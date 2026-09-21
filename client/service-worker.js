/*キャッシュメモ
web.js側のCache-Controlまわりは「通常のHTTP通信での、ブラウザ標準のキャッシュ挙動」の話
service-worker.js側のcachesは「オフラインでも動かすための、独自に用意したキャッシュの仕組み」
*/

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


// ページがファイルを読み込もうとするたびに呼ばれる処理
self.addEventListener('fetch', (event) =>
{
	event.respondWith(
		// ①まずネットワーク(サーバー)から最新のファイルを取りに行く
		fetch(event.request)
			.then((networkResponse) =>
			{
				// 取得できたら、次回オフライン時のためにキャッシュを最新の内容で上書きしておく
				return caches.open(CACHE_NAME).then((cache) =>
				{
					cache.put(event.request, networkResponse.clone());
					return networkResponse;
				});
			})
			.catch(() =>
			{
				// ②サーバーに繋がらなかった(オフライン)時だけキャッシュを見に行く
				return caches.match(event.request).then((cachedResponse) =>
				{
					// キャッシュにも無ければ、せめてトップページだけは表示できるようにする保険
					return cachedResponse || caches.match('./index.html');
				});
			})
	);
});

// service worker が有効化された時の処理
self.addEventListener('activate', (event) =>
{
	const cacheWhitelist = [CACHE_NAME];
	event.waitUntil(
		caches.keys()
			.then((cacheNames) =>
			{
				return Promise.all(
					cacheNames.map((cacheName) =>
					{
						// CACHE_NAME(最新版)以外の古いキャッシュを削除する
						if (cacheWhitelist.indexOf(cacheName) === -1)
							return caches.delete(cacheName);
					})
				);
			})
			// 有効化が終わった時点で、今開いているページもすぐ新しいService Workerの管理下に置く
			.then(() => self.clients.claim())
	);
});