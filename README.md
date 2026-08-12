# usehax.dev

Static landing page for [hax](https://github.com/OleksandrChekhovskyi/hax), served via
GitHub Pages at [usehax.dev](https://usehax.dev).

To preview locally:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. If the browser shows a stale page after an edit,
force-reload (Cmd+Shift+R): `http.server` sends no cache headers, so browsers fall back to
heuristic caching.

## The demo

The hero plays `demo.cast`, a terminal recording replayed by
[asciinema-player](https://github.com/asciinema/asciinema-player) — real terminal state, not
video, so the text stays text. `vendor/` holds the player bundle (v3.17.0), copied from the
project's release assets and committed so the page has no build step and no CDN.

Player and recording together weigh about half a megabyte, so neither is on the critical path:
`demo-poster.png` stands in, and the assets are prefetched at low priority once the page has
finished loading, so a click on play usually has nothing left to fetch. That prefetch is
skipped when the browser reports a metered or slow connection. Playback speed and idle
trimming are set where the player is created in `demo.js`, not baked into the recording.

The window frame — title bar, dots, shadow — is CSS in `style.css`; the poster and the player
hold only the terminal itself, stacked in one box with a pinned aspect ratio so that neither
starting playback nor the player's own initial resize moves the page. That box also reserves
34px below the screen for the player's control bar, which is laid out inside the player and
would otherwise be clipped, making hover appear to do nothing.

Left to fit the width it is given, the player solves for a font size and lands on a fraction
of a pixel, which smears glyphs on low-DPI screens. So it is asked for exactly 16px instead,
and `.demo-window` is capped at the width 80 columns occupy at that size (774px, plus its 1px
borders). Below that width there is no room for the exact size, and the player falls back to
scaling to fit — see the create call in `demo.js`.

16px is also whole at 125% and 150% zoom (20px and 24px); because 125% multiplies by 1.25,
only multiples of 4 manage that, so the neighbouring sizes do not. Changing it means changing
three things in step: `terminalFontSize` and `TERMINAL_WIDTH` in `demo.js`, `max-width` on
`.demo-window` and `aspect-ratio` on `.demo` in `style.css`, and the dimensions near the top
of `tools/make-poster.sh` — then re-running that script.

`demo-card.png` is the Open Graph link preview, built from the same recording. Social cards
want roughly 1.91:1 and a terminal is 1.17:1, so it is composed — wordmark, tagline, and the
screen running off the bottom edge — rather than cropped, and its terminal is set larger
because a card is shown at about half size in a feed. Twitter reads the `og:*` tags, so
`index.html` only sets the card type separately.

To replace the demo, record at 80x30 and regenerate both images:

```sh
asciinema rec --cols 80 --rows 30 demo.cast
tools/make-poster.sh 75          # seconds into the recording to freeze
tools/make-poster.sh --card 75
```

`make-poster.sh` drives the real player headlessly, in the same font and geometry the page
uses, so swapping the poster for the player moves nothing. The frame it captures is chosen
to show hax mid-task; playback still starts at the beginning of the recording, so the
picture changes on click even though the layout does not. It needs chromium and python3.
If the new recording is not 80x30, update the sizes near the top of the script and the
`aspect-ratio` on `.demo` in `style.css` to match.
