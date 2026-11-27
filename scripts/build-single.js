// Construiește Catedra.html – un singur fișier care rulează în orice browser (și în aplicația Android).
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const html = src('index.html')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${src('styles.css')}\n</style>`)
  .replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>\n${src(f).replace(/<\/script/gi, '<\\/script')}\n</script>`);
const out = process.argv[2] || path.join(__dirname, '..', 'Catedra.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Scris:', out, Math.round(html.length / 1024) + ' KB');
