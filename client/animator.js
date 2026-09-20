import * as utils2 from './utils2.js';
//アニメ更新間隔
export const ANIME_FRAMES = {
	"idle_forside": [[0, 3], [1, 0.2], [2, 0.2], [3, 0.3], [4, 0.15]
		, [5, 0.15], [6, 0.15]
		, [5, 0.15], [4, 0.15]
		, [5, 0.15], [6, 0.15]
		, [5, 0.15], [4, 0.15]
		, [5, 0.15], [6, 0.15]
		, [5, 0.15], [4, 0.15]
		, [5, 0.15], [6, 0.15]
		, [5, 0.15], [4, 0.15]
		, [3, 0.3], [2, 0.2], [1, 0.2]
	],
	//forsideと違って3-4が同じで6が無し
	"idle_backside": [[0, 3], [1, 0.2], [2, 0.2], [3, 0.3], [3, 0.15]
		, [4, 0.15], [5, 0.15]
		, [4, 0.15], [3, 0.15]
		, [4, 0.15], [5, 0.15]
		, [4, 0.15], [3, 0.15]
		, [4, 0.15], [5, 0.15]
		, [4, 0.15], [3, 0.15]
		, [4, 0.15], [5, 0.15]
		, [4, 0.15], [3, 0.15]
		, [3, 0.3], [2, 0.2], [1, 0.2]
	],
};



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

		// 「何コマ目を、何秒表示するか」を { frame, duration } の配列（再生順そのもの）にまとめておく
		this.sequence = this.buildSequence(durations, defaultDuration);

		this.sequenceIndex = 0;	// 現在、sequenceの何番目（何ステップ目）を再生中か
		this.frameTimer = 0;		// 現在のステップを表示し始めてからの経過時間
	}

	// 画像ファイルを読み込んでSpriteAnimatorを作る（読み込みが終わるまで待つ必要があるのでstaticな非同期メソッドにしてある）
	static async load(path, frameWidth, frameHeight, durations = null, defaultDuration = 0.1)
	{
		const img = await utils2.loadImage(path);
		return new SpriteAnimator(img, frameWidth, frameHeight, durations, defaultDuration);
	}

	// durationsの指定方法（省略 / 秒数だけの配列 / ペアの配列）から、実際の再生順(sequence)を組み立てる
	buildSequence(durations, defaultDuration)
	{
		//③ペアの配列（[[コマ番号, 秒数], ...]）の場合：再生順そのものなので、そのまま使う
		if (Array.isArray(durations) && Array.isArray(durations[0]))
			return durations.map(([frame, duration]) => ({ frame, duration }));

		//②秒数だけの配列（[0.1, 0.1, ...]）の場合：0コマ目から順番に1回ずつ再生する
		if (Array.isArray(durations))
			return durations.map((duration, frame) => ({ frame, duration }));

		//①省略時：0コマ目からframeCount-1コマ目まで、順番に1回ずつdefaultDuration秒で再生する
		const sequence = [];
		for (let frame = 0; frame < this.frameCount; frame++)
			sequence.push({ frame, duration: defaultDuration });
		return sequence;
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

		// スプライトシートの中で、そのコマが何px目から始まるか
		const sx = frame * this.frameWidth;

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