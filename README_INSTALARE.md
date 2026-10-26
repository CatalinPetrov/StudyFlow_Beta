# StudyFlow — Prototip: curățare date demo + identitate (actualizare 1)

Această arhivă a fost generată folosind codul din proiectul tău **StudyFlow_Home_v1.0_ZIP.zip** încărcat pentru audit, nu dintr-un proiect mai vechi.

## Înainte să instalezi

1. Din **Profil → Datele mele**, exportă un backup al datelor tale. Păstrează fișierul exportat într-un loc sigur (nu îl încărca în conversație dacă are date personale).
2. Fă o copie de siguranță a directorului proiectului.
3. NU șterge datele site-ului din browser și NU modifica portul/adresa locală, ca să rămâi în același spațiu de stocare.

## Instalare în IntelliJ

Extrage ZIP-ul, apoi copiază în proiect, **păstrând structura directoarelor**:

- `src/App.tsx` — înlocuiește-l.
- `.figma/make/site.json` — înlocuiește-l. În managerul de fișiere Fedora apasă `Ctrl+H` ca să vezi folderul ascuns `.figma`.
- `public/favicon.svg` — înlocuiește-l.

Nu modifica fișierele Plan, Materii, Library sau Study Hub.

## Modificări

- Un profil de browser fără taskuri salvate începe cu lista goală, nu cu 12 taskuri fictive.
- Taskurile salvate în `studyflow-tasks-v1` sunt încărcate ca înainte, fără ștergere/migrare.
- Home afișează pentru lista goală mesajul „Nu ai taskuri adăugate încă.” și un acces către Plan → Taskuri.
- Este eliminat textul „Taskuri demonstrative” din Home.
- Fila browserului afișează „StudyFlow — Planner universitar”, iar iconița este proprie StudyFlow.

**Important:** dacă cele 12 taskuri demo au fost deja salvate în browser de o versiune anterioară, ele rămân salvate pentru siguranță. Le poți șterge manual din Plan → Taskuri. Această actualizare nu atinge fișiere PDF sau alte date existente.

## Testare

1. În terminalul IntelliJ: `npm run build` și apoi `npm run dev`.
2. Reîmprospătează pagina (dacă iconița nu se actualizează, reîncarcă forțat tabul).
3. Verifică titlul „StudyFlow — Planner universitar” și noua iconiță.
4. Verifică dacă taskurile tale **existente** sunt încă acolo.
5. Pentru un browser/profil de test nou, fără date salvate, Home trebuie să arate „Nu ai taskuri adăugate încă.”. Nu curăța datele browserului tău principal doar pentru acest test.
6. Adaugă un task în Plan, actualizează pagina și verifică dacă persistă.

## Verificări tehnice

Modificările au trecut verificarea TypeScript strictă și buildul Vite local. Buildul avertizează încă despre mărimea pachetului JavaScript și anumite resurse PDF.js, probleme deja existente în proiect înaintea acestei actualizări.
