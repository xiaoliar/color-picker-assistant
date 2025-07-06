const colorSwatch = document.getElementById('color-swatch');
const colorText = document.getElementById('color-text');

const tabBar = document.getElementById('tab-bar');
const tabPanels = document.getElementById('tab-panels');

const inputRect = document.getElementById('input-rect');
const btnAddRect = document.getElementById('btn-add-rect');

const tabButtons = document.querySelectorAll('#tab-buttons .tab-btn');
const tabContents = document.querySelectorAll('#tab-contents .tab-content');
const colorList = document.querySelector('#tab-contents .tab-content[data-tab=color]');
const imageList = document.querySelector('#tab-contents .tab-content[data-tab=image]');
const rectList = document.querySelector('#tab-contents .tab-content[data-tab=rect]');

document.querySelectorAll('[data-menu-id]').forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.menuId;
        window.electronAPI.sendCmd(action, id);
    });
});


function colorMatch(c1, c2, threshold, algorithm) {
    switch (algorithm) {
        case 'equal':
            return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2];

        case 'diff':
            return (
                Math.abs(c1[0] - c2[0]) +
                Math.abs(c1[1] - c2[1]) +
                Math.abs(c1[2] - c2[2])
            ) <= threshold;

        case 'rgb':
            return Math.sqrt(
                Math.pow(c1[0] - c2[0], 2) +
                Math.pow(c1[1] - c2[1], 2) +
                Math.pow(c1[2] - c2[2], 2)
            ) <= threshold;

        case 'rgb+': {
            const rMean = (c1[0] + c2[0]) / 2;
            const r = c1[0] - c2[0];
            const g = c1[1] - c2[1];
            const b = c1[2] - c2[2];
            const distance = Math.sqrt(
                (2 + rMean / 256) * r * r +
                4 * g * g +
                (2 + (255 - rMean) / 256) * b * b
            );
            return distance <= threshold;
        }

        case 'hs': {
            const [h1, s1] = rgb2hs(c1);
            const [h2, s2] = rgb2hs(c2);
            const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2)); // 环状角度
            const ds = Math.abs(s1 - s2);
            return Math.sqrt(dh * dh + ds * ds) <= threshold;
        }

        default:
            return false;
    }
}

function rgb2hs([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0, s = 0;

    if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = ((b - r) / delta) + 2;
        else h = ((r - g) / delta) + 4;

        h *= 60;
        if (h < 0) h += 360;
    }

    s = max === 0 ? 0 : delta / max;
    return [h, s];
}


function findMultiColorMatch(imageData, rect, colorList, threshold = 20, algorithm = 'rgb+') {
    const { data, width, height } = imageData;
    const [baseX, baseY] = colorList[0].pos;

    const matchPattern = colorList.map(c => {
        const [x, y] = c.pos;
        return {
            dx: x - baseX,
            dy: y - baseY,
            rgb: c.rgb
        };
    });

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let matched = true;

            for (let { dx, dy, rgb } of matchPattern) {
                const tx = x + dx;
                const ty = y + dy;

                if (tx < 0 || ty < 0 || tx >= width || ty >= height) {
                    matched = false;
                    break;
                }

                const index = (ty * width + tx) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];

                if (!colorMatch([r, g, b], rgb, threshold, algorithm)) {
                    matched = false;
                    break;
                }
            }

            if (matched) {
                const result = { x: rect.x + x, y: rect.y + y };
                showToast(`找到匹配颜色: (${result.x}, ${result.y})`, 'success');
                return result;
            }
        }
    }

    showToast('没有找到匹配的颜色', 'info');
    return null;
}


document.getElementById('btn-find-multicolor').addEventListener('click', () => {
    const colors = getSelectedColorList();

    if (colors.length === 0) {
        showToast('请先添加颜色', 'error');
        return;
    }
    console.log('多点找色:', colors);

    if (!currentImageContext) {
        showToast('当前没有图片上下文', 'error');
        return;
    }

    const { imageCanvas, imgCtx, pointer, startPoint, endPoint } = currentImageContext;
    pointer.style.display = 'none';
    const rect = getSelectedRect(imageCanvas, startPoint, endPoint);
    console.log('rect:', rect);
    const imageData = imgCtx.getImageData(rect.x, rect.y, rect.w, rect.h);
    const threshold = parseInt(document.getElementById('threshold-input')?.value || '20', 10);
    const algorithm = document.getElementById('algorithm-select').value;

    const result = findMultiColorMatch(imageData, rect, colors, threshold, algorithm);
    if (result) {
        console.log("匹配成功:", result);
        showPointerAt(pointer, result);
    }
});

function showPointerAt(pointer, point) {
    // point 是 CSS 坐标，直接用
    pointer.style.left = `${point.x}px`;
    pointer.style.top = `${point.y}px`;
    pointer.style.display = 'block';
}

function getSelectedColorList() {
    const colors = [...colorList.querySelectorAll('.color-item')].map(e => {
        const hex = e.dataset.hex; // #RRGGBB 格式
        const rgb = e.dataset.rgb.split(',').map(Number); // [r, g, b] 格式
        const pos = e.dataset.pos.split(',').map(Number); // [x, y] 格式
        return { hex, rgb, pos };
    });
    return colors;
}

function getSelectedRect(imageCanvas, startPoint, endPoint) {
    const rect = calRect(startPoint, endPoint);

    if (rect.x < 0 || rect.y < 0) {
        rect.x = 0;
        rect.y = 0;
        rect.w = imageCanvas.width;
        rect.h = imageCanvas.height;
    }

    return rect;
}

function showTab(tab) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    tabContents.forEach(panel => panel.classList.toggle('active', panel.dataset.tab === tab));
}

