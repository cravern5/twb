import { print, addLog } from '../shared/sub.js';

import * as socket from './ws_bin_client.js';
import * as utils2 from './utils2.js';
import * as input from './input.js';
import * as windows from './windows.js';
import * as engine from './engine.js';
import { canvas, ctx } from './engine.js';
import { MAP_WIDTH, MAP_HEIGHT, camera } from './world.js';
import * as world from './world.js';
//import * as game from './game.js';

//プレイヤー======================================
export let player = null;

export const SPRITE_WIDTH = 70;		//キャラ画像1コマの幅
export const SPRITE_HEIGHT = 95;	//キャラ画像1コマの高さ
export const ASSETSDIR = '/assets/player';	//キャラ画のディレクトリ
export const CHARACTERS = ['maximin', 'tichiel'];
export const DIRECTIONS = ['forward', 'forside', 'side', 'backside', 'backward'];
export const STATES = ["idle", "run", "sit", "walk"];
export const MOVE_SPEED = 150; 						// 1秒あたりの移動ピクセル数
export const MOVE_SPEED_X_RATIO = 1.66;				//横方向の体感速度を補正するための倍率、横長なほど横移動が遅く感じる
export const MOVE_TARGET_THRESHOLD = 4;				// 目的地にどれだけ近づいたら「到着」とみなすか（px）
export const FRAME_DURATION = 0.07;					// アニメーションの更新間隔（秒単位：例 0.1秒ごとに1コマ進める）
export const SEND_INTERVAL = 1 / 20;				// 座標送信は1秒間に最大20回まで（20Hz 0.05秒に1回)に制限する、　自キャラ(60fps 16.67ミリ秒)

//チャット
//const chatArea = document.getElementById("chatArea");
const chatInput = document.getElementById("chatInput");
//const chatLog = document.getElementById("chatLog");
//バブル用の各種サイズ設定（調整・描画の両方で使うので関数の外に出しておく）
export const BUBBLE_MAX_WIDTH = 197;	// ふきだしの最大の幅
export const BUBBLE_MAX_HEIGHT = 73;	// ふきだしの最大の高さ
export const BUBBLE_PADDING_X = 10;		// 文字の左右の余白
export const BUBBLE_PADDING_Y = 6;		// 文字の上下の余白
export const BUBBLE_LINE_HEIGHT = 20;	// 1行分の高さ（フォントサイズ14pxに行間を足した目安）
export const BUBBLE_DURATION = 4.5;		// ふきだしを表示しておく秒数

//左ステータス
const leftStatusList = document.querySelector('#leftStatusValueCol .leftStatusValue span');

