import { print, addLog } from '../shared/sub.js';

import * as socket from './ws_bin_client.js';
import * as windows from './windows.js';
import * as engine from './engine.js';
import * as player from './player.js';

// ==========================================================================
// チャット入力の処理
// ==========================================================================

// HTMLから「入力欄」と「ログを表示するエリア」の要素を取得しておく
const chatArea = document.getElementById("chatArea");
const chatInput = document.getElementById("chatInput");
const chatLog = document.getElementById("chatLog");


export function init()
{
	//this.onChat = this.onChat.bind(this);
	socket.callbacks.onchat = onChat;
}

//チャット受信
export function onChat(text)
{
	addLog("INFO", text);

	player.showBubble(text);
}

//チャットを送信
export function SendChat(e)
{
	if (e.key === 'Enter')
	{
		const text = chatInput.value.trim();

		//サーバー未接続
		if (!socket.connected)
		{
			addLog("ERROR", "サーバーに接続されていません")
		}
		//チャットウィンドウ非表示中
		if (!windows.chatWindow.isVisible())
		{
			windows.chatWindow.restore();
			chatInput.focus();
		}
		//チャットバーにフォーカスある
		else if (document.activeElement === chatInput)
		{
			//テキスト入力
			if (text === '')
				engine.canvas.focus();//3Dキャンバスに戻る
			else
			{
				socket.sendChat(text);//サーバーへチャット
				//this.showBubble(text);//バブル表示
				chatInput.value = '';// 入力欄をクリア
				engine.canvas.focus();//3Dキャンバスに戻る
			}
		}
		//チャットバーにフォーカス
		else
			chatInput.focus();

		return true;
	}
	else//Enter以外
	{
		//チャットバーにフォーカスがある状態でのキー入力
		return document.activeElement === chatInput;
	}
}

// 入力欄でキーが押されたときに呼ばれる処理を登録する
chatInput.addEventListener("keydown", (e) =>
{
	//SendChat(e);

	// 押されたキーが「Enter」以外なら何もしない
	/*if (event.key !== "Enter")
	{
		return;
	}

	// 入力された文字の前後の余分な空白を取り除く
	const message = chatInput.value.trim();

	// 何も入力されていない（空文字）場合は送信しない
	if (message === "")
	{
		return;
	}

	// ログに表示するための新しい要素（1行分）を作る
	const logLine = document.createElement("div");
	// 作った要素にメッセージの文字を入れる
	logLine.textContent = message;

	// 作った行をログエリアの一番下に追加する
	chatLog.appendChild(logLine);

	// 入力欄を空にして、次の入力に備える
	chatInput.value = "";

	// 新しい行が見えるように、ログエリアを一番下までスクロールする
	chatLog.scrollTop = chatLog.scrollHeight;
	*/
});

// ==========================================================================
// スクロールバーの処理
// ==========================================================================

// スクロールバーに関わる要素をHTMLから取得しておく
const chatScrollUp = document.getElementById("chatScrollUp");
const chatScrollDown = document.getElementById("chatScrollDown");
const chatScrollTrack = document.getElementById("chatScrollTrack");
const chatScrollBar = document.getElementById("chatScrollBar");

// 1回のクリックで何pxスクロールするかの量
const SCROLL_STEP = 14;

// 「つまみ」の大きさと位置を、今のログの状態に合わせて計算し直す処理
function updateScrollBar()
{
	// ログ全体の高さ（見えていない部分も含む）
	const contentHeight = chatLog.scrollHeight;
	// ログを表示している枠の高さ（見えている部分だけ）
	const visibleHeight = chatLog.clientHeight;
	// 現在どれだけ下にスクロールしているか
	const scrollTop = chatLog.scrollTop;

	// 全部の内容が枠内に収まっている（スクロールする必要がない）かどうかを判定する
	const needsScroll = contentHeight > visibleHeight;

	// スクロール不要なら、上下ボタンとつまみをまとめて隠して処理を終える
	if (!needsScroll)
	{
		chatScrollUp.style.display = "none";
		chatScrollDown.style.display = "none";
		chatScrollBar.style.display = "none";
		return;
	}

	// スクロールが必要な場合は、隠していたものを元に戻す
	chatScrollUp.style.display = "";
	chatScrollDown.style.display = "";
	chatScrollBar.style.display = "";

	// つまみが動ける範囲（トラックの高さ）を取得する
	const trackHeight = chatScrollTrack.clientHeight;

	// 「見えている割合」に応じてつまみの高さを決める
	// 最低の高さを大きめ（トラックの40%）にすることで、
	// 少しだけ隠れている場合でも「まだ動かせる余地がある」と分かりやすくする
	const thumbHeight = Math.max((visibleHeight / contentHeight) * trackHeight, trackHeight * 0.4);

	// スクロールできる範囲がどれくらい残っているか
	const maxScrollTop = contentHeight - visibleHeight;
	// つまみが動ける範囲（トラックの高さ - つまみ自身の高さ）
	const maxThumbTop = trackHeight - thumbHeight;

	// 現在のスクロール位置を、つまみの位置（割合）に変換する
	// maxScrollTopが0（スクロール不要）のときは0除算になるので、その場合はつまみを一番上にする
	const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

	// 計算した高さと位置をつまみのCSSに反映する
	chatScrollBar.style.height = thumbHeight + "px";
	chatScrollBar.style.top = thumbTop + "px";
}

