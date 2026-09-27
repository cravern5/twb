import { fileURLToPath } from 'url'; // パスとURLを相互変換するための標準機能、isMainModule用
import { WebSocketServer } from 'ws';

import { print, isMainModule, isDev } from '../shared/sub.js';
import { PACKET_TYPE, PORT, encodePacket, decodePacket, FIXED_SIZE } from '../shared/network.js';
import * as network from '../shared/network.js';
//import * as web from './web.js';

export let wss = null;
export let playerCount = 0;//上限 setUint16(65535）
export const WELCOME_JOIN_TIMEOUT = 5000; // 5秒待っても反応がなければタイムアウト扱い

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
		playerCount++;

		//このクライアントが最後に送ってきたSTATEパケット（Buffer）をキャッシュ、まだ一度もSTATEを送ってきていない場合はnull
		ws.lastStateBuffer = null;
		print("white", '新しいプレイヤーが接続しました！(' + ws.playerId + ')');

		//WELCOME送信 本人にIDを送信　タイプ(1byte) + プレイヤーID(2byte) の3byteパケット
		ws.send(encodePacket(PACKET_TYPE.WELCOME, { playerId: ws.playerId }), { binary: true });

		//WELCOME送信後、クライアントからJOINが一定時間内に届かなければ、正式なクライアントとして認めず強制切断する
		if (!isDev)
		{
			ws.joinTimeoutId = setTimeout(() =>
			{
				print("warning", "プレイヤー(" + ws.playerId + ")からJOINが届かなかったため切断します。");
				ws.terminate(); // 強制切断→'close'イベントが発火し、wss.clientsから自動的に除外される
			}, WELCOME_JOIN_TIMEOUT);
		}

		//クライアントから受信
		ws.on('message', (data) =>
		{
			let dataType;
			try
			{
				if (!data || data.length === 0) return;

				// 先頭の1バイト目からタイプを読み取る
				dataType = data[0];

				//バイト数チェック
				//if (data.length !== getPacketMinLength(data.length))
				//	return;

				// クライアントが送ってきたIDは信用せず、サーバーが把握している本物のIDに上書きする
				if (dataType === PACKET_TYPE.CHAT || dataType === PACKET_TYPE.STATE)
				{
					const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
					view.setUint16(1, ws.playerId, true); // 2〜3byte目のIDを正しい値に書き換える
				}

				// クライアントから状態受信
				if (dataType === PACKET_TYPE.STATE)
				{
					// 次に誰かが新規接続してきたとき、この人の紹介用に使えるよう最新状態を保存しておく
					ws.lastStateBuffer = Buffer.from(data);
				}
				// クライアントからチャット受信
				else if (dataType === PACKET_TYPE.CHAT)
				{
					// タイプ1byte + ID(2byte) + 文字列 が最低構成（サーバーは中身を見ず、そのまま転送するだけ）
					//if (data.length < 3) return;

					const decodeData = decodePacket(dataType, data);
					if (decodeData.text.length > FIXED_SIZE["stringChat"])
					{
						//print("warning", "【検閲】50文字超過のバイナリチャットを破棄しました。");
						//return;
					}
				}
				// クライアントからキャラ情報取得
				else if (dataType === PACKET_TYPE.JOIN)
				{
					// タイプ(1byte) + プレイヤーID(2byte) + キャラID(2byte)
					// + x座標(4byte) + y座標(4byte) + 名前(固定BYTE_LENGTH_NAMEバイト)
					//if (data.length < 13 + BYTE_LENGTH_NAME) return;

					//キャラクター情報取得し、wsへコピー
					const decodeData = decodePacket(dataType, data);
					Object.assign(ws, decodeData);

					// JOINを正常に受け取れたので、タイムアウト強制切断の予約はもう不要→解除する
					if (ws.joinTimeoutId)
						clearTimeout(ws.joinTimeoutId);

					// 新規参加者自身のJOINパケットに、決定した位置も乗せる
					const myJoinPacket = encodePacket(PACKET_TYPE.JOIN, {
						playerId: ws.playerId,
						characterIndex: ws.characterIndex,
						playerName: ws.playerName,
						x: ws.x, y: ws.y
					});

					//自分自身に対してJOINパケットを送る
					ws.send(myJoinPacket, { binary: true });

					// 他の全ユーザーへ通知＆情報同期
					wss.clients.forEach((client) =>
					{
						if (client === ws || client.readyState !== 1) return;

						// 新規参加者へ、既存プレイヤーの情報(ID+キャラID+位置)を通知
						if (client.characterIndex !== undefined)
						{
							const existingJoinPacket = encodePacket(PACKET_TYPE.JOIN, {
								playerId: client.playerId,
								characterIndex: client.characterIndex,
								playerName: client.playerName,
								x: client.x, y: client.y
							});
							ws.send(existingJoinPacket, { binary: true });
						}

						// 既存プレイヤーの最新STATEがあれば送信（動いていれば、こちらでさらに位置が上書きされる）
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
					//if (client.readyState !== 1) return;
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
			if (ws.joinTimeoutId)
				clearTimeout(ws.joinTimeoutId);

			//LEAVE送信 他の全員に自分の切断を伝える
			const leavePacket = encodePacket(PACKET_TYPE.LEAVE, { playerId: ws.playerId });
			wss.clients.forEach((client) =>
			{
				if (client.readyState === 1)
					client.send(leavePacket, { binary: true });
			});
		});
	});

}

if (await isMainModule(import.meta.url))
	init();