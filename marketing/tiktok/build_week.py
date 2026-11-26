#!/usr/bin/env python3
"""A week of TikTok videos (still branded Subly while the account name is locked for 7 days).

Reuses scenes, phone, CTA and Gemini voice from build.py.
Run: GEMINI_KEY_FILE=... python3 build_week.py [w1 w2 ...]
"""
import os, shutil, subprocess, sys
import build as B

ROOT = B.ROOT
ASSETS = os.path.join(ROOT, 'shared-subly', 'assets')   # Subly-branded screens and the old «S» icon
MUSIC = os.path.join(ROOT, 'music')
B.SHARED = ASSETS                                       # cta() reads the icon from here


def hook(cid, title, sub='', bg='#0f1218', size=78):
    sub_html = f'\n    <p id="{cid}-t2" class="center">{sub}</p>' if sub else ''
    return B.scene(cid, f"""
  #{cid}-bg {{ background: {bg}; }}
  #{cid}-t1 {{ top: 520px; font-size: {size}px; }}
  #{cid}-t1 span {{ color: #8796ff; }}
  #{cid}-t2 {{ top: 1000px; font-size: 40px; font-weight: 600; opacity: .75; }}
""", f"""    <div id="{cid}-bg" class="bg"></div>
    <h1 id="{cid}-t1" class="center display">{title}</h1>{sub_html}""", f"""
    tl.fromTo("#{cid}-t1", {{ scale: 0.98 }}, {{ scale: 1.0, duration: 3, ease: "none" }}, 0);""" + (f"""
    tl.fromTo("#{cid}-t2", {{ y: 20, opacity: 0 }}, {{ y: 0, opacity: 0.75, duration: 0.35, ease: "power3.out" }}, 0.9);""" if sub else ''))


def phone_scene(cid, title, img, chip='', bg='linear-gradient(180deg, #2f46d0 0%, #1b2a8f 100%)', scroll=0, chip_top=1110, chip_color=''):
    chip_html = f'\n    <div id="{cid}-chip">{chip}</div>' if chip else ''
    return B.scene(cid, f"""
  #{cid}-bg {{ background: {bg}; }}
  #{cid}-t1 {{ top: 300px; font-size: 50px; }}
  #{cid}-ph {{ top: 470px; }}
  #{cid}-chip {{ position: absolute; left: 130px; top: {chip_top}px; padding: 16px 26px; border-radius: 18px; background: {chip_color or '#fff'};
                color: #141821; font-size: 32px; font-weight: 700; box-shadow: 0 16px 40px rgba(0,0,0,.3); max-width: 640px; }}
""", f"""    <div id="{cid}-bg" class="bg"></div>
    <h2 id="{cid}-t1" class="center display">{title}</h2>
    {B.phone(cid + '-ph', img)}{chip_html}""", f"""
    tl.fromTo("#{cid}-t1", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }}, 0);
    tl.fromTo("#{cid}-ph", {{ y: 520 }}, {{ y: 0, duration: 0.6, ease: "power4.out" }}, 0.15);
    tl.fromTo("#{cid}-ph", {{ scale: 1 }}, {{ scale: 1.05, duration: 5, ease: "none" }}, 0.75);""" + (f"""
    tl.fromTo("#{cid}-ph-img", {{ y: 0 }}, {{ y: -{scroll}, duration: 2.6, ease: "sine.inOut" }}, 1.0);""" if scroll else '') + (f"""
    tl.fromTo("#{cid}-chip", {{ y: 24, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.4, ease: "back.out(2)" }}, 1.3);
    tl.fromTo("#{cid}-chip", {{ scale: 1 }}, {{ scale: 1.04, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 5, immediateRender: false }}, 2.2);""" if chip else ''))


def cards_scene(cid, title, items, footer='', bg='#0f1218', step=0.55, top=440, gap=118):
    rows = '\n'.join(f'    <div class="wcard" id="{cid}-c{i}" style="top:{top + i * gap}px">{t}</div>' for i, t in enumerate(items))
    foot = f'\n    <p id="{cid}-f" class="center display">{footer}</p>' if footer else ''
    return B.scene(cid, f"""
  #{cid}-bg {{ background: {bg}; }}
  #{cid}-t1 {{ top: 300px; font-size: 50px; }}
  .wcard {{ position: absolute; left: 130px; width: 640px; min-height: 96px; padding: 20px 26px; border-radius: 22px; background: #1d2230;
            font-size: 32px; font-weight: 700; line-height: 1.25; }}
  #{cid}-f {{ top: {top + len(items) * gap + 20}px; font-size: 56px; color: #ffd36b; }}
""", f"""    <div id="{cid}-bg" class="bg"></div>
    <h2 id="{cid}-t1" class="center display">{title}</h2>
{rows}{foot}""", f"""
    tl.fromTo("#{cid}-t1", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }}, 0);
    for (let i = 0; i < {len(items)}; i++) {{
      tl.fromTo("#{cid}-c" + i, {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.3, ease: "back.out(2)" }}, 0.4 + i * {step});
      tl.fromTo("#{cid}-c" + i, {{ y: 0 }}, {{ y: -18, duration: 4, ease: "sine.inOut", immediateRender: false }}, 0.7 + i * {step});
    }}""" + (f"""
    tl.fromTo("#{cid}-f", {{ scale: 1.5, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.35, ease: "power4.out" }}, {0.5 + len(items) * step});""" if footer else ''))