// 上ボタンを押したら少し上にスクロールする
chatScrollUp.addEventListener("click", () =>
{
	chatLog.scrollTop -= SCROLL_STEP;
});

// 下ボタンを押したら少し下にスクロールする
chatScrollDown.addEventListener("click", () =>
{
	chatLog.scrollTop += SCROLL_STEP;
});

let isDraggingThumb = false;	// つまみをドラッグしている最中かどうかを覚えておく変数
let dragStartY = 0;				// ドラッグを開始した瞬間の、マウスのY座標を覚えておく変数
let dragStartScrollTop = 0;		// ドラッグを開始した瞬間の、ログのscrollTopを覚えておく変数

// つまみの上でマウスボタンを押したらドラッグ開始
chatScrollBar.addEventListener("mousedown", (event) =>
{
	isDraggingThumb = true;
	dragStartY = event.clientY;
	dragStartScrollTop = chatLog.scrollTop;

	// ドラッグ中に文字などが選択されてしまうのを防ぐ
	event.preventDefault();
});

// マウスが動いたときの処理（スクロールバードラッグ処理）
export function mousemove(e)
{
	// ドラッグ中でなければ何もしない
	if (!isDraggingThumb)
	{
		return;
	}

	// ドラッグ開始位置から、マウスがどれだけ動いたか
	const deltaY = e.clientY - dragStartY;

	// トラックの高さとつまみの高さから、動ける範囲を計算する
	const trackHeight = chatScrollTrack.clientHeight;
	const thumbHeight = chatScrollBar.clientHeight;
	const maxThumbTop = trackHeight - thumbHeight;

	// スクロールできる範囲の最大値
	const maxScrollTop = chatLog.scrollHeight - chatLog.clientHeight;

	// マウスの移動量（px）を、スクロール量（px）に変換する
	// 「つまみが動ける範囲」に対する「スクロールできる範囲」の比率をかけている
	const scrollDelta = maxThumbTop > 0 ? (deltaY / maxThumbTop) * maxScrollTop : 0;

	// ドラッグ開始時のスクロール位置に、移動量を足して反映する
	chatLog.scrollTop = dragStartScrollTop + scrollDelta;
}

// マウスボタンを離したらドラッグ終了
export function mouseup(e)
{
	isDraggingThumb = false;
}


// ログがスクロールされたら（マウスホイールなども含む）
chatLog.addEventListener("scroll", () =>
{
	//つまみの位置を更新する
	updateScrollBar();
});


// ログの中身が増えたり減ったりしたときにも、つまみの大きさを更新する
// MutationObserverは「監視対象の中身が変わったら知らせてくれる」仕組み
const chatLogObserver = new MutationObserver(updateScrollBar);
chatLogObserver.observe(chatLog, { childList: true });

// chatLogArea自体のサイズが変わったこと（ドラッグでのリサイズなど）を検知する仕組み
// ResizeObserverは「監視対象の大きさが変わったら知らせてくれる」機能で、
// windowのresizeイベントと違い、要素自体を直接リサイズした場合にも反応してくれる
const chatLogAreaResizeObserver = new ResizeObserver(() => { updateScrollBar(); });

// 監視対象として、ログエリア全体（枠）を登録する
chatLogAreaResizeObserver.observe(document.getElementById("chatLogArea"));


// ページが読み込まれた時点でも、一度つまみの状態を正しくしておく
updateScrollBar();