import { print, addLog } from '../shared/sub.js';

import * as socket from './ws_bin_client.js';
import * as utils2 from './utils2.js';
import * as input from './input.js';
import * as windows from './windows.js';
import * as engine from './engine.js';
import { canvas, ctx } from './engine.js';
import { MAP_WIDTH, MAP_HEIGHT, camera } from './world.js';
import * as world from './world.js';

//キャラクター
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

//チャット
const chatArea = document.getElementById("chatArea");
const chatInput = document.getElementById("chatInput");
const chatLog = document.getElementById("chatLog");
//バブル用の各種サイズ設定（調整・描画の両方で使うので関数の外に出しておく）
const BUBBLE_MAX_WIDTH = 197;	// ふきだしの最大の幅
const BUBBLE_MAX_HEIGHT = 73;	// ふきだしの最大の高さ
const BUBBLE_PADDING_X = 10;	// 文字の左右の余白
const BUBBLE_PADDING_Y = 6;	// 文字の上下の余白
const BUBBLE_LINE_HEIGHT = 20;	// 1行分の高さ（フォントサイズ14pxに行間を足した目安）
const BUBBLE_DURATION = 4;		// ふきだしを表示しておく秒数


//プレイヤー管理
export let player = null;
export let players = [];

export async function addPlayer(id, playerName, character)
{
	player = await new Player(0, playerName, character).init();
	players.push(player);

	return player;
}


//プレイヤークラス
export class Player
{
	constructor(id, playerName, character)
	{
		//プレイヤー情報
		this.id = id;
		this.playerName = playerName;

		//キャラクター
		this.character = character;
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

		socket.callbacks.onchat = this.onChat.bind(this);
		//this.socket.callbacks.onchat = onChat;
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
					this.assets[key] = [];
					this.assets[key].img = await utils2.loadImage(path);
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
		return this;
	}

	//足元座標
	getFootPosition(screenX, screenY)
	{
		return { x: screenX + SPRITE_WIDTH / 2 + 0, y: screenY + SPRITE_HEIGHT - 14.5 };
	}

	//ワールド座標取得
	getWorldPosition()
	{
		const x = this.position.x + SPRITE_WIDTH / 2;
		const y = this.position.y + SPRITE_HEIGHT / 2;
		return { x: x, y: y };
	}

	//移動しているかどうか（キーボード操作 or バーチャル十字キー or マウスの目的地移動）
	/*isMoving()
	{
		const key = input.keysPress;
		const keyMoving = key.w || key.a || key.s || key.d;
		const virtualMoving = (input.virtualMove.x !== 0 || input.virtualMove.y !== 0);
		return keyMoving || virtualMoving || moveTarget !== null;
	}*/

	//キーの移動量取得
	getMovement()
	{
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

		// バーチャル十字キー（スマホ）の入力があれば、それを使う
		if (input.virtualMove.x !== 0 || input.virtualMove.y !== 0)
		{
			// タッチ操作を優先する（マウスクリックでの目的地移動は中断する）
			this.moveTarget = null;

			return { x: input.virtualMove.x, y: input.virtualMove.y };
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
		}
	}

	//キャラ(状態、方向、反転)の設定
	updateState(move)
	{
		let changed = false;
		let s = this.state;
		let d = this.direction;
		let f = this.flip;

		//状態
		if (move.x !== 0 || move.y !== 0)
			s = this.isRunning ? "run" : "walk";
		else
			s = "idle";

		// 動いていない場合は、直前の向きをそのまま維持する
		if (move.x !== 0 || move.y !== 0)
		{
			// 移動ベクトルの向いている角度を求める（画面はyが下向きなので、0=右、90°=下、180°=左、-90°=上）
			const angle = Math.atan2(move.y, move.x);

			// 角度を45度(=PI/4)刻みに丸めて、8方向のうちどれに一番近いかを求める（0〜7の整数）
			const octant = Math.round(angle / (Math.PI / 4)) & 7;

			// 求めた8方向の番号を、実際のスプライトの向き(d)と反転(f)に変換する
			switch (octant)
			{
				case 0: d = 'side'; f = true; break;			// 右
				case 1: d = 'forside'; f = true; break;		// 右下（左下を反転）
				case 2: d = 'forward'; f = false; break;		// 下
				case 3: d = 'forside'; f = false; break;		// 左下
				case 4: d = 'side'; f = false; break;			// 左
				case 5: d = 'backside'; f = false; break;		// 左上
				case 6: d = 'backward'; f = false; break;		// 上
				case 7: d = 'backside'; f = true; break;		// 右上（左上を反転）
			}
		}

		changed = (s != this.state || d != this.direction || f != this.flip);

		this.state = s;
		this.direction = d;
		this.flip = f;

		return changed;
	}

	// クリックした場所を目的地として登録する関数(game.jsなどで呼び出し用)
	setMoveTarget(x, y)
	{
		this.moveTarget = { x, y };
	}

