#!/usr/bin/env bash
# Processes the raw "ho ho ho" recording into audio/sfx/hohoho.mp3 (milestone 15).
#   usage: scripts/process-hohoho.sh [raw-file] [out-file]
# Needs ffmpeg and ffprobe. Steps: trim silence at both ends, 80 Hz high-pass, mono,
# cut after the first pause longer than 0.4 s (and at 3 s at the latest), peak to -3 dBFS,
# 10 ms fade in, 150 ms fade out, MP3 44.1 kHz ~96 kbit/s.
set -euo pipefail

RAW="${1:-audio/raw/hohoho.mp3}"
OUT="${2:-audio/sfx/hohoho.mp3}"
TARGET_PEAK=-3     # dBFS
MAX_SECONDS=3
PAUSE_SECONDS=0.4
THRESHOLD=-40dB    # what counts as silence

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$(dirname "$OUT")"

peak() { ffmpeg -hide_banner -i "$1" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-\?[0-9.]*\) dB.*/\1/p'; }

# 1. Mono, 44.1 kHz, high-pass, silence trimmed at the start, then at the end (areverse trick).
TRIM="silenceremove=start_periods=1:start_threshold=$THRESHOLD:start_silence=0.02"
ffmpeg -v error -y -i "$RAW" \
  -af "aformat=channel_layouts=mono,aresample=44100,highpass=f=80,$TRIM,areverse,$TRIM,areverse" \
  "$TMP/trimmed.wav"

# 2. Cut after the first pause longer than PAUSE_SECONDS once the sound has started (the
#    first silence_start after a silence_end), and never past MAX_SECONDS.
CUT="$(ffmpeg -hide_banner -i "$TMP/trimmed.wav" -af "silencedetect=n=$THRESHOLD:d=$PAUSE_SECONDS" -f null - 2>&1 \
  | sed -n 's/.*silence_start: \([0-9.]*\).*/\1/p' | head -1)"
DURATION="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/trimmed.wav")"
END="$(awk -v c="${CUT:-$DURATION}" -v m="$MAX_SECONDS" 'BEGIN { print (c < m ? c : m) }')"
echo "raw trimmed: ${DURATION}s, cut at ${END}s (pause > ${PAUSE_SECONDS}s: ${CUT:-none})"

# 3. Peak to TARGET_PEAK with a plain gain (loudnorm is unreliable on clips this short).
ffmpeg -v error -y -i "$TMP/trimmed.wav" -t "$END" "$TMP/cut.wav"
GAIN="$(awk -v t="$TARGET_PEAK" -v p="$(peak "$TMP/cut.wav")" 'BEGIN { printf "%.2f", t - p }')"
echo "gain: ${GAIN} dB"

# 4. Fades (150 ms out ends at the exact end of the clip), gain, MP3.
LEN="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/cut.wav")"
FADE_OUT_START="$(awk -v l="$LEN" 'BEGIN { printf "%.4f", l - 0.15 }')"
ffmpeg -v error -y -i "$TMP/cut.wav" \
  -af "volume=${GAIN}dB,afade=t=in:d=0.01,afade=t=out:st=$FADE_OUT_START:d=0.15" \
  -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k "$OUT"

ls -l "$OUT"