export class Player
{
	constructor(id, characterName, playerName)
	{
		this.initialized = false;

		//プレイヤー情報
		this.id = id;
		this.playerName = playerName;

		//キャラクター
		this.character = characterName;
		this.assets = {};
		this.isSitting = false;						//立ち/座り
		this.isRunning = true; 						//走り/歩き
		this.state = "idle";						//状態
		this.direction = "forward";					//キャラの向き
		this.flip = false;							//false=左
		this.position = { x: 2585, y: 1956 };		//プレイヤー位置
		this.currentFrame = 0; 						// 何コマ目を表示しているか(0番目からスタート)
		this.frameTimer = 0;						// コマ切り替え用の経過時間カウンター
		this.moveTarget = null;						// マウスクリックで指定した「目的地」（ワールド座標）、null のときは目的地なし＝マウスでは移動していない状態

		this.sendTimer = 0;							// ポジションを前回送信してからの経過時間、SEND_INTERVALを超えたら送信可能

		this.lastReceiveTime = null;				// 前回STATEを受信した時刻（ミリ秒）。まだ1回も受信していなければnull
		this.lastReceiveInterval = 0;				// 前回受信からの間隔（ミリ秒）＝これが不規則だと表示もカクつく
		this.receiveCount = 0;						// 直近1秒間の受信回数のカウンター（毎秒0にリセットされる）
		this.receivePerSecond = 0;					// 直前の1秒間で実際に受信できた回数（表示用に確定した値）
		this.receiveCountTimer = 0;					// 1秒経過したかどうかを計るための経過時間カウンター

		//チャットバブル
		this.bubbleLines = null;		// 頭上に表示中のチャット内容
		this.bubbleTimer = 0;			// ふきだしが消えるまでの残り時間（秒）
		this.bubbleFont = "14px 'MS PGothic', 'Meiryo', sans-serif";	//バブルフォント
		this.bubbleColor = "#CEFFCE";								//バブル文字色
		this.bubbleBackcolor = "rgba(0, 0, 0, 0.6)";				//バブル背景色
		if (chatInput)
		{
			// "font-size" と "font-family" をつなげて、ctx.fontで使える形の文字列にしておく（毎フレーム計算すると無駄なので、最初に1回だけ作って使い回す）
			const chatFontStyle = getComputedStyle(chatInput);
			this.bubbleFont = chatFontStyle.fontSize && chatFontStyle.fontFamily ? (`${chatFontStyle.fontSize} ${chatFontStyle.fontFamily}`) : ("");
			this.bubbleColor = chatFontStyle.color;
		}

		//左ステータスフォント
		this.leftStatusListValueFont = "14px 'maruminya'";	//バブルフォント
		this.leftStatusListValueColor = "#ffffff";								//バブル文字色
		if (leftStatusList)
		{
			// "font-size" と "font-family" をつなげて、ctx.fontで使える形の文字列にしておく（毎フレーム計算すると無駄なので、最初に1回だけ作って使い回す）
			const leftStatusListStyle = getComputedStyle(leftStatusList);
			this.leftStatusListValueFont = leftStatusListStyle.fontSize && leftStatusListStyle.fontFamily ? (`${leftStatusListStyle.fontSize} ${leftStatusListStyle.fontFamily}`) : ("");
			this.leftStatusListValueColor = leftStatusListStyle.color;
		}

		//他プレイヤーが含まれるのでここでは書かない
		//this.socket.callbacks.onchat = onChat;
		//socket.callbacks.onchat = this.onChat.bind(this);
		//socket.callbacks.onmove = this.onMove.bind(this);
	}

	//初期化
	async init()
	{

		//画像読み込み ループで一気に Image オブジェクトを作成
		//for (const chara of CHARACTERS)//キャラ
		//{
		const chara = this.character;
		for (const stt of STATES)//状態
		{
			for (const dir of DIRECTIONS)//方向
			{
				const path = ASSETSDIR + "/" + chara + "/" + stt + "/" + dir + ".png";
				const key = chara + "_" + stt + "_" + dir;
				if (chara === "maximin" && stt === "idle" && dir === "forward")
				{
					let a = 1;
					a = 2;
				}
				try
				{
					//画像が無い場合ここでエラーでキーを作らないようにする
					const img = await utils2.loadImage(path);

					this.assets[key] = [];
					this.assets[key].img = img;
					this.assets[key].frameWidth = SPRITE_WIDTH;
					this.assets[key].frameHeight = SPRITE_HEIGHT;
					this.assets[key].frameCount = this.assets[key].img.width / this.assets[key].frameWidth;
				}
				catch (e)
				{
					addLog("ERROR", "プレイヤーファイル読み込みエラー：" + path + " " + e.message);
				}
			}
		}
		//}

		this.initialized = true;

		return this;
	}

	//足元座標
	getFootPosition(screenX, screenY)
	{
		return { x: screenX + (SPRITE_WIDTH / 2), y: screenY + (SPRITE_HEIGHT - 14.5) };
		//return { x: screenX + SPRITE_WIDTH / 2 + 0, y: screenY + SPRITE_HEIGHT - 14.5 };
	}

	//中央の座標取得
	getCenterPosition()
	{
		const x = this.position.x + SPRITE_WIDTH / 2;
		const y = this.position.y + SPRITE_HEIGHT / 2;
		return { x: x, y: y };
	}

	//ワールド座標(position)からカメラ位置を引いて「画面上の描画位置」を求める、プレイヤーが動いてもカメラが追従して常に画面中央に見える
	getWorldPosition()
	{
		const screenX = (this.position.x - camera.x);
		const screenY = (this.position.y - camera.y);

		return { x: screenX, y: screenY };
	}

