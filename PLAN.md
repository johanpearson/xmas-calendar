# Adventskalender 2026: byggplan

Plan att läsa först av Claude Code. Följ milstolparna i ordning och stäm av mot "Beslut" innan du avviker.

## Mål

En liten webbapp (PWA) som hostas på GitHub Pages, en adventskalender till Elin. Luckor går bara att öppna när datumet är nått. Appen ska gå att installera på telefonen. Johan ska kunna testa alla dagar interaktivt utan att Elin kan det av misstag.

Familjen: Johan, Elin och dottern Saga (1,5 år). Bor i Höör, Skåne.

## Beslut (ändra inte utan att fråga)

- Ren statisk sajt: HTML, CSS och vanilla JS (ES modules). Ingen bundler, inga runtime-beroenden.
- Deploy direkt från `main` via GitHub Pages (ingen Actions-pipeline behövs).
- Allt luckinnehåll ligger i en fil: `content/days.json`. Tomtens repliker (milstolpe 8) ligger i `content/tomte.json`.
- Datumspärr sker i klienten med enhetens lokala tid. Att fuska genom att ändra telefonens klocka accepteras.
- UI-språk: svenska. Kod och kommentarer: engelska.
- Alla sökvägar är relativa. Sajten serveras under `/<repo-namn>/` på GitHub Pages, så `/foo` (rot-absolut) är förbjudet.
- Inga push-notiser (utanför scope).
- Repot blir publikt på ett gratiskonto. Innehållet går att läsa i källan, det är accepterat.
- I år finns en specialluckan för 29 november (1:a advent) ovanför de 24 vanliga luckorna 1-24 dec. Nästa år börjar kalendern 1 december, utan specialruta.
- Kalendern ska kunna återanvändas nästa år. Ingen årsspecifik logik i koden: titel, datum och innehåll kommer enbart från `content/days.json` (och tomtens från `content/tomte.json`). Nästa år byts bara de filerna.

## Repostruktur

```
/
  index.html
  manifest.webmanifest
  sw.js
  css/style.css
  js/app.js        UI och rendering
  js/dates.js      ren logik: today(), isUnlocked(), formatDate()
  js/storage.js    öppnade luckor, dev-flagga, datum-override
  js/dev.js        dev-panel
  js/scene.js      bakgrund: ljusslinga och snö
  js/themes.js     ren logik: lucktema och adventssöndagar
  js/icons.js      inline-SVG-ikoner
  js/effects.js    öppna-animationer
  js/tomte.js      ren logik: vilken tomtescen som visas, frågesvar, väder
  js/tomte-ui.js   tomten: SVG, pratbubbla, knappar
  content/days.json
  content/tomte.json
  icons/           icon-192.png, icon-512.png, icon-maskable-512.png,
                   apple-touch-icon-180.png, favicon.svg
  tests/dates.test.js
  tests/content.test.js  validering av content/days.json
  tests/tomte.test.js    js/tomte.js och validering av content/tomte.json
  tests/e2e/       Playwright (valfritt, milstolpe 5)
  PLAN.md
  README.md
```

## Datamodell: `content/days.json`

```json
{
  "title": "Adventskalendern 2026",
  "recipient": "Elin",
  "days": [
    {
      "id": "d-2026-11-29",
      "date": "2026-11-29",
      "label": "1:a advent",
      "type": "uppdrag",
      "title": "När första ljuset brinner",
      "verse": "står julens dörr på glänt\noch alla människor glädjas",
      "body": "Text, \n separerar stycken. Ingen HTML.",
      "alternative": { "title": "Plan B", "body": "Valfri reservplan vid dåligt väder" }
    }
  ]
}
```

