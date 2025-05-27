const { app, BrowserWindow, Menu, dialog, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const { mouse, straightTo, Point } = require('@nut-tree-fork/nut-js');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 675,
        minWidth: 400,
        minHeight: 300,
        show: false,
        // frame: false,
        // transparent: true,
        // autoHideMenuBar: true,
        // icon: 'logon.png',
        // title: '标题',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true // 上下文隔离
        }
    });
    const menu = Menu.buildFromTemplate([
        {
            role: "appmenu"
        },
        {
            label: 'Image',
            submenu: [
                {
                    label: 'Open Image',
                    click: async () => {
                        const result = await dialog.showOpenDialog({
                            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
                            properties: ['openFile', 'multiSelections']
                        });
                        if (!result.canceled) {
                            mainWindow.webContents.send('load-images', result.filePaths);
                        }
                    }
                },
                {
                    label: 'Capture Selected Area',
                    click: () => {
                        mainWindow.webContents.webContents.send('trigger-capture');
                    }
                },
            ]
        },
        {
            role: "windowmenu"
        },
        {
            role: "viewMenu"
        }
    ]);
    Menu.setApplicationMenu(menu);
    mainWindow.loadFile('renderer/index.html').then(() => mainWindow.show());
}

app.whenReady().then(() => {
    setupIpc();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});




function setupIpc() {
    // 接收指令，根据方向移动鼠标1像素
    ipcMain.handle('move-mouse-relative', async (event, dx, dy) => {
        try {
            const pos = await mouse.getPosition();
            const newPos = new Point(pos.x + dx, pos.y + dy);
            await mouse.move(straightTo(newPos));
            return { success: true, x: newPos.x, y: newPos.y };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // 显示右键菜单
    let currentItem = {};
    ipcMain.on('show-color-item-menu', (event, item) => {
        currentItem = item;
        const win = BrowserWindow.fromWebContents(event.sender);
        // 创建右键菜单
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '复制坐标',
                click: () => {
                    clipboard.writeText(currentItem.pos);
                    console.log('已复制:', currentItem.pos);
                }
            },
            {
                type: 'separator',
            },
            {
                label: '复制颜色值(hex)',
                click: () => {
                    console.log(currentItem)
                    clipboard.writeText(currentItem.hex);
                    console.log('已复制:', currentItem.hex);
                }
            },
            {
                label: '复制颜色值(rgb)',
                click: () => {
                    clipboard.writeText(currentItem.rgb);
                    console.log('已复制:', currentItem.rgb);
                }
            },
            {
                type: 'separator',
            },
            {
                label: '删除',
                click: () => {
                    win.webContents.send('delete-color-item');
                }
            }
        ]);
        contextMenu.popup({ window: win });
    });

    ipcMain.on('show-color-list-menu', (event, list) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        // 创建右键菜单
        const menu = Menu.buildFromTemplate([
            {
                label: '导出',
                click: () => {
                    win.webContents.send('export-all-color-item');
                }
            },
            {
                type: 'separator',
            },
            {
                label: '清空全部',
                click: () => {
                    win.webContents.send('delete-all-color-item');
                }
            }
        ]);
        menu.popup({ window: win });
    });
}

