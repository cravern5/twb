import * as utils2 from './utils2.js';
import { canvas, ctx } from './engine.js';

// マップ設定
export const MAP_WIDTH = 6800;
export const MAP_HEIGHT = 4500;

export let path = '/assets/map/kaul.png';
export let img = null;
export const camera = { x: 0, y: 0 };

//初期化
export async function init()
{
	img = await utils2.loadImage(path);
}

// プレイヤーの中心座標をもとに、カメラの位置を計算する関数
export function updateCamera(targetX, targetY)
{
	// プレイヤーが常に画面の中心に来るように、カメラの左上座標を逆算する
	camera.x = targetX - canvas.width / 2;
	camera.y = targetY - canvas.height / 2;

	// マップの端でカメラが止まるように、値の範囲を制限する（端の外側が映らないように）
	camera.x = Math.max(0, Math.min(MAP_WIDTH - canvas.width, camera.x));
	camera.y = Math.max(0, Math.min(MAP_HEIGHT - canvas.height, camera.y));

}


//画面更新
export function update(delta)
{
	// 1. フレームの最初にキャンバス全体をクリア
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// 中央固定の切り出しではなく、カメラ位置を基準にマップを切り出す
	ctx.drawImage(
		img,
		camera.x, camera.y, canvas.width, canvas.height, // カメラ位置から画面サイズ分だけ切り抜き
		0, 0, canvas.width, canvas.height                // 画面全体に1:1の等倍サイズで描画
	);
}