//windows.js
import { addLog } from '../shared/sub.js';
import { canvas } from './engine.js';

export let activeWindow = null;
export let debugWindow;
export let chatWindow;
export let leftStatusWindow;
export let windows = [];

export const debugInfo = document.getElementById('debugInfo');

//チャットバー
export const chatArea = document.getElementById("chatArea");
export const chatWhisperInput = document.getElementById("chatWhisperInput");
export const chatInput = document.getElementById("chatInput");
export const chatLog = document.getElementById("chatLog");
//チャットバーボタン
export const chatOpen = document.getElementById("chatOpen");
export const chatMail = document.getElementById("chatMail");
export const chatMemo = document.getElementById("chatMemo");
export const chatMessanger = document.getElementById("chatMessanger");
export const chatDM = document.getElementById("chatDM");
export const chatFixedText = document.getElementById("chatFixedText");
export const chatEmote = document.getElementById("chatEmote");
export const chatRange = document.getElementById("chatRange");

//左ステータス 開閉ボタンの要素と、開閉対象の箱の要素を取得
export const leftStatusBtns = document.getElementsByClassName("leftStatusBtn");
export const leftStatus = document.getElementById("leftStatus");
export const leftStatusTab = document.getElementById("leftStatusTab");
export const leftOpen = document.getElementById("leftOpen");
export const leftAfkBtn = document.getElementById("leftAfkBtn");

//右メニュー
export const rightMenuButtons = document.getElementById("rightMenuButtons");

