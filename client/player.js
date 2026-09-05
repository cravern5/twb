import { print, addLog } from '../shared/sub.js';

import * as utils2 from './utils2.js';
import * as input from './input.js';
import { canvas, ctx } from './engine.js';
import { MAP_WIDTH, MAP_HEIGHT, camera } from './world.js';
import * as world from './world.js';

export let playerName = "名無し";

export let charactor = "maximin";
export let isSitting = false;				//立ち/座り
export let isRunning = true; 				//走り/歩き
export let state = "idle";
export let direction = "forward";
export let flip = false;//false=左
export const position = { x: 2585, y: 1956 };	//プレイヤー位置
export let currentFrame = 0; 				// 何コマ目を表示しているか(0番目からスタート)
//export const ANIMATION_SPEED = 10; 		// フレーム更新の速さ（値が小さいほど速い）
export let FRAME_DURATION = 0.07;			// アニメーションの更新間隔（秒単位：例 0.1秒ごとに1コマ進める）
export let frameTimer = 0;					// コマ切り替え用の経過時間カウンター
export const MOVE_SPEED = 200; 				// 1秒あたりの移動ピクセル数
export const MOVE_SPEED_X_RATIO = 1.66;		//横方向の体感速度を補正するための倍率、横長なほど横移動が遅く感じる
//export const MOVE_SPEED_X = 330;			// 横移動の速さ（1秒あたりのピクセル数）
//export const MOVE_SPEED_Y = 200;			// 縦移動の速さ（1秒あたりのピクセル数）
export const SPRITE_WIDTH = 70;
export const SPRITE_HEIGHT = 95;

export let moveTarget = null;// マウスクリックで指定した「目的地」（ワールド座標）、null のときは目的地なし＝マウスでは移動していない状態
const MOVE_TARGET_THRESHOLD = 4;// 目的地にどれだけ近づいたら「到着」とみなすか（px）

//キャラクター画像
export const assets = {};
export const assetPaths =
{
	run_backside: '/assets/player/' + charactor + '/run/backside.png',
	run_backward: '/assets/player/' + charactor + '/run/backward.png',
	run_forside: '/assets/player/' + charactor + '/run/forside.png',
	run_forward: '/assets/player/' + charactor + '/run/forward.png',
	run_side: '/assets/player/' + charactor + '/run/side.png',

	idle_backside: '/assets/player/' + charactor + '/idle/backside.png',
	idle_backward: '/assets/player/' + charactor + '/idle/backward.png',
	idle_forside: '/assets/player/' + charactor + '/idle/forside.png',
	idle_forward: '/assets/player/' + charactor + '/idle/forward.png',
	idle_side: '/assets/player/' + charactor + '/idle/side.png',
};

//チャットバブル
export let bubbleText = null;	// 頭上に表示中のチャット内容（null＝非表示中）
let bubbleTimer = 0;			// ふきだしが消えるまでの残り時間（秒）
const BUBBLE_DURATION = 4;		// ふきだしを表示しておく秒数
let bubbleFont = "14px 'MS PGothic', 'Meiryo', sans-serif";	//バブルフォント
let bubbleColor = "#CEFFCE";								//バブル文字色
let bubbleBackcolor = "rgba(0, 0, 0, 0.6)";				//バブル背景色

//チャットバブル(css読み取り)
const chatFontElement = document.getElementById("chatInput");
if (chatFontElement)
{
	// "font-size" と "font-family" をつなげて、ctx.fontで使える形の文字列にしておく（毎フレーム計算すると無駄なので、最初に1回だけ作って使い回す）
	const chatFontStyle = getComputedStyle(chatFontElement);
	bubbleFont = chatFontStyle.fontSize && chatFontStyle.fontFamily ? (`${chatFontStyle.fontSize} ${chatFontStyle.fontFamily}`) : ("");
	bubbleColor = chatFontStyle.color;
}


