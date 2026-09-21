const CACHE_NAME = 'tales-beaver-v1';
// キャッシュするファイルのリスト　service-worker.jsファイルからの相対パスで指定
const urlsToCache = [
	// ルートページ(アプリの入口。manifestのstart_urlもこれ)
	'./index.html',
	// ゲーム本編の画面
	'./game.html',

	// PWA設定ファイル自体もキャッシュしておく
	'./manifest.json',

	// スタイルシート(CSS)一式 ※game.htmlが読み込んでいるもの全部
	'./css/game.css',
	'./css/resize.css',
	'./css/chat.css',
	'./css/rightMenu.css',
	'./css/leftStatus.css',
	'./css/leftQuickSlot.css',

	// ゲーム本体のJavaScript(ESモジュール)一式
	'./game.js',
	'./engine.js',
	'./player.js',
	'./animator.js',
	'./input.js',
	'./scroll.js',
	'./sound.js',
	'./utils2.js',
	'./windows.js',
	'./world.js',
	'./ws_bin_client.js',

	// client以外から読み込まれている共通スクリプト(import '../shared/xxx.js')
	'../shared/sub.js',
	'../shared/config.js',

	// アイコン画像(manifest.jsonとhtmlのlink rel="icon"で使用)
	'/assets/icon.png',
	'/assets/icon.ico',
];

// 1. インストールイベント (Service Worker登録時に実行)
self.addEventListener('install', (event) =>
{
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) =>
			{
				console.log('Opened cache');
				// 指定されたファイルをすべてキャッシュする
				return cache.addAll(urlsToCache);
			})
			.catch((error) =>
			{
				console.log('Cache installation failed:', error);
			})
	);
});

// 2. フェッチイベント (リクエスト送信時に実行) - キャッシュファースト
self.addEventListener('fetch', (event) =>
{
	event.respondWith(
		caches.match(event.request)
			.then((response) =>
			{
				// キャッシュにあればそれを返し、なければネットワークから取得
				return response || fetch(event.request);
			})
	);
});

// 3. アクティベートイベント (Service Workerが有効になった時に実行)
self.addEventListener('activate', (event) =>
{
	const cacheWhitelist = [CACHE_NAME];
	event.waitUntil(
		caches.keys().then((cacheNames) =>
		{
			return Promise.all(
				cacheNames.map((cacheName) =>
				{
					// CACHE_NAME (v1) 以外の古いキャッシュ(v0など)を削除する
					if (cacheWhitelist.indexOf(cacheName) === -1)
					{
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
});
