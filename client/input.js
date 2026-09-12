import { print, addLog } from '../shared/sub.js';
import { canvas } from './engine.js';
import { player } from './player.js';
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

	game.mousedown(e);

});

// マウスを動かしているとき
document.addEventListener('mousemove', (e) =>
{
	//状態取得
	mouseInfo.movementX = e.movementX;
	mouseInfo.movementY = e.movementY;

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

//メモ

//順序
//touchstart touchend mousedown click

//passive: true
//preventDefaultが無視されます

//タッチがうまく反応しないとき
//タッチを少し長押しすると右クリック扱いになる＝mousedownが呼ばれなくなる
//そしてmousedownはタッチが離れたときに呼ばれて少し遅れた感じに発動する

//タッチ保持クラス
class myTouch
{
	constructor()
	{
		this.clear();
	}
	init(touch)
	{
		//直接保有しないようにする
		//this.touch = touch;
		this.id = touch.identifier;
		this.time = Date.now();
		this.startX = touch.clientX;
		this.startY = touch.clientY;
		this.x = 0;
		this.y = 0;
	}
	clear()
	{
		//this.touch = null;
		this.id = null;
		this.time = null;
		this.startX = null;
		this.startY = null;
		this.x = null;
		this.y = null;
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

		return dist;
	}
	movePower(e, radius)
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
export const pinchTouch1 = new myTouch();
export const pinchTouch2 = new myTouch();
export let pinchLastDist = null;// 直前に計測した2本指の距離（次の距離と比べてズーム量を求めるため）
export const inputZoom = { scale: 1 };// 直近のフレームで蓄積されたズーム倍率（1.0 = 変化なし、1.05 = 5%拡大、0.95 = 5%縮小）、指の位置は使わず「距離の変化率」だけを使う
export function clearInputZoom() { inputZoom.scale = 1; }// フレーム末にズーム倍率をリセットする（clearKeysと同様、engine側のループ末尾で呼ぶ）

//十字キー
export const crossTouch = new myTouch();
export const VIRTUAL_MOVE_RADIUS = 50;// スティックが反応する最大距離（px）。これ以上離しても入力の強さは頭打ちになる

//タップ(マウスダウンの代わり)
export const tapTouch = new myTouch();
export const TAP_MOVE_THRESHOLD = 10;  // これ以上動いたらタップ扱いしない（px）
export const TAP_TIME_THRESHOLD = 300; // これより長く押し続けたらタップ扱いしない（ms）

//ダブルタップ判定/自動ズームの無効化(game.cssで対策する) https://zenn.dev/kiki_her/articles/0f3e86ba83df08
export let lastTapTime = 0;// 最後にタップ（指を離した瞬間）した時刻を覚えておく変数
export const DOUBLE_TAP_THRESHOLD = 300;// これより短い間隔で2回タップされたら「ダブルタップ」とみなす時間（ミリ秒）


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

//画面に指を置いたとき
canvas.addEventListener('touchstart', (e) =>
{
	touchDebugLog("touchstart", e);

	// 指が2本になったらピンチズーム開始（十字キー操作より優先する）
	if (e.touches.length === 2)
	{
		// ここでブラウザ標準のピンチズームを止めて、自前でズームを行う
		e.preventDefault();

		pinchTouch1.init(e.touches[0]);
		pinchTouch2.init(e.touches[1]);

		pinchLastDist = getPinchDistance(e.touches, pinchTouch1, pinchTouch2);

		// ピンチ中は十字キー操作をキャンセルしておく
		crossTouch.clear();

		touchDebugLog("touchstart 指2本で開始");
		return;
	}

	// 既に別の指で操作中なら何もしない（2本指で同時操作させない）
	if (crossTouch.isEnabled())
	{
		touchDebugLog("touchstart crossTouchIdが既に存在します");
		return;
	}

	const touch = e.changedTouches[0];

	//タップキー初期化
	tapTouch.init(touch);
	touchDebugLog("タップ開始 taptouch.id[" + tapTouch.id + "]");

	// 画面の左半分に置いた指だけを「十字キー操作」として扱う
	if (touch.clientX <= window.innerWidth / 2)
	{
		//十字キー初期化
		crossTouch.init(touch);
		touchDebugLog("十字キー開始 taptouch.id[" + crossTouch.id + "]");

	}
	else
		return;



	// 十字キー範囲外＝タップ（移動先指定）候補として追跡する
	// ここでpreventDefaultして、信頼できないブラウザの合成mousedownには頼らないようにする
	e.preventDefault();


}, { passive: false });

//指を離したとき
canvas.addEventListener('touchend', (e) =>
{
	touchDebugLog("touchend", e);

	//ダブルタップを検知
	const now = Date.now();// 今の時刻を取得
	const interval = now - lastTapTime;// 前回のタップからの経過時間

	// 一定時間以内の2回目のタップなら、ブラウザの拡大処理をキャンセルする
	if (interval > 0 && interval < DOUBLE_TAP_THRESHOLD)
	{
		touchDebugLog("touchend ダブルタップを確認しました", e);
		e.preventDefault();
	}
	lastTapTime = now;// 今回のタップ時刻を、次回判定用に覚えておく


	// タップ候補だった指が離れたら、条件を満たしていればタップ成立とする
	if (tapTouch.isEnabled())
	{
		if (tapTouch.find(e))
		{
			const touch = tapTouch.find(e);
			if (touch)
			{
				// あまり動かさず、素早く離した場合だけ「タップ」として成立させる
				if (player && tapTouch.dist(e) <= TAP_MOVE_THRESHOLD && tapTouch.duration(now) <= TAP_TIME_THRESHOLD)
				{
					touchDebugLog("touchend タップ成功、キャラクター移動(" + touch.clientX.toFixed(0) + "," + touch.clientY.toFixed(0) + ")");
					player.setMoveTargetFromScreen(touch.clientX, touch.clientY);
				}
			}
		}
		else
			touchDebugLog("touchend タップ候補見つかりませんでした");

		tapTouch.clear();
		crossTouch.clear();
		return;
	}
	else
		touchDebugLog("touchend タップ候補見つかりませんでした");


	// ピンチ中の指（2本のうちどちらか）が離れたら、ピンチズームを終了する
	if (pinchTouch1.isEnabled() || pinchTouch2.isEnabled())
	{
		//変更のある指でfrom:配列を作って、ピンチの指があるか調べる
		const released = Array.from(e.changedTouches).some(t => t.identifier === pinchTouch1.id || t.identifier === pinchTouch2.id);

		if (released)
		{
			pinchTouch1.clear();
			pinchTouch2.clear();
			pinchLastDist = null;
		}

		// 指が1本以下になった時点で終了。ここでは十字キー操作は再開しない
		if (e.touches.length < 2)
			return;
	}

	// 操作終了。入力をリセットする
	crossTouch.clear();

}, { passive: false });

//指を動かしたとき
canvas.addEventListener('touchmove', (e) =>
{
	//touchDebugLog("touchmove", e);

	// タップ候補の指が動きすぎたら、タップ扱いをやめる（スワイプ等に譲る）
	const tap = tapTouch.find(e);
	if (tap)
	{
		const move = tapTouch.move(tap);
		if (Math.hypot(move.x, move.y) > TAP_MOVE_THRESHOLD)
		{
			touchDebugLog("指が動いたのでタップ中断");
			tapTouch.clear();
		}
		return;
	}


	// ピンチズーム中（2本の指を追跡している）なら、距離の変化率からズーム倍率を求める
	if (pinchTouch1.isEnabled() && pinchTouch2.isEnabled())
	{
		e.preventDefault();

		const dist = getPinchDistance(e.touches, pinchTouch1, pinchTouch2);
		if (dist !== null && pinchLastDist !== null && pinchLastDist > 0)
		{
			// 前回との距離の比率をそのままズーム倍率として積算する、（指が離れていく→比率が1より大きい→拡大、指が近づく→1より小さい→縮小）
			inputZoom.scale *= dist / pinchLastDist;
		}

		pinchLastDist = dist;
		return;
	}
	// 途中から2本目の指が触れた＝ピンチズームに切り替わったとみなし、
	// 十字キー操作を強制終了してブラウザの標準ジェスチャーに譲る
	if (e.touches.length >= 2)
	{
		crossTouch.clear();
		return;
	}

	// 今追跡している指を、動いた指の一覧から探す
	const ctouch = crossTouch.find(e);
	if (!ctouch)
		return;

	// タッチ操作から発生する余計なマウスイベント（クリック移動）を防ぐ
	e.preventDefault();

	// 指を置いた場所からの移動量
	const pow = crossTouch.movePower(ctouch, VIRTUAL_MOVE_RADIUS);
	crossTouch.x = pow.x;
	crossTouch.y = pow.y;

	//touchDebugLog("power x:" + crossTouch.x + " y:" + crossTouch.y);

}, { passive: false });

//タッチがキャンセルされたとき
canvas.addEventListener('touchcancel', (e) =>
{
	touchDebugLog("touchcancel");
	pinchTouch1.clear();
	pinchTouch2.clear();
	pinchLastDist = null;
	tapTouch.clear();
	crossTouch.clear();
}, { passive: false });