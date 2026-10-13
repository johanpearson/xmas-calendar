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

## Tester

Kräver Node 20 eller senare. Inga beroenden behöver installeras.

```sh
node --test
# eller
npm test
```

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
