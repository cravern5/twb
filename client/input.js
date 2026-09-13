import { print, addLog } from '../shared/sub.js';
import { canvas } from './engine.js';
import * as world from './world.js';
import { player } from './player.js';
import * as engine from './engine.js';
import * as game from './game.js';

//キーボード==============================================================
export const keys = {};
export const keysPress = {};
//export const keys = new Proxy({}, {	get: (target, key) => key in target ? target[key] : false});

// フレーム末にエッジフラグをリセット（anime()の末尾などで呼ぶ）
export function clearKeys()
{
	for (const key in keys)
		delete keys[key];
}

//キーが押されたとき
document.addEventListener('keydown', (e) =>
{
	//キー状態更新
	const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
	// keysDownは最初の押下のみ（リピートを除外）
	if (!e.repeat)
		keys[key] = true;// keysは最初の押下のみtrueになる（リピートは除外）
	keysPress[key] = true; // keysPressはリピート含めて押している間ずっとtrue

	game.keydown(e);

});

//キーが離されたとき
document.addEventListener('keyup', (e) =>
{
	//キー状態更新
	const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
	keys[key] = false;
	keysPress[key] = false;

	game.keyup(e);
});


//マウス==============================================================


export const mouseInfo =
{
	left: false,    //0: 主ボタン。通常は左ボタンか初期化されていない状態。
	middle: false,  //1: 補助ボタン。通常はホイールボタンまたは中央のボタンが押された場合。
	right: false,   //2: 副ボタン。通常は右ボタン。
	back: false,    //3: 第四ボタン。一般的にブラウザーの戻るボタン。
	forward: false, //4: 第五ボタン。一般的にブラウザーの進むボタン。
	wheel_deltaY: 0,//ホイール移動
	clientX: null,
	clientY: null,
};

// chatRange非表示
document.addEventListener('click', (e) =>
{
	//addLog("info", "click");

	game.click(e);
});

//マウスを押したとき
document.addEventListener('mousedown', (e) =>
{
	//addLog("info", "mousedown");

	//マウス状態更新
	if (e.button === 0) mouseInfo.left = true;
	if (e.button === 1) mouseInfo.middle = true;
	if (e.button === 2) mouseInfo.right = true;
	if (e.button === 3) mouseInfo.back = true;
	if (e.button === 4) mouseInfo.forward = true;

	mouseInfo.clientX = e.clientX;
	mouseInfo.clientY = e.clientY;

	if (!engine.useTouch)
	{
		if (player)
			player.mousedown(e);
	}

	game.mousedown(e);
});

// マウスを動かしているとき
document.addEventListener('mousemove', (e) =>
{
	//状態取得
	mouseInfo.movementX = e.movementX;
	mouseInfo.movementY = e.movementY;

	/*if (!engine.useTouch)
	{
		if (player)
			player.mousedown(e);
	}*/

	game.mousemove(e);
});
// マウスを離したとき
document.addEventListener('mouseup', (e) =>
{
	//状態取得
	if (e.button === 0) mouseInfo.left = false;
	if (e.button === 1) mouseInfo.middle = false;
	if (e.button === 2) mouseInfo.right = false;
	if (e.button === 3) mouseInfo.back = false;
	if (e.button === 4) mouseInfo.forward = false;

	game.mouseup(e);

});
// マウスホイールのイベント
window.addEventListener('wheel', (e) =>
{
	//状態取得
	mouseInfo.wheel_deltaY = e.deltaY;
});

// 画面外に出た
window.addEventListener('mouseleave', () =>
{
});



//バーチャル十字キー（スマホ用）==============================================================

