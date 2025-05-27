const colorSwatch = document.getElementById('colorSwatch');
const colorText = document.getElementById('colorText');

const tabs = document.getElementById('tabs');
const tabBar = document.getElementById('tab-bar');
const colorList = document.getElementById('colorList');

let imageCounter = 0; // 用于生成唯一的 tab id
const dpr = window.devicePixelRatio || 1; // 设备像素比，支持高清屏适配



// 定义放大镜
const zoomPixelCount = 15; // 放大镜显示的像素点数 (横向和纵向都是)
const pixelSize = 17; // 放大镜显示的像素点每个像素块实际大小
const magnifierSize = zoomPixelCount * pixelSize; // 放大镜大小
const textBgHeight = 22;
const magnifier = document.createElement('canvas');
magnifier.width = magnifierSize * dpr;
magnifier.height = (magnifierSize + textBgHeight) * dpr;
magnifier.style.width = magnifierSize + 'px';
magnifier.style.height = (magnifierSize + textBgHeight)+ 'px';
magnifier.style.display = 'none'; // 初始隐藏
magnifier.className = 'magnifier';
document.body.appendChild(magnifier);
const mCtx = magnifier.getContext('2d');
mCtx.imageSmoothingEnabled = false;
mCtx.scale(dpr, dpr);


