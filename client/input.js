import { print, addLog } from '../shared/sub.js';
import * as engine from './engine.js';
import { player } from './player.js';

//キーボード==============================================================
export const keys = {};
export const keysPress = {};
//export const keys = new Proxy({}, {	get: (target, key) => key in target ? target[key] : false});

//キーが押されたとき
export function getKeyState_keydown(e)
{
	const key = e.key === ' ' ? 'space' : e.key.toLowerCase();

	// keysDownは最初の押下のみ（リピートを除外）
	if (!e.repeat)
		keys[key] = true;

	keysPress[key] = true; // keysはリピート含めて常にtrue（変更なし）
};

//キーが離されたとき
export function getKeyState_keyup(e)
{
	const key = e.key === ' ' ? 'space' : e.key.toLowerCase();

	keys[key] = false;
	keysPress[key] = false;
};

// フレーム末にエッジフラグをリセット（anime()の末尾などで呼ぶ）
export function clearKeys()
{
	for (const key in keys)
		delete keys[key];
}

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


// マウスを動かしているとき
export function getMouseState_mousedown(e)
{
	if (e.button === 0) mouseInfo.left = true;
	if (e.button === 1) mouseInfo.middle = true;
	if (e.button === 2) mouseInfo.right = true;
	if (e.button === 3) mouseInfo.back = true;
	if (e.button === 4) mouseInfo.forward = true;

	mouseInfo.clientX = e.clientX;
	mouseInfo.clientY = e.clientY;
}

// マウスを動かしているとき
export function getMouseState_mousemove(e)
{
	mouseInfo.movementX = e.movementX;
	mouseInfo.movementY = e.movementY;
};

// マウスを離したとき
export function getMouseState_mouseup(e)
{
	if (e.button === 0) mouseInfo.left = false;
	if (e.button === 1) mouseInfo.middle = false;
	if (e.button === 2) mouseInfo.right = false;
	if (e.button === 3) mouseInfo.back = false;
	if (e.button === 4) mouseInfo.forward = false;
};

// マウスを動かしているとき
export function getMouseState_mousewheel(e)
{
	mouseInfo.wheel_deltaY = e.deltaY;
};




//バーチャル十字キー（スマホ用）==============================================================

// 直近のフレームで蓄積されたズーム倍率（1.0 = 変化なし、1.05 = 5%拡大、0.95 = 5%縮小）
// 常に画面中心（プレイキャラクター）を起点にズームしたいので、指の位置は使わず「距離の変化率」だけを使う
export const virtualZoom = { scale: 1 };

// ピンチ中に追跡する2本の指のID
let pinchTouchId1 = null;
let pinchTouchId2 = null;

// 直前に計測した2本指の距離（次の距離と比べてズーム量を求めるため）
let pinchLastDist = null;

