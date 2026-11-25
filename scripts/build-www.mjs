// Copies the static app into www/ — the folder that GitHub Pages and the Android app both serve.
import { cp, rm, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const out = new URL('www/', root);
const files = ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'css', 'js', 'fonts'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of files) await cp(new URL(f, root), new URL(f, out), { recursive: true });
console.log('www/ ready');
