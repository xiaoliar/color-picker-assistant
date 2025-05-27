const colorSwatch = document.getElementById('colorSwatch');
const colorText = document.getElementById('colorText');

const tabs = document.getElementById('tabs');
const tabBar = document.getElementById('tab-bar');
const colorList = document.getElementById('colorList');

const magnifierSize = 221; // 偶数也可以，但奇数更好定位中心像素
const zoomPixelCount = 13; // 放大镜显示的像素点数 (横向和纵向都是)
const pixelSize = magnifierSize / zoomPixelCount; // 每个像素块实际大小
const dpr = window.devicePixelRatio || 1; // 设备像素比，支持高清屏适配

let imageCounter = 0;

function loadImage(path) {
    const img = new Image();
    img.src = path;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        canvas.className = 'image-canvas';

        // 定义放大镜
        let magnifier = document.createElement('canvas');
        // 设置canvas实际绘制尺寸（物理像素），同时保持css大小不变
        magnifier.width = magnifierSize * dpr;
        magnifier.height = magnifierSize * dpr;
        magnifier.style.width = magnifierSize + 'px';
        magnifier.style.height = magnifierSize + 'px';

        magnifier.className = 'magnifier';
        document.body.appendChild(magnifier);
        const mCtx = magnifier.getContext('2d');
        // 缩放绘图坐标系，保证坐标系和css尺寸一致
        mCtx.scale(dpr, dpr);

        // 监听鼠标移动绘制放大镜
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            const data = ctx.getImageData(x, y, 1, 1).data;
            const hex = rgbToHex(data[0], data[1], data[2]);
            colorSwatch.style.backgroundColor = hex;
            colorText.textContent = `${hex} (${data[0]}, ${data[1]}, ${data[2]}) @ (${x}, ${y})`;

            // 放大镜位置防止超出
            let left = e.pageX + 10;
            let top = e.pageY + 10;
            if (left + magnifierSize > window.innerWidth) left = e.pageX - magnifierSize - 10;
            if (top + magnifierSize > window.innerHeight) top = e.pageY - magnifierSize - 10;
            magnifier.style.left = left + 'px';
            magnifier.style.top = top + 'px';

            // 1. 背景黑
            mCtx.fillStyle = 'black';
            mCtx.fillRect(0, 0, magnifierSize, magnifierSize);

            // 2. 放大图像（禁止抗锯齿）
            mCtx.imageSmoothingEnabled = false;
            mCtx.drawImage(
                canvas,
                x - Math.floor(zoomPixelCount / 2),
                y - Math.floor(zoomPixelCount / 2),
                zoomPixelCount,
                zoomPixelCount,
                0,
                0,
                magnifierSize,
                magnifierSize
            );

            // 3. 像素网格
            mCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            mCtx.lineWidth = 1;
            for (let i = 0; i <= zoomPixelCount; i++) {
                mCtx.beginPath();
                mCtx.moveTo(i * pixelSize, 0);
                mCtx.lineTo(i * pixelSize, magnifierSize);
                mCtx.stroke();

                mCtx.beginPath();
                mCtx.moveTo(0, i * pixelSize);
                mCtx.lineTo(magnifierSize, i * pixelSize);
                mCtx.stroke();
            }

            // 4. 红色边框框住中心像素格
            const centerIndex = Math.floor(zoomPixelCount / 2);
            const highlightX = centerIndex * pixelSize;
            const highlightY = centerIndex * pixelSize;

            mCtx.strokeStyle = 'red';
            mCtx.lineWidth = 2;
            mCtx.strokeRect(highlightX, highlightY, pixelSize, pixelSize);

            // 5. 显示中心像素的 RGB / HEX 数值悬浮文字
            const text = `${hex}  RGB(${data[0]},${data[1]},${data[2]})`;

            mCtx.font = `bold ${14}px monospace`;
            mCtx.fillStyle = 'white';
            mCtx.textBaseline = 'top';

            // 给文字加个半透明黑色背景，提升可读性
            const padding = 4;
            const textWidth = mCtx.measureText(text).width;
            const textHeight = 16; // 估算字体高度

            // 文字位置：放大镜底部中央偏上
            let textX = (magnifierSize - textWidth) / 2;
            let textY = magnifierSize - textHeight - padding;

            mCtx.fillStyle = 'rgba(0,0,0,0.6)';
            mCtx.fillRect(textX - padding, textY - padding, textWidth + padding * 2, textHeight + padding * 2);

            mCtx.fillStyle = 'white';
            mCtx.fillText(text, textX, textY);

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
            const data = ctx.getImageData(x, y, 1, 1).data;
            // 格式化颜色
            const hex = rgbToHex(data[0], data[1], data[2]);

            // 添加到colorList中
            // const item = document.createElement('div');
            // item.className = 'color-item';
            // item.textContent = `(${x}, ${y}) - ${hex} (${data[0]}, ${data[1]}, ${data[2]})`;
            // colorList.appendChild(item);


            const item = document.createElement('div');
            item.className = 'color-item';
            item.dataset.color = hex; // 用于复制
            item.innerHTML = `
  <div class="color-swatch" style="background-color: ${hex};"></div>
  <span>(${x}, ${y}) - ${hex} (${data[0]}, ${data[1]}, ${data[2]})</span>
`;
            colorList.appendChild(item);


        });

        // tab的id
        const tabId = `tab-${imageCounter++}`;
        canvas.id = tabId;

        // 创建tab button
        const button = document.createElement('div');
        button.className = 'tab-button';
        button.textContent = path.split(/[\\/]/).pop(); // 提取文件名
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
            if (!confirm("确认关闭这个图片？")) return;
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

colorList.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const item = e.target.closest('.color-item');
    if (!item) return;

    const color = item.dataset.color;
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `<div class="menu-item">复制颜色值 ${color}</div>`;

    // 设置菜单位置
    menu.style.top = e.pageY + 'px';
    menu.style.left = e.pageX + 'px';
    document.body.appendChild(menu);

    // 点击菜单项执行复制
    menu.querySelector('.menu-item').addEventListener('click', () => {
        navigator.clipboard.writeText(color).then(() => {
            console.log('已复制:', color);
        });
        menu.remove();
    });

    // 点击其他地方移除菜单
    document.addEventListener('click', () => menu.remove(), { once: true });
});

window.electronAPI.onLoadImages((paths) => {
    paths.forEach(loadImage);
});

window.electronAPI.onTriggerCapture(() => {
    alert('框选截图功能开发中...');
});

