import { fileURLToPath } from 'url'; // パスとURLを相互変換するための標準機能、isMainModule用
import { WebSocketServer } from 'ws';

import { print, encodeFixedName, decodeFixedName } from '../shared/sub.js';
import { PACKET_TYPE, PORT, NAME_BYTE_LENGTH } from '../shared/config.js';
//import * as web from './web.js';

//直接実行されたかどうか
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

//ポート番号 でWebSocketサーバーを起動
//const wss = new WebSocketServer({ port: PORT });

export let wss = null;

let playerCount = 0;//上限 setUint16(65535）
const JOIN_TIMEOUT = 5000; // 5秒待っても反応がなければタイムアウト扱い

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
		//client.send(data, {options.binary=true})　送信方式(バイナリ or テキスト)
		//省略した場合、渡されたdataの型を見て自動的に判定します。
		//文字列(string)なら「テキストフレーム」、Buffer・ArrayBuffer・Uint8Arrayなどのバイナリ型なら「バイナリフレーム」として送ってくれます。

		//DataViewとは？　中身の解釈(どこまでがなんなのかを分かりやすくする)
		//1つのパケットの中に「1byteの整数（タイプ）」「2byteの整数（ID）」「4byteの小数（座標）」のように違う種類のデータが混ざって入っているので、
		//それぞれ正しい型・正しい位置で読み書きするためにDataViewが必要

		//「リトルエンディアン」とは？
		//複数バイトのデータをメモリや通信で送るときに、「下の位（桁）のバイトから順番に並べるルール」のことです。
		//例:4550を16進数（2バイト）で表すと 0x1234（12 と 34）　ビッグエンディアン = 0x12 0x34、リトルエンディアン = 0x34 0x12

		//クライアント除外
		//ws.terminate()またはws.close()を呼べば、closeイベントが発火して自動的にwss.clientsから除外されます

		//ID作成
		ws.playerId = playerCount;
		//このクライアントが最後に送ってきたSTATEパケット（Buffer）をキャッシュ、まだ一度もSTATEを送ってきていない場合はnull
		ws.lastStateBuffer = null;
		playerCount++;
		print("white", '新しいプレイヤーが接続しました！(' + ws.playerId + ')');

		//WELCOME送信 本人にIDを送信　タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
		const welcomePacket = createWelcomePacket(ws.playerId);
		ws.send(welcomePacket, { binary: true });

		// JOINが一定時間内に届かなければ、正式なクライアントとして認めず強制切断する
		ws.joinTimeoutId = setTimeout(() =>
		{
			print("warning", "プレイヤー(" + ws.playerId + ")からJOINが届かなかったため切断します。");
			ws.terminate(); // 強制切断→'close'イベントが発火し、wss.clientsから自動的に除外される
		}, JOIN_TIMEOUT);

		//JOIN送信 ※WELCOMEの後にクライアント側にJOINを送信させる　他の全員に自分を伝える タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
		/*//クライアントが情報を送るタイプ
		//const joinPacket = createJoinPacket(ws.playerId);

		//全ユーザー取得
		wss.clients.forEach((client) =>
		{
			if (client === ws || client.readyState !== 1)
				return;

			// 新規参加者に既存プレイヤーを通知
			const existingJoinPacket = createJoinPacket(client.playerId);
			ws.send(existingJoinPacket, { binary: true });

			// 既存プレイヤーが一度でもSTATEを送ってきていれば、そのままキャッシュ済みSTATEを送る
			if (client.lastStateBuffer)
				ws.send(client.lastStateBuffer, { binary: true });

			// 既存参加者へ新規参加者を通知
			client.send(joinPacket, { binary: true });
		});*/

		//クライアントから受信
		ws.on('message', (data) =>
		{
			let dataType;
			try
			{
				if (!data || data.length === 0) return;

				// 先頭の1バイト目からタイプを読み取る
				dataType = data[0];

				// クライアントから状態受信
				if (dataType === PACKET_TYPE.STATE)
				{
					// タイプ1byte + ID(2byte) + Float32×2(8byte) + 状態(1byte) + 向き(1byte) + 反転(1byte) = 14バイト
					if (data.length !== 14) return;

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
				// クライアントからキャラ情報取得
				else if (dataType === PACKET_TYPE.JOIN)
				{
					// タイプ(1byte) + プレイヤーID(2bytes) + キャラID(2byte) + 名前(固定NAME_BYTE_LENGTHバイト)
					if (data.length < 5 + NAME_BYTE_LENGTH) return;

					//data.byteOffset(読み書きの開始位置)、data.byteLength(対象のデータ長)
					const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
					const dummyid = view.getUint16(1, true); // プレイヤーIDを記録
					ws.characterIndex = view.getUint16(3, true); // キャラIDを記録

					// 4byte目から固定長分を取り出し、プレイヤー名として記録する
					const nameBytes = data.subarray(5, 5 + NAME_BYTE_LENGTH);
					ws.playerName = decodeFixedName(nameBytes);

					// JOINを正常に受け取れたので、タイムアウト強制切断の予約はもう不要→解除する
					clearTimeout(ws.joinTimeoutId);

					// 新規参加者自身のJOINパケットに名前も乗せる
					const myJoinPacket = createJoinPacket(ws.playerId, ws.characterIndex, ws.playerName);

					//自分自身に対してJOINパケットを送る
					ws.send(myJoinPacket, { binary: true });

					// 他の全ユーザーへ通知＆情報同期
					wss.clients.forEach((client) =>
					{
						if (client === ws || client.readyState !== 1) return;

						// 新規参加者へ、既存プレイヤーの情報(ID+キャラID)を通知
						if (client.characterIndex !== undefined)
						{
							const existingJoinPacket = createJoinPacket(client.playerId, client.characterIndex, client.playerName);
							ws.send(existingJoinPacket, { binary: true });
						}

						// 既存プレイヤーの最新STATEがあれば送信
						if (client.lastStateBuffer)
							ws.send(client.lastStateBuffer, { binary: true });

						// 既存プレイヤーへ、新規参加者の情報を通知
						client.send(myJoinPacket, { binary: true });
					});
					return;
				}
				// クライアントから想定外の受信
				else 
				{
					print("warning", "未定義のタイプ(" + dataType + ")を受信しました。(" + ws.playerId + ")\n" + data);
					return;
				}

				// ブロードキャスト 安全が確認されたので全員に生のバイナリのまま横流し
				wss.clients.forEach((client) =>
				{
					// 1人への送信が失敗しても、他のクライアントへの配信を止めないようにする
					if (client.readyState !== 1) return;
					//if (client === ws || client.readyState !== 1) return;
					try
					{
						//STATEが自分自身も入ってくる状態になっている（クライアントでidで除外している）
						if (client.readyState === 1)
							client.send(data, { binary: true });
					}
					catch (e)
					{
						print("error", "ブロードキャスト送信失敗 playerId(" + client.playerId + ") " + e.message);
					}
				});

			}
			catch (e)
			{
				// この接続の異常だけに留め、他のプレイヤーには影響させない
				print("error", "メッセージ処理中に例外発生 playerId(" + ws.playerId + ") " + e.message);

				// JOIN処理中に失敗した場合は「正式なクライアント」として成立しないので強制切断する
				if (dataType === PACKET_TYPE.JOIN)
					ws.terminate(); // 'close'イベント発火→wss.clientsから自動除外される
			}
		});

		// 接続が切れたとき
		ws.on('close', () =>
		{
			print("white", "プレイヤーが切断しました。(" + ws.playerId + ")");

			// JOIN待ちタイマーが残っていれば解除する（二重発火防止のお作法）
			clearTimeout(ws.joinTimeoutId);

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
function createWelcomePacket(playerId)
{
	const welcomePacket = new Uint8Array(3);
	try
	{
		const welcomeView = new DataView(welcomePacket.buffer);
		welcomeView.setUint8(0, PACKET_TYPE.WELCOME);
		welcomeView.setUint16(1, playerId, true); // 第3引数trueは「リトルエンディアン」という並び順の指定（clientと合わせる必要あり）
	}
	catch (e)
	{
		print("error", "createWelcomePacket:" + e.message);
		throw e;
	}


	return welcomePacket;
}

//JOIN 入ってきた人のID・キャラID・名前を送信 (タイプ1byte + ID 2byte + キャラID 2byte + 名前(固定NAME_BYTE_LENGTHバイト))
function createJoinPacket(playerId, characterIndex, playerName)
{
	const joinPacket = new Uint8Array(5 + NAME_BYTE_LENGTH);
	try
	{
		const view = new DataView(joinPacket.buffer);
		view.setUint8(0, PACKET_TYPE.JOIN);
		view.setUint16(1, playerId, true);
		view.setUint16(3, characterIndex, true);

		// 6byte目以降に名前を固定長のバイト列として書き込む
		joinPacket.set(encodeFixedName(playerName, NAME_BYTE_LENGTH), 5);
	}
	catch (e)
	{
		print("error", "createJoinPacket:" + e.message);
		throw e;
	}

	return joinPacket;
}

//LEAVE 自分の切断を伝える タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
function createLeavePacket(playerId)
{
	const leavePacket = new Uint8Array(3);
	try
	{
		const leaveView = new DataView(leavePacket.buffer);
		leaveView.setUint8(0, PACKET_TYPE.LEAVE);
		leaveView.setUint16(1, playerId, true);
	}
	catch (e)
	{
		print("error", "createLeavePacket:" + e.message);
		throw e;
	}


	return leavePacket;
}


if (isMainModule)
	init();