#!/usr/bin/env python3
"""
Renders Mongchi App Store screenshot set v3 from the user-approved v2 art
(docs/design/app-store/outputs/v2/), replacing only the content that is stale
because it predates the current golden-retriever "Mong" pet and the recent
chat redesign:

  01-hero-rich          -- reused as-is, except the small cream pill reading
                            "A cozy companion made from one photo" is
                            inpainted away (the parchment headline, the
                            "Your Pet, Living in Your Phone" title, and the
                            hero dog illustration all stay untouched).
  02-home-care-mockup    -- the phone screen is replaced with a fresh capture
  04-talk-about-your-day    of the current app (home/care dock, pet reveal,
  05-every-day-memory       redesigned chat, friend/memories, friend/poses).
  06-meet-every-side         The dynamic island is redrawn on top of every
                            pasted capture so it always looks clean regardless
                            of where the real status bar landed after crop.
  03-one-photo-tiny-self -- phone screen replaced (pet-reveal capture), and
                            the two blank polaroid props at the bottom right
                            get the real source photo.
  06-meet-every-side     -- additionally, the three pose cards (Curious /
                            Playful / Hungry), which still showed the old
                            white Pomeranian, get the current Mong pose art.

All measurements below were taken directly from the v2 PNGs (color-threshold
edge detection cross-checked with pixel-grid crops -- see the run report for
the methodology) since the v2 art is hand/AI-illustrated and not laid out on
a grid.

Pipeline note: a HTML+Playwright path (matching the reference
ticketshelf/screenshots/render.py structure) was evaluated first -- Playwright
1.58 and Chromium are both installed and launch cleanly in this environment.
It was not used because every edit this round is pixel-level raster
compositing (crop/cover-fit, rounded-rect clipping, mask-based photo/sprite
replacement, flat-color inpainting) with no text to render: v2's baked-in
headline copy is left untouched, since the copy for en-US is unchanged from
v2. Pillow does this compositing natively (this repo's own
scripts/store-screenshots/compose.py already establishes that precedent for
the sibling docs/store-screenshots-v2 set). The LOCALE constant and the
per-slide config table below are the extension point a future localized
round would use to add an HTML/Playwright text-rendering pass for translated
headlines; nothing here forecloses that.

Usage:
    python3 scripts/store-screenshots/render_v3.py
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent

V2_DIR = ROOT / "docs/design/app-store/outputs/v2"
OUT_DIR = ROOT / "docs/design/app-store/outputs/v3"
RAW_DIR = SCRIPT_DIR / "raw"
MATERIALS_DIR = ROOT / "docs/store-screenshots-v2/materials"

LOCALE = "en-US"  # extension point: future locales get their own OUT_DIR / row

CANVAS_W, CANVAS_H = 1320, 2868

# Raw simulator captures are native iPhone 16 Pro screenshots (1206x2622),
# taken fresh from the booted simulator against the current build.
RAW_W, RAW_H = 1206, 2622

# The dynamic island is OS/device chrome, so it lands at the same pixel
# rectangle in every raw capture regardless of which app screen is showing.
RAW_ISLAND_BBOX = (415, 42, 790, 155)  # x0, y0, x1, y1


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)], radius=radius, fill=255)
    return mask


def cover_fit_top_aligned(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale `img` to cover target_w x target_h, then crop -- horizontally
    centered, but vertically anchored to the TOP (never the bottom), since
    the top edge is the phone's status bar / dynamic island and must stay
    intact. This mirrors the v2 phone mockup's own top-anchored screen."""
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = round(src_w * scale), round(src_h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = 0
    return resized.crop((left, top, left + target_w, top + target_h)), scale, left, top


def cover_fit_center(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale `img` to cover target_w x target_h, center-cropped on both axes.
    Used for fitting a plain photo (not a phone screenshot) into a frame, so
    the subject stays centered rather than being anchored to one edge."""
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = round(src_w * scale), round(src_h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def paste_rounded(base: Image.Image, layer: Image.Image, position: tuple[int, int], radius: int) -> None:
    layer = layer.convert("RGBA")
    mask = rounded_mask(layer.size, radius)
    base.paste(layer, position, mask)


def sample_color(img: Image.Image, point: tuple[int, int]) -> tuple[int, int, int]:
    return img.convert("RGB").getpixel(point)


def noisy_fill(size: tuple[int, int], base_color: tuple[int, int, int], sigma: float = 4.0) -> Image.Image:
    rng = np.random.default_rng(7)
    arr = np.array(base_color, dtype=np.float32) + rng.normal(0, sigma, size=(size[1], size[0], 3))
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


# ---------------------------------------------------------------------------
# Slide 01: reuse as-is, inpaint away the small subline pill only.
# ---------------------------------------------------------------------------


def build_slide_01() -> Image.Image:
    base = Image.open(V2_DIR / "01-hero-rich.png").convert("RGB")

    # Pill bbox measured from the v2 art (color threshold on the pill's own
    # cream fill (255,248,231), cross-checked with a labeled pixel grid).
    px0, py0, px1, py1 = 183, 2508, 1137, 2642
    fill_sample = sample_color(base, (660, 2498))  # clean parchment just above the pill
    patch = noisy_fill((px1 - px0, py1 - py0), fill_sample, sigma=4.0)
    mask = rounded_mask(patch.size, radius=(py1 - py0) // 2)
    base.paste(patch, (px0, py0), mask)
    return base


# ---------------------------------------------------------------------------
# Slide 03 prep: fill the two blank polaroid props with the real source photo.
# ---------------------------------------------------------------------------


def build_slide_03_background() -> Image.Image:
    base = Image.open(V2_DIR / "03-one-photo-tiny-self.png").convert("RGB")
    arr = np.array(base).astype(int)

    target = np.array([120, 97, 88])  # the polaroids' dark "unexposed" fill
    dist = np.abs(arr - target).sum(axis=2)
    raw_mask = dist < 45

    region = np.zeros(raw_mask.shape, dtype=bool)
    region[2340:2690, 600:1270] = raw_mask[2340:2690, 600:1270]

    mask_img = Image.fromarray((region * 255).astype(np.uint8))
    mask_img = mask_img.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.MinFilter(25))
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(2))

    mask_arr = np.array(mask_img) > 100
    ys, xs = np.where(mask_arr)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()

    # Zoom in ~1.5x beyond the mask's own bounding box: the source photo has
    # a fair amount of white margin around the dog, and the two overlapping
    # polaroid windows are an irregular rotated diamond, not a clean rect, so
    # a plain edge-to-edge cover-fit left slivers of that white margin (and
    # of the old dark fill just outside the diamond) visible at the corners.
    # Cropping in tighter keeps the frame full of dog, not photo background.
    zoom = 1.2
    box_w, box_h = bx1 - bx0, by1 - by0
    photo = Image.open(MATERIALS_DIR / "original-photo.jpg").convert("RGB")
    photo_fit = cover_fit_center(photo, round(box_w * zoom), round(box_h * zoom))

    layer = Image.new("RGB", base.size, (0, 0, 0))
    paste_x = bx0 - round((photo_fit.width - box_w) / 2)
    paste_y = by0 - round((photo_fit.height - box_h) / 2)
    layer.paste(photo_fit, (paste_x, paste_y))

    base = Image.composite(layer, base, mask_img)
    return base


# ---------------------------------------------------------------------------
# Slide 06 prep: swap the Curious/Playful/Hungry pose cards to current Mong art.
# ---------------------------------------------------------------------------


@dataclass
class PoseCard:
    sprite: str
    center_x: int
    erase_box: tuple[int, int, int, int]  # x0, y0, x1, y1
    sprite_height: int
    bottom_y: int


POSE_CARDS = [
    PoseCard("curious.png", 276, (135, 2225, 410, 2545), 300, 2495),
    PoseCard("play.png", 655, (500, 2210, 800, 2548), 300, 2500),
    PoseCard("hungry.png", 1032, (885, 2225, 1180, 2545), 300, 2495),
]

# Sampled from the v2 card interior itself (bottom band, clear of the gold
# trim border and the sparkle decoration that overlap the card's top edge).
CARD_CREAM = (253, 240, 207)


def build_slide_06_background() -> Image.Image:
    base = Image.open(V2_DIR / "06-meet-every-side.png").convert("RGBA")
    draw = ImageDraw.Draw(base)

    for card in POSE_CARDS:
        draw.rectangle(card.erase_box, fill=CARD_CREAM + (255,))

        sprite = Image.open(MATERIALS_DIR / card.sprite).convert("RGBA")
        scale = card.sprite_height / sprite.height
        new_size = (round(sprite.width * scale), card.sprite_height)
        sprite = sprite.resize(new_size, Image.LANCZOS)

        x = card.center_x - sprite.width // 2
        y = card.bottom_y - sprite.height
        base.alpha_composite(sprite, (x, y))

    return base.convert("RGB")


# ---------------------------------------------------------------------------
# Slides 02-06: phone-screen compositing (shared logic).
# ---------------------------------------------------------------------------


@dataclass
class ScreenSlide:
    output_name: str
    background: "callable"  # () -> Image.Image (RGB)
    raw_capture: str
    screen_rect: tuple[int, int, int, int]  # x0, y0, x1, y1 in v2 canvas space
    corner_radius: int


SCREEN_SLIDES = [
    ScreenSlide(
        output_name="02-home-care-mockup.png",
        background=lambda: Image.open(V2_DIR / "02-home-care-mockup.png").convert("RGB"),
        raw_capture="ios-iphone16pro-terrarium.png",
        screen_rect=(205, 389, 1114, 2504),
        corner_radius=115,
    ),
    ScreenSlide(
        output_name="03-one-photo-tiny-self.png",
        background=build_slide_03_background,
        raw_capture="ios-iphone16pro-pet-reveal.png",
        screen_rect=(160, 389, 1159, 2300),
        corner_radius=125,
    ),
    ScreenSlide(
        output_name="04-talk-about-your-day.png",
        background=lambda: Image.open(V2_DIR / "04-talk-about-your-day.png").convert("RGB"),
        raw_capture="ios-iphone16pro-chat.png",
        screen_rect=(205, 389, 1114, 2504),
        corner_radius=115,
    ),
    ScreenSlide(
        output_name="05-every-day-memory.png",
        background=lambda: Image.open(V2_DIR / "05-every-day-memory.png").convert("RGB"),
        raw_capture="ios-iphone16pro-friend-memories.png",
        screen_rect=(205, 389, 1114, 2504),
        corner_radius=115,
    ),
    ScreenSlide(
        output_name="06-meet-every-side.png",
        background=build_slide_06_background,
        raw_capture="ios-iphone16pro-friend-top.png",
        screen_rect=(235, 389, 1084, 1782),
        corner_radius=105,
    ),
]


def build_screen_slide(slide: ScreenSlide) -> Image.Image:
    canvas = slide.background().convert("RGB")
    x0, y0, x1, y1 = slide.screen_rect
    target_w, target_h = x1 - x0, y1 - y0

    raw = Image.open(RAW_DIR / slide.raw_capture).convert("RGB")
    cropped, scale, crop_left, _crop_top = cover_fit_top_aligned(raw, target_w, target_h)

    paste_rounded(canvas, cropped, (x0, y0), slide.corner_radius)

    # The dynamic island is device chrome, so after the top-anchored cover-fit
    # crop above it always lands at the same transformed spot inside the
    # pasted area -- right where the real app's own safe-area padding already
    # expects it, with proper clearance above whatever UI comes next. Redraw
    # it there (not at the old v2 template's hand-illustrated position, which
    # assumed different, shorter content and would collide with real UI) so
    # it reads crisp after the resize instead of slightly blurred.
    rix0, riy0, rix1, riy1 = RAW_ISLAND_BBOX
    erase_x0 = round(rix0 * scale) - crop_left + x0
    erase_x1 = round(rix1 * scale) - crop_left + x0
    erase_y0 = round(riy0 * scale) + y0
    erase_y1 = round(riy1 * scale) + y0
    erase_pad = 8

    # Fill with a stretched strip sampled from just beside the island (from
    # the already-pasted capture, not a single flat color) so a real sky/
    # background gradient carries across the patch instead of leaving a
    # visible flat-color seam.
    strip_w = 14
    strip_gap = 4
    strip_x = erase_x0 - erase_pad - strip_gap - strip_w
    strip = canvas.crop((strip_x, erase_y0 - erase_pad, strip_x + strip_w, erase_y1 + erase_pad))
    patch_w = (erase_x1 + erase_pad) - (erase_x0 - erase_pad)
    patch_h = (erase_y1 + erase_pad) - (erase_y0 - erase_pad)
    patch = strip.resize((patch_w, patch_h), Image.LANCZOS)
    canvas.paste(patch, (erase_x0 - erase_pad, erase_y0 - erase_pad))

    draw = ImageDraw.Draw(canvas)
    redraw_pad = 2
    draw.rounded_rectangle(
        (erase_x0 - redraw_pad, erase_y0 - redraw_pad, erase_x1 + redraw_pad, erase_y1 + redraw_pad),
        radius=(erase_y1 - erase_y0) // 2 + redraw_pad,
        fill=(0, 0, 0),
    )

    return canvas


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    out_dir = OUT_DIR / LOCALE
    out_dir.mkdir(parents=True, exist_ok=True)

    outputs = []

    img01 = build_slide_01()
    path01 = out_dir / "01-hero-rich.png"
    img01.save(path01, "PNG")
    outputs.append((path01, img01.size))

    for slide in SCREEN_SLIDES:
        img = build_screen_slide(slide)
        path = out_dir / slide.output_name
        img.save(path, "PNG")
        outputs.append((path, img.size))

    for path, size in outputs:
        assert size == (CANVAS_W, CANVAS_H), f"{path.name} wrong size: {size}"
        assert Image.open(path).mode in ("RGB",), f"{path.name} not opaque RGB"
        print(f"wrote {path} ({size[0]}x{size[1]})")


if __name__ == "__main__":
    main()
