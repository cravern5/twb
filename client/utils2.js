//ctx.drawImage関数
//img	CanvasImageSource	描画する画像
//sx	number	元画像の切り抜き開始位置（X座標 / Source X）
//sy	number	元画像の切り抜き開始位置（Y座標 / Source Y）
//sw	number	元画像から切り抜く幅（Source Width）
//sh	number	元画像から切り抜く高さ（Source Height）
//dx	number	Canvas上の描画開始位置（X座標 / Destination X）
//dy	number	Canvas上の描画開始位置（Y座標 / Destination Y）
//dw	number	Canvas上に描画する幅（Destination Width）
//dh	number	Canvas上に描画する高さ（Destination Height）

//画像イメージ同期処理

export function loadImage(src)
{
	return new Promise((resolve, reject) =>
	{
		const img = new Image();
		img.onload = () =>
		{
			resolve(img);
		}
		img.onerror = (err) =>
		{
			reject(new Error(`画像の読み込みに失敗しました: ${src}`));
		}
		img.src = src;
	});
};

// 角度から「使用する画像」と「反転フラグ」を決定する関数
export function getDirection(angle)
{
	const a = angle;
	let direction = 'forward';
	let flip = false;

	// 8方向の判定 (45度ずつ分割)
	if (a >= 22.5 && a < 67.5) { direction = 'forside'; flip = true; }			// 右下（左下を反転）
	else if (a >= 67.5 && a < 112.5) direction = 'forward';						// 下
	else if (a >= 112.5 && a < 157.5) direction = 'forside';					// 左下
	else if (a >= 157.5 && a < 202.5) direction = 'side';						// 左
	else if (a >= 202.5 && a < 247.5) direction = 'backside';					// 左上
	else if (a >= 247.5 && a < 292.5) direction = 'backward';					// 上
	else if (a >= 292.5 && a < 337.5) { direction = 'backside'; flip = true; }	// 右上（左上を反転）
	else if (a >= 337.5 || a < 22.5) { direction = 'side'; flip = true; }		// 右（左を反転）
	else direction = "forward";

	return { direction: direction, flip: flip };
}

// 24bit HEX (0xRRGGBB)
export function getColor24bit(val)
{
	const hex24 = val;
	const r = (hex24 >> 16) & 0xFF; // 255
	const g = (hex24 >> 8) & 0xFF;  // 0
	const b = hex24 & 0xFF;         // 51

	return { r, g, b };
}

// 32bit HEX (0xRRGGBBAA)
export function getColor32bit(val)
{
	const r = (val >>> 24) & 0xFF;
	const g = (val >>> 16) & 0xFF;
	const b = (val >>> 8) & 0xFF;
	const a = (val & 0xFF);// / 255;少数で欲しい場合

	return { r, g, b, a };
}

// RGBA
export function rgbaToColor(r, g, b, a = 255)
{
	// アルファ値が 0〜1 の場合は 0〜255 に変換
	const alpha = a <= 1 ? Math.round(a * 255) : a;

	// >>> 0 で符号なし32ビット整数に変換（rが128以上で負数になるのを防ぐ）
	return ((r << 24) | (g << 16) | (b << 8) | alpha) >>> 0;
}

// #RRGGBBAA #RGBA
export function hexToRgba(hex)
{
	// #を除去
	let c = hex.replace(/^#/, '');

	// 3桁・4桁の短縮表記（#RGB / #RGBA）を6桁・8桁に拡張
	if (c.length === 3 || c.length === 4)
		c = c.split('').map(char => char + char).join('');

	// 不透明度（Alpha）が指定されていない場合は FF (255) とする
	if (c.length === 6)
		c += 'ff';

	if (c.length !== 8)
		throw new Error('Invalid HEX color code');

	const num = parseInt(c, 16);

	return {
		r: (num >> 24) & 255,
		g: (num >> 16) & 255,
		b: (num >> 8) & 255,
		a: num & 255 // 0〜255の値（0.0〜1.0にしたい場合は (num & 255) / 255）
	};
}

//putImageDataで線を描画  ※moveTo lineToだと1ピクセル単位の描画にならないため
export function drawPixelLine(ctx, x0, y0, x1, y1, color)
{
	let { r, g, b, a } = hexToRgba(color);

	// 描画領域の最小・最大座標を計算（逆方向に引っ張られた場合に対応するため）
	const minX = Math.min(x0, x1);
	const maxX = Math.max(x0, x1);
	const minY = Math.min(y0, y1);
	const maxY = Math.max(y0, y1);

	const width = maxX - minX + 1;
	const height = maxY - minY + 1;

	// バウンディングボックス分のピクセルデータを取得
	const imageData = ctx.getImageData(minX, minY, width, height);
	const data = imageData.data;

	// 指定したピクセル(x, y)に色を書き込む関数
	function _setPixel(x, y)
	{
		// 切り取ったデータ領域（minX, minY）からの相対座標を計算
		const localX = x - minX;
		const localY = y - minY;

		// 配列のインデックス計算（全体の幅ではなく取得領域の幅 width を使用）
		const index = (localY * width + localX) * 4;

		data[index] = r;
		data[index + 1] = g;
		data[index + 2] = b;
		data[index + 3] = a;
	}

	// --- ブレゼンハムのアルゴリズム本体 ---
	const dx = Math.abs(x1 - x0);
	const dy = Math.abs(y1 - y0);
	const sx = (x0 < x1) ? 1 : -1;
	const sy = (y0 < y1) ? 1 : -1;
	let err = dx - dy;

	let x = x0;
	let y = y0;

	while (true)
	{
		// 現在地のピクセルを塗る
		_setPixel(x, y);

		// 終点に到達したらループを抜ける
		if (x === x1 && y === y1)
			break;

		const e2 = err * 2;

		// 誤差に応じてxを進めるかyを進めるか(あるいは両方)を判定
		if (e2 > -dy)
		{
			err -= dy;
			x += sx;
		}
		if (e2 < dx)
		{
			err += dx;
			y += sy;
		}
	}

	// 計算し終えたピクセルデータを正しい位置（minX, minY）に描画
	ctx.putImageData(imageData, minX, minY);
}