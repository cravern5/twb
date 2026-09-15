import { print, addLog } from '../shared/sub.js';
import * as sub from '../shared/sub.js';

import * as utils2 from './utils2.js';
import * as windows from './windows.js';
import { ctx, canvas } from './engine.js';
import * as engine from './engine.js';
import * as socket from './ws_bin_client.js';
//import { player } from './ws_bin_client.js';
import * as input from './input.js';
import { keys, keysPress, mouseInfo } from './input.js';
import * as world from './world.js';
import * as Player from './player.js';
//import { player } from './player.js';
import * as scroll from './scroll.js';
import * as sound from './sound.js';

let player = null;

export let firstUpdate = false;
export let lastTime = null;
export let fps = 0;			// 直近1秒間に実際に描画できたフレーム数
export let frameCount = 0;		// 1秒間のフレームカウンター
export let fpsTimer = 0;		// 1秒経過したかを計るための経過時間

//初期化
async function init()
{
	//debugInfo.style.display = 'block';
	//chatArea.style.display = 'none';
	//rightMenuButtons.classList.toggle("closed");

	engine.updateProgress("<エンジン初期化>");
	engine.init();
	engine.updateProgress("<ウィンドウコントローラー初期化>");
	windows.init();
	engine.updateProgress("<通信初期化>");
	socket.init();
	engine.updateProgress("<ワールド初期化>");
	await world.init();

	engine.updateProgress("<プレイヤー初期化>");
	player = await sub.wait({ obj: Player, propName: "player" });
	print("info", player.myPlayerId);

	engine.endProgress();
}


///////ボタンイベント//////////

//run/walk
leftFootBtn.addEventListener('click', (e) =>
{
	if (player) player.isRunning = !player.isRunning;
});

//afkはみ出し抑制
leftEnvironmentTab.addEventListener('click', (e) =>
{
	//はみ出し抑制
	//for (const win of windows.windows) { win.insideScreen(); }
	windows.windows.forEach(win => { win.insideScreen(); });
});


//チャット範囲選択
chatOpen.addEventListener('click', (e) =>
{
	e.stopPropagation(); // ドキュメント側へのクリックイベント伝播を防止

	const rect = chatOpen.getBoundingClientRect();
	const x = rect.left;
	const y = rect.top - (19 * 3);

	chatRange.style.display = 'flex';
	/*	chatRange.style.left = `${x}px`;
		chatRange.style.top = `${y}px`;*/
});

//デバッグ表示
chatMail.addEventListener('click', (e) =>
{
	windows.debugWindow.show(-1);
});

//BGM再生
chatEmote.addEventListener('click', (e) =>
{
	let fileBGM = sub.getFileName(world.path);
	fileBGM = sub.changeExt(fileBGM, "mp3");
	fileBGM = sound.pathBGM + "/" + fileBGM;
	sound.setBGM(fileBGM).play();

});

//画面フルスクリーン
chatFixedText.addEventListener('click', (e) =>
{
	windows.chatWindow.restoreFullScreen();
});

///////入力イベント//////////

//キーが押されたとき
export function keydown(e)
{
	if (!player)
		return;

	const key = e.key.toLowerCase();
	if (player.SendChat(e))//送信したらtrue
	{
	}
	else if (key === "insert")//座り
	{
		player.isSitting = !player.isSitting;
	}
	else if (key === "c")//チャット表示切替
	{
		windows.chatWindow.show(-1);
	}
	else if (key === "f12")
	{
		windows.leftStatusWindow.show(-1);
		e.stopPropagation();
		e.preventDefault();//デベロップツールが出る
	}
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
	if (chatRange.style.display === 'flex')
	{
		if (e.target.classList.contains('chatRangeBtn') || !chatRange.contains(e.target))
			chatRange.style.display = 'none';
	}
}

//マウスを押したとき
export function mousedown(e)
{

	/*if (!engine.useTouch)
	{
		if (player)
			player.mousedown(e);
	}*/
}

// マウスを動かしているとき
export function mousemove(e)
{
	//チャットスクロールバー
	scroll.mousemove(e);

	//if (mouseInfo.right)
	//{
	//カメラ
	//	engine.camera_MouseMove(e);

	//}

	//addLog("INFO", "window.mousemove" + mouseInfo.right);
	//windows.mousemove(e);
}

// マウスを離したとき
export function mouseup(e)
{
	//チャットスクロールバー
	scroll.mouseup(e);
}

//マウスホイール
export function mousewheel(e)
{
}


///////ゲーム//////////

//画面更新
function update(delta)
{
	if (!player)
		return;


	// 1. フレームの最初にキャンバス全体をクリア
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// カメラ計算のため、プレイヤーの中心座標を渡す
	const center = player.getCenterPosition();

	// プレイヤー位置に合わせてカメラを更新
	world.updateCamera(center.x, center.y);

	//マップ描画
	world.update(delta);

	//プレイヤー全更新
	Player.updateAll(delta);

	firstUpdate = true;
}

function animate(currentTime)
{
	try
	{
		if (!lastTime)
			lastTime = currentTime;
		const deltaTime = (currentTime - lastTime) / 1000;

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
		print("error", "error:animate " + e.message);
	}

	lastTime = currentTime;
}

//初期化
await init();

//ゲーム開始
requestAnimationFrame(animate);


//デバッグ表示
function showModelDebugInfo()
{
	if (!player)//|| !player.object3D)
		return;

	debugInfo.textContent =
		"[Debug Info]"
		+ "\n width:" + canvas.width + " height:" + canvas.height
		+ "\n FPS:" + fps
		+ "\n Log:" + chatLog.children.length
		+ "\n useTouch:" + engine.useTouch
		+ "\n[World]"
		+ "\n camera.x:" + world.camera.x.toFixed(1) + " camera.y:" + world.camera.y.toFixed(1)
		+ "\n camera.zoom:" + world.camera.zoom.toFixed(3)
		+ "\n[Player]"
		+ "\n ID:" + socket.myPlayerId
		+ "\n position.x:" + player.position.x.toFixed(1) + " position.y:" + player.position.y.toFixed(1)
		+ "\n state:" + player.state + " direction:" + player.direction + " flip:" + player.flip
		+ "\n[Network]"
		+ Player.players
			.filter((p) => p.id !== socket.myPlayerId)		// 自分以外の全プレイヤーが対象
			.map((p) =>
				"\n ID:" + p.id
				+ "  受信:" + p.receivePerSecond + "回/秒"
				+ "  前回間隔:" + p.lastReceiveInterval.toFixed(0) + "ms"
			)
			.join("");
}
showModelDebugInfo();
setInterval(showModelDebugInfo, 500);

//レンダラーにフォーカス
engine.canvas.focus();