	//現在の状態のアセットを取得
	getStateAsset()
	{
		const stateKey = this.character + "_" + this.state + "_" + this.direction;
		const asset = this.assets[stateKey];
		if (!asset)
		{
			print("error", "指定されたステートイメージはありません(" + this.stateKey + ")")
			return null;
		}

		return asset;
	}

	//画面座標→ワールド座標に変換して移動先をセットする（マウスクリック・タップの共通処理）
	setMoveTargetFromScreen(clientX, clientY)
	{
		// 画面座標 = (ワールド座標 - camera.x) * zoom の逆算
		const worldX = clientX / world.camera.zoom + world.camera.x;
		const worldY = clientY / world.camera.zoom + world.camera.y;

		this.moveTarget = { x: worldX, y: worldY };
	}

	//マウス移動
	mousedown(e)
	{
		// キャンバス上を左クリックしたら、その場所を目的地にして歩き出す
		if (input.mouseInfo.left && e.target === engine.canvas)
		{
			//addLog("info", "mousedown x:" + e.clientX + " y;" + e.clientY);
			this.setMoveTargetFromScreen(e.clientX, e.clientY);
		}

		//addLog("info", "moveTarget worldX(" + worldX.toFixed(1) + ") worldY(" + worldY.toFixed(1) + ")");
	}

	//キーの移動量取得
	getMovement()
	{
		//このプレイヤーが「自分自身」でなければ、キーボード・マウスの入力を反映しない
		//（他人のキャラは、通信で受け取った座標(onMove)だけで動かすべきで、自分のキー入力を混ぜてはいけない）
		if (this.id !== socket.myPlayerId)
			return { x: 0, y: 0 };

		// キーボード入力があれば、そちらを優先する（マウス移動は中断する）
		const key = input.keysPress;
		if (key.w || key.a || key.s || key.d)
		{
			// タッチ操作を優先する（マウスクリックでの目的地移動は中断する）
			this.moveTarget = null;

			let moveX = 0;
			let moveY = 0;

			// キー入力状態に応じて移動方向を設定
			if (key.w) moveY -= 1;
			if (key.s) moveY += 1;
			if (key.a) moveX -= 1;
			if (key.d) moveX += 1;

			// 斜め移動時に移動速度が速くならないよう正規化
			if (moveX !== 0 && moveY !== 0)
			{
				moveX *= Math.SQRT1_2; // 1 / sqrt(2)
				moveY *= Math.SQRT1_2;
			}

			return { x: moveX, y: moveY };
		}

		// 十字キー（スマホ）の入力があれば、それを使う
		if (input.touch1.isEnabled())
		{
			// タッチ操作を優先する（マウスクリックでの目的地移動は中断する）
			this.moveTarget = null;

			//addLog("info", "movement x:" + input.touch1.x + " y;" + input.touch1.y);

			return { x: input.touch1.powerX, y: input.touch1.powerY };
		}

		// マウスの目的地に向かって移動する
		if (this.moveTarget)
		{
			// スプライトの中央ではなく「足元（下端の中央）」を基準にする、クリックした場所に、見た目の足がぴったり来るようにするため
			const foot = this.getFootPosition(this.position.x, this.position.y);

			const dx = this.moveTarget.x - foot.x;
			const dy = this.moveTarget.y - foot.y;
			const dist = Math.hypot(dx, dy);

			// 十分近づいたら到着とみなし、目的地をクリアする
			if (dist < MOVE_TARGET_THRESHOLD)
			{
				this.moveTarget = null;
				return { x: 0, y: 0 };
			}

			// 目的地の方向を向いた「長さ1のベクトル」を返す
			return { x: dx / dist, y: dy / dist };
		}


		return { x: 0, y: 0 };
	}

