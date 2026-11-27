// Builds the GitHub Pages site into _site/: the landing page at the root, the web app under /app/.
// The Android app is unaffected: it still packages www/ from build-www.mjs.
import { cp, rm, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const out = new URL('_site/', root);

execFileSync(process.execPath, [new URL('scripts/build-www.mjs', root).pathname], { stdio: 'inherit' });

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL('site/', root), out, { recursive: true });
await cp(new URL('www/', root), new URL('app/', out), { recursive: true });
for (const f of ['privacy.html', 'icon.svg', 'icon-192.png', 'icon-512.png', 'fonts']) {
  await cp(new URL(f, root), new URL(f, out), { recursive: true });
}

// The app used to live at the root with a service worker scoped there. This replacement
// takes over that old registration once and removes it, so the landing page isn't served from its cache.
await writeFile(new URL('sw.js', out), `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.registration.unregister()));
`);
console.log('_site/ ready');