// 初始化默认激活第一个tab
if (tabButtons.length > 0) {
    showTab(tabButtons[0].dataset.tab);
}

// 绑定事件
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        showTab(btn.dataset.tab);
    });
    btn.addEventListener('contextmenu', e => {
        e.preventDefault(); // 阻止默认菜单

        // 找到对应 panel
        const panel = [...tabContents]
            .find(p => p.dataset.tab === btn.dataset.tab);

        if (panel) {
            // 创建并分发 contextmenu 事件
            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                clientX: e.clientX,
                clientY: e.clientY,
            });

            panel.dispatchEvent(event);
        }
    });
});

function updateBadgeFromList(tabName, listElement) {
    const count = listElement.children.length;
    updateTabBadge(tabName, count);
}

function observeList(tabName, listElement) {
    const observer = new MutationObserver(() => {
        updateBadgeFromList(tabName, listElement);
    });

    observer.observe(listElement, { childList: true, subtree: false });
    // 初始化一次
    updateBadgeFromList(tabName, listElement);
}

tabContents.forEach(panel => {
    observeList(panel.dataset.tab, panel);
});


function updateTabBadge(tabName, count) {
    const wrapper = document.querySelector(`.tab-btn-wrapper button[data-tab="${tabName}"]`)?.parentElement;
    if (!wrapper) return;

    const badge = wrapper.querySelector('.tab-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// 匹配 [x, y, w, h] 格式，x/y/w/h 为整数
const rectPattern = /^\[\s*\d+\s*,\s*\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*\]$/;
inputRect.addEventListener('input', e => {
    const value = e.target.value.trim();
    if (!rectPattern.test(value)) return;
    if (!currentImageContext) return;

    const nums = value.match(/-?\d+/g).map(Number);
    const [x, y, w, h] = nums;
    // console.log('有效输入：', nums);

    const { overlayCanvas, overlayCtx, startPoint, endPoint } = currentImageContext;
    startPoint.x = x;
    startPoint.y = y;
    endPoint.x = x + w - 1;
    endPoint.y = y + h - 1;
    drawSelectArea(overlayCanvas, overlayCtx, regionToRect(nums), 'white');
});

inputRect.addEventListener('contextmenu', e => {
    inputRect.blur();
    e.preventDefault();
    window.electronAPI.showInputRectMenu(inputRect.value.trim());
});

window.electronAPI.onCopyInputRect(() => {
    showToast('复制成功', 'success');
});

window.electronAPI.onPasteInputRect((content) => {
    inputRect.value = content;
    // 触发一次 input 事件
    const event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });
    inputRect.dispatchEvent(event);
});


window.electronAPI.onDeleteInputRect(() => {
    inputRect.value = '';

    showToast('清除成功', 'info');
    if (!currentImageContext) return;
    const { overlayCanvas, overlayCtx, startPoint, endPoint, pointer } = currentImageContext;
    startPoint.x = -1;
    startPoint.y = -1;
    endPoint.x = -1;
    endPoint.y = -1;
    pointer.style.display = 'none';

    drawSelectArea(overlayCanvas, overlayCtx, calRect(startPoint, endPoint), 'white');
});


// 绑定添加矩形按钮
btnAddRect.addEventListener('click', () => {
    const value = inputRect.value.trim();
    if (!rectPattern.test(value)) {
        showToast('请输入有效的矩形格式: [x, y, w, h]', 'error');
        return;
    }

    const nums = value.match(/-?\d+/g).map(Number);
    const [x, y, w, h] = nums;

    // 创建一个新的矩形项
    const rect = regionToRect(nums);
    const rectInfo = `${rectOrder++} [${x}, ${y}, ${w}, ${h}]`;
    const rectItem = document.createElement('div');
    rectItem.classList.add('rect-item');
    rectItem.dataset.rect = JSON.stringify(rect);
    rectItem.innerHTML = `<span>${rectInfo}</span>`;
    rectItem.addEventListener('click', e => {
        e.stopPropagation(); // 阻止事件冒泡，避免触发 rectList 的 click 事件
        // 选中当前矩形项
        document.querySelectorAll('.rect-item.selected').forEach(e => e.classList.remove('selected'));
        rectItem.classList.add('selected');
        currentSelectedRectItem = rectItem;

        // 预览选中矩形
        if (!currentImageContext) return;
        const { overlayCanvas, overlayCtx } = currentImageContext;
        drawSelectArea(overlayCanvas, overlayCtx, rect, '#ffa500');
    });
    rectItem.addEventListener('contextmenu', e => {
        e.stopPropagation();
        // 选中当前矩形项
        document.querySelectorAll('.rect-item.selected').forEach(e => e.classList.remove('selected'));
        rectItem.classList.add('selected');
        currentSelectedRectItem = rectItem;

        // 显示右键菜单
        window.electronAPI.showRectItemMenu();
    });
    // 添加到矩形列表
    rectList.appendChild(rectItem);
    showToast(`添加矩形成功: ${rectInfo}`, 'success');
});

window.electronAPI.onUpdateContextRect(() => {
    if (!currentImageContext || !currentSelectedRectItem) return;
    const { overlayCanvas, overlayCtx, startPoint, endPoint } = currentImageContext;
    const rect = JSON.parse(currentSelectedRectItem.dataset.rect);
    startPoint.x = rect.x;
    startPoint.y = rect.y;
    endPoint.x = rect.x + rect.w - 1;
    endPoint.y = rect.y + rect.h - 1;
    drawSelectArea(overlayCanvas, overlayCtx, rect, 'white');
    inputRect.value = `[${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`;
});

