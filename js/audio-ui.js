// The sound button and the music menu. Several sound buttons (the header, Tomten's
// bubble) stay in sync through onAudioChange. Nothing is rendered where Web Audio is missing.

import {
  audioSupported,
  isSoundOn,
  setSound,
  isMusicOn,
  getMusicChoice,
  setMusicChoice,
  nextSong,
  nowPlaying,
  isMusicPaused,
  MUSIC_MENU,
  onAudioChange,
} from './audio.js';
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

// What the menu says is playing.
function nowPlayingText() {
  if (!isMusicOn()) return 'Ingen musik';
  if (!isSoundOn()) return 'Ljudet är avstängt';
  if (isMusicPaused()) return 'Musiken är pausad en stund';
  const title = nowPlaying();
  return title ? `Nu spelas: ${title}` : 'Musiken startar …';
}

/**
 * The "Musik" button and its menu: Av, Blandat, every song and "Nästa låt", with what
 * is playing. The button shows the music as on (gold) while it plays. Returns null
 * without Web Audio.
 */
export function musicMenu(className = 'audio-btn') {
  if (!audioSupported()) return null;
  const wrap = document.createElement('div');
  wrap.className = 'music-wrap';

  const btn = toggleButton(`${className} audio-music`, () => setOpen(menu.hidden));
  btn.append(icon('note', 'audio-icon'), document.createTextNode('Musik'));
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'music-menu');

  const menu = document.createElement('div');
  menu.className = 'music-menu';
  menu.id = 'music-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'Musik');

  const now = document.createElement('p');
  now.className = 'music-now';
  now.setAttribute('aria-live', 'polite');

  const list = document.createElement('ul');
  list.className = 'music-options';
  const options = MUSIC_MENU.map(({ choice, label }) => {
    const item = document.createElement('li');
    const option = toggleButton('music-option', () => setMusicChoice(choice));
    option.textContent = label;
    option.dataset.choice = choice;
    item.append(option);
    list.append(item);
    return option;
  });

  const next = toggleButton('music-next', () => nextSong());
  next.textContent = 'Nästa låt';

  menu.append(now, list, next);
  wrap.append(btn, menu);

  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  // Closes on a tap outside and on Escape (focus back on the button).
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !wrap.contains(e.target)) setOpen(false);
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || menu.hidden) return;
    e.stopPropagation();
    setOpen(false);
    btn.focus();
  });

  const render = () => {
    const choice = getMusicChoice();
    const playing = isMusicOn() && isSoundOn();
    btn.classList.toggle('is-on', playing);
    const current = MUSIC_MENU.find((o) => o.choice === choice)?.label ?? 'Av';
    btn.title = `Musik: ${current}`;
    for (const option of options) option.setAttribute('aria-pressed', String(option.dataset.choice === choice));
    now.textContent = nowPlayingText();
    next.disabled = !isMusicOn();
  };
  render();
  onAudioChange(render);
  return wrap;
}

/** Both buttons in a row, for the main view. Returns null without Web Audio. */
export function audioControls() {
  if (!audioSupported()) return null;
  const row = document.createElement('div');
  row.className = 'audio-controls';
  row.append(soundButton(), musicMenu());
  return row;
}
