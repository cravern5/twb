import { print, addLog } from '../shared/sub.js';
import * as sub from '../shared/sub.js';

export let canvas = document.getElementById("gameCanvas");
export let ctx = canvas.getContext("2d");
export let useTouch;

export function init()
{
	//タッチ操作が可能なら
	useTouch = sub.isCanTouch();

	//画像を滑らかに拡大するかどうかを示します　※ここで変更してもダメcanvas.widthなど呼ばれると戻る
	//ctx.imageSmoothingEnabled = false;

	// canvasがフォーカスを受け取れるようにする
	canvas.setAttribute('tabindex', '0');
	// 外枠の黒い線を消す（フォーカス時に青い枠線などが出ないようにする）
	canvas.style.outline = 'none';

	autoPageReloader();

	return true;
}

// プログレスバーとテキストの更新=================
let loadedCount = 0;
let loadTotal = 5;
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const progressBar = document.getElementById('progress-bar');
export function updateProgress(message = "")
{
	loadedCount++;
	const percentage = Math.floor((loadedCount / loadTotal) * 100);
	loadingText.textContent = "Loading... " + percentage + "%" + message + "";
	progressBar.style.width = `${percentage}%`;
}
export function endProgress()
{
	if (loadedCount != loadTotal)
		print("warning", "読み込みカウントが違います。 loadTotal:" + loadTotal + " loadedCount:" + loadedCount);


	// 画面をフェードアウトして非表示にする
	loadingScreen.style.opacity = '0';
	//loadingScreen.style.display = 'none';
	setTimeout(() => { loadingScreen.style.display = 'none'; });
}
//保存時の自動ページリロード用
export function autoPageReloader()
{
	// サーバーとの常時接続を開始する
	const eventSource = new EventSource('/events');

	// サーバーから 'data: reload\n\n' が送られてきた時に実行される処理
	eventSource.onmessage = function (event)
	{
		// 送られてきたデータが "reload" だったらページを再読み込みする
		if (event.data === 'reload')
			location.reload();
	};
	// 追加：接続エラー時（本番環境で404が返る場合など）は再接続をやめる
	eventSource.onerror = function ()
	{
		eventSource.close();
	};
}