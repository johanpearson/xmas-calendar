# Teaser för Adventskalendern 2026

En 36 sekunder lång teaser-film (1080x1920, 30 fps) gjord med [Remotion](https://www.remotion.dev). Ligger på grenen `teaser` och ska aldrig mergas till `main` (GitHub Pages publicerar hela `main`). Allt finns i `teaser/`, appen är orörd.

Färdig film: `out/teaser.mp4`.

## Rendera om

```bash
cd teaser
npm i
npx remotion browser ensure          # hämtar Chrome Headless Shell (kräver remotion.media)
sudo apt-get install -y fluidsynth fluid-soundfont-gm   # en gång, för ljudet
npm run audio                         # bygger public/music.wav (MIDI + FluidSynth)
npm run studio                        # förhandsgranska i Remotion Studio
npx remotion still Teaser out/stills/t.png --frame=330 --scale=0.5   # en bildruta
npm run preview                       # snabb förhandsversion, halv upplösning
npm run render                        # slutfilm: out/teaser.mp4 (h264, yuv420p, crf 24)
```

Storleken justeras med `--crf` (högre = mindre fil). Se filstorleken i slutet av rapporten från ffprobe nedan.

Teckensnitten (Cormorant Garamond och Mountains of Christmas, båda OFL) hämtas från `@remotion/google-fonts` av `scripts/fetch-fonts.mjs` och läggs i `public/fonts/` (redan incheckade). Kör `node scripts/fetch-fonts.mjs` bara om du byter typsnitt.

## Ändra texter och tider

- Texter: `src/timing.ts`, objektet `TEXT`.
- Scenernas start och slut: `SCENES` i `src/timing.ts`. Ändras längden, ändra även `DURATION_S` och `DURATION` i `scripts/make-music.mjs`.
- Ljudet ligger i `scripts/make-music.mjs` (tiderna där är manusets och förskjuts med `SHIFT`, lika med `SHIFT` i `src/timing.ts`; tändningsklockorna ska stämma med `CANDLE_TIMES`). Kör `npm run audio` efter ändring.
- Bilder: `src/scenes1.tsx` (intro, hus, ljusstake) och `src/scenes2.tsx` (luckor, montage, titel, datum). Gemensamma effekter (bokeh, snö, filmkorn, vinjett) i `src/fx.tsx`.

## Ljud

Ljudet är sampelbaserat. `scripts/make-music.mjs`:

1. skriver ett General MIDI-arrangemang (egen liten MIDI-skrivare, inget npm-beroende) till `out/music.mid`,
2. renderar det med `fluidsynth` och SoundFonten FluidR3_GM (`/usr/share/sounds/sf2/FluidR3_GM.sf2`, paketet `fluid-soundfont-gm`) till 44,1 kHz stereo med FluidSynths inbyggda klang och chorus,
3. lägger på en mjuk toppbegränsare (så att klockklangen inte trycker ner resten), 1 s fade in, 3 s fade out och normaliserar toppen till -3,5 dBFS. Resultat: `public/music.wav` (36 s).

Arrangemanget följer manuset (tiderna nedan är manusets, i filmen +2 s, se Antaganden):
- 0-3 s: stråkpad och glitter av jingle bell (kanal 10, ton 83).
- 3-8 s: speldosa (program 10) med "Nu tändas tusen juleljus", bara melodin.
- 8-13 s: harpa (46) i arpeggion och en rörklocka (14) för varje ljus som tänds.
- 13-20 s: celesta (8) och klockspel (9) med växande stråkar, pizzicato (45) som rytm, bell tree (ton 84) när luckorna lyser.
- 20-25 s: staccato-medley av "Hej tomtegubbar" och "Jingle Bells" på klockspel och celesta, med jingle bell och bell tree.
- 25-31 s: temat med stråkar, kör (52), harpa och celesta, en stor rörklockeklang när titelkortet visas och lång avklingning.
- 31-34 s: ett sista mjukt ackord.

Noterna kommer från appens `js/melodies.js` (alla tre melodierna är traditionella/fria). SoundFonten FluidR3_GM är MIT-licensierad (Frank Wen, se `/usr/share/doc/fluid-soundfont-gm/copyright`), så det renderade ljudet får användas fritt.

`scripts/make-audio-synth.mjs` är det tidigare, kodsyntetiserade ljudet. Det finns kvar som reserv, används inte och skriver till `public/music-synth.wav` (inte `music.wav`).

## Antaganden

- Introt ("Det finns en tid på året...") var för kort och är förlängt med 2 s (texten syns nu ca 3,4 s i stället för 1,7 s). Alla senare scener och alla ljudhändelser är förskjutna lika mycket (`SHIFT = 2`), så filmen är 36 s (gränsen i uppdraget). Scenerna följer annars manuset; scenövergångarna är mjuka övertoningar som överlappar något.
- Titeln "Adventskalendern 2026", "Till Elin", "Från Johan" och "Första luckan öppnas 29 november." används ordagrant. Ingen annan text, inga namn, inga luckors innehåll (`content/` har inte lästs). Luckorna i filmen har bara en generisk stjärnornament, inga datum eller nummer.
- Tomtens "Ho ho ho..." visas med en tomteluva och ett ansikte som tittar upp från nedre bildkanten (monterad i eget SVG, inte hämtad från appen).
- Texter hålls minst 150 px från sidorna och 250 px från över- och underkant.
- Melodin är uppdelad över filmen: första frasen på speldosa (3-8 s), nästa på celesta och klockspel (13-20 s) och temat som öppnar titelkortet (25 s). "Hej tomtegubbar" och "Jingle Bells" spelas bara som korta utdrag i montaget. Tempot är lugnt (96 till 108 bpm), snabbare (168 bpm) i montaget.
- Pad, harpa och körer är mitt eget arrangemang (enkla F-dur-ackord), skrivet utan att kunna lyssna på resultatet i miljön; nivåerna är mätta (RMS per tvåsekundersfönster och topp), inte bedömda med öronen. Justera velocities och `level` i `make-music.mjs` efter gehör.
- Typsnitten laddas från lokala filer och inte direkt från Google vid rendering, eftersom Chrome i molnmiljön inte litar på proxyns certifikat för fonts.gstatic.com. Filerna kommer från samma källa som `@remotion/google-fonts` pekar på.
- Ljudbygget kräver `fluidsynth` och `fluid-soundfont-gm` (apt). Den renderade `public/music.wav` är incheckad, så ljudet behöver inte byggas om för att rendera filmen.
- Rendering i molnmiljön kräver `NODE_USE_ENV_PROXY=1` och `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` för att Node ska använda proxyn (bara relevant där).
- Filen är en liten (ca 8 MB) binär incheckad i repot enligt uppdraget. `out/preview.mp4`, stillbilder och loggar ignoreras av git.
- Remotion har egen licens (gratis för privat bruk och små team, se remotion.dev/license).

## Version 2: TeaserA och TeaserB

Två friare filmer, `out/teaser-v2-a.mp4` ("Klassisk julfilm", 39,0 s) och `out/teaser-v2-b.mp4` ("Julfilms-trailer med glimten i ögat", 39,2 s). Regi, texter, hintar och spoilerkontroll står i `CONCEPTS.md`. Den ursprungliga `Teaser` och `out/teaser.mp4` är orörda.

```bash
cd teaser
node scripts/make-music-a.mjs && node scripts/make-music-b.mjs   # public/music-a.wav och music-b.wav
npx remotion render src/index.ts TeaserA out/teaser-v2-a.mp4 --codec=h264 --crf=24 --pixel-format=yuv420p --audio-codec=aac
npx remotion render src/index.ts TeaserB out/teaser-v2-b.mp4 --codec=h264 --crf=24 --pixel-format=yuv420p --audio-codec=aac
npx remotion render src/index.ts TeaserA out/preview-a.mp4 --scale=0.5 --crf=30   # förhandsversion
```

- Texter, tider och hintar: `src/v2/cues.json` (läses av både bild och ljud). Scener och hintar: `src/v2/kit.tsx`, sammansättning: `src/v2/Films.tsx`.
- Ljud: `scripts/audio-lib.mjs` (samma kedja som v1: MIDI, FluidSynth/FluidR3_GM, ffmpeg) plus `make-music-a.mjs` och `make-music-b.mjs`. Effekter ("ding", "poff", bjällror) byggs med FluidSynth och ffmpeg. Mixen får 1 s fade in, 3 s fade ut och topp -3,5 dBFS (mätt -3,4/-3,5 dB i filerna).
- Mätvärden (ffprobe): båda 1080x1920, 30 fps, h264 yuv420p, aac 48 kHz stereo. A: 9,7 MB. B: 8,4 MB. Renderingstid ca 3 min 39 s vardera (parallellt), förhandsversionerna ca 1 min 42 s.

### Antaganden

- "Ho ho ho" är `audio/sfx/hohoho.mp3` från origin/main (redan bearbetad: mono, 96 kbit/s, 1,4 s, topp -3,3 dBFS), använd som den är med eko och en klockklang. Ingen syntetisk ersättare behövdes.
- Hintarna visas som mjukt oskarpa silhuetter på en glödande skiva, 1,3-1,4 s var, 7 i A och 8 i B. Scenerna innehåller inga rekvisita som liknar en hint. Stenen med tomteluva användes inte.
- Orden "kakao" och "tomten" bedömdes som tillåtna. Inga andra namn än Elin och Johan, inga datum utom 29 november.
- Texter i B är versaler för trailerkänslan; alla textrader visas minst 2,4 s och är minst 64 px. Marginaler: minst 150 px i sidled, text börjar minst 280 px från överkanten.
- Ljudbalansen är mätt, inte lyssnad på (ingen ljuduppspelning i miljön). Justera nivåerna i `make-music-*.mjs` efter gehör.
- Typsnitt (Cormorant Garamond, Mountains of Christmas) är samma lokala filer som v1, hämtade via `@remotion/google-fonts`.
- Rendering i molnmiljön kräver `NODE_USE_ENV_PROXY=1` och `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