window.electronAPI.onDeleteRectItem(() => {
    if (currentSelectedRectItem) {
        const rect = JSON.parse(currentSelectedRectItem.dataset.rect);
        currentSelectedRectItem.remove();
        currentSelectedRectItem = null;
        if (rectList.children.length === 0) {
            rectOrder = 1; // 重置矩形项计数
        }
        showToast(`删除矩形成功: [${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`, 'info');
    }
});

rectList.addEventListener('contextmenu', e => {
    window.electronAPI.showRectListMenu();
});

rectList.addEventListener('click', () => {
    // 取消当前选中矩形项
    document.querySelectorAll('.rect-item.selected').forEach(e => e.classList.remove('selected'));
    currentSelectedRectItem = null;

    // 绘制上下文矩形
    if (!currentImageContext) return;
    const { overlayCanvas, overlayCtx, startPoint, endPoint } = currentImageContext;
    const rect = calRect(startPoint, endPoint);
    drawSelectArea(overlayCanvas, overlayCtx, rect, 'white');
});

window.electronAPI.onExportAllRectItem(() => {
    const result = [...rectList.querySelectorAll('.rect-item')].map(e => JSON.parse(e.dataset.rect));
    // 你可以：打印、保存到文件、发送回主进程等等
    console.log('导出矩形项:', result);
    // window.electronAPI.saveExportedRectItems(result);
    showToast(`已导出 ${result.length} 个矩形`, 'success');
});

window.electronAPI.onDeleteAllRectItem(() => {
    rectList.innerHTML = ''; // 清空所有矩形项
    currentSelectedRectItem = null;
    rectOrder = 1;
    showToast('已删除所有矩形', 'info');
});


const dpr = window.devicePixelRatio || 1;
let colorOrder = 1;
let imageOrder = 1;
let rectOrder = 1;
let currentImageContext = null;
let currentSelectedColorItem = null;
let currentSelectedImageItem = null;
let currentSelectedRectItem = null;

// 定义放大镜
const zoomPixelCount = 17; // 放大镜显示的像素点数 (横向和纵向都是)
const pixelSize = 19; // 放大镜显示的像素点每个像素块实际大小
const magnifierSize = zoomPixelCount * pixelSize; // 放大镜大小
const textBgHeight = 22;
const magnifierWidth = magnifierSize;
const magnifierHeight = magnifierSize + textBgHeight;
const magnifier = document.createElement('canvas');
magnifier.width = magnifierWidth * dpr;
magnifier.height = magnifierHeight * dpr;
magnifier.style.width = magnifierWidth + 'px';
magnifier.style.height = magnifierHeight + 'px';
magnifier.style.display = 'none'; // 初始隐藏
magnifier.classList.add('magnifier');
const mCtx = magnifier.getContext('2d');
mCtx.imageSmoothingEnabled = false; // 禁止抗锯齿
mCtx.scale(dpr, dpr);
document.body.appendChild(magnifier);

function calRect(startPoint, endPoint) {
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const w = Math.abs(endPoint.x - startPoint.x) + 1;
    const h = Math.abs(endPoint.y - startPoint.y) + 1;
    return { x, y, w, h };
}

function regionToRect([x, y, w, h]) {
    return { x, y, w, h };
}

function rectToRegion({ x, y, w, h }) {
    return [x, y, w, h];
}

function calAndSetPoint(canvas, event, point) {
    const rect = canvas.getBoundingClientRect();
    point.x = Math.floor(event.clientX - rect.left);
    point.y = Math.floor(event.clientY - rect.top);
}

function drawSelectArea(overlayCanvas, overlayCtx, { x, y, w, h }, strokeStyle) {
    // 清除画布并重新绘制预览
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.strokeStyle = strokeStyle;
    overlayCtx.lineWidth = 1;
    overlayCtx.setLineDash([4, 3]); // 设置虚线：4px 实线 + 3px 空白
    overlayCtx.strokeRect(x, y, w, h);
    overlayCtx.setLineDash([]); // 清除虚线样式，恢复默认
}

