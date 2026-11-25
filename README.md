# Catedra – asistentul digital al profesorului

Aplicație pentru calculator (Windows / macOS / Linux), complet în limba română, care funcționează **offline**. Datele rămân doar pe calculatorul profesorului.

## De ce?
Profesorii petrec ore întregi pe hârtii: catalog, calculul mediilor, absențe, planificări, proiecte de lecție, teste, fișe pentru părinți. Catedra face aceste lucruri automat.

## Funcții
| Secțiune | Ce face |
|---|---|
| 🏠 **Acasă** | Orele de azi + alerte automate: elevi cu prea puține note, medii sub 5, absențe nemotivate peste prag |
| 👥 **Clase și elevi** | Lista de elevi se lipește direct din Excel/Word |
| 📒 **Catalog și medii** | Note 1–10, medii semestriale (rotunjire x,50 în sus) și anuale calculate automat, număr minim de note (ore/săpt. + 1), **notare rapidă** pentru un test pe toată clasa, statistica clasei, export Excel (CSV), tipărire |
| 🗓️ **Absențe** | Bifare rapidă pe dată, motivare cu un clic, total motivate / nemotivate |
| ⏰ **Orar** | Orar săptămânal cu ore calculate automat, tipărire |
| 📅 **Planificare calendaristică** | Schelet pe 34 de săptămâni, tipărire în formatul uzual |
| 📝 **Proiect de lecție** | Formular cu etapele lecției deja propuse, durată calculată, duplicare, tipărire / PDF |
| 🧪 **Generator de teste** | Bancă de itemi (grilă, A/F, răspuns deschis), import rapid din text, variante A/B/C/D amestecate, barem, transformare punctaj → notă |
| 📊 **Rapoarte părinți** | Fișă individuală cu note, medie, absențe și observație generată automat |
| 🎲 **La clasă** | Elev aleatoriu (fără repetare), cronometru, împărțire pe grupe |
| ⚙️ **Setări** | Profil, durata orelor, copie de rezervă / restaurare (JSON) |

## Cel mai simplu mod (fără instalare)
Descărcați fișierul **`Catedra.html`** (74 KB) și deschideți-l cu dublu clic în Chrome, Edge sau Firefox. Funcționează offline; datele se salvează în browserul de pe acel calculator – faceți periodic copie de rezervă din „Setări”.

Fișierul se regenerează cu `node scripts/build-single.js`.

## Pornire (aplicația desktop)
```bash
npm install
npm start
```

## Instalare

**Windows:** rulați `Catedra-Setup-1.0.0.exe` → Înainte → Instalează. Nu sunt necesare drepturi de administrator. Se creează scurtături pe Desktop și în meniul Start. Datele se păstrează în `%APPDATA%\Catedra` și nu se șterg la dezinstalare.

> Programul nu este semnat digital, așa că Windows SmartScreen poate afișa „Windows a protejat computerul”. Apăsați „Mai multe informații” → „Rulează oricum”.

**Linux (Ubuntu, Debian, Mint):**
```bash
sudo apt install ./catedra_1.0.0_amd64.deb
```
Aplicația apare în meniu la „Educație”. Datele se păstrează în `~/.config/Catedra`.

## Construire
```bash
npm install
npm run dist:win     # dist/Catedra-Setup-1.0.0.exe (pe Linux necesită pachetul nsis)
npm run dist:linux   # dist/catedra_1.0.0_amd64.deb
npm run build:html   # Catedra.html
```
Sau din GitHub: **Actions → Build Catedra → Run workflow**, apoi descărcați fișierul din „Artifacts”.