//初期化
export async function init()
{
	//画像読み込み　ループで一気に Image オブジェクトを作る
	for (const [key, path] of Object.entries(assetPaths))
	{
		try
		{
			assets[key] = [];
			assets[key].img = await utils2.loadImage(path);
			assets[key].frameWidth = SPRITE_WIDTH;
			assets[key].frameHeight = SPRITE_HEIGHT;
			assets[key].frameCount = assets[key].img.width / assets[key].frameWidth;

		}
		catch (e)
		{
			addLog("ERROR", "プレイヤーファイル読み込みエラー：" + key + " " + e.message);
		}
	}
}

//足元座標
export function getFoot(screenX, screenY)
{
	return { x: screenX + SPRITE_WIDTH / 2 + 0, y: screenY + SPRITE_HEIGHT - 14.5 };
}

//キーボードのw/a/s/dが押されているかどうか
function isKeyMoving(key = input.keysPress)
{
	return (key.w || key.a || key.s || key.d);
}

//移動しているかどうか（キーボード操作 or バーチャル十字キー or マウスの目的地移動）
export function isMoving(key = input.keysPress)
{
	const virtualMoving = (input.virtualMove.x !== 0 || input.virtualMove.y !== 0);

	return isKeyMoving(key) || virtualMoving || moveTarget !== null;
}

//キーの移動量取得
export function getMovement(key = input.keysPress)
{
	// キーボード入力があれば、そちらを優先する（マウス移動は中断する）
	if (isKeyMoving(key))
	{
		moveTarget = null;

		let moveX = 0;
		let moveY = 0;

		// キー入力状態に応じて移動方向を設定
		if (key.w) moveY -= 1;
		if (key.s) moveY += 1;
		if (key.a) moveX -= 1;
		if (key.d) moveX += 1;

		// 斜め移動時に移動速度が速くならないよう正規化
		if (moveX !== 0 && moveY !== 0)
		{
			moveX *= Math.SQRT1_2; // 1 / sqrt(2)
			moveY *= Math.SQRT1_2;
		}

		return { x: moveX, y: moveY };
	}

	// バーチャル十字キー（スマホ）の入力があれば、それを使う
	if (input.virtualMove.x !== 0 || input.virtualMove.y !== 0)
	{
		// タッチ操作を優先する（マウスクリックでの目的地移動は中断する）
		moveTarget = null;
		return { x: input.virtualMove.x, y: input.virtualMove.y };
	}

	// マウスの目的地に向かって移動する
	if (moveTarget)
	{
		// スプライトの中央ではなく「足元（下端の中央）」を基準にする、クリックした場所に、見た目の足がぴったり来るようにするため
		const foot = getFoot(position.x, position.y);

		const dx = moveTarget.x - foot.x;
		const dy = moveTarget.y - foot.y;
		const dist = Math.hypot(dx, dy);

		// 十分近づいたら到着とみなし、目的地をクリアする
		if (dist < MOVE_TARGET_THRESHOLD)
		{
			moveTarget = null;
			return { x: 0, y: 0 };
		}

		// 目的地の方向を向いた「長さ1のベクトル」を返す
		return { x: dx / dist, y: dy / dist };
	}


	return { x: 0, y: 0 };
}