// 追跡中の2本の指を探して、その間の距離を計算する
function getPinchDistance(touches, id1, id2)
{
	const t1 = Array.from(touches).find(t => t.identifier === id1);
	const t2 = Array.from(touches).find(t => t.identifier === id2);

	// 片方でも見つからなければ計算不能
	if (!t1 || !t2)
		return null;

	return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

// フレーム末にズーム倍率をリセットする（clearKeysと同様、engine側のループ末尾で呼ぶ）
export function clearVirtualZoom()
{
	virtualZoom.scale = 1;
}

// 現在バーチャル十字キーで入力されている移動方向（-1〜1の範囲、未入力時は0）
export const virtualMove = { x: 0, y: 0 };

// 今操作中のタッチを追跡するためのID（他の指のタッチと混ざらないようにする）
let virtualMoveTouchId = null;

// 指を置いた場所（ここを中心にどれだけ離れたかで、方向と強さを決める）
let virtualMoveOriginX = 0;
let virtualMoveOriginY = 0;

// スティックが反応する最大距離（px）。これ以上離しても入力の強さは頭打ちになる
const VIRTUAL_MOVE_RADIUS = 50;


let lastTapTime = 0;// 最後にタップ（指を離した瞬間）した時刻を覚えておく変数
const DOUBLE_TAP_THRESHOLD = 300;// これより短い間隔で2回タップされたら「ダブルタップ」とみなす時間（ミリ秒）


//タッチがうまく反応しないときのメモ
//タッチを少し長押しすると右クリック扱いになる＝mousedownが呼ばれなくなる
//そしてmousedownはタッチが離れたときに呼ばれて少し遅れた感じに発動する

// タップ（十字キー範囲外を、あまり動かさず短く触れて離す操作）の追跡用
let tapTouchId = null;
let tapStartX = 0;
let tapStartY = 0;
let tapStartTime = 0;
const TAP_MOVE_THRESHOLD = 10;  // これ以上動いたらタップ扱いしない（px）
const TAP_TIME_THRESHOLD = 300; // これより長く押し続けたらタップ扱いしない（ms）

// タップが成立した位置。consumeTap()で受け取ると自動でリセットされる
export const tapPosition = { x: 0, y: 0 };
let tapPending = false;

// タップが成立していれば true を返して消費する（1回受け取ったら次のタップまでfalseに戻る）
export function consumeTap()
{
	if (!tapPending)
		return false;

	tapPending = false;
	return true;
}





//画面に指を置いたとき
export function getVirtualMove_touchstart(e)
{
	addLog("info", "touchstart(" + e.touches.length + ")");

	// 指が2本になったらピンチズーム開始（十字キー操作より優先する）
	if (e.touches.length === 2)
	{
		// ここでブラウザ標準のピンチズームを止めて、自前でズームを行う
		e.preventDefault();

		pinchTouchId1 = e.touches[0].identifier;
		pinchTouchId2 = e.touches[1].identifier;
		pinchLastDist = getPinchDistance(e.touches, pinchTouchId1, pinchTouchId2);

		// ピンチ中は十字キー操作をキャンセルしておく
		virtualMoveTouchId = null;
		virtualMove.x = 0;
		virtualMove.y = 0;
		return;
	}



	//let touches = e.touches ? e.touches.length : 0;
	//addLog("INFO", "touch_start(" + touches + ")");

	// 既に別の指で操作中なら何もしない（2本指で同時操作させない）
	if (virtualMoveTouchId !== null)
		return;

	// 画面に触れている指が2本以上＝ピンチズームの可能性があるので、
	// 十字キーとしては扱わず、preventDefault()も呼ばずにブラウザに判断を任せる
	if (e.touches.length >= 2)
		return;

	const touch = e.changedTouches[0];

	// 画面の左半分に置いた指だけを「十字キー操作」として扱う
	if (touch.clientX > window.innerWidth / 2)
		return;

	// 十字キー範囲外＝タップ（移動先指定）候補として追跡する
	// ここでpreventDefaultして、信頼できないブラウザの合成mousedownには頼らないようにする
	e.preventDefault();

	/*
	virtualMoveTouchId = touch.identifier;
	virtualMoveOriginX = touch.clientX;
	virtualMoveOriginY = touch.clientY;
	*/

	tapTouchId = touch.identifier;
	tapStartX = touch.clientX;
	tapStartY = touch.clientY;
	tapStartTime = Date.now();
	return;
}

//指を動かしたとき
export function getVirtualMove_touchmove(e)
{
	// タップ候補の指が動きすぎたら、タップ扱いをやめる（スワイプ等に譲る）
	if (tapTouchId !== null)
	{
		const touch = Array.from(e.touches).find(t => t.identifier === tapTouchId);
		if (touch)
		{
			const dx = touch.clientX - tapStartX;
			const dy = touch.clientY - tapStartY;
			if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD)
				tapTouchId = null;
		}
		return;
	}


	// ピンチズーム中（2本の指を追跡している）なら、距離の変化率からズーム倍率を求める
	if (pinchTouchId1 !== null && pinchTouchId2 !== null)
	{
		e.preventDefault();

		const dist = getPinchDistance(e.touches, pinchTouchId1, pinchTouchId2);

		if (dist !== null && pinchLastDist !== null && pinchLastDist > 0)
		{
			// 前回との距離の比率をそのままズーム倍率として積算する
			// （指が離れていく→比率が1より大きい→拡大、指が近づく→1より小さい→縮小）
			virtualZoom.scale *= dist / pinchLastDist;
		}

		pinchLastDist = dist;
		return;
	}




	//let touches = e.touches ? e.touches.length : 0;
	//addLog("INFO", "touch_move(" + touches + ")");

	// 途中から2本目の指が触れた＝ピンチズームに切り替わったとみなし、
	// 十字キー操作を強制終了してブラウザの標準ジェスチャーに譲る
	if (e.touches.length >= 2)
	{
		virtualMoveTouchId = null;
		virtualMove.x = 0;
		virtualMove.y = 0;
		return;
	}

	//課題
	//指が2本かつスライドさせるとデフォルトのスクロール判定されてしまうが
	//その処理を止めてしまうとズームインアウトもできない

	// 今追跡している指を、動いた指の一覧から探す
	const touch = Array.from(e.changedTouches).find(t => t.identifier === virtualMoveTouchId);

	if (!touch)
		return;

	// タッチ操作から発生する余計なマウスイベント（クリック移動）を防ぐ
	e.preventDefault();

	// 指を置いた場所からの移動量
	const dx = touch.clientX - virtualMoveOriginX;
	const dy = touch.clientY - virtualMoveOriginY;
	const dist = Math.hypot(dx, dy);

	if (dist > 0)
	{
		// 最大距離でクランプ（頭打ち）しつつ、-1〜1の範囲の強さに変換する
		const power = Math.min(dist, VIRTUAL_MOVE_RADIUS) / VIRTUAL_MOVE_RADIUS;
		virtualMove.x = (dx / dist) * power;
		virtualMove.y = (dy / dist) * power;
	}
}