def math_scene(cid):
    return B.scene(cid, f"""
  #{cid}-bg {{ background: #0f1218; }}
  #{cid}-a {{ top: 380px; font-size: 64px; color: #c9d0e3; }}
  #{cid}-b {{ top: 540px; font-size: 104px; }}
  #{cid}-c {{ top: 760px; font-size: 52px; color: #c9d0e3; }}
  #{cid}-d {{ top: 880px; font-size: 92px; color: #ffd36b; }}
  #{cid}-e {{ top: 1060px; font-size: 40px; font-weight: 600; opacity: .7; }}
""", f"""    <div id="{cid}-bg" class="bg"></div>
    <p id="{cid}-a" class="center display">399 ₽ × 12</p>
    <h2 id="{cid}-b" class="center display">4 788 ₽</h2>
    <p id="{cid}-c" class="center display">× 10 подписок</p>
    <h2 id="{cid}-d" class="center display">47 880 ₽</h2>
    <p id="{cid}-e" class="center">в год 😳</p>""", f"""
    tl.fromTo("#{cid}-a", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }}, 0.1);
    tl.fromTo("#{cid}-b", {{ scale: 1.5, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.35, ease: "power4.out" }}, 0.9);
    tl.fromTo("#{cid}-c", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }}, 2.4);
    tl.fromTo("#{cid}-d", {{ scale: 1.6, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }}, 3.1);
    tl.fromTo("#{cid}-e", {{ opacity: 0 }}, {{ opacity: 0.7, duration: 0.3 }}, 3.4);""")