function loadImage(path, options = {}) {
    const img = new Image();
    img.onload = () => {
        // 提取文件名
        const filename = options.name || (() => {
            try {
                // 支持普通文件路径
                return path.split(/[\\/]/).pop();
            } catch (e) {
                return 'Untitled';
            }
        })();

        // 原始像素层canvas
        const imageCanvas = document.createElement('canvas');
        imageCanvas.width = img.naturalWidth;
        imageCanvas.height = img.naturalHeight;
        imageCanvas.style.width = `${img.naturalWidth}px`;
        imageCanvas.style.height = `${img.naturalHeight}px`;
        const imgCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
        imgCtx.imageSmoothingEnabled = false; // 禁止抗锯齿
        imgCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

        // 背景层canvas
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = img.width * dpr;
        bgCanvas.height = img.height * dpr;
        bgCanvas.style.width = `${img.width}px`;
        bgCanvas.style.height = `${img.height}px`;
        bgCanvas.classList.add('image-canvas');
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.imageSmoothingEnabled = false; // 禁止抗锯齿
        bgCtx.scale(dpr, dpr); // 缩放绘图坐标系，保证坐标系和css尺寸一致
        bgCtx.drawImage(img, 0, 0, img.width, img.height);

        // 预览层canvas
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = img.width * dpr;
        overlayCanvas.height = img.height * dpr;
        overlayCanvas.style.width = `${img.width}px`;
        overlayCanvas.style.height = `${img.height}px`;
        overlayCanvas.tabIndex = 0;
        overlayCanvas.classList.add('image-canvas');
        const overlayCtx = overlayCanvas.getContext('2d');
        overlayCtx.imageSmoothingEnabled = false; // 禁止抗锯齿
        overlayCtx.scale(dpr, dpr); // 缩放绘图坐标系，保证坐标系和css尺寸一致

        // 预览层框选功能
        const startPoint = {
            x: -1,
            y: -1
        };
        const endPoint = {
            x: -1,
            y: -1
        };
        let clientX, clientY, isDrawing = false; // 是否正在绘制框选
        let startX, startY, isDragging = false; // 是否正在拖拽

        overlayCanvas.addEventListener('mousedown', e => {
            // 0 表示左键
            if (e.button === 0) {
                // 如果在绘制框选，或上一次的移动一直长按鼠标离开了canvas元素的范围内松手导致不触发mouseup，直接退出
                if (isDrawing || isDragging) return;

                startX = e.offsetX;
                startY = e.offsetY;
                isDragging = false;

                clientX = e.clientX;
                clientY = e.clientY;
                isDrawing = true;
            } else if (e.button === 2) {
                if (!isDrawing) {
                    // 开始绘制
                    clientX = e.clientX;
                    clientY = e.clientY;
                    isDrawing = true;
                    calAndSetPoint(overlayCanvas, { clientX, clientY }, startPoint);
                } else {
                    // 结束绘制
                    isDrawing = false;
                    const rect = calRect(startPoint, endPoint);
                    drawSelectArea(overlayCanvas, overlayCtx, rect, 'white');
                    inputRect.value = `[${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`;
                }
            }
        });

        overlayCanvas.addEventListener('mousemove', e => {
            // 1 表示左键按住
            if (e.buttons === 1) {
                if (!isDrawing) return; // 不是绘制状态，直接退出
                if (!isDragging) {
                    const dx = e.offsetX - startX;
                    const dy = e.offsetY - startY;
                    // 判断是否拖拽
                    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                        isDragging = true;
                        calAndSetPoint(overlayCanvas, { clientX, clientY }, startPoint);
                        // console.log("startPoint:", startPoint);
                    } else {
                        return; // 未达到拖拽阈值
                    }
                }

                calAndSetPoint(overlayCanvas, e, endPoint);
                // console.log("endPoint:", endPoint);
                const rect = calRect(startPoint, endPoint);
                drawSelectArea(overlayCanvas, overlayCtx, rect, 'red');
                inputRect.value = `[${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`;
            } else if (e.buttons === 0) {
                if (!isDrawing) return; // 不是绘制状态，直接退出
                calAndSetPoint(overlayCanvas, e, endPoint);
                // console.log("endPoint:", endPoint);
                const rect = calRect(startPoint, endPoint);
                drawSelectArea(overlayCanvas, overlayCtx, rect, 'red');
                inputRect.value = `[${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`;
            }
        });

        overlayCanvas.addEventListener('mouseup', e => {
            // 0 表示左键
            if (e.button === 0) {
                if (!isDrawing) return; // 不是绘制状态，直接退出
                isDrawing = false; // 关闭绘制状态
                if (!isDragging) return; // 不是鼠标拖拽操作，直接退出
                calAndSetPoint(overlayCanvas, e, endPoint);
                // console.log("endPoint:", endPoint);
                const rect = calRect(startPoint, endPoint);
                drawSelectArea(overlayCanvas, overlayCtx, rect, 'white');
                inputRect.value = `[${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`;
            }
        });

        // 监听鼠标移动绘制放大镜
        overlayCanvas.addEventListener('mousemove', e => {
            const rect = overlayCanvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            const rgba = imgCtx.getImageData(x, y, 1, 1).data;
            const hex = rgbToHex(rgba[0], rgba[1], rgba[2]);
            // 设置状态栏的当前颜色
            colorSwatch.style.backgroundColor = hex;
            colorText.textContent = `${hex} (${rgba[0]}, ${rgba[1]}, ${rgba[2]}) @ (${x}, ${y})`;

            // 放大镜位置防止超出
            let left = e.pageX + 10;
            let top = e.pageY + 10;
            if (left + magnifierWidth > window.innerWidth) left = e.pageX - magnifierWidth - 10;
            if (top + magnifierHeight > window.innerHeight) top = e.pageY - magnifierHeight - 10;
            magnifier.style.left = `${left}px`;
            magnifier.style.top = `${top}px`;


            // 2.填充像素颜色值
            const imageData = imgCtx.getImageData(
                x - Math.floor(zoomPixelCount / 2),
                y - Math.floor(zoomPixelCount / 2),
                zoomPixelCount,
                zoomPixelCount
            );

            // 逐像素放大绘制
            for (let y = 0; y < zoomPixelCount; y++) {
                for (let x = 0; x < zoomPixelCount; x++) {
                    const index = (y * zoomPixelCount + x) * 4;

                    const r = imageData.data[index];
                    const g = imageData.data[index + 1];
                    const b = imageData.data[index + 2];

                    mCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    mCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }


            // 3. 绘制像素网格
            mCtx.strokeStyle = 'rgb(88, 88, 88)';
            mCtx.lineWidth = 1;
            for (let i = 0; i <= zoomPixelCount; i++) {
                const pos = i * pixelSize;

                // 画竖线
                mCtx.beginPath();
                mCtx.moveTo(pos, 0);
                mCtx.lineTo(pos, magnifierWidth);
                mCtx.stroke();

                // 画横线
                mCtx.beginPath();
                mCtx.moveTo(0, pos);
                mCtx.lineTo(magnifierWidth, pos);
                mCtx.stroke();
            }


            // 4. 绘制中心像素格边框
            const centerIndex = Math.floor(zoomPixelCount / 2);
            const highlightX = centerIndex * pixelSize;
            const highlightY = centerIndex * pixelSize;
            mCtx.strokeStyle = 'red';
            mCtx.lineWidth = 2;
            mCtx.strokeRect(highlightX, highlightY, pixelSize, pixelSize);


            // 5. 显示中心像素的 RGB(HEX) position 数值悬浮文字
            const text = `${hex} P(${x}, ${y})`;
            const metrics = mCtx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            const blockSize = textHeight;
            const padding = 4;
            const fontSize = 13; // 定义一个字体高度

            // 放大镜底部给文字加个半透明黑色背景，提升可读性
            mCtx.fillStyle = 'black';
            mCtx.fillRect(0, magnifierWidth, magnifierWidth, textBgHeight);

            // 绘制颜色块
            const colorBlockX = (magnifierWidth - (blockSize + padding + textWidth)) / 2;
            const colorBlockY = magnifierWidth + (textBgHeight - blockSize) / 2;
            mCtx.fillStyle = `rgb(${rgba[0]}, ${rgba[1]}, ${rgba[2]})`;
            mCtx.fillRect(colorBlockX, colorBlockY, blockSize, blockSize);
            mCtx.strokeStyle = 'rgb(238, 238, 238)';
            mCtx.lineWidth = 1;
            mCtx.strokeRect(colorBlockX, colorBlockY, blockSize, blockSize);

            // 绘制文字
            mCtx.fillStyle = 'white';
            mCtx.font = `${fontSize}px monospace`;
            mCtx.textBaseline = 'top';
            const textX = colorBlockX + blockSize + padding;
            const textY = colorBlockY;
            mCtx.fillText(text, textX, textY);


            // 6. 显示放大镜
            magnifier.style.display = 'block';
        });

        // 鼠标移出区域时隐藏放大镜
        overlayCanvas.addEventListener('mouseleave', e => {
            magnifier.style.display = 'none';
        });

        // 点击时获取当前坐标的像素值
        overlayCanvas.addEventListener('click', e => {
            // 是拖动框选，不执行点击行为
            if (isDragging) {
                e.stopPropagation();
                isDragging = false;
                return;
            }
            // 获取当前鼠标坐标点的颜色值
            const rect = overlayCanvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            const rgba = imgCtx.getImageData(x, y, 1, 1).data;
            // 格式化颜色
            const hex = rgbToHex(rgba[0], rgba[1], rgba[2]);
            const colorInfo = `${colorOrder++} ${hex} (${rgba[0]}, ${rgba[1]}, ${rgba[2]}) - (${x}, ${y})`;

            // 添加到colorList中
            const item = document.createElement('div');
            item.classList.add('color-item');
            item.dataset.pos = `${x}, ${y}`;
            item.dataset.hex = hex;
            item.dataset.rgb = `${rgba[0]}, ${rgba[1]}, ${rgba[2]}`;
            item.innerHTML = `<div class="color-swatch" style="background-color: ${hex};"></div><span>${colorInfo}</span>`;

            item.addEventListener('click', e => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发 colorList 的 click 事件
                selectColorItem(item);
            });

            item.addEventListener('contextmenu', e => {
                e.stopPropagation();
                selectColorItem(item);

                const dataset = e.currentTarget.dataset;
                const data = {
                    pos: dataset.pos,
                    hex: dataset.hex,
                    rgb: dataset.rgb,
                };

                window.electronAPI.showColorItemMenu(data);
            });

            colorList.appendChild(item);

        });


        overlayCanvas.addEventListener('mouseenter', e => {
            overlayCanvas.focus();
        });

        overlayCanvas.addEventListener('mouseleave', e => {
            overlayCanvas.blur();
        });

        overlayCanvas.addEventListener('keydown', async e => {
            e.preventDefault(); // 阻止默认行为
            e.stopPropagation(); // 阻止事件冒泡
            const code = e.code;
            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                step = fastStep;
                return;
            }

            if (keyMap[code]) {
                const [dx, dy] = keyMap[code]();
                const res = await window.electronAPI.moveMouseRelative(dx, dy);
                if (!res.success) {
                    console.error('移动鼠标失败:', res.error);
                } else {
                    // console.log('鼠标新坐标:', res.x, res.y);
                }
            } else if (code === 'Space') {
                window.electronAPI.simulateClick();
            }
        });

        overlayCanvas.addEventListener('keyup', e => {
            const code = e.code;
            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                step = normalStep;
            }
        });


        // 创建指针
        const pointer = document.createElement('img');
        pointer.src = 'pointer.svg';
        pointer.style.position = 'absolute';
        pointer.style.width = '24px';
        pointer.style.height = '24px';
        pointer.style.transform = 'translate(-50%, -100%)';
        pointer.style.display = 'none';
        pointer.style.pointerEvents = 'none';
        // pointer.style.zIndex = '10';
        pointer.classList.add('canvas-pointer'); // 可选，用于后续样式控制

        // 创建图片容器
        const tab = document.createElement('div');
        tab.classList.add('tab');

        //添加 canvas 和指针
        tab.appendChild(bgCanvas);
        tab.appendChild(overlayCanvas);
        tab.appendChild(pointer); // 👈 添加指针到 tab 层
        tabPanels.appendChild(tab);

        // 创建tab button
        const tabButton = document.createElement('div');
        tabButton.classList.add('tab-button');
        tabButton.textContent = filename;
        tabButton.addEventListener('click', () => {
            // 取消激活所有的tab页面，ab button
            document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(e => e.classList.remove('active'));

            // 激活所当前当前tab tab button
            tab.classList.add('active');
            tabButton.classList.add('active');

            // 保存当前图片上下文
            currentImageContext = {
                imageCanvas,
                imgCtx,
                bgCanvas,
                bgCtx,
                overlayCanvas,
                overlayCtx,
                startPoint,
                endPoint,
                pointer,
                filename
            };
            const rect = calRect(startPoint, endPoint);
            if (rect.x < 0 || rect.y < 0) {
                inputRect.value = '';
            } else {
                inputRect.value = `[${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`;
            }
        });

        // 创建tab close
        const tabClose = document.createElement("span");
        tabClose.classList.add('tab-close');
        tabClose.title = '关闭图片';
        tabClose.innerHTML = `
            <svg t="1750507841494" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2627" width="200" height="200"><path d="M818.346667 182.058667a42.666667 42.666667 0 0 1 4.650666 57.493333l-2.389333 2.816L570.197333 512l250.410667 269.653333 2.389333 2.773334a42.666667 42.666667 0 0 1-64.938666 55.253333L512 574.698667 265.941333 839.701333a42.666667 42.666667 0 0 1-64.938666-55.253333l2.389333-2.816L453.781333 512 203.392 242.346667l-2.389333-2.773334a42.666667 42.666667 0 0 1 64.938666-55.253333L512 449.28 758.058667 184.298667a42.666667 42.666667 0 0 1 60.309333-2.24z" fill="#ffffff" p-id="2628"></path></svg>
        `;
        // tabClose.textContent = ' x '
        tabClose.addEventListener('click', e => {
            e.stopPropagation(); // 防止触发 tab 切换
            if (!confirm("确认关闭这个图片？\n" + filename)) return;
            const wasActive = tabButton.classList.contains('active');

            tabButton.remove();
            tab.remove();

            if (wasActive) {
                // 打开最后一个
                const allTabButtons = document.querySelectorAll('.tab-button');
                if (allTabButtons.length > 0) {
                    allTabButtons[allTabButtons.length - 1].click();
                } else {
                    // 如果没有剩余的tab，清空当前图片上下文
                    currentImageContext = null;
                    inputRect.value = '';
                }
            }

        });

        tabButton.appendChild(tabClose);
        tabBar.appendChild(tabButton);


        // 激活当前加载的
        tabButton.click();
    };
    img.src = path;
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