	//チャット受信
	onChat(text)
	{
		addLog("INFO", text);

		//表示するテキストの残り表示時間をセット
		this.bubbleTimer = BUBBLE_DURATION;
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
					engine.canvas.focus();//3Dキャンバスに戻る
				else
				{
					//ログに送られる文字列
					const sendText = playerName + " ： " + text;

					//バブル表示用テキストセット
					bubbleLines = this.adjustBubbleText(sendText);
					//改行を取り除いて1行のテキストにする（\r\nの場合も考慮）
					//const oneLineText = text.replace(/\r?\n/g, "");

					socket.sendChat(sendText);//サーバーへチャット
					//this.showBubble(text);//バブル表示
					chatInput.value = '';// 入力欄をクリア
					engine.canvas.focus();//3Dキャンバスに戻る
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

	//マウス移動
	mousedown(e)
	{
		// キャンバス上を左クリックしたら、その場所を目的地にして歩き出す
		if (input.mouseInfo.left && e.target === engine.canvas)
		{
			// 画面上のクリック位置(clientX/Y)にカメラのズレ(camera.x/y)を足して、マップ上の座標に変換する
			const worldX = e.clientX + world.camera.x;
			const worldY = e.clientY + world.camera.y;

			this.setMoveTarget(worldX, worldY);
		}
	}

	//画面更新
	update(delta)
	{
		//移動量はここで1回だけ計算し、updatePositionとupdateStateの両方に渡す、2回計算すると、その間にpositionが変わってしまい向きがズレるため
		const move = this.getMovement();

		//移動処理を追加
		this.updatePosition(delta, move);

		//状態変化
		if (this.updateState(move))
		{
			//状態変化したらフレームは最初に
			this.currentFrame = 0;
		}

		//addLog("direction:" + olddirection + "→" + direction + " state:" + oldstate + "→" + state);
		const stateKey = this.character + "_" + this.state + "_" + this.direction;
		const asset = this.assets[stateKey];
		if (!asset)
		{
			print("error", "指定されたステートイメージはありません(" + this.stateKey + ")")
			return;
		}

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

		//ワールド座標(position)からカメラ位置を引いて「画面上の描画位置」を求める、プレイヤーが動いてもカメラが追従して常に画面中央に見える
		const screenX = this.position.x - camera.x;
		const screenY = this.position.y - camera.y;

		// 描画前に一旦キャンバスをクリアする
		//ctx.clearRect(this.position.x, this.position.y, asset.frameWidth, asset.frameHeight);

		//足の位置
		const foot = this.getFootPosition(screenX, screenY);

		//影の描画
		this.drawShadow(foot);

		//キャラクター描画
		this.drawCharacter(asset, screenX, screenY);

		//吹き出し描画
		if (this.bubbleTimer > 0)
		{
			//ふきだしを表示中なら、残り時間を減らしていく
			this.bubbleTimer -= delta;

			//まだ時間が残っていれば、頭の少し上にふきだしを描画する
			if (this.bubbleTimer > 0)
			{
				//描画
				this.rawBubble(this.bubbleLines, screenX + SPRITE_WIDTH / 2, screenY - 5);
			}
		}
	}

	//影の描画
	drawShadow(foot)
	{
		//影の描画
		utils2.drawCircle(
			ctx, 'rgba(0, 0, 0, 0.6)', foot.x, foot.y,
			SPRITE_WIDTH * 0.25,//幅
			SPRITE_WIDTH * 0.1//高さ
		);
		//utils2.drawShadow(ctx, 'rgba(0, 0, 0, 0.5)', screenX + 5, screenY - 15, SPRITE_WIDTH - 10, SPRITE_HEIGHT);
	}

	//キャラクター描画
	drawCharacter(asset, x, y)
	{
		try
		{
			// スプライトシートから該当コマだけを切り出して描画する
			if (this.flip)
			{
				//描画状態（座標系の回転・拡大縮小・移動、透過度、塗りつぶし色など）をスタックに保存・復元するための命令
				ctx.save();
				ctx.scale(-1, 1);
				ctx.drawImage(
					asset.img,
					this.currentFrame * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight,
					-x - asset.frameWidth, y, asset.frameWidth, asset.frameHeight
				);
				ctx.restore();
			}
			else
			{
				ctx.drawImage(
					asset.img,
					this.currentFrame * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight,
					x, y, asset.frameWidth, asset.frameHeight
				);
			}
		}
		catch (e)
		{
			print("error", "キャラクター描画でエラーが発生しました " + e.message);
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
		let lines = wrapText(text, maxTextWidth);

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
	drawBubble(lines, x, y)
	{
		//adjustBubbleTextで既に設定してある
		//ctx.font = bubbleFont;

		// 実際に表示する行の中で、一番幅が広い行に合わせて背景の横幅を決める（最大幅は超えない）
		let widestLineWidth = 0;
		for (const line of lines)
			widestLineWidth = Math.max(widestLineWidth, ctx.measureText(line).width);

		const boxWidth = Math.min(BUBBLE_MAX_WIDTH, widestLineWidth + BUBBLE_PADDING_X * 2);
		const boxHeight = lines.length * BUBBLE_LINE_HEIGHT + BUBBLE_PADDING_Y * 2;

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
		for (let i = 0; i < lines.length; i++)
		{
			const lineY = boxY + BUBBLE_PADDING_Y + BUBBLE_LINE_HEIGHT * i + BUBBLE_LINE_HEIGHT / 2;
			ctx.fillText(lines[i], x, lineY);
		}
	}

}




