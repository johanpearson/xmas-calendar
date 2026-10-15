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
  js/audio.js      ljud: Web Audio-syntes, jingel, bakgrundsmusik (milstolpe 9)
  js/audio-ui.js   ljud- och musikknappar
  js/weather.js    väder: prognoskälla (provider), klassning, cache (milstolpe 10)
  js/melodies.js   melodier som data och logik för Blandat (milstolpe 11)
  js/scenes.js     dagsscener: register, SVG och cleanup (milstolpe 12)
  js/card.js       ren logik: kortets stycken och val av plan A eller B (milstolpe 13)
  js/latency.js    dev: logg över ljudlatens per tryck (milstolpe 14)
  css/scenes.css   dagsscenernas animationer (milstolpe 12)
  content/days.json
  content/tomte.json
  icons/           icon-192.png, icon-512.png, icon-maskable-512.png,
                   apple-touch-icon-180.png, favicon.svg
  tests/dates.test.js
  tests/content.test.js  validering av content/days.json
  tests/tomte.test.js    js/tomte.js och validering av content/tomte.json
  tests/audio.test.js    ren logik i js/audio.js: noter, melodier, mute
  tests/weather.test.js  js/weather.js: klassning, cache, timeout, fel
  tests/melodies.test.js js/melodies.js: notdata och blandningslogik
  tests/scenes.test.js   js/scenes.js: registret och kopplingen till days.json
  tests/card.test.js     js/card.js: stycken, plan A/B och reservvärden (milstolpe 13)
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
      "alternative": { "title": "När första ljuset brinner", "verse": "…", "body": "Reservplan vid dåligt väder" }
    }
  ]
}
```

- `date`: `YYYY-MM-DD`, lokalt datum. Luckorna styrs av `date`, inte av position. Hårdkoda aldrig "1 till 24".
- `type`: `ledtrad` | `litet` | `uppdrag` | `rim` | `jakt`. Styr ikon, färgaccent och öppna-animation.
- `label`: valfri text på luckan, annars dagens nummer i månaden.
- `animation`: valfri. Överstyr typens öppna-animation: `sparkle` (standard för `ledtrad`), `gift` (`litet`), `bells` (`uppdrag`), `ribbon` (`rim`), `magnifier` (`jakt`), `confetti` eller `snowburst`. Okänt värde ger typens standard.
- `alternative`: valfri, `{ title, verse, body }`. Plan B vid dåligt väder: väljs automatiskt efter prognosen för luckans datum och kan alltid bytas för hand (milstolpe 13). `title` och `verse` är valfria och faller tillbaka på luckans egna.
- `verse`: valfri sträng, rader separerade med `\n`. Visas i kursiv stil direkt under titeln i kortet, före `body`, en rad per radbrytning. Gäller alla luckor, även specialrutan. Renderas med `textContent` (aldrig `innerHTML`). Plan B visar `alternative.verse` om den finns, annars luckans `verse`.
- `body` renderas med `textContent` (aldrig `innerHTML`), stycken delas på `\n`. En tom rad (`\n\n`) ger extra avstånd mellan stycken. `body` får vara tom om `verse` finns.
- `sound`: valfri. Namnet på en ljudeffekt som spelas när luckan öppnas i stället för typens standardljud (milstolpe 11). Måste vara en känd effekt i `js/audio.js`.
- `music`: valfri. Namnet på en melodi i `js/melodies.js` som spelas en gång när luckan öppnas (milstolpe 11).
- `scene`: valfri. Nyckeln till en dagsscen i `js/scenes.js` som visas bakom texten i kortet när luckan öppnas (milstolpe 12). Måste finnas i registret.

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
   - **Öppna-animationer** efter `type`: `ledtrad` gnistor och stjärnor och kortet viks ut som ett brev, `litet` presentlocket lyfter med konfetti, `uppdrag` dörren svänger upp i 3D med ljus och strålar och klockor ploppar upp, `rim` rosetten knyts upp, paketet öppnas med glitter och hjärtan. Max cirka 1,2 s, tryck för att hoppa över, partiklarna tas bort ur DOM:en efteråt. `prefers-reduced-motion` ger bara en enkel fade. Kort vibration där det stöds, inget ljud (ljud kommer i milstolpe 9). Dev-panelen får "Spela upp animation".
   - **Fält `animation`** (valfritt) i `days.json` överstyr typens animation: `sparkle`, `gift`, `bells`, `ribbon`, `confetti` eller `snowburst`.

8. **Tomten.** En tomte som pratar med Elin i en pratbubbla: en intro i webbläsaren, en välkomst när appen installerats och korta scener varje vecka. Plus lucktypen `jakt`. Klar när: punkterna nedan fungerar på 360 px, `tests/tomte.test.js` är grön och `CACHE_VERSION` är bumpad med de nya filerna i precache.
   - **Lucktyp `jakt`** (skattjakt i huset): eget tema (färgaccent), egen ikon (guldnyckel med röd julrosett, tidigare förstoringsglas) och öppna-animationen `magnifier`: ett förstoringsglas sveper över ett papper och det glittrar när kortet och texten visas. `verse` renderas i kursiv under titeln för alla typer (redan på plats sedan milstolpe 7).
   - **Filer.** `js/tomte.js` (ren logik, testas med `node --test`), `js/tomte-ui.js` (DOM) och `content/tomte.json` (data, se nedan).
   - **Utseende.** SVG-tomte med samma tomteluva som rubriken, pratbubbla, knappen "Nästa" mellan raderna och svarsknappar för frågor. En liten ho ho ho-animation när tomten dyker upp, inget ljud (ljud kommer i milstolpe 9). `prefers-reduced-motion` stänger av rörelsen.
   - **Intro** (`intro`): första gången appen öppnas i en vanlig webbläsarflik (inte standalone). Sista steget visar knappen `installButton` om `beforeinstallprompt` har avfyrats, annars texten `installHelp`, och knappen `doneButton`. Visas bara en gång (`localStorage`).
   - **Välkomst** (`welcome`): första gången appen startas installerad (`display-mode: standalone` eller `navigator.standalone`). Egen flagga, oberoende av intro.
   - **Scener** (`scenes`): en scen visas när lokalt datum ligger mellan `from` och `until` (inklusive) och den inte redan setts. Högst en tomte per appstart: intro och välkomst går först, scenen kommer då vid nästa start. Är flera scener möjliga visas den med senast `from` och de andra markeras som sedda. En scen visas aldrig före `from`.
   - **Frågor:** varje svarsalternativ ger sin `reply` direkt. Efter sista frågan visas `closing.allPositive` om alla svar var första alternativet, annars `closing.someNegative` (`closing` är valfritt). Svaren sparas i `localStorage` och används bara för tomtens repliker, de skickas ingenstans.
   - **Väder:** scener med `weatherVariants` visar i detta steg alltid varianten `unknown`. `getWeatherVariant(forecastForDates)` i `js/tomte.js` returnerar `"unknown"` tills väderhämtning kopplas in i en senare milstolpe.
   - **Dev-läge:** dev-panelen listar intro, välkomst och alla scener med knappen "Spela upp" (ignorerar `from`, `until` och setts-status) och har knappen "Nollställ tomtescener". Datum-override styr även vilken scen som är aktuell.
   - **Tester** (`tests/tomte.test.js`): fönsterlogik (före, första dagen, sista dagen, efter), en gång per scen, max en scen per start, intro kontra välkomst, tolkning av frågesvar och `closing`, samt validering av `content/tomte.json`.
   - **PWA:** `content/tomte.json` precachas och serveras stale-while-revalidate som `days.json`. `CACHE_VERSION` bumpas.

9. **Ljud.** Små julljud, en tomtejingel och valfri bakgrundsmusik. Klar när: punkterna nedan fungerar på 360 px, `tests/audio.test.js` är grön och `CACHE_VERSION` är bumpad med de nya filerna i precache.
   - **Inga ljudfiler.** Allt ljud genereras med Web Audio API i `js/audio.js` (oscillatorer, brus, filter och envelopes). Inga ljudfiler i repot (publikt repo, inget upphovsrättsskyddat) och inga beroenden.
   - **Autoplay.** `AudioContext` skapas eller återupptas först efter ett användartryck. Tomtens intro, första "Nästa", är det trycket för en ny användare. Före första trycket: inget ljud och inga fel.
   - **Ljudknapp** (högtalarikon) i huvudvyn och i tomtens bubbla: på/av, sparas i `localStorage`. Standard: på. Av betyder helt tyst (även musiken).
   - **Volym:** låg som standard (master gain cirka 0,25).
   - **Bakgrund:** `AudioContext` pausas (`suspend`) när fliken eller appen hamnar i bakgrunden (`visibilitychange`) och återupptas när den visas igen.
   - **Effekter**, alla under 1,5 s, kopplade till samma händelser som animationerna och till fältet `animation` i `days.json`:
     - bjällror: `bells` (lucktyp `uppdrag`) och tomtens entré
     - pling och glittrande arpeggio: `sparkle` (`ledtrad`) och `ribbon` (`rim`)
     - mjukt pop och glitter: `gift` (`litet`) och `confetti`
     - sökarsvep och ding: `magnifier` (`jakt`)
     - lågt "tonk" vid låst lucka
     - litet klick vid "Nästa" i tomtens bubbla
   - **Tomtens jingel:** 5-8 s speldosa när tomten dyker upp (intro, välkomst, scener). Melodin är en liten datastruktur (notnamn och längd i taktslag) och spelas med sinus/triangel och mjuk envelope. Public domain-melodi: refrängen ur "Jingle Bells" (James Lord Pierpont, 1857).
   - **Bakgrundsmusik:** valfri, av som standard, egen knapp "Musik" bredvid ljudknappen. Låg volym, loopar en lugnare speldosa-version av samma melodi med paus mellan varven. Pausas när fliken är dold.
   - **Robust:** inga fel om ljud inte kan spelas (saknat Web Audio, tyst läge, nekad uppspelning).
   - **Dev-läge:** knapparna "Spela alla ljud" och "Testa jingle" i dev-panelen.
   - **Tester** (`tests/audio.test.js`, `node --test`): ren logik som noter till frekvenser, melodier till händelser och mute-hantering. Själva ljudet testas manuellt.
   - **PWA:** de nya filerna precachas och `CACHE_VERSION` bumpas.

10. **Väder.** Tomtens väderscener (de med `weatherVariants`) väljer `good`, `bad` eller `unknown` utifrån en riktig prognos för Höör. Klar när: punkterna nedan fungerar på 360 px, `tests/weather.test.js` och e2e-testerna är gröna och `CACHE_VERSION` är bumpad med `js/weather.js` i precache.
   - **Källa:** Open-Meteo Forecast API (`https://api.open-meteo.com/v1/forecast`), utan API-nyckel, direkt från webbläsaren (CORS). Plats: Höör, `latitude` 55.94, `longitude` 13.54, konstanter i `js/weather.js`. Daily-variablerna `precipitation_sum`, `wind_speed_10m_max` och `temperature_2m_max`, `wind_speed_unit=ms`, `timezone=Europe/Stockholm`, `start_date` och `end_date` satta till promenaddagen.
   - **Provider:** källan ligger bakom ett litet gränssnitt i `js/weather.js` (`id`, `attribution`, `fetchDay(dateKey, { fetch, signal })`) så att den kan bytas mot t.ex. SMHI (snow1g version 1, pmp3g är avvecklat sedan 31 mars 2026).
   - **Klassning** (konstanter överst i filen): det sista datumet i scenens `forecastFor` används. `bad` om `precipitation_sum` >= 2 mm eller `wind_speed_10m_max` >= 10 m/s, `good` om ingen av dem gäller, `unknown` om data saknas eller anropet misslyckas.
   - **Robusthet:** hämtas först när en väderscen ska visas, inte vid appstart. Timeout 4 s (`AbortController`). Resultatet cachas per datum i `localStorage` med tidsstämpel: yngre än 3 timmar används direkt, vid nätverksfel duger cache upp till 24 timmar, annars `unknown`. Datum längre fram än källan tillåter (fel eller tomt svar) ger `unknown`, inga felmeddelanden i UI. Bara koordinaterna skickas (ingen referrer, inga cookies).
   - **Service worker:** hanterar bara same-origin GET. Väderanropen går direkt till nätverket och cachas aldrig av service workern.
   - **Attribution:** en liten text "Väderdata: Open-Meteo.com" längst ned i tomtens bubbla när en väderscen visas (CC BY 4.0).
   - **Dev-läge:** väljaren "Prognos" (Riktig, Bra, Dålig, Okänd) överstyr `getWeatherVariant`, sparas och gäller även "Spela upp". Panelen visar senast hämtade värden (nederbörd, vind) och tidpunkt.
   - **Tester:** `tests/weather.test.js` (`node --test`): klassningens gränsvärden, cacheregler (färsk, gammal men tillåten vid nätverksfel, för gammal), timeout och fel med mockad `fetch`, `unknown` vid saknad data. Playwright med mockad Open-Meteo: rätt variant vid simulerat datum 2026-12-14 och 2026-12-18.

