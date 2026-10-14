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

### Som på GitHub Pages (under en undermapp)

På GitHub Pages ligger sajten under `/<repo-namn>/`, så alla sökvägar måste vara relativa
(`./sw.js`, aldrig `/sw.js`). Så här provar du det lokalt:

```sh
mkdir -p /tmp/pages && ln -sfn "$PWD" /tmp/pages/xmas-calendar
cd /tmp/pages && python3 -m http.server 8080
```

Öppna <http://localhost:8080/xmas-calendar/>. E2e-testerna (nedan) kör alltid appen
på det här sättet och fallerar om något hämtas utanför undermappen.

## Testa på telefon

- **Samma wifi:** starta servern lokalt och öppna `http://<datorns-ip>:8080/` i telefonen.
  Datumlogik och utseende går att testa så, men service worker och installation kräver
  HTTPS (eller `localhost`), så de fungerar inte via en IP-adress.
- **Installation och offline:** testa på den riktiga Pages-adressen
  `https://<user>.github.io/<repo>/` (se checklistan nedan).
- Telefonens egen klocka styr vilka luckor som är öppna. För att prova andra datum,
  använd dev-läget i webbläsaren (inte i den installerade appen, se nedan).

## Tester

### Enhetstester

Kräver Node 20 eller senare. Inga beroenden behöver installeras.

```sh
node --test
# eller
npm test
```

### E2e (Playwright)

Smoke-tester i `tests/e2e/` som kör appen i Chromium under `/xmas-calendar/`, med låst
klocka (`page.clock`) på 2026-12-05: luckor till och med den 5:e går att öppna och den 6:e
är låst, öppnad lucka finns kvar efter omladdning, appen startar offline, manifestet är
giltigt och Chrome bedömer appen som installerbar, inga rot-absoluta sökvägar, samt
installationsknappen och iOS-rutan.

```sh
npm install                       # bara dev-beroendet @playwright/test
npx playwright install chromium   # första gången
npm run test:e2e
```

Playwright startar själv en liten testserver (`tests/e2e/serve.mjs`) på port 4173.

### Manuellt: installation på riktig telefon

**iOS Safari**
1. Öppna Pages-adressen i Safari. En ruta "Lägg kalendern på hemskärmen" visas en gång.
2. Tryck på Dela, sedan "Lägg till på hemskärmen". Namnet ska vara "Advent" och ikonen
   den röda luckan med guldstjärna.
3. Starta från hemskärmen: ingen adressrad, ingen installationsruta.
4. Sätt telefonen i flygplansläge och starta igen: kalendern ska visas.

**Android Chrome**
1. Öppna Pages-adressen i Chrome. Efter en stund visas en liten knapp "Installera"
   under rubriken (eller välj "Installera app" i menyn ⋮).
2. Installera. Ikonen ska fylla hela formen (maskable) utan vita kanter.
3. Starta från hemskärmen: fristående fönster, knappen "Installera" syns inte.
4. Flygplansläge och starta igen: kalendern ska visas.

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

En lucka ser ut så här:

```json
{
  "id": "d-2026-12-06",
  "date": "2026-12-06",
  "label": "2:a advent",
  "type": "uppdrag",
  "title": "Baka lussekatter",
  "body": "Första stycket.\nAndra stycket.",
  "alternative": { "title": "Plan B", "body": "Valfri reservplan" }
}
```

- `id` måste vara unikt. Byt inte `id` på en lucka som redan öppnats, då glömmer
  appen att den är öppnad.
- `type` är `ledtrad`, `litet`, `uppdrag` eller `rim` (styr ikon och färg).
- `label` och `alternative` är valfria. `\n` i `body` delar upp texten i stycken.
- Luckor med datum före 1 december visas som en stor specialruta överst.
- Nästa år: byt bara ut `content/days.json` (titel, datum och innehåll).

