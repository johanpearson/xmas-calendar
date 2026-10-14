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

`tests/content.test.js` validerar även `content/days.json` (se "Lägga till och ändra luckor")
och `tests/tomte.test.js` testar tomtens logik och validerar `content/tomte.json` (se "Tomten").
`tests/audio.test.js` testar ljudets rena logik: noter till frekvenser, melodier, jingelns
längd och mute-reglerna (se "Ljud").
`tests/weather.test.js` testar vädret med mockad `fetch`, falsk `localStorage` och falsk
klocka: klassningens gränsvärden (precis under och på gränsen), cachereglerna (färsk,
gammal men tillåten vid nätverksfel, för gammal), timeout, felsvar och saknad data (se "Väder").

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

`tests/e2e/tomte.spec.js` testar tomten: intro, välkomst, scener, frågor, dev-panelen och offline.
`tests/e2e/weather.spec.js` mockar Open-Meteo (`page.route`, inget går till riktiga API:t)
och kontrollerar att väderscenen visar rätt variant vid simulerat datum 2026-12-14 (fint)
och 2026-12-18 (regn), att anropet bara innehåller Höörs koordinater och de avtalade
parametrarna, `unknown` vid felsvar och timeout, cachen och att service workern inte cachar
väderanropen, samt dev-panelens senaste värden.
`tests/e2e/audio.spec.js` testar ljudets koppling (inte hur det låter): ingen `AudioContext`
före första trycket, jingeln startar på introts första "Nästa", knapparna, tyst läge,
musiken och att den pausas när sidan är dold, samt att appen fungerar utan Web Audio.
De andra e2e-testerna markerar alla tomtescener som sedda (`tests/e2e/helpers.js`), så att
tomten inte står i vägen.

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
  - **Spela upp animation**: välj lucka och animation ("Luckans egen" är den som
    `type`/`animation` ger) och förhandsgranska. Luckan markeras inte som öppnad och
    det fungerar även på låsta luckor.
  - **Ljud**: **Spela alla ljud** spelar effekterna en i taget (namnet visas i en
    toast) och **Testa jingle** spelar tomtens jingel. Ljudknappen måste vara på.
  - **Tomten**: intro, välkomst och alla scener med knappen **Spela upp**, som visar dem
    direkt oavsett datum och om de redan setts (och utan att markera dem som sedda).
    Scenen som det simulerade datumet pekar på är markerad "aktuell", och "sedd" visar vad
    som redan visats. Ladda om sidan för att se det Elin skulle se vid en appstart med det
    datumet. **Nollställ tomtescener** glömmer allt tomten visat och alla svar (även intro
    och välkomst).
  - **Prognos**: *Riktig* (standard) hämtar prognosen från Open-Meteo. *Bra*, *Dålig* och
    *Okänd* tvingar väderreplikerna `good`, `bad` eller `unknown` utan att fråga någon
    källa. Valet sparas och gäller både **Spela upp** och scener vid appstart (även efter
    omladdning) tills du byter tillbaka till *Riktig* eller stänger av dev-läget. Under
    väljaren visas senast hämtade prognos: tidpunkt, vilket datum den gäller, nederbörd
    och vind. **Testa hämtning (imorgon)** hämtar direkt (utan cache) en riktig prognos
    för morgondagen enligt det riktiga datumet, inte det simulerade, och visar resultatet
    i en toast ("Prognos för 15 oktober: bra" eller varför det misslyckades). Scenerna
    påverkas inte.
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
  "title": "När andra ljuset brinner",
  "verse": "då är Lucia här\nhon bjuder oss på kaffe",
  "body": "Första stycket.\nAndra stycket.",
  "alternative": { "title": "Plan B", "body": "Valfri reservplan" }
}
```

- `id` måste vara unikt. Byt inte `id` på en lucka som redan öppnats, då glömmer
  appen att den är öppnad.
- `type` är `ledtrad`, `litet`, `uppdrag`, `rim` eller `jakt` (styr ikon, färg och öppna-animation).
  `jakt` är en skattjakt i huset: en guldnyckel med röd rosett som ikon och mintgrön accent.
- `animation` är valfri och byter öppna-animationen för just den luckan:

  | Värde | Animation | Standard för |
  |---|---|---|
  | `sparkle` | gnistor och stjärnor, kortet viks ut som ett brev | `ledtrad` |
  | `gift` | presentlocket lyfter, konfetti | `litet` |
  | `bells` | dörren svänger upp med ljus och strålar, klockor ploppar upp | `uppdrag` |
  | `ribbon` | rosetten knyts upp, paketet öppnas, glitter och hjärtan | `rim` |
  | `magnifier` | ett förstoringsglas sveper över en lapp, kortet glittrar när texten visas | `jakt` |
  | `confetti` | konfetti från luckan | |
  | `snowburst` | snöyra från luckan | |

  Ett okänt värde ger typens standard. Prova animationerna med "Spela upp animation" i dev-läget.
- `label` och `alternative` är valfria. `\n` i `body` delar upp texten i stycken.
- `verse` är valfri: en vers som visas i kursiv stil direkt under titeln, före `body`
  (även i specialrutan). `\n` ger en ny rad. Ingen HTML, texten visas precis som den står.
  Plan B visar samma vers, om inte `alternative` har en egen `verse`.
- `npm test` kontrollerar filen: giltig JSON, unika datum i stigande ordning, unika `id`
  och att `type` är en av de fem ovan. Kör det efter varje ändring.
- Luckor med datum före 1 december visas som en stor specialruta överst.
- Nästa år: byt bara ut `content/days.json` (titel, datum och innehåll).

Efter en ändring: ladda om i webbläsaren och kontrollera att kalendern syns (en trasig
fil ger ett felmeddelande). Pusha till `main`, så når ändringen telefonen nästa gång
appen startas. Ingen `CACHE_VERSION`-bump behövs för innehållsändringar.

## Tomten

En tomte (SVG med samma tomteluva som rubriken) som pratar med Elin i en pratbubbla. Han
dyker upp högst en gång per appstart:

1. **Intro** första gången appen öppnas i en vanlig webbläsarflik. Sista repliken visar
   knappen "Installera appen" om Chrome erbjuder installation, annars en kort hjälptext.
2. **Välkomst** första gången appen startas installerad (från hemskärmen).
3. Annars en **scen** om dagens datum ligger mellan scenens `from` och `until` och den
   inte redan visats. Varje scen visas bara en gång.

"Nästa" stegar mellan replikerna, frågor har en knapp per svar och tomten svarar direkt.
Svaren sparas bara i telefonen (`localStorage`) och används bara för tomtens repliker.
Allt innehåll ligger i `content/tomte.json`:

```json
{
  "name": "Tomten",
  "intro": {
    "lines": ["Ho ho ho! Hej Elin, det är jag, tomten.", "..."],
    "installButton": "Installera appen",
    "installHelp": "Om knappen inte syns: ...",
    "doneButton": "Nu kör vi"
  },
  "welcome": { "lines": ["Ho ho ho, välkommen, Elin!"] },
  "scenes": [
    {
      "id": "v1-uppfoljning",
      "from": "2026-12-03",
      "until": "2026-12-06",
      "lines": ["Hej igen, Elin!"],
      "questions": [
        {
          "id": "gran",
          "text": "Har ni fixat julgranen?",
          "options": [
            { "label": "Ja, den står där", "reply": "Fint!" },
            { "label": "Inte än", "reply": "Då är det dags." }
          ]
        }
      ],
      "closing": { "allPositive": "Fantastiskt!", "someNegative": "Jag tror på er." }
    }
  ]
}
```

- `name` visas ovanför pratbubblan (valfritt, standard "Tomten").
- `intro` och `welcome` är valfria. `lines` visas en i taget. `installButton`,
  `installHelp` och `doneButton` (bara intro) har svenska standardtexter om de saknas.
- `scenes[].id` måste vara unikt. Byt inte `id` på en scen som redan visats.
- `from` och `until` är `YYYY-MM-DD` (lokalt datum), båda inklusive.
- Ordningen i en scen: `lines`, sedan väderrepliker, sedan `questions` och sist `closing`.
- `questions` är valfritt. Första alternativet räknas som det positiva svaret: om alla svar
  var det första visas `closing.allPositive`, annars `closing.someNegative`. `closing` är
  valfritt (och båda texterna i den).
- `weatherVariants` (`good`, `bad`, `unknown`) är väderrepliker och `forecastFor` de datum
  prognosen gäller. Det **sista** datumet i `forecastFor` (promenaddagen) avgör vilken
  variant som visas, se "Väder".
- Överlappar flera scener visas den med senast `from`, och de andra räknas som sedda.
- Texterna visas precis som de står (ingen HTML).
- `npm test` validerar filen: giltiga och unika `id`, giltiga datum med `from` <= `until`,
  frågor med svarsalternativ och `reply`, och att väderscener har `unknown`.
- Är filen trasig eller saknas syns ingen tomte, men kalendern fungerar som vanligt.

Prova tomten med dev-läget (se ovan). Precis som `days.json` hämtas `tomte.json` med
stale-while-revalidate, så ändringar kräver ingen `CACHE_VERSION`-bump.

## Väder

Tomtens väderscener (de med `weatherVariants` i `content/tomte.json`) väljer repliker efter
en riktig prognos för Höör. All logik ligger i `js/weather.js`.

- **Källa:** [Open-Meteo](https://open-meteo.com/) Forecast API
  (`https://api.open-meteo.com/v1/forecast`), utan API-nyckel och direkt från webbläsaren
  (Open-Meteo tillåter CORS). Data under CC BY 4.0, därför står "Väderdata: Open-Meteo.com"
  längst ned i tomtens bubbla när en väderscen visas.