11. **Mer musik och roligare ljud.** Fler julmelodier, en musikmeny, en temalåt per lucka och många nya syntetiska ljudeffekter. Klar när: punkterna nedan fungerar på 360 px, `tests/melodies.test.js`, `tests/audio.test.js` och `tests/content.test.js` är gröna och `CACHE_VERSION` är bumpad med `js/melodies.js` i precache.
   - **Inga ljudfiler.** Som i milstolpe 9: allt genereras med Web Audio i `js/audio.js`, melodierna är data i `js/melodies.js`. Inga beroenden.
   - **Melodier** (`js/melodies.js`): notnamn och längd i taktslag per takt, tempo, taktart, en basnot per takt och valfritt ett utdrag (`theme`) för temalåten. `jingle-bells`, `tusen-juleljus` (Nu tändas tusen juleljus), `hej-tomtegubbar`, `deck-the-halls`, `we-wish-you` (We Wish You a Merry Christmas), `stilla-natt` och `santa-lucia`. Bara traditionella melodier eller melodier vars upphovsrätt gått ut, ingen text visas. README listar varje melodi med källa och varför den är fri. Noterna ska vara lätta att rätta efter gehör.
   - **Klang:** speldosa eller celesta (triangel och sinus med klocklik avklingning), en diskret basnot per takt och ett svagt lager bjällror. Låg volym.
   - **Musikmeny:** musikknappen öppnar en liten meny med Av, Blandat, en lista med låtarna och "Nästa låt", samt "Nu spelas: <låt>". Valet sparas, standard Av. Blandat spelar låtarna i slumpad ordning utan samma låt två gånger i rad, med en kort paus mellan låtarna. `santa-lucia` ingår i Blandat först från och med 13 december (inställning i `js/melodies.js`, dev-datum respekteras).
   - **Duckning:** bakgrundsmusiken sänks medan en temalåt eller tomtens jingel spelar och återställs efteråt.
   - **Temalåt:** har en lucka `music` spelas den melodin en gång (högst cirka 20 s) när luckan öppnas, om ljudet är på, oberoende av musikmenyn.
   - **Ljudeffekter** (`sfx.play(namn)`), alla under 2 s: globala `sleigh` (tomtens entré, stereosvep), `knock` (låst lucka, ersätter "tonk") och `fanfare` (jakt-lucka öppnas). `ho` och `door` var med i planen men togs bort efter lyssning: de gick inte att få att låta rätt med syntes. Per lucka via `sound`: `bells`, `twinkle`, `cat`, `sneak`, `camera`, `paper`, `candy`, `chime`, `splat`, `pop`, `mystery`, `popcorn`, `glogg`, `bingo` och `unwrap`. Luckor utan `sound` får typens standardljud. Alla effekter följer ljudknappen och master gain och får inte klippa.
   - **Validering:** `sound` och `music` i `days.json` måste vara kända nycklar, `scene` tillåts.
   - **Dev-läge:** alla melodier och effekter med knappen "Spela", "Spela alla effekter i följd" och vilka luckor som använder vilken effekt eller melodi.
   - **Tester** (`node --test`): notdata (giltiga noter, positiva längder, rimlig längd), att alla `sound` och `music` i `days.json` finns i koden och blandningslogiken (ingen upprepning i rad, `santa-lucia` låst före 13 december).
   - **PWA:** `js/melodies.js` precachas och `CACHE_VERSION` bumpas.

