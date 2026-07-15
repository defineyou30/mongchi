#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=10.0"]
# ///
# Run with: uv run scripts/store-screenshots/render_v4_pixel.py

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Final

from PIL import Image, ImageDraw, ImageFont

from store_screenshot_copy import LOCALIZED_LOCALES, LOCALE_COPY, LocaleCopy, SlideCopy


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "scripts/store-screenshots/raw"
V4_DIR = ROOT / "docs/design/app-store/outputs/v4-pixel"
BASE_DIR = V4_DIR / "backgrounds"
OUT_DIR = V4_DIR / "final"
FONT_DIR = ROOT / "apps/mobile/assets/fonts"

CANVAS_SIZE: Final = (1320, 2868)

WOOD_DARK = (75, 43, 28, 255)
WOOD = (143, 83, 39, 255)
HONEY = (237, 184, 86, 255)
CREAM = (255, 242, 202, 255)
INK = (50, 37, 31, 255)


@dataclass(frozen=True)
class ScreenPlacement:
    source: str
    box: tuple[int, int, int, int]
    corner: int = 22
    angle: float = 0.0


@dataclass(frozen=True)
class Slide:
    output: str
    background: str
    screens: tuple[ScreenPlacement, ...]
    light_copy: bool = False


SLIDES = (
    Slide(
        output="01-your-pet-living-in-your-phone.png",
        background="01-transformation-base.png",
        screens=(ScreenPlacement("2-2generate.png", (507, 676, 1269, 2332), corner=26),),
    ),
    Slide(
        output="02-care-in-little-moments.png",
        background="02-care-base.png",
        screens=(ScreenPlacement("1-home.png", (213, 675, 1107, 2618), corner=30),),
    ),
    Slide(
        output="03-meet-every-side.png",
        background="03-poses-share-base.png",
        screens=(ScreenPlacement("3share.png", (296, 688, 1035, 2295), corner=28),),
    ),
    Slide(
        output="04-tell-them-about-your-day.png",
        background="04-chat-base.png",
        screens=(ScreenPlacement("4-chat.png", (237, 620, 1083, 2459), corner=30),),
        light_copy=True,
    ),
    Slide(
        output="05-every-day-becomes-a-memory.png",
        background="06-memory-base.png",
        screens=(ScreenPlacement("6-memory.png", (255, 655, 1065, 2416), corner=28),),
    ),
    Slide(
        output="06-a-cozy-world-of-their-own.png",
        background="05-shop-base.png",
        screens=(
            ScreenPlacement("5-shop-2.png", (665, 770, 1175, 1878), corner=24),
            ScreenPlacement("5-shop-1.png", (122, 650, 802, 2128), corner=26),
        ),
    ),
)


