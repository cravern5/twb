//import path from 'path'; //ブラウザ環境では使えない
//import fs from 'fs';//ブラウザ環境では使えない

//ブラウザ環境のみ
let chatLog = null;
if (typeof document !== 'undefined')
	chatLog = document.getElementById('chatLog');


// 文字色・背景色などのエスケープコード一覧
// ※Pythonの \033 とJavaScriptの \x1b は同じ「ESCシーケンス」を表す書き方です
const COLORS = {

	info: "\x1b[34m",
	warning: "\x1b[33m",
	error: "\x1b[31m",

	// 文字色
	black: "\x1b[30m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",

	// 太字の文字色
	bold_red: "\x1b[1;31m",
	bold_green: "\x1b[1;32m",
	bold_yellow: "\x1b[1;33m",
	bold_blue: "\x1b[1;34m",
	bold_magenta: "\x1b[1;35m",
	bold_cyan: "\x1b[1;36m",

	// 明るい文字色（bright系）を追加
	bright_black: "\x1b[90m",
	bright_red: "\x1b[91m",
	bright_green: "\x1b[92m",
	bright_yellow: "\x1b[93m",
	bright_blue: "\x1b[94m",
	bright_magenta: "\x1b[95m",
	bright_cyan: "\x1b[96m",
	bright_white: "\x1b[97m",

	// 背景色つき（例: 赤背景に白文字など）
	bg_red: "\x1b[41m\x1b[37m",
	bg_green: "\x1b[42m\x1b[30m",
	bg_yellow: "\x1b[43m\x1b[30m",
};

// RGB値（0-255ずつ）を直接指定して約1677万色を出力（truecolor対応端末のみ）
export function trgb(r, g, b, text)
{

	// 各成分を0-255にクリップ
	r = Math.max(0, Math.min(255, r));
	g = Math.max(0, Math.min(255, g));
	b = Math.max(0, Math.min(255, b));
	const code = `\x1b[38;2;${r};${g};${b}m`;
	return `${code}${text}\x1b[0m`;
	//return code + text;
}

export function tc(color, text)
{
	// COLORSに無いキーが指定されたらwhiteにフォールバックする
	const code = COLORS[color] || COLORS["white"] || "";
	return `${code}${text}\x1b[0m`;
	//return code + text;
}

export function log_rgb(r, g, b, text)
{
	let result = trgb(r, g, b, text);
	if (!result.endsWith("\x1b[0m")) result += "\x1b[0m";
	console.log(result);
}

//色log
export function print(color, text)
{
	if (text === undefined)
		text = color;
	let result = tc(color, text);
	if (!result.endsWith("\x1b[0m")) result += "\x1b[0m";
	console.log(result);
}

export function print2(text)
{
	if (!text.endsWith("\x1b[0m")) text += "\x1b[0m";
	console.log(text);
}

//色付きdiv作成
export function createTypeFont(type, message)
{
	const ctype = type.toUpperCase();
	let prefix = "";
	const mes = document.createElement('div');

	//クラス名設定
	mes.classList.add("logLine");

	/*
	// 直接 body に追加する場合は、3D画面の手前に浮かせるために絶対配置が必要です！
	document.body.appendChild(msgDiv);
	
	msgDiv.style.position = 'absolute';
	msgDiv.style.top = '10px';
	msgDiv.style.left = '10px';
	msgDiv.style.zIndex = '100'; // 3D画面（キャンバス）より手前に出す設定
	*/

	//cssそのままを使う
	//if (ctype === 'INFO')
	//	mes.style.color = 'white';
	if (ctype === 'WARNING')
		mes.style.color = 'yellow';
	else if (ctype === 'ERROR')
		mes.style.color = 'red';

	mes.innerText = message;
	//mes.innerText = `${prefix} ${message}`;

	return mes;
}

//typeのconsoleを取得
export function typeConsole(type)
{
	const ctype = type.toUpperCase();
	let consoleFunc = console.log
	if (ctype === 'INFO')
		consoleFunc = console.log;
	else if (ctype === 'WARNING')
		consoleFunc = console.warn; //ちょっとまずい
	else if (ctype === 'ERROR')
		consoleFunc = console.error; //致命的エラー
	return consoleFunc;
}

export function addLog(type, message, logArea = chatLog)
{
	//タイプコンソール取得
	let consoleFunc = typeConsole(type);

	//色付き文字のdiv作成
	let msgDiv = createTypeFont(type, message);

	if (logArea)
	{
		logArea.appendChild(msgDiv);
		logArea.scrollTop = logArea.scrollHeight;
	}

	//conlose.log
	consoleFunc(message);

	// INFOやWARNINGが画面に残り続けると邪魔なので、5秒後に自動で消えるようにする
	/*if (ctype !== 'ERROR')
	{
		setTimeout(() =>
		{
			msgDiv.remove();
		}, 5000); // 5000ミリ秒 = 5秒
	}*/
}

let debugMessage;
export function debugLog(message)
{
	if (debugMessage != message)
	{
		debugMessage = message;
		addLog('INFO', debugMessage);
	}
}

//丸め処理
export function roundTo(value, digits)
{
	const factor = Math.pow(10, digits);
	return Math.round(value * factor) / factor;
}

//2つの数値がほぼ等しいか判定する（浮動小数点誤差を許容する）
export function nearlyEqual(a, b, epsilon = 1e-4)
{
	return Math.abs(a - b) <= epsilon;
}

