#!/usr/bin/env python3
"""Generates three vertical TikTok HyperFrames projects for recruiting Subly testers.

Shared look: Subly ultramarine / near-black grounds, Unbounded display + Manrope body,
real app screenshots in a phone frame, one shared call-to-action scene.
Run: python3 build.py  (then check / render each project)
"""
import json, os, re, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SHARED = os.path.join(ROOT, 'shared', 'assets')
W, H = 1080, 1920

# ---------- fonts: reuse the unicode ranges from the app's own fonts.css ----------
src_css = open('/home/user/subly/fonts/fonts.css', encoding='utf8').read()
faces = []
for block in re.findall(r'@font-face\s*\{[^}]*\}', src_css):
    m = re.search(r"url\(\./([^)]+)\)", block)
    if not m or not os.path.exists(os.path.join(SHARED, 'fonts', m.group(1))):
        continue
    faces.append(block.replace(f"url(./{m.group(1)})", f"url('assets/fonts/{m.group(1)}')"))
FONTS = '\n'.join(faces)

BASE_CSS = """
  #root { position: absolute; inset: 0; overflow: hidden; font-family: 'Manrope', sans-serif; color: #fff; }
  .bg { position: absolute; inset: 0; }
  .display { font-family: 'Unbounded', sans-serif; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
  .center { position: absolute; left: 120px; width: 660px; text-align: center; }
  .phone { position: absolute; width: 400px; height: 866px; left: 250px; border-radius: 54px; overflow: hidden;
           box-shadow: 0 0 0 12px #0b0e1a, 0 40px 90px rgba(0,0,0,.45); background: #0b0e1a; }
  .phone img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
"""


def scene(cid, css, body, script):
    return f"""<template>
  <style>
{FONTS}
{BASE_CSS}
{css}
  </style>
  <div id="root" data-composition-id="{cid}" data-width="{W}" data-height="{H}">
{body}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{script}
    window.__timelines["{cid}"] = tl;
  </script>
</template>
"""


def index(title, scenes, variables, music=None, voice=()):
    total = round(sum(d for _, d in scenes), 2)
    hosts, t = [], 0.0
    for cid, dur in scenes:
        hosts.append(f'''      <div id="{cid}" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html"
        data-start="{round(t, 2)}" data-duration="{dur}" data-track-index="1" data-track-kind="graphics"
        data-width="{W}" data-height="{H}"></div>''')
        t += dur
    for i, (f, start, dur, cid) in enumerate(voice):
        hosts.append(f'''      <audio id="vo-{i}" class="clip" src="assets/voice/{f}" data-start="{start}" data-duration="{dur}" data-volume="1" data-fade-in="0.02" data-fade-out="0.05" data-track-index="2"></audio>''')
    if music:
        f, offset, vol = music
        if voice:
            vol = round(vol * 0.38, 3)  # bed sits under the voice
        hosts.append(f'''      <audio id="bed" class="clip" src="assets/music/{f.replace('.mp3', '.m4a')}" data-start="0" data-duration="{total}"
        data-media-start="{offset}" data-volume="{vol}" data-fade-in="0.3" data-fade-out="1.2" data-track-index="3"></audio>''')
    return f"""<!doctype html>
<html lang="ru" data-composition-variables='{json.dumps(variables, ensure_ascii=False)}'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: #0f1218; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="{W}" data-height="{H}">
{chr(10).join(hosts)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""


# ---------- shared call-to-action scene (5 s) ----------
def cta(cid):
    dots = '\n'.join(f'      <span class="dot" id="{cid}-d{i}"></span>' for i in range(12))
    css = f"""
  #{cid}-bg {{ background: radial-gradient(120% 70% at 50% 30%, #3a52e0 0%, #2f46d0 45%, #1b2a8f 100%); }}
  #{cid}-logo {{ position: absolute; left: 375px; top: 300px; width: 150px; height: 150px; }}
  #{cid}-logo svg {{ width: 150px; height: 150px; display: block; border-radius: 35px; box-shadow: 0 0 0 4px rgba(255,255,255,.35); }}
  #{cid}-t1 {{ top: 490px; font-size: 64px; }}
  #{cid}-dots {{ position: absolute; left: 230px; width: 440px; top: 730px; display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }}
  .dot {{ width: 56px; height: 56px; border-radius: 50%; border: 4px dashed rgba(255,255,255,.55); display: block; }}
  #{cid}-t2 {{ top: 920px; font-size: 42px; font-weight: 700; line-height: 1.25; }}
  #{cid}-t2 b {{ color: #ffd36b; }}
  #{cid}-t3 {{ top: 1150px; font-size: 32px; font-weight: 500; opacity: .85; }}