12. **Dagsscener.** Varje lucka kan ha en egen liten animerad scen (fältet `scene`). Klar när: punkterna nedan fungerar på 360 px, `tests/scenes.test.js`, `tests/content.test.js` och e2e-testerna är gröna och `CACHE_VERSION` är bumpad med `js/scenes.js` och `css/scenes.css` i precache.
   - **Inga bilder, inga beroenden.** Allt ritas med inline-SVG och animeras med CSS. Högst ett fåtal DOM-element per partikel och högst cirka 40 partiklar per scen.
   - **Register** (`js/scenes.js`): varje scennyckel har `render(container, { date, reducedMotion })` som ritar scenen och returnerar en cleanup-funktion. Cleanup tar bort alla noder, lyssnare och timers.
   - **I kortet:** scenen visas bakom texten när luckan öppnas: en kort entré (högst cirka 3 s) och sedan en lugn loop med låg CPU-last. Loopen pausas när fliken är dold. Texten ligger på papper, så kontrast och läsbarhet blir inte sämre.
   - **På huvudskärmen:** för `advent1`, `advent2`, `lucia`, `advent4`, `cat` och `christmas` visas en liten version på luckans datum. Den ligger bakom rutnätet, tar inga tryck och ändrar inte layouten.
   - **`prefers-reduced-motion`** ger en stilla bild (slutläget).
   - **Scener:** `advent1`, `advent2`, `advent4` (adventsljusstake med 1, 2 och 4 tända ljus, `advent4` med snöig skog), `lucia` (Lucia och tärnor glider in, skenet tonar upp, tre ljus tänds, stjärnor), `tree` (granen växer fram och tänds), `christmas` (gran med paket, stjärna och glöd), `cat` (Hiro tittar upp och viftar på svansen), `camera` (blixt och polaroid), `letter` (vaxsigill som bryts), `candy` (fallande godis), `paint` (färgklickar som blir en ren), `party` (konfetti och bubblor), `cozy` (ljus och hjärtan), `gold` (guldstoft), `snow`, `stars`, `lanterns`, `flashlight` (ficklampskägla), `mystery` (frågetecken), `movie` (filmflimmer och stjärnor), `glogg` (rykande mugg), `solstice` (solnedgång, stjärnor och ljus), `countdown` (två blinkande stjärnor) och `bingo` (studsande bingokulor).
   - **Ljud:** scenens entré och luckans ljudeffekt (`sound`, annars typens) startar samtidigt. Temalåten (`music`) spelas som i milstolpe 11.
   - **Dev-läge:** alla scener med "Spela upp" (förhandsvisning i kortet utan att markera eller nollställa luckor) och "Visa dagens huvudskärmsdekor" för valfritt datum.
   - **Tester:** alla `scene` i `days.json` finns i registret, cleanup tar bort alla noder och timers. Playwright tar skärmdumpar vid 360 px av slutläget för varje scen och av huvudskärmen 2026-12-13, 2026-12-04 och 2026-12-24.
   - **PWA:** `js/scenes.js` och `css/scenes.css` precachas och `CACHE_VERSION` bumpas.

