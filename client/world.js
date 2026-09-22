import { print, addLog } from '../shared/sub.js';

import * as utils2 from './utils2.js';
import { ctx } from './engine.js';
import * as engine from './engine.js';
import { SpriteAnimator } from './animator.js';
//import { player } from './player.js';
import { SPRITE_WIDTH as PLAYER_SPRITE_WIDTH, SPRITE_HEIGHT as PLAYER_SPRITE_HEIGHT } from './player.js'; //位置合わせ用

export const FRAME_DURATION = 0.07;					// アニメーションの更新間隔（秒単位：例 0.1秒ごとに1コマ進める）
export const MAPDIR = "/assets/map";
export const OBJECTDIR = "/assets/object";

// マップ一覧
export const maps =
{
	//カウル
	kaul:
	{
		//width: 6800,
		//height: 4500,
		spawnX: 2585,
		spawnX: 1956,
		img: null,

		//オブジェクト一覧
		objects:
		{
			warp0: { name: "warp", width: 246, height: 236, duration: 0.085, charaX: 3280, charaY: 341, x: null, y: null, animator: null },
			warp1: { name: "warp", width: 246, height: 236, duration: 0.085, charaX: 2787, charaY: 3920, x: null, y: null, animator: null }
		}
	}
}


//現在地情報
export let location = "kaul";
export let map = null;

//export const MAP_WIDTH = 6800;
//export const MAP_HEIGHT = 4500;
//export let path = '/assets/map/kaul.png';
//export let img = null;


//オブジェクト一覧(x,yは位置合わせ時の位置)

//初期化
export async function init()
{
	await changeLocation(location);
}

export async function changeLocation(newLocation)
{
	location = newLocation;

	// マップ読み込み
	map = maps[location];
	map.img = await utils2.loadImage(MAPDIR + "/" + location + ".png");

	//カメラの設定
	engine.setCameraBounds(map.img.width, map.img.height);


	//画像読み込み ループで一気に Image オブジェクトを作成
	for (const [key, obj] of Object.entries(map.objects))
	{
		const path = OBJECTDIR + "/" + obj.name + ".png";
		try
		{
			//画像読み込み＋アニメーション管理を、SpriteAnimatorにまとめて任せる（画像が無い場合ここでエラーになりキーは作られない）
			const animator = await SpriteAnimator.load(path, obj.width, obj.height, null, obj.duration);

			obj.animator = animator;
			obj.x = obj.charaX + (PLAYER_SPRITE_WIDTH / 2) - (obj.width / 2);
			obj.y = obj.charaY + (PLAYER_SPRITE_HEIGHT / 2) - (obj.height / 2);
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
	if (!map)
		return;

	// マップ描画　// engine.beginCameraTransform()で既にズーム・カメラ移動の変形がかかっている
	ctx.drawImage(map.img, 0, 0);

	//オブジェクト描画
	for (const [key, obj] of Object.entries(map.objects))
	{
		//addLog("info", "x:" + warp.x + " y:" + warp.y);

		//コマ送り（経過時間の加算～次のコマへ進める判定）はSpriteAnimator自身に任せる
		obj.animator.update(delta);

		//現在のコマを、指定した位置(x,y)に描画する
		obj.animator.draw(ctx, obj.x, obj.y);
	}
}