//タッチ保持クラス
class myTouch
{
	constructor(touch)
	{
		this.clear();
		if (touch)
			this.init(touch);
	}
	clear()
	{
		//this.touch = null;
		this.id = null;
		this.time = null;
		this.startX = null;
		this.startY = null;
		this.startLeft = null;
		this.powerX = null;
		this.powerY = null;
	}
	init(touch)
	{
		//直接保有しないようにする
		//this.touch = touch;
		this.id = touch.identifier;
		this.time = Date.now();

		//開始位置を記録
		this.startX = touch.clientX;
		this.startY = touch.clientY;
		this.startLeft = (this.startX <= window.innerWidth / 2);

		//crossTouch用移動量
		this.powerX = 0;
		this.powerY = 0;
	}
	isEnabled()
	{
		return (this.id !== null)
	}
	find(e)
	{
		if (!this.isEnabled() || e === null)
			return null;

		//直接Touch型きたらそのまま返す
		if (e instanceof Touch)
			return e;

		return Array.from(e.changedTouches).find(t => t.identifier === this.id);
	}
	// 指を置いた場所からの移動量
	move(e)
	{
		const touch = this.find(e);
		if (!touch)
			return null;

		const dx = touch.clientX - this.startX;
		const dy = touch.clientY - this.startY;

		return { x: dx, y: dy };
	}
	dist(e)
	{
		const touch = this.find(e);
		if (!touch)
			return null;

		const move = this.move(touch);
		const dist = Math.hypot(move.x, move.y);

		//addLog("info", "move x: " + move.x + "y:" + move.y);

		return dist;
	}
	power(e, radius)
	{
		const touch = this.find(e);
		if (!touch)
			return null;

		const move = this.move(touch);
		const dist = this.dist(touch);

		if (dist > 0)
		{
			// 最大距離でクランプ（頭打ち）しつつ、-1〜1の範囲の強さに変換する
			const power = Math.min(dist, radius) / radius;
			const vx = (move.x / dist) * power;
			const vy = (move.y / dist) * power;

			return { x: vx, y: vy };
		}

		return { x: 0, y: 0 };
	}
	//経過
	duration(now)
	{
		if (!this.isEnabled() || this.time === null || now === null)
			return null;

		return now - this.time;
	}
}

//ピンチ(ズーム用)
export const touch1 = new myTouch();
export const touch2 = new myTouch();
export let pinchLastDist = null;// 直前に計測した2本指の距離（次の距離と比べてズーム量を求めるため）
//export const inputZoom = { scale: 1 };// 直近のフレームで蓄積されたズーム倍率（1.0 = 変化なし、1.05 = 5%拡大、0.95 = 5%縮小）、指の位置は使わず「距離の変化率」だけを使う
//export function clearInputZoom() { inputZoom.scale = 1; }// フレーム末にズーム倍率をリセットする（clearKeysと同様、engine側のループ末尾で呼ぶ）

//十字キー
//export const crossTouch = new myTouch();
export const VIRTUAL_MOVE_RADIUS = 50;// スティックが反応する最大距離（px）。これ以上離しても入力の強さは頭打ちになる

//タップ(マウスダウンの代わり)
//export const tapTouch = new myTouch();
export const TAP_MOVE_THRESHOLD = 10;  // これ以上動いたらタップ扱いしない（px）
export const TAP_TIME_THRESHOLD = 300; // これより長く押し続けたらタップ扱いしない（ms）

//ダブルタップ判定/自動ズームの無効化(game.cssで対策する) https://zenn.dev/kiki_her/articles/0f3e86ba83df08
export let lastTapTime = 0;// 最後にタップ（指を離した瞬間）した時刻を覚えておく変数
export const DOUBLE_TAP_THRESHOLD = 300;// これより短い間隔で2回タップされたら「ダブルタップ」とみなす時間（ミリ秒）

//長押し
export const PRESS_TIME_THRESHOLD = 400; // 長押しとみなす時間（ms）

//メモ

//順序
//touchstart touchend mousedown click

//passive: true
//preventDefaultが無視されます

//タッチがうまく反応しないとき
//タッチを少し長押しすると右クリック扱いになる＝mousedownが呼ばれなくなる
//そしてmousedownはタッチが離れたときに呼ばれて少し遅れた感じに発動する

