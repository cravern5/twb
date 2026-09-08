import { fileURLToPath } from 'url'; // パスとURLを相互変換するための標準機能、isMainModule用
import { WebSocketServer } from 'ws';

import { print } from '../shared/sub.js';
import { PACKET_TYPE, PORT } from '../shared/config.js';
//import * as web from './web.js';

//直接実行されたかどうか
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

//ポート番号 でWebSocketサーバーを起動
//const wss = new WebSocketServer({ port: PORT });

export let wss = null;

let playerCount = 0;

export function init(server)
{
	//ウェブサーバーとポート共有してサーバー起動 独自にポートを開かず、http サーバーの Upgrade イベントに相乗りする
	wss = new WebSocketServer({ server: server });

	// サーバーが正常に「待ち受け状態」になったら実行
	wss.on('listening', () =>
	{
		print("green", `✅ WebSocketサーバーを起動しました: PORT (${PORT})`);
	});

	wss.on('error', (err) =>
	{
		if (err.code === 'EADDRINUSE')
		{
			print("error", `❌ エラー: ポート ${PORT} は既に使われています。`);
			process.exit(1);
		}
	});

	// クライアントが接続してきたときの処理===============
	wss.on('connection', (ws) =>
	{
		//ID作成
		ws.playerId = playerCount;
		//このクライアントが最後に送ってきたSTATEパケット（Buffer）をキャッシュ、まだ一度もSTATEを送ってきていない場合はnull
		ws.lastStateBuffer = null;
		playerCount++;
		print("white", '新しいプレイヤーが接続しました！(' + ws.playerId + ')');

		//client.send(data, {options.binary=true})　送信方式(バイナリ or テキスト)
		//省略した場合、渡されたdataの型を見て自動的に判定します。
		//文字列(string)なら「テキストフレーム」、Buffer・ArrayBuffer・Uint8Arrayなどのバイナリ型なら「バイナリフレーム」として送ってくれます。

		//DataViewとは？　中身の解釈(どこまでがなんなのかを分かりやすくする)
		//1つのパケットの中に「1byteの整数（タイプ）」「2byteの整数（ID）」「4byteの小数（座標）」のように違う種類のデータが混ざって入っているので、
		//それぞれ正しい型・正しい位置で読み書きするためにDataViewが必要

		//「リトルエンディアン」とは？
		//複数バイトのデータをメモリや通信で送るときに、「下の位（桁）のバイトから順番に並べるルール」のことです。
		//例:4550を16進数（2バイト）で表すと 0x1234（12 と 34）　ビッグエンディアン = 0x12 0x34、リトルエンディアン = 0x34 0x12

		//WELCOME送信 本人にIDを送信　タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
		const welcomePacket = createWelcomePacket(ws.playerId);
		ws.send(welcomePacket, { binary: true });

		/*//JOIN(本人) 既存ユーザーを本人に伝える
		wss.clients.forEach((client) =>
		{
			// 自分自身(今接続してきた本人)は対象外にする
			if (client !== ws && client.readyState === 1)
			{
				// 既存プレイヤー1人につき、JOINパケット(タイプ+ID)を1つ作る
				const existingJoinPacket = new Uint8Array(3);
				const existingJoinView = new DataView(existingJoinPacket.buffer);
				existingJoinView.setUint8(0, PACKET_TYPE.JOIN);
				existingJoinView.setUint16(1, client.playerId, true);

				// 他の全員にではなく、新しく入ってきた本人(ws)にだけ送る
				ws.send(existingJoinPacket, { binary: true });

				// 既存プレイヤーが一度でもSTATEを送ってきていれば、そのままキャッシュ済みSTATEを送る
				if (client.lastStateBuffer)
					ws.send(client.lastStateBuffer, { binary: true });
			}
		});

		//JOIN送信 他の全員に自分を伝える タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
		const joinPacket = new Uint8Array(3);
		const joinView = new DataView(joinPacket.buffer);
		joinView.setUint8(0, PACKET_TYPE.JOIN);
		joinView.setUint16(1, ws.playerId, true);
		wss.clients.forEach((client) =>
		{
			// 送信者(=今接続してきた本人)には送らない
			if (client !== ws && client.readyState === 1)
				client.send(joinPacket, { binary: true });
		});*/

		//JOIN送信 他の全員に自分を伝える タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
		const joinPacket = createJoinPacket(ws.playerId);

		//全ユーザー取得
		wss.clients.forEach((client) =>
		{
			if (client === ws || client.readyState !== 1)
				return;

			// 新規参加者へ既存プレイヤーを通知
			const existingJoinPacket = createJoinPacket(client.playerId);
			ws.send(existingJoinPacket, { binary: true });

			// 既存プレイヤーが一度でもSTATEを送ってきていれば、そのままキャッシュ済みSTATEを送る
			if (client.lastStateBuffer)
				ws.send(client.lastStateBuffer, { binary: true });

			// 既存参加者へ新規参加者を通知
			client.send(joinPacket, { binary: true });
		});

		//クライアントから受信
		ws.on('message', (data) =>
		{
			if (!data || data.length === 0) return;

			// 先頭の1バイト目からタイプを読み取る
			const dataType = data[0];

			// クライアントから状態受信
			if (dataType === PACKET_TYPE.STATE)
			{
				// タイプ1byte + ID(2byte) + Float32×2(8byte) + 状態(1byte) + 向き(1byte) + 反転(1byte) = 14バイト
				if (data.length < 14) return;

				// 次に誰かが新規接続してきたとき、この人の紹介用に使えるよう最新状態を保存しておく
				ws.lastStateBuffer = Buffer.from(data);
			}
			// クライアントからチャット受信
			else if (dataType === PACKET_TYPE.CHAT)
			{
				// タイプ1byte + ID(2byte) + 文字列 が最低構成（サーバーは中身を見ず、そのまま転送するだけ）
				if (data.length < 3) return;

				const chatMessage = data.toString('utf-8', 1);// 2バイト目以降を文字列に変換
				const chatMessageChars = [...chatMessage];

				if (chatMessageChars.length > 50)
				{
					print("warning", "【検閲】50文字超過のバイナリチャットを破棄しました。");
					return;
				}
			}
			// クライアントから想定外の受信
			else 
			{
				print("warning", `【警告】未定義のタイプ（${dataType}）を受信しました。'\n(${data})`);
				return;
			}

			// 安全が確認されたので全員に生のバイナリのまま横流し
			wss.clients.forEach((client) =>
			{
				if (client.readyState === 1) 
				{
					client.send(data, { binary: true });
				}
			});
		});

		// 接続が切れたとき
		ws.on('close', () =>
		{
			print("white", "プレイヤーが切断しました。(" + ws.playerId + ")");

			//LEAVE送信 他の全員に自分の切断を伝える
			const leavePacket = createLeavePacket(ws.playerId);
			wss.clients.forEach((client) =>
			{
				if (client.readyState === 1)
					client.send(leavePacket, { binary: true });
			});
		});
	});

}


//WELCOME 本人にIDを送信　タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
function createWelcomPacket(playerId)
{
	const welcomePacket = new Uint8Array(3);
	const welcomeView = new DataView(welcomePacket.buffer);
	welcomeView.setUint8(0, PACKET_TYPE.WELCOME);
	welcomeView.setUint16(1, playerId, true); // 第3引数trueは「リトルエンディアン」という並び順の指定（clientと合わせる必要あり）

	return welcomePacket;
}

//JOIN 入ってきた人のIDを送信 タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
function createJoinPacket(playerId)
{
	const joinPacket = new Uint8Array(3);
	const view = new DataView(joinPacket.buffer);

	view.setUint8(0, PACKET_TYPE.JOIN);
	view.setUint16(1, playerId, true);

	return joinPacket;
}

//LEAVE 自分の切断を伝える タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
function createLeavePacket(playerId)
{
	const leavePacket = new Uint8Array(3);
	const leaveView = new DataView(leavePacket.buffer);
	leaveView.setUint8(0, PACKET_TYPE.LEAVE);
	leaveView.setUint16(1, playerId, true);

	return leavePacket;
}


if (isMainModule)
	init();