def stepped_mask(size: tuple[int, int], corner: int) -> Image.Image:
    width, height = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    points = (
        (corner, 0),
        (width - corner, 0),
        (width - corner, corner // 2),
        (width - corner // 2, corner // 2),
        (width - corner // 2, corner),
        (width, corner),
        (width, height - corner),
        (width - corner // 2, height - corner),
        (width - corner // 2, height - corner // 2),
        (width - corner, height - corner // 2),
        (width - corner, height),
        (corner, height),
        (corner, height - corner // 2),
        (corner // 2, height - corner // 2),
        (corner // 2, height - corner),
        (0, height - corner),
        (0, corner),
        (corner // 2, corner),
        (corner // 2, corner // 2),
        (corner, corner // 2),
    )
    draw.polygon(points, fill=255)
    return mask


def fit_exact(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.LANCZOS)


def framed_capture(placement: ScreenPlacement, raw_dir: Path) -> Image.Image:
    x0, y0, x1, y1 = placement.box
    target_size = (x1 - x0, y1 - y0)
    capture = Image.open(raw_dir / placement.source).convert("RGBA")
    capture = fit_exact(capture, target_size)

    border = 18
    highlight = 7
    shadow = 14
    total_size = (
        target_size[0] + (border + highlight) * 2 + shadow,
        target_size[1] + (border + highlight) * 2 + shadow,
    )
    layer = Image.new("RGBA", total_size, (0, 0, 0, 0))

    draw = ImageDraw.Draw(layer)
    outer = stepped_mask(
        (total_size[0] - shadow, total_size[1] - shadow),
        placement.corner + border + highlight,
    )
    shadow_layer = Image.new("RGBA", total_size, (0, 0, 0, 0))
    shadow_layer.paste(INK, (shadow, shadow), outer)
    layer.alpha_composite(shadow_layer)

    outer_layer = Image.new("RGBA", total_size, (0, 0, 0, 0))
    outer_layer.paste(WOOD_DARK, (0, 0), outer)
    layer.alpha_composite(outer_layer)

    inset_size = (target_size[0] + (border + highlight) * 2, target_size[1] + (border + highlight) * 2)
    inset_mask = stepped_mask(inset_size, placement.corner + border)
    inset = Image.new("RGBA", total_size, (0, 0, 0, 0))
    inset.paste(HONEY, (0, 0), inset_mask)
    layer.alpha_composite(inset)

    cream_size = (target_size[0] + highlight * 2, target_size[1] + highlight * 2)
    cream_mask = stepped_mask(cream_size, placement.corner + highlight)
    cream_layer = Image.new("RGBA", total_size, (0, 0, 0, 0))
    cream_layer.paste(CREAM, (border, border), cream_mask)
    layer.alpha_composite(cream_layer)

    screen_mask = stepped_mask(target_size, placement.corner)
    screen_layer = Image.new("RGBA", total_size, (0, 0, 0, 0))
    screen_layer.paste(capture, (border + highlight, border + highlight), screen_mask)
    layer.alpha_composite(screen_layer)

    if placement.angle:
        layer = layer.rotate(
            placement.angle,
            resample=Image.Resampling.BICUBIC,
            expand=True,
            fillcolor=(0, 0, 0, 0),
        )
    return layer


def fitted_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_path: Path,
    *,
    start_size: int,
    minimum_size: int,
    max_width: int,
    stroke_width: int,
    multiline: bool,
) -> ImageFont.FreeTypeFont:
    for size in range(start_size, minimum_size - 1, -1):
        font = ImageFont.truetype(font_path, size)
        if multiline:
            box = draw.multiline_textbbox(
                (0, 0),
                text,
                font=font,
                spacing=8,
                align="center",
                stroke_width=stroke_width,
            )
        else:
            box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
        if box[2] - box[0] <= max_width:
            return font

    return ImageFont.truetype(font_path, minimum_size)


def draw_centered_copy(
    canvas: Image.Image,
    slide: Slide,
    slide_copy: SlideCopy,
    locale_copy: LocaleCopy,
) -> None:
    draw = ImageDraw.Draw(canvas)
    font_path = FONT_DIR / locale_copy.font_filename
    title_font = fitted_font(
        draw,
        slide_copy.title,
        font_path,
        start_size=91,
        minimum_size=66,
        max_width=1160,
        stroke_width=9,
        multiline=True,
    )
    subtitle_font = fitted_font(
        draw,
        slide_copy.subtitle,
        font_path,
        start_size=43,
        minimum_size=31,
        max_width=1160,
        stroke_width=4,
        multiline=False,
    )
    title_fill = CREAM if slide.light_copy else WOOD_DARK
    title_stroke = WOOD_DARK if slide.light_copy else CREAM
    subtitle_fill = CREAM if slide.light_copy else INK
    subtitle_stroke = WOOD_DARK if slide.light_copy else CREAM

    title_bbox = draw.multiline_textbbox(
        (0, 0),
        slide_copy.title,
        font=title_font,
        spacing=8,
        align="center",
        stroke_width=9,
    )
    title_width = title_bbox[2] - title_bbox[0]
    title_height = title_bbox[3] - title_bbox[1]
    title_position = ((CANVAS_SIZE[0] - title_width) // 2, 112 - title_bbox[1])
    draw.multiline_text(
        title_position,
        slide_copy.title,
        font=title_font,
        fill=title_fill,
        spacing=8,
        align="center",
        stroke_width=9,
        stroke_fill=title_stroke,
    )

    subtitle_bbox = draw.textbbox(
        (0, 0),
        slide_copy.subtitle,
        font=subtitle_font,
        stroke_width=4,
    )
    subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
    subtitle_y = 112 + title_height + 42 - subtitle_bbox[1]
    draw.text(
        ((CANVAS_SIZE[0] - subtitle_width) // 2, subtitle_y),
        slide_copy.subtitle,
        font=subtitle_font,
        fill=subtitle_fill,
        stroke_width=4,
        stroke_fill=subtitle_stroke,
    )


def render_slide(
    slide: Slide,
    raw_dir: Path,
    base_dir: Path,
    *,
    slide_copy: SlideCopy | None,
    locale_copy: LocaleCopy | None,
    source_replacements: dict[str, str] | None = None,
) -> Image.Image:
    base = Image.open(base_dir / slide.background).convert("RGBA")
    canvas = base.resize(CANVAS_SIZE, Image.Resampling.LANCZOS)

    if slide_copy is not None and locale_copy is not None:
        draw_centered_copy(canvas, slide, slide_copy, locale_copy)

    for placement in slide.screens:
        replacement = (source_replacements or {}).get(placement.source)
        effective_placement = (
            ScreenPlacement(
                source=replacement,
                box=placement.box,
                corner=placement.corner,
                angle=placement.angle,
            )
            if replacement is not None
            else placement
        )
        framed = framed_capture(effective_placement, raw_dir)
        x0, y0, _x1, _y1 = placement.box
        border_offset = 25
        if placement.angle:
            x0 -= max(0, (framed.width - (_x1 - x0)) // 2)
            y0 -= max(0, (framed.height - (_y1 - y0)) // 2)
        else:
            x0 -= border_offset
            y0 -= border_offset
        canvas.alpha_composite(framed, (x0, y0))

    return canvas.convert("RGB")


def make_contact_sheet(outputs: list[Path], output_path: Path) -> None:
    thumb_w = 330
    thumb_h = round(thumb_w * CANVAS_SIZE[1] / CANVAS_SIZE[0])
    gutter = 24
    rows = 2
    cols = 3
    sheet = Image.new(
        "RGB",
        (gutter + cols * (thumb_w + gutter), gutter + rows * (thumb_h + gutter)),
        (30, 26, 23),
    )
    for index, path in enumerate(outputs):
        thumb = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x = gutter + (index % cols) * (thumb_w + gutter)
        y = gutter + (index // cols) * (thumb_h + gutter)
        sheet.paste(thumb, (x, y))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, quality=95)


def render_set(
    raw_dir: Path,
    base_dir: Path,
    output_dir: Path,
    contact_sheet: Path,
    *,
    locale_copy: LocaleCopy | None,
    source_replacements: dict[str, str] | None = None,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for index, slide in enumerate(SLIDES):
        result = render_slide(
            slide,
            raw_dir,
            base_dir,
            slide_copy=locale_copy.slides[index] if locale_copy is not None else None,
            locale_copy=locale_copy,
            source_replacements=source_replacements,
        )
        path = output_dir / slide.output
        result.save(path, quality=95)
        outputs.append(path)
        print(path.relative_to(ROOT))
    make_contact_sheet(outputs, contact_sheet)
    print(contact_sheet.relative_to(ROOT))


def main() -> None:
    render_set(
        RAW_DIR,
        BASE_DIR,
        OUT_DIR,
        V4_DIR / "contact-sheet.png",
        locale_copy=None,
    )
    for locale in LOCALIZED_LOCALES:
        render_set(
            RAW_DIR / locale,
            BASE_DIR / "ko-KR",
            OUT_DIR / locale,
            V4_DIR / f"contact-sheets/{locale}.png",
            locale_copy=LOCALE_COPY[locale],
            source_replacements=(
                {"1-home.png": "2-2generate.png"} if locale == "ja-JP" else None
            ),
        )


if __name__ == "__main__":
    main()
