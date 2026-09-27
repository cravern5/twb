//ポート番号

//Renderのデフォルトポートは10000、Koyebも同様に自動割り当て
//Render・Koyebなどのホスティング先では、起動時に使うポート番号が
//環境変数 process.env.PORT で渡されることがある、ただしこのファイルはブラウザ側からも読み込まれ、
//ブラウザには process という変数が存在しないため、先に「process が使えるかどうか」を確認してから使う
export const PORT =
	(typeof process !== 'undefined' && process.env.PORT)
		? process.env.PORT
		: 5135;

export const NAME_MAX_CHARS = 20;
export const NAME_BYTE_LENGTH = NAME_MAX_CHARS * 3; // 漢字はUTF-8で1文字3byteなので3倍しておく

// 型ごとの固定バイト数（固定長の型だけをここに書く。可変長の fixedName/string は個別に計算する）
export const FIXED_SIZE =
{
	uint8: 1,
	uint16: 2,
	uint32: 4,
	float32: 4,
	stringName: 60.,
	stringChat: 100,
};

//通信のタイプ
export const PACKET_TYPE =
{
	CHAT: 1,	//チャット送信
	STATE: 2,	//状態を送る
	WELCOME: 3,	// サーバー→本人だけに送る「あなたのIDはこれです」通知
	JOIN: 4,	// サーバー→他の全員に送る「新しい人が入ってきました」通知
	LEAVE: 5	// サーバー→他の全員に送る「この人が抜けました」通知
};


// ここに新しいパケットタイプを追加するだけで、送受信できるフィールドが増える
// name  : プログラム内で使うフィールド名（decodePacketで取り出すときのキーになる）
// type  : 'uint8' | 'uint16' | 'uint32' | 'float32' | 'fixedName' | 'string'
// length: type が 'fixedName' のときだけ、バイト長を指定する
// ※ 'string' は可変長なので、必ずスキーマの一番最後の項目にすること
export const PACKET_SCHEMA =
{
	[PACKET_TYPE.WELCOME]:
		[
			{ name: 'playerId', type: 'uint16' },
		],
	[PACKET_TYPE.LEAVE]:
		[
			{ name: 'playerId', type: 'uint16' },
		],
	[PACKET_TYPE.JOIN]:
		[
			{ name: 'playerId', type: 'uint16' },
			{ name: 'characterIndex', type: 'uint16' },
			{ name: 'x', type: 'float32' },
			{ name: 'y', type: 'float32' },
			{ name: 'playerName', type: 'stringName' },
		],
	[PACKET_TYPE.STATE]:
		[
			{ name: 'playerId', type: 'uint16' },
			{ name: 'x', type: 'float32' },
			{ name: 'y', type: 'float32' },
			{ name: 'stateIndex', type: 'uint8' },
			{ name: 'directionIndex', type: 'uint8' },
			{ name: 'flip', type: 'uint8' },
		],
	[PACKET_TYPE.CHAT]:
		[
			{ name: 'playerId', type: 'uint16' },
			{ name: 'text', type: 'stringChat' },
		],
};

const schema = PACKET_SCHEMA[PACKET_TYPE.STATE];

encodePacket(PACKET_TYPE.JOIN, { playerId: 1, characterIndex: 0, x: 10, y: 20, playerName: "タロウ" });
debugger;

// スキーマとフィールドの値(オブジェクト)から、送信用のバイナリを組み立てる
// 例: encodePacket(PACKET_TYPE.JOIN, { playerId:1, characterIndex:0, x:10, y:20, playerName:"タロウ" })
export function encodePacket(packetType, fields)
{
	const schema = PACKET_SCHEMA[packetType];

	// まず全体のバイト数を計算する（可変長のstringだけ、先にバイト列へ変換しておく）
	let bodySize = 0;
	let textBytes = null;

	for (const field of schema)
	{
		if (field.type === 'fixedName')
			bodySize += field.length;
		else if (field.type === 'string')
		{
			textBytes = new TextEncoder().encode(fields[field.name] ?? '');
			bodySize += textBytes.length;
		}
		else
			bodySize += FIXED_SIZE[field.type];
	}

	// タイプ(1byte) + 中身(bodySize byte) の箱を用意する
	const packet = new Uint8Array(1 + bodySize);
	const view = new DataView(packet.buffer);

	view.setUint8(0, packetType);
	let offset = 1;

	// スキーマの順番通りに、1つずつ値を書き込んでいく
	for (const field of schema)
	{
		const value = fields[field.name];

		if (field.type === 'uint8')
		{
			view.setUint8(offset, value ?? 0);
			offset += 1;
		}
		else if (field.type === 'uint16')
		{
			view.setUint16(offset, value ?? 0, true); // trueはリトルエンディアン指定（受信側と合わせる）
			offset += 2;
		}
		else if (field.type === 'uint32')
		{
			view.setUint32(offset, value ?? 0, true);
			offset += 4;
		}
		else if (field.type === 'float32')
		{
			view.setFloat32(offset, value ?? NaN, true);
			offset += 4;
		}
		else if (field.type === 'fixedName')
		{
			packet.set(encodeFixedName(value ?? '', field.length), offset);
			offset += field.length;
		}
		else if (field.type === 'string')
		{
			packet.set(textBytes, offset);
			offset += textBytes.length;
		}
	}

	return packet;
}

