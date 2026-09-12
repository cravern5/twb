import * as utils2 from './utils2.js';
import { canvas, ctx } from './engine.js';
//import * as input from './input.js';

// マップ設定
export const MAP_WIDTH = 6800;
export const MAP_HEIGHT = 4500;

export let path = '/assets/map/kaul.png';
export let img = null;

// zoom: 1が等倍。2なら「画面の半分の範囲」を切り出して拡大表示＝2倍ズームになる
export const camera = { x: 0, y: 0, zoom: 1 };

//初期化
export async function init()
{
	img = await utils2.loadImage(path);
}

// プレイヤーの中心座標をもとに、カメラの位置を計算する関数
export function updateCamera(targetX, targetY)
{
	// zoomを考慮した「実際に画面に映る範囲」の幅と高さ
	// zoomが大きいほど範囲が狭くなる＝拡大して見える
	const viewWidth = canvas.width / camera.zoom;
	const viewHeight = canvas.height / camera.zoom;

	// プレイヤーが常に画面の中心に来るように、カメラの左上座標を逆算する
	camera.x = targetX - viewWidth / 2;
	camera.y = targetY - viewHeight / 2;

	// マップの端でカメラが止まるように、値の範囲を制限する（端の外側が映らないように）
	camera.x = Math.max(0, Math.min(MAP_WIDTH - viewWidth, camera.x));
	camera.y = Math.max(0, Math.min(MAP_HEIGHT - viewHeight, camera.y));
}


//画面更新
export function update(delta)
{
	// zoomを考慮した切り出しサイズ（updateCameraと同じ計算）
	const viewWidth = canvas.width / camera.zoom;
	const viewHeight = canvas.height / camera.zoom;

	// 中央固定の切り出しではなく、カメラ位置を基準にマップを切り出す
	ctx.drawImage(
		img,
		camera.x, camera.y, viewWidth, viewHeight,       // カメラ位置からズームを反映したサイズで切り抜き
		0, 0, canvas.width, canvas.height                // 切り出した範囲を画面全体に引き伸ばして描画（狭く切るほど拡大されて見える）
	);

}
