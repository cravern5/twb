
/*アンチエイリアス　メモ

1. imageSmoothingEnabledとimage-rendering: pixelatedは「文字の描画」には効かない
これらの設定が制御しているのは、画像(ビットマップ)をdrawImageで拡大・縮小するときの補間方法だけです。fillTextで描かれる文字はビットマップ画像ではなく、
フォントの輪郭(ベクター)をその都度計算して描画しているので、この2つの設定は最初から無関係でした(CSSコメントに「効果なし」と書かれているのは、まさにこれが原因です)。

2. -webkit-font-smoothingとtext-renderingはDOM要素にしか効かない
これらはブラウザがHTMLの文字要素を画面に描画するときのアンチエイリアス設定です。
<canvas>の中に描くfillTextはcanvas自体が独自にラスタライズ(輪郭→ピクセルへの変換)を行うため、外側のCSSはcanvasの中身には一切影響しません。

3. Canvas 2DのfillText自体に「アンチエイリアスを切る」公式APIが存在しない
drawImage用のimageSmoothingEnabledのような、文字専用のオン/オフスイッチはCanvas仕様上用意されていません。
そのため、TrueType/OpenTypeのような輪郭ベースのフォントをfillTextで描く限り、必ず輪郭の境界がアンチエイリアスされます。

*/


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

// 汎用の楕円（円）描画関数
// ctx      : 描画先のCanvasコンテキスト
// color    : 塗りつぶす色（例 'rgba(0,0,0,0.35)'）
// x, y     : 楕円の中心となる基準座標
// width    : 横方向の半径（拡大縮小前の基準サイズ）
// height   : 縦方向の半径（拡大縮小前の基準サイズ）
// scaleX   : width に掛ける倍率（1で等倍、0.5なら半分の幅）
// scaleY   : height に掛ける倍率（1で等倍、0.5なら半分の高さ）
export function drawCircle(ctx, color, x, y, width, height)
{
	// 倍率を掛けて、実際に描画する半径を求める
	const radiusX = width;// * scaleX;
	const radiusY = height;// * scaleY;

	// 描画状態（塗りつぶし色など）を一時的に保存する
	ctx.save();

	ctx.fillStyle = color;

	ctx.beginPath();
	// 楕円を描く（回転なし、0〜2π=1周分をすべて描く）
	ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
	ctx.fill();

	// 保存しておいた描画状態に戻す（他の描画に影響を与えないように）
	ctx.restore();
}

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

//putImageDataで線を描画  ※アンチエイリアス対策　moveTo lineToだと1ピクセル単位の描画にならないため
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

//文字の描画
export function drawText({ canvas, ctx, text, x, y, width, height, font, color, outline = null, letterSpacing = 0 })
{
	//画像に対して有効
	//hpCtx.imageSmoothingEnabled = false;

	// 端末の画面倍率を取得(例:Retinaディスプレイなら2など)
	const dpr = window.devicePixelRatio || 1;

	// 表示サイズ(CSS上の見た目)はそのまま100x30に保つ
	canvas.style.width = width + "px";
	canvas.style.height = height + "px";

	// 内部の実解像度だけ倍率ぶん引き上げる(これで文字がくっきりする)
	//呼び出すたびにcanvasの内容がクリア
	canvas.width = width * dpr;
	canvas.height = height * dpr;

	// 描画命令の座標系も倍率に合わせて拡大しておく(以後は今まで通りの座標で描ける)
	ctx.scale(dpr, dpr);

	// 前回描画した文字を消す(消さないと重ね書きになってしまう)
	//ctx.clearRect(0, 0, 100, 30);

	// フォントと色を指定
	ctx.fillStyle = color;
	ctx.font = font;

	//文字描画
	//ctx.fillText(text, x, y);

	//現在の描画位置(左端)。1文字描くたびにここを右へずらしていく
	let cursorX = x;

	//絵文字やサロゲートペアの文字も1文字として数えられるように[...text]で分解する
	for (const char of [...text])
	{
		if (outline)
		{
			ctx.fillStyle = outline.color;
			ctx.fillText(char, cursorX + outline.x, y + outline.y);
		}

		//1文字だけ描画
		ctx.fillStyle = color;
		ctx.fillText(char, cursorX, y);

		//この文字の実際の描画幅を測定する(フォントによって幅が違うため)
		const charWidth = ctx.measureText(char).width;

		//次の文字の開始位置 = 今の文字の幅 + 文字間隔ぶん右へ
		cursorX += charWidth + letterSpacing;
	}
}

//アンチエイリアスを手動で除去する後処理---
export function removeAntiAliasing({ ctx, width, height })
{
	//canvas上の全ピクセルの色情報(RGBA)をまとめて取得する
	//dataは[R,G,B,A, R,G,B,A, ...]のように4個ずつ並んだ配列になっている
	const imageData = ctx.getImageData(0, 0, width, height);
	const data = imageData.data;

	//アンチエイリアスの境界を「完全に透明」か「完全に不透明」かに振り分ける境目(0〜255)
	const alphaThreshold = 128;

	//R,G,B,Aの4つ1組で進むのでi += 4ずつループする
	for (let i = 0; i < data.length; i += 4)
	{
		//インデックス+3番目がアルファ(透明度)の値
		const alpha = data[i + 3];

		//閾値未満なら完全に透明、以上なら完全に不透明にする
		//→ 中間の薄い色(=ボヤけて見える原因)がなくなる
		data[i + 3] = alpha < alphaThreshold ? 0 : 255;
	}

	//加工したピクセル情報をcanvasに書き戻して画面に反映させる
	ctx.putImageData(imageData, 0, 0);
}