window.electronAPI.onLoadImages((paths) => {
    paths.forEach(loadImage);
});

window.electronAPI.onTriggerCapture(() => {
    if (!currentImageContext) {
        alert('当前图片上下文为空');
        return;
    }

    const { startPoint, endPoint, imageCanvas, filename } = currentImageContext;
    const rect = calRect(startPoint, endPoint);
    if (rect.x < 0 || rect.y < 0) {
        showToast('无效的裁剪区域', 'error');
        return;
    }

    cropSelection(imageCanvas, rect, filename);
    showToast('裁剪图片成功', 'success');
});


const cropSelection = (imageCanvas, rect, originalFilename) => {
    const { x, y, w, h } = rect;

    // 生成新文件名，例如：foo_[x,y,w,h].png
    const baseName = originalFilename.replace(/\.[^.]+$/, ''); // 去掉扩展名
    const rawExt = originalFilename.split('.').pop(); // 原始扩展名
    const croppedName = rawExt.toLowerCase() === 'png'
        ? `${baseName}_[${x},${y},${w},${h}].${rawExt}` // 如果原本就是 png，就直接追加
        : `${baseName}_[${x},${y},${w},${h}].${rawExt}.png`; // 否则追加 ".原始扩展名.png"


    // 创建离屏 canvas 存储裁剪结果
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.imageSmoothingEnabled = false; // 禁止抗锯齿
    cropCtx.drawImage(
        imageCanvas, // 源 canvas
        x, y, w, h,  // 源图区域
        0, 0, w, h   // 目标区域
    );

    const croppedImageDataUrl = cropCanvas.toDataURL('image/png'); // base64
    const croppedImg = new Image();
    croppedImg.src = croppedImageDataUrl;
    croppedImg.draggable = true;
    croppedImg.classList.add('image-item');
    // 保存文件名在自定义属性中
    croppedImg.dataset.filename = croppedName;

    croppedImg.addEventListener('click', e => {
        e.stopPropagation(); // 阻止事件冒泡，避免触发 imageList 的 click 事件
        selectImageItem(croppedImg);
    });

    croppedImg.addEventListener('contextmenu', e => {
        e.stopPropagation();
        selectImageItem(croppedImg);
        window.electronAPI.showImageItemMenu({
            data: croppedImageDataUrl,
            filename: croppedImg.dataset.filename // 加入文件名
        });
    });

    croppedImg.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/uri-list', croppedImg.src); // base64 URL
        // 传递文件名（自定义 MIME 类型字符串）
        e.dataTransfer.setData('application/x-filename', croppedImg.dataset.filename);
    });

    // 绑定所有图片的双击事件
    croppedImg.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (target.tagName === 'IMG' && target.classList.contains('image-item')) {
            previewImg.src = target.src;
            modal.style.display = 'flex'; // 显示模态框
            previewImg.style.transform = `scale(${scale})`;
        }
    });
    imageList.appendChild(croppedImg);
};



