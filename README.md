# Adventskalendern

En liten statisk webbapp (HTML, CSS och vanilla JS) med en adventskalender till Elin.
Se `PLAN.md` för hela planen och besluten.

## Köra lokalt

Appen använder ES-moduler och `fetch`, så den måste serveras över HTTP (att öppna
`index.html` direkt som fil fungerar inte).

```sh
python3 -m http.server 8080
# eller
npx serve
```

Öppna sedan <http://localhost:8080/>.

För att titta på telefonen i samma wifi: öppna `http://<datorns-ip>:8080/` där.

## Tester

Kräver Node 20 eller senare. Inga beroenden behöver installeras.

```sh
node --test
# eller
npm test
```

## Dev-läge

Dev-läget låter dig testa alla dagar utan att vänta på rätt datum.

- Slå på: besök appen med `?dev=on` en gång, t.ex. <http://localhost:8080/?dev=on>.
  Flaggan sparas i `localStorage` och parametern tas bort ur adressfältet.
- Slå av: besök `?dev=off` (eller knappen "Stäng av dev-läge" i panelen).
  Då rensas även det simulerade datumet.
- En gul runda "DEV" nere till höger öppnar panelen:
  - **Simulerat datum**: åsidosätter "idag" (sparas). En gul banner visar
    "DEV: simulerat datum ÅÅÅÅ-MM-DD" så länge det är aktivt.
  - **Använd riktigt datum**: tar bort det simulerade datumet.
  - **Öppna alla**: markerar alla luckor som öppnade.
  - **Nollställ öppnade luckor**: glömmer vilka luckor som öppnats.
- Utan flaggan laddas `js/dev.js` aldrig och inget dev-element finns i DOM:en.
- OBS: en installerad PWA på iOS har egen `localStorage`, så dev-flaggan från Safari
  gäller inte där. Testa datumlogik i webbläsaren och installationen separat.

## Lägga till och ändra luckor

Allt innehåll ligger i `content/days.json`. Varje lucka styrs av sitt `date`
(`YYYY-MM-DD`, lokalt datum), inte av sin position i listan. Se datamodellen i `PLAN.md`.

## Antaganden

- `package.json` finns bara för att Node ska tolka `.js` som ES-moduler i testerna
  (`"type": "module"`) och för `npm test`. Den har inga beroenden.
- `PLAN.md` hänvisar till "öppen fråga 2" för temat, men bara en öppen fråga (design) finns.
  Jag följde förslaget där: mörkblå natthimmel, varm röd och guld, subtil snö i ren CSS.
- Luckorna i rutnätet visar alltid dagens nummer, och `label` (t.ex. "2:a advent") visas
  som liten text under numret, så att rutnätet går att skumma. I specialrutan visas
  `label` stort och datumet under.
- Ikoner per typ: `ledtrad` 🔍, `litet` 🎁, `uppdrag` ⭐, `rim` 📜 (okänd typ ✨).
- Plan B-knappen växlar: "Dåligt väder? Visa plan B" och tillbaka med
  "Tillbaka till ursprungsplanen". Kortet visar alltid ursprungsplanen när det öppnas.
- Kortet stängs med "Stäng", Esc eller tryck utanför kortet.
- Låsning går alltid före "öppnad": en lucka som sparats som öppnad men vars datum inte
  är nått (kan hända efter att man bytt datum i dev-läget) visas som låst.
- Öppna-animationen (3D-flip) körs bara första gången. Redan öppnade luckor visar kortet direkt.
- Innehållet hämtas med `cache: 'no-cache'` så att ändringar i `days.json` slår igenom
  utan hård omladdning.
- "Öppna alla" markerar alla luckor som öppnade. Eftersom låsning alltid går före
  (se ovan) sätts även det simulerade datumet till sista luckans datum om den inte redan
  är upplåst, annars skulle knappen inte synas göra något.
- Dev-panelen har en extra knapp, "Stäng av dev-läge", som gör samma sak som `?dev=off`.
- `?dev=on`/`?dev=off` tas bort ur adressen efter att de lästs, så att en länk med
  `?dev=on` inte sparas som bokmärke eller delas av misstag.
- Ett simulerat datum som ligger kvar i `localStorage` ignoreras helt när dev-flaggan är av.
- `days.json` valideras strikt: ett ogiltigt datum (t.ex. `2026-12-5`) eller två luckor
  med samma `id` ger felmeddelandet i stället för en kalender där en lucka saknas eller
  öppnar fel innehåll. Testa därför alltid i webbläsaren efter att du ändrat filen.