- **Anropet:** `latitude=55.94`, `longitude=13.54` (konstanterna `LATITUDE` och `LONGITUDE`),
  `daily=precipitation_sum,wind_speed_10m_max,temperature_2m_max`, `wind_speed_unit=ms`,
  `timezone=Europe/Stockholm` och `start_date` = `end_date` = promenaddagen. Inget annat
  skickas: inga cookies och ingen referrer.
- **Klassning** (konstanter överst i `js/weather.js`):
  - `bad` om nederbörden är minst `BAD_PRECIPITATION_MM` (2 mm) eller vinden minst
    `BAD_WIND_MS` (10 m/s)
  - `good` om båda är kända och under gränserna
  - `unknown` om data saknas eller anropet misslyckas
- **När:** prognosen hämtas först när en väderscen ska visas, aldrig vid appstart. Tomten
  väntar högst `FETCH_TIMEOUT_MS` (4 s), sedan blir det `unknown`.
- **Cache:** svaret sparas per datum i `localStorage` (`advent.weather.cache`) med
  tidsstämpel. Yngre än 3 timmar (`CACHE_FRESH_MS`) används det direkt. Misslyckas
  hämtningen duger ett svar upp till 24 timmar gammalt (`CACHE_MAX_AGE_MS`), annars
  `unknown`. Service workern rör aldrig väderanropen.