"""
    icon = open(os.path.join(SHARED, 'icon.svg'), encoding='utf8').read()
    body = f"""    <div id="{cid}-bg" class="bg"></div>
    <div id="{cid}-logo">{icon}</div>
    <h1 id="{cid}-t1" class="center display">Нужны 12 тестировщиков</h1>
    <div id="{cid}-dots">
{dots}
    </div>
    <p id="{cid}-t2" class="center">Напиши <b>«хочу»</b> в комментариях —<br>пришлю ссылку</p>
    <p id="{cid}-t3" class="center">Android · бесплатно · без регистрации</p>"""
    script = f"""    tl.fromTo("#{cid}-logo", {{ scale: 0.6, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)" }}, 0);
    tl.fromTo("#{cid}-t1", {{ y: 40, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }}, 0.15);
    for (let i = 0; i < 12; i++) {{
      tl.fromTo("#{cid}-d" + i, {{ scale: 0.4, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.22, ease: "back.out(2.5)" }}, 0.5 + i * 0.07);
    }}
    tl.fromTo("#{cid}-t2", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }}, 1.5);
    tl.fromTo("#{cid}-t3", {{ opacity: 0 }}, {{ opacity: 0.85, duration: 0.4 }}, 1.9);
    tl.fromTo("#{cid}-t2", {{ scale: 1 }}, {{ scale: 1.06, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: 3 }}, 2.6);"""
    return scene(cid, css, body, script)


CTA_VARS = [
    {"id": "ctaTitle", "type": "string", "label": "CTA title", "default": "Нужны 12 тестировщиков"},
    {"id": "ctaAsk", "type": "string", "label": "CTA ask", "default": "Напиши «хочу» в комментариях — пришлю ссылку"},
    {"id": "ctaNote", "type": "string", "label": "CTA note", "default": "Android · бесплатно · без регистрации"},
]


def phone(id_, img):
    return f'<div id="{id_}" class="phone" data-layout-allow-overflow><img id="{id_}-img" src="assets/{img}" alt=""></div>'


# =====================================================================
# A — «Число»: a number lands
# =====================================================================
def video_a():
    s = {}
    s['a-hook'] = scene('a-hook', """
  #a-hook-bg { background: #0f1218; }
  #a-hook-t1 { top: 520px; font-size: 84px; }
  #a-hook-t1 span { color: #8796ff; }
  #a-hook-t2 { top: 1010px; font-size: 40px; font-weight: 600; opacity: .7; }
