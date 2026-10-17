# Regi-anteckningar, teaser v2

Två friare versioner av filmen (1080x1920, 30 fps). Texter, hintar och ljudtider finns i `src/v2/cues.json`
och är samma data som kompositionerna och ljudskripten läser, så anteckningarna nedan är facit.

## A, "Klassisk julfilm" (TeaserA, 39 s)

| Tid (s) | Bild | Text | Hint | Ljud |
|---|---|---|---|---|
| 0-5 | Småstad i skymning, snö, fönster tänds ett i taget, långsam inzoomning | "I en liten stad där snön får ligga kvar..." | | Fade in, speldosa: Nu tändas tusen juleljus, bjällror |
| 5-10 | Närmare på husen, bokeh | "...bor en man med en plan." | | Harpa |
| 10-16 | Verkstad: man i ryggtavla vid lampa, bord med små luckor | "En plan som kräver lim, tålamod och tystnad." / "Elin får inte veta." | kattsvans i bildkanten 10,6 s; förstoringsglas 14,6 s | ding vid hintarna |
| 16-22 | Snögata på natten, kamera glider framåt | "Snön faller. Kakaon puttrar." / "Det är nästan lite för tyst." | fotspår till lykta 17,4 s; rykande kopp 20,4 s | pizzicato, celesta |
| 22-27 | Fönster utifrån, tomteluva tittar upp | "Någon i röd luva har redan tjuvkikat." | pepparkaka med leende 25,8 s | "Ho ho ho" 23,4 s med klang och eko, bjällror |
| 27-31,5 | Luckor som lyser, kamerablixt | "Lucka för lucka. Dag för dag." | kamerablixt med tom polaroidram 28,6 s | poff 28,7 s |
| 31,5-35 | Titelkort i guld | "Adventskalendern 2026" / "Till Elin" | adventsljus som tänds 32,4 s | Stor klockklang, temat |
| 35-39 | Stilla slutkort | "Från Johan" / "Första luckan öppnas 29 november." | | Sista ackordet, fade ut 3 s |

## B, "Julfilms-trailer med glimten i ögat" (TeaserB, 39,2 s)

| Tid (s) | Bild | Text | Hint | Ljud |
|---|---|---|---|---|
| 0-3 | Mörker, snö | "I en värld av snö och kakao..." | | Klocka, droner |
| 3-6 | Tre snärtiga klipp: stad, verkstad, gata | "...har en man en plan." | | Dingar vid klippen, pizzicato |
| 6-8,8 | Kapitelkort | "Kapitel ett" / "Planen" | | Pukslag |
| 8,8-12,8 | Verkstaden, hård inzoomning | "Baserad på en sann adventskalender" | kattsvans 9,8 s; förstoringsglas 11,2 s | Fagott och glockenspiel, Hej tomtegubbar |
| 12,8-15,6 | Kapitelkort | "Kapitel två" / "Hemligheten" | frågetecken som glimmar 13,8 s | Pukslag, låga stråkar |
| 15,6-19,8 | Gatan, snabb körning framåt | "Hon anar ingenting. Nästan." | fotspår till lykta 16,4 s; rykande kopp 18,2 s | Stråkar stiger |
| 19,8-23,8 | Luckor blinkar | "I år kommer julen i luckor" | pepparkaka med leende 21,6 s | Jingle Bells staccato, bell tree |
| 23,8-28,8 | Rollistkort | "Medverkande" / "Elin" / "Johan" / "Snön, som sig själv" / "Kakaon, i en biroll" | | Mjuk harpa och stråkar, stigande puls |
| 28,8-32 | Tomteluva dyker upp, blixt | "Rekommenderas av tomten" | paket med lyft lock 30,2 s | "Ho ho ho" 29,3 s med klang, poff, pukor |
| 32-35,2 | Titelkort i guld | "Adventskalendern 2026" / "Till Elin" | adventsljus som tänds 33,4 s | Tema, klockklang |
| 35,2-39,2 | Slutkort | "Från Johan" / "Första luckan öppnas 29 november." | | Sista ackordet, fade ut 3 s |


## Spoilerkontroll

Genereras ur `src/v2/cues.json` och kontrolleras mot regel 3 och 4 (inga förbjudna ord, inga namn utöver Elin och Johan, inga datum utom 29 november; hintar bara från listan, högst 8 per film, högst 1,5 s var; varje textrad minst 2 s).