	//位置移動
	updatePosition(delta, move)
	{
		let changed = false;
		if (move.x !== 0 || move.y !== 0)
		{
			if (this.moveTarget)
			{
				//マウス移動中は、x/yを別々に加速するのではなく
				// 「進む向き」に応じた1つの速度を、x・yどちらにも同じ倍率でかける
				// （move.xが1に近い＝横方向に近いほど、速度がMOVE_SPEED_X_RATIO倍に近づく）
				// こうすることで実際に進む向きが必ずmove.x, move.yと一致し、
				// 目的地付近で急に向きが変わらなくなる
				const speed = MOVE_SPEED * (1 + Math.abs(move.x) * (MOVE_SPEED_X_RATIO - 1));

				this.position.x += move.x * speed * delta;
				this.position.y += move.y * speed * delta;
			}
			else
			{
				// キーボード・バーチャル十字キーの場合は、これまで通り横方向にだけ比率を掛ける
				this.position.x += move.x * MOVE_SPEED * MOVE_SPEED_X_RATIO * delta;
				this.position.y += move.y * MOVE_SPEED * delta;
			}

			// 画面(canvas)の外ではなく、マップ全体(MAP_WIDTH/MAP_HEIGHT)の外に出ないよう制限する
			this.position.x = Math.max(0, Math.min(MAP_WIDTH - SPRITE_WIDTH, this.position.x));
			this.position.y = Math.max(0, Math.min(MAP_HEIGHT - SPRITE_HEIGHT, this.position.y));

			changed = true;
		}

		return changed;
	}

	//キャラ(状態、方向、反転)の設定
	updateState(move)
	{
		let changed = false;
		let s = this.state;
		let d = this.direction;
		let f = this.flip;


		// 動いていない場合は、直前の向きをそのまま維持する
		if (move.x === 0 && move.y === 0)
			s = "idle";
		else
		{
			s = this.isRunning ? "run" : "walk";

			// 移動ベクトルの向いている角度を求める（画面はyが下向きなので、0=右、90°=下、180°=左、-90°=上）
			const angle = Math.atan2(move.y, move.x);

			// 角度を45度(=PI/4)刻みに丸めて、8方向のうちどれに一番近いかを求める（0〜7の整数）
			const octant = Math.round(angle / (Math.PI / 4)) & 7;

			// 求めた8方向の番号を、実際のスプライトの向き(d)と反転(f)に変換する
			switch (octant)
			{
				case 0: d = 'side'; f = true; break;			// 右
				case 1: d = 'forside'; f = true; break;			// 右下（左下を反転）
				case 2: d = 'forward'; f = false; break;		// 下
				case 3: d = 'forside'; f = false; break;		// 左下
				case 4: d = 'side'; f = false; break;			// 左
				case 5: d = 'backside'; f = false; break;		// 左上
				case 6: d = 'backward'; f = false; break;		// 上
				case 7: d = 'backside'; f = true; break;		// 右上（左上を反転）
			}
		}

		if (s != this.state || d != this.direction || f != this.flip)
			changed = true;

		this.state = s;
		this.direction = d;
		this.flip = f;

		return changed;
	}

	//再計算(位置・状態)　(自身の場合)deltaだけ、(他ユーザーの場合)delta以外直接入力
	recalc({ delta, x, y, state, direction, flip })
	{
		let position_changed = false;
		let state_changed = false;

		//状態を更新して送信(自分自身の場合)
		if (this.id === socket.myPlayerId)
		{
			//移動量はここで1回だけ計算し、updatePositionとupdateStateの両方に渡す、2回計算すると、その間にpositionが変わってしまい向きがズレるため
			const move = this.getMovement();

			//addLog("info", "movement x:" + move.x + " y;" + move.y);

			//移動処理を追加
			position_changed = this.updatePosition(delta, move);

			//状態変化
			state_changed = this.updateState(move);

			//if (state_changed)
			//	this.currentFrame = 0;	//状態変化したらフレームは最初に

			// 前回送信からの経過時間を積算しておく
			this.sendTimer += delta;

			//状態変化（止まる/歩く/走る切替など）は遅らせず即送信、
			//位置だけの更新はsendIntervalごとに間引いて送信（負荷軽減）
			if (state_changed || (position_changed && this.sendTimer >= SEND_INTERVAL))
			{
				this.sendTimer = 0;	// 送信したのでタイマーをリセット
				socket.sendState(this.position.x, this.position.y, this.state, this.direction, this.flip);
			}
		}
		else
		{
			if (this.position.x !== x || this.position.y !== y)
				position_changed = true;

			//状態更新
			this.position.x = x;
			this.position.y = y;

			//状態か向きが変わった瞬間だけ、アニメーションのコマ数を最初に戻す
			if (this.state !== state || this.direction !== direction || this.flip != flip)
				state_changed = true;
			//this.currentFrame = 0;

			this.state = state;
			this.direction = direction;
			this.flip = flip;
		}

		//状態変化したらフレームは最初に
		if (state_changed)
			this.currentFrame = 0;

		return state_changed;
	}