- `date`: `YYYY-MM-DD`, lokalt datum. Luckorna styrs av `date`, inte av position. Hårdkoda aldrig "1 till 24".
- `type`: `ledtrad` | `litet` | `uppdrag` | `rim` | `jakt`. Styr ikon, färgaccent och öppna-animation.
- `label`: valfri text på luckan, annars dagens nummer i månaden.
- `animation`: valfri. Överstyr typens öppna-animation: `sparkle` (standard för `ledtrad`), `gift` (`litet`), `bells` (`uppdrag`), `ribbon` (`rim`), `magnifier` (`jakt`), `confetti` eller `snowburst`. Okänt värde ger typens standard.
- `alternative`: valfri. Om den finns visas knappen "Dåligt väder? Visa plan B" som byter innehåll i kortet.
- `verse`: valfri sträng, rader separerade med `\n`. Visas i kursiv stil direkt under titeln i kortet, före `body`, en rad per radbrytning. Gäller alla luckor, även specialrutan. Renderas med `textContent` (aldrig `innerHTML`). Plan B visar `alternative.verse` om den finns, annars luckans `verse`.
- `body` renderas med `textContent` (aldrig `innerHTML`), stycken delas på `\n`.

### Seed-innehåll (fasta punkter)

Skapa dessa med riktigt innehåll:

| Datum | Typ | Innehåll |
|---|---|---|
| 2026-11-29 | uppdrag | 1:a advent: Skånska Juldagarna, Bosjökloster (Höör) |
| 2026-12-06 | uppdrag | 2:a advent: baka lussekatter |
| 2026-12-13 | uppdrag | Lucia: vi lussar Saga och hennes mormor när vi hämtar henne |
| 2026-12-20 | uppdrag | 4:e advent: glöggpromenad vid Ringsjön eller i skogen. `alternative`: julfilm, ljus och glögg hemma |
| 2026-12-24 | rim | Platshållare: "Rimmet skrivs av Johan" |

Övriga dagar 1-23 dec: skapa platshållare med `type: "ledtrad"` och texten `TODO`. Innehållet fylls på separat (milstolpe 6).

## Beteende

1. "Idag" är lokalt datum via `getFullYear/getMonth/getDate`. Använd aldrig `toISOString()` (UTC ger fel dag nära midnatt). Jämför strängar på formen `YYYY-MM-DD`.
2. En lucka är upplåst om `today >= date`.
3. Låst lucka: kort skak-animation och en toast, t.ex. "Den här luckan öppnas 6 december" (formatera med `sv-SE`).
4. Upplåst men ej öppnad: öppna-animation (efter typ, se milstolpe 7), visa innehållet i ett kort, spara som öppnad i `localStorage`.
5. Öppnad lucka kan öppnas igen. Missade dagar går att öppna i efterhand.
6. Dagens lucka markeras tydligt. Luckor visas i datumordning. Luckor med datum före 1 december (i år bara 2026-11-29) visas som en större specialruta ovanför rutnätet. Finns inga sådana luckor (som nästa år) renderas ingen specialruta.
7. Omvärdera "idag" vid `visibilitychange` och med en timer till nästa midnatt, så en öppen app uppdateras utan omstart.
8. Saknas eller är `days.json` trasig: visa ett vänligt felmeddelande, inte en vit sida.
9. Efter sista datumet är allt upplåst.
10. Tillgänglighet: luckor är `<button>` med `aria-label` (t.ex. "Lucka 6, låst, öppnas 6 december"). `prefers-reduced-motion` stänger av animationer. Kontrast minst AA.
11. Mobile first (360 px bredd), respektera `safe-area-inset-*`, ingen horisontell scroll.

## Dev-läge

- Aktiveras genom att besöka `?dev=on` en gång. Det sparar en flagga i `localStorage`. `?dev=off` stänger av.
- Utan flaggan ignoreras alla dev-funktioner och inga dev-kontroller renderas. Samma kod körs i prod och dev.
- Dev-panel (liten flytande knapp):
  - datumväljare som åsidosätter "idag" (sparas)
  - knapp "Använd riktigt datum"
  - "Öppna alla"
  - "Nollställ öppnade luckor"