""", """    <div id="a-hook-bg" class="bg"></div>
    <h1 id="a-hook-t1" class="center display">Сколько ты тратишь на <span>подписки</span>?</h1>
    <p id="a-hook-t2" class="center">Посчитай честно 👇</p>""", """
    tl.fromTo("#a-hook-t1", { scale: 1 }, { scale: 1.04, duration: 2.6, ease: "none" }, 0);
    tl.fromTo("#a-hook-t2", { y: 20, opacity: 0 }, { y: 0, opacity: 0.7, duration: 0.35, ease: "power3.out" }, 0.9);""")

    chips = [('Яндекс Плюс', '399 ₽'), ('Spotify', '6 $'), ('ChatGPT', '20 $'), ('Связь', '650 ₽'),
             ('Интернет', '700 ₽'), ('Фитнес', '3 500 ₽'), ('ЖКХ', '5 200 ₽'), ('Литрес', '399 ₽')]
    chip_html = '\n'.join(f'      <span class="chip" id="a-count-c{i}">{n} <b>{p}</b></span>' for i, (n, p) in enumerate(chips))
    s['a-count'] = scene('a-count', """
  #a-count-bg { background: #0f1218; }
  #a-count-chips { position: absolute; left: 120px; width: 660px; top: 330px; display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
  .chip { display: inline-block; padding: 12px 20px; border-radius: 999px; background: #1d2230; font-size: 30px; font-weight: 600; color: #c9d0e3; }
  .chip b { color: #fff; }
  #a-count-num { top: 760px; font-size: 116px; font-variant-numeric: tabular-nums; }
  #a-count-sub { top: 930px; font-size: 44px; font-weight: 700; color: #9aa3b5; }
  #a-count-year { top: 1050px; font-size: 52px; color: #ffd36b; }
  #a-count-note { top: 1190px; font-size: 28px; color: #6d768a; }
""", f"""    <div id="a-count-bg" class="bg"></div>
    <div id="a-count-chips">
{chip_html}
    </div>
    <h2 id="a-count-num" class="center display">0 ₽</h2>
    <p id="a-count-sub" class="center">в месяц</p>
    <p id="a-count-year" class="center display">166 001 ₽ в год 😳</p>
    <p id="a-count-note" class="center">пример из приложения</p>""", f"""
    for (let i = 0; i < {len(chips)}; i++) {{
      tl.fromTo("#a-count-c" + i, {{ y: 24, opacity: 0, scale: 0.8 }}, {{ y: 0, opacity: 1, scale: 1, duration: 0.22, ease: "back.out(2)" }}, 0.1 + i * 0.17);
    }}
    const counter = {{ v: 0 }};
    const numEl = document.querySelector("#a-count-num");
    tl.fromTo(counter, {{ v: 0 }}, {{ v: 13833, duration: 1.6, ease: "power2.out",
      onUpdate: () => {{ numEl.textContent = Math.round(counter.v).toLocaleString("ru-RU").replace(/\\u00a0/g, " ") + " ₽"; }} }}, 0.2);
    tl.fromTo("#a-count-num", {{ scale: 1 }}, {{ scale: 1.08, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1 }}, 1.8);
    tl.fromTo("#a-count-sub", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, 0.4);
    tl.fromTo("#a-count-year", {{ y: 40, opacity: 0, scale: 0.9 }}, {{ y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }}, 2.3);
    tl.fromTo("#a-count-note", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, 2.5);""")

    s['a-app'] = scene('a-app', """
  #a-app-bg { background: linear-gradient(180deg, #2f46d0 0%, #1b2a8f 100%); }
  #a-app-t1 { top: 300px; font-size: 50px; }
  #a-app-ph { top: 470px; }
  #a-app-chip { position: absolute; left: 130px; top: 1110px; padding: 16px 26px; border-radius: 18px; background: #fff; color: #141821; font-size: 32px; font-weight: 700; box-shadow: 0 16px 40px rgba(0,0,0,.3); }
""", f"""    <div id="a-app-bg" class="bg"></div>
    <h2 id="a-app-t1" class="center display">Я сделал приложение, которое считает это</h2>
    {phone('a-app-ph', 'overview-light.png')}
    <div id="a-app-chip">🔔 Напомнит до списания</div>""", """
    tl.fromTo("#a-app-t1", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0);
    tl.fromTo("#a-app-ph", { y: 500, rotation: 6 }, { y: 0, rotation: 0, duration: 0.7, ease: "power4.out" }, 0.2);
    tl.fromTo("#a-app-ph-img", { y: 0 }, { y: -140, duration: 2.6, ease: "sine.inOut" }, 1.2);
    tl.fromTo("#a-app-chip", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "back.out(2)" }, 1.6);""")
    s['a-cta'] = cta('a-cta')
    order = [('a-hook', 2.6), ('a-count', 4.2), ('a-app', 4.2), ('a-cta', 5)]
    return 'a-number', 'Subly TikTok A — Число', s, order, ('a-bed.mp3', 9.95, 0.85)


# =====================================================================
# B — «Пробный период»: a moment in someone's day
# =====================================================================
def video_b():
    s = {}
    s['b-lock'] = scene('b-lock', """
  #b-lock-bg { background: radial-gradient(90% 60% at 50% 20%, #2b2f45 0%, #0f1218 70%); }
  #b-lock-time { top: 300px; font-size: 150px; font-weight: 500; font-family: 'Manrope', sans-serif; letter-spacing: -4px; }
  #b-lock-date { top: 490px; font-size: 34px; font-weight: 600; opacity: .7; }
  #b-lock-card { position: absolute; left: 130px; width: 640px; top: 620px; padding: 26px 30px; border-radius: 34px;
                 background: rgba(255,255,255,.14); backdrop-filter: blur(20px); }
  #b-lock-card .app { font-size: 28px; font-weight: 700; opacity: .7; }
  #b-lock-card .title { font-size: 38px; font-weight: 700; margin-top: 8px; }
  #b-lock-card .text { font-size: 32px; margin-top: 6px; opacity: .9; }
  #b-lock-t1 { top: 930px; font-size: 58px; }
  #b-lock-t2 { top: 1100px; font-size: 40px; font-weight: 600; opacity: .75; }