	//画面更新
	update(delta)
	{
		if (!this.initialized)
			return;

		//1秒ごとにupdate回数を集計する(デバッグ用)
		this.receiveCountTimer += delta;					// 経過時間を積算
		if (this.receiveCountTimer >= 1)
		{
			this.receivePerSecond = this.receiveCount;		// 直近1秒間の受信回数を「表示用の値」として確定
			this.receiveCount = 0;							// カウンターを0に戻して次の1秒を数え直す
			this.receiveCountTimer %= 1;					// 1秒を超えた余り時間は次に繰り越す（ずれ防止）
		}

		//再計算(位置・状態)
		//if (this.id === socket.myPlayerId)
		//{
		//	if (this.recalc({ delta }))
		//		this.currentFrame = 0;
		//}

		//ステートアセット
		const asset = this.getStateAsset();
		if (!asset)
			return;

		//実際に経過した時間(delta)を加算する
		this.frameTimer += delta;

		// 設定した時間（0.1秒）を超えたらコマを進める
		if (this.frameTimer >= FRAME_DURATION)
		{
			// 余剰時間を保持してタイミングを滑らかに維持する
			this.frameTimer %= FRAME_DURATION;

			// 最後のコマまで来たら最初のコマに戻る
			this.currentFrame = (this.currentFrame + 1) % asset.frameCount;
		}

		//ふきだしを表示中なら、残り時間を減らしていく
		if (this.bubbleTimer > 0)
			this.bubbleTimer -= delta;
		else
			this.bubbleLines = null;
	}

	drawCharacter()
	{
		if (!this.initialized)
			return;

		const asset = this.getStateAsset();
		if (!asset)
			return;

		//画像を滑らかに拡大するかどうか css image-rendering: pixelatedと併用可能
		ctx.imageSmoothingEnabled = false;

		//ワールド座標(position)からカメラ位置を引いて「画面上の描画位置」を求める、プレイヤーが動いてもカメラが追従して常に画面中央に見える
		const screen = this.getWorldPosition();

		// ズームすると見た目のサイズも変わるので、幅・高さにも同じ倍率を掛けておく
		const drawWidth = asset.frameWidth * camera.zoom;
		const drawHeight = asset.frameHeight * camera.zoom;

		//足の位置
		const foot = this.getFootPosition(screen.x, screen.y);

		//影の描画
		utils2.drawCircle(
			ctx, 'rgba(0, 0, 0, 0.6)', foot.x * camera.zoom, foot.y * camera.zoom,
			SPRITE_WIDTH * 0.25 * camera.zoom,//幅　※ズームに合わせて影の大きさも変える
			SPRITE_WIDTH * 0.1 * camera.zoom//高さ
		);

		//キャラクター描画 スプライトシートから該当コマだけを切り出して描画する
		if (this.flip)
		{
			//描画状態（座標系の回転・拡大縮小・移動、透過度、塗りつぶし色など）をスタックに保存・復元するための命令
			ctx.save();
			ctx.scale(-1, 1);
			ctx.drawImage(
				asset.img,
				this.currentFrame * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight,
				-screen.x * camera.zoom - drawWidth, screen.y * camera.zoom, drawWidth, drawHeight
			);
			ctx.restore();
		}
		else
		{
			ctx.drawImage(
				asset.img,
				this.currentFrame * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight,
				screen.x * camera.zoom, screen.y * camera.zoom, drawWidth, drawHeight
			);
		}

		//this.drawHPText("190/190");
	}