# ---------------------------------------------------------------- the week
WEEK = {
    'w1-forgot': dict(
        title='Subly W1 — Забытые подписки', music=('de498ed9.mp3', 0),
        scenes=[
            ('w1-hook', 2.6, lambda c: hook(c, '5 подписок, которые ты <span>забыл</span> отменить', 'Проверь себя 👇')),
            ('w1-list', 5.0, lambda c: cards_scene(c, 'Узнаёшь?', ['🎬 Кинотеатр, который не смотришь', '☁️ Облако на 2 ТБ, занято 15 ГБ',
                                                                 '🧪 Пробный период, ставший платным', '🏋️ Тренировки «с понедельника»', '🎧 Второй музыкальный сервис'])),
            ('w1-app', 4.0, lambda c: phone_scene(c, 'Subly соберёт их в одном месте', 'list-light.png', '✂️ Можно сэкономить 23 988 ₽ в год')),
            ('w1-cta', 5.0, B.cta),
        ],
        voice={
            'w1-hook': [(0.1, 'Пять подписок, которые ты, скорее всего, забыл отменить.')],
            'w1-list': [(0.3, 'Кинотеатр, который ты не смотришь. Облако, которое почти пустое. Пробный период, который стал платным. И ещё парочка.')],
            'w1-app': [(0.15, 'Сабли соберёт их в одном месте и посчитает, сколько ты сэкономишь, если отменить лишнее.')],
            'w1-cta': [(0.15, 'Мне нужно двенадцать тестировщиков. Напиши «хочу» в комментах.')],
        }),
    'w2-coffee': dict(
        title='Subly W2 — Математика подписок', music=('5b2b7b06.mp3', 0),
        scenes=[
            ('w2-hook', 2.6, lambda c: hook(c, '399 ₽ в месяц — это <span>мало</span>?', 'Давай посчитаем')),
            ('w2-math', 4.6, math_scene),
            ('w2-app', 4.0, lambda c: phone_scene(c, 'Subly считает это за тебя', 'overview-dark.png', '📊 В месяц, в год и в день')),
            ('w2-cta', 5.0, B.cta),
        ],
        voice={
            'w2-hook': [(0.1, 'Триста девяносто девять рублей в месяц — это же мелочь, да?')],
            'w2-math': [(0.3, 'Умножь на двенадцать месяцев — почти пять тысяч. А подписок у тебя не одна, а штук десять.')],
            'w2-app': [(0.15, 'Сабли считает это за тебя и показывает реальную сумму в месяц и в год.')],
            'w2-cta': [(0.15, 'Хочешь попробовать первым? Напиши «хочу» в комментах.')],
        }),
    'w3-family': dict(
        title='Subly W3 — Семейная подписка', music=('fb2e07a9.mp3', 0),
        scenes=[
            ('w3-hook', 2.6, lambda c: hook(c, 'Делишь <span>семейную</span> подписку?', 'С друзьями, сестрой, соседом')),
            ('w3-who', 3.6, lambda c: cards_scene(c, 'А сколько из этого твоё?', ['🎧 Музыка Duo — на двоих', '🍿 Кинотеатр — на семью', '📺 Видео Family — на пятерых'],
                                                  'Непонятно 🤯')),
            ('w3-app', 4.4, lambda c: phone_scene(c, 'Укажи, с кем делишь', 'shared-light.png', '💸 Твоя доля: 480 ₽ в месяц', chip_top=1080)),
            ('w3-cta', 5.0, B.cta),
        ],
        voice={
            'w3-hook': [(0.1, 'Делишь семейную подписку с друзьями или семьёй?')],
            'w3-who': [(0.3, 'Обычно непонятно, сколько из этого на самом деле платишь ты.')],
            'w3-app': [(0.15, 'В Сабли просто укажи, со сколькими людьми делишь, и в расходы попадёт только твоя доля.')],
            'w3-cta': [(0.15, 'Ищу двенадцать тестировщиков на Андроид. Пиши «хочу» в комментах.')],
        }),
    'w4-bills': dict(
        title='Subly W4 — ЖКХ и аренда', music=('5e171f46.mp3', 0),
        scenes=[
            ('w4-hook', 2.6, lambda c: hook(c, 'Опять забыл оплатить <span>ЖКХ</span>?', 'Или аренду. Или кредит')),
            ('w4-alert', 3.8, lambda c: phone_scene(c, 'Subly напомнит о неоплаченном', 'alerts-dark.png', bg='#0f1218')),
            ('w4-bill', 3.8, lambda c: phone_scene(c, 'Оплатил — нажал «Оплачено»', 'bill-dark.png', '✅ Вся история платежей', bg='#0f1218')),
            ('w4-cta', 5.0, B.cta),
        ],
        voice={
            'w4-hook': [(0.1, 'Снова забыл оплатить коммуналку?')],
            'w4-alert': [(0.15, 'Сабли покажет, что не оплачено и что уже просрочено.')],
            'w4-bill': [(0.15, 'Оплатил — нажал «Оплачено». И вся история платежей под рукой.')],
            'w4-cta': [(0.15, 'Нужны тестировщики — напиши «хочу», и я пришлю ссылку.')],
        }),
    'w5-calendar': dict(
        title='Subly W5 — Календарь списаний', music=('0df0d964.mp3', 10.0),
        scenes=[
            ('w5-hook', 2.8, lambda c: hook(c, 'В какой день у тебя уходит <span>больше всего</span>?', size=70)),
            ('w5-cal', 4.0, lambda c: phone_scene(c, 'Все списания в календаре', 'calendar-light.png', '📅 Сумма за каждый день')),
            ('w5-year', 4.0, lambda c: phone_scene(c, 'И прогноз на год вперёд', 'forecast-dark.png', '📈 Видно «тяжёлые» месяцы', bg='#0f1218')),
            ('w5-cta', 5.0, B.cta),
        ],
        voice={
            'w5-hook': [(0.1, 'А ты знаешь, в какой день месяца у тебя уходит больше всего денег?')],
            'w5-cal': [(0.15, 'В Сабли все списания видно в календаре — с суммой за каждый день.')],
            'w5-year': [(0.15, 'А ещё прогноз на год: сразу видно тяжёлые месяцы с годовыми оплатами.')],
            'w5-cta': [(0.15, 'Приложение бесплатное. Напиши «хочу» в комментах — пришлю ссылку.')],
        }),
    'w6-privacy': dict(
        title='Subly W6 — Приватность', music=('5fd841d2.mp3', 0),
        scenes=[
            ('w6-hook', 2.8, lambda c: hook(c, 'Трекер подписок просит доступ к <span>банку</span> 🏦', 'Серьёзно?', size=70)),
            ('w6-no', 4.6, lambda c: cards_scene(c, 'В Subly этого нет', ['❌ Регистрация и аккаунты', '❌ Доступ к банку и почте', '❌ Реклама и слежка',
                                                                     '✅ Всё хранится только на телефоне'])),
            ('w6-app', 3.6, lambda c: phone_scene(c, 'Работает даже без интернета', 'privacy-light.png', '🔒 Данные никуда не уходят')),
            ('w6-cta', 5.0, B.cta),
        ],
        voice={
            'w6-hook': [(0.1, 'Многие трекеры подписок просят доступ к твоему банку и почте.')],
            'w6-no': [(0.3, 'В Сабли нет регистрации, нет доступа к банку и нет рекламы. Всё хранится только на твоём телефоне.')],
            'w6-app': [(0.15, 'И работает даже без интернета.')],
            'w6-cta': [(0.15, 'Хочешь протестировать? Напиши «хочу» в комментах.')],
        }),
    'w7-budget': dict(
        title='Subly W7 — Бюджет', music=('a8bf2a91.mp3', 12.0),
        scenes=[
            ('w7-hook', 2.6, lambda c: hook(c, 'Сколько ты готов тратить на <span>подписки</span>?', size=70)),
            ('w7-set', 4.0, lambda c: phone_scene(c, 'Задай бюджет', 'overview-light.png', '🎯 92% от бюджета 15 000 ₽')),
            ('w7-over', 4.2, lambda c: phone_scene(c, 'Вылез за лимит — узнаешь сразу', 'top-dark.png', '⚠️ Бюджет превышен на 3 833 ₽',
                                                   bg='#0f1218', chip_color='#ffd9d6')),
            ('w7-cta', 5.0, B.cta),
        ],
        voice={
            'w7-hook': [(0.1, 'Сколько ты готов тратить на подписки в месяц?')],
            'w7-set': [(0.15, 'Задай бюджет в Сабли, и полоска покажет, сколько уже потрачено.')],
            'w7-over': [(0.15, 'А если вылезешь за лимит — приложение сразу скажет и покажет самые дорогие подписки.')],
            'w7-cta': [(0.15, 'Помоги мне выйти в Гугл Плей — напиши «хочу» в комментах.')],
        }),
}