""", """    <div id="b-lock-bg" class="bg"></div>
    <p id="b-lock-time" class="center">08:12</p>
    <p id="b-lock-date" class="center">понедельник, 1 декабря</p>
    <div id="b-lock-card">
      <div class="app">💳 БАНК · сейчас</div>
      <div class="title">Списание 399 ₽</div>
      <div class="text">OKKO · подписка</div>
    </div>
    <h2 id="b-lock-t1" class="center display">Пробный период закончился 🙃</h2>
    <p id="b-lock-t2" class="center">И ты опять забыл его отменить</p>""", """
    tl.fromTo("#b-lock-card", { scale: 0.96 }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, 0.05);
    tl.fromTo("#b-lock-t2", { y: 20, opacity: 0 }, { y: 0, opacity: 0.75, duration: 0.35, ease: "power3.out" }, 3.75);
    tl.fromTo("#b-lock-time", { scale: 1 }, { scale: 1.08, duration: 6.5, ease: "none" }, 0);
    tl.fromTo("#b-lock-t1", { scale: 1 }, { scale: 1.05, duration: 6.5, ease: "none" }, 0);
    tl.fromTo("#b-lock-card", { x: 0 }, { x: 10, duration: 0.06, yoyo: true, repeat: 5, ease: "none" }, 0.6);""")

    s['b-save'] = scene('b-save', """
  #b-save-bg { background: linear-gradient(180deg, #2f46d0 0%, #1b2a8f 100%); }
  #b-save-t1 { top: 300px; font-size: 52px; }
  #b-save-ph { top: 470px; }
  #b-save-notif { position: absolute; left: 130px; width: 640px; top: 520px; padding: 22px 26px; border-radius: 28px;
                  background: #fff; color: #141821; box-shadow: 0 24px 60px rgba(0,0,0,.35); display: flex; gap: 18px; align-items: center; }
  #b-save-notif svg { width: 64px; height: 64px; flex: none; border-radius: 16px; }
  #b-save-notif .title { font-size: 30px; font-weight: 700; }
  #b-save-notif .text { font-size: 28px; margin-top: 2px; color: #3b4255; }