- **För långt fram:** Open-Meteo ger prognos cirka 16 dagar framåt. Längre fram svarar den
  med fel, och det blir `unknown` utan felmeddelande i appen. Väderscenerna 14-20 december
  ligger alltid inom en vecka från promenaddagen.

### Byta källa

Källan är en *provider* i `js/weather.js`: ett objekt med

```js
{
  id: 'smhi',                          // skiljer cachen mellan källor
  attribution: 'Väderdata: SMHI',      // texten i tomtens bubbla
  attributionUrl: 'https://www.smhi.se/',
  async fetchDay(dateKey, { fetch, signal }) {
    // hämta prognosen för dateKey ('YYYY-MM-DD', svensk tid) med fetch och signal
    // (signal avbryter vid timeout) och returnera
    // { precipitation, wind, temperature } i mm, m/s och °C, null där värde saknas.
    // Kasta ett fel om något går snett.
  },
}
```

Skriv en sådan bredvid `openMeteo` och peka om `export const provider = openMeteo;` till
den nya. Klassning, cache, timeout och dev-panelen fungerar som förut. För SMHI: använd
snow1g version 1 (det gamla pmp3g-API:t är avvecklat sedan 31 mars 2026). SMHI ger
tim- eller periodvärden, så `fetchDay` får själv summera nederbörden och ta högsta
vindhastigheten för dygnet (svensk tid). Lägg till ett test i `tests/weather.test.js`,
bumpa `CACHE_VERSION` och kontrollera att källan tillåter CORS.

