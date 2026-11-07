import { defaultCache } from '@serwist/next/worker';
import { NetworkFirst, Serwist } from 'serwist';

// NOTE: `NetworkFirst` lives in `serwist`, NOT in `@serwist/next/worker`
// (that entry only re-exports `defaultCache` and `PAGES_CACHE_NAME`). Importing
// it from the wrong place yields `undefined`, so `new NetworkFirst(...)`
// threw a TypeError and the whole worker died before `addEventListeners()`
// ran — meaning an older worker, if the browser had one, could never be
// replaced and kept serving the stale bundle indefinitely.

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Scripts and stylesheets must come from the network first. Serwist's
    // default runtime cache is cache-first for static assets, which meant a
    // worker installed by an earlier `pnpm build` went on serving the OLD
    // JS/CSS bundle to `pnpm dev` long after the source had changed — the
    // page rendered stale markup with no error anywhere to hint at why.
    // Network-first fixes that: the cached copy is only a fallback for when
    // the network is actually unreachable.
    {
      matcher: ({ request }) => request.destination === 'script' || request.destination === 'style',
      handler: new NetworkFirst({ cacheName: 'polyattend-assets' }),
    },
    {
      matcher: ({ request, url }) => request.destination === 'document' || url.pathname.startsWith('/api/'),
      handler: new NetworkFirst({ cacheName: 'polyattend-pages' }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
