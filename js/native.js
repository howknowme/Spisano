// Native features for the Android app (Capacitor). Every function is a no-op in a browser.

const cap = () => window.Capacitor;
const plugin = (name) => cap()?.Plugins?.[name];

export function isNative() {
  return !!cap()?.isNativePlatform?.();
}

/** Writes a file to the app cache and opens the system share sheet (save to Files, Drive, Calendar…). */
export async function saveFile(name, text, title) {
  const fs = plugin('Filesystem');
  const share = plugin('Share');
  const res = await fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
  try {
    await share.share({ title, dialogTitle: title, files: [res.uri] });
  } catch (e) {
    if (!/cancel/i.test(String(e?.message || e))) throw e;
  }
}

// ---------- scheduled reminders ----------

const CHANNEL = 'reminders';

export async function notificationState() {
  const ln = plugin('LocalNotifications');
  if (!ln) return 'unsupported';
  try { return (await ln.checkPermissions()).display; } catch { return 'unsupported'; }
}

export async function requestNotifications() {
  const ln = plugin('LocalNotifications');
  if (!ln) return 'unsupported';
  try { return (await ln.requestPermissions()).display; } catch { return 'denied'; }
}

function hashId(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1; // positive 31-bit int, as Android requires
}

let channelReady = false;
let syncing = Promise.resolve();

/**
 * Replaces all pending reminders with `items`: [{ key, title, body, at: Date }].
 * Android fires them even when the app is closed.
 */
export function syncReminders(items, channelName) {
  syncing = syncing.then(async () => {
    const ln = plugin('LocalNotifications');
    if (!ln || (await notificationState()) !== 'granted') return;
    if (!channelReady) {
      try { await ln.createChannel({ id: CHANNEL, name: channelName, importance: 4, visibility: 1, vibration: true }); } catch { /* old Android */ }
      channelReady = true;
    }
    const pending = await ln.getPending();
    if (pending.notifications.length) await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const now = Date.now();
    const list = items.filter((n) => n.at.getTime() > now + 30000).slice(0, 64).map((n) => ({
      id: hashId(n.key), title: n.title, body: n.body, channelId: CHANNEL,
      smallIcon: 'ic_stat_subly', iconColor: '#2f46d0',
      schedule: { at: n.at, allowWhileIdle: true },
      extra: { view: 'overview' },
    }));
    if (list.length) await ln.schedule({ notifications: list });
  }).catch(() => { /* keep the app usable if scheduling fails */ });
  return syncing;
}

// ---------- system UI ----------

export function onBackButton(handler) {
  const app = plugin('App');
  if (!app) return;
  app.addListener('backButton', handler);
}

export function minimizeApp() {
  plugin('App')?.minimizeApp?.();
}

export function onResume(handler) {
  plugin('App')?.addListener('resume', handler);
}

export async function setStatusBar(bgColor, darkBackground) {
  const sb = plugin('StatusBar');
  if (!sb) return;
  try {
    await sb.setOverlaysWebView({ overlay: false });
    await sb.setBackgroundColor({ color: bgColor });
    await sb.setStyle({ style: darkBackground ? 'DARK' : 'LIGHT' });
  } catch { /* not critical */ }
}