//位置移動
export function updatePosition(delta, move)
{
	if (move.x !== 0 || move.y !== 0)
	{
		if (moveTarget)
		{
			//マウス移動中は、x/yを別々に加速するのではなく
			// 「進む向き」に応じた1つの速度を、x・yどちらにも同じ倍率でかける
			// （move.xが1に近い＝横方向に近いほど、速度がMOVE_SPEED_X_RATIO倍に近づく）
			// こうすることで実際に進む向きが必ずmove.x, move.yと一致し、
			// 目的地付近で急に向きが変わらなくなる
			const speed = MOVE_SPEED * (1 + Math.abs(move.x) * (MOVE_SPEED_X_RATIO - 1));

			position.x += move.x * speed * delta;
			position.y += move.y * speed * delta;
		}
		else
		{
			// キーボード・バーチャル十字キーの場合は、これまで通り横方向にだけ比率を掛ける
			position.x += move.x * MOVE_SPEED * MOVE_SPEED_X_RATIO * delta;
			position.y += move.y * MOVE_SPEED * delta;
		}

		// 画面(canvas)の外ではなく、マップ全体(MAP_WIDTH/MAP_HEIGHT)の外に出ないよう制限する
		position.x = Math.max(0, Math.min(MAP_WIDTH - SPRITE_WIDTH, position.x));
		position.y = Math.max(0, Math.min(MAP_HEIGHT - SPRITE_HEIGHT, position.y));
	}
}

//キャラ(状態、方向、反転)の設定
export function updateState(move)
{
	let changed = false;
	let s = state;
	let d = direction;
	let f = flip;

	//状態
	if (move.x !== 0 || move.y !== 0)
		s = isRunning ? "run" : "walk";
	else
		s = "idle";

	// 動いていない場合は、直前の向きをそのまま維持する
	if (move.x !== 0 || move.y !== 0)
	{
		// 移動ベクトルの向いている角度を求める（画面はyが下向きなので、0=右、90°=下、180°=左、-90°=上）
		const angle = Math.atan2(move.y, move.x);

		// 角度を45度(=PI/4)刻みに丸めて、8方向のうちどれに一番近いかを求める（0〜7の整数）
		const octant = Math.round(angle / (Math.PI / 4)) & 7;

		// 求めた8方向の番号を、実際のスプライトの向き(d)と反転(f)に変換する
		switch (octant)
		{
			case 0: d = 'side'; f = true; break;			// 右
			case 1: d = 'forside'; f = true; break;		// 右下（左下を反転）
			case 2: d = 'forward'; f = false; break;		// 下
			case 3: d = 'forside'; f = false; break;		// 左下
			case 4: d = 'side'; f = false; break;			// 左
			case 5: d = 'backside'; f = false; break;		// 左上
			case 6: d = 'backward'; f = false; break;		// 上
			case 7: d = 'backside'; f = true; break;		// 右上（左上を反転）
		}
	}

	changed = (s != state || d != direction || f != flip);

	state = s;
	direction = d;
	flip = f;

	return changed;
}

// クリックした場所を目的地として登録する関数(game.jsなどで呼び出し用)
export function setMoveTarget(x, y)
{
	moveTarget = { x, y };
}

//頭上にチャット内容のふきだしを表示する
export function showBubble(text)
{
	//表示するテキストと、残り表示時間をセットするだけ
	//（実際の描画は毎フレームupdate()の中で行う）
	bubbleText = text;
	bubbleTimer = BUBBLE_DURATION;
}

//画面更新
export function update(delta)
{
	//移動量はここで1回だけ計算し、updatePositionとupdateStateの両方に渡す、2回計算すると、その間にpositionが変わってしまい向きがズレるため
	const move = getMovement();

	//移動処理を追加
	updatePosition(delta, move);

	//状態変化
	if (updateState(move))
	{
		//状態変化したらフレームは最初に
		currentFrame = 0;
	}

	//addLog("direction:" + olddirection + "→" + direction + " state:" + oldstate + "→" + state);

	let asset = assets[state + "_" + direction];

	//実際に経過した時間(delta)を加算する
	frameTimer += delta;

	// 設定した時間（0.1秒）を超えたらコマを進める
	if (frameTimer >= FRAME_DURATION)
	{
		// 余剰時間を保持してタイミングを滑らかに維持する
		frameTimer %= FRAME_DURATION;

		// 最後のコマまで来たら最初のコマに戻る
		currentFrame = (currentFrame + 1) % asset.frameCount;
	}

	// 描画前に一旦キャンバスをクリアする
	//ctx.clearRect(position.x, position.y, player.frameWidth, player.frameHeight);

	//ワールド座標(position)からカメラ位置を引いて「画面上の描画位置」を求める、プレイヤーが動いてもカメラが追従して常に画面中央に見える
	const screenX = position.x - camera.x;
	const screenY = position.y - camera.y;

	//足の位置
	const foot = getFoot(screenX, screenY);

	//影の描画
	drawShadow(ctx, foot);

	//キャラクター描画
	drawCharactor(ctx, asset, screenX, screenY);

	//吹き出し描画
	if (bubbleTimer > 0)
	{
		//ふきだしを表示中なら、残り時間を減らしていく
		bubbleTimer -= delta;

		//まだ時間が残っていれば、頭の少し上にふきだしを描画する
		if (bubbleTimer > 0)
			drawBubble(playerName + " ： " + bubbleText, screenX + SPRITE_WIDTH / 2, screenY - 5);
	}
}


