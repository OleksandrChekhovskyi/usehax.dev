#!/bin/sh
# Render the images the page needs out of demo.cast, by driving the real player headlessly
# so they match what a visitor actually sees. Re-run after replacing the recording.
#
#   tools/make-poster.sh [seconds-into-recording]          -> demo-poster.png
#   tools/make-poster.sh --card [seconds-into-recording]   -> demo-card.png
#
# The poster is the click-to-play still. Rendering it through the player gives it the page's
# font, palette and geometry, so the box does not move when the player takes over. It is a
# frame from mid-session on purpose — playback starts at the beginning of the recording, so
# the picture changes on click even though the layout does not.
#
# The card is the Open Graph link preview. Social cards want about 1.91:1 and the terminal
# is 1.17:1, so the card is composed around the screen rather than cropped out of it.
#
# Needs chromium (or Chrome) and python3; Pillow, if present, palettizes the result to
# roughly half the bytes with no visible difference.
set -eu

mode=poster
if [ "${1:-}" = "--card" ]; then
    mode=card
    shift
fi
at="${1:-75}"
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
port=8799

if [ "$mode" = card ]; then
    # 1200x630 is what every scraper expects. The terminal is set larger than it is on the
    # page because a card is shown at roughly half size in a feed.
    out=demo-card.png
    font=20px
    width=1200
    height=630
    scale=1
else
    # The size the player draws at on the page: 80 columns of 30 rows at exactly 16px,
    # rendered at 2x for high-DPI screens. Keep in step with style.css.
    out=demo-poster.png
    font=16px
    width=774
    height=664
    scale=2
fi

chromium=
for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$candidate" >/dev/null 2>&1; then
        chromium=$candidate
        break
    fi
done
if [ -z "$chromium" ]; then
    echo "make-poster: no chromium/chrome on PATH" >&2
    exit 1
fi

harness="$root/.poster-harness.html"
profile=$(mktemp -d)
server=

cleanup() {
    if [ -n "$server" ]; then
        kill "$server" 2>/dev/null || true
    fi
    rm -f "$harness" || true
    rm -rf "$profile" || true
    return 0
}
trap cleanup EXIT INT TERM

# Mounting and seeking are identical for both images, so they are emitted once and appended
# to whichever layout is in use.
emit_player() {
    cat <<'JS'
<script src="vendor/asciinema-player.min.js"></script>
<script>
  var at = parseFloat(new URLSearchParams(location.search).get("t") || "0");
  var player = AsciinemaPlayer.create("demo.cast", document.getElementById("screen"), {
    preload: true, autoPlay: false, controls: false, fit: false, terminalFontSize: "@FONT@"
  });
  /* Seeking only lands once the recording is parsed, so retry until it takes. */
  var tries = 0;
  (function seek() {
    if (tries++ > 60) return;
    try {
      Promise.resolve(player.seek(at)).then(function (ok) {
        if (!ok) setTimeout(seek, 100);
      }, function () { setTimeout(seek, 100); });
    } catch (e) { setTimeout(seek, 100); }
  })();
</script>
</body>
</html>
JS
}

# Both layouts load the real stylesheet, so the images inherit the site's font, palette and
# window frame; the player's own start overlay is dropped since neither image wants it.
{
    if [ "$mode" = card ]; then
        cat <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="vendor/asciinema-player.css">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  .card { display: flex; flex-direction: column; align-items: center; padding-top: 42px; }
  .card h1 { margin: 0 0 8px; font-size: 56px; font-weight: bold; letter-spacing: 0.04em;
             color: #fff; line-height: 1.1; }
  .card p { margin: 0 0 30px; font-size: 21px; }
  /* The window runs off the bottom edge rather than floating in empty space, which reads
     as a screen continuing past the card. */
  .card .demo-window { width: 990px; max-width: none; border-bottom: 0;
                       border-radius: 8px 8px 0 0; }
  .card .demo { aspect-ratio: auto; height: 420px; padding-bottom: 0; }
  .ap-overlay { display: none !important; }
</style>
</head>
<body>
<div class="card">
  <h1>hax</h1>
  <p>A minimalist, terminal-native coding agent written in C.</p>
  <div class="demo-window">
    <div class="demo-titlebar">
      <span class="demo-dot demo-dot-a"></span>
      <span class="demo-dot demo-dot-b"></span>
      <span class="demo-dot demo-dot-c"></span>
      <span class="demo-title">hax — 80×30</span>
    </div>
    <div class="demo"><div class="demo-screen" id="screen"></div></div>
  </div>
</div>
HTML
    else
        cat <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="vendor/asciinema-player.css">
<style>
  html, body { margin: 0; background: #000; }
  #frame { width: 774px; }
  .ap-overlay { display: none !important; }
</style>
</head>
<body>
<div class="demo" id="frame"><div class="demo-screen" id="screen"></div></div>
HTML
    fi
    emit_player
} | sed "s/@FONT@/$font/" > "$harness"

# Bound to loopback: for the few seconds this runs it would otherwise serve the whole
# repository, .git included, to anything that can reach this host. `exec` matters — without
# it the subshell, not the server, is what $! names, and cleanup leaves an orphan holding
# the port and the directory open.
(cd "$root" && exec python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1) &
server=$!
sleep 1

# A failed bind exits the background job without tripping set -e, which would leave
# chromium screenshotting whatever else holds the port and overwriting a good image.
if ! kill -0 "$server" 2>/dev/null; then
    echo "make-poster: could not serve on port $port; is it already in use?" >&2
    exit 1
fi

"$chromium" --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --user-data-dir="$profile" --force-device-scale-factor="$scale" \
    --window-size="$width,$height" --virtual-time-budget=25000 \
    --screenshot="$root/$out" \
    "http://localhost:$port/.poster-harness.html?t=$at" >/dev/null 2>&1

# Terminal frames hold about a thousand distinct colours, nearly all of them antialiasing,
# so a 256-entry palette is visually lossless and much smaller.
python3 - "$root/$out" <<'PY' || echo "make-poster: no Pillow, 24-bit PNG kept" >&2
import sys
from PIL import Image

path = sys.argv[1]
im = Image.open(path).convert("RGB")
im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE).save(path, optimize=True)
PY

echo "make-poster: wrote $out at t=${at}s"
