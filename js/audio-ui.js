// The sound and music buttons. Several copies (the header, Tomten's bubble) stay in sync
// through onAudioChange. Nothing is rendered where Web Audio is missing.

import { audioSupported, isSoundOn, setSound, isMusicOn, setMusic, onAudioChange } from './audio.js';
import { icon } from './icons.js';

function toggleButton(className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.addEventListener('click', onClick);
  return btn;
}

/** The speaker button: sound on/off (aria-pressed). Returns null without Web Audio. */
export function soundButton(className = 'audio-btn') {
  if (!audioSupported()) return null;
  const btn = toggleButton(`${className} audio-sound`, () => setSound(!isSoundOn()));
  btn.setAttribute('aria-label', 'Ljud');
  // Both icons stay in the button: swapping nodes mid-tap would swallow the click.
  const onIcon = icon('speaker', 'audio-icon');
  const offIcon = icon('speakerOff', 'audio-icon');
  btn.append(onIcon, offIcon);
  const render = () => {
    const on = isSoundOn();
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Ljud på' : 'Ljud av';
    onIcon.style.display = on ? '' : 'none';
    offIcon.style.display = on ? 'none' : '';
  };
  render();
  onAudioChange(render);
  return btn;
}

/** The "Musik" button: background music on/off (aria-pressed). Returns null without Web Audio. */
export function musicButton(className = 'audio-btn') {
  if (!audioSupported()) return null;
  // With the sound off the music is silent, so the button shows off (and a tap turns both on).
  const playing = () => isMusicOn() && isSoundOn();
  const btn = toggleButton(`${className} audio-music`, () => setMusic(!playing()));
  btn.append(icon('note', 'audio-icon'), document.createTextNode('Musik'));
  const render = () => {
    const on = playing();
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Bakgrundsmusik på' : 'Bakgrundsmusik av';
  };
  render();
  onAudioChange(render);
  return btn;
}

/** Both buttons in a row, for the main view. Returns null without Web Audio. */
export function audioControls() {
  if (!audioSupported()) return null;
  const row = document.createElement('div');
  row.className = 'audio-controls';
  row.append(soundButton(), musicButton());
  return row;
}