const normalStep = 1; // 正常移动，每次移动1像素
const fastStep = 4; // 快速移动，每次移动4像素
let step = 1; // 当前移动速度
// 方向映射
const keyGroups = [
    { keys: ['ArrowUp', 'KeyW', 'KeyI'], getDirection: () => [0, -step] },
    { keys: ['ArrowDown', 'KeyS', 'KeyK'], getDirection: () => [0, step] },
    { keys: ['ArrowLeft', 'KeyA', 'KeyJ'], getDirection: () => [-step, 0] },
    { keys: ['ArrowRight', 'KeyD', 'KeyL'], getDirection: () => [step, 0] },
];

const keyMap = {};
keyGroups.forEach(({ keys, getDirection }) => {
    keys.forEach(key => {
        keyMap[key] = getDirection;
    });
});


function selectColorItem(item) {
    // 先取消之前选中的
    document.querySelectorAll('.color-item.selected').forEach(e => e.classList.remove('selected'));

    // 给当前 item 添加 selected 类
    item.classList.add('selected');
    currentSelectedColorItem = item;
}

window.electronAPI.onDeleteColorItem(() => {
    if (currentSelectedColorItem) {
        const dataset = currentSelectedColorItem.dataset;
        const data = {
            pos: dataset.pos,
            hex: dataset.hex,
            rgb: dataset.rgb,
        };
        currentSelectedColorItem.remove();
        currentSelectedColorItem = null;
        if (colorList.children.length === 0) {
            colorOrder = 1; // 重置颜色项计数
        }
        showToast(`删除颜色成功: ${data.hex} (${data.rgb}) @ ${data.pos}`, 'info');
    }
});