""", f"""    <div id="b-save-bg" class="bg"></div>
    <h2 id="b-save-t1" class="center display">А Subly напомнил бы за день</h2>
    {phone('b-save-ph', 'alerts-dark.png')}
    <div id="b-save-notif">{open(os.path.join(SHARED, 'icon.svg'), encoding='utf8').read()}
      <div><div class="title">Subly · завтра</div><div class="text">Okko: пробный период закончится завтра</div></div>
    </div>""", """
    tl.fromTo("#b-save-t1", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0);
    tl.fromTo("#b-save-ph", { y: 500 }, { y: 0, duration: 0.6, ease: "power4.out" }, 0.15);
    tl.fromTo("#b-save-notif", { y: -160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)" }, 1.0);""")

    s['b-tour'] = scene('b-tour', """
  #b-tour-bg { background: #0f1218; }
  #b-tour-t1, #b-tour-t2, #b-tour-t3 { top: 300px; font-size: 50px; }
  #b-tour-p1, #b-tour-p2, #b-tour-p3 { top: 470px; }
""", f"""    <div id="b-tour-bg" class="bg"></div>
    <h2 id="b-tour-t1" class="center display">Все подписки в одном месте</h2>
    <h2 id="b-tour-t2" class="center display">Календарь списаний</h2>
    <h2 id="b-tour-t3" class="center display">Прогноз на год</h2>
    {phone('b-tour-p1', 'list-dark.png')}
    {phone('b-tour-p2', 'calendar-dark.png')}
    {phone('b-tour-p3', 'forecast-dark.png')}""", """
    const beats = [0, 2.0, 4.0];
    beats.forEach((t, i) => {
      const n = i + 1;
      tl.fromTo("#b-tour-t" + n, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, t);
      tl.fromTo("#b-tour-p" + n, { x: 900 }, { x: 0, duration: 0.45, ease: "power4.out" }, t);
      if (i < 2) {
        tl.fromTo("#b-tour-t" + n, { opacity: 1 }, { opacity: 0, duration: 0.2, immediateRender: false }, t + 1.85);
        tl.fromTo("#b-tour-p" + n, { x: 0 }, { x: -900, duration: 0.4, ease: "power3.in", immediateRender: false }, t + 1.65);
      }
    });""")
    s['b-cta'] = cta('b-cta')
    order = [('b-lock', 3.6), ('b-save', 3.8), ('b-tour', 6.0), ('b-cta', 5)]
    return 'b-trial', 'Subly TikTok B — Пробный период', s, order, ('b-bed.mp3', 0, 0.8)


# =====================================================================
# C — «Один»: type carries the argument
# =====================================================================
def video_c():
    s = {}
    words = ['Я сделал приложение.', 'Один.', 'Без рекламы.', 'Без регистрации.', 'Бесплатно.']
    grounds = ['#2f46d0', '#0f1218', '#2f46d0', '#0f1218', '#2f46d0']
    times = [(0, 1.425), (1.425, 0.93), (2.355, 0.95), (3.305, 0.93), (4.235, 0.94)]
    blocks = []
    for i, (w, g, (t0, d)) in enumerate(zip(words, grounds, times)):
        blocks.append(f'''    <div id="c-type-b{i}" class="clip bg" data-start="{t0}" data-duration="{d}" data-track-index="0" style="background:{g}">
      <h1 id="c-type-w{i}" class="center display word">{w}</h1>
    </div>''')
    s['c-type'] = scene('c-type', """
  .word { top: 700px; font-size: 84px; }
  #c-type-w0 { font-size: 66px; top: 680px; }
  #c-type-w1 { font-size: 170px; top: 660px; color: #ffd36b; }
""", '\n'.join(blocks), """
    [1.425, 2.355, 3.305, 4.235].forEach((t, i) => {
      tl.fromTo("#c-type-w" + (i + 1), { scale: 1.25, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.22, ease: "power4.out" }, t);
    });
    tl.fromTo("#c-type-w0", { scale: 1 }, { scale: 1.05, duration: 1.425, ease: "none" }, 0);""")

    s['c-rule'] = scene('c-rule', """
  #c-rule-bg { background: #0f1218; }
  #c-rule-t1 { top: 330px; font-size: 52px; color: #c9d0e3; }
  #c-rule-num { top: 470px; font-size: 300px; color: #8796ff; line-height: 1; }
  #c-rule-t2 { top: 790px; font-size: 50px; }
  #c-rule-t3 { top: 1000px; font-size: 58px; color: #ffd36b; }
""", """    <div id="c-rule-bg" class="bg"></div>
    <p id="c-rule-t1" class="center display">Но Google Play требует</p>
    <h1 id="c-rule-num" class="center display">12</h1>
    <h2 id="c-rule-t2" class="center display">тестировщиков на 14 дней</h2>
    <h2 id="c-rule-t3" class="center display">А у меня — 0 😅</h2>""", """
    tl.fromTo("#c-rule-t1", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0);
    tl.fromTo("#c-rule-num", { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "power4.out" }, 0.5);
    tl.fromTo("#c-rule-t2", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 1.0);
    tl.fromTo("#c-rule-t3", { y: 30, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, 2.0);""")

    s['c-show'] = scene('c-show', """
  #c-show-bg { background: linear-gradient(180deg, #2f46d0 0%, #1b2a8f 100%); }
  #c-show-t1 { top: 300px; font-size: 50px; }
  #c-show-p1, #c-show-p2, #c-show-p3 { top: 470px; }
""", f"""    <div id="c-show-bg" class="bg"></div>
    <h2 id="c-show-t1" class="center display">Subly — трекер подписок</h2>
    {phone('c-show-p1', 'overview-light.png')}
    {phone('c-show-p2', 'calendar-light.png')}
    {phone('c-show-p3', 'alerts-light.png')}""", """
    tl.fromTo("#c-show-t1", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0);
    tl.fromTo("#c-show-p1", { y: 520 }, { y: 0, duration: 0.5, ease: "power4.out" }, 0.1);
    tl.fromTo("#c-show-p2", { y: 1500 }, { y: 0, duration: 0.45, ease: "power4.out" }, 1.1);
    tl.fromTo("#c-show-p3", { y: 1500 }, { y: 0, duration: 0.45, ease: "power4.out" }, 2.1);""")
    s['c-cta'] = cta('c-cta')
    order = [('c-type', 5.175), ('c-rule', 3.6), ('c-show', 3.2), ('c-cta', 5)]
    return 'c-solo', 'Subly TikTok C — Один разработчик', s, order, ('c-bed.mp3', 0, 0.95)