### Testa varianterna

- **I dev-läget:** välj *Bra*, *Dålig* eller *Okänd* under **Prognos** och tryck **Spela
  upp** på `v3-vader` eller `v3-vaderrapport`. För att se vad Elin ser vid en appstart:
  sätt **Simulerat datum** (t.ex. 2026-12-14 eller 2026-12-18), tryck **Nollställ
  tomtescener** och ladda om.
- **Riktig prognos:** Open-Meteo ger bara prognos cirka 16 dagar framåt räknat från det
  *riktiga* datumet. Före början av december blir väderscenerna därför `unknown` även med
  *Riktig*, också med simulerat datum. Tryck **Testa hämtning (imorgon)** för att se att
  källan svarar; värdena syns sedan i panelen. Vill du se en hel scen med riktig
  prognos: ändra tillfälligt `forecastFor` lokalt till ett datum inom två veckor.
- **Automatiskt:** `npm test` och `npx playwright test tests/e2e/weather.spec.js`.
- **CORS från webbläsaren** (en gång, på en dator med nät): öppna appen, öppna
  utvecklarverktygens konsol och kör
  `fetch('https://api.open-meteo.com/v1/forecast?latitude=55.94&longitude=13.54&daily=precipitation_sum,wind_speed_10m_max,temperature_2m_max&wind_speed_unit=ms&timezone=Europe%2FStockholm&start_date=2026-12-20&end_date=2026-12-20').then((r) => r.json()).then(console.log)`.
  Ett svar med `daily` (eller `error`/`reason` om datumet ligger för långt fram) betyder
  att CORS fungerar; ett CORS-fel syns i konsolen.

## Ljud

Allt ljud skapas i webbläsaren med Web Audio API i `js/audio.js` (oscillatorer, brus,
filter och envelopes). Det finns inga ljudfiler och inga beroenden.

- **Ljudknappen** (högtalaren under rubriken och i tomtens pratbubbla) slår på och av allt
  ljud. Standard: på. Av betyder helt tyst, även musiken.
- **Musik** (bredvid) slår på en lugn speldosa-version av tomtens melodi som loopar med
  en paus mellan varven. Standard: av.
- Inget ljud spelas före första trycket i appen (webbläsarnas autoplay-regler). För en ny
  användare är det tomtens första "Nästa", och då börjar hans jingel.
- Ljudet pausas när appen eller fliken hamnar i bakgrunden och fortsätter när den visas.

| Händelse | Ljud |
|---|---|
| `bells` (`uppdrag`), tomtens entré | bjällror |
| `sparkle` (`ledtrad`), `ribbon` (`rim`), `snowburst` | pling och glittrande arpeggio |
| `gift` (`litet`), `confetti` | mjukt pop och glitter |
| `magnifier` (`jakt`) | sökarsvep och ding |
| låst lucka | lågt "tonk" |
| "Nästa" hos tomten | litet klick |
| tomten dyker upp | bjällror och jingel (refrängen ur "Jingle Bells") |

Ljudet följer animationen, så fältet `animation` i `days.json` byter även ljudet.

**Ändra melodin:** den ligger i `JINGLE_BELLS` i `js/audio.js` som en lista per stämma med
`[notnamn, taktslag]`, t.ex. `['E5', 1]` (fjärdedel) eller `['C5', 4]` (helnot). Notnamn
är bokstav, valfritt `#` eller `b` och oktav (`A4` = 440 Hz), `'R'` är paus. `bpm` styr
jingelns tempo (testet kräver 5-8 s) och `calmBpm` bakgrundsmusikens. Ljudnivåer och
klangfärger ändras i `SOUNDS` och `MASTER_GAIN`. Kör `npm test` efteråt och bumpa
`CACHE_VERSION`.

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
- Ändrar du bara `content/days.json` eller `content/tomte.json` behövs ingen bump.
  Filerna hämtas med stale-while-revalidate: appen visar den sparade versionen direkt och hämtar en ny
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

