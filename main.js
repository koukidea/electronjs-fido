const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const CARD_PATH = '/dev/ttyUSB0';
let isCardPresent = false;
let cardPort, cardParser;

let win, port, parser;

ipcMain.on('card-get-initial', (e) => {
    e.returnValue = isCardPresent;
});

function createWindow() {
    win = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    Menu.setApplicationMenu(null);
    win.loadFile(path.join(__dirname, 'src/index.html'));
}

app.whenReady().then(() => {
    createWindow();

    checkCardPresence();

    setInterval(checkCardPresence, 2000);

    port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.on('error', (err) => console.error('SerialPort Error:', err));
    port.on('open', () => win.webContents.send('serial-opened'));
});

ipcMain.handle('card-request', (_evt, payload) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            parser.off('data', onData);
            reject(new Error('Kart’tan cevap gelmedi (timeout)'));
        }, 3000);

        function onData(line) {
            clearTimeout(timer);
            parser.off('data', onData);
            resolve(line.trim() === 'true');
        }

        parser.on('data', onData);
        port.write(payload + '\n', (err) => {
            if (err) {
                clearTimeout(timer);
                parser.off('data', onData);
                reject(err);
            }
        });
    });
});

app.on('window-all-closed', () => {
    if (port?.isOpen) port.close();
    if (process.platform !== 'darwin') app.quit();
});

async function checkCardPresence() {
    const ports = await SerialPort.list();
    const found = ports.some((p) => p.path === CARD_PATH);

    if (found && !isCardPresent) {
        isCardPresent = true;
        win.webContents.send('card-connected');
        openCardPort();
    } else if (!found && isCardPresent) {
        isCardPresent = false;
        win.webContents.send('card-disconnected');
        closeCardPort();
    }
}

function openCardPort() {
    cardPort = new SerialPort({ path: CARD_PATH, baudRate: 115200 });
    cardParser = cardPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    cardPort.on('open', () => win.webContents.send('serial-opened'));
    cardPort.on('error', (err) => win.webContents.send('serial-error', err.message));
    cardPort.on('close', () => win.webContents.send('serial-closed'));

    cardParser.on('data', (line) => win.webContents.send('serial-data', line.trim()));
}

function closeCardPort() {
    if (cardPort && cardPort.isOpen) cardPort.close();
}
