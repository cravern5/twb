//import inspector from 'node:inspector'; // 追加：デバッガが接続されているか調べるため
import { fileURLToPath } from 'url'; // パスとURLを相互変換するための標準機能、isMainModule用
import * as web from './web.js';
import * as ws from './ws_bin_server.js'; //webserverに相乗り
import { print, isMainModule, isDev } from '../shared/sub.js';
//import * as dbs from './db_sync.js';

//print("green", (isMainModule(import.meta.url) ? "(main)" : "") + (isDev ? "(debug)" : "") + "で実行中 引数:" + JSON.stringify(process.argv.slice(2)))

//urlの文字列 と 実行する関数 の対応表（ルーティングテーブル）
export const routesAPI =
{
	//"seed": api_seed,
	//"query": api_query,
};

//直接起動時
if (await isMainModule(import.meta.url))
{
	//webserver立ち上げ
	web.init(routesAPI);

	//websocket立ち上げ
	ws.init(web.server);

	//サーバーを安全に終了させるための処理
	//Render/Koyebはデプロイやスリープの際に「SIGTERM」という終了信号を送ってくる
	//何もしないと接続中のプレイヤーが前触れなく切断されてしまうので、
	//先に全員へ切断を知らせてから、行儀よく終了する
	process.on('SIGTERM', () =>
	{
		console.log('SIGTERMを受信しました。サーバーを終了します。');

		//接続中の全クライアントに終了を通知
		ws.wss.clients.forEach((client) =>
		{
			if (client.readyState === 1)
				client.close(1001, 'サーバーがメンテナンスのため終了します');
		});

		//新しい接続の受付を止めて、今ある接続が終わるのを待ってから終了する
		web.server.close(() =>
		{
			console.log('サーバーを終了しました。');
			process.exit(0);
		});
	});
}

//サンプル
/*
//ダミーデータの作成
function api_seed(req, res, body)
{
	try
	{
		//データベース接続
		dbs.connect();

		//ダミーデータ作成
		let ret = dbs.seed(res);

		return { code: 200, message: "ダミーデータの取得完了", results: ret };
	}
	catch (e)
	{
		return { code: 400, message: "ダミーデータ取得に失敗しました" + e.message, results: null };
	}
	finally
	{
		dbs.close();
	}
}

//sql実行
function api_query(req, res, body)
{
	try
	{
		//文字列JSON解析
		const { sql } = JSON.parse(body);

		//クエリエラー
		if (!sql)
			return { code: 400, message: "SQLクエリが空です", results: null };

		const lowerSql = sql.trim().toLowerCase();

		//データベース接続
		dbs.connect();

		//select文
		if (lowerSql.startsWith('select'))
		{
			try
			{
				//データ取得
				const rows = dbs.all(sql);
				return { code: 200, message: "データ取得完了", results: rows };
			}
			catch (e)
			{
				return { code: 400, message: "データ取得が失敗しました" + e.message, results: null };
			}
		}
		else
		{
			//plainWrite(res, 501, "SELECT以外のクエリは未対応です。");
			//DELETE FROM users WHERE name = '佐藤 花子'

			try
			{
				//SQL実行
				const info = dbs.prepare(sql).run();
				let mes = "データ処理完了";
				//実行件数あり
				if (info.changes)
					mes += "(" + info.changes + ")";

				return { code: 200, message: mes, results: info };
			}
			catch (e)
			{
				return { code: 400, message: "データ処理が失敗しました" + e.message, results: null };
			}
		}
	}
	catch (e)
	{
		return { code: 400, message: "無効なJSONリクエストです。" + e.message, results: null };
	}
	finally
	{
		dbs.close();
	}
}
	*/