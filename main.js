const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
// const { ReadlineParser } = require('@serialport/parser-readline'); // Yorumlandı
const cbor = require('cbor'); // 'cbor' kütüphanesi kullanılıyor
const crypto = require('crypto'); // crypto eklendi

const CARD_PATH = '/dev/ttyUSB0';
let isCardPresent = false;
let cardPort;

let win;

const PKT_SIZE = 64;
const CMD_CBOR = 0x10;
const CHANNEL_ID = Buffer.from('FFFFFFFF', 'hex'); // CTAP HID Broadcast Channel ID

ipcMain.on('card-get-initial', (e) => {
    e.returnValue = isCardPresent;
});

function createWindow() {
    win = new BrowserWindow({
        width: 800, 
        height: 700,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    //Menu.setApplicationMenu(null);
    win.loadFile(path.join(__dirname, 'src/index.html'));
    win.webContents.openDevTools(); 
}

app.whenReady().then(() => {
    createWindow();

    checkCardPresence();

    setInterval(checkCardPresence, 3000); // Kontrol aralığı 3 saniye
});

function getClientDataHash(challenge, type = 'webauthn.create', origin = 'https://example.com') {
    // Bu fonksiyon zaten dinamik hash üretiyor, olduğu gibi kalabilir.
    const clientDataJSON = {
        type: type,
        challenge: challenge, // Base64URL encoded challenge string
        origin: origin,
        crossOrigin: false
    };
    const jsonString = JSON.stringify(clientDataJSON);
    return crypto.createHash('sha256').update(jsonString).digest();
}

function buildCtapPayload(op, requestData) {
    let cmdByte;
    let body;
    const clientDataHash = getClientDataHash(requestData.challenge, requestData.type, requestData.rpId);

    if (op === 'makeCredential') {
        cmdByte = 0x01; // authenticatorMakeCredential
        body = {
            1: clientDataHash,
            2: { 'id': requestData.rpId, 'name': requestData.rpName },
            3: { 
                'id': Buffer.from(requestData.userId, 'hex'),
                'name': requestData.userName,
                'displayName': requestData.userDisplayName,
            },
            4: requestData.pubKeyCredParams, // örn: [{ type: 'public-key', alg: -5 }]
            7: { 'rk': true } // Python'daki gibi her zaman rk: true
        };
        

    } else if (op === 'getAssertion') {
        cmdByte = 0x02; // authenticatorGetAssertion
        body = {
            1: requestData.rpId, // Relying Party ID
            2: clientDataHash,
        };

    } else {
        throw new Error('Unknown CTAP operation: ' + op);
    }
    const encodedBody = cbor.encode(body);
    return Buffer.concat([Buffer.from([cmdByte]), encodedBody]);
}

function buildCtapHidPackets(cborCommandPayload) {
    const packets = [];
    const totalLength = cborCommandPayload.length;

    const initHeader = Buffer.alloc(7);
    CHANNEL_ID.copy(initHeader, 0); // cid
    initHeader.writeUInt8(CMD_CBOR | 0x80, 4); // cmd (CTAP_INIT bit set)
    initHeader.writeUInt16BE(totalLength, 5); // bcnt

    let dataToSend = cborCommandPayload;
    let chunk = dataToSend.subarray(0, PKT_SIZE - initHeader.length);
    const initPacket = Buffer.alloc(PKT_SIZE, 0);
    initHeader.copy(initPacket, 0);
    chunk.copy(initPacket, initHeader.length);
    packets.push(initPacket);

    dataToSend = dataToSend.subarray(chunk.length);
    let seq = 0;
    while (dataToSend.length > 0) {
        const contHeader = Buffer.alloc(5);
        CHANNEL_ID.copy(contHeader, 0); // cid
        contHeader.writeUInt8(seq & 0x7F, 4); // seq (INIT bit not set)

        chunk = dataToSend.subarray(0, PKT_SIZE - contHeader.length);
        const contPacket = Buffer.alloc(PKT_SIZE, 0);
        contHeader.copy(contPacket, 0);
        chunk.copy(contPacket, contHeader.length);
        packets.push(contPacket);

        dataToSend = dataToSend.subarray(chunk.length);
        seq++;
        if (seq > 0x7F) {
            throw new Error("CTAP message too long, sequence number overflow.");
        }
    }
    return packets;
}

let activeCtapRequest = null;

function resetActiveCtapRequest() {
    if (activeCtapRequest) {
        clearTimeout(activeCtapRequest.timer);
        activeCtapRequest = null;
    }
    if (cardPort && cardPort.isOpen) {
        cardPort.removeAllListeners('data');
    }
    // Reset buffer states for assembly
    incomingCtapBuffer = Buffer.alloc(0);
    expectedCtapLength = 0;
    currentCtapChannelId = null;
    assembledData = Buffer.alloc(0);
}

// Globals for assembling incoming CTAP HID packets
let incomingCtapBuffer = Buffer.alloc(0);
let expectedCtapLength = 0;
let currentCtapChannelId = null;
let assembledData = Buffer.alloc(0);

function processIncomingData(dataChunk) {
    if (!activeCtapRequest || !activeCtapRequest.promiseFns) {
        console.warn("Incoming data ignored: No active CTAP request or promise functions.");
        return;
    }

    incomingCtapBuffer = Buffer.concat([incomingCtapBuffer, dataChunk]);

    while (incomingCtapBuffer.length > 0) {
        if (expectedCtapLength === 0) { // Looking for an initialization packet
            if (incomingCtapBuffer.length < 7) return; // Not enough data for init header

            const packetChannelId = incomingCtapBuffer.subarray(0, 4);
            const cmdOrSeq = incomingCtapBuffer.readUInt8(4);

            // Kanal ID kontrolü (gelen CID ya broadcast ya da aktif isteğin CID'i olmalı)
            if (!packetChannelId.equals(CHANNEL_ID) && 
                (activeCtapRequest.sentChannelId && !packetChannelId.equals(activeCtapRequest.sentChannelId))) {
                console.warn(`Data on unexpected channel ${packetChannelId.toString('hex')}. Expected ${activeCtapRequest.sentChannelId ? activeCtapRequest.sentChannelId.toString('hex') : CHANNEL_ID.toString('hex')}. Discarding packet.`);
                incomingCtapBuffer = incomingCtapBuffer.subarray(PKT_SIZE > incomingCtapBuffer.length ? incomingCtapBuffer.length : PKT_SIZE);
                continue;
            }
            
            if ((cmdOrSeq & 0x80) !== 0) { // Initialization packet
                currentCtapChannelId = packetChannelId; // Store the channel ID for this transaction
                const cmd = cmdOrSeq & 0x7F;
                if (cmd !== CMD_CBOR) {
                    console.error(`Unexpected CTAP command: 0x${cmd.toString(16)}. Expected 0x${CMD_CBOR.toString(16)}`);
                    resetActiveCtapRequest();
                    activeCtapRequest.promiseFns.reject(new Error(`Unexpected CTAP command: 0x${cmd.toString(16)}`));
                    return;
                }

                expectedCtapLength = incomingCtapBuffer.readUInt16BE(5);
                const firstPayloadFragment = incomingCtapBuffer.subarray(7, Math.min(7 + expectedCtapLength, PKT_SIZE));
                assembledData = Buffer.from(firstPayloadFragment);
                
                incomingCtapBuffer = incomingCtapBuffer.subarray(PKT_SIZE > incomingCtapBuffer.length ? incomingCtapBuffer.length : PKT_SIZE);

                if (assembledData.length >= expectedCtapLength) {
                    handleCompleteMessage(assembledData.subarray(0, expectedCtapLength));
                    return;
                }
            } else { // Continuation packet (or unexpected data)
                console.warn("Received continuation packet before an initialization packet, or data is out of sync. Discarding.");
                incomingCtapBuffer = incomingCtapBuffer.subarray(PKT_SIZE > incomingCtapBuffer.length ? incomingCtapBuffer.length : PKT_SIZE);
                // Potentially reset or attempt to re-sync
                continue;
            }
        } else { // Assembling a message
            if (!currentCtapChannelId) {
                 console.error("Error: Trying to assemble message without a current channel ID.");
                 resetActiveCtapRequest();
                 activeCtapRequest.promiseFns.reject(new Error("Internal error: No current channel ID during assembly."));
                 return;
            }
            if (incomingCtapBuffer.length < 5) return; // Not enough for cont. header

            const packetChannelId = incomingCtapBuffer.subarray(0, 4);
            if (!packetChannelId.equals(currentCtapChannelId)) {
                console.warn(`Continuation packet on wrong channel: ${packetChannelId.toString('hex')}. Expected: ${currentCtapChannelId.toString('hex')}. Discarding.`);
                incomingCtapBuffer = incomingCtapBuffer.subarray(PKT_SIZE > incomingCtapBuffer.length ? incomingCtapBuffer.length : PKT_SIZE);
                continue;
            }
            // const seq = incomingCtapBuffer.readUInt8(4); // Sequence check can be added for robustness

            const bytesNeeded = expectedCtapLength - assembledData.length;
            const payloadFragment = incomingCtapBuffer.subarray(5, Math.min(5 + bytesNeeded, PKT_SIZE));
            assembledData = Buffer.concat([assembledData, payloadFragment]);
            
            incomingCtapBuffer = incomingCtapBuffer.subarray(PKT_SIZE > incomingCtapBuffer.length ? incomingCtapBuffer.length : PKT_SIZE);

            if (assembledData.length >= expectedCtapLength) {
                handleCompleteMessage(assembledData.subarray(0, expectedCtapLength));
                return;
            }
        }
        if (incomingCtapBuffer.length === 0) break;
    }
}

function handleCompleteMessage(fullMessagePayload) {
    if (!activeCtapRequest || !activeCtapRequest.promiseFns) {
        console.error("Cannot handle complete message: No active request or promise functions.");
        resetActiveCtapRequest(); // Clean up partially
        return;
    }

    const { resolve, reject } = activeCtapRequest.promiseFns;
    // const operation = activeCtapRequest.operation; // Yanıtı şimdilik yorumlamadık

    try {
        const statusCode = fullMessagePayload.readUInt8(0);
        const cborResponseData = fullMessagePayload.slice(1);

        if (statusCode === 0x00) { // CTAP1_ERR_SUCCESS
            // CBOR decode edip gönder
            const decodedData = cbor.decodeFirstSync(cborResponseData);
            console.log("Authenticator Response (Decoded CBOR):", decodedData);
            resolve(decodedData);
        } else {
            let errorMsg = `CTAP Error from authenticator: 0x${statusCode.toString(16)}`;
            console.warn(errorMsg, "Raw error payload:", cborResponseData.toString('hex'));
            try {
                // Hata yanıtı CBOR ise decode et, değilse ignore
                const errorDetails = cbor.decodeFirstSync(cborResponseData);
                errorMsg += ` (${JSON.stringify(errorDetails)})`;
            } catch (e) { /* Ignore if error payload is not valid CBOR */ }
            reject(new Error(errorMsg));
        }
    } catch (err) {
        console.error("Error decoding CTAP CBOR response:", err, "Payload:", fullMessagePayload.toString('hex'));
        reject(new Error('Failed to decode CBOR response from authenticator: ' + err.message));
    } finally {
        resetActiveCtapRequest();
    }
}

ipcMain.handle('card-request', async (_evt, request) => {
    if (!cardPort || !cardPort.isOpen) {
        throw new Error('Card port is not open or not defined.');
    }
    if (activeCtapRequest) {
        throw new Error('Another card operation is already in progress.');
    }

    let promiseResolve, promiseReject;
    const promise = new Promise((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;
    });

    const timeout = 30000; // default 30s
    const timer = setTimeout(() => {
        if (activeCtapRequest) { // Check if request is still active
            console.warn(`CTAP request timed out after ${timeout/1000}s for op: ${request.operation}`);
            activeCtapRequest.promiseFns.reject(new Error(`Authenticator communication timed out (${timeout/1000}s).`));
            resetActiveCtapRequest();
        }
    }, timeout);

    activeCtapRequest = {
        operation: request.operation,
        promiseFns: { resolve: promiseResolve, reject: promiseReject },
        timer: timer,
        sentChannelId: CHANNEL_ID // Assuming we send on broadcast, device might respond on a different one.
    };

    try {
        console.log(`Building CTAP payload for operation: ${request.operation}`, request);
        const ctapCommandPayload = buildCtapPayload(request.operation, request.data);
        console.log(`CTAP command payload (hex): ${ctapCommandPayload.toString('hex')}`);
        
        const packets = buildCtapHidPackets(ctapCommandPayload);
        console.log(`Sending ${packets.length} packets...`);

        cardPort.on('data', processIncomingData);

        for (const [index, packet] of packets.entries()) {
            await new Promise((pResolve, pReject) => {
                cardPort.write(packet, (err) => {
                    if (err) {
                        console.error(`Error writing packet ${index + 1}/${packets.length}:`, err);
                        return pReject(err);
                    }
                    // console.log(`Packet ${index + 1}/${packets.length} sent.`);
                    pResolve();
                });
            });
        }
        console.log("All packets sent. Waiting for response...");
    } catch (error) {
        console.error("Error during card request preparation or sending:", error);
        activeCtapRequest.promiseFns.reject(error); // Reject the main promise
        resetActiveCtapRequest();
    }
    return promise; // Return the promise that will be resolved/rejected by handlers
});

app.on('window-all-closed', () => {
    if (cardPort?.isOpen) {
        cardPort.close(() => console.log("Card port closed on app quit."));
    }
    if (process.platform !== 'darwin') app.quit();
});

async function checkCardPresence() {
    try {
    const ports = await SerialPort.list();
        const found = ports.some((p) => {
            // Örnek: CARD_PATH = 'COM3' (Windows) veya '/dev/ttyUSB0' (Linux)
            return p.path === CARD_PATH;
        });

    if (found && !isCardPresent) {
            console.log(`Card found at ${CARD_PATH}. Attempting to open port...`);
        openCardPort();
    } else if (!found && isCardPresent) {
            console.log(`Card at ${CARD_PATH} removed or no longer available. Closing port...`);
        closeCardPort();
        }
    } catch (error) {
        console.error("Error listing serial ports:", error);
        if (isCardPresent) closeCardPort(); // Hata durumunda port açıksa kapat
    }
}

function openCardPort() {
    if (cardPort && cardPort.isOpen) return;
    
    console.log(`Opening card port: ${CARD_PATH}`);
    cardPort = new SerialPort({ path: CARD_PATH, baudRate: 115200 });

    cardPort.on('open', () => {
        console.log(`Card port ${CARD_PATH} opened successfully.`);
        isCardPresent = true;
        if (win) win.webContents.send('card-connected', CARD_PATH);
    });

    cardPort.on('error', (err) => {
        console.error(`Card port ${CARD_PATH} error:`, err.message);
        // Port hatası durumunda, port zaten kapanmış olabilir veya hiç açılamamış olabilir.
        // `isCardPresent` ve `card-disconnected` emit etmeden önce durumu kontrol et.
        if (isCardPresent) { // Sadece daha önce bağlıysa ve şimdi hata oluştuysa
            isCardPresent = false;
            if (win) win.webContents.send('card-disconnected', CARD_PATH);
        }
        // Portu manuel olarak kapatmaya çalışmaya gerek yok, 'error' eventi genelde portun kullanılamaz olduğu anlamına gelir.
    });

    cardPort.on('close', () => {
        console.log(`Card port ${CARD_PATH} closed.`);
        const previouslyPresent = isCardPresent;
        isCardPresent = false;
        if (previouslyPresent && win) { // Sadece daha önce bağlıysa ve şimdi kapandıysa
            win.webContents.send('card-disconnected', CARD_PATH);
        }
    });
}

function closeCardPort() {
    if (cardPort && cardPort.isOpen) {
        console.log(`Closing card port: ${CARD_PATH}`);
        cardPort.close((err) => {
            if (err) console.error(`Error closing card port ${CARD_PATH}:`, err.message);
            // 'close' event handler zaten isCardPresent'ı ve 'card-disconnected'ı yönetir.
        });
    } else {
         // Port zaten kapalıysa veya tanımlı değilse, durumu güncelle
        if (isCardPresent) {
            isCardPresent = false;
            if (win) win.webContents.send('card-disconnected', CARD_PATH);
        }
    }
}
