'use strict';
/* Catedra pe Android (Capacitor): tipărire nativă, partajare fișiere, copie a datelor în memoria internă,
   butonul „Înapoi”. În browser sau pe calculator acest fișier nu face nimic. */
(function () {
  const Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  const Filesystem = Cap.registerPlugin('Filesystem');
  const Share = Cap.registerPlugin('Share');
  const App = Cap.registerPlugin('App');
  const Printer = Cap.registerPlugin('CatedraPrint');
  const DATA_FILE = 'catedra-date.json';
  const KEY = 'catedra-date';

  // Datele stau în localStorage; o copie se scrie și în memoria internă a aplicației.
  // Dacă sistemul golește localStorage, datele se recuperează automat din fișier.
  window.desktopReady = (async () => {
    let has = false;
    try { has = !!localStorage.getItem(KEY); } catch (e) {}
    if (!has) {
      try {
        const r = await Filesystem.readFile({ path: DATA_FILE, directory: 'DATA', encoding: 'utf8' });
        if (r && r.data) localStorage.setItem(KEY, r.data);
      } catch (e) { /* prima pornire */ }
    }
  })();

  let mirrorTimer = null, lastJson = null;
  const writeMirror = () => { if (lastJson != null) Filesystem.writeFile({ path: DATA_FILE, data: lastJson, directory: 'DATA', encoding: 'utf8' }).catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(mirrorTimer); writeMirror(); } });

  const PRINT_CSS = `body{font-family:sans-serif;font-size:11pt;color:#000;margin:0}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:3px 5px;text-align:left;vertical-align:top}
    h1,h2,h3{margin:6px 0}.page-break{page-break-after:always}`;

  window.mobile = {
    mirror(json) { lastJson = json; clearTimeout(mirrorTimer); mirrorTimer = setTimeout(writeMirror, 1500); },
    async print(html) {
      const doc = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>${html}</body></html>`;
      try { await Printer.print({ html: doc, name: 'Catedra' }); } catch (e) { toast('Tipărirea nu este disponibilă: ' + (e.message || e)); }
    },
    async exportFile(name, content) {
      try {
        const safe = name.replace(/[^\w.\-ăâîșțĂÂÎȘȚ]+/g, '_');
        const r = await Filesystem.writeFile({ path: safe, data: content, directory: 'CACHE', encoding: 'utf8' });
        await Share.share({ title: safe, dialogTitle: 'Trimite sau salvează fișierul', files: [r.uri] });
      } catch (e) { if (!/cancel/i.test(String(e.message || e))) toast('Fișierul nu a putut fi partajat'); }
    }
  };

  App.addListener('backButton', () => {
    if (!document.querySelector('#modal').classList.contains('hidden')) return closeModal();
    if (typeof current !== 'undefined' && current !== 'acasa') return go('acasa');
    App.exitApp();
  });
  App.addListener('resume', () => { try { Sync.syncNow(); } catch (e) {} });
})();