//拡張子変更
export function changeExt(filePath, newExt)
{
	// .の有無を吸収してフォーマット（例: "png" -> ".png"）
	const ext = newExt.startsWith('.') ? newExt : `.${newExt}`;

	// 末尾の拡張子部分（.xxx）を新しい拡張子に置換
	return filePath.replace(/\.[^/.]+$/, ext);
}

//ファイル名だけ取得
export function getFileName(filePath)
{
	return filePath.split(/[/\\]/).pop();
}

//ファイルの有無
export async function checkFileExists(url)
{
	try
	{
		const response = await fetch(url, { method: 'HEAD' });
		return response.ok; // 200〜299ならtrue
	} catch
	{
		return false;
	}
}

//wait setInterval & Promise(外部ライブラリなどの既存オブジェクトの追加待ち)
/*使用例
// 3秒後にプロパティが追加されるダミーオブジェクト
const myObj = {};
setTimeout(() =>
{
	myObj.data = "Loaded!";
}, 3000);

// 待機処理を実行
(async () =>
{
	try
	{
		const value = await waitInterval(myObj, "data");
		console.log("取得成功:", value); // -> "取得成功: Loaded!"
	} catch (error)
	{
		console.error(error.message);
	}
})();
*/
export function waitInterval(obj, propName, timeout = 5000, interval = 100)
{
	return new Promise((resolve, reject) =>
	{
		const startTime = Date.now();

		const timer = setInterval(() =>
		{
			// プロパティが存在するかチェック (undefined 以外、または 'in' 演算子)
			if (propName in obj && obj[propName] !== undefined)
			{
				clearInterval(timer);
				resolve(obj[propName]);
			} else if (Date.now() - startTime > timeout)
			{
				clearInterval(timer);
				reject(new Error(`Timeout: Property "${propName}" was not found.`));
			}
		}, interval);
	});
}

//wait requestAnimationFrame(外部ライブラリなどの既存オブジェクトの追加待ち)
export function waitRAF(obj, propName, timeout = 5000)
{
	return new Promise((resolve, reject) =>
	{
		const startTime = Date.now();

		function check()
		{
			if (propName in obj && obj[propName] !== undefined)
			{
				resolve(obj[propName]);
			} else if (Date.now() - startTime > timeout)
			{
				reject(new Error(`Timeout: Property "${propName}" was not found.`));
			} else
			{
				requestAnimationFrame(check);
			}
		}

		check();
	});
}

//wait proxy(自作のデータ構造でプロパティ追加をトリガーにしたい時)
/*使用例
// 1. 監視可能なオブジェクトを作成
const watchedObj = waitProxy();

// 2. プロパティがセットされるのを非同期で待機
(async () =>
{
	console.log("待機開始...");

	// 'token' プロパティが追加されるまでここで処理が一時停止する
	const token = await watchedObj.waitFor("token");

	console.log("取得完了:", token); // -> "取得完了: abc-123-xyz"
})();

// 3. 少し遅れて（例: 2秒後）プロパティを代入してみる
setTimeout(() =>
{
	console.log("プロパティをセットします");
	watchedObj.token = "abc-123-xyz"; // この代入を検知して waitFor の Promise が解決する
}, 2000);
*/
export function waitProxy(target = {})
{
	const listeners = new Map();

	const proxy = new Proxy(target, {
		set(obj, prop, value)
		{
			obj[prop] = value;
			if (listeners.has(prop))
			{
				listeners.get(prop)(value);
				listeners.delete(prop); // 待機解消
			}
			return true;
		}
	});

	// プロパティ追加をPromiseで待機するメソッド
	proxy.waitFor = (propName) =>
	{
		return new Promise((resolve) =>
		{
			if (propName in proxy && proxy[propName] !== undefined)
			{
				resolve(proxy[propName]);
			} else
			{
				listeners.set(propName, resolve);
			}
		});
	};

	return proxy;
}

//ewait MutationObserver(DOM要素の属性や状態追加を待ちたい時)
/*使用例
// 1. 対象のDOM要素を取得
const button = document.querySelector("#my-button");

// 2. 属性が追加されるのを非同期で待機
(async () =>
{
	console.log("属性の追加を待機中...");

	try
	{
		// 'data-status' 属性が付与されるまで最大5秒間待つ
		const status = await waitMObs(button, "data-status", 5000);
		console.log("属性を取得しました:", status); // -> "属性を取得しました: ready"
	} catch (error)
	{
		console.error(error.message); // タイムアウト時の処理
	}
})();

// 3. 例：2秒後に外部スクリプトなどによって属性が付与される
setTimeout(() =>
{
	button.setAttribute("data-status", "ready");
}, 2000);
*/
export function waitMObs(element, attrName, timeout = 5000)
{
	return new Promise((resolve, reject) =>
	{
		if (element.hasAttribute(attrName))
		{
			return resolve(element.getAttribute(attrName));
		}

		const timer = setTimeout(() =>
		{
			observer.disconnect();
			reject(new Error(`Timeout: Attribute "${attrName}" was not found.`));
		}, timeout);

		const observer = new MutationObserver(() =>
		{
			if (element.hasAttribute(attrName))
			{
				clearTimeout(timer);
				observer.disconnect();
				resolve(element.getAttribute(attrName));
			}
		});

		observer.observe(element, { attributes: true });
	});
}