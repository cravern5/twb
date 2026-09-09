//ポート番号

//Renderのデフォルトポートは10000、Koyebも同様に自動割り当て
//Render・Koyebなどのホスティング先では、起動時に使うポート番号が
//環境変数 process.env.PORT で渡されることがある、ただしこのファイルはブラウザ側からも読み込まれ、
//ブラウザには process という変数が存在しないため、先に「process が使えるかどうか」を確認してから使う
export const PORT =
	(typeof process !== 'undefined' && process.env.PORT)
		? process.env.PORT
		: 5135;

//通信のタイプ
export const PACKET_TYPE =
{
	CHAT: 1,
	STATE: 2,
	WELCOME: 3,	// サーバー→本人だけに送る「あなたのIDはこれです」通知
	JOIN: 4,	// サーバー→他の全員に送る「新しい人が入ってきました」通知
	LEAVE: 5	// サーバー→他の全員に送る「この人が抜けました」通知
};

export const NAME_MAX_CHARS = 20;
export const NAME_BYTE_LENGTH = NAME_MAX_CHARS * 3; // 漢字はUTF-8で1文字3byteなので3倍しておく