### Väder (milstolpe 10)

- Promenaddagen är det sista datumet i `forecastFor`; bara den dagen hämtas och avgör.
- Ett enda dåligt värde räcker för `bad` även om det andra saknas (t.ex. 12 m/s och ingen
  nederbörd). `good` kräver att både nederbörd och vind finns. Temperaturen hämtas och
  sparas (syns inte i panelen) men påverkar inte klassningen.
- Alla misslyckanden behandlas lika: nätverksfel, timeout, HTTP-fel, `error: true`,
  saknat datum i svaret eller saknade värden. Då används cache upp till 24 timmar, annars
  `unknown`. Svar utan användbara värden cachas inte, så en senare start kan få en prognos.
- Cachen gäller per källa (`id`), så ett byte av källa ignorerar gamla svar.
- Medan prognosen hämtas (högst 4 s) visas ingen tomte; han dyker upp med hela scenen när
  varianten är bestämd. Scenen markeras som sedd redan innan, som förut.
- Dev-valet "Prognos" sparas i `localStorage` (`advent.dev.forecast`), gäller bara när
  dev-läget är på och rensas när dev-läget stängs av.
- Attributionen "Väderdata: Open-Meteo.com" är en länk till open-meteo.com och visas för
  alla varianter av en väderscen, även `unknown` och när dev-valet tvingar en variant.
- Open-Meteos dokumentationssida och API:t gick inte att nå från miljön där detta byggdes
  (nätverkspolicy). Parametrarna är kontrollerade mot Open-Meteos källkod för
  dokumentationen på GitHub (variabelnamn, enheter, CORS, 16 dagar). CORS och ett riktigt
  svar bör verifieras en gång enligt "Testa varianterna" ovan.
- Ett gammalt e2e-test i `tomte.spec.js` var instabilt: det kunde sätta simulerat datum
  innan appens startkontroll (600 ms) hade körts. Testet väntar nu in den.

### Ljud (milstolpe 9)

- Melodin är refrängen ur "Jingle Bells" (James Lord Pierpont, 1857, public domain) i
  C-dur med slutet "...one-horse open sleigh" som landar på grundtonen. Den är
  nedskriven för hand som noter i `js/audio.js` (ingen inspelning eller ljudfil). En enkel
  stämma med grundton och kvint ligger under. Jingeln är cirka 7 s (270 bpm),
  bakgrundsmusiken samma melodi i 132 bpm (cirka 14,5 s) med 6 s paus mellan varven.
- Speldosan är en triangelvåg med mjuk attack (12 ms) och lång avklingning plus en svag
  oktav ovanför, så att tonerna ringer som en speldosa oavsett notlängd.
- "Första trycket" är vilket tryck eller tangent som helst i appen, inte bara introts
  "Nästa" (som är första trycket för en ny användare). Dök tomten upp innan dess spelas
  hans jingel på första trycket så länge han är kvar på skärmen. Bjällrorna hoppas då över,
  annars skulle de låta mitt i en replik.
- Är ljudet avstängt skapas ingen `AudioContext` alls. Den skapas när ljudet slås på
  (knapptrycket räknas som användartryck).
- Ljudknappen är en `aria-pressed`-knapp med namnet "Ljud". Knappen i tomtens bubbla och
  den under rubriken är samma inställning. Slås ljudet av tystnar även ljud som redan
  spelas.
- Musikknappen visar "av" när ljudet är avstängt (musiken hörs ju inte då), och ett tryck
  på "Musik" slår på både musik och ljud.
- Jingeln tonas ut när tomten stängs, och bakgrundsmusiken sänks medan jingeln spelar.
- Med `prefers-reduced-motion` hoppas animationen över men ljudet spelas ändå (det är
  ingen rörelse). Redan öppnade luckor ger inget ljud, precis som de inte animeras.
  Hoppar man över en animation med ett tryck klingar ljudet ut (högst cirka 1,2 s).
