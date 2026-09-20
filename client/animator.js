import * as utils2 from './utils2.js';

// アニメーション（スプライトのコマ送り）だけを担当するクラス。
// 「1枚の横長画像（スプライトシート）」と「1コマの表示時間」を持ち、
// 時間経過によってコマを進めたり、現在のコマを描画したりする処理をここにまとめる。
// Player側は「今どのコマか」を意識しなくてよくなる。
export class SpriteAnimator
{
	// img         : 読み込み済みのImageオブジェクト（横に並んだスプライトシート）
	// frameWidth  : 1コマの幅（px）
	// frameHeight : 1コマの高さ（px）
	// durations   : 各コマの表示時間（秒）を並べた配列。例：[0.1, 0.1, 0.3, 0.1]
	//               省略した場合は、defaultDurationを全コマ分並べたものを使う
	// defaultDuration : durations省略時に使う、1コマあたりの共通表示時間（秒）
	constructor(img, frameWidth, frameHeight, durations = null, defaultDuration = 0.1)
	{
		this.img = img;
		this.frameWidth = frameWidth;
		this.frameHeight = frameHeight;

		// 画像の横幅を1コマの幅で割って、コマ数を求める
		this.frameCount = Math.floor(img.width / frameWidth);

		// コマごとの表示時間を配列で保持する、個別指定が無ければ、defaultDurationを人数分（コマ数分）並べて埋める
		this.durations = durations ? durations : new Array(this.frameCount).fill(defaultDuration);

		this.currentFrame = 0;	// 現在表示中のコマ番号（0番目からスタート）
		this.frameTimer = 0;	// 現在のコマを表示し始めてからの経過時間
	}

	// 画像ファイルを読み込んでSpriteAnimatorを作る（読み込みが終わるまで待つ必要があるのでstaticな非同期メソッドにしてある）
	static async load(path, frameWidth, frameHeight, durations = null, defaultDuration = 0.1)
	{
		const img = await utils2.loadImage(path);
		return new SpriteAnimator(img, frameWidth, frameHeight, durations, defaultDuration);
	}

	// 指定したコマ（index）だけ表示時間を変更する（個別のdurationをあとから調整したいとき用）
	setFrameDuration(index, duration)
	{
		this.durations[index] = duration;
	}

	// 再生位置を先頭のコマに戻す（状態が切り替わった直後などに呼ぶ）
	reset()
	{
		this.currentFrame = 0;
		this.frameTimer = 0;
	}

	// 時間経過にあわせてコマを進める処理。毎フレーム呼び出す想定
	update(delta)
	{
		// 現在のコマに設定されている表示時間を取り出す
		const duration = this.durations[this.currentFrame];

		// 経過時間を積み上げていく
		this.frameTimer += delta;

		// 設定時間を超えたら次のコマへ進める
		if (this.frameTimer >= duration)
		{
			// コマごとに時間が異なるので「割った余り(%)」ではなく引き算で余剰時間を残す
			this.frameTimer -= duration;

			// 最後のコマまで来たら先頭のコマに戻る（0〜frameCount-1をループ）
			this.currentFrame = (this.currentFrame + 1) % this.frameCount;
		}
	}

	// 現在のコマをキャンバスに描画する
	// ctx  : 描画先のコンテキスト
	// dx,dy: 描画先（ワールド/画面）の左上座標
	// flip : trueなら左右反転して描画する
	draw(ctx, dx, dy, flip = false)
	{
		// スプライトシートの中で、現在のコマが何px目から始まるか
		const sx = this.currentFrame * this.frameWidth;

		if (flip)
		{
			// 反転して描く場合は、一旦座標系ごと左右反転させてから描画する
			ctx.save();
			ctx.scale(-1, 1);
			ctx.drawImage(
				this.img,
				sx, 0, this.frameWidth, this.frameHeight,
				-dx - this.frameWidth, dy, this.frameWidth, this.frameHeight
			);
			ctx.restore();
		}
		else
		{
			ctx.drawImage(
				this.img,
				sx, 0, this.frameWidth, this.frameHeight,
				dx, dy, this.frameWidth, this.frameHeight
			);
		}
	}
}