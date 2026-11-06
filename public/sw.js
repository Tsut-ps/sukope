/* sukope のオフライン対応。画面そのもの(HTML と assets/)だけを保存し、音声は保存しない。 */
const CACHE = 'sukope';
const STATIC = ['/', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-touch-icon.png'];

/** HTML が参照している assets/ のパス */
const assetsIn = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);

/** 参照されなくなった assets/ を捨てる */
async function prune(cache, keep) {
  for (const req of await cache.keys()) {
    const p = new URL(req.url).pathname;
    if (p.startsWith('/assets/') && !keep.has(p)) await cache.delete(req);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('/', { cache: 'reload' });
      const html = await res.clone().text();
      await cache.put('/', res);
      await cache.addAll([...STATIC.slice(1), ...assetsIn(html)]);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    // 画面は、つながっていれば最新を取り、だめなら保存したものを出す
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res.ok && url.pathname === '/') {
            // 返す前に、保存用の複製を先に作っておく(返したあとでは本体を読めない)
            const forCache = res.clone();
            const forScan = res.clone();
            e.waitUntil(
              (async () => {
                await cache.put('/', forCache);
                await prune(cache, new Set(assetsIn(await forScan.text())));
              })(),
            );
          }
          return res;
        } catch {
          return (await cache.match('/')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // assets/ は名前に内容のハッシュが入っているので、保存したものをそのまま使う。それ以外は取り直しつつ、保存したものを先に出す
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit && url.pathname.startsWith('/assets/')) return hit;
      const net = fetch(req)
        .then((res) => {
          if (res.ok) void cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? net;
    })(),
  );
});