VOICE_MODEL = '/home/user/subly-tiktok/voices/ru_RU-dmitri-medium.onnx'
VOICE = {
    'a-number': {
        'a-hook': [(0.1, 'Сколько ты тратишь на подписки?')],
        'a-count': [(0.2, 'Почти четырнадцать тысяч в месяц.'), (2.35, 'А в год — сто шестьдесят шесть тысяч.')],
        'a-app': [(0.15, 'Поэтому я сделал приложение. Оно само всё считает и напоминает до списания.')],
        'a-cta': [(0.15, 'Оно бесплатное. Мне нужно двенадцать тестировщиков. Напиши «хочу» в комментах.')],
    },
    'b-trial': {
        'b-lock': [(0.1, 'Восемь утра. Списали триста девяносто девять рублей.'), (None, 'Пробный период закончился, а отменить ты опять забыл.')],
        'b-save': [(0.15, 'А Сабли напомнил бы об этом за день.')],
        'b-tour': [(0.1, 'Все подписки в одном месте.'), (2.1, 'Календарь списаний.'), (4.1, 'И прогноз на год.')],
        'b-cta': [(0.15, 'Приложение бесплатное и без рекламы. Ищу двенадцать тестировщиков. Напиши «хочу» в комментах.')],
    },
    'c-solo': {
        'c-type': [(0.1, 'Я сделал приложение.'), (1.425, 'Один.'), (2.355, 'Без рекламы.'), (3.305, 'Без регистрации.'), (4.4, 'Бесплатно.')],
        'c-rule': [(0.0, 'Но Гугл Плей требует двенадцать тестировщиков на две недели.'), (None, 'А у меня — ноль.')],
        'c-show': [(0.15, 'Это Сабли — трекер подписок. Считает траты и напоминает до списания.')],
        'c-cta': [(0.15, 'Помоги мне выйти в магазин. Напиши «хочу» в комментах, и я пришлю ссылку.')],
    },
}

import hashlib, subprocess