### TeaserA

Texter:
- 0.8-4.6 s (3.8 s, 78 px): "I en liten stad där snön får ligga kvar..."
- 5.2-9.2 s (4.0 s, 84 px): "...bor en man med en plan."
- 10.0-13.6 s (3.6 s, 76 px): "En plan som kräver lim, tålamod och tystnad."
- 14.0-16.9 s (2.9 s, 88 px): "Elin får inte veta."
- 16.9-19.9 s (3.0 s, 80 px): "Snön faller. Kakaon puttrar."
- 20.1-22.7 s (2.6 s, 80 px): "Det är nästan lite för tyst."
- 23.6-27.3 s (3.7 s, 76 px): "Någon i röd luva har redan tjuvkikat."
- 27.8-31.3 s (3.5 s, 84 px): "Lucka för lucka. Dag för dag."
- 31.8-35.4 s (3.6 s, 104 px): "Adventskalendern"
- 32.2-35.4 s (3.2 s, 150 px): "2026"
- 33.0-35.4 s (2.4 s, 86 px): "Till Elin"
- 35.6-38.9 s (3.3 s, 100 px): "Från Johan"
- 36.3-38.9 s (2.6 s, 80 px): "Första luckan öppnas 29 november."

Hintar (7 st):
- 10.6-11.9 s (1.3 s): kattsvans som viftar i bildkanten
- 14.6-15.9 s (1.3 s): förstoringsglas som sveper förbi
- 17.4-18.8 s (1.4 s): fotspår i snön som leder till en lykta
- 20.4-21.8 s (1.4 s): rykande kopp utan etikett
- 25.8-27.1 s (1.3 s): pepparkaka med ett leende
- 28.6-29.9 s (1.3 s): kamerablixt med tom polaroidram
- 32.4-33.8 s (1.4 s): adventsljus som tänds

### TeaserB

Texter:
- 0.4-3.0 s (2.6 s, 72 px): "I en värld av snö och kakao..."
- 3.2-6.0 s (2.8 s, 76 px): "...har en man en plan."
- 6.2-8.8 s (2.6 s, 66 px): "Kapitel ett"
- 6.4-8.8 s (2.4 s, 150 px): "Planen"
- 9.2-12.7 s (3.5 s, 72 px): "Baserad på en sann adventskalender"
- 13.0-15.6 s (2.6 s, 66 px): "Kapitel två"
- 13.2-15.6 s (2.4 s, 124 px): "Hemligheten"
- 15.9-19.6 s (3.7 s, 76 px): "Hon anar ingenting. Nästan."
- 20.0-23.6 s (3.6 s, 88 px): "I år kommer julen i luckor"
- 24.0-28.6 s (4.6 s, 66 px): "Medverkande"
- 24.4-28.6 s (4.2 s, 130 px): "Elin"
- 25.0-28.6 s (3.6 s, 130 px): "Johan"
- 25.6-28.6 s (3.0 s, 64 px): "Snön, som sig själv"
- 26.2-28.6 s (2.4 s, 64 px): "Kakaon, i en biroll"
- 29.2-32.0 s (2.8 s, 72 px): "Rekommenderas av tomten"
- 32.4-35.4 s (3.0 s, 104 px): "Adventskalendern"
- 32.7-35.4 s (2.7 s, 150 px): "2026"
- 33.2-35.4 s (2.2 s, 86 px): "Till Elin"
- 35.6-39.0 s (3.4 s, 100 px): "Från Johan"
- 36.2-39.0 s (2.8 s, 66 px): "Första luckan öppnas 29 november."

Hintar (8 st):
- 9.8-11.1 s (1.3 s): kattsvans som viftar i bildkanten
- 11.2-12.6 s (1.4 s): förstoringsglas som sveper förbi
- 13.8-15.2 s (1.4 s): frågetecken som glimmar till
- 16.4-17.8 s (1.4 s): fotspår i snön som leder till en lykta
- 18.2-19.5 s (1.3 s): rykande kopp utan etikett
- 21.6-22.9 s (1.3 s): pepparkaka med ett leende
- 30.2-31.6 s (1.4 s): paket vars lock lyfts en aning
- 33.4-34.8 s (1.4 s): adventsljus som tänds

Resultat: alla regler uppfyllda.
