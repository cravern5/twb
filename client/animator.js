import * as utils2 from './utils2.js';
// アニメーション（スプライトのコマ送り）だけを担当するクラス。
// 「1枚の横長画像（スプライトシート）」と「1コマの表示時間」を持ち、
// 時間経過によってコマを進めたり、現在のコマを描画したりする処理をここにまとめる。
// Player側は「今どのコマか」を意識しなくてよくなる。
export class SpriteAnimator
{
	// frameWidth  : 1コマの幅（px）
	// frameHeight : 1コマの高さ（px）
	// durations   : 各コマの表示時間（秒）を並べた配列。例：[0.1, 0.1, 0.3, 0.1]
	//               省略した場合は、defaultDurationを全コマ分並べたものを使う
	// defaultDuration : durations省略時に使う、1コマあたりの共通表示時間（秒）
	constructor({ frameWidth, frameHeight, durations = null })
	{
		this.initialized = false;
		this.path = null;
		this.img = null;
		this.frameWidth = frameWidth;
		this.frameHeight = frameHeight;
		this.durations = durations;
		//this.defaultDuration = defaultDuration;
		this.sequenceIndex = 0;	// 現在、sequenceの何番目（何ステップ目）を再生中か
		this.frameTimer = 0;		// 現在のステップを表示し始めてからの経過時間
	}

	// 画像ファイルを読み込み
	async load({ path, frameCount = null, bitmap = false })
	{
		this.initialized = false;
		this.path = path;

		//画像読み込み
		this.img = await utils2.loadImage(path, bitmap);

		//1行に何コマ並んでいるか（画像の横幅から逆算する）
		this.cols = Math.floor(this.img.width / this.frameWidth);

		// frameCountが指定されていればそれを使う（＝空白コマを除いた本当のコマ数）
		// 指定が無ければ、今まで通り画像サイズいっぱいのマス目数として計算する
		this.frameCount = frameCount ?? (this.cols * Math.floor(this.img.height / this.frameHeight));

		// 「何コマ目を、何秒表示するか」を { frame, duration } の配列（再生順そのもの）にまとめておく
		this.sequence = this.buildSequence();

		this.initialized = true;
		return this;
	}

	// durationsの指定方法（省略 / 秒数だけの配列 / ペアの配列）から、実際の再生順(sequence)を組み立てる
	buildSequence()
	{
		let defaultDuration = null;
		let durations = this.durations;

		//durationsにオブジェクトが指定された場合
		if (typeof this.durations === "object" && !Array.isArray(this.durations))
		{
			durations = this.durations.durations;
			defaultDuration = this.durations.defaultDuration;
		}

		//ペアの配列（[[コマ番号, 秒数], ...]）の場合：再生順そのものなので、そのまま使う
		if (Array.isArray(durations) && Array.isArray(durations[0]))
			return durations.map(([frame, duration]) => ({ frame, duration: duration ?? defaultDuration }));
		//秒数だけの配列（[0.1, 0.1, ...]）の場合：0コマ目から順番に1回ずつ再生する
		else if (Array.isArray(durations))
			return durations.map((duration, frame) => ({ frame, duration: duration ?? defaultDuration }));
		else
		{
			const sequence = [];
			//①省略時：0コマ目からframeCount-1コマ目まで、順番に1回ずつdefaultDuration秒で再生する
			for (let frame = 0; frame < this.frameCount; frame++)
				sequence.push({ frame, duration: durations });
			return sequence;

		}
	}

	// 指定したコマ（index）だけ表示時間を変更する（個別のdurationをあとから調整したいとき用）
	setFrameDuration(index, duration)
	{
		this.durations[index] = duration;
	}

	// 再生位置を先頭のコマに戻す（状態が切り替わった直後などに呼ぶ）
	reset()
	{
		this.sequenceIndex = 0;
		this.frameTimer = 0;
	}

	// 時間経過にあわせてコマを進める処理。毎フレーム呼び出す想定
	update(delta)
	{
		// 現在再生中のステップ（{frame, duration}）を取り出す
		const step = this.sequence[this.sequenceIndex];

		// 経過時間を積み上げていく
		this.frameTimer += delta;

		// 設定時間を超えたら次のステップへ進める
		if (this.frameTimer >= step.duration)
		{
			// ステップごとに時間が異なるので「割った余り(%)」ではなく引き算で余剰時間を残す
			this.frameTimer -= step.duration;

			// sequenceの最後まで来たら先頭に戻る（＝アニメーション全体をもう一度最初から再生する）
			this.sequenceIndex = (this.sequenceIndex + 1) % this.sequence.length;
		}
	}

	// 現在のコマをキャンバスに描画する
	// ctx  : 描画先のコンテキスト
	// dx,dy: 描画先（ワールド/画面）の左上座標
	// flip : trueなら左右反転して描画する
	draw(ctx, dx, dy, flip = false)
	{
		// 現在のステップから、スプライトシートの何コマ目を描くかを取り出す
		const frame = this.sequence[this.sequenceIndex].frame;

		// コマ番号を「何列目か（col）」「何行目か（row）」に変換する
		const col = frame % this.cols;
		const row = Math.floor(frame / this.cols);

		// 列・行から、実際に切り出す画像内の座標(sx, sy)を求める
		const sx = col * this.frameWidth;
		const sy = row * this.frameHeight;

		if (flip)
		{
			// 反転して描く場合は、一旦座標系ごと左右反転させてから描画する
			ctx.save();
			ctx.scale(-1, 1);
			ctx.drawImage(
				this.img,
				sx, sy, this.frameWidth, this.frameHeight,
				-dx - this.frameWidth, dy, this.frameWidth, this.frameHeight
			);
			ctx.restore();
		}
		else
		{
			ctx.drawImage(
				this.img,
				sx, sy, this.frameWidth, this.frameHeight,
				dx, dy, this.frameWidth, this.frameHeight
			);
		}
	}
}