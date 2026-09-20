import { print, addLog } from '../shared/sub.js';

import * as utils2 from './utils2.js';
import { ctx } from './engine.js';
import * as engine from './engine.js';
import { SpriteAnimator } from './animator.js';

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

//オブジェクト一覧(x,yは位置合わせ時の位置)
export const objects = [
	{ name: 'warp', width: 195, height: 236, x: 3498, y: 511 },
];
export const assets = {};


//初期化
export async function init()
{
	// マップ
	img = await utils2.loadImage(path);
	engine.setCameraBounds(MAP_WIDTH, MAP_HEIGHT);


	//画像読み込み ループで一気に Image オブジェクトを作成
	for (const obj of objects)//方向
	{
		const path = ASSETSDIR + "/" + obj.name + ".png";
		const key = obj.name;
		try
		{
			//画像読み込み＋アニメーション管理を、SpriteAnimatorにまとめて任せる（画像が無い場合ここでエラーになりキーは作られない）
			const animator = await SpriteAnimator.load(path, obj.width, obj.height, null, FRAME_DURATION);

			assets[key] = {
				animator: animator,
				x: obj.x + (PLAYER_SPRITE_WIDTH / 2) - (obj.width / 2),
				y: obj.y + (PLAYER_SPRITE_HEIGHT / 2) - (obj.height / 2)
			};
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

	//コマ送り（経過時間の加算～次のコマへ進める判定）はSpriteAnimator自身に任せる
	asset.animator.update(delta);

	//現在のコマを、指定した位置(x,y)に描画する
	asset.animator.draw(ctx, asset.x, asset.y);
}