function loadImage(path) {
    const img = new Image();
    img.src = path;
    img.onload = () => {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.naturalWidth;
        srcCanvas.height = img.naturalHeight;
        srcCanvas.style.width = img.naturalWidth + 'px';
        srcCanvas.style.height = img.naturalHeight + 'px';
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        // const imageData = srcCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
        // console.log(imageData.data); // 原始像素数据


        // 绘制图片到canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width * dpr;
        canvas.height = img.height * dpr;
        canvas.style.width = img.width + 'px';
        canvas.style.height = img.height + 'px';
        canvas.className = 'image-canvas';
        const ctx = canvas.getContext('2d');
        // 禁止抗锯齿
        ctx.imageSmoothingEnabled = false;
        ctx.scale(dpr, dpr); // 缩放绘图坐标系，保证坐标系和css尺寸一致
        ctx.drawImage(img, 0, 0, img.width, img.height);

        // 监听鼠标移动绘制放大镜
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            const rgba = srcCtx.getImageData(x, y, 1, 1).data;
            const hex = rgbToHex(rgba[0], rgba[1], rgba[2]);
            // 设置状态栏的当前颜色
            colorSwatch.style.backgroundColor = hex;
            colorText.textContent = `${hex} (${rgba[0]}, ${rgba[1]}, ${rgba[2]}) @ (${x}, ${y})`;

            // 放大镜位置防止超出
            let left = e.pageX + 10;
            let top = e.pageY + 10;
            if (left + magnifierSize > window.innerWidth) left = e.pageX - magnifierSize - 10;
            if (top + magnifierSize > window.innerHeight) top = e.pageY - magnifierSize - 10;
            magnifier.style.left = left + 'px';
            magnifier.style.top = top + 'px';

            // 1. 背景黑
            // mCtx.fillStyle = 'black';
            // mCtx.fillRect(0, 0, magnifierSize, magnifierSize);


            // 2.填充像素颜色值
            var imageData = srcCtx.getImageData(
                x - Math.floor(zoomPixelCount / 2),
                y - Math.floor(zoomPixelCount / 2),
                zoomPixelCount,
                zoomPixelCount
            );

            // 逐像素放大绘制
            for (let y = 0; y < zoomPixelCount; y++) {
                for (let x = 0; x < zoomPixelCount; x++) {
                    let index = (y * zoomPixelCount + x) * 4;

                    let r = imageData.data[index];
                    let g = imageData.data[index + 1];
                    let b = imageData.data[index + 2];

                    mCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    mCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                    // mCtx.fillRect(x , y , 1, 1);
                }
            }


            // 3. 绘制像素网格
            mCtx.strokeStyle = 'rgb(88, 88, 88)';
            mCtx.lineWidth = 1;
            for (let i = 0; i <= zoomPixelCount; i++) {
                // 画竖线
                mCtx.beginPath();
                mCtx.moveTo(i * pixelSize, 0);
                mCtx.lineTo(i * pixelSize, magnifierSize);
                mCtx.stroke();

                // 画横线
                mCtx.beginPath();
                mCtx.moveTo(0, i * pixelSize);
                mCtx.lineTo(magnifierSize, i * pixelSize);
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
            const text = `${hex}  Pos(${x}, ${y})`;
            const metrics = mCtx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
            const fontSize = 13; // 定义一个字体高度
            // 放大镜底部给文字加个半透明黑色背景，提升可读性
            mCtx.fillStyle = 'black';
            // 半透明黑色背景位置：放大镜底部
            mCtx.fillRect(0, magnifierSize, magnifierSize, textBgHeight);
            // 绘制文字
            mCtx.fillStyle = 'white';
            mCtx.font = `${fontSize}px monospace`;
            mCtx.textBaseline = 'top';
            // 文字位置：黑色背景中央
            const textX = (magnifierSize - textWidth) / 2;
            const textY = magnifierSize + (textBgHeight - textHeight) / 2;
            mCtx.fillText(text, textX, textY);
            // 绘制颜色块
            const colorBlockX = textX - textHeight - 4;
            const colorBlockY = textY;
            const blockSize = textHeight;
            mCtx.fillStyle = `rgb(${rgba[0]}, ${rgba[1]}, ${rgba[2]})`;
            mCtx.fillRect(colorBlockX, colorBlockY, blockSize, blockSize);
            // 绘制颜色块边框
            mCtx.strokeStyle = 'rgb(238, 238, 238)';
            mCtx.lineWidth = 1;
            mCtx.strokeRect(colorBlockX, colorBlockY, blockSize, blockSize);

            // 6. 显示放大镜
            magnifier.style.display = 'block';
        });

        // 鼠标移出区域时隐藏放大镜
        canvas.addEventListener('mouseleave', () => {
            magnifier.style.display = 'none';
        });

        // 点击时获取当前坐标的像素值
        canvas.addEventListener('click', (e) => {
            // 获取当前鼠标坐标点的颜色值
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            const rgba = srcCtx.getImageData(x, y, 1, 1).data;
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

        // tab的id
        const tabId = `tab-${imageCounter++}`;
        canvas.id = tabId;

        // 创建tab button
        const button = document.createElement('div');
        button.className = 'tab-button';
        const filename = path.split(/[\\/]/).pop(); // 提取文件名
        button.textContent = filename;
        button.addEventListener('click', () => {
            // 隐藏所有的tab
            document.querySelectorAll('.image-canvas').forEach(c => c.style.display = 'none');
            // 取消激活所有的tab button
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            // 显示当前tab
            canvas.style.display = 'block';
            // 激活所当前tab button
            button.classList.add('active');
        });

        // 创建tab close
        const tabClose = document.createElement("span");
        tabClose.className = 'tab-close';
        tabClose.textContent = ' x '
        tabClose.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发 tab 切换
            if (!confirm("确认关闭这个图片？\n" + filename)) return;
            const wasActive = button.classList.contains('active');
            button.remove();
            canvas.remove();
            if (wasActive) {
                const allTabs = document.querySelectorAll('.tab-button');
                if (allTabs.length > 0) {
                    allTabs[allTabs.length - 1].click();
                }
            }

        });

        button.appendChild(tabClose);
        tabBar.appendChild(button);
        tabs.appendChild(canvas);

        // 默认激活首个
        if (imageCounter === 1) {
            button.click();
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
    alert('框选截图功能开发中...');
});


// 方向映射，每次移动1像素
let step = 1;
const keyGroups = [
    { keys: ['arrowup', 'w', 'i'], get dir() { return [0, -step]; } },
    { keys: ['arrowdown', 's', 'k'], get dir() { return [0, step]; } },
    { keys: ['arrowleft', 'a', 'j'], get dir() { return [-step, 0]; } },
    { keys: ['arrowright', 'd', 'l'], get dir() { return [step, 0]; } },
];

const keyMap = {};
keyGroups.forEach(({ keys, dir }) => {
    keys.forEach(key => {
        keyMap[key] = dir;
    });
});

window.addEventListener('keydown', async (event) => {
    const key = event.key.toLowerCase();
    if (keyMap[key]) {
        event.preventDefault(); // 阻止默认滚动等行为
        const [dx, dy] = keyMap[key];
        const res = await window.electronAPI.moveMouseRelative(dx, dy);
        if (!res.success) {
            console.error('移动鼠标失败:', res.error);
        } else {
            console.log('鼠标新坐标:', res.x, res.y);
        }
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


