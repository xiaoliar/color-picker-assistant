const colorSwatch = document.getElementById('colorSwatch');
const colorText = document.getElementById('colorText');

const tabs = document.getElementById('tabs');
const tabBar = document.getElementById('tab-bar');
const colorList = document.getElementById('colorList');

let imageCounter = 0; // 用于生成唯一的 tab id
const dpr = window.devicePixelRatio || 1; // 设备像素比，支持高清屏适配



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
magnifier.className = 'magnifier';
document.body.appendChild(magnifier);
const mCtx = magnifier.getContext('2d');
mCtx.imageSmoothingEnabled = false;
mCtx.scale(dpr, dpr);


let currentImageContext = null;


function loadImage(path) {
    const img = new Image();
    img.src = path;
    img.onload = () => {
        const filename = path.split(/[\\/]/).pop(); // 提取文件名

        // 保存原始图片像素的canvas
        const imageCanvas = document.createElement('canvas');
        imageCanvas.width = img.naturalWidth;
        imageCanvas.height = img.naturalHeight;
        imageCanvas.style.width = img.naturalWidth + 'px';
        imageCanvas.style.height = img.naturalHeight + 'px';
        const imgCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
        imgCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

        // 绘制图片到背景层canvas
        const bgCanvas = document.createElement('canvas');
        bgCanvas.id = `tab-${imageCounter++}`;
        bgCanvas.width = img.width * dpr;
        bgCanvas.height = img.height * dpr;
        bgCanvas.style.width = img.width + 'px';
        bgCanvas.style.height = img.height + 'px';
        bgCanvas.className = 'image-canvas';
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.imageSmoothingEnabled = false; // 禁止抗锯齿
        bgCtx.scale(dpr, dpr); // 缩放绘图坐标系，保证坐标系和css尺寸一致
        bgCtx.drawImage(img, 0, 0, img.width, img.height);

        // 预览层canvas
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = img.width * dpr;
        overlayCanvas.height = img.height * dpr;
        overlayCanvas.style.width = img.width + 'px';
        overlayCanvas.style.height = img.height + 'px';
        overlayCanvas.className = 'image-canvas';
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
        let isDrawing = false;
        let startX, startY, isDragging = false;

        overlayCanvas.addEventListener('mousedown', e => {
            startX = e.offsetX;
            startY = e.offsetY;
            isDragging = false;

            const rect = overlayCanvas.getBoundingClientRect();
            startPoint.x = e.clientX - rect.left;
            startPoint.y = e.clientY - rect.top;
            console.log("startPoint:", startPoint);
            isDrawing = true;
        });

        overlayCanvas.addEventListener('mousemove', e => {
            if (!isDrawing) return;

            if (!isDragging) {
                const dx = e.offsetX - startX;
                const dy = e.offsetY - startY;
                // 拖拽操作
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    isDragging = true;
                } else {
                    return;
                }
            }

            const rect = overlayCanvas.getBoundingClientRect();
            endPoint.x = e.clientX - rect.left;
            endPoint.y = e.clientY - rect.top;

            const x = Math.min(startPoint.x, endPoint.x);
            const y = Math.min(startPoint.y, endPoint.y);
            const w = Math.abs(endPoint.x - startPoint.x);
            const h = Math.abs(endPoint.y - startPoint.y);

            // 清除画布并重新绘制预览
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            overlayCtx.strokeStyle = 'red';
            overlayCtx.lineWidth = 1;
            overlayCtx.setLineDash([4, 3]); // 设置虚线：5px 实线 + 3px 空白
            overlayCtx.strokeRect(x, y, w, h);
            overlayCtx.setLineDash([]); // 清除虚线样式，恢复默认
        });

        overlayCanvas.addEventListener('mouseup', e => {
            if (!isDrawing || !isDragging) {
                isDrawing = false;
                isDragging = false;
                return;
            }

            const rect = overlayCanvas.getBoundingClientRect();
            endPoint.x = e.clientX - rect.left;
            endPoint.y = e.clientY - rect.top;
            console.log("endPoint:", endPoint);

            const x = Math.min(startPoint.x, endPoint.x);
            const y = Math.min(startPoint.y, endPoint.y);
            const w = Math.abs(endPoint.x - startPoint.x);
            const h = Math.abs(endPoint.y - startPoint.y);

            // 清除画布并重新绘制预览
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            overlayCtx.strokeStyle = 'white';
            overlayCtx.lineWidth = 1;
            overlayCtx.setLineDash([4, 3]); // 设置虚线：5px 实线 + 3px 空白
            overlayCtx.strokeRect(x, y, w, h);
            overlayCtx.setLineDash([]); // 清除虚线样式，恢复默认

            // 重置状态
            isDrawing = false;
        });

        // 监听鼠标移动绘制放大镜
        overlayCanvas.addEventListener('mousemove', (e) => {
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
            magnifier.style.left = left + 'px';
            magnifier.style.top = top + 'px';


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
        overlayCanvas.addEventListener('mouseleave', () => {
            magnifier.style.display = 'none';
        });

        // 点击时获取当前坐标的像素值
        overlayCanvas.addEventListener('click', (e) => {
            if (isDragging) {
                // 是拖动框选，不执行点击行为
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            // 获取当前鼠标坐标点的颜色值
            const rect = overlayCanvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            const rgba = imgCtx.getImageData(x, y, 1, 1).data;
            // 格式化颜色
            const hex = rgbToHex(rgba[0], rgba[1], rgba[2]);

            // 添加到colorList中
            const item = document.createElement('div');
            item.className = 'color-item';
            item.dataset.pos = `${x}, ${y}`;
            item.dataset.hex = hex;
            item.dataset.rgb = `${rgba[0]}, ${rgba[1]}, ${rgba[2]}`;
            item.innerHTML = `<div class="color-swatch" style="background-color: ${hex};"></div><span>(${x}, ${y}) - ${hex} (${rgba[0]}, ${rgba[1]}, ${rgba[2]})</span>`;

            item.addEventListener('click', () => {
                selectItem(item);
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                selectItem(item);

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


        // 创建tab button
        const tabButton = document.createElement('div');
        tabButton.textContent = filename;
        tabButton.className = 'tab-button';
        tabButton.addEventListener('click', () => {
            // 隐藏所有的tab页面
            document.querySelectorAll('.image-canvas').forEach(c => c.style.display = 'none');
            // 取消激活所有的tab button
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            // 显示当前tab
            bgCanvas.style.display = 'block';
            overlayCanvas.style.display = 'block';
            // 激活所当前tab button
            tabButton.classList.add('active');
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
        tabClose.className = 'tab-close';
        tabClose.textContent = ' x '
        tabClose.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发 tab 切换
            if (!confirm("确认关闭这个图片？\n" + filename)) return;
            const wasActive = tabButton.classList.contains('active');
            tabButton.remove();
            bgCanvas.remove();
            overlayCanvas.remove();
            if (wasActive) {
                const allTabs = document.querySelectorAll('.tab-button');
                if (allTabs.length > 0) {
                    allTabs[allTabs.length - 1].click();
                }
            }

        });

        tabButton.appendChild(tabClose);
        tabBar.appendChild(tabButton);

        // 创建图片容器
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.display = 'inline-block';
        // 叠加canvas层
        container.appendChild(bgCanvas);
        container.appendChild(overlayCanvas);
        tabs.appendChild(container);

        // 默认激活首个
        if (imageCounter === 1) {
            tabButton.click();
        }
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

window.electronAPI.onLoadImages((paths) => {
    paths.forEach(loadImage);
});

window.electronAPI.onTriggerCapture(() => {
    // alert('框选截图功能开发中...');
    if (!currentImageContext) {
        alert('当前图片上下文为空');
    } else {
        cropSelection(currentImageContext);
    }

});

const cropSelection = ({ startPoint, endPoint, imageCanvas }) => {
    if (!startPoint || !endPoint) return;

    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const w = Math.abs(endPoint.x - startPoint.x);
    const h = Math.abs(endPoint.y - startPoint.y);

    if (w === 0 || h === 0) return;

    // 创建离屏 canvas 存储裁剪结果
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext('2d');

    // 从原图拷贝像素到裁剪画布
    cropCtx.drawImage(
        imageCanvas, // 源 canvas
        x, y, w, h,  // 源图区域
        0, 0, w, h   // 目标区域
    );

    // 可选：显示或导出裁剪结果
    const croppedImageDataUrl = cropCanvas.toDataURL(); // base64
    const croppedImg = new Image();
    croppedImg.src = croppedImageDataUrl;
    console.log(croppedImageDataUrl)
    // document.body.appendChild(croppedImg); // 或自定义容器
    colorList.appendChild(croppedImg); // 或自定义容器
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

window.addEventListener('keydown', async (event) => {
    const code = event.code;
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
        step = fastStep;
        return;
    }

    if (keyMap[code]) {
        event.preventDefault(); // 阻止默认滚动等行为
        const [dx, dy] = keyMap[code]();
        const res = await window.electronAPI.moveMouseRelative(dx, dy);
        if (!res.success) {
            console.error('移动鼠标失败:', res.error);
        } else {
            // console.log('鼠标新坐标:', res.x, res.y);
        }
    } else if (code === 'Space') {
        window.electronAPI.simulateClick();
        event.preventDefault();
    }
});

window.addEventListener('keyup', (event) => {
    const code = event.code;
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
        step = normalStep;
    }
});

let currentSelectedItem = null;
function selectItem(item) {
    // 先取消之前选中的
    document.querySelectorAll('.color-item.selected').forEach(e => {
        e.classList.remove('selected');
    });

    // 给当前 item 添加 selected 类
    item.classList.add('selected');
    currentSelectedItem = item;
}

window.electronAPI.onDeleteColorItem(() => {
    if (currentSelectedItem) {
        currentSelectedItem.remove();
        currentSelectedItem = null;
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
});


