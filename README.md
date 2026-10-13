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