	//チャット送信
	SendChat(e)
	{
		if (e.key === 'Enter')
		{
			const text = chatInput.value.trim();

			//サーバー未接続
			if (!socket.connected)
			{
				addLog("ERROR", "サーバーに接続されていません")
			}
			//チャットウィンドウ非表示中
			if (!windows.chatWindow.isVisible())
			{
				windows.chatWindow.restore();
				chatInput.focus();
			}
			//チャットバーにフォーカスある
			else if (document.activeElement === chatInput)
			{
				//テキスト入力
				if (text === '')
					engine.canvas.focus();//キャンバスに戻る
				else if (text.toUpperCase() === '/SHOWFPS')
				{
					windows.debugInfo.show(-1);
					chatInput.value = '';// 入力欄をクリア
					engine.canvas.focus();//キャンバスに戻る
				}
				else
				{
					//ログに送られる文字列
					const sendText = this.playerName + " ： " + text;

					//改行を取り除いて1行のテキストにする（\r\nの場合も考慮）
					//const oneLineText = text.replace(/\r?\n/g, "");

					//サーバーへチャット
					socket.sendChat(sendText);

					chatInput.value = '';// 入力欄をクリア
					engine.canvas.focus();//キャンバスに戻る
				}
			}
			//チャットバーにフォーカス
			else
				chatInput.focus();

			return true;
		}
		else//Enter以外
		{
			//チャットバーにフォーカスがある状態でのキー入力
			return document.activeElement === chatInput;
		}
	}

	//テキストを、指定した幅(maxWidth)に収まるように1行ずつ分割する
	wrapText(text, maxWidth)
	{
		const lines = [];		// 完成した行を入れていく配列
		let currentLine = "";	// 今組み立て中の行

		//1文字ずつ確認しながら、幅に収まる分だけ行を区切っていく
		for (const char of text)
		{
			const testLine = currentLine + char;	// 1文字足してみたときの文字列

			//1文字足すと幅をオーバーする場合は、そこで行を区切る
			//（currentLineが空文字の場合は、1文字も入らないバグを防ぐためオーバーしても続行する）
			if (ctx.measureText(testLine).width > maxWidth && currentLine !== "")
			{
				lines.push(currentLine);	// 今の行を確定
				currentLine = char;			// 新しい行を、はみ出した1文字から開始
			}
			else
			{
				currentLine = testLine;
			}
		}

		//最後まで作っていた行が残っていれば、それも追加する
		if (currentLine !== "")
			lines.push(currentLine);

		return lines;

	}

	//バブルの文字調整（改行・行数オーバー時の省略処理だけを行う）
	adjustBubbleText(text)
	{

		//フォントを先に設定しておく（measureTextの結果はフォント設定に依存するため）
		ctx.font = this.bubbleFont;

		// 実際に文字を置ける横幅・最大行数を、余白を引いて計算する
		const maxTextWidth = BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2;
		const maxLines = Math.floor((BUBBLE_MAX_HEIGHT - BUBBLE_PADDING_Y * 2) / BUBBLE_LINE_HEIGHT);

		// 幅に収まるように、テキストを複数行に分割する
		let lines = this.wrapText(text, maxTextWidth);

		// 表示できる行数をオーバーしていたら、最後の行を省略して"..."を付ける
		if (lines.length > maxLines)
		{
			// 表示できる行数分だけ残す（はみ出した分は切り捨て）
			lines = lines.slice(0, maxLines);

			// 最後の行を、"..."を付けても幅に収まるまで、後ろから1文字ずつ削る
			let lastLine = lines[maxLines - 1];
			while (ctx.measureText(lastLine + "...").width > maxTextWidth && lastLine.length > 0)
				lastLine = lastLine.slice(0, -1);

			lines[maxLines - 1] = lastLine + "...";
		}

		return lines;

	}

