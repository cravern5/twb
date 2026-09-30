
/*　配列メモ
Int = 符号あり整数(マイナスも可)
Uint = 符号なし整数(0以上のみ。Uは unsigned)
Float = 小数
数字 = ビット数(8ビット = 1バイト)

//通常の配列
Array	普通のデータ、型が混ざる、長さが変わる

//TypeScriptのみ
ReadonlyArray

//TypedArray(型付き配列)の共通ルール

Int8Array			1バイト	-128 〜 127	小さな符号付き値
Uint8Array			1バイト	0 〜 255	バイナリデータ、ファイル、通信
Uint8ClampedArray	1バイト	0 〜 255(自動で丸める)	画像のピクセル(Canvas)
Int16Array			2バイト	-32,768 〜 32,767	音声データなど
Uint16Array			2バイト	0 〜 65,535	文字コード(UTF-16)など
Int32Array			4バイト	約 ±21億	汎用の整数
Uint32Array			4バイト	0 〜 約42.9億	ID、ハッシュ値
Float32Array		4バイト	小数(精度は約7桁)	3Dグラフィックス(WebGL)
Float64Array		8バイト	小数(精度は約15桁)	科学計算(普通のNumberと同じ精度)
BigInt64Array		8バイト	-2⁶³ 〜 2⁶³-1	巨大な符号付き整数
BigUint64Array		8バイト	0 〜 2⁶⁴-1	巨大な符号なし整数

t.map((n) => n * 2);   // Int16Array [10, 2, 8]
t.filter((n) => n > 1); // Int16Array [5, 4]
t.forEach((n) => console.log(n));
t.fill(0);             // 全部0にする
[10, 9, 1].sort();                 // [1, 10, 9] ← 通常の配列は文字列比較

const t = new Int16Array([5, 1, 4]);
console.log(t.length);             // 3  要素数
console.log(t.byteLength);         // 6  全体のバイト数(3個 × 2バイト)
console.log(Int16Array.BYTES_PER_ELEMENT); // 2  1要素あたりのバイト数

const src = new Uint8Array([1, 2, 3, 4]);
const view = src.subarray(1, 3); // 同じメモリを見る(コピーなし、速い)
const copy = src.slice(1, 3);    // 新しくコピーを作る

//同じメモリを別の型で見る(ArrayBuffer)
const buffer = new ArrayBuffer(4);// 生のメモリ領域(4バイト)を確保する
// 同じ領域を2通りの見方で扱う
const bytes = new Uint8Array(buffer);   // 1バイトずつ見る(4個)
const whole = new Uint32Array(buffer);  // 4バイトまとめて見る(1個)
whole[0] = 0x01020304;
console.log(bytes); // 数値が1バイトずつ分かれて見える(順序はCPU依存)


//漢字は「文字」なので、何の配列になるかはどの文字コードで保存するかで決まります。
文字コード	漢字1文字	20文字	使う型
UTF-8	3バイト(多くの漢字)	60バイト	Uint8Array
UTF-16	2バイト				40バイト	Uint16Array		(JSの文字列の内部形式)
UTF-32	4バイト				80バイト	Uint32Array	(コードポイント)

*/


const size = 4_000_000;
const arr = new Int32Array(size); // 連続したメモリ領域を持つ配列

// 順番にアクセス(キャッシュに乗りやすい)
console.time("順番アクセス");
let sum = 0;
for (let i = 0; i < size; i++)
{
	sum += arr[i];
}
console.timeEnd("順番アクセス");

// バラバラの順でアクセス(キャッシュに乗りにくい)
const idx = Array.from({ length: size }, (_, i) => i)
	.sort(() => Math.random() - 0.5); // 添字をシャッフル
console.time("ランダムアクセス");
sum = 0;
for (let i = 0; i < size; i++)
{
	sum += arr[idx[i]];
}
console.timeEnd("ランダムアクセス");