- När override är aktiv visas en tydlig banner: "DEV: simulerat datum 2026-12-10".
- OBS: en installerad PWA har egen `localStorage` på iOS, så dev-flaggan i Safari gäller inte i den installerade appen. Testa datumlogik i webbläsaren, testa installation separat.

## PWA

- `manifest.webmanifest`: `name`, `short_name` ("Advent"), `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `lang: "sv"`, `background_color`, `theme_color`, ikoner 192, 512 och maskable 512.
- `index.html`: länk till manifest, `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-touch-icon`, viewport med `viewport-fit=cover`.
- `sw.js`, registreras med relativ sökväg `./sw.js`:
  - versionerat cache-namn (`CACHE_VERSION`), precache av app-skalet
  - cache-first för skalet
  - stale-while-revalidate för `content/days.json`, så att innehållsändringar når Elin vid nästa uppstart
  - `activate` städar gamla cacher, `skipWaiting` och `clients.claim`
- Appen ska fungera offline efter första besöket.
- Installation: på Android en diskret "Installera"-knapp via `beforeinstallprompt`. På iOS Safari en engångsruta "Tryck på Dela, sedan Lägg till på hemskärmen" om appen inte redan körs standalone.
- Ikoner: skapa en enkel `favicon.svg` och generera PNG-varianterna från den (script eller manuellt).

## Deploy

1. Skapa repo, pusha till `main`.
2. Settings, Pages, Deploy from branch: `main` och `/ (root)`. URL: `https://<user>.github.io/<repo>/`.
3. Bumpa `CACHE_VERSION` i `sw.js` varje gång något i appskalet ändras (inte vid ren innehållsändring i `days.json`).

`README.md` ska beskriva: köra lokalt (`python3 -m http.server 8080` eller `npx serve`), lägga till och ändra luckor, aktivera dev-läge, testa på telefon.

## Tester

- `tests/dates.test.js` med `node --test` mot `js/dates.js`: dagen före, samma dag och dagen efter datumet, 23:59 och 00:00 lokal tid, override.
- `tests/content.test.js` validerar `content/days.json`: giltig JSON, giltiga datum som är unika och i stigande ordning, unika `id`, `type` är `ledtrad`, `litet`, `uppdrag`, `rim` eller `jakt`, och `verse` är en sträng om den finns.
- Playwright smoke (valfritt) med `page.clock`: vid 2026-12-05 går luckor till och med den 5:e att öppna och den 6:e är låst, öppnad lucka finns kvar efter reload, appen laddar offline efter första besöket, manifestet är giltigt.
- Manuellt: iOS Safari "Lägg till på hemskärmen", Android Chrome "Installera".

## Milstolpar