//影の描画
function drawShadow(ctx, foot)
{
	//影の描画
	utils2.drawCircle(
		ctx, 'rgba(0, 0, 0, 0.6)', foot.x, foot.y,
		SPRITE_WIDTH * 0.25,//幅
		SPRITE_WIDTH * 0.1//高さ
	);
	//utils2.drawShadow(ctx, 'rgba(0, 0, 0, 0.5)', screenX + 5, screenY - 15, SPRITE_WIDTH - 10, SPRITE_HEIGHT);
}


//キャラクター描画
function drawCharactor(ctx, asset, x, y)
{
	// スプライトシートから該当コマだけを切り出して描画する
	if (flip)
	{
		//描画状態（座標系の回転・拡大縮小・移動、透過度、塗りつぶし色など）をスタックに保存・復元するための命令
		ctx.save();
		ctx.scale(-1, 1);
		ctx.drawImage(
			asset.img,
			currentFrame * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight,
			-x - asset.frameWidth, y, asset.frameWidth, asset.frameHeight
		);
		ctx.restore();
	}
	else
	{
		ctx.drawImage(
			asset.img,
			currentFrame * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight,
			x, y, asset.frameWidth, asset.frameHeight
		);
	}
}

//テキストを、指定した幅(maxWidth)に収まるように1行ずつ分割する
function wrapText(text, maxWidth)
{
	const lines = [];		// 完成した行を入れていく配列
	let currentLine = "";	// 今組み立て中の行

	//1文字ずつ確認しながら、幅に収まる分だけ行を区切っていく
	for (const char of text)
	{
		const testLine = currentLine + char;	// 1文字足してみたときの文字列

		//1文字足すと幅をオーバーする場合は、そこで行を区切る
		//（currentLineが空文字の場合は、1文字も入らないバグを防ぐためオーバーしても続行する）
		if (ctx.measureText(testLine).width > maxWidth && currentLine !== "")
		{
			lines.push(currentLine);	// 今の行を確定
			currentLine = char;			// 新しい行を、はみ出した1文字から開始
		}
		else
		{
			currentLine = testLine;
		}
	}

	//最後まで作っていた行が残っていれば、それも追加する
	if (currentLine !== "")
		lines.push(currentLine);

	return lines;
}

// ↑↑↑ ここまで追加 ↑↑↑

