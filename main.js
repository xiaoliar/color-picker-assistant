import { app, BrowserWindow, Menu, dialog, ipcMain, clipboard } from 'electron';
import { dirname, join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { mouse, straightTo, Point } from '@nut-tree-fork/nut-js';
import { getRecentPaths, addRecentPath, clearRecentPaths } from './store.js';
import { fileURLToPath } from 'url';

// 模拟 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow; // 提升为全局变量
let mainMenu;
let lastOpenPath = undefined;

async function openImageDialog(win, defaultPath = undefined) {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Images',
        defaultPath,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'svg'] }],
        properties: ['openFile', 'multiSelections', 'createDirectory']
    });

    if (canceled || filePaths.length === 0) return;

    win.webContents.send('load-images', filePaths);
    const dir = dirname(filePaths[0]);
    lastOpenPath = dir;
    addRecentPath(dir); // 更新 recent 列表
    refreshMenu(); // 重新刷新菜单，更新 recent 子菜单
}

function refreshMenu() {
    createMenu(); // 相当于重新构建 recent 部分
}

function createMenu() {
    const recentPaths = getRecentPaths();
    const recentSubmenu = recentPaths.length > 0
        ? recentPaths.map(p => ({
            label: p,
            click: () => openImageDialog(mainWindow, p)
        })).concat([
            { type: 'separator' },
            {
                label: 'Clear Recent',
                click: () => {
                    clearRecentPaths();
                    refreshMenu();
                }
            }
        ])
        : [{ label: 'No recent paths', enabled: false }];

    mainMenu = Menu.buildFromTemplate([
        {
            role: "appmenu"
        },
        {
            label: 'Image',
            submenu: [
                {
                    label: 'Open Image',
                    id: 'open-image',
                    click: () => openImageDialog(mainWindow, lastOpenPath)
                },
                {
                    label: 'Open Recent',
                    id: 'open-recent',
                    submenu: recentSubmenu
                },
                {
                    label: 'Capture Selected Area',
                    id: 'capture-selected-area',
                    click: () => {
                        mainWindow.webContents.send('trigger-capture');
                    }
                },
            ]
        },
        {
            role: "windowmenu"
        },
        {
            role: "viewMenu"
        },
        {
            role: 'editMenu'
        }
    ]);
    Menu.setApplicationMenu(mainMenu);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        show: false,
        // 去除默认标题栏
        titleBarStyle: 'hidden',
        // expose window controls in Windows/Linux
        /**
         * 在MacOS上，设置titleBarStyle: 'hidden'会去除标题栏，保留窗口左上角的红绿灯控件。 
         * 但是在Windows和Linux上，你需要通过设置titleBarOverlay参数来将窗口控件添加回你的BrowserWindow。
         * 设置titleBarOverlay: true是将窗口控件添加回你的BrowserWindow最简单的方法。
         */
        ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),

        // frame: false,
        // transparent: true,
        // autoHideMenuBar: true,
        // icon: 'logon.png',
        // title: '标题',
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true // 上下文隔离
        }
    });

    mainWindow.loadFile('renderer/index.html').then(() => mainWindow.show());
}

app.whenReady().then(() => {
    createMenu(); // 先创建菜单
    setupIpc(); // 只注册一次即可
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('open-file', (event, path) => {
    event.preventDefault();
    mainWindow.webContents.send('load-images', path);
});

function setupIpc() {
    ipcMain.handle('trigger-menu-item', (event, menuId) => {
        const item = mainMenu.getMenuItemById(menuId);
        if (item && typeof item.click === 'function') {
            item.click({}, mainWindow, event);
        }
    });

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

    ipcMain.on('simulate-click', async (event) => {
        await mouse.leftClick();
    });

    // 显示右键菜单
    let currentItem = {};
    ipcMain.on('show-color-item-menu', (event, item) => {
        currentItem = item;
        const win = BrowserWindow.fromWebContents(event.sender);
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
        const menu = Menu.buildFromTemplate([
            {
                label: '导出全部颜色',
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

    ipcMain.on('show-image-item-menu', (event, item) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '保存',
                click: async () => {
                    const { canceled, filePath } = await dialog.showSaveDialog(win, {
                        title: '保存图片',
                        defaultPath: item.filename || `${Date.now()}.png`,
                        filters: [
                            { name: 'PNG Image', extensions: ['png'] }
                        ]
                    });
                    if (canceled || !filePath) return;

                    try {
                        const base64Data = item.data.replace(/^data:image\/\w+;base64,/, '');
                        const buffer = Buffer.from(base64Data, 'base64');
                        await writeFile(filePath, buffer);
                        console.log('图片已保存到', filePath);
                    } catch (err) {
                        console.error('保存失败:', err);
                    }
                }
            },
            {
                type: 'separator',
            },
            {
                label: '删除',
                click: () => {
                    win.webContents.send('delete-image-item');
                }
            }
        ]);
        contextMenu.popup({ window: win });
    });

    ipcMain.on('show-image-list-menu', (event, list) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const menu = Menu.buildFromTemplate([
            {
                label: '导出全部图片',
                click: () => {
                    win.webContents.send('export-all-image-item');
                }
            },
            {
                type: 'separator',
            },
            {
                label: '清空全部',
                click: () => {
                    win.webContents.send('delete-all-image-item');
                }
            }
        ]);
        menu.popup({ window: win });
    });

    ipcMain.on('show-rect-item-menu', (event, item) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '使用',
                click: async () => {
                    win.webContents.send('update-context-rect', item);
                }
            },
            {
                type: 'separator',
            },
            {
                label: '删除',
                click: () => {
                    win.webContents.send('delete-rect-item');
                }
            }
        ]);
        contextMenu.popup({ window: win });
    });

    ipcMain.on('show-rect-list-menu', (event, list) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const menu = Menu.buildFromTemplate([
            {
                label: '导出全部矩形',
                click: () => {
                    win.webContents.send('export-all-rect-item');
                }
            },
            {
                type: 'separator',
            },
            {
                label: '清空全部',
                click: () => {
                    win.webContents.send('delete-all-rect-item');
                }
            }
        ]);
        menu.popup({ window: win });
    });

    ipcMain.on('show-recent-menu', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        // 直接使用之前创建的菜单
        const item = mainMenu.getMenuItemById('open-recent');
        item?.submenu?.popup({ window: win });
    });

    ipcMain.on('show-input-rect-menu', (event, rectStr) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const menu = Menu.buildFromTemplate([
            {
                label: '复制',
                click: () => {
                    clipboard.writeText(rectStr);
                    console.log('已复制:', rectStr);
                    win.webContents.send('copy-input-rect');
                }
            },
            {
                label: '粘贴',
                click: () => {
                    const content = clipboard.readText('clipboard');
                    win.webContents.send('paste-input-rect', content);
                }
            },
            {
                type: 'separator',
            },
            {
                label: '清空',
                click: () => {
                    win.webContents.send('delete-input-rect');
                }
            }
        ]);
        menu.popup({ window: win });
    });
}