1. **Skelett och spärr.** Rutnät från `days.json`, `dates.js`, låst/upplåst. Klar när: luckor före idag går att öppna, framtida är låsta, testerna i `dates.test.js` är gröna.
2. **Öppna-upplevelsen och design.** Animation, kort, toast, tema (se öppen fråga 2), `alternative`-knapp, felhantering. Klar när: allt i "Beteende" 3-11 fungerar på 360 px.
3. **Dev-läge.** Flagga, panel, datum-override, banner. Klar när: `?dev=on` låter mig simulera valfritt datum och utan flaggan finns inga spår av panelen i DOM.
4. **PWA.** Manifest, ikoner, service worker, installationsflöde. Klar när: Lighthouse PWA-kontroller passerar och appen startar offline.
5. **Tester, README, deploy.** Klar när: Pages-URL:en fungerar och går att installera på riktig telefon.
6. **Innehåll.** Johan (och Claude i chatten) fyller `days.json` med alla luckor. Inte en uppgift för Claude Code.
7. **Jul-design och animationer.** Det ska kännas som en riktig julkalender, inte blå rutor. Natthimlen är kvar som bas, med rött, grönt och guld. Allt ritas med CSS och inline-SVG, inga bilder eller beroenden. Klar när: punkterna nedan fungerar på 360 px, testerna är gröna och `CACHE_VERSION` är bumpad med alla nya filer i precache.
   - **Tema och dekor.** Tomteluva på rubriken (svajande boll), fallande snö (canvas, pausas när fliken är dold, av vid `prefers-reduced-motion`), ljusslinga med glimmande lampor överst, stjärnhimmel, granar och snötäckt mark längst ner. Allt ligger bakom innehållet och tar inga tryck.
   - **Lucktema.** 7 teman (röd med guldkant, grön, pepparkaka, godisrandig, guld, rutig röd, vit med frost) med varsin SVG-ikon. Temat väljs deterministiskt per lucka (samma varje gång) och grannar i rutnätet (4 och 6 kolumner) får aldrig samma tema. Adventssöndagar får adventsljus med 1-4 tända lågor (räknas ut från datumet, ingen årsspecifik logik), lucka 24 ser ut som en julklapp med rosett. Tillstånd: låst (dämpad med lås), dagens (glöd och puls), öppnad (öppen dörr med ikon efter innehållstyp).
   - **Öppna-animationer** efter `type`: `ledtrad` gnistor och stjärnor och kortet viks ut som ett brev, `litet` presentlocket lyfter med konfetti, `uppdrag` dörren svänger upp i 3D med ljus och strålar och klockor ploppar upp, `rim` rosetten knyts upp, paketet öppnas med glitter och hjärtan. Max cirka 1,2 s, tryck för att hoppa över, partiklarna tas bort ur DOM:en efteråt. `prefers-reduced-motion` ger bara en enkel fade. Kort vibration där det stöds, inget ljud. Dev-panelen får "Spela upp animation".
   - **Fält `animation`** (valfritt) i `days.json` överstyr typens animation: `sparkle`, `gift`, `bells`, `ribbon`, `confetti` eller `snowburst`.

8. **Tomten.** En tomte som pratar med Elin i en pratbubbla: en intro i webbläsaren, en välkomst när appen installerats och korta scener varje vecka. Plus lucktypen `jakt`. Klar när: punkterna nedan fungerar på 360 px, `tests/tomte.test.js` är grön och `CACHE_VERSION` är bumpad med de nya filerna i precache.
   - **Lucktyp `jakt`** (skattjakt i huset): eget tema (färgaccent), egen ikon (förstoringsglas med guldkant) och öppna-animationen `magnifier`: ett förstoringsglas sveper över ett papper och det glittrar när kortet och texten visas. `verse` renderas i kursiv under titeln för alla typer (redan på plats sedan milstolpe 7).
   - **Filer.** `js/tomte.js` (ren logik, testas med `node --test`), `js/tomte-ui.js` (DOM) och `content/tomte.json` (data, se nedan).
   - **Utseende.** SVG-tomte med samma tomteluva som rubriken, pratbubbla, knappen "Nästa" mellan raderna och svarsknappar för frågor. En liten ho ho ho-animation när tomten dyker upp, inget ljud. `prefers-reduced-motion` stänger av rörelsen.
   - **Intro** (`intro`): första gången appen öppnas i en vanlig webbläsarflik (inte standalone). Sista steget visar knappen `installButton` om `beforeinstallprompt` har avfyrats, annars texten `installHelp`, och knappen `doneButton`. Visas bara en gång (`localStorage`).
   - **Välkomst** (`welcome`): första gången appen startas installerad (`display-mode: standalone` eller `navigator.standalone`). Egen flagga, oberoende av intro.
   - **Scener** (`scenes`): en scen visas när lokalt datum ligger mellan `from` och `until` (inklusive) och den inte redan setts. Högst en tomte per appstart: intro och välkomst går först, scenen kommer då vid nästa start. Är flera scener möjliga visas den med senast `from` och de andra markeras som sedda. En scen visas aldrig före `from`.
   - **Frågor:** varje svarsalternativ ger sin `reply` direkt. Efter sista frågan visas `closing.allPositive` om alla svar var första alternativet, annars `closing.someNegative` (`closing` är valfritt). Svaren sparas i `localStorage` och används bara för tomtens repliker, de skickas ingenstans.
   - **Väder:** scener med `weatherVariants` visar i detta steg alltid varianten `unknown`. `getWeatherVariant(forecastForDates)` i `js/tomte.js` returnerar `"unknown"` tills väderhämtning kopplas in i en senare milstolpe.
   - **Dev-läge:** dev-panelen listar intro, välkomst och alla scener med knappen "Spela upp" (ignorerar `from`, `until` och setts-status) och har knappen "Nollställ tomtescener". Datum-override styr även vilken scen som är aktuell.
   - **Tester** (`tests/tomte.test.js`): fönsterlogik (före, första dagen, sista dagen, efter), en gång per scen, max en scen per start, intro kontra välkomst, tolkning av frågesvar och `closing`, samt validering av `content/tomte.json`.
   - **PWA:** `content/tomte.json` precachas och serveras stale-while-revalidate som `days.json`. `CACHE_VERSION` bumpas.

