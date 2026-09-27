// client.js
import { PACKET_TYPE, PORT, encodePacket, decodePacket, FIXED_SIZE } from '/shared/network.js';
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
	onchat: null,	//チャット
	onstate: null,	//キャラ状態が変化
	onwelcome: null,//本人が入ったとき呼ばれる、すぐJOINを返す必要がある
	onjoin: null,	// 自身・他プレイヤーの情報を通知
	onleave: null,	// 他プレイヤーが抜けたときに通知
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

	//サーバーから届くバイナリを受け取る、届いたバイナリを何に包むか指定
	ws.binaryType = 'arraybuffer';

	// サーバーからのチャット・移動データを受け取る窓口を、モジュール読み込み時に1回だけ登録する
	callbacks.onchat = Player.onChat;
	callbacks.onstate = Player.onState;
	callbacks.onjoin = Player.onJoin;
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
			const ddata = decodePacket(dataType, event.data);

			if (callbacks.onstate)
				callbacks.onstate(ddata.playerId, ddata.x, ddata.y, ddata.stateIndex, ddata.directionIndex, ddata.flip === 1);
			else
				addLog("WARNING", "onstateコールバック指定無し");
		}
		// ─── チャットを受信した場合 ───
		else if (dataType === PACKET_TYPE.CHAT)
		{
			const ddata = decodePacket(dataType, event.data);

			// 誰からのチャットかも含めてコールバックに渡す
			if (callbacks.onchat)
				callbacks.onchat(ddata.playerId, ddata.text);
			else
				addLog("WARNING", "onChatコールバック指定無し");
		}
		// ─── 自分のIDを教えてもらった場合 ───
		else if (dataType === PACKET_TYPE.WELCOME)
		{
			const ddata = decodePacket(dataType, event.data);

			myPlayerId = ddata.playerId;

			if (callbacks.onwelcome)
				callbacks.onwelcome(myPlayerId);
			else
				addLog("WARNING", "onjoinコールバック指定無し");
		}
		// ─── 他プレイヤーが入ってきた場合 ───
		else if (dataType === PACKET_TYPE.JOIN)
		{
			const ddata = decodePacket(dataType, event.data);

			if (callbacks.onjoin)
				callbacks.onjoin(ddata.playerId, ddata.characterIndex, ddata.playerName, ddata.x, ddata.y);
			else
				addLog("WARNING", "onjoinコールバック指定無し");
		}
		// ─── 他プレイヤーが抜けた場合 ───
		else if (dataType === PACKET_TYPE.LEAVE)
		{
			const ddata = decodePacket(dataType, event.data);

			if (callbacks.onleave)
				callbacks.onleave(ddata.playerId);
			else
				addLog("WARNING", "onleaveコールバック指定無し");
		}
	};

	return true;
}

// WELCOMEでJOINを返送する　キャラ選択情報をサーバーへ送り返す関数
export function sendJoin(characterIndex, playerName, x = null, y = null)
{
	const packet = encodePacket(PACKET_TYPE.JOIN, { playerId: myPlayerId, characterIndex, playerName, x, y });

	if (ws && ws.readyState === WebSocket.OPEN)
		ws.send(packet);
}

//チャット送信
export function sendChat(text)
{
	const packet = encodePacket(PACKET_TYPE.CHAT, { playerId: myPlayerId, text: text });

	// 5. サーバーへ生のバイナリのまま送信！
	if (ws && ws.readyState === WebSocket.OPEN)
		ws.send(packet);
}

//移動を送信
export function sendState(x, y, state, direction, flip)
{
	//文字列(state/direction)のままではバイナリに乗せられないので、配列の中の「何番目か」という数字に変換する
	//（見つからない場合はindexOfが-1を返すので、念のため0番目扱いにしておく）
	const stateIndex = Math.max(0, Player.STATES.indexOf(state));
	const directionIndex = Math.max(0, Player.DIRECTIONS.indexOf(direction));

	const packet = encodePacket(PACKET_TYPE.STATE, { playerId: myPlayerId, x, y, stateIndex, directionIndex, flip: flip ? 1 : 0 });

	if (ws && ws.readyState === WebSocket.OPEN)
		ws.send(packet);
}




