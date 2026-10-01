// Embaresa QC — Service Worker
// Versão: incrementar quando publicar nova versão para forçar update no telemóvel/tablet
const CACHE_VERSION = 'embaresa-qc-v1-8-6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Install: precachear assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: limpar caches antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch:
//  - HTML/navegacao (index.html): NETWORK-FIRST — tenta sempre a versao fresca do servidor,
//    e so cai na cache quando esta offline. Assim uma versao nova pega logo (nao fica presa em cache).
//  - Restantes recursos locais (icones, manifest): cache-first (rapido; mudam com o bump da versao).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;

  if (!isOwnOrigin) {
    // Pedidos a dominios externos (ex: fluxos Power Automate) — passar directo, nao cachear
    return;
  }

  const isHTML = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isHTML) {
    // NETWORK-FIRST
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', clone));
        }
        return response;
      }).catch(() =>
        // Sem rede — servir a ultima versao em cache
        caches.match(event.request).then((c) => c || caches.match('./index.html'))
      )
    );
    return;
  }

  // CACHE-FIRST para o resto
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Mensagem opcional do app para forcar update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
