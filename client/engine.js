import { print, addLog } from '../shared/sub.js';
import * as sub from '../shared/sub.js';

export let useTouch;
export let canvas = document.getElementById("gameCanvas");
export let ctx = canvas.getContext("2d");

export function init()
{
	//タッチ操作が可能なら
	useTouch = sub.isCanTouch();

	//画像を滑らかに拡大するかどうかを示します　※ここで変更してもダメcanvas.widthなど呼ばれると戻る
	//ctx.imageSmoothingEnabled = false;

	// canvasがフォーカスを受け取れるようにする
	canvas.setAttribute('tabindex', '0');
	// 外枠の黒い線を消す（フォーカス時に青い枠線などが出ないようにする）
	canvas.style.outline = 'none';

	autoPageReloader();

	return true;
}

// プログレスバーとテキストの更新=================
let loadedCount = 0;
let loadTotal = 5;
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const progressBar = document.getElementById('progress-bar');
export function updateProgress(message = "")
{
	loadedCount++;
	const percentage = Math.floor((loadedCount / loadTotal) * 100);
	loadingText.textContent = "Loading... " + percentage + "%" + message + "";
	progressBar.style.width = `${percentage}%`;
}
export function endProgress()
{
	if (loadedCount != loadTotal)
		print("warning", "読み込みカウントが違います。 loadTotal:" + loadTotal + " loadedCount:" + loadedCount);


	// 画面をフェードアウトして非表示にする
	loadingScreen.style.opacity = '0';
	//loadingScreen.style.display = 'none';
	setTimeout(() => { loadingScreen.style.display = 'none'; });
}
//保存時の自動ページリロード用
export function autoPageReloader()
{
	if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
		return;

	// サーバーとの常時接続を開始する
	const eventSource = new EventSource('/events');

	// サーバーから 'data: reload\n\n' が送られてきた時に実行される処理
	eventSource.onmessage = function (event)
	{
		// 送られてきたデータが "reload" だったらページを再読み込みする
		if (event.data === 'reload')
			location.reload();
	};
	// 追加：接続エラー時（本番環境で404が返る場合など）は再接続をやめる
	eventSource.onerror = function ()
	{
		eventSource.close();
	};
}


// カメラ（視点）関連 ==========================

// zoom: 1が等倍。2なら「画面の半分の範囲」を切り出して拡大表示＝2倍ズームになる
// カメラが動ける範囲（＝現在のマップサイズ）。マップ側からsetCameraBoundsで教えてもらう
export const camera = { x: 0, y: 0, zoom: 1, width: 0, height: 0 };

// マップを読み込んだとき（マップ切り替え時も）に、カメラが動ける範囲を設定する
export function setCameraBounds(width, height)
{
	camera.width = width;
	camera.height = height;
}


// 中心座標をもとに、カメラの位置を計算
// 中心座標をもとにカメラ位置を計算し、カメラ変形（ズーム・平行移動）を開始する
// 呼び出し後は、マップやプレイヤーの描画でカメラやズームを意識せず、そのままワールド座標を使って描画できる
export function beginCameraTransform(targetX, targetY)
{
	// zoomを考慮した「実際に画面に映る範囲」の幅と高さ zoomが大きいほど範囲が狭くなる＝拡大して見える
	const viewWidth = canvas.width / camera.zoom;
	const viewHeight = canvas.height / camera.zoom;

	// プレイヤーが常に画面の中心に来るように、カメラの左上座標を逆算する
	camera.x = targetX - viewWidth / 2;
	camera.y = targetY - viewHeight / 2;

	// マップの端でカメラが止まるように、値の範囲を制限する（端の外側が映らないように）
	camera.x = Math.max(0, Math.min(camera.width - viewWidth, camera.x));
	camera.y = Math.max(0, Math.min(camera.height - viewHeight, camera.y));

	ctx.save();                          // 変形前の状態を退避しておく（あとで必ずrestoreで戻す）
	ctx.scale(camera.zoom, camera.zoom); // これ以降の描画すべてに、ズーム倍率がかかるようにする
	ctx.translate(-camera.x, -camera.y); // カメラの位置ぶん、描画位置をずらす
}

// カメラ変形を終了し、変形前の状態に戻す（beginCameraTransformと必ずセットで呼ぶこと）
export function endCameraTransform()
{
	ctx.restore();
}

// スクリーン座標（ページ基準のe.clientX/clientY）をワールド座標に変換する
// マウスクリック位置から「地図上のどこがクリックされたか」を求めるときに使う
export function screenToWorld(clientX, clientY)
{
	// キャンバスがページ内のどこに表示されているかを取得する
	const rect = canvas.getBoundingClientRect();

	// client座標から、キャンバス内のローカル座標（キャンバス左上を(0,0)とする座標）に直す
	const localX = clientX - rect.left;
	const localY = clientY - rect.top;

	// ローカル座標をズーム倍率で割り戻し、カメラ位置を足してワールド座標にする
	return {
		x: localX / camera.zoom + camera.x,
		y: localY / camera.zoom + camera.y
	};
}

// ワールド座標を、実際のキャンバス上のピクセル座標に変換する（ズームを計算済みの値）
// カメラ変形をかけずに描きたいUI要素（ズームしても大きさを変えたくないもの）で使う
export function worldToScreen(worldX, worldY)
{
	return {
		x: (worldX - camera.x) * camera.zoom,
		y: (worldY - camera.y) * camera.zoom
	};
}