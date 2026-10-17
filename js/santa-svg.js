// Tomten's SVG, shared by the dialog (tomte-ui.js) and the peeking Santa (peek.js).

// Constant, authored markup (never content from tomte.json). The hat is the same one as
// on the page title and uses its classes (hat-body, hat-ball, ...) and colours.
export const SANTA_SVG = `
  <svg class="tomte-svg" viewBox="0 0 120 132" aria-hidden="true" focusable="false">
    <path class="tomte-coat" d="M10 132c3-20 16-31 36-33h28c20 2 33 13 36 33z"/>
    <path class="tomte-coat-fur" d="M52 99h16v33H52z"/>
    <circle class="tomte-face" cx="60" cy="70" r="23"/>
    <circle class="tomte-cheek" cx="45" cy="76" r="4.5"/>
    <circle class="tomte-cheek" cx="75" cy="76" r="4.5"/>
    <path class="tomte-beard" d="M35 72c-2 26 9 40 25 42 16-2 27-16 25-42-5 9-13 13-25 13s-20-4-25-13z"/>
    <ellipse class="tomte-mouth" cx="60" cy="92" rx="4.5" ry="3"/>
    <path class="tomte-moustache" d="M60 84c-4-6-13-7-17-2 3 1 5 4 9 4 4 0 6-1 8-2zm0 0c4-6 13-7 17-2-3 1-5 4-9 4-4 0-6-1-8-2z"/>
    <circle class="tomte-nose" cx="60" cy="78" r="4.2"/>
    <g class="tomte-eyes">
      <ellipse cx="51" cy="68" rx="2.4" ry="2.8"/>
      <ellipse cx="69" cy="68" rx="2.4" ry="2.8"/>
    </g>
    <path class="tomte-brow" d="M46 62.5q5-3 9 0M65 62.5q5-3 9 0"/>
    <g class="tomte-hat-wrap"><g transform="translate(25 3) scale(1.06)">
      <path class="hat-body" d="M9 47C12 25 28 8 48 6c10-1 18 5 21 15-6-5-11-5-14 0-3 6-1 16 3 26z"/>
      <path class="hat-shade" d="M48 6c10-1 18 5 21 15-6-5-11-5-14 0-3 6-1 16 3 26H46c-4-12-3-30 2-41z"/>
      <g class="hat-ball"><circle cx="70" cy="27" r="7"/></g>
      <rect class="hat-fur" x="3" y="43" width="60" height="15" rx="7.5"/>
    </g></g>
  </svg>`;