def voice_file(text):
    """Synthesize one line with Piper (cached), loudness-normalised to -16 LUFS. Returns (filename, seconds)."""
    vdir = os.path.join(ROOT, 'shared', 'voice')
    os.makedirs(vdir, exist_ok=True)
    key = hashlib.sha1((VOICE_MODEL + '|v6|' + text).encode()).hexdigest()[:12]
    raw, out = os.path.join(vdir, key + '-raw.wav'), os.path.join(vdir, key + '.wav')
    if not os.path.exists(out):
        subprocess.run(['python3', '-m', 'piper', '-m', VOICE_MODEL, '-f', raw, '--length-scale', '0.92', '--sentence-silence', '0.15',
                        '--volume', '0.5', '--noise-scale', '0.5', '--noise-w-scale', '0.6'],
                       input=text.encode(), check=True, capture_output=True)
        tmp = raw.replace('-raw.wav', '-tmp.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af',
                        'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
                        'adeclick,deesser=i=0.6:m=0.6:f=0.5,highpass=f=100:poles=2,lowpass=f=7500,'
                        'afade=t=in:d=0.02,areverse,afade=t=in:d=0.05,areverse,apad=pad_dur=0.05', '-ar', '44100', tmp], check=True)
        # one static gain per line (no dynamic loudness processing): speech RMS to about -19 dBFS, peaks kept under -3 dBFS
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', tmp, '-f', 's16le', '-ac', '1', '-'], capture_output=True).stdout
        import numpy as np
        x = np.frombuffer(pcm[:len(pcm) // 2 * 2], dtype=np.int16).astype(np.float32) / 32768
        rms = float(np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2))) or 1e-4
        gain = min(10 ** (-19 / 20) / rms, 10 ** (-3 / 20) / max(float(np.abs(x).max()), 1e-4))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={gain:.4f}', out], check=True)
        os.remove(tmp)
        os.remove(raw)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out],
                               capture_output=True, text=True).stdout)
    return os.path.basename(out), dur


def place_voice(name, order):
    """Stretch scenes to fit their lines; return the new order and the voice clips with absolute starts."""
    clips, new_order, t = [], [], 0.0
    for cid, base in order:
        cursor, end = 0.0, 0.0
        for off, text in VOICE.get(name, {}).get(cid, []):
            f, d = voice_file(text)
            start = cursor + 0.12 if off is None else off
            clips.append((f, round(t + start, 3), round(d, 3), cid))
            cursor = start + d
            end = max(end, cursor)
        dur = round(max(base, end + 0.45), 3)
        new_order.append((cid, dur))
        t += dur
    return new_order, clips


for build in (video_a, video_b, video_c):
    name, title, scenes, order, music = build()
    order, voice_clips = place_voice(name, order)
    proj = os.path.join(ROOT, name)
    os.makedirs(os.path.join(proj, 'compositions'), exist_ok=True)
    dst_assets = os.path.join(proj, 'assets')
    if os.path.exists(dst_assets):
        shutil.rmtree(dst_assets)
    shutil.copytree(SHARED, dst_assets)
    os.makedirs(os.path.join(dst_assets, 'music'), exist_ok=True)
    bed_src = os.path.join(ROOT, 'shared', 'music', music[0])
    bed_out = os.path.join(dst_assets, 'music', music[0].replace('.mp3', '.m4a'))
    # phone speakers can't play sub-bass: they rattle ("fart") on it. Cut below 120 Hz, thin the 200 Hz mud.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', bed_src, '-af',
                    'highpass=f=120:poles=2,highpass=f=120:poles=2,equalizer=f=200:t=q:w=1.2:g=-4,lowpass=f=14000',
                    '-c:a', 'aac', '-b:a', '192k', bed_out], check=True)
    for f in os.listdir(os.path.join(proj, 'compositions')):
        os.remove(os.path.join(proj, 'compositions', f))
    for cid, html in scenes.items():
        open(os.path.join(proj, 'compositions', f'{cid}.html'), 'w', encoding='utf8').write(html)
    open(os.path.join(proj, 'index.html'), 'w', encoding='utf8').write(index(title, order, [], music, voice_clips))
    os.makedirs(os.path.join(dst_assets, 'voice'), exist_ok=True)
    for f, *_ in voice_clips:
        shutil.copy(os.path.join(ROOT, 'shared', 'voice', f), os.path.join(dst_assets, 'voice', f))
    print(name, 'voice lines:', len(voice_clips), '|', 'scenes:', [c for c, _ in order], 'length:', round(sum(d for _, d in order), 2), 's')
