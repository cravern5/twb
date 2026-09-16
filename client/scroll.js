import { print, addLog } from '../shared/sub.js';

// ==========================================================================
// スクロールバーの処理
// ==========================================================================

const chatScrollUp = document.getElementById("chatScrollUp");		//スクロールUPボタン
const chatScrollDown = document.getElementById("chatScrollDown");	//スクロールDOWNボタン
const chatScrollTrack = document.getElementById("chatScrollTrack");	//スクロールつまみ範囲
const chatScrollBar = document.getElementById("chatScrollBar");		//スクロールバー
const chatLogArea = document.getElementById("chatLogArea");//チャット全体
const chatLog = document.getElementById("chatLog");//チャット全体


export const SCROLL_STEP = 14;// 1回のクリックで何pxスクロールするかの量
export const THUMB_HEIGHT = 19;// つまみの高さ（固定値。中身の量に関わらずこの高さのまま変えない）

export let isDraggingThumb = false;	// つまみをドラッグしている最中かどうかを覚えておく変数
export let dragStartY = 0;				// ドラッグを開始した瞬間の、マウスのY座標を覚えておく変数
export let dragStartScrollTop = 0;		// ドラッグを開始した瞬間の、ログのscrollTopを覚えておく変数


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

	/*//つまみの高さを変えるパターン
	// 「見えている割合」に応じてつまみの高さを決める
	// 最低の高さを大きめ（トラックの40%）にすることで、
	// 少しだけ隠れている場合でも「まだ動かせる余地がある」と分かりやすくする
	const thumbHeight = Math.max((visibleHeight / contentHeight) * trackHeight, trackHeight * 0.4);
	// スクロールできる範囲がどれくらい残っているか
	const maxScrollTop = contentHeight - visibleHeight;
	// つまみが動ける範囲（トラックの高さ - つまみ自身の高さ）
	const maxThumbTop = trackHeight - thumbHeight;
	*/

	// つまみの高さは常に固定値を使う（見えている割合による変化はさせない）
	const thumbHeight = THUMB_HEIGHT;
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

// ログがスクロールされたら（マウスホイールなども含む）
chatLog.addEventListener("scroll", () =>
{
	//つまみの位置を更新する
	updateScrollBar();
});

// つまみの上でマウスボタンを押したらドラッグ開始
chatScrollBar.addEventListener("mousedown", (e) =>
{
	dragStart(e, e.clientY);
});

// マウスを動かしているとき
document.addEventListener("mousemove", (e) =>
{
	//チャットスクロールバー
	dragMove(e.clientY);
});

// マウスを動かしているとき
document.addEventListener("mouseup", (e) =>
{
	//チャットスクロールバー
	dragEnd();
});

// つまみの上でマウスボタンを押したらドラッグ開始
chatScrollBar.addEventListener("touchstart", (e) =>
{
	dragStart(e, e.touches[0].clientY);
});

// (documentでなくてもOK)つまみの上でマウスボタンを押したらドラッグ開始
chatScrollBar.addEventListener("touchmove", (e) =>
{
	// ブラウザ標準のスクロール動作を止める ※これがないと「dragMoveで計算した位置」と「スマホ標準のスクロール」が同時に働く
	e.preventDefault();

	dragMove(e.changedTouches[0].clientY);

	//addLog("info", e.changedTouches[0].clientY);
});

// (documentでなくてもOK)つまみの上でマウスボタンを押したらドラッグ開始
chatScrollBar.addEventListener("touchend", (e) =>
{
	dragEnd();
});

export function dragStart(e, y)
{
	isDraggingThumb = true;
	dragStartY = y;
	dragStartScrollTop = chatLog.scrollTop;

	// ドラッグ中に文字などが選択されてしまうのを防ぐ
	e.preventDefault();
}

// マウスが動いたときの処理（スクロールバードラッグ処理）
export function dragMove(y)
{
	// ドラッグ中でなければ何もしない
	if (!isDraggingThumb)
		return;

	// ドラッグ開始位置から、マウスがどれだけ動いたか
	const deltaY = y - dragStartY;

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
export function dragEnd()
{
	isDraggingThumb = false;
}


// ログの中身が増えたり減ったりしたときにも、つまみの大きさを更新する
// MutationObserverは「監視対象の中身が変わったら知らせてくれる」仕組み
const chatLogObserver = new MutationObserver(updateScrollBar);
chatLogObserver.observe(chatLog, { childList: true });

// chatLogArea自体のサイズが変わったこと（ドラッグでのリサイズなど）を検知する仕組み
// ResizeObserverは「監視対象の大きさが変わったら知らせてくれる」機能で、
// windowのresizeイベントと違い、要素自体を直接リサイズした場合にも反応してくれる
const chatLogAreaResizeObserver = new ResizeObserver(() => { updateScrollBar(); });

// 監視対象として、ログエリア全体（枠）を登録する
chatLogAreaResizeObserver.observe(chatLogArea);


// ページが読み込まれた時点でも、一度つまみの状態を正しくしておく
updateScrollBar();