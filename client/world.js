import { print, addLog } from '../shared/sub.js';

import * as utils2 from './utils2.js';
import { ctx } from './engine.js';
import * as engine from './engine.js';

//位置合わせ用
const PLAYER_SPRITE_WIDTH = 70;    // player.js の SPRITE_WIDTH と同じ値
const PLAYER_SPRITE_HEIGHT = 95;   // player.js の SPRITE_HEIGHT と同じ値

// マップ設定
export const MAP_WIDTH = 6800;
export const MAP_HEIGHT = 4500;

export let path = '/assets/map/kaul.png';
export let img = null;

export const ASSETSDIR = "/assets/other";	//ディレクトリ
export const FRAME_DURATION = 0.07;					// アニメーションの更新間隔（秒単位：例 0.1秒ごとに1コマ進める）
export const OTHERS = [
	{ name: 'warp', width: 195, height: 236 }
];
export const assets = {};


//初期化
export async function init()
{
	img = await utils2.loadImage(path);

	// このマップのサイズをengine（カメラ）に教える
	engine.setCameraBounds(MAP_WIDTH, MAP_HEIGHT);


	//画像読み込み ループで一気に Image オブジェクトを作成
	for (const item of OTHERS)//方向
	{
		const path = ASSETSDIR + "/" + item.name + ".png";
		const key = item.name;
		try
		{
			//画像が無い場合ここでエラーでキーを作らないようにする
			const img = await utils2.loadImage(path);

			assets[key] = [];
			assets[key].img = img;
			assets[key].frameWidth = item.width;
			assets[key].frameHeight = item.height;
			assets[key].frameCount = img.width / item.width;
			assets[key].currentFrame = 0;
			assets[key].frameTimer = 0;



			assets[key].x = 3498 + (PLAYER_SPRITE_WIDTH / 2) - (item.width / 2);
			assets[key].y = 511 + (PLAYER_SPRITE_HEIGHT / 2) - (item.height / 2);
		}
		catch (e)
		{
			addLog("ERROR", "ファイル読み込みエラー：" + path + " " + e.message);
		}
	}
}

//画面更新
export function update(delta)
{
	// マップ描画　// engine.beginCameraTransform()で既にズーム・カメラ移動の変形がかかっている
	ctx.drawImage(img, 0, 0);


	const asset = assets["warp"];
	//addLog("info", "x:" + asset.x + " y:" + asset.y);

	//実際に経過した時間(delta)を加算する
	asset.frameTimer += delta;

	// 設定した時間（0.1秒）を超えたらコマを進める
	if (asset.frameTimer >= FRAME_DURATION)
	{
		// 余剰時間を保持してタイミングを滑らかに維持する
		asset.frameTimer %= FRAME_DURATION;

		// 最後のコマまで来たら最初のコマに戻る
		asset.currentFrame = (asset.currentFrame + 1) % asset.frameCount;
	}


	ctx.drawImage(
		asset.img,
		asset.currentFrame * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight,
		asset.x, asset.y, asset.frameWidth, asset.frameHeight
	);
}

