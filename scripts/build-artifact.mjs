// Bundles the app into one self-contained HTML fragment (no service worker),
// used for the hosted claude.ai preview: node scripts/build-artifact.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const [html, css, core, i18n, app] = await Promise.all([
  read('index.html'), read('css/app.css'), read('js/core.js'), read('js/i18n.js'), read('js/app.js'),
]);

const body = html.split('<!--APP-START-->')[1].split('<!--APP-END-->')[0];
const coreNames = [...core.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
const coreBundle = `const C = (() => {\n${core.replace(/^export /gm, '')}\nreturn { ${coreNames.join(', ')} };\n})();`;
const i18nBundle = i18n.replace(/^export /gm, '');
const appBundle = app.replace(/^import .*$/gm, '');
const icon = Buffer.from(await read('icon.svg')).toString('base64');

const out = `<title>Subly</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="icon" href="data:image/svg+xml;base64,${icon}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Manrope:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
${body.trim()}
<script type="module">
window.__SUBLY_NO_SW__ = true;
${coreBundle}
${i18nBundle}
${appBundle}
</script>
`;
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/subly.html', root), out);
console.log('dist/subly.html', (out.length / 1024).toFixed(1) + ' KB');
