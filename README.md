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

## Pornire
```bash
npm install
npm start
```

## Construire program de instalare
```bash
npm run dist:win    # Windows (.exe) – recomandat pe Windows
npm run dist:mac    # macOS (.dmg)
npm run dist:linux  # Linux (.AppImage)
```
Sau din GitHub: **Actions → Build Catedra → Run workflow**, apoi descărcați fișierul din „Artifacts”.

Aplicația se poate deschide și direct în browser: `src/index.html` (datele se salvează atunci în browser).
