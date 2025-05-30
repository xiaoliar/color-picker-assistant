const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onLoadImages: (callback) => ipcRenderer.on('load-images', (event, paths) => callback(paths)),
    onTriggerCapture: (callback) => ipcRenderer.on('trigger-capture', (event) => callback()),
    moveMouseRelative: (dx, dy) => ipcRenderer.invoke('move-mouse-relative', dx, dy),
    showColorListMenu: (item) => ipcRenderer.send('show-color-list-menu', item),
    showColorItemMenu: (item) => ipcRenderer.send('show-color-item-menu', item),
    onDeleteColorItem: (callback) => ipcRenderer.on('delete-color-item', (event) => callback()),
    onDeleteAllColorItem: (callback) => ipcRenderer.on('delete-all-color-item', (event) => callback()),
    onExportAllColorItem: (callback) => ipcRenderer.on('export-all-color-item', (event) => callback()),
    simulateClick: () => ipcRenderer.send('simulate-click'),
});