function drawBubble(text, x, y)
{
	const maxBoxWidth = 197;	// ふきだしの最大の幅
	const maxBoxHeight = 73;	// ふきだしの最大の高さ
	const paddingX = 10;		// 文字の左右の余白
	const paddingY = 6;		// 文字の上下の余白
	const lineHeight = 20;		// 1行分の高さ（フォントサイズ14pxに行間を足した目安）

	ctx.font = bubbleFont;

	// xを中心にして描く// yを縦方向の中心にして描く
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	// 実際に文字を置ける横幅・最大行数を、余白を引いて計算する
	const maxTextWidth = maxBoxWidth - paddingX * 2;
	const maxLines = Math.floor((maxBoxHeight - paddingY * 2) / lineHeight);

	// 幅に収まるように、テキストを複数行に分割する
	let lines = wrapText(text, maxTextWidth);

	// 表示できる行数をオーバーしていたら、最後の行を省略して"..."を付ける
	if (lines.length > maxLines)
	{
		// 表示できる行数分だけ残す（はみ出した分は切り捨て）
		lines = lines.slice(0, maxLines);

		// 最後の行を、"..."を付けても幅に収まるまで、後ろから1文字ずつ削る
		let lastLine = lines[maxLines - 1];
		while (ctx.measureText(lastLine + "...").width > maxTextWidth && lastLine.length > 0)
			lastLine = lastLine.slice(0, -1);

		lines[maxLines - 1] = lastLine + "...";
	}

	// 実際に表示する行の中で、一番幅が広い行に合わせて背景の横幅を決める（最大幅は超えない）
	let widestLineWidth = 0;
	for (const line of lines)
		widestLineWidth = Math.max(widestLineWidth, ctx.measureText(line).width);

	const boxWidth = Math.min(maxBoxWidth, widestLineWidth + paddingX * 2);
	const boxHeight = lines.length * lineHeight + paddingY * 2;

	// 四角の左上座標（xを中心にしたいので、幅の半分だけ左にずらす）
	const boxX = x - boxWidth / 2;
	const boxY = y - boxHeight;

	// 薄い黒背景の四角を描画
	ctx.fillStyle = bubbleBackcolor;
	ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

	// 文字を1行ずつ描画する（各行が縦方向にも中央に来るように位置を計算）
	ctx.fillStyle = bubbleColor;
	for (let i = 0; i < lines.length; i++)
	{
		const lineY = boxY + paddingY + lineHeight * i + lineHeight / 2;
		ctx.fillText(lines[i], x, lineY);
	}

	// 実際に画面へ描画した文字列を返す（複数行の場合は改行でつなげる）
	return lines.join("\n");
}

/*divでチャットバブル表現

function update(delta)
{
		//時間切れになったら非表示にする
		if (bubbleTimer <= 0)
		{
			bubbleElement.style.display = 'none';
		}
		else
		{
			//canvas自体が画面上のどこにあるかを取得する
			//（screenX/screenYは「canvasの中での位置」なので、ページ全体での位置に変換する必要がある）
			const canvasRect = canvas.getBoundingClientRect();

			//キャラクターの頭の少し上にふきだしが来るように位置を計算する
			bubbleElement.style.left = (canvasRect.left + screenX + SPRITE_WIDTH / 2) + "px";
			bubbleElement.style.top = (canvasRect.top + screenY - 10) + "px";
		}
}

// ふきだし用のHTML要素を、最初に1つだけ作って画面(body)に追加しておく
// （毎回作り直すと重くなるので、使い回す）
const bubbleElement = document.createElement('div');
bubbleElement.className = 'chat-bubble';	// chat.cssで定義済みの見た目を適用
bubbleElement.style.display = 'none';		// 最初は非表示にしておく
document.body.appendChild(bubbleElement);

//頭上にチャット内容のふきだしを表示する
export function showBubble(text)
{
	//表示するテキストと、残り表示時間をセット
	bubbleText = text;
	bubbleTimer = BUBBLE_DURATION;

	//ふきだしの中身を書き換えて、見えるようにする
	bubbleElement.textContent = text;
	bubbleElement.style.display = 'block';
}
*/


//マウス移動
export function mousedown(e)
{
	// キャンバス上を左クリックしたら、その場所を目的地にして歩き出す
	if (input.mouseInfo.left && e.target === canvas)
	{
		// 画面上のクリック位置(clientX/Y)にカメラのズレ(camera.x/y)を足して、マップ上の座標に変換する
		const worldX = e.clientX + world.camera.x;
		const worldY = e.clientY + world.camera.y;

		setMoveTarget(worldX, worldY);
	}
}