13. **Innehållsuppdatering och automatisk plan B.** Innehållet redigeras i Excel och konverteras till `content/days.json` och `content/tomte.json`. Appen anpassas till det nya innehållet och plan B väljs automatiskt efter vädret. Klar när: punkterna nedan fungerar på 360 px, `tests/card.test.js`, `tests/content.test.js`, `tests/tomte.test.js` och e2e-testerna är gröna och `CACHE_VERSION` är bumpad med `js/card.js` i precache.
   - **`alternative`** har `title`, `verse` och `body`. Plan B visar `alternative.title` och `alternative.verse` (saknas de: luckans egna) med `alternative.body`. Titel och vers ser likadana ut i plan A och B, bara texten skiljer.
   - **Tom `body`** är tillåten om luckan har `verse`: kortet visar titel och kursiv vers utan tom text eller extra avstånd.
   - **Tomma rader** i `body` ger extra avstånd mellan stycken, de försvinner inte.
   - **Validering:** typen `jakt` och fälten `scene`, `sound` och `music` tillåts, `body` får vara tom om `verse` finns och `alternative.verse` är tillåtet. Varje `scene`, `sound` och `music` i `days.json` ska finnas i koden.
   - **Automatisk plan B:** gäller varje lucka med `alternative`. När luckan öppnas anropas `getWeatherVariant([luckans datum])` i `js/weather.js`, samma funktion och cache som tomtens väderscener.
     - `bad`: plan B visas direkt med raden "Tomten har tittat på vädret och det ser blött eller blåsigt ut, så det blir plan B." ovanför texten, och knappen "Visa plan A".
     - `good` eller `unknown`: huvudtexten med knappen "Dåligt väder? Visa plan B".
     - Knappen fungerar alltid åt båda hållen oavsett prognos.
     - Hämtningen fördröjer aldrig öppnandet märkbart: har prognosen inte kommit inom cirka 800 ms öppnas luckan med huvudtexten, och blir svaret sedan `bad` byts den till plan B med en mjuk övergång, men inte om Elin redan bytt för hand.
     - Prognosen på luckans dag gäller, även om den skiljer sig från vad tomten sa tidigare i veckan.
   - **Dev-läge:** väljaren "Prognos" (Riktig, Bra, Dålig, Okänd) styr även plan B.
   - **Tester:** `node --test` för valet av plan A eller B (bad, good, unknown, timeout, manuellt byte åt båda hållen) och reservvärdena för titel och vers. Playwright med mockad Open-Meteo och simulerat datum 2026-12-20 (dålig, bra och okänd prognos, knappen åt båda hållen, samma titel och vers), plus luckorna 2026-12-02 (tom `body`) och 2026-12-08 (tom rad i `body`). Skärmdumpar vid 360 px.
   - **PWA:** `js/card.js` precachas, `CACHE_VERSION` bumpas, `content/days.json` och `content/tomte.json` ligger kvar i precache med stale-while-revalidate.

