import { print, addLog } from '../shared/sub.js';

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

// 中心座標をもとに、カメラの位置を計算
// カメラ変形（ズーム・平行移動）を開始する。呼び出し後は、マップやプレイヤーの描画で
// カメラやズームを意識せず、そのままワールド座標を使って描画できるようになる
export function beginCameraTransform(targetX, targetY)
{
	// zoomを考慮した「実際に画面に映る範囲」の幅と高さ zoomが大きいほど範囲が狭くなる＝拡大して見える
	const viewWidth = canvas.width / camera.zoom;
	const viewHeight = canvas.height / camera.zoom;

	// プレイヤーが常に画面の中心に来るように、カメラの左上座標を逆算する
	camera.x = targetX - viewWidth / 2;
	camera.y = targetY - viewHeight / 2;

	// マップの端でカメラが止まるように、値の範囲を制限する（端の外側が映らないように）
	camera.x = Math.max(0, Math.min(MAP_WIDTH - viewWidth, camera.x));
	camera.y = Math.max(0, Math.min(MAP_HEIGHT - viewHeight, camera.y));

	ctx.save();                          // 変形前の状態を退避しておく（あとで必ずrestoreで戻す）
	ctx.scale(camera.zoom, camera.zoom); // これ以降の描画すべてに、ズーム倍率がかかるようにする
	ctx.translate(-camera.x, -camera.y); // カメラの位置ぶん、描画位置をずらす
}

// カメラ変形を終了し、変形前の状態に戻す（beginCameraTransformと必ずセットで呼ぶこと）
export function endCameraTransform()
{
	ctx.restore();
}


//画面更新
export function update(delta)
{
	// マップ描画　// beginCameraTransform()で既にズーム・カメラ移動の変形がかかっている
	ctx.drawImage(img, 0, 0);
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