import { defaultCache, NetworkFirst } from '@serwist/next/worker';
import { Serwist } from 'serwist';

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