14. **Ljudfördröjning.** Ljudeffekterna kom märkbart för sent när en lucka öppnades på Android. Målet: ljudet startar inom cirka 50 ms efter trycket och ligger i synk med animationen. Klar när: punkterna nedan fungerar på 360 px, `tests/audio.test.js` och e2e-testerna är gröna, uppmätta värden före och efter står i PR-beskrivningen och `CACHE_VERSION` är bumpad med `js/latency.js` i precache.
   - **Som tidigare:** ingen bundler, inga runtime-beroenden, inga ljudfiler i repot. Förrenderade buffertar skapas i webbläsaren vid körning och sparas aldrig.
   - **Mät först (dev-läge):** `performance.now()` för `pointerdown` på luckan, när `sfx.play` anropas, ljudets schemalagda starttid (`AudioContext.currentTime`, `baseLatency`, `outputLatency`) och animationens första bildruta. Dev-panelen visar siffrorna under "Ljudlatens". Notera om fördröjningen bara gäller första luckan efter appstart, vissa effekter eller lucka 20 december (prognoshämtningen får aldrig blockera ljud eller animation).
   - **Tryck:** ljud och öppnande triggas på `pointerdown`, inte på `click` eller efter animationens slut. Ljudet startas först, det tunga ritandet (öppna-animationen och DOM-uppdateringar) i nästa `requestAnimationFrame`. Tangentbordet (Enter, mellanslag) öppnar som förut via `click`. Blir trycket en scroll (`pointercancel`) avbryts öppnandet. Ersätter milstolpe 12:s "ljudet startar med scenens entré": scenen kommer som förut med kortet, ljudet redan vid trycket.
   - **AudioContext:** skapas med `latencyHint: 'interactive'` vid första `pointerdown` var som helst i appen och väcks med en tyst buffert. Ingen `await ctx.resume()` när kontexten redan kör. Återupptas tidigt vid `visibilitychange`.
   - **Förrendering:** effekterna renderas till `AudioBuffer` med `OfflineAudioContext` i vilolägen (`requestIdleCallback`, annars `setTimeout` i små steg) efter första trycket, så att uppspelning bara är en `AudioBufferSourceNode`. Idag och redan upplåsta luckors effekter först, buffertarna återanvänds, låg samplingsfrekvens (22050 Hz, 32000 Hz för bjällrorna) och tystnad i slutet kapas. Är bufferten inte klar spelas den direkt syntetiserade versionen som reserv. Tomtens jingel och temalåtarna förrenderas på samma sätt. Duckningen av bakgrundsmusiken har en ramp under 100 ms och fördröjer aldrig effekterna.
   - **Schemaläggning:** effekter startar på ljudklockan med lookahead `ctx.currentTime + 0.005`, aldrig med `setTimeout`.
   - **Finjustering:** överst i `js/audio.js` finns `SFX_LEAD_MS` och en tabell med offset per effekt (ms relativt animationens start, negativt = ljudet först). README beskriver var synken justeras. Dev-panelen har "Testa ljud med aktuell offset" per effekt.
   - **Tester:** `node --test` för schemaläggningen (lookahead, ingen await på igång-kontext, reserv när bufferten inte är klar). Playwright med mockad `AudioContext`: `sfx.play` anropas på `pointerdown`, före scenritandet, och blockeras inte av väderanropet (långsamt mockat Open-Meteo-svar vid 2026-12-20).
   - **PWA:** `js/latency.js` precachas och `CACHE_VERSION` bumpas.

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
- `scenes[].weatherVariants`: valfritt. `good`, `bad` och `unknown` är listor med repliker som visas efter `lines`. `forecastFor` säger vilka datum prognosen gäller; det sista datumet (promenaddagen) avgör varianten (milstolpe 10).
- `scenes[].questions`: valfritt. Visas efter replikerna, en i taget. `options[0]` räknas som det positiva svaret.
- `scenes[].closing`: valfritt, `allPositive` och `someNegative`. Visas efter sista frågan.
- All text renderas med `textContent`, aldrig `innerHTML`.

## Öppna frågor

1. **Design.** Förslag: mörkblå natthimmel, varm röd och guld som accent, subtil snö med ren CSS, ingen tung grafik. Valfri bild per lucka kan läggas till senare via `image`-fält.
