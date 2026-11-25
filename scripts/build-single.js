// Construiește Catedra.html – un singur fișier care rulează în orice browser, fără instalare.
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
let html = src('index.html')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${src('styles.css')}\n</style>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${src('app.js').replace(/<\/script/gi, '<\\/script')}\n</script>`);
const out = path.join(__dirname, '..', 'Catedra.html');
fs.writeFileSync(out, html);
console.log('Scris:', out, Math.round(html.length / 1024) + ' KB');