- Dev-förhandsvisningen ("Spela upp animation") spelar också ljudet.
- `snowburst` får plinget med arpeggio och `confetti` popet (de saknade ljud i önskemålen).
- Nivåerna är uppmätta genom att rendera varje effekt i en `OfflineAudioContext`: alla
  effekter klingar ut inom 1,2 s och ligger på ungefär samma nivå, med master gain 0,25.
- Tyst läge på iPhone stänger av Web Audio. Det är inget fel och appen märker det inte.
- De nya filerna `js/audio.js` och `js/audio-ui.js` ligger i precache och `CACHE_VERSION`
  är `v5`.
- Efter första lyssningen (`CACHE_VERSION` `v6`): bjällrorna lät mekaniska och byggs nu
  av en liten bank syntetiserade bjällerslag (egna oharmoniska deltoner med lätt
  svävning och ett kulklick) som spelas många i taget med olika hastighet, nivå och
  stereoläge, mänsklig tajming och några som klingar efter. Förstoringsglasen som ikoner
  för `ledtrad` och `jakt` är utbytta mot ett julbrev och en guldnyckel med rosett.
  Animationen `magnifier` (förstoringsglaset som sveper) är kvar.

### Tomten och lucktypen jakt (milstolpe 8)

- `PLAN.md` sa att allt innehåll ligger i `days.json`. Det gäller fortfarande luckorna;
  tomtens repliker ligger i `content/tomte.json` som önskat, och "Beslut" är uppdaterat
  med det.
- "Max en scen per appstart, intro och welcome går först" tolkas som att tomten visar
  högst en sak per start. Visas intro eller välkomst kommer en aktuell scen vid nästa
  start (om den fortfarande är i sitt datumfönster).
- En "appstart" är när sidan laddas, och även när appen kommer tillbaka från bakgrunden
  på en ny dag. Telefoner håller ofta en installerad app vid liv i dagar, och då skulle
  veckans scen annars missas.
- En scen räknas som sedd så fort den visas, inte när man klickat sig igenom den. Stänger
  Elin tomten med × eller Esc kommer scenen alltså inte tillbaka. Ett tryck utanför
  pratbubblan stänger inte (så att man inte råkar avbryta tomten).
- Tomten väntar 0,6 s efter att kalendern visats, och väntar tills en öppnad lucka är
  stängd. Med `prefers-reduced-motion` dyker han upp direkt utan hopp och "Ho ho ho".
- Sista knappen heter "Hej då!" (introts heter `doneButton`, "Nu kör vi"). Det finns även
  ett × för att stänga.
- Intro och välkomst har egna flaggor. På iOS har den installerade appen egen
  `localStorage`, så där får Elin både introt (i Safari) och välkomsten (i appen).
- Introts installationsknapp använder samma `beforeinstallprompt` som knappen
  "Installera" under rubriken: används prompten på det ena stället försvinner båda.
  Dyker prompten upp medan introt visas byts hjälptexten ut mot knappen. iOS-rutan
  ("Lägg till på hemskärmen") visas som förut, under tomten.
- Svaren sparas per scen och fråga som index för valt alternativ
  (`advent.tomte.answers`). En obesvarad fråga räknas inte som positiv.
- Väderscener visar alltid `unknown`. Saknar en scen en variant används `unknown`.
- I dev-panelen markeras inte en uppspelad scen som sedd, så att man kan spela upp den
  flera gånger. "Nollställ tomtescener" glömmer även intro, välkomst och svar.
- `tomte.json` valideras strikt (samma princip som `days.json`): ett fel gör att tomten
  inte visas alls, i stället för att visa fel scen.
- Lucktypen `jakt` har en mintgrön accent och (sedan milstolpe 9) en gammal guldnyckel
  med röd julrosett som ikon. `ledtrad` har ett julbrev med röd vaxsigill och järnek.
  Förstoringsglasen som ikoner var för svåra att förstå. Animationen heter
  `magnifier`: en lapp flyger ut ur luckan, förstoringsglaset sveper i sicksack över den,
  och kortet glittrar (en glansrand och små guldprickar) när texten visas.
- `verse` renderades redan i kursiv under titeln (milstolpe 7), så inget ändrades där.
- Skärmdumpsskriptet tar nu bilder av alla fem typer från riktiga luckor (det behöver inte
  längre låna en dag för `litet`) och två bilder på tomten.

