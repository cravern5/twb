import { print, addLog, elementsAddEventListener } from '../shared/sub.js';

// ==========================================================================
// スクロールバーの処理
// ==========================================================================
// ★変更点：getElementById(1個だけ取得)から getElementsByClassName(複数まとめて取得)に変えたので、
// 　これ以降は「配列のようにたくさんの要素が並んでいるもの」として扱う必要がある。
// 　「同じ並び順（＝何番目のチャットか）」の要素同士をセットとして扱うようにしている。

const logAreas = document.getElementsByClassName("logArea");			//チャット全体（枠）※複数
const logs = document.getElementsByClassName("log");					//チャット全体（中身）※複数
const scrollTracks = document.getElementsByClassName("scrollTrack");	//スクロールつまみ範囲　※複数
const scrollUps = document.getElementsByClassName("scrollUp");			//スクロールUPボタン　※複数
const scrollDowns = document.getElementsByClassName("scrollDown");		//スクロールDOWNボタン　※複数
const scrollBars = document.getElementsByClassName("scrollBar");		//スクロールバー　※複数

export const SCROLL_STEP = 14;// 1回のクリックで何pxスクロールするかの量
export const THUMB_HEIGHT = 19;// つまみの高さ（固定値。中身の量に関わらずこの高さのまま変えない）

export let isDraggingThumb = false;	// つまみをドラッグしている最中かどうかを覚えておく変数
export let dragStartY = 0;				// ドラッグを開始した瞬間の、マウスのY座標を覚えておく変数
export let dragStartScrollTop = 0;		// ドラッグを開始した瞬間の、ログのscrollTopを覚えておく変数
export let draggingIndex = -1;			// ★追加：今ドラッグしているのが「何番目のチャット」かを覚えておく変数
//   （マウスや指は同時に1つしか動かせないので、番号は1個覚えれば十分）


// 「つまみ」の大きさと位置を、今のログの状態に合わせて計算し直す処理
function updateScrollBar(index)
{
	// index番目のチャットの要素だけを取り出しておく
	const log = logs[index];
	const scrollUp = scrollUps[index];
	const scrollDown = scrollDowns[index];
	const scrollBar = scrollBars[index];
	const scrollTrack = scrollTracks[index];

	// ログ全体の高さ（見えていない部分も含む）
	const contentHeight = log.scrollHeight;
	// ログを表示している枠の高さ（見えている部分だけ）
	const visibleHeight = log.clientHeight;
	// 現在どれだけ下にスクロールしているか
	const scrollTop = log.scrollTop;

	// 全部の内容が枠内に収まっている（スクロールする必要がない）かどうかを判定する
	const needsScroll = contentHeight > visibleHeight;

	// スクロール不要なら、上下ボタンとつまみをまとめて隠して処理を終える
	if (!needsScroll)
	{
		scrollUp.style.display = "none";
		scrollDown.style.display = "none";
		scrollBar.style.display = "none";
		return;
	}

	// スクロールが必要な場合は、隠していたものを元に戻す
	scrollUp.style.display = "";
	scrollDown.style.display = "";
	scrollBar.style.display = "";

	// つまみが動ける範囲（トラックの高さ）を取得する
	const trackHeight = scrollTrack.clientHeight;

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
	scrollBar.style.height = thumbHeight + "px";
	scrollBar.style.top = thumbTop + "px";
}

// 上ボタンを押したら、対応する番号(index)のログを少し上にスクロールする
elementsAddEventListener(scrollUps, "click", (e, index) =>
{
	logs[index].scrollTop -= SCROLL_STEP;
});

// 下ボタンを押したら、対応する番号のログを少し下にスクロールする
elementsAddEventListener(scrollDowns, "click", (e, index) =>
{
	logs[index].scrollTop += SCROLL_STEP;
});

// ログがスクロールされたら（マウスホイールなども含む）、対応する番号のつまみを更新する
elementsAddEventListener(logs, "scroll", (e, index) =>
{
	updateScrollBar(index);
});

// つまみの上でマウスボタンを押したらドラッグ開始（自分が何番目かも一緒に伝わってくる）
elementsAddEventListener(scrollBars, "mousedown", (e, index) =>
{
	dragStart(e, e.clientY, index);
});

