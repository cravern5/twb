// client.js
import { PACKET_TYPE, PORT } from '/shared/config.js';
import { addLog } from '../shared/sub.js';
//クライアントwsはnode標準搭載

import * as Player from './player.js';
import * as game from './game.js';

let ws = null;
export let connected = false;
export let myPlayerId = null;

// 複数のコールバックを保管する箱（初期状態は空っぽ）
//export let onchat = null;  //これだと外から書き換え不可
export const callbacks =
{
	onchat: null,
	onstate: null,
	onwelcome: null, //本人が入ったとき呼ばれる
	onjoin: null,	// 他プレイヤーが入ってきたときに呼ばれる
	onleave: null,	// 他プレイヤーが抜けたときに呼ばれる
};

//WebSocketサーバーに接続し、各種イベントのコールバックを登録する
export function init()
{
	//本番（https配信のCloudflare Pages）では、暗号化された wss:// を使う必要がある
	//自分のパソコンで動かして試す時（http）は、今まで通り ws:// でよい
	const isSecure = (location.protocol === 'https:');
	const protocol = isSecure ? 'wss' : 'ws';

	//クライアントとサーバーが別ドメインになるので、本番用のURLに書き換えてください
	//const host = isSecure ? "あなたのアプリ名-組織名-xxxx.koyeb.app" : `${window.location.hostname}:${PORT}`;
	const host = window.location.host;

	ws = new WebSocket(`${protocol}://${host}`);

	// これをつけることで、サーバーから届くバイナリを正しく受け取れるようになります
	ws.binaryType = 'arraybuffer';

	// サーバーからのチャット・移動データを受け取る窓口を、モジュール読み込み時に1回だけ登録する
	callbacks.onchat = Player.onChat;
	callbacks.onstate = Player.onState;
	callbacks.onjoin = game.onJoin;
	callbacks.onleave = Player.onLeave;
	callbacks.onwelcome = Player.onWelcome;

	//セッション開始
	ws.onopen = () =>
	{
		connected = true;
		addLog("INFO", "サーバーと接続しました。");
	}
	//セッション終了
	ws.onclose = () =>
	{
		connected = false;
		addLog("INFO", "サーバーとの接続が切れました。");
	};
	//セッションエラー
	ws.onerror = (error) =>
	{
		connected = false;
		addLog("ERROR", "サーバーとの接続が切れました。(" + error.code + ")");
	};


	//サーバーから受信
	ws.onmessage = (event) =>
	{
		// 届いたバイナリを読み取るために Uint8Array に包む
		const data = new Uint8Array(event.data);

		// 1バイト目からタイプを読み取る
		const dataType = data[0];

		//DataViewとは？(※server.js確認)

		// ─── 状態データを受信した場合 ───
		if (dataType === PACKET_TYPE.STATE)
		{
			// DataViewを使って、バイト列から小数を正しく引き抜く
			const view = new DataView(event.data);
			const id = view.getUint16(1, true);			// 2〜3byte目：送信元のプレイヤーID
			const x = view.getFloat32(3, true);			// 4〜7byte目：X座標
			const y = view.getFloat32(7, true);			// 8〜11byte目：Y座標
			const stateIndex = view.getUint8(11);		// 12byte目：状態
			const directionIndex = view.getUint8(12);	// 13byte目：向き
			const flip = view.getUint8(13) === 1;		// 14byte目：反転

			if (callbacks.onstate)
				callbacks.onstate(id, x, y, stateIndex, directionIndex, flip);
			else
				addLog("WARNING", "onstateコールバック指定無し");
		}
		// ─── チャットを受信した場合 ───
		else if (dataType === PACKET_TYPE.CHAT)
		{
			// dataはUint8Arrayなので、中のArrayBufferを使ってDataViewを作る
			const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

			// 2〜3byte目：送信元のプレイヤーID
			const id = view.getUint16(1, true);

			// 4byte目以降を文字列に変換
			const textBytes = data.subarray(3);
			const decoder = new TextDecoder();
			const chatMessage = decoder.decode(textBytes);

			// 誰からのチャットかも含めてコールバックに渡す
			if (callbacks.onchat)
				callbacks.onchat(id, chatMessage);
			else
				addLog("WARNING", "onChatコールバック指定無し");
		}
		// ─── 自分のIDを教えてもらった場合 ───
		else if (dataType === PACKET_TYPE.WELCOME)
		{
			// DataViewを使って2バイト目からID(Uint16)を読み取る
			const view = new DataView(event.data);
			myPlayerId = view.getUint16(1, true); // trueはサーバー側と合わせてリトルエンディアン指定
			addLog("INFO", "WELCOME：" + myPlayerId);

			if (callbacks.onwelcome)
				callbacks.onwelcome(myPlayerId);
			else
				addLog("WARNING", "onjoinコールバック指定無し");
		}
		// ─── 他プレイヤーが入ってきた場合 ───
		else if (dataType === PACKET_TYPE.JOIN)
		{
			const view = new DataView(event.data);
			const joinedId = view.getUint16(1, true);
			const charactorIndex = view.getUint16(3, true);

			if (callbacks.onjoin)
				callbacks.onjoin(joinedId, charactorIndex);
			else
				addLog("WARNING", "onjoinコールバック指定無し");
		}
		// ─── 他プレイヤーが抜けた場合 ───
		else if (dataType === PACKET_TYPE.LEAVE)
		{
			const view = new DataView(event.data);
			const leftId = view.getUint16(1, true);

			if (callbacks.onleave)
				callbacks.onleave(leftId);
			else
				addLog("WARNING", "onleaveコールバック指定無し");
		}
	};

	return true;
}

