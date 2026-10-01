
//※ここの順序は特に気にしたほうが良い
import { print, addLog, isDev } from '../shared/sub.js';
import * as sub from '../shared/sub.js';

import { ctx, canvas } from './DOM.js';
import * as engine from './engine.js';
import * as utils2 from './utils2.js';
import * as windows from './windows.js';
import * as socket from './ws_bin_client.js';
//import { player } from './ws_bin_client.js';
import { keys, keysPress, mouseInfo, nKey, nKeyPress } from './input.js';
import * as input from './input.js';

import * as world from './world.js';
import * as Player from './player.js';
import { player, players } from './player.js';
import * as scroll from './scroll.js';
import * as sound from './sound.js';

export let firstUpdate = false;
export let lastTime = null;
export let fps = 0;				// 直近1秒間に実際に描画できたフレーム数
export let frameCount = 0;		// 1秒間のフレームカウンター
export let fpsTimer = 0;		// 1秒経過したかを計るための経過時間
export let lastSelectID = "";	//最後に触ったDOM
export const MAX_DELTA = 0.1;	// 別タブに移動していた間はrequestAnimationFrameが呼ばれないため、戻ってきた瞬間はcurrentTime - lastTimeが数秒分の差になってしまうことがある。差をそのまま使うと、移動やアニメーションが一気に進んで「早送り」のように見えてしまう。そこで1フレームあたりの経過時間に上限（例：0.1秒＝10FPS相当）を設け、それ以上は切り捨てる。

//初期化
async function init()
{
	//debugContainer.style.display = 'block';
	//chatContainer.style.display = 'none';
	//rightMenuButtons.classList.toggle("closed");

	engine.setProgressCount(5);

	engine.updateProgress("<エンジン初期化>");
	engine.init();
	engine.updateProgress("<ウィンドウコントローラー初期化>");
	windows.init();
	engine.updateProgress("<通信初期化>");
	socket.init();
	engine.updateProgress("<ワールド初期化>");
	await world.init();

	engine.updateProgress("<プレイヤー初期化>");
	await sub.wait({ obj: Player, propName: "player" });
	//print("info", player.myPlayerId);

	engine.endProgress();
}

//ゲーム開始
function start()
{
	//フレームスタート
	requestAnimationFrame(animate);

	//デバッグウィンドウ
	showModelDebugInfo();
	setInterval(showModelDebugInfo, 500);

	//レンダラーにフォーカス
	canvas.focus();
}

///////入力イベント//////////

//タップ
export function oneTap(touch)
{
	if (player)
		player.setMoveTargetFromScreen(touch.startX, touch.startY);

	lastSelectID = touch.targetID;
}
//ダブルタップ
export function dblTap(touch)
{
	if (player)
		player.setMoveTargetFromScreen(touch.startX, touch.startY);

	lastSelectID = touch.targetID;
}
//長押しタッチ
export function holdTouch(touch)
{
	//ホールド=shiftキーを押したことにする
	input.keysPress.shift = true;
	if (player)
		player.moveTarget = null;

	lastSelectID = touch.targetID;
}
//長押しタッチ
export function HoldEnd(touch)
{
	input.keysPress.shift = false;
	//if (player)
	//	player.holdTouch(touch.startX, touch.startY);


	//addLog("info", "holdEnd");
}
//十字キー
export function crossTouch(touch)
{
	if (player)
		player.moveTarget = null;
}
//2本指ピンチ
export function pinchTouch(dist)
{
	engine.camera.zoom *= dist;
	engine.camera.zoom = Math.min(Math.max(engine.camera.zoom, 0.5), 3); // 拡大率の上限・下限を制限（お好みで調整）
}

//キーが押されたとき
export function keydown(e)
{
	if (!player?.initialized)
		return;

	if (nKey('enter'))
		return player.SendChat(e);
	//チャットバーにフォーカスがある状態
	else if (document.activeElement === chatInput)
	{
		input.clearKeys();
		e.stopPropagation();//イベントの伝搬を防ぐ
		//e.preventDefault();//イベントの本来の動作を止める、キー入力はされる必要がある
		return true;
	}
	//走り
	else if (nKey("r"))
	{
		leftFootBtn.click();
		return true;
	}
	//座り
	else if (nKey("insert"))
	{
		leftAfkBtn.click();
		return true;
	}
	//移動キー
	else if (nKey("w") || nKey("a") || nKey("s") || nKey("d"))
	{
		// キー操作を優先する（マウスクリックでの目的地移動は中断する）
		player.moveTarget = null;
		return true;
	}
	//チャット表示切替
	else if (nKey("c"))
	{
		windows.chatWindow.show(-1);
	}
	/*else if (nKey("f12"))
	{
		windows.leftStatusWindow.show(-1);
		e.stopPropagation();
		e.preventDefault();//デベロップツールが出る
	}*/
	else
	{

	}
}

//キーが離されたとき
export function keyup(e)
{

}

//マウスクリック
export function click(e)
{
	// クリックされた要素が chatRange 内のボタン、または chatRange の外側であれば非表示
	if (chatRangeContainer.style.display === 'flex')
	{
		if (e.target.classList.contains('chatRangeBtn') || !chatRangeContainer.contains(e.target))
			chatRangeContainer.style.display = 'none';
	}
}

