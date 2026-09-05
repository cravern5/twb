import { print, addLog } from '../shared/sub.js';
import * as sub from '../shared/sub.js';

import * as utils2 from './utils2.js';
import * as windows from './windows.js';
import { canvas, ctx } from './engine.js';
import * as engine from './engine.js';
import * as socket from './ws_bin_client.js';
import * as input from './input.js';
import { keys, keysPress, mouseInfo } from './input.js';
import * as world from './world.js';
import * as player from './player.js';
import * as scroll from './scroll.js';
import * as sound from './sound.js';

// プログレスバーとテキストの更新
let loadedCount = 0;
let loadTotal = 6;
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const progressBar = document.getElementById('progress-bar');
function updateProgress()
{
	loadedCount++;
	const percentage = Math.floor((loadedCount / loadTotal) * 100);
	loadingText.textContent = `Loading... ${percentage}%`;
	progressBar.style.width = `${percentage}%`;
}

//初期化
async function init()
{
	engine.init(); updateProgress();
	windows.init(); updateProgress();
	socket.init(); updateProgress();
	//scroll.init(); updateProgress();

	await player.init(); updateProgress();
	await world.init(); updateProgress();

	// 画面をフェードアウトして非表示にする
	loadingScreen.style.opacity = '0';
	//loadingScreen.style.display = 'none';
	setTimeout(() => { loadingScreen.style.display = 'none'; });


	const charName = localStorage.getItem('charName');
	const charType = localStorage.getItem('charType');
}

///////イベント//////////

const chatOpen = document.getElementById("chatOpen");
const chatMail = document.getElementById("chatMail");
const chatMemo = document.getElementById("chatMemo");
const chatMessanger = document.getElementById("chatMessanger");
const chatDM = document.getElementById("chatDM");
const chatFixedText = document.getElementById("chatFixedText");
const chatEmote = document.getElementById("chatEmote");
const chatRange = document.getElementById("chatRange");

const debugInfo = document.getElementById("debugInfo");


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
	windows.debugInfo.show(-1);
});



//BGM再生
chatEmote.addEventListener('click', (e) =>
{
	let fileBGM = sub.getFileName(world.path);
	fileBGM = sub.changeExt(fileBGM, "mp3");
	fileBGM = sound.pathBGM + "/" + fileBGM;
	sound.setBGM(fileBGM).play();

});


// chatRange非表示
document.addEventListener('click', (e) =>
{
	// クリックされた要素が chatRange 内のボタン、または chatRange の外側であれば非表示
	if (chatRange.style.display === 'flex')
	{
		if (e.target.classList.contains('chatRangeBtn') || !chatRange.contains(e.target))
		{
			chatRange.style.display = 'none';
		}
	}
});

//画面フルスクリーン
chatFixedText.addEventListener('click', (e) =>
{
	windows.chatWindow.restoreFullScreen();
});


// バーチャル十字キー（スマホの画面左半分でのタッチ操作）
// passive: true だと preventDefault が無視されます
canvas.addEventListener('touchstart', (e) => input.getVirtualMove_touchstart(e), { passive: false });
canvas.addEventListener('touchmove', (e) => input.getVirtualMove_touchmove(e), { passive: false });
canvas.addEventListener('touchend', (e) => input.getVirtualMove_touchend(e), { passive: false });
canvas.addEventListener('touchcancel', (e) => input.getVirtualMove_touchend(e), { passive: false });

document.addEventListener('keydown', (e) =>
{
	if (player.SendChat(e))//送信したらtrue
	{
	}
	else if (e.key.toLowerCase() === "c")
	{
		windows.chatWindow.show(-1);
	}
	else
	{
		//キー状態更新
		input.getKeyState_keydown(e);
	}
});


document.addEventListener('keyup', (e) =>
{
	//キー状態更新
	input.getKeyState_keyup(e);
});

document.addEventListener('mousedown', (e) =>
{
	//マウス状態更新
	input.getMouseState_mousedown(e);

	player.mousedown(e);
});
// マウスを動かしているとき
document.addEventListener('mousemove', (e) =>
{
	//状態取得
	input.getMouseState_mousemove(e);

	//チャットスクロールバー
	scroll.mousemove(e);

	//if (mouseInfo.right)
	//{
	//カメラ
	//	engine.camera_MouseMove(e);

	//}

	//addLog("INFO", "window.mousemove" + mouseInfo.right);
	//windows.mousemove(e);
});
// マウスを離したとき
document.addEventListener('mouseup', (e) =>
{
	//状態取得
	input.getMouseState_mouseup(e);

	//チャットスクロールバー
	scroll.mouseup(e);

});
// マウスホイールのイベント
window.addEventListener('wheel', (e) =>
{
	input.getMouseState_mousewheel(e);
});

// 画面外に出た
window.addEventListener('mouseleave', () =>
{
});

// タブが切り替わったり別ウィンドウに移った
window.addEventListener('blur', () =>
{
});

//メニューが表示されたとき
document.addEventListener('contextmenu', (e) =>
{
	//ブラウザの標準右クリックメニューが出ないようにする
	e.preventDefault();
});

// 画面リサイズへの対応
window.addEventListener('resize', () =>
{
	//キャンバスリフレッシュ
	engine.repaint();

	//はみ出し抑制
	windows.windows.forEach(win => 
	{
		win.insideScreen();
	});
});

// ページ読み込み時
window.addEventListener('load', () =>
{
	// ページの準備が完全に整ってからフォーカスを当てる
	//engine.canvas.focus();
});





//画面更新
let firstUpdate = false;
function update(delta)
{
	// カメラ計算のため、プレイヤーの中心座標を渡す
	const centerX = player.position.x + player.SPRITE_WIDTH / 2;
	const centerY = player.position.y + player.SPRITE_HEIGHT / 2;

	//マップ描画
	world.update(delta, centerX, centerY);

	//プレイヤー画面更新
	player.update(delta);


	firstUpdate = true;
}

//アニメーション
let lastTime = null;
function animate(currentTime)
{
	if (!lastTime)
		lastTime = currentTime;

	// ゲーム状態の更新（移動速度などに deltaTime を掛ける）
	try
	{
		// 前のフレームからの経過時間（秒単位）
		const deltaTime = (currentTime - lastTime) / 1000;

		update(deltaTime);
		requestAnimationFrame(animate);
	}
	catch (e)
	{
		print("red", "animation: " + e.message);
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

	const div = document.getElementById('debugInfo');

	div.textContent =
		"[Debug Info]"
		+ "\n width:" + canvas.width + " height:" + canvas.height
		+ "\n[World]"
		+ "\n camera.x:" + world.camera.x.toFixed(3) + " camera.y:" + world.camera.y.toFixed(3)
		+ "\n[Player]"
		+ "\n position.x:" + player.position.x.toFixed(3) + " position.y:" + player.position.y.toFixed(3)
		+ "\n state:" + player.state + " direction:" + player.direction + " flip:" + player.flip
}
showModelDebugInfo();
setInterval(showModelDebugInfo, 500);

//レンダラーにフォーカス
engine.canvas.focus();