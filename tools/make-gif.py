#!/usr/bin/env python3
"""Render the standalone assets out of demo.cast: an animation and a single still.

    tools/make-gif.py            -> demo.gif and demo-still.png
    tools/make-gif.py --still    -> demo-still.png only

These are what external listings ask for, since they take a URL rather than embedding the
player. The recording holds two turns - a question answered in 34s, then a four-and-a-half
minute implementation session - and only the first is used: the whole arc, at a length
someone will actually watch.

The still holds a different frame from demo-poster.png on purpose. The poster is mid-session
because the page plays from the start and the picture should change on click; a listing has
nothing to click, so it wants the banner in shot.

Needs agg on PATH, Pillow for the still, and Source Code Pro installed for the typeface.
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Final

try:
    from PIL import Image
except ImportError:
    sys.exit("make-gif: Pillow needed to write the still")

ROOT: Final = Path(__file__).resolve().parent.parent

# End of the first turn. The prompt comes back empty at 33.7s and the next question starts
# at 35.5s, so anything in between cuts clean.
CUT: Final = 34.9

# Held frame for the still: the last moment holding both the banner and a full screen of
# output, a tenth of a second before the top line scrolls away. tools/make-poster.sh renders
# the link preview card at the same moment, for the same reason.
STILL_AT: Final = 32.2

# The page's typeface, so these agree with the poster and the card. Source Code Pro has no
# braille, so the spinner falls through to the second family; both are named because left to
# itself agg picks from seven defaults and whatever else is installed, which is enough to
# change the rendered spinner when an unrelated font package lands on the machine.
FONT: Final = "Source Code Pro,DejaVu Sans"


def trim(src: Path, dst: Path, cut: float) -> float:
    """Copy the events up to `cut` seconds, keeping the header. Returns the kept duration.

    agg's --select runs on the timeline *after* --speed and --idle-time-limit, so the second
    of the recording a number refers to moves once those are set. Trimming to a prefix first
    keeps the cut expressed in the recording's own seconds; a prefix also needs no replay,
    since the screen at the cut is whatever the kept events already drew.
    """
    at = 0.0
    kept: list[str] = []
    with src.open() as f:
        header = f.readline().rstrip("\n")
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            # v3 stores intervals between events, not absolute times, so the clock is a
            # running sum rather than a field to read.
            interval: float = json.loads(line)[0]
            if at + interval > cut:
                break
            at += interval
            kept.append(line)
    dst.write_text(header + "\n" + "\n".join(kept) + "\n")
    print(f"make-gif: kept {len(kept)} events, {at:.1f}s")
    return at


def agg(*args: str | float | Path) -> None:
    subprocess.run(["agg", "--quiet", *(str(a) for a in args)], check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render demo.gif and demo-still.png.")
    parser.add_argument("--still", action="store_true", help="write the still only")
    args = parser.parse_args()

    if shutil.which("agg") is None:
        sys.exit("make-gif: no agg on PATH (yay -S asciinema-agg-bin)")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        trimmed = tmp / "turn1.cast"
        trim(ROOT / "demo.cast", trimmed, CUT)

        if not args.still:
            # 1.2x keeps the typing from dragging without looking hurried. The idle cap is
            # well under agg's default of 5s because the longest pause here is only ~3s.
            agg("--text-font-family", FONT, "--font-size", 20, "--speed", 1.2,
                "--idle-time-limit", 1.5, "--last-frame-duration", 4,
                trimmed, ROOT / "demo.gif")
            print("make-gif: wrote demo.gif")

        # One frame, so speed is irrelevant and the idle cap is raised past any gap in the
        # recording purely so --select lands on the second it names.
        still = tmp / "still.gif"
        agg("--text-font-family", FONT, "--font-size", 28, "--idle-time-limit", 1000,
            "--select", STILL_AT, trimmed, still)

        # agg only writes GIF, so the still arrives as a single-frame one, capped at the 256
        # colours the poster is quantized to anyway. The enums are spelled out because Pillow
        # builds its module-level aliases with setattr, which no type checker can see.
        frame = Image.open(still).convert("RGB")
        quantized = frame.quantize(
            colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        quantized.save(ROOT / "demo-still.png", optimize=True)
        print(f"make-gif: wrote demo-still.png at t={STILL_AT}s")


if __name__ == "__main__":
    main()