	//バブル描画（文字の調整は行わず、渡された結果を使って描くだけ）
	drawBubble()
	{
		if (!this.bubbleLines)
			return;

		//ワールド座標(position)からカメラ位置を引いて「画面上の描画位置」を求める、プレイヤーが動いてもカメラが追従して常に画面中央に見える
		const screen = this.getWorldPosition();
		const x = (screen.x + SPRITE_WIDTH / 2) * camera.zoom;
		const y = (screen.y - 5) * camera.zoom;

		//adjustBubbleTextで既に設定してある
		//ctx.font = bubbleFont;

		// 実際に表示する行の中で、一番幅が広い行に合わせて背景の横幅を決める（最大幅は超えない）
		let widestLineWidth = 0;
		for (const line of this.bubbleLines)
			widestLineWidth = Math.max(widestLineWidth, ctx.measureText(line).width);

		const boxWidth = Math.min(BUBBLE_MAX_WIDTH, widestLineWidth + BUBBLE_PADDING_X * 2);
		const boxHeight = this.bubbleLines.length * BUBBLE_LINE_HEIGHT + BUBBLE_PADDING_Y * 2;

		// xを中心にして描く// yを縦方向の中心にして描く
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		// 四角の左上座標（xを中心にしたいので、幅の半分だけ左にずらす）
		const boxX = x - boxWidth / 2;
		const boxY = y - boxHeight;

		// 薄い黒背景の四角を描画
		ctx.fillStyle = this.bubbleBackcolor;
		ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

		// 文字を1行ずつ描画する（各行が縦方向にも中央に来るように位置を計算）
		ctx.fillStyle = this.bubbleColor;
		for (let i = 0; i < this.bubbleLines.length; i++)
		{
			const lineY = boxY + BUBBLE_PADDING_Y + BUBBLE_LINE_HEIGHT * i + BUBBLE_LINE_HEIGHT / 2;
			ctx.fillText(this.bubbleLines[i], x, lineY);
		}

	}

	//HPバー描画　per=hp / maxを入れる
	drawHP(per, startx = 30, starty = 30)
	{
		per = per * 10;
		for (let i = 0; i < 10 && i < per; i++)
		{
			sub.drawPixelLine(ctx, startx + 0 + i * 4, starty, startx + 10 + i * 4, starty + 10, '#000418');
			sub.drawPixelLine(ctx, startx + 1 + i * 4, starty, startx + 11 + i * 4, starty + 10, '#E75D21');
			sub.drawPixelLine(ctx, startx + 2 + i * 4, starty, startx + 12 + i * 4, starty + 10, '#E75D21');
			sub.drawPixelLine(ctx, startx + 3 + i * 4, starty, startx + 13 + i * 4, starty + 10, '#E75D21');
		}
	}

	drawHPText(text)
	{
		// canvas要素を取得
		const hpCanvas = document.getElementById("statusHP");

		// hpCanvas自身の描画用コンテキストを取得する
		const hpCtx = hpCanvas.getContext("2d");

		//文字描画
		utils2.drawText({
			canvas: hpCanvas, ctx: hpCtx,
			text, x: 0, y: 20, width: 100, height: 30,
			color: '#FFFFFF', font: "14px maruminya",
			outline: { color: '#000000', x: 1, y: 1 },
			letterSpacing: 1
		});

		//アンチエイリアスを手動で除去する後処理
		utils2.removeAntiAliasing({ ctx: hpCtx, width: hpCanvas.width, height: hpCanvas.height });
	}

}







//プレイヤー管理================================
export let players = [];