//仕様
//- mousedownはPC、touchstartはスマホに完全に分ける
//- ブラウザ標準のズームインアウトはcanvasスクロールは呼ばないで独自にズームインアウトを作る
//- ピッチ中でもタッチ移動が止まらないようにしたい　※ピッチしようとすると1度touchstartが挟まれてしまうので難しい
//- 

//デバッグ用
function touchDebugLog(message, e = null)
{
	if (!e)
	{
		addLog("info", message);
		return;
	}

	// 現在画面に触れている指の数と、そのうち今回イベントが発生した指の数
	const touchesCount = e.touches?.length ?? 0;
	const changedCount = e.changedTouches?.length ?? 0;

	// 今画面に触れている「全部の指」の座標一覧を文字列にする
	const touchesInfo = Array.from(e.touches ?? []).map(t => "[id" + t.identifier + ":" + Math.round(t.clientX) + "," + Math.round(t.clientY) + "]").join(" ");

	// 今回のイベントで「動いた・離れた指」だけの座標一覧
	const changedInfo = Array.from(e.changedTouches ?? []).map(t => "[id" + t.identifier + ":" + Math.round(t.clientX) + "," + Math.round(t.clientY) + "]").join(" ");

	// 例: [id0:120,340] [id1:200,410]
	addLog("info",
		message
		+ " touches(" + touchesCount + ")" + (touchesInfo ? " " + touchesInfo : "")
		+ " changed(" + changedCount + ")" + (changedInfo ? " " + changedInfo : "")
	);
}