### Jul-design och animationer (milstolpe 7)

- Allt är ritat med CSS och inline-SVG (inga bildfiler, typsnitt eller beroenden).
  Stjärnor, granar och snömark är små SVG:er som data-URI i `style.css`, ljusslingan
  byggs av `js/scene.js` efter skärmens bredd och ikonerna ligger i `js/icons.js`.
- Snön ritas på en `<canvas>` (max cirka 110 flingor, högst 2x pixeltäthet). Den stoppas
  när fliken är dold och finns inte alls med `prefers-reduced-motion`. Ljusslingan och
  marken skrollar med sidan, stjärnhimlen och snön ligger fast.
- Lucktemat (7 st) väljs med en fröad slump utifrån luckornas datum: samma varje gång
  med samma `days.json`, men ändras datumen (t.ex. nästa år) blir det en ny placering.
  "Grannar" betyder vänster/höger och ovanför/under i både 4-kolumns- (mobil) och
  6-kolumnsrutnätet. Specialrutan ovanför rutnätet räknas inte som granne.
- Adventssöndagarna räknas ut från datumet (fjärde advent är sista söndagen före
  juldagen), så ingen årsspecifik logik behövs och nästa år blir rätt av sig själv.
  Adventsluckorna är adventslila med guldkant och ljusen tänds från vänster. Om julafton
  är en söndag (fjärde advent) vinner julklappsutseendet.
- Lucka 24 är julklappen för alla år (datum `12-24`), oavsett `type`.
- Ikonen inne i en öppnad lucka följer innehållstypen: julbrev (`ledtrad`, ändrad från förstoringsglas),
  paket (`litet`), klocka (`uppdrag`) och skriftrulle (`rim`). Samma ikon visas i kortet.
- Låsta luckor dämpas med natthimlens färg över temat. Texten är alltid ljus där, och
  på de mönstrade temana (godisrandig, rutig, julklapp) ligger siffran på en ljus skylt.
  Kontrasten har mätts mot pixlarna bakom texten i alla teman och tillstånd: minst
  4,9:1 (AA även för liten text).
- Öppna-animationen spelas bara första gången en lucka öppnas. Redan öppnade luckor visar
  kortet direkt. Animationerna tar 1,0-1,1 s plus kortets entré (0,2-0,4 s). Ett tryck
  var som helst eller valfri tangent hoppar över, och då tonar kortet bara in.
- Under animationen dämpas sidan till samma nyans som kortets bakgrund, så övergången
  till kortet blir sömlös.
- Vibrationen är kort (10-90 ms) och körs bara vid riktig öppning, inte i
  dev-förhandsvisningen. iOS Safari saknar `navigator.vibrate`, där händer inget.
- Värdet `ribbon` är mitt namn för `rim`-animationen (rosetten). De andra namnen
  kommer från önskemålen.
- "Spela upp animation" i dev-panelen visar kortet efteråt men markerar inte luckan som
  öppnad, så att man kan förhandsgranska utan att nollställa något.
- Bara `label` för 2026-12-13 ändrades i `days.json`. Titeln ("Vi lussar för Saga och
  mormor") och texten ("Glad Lucia!") handlar redan om Lucia och lämnades orörda.
- Skärmdumparna i `docs/screenshots/` tas med `npm run screenshots` (Playwright, 360 px).
  Mappen ingår inte i appskalet.

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
  (Ersatta av SVG-ikoner i milstolpe 7.)
- Plan B-knappen växlar: "Dåligt väder? Visa plan B" och tillbaka med
  "Tillbaka till ursprungsplanen". Kortet visar alltid ursprungsplanen när det öppnas.
- Kortet stängs med "Stäng", Esc eller tryck utanför kortet.
- Låsning går alltid före "öppnad": en lucka som sparats som öppnad men vars datum inte
  är nått (kan hända efter att man bytt datum i dev-läget) visas som låst.
- Öppna-animationen (3D-flip) körs bara första gången. Redan öppnade luckor visar kortet direkt.
  (Animationerna är ersatta i milstolpe 7, men regeln gäller fortfarande.)
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
