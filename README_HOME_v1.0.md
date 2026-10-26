# StudyFlow — Home v1.0 (prototip)

Această versiune pornește de la exportul Figma Make primit. Am păstrat structura React + Vite + Tailwind și stilul cardurilor.

## Modificări

- Header: salut/data din ora locală, rezumat calculat din datele demo, notificări și avatar circular CM.
- „Orele de astăzi”: curs/seminar/laborator, sală, profesor; durata totală calculată automat (6 ore); status în timp real înainte/în timpul/între/după cursuri; „Vezi orarul” merge în Plan → Orar.
- Taskuri: ordonate după termen; checkbox-uri funcționale cu persistență locală în browser; „Vezi toate” merge în Plan → Taskuri; datele se folosesc și pentru progres.
- Examen: număr zile calculat automat pentru examenul demonstrativ din 4 noiembrie 2026, buton „Vezi examenul” cu detalii; examenele trecute nu apar ca examene viitoare.
- Progresul săptămânii: 8/12 (67%) inițial; procentul se recalculează când bifezi un task.
- Ordine pe telefon: Header → Ore → Taskuri → Examen → Progres. Desktop: Ore + Taskuri / Examen + Progres.
- Focus Timer nu mai apare pe Home, conform specificației Home v1.0.

## Ce nu este încă implementat

- Datele din orar, taskuri, examen și profil sunt DEMO și nu provin dintr-o bază de date.
- Bifările taskurilor se păstrează doar local, în browserul curent, pentru săptămâna curentă.
- Pagina completă de Profil, centrul de Notificări și formularele „+” urmează să fie proiectate. Butoanele de profil, notificări, curs și examen deschid între timp panouri cu detalii demonstrative.
- Niciun backend Java/Spring Boot nu este inclus aici.

## Instalare în IntelliJ (proiect deja pornit)

1. Fă o copie de siguranță a fișierului original `src/App.tsx`.
2. Copiază fișierul `src/App.tsx` din acest ZIP peste `src/App.tsx` din proiectul tău.
3. Dacă rulează deja `npm run dev`, salvează și reîncarcă pagina. Vite reîncarcă de obicei automat.
4. Dacă nu rulează, în Terminal: `npm run dev`. Deschide exact URL-ul afișat acolo (poate fi 5173, 8443 sau alt port configurat).
5. Testează butoanele, bifează un task și urmărește schimbarea progresului.

Nu trebuie să reinstalezi dependențele doar pentru această modificare a fișierului `App.tsx`.

## Verificări

Fișierul TSX a fost verificat pentru sintaxă și analiză de tipuri în mediu izolat. Un build Vite complet nu a putut fi executat aici, deoarece instalarea pachetelor npm a fost blocată de accesul la registry. Rulează `npm run dev` în IntelliJ pentru verificarea finală în browser.
