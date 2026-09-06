import { fileURLToPath } from 'url'; // パスとURLを相互変換するための標準機能、isMainModule用
import { WebSocketServer } from 'ws';

import { print } from '../shared/sub.js';
import { PACKET_TYPE, PORT } from '../shared/config.js';
//import * as web from './web.js';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);//直接実行されたかどうか

//ポート番号 でWebSocketサーバーを起動
//const wss = new WebSocketServer({ port: PORT });

export let wss = null;

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

	// クライアントが接続してきたときの処理
	wss.on('connection', (ws) =>
	{
		print("white", '新しいプレイヤーが接続しました！');

		//クライアントから受信
		ws.on('message', (data) =>
		{
			if (!data || data.length === 0) return;

			// 先頭の1バイト目からタイプを読み取る
			const dataType = data[0];

			// チャット
			if (dataType === PACKET_TYPE.CHAT) // 💡 数字の「1」の代わりに定義を使う！
			{

				// 2バイト目以降を文字列に変換
				const chatMessage = data.toString('utf-8', 1);
				const chatMessageChars = [...chatMessage];

				//if (chatMessageChars.length > 50)
				//{
				//	print("warning","【検閲】50文字超過のバイナリチャットを破棄しました。");
				//	return;
				//}
			}
			// 移動
			else if (dataType === PACKET_TYPE.MOVE) // 💡 数字の「2」の代わりに定義を使う！
			{
				// 文字列変換もパースも通らない超軽量ルート
				if (data.length < 13) return; // タイプ1B + Float32×3(12B) = 最低13バイト
			}

			// 想定外
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
			print("white", 'プレイヤーが切断しました。');
		});
	});

}

if (isMainModule)
	init();