colorList.addEventListener('contextmenu', e => {
    window.electronAPI.showColorListMenu();
});

colorList.addEventListener('click', () => {
    // 取消当前选中颜色项
    document.querySelectorAll('.color-item.selected').forEach(e => e.classList.remove('selected'));
    currentSelectedColorItem = null;
});


function convertToRelColor(colors) {
    if (!colors || colors.length === 0) return [];

    // 取第一个颜色hex和pos
    const baseColorHex = colors[0].hex;
    const [x0, y0] = colors[0].pos.split(',').map(s => parseInt(s.trim(), 10));

    // 生成相对坐标数组（跳过第一个点）
    const relativeColors = colors.slice(1).map(c => {
        const [x, y] = c.pos.split(',').map(s => parseInt(s.trim(), 10));
        const dx = x - x0;
        const dy = y - y0;
        return [dx, dy, c.hex];
    });

    return [baseColorHex, relativeColors];
}

function formatRelColor(colors) {
    if (!colors || colors.length === 0) return '';

    const [baseColorHex, relativeColors] = colors;

    // 把内层数组转成 '[dx, dy, "hex"]' 形式，元素间逗号后带空格
    const innerStr = relativeColors
        .map(item => `[${item[0]}, ${item[1]}, "${item[2]}"]`)
        .join(', ');

    return `["${baseColorHex}", [${innerStr}]]`;
}

window.electronAPI.onExportAllColorItem(async () => {
    const items = colorList.querySelectorAll('.color-item');
    const result = [];

    items.forEach(item => {
        result.push({
            pos: item.dataset.pos,
            hex: item.dataset.hex,
            rgb: item.dataset.rgb,
        });
    });

    // 你可以：打印、保存到文件、发送回主进程等等
    const res = formatRelColor(convertToRelColor(result));
    console.log('导出颜色项:', res);

    const { action } = await dialog.show({
        title: '确认复制',
        content: `<pre class="dialog-body">${res}</pre>`,
        buttons: [
            { label: '复制', value: 'copy', class: 'primary' },
            { label: '取消', value: 'cancel', class: 'text' }
        ]
    });

    if (action === 'copy') {
        navigator.clipboard.writeText(res);
        showToast(`已导出 ${result.length} 个颜色`, 'success');
    } else {
        console.log('用户取消');
    }

});

window.electronAPI.onDeleteAllColorItem(() => {
    colorList.innerHTML = ''; // 清空所有颜色项
    currentSelectedColorItem = null;
    colorOrder = 1;
    showToast('已删除所有颜色', 'info');
});

function selectImageItem(item) {
    // 先取消之前选中的
    document.querySelectorAll('.image-item.selected').forEach(e => e.classList.remove('selected'));

    // 给当前 item 添加 selected 类
    item.classList.add('selected');
    currentSelectedImageItem = item;
}

window.electronAPI.onDeleteImageItem(() => {
    if (currentSelectedImageItem) {
        currentSelectedImageItem.remove();
        currentSelectedImageItem = null;
        if (imageList.children.length === 0) {
            imageOrder = 1; // 重置图片项计数
        }
        showToast('删除图片成功', 'info');
    }
});

imageList.addEventListener('contextmenu', e => {
    window.electronAPI.showImageListMenu();
});

imageList.addEventListener('click', () => {
    // 取消当前选中图片项
    document.querySelectorAll('.image-item.selected').forEach(e => e.classList.remove('selected'));
    currentSelectedImageItem = null;
});

window.electronAPI.onExportAllImageItem(async () => {
    function canvasToBlob(canvas, type = 'image/png') {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), type);
        });
    }

    function blobToDataURL(blob) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    const items = imageList.querySelectorAll('.image-item');
    const result = [];

    for (const canvas of items) {
        const blob = await canvasToBlob(canvas);
        const dataUrl = await blobToDataURL(blob);
        result.push({ data: dataUrl });
    }

    console.log('导出图片项:', result);
    showToast(`已导出 ${result.length} 张图片`, 'success');
    // window.electronAPI.saveExportedImageItems(result);
});

window.electronAPI.onDeleteAllImageItem(() => {
    imageList.innerHTML = ''; // 清空所有图片项
    currentSelectedImageItem = null;
    imageOrder = 1;
    showToast('已删除所有图片', 'info');
});


const modal = document.getElementById('preview-modal');
const previewImg = document.getElementById('preview-img');

let scale = 2; // 预览图片的初始缩放比例
let offsetX = 0;
let offsetY = 0;
let isPanning = false; // 是否正在拖动预览图片
let startX, startY;

