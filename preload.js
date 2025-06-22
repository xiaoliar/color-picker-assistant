const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onLoadImages: (callback) => ipcRenderer.on('load-images', (event, paths) => callback(paths)),
    onTriggerCapture: (callback) => ipcRenderer.on('trigger-capture', (event) => callback()),
    simulateClick: () => ipcRenderer.send('simulate-click'),
    moveMouseRelative: (dx, dy) => ipcRenderer.invoke('move-mouse-relative', dx, dy),
    sendCmd: (action, id) => {
        if (action === 'show-menu') {
            ipcRenderer.send(id);
        } else if (action === 'trigger-menu-item') {
            return ipcRenderer.invoke('trigger-menu-item', id);
        }
    },
    showRecentMenu: () => ipcRenderer.send('show-recent-menu'),

    // 颜色列表相关
    showColorListMenu: (item) => ipcRenderer.send('show-color-list-menu', item),
    showColorItemMenu: (item) => ipcRenderer.send('show-color-item-menu', item),
    onDeleteColorItem: (callback) => ipcRenderer.on('delete-color-item', (event) => callback()),
    onDeleteAllColorItem: (callback) => ipcRenderer.on('delete-all-color-item', (event) => callback()),
    onExportAllColorItem: (callback) => ipcRenderer.on('export-all-color-item', (event) => callback()),

    // 图片列表相关
    showImageListMenu: (item) => ipcRenderer.send('show-image-list-menu', item),
    showImageItemMenu: (item) => ipcRenderer.send('show-image-item-menu', item),
    onDeleteImageItem: (callback) => ipcRenderer.on('delete-image-item', (event) => callback()),
    onDeleteAllImageItem: (callback) => ipcRenderer.on('delete-all-image-item', (event) => callback()),
    onExportAllImageItem: (callback) => ipcRenderer.on('export-all-image-item', (event) => callback()),

    // 矩形列表相关
    showRectListMenu: (item) => ipcRenderer.send('show-rect-list-menu', item),
    showRectItemMenu: (item) => ipcRenderer.send('show-rect-item-menu', item),
    onDeleteRectItem: (callback) => ipcRenderer.on('delete-rect-item', (event) => callback()),
    onDeleteAllRectItem: (callback) => ipcRenderer.on('delete-all-rect-item', (event) => callback()),
    onExportAllRectItem: (callback) => ipcRenderer.on('export-all-rect-item', (event) => callback()),
    onUpdateContextRect: (callback) => ipcRenderer.on('update-context-rect', (event) => callback()),
    
    // 输入矩形
    showInputRectMenu: (rectStr) => ipcRenderer.send('show-input-rect-menu', rectStr),
    onCopyInputRect: (callback) => ipcRenderer.on('copy-input-rect', (event) => callback()),
    onPasteInputRect: (callback) => ipcRenderer.on('paste-input-rect', (event, content) => callback(content)),
    onDeleteInputRect: (callback) => ipcRenderer.on('delete-input-rect', (event) => callback()),

});
