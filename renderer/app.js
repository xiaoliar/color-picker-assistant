const colorSwatch = document.getElementById('color-swatch');
const colorText = document.getElementById('color-text');

const tabBar = document.getElementById('tab-bar');
const tabPanels = document.getElementById('tab-panels');

const inputRect = document.getElementById('input-rect');

const tabButtons = document.querySelectorAll('#tab-buttons .tab-btn');
const tabContents = document.querySelectorAll('#tab-contents .tab-content');
const colorList = document.querySelector('#tab-contents .tab-content[data-tab=color]');
const imageList = document.querySelector('#tab-contents .tab-content[data-tab=image]');
const rectList = document.querySelector('#tab-contents .tab-content[data-tab=rect]');

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
});

// 匹配 [x, y, w, h] 格式，x/y/w/h 为整数或小数
const rectPattern = /^\[\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*\]$/;
inputRect.addEventListener('input', e => {
    if (!currentImageContext) return;
    const value = e.target.value.trim();
    if (rectPattern.test(value)) {
        // 你可以在这里安全地解析为数组使用
        const nums = JSON.parse(value.replace(/(\d+)\s*(?=,|\])/g, '$1')); // 简单容错
        // console.log('有效输入：', nums);
        const { overlayCanvas, overlayCtx, startPoint, endPoint } = currentImageContext;
        const [x, y, w, h] = nums;
        startPoint.x = x;
        startPoint.y = y;
        endPoint.x = x + w - 1;
        endPoint.y = y + h - 1;
        drawSelectArea(overlayCanvas, overlayCtx, { x, y, w, h }, 'white');
    }
});



const dpr = window.devicePixelRatio || 1;
let colorOrder = 1;
let currentImageContext = null;
let currentSelectedColorItem = null;
let currentSelectedImageItem = null;
let currentSelectedRectItem = null;

// 定义放大镜
const zoomPixelCount = 15; // 放大镜显示的像素点数 (横向和纵向都是)
const pixelSize = 13; // 放大镜显示的像素点每个像素块实际大小
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

function loadImage(path) {
    const img = new Image();
    img.onload = () => {
        const filename = path.split(/[\\/]/).pop(); // 提取文件名

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
            x: 0,
            y: 0
        };
        const endPoint = {
            x: 0,
            y: 0
        };
        let clientX, clientY, isDrawing = false; // 是否正在绘制框选
        let startX, startY, isDragging = false; // 是否正在拖拽

        overlayCanvas.addEventListener('mousedown', e => {
            if (e.button !== 0) return; // 0 表示左键
            // 如果在绘制框选，或上一次的移动一直长按鼠标离开了canvas元素的范围内松手导致不触发mouseup，直接退出
            if (isDrawing || isDragging) return;

            startX = e.offsetX;
            startY = e.offsetY;
            isDragging = false;

            clientX = e.clientX;
            clientY = e.clientY;
            isDrawing = true;
        });

        overlayCanvas.addEventListener('mousemove', e => {
            if (e.button !== 0) return; // 0 表示左键
            if (!isDrawing) return; // 不是绘制状态，直接退出
            if (!isDragging) {
                const dx = e.offsetX - startX;
                const dy = e.offsetY - startY;
                // 判断是否拖拽
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    isDragging = true;
                    calAndSetPoint(overlayCanvas, { clientX, clientY }, startPoint);
                    // console.log("startPoint:", startPoint);
                } else {
                    return; // 未达到拖拽阈值
                }
            }

            calAndSetPoint(overlayCanvas, e, endPoint);
            // console.log("endPoint:", endPoint);
            drawSelectArea(overlayCanvas, overlayCtx, calRect(startPoint, endPoint), 'red');
        });

        overlayCanvas.addEventListener('mouseup', e => {
            if (e.button !== 0) return; // 0 表示左键
            if (!isDrawing) return; // 不是绘制状态，直接退出
            isDrawing = false; // 关闭绘制状态
            if (!isDragging) return; // 不是鼠标拖拽操作，直接退出
            calAndSetPoint(overlayCanvas, e, endPoint);
            // console.log("endPoint:", endPoint);
            const rect = calRect(startPoint, endPoint);
            drawSelectArea(overlayCanvas, overlayCtx, rect, 'white');
            inputRect.value = `[${rect.x}, ${rect.y}, ${rect.w}, ${rect.h}]`;
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
                // 画竖线
                mCtx.beginPath();
                mCtx.moveTo(i * pixelSize, 0);
                mCtx.lineTo(i * pixelSize, magnifierWidth);
                mCtx.stroke();

                // 画横线
                mCtx.beginPath();
                mCtx.moveTo(0, i * pixelSize);
                mCtx.lineTo(magnifierWidth, i * pixelSize);
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
                e.preventDefault();
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

            item.addEventListener('click', () => {
                selectColorItem(item);
            });

            item.addEventListener('contextmenu', e => {
                e.preventDefault();
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
            const code = e.code;
            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                step = fastStep;
                return;
            }

            if (keyMap[code]) {
                e.preventDefault(); // 阻止默认滚动等行为
                const [dx, dy] = keyMap[code]();
                const res = await window.electronAPI.moveMouseRelative(dx, dy);
                if (!res.success) {
                    console.error('移动鼠标失败:', res.error);
                } else {
                    // console.log('鼠标新坐标:', res.x, res.y);
                }
            } else if (code === 'Space') {
                window.electronAPI.simulateClick();
                e.preventDefault();
            }
        });

        overlayCanvas.addEventListener('keyup', e => {
            const code = e.code;
            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                step = normalStep;
            }
        });


        // 创建图片容器
        const tab = document.createElement('div');
        tab.classList.add('tab');
        // 叠加canvas层
        tab.appendChild(bgCanvas);
        tab.appendChild(overlayCanvas);
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
                endPoint
            };
        });

        // 创建tab close
        const tabClose = document.createElement("span");
        tabClose.classList.add('tab-close');
        tabClose.textContent = ' x '
        tabClose.addEventListener('click', e => {
            e.preventDefault();
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
    } else if (!cropSelection(currentImageContext)) {
        alert('图片框选范围不合法');
    }
});