// 应用 transform 统一更新
function updateTransform() {
    previewImg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

previewImg.addEventListener('click', e => {
    e.preventDefault(); // 阻止默认行为
    e.stopPropagation(); // 阻止事件冒泡，避免触发模态框的 click 事件
});

// 拖动：鼠标按下
previewImg.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // 仅左键
    e.preventDefault(); // 阻止默认行为，避免选中图片
    isPanning = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    previewImg.style.cursor = 'grabbing';
});

// 拖动：鼠标移动
previewImg.addEventListener('mousemove', e => {
    e.preventDefault(); // 阻止默认行为，避免触发拖拽img默认行为
    if (!isPanning) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    updateTransform();
});

// 鼠标释放，结束拖动
window.addEventListener('mouseup', () => {
    isPanning = false;
    previewImg.style.cursor = 'grab';
});

// 滚轮放大缩小
modal.addEventListener('wheel', e => {
    e.preventDefault();

    const delta = e.deltaY;
    const zoomSpeed = 0.5;

    if (delta < 0) {
        // 向上滚：放大
        scale += zoomSpeed;
    } else {
        // 向下滚：缩小
        scale = Math.max(0.5, scale - zoomSpeed);
    }

    updateTransform(); // 保持 translate + scale 一致
}, { passive: false }); // 兼容 Chrome 默认滚动

function resetPreview() {
    scale = 2;
    offsetX = 0;
    offsetY = 0;
    isPanning = false;
    updateTransform();
    previewImg.style.cursor = 'grab';
}


// 点击模态框关闭预览
modal.addEventListener('click', () => {
    if (isPanning) return; // 如果正在拖动，点击不关闭
    modal.style.display = 'none';
    resetPreview();
});

// ESC 键关闭预览
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        modal.style.display = 'none';
        resetPreview();
    }
});



// toast
const container = document.getElementById('toast-container');
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
        <span>${message}</span>
        <span class="toast-close" title="关闭">
            <svg t="1750507841494" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2627" width="200" height="200"><path d="M818.346667 182.058667a42.666667 42.666667 0 0 1 4.650666 57.493333l-2.389333 2.816L570.197333 512l250.410667 269.653333 2.389333 2.773334a42.666667 42.666667 0 0 1-64.938666 55.253333L512 574.698667 265.941333 839.701333a42.666667 42.666667 0 0 1-64.938666-55.253333l2.389333-2.816L453.781333 512 203.392 242.346667l-2.389333-2.773334a42.666667 42.666667 0 0 1 64.938666-55.253333L512 449.28 758.058667 184.298667a42.666667 42.666667 0 0 1 60.309333-2.24z" fill="#ffffff" p-id="2628"></path></svg>
        </span>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());

    container.appendChild(toast);

    function createTimer() {
        return setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }

    let hideTimer = createTimer();

    // 悬停时暂停消失
    toast.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    toast.addEventListener('mouseleave', () => {
        hideTimer = createTimer();
    });
}




tabPanels.addEventListener('dragover', (e) => {
    e.preventDefault(); // 必须阻止默认，才能触发 drop
}, true); // 第三个参数 `true` 表示使用事件捕获阶段

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

tabPanels.addEventListener('drop', async (e) => {
    e.preventDefault();

    // 支持从图片元素拖拽（base64 URI）
    const uri = e.dataTransfer.getData('text/uri-list');
    const filename = e.dataTransfer.getData('application/x-filename');
    if (uri?.startsWith('data:image')) {
        // 拖入 base64 图片
        loadImage(uri, { name: filename });
        return;
    }

    // 支持从本地文件系统拖入图片文件
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));

    if (files.length) {
        for (const file of files) {
            const result = await readFileAsDataURL(file);
            loadImage(result, { name: file.name });
        }
        return;
    }

    showToast('拖入的不是支持的图片格式', 'warning');
}, true);


let dragCounter = 0;
tabPanels.addEventListener('dragenter', () => {
    dragCounter++;
    tabPanels.classList.add('dragover');
}, true);
tabPanels.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter === 0) {
        tabPanels.classList.remove('dragover');
    }
}, true);
tabPanels.addEventListener('drop', () => {
    dragCounter = 0;
    tabPanels.classList.remove('dragover');
}, true);





// dialog start
class Dialog {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container #${containerId} not found`);
        }
    }

    show({ title, content, buttons }) {
        return new Promise((resolve) => {
            this.container.innerHTML = '';

            const dialog = document.createElement('div');
            dialog.className = 'dialog';

            const backdrop = document.createElement('div');
            backdrop.className = 'dialog-backdrop';
            backdrop.addEventListener('click', () => {
                this.hide();
                resolve(null);
            });

            const contentBox = document.createElement('div');
            contentBox.className = 'dialog-content';

            contentBox.innerHTML = `
        <h3>${title}</h3>
        <div class="dialog-body">${content}</div>
      `;

            const btnContainer = document.createElement('div');
            btnContainer.className = 'dialog-buttons';

            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.label;
                button.type = 'button';
                if (btn.class) {
                    button.className = btn.class;
                }
                button.addEventListener('click', () => {
                    // 在点击时收集输入值
                    const inputs = this.container.querySelectorAll('.dialog-body input, .dialog-body textarea');
                    const values = {};
                    inputs.forEach(el => {
                        const key = el.name || el.id || 'value';
                        values[key] = el.value;
                    });

                    this.hide();
                    resolve({ action: btn.value, inputs: values });
                });
                btnContainer.appendChild(button);
            });

            contentBox.appendChild(btnContainer);

            dialog.appendChild(backdrop);
            dialog.appendChild(contentBox);
            this.container.appendChild(dialog);
        });
    }

    hide() {
        this.container.innerHTML = '';
    }
}

const dialog = new Dialog('dialog-container');
// dialog end
