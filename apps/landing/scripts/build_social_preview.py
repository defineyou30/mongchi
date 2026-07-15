#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=10.0"]
# ///

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[3]
LANDING = ROOT / "apps/landing"
DEFAULT_OUTPUT = LANDING / "public/assets/social/mongchi-social-preview.png"
PIXEL_FONT = LANDING / "public/assets/fonts/PixelifySans_700Bold.ttf"
APP_ICON = LANDING / "public/assets/brand/app-icon.webp"

CANVAS_SIZE = (1200, 630)
CREAM = "#FFF5DE"
HONEY = "#F7B94C"
WOOD_DARK = "#5B3726"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the MongChi social preview image.")
    parser.add_argument("source", type=Path, help="Generated pixel-garden source image.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def draw_pixel_text(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    *,
    stroke_width: int,
) -> None:
    x, y = position
    draw.multiline_text(
        (x + 7, y + 8),
        text,
        font=font,
        fill=WOOD_DARK,
        spacing=0,
        stroke_width=stroke_width,
        stroke_fill=WOOD_DARK,
    )
    draw.multiline_text(
        (x, y),
        text,
        font=font,
        fill=CREAM,
        spacing=0,
        stroke_width=stroke_width,
        stroke_fill=WOOD_DARK,
    )


def main() -> None:
    args = parse_args()
    with Image.open(args.source) as source:
        canvas = ImageOps.fit(
            source.convert("RGB"),
            CANVAS_SIZE,
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )

    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(str(PIXEL_FONT), 102)
    tagline_font = ImageFont.truetype(str(PIXEL_FONT), 52)

    with Image.open(APP_ICON) as opened_icon:
        icon = opened_icon.convert("RGBA").resize((82, 82), Image.Resampling.LANCZOS)
    canvas.paste(icon, (72, 54), icon)

    draw_pixel_text(draw, (174, 48), "MongChi", title_font, stroke_width=5)
    draw_pixel_text(
        draw,
        (72, 188),
        "Your pet,\nliving in your phone.",
        tagline_font,
        stroke_width=4,
    )

    draw.rectangle((72, 382, 112, 394), fill=HONEY)
    draw.rectangle((120, 382, 336, 394), fill=CREAM)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, "PNG", optimize=True)
    print(args.output.relative_to(ROOT))


if __name__ == "__main__":
    main()
