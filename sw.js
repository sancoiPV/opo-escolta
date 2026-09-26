// OpoÀudio — service worker
const VERSIO = "c937146247";
const SHELL = "shell-" + VERSIO;
const AUDIO = "audio-v1"; // es manté entre versions: els temes descarregats no es perden
const FITXERS = ["./", "index.html", "manifest.webmanifest", "icona-192.png", "icona-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FITXERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k.startsWith("shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function ambRang(req, resp) {
  const rang = req.headers.get("range");
  if (!rang) return resp;
  const buf = await resp.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(rang) || [];
  const mida = buf.byteLength;
  let ini = m[1] ? parseInt(m[1], 10) : 0;
  let fi = m[2] ? parseInt(m[2], 10) : mida - 1;
  if (!m[1] && m[2]) { ini = mida - parseInt(m[2], 10); fi = mida - 1; }
  fi = Math.min(fi, mida - 1);
  return new Response(buf.slice(ini, fi + 1), {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(fi - ini + 1),
      "Content-Range": `bytes ${ini}-${fi}/${mida}`,
      "Accept-Ranges": "bytes"
    }
  });
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  if (url.pathname.includes("/audio/")) {
    e.respondWith((async () => {
      const c = await caches.open(AUDIO);
      const r = await c.match(url.pathname, { ignoreSearch: true });
      return r ? ambRang(e.request, r) : fetch(e.request);
    })());
    return;
  }

  if (url.pathname.endsWith("temes.json")) {
    // xarxa primer, per a rebre temes nous; si no hi ha connexió, la còpia guardada
    e.respondWith(fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(SHELL).then(c => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }

  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