//データを送信する汎用関数
function sendBinary(buffer)
{
	if (ws && ws.readyState === WebSocket.OPEN)
	{
		// type と data をセットにして、JSON文字列にして送信
		//const packet = JSON.stringify({ type: type, data: data });
		ws.send(buffer);
	}
}

// WELCOMEでJOINを返送する　キャラ選択情報をサーバーへ送り返す関数
export function sendJoin(characterIndex)
{
	// タイプ(1byte) + キャラID(2byte) = 3バイト
	const buffer = new ArrayBuffer(3);
	const view = new DataView(buffer);

	view.setUint8(0, PACKET_TYPE.JOIN);
	view.setUint16(1, characterIndex, true);

	sendBinary(buffer);
}

//チャット送信
export function sendChat(text)
{
	// 1. 文字列をバイナリ（UTF-8）のバイト列に変換する便利メカニズム
	const encoder = new TextEncoder();
	const textBytes = encoder.encode(text); // 例: "あ" -> [227, 129, 130]

	//const packet = new Uint8Array(1 + textBytes.length);// 2. 「タイプ用(1バイト) + 文字列用」の合計サイズを持つ新しいバイナリの箱を作る
	//packet[0] = PACKET_TYPE.CHAT;						// 3. 1バイト目にチャットのタイプ（1）を入れる
	//packet.set(textBytes, 1);							// 4. 2バイト目以降に、変換した文字列のバイナリをそっくりコピーする

	const packet = new Uint8Array(1 + 2 + textBytes.length);
	const view = new DataView(packet.buffer);
	view.setUint8(0, PACKET_TYPE.CHAT);// 3. 1byte目にチャットのタイプ（1）を入れる
	view.setUint16(1, myPlayerId, true);// 4. 2〜3byte目に自分のIDを入れる（trueはmoveパケットと同じくリトルエンディアン指定）
	packet.set(textBytes, 3);// 5. 4byte目以降に、変換した文字列のバイナリをそっくりコピーする

	// 5. サーバーへ生のバイナリのまま送信！
	sendBinary(packet);
}

//移動を送信
export function sendState(x, y, state, direction, flip)
{
	//文字列(state/direction)のままではバイナリに乗せられないので、配列の中の「何番目か」という数字に変換する
	//（見つからない場合はindexOfが-1を返すので、念のため0番目扱いにしておく）
	const stateIndex = Math.max(0, Player.STATES.indexOf(state));
	const directionIndex = Math.max(0, Player.DIRECTIONS.indexOf(direction));

	// タイプ(1byte) + プレイヤーID(2byte) + x座標(4byte) + y座標(4byte)
	// + 状態(1byte) + 向き(1byte) + 反転(1byte) = 合計14byte
	const buffer = new ArrayBuffer(14);
	const view = new DataView(buffer);

	view.setUint8(0, PACKET_TYPE.STATE);		// 1byte目：タイプ
	view.setUint16(1, myPlayerId, true);	// 2〜3byte目：自分のID
	view.setFloat32(3, x, true);			// 4〜7byte目：X座標
	view.setFloat32(7, y, true);			// 8〜11byte目：Y座標
	view.setUint8(11, stateIndex);			// 12byte目：状態（idle/run/sit/walkのどれか）
	view.setUint8(12, directionIndex);		// 13byte目：向き（forward/forside/side/backside/backwardのどれか）
	view.setUint8(13, flip ? 1 : 0);		// 14byte目：反転しているか（0=通常、1=反転）

	sendBinary(buffer);
}




