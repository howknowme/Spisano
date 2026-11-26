// node tts-gemini.mjs <voice> <out.wav> <model> -- "<text>"   (key: GEMINI_KEY_FILE)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
process.env.GEMINI_API_KEY = readFileSync(process.env.GEMINI_KEY_FILE, "utf8").trim();
const { synthesizeGemini } = await import("/root/.claude/plugins/synced/16bacd01-35d0-4f23-b8d0-d114a75f255b_48d59c8c-fbd8-48a4-9109-ff406aad4c85/hyperframes/skills/media-use/audio/scripts/lib/gemini-tts.mjs");
const [voice, out, model] = process.argv.slice(2, 5);
const text = process.argv.slice(process.argv.indexOf("--") + 1).join(" ");
const style = process.env.TTS_STYLE || undefined;
const r = await synthesizeGemini({ text, voiceId: voice, model, style, wavAbs: resolve(out) });
console.log(JSON.stringify(r).slice(0, 300));