def bed(src, offset, total, out):
    """Phone-safe music bed: no sub-bass, steady level, looped if the track is shorter than the video."""
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-stream_loop', '2', '-ss', str(offset), '-i', src, '-t', f'{total + 0.5:.2f}', '-af',
                    'highpass=f=120:poles=2,highpass=f=120:poles=2,equalizer=f=200:t=q:w=1.2:g=-4,lowpass=f=14000,loudnorm=I=-16:TP=-2:LRA=11:linear=true',
                    '-c:a', 'aac', '-b:a', '192k', out], check=True)


def main():
    only = set(sys.argv[1:])
    for name, cfg in WEEK.items():
        if only and name not in only:
            continue
        B.CURRENT_VIDEO['name'] = name
        B.VOICE[name] = cfg['voice']
        order = [(cid, dur) for cid, dur, _ in cfg['scenes']]
        order, voice_clips = B.place_voice(name, order)
        proj = os.path.join(ROOT, 'week', name)
        if not os.path.exists(os.path.join(proj, 'hyperframes.json')):
            os.makedirs(os.path.dirname(proj), exist_ok=True)
            subprocess.run(['node', os.environ['HF_LAUNCHER'], 'init', proj, '--skip-skills', '--skill=hyperframes'],
                           capture_output=True, check=True)
        comp = os.path.join(proj, 'compositions')
        os.makedirs(comp, exist_ok=True)
        for f in os.listdir(comp):
            os.remove(os.path.join(comp, f))
        dst = os.path.join(proj, 'assets')
        if os.path.exists(dst):
            shutil.rmtree(dst)
        shutil.copytree(ASSETS, dst)
        for cid, _, make in cfg['scenes']:
            open(os.path.join(comp, f'{cid}.html'), 'w', encoding='utf8').write(make(cid))
        total = sum(d for _, d in order)
        os.makedirs(os.path.join(dst, 'music'), exist_ok=True)
        track, offset = cfg['music']
        bed(os.path.join(MUSIC, track), offset, total, os.path.join(dst, 'music', 'bed.m4a'))
        os.makedirs(os.path.join(dst, 'voice'), exist_ok=True)
        for f, *_ in voice_clips:
            shutil.copy(os.path.join(ROOT, 'shared', 'voice', f), os.path.join(dst, 'voice', f))
        open(os.path.join(proj, 'index.html'), 'w', encoding='utf8').write(B.index(cfg['title'], order, [], ('bed.mp3', 0, 0.95), voice_clips))
        print(name, '| voice model:', B.MODEL_BY_VIDEO.get(name, B.GEMINI_MODEL), '| lines:', len(voice_clips), '| length:', round(total, 2), 's')


if __name__ == '__main__':
    main()