// 追跡中の2本の指を探して、その間の距離を計算する
export function getPinchDistance(touches, touch1, touch2)
{
	const t1 = Array.from(touches).find(t => t.identifier === touch1.id);
	const t2 = Array.from(touches).find(t => t.identifier === touch2.id);

	// 片方でも見つからなければ計算不能
	if (!t1 || !t2)
		return null;

	return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

export function clearTouch()
{
	touch1.clear();
	touch2.clear();
	pinchLastDist = null;
}

//画面に指を置いたとき
canvas.addEventListener('touchstart', (e) =>
{
	//touchDebugLog("touchstart", e);

	//信頼できないブラウザの合成mousedownには頼らないようにする
	e.preventDefault();

	//タッチ1初期化 まだ1本目の指を追跡していない場合のみ初期化、すでに追跡中なら後から増えた指でstartX/startYが上書きされないようにする
	if (!touch1.isEnabled())
	{
		touchDebugLog("touchstart タップを開始します");
		touch1.init(e.touches[0]);
	}
	//1本目を追跡中に、2本目の指が新しく触れたらピンチ開始、3本目以降の指は入らないのでピンチ状態は保たれる
	else if (!touch2.isEnabled() && e.touches.length >= 2)
	{
		const second = Array.from(e.touches).find(t => t.identifier !== touch1.id);
		if (second)
		{
			touchDebugLog("touchstart タップ(指2本)を開始します");
			touch2.init(second);
			pinchLastDist = getPinchDistance(e.touches, touch1, touch2);
		}
	}
	//それ以外（3本目以降の指）は何もせず、既存の追跡をそのまま維持する

}, { passive: false });

//指を離したとき
//e.touches 画面から離れた指
//e.changedTouches 離れた指
canvas.addEventListener('touchend', (e) =>
{
	//touchDebugLog("touchend", e);

	// タッチ操作から発生する余計なマウスイベント（クリック移動）を防ぐ
	e.preventDefault();

	//前回のタップからの経過時間
	const now = Date.now();// 今の時刻を取得
	const interval = now - lastTapTime;

	//ダブルタップの検知
	if (interval > 0 && interval < DOUBLE_TAP_THRESHOLD)
	{
		touchDebugLog("touchend ダブルタップを検知しました");
		lastTapTime = now;// 今回のタップ時刻を、次回判定用に覚えておく

		if (player)
			player.setMoveTargetFromScreen(touch1.startX, touch1.startY);

		clearTouch();

		//一定時間以内の2回目のタップなら、ブラウザの拡大処理をキャンセルする
		//e.preventDefault();
	}
	// ピンチ終了　2本のうちどちらかが離れた
	else if (e.touches.length >= 1)
	{
		touchDebugLog("touchend 指が離れたのでピンチを終了します");
		clearTouch();

		// 指が1本以下になった時点で終了。ここでは十字キー操作は再開しない
		//if (e.touches.length < 2)
		//return;
	}
	// タップ
	else if (touch1.isEnabled())
	{
		// あまり動かさず、素早く離した場合だけ「タップ」として成立させる
		if (touch1.dist(e) <= TAP_MOVE_THRESHOLD && touch1.duration(now) <= TAP_TIME_THRESHOLD)
		{
			touchDebugLog("touchend タップ成功", e);
			lastTapTime = now;// 今回のタップ時刻を、次回判定用に覚えておく
			if (player)
				player.setMoveTargetFromScreen(touch1.startX, touch1.startY);
		}
		clearTouch();

	}
	else
		touchDebugLog("touchend タップ候補見つかりませんでした");

}, { passive: false });

//指を動かしたとき
canvas.addEventListener('touchmove', (e) =>
{
	//touchDebugLog("touchmove", e);

	// タッチ操作から発生する余計なマウスイベント（クリック移動）を防ぐ
	e.preventDefault();

	// ピンチズーム中（2本の指を追跡している）なら、距離の変化率からズーム倍率を求める
	if (touch1.isEnabled() && touch2.isEnabled())
	{
		const dist = getPinchDistance(e.touches, touch1, touch2);
		if (dist !== null && pinchLastDist !== null && pinchLastDist > 0)
		{
			// 前回との距離の比率をそのままズーム倍率として積算する、（指が離れていく→比率が1より大きい→拡大、指が近づく→1より小さい→縮小）
			//inputZoom.scale *= dist / pinchLastDist;
			//world.camera.zoom *= input.inputZoom.scale;

			// ピンチズームの結果をカメラの拡大率に反映する（プレイヤーは常に画面中心にいるので、これだけで自動的に中心起点のズームになる）
			world.camera.zoom *= dist / pinchLastDist;
			world.camera.zoom = Math.min(Math.max(world.camera.zoom, 0.5), 3); // 拡大率の上限・下限を制限（お好みで調整）
		}

		pinchLastDist = dist;
	}
	//タッチ移動
	else if (touch1.isEnabled())
	{
		// 今追跡している指を、動いた指の一覧から探す
		const touch = touch1.find(e);
		if (!touch)
			return;

		//長押し判定
		if (touch1.dist(touch) <= TAP_MOVE_THRESHOLD && touch1.duration(Date.now()) > PRESS_TIME_THRESHOLD)
		{
			touchDebugLog("指が長押しされました");
			touch1.clear();
		}
		//十字キー操作　開始の指が画面左半分の指だけを「十字キー操作」として扱う
		else if (touch1.startLeft)
		{
			// 指を置いた場所からの移動量の-1~1を取得
			const pow = touch1.power(touch, VIRTUAL_MOVE_RADIUS);
			touch1.powerX = pow.x;
			touch1.powerY = pow.y;
		}
		// タップ候補の指が動きすぎたら、タップ扱いをやめる（スワイプ等に譲る）
		else if (touch1.dist(touch) > TAP_MOVE_THRESHOLD)
		{
			touchDebugLog("指が動いたのでタップ中断");
			touch1.clear();
		}
	}

}, { passive: false });

//タッチがキャンセルされたとき
canvas.addEventListener('touchcancel', (e) =>
{
	touchDebugLog("touchcancel");
	clearTouch();
}, { passive: false });