//マウスを押したとき
export function mousedown(e)
{
	//押された場所を記憶
	lastSelectID = e.target.id;

	if (scroll.isDraggingThumb || !player?.initialized)
		return;

	// キャンバス上を左クリックしたら、その場所を目的地にして歩き出す
	if (input.mouseInfo.left && e.target === canvas)
	{
		//シフトキーのキャラ向き更新
		if (e.shiftKey)
			player.setDirectionTargetFromScreen(e.clientX, e.clientY);
		else
			player.setMoveTargetFromScreen(e.clientX, e.clientY);
	}
}

// マウスを動かしているとき
export function mousemove(e)
{
	lastSelectID = e.target.id;

	if (scroll.isDraggingThumb || !player?.initialized)
		return;

	//mousedownが有効になったときだけ動かさないと色々挙動問題起きます
	// キャンバス上を左クリックしたら、その場所を目的地にして歩き出す
	if (input.mouseInfo.left && input.mouseInfo.downTarget === engine.canvas)
	{
		//シフトキーのキャラ向き更新
		if (e.shiftKey)
			player.setDirectionTargetFromScreen(e.clientX, e.clientY);
		else
			player.setMoveTargetFromScreen(e.clientX, e.clientY);
	}
}

// マウスを離したとき
export function mouseup(e)
{
	if (scroll.isDraggingThumb)
		return;

}

//マウスホイール
export function mousewheel(e)
{
}


///////ゲーム//////////

//アニメーション
function animate(currentTime)
{
	try
	{
		if (!lastTime)
			lastTime = currentTime;

		let deltaTime = (currentTime - lastTime) / 1000;
		if (deltaTime > MAX_DELTA)
			deltaTime = MAX_DELTA;

		//フレームレート　1秒ごとに「何回animateが呼ばれたか」を数える
		frameCount++;
		fpsTimer += deltaTime;
		if (fpsTimer >= 1)
		{
			fps = frameCount;		// 直近1秒間のフレーム数を確定
			frameCount = 0;
			fpsTimer %= 1;
		}

		update(deltaTime);
		requestAnimationFrame(animate);
	}
	catch (e)
	{
		//print("error", "animateでエラーが発生しました", [1, 2, 3], { a: "a", b: "b" }, e);
		console.error("animateでエラーが発生しました", e);
		if (isDev)
			debugger;
	}

	lastTime = currentTime;
}

//画面更新
function update(delta)
{
	if (!player?.initialized || !world?.initialized)
		return;

	// フレームの最初にキャンバス全体をクリア
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// プレイヤーの位置・状態を「先に」動かして確定させる　この後でカメラを合わせないと、カメラだけ1フレーム前の位置を追いかけることになり、丸め処理と合わさって震えて見える）
	Player.updateAll(delta);

	//マップ更新
	world.update(delta);

	// カメラ計算のため、プレイヤーの中心座標を渡す（更新済みの最新位置を使う）
	const center = player.getPosition({ render: true, center: true });

	// カメラ変形（ズーム・平行移動）を開始する、これ以降、マップやプレイヤーの描画はズームを意識せずワールド座標のまま書ける
	engine.beginCameraTransform(center.x, center.y);

	//マップ描画(後ろ)
	world.draw(true);

	//プレイヤー描画（カメラ変形が有効なうちに描画する）
	Player.drawAll();

	//マップ描画(手前)
	world.draw(false);

	// カメラ変形を元に戻す（beginCameraTransformと必ずセットで呼ぶ）
	engine.endCameraTransform();

	firstUpdate = true;
}

//デバッグ画面
export function showModelDebugInfo()
{
	if (!player?.initialized || !world?.initialized)
		return;

	debugContainer.textContent =
		"[Debug Info]"
		+ "\n canvas.width:" + canvas.width + " canvas.height:" + canvas.height
		+ "\n camera.x:" + engine.camera.x.toFixed(1) + " camera.y:" + engine.camera.y.toFixed(1)
		+ "\n camera.zoom:" + engine.camera.zoom.toFixed(3)
		+ "\n FPS:" + fps
		+ "\n Log:" + chatLog.children.length
		+ "\n useTouch:" + engine.useTouch
		+ "\n lastSelect:" + lastSelectID
		+ "\n[Player]"
		+ "\n ID:" + socket.myPlayerId
		+ "\n position.x:" + player.position.x.toFixed(1) + " position.y:" + player.position.y.toFixed(1)
		+ "\n state:" + player.state + " direction:" + player.direction + " flip:" + player.flip
		+ "\n[Network]"
		+ players
			.filter((p) => p.id !== socket.myPlayerId)		// 自分以外の全プレイヤーが対象
			.map((p) =>
				"\n ID:" + p.id
				+ "  受信:" + p.receivePerSecond + "回/秒"
				+ "  前回間隔:" + p.lastReceiveInterval.toFixed(0) + "ms"
			)
			.join("");
}


//初期化
await init();

//ゲーム開始
start();