// つまみの上で指を触れたらドラッグ開始（スマホ用）
elementsAddEventListener(scrollBars, "touchstart", (e, index) =>
{
	// ドラッグ中に文字などが選択されてしまうのを防ぐ
	e.preventDefault();

	dragStart(e, e.touches[0].clientY, index);
});

// 指を動かしている間の処理（スマホ用）
elementsAddEventListener(scrollBars, "touchmove", (e, index) =>
{
	// ブラウザ標準のスクロール動作を止める ※これがないと「dragMoveで計算した位置」と「スマホ標準のスクロール」が同時に働く
	e.preventDefault();

	dragMove(e.changedTouches[0].clientY);
});

// 指を離したらドラッグ終了（スマホ用）
elementsAddEventListener(scrollBars, "touchend", (e, index) =>
{
	dragEnd();
});

// マウスを動かしているとき
// ※これは画面全体で1つだけ監視すればよいので、ループにする必要はない（今まで通り）
document.addEventListener("mousemove", (e) =>
{
	dragMove(e.clientY);
});

// マウスのボタンを離したとき
document.addEventListener("mouseup", (e) =>
{
	dragEnd();
});

export function dragStart(e, y, index)
{
	isDraggingThumb = true;
	dragStartY = y;
	draggingIndex = index;					// ★追加：今どの番号のチャットをドラッグしているかを覚えておく
	dragStartScrollTop = logs[index].scrollTop;
}

// マウス（や指）が動いたときの処理（スクロールバードラッグ処理）
export function dragMove(y)
{
	// ドラッグ中でなければ何もしない
	if (!isDraggingThumb)
		return;

	// 覚えておいた番号を使って、ドラッグ対象のチャットの要素を取り出す
	const index = draggingIndex;
	const log = logs[index];
	const scrollTrack = scrollTracks[index];
	const scrollBar = scrollBars[index];

	// ドラッグ開始位置から、マウスがどれだけ動いたか
	const deltaY = y - dragStartY;

	// トラックの高さとつまみの高さから、動ける範囲を計算する
	const trackHeight = scrollTrack.clientHeight;
	const thumbHeight = scrollBar.clientHeight;
	const maxThumbTop = trackHeight - thumbHeight;

	// スクロールできる範囲の最大値
	const maxScrollTop = log.scrollHeight - log.clientHeight;

	// マウスの移動量（px）を、スクロール量（px）に変換する
	// 「つまみが動ける範囲」に対する「スクロールできる範囲」の比率をかけている
	const scrollDelta = maxThumbTop > 0 ? (deltaY / maxThumbTop) * maxScrollTop : 0;

	// ドラッグ開始時のスクロール位置に、移動量を足して反映する
	log.scrollTop = dragStartScrollTop + scrollDelta;
}

// マウスボタンを離したらドラッグ終了
export function dragEnd()
{
	isDraggingThumb = false;
	draggingIndex = -1;		// ★追加：ドラッグが終わったので番号もリセットしておく
}


// ログの中身が増えたり減ったりしたときにも、つまみの大きさを更新する
// ★変更点：ログが複数あるので、1つずつ「自分は何番目か」を対応させて監視する
for (let i = 0; i < logs.length; i++)
{
	const index = i;

	// MutationObserverは「監視対象の中身が変わったら知らせてくれる」仕組み
	const logObserver = new MutationObserver(() =>
	{
		updateScrollBar(index);
	});
	logObserver.observe(logs[index], { childList: true });
}

// chatLogArea自体のサイズが変わったこと（ドラッグでのリサイズなど）を検知する仕組み
// ★変更点：エリアが複数あるので、1つずつ「自分は何番目か」を対応させて監視する
for (let i = 0; i < logAreas.length; i++)
{
	const index = i;

	// ResizeObserverは「監視対象の大きさが変わったら知らせてくれる」機能で、
	// windowのresizeイベントと違い、要素自体を直接リサイズした場合にも反応してくれる
	const logAreaResizeObserver = new ResizeObserver(() =>
	{
		updateScrollBar(index);
	});
	logAreaResizeObserver.observe(logAreas[index]);
}


// ページが読み込まれた時点でも、すべてのチャットで一度つまみの状態を正しくしておく
for (let i = 0; i < logs.length; i++)
{
	updateScrollBar(i);
}