// 受信したバイナリ(Uint8Array)を、スキーマに沿ってわかりやすいオブジェクトに変換する
// 例: decodePacket(PACKET_TYPE.JOIN, data) → { playerId:1, characterIndex:0, x:10, y:20, playerName:"タロウ" }
export function decodePacket(packetType, data)
{
	const schema = PACKET_SCHEMA[packetType];
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const result = {};
	let offset = 1; // 0byte目はタイプなので読み飛ばす

	for (const field of schema)
	{
		if (field.type === 'uint8')
		{
			result[field.name] = view.getUint8(offset);
			offset += 1;
		}
		else if (field.type === 'uint16')
		{
			result[field.name] = view.getUint16(offset, true);
			offset += 2;
		}
		else if (field.type === 'uint32')
		{
			result[field.name] = view.getUint32(offset, true);
			offset += 4;
		}
		else if (field.type === 'float32')
		{
			result[field.name] = view.getFloat32(offset, true);
			offset += 4;
		}
		else if (field.type === 'fixedName')
		{
			result[field.name] = decodeFixedName(data.subarray(offset, offset + field.length));
			offset += field.length;
		}
		else if (field.type === 'string')
		{
			// 可変長かつ必ず最後に置く前提なので、残り全部を文字列として読み取る
			result[field.name] = new TextDecoder().decode(data.subarray(offset));
		}
	}

	return result;
}

// 受信データの長さが、このパケットタイプに必要な最小バイト数を満たしているかを調べる
// （壊れたデータや、なりすましの不正なパケットを弾くための入り口チェックに使う）
export function getPacketMinLength(packetType)
{
	const schema = PACKET_SCHEMA[packetType];
	let size = 1; // タイプ分の1byte

	for (const field of schema)
	{
		if (field.type === 'fixedName')
			size += field.length;
		else if (field.type === 'string')
			size += 0; // 可変長なので最低0byteでもOKとする
		else
			size += FIXED_SIZE[field.type];
	}

	return size;
}


//キャラクター名を固定長のバイト列に変換する（余った部分は自動的に0埋めになる）
export function encodeFixedName(text, byteLength)
{
	/*
	// packetのオフセット3から直接NAME_BYTE_LENGTHバイトの書き込み枠（サブアレイ）を作成
		const nameTarget = packet.subarray(5, NAME_BYTE_LENGTH + 5);
		const encoder = new TextEncoder();
		// encodeIntoは target のサイズ（NAME_BYTE_LENGTH）を超えないよう、
		// 文字の途中で切れない最大のところまで自動で安全に書き込んでくれます
		encoder.encodeInto(playerName, nameTarget);
	*/

	const encoder = new TextEncoder();
	let bytes = encoder.encode(text);

	// 漢字や絵文字を文字の途中で切らないよう、1文字ずつ削りながら収まるまで縮める
	let chars = [...text];
	while (bytes.length > byteLength && chars.length > 0)
	{
		chars.pop();
		bytes = encoder.encode(chars.join(""));
	}

	// 固定長の箱を用意し、変換したバイト列だけコピーする（残りは自動的に0埋めになる）
	const fixed = new Uint8Array(byteLength);
	fixed.set(bytes);
	return fixed;
}

//固定長のバイト列から末尾の0埋め部分を取り除いて文字列に戻す
export function decodeFixedName(bytes)
{
	// 末尾に続く0x00（パディング）が終わる位置を探す
	let end = bytes.length;
	while (end > 0 && bytes[end - 1] === 0) end--;

	const decoder = new TextDecoder();
	return decoder.decode(bytes.subarray(0, end));
}


