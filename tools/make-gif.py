#!/usr/bin/env python3
"""Render demo.cast's first turn as a GIF and a still for external listings.

    tools/make-gif.py            -> demo.gif and demo-still.png
    tools/make-gif.py --still    -> demo-still.png only

Requires agg, Pillow, and the Source Code Pro and DejaVu Sans fonts.
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

# Cut between the empty prompt at 33.7s and the next question at 35.5s.
CUT: Final = 34.9

# Last frame before the banner scrolls away; shared with make-poster.sh's card.
STILL_AT: Final = 32.2

# Source Code Pro lacks braille; pin the fallback so installed fonts cannot change the spinner.
FONT: Final = "Source Code Pro,DejaVu Sans"


def trim(src: Path, dst: Path, cut: float) -> float:
    """Copy the header and events through `cut` seconds; return the kept duration.

    Trim before agg applies speed and idle limits so `cut` uses recording time.
    """
    at = 0.0
    kept: list[str] = []
    with src.open() as f:
        header = f.readline().rstrip("\n")
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            # Asciicast v3 timestamps are intervals, not absolute times.
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
            agg("--text-font-family", FONT, "--font-size", 20, "--speed", 1.2,
                "--idle-time-limit", 1.5, "--last-frame-duration", 4,
                trimmed, ROOT / "demo.gif")
            print("make-gif: wrote demo.gif")

        # Disable idle trimming so --select uses recording time.
        still = tmp / "still.gif"
        agg("--text-font-family", FONT, "--font-size", 28, "--idle-time-limit", 1000,
            "--select", STILL_AT, trimmed, still)

        frame = Image.open(still).convert("RGB")
        quantized = frame.quantize(
            colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        quantized.save(ROOT / "demo-still.png", optimize=True)
        print(f"make-gif: wrote demo-still.png at t={STILL_AT}s")


if __name__ == "__main__":
    main()