//IDからプレイヤーを検索する（見つからなければundefined）
export function getPlayerById(id)
{
	return players.find((p) => p.id === id);
}
//プレイヤーの追加
export async function addPlayer(id, characterName, playerName)
{
	const player = new Player(id, characterName, playerName)

	//※本来はinit前に書いたほうが良い
	//画像読み込み前にSTATEパケットが届くと、「存在しないプレイヤー」扱いされる
	players.push(player);

	//画像の読み込みが終わるまで待つ（描画に使うだけなので、後からで問題ない）
	await player.init();

	return player;
}
//IDを指定してプレイヤーをplayers配列から取り除く
export function removePlayer(id)
{
	// findIndexで「配列の何番目にいるか」を調べる（見つからなければ-1）
	const index = players.findIndex((p) => p.id === id);

	if (index !== -1)
		players.splice(index, 1); // 見つかった位置から1個だけ取り除く
}
//自身のログイン
export async function onWelcome(id)
{
	//データ読み込み
	let characterName = localStorage.getItem('characterName');
	let playerName = localStorage.getItem('playerName');

	//デフォルト指定(直接game.htmlにアクセスされるのを許容)
	if (!characterName)
		characterName = CHARACTERS[0];
	if (!playerName)
		playerName = "名無し";

	let characterIndex = CHARACTERS.indexOf(characterName);

	//JOINでキャラ情報を送る
	socket.sendJoin(characterIndex, playerName);

	//JOINを受信して初めてキャラ追加する
	//player = await addPlayer(id, playerName, character);
}
// 他プレイヤーが新しく入ってきたときの処理
export async function onJoin(joinedId, characterIndex, playerName)
{
	let joiner = null;
	// 念のため、既に同じIDが存在していないか確認してから追加する
	if (!getPlayerById(joinedId))
	{
		joiner = await addPlayer(joinedId, CHARACTERS[characterIndex], playerName);

		//自分自身
		if (joinedId == socket.myPlayerId)
			player = joiner;
	}
}
// 他プレイヤーが抜けたときの処理
export function onLeave(leftId)
{
	removePlayer(leftId);
}
//他プレイヤーのチャット受信
export function onChat(id, text)
{
	const player = getPlayerById(id);
	if (!player)
	{
		addLog("WARNING", "存在しないプレイヤーからのチャットです（ID: " + id + "）");
		return;
	}

	addLog("INFO", text);

	//表示するテキストの残り表示時間をセット
	player.bubbleTimer = BUBBLE_DURATION;
	player.bubbleLines = player.adjustBubbleText(text);
}
//状態受信
export function onState(id, x, y, stateIndex, directionIndex, flip)
{
	//自分自身の状態データは無視する（ローカルの計算結果の方が新しいため）
	if (id === socket.myPlayerId)
		return;

	const player = getPlayerById(id);
	if (!player)
	{
		addLog("WARNING", "存在しないプレイヤーからのSTATE受信データです（ID: " + id + "）");
		return;
	}

	//onStateの受信間隔計測(デバッグ用)
	const now = performance.now();// 現在時刻をミリ秒の高精度な値で取得

	// 前回受信からの経過時間
	if (player.lastReceiveTime !== null)
		player.lastReceiveInterval = now - player.lastReceiveTime;
	player.lastReceiveTime = now;

	// 1秒間の受信回数カウントに+1
	player.receiveCount++;

	const state = STATES[stateIndex] || STATES[0];
	const direction = DIRECTIONS[directionIndex] || DIRECTIONS[0];

	//再計算
	player.recalc({ x, y, state, direction, flip });
}

//プレイヤー一覧をYSortしたものを出力
export function playerYSort()
{
	//足元のY座標が小さい（奥）順に並べ替える
	//→ Y座標が大きい（画面の下＝手前）キャラを後から重ねて描くことで、自然な前後関係（Y-sort）になる
	const sortedPlayers = [...players].sort((a, b) =>
	{
		const footA = a.getFootPosition(a.position.x, a.position.y);
		const footB = b.getFootPosition(b.position.x, b.position.y);
		return footA.y - footB.y;
	});
	return sortedPlayers;
}

//プレイヤー全更新
export function updateAll(delta)
{
	//自分自身の再計算
	if (player)
		player.recalc({ delta });

	//足元のY座標が小さい（奥）順に並べ替える
	const sortedPlayers = playerYSort();

	//プレイヤーの位置・状態だけ先に更新する　※全てのフレームを更新
	players.forEach((p) => { p.update(delta); });

	//ソート済みの順番で描画する
	sortedPlayers.forEach((p) => { p.drawCharacter(); });
	sortedPlayers.forEach((p) => { p.drawBubble(); });
}