const cropSelection = ({ startPoint, endPoint, imageCanvas }) => {
    if (!startPoint || !endPoint) return false;

    const { x, y, w, h } = calRect(startPoint, endPoint);
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
    croppedImg.classList.add('image-item');
    croppedImg.addEventListener('click', e => {
        selectImageItem(croppedImg);
    });

    croppedImg.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        selectImageItem(croppedImg);
        window.electronAPI.showImageItemMenu({
            data: croppedImageDataUrl
        });
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

    return true;
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
        currentSelectedColorItem.remove();
        currentSelectedColorItem = null;
        if (colorList.children.length === 0) {
            colorOrder = 1;
        }
    }
});

colorList.addEventListener('contextmenu', e => {
    e.preventDefault();
    window.electronAPI.showColorListMenu();
});

window.electronAPI.onExportAllColorItem(() => {
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
    console.log('导出颜色项:', result);

    // 示例：发回主进程保存为 JSON 文件
    // window.electronAPI.saveExportedColorItems(result);
});

window.electronAPI.onDeleteAllColorItem(() => {
    colorList.innerHTML = ''; // 清空所有颜色项
    currentSelectedColorItem = null;
    colorOrder = 1;
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
    }
});

imageList.addEventListener('contextmenu', e => {
    e.preventDefault();
    window.electronAPI.showImageListMenu();
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
    // window.electronAPI.saveExportedImageItems(result);
});

window.electronAPI.onDeleteAllImageItem(() => {
    imageList.innerHTML = ''; // 清空所有图片项
    currentSelectedImageItem = null;
});




const modal = document.getElementById('preview-modal');
const previewImg = document.getElementById('preview-img');
let scale = 2;

// 点击模态框关闭预览
modal.addEventListener('click', () => {
    modal.style.display = 'none';
    scale = 2;
});

// ESC 键关闭预览
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modal.style.display = 'none';
        scale = 2;
    }
});

// 滚轮放大缩小
previewImg.addEventListener('wheel', (e) => {
    e.preventDefault();

    const delta = e.deltaY;
    const zoomSpeed = 0.5;

    if (delta < 0) {
        // 向上滚：放大
        scale += zoomSpeed;
    } else {
        // 向下滚：缩小
        scale = Math.max(0.1, scale - zoomSpeed);
    }

    previewImg.style.transform = `scale(${scale})`;
});