## Datamodell: `content/tomte.json`

```json
{
  "name": "Tomten",
  "intro": {
    "lines": ["Ho ho ho! Hej Elin, det är jag, tomten.", "..."],
    "installButton": "Installera appen",
    "installHelp": "Om knappen inte syns: öppna menyn i Chrome och välj Installera app.",
    "doneButton": "Nu kör vi"
  },
  "welcome": { "lines": ["Ho ho ho, välkommen, Elin! Nu bor jag i din telefon."] },
  "scenes": [
    {
      "id": "v1-uppfoljning",
      "from": "2026-12-03",
      "until": "2026-12-06",
      "lines": ["Hej igen, Elin! Jag har en snabb koll inför julen."],
      "questions": [
        {
          "id": "gran",
          "text": "Har ni fixat julgranen?",
          "options": [
            { "label": "Ja, den står där", "reply": "Fint! Nu börjar det likna jul." },
            { "label": "Inte än", "reply": "Då är det dags." }
          ]
        }
      ],
      "closing": { "allPositive": "Fantastiskt!", "someNegative": "Jag tror på er." }
    },
    {
      "id": "v3-vader",
      "from": "2026-12-14",
      "until": "2026-12-17",
      "forecastFor": ["2026-12-19", "2026-12-20"],
      "lines": ["God måndag, Elin! Jag har tittat på vädret inför helgen."],
      "weatherVariants": { "good": ["..."], "bad": ["..."], "unknown": ["..."] }
    }
  ]
}
```

- `name`: tomtens namn, visas ovanför pratbubblan. Valfritt (standard "Tomten").
- `intro`, `welcome`: valfria. `lines` är repliker som visas en i taget. Bara `intro` har `installButton`, `installHelp` och `doneButton` (valfria, med svenska standardtexter).
- `scenes[].id`: unikt och stabilt. Det sparas när scenen setts, så byt inte `id` på en scen som redan visats.
- `scenes[].from`, `until`: `YYYY-MM-DD`, lokalt datum, båda inklusive. `from` <= `until`.
- `scenes[].lines`: repliker i ordning. Visas först.
- `scenes[].weatherVariants`: valfritt. `good`, `bad` och `unknown` är listor med repliker som visas efter `lines`. `forecastFor` säger vilka datum prognosen gäller (används när väder kopplas in).
- `scenes[].questions`: valfritt. Visas efter replikerna, en i taget. `options[0]` räknas som det positiva svaret.
- `scenes[].closing`: valfritt, `allPositive` och `someNegative`. Visas efter sista frågan.
- All text renderas med `textContent`, aldrig `innerHTML`.

## Öppna frågor

1. **Design.** Förslag: mörkblå natthimmel, varm röd och guld som accent, subtil snö med ren CSS, ingen tung grafik. Valfri bild per lucka kan läggas till senare via `image`-fält.