//指を離したとき
export function getVirtualMove_touchend(e)
{
	addLog("info", "touchend");

	// タップ候補だった指が離れたら、条件を満たしていればタップ成立とする
	if (tapTouchId !== null)
	{
		const touch = Array.from(e.changedTouches).find(t => t.identifier === tapTouchId);

		if (touch)
		{
			const dx = touch.clientX - tapStartX;
			const dy = touch.clientY - tapStartY;
			const dist = Math.hypot(dx, dy);
			const duration = Date.now() - tapStartTime;

			// あまり動かさず、素早く離した場合だけ「タップ」として成立させる
			if (dist <= TAP_MOVE_THRESHOLD && duration <= TAP_TIME_THRESHOLD)
			{
				tapPosition.x = touch.clientX;
				tapPosition.y = touch.clientY;
				tapPending = true;
			}

			tapTouchId = null;
		}
		return;
	}

	// タップ（十字キー範囲外を軽く触れる操作）が成立していれば、クリック相当の移動先セットを直接行う
	// ブラウザの合成mousedownを待たないので、発火しないことによる「動かない」問題を防げる
	if (player && consumeTap())
	{
		addLog("info", "consumeTap");
		player.setMoveTargetFromScreen(input.tapPosition.x, input.tapPosition.y);
	}


	// ピンチ中の指（2本のうちどちらか）が離れたら、ピンチズームを終了する
	if (pinchTouchId1 !== null || pinchTouchId2 !== null)
	{
		const released = Array.from(e.changedTouches).some(
			t => t.identifier === pinchTouchId1 || t.identifier === pinchTouchId2
		);

		if (released)
		{
			pinchTouchId1 = null;
			pinchTouchId2 = null;
			pinchLastDist = null;
		}

		// 指が1本以下になった時点で終了。ここでは十字キー操作は再開しない
		if (e.touches.length < 2)
			return;
	}



	//let touches = e.touches ? e.touches.length : 0;
	//addLog("INFO", "touch_end(" + touches + ")");

	// 今の時刻を取得
	const now = Date.now();

	// 前回のタップからの経過時間
	const interval = now - lastTapTime;

	// 一定時間以内の2回目のタップなら、ブラウザの拡大処理をキャンセルする
	if (interval > 0 && interval < DOUBLE_TAP_THRESHOLD)
		e.preventDefault();

	// 今回のタップ時刻を、次回判定用に覚えておく
	lastTapTime = now;



	// 今追跡している指を、動いた指の一覧から探す
	const touch = Array.from(e.changedTouches).find(t => t.identifier === virtualMoveTouchId);

	if (!touch)
		return;

	// 操作終了。入力をリセットする
	virtualMoveTouchId = null;
	virtualMove.x = 0;
	virtualMove.y = 0;
}