//ウィンドウズクラス
class WindowController
{
	//container　全面サイズ変更
	//drager　動かしたいウィンドウ
	//resizer　特定サイズ変更用
	//resizeDir　特定サイズ変更位置
	//minWidth　最小横幅
	//minHeight　最小高さ
	constructor({ container, drager = null, closer = null,
		resizer = null, resizeDir = 'n', minWidth = 280, minHeight = 180, childLock = false, defaultDisplay = null })
	{
		this.container = typeof container === 'string' ? document.querySelector(container) : container;
		this.drager = typeof drager === 'string' ? document.querySelector(drager) : drager;
		this.closer = typeof closer === 'string' ? document.querySelector(closer) : closer;
		this.resizer = typeof resizer === 'string' ? document.querySelector(resizer) : resizer;

		if (!this.container)
		{
			addLog("WARNING", '対象のウィンドウ要素が見つかりませんでした。');
			return;
		}

		//初期値noneの場合はデフォルトを指定する
		if (defaultDisplay)
			this.defaultDisplay = defaultDisplay;
		else
			this.defaultDisplay = getComputedStyle(this.container).display;

		this.childLock = childLock;

		// 各インスタンスごとに独立した状態（状態の隠蔽）
		this.isDragging = false;
		this.dragOffsetX = 0;
		this.dragOffsetY = 0;

		this.isResizing = false;
		this.resizeDir = '';
		this.resizeStartX = 0;
		this.resizeStartY = 0;
		this.resizeStartW = 0;
		this.resizeStartH = 0;
		this.resizeStartLeft = 0;
		this.resizeStartTop = 0;

		this.minWidth = minWidth;
		this.minHeight = minHeight;

		//四隅上下左右リサイズハンドルの追加
		//['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'].forEach(dir =>
		for (let dir of ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'])
		{
			const handle = document.createElement('div');
			handle.className = `resize-handle ${dir}`;

			this._makeResizable(handle, dir);

			this.container.appendChild(handle);

		}//);

		//ウィンドウリサイズ
		if (this.resizer)
		{
			this._makeResizable(this.resizer, resizeDir);
		}

		// ウィンドウドラッグ用
		if (this.drager)
		{
			// スマホでのスクロール等のジェスチャーをブラウザに横取りされないようにする少し動かした瞬間に pointercancel が発生してドラッグが止まる
			this.drager.style.touchAction = 'none';

			//ヘッダーマウスダウン
			this.drager.addEventListener('pointerdown', (e) =>
			{
				// e.targetが「子要素自体」または「子要素の中身」である場合は、親の処理をスルーする
				if (this.childLock)
				{
					if (this.drager.contains(e.target) && e.target !== this.drager)
					{
						return; // ここで処理を終わらせれば、親の処理をスキップできます
					}
				}

				// ポインターの入力をこの要素に固定する
				this.drager.setPointerCapture(e.pointerId);

				e.preventDefault();  //デフォルトの挙動（イベント）をキャンセルする
				e.stopPropagation(); //親へイベントが伝わるのを止める！

				activeWindow = this;

				this.isDragging = true;
				const rect = this._fixPosition();
				this.dragOffsetX = e.clientX - rect.left;
				this.dragOffsetY = e.clientY - rect.top;
			});

			//ヘッダーマウス移動
			this.drager.addEventListener('pointermove', (e) =>
			{
				if (this.isDragging)
				{
					const x = e.clientX - this.dragOffsetX;
					const y = e.clientY - this.dragOffsetY;
					this.container.style.left = `${x}px`;
					this.container.style.top = `${y}px`;
				}
			});

			//ヘッダーマウスアップ
			this.drager.addEventListener('pointerup', (e) =>
			{
				// ポインターの入力をこの要素に固定する
				this.drager.releasePointerCapture(e.pointerId);

				this.isDragging = false;
				this.isResizing = false;
				activeWindow = null;
			});

			//ブラウザ都合などで強制的にドラッグが中断された場合の後始末
			//pointerup が呼ばれずに終わるケースがあるため、これが無いと isDragging が
			//true のまま固まってしまい、次のドラッグがおかしくなることがある
			this.drager.addEventListener('pointercancel', (e) =>
			{
				this.isDragging = false;
				this.isResizing = false;
				activeWindow = null;
			});
		}

		// 閉じるボタン
		if (this.closer)
		{
			this.closer.addEventListener('click', (e) =>
			{
				this.hide();

				e.preventDefault();  //デフォルトの挙動（イベント）をキャンセルする
				e.stopPropagation(); //親へイベントが伝わるのを止める！
			});
		}
	}

	//ハンドル要素に「掴んで動かすとリサイズする」処理を付ける共通関数
	_makeResizable(handle, dir)
	{
		// リサイズハンドルもスマホでのジェスチャー横取りを防ぐ
		handle.style.touchAction = 'none';


		handle.addEventListener('pointerdown', (e) =>
		{
			// ポインターの入力をこの要素に固定する
			handle.setPointerCapture(e.pointerId);

			e.preventDefault();  //デフォルトの挙動（イベント）をキャンセルする
			e.stopPropagation(); //親へイベントが伝わるのを止める！

			activeWindow = this;

			this.isResizing = true;
			this.resizeDir = dir;
			this.resizeStartX = e.clientX;
			this.resizeStartY = e.clientY;

			const rect = this._fixPosition();
			this.resizeStartW = rect.width;
			this.resizeStartH = rect.height;
			this.resizeStartLeft = rect.left;
			this.resizeStartTop = rect.top;
		});

		handle.addEventListener('pointermove', (e) =>
		{
			if (this.isResizing)
			{
				const dx = e.clientX - this.resizeStartX;
				const dy = e.clientY - this.resizeStartY;

				if (dir.includes('e'))
				{
					//固定値280 → this.minWidth
					this.container.style.width = `${Math.max(this.minWidth, this.resizeStartW + dx)}px`;
				}
				if (dir.includes('s'))
				{
					//固定値180 → this.minHeight
					this.container.style.height = `${Math.max(this.minHeight, this.resizeStartH + dy)}px`;
				}
				if (dir.includes('w'))
				{
					const newW = Math.max(this.minWidth, this.resizeStartW - dx);
					this.container.style.width = `${newW}px`;
					this.container.style.left = `${this.resizeStartLeft + (this.resizeStartW - newW)}px`;
				}
				if (dir.includes('n'))
				{
					//topBarを上にドラッグ→高さが増える／下にドラッグ→高さが減る
					const newH = Math.max(this.minHeight, this.resizeStartH - dy);
					this.container.style.height = `${newH}px`;
					this.container.style.top = `${this.resizeStartTop + (this.resizeStartH - newH)}px`;
				}
			}
		});

		handle.addEventListener('pointerup', (e) =>
		{
			handle.releasePointerCapture(e.pointerId);

			this.isDragging = false;
			this.isResizing = false;
			activeWindow = null;
		});

		// 中断時の後始末（ドラッグ側と同じ理由）
		handle.addEventListener('pointercancel', (e) =>
		{
			this.isDragging = false;
			this.isResizing = false;
			activeWindow = null;
		});
	}

	// 完全に消え去るための後片付けメソッド
	destroy()
	{
		// 1. もしクラス内で直接イベントを貼っていた場合は必ず外す
		// 2. DOM要素に追加したリサイズハンドルを削除する
		const handles = this.container.querySelectorAll('.resize-handle');
		handles.forEach(h => h.remove());

		addLog("INFO", 'メモリ解放');
	}

	// 位置固定の共通処理
	_fixPosition()
	{
		const rect = this.container.getBoundingClientRect();
		this.container.style.top = `${rect.top}px`;
		this.container.style.left = `${rect.left}px`;
		this.container.style.bottom = 'auto';
		this.container.style.right = 'auto';

		//CSSの transform: translateX(-50 %) が残っていると、left を上書きした後にさらにズレてしまうので、無効化する
		this.container.style.transform = 'none';
		return rect;
	}

	show(flg)
	{
		if (flg) this.restore(); else this.hide();
	}

	show(flg = true)
	{
		if (flg === -1)
			flg = !this.isVisible();

		if (flg)
			this.container.style.display = this.defaultDisplay;
		else
			this.hide();
	}

	hide()
	{
		this.container.style.display = 'none';
	}

	restore()
	{
		this.container.style.display = '';
	}

	isVisible()
	{
		//方法1 最終的に適用されている実際の display の値を取得して判定
		if (getComputedStyle(this.container).display !== 'none')
			return true;

		//方法2 画面上に表示されていれば offsetParent は null 以外になる
		return this.container.offsetParent !== null;
	}


	//位置記憶
	savePosition()
	{
		if (!this.container)
			return;

		// 画面に対する現在の相対位置（割合: 0.0 ～ 1.0）を記録する変数
		this._saveRelativePos = { xRate: 0.5, yRate: 0.5 };
		this._saveRect = this.container.getBoundingClientRect();//相対位置

		// 「左端」ではなく「要素の中心点」が画面のどの割合の位置にあるかを記録する
		// こうすることで、要素サイズや画面サイズが変わっても中心位置を正しく再現できる
		const centerX = this._saveRect.left + this._saveRect.width / 2;
		const centerY = this._saveRect.top + this._saveRect.height / 2;
		this._saveRelativePos.xRate = centerX / window.innerWidth;
		this._saveRelativePos.yRate = centerY / window.innerHeight;



	}

	//位置復元
	restorePosition()
	{
		if (!this.container)
			return;

		// 現在の要素サイズを取得（中心位置からleft/topへ逆算するために必要）
		const rect = this.container.getBoundingClientRect();

		// 保存しておいた「中心点の割合」から、現在の画面サイズにおける中心座標を求める
		const centerX = window.innerWidth * this._saveRelativePos.xRate;
		const centerY = window.innerHeight * this._saveRelativePos.yRate;

		// 中心座標から要素幅・高さの半分を引いて、left/topの値に変換する
		let newLeft = centerX - rect.width / 2;
		let newTop = centerY - rect.height / 2;

		// bottom/right や transform による影響を打ち消す場合は以下を指定
		this.container.style.bottom = 'auto';
		this.container.style.transform = 'none';

		// CSSのスタイルを更新（transform等で中央寄せしている場合は記述に合わせて調整）
		this.container.style.left = `${newLeft}px`;
		this.container.style.top = `${newTop}px`;
	}

	//はみ出しを戻す
	insideScreen()
	{
		if (!this.container)
			return;

		// visualViewportが使える場合は、アドレスバー等を除いた実際の表示領域の高さを使う
		const currentWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
		const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

		const rect = this.container.getBoundingClientRect();

		// style.leftは"100px"のような文字列なので、parseFloatで数値に変換する
		let newLeft = parseFloat(rect.left) || 0;
		let newTop = parseFloat(rect.top) || 0;

		// はみ出し判定には要素自身の幅・高さが必要なので取得しておく
		const elemWidth = rect.width;
		const elemHeight = rect.height;

		// 画面内からはみ出ないように座標を補正 (0 ～ 画面幅-要素幅)
		const maxLeft = Math.max(0, currentWidth - elemWidth);
		const maxTop = Math.max(0, currentHeight - elemHeight);

		newLeft = Math.min(Math.max(0, newLeft), maxLeft);
		newTop = Math.min(Math.max(0, newTop), maxTop);

		// bottom/right や transform による影響を打ち消す場合は以下を指定
		this.container.style.bottom = 'auto';
		this.container.style.transform = 'none';

		// 補正後の位置を適用
		this.container.style.left = `${newLeft}px`;
		this.container.style.top = `${newTop}px`;

	}

	//ブラウザのアドレスを消して全画面表示 -1=auto ,1=full,2=解除
	async restoreFullScreen(flg = -1)
	{
		// フルスクリーン前の位置とサイズ割合を記憶
		this.savePosition();

		// フルスクリーン切替（完了を await で待つ）
		await fullScreen(flg);

		// 画面リサイズイベントの完了を待機
		await waitForResize();

		// 新しい画面サイズに基づいて位置を復元および補正
		this.restorePosition();
		this.insideScreen();
	}
}

//ウィンドウクラス追加 呼び出し
export function init()
{
	//ウィンドウコンテナ作成
	chatWindow = new WindowController({ container: '#chatArea', drager: '#chatLog', minWidth: 300, minHeight: 90, childLock: true, defaultDisplay: 'flex' });
	debugWindow = new WindowController({ container: '#debugInfo', defaultDisplay: "block" });
	leftStatusWindow = new WindowController({ container: '#leftStatus', defaultDisplay: "flex" });

	windows.push(chatWindow);


	//左ステータス

	// 開閉ボタンの要素と、開閉対象の箱の要素を取得
	for (let el of leftStatusBtns)
	{
		// 開閉ボタンがクリックされたら
		el.addEventListener("click", () =>
		{
			el.classList.toggle("downed");
		});
	}
	//ステータスタブが初期値
	leftStatusTab.classList.toggle("downed");

	leftOpen.addEventListener("click", () =>
	{
		if (leftStatus.style.display === 'none')
			leftStatus.style.display = '';
		else
			leftStatus.style.display = 'none';
	});


	//右メニュー

	// 開閉ボタンの要素と、開閉対象の箱の要素を取得
	const rightMenuOpenBtn = document.getElementById("rightMenuOpen");
	// 開閉ボタンがクリックされたら
	rightMenuOpenBtn.addEventListener("click", () =>
	{
		rightMenuButtons.classList.toggle("closed");
	});


	//canvasサイズ初期化
	repaint();
}


//リサイズイベントを待つ
// 画面のリサイズイベント完了を待つ非同期ヘルパー関数
export function waitForResize(timeout = 100)
{
	return new Promise((resolve) =>
	{
		const onResize = () =>
		{
			window.removeEventListener('resize', onResize);
			resolve();
		};
		window.addEventListener('resize', onResize);

		// リサイズイベントがすでに発火済み、または発火しない場合のためのタイマー
		setTimeout(() =>
		{
			window.removeEventListener('resize', onResize);
			resolve();
		}, timeout);
	});
}

//ブラウザのアドレスを消して全画面表示 -1=auto ,1=full,2=解除
export async function fullScreen(flg = -1)
{
	//自動
	if (flg == -1)
		flg = !(document.fullscreenElement);

	try
	{
		if (flg)
		{
			// Promise を返して待機可能にする
			await document.documentElement.requestFullscreen();
		}
		else if (document.fullscreenElement)
		{
			await document.exitFullscreen();
		}
	}
	catch (err)
	{
		console.log("全画面化の切替に失敗しました:", err);
	}
}

//ウィンドウリサイズ時の再描画
export function repaint()
{
	// 実際にサイズが変わっていなければ何もしない（無駄なリセット＝チラつきを防ぐ）
	if (canvas.width === window.innerWidth && canvas.height === window.innerHeight)
		return;

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
}




// 画面リサイズへの対応
window.addEventListener('resize', () =>
{
	//キャンバスリフレッシュ
	repaint();
});

// ページ読み込み時
window.addEventListener('load', () =>
{
	// ページの準備が完全に整ってからフォーカスを当てる
	//engine.canvas.focus();

	//(いまいち) ページ全体のスクロールを左上(0,0)にリセットする
	//window.scrollTo(0, 0);

	//入力DOMのクリック時の自動スクロールを止めてフォーカスする
	for (let el of [chatWhisperInput, chatInput])
		el.addEventListener("mousedown", (e) => (e.preventDefault(), el.focus({ preventScroll: true })));
});

// タブが切り替わったり別ウィンドウに移った
window.addEventListener('blur', () =>
{
});

//メニューが表示されたとき
document.addEventListener('contextmenu', (e) =>
{
	//addLog("warning", "contextmenu");
	//ブラウザの標準右クリックメニューが出ないようにする
	e.preventDefault();
});



export function mousemove(e)
{
	//if (activeWindow)
	//	activeWindow.handleMouseMove(e);
	//全ウィンドウクラスの移動・リサイズ
	//windows.forEach(win => win.handleMouseMove(e));
}

export function mouseup(e)
{
	//if (activeWindow)
	//	activeWindow.handleMouseUp(e);

	//全ウィンドウクラスの移動・リサイズ
	//windows.forEach(win => win.handleMouseUp(e));
}

