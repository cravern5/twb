import { print, addLog } from '../shared/sub.js';

import * as utils2 from './utils2.js';
import { ctx } from './engine.js';
import * as engine from './engine.js';

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

	// このマップのサイズをengine（カメラ）に教える
	engine.setCameraBounds(MAP_WIDTH, MAP_HEIGHT);
}

//画面更新
export function update(delta)
{
	// マップ描画　// engine.beginCameraTransform()で既にズーム・カメラ移動の変形がかかっている
	ctx.drawImage(img, 0, 0);
}

