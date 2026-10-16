# Teaser för Adventskalendern 2026

En 34 sekunder lång teaser-film (1080x1920, 30 fps) gjord med [Remotion](https://www.remotion.dev). Ligger på grenen `teaser` och ska aldrig mergas till `main` (GitHub Pages publicerar hela `main`). Allt finns i `teaser/`, appen är orörd.

Färdig film: `out/teaser.mp4`.

## Rendera om

```bash
cd teaser
npm i
npx remotion browser ensure          # hämtar Chrome Headless Shell (kräver remotion.media)
npm run audio                         # skapar public/music.wav (deterministiskt)
npm run studio                        # förhandsgranska i Remotion Studio
npx remotion still Teaser out/stills/t.png --frame=330 --scale=0.5   # en bildruta
npm run preview                       # snabb förhandsversion, halv upplösning
npm run render                        # slutfilm: out/teaser.mp4 (h264, yuv420p, crf 24)
```

Storleken justeras med `--crf` (högre = mindre fil). Nu ca 7,7 MB.

Teckensnitten (Cormorant Garamond och Mountains of Christmas, båda OFL) hämtas från `@remotion/google-fonts` av `scripts/fetch-fonts.mjs` och läggs i `public/fonts/` (redan incheckade). Kör `node scripts/fetch-fonts.mjs` bara om du byter typsnitt.

## Ändra texter och tider

- Texter: `src/timing.ts`, objektet `TEXT`.
- Scenernas start och slut: `SCENES` i `src/timing.ts`. Ändras längden, ändra även `DURATION_S` och `DURATION` i `scripts/make-audio.mjs`.
- Ljudets händelser ligger i `CUES` överst i `scripts/make-audio.mjs` (tändningsklockor `CANDLE_TIMES` måste vara lika i `timing.ts`). Kör `npm run audio` efter ändring.
- Bilder: `src/scenes1.tsx` (intro, hus, ljusstake) och `src/scenes2.tsx` (luckor, montage, titel, datum). Gemensamma effekter (bokeh, snö, filmkorn, vinjett) i `src/fx.tsx`.

## Ljud

`scripts/make-audio.mjs` syntetiserar `public/music.wav` (44,1 kHz, stereo, 16 bit) utan samplingar: speldosa med "Nu tändas tusen juleljus" från ca 3 s (noterna är hämtade från appens `js/melodies.js`, melodin är fri), mjukt bjällerlager, klockslag vid de fyra ljusen (8,9 till 11,9 s), glittersvep vid luckor och montage, klang vid titelkortet (25 s) med lång avklingning. 1 s fade in, 3 s fade out, topp -3,5 dBFS (verifierat även efter AAC-kodning).

## Antaganden

- Längd 34 s (inom 30 till 36 s). Scenerna följer manuset sekund för sekund; scenövergångarna är mjuka övertoningar som överlappar något.
- Titeln "Adventskalendern 2026", "Till Elin", "Från Johan" och "Första luckan öppnas 29 november." används ordagrant. Ingen annan text, inga namn, inga luckors innehåll (`content/` har inte lästs). Luckorna i filmen har bara en generisk stjärnornament, inga datum eller nummer.
- Tomtens "Ho ho ho..." visas med en tomteluva och ett ansikte som tittar upp från nedre bildkanten (monterad i eget SVG, inte hämtad från appen).
- Texter hålls minst 150 px från sidorna och 250 px från över- och underkant.
- Melodin spelas bara första två verserna (till ca 24,6 s) i tempo 86 bpm, så att den hinner klinga ut före titelklangen vid 25 s.
- Typsnitten laddas från lokala filer och inte direkt från Google vid rendering, eftersom Chrome i molnmiljön inte litar på proxyns certifikat för fonts.gstatic.com. Filerna kommer från samma källa som `@remotion/google-fonts` pekar på.
- Rendering i molnmiljön kräver `NODE_USE_ENV_PROXY=1` och `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` för att Node ska använda proxyn (bara relevant där).
- Filen är en liten (ca 8 MB) binär incheckad i repot enligt uppdraget. `out/preview.mp4`, stillbilder och loggar ignoreras av git.
- Remotion har egen licens (gratis för privat bruk och små team, se remotion.dev/license).