Efter en ändring: ladda om i webbläsaren och kontrollera att kalendern syns (en trasig
fil ger ett felmeddelande). Pusha till `main`, så når ändringen telefonen nästa gång
appen startas. Ingen `CACHE_VERSION`-bump behövs för innehållsändringar.

## Deploy och CACHE_VERSION

Sajten deployas direkt från `main` med GitHub Pages
(Settings, Pages, Deploy from branch: `main` och `/ (root)`).
URL: `https://<user>.github.io/<repo>/`.

Service workern (`sw.js`) sparar appskalet (HTML, CSS, JS, ikoner, manifest) i en cache
och svarar från den först. Därför måste du **bumpa `CACHE_VERSION`** i `sw.js` varje gång
något i appskalet ändras, annars fortsätter telefonen att visa den gamla versionen:

```js
const CACHE_VERSION = 'v2'; // var 'v1'
```

- Lägger du till en ny fil i appskalet: lägg även till den i `SHELL_FILES` i `sw.js`.
- Ändrar du bara `content/days.json` behövs ingen bump. Filen hämtas med
  stale-while-revalidate: appen visar den sparade versionen direkt och hämtar en ny
  i bakgrunden, som syns vid nästa start.
- Efter en bump laddas den nya versionen ner när appen startas och används från
  starten därefter (alltså ibland först vid andra starten).

### Ikoner

Ikonerna i `icons/` genereras från `icons/favicon.svg`. Efter att du ändrat SVG:n:

```sh
npm install
npm run icons
```

och bumpa sedan `CACHE_VERSION`.

## Antaganden

### PWA, tester och deploy (milstolpe 4 och 5)

- Ikonen är en röd lucka med guldstjärna på natthimmelsblå botten (samma färger som appen).
  PNG-varianterna renderas från `favicon.svg` med Chromium via Playwright
  (`npm run icons`), så inget extra verktyg behövs. Maskable-ikonen har motivet inom
  den säkra zonen och apple-touch-ikonen har heltäckande bakgrund (iOS rundar själv hörnen).
- `@playwright/test` är ett dev-beroende (låst till 1.56.1, samma version som
  Chromium i utvecklingsmiljön). Appen själv har fortfarande inga beroenden.
- `content/days.json` ligger i en egen, oversionerad cache (`advent-content`), så att
  senast kända innehåll finns kvar även när appskalet uppdateras. Den precachas vid
  installation eftersom första sidladdningen sker innan service workern tagit över.
- Alla navigeringar till appen (även `?dev=on`) besvaras med den cachade `index.html`,
  så dev-läget fungerar offline. Okända filer under sajten cachas vid första hämtningen.
- Service workern laddar inte om sidan när en ny version tagit över. Den nya versionen
  används vid nästa start, vilket räcker för en kalender och undviker att sidan hoppar.
- Installera-knappen ligger diskret under rubriken och visas bara när Chrome skickar
  `beforeinstallprompt`. Den försvinner efter ett klick (prompten kan bara användas en
  gång) och när appen installerats.
- iOS-rutan visas i Safari på iPhone/iPad (inte i Chrome/Firefox på iOS, vars menyer ser
  annorlunda ut) när appen inte körs fristående. Den räknas som visad först när man
  trycker "Okej", så den kommer tillbaka om man bara navigerar bort.
- Manifestet har även `id`, `description` och `orientation: portrait`. Statusfältet på
  iOS är `black-translucent`, så den mörka bakgrunden går hela vägen upp (innehållet
  respekterar redan `safe-area-inset-top`).
- E2e-testerna kör bara Chromium (Pixel 7-emulering). Safari kan inte testas
  automatiskt här, därav den manuella checklistan. iOS-rutan testas med Safaris
  user agent i Chromium.
- "Lighthouse PWA-kontroller" tolkas som Chromes egna installationskontroller
  (`Page.getInstallabilityErrors`), som e2e-testet kör. Nyare Lighthouse har ingen
  PWA-kategori längre.

### Milstolpe 1-3

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
