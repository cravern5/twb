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

//現在地情報
export let initialized = false;
export let location = "kaul";
export let map = null;
export let objects_back = null;
export let objects_front = null;

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
			//portal: { name: "portal", width: 320, height: 320, frameCount: 38, duration: 0.085, charaX: 2583, charaY: 1913, x: null, y: null, animator: null, position: "front" },
			portal: { name: "portal", width: 220, height: 250, frameCount: 38, duration: 0.085, charaX: 2583, charaY: 1913, x: null, y: null, animator: null, position: "front" },
			warp0: { name: "warp", width: 195, height: 225, duration: 0.085, charaX: 3280, charaY: 341, x: null, y: null, animator: null, position: "back" },
			warp1: { name: "warp", width: 195, height: 225, duration: 0.085, charaX: 2787, charaY: 3920, x: null, y: null, animator: null, position: "back" }
		}
	}
}

//初期化
export async function init()
{
	await changeLocation(location);
}

export async function changeLocation(newLocation)
{
	initialized = false;

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
			const animator = await SpriteAnimator.load(path, obj.width, obj.height, obj.frameCount, obj.duration, null);

			obj.animator = animator;
			obj.x = obj.charaX + (PLAYER_SPRITE_WIDTH / 2) - (obj.width / 2);
			obj.y = obj.charaY + (PLAYER_SPRITE_HEIGHT / 2) - (obj.height / 2);

			//obj.x = obj.charaX - (obj.width / 2);
			//obj.y = obj.charaY - (obj.height / 2);
		}
		catch (e)
		{
			addLog("ERROR", "ファイル読み込みエラー：" + path + " " + e.message);
		}
	}

	objects_back = Object.values(map.objects).filter((obj) => { return obj.position === "back"; });
	objects_front = Object.values(map.objects).filter((obj) => { return obj.position === "front"; });

	initialized = true;
}

//画面更新
export function update(delta)
{
	if (!map || !initialized)
		return;

	//オブジェクト描画
	for (const [key, obj] of Object.entries(map.objects))
	{
		//addLog("info", "x:" + warp.x + " y:" + warp.y);

		//コマ送り（経過時間の加算～次のコマへ進める判定）はSpriteAnimator自身に任せる
		obj.animator.update(delta);
	}
}

//描画
export function draw(background)
{
	if (!map || !initialized)
		return;

	// マップ描画　// engine.beginCameraTransform()で既にズーム・カメラ移動の変形がかかっている
	if (background)
		ctx.drawImage(map.img, 0, 0);

	const objects = background ? objects_back : objects_front;

	//オブジェクト描画
	for (const obj of objects)
	{
		//addLog("info", "x:" + warp.x + " y:" + warp.y);

		// カメラに映っていない（画面外の）オブジェクトは描画をスキップする
		if (!engine.isVisible(obj.x, obj.y, obj.width, obj.height))
			continue;

		//現在のコマを、指定した位置(x,y)に描画する
		obj.animator.draw(ctx, obj.x, obj.y);
	}
}