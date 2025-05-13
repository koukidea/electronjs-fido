const { contextBridge, ipcRenderer } = require('electron');

const initialCardPresent = ipcRenderer.sendSync('card-get-initial');

contextBridge.exposeInMainWorld('card', {
    request: (payload) => ipcRenderer.invoke('card-request', payload),

    onCardConnected: (cb) => ipcRenderer.on('card-connected', () => cb()),
    onCardDisconnected: (cb) => ipcRenderer.on('card-disconnected', () => cb()),

    simulateConnect: () => ipcRenderer.emit('card-connected'),
    simulateDisconnect: () => ipcRenderer.emit('card-disconnected'),
});


contextBridge.exposeInMainWorld('initialCardPresent', initialCardPresent);
