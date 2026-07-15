#!/usr/bin/env python3
"""
Composes App Store screenshot pages for Mongchi (docs/store-screenshots-v2).

Renders full-bleed 1290x2796 (6.9" iPhone) PNG pages from:
  - real theme garden background art (apps/mobile/assets/generated/backgrounds/themes)
  - real UI screenshots captured from the booted iOS simulator
    (docs/store-screenshots-v2/raw/*.png)
  - a small set of standalone pet-pose sprites and one real pet photo
    (docs/store-screenshots-v2/materials/*)
  - the app's own Pixelify Sans font and warm cream/ink color tokens

Page content (background, headline, crop boxes, sprite placement) is kept as
data in PAGES / HEADLINES below so this script can be re-run after an art or
copy change, and so additional locales can be added by extending HEADLINES
without touching the render code. Only "en-US" is rendered today.

Usage:
    python3 scripts/store-screenshots/compose.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
MOBILE_ASSETS = ROOT / "apps/mobile/assets"
THEMES_DIR = MOBILE_ASSETS / "generated/backgrounds/themes"
HUD_DIR = MOBILE_ASSETS / "game-items/hud"

STORE_DIR = ROOT / "docs/store-screenshots-v2"
RAW_DIR = STORE_DIR / "raw"
MATERIALS_DIR = STORE_DIR / "materials"
OUTPUT_DIR = STORE_DIR

FONT_BOLD_PATH = (
    ROOT
    / "node_modules/.pnpm/@expo-google-fonts+pixelify-sans@0.4.2/node_modules"
    "/@expo-google-fonts/pixelify-sans/700Bold/PixelifySans_700Bold.ttf"
)
FONT_REGULAR_PATH = MOBILE_ASSETS / "fonts/PixelifySans-Regular.ttf"

# The pet photo used inside every polaroid prop (hero + transform). This is
# the ONLY place the "source photo" is chosen -- swap this single path to
# use a different real photo later without touching any layout code.
LEFT_PHOTO_PATH = MATERIALS_DIR / "original-photo.jpg"

SPRITE_IDLE = MATERIALS_DIR / "idle.png"
SPRITE_HAPPY = MATERIALS_DIR / "happy.png"
SPRITE_SLEEP = MATERIALS_DIR / "sleep.png"
SPRITE_CURIOUS = MATERIALS_DIR / "curious.png"
SPRITE_PLAY = MATERIALS_DIR / "play.png"
SPRITE_HUNGRY = MATERIALS_DIR / "hungry.png"

ALL_POSE_SPRITES = [
    ("Idle", SPRITE_IDLE),
    ("Happy", SPRITE_HAPPY),
    ("Sleepy", SPRITE_SLEEP),
    ("Curious", SPRITE_CURIOUS),
    ("Playful", SPRITE_PLAY),
    ("Hungry", SPRITE_HUNGRY),
]

# ---------------------------------------------------------------------------
# Canvas + palette (colors lifted from apps/mobile/src/shared/design/tokens.ts
# so the composed pages read as part of the same game, not a bolt-on ad).
# ---------------------------------------------------------------------------

CANVAS_W, CANVAS_H = 1290, 2796

COLOR_INK = (59, 46, 42)          # tokens.ink
COLOR_CREAM = (255, 245, 222)     # tokens.cream
COLOR_PARCHMENT = (255, 232, 199)  # tokens.parchment
COLOR_PARCHMENT_DEEP = (246, 209, 163)  # tokens.parchmentDeep
COLOR_LINE = (232, 207, 169)      # tokens.line
COLOR_HONEY = (246, 184, 79)      # tokens.honey
COLOR_WHITE = (255, 255, 255)

LOCALE = "en-US"

THEME_FILES = {
    "fairy-garden": THEMES_DIR / "theme-fairy-garden-v1-portrait.png",
    "seaside-cove": THEMES_DIR / "theme-seaside-cove-v1-portrait.png",
    "autumn-woods": THEMES_DIR / "theme-autumn-woods-v1-portrait.png",
    "winter-lights": THEMES_DIR / "theme-winter-lights-v1-portrait.png",
}

# ---------------------------------------------------------------------------
# Headline copy, keyed by locale so future locales are additive.
# ---------------------------------------------------------------------------

HEADLINES = {
    "en-US": {
        "hero": "Your Pet, Living\nin Your Phone",
        "transform": "One Photo Becomes\nYour Tiny Friend",
        "garden": "A Little Garden\nThat Waits for You",
        "poses": "Every Mood, Drawn\nfrom Your Photo",
        "chat": "Talk — They\nRemember",
        "walks": "Walks, Treasures,\nTiny Stories",
        "letter": "Thirty Days,\nOne Letter",
        "themes": "Dress the Garden\nfor the Season",
    }
}

# Real in-app copy (apps/mobile/src/localization/resources/en-US.ts) reused
# for the letter page mock, since the 30-day unlock state cannot be reached
# through the deterministic screenshot presets without seeding fake elapsed
# time -- see the run report for why this page is hand-built, not captured.
LETTER_COPY = {
    "title": "Mong's letter",
    "progress": "Day 30 of 30",
    "body": "A letter has arrived.\nOpen it whenever you're ready.",
    "cta": "Open",
}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def bold(size: int) -> ImageFont.FreeTypeFont:
    return font(FONT_BOLD_PATH, size)


def regular(size: int) -> ImageFont.FreeTypeFont:
    return font(FONT_REGULAR_PATH, size)


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def cover_fit_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale `img` so it fully covers target_w x target_h, then center-crop."""
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = math.ceil(src_w * scale), math.ceil(src_h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def load_theme_bg(theme_key: str) -> Image.Image:
    path = THEME_FILES[theme_key]
    img = Image.open(path).convert("RGB")
    return cover_fit_crop(img, CANVAS_W, CANVAS_H)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)], radius=radius, fill=255)
    return mask


def add_rounded_corners(img: Image.Image, radius: int) -> Image.Image:
    img = img.convert("RGBA")
    mask = rounded_mask(img.size, radius)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def paste_with_drop_shadow(
    base: Image.Image,
    layer: Image.Image,
    position: tuple[int, int],
    blur_radius: int = 28,
    shadow_opacity: int = 110,
    offset: tuple[int, int] = (0, 22),
) -> None:
    """Paste `layer` (RGBA, already corner-rounded if desired) onto `base`
    with a soft drop shadow shaped like its alpha silhouette."""
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    alpha = layer.split()[-1]
    shadow_shape = Image.new("RGBA", layer.size, (0, 0, 0, shadow_opacity))
    shadow_shape.putalpha(alpha.point(lambda a: min(a, shadow_opacity)))
    shadow.paste(shadow_shape, (position[0] + offset[0], position[1] + offset[1]), shadow_shape)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur_radius))
    base.alpha_composite(shadow)
    base.alpha_composite(layer, position)


def draw_outlined_text_block(
    canvas: Image.Image,
    text: str,
    fnt: ImageFont.FreeTypeFont,
    center_x: int,
    top_y: int,
    fill=COLOR_WHITE,
    outline=COLOR_INK,
    stroke_width: int = 10,
    line_spacing: int = 14,
) -> int:
    """Draws a centered, multi-line, thick-outlined pixel headline.
    Returns the y coordinate just below the drawn block."""
    draw = ImageDraw.Draw(canvas)
    lines = text.split("\n")
    y = top_y
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=fnt, stroke_width=stroke_width)
        line_w = bbox[2] - bbox[0]
        line_h = bbox[3] - bbox[1]
        x = center_x - line_w // 2 - bbox[0]
        draw.text(
            (x, y - bbox[1]),
            line,
            font=fnt,
            fill=fill,
            stroke_width=stroke_width,
            stroke_fill=outline,
        )
        y += line_h + line_spacing
    return y


def soft_ground_shadow(size: tuple[int, int]) -> Image.Image:
    """A soft dark ellipse used to ground a floating sprite cutout."""
    w, h = size
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse([(w * 0.12, h * 0.55), (w * 0.88, h * 0.95)], fill=(30, 40, 20, 90))
    return shadow.filter(ImageFilter.GaussianBlur(w * 0.03))


def make_polaroid(
    photo: Image.Image,
    frame_size: int,
    border: int = 26,
    bottom_border: int = 96,
    rotation: float = 0.0,
) -> Image.Image:
    """Builds a white polaroid-style frame around a square-cropped photo."""
    inner = frame_size - border * 2
    photo_sq = ImageOps.fit(photo.convert("RGB"), (inner, inner), Image.LANCZOS)

    total_h = frame_size + (bottom_border - border)
    card = Image.new("RGBA", (frame_size, total_h), (252, 250, 246, 255))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([(0, 0), (frame_size - 1, total_h - 1)], radius=18, fill=(252, 250, 246, 255))
    card.paste(photo_sq, (border, border))

    card = add_rounded_corners(card, 18)

    if rotation:
        card = card.rotate(rotation, expand=True, resample=Image.BICUBIC)
    return card


def paste_sprite(
    base: Image.Image,
    sprite_path: Path,
    center: tuple[int, int],
    height: int,
    shadow: bool = True,
    flip: bool = False,
) -> None:
    sprite = load_rgba(sprite_path)
    ratio = height / sprite.height
    new_size = (round(sprite.width * ratio), height)
    sprite = sprite.resize(new_size, Image.LANCZOS)
    if flip:
        sprite = ImageOps.mirror(sprite)

    x = center[0] - sprite.width // 2
    y = center[1] - sprite.height // 2

    if shadow:
        shadow_layer = soft_ground_shadow(sprite.size)
        base.alpha_composite(shadow_layer, (x, y))

    base.alpha_composite(sprite, (x, y))


def crop_raw(name: str, box: tuple[int, int, int, int]) -> Image.Image:
    path = RAW_DIR / name
    img = Image.open(path).convert("RGB")
    return img.crop(box)


def draw_pixel_star(draw: ImageDraw.ImageDraw, center: tuple[int, int], size: int, color) -> None:
    cx, cy = center
    r_outer = size
    r_inner = size * 0.38
    points = []
    for i in range(8):
        angle = math.pi / 4 * i - math.pi / 2
        r = r_outer if i % 2 == 0 else r_inner
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=color)


def draw_arrow(canvas: Image.Image, start: tuple[int, int], end: tuple[int, int], width: int, color) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line([start, end], fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    head_len = width * 3.2
    head_w = width * 2.4
    left = (
        end[0] - head_len * math.cos(angle - math.pi / 7),
        end[1] - head_len * math.sin(angle - math.pi / 7),
    )
    right = (
        end[0] - head_len * math.cos(angle + math.pi / 7),
        end[1] - head_len * math.sin(angle + math.pi / 7),
    )
    draw.polygon([end, left, right], fill=color)


# ---------------------------------------------------------------------------
# Wordmark (top-of-hero "Mongchi" typography + tiny app icon)
# ---------------------------------------------------------------------------


def draw_wordmark(canvas: Image.Image, center_x: int, top_y: int) -> int:
    icon = load_rgba(MOBILE_ASSETS / "icon.png").resize((92, 92), Image.LANCZOS)
    icon = add_rounded_corners(icon, 22)

    fnt = bold(96)
    draw = ImageDraw.Draw(canvas)
    text = "Mongchi"
    bbox = draw.textbbox((0, 0), text, font=fnt, stroke_width=9)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    gap = 22
    total_w = icon.width + gap + text_w
    icon_x = center_x - total_w // 2
    icon_y = top_y + (text_h - icon.height) // 2 - bbox[1]
    canvas.alpha_composite(icon, (icon_x, icon_y))

    text_x = icon_x + icon.width + gap
    draw.text(
        (text_x - bbox[0], top_y - bbox[1]),
        text,
        font=fnt,
        fill=COLOR_WHITE,
        stroke_width=9,
        stroke_fill=COLOR_INK,
    )
    return top_y + text_h + 24


# ---------------------------------------------------------------------------
# Page builders
# ---------------------------------------------------------------------------


def new_canvas(theme_key: str) -> Image.Image:
    bg = load_theme_bg(theme_key).convert("RGBA")
    return bg


def build_hero() -> Image.Image:
    canvas = new_canvas("fairy-garden")

    y = draw_wordmark(canvas, CANVAS_W // 2, 96)
    y = draw_outlined_text_block(
        canvas, HEADLINES[LOCALE]["hero"], bold(96), CANVAS_W // 2, y + 18, stroke_width=11
    )

    # Flanking smaller poses first so the big idle sprite overlaps on top.
    paste_sprite(canvas, SPRITE_HAPPY, (CANVAS_W // 2 - 380, 1660), height=430)
    paste_sprite(canvas, SPRITE_SLEEP, (CANVAS_W // 2 + 400, 1700), height=390)
    paste_sprite(canvas, SPRITE_IDLE, (CANVAS_W // 2, 1620), height=760)

    # Polaroid prop: the real source photo, tucked in the bottom corner --
    # "one photo becomes this tiny friend" told visually on the hero itself.
    polaroid = make_polaroid(Image.open(LEFT_PHOTO_PATH), frame_size=430, rotation=-7)
    px = 92
    py = CANVAS_H - polaroid.height - 150
    paste_with_drop_shadow(canvas, polaroid, (px, py), blur_radius=24, shadow_opacity=120)

    return canvas.convert("RGB")


def build_transform() -> Image.Image:
    canvas = new_canvas("seaside-cove")

    draw_outlined_text_block(
        canvas, HEADLINES[LOCALE]["transform"], bold(92), CANVAS_W // 2, 150, stroke_width=11
    )

    # Left: the real source photo in a polaroid frame.
    polaroid = make_polaroid(Image.open(LEFT_PHOTO_PATH), frame_size=520, rotation=-4)
    left_x = 70
    left_y = 1160
    paste_with_drop_shadow(canvas, polaroid, (left_x, left_y), blur_radius=26, shadow_opacity=120)

    # Middle: arrow + sparkles.
    arrow_y = left_y + polaroid.height // 2 - 10
    arrow_start_x = left_x + polaroid.width + 40
    arrow_end_x = CANVAS_W - 470
    draw_arrow(canvas, (arrow_start_x, arrow_y), (arrow_end_x, arrow_y), width=20, color=COLOR_INK)
    draw_pixel_star(ImageDraw.Draw(canvas), (arrow_start_x + 90, arrow_y - 120), 34, COLOR_HONEY)
    draw_pixel_star(ImageDraw.Draw(canvas), (arrow_start_x + 190, arrow_y + 110), 22, (255, 157, 196))
    draw_pixel_star(ImageDraw.Draw(canvas), (arrow_end_x - 90, arrow_y - 90), 26, COLOR_WHITE)

    # Right: 3 pose thumbnails stacked, showing the variety the one photo becomes.
    right_x = CANVAS_W - 430
    poses = [("Happy", SPRITE_HAPPY), ("Curious", SPRITE_CURIOUS), ("Playful", SPRITE_PLAY)]
    card_size = 400
    gap = 34
    start_y = 1060
    for i, (label, sprite_path) in enumerate(poses):
        cy = start_y + i * (card_size // 2 + gap + 30)
        card = Image.new("RGBA", (card_size, card_size), COLOR_CREAM + (255,))
        card = add_rounded_corners(card, 40)
        card_draw = ImageDraw.Draw(card)
        card_draw.rounded_rectangle(
            [(4, 4), (card_size - 5, card_size - 5)], radius=36, outline=COLOR_LINE + (255,), width=6
        )
        paste_sprite(card, sprite_path, (card_size // 2, card_size // 2 + 6), height=int(card_size * 0.72), shadow=False)
        paste_with_drop_shadow(canvas, card, (right_x, cy), blur_radius=18, shadow_opacity=90, offset=(0, 12))

    return canvas.convert("RGB")


def build_ui_card_page(
    theme_key: str,
    headline_key: str,
    raw_name: str,
    crop_box: tuple[int, int, int, int],
    card_width: int = 1010,
    card_top: Optional[int] = None,
    corner_radius: int = 56,
) -> Image.Image:
    canvas = new_canvas(theme_key)
    headline_bottom = draw_outlined_text_block(
        canvas, HEADLINES[LOCALE][headline_key], bold(86), CANVAS_W // 2, 130, stroke_width=10
    )

    cropped = crop_raw(raw_name, crop_box)
    scale = card_width / cropped.width
    card_height = round(cropped.height * scale)
    cropped = cropped.resize((card_width, card_height), Image.LANCZOS)
    card = add_rounded_corners(cropped.convert("RGBA"), corner_radius)

    x = (CANVAS_W - card_width) // 2
    if card_top is None:
        remaining = CANVAS_H - headline_bottom - 110
        y = headline_bottom + max(30, (remaining - card_height) // 2)
    else:
        y = card_top

    paste_with_drop_shadow(canvas, card, (x, y), blur_radius=30, shadow_opacity=120, offset=(0, 26))
    return canvas.convert("RGB")


def build_poses() -> Image.Image:
    canvas = build_ui_card_page(
        "winter-lights",
        "poses",
        "ios-iphone-16-pro-raw-friend.png",
        crop_box=(0, 150, 1206, 1330),
        card_width=980,
        card_top=460,
    ).convert("RGBA")

    # Mood strip: small circular thumbnails of every pose sprite, right under
    # the live "Pose 1 of 5" UI card -- makes the "every mood" claim concrete.
    thumb = 150
    gap = 26
    total_w = len(ALL_POSE_SPRITES) * thumb + (len(ALL_POSE_SPRITES) - 1) * gap
    start_x = (CANVAS_W - total_w) // 2
    y = 2300
    for i, (_, sprite_path) in enumerate(ALL_POSE_SPRITES):
        cx = start_x + i * (thumb + gap) + thumb // 2
        chip = Image.new("RGBA", (thumb, thumb), COLOR_CREAM + (235,))
        mask = Image.new("L", (thumb, thumb), 0)
        ImageDraw.Draw(mask).ellipse([(0, 0), (thumb - 1, thumb - 1)], fill=255)
        chip.putalpha(mask)
        paste_sprite(chip, sprite_path, (thumb // 2, thumb // 2 + 6), height=int(thumb * 0.86), shadow=False)
        paste_with_drop_shadow(canvas, chip, (cx - thumb // 2, y), blur_radius=14, shadow_opacity=80, offset=(0, 8))

    return canvas.convert("RGB")


def build_letter() -> Image.Image:
    canvas = new_canvas("autumn-woods")
    draw_outlined_text_block(
        canvas, HEADLINES[LOCALE]["letter"], bold(92), CANVAS_W // 2, 150, stroke_width=11
    )

    card_w, card_h = 980, 1080
    card = Image.new("RGBA", (card_w, card_h), COLOR_CREAM + (255,))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([(0, 0), (card_w - 1, card_h - 1)], radius=56, fill=COLOR_CREAM + (255,))
    draw.rounded_rectangle([(10, 10), (card_w - 11, card_h - 11)], radius=48, outline=COLOR_LINE + (255,), width=6)
    card = add_rounded_corners(card, 56)
    draw = ImageDraw.Draw(card)

    gift = load_rgba(HUD_DIR / "gift-box.png").resize((260, 260), Image.NEAREST)
    card.alpha_composite(gift, ((card_w - gift.width) // 2, 90))

    title_font = bold(68)
    bbox = draw.textbbox((0, 0), LETTER_COPY["title"], font=title_font)
    draw.text(((card_w - (bbox[2] - bbox[0])) // 2 - bbox[0], 380 - bbox[1]), LETTER_COPY["title"], font=title_font, fill=COLOR_INK)

    pill_font = regular(38)
    pill_text = LETTER_COPY["progress"]
    pbbox = draw.textbbox((0, 0), pill_text, font=pill_font)
    pill_w = (pbbox[2] - pbbox[0]) + 70
    pill_h = 66
    pill_x = (card_w - pill_w) // 2
    pill_y = 480
    draw.rounded_rectangle([(pill_x, pill_y), (pill_x + pill_w, pill_y + pill_h)], radius=pill_h // 2, fill=COLOR_PARCHMENT_DEEP + (255,))
    draw.text((pill_x + 35 - pbbox[0], pill_y + (pill_h - (pbbox[3] - pbbox[1])) // 2 - pbbox[1]), pill_text, font=pill_font, fill=COLOR_INK)

    body_font = regular(42)
    y = 610
    for line in LETTER_COPY["body"].split("\n"):
        bbox = draw.textbbox((0, 0), line, font=body_font)
        line_w = bbox[2] - bbox[0]
        draw.text(((card_w - line_w) // 2 - bbox[0], y - bbox[1]), line, font=body_font, fill=(90, 74, 62))
        y += (bbox[3] - bbox[1]) + 18

    btn_w, btn_h = 360, 118
    btn_x = (card_w - btn_w) // 2
    btn_y = card_h - btn_h - 110
    draw.rounded_rectangle([(btn_x, btn_y), (btn_x + btn_w, btn_y + btn_h)], radius=btn_h // 2, fill=COLOR_HONEY + (255,))
    cta_font = bold(48)
    cbbox = draw.textbbox((0, 0), LETTER_COPY["cta"], font=cta_font)
    draw.text(
        (btn_x + (btn_w - (cbbox[2] - cbbox[0])) // 2 - cbbox[0], btn_y + (btn_h - (cbbox[3] - cbbox[1])) // 2 - cbbox[1]),
        LETTER_COPY["cta"],
        font=cta_font,
        fill=COLOR_WHITE,
        stroke_width=4,
        stroke_fill=(200, 120, 30),
    )

    x = (CANVAS_W - card_w) // 2
    y = 860
    canvas = canvas.convert("RGBA")
    paste_with_drop_shadow(canvas, card, (x, y), blur_radius=32, shadow_opacity=120, offset=(0, 28))
    return canvas.convert("RGB")


# ---------------------------------------------------------------------------
# Page registry
# ---------------------------------------------------------------------------


@dataclass
class Page:
    output_name: str
    build: Callable[[], Image.Image]


PAGES: list[Page] = [
    Page("01-hero.png", build_hero),
    Page("02-transform.png", build_transform),
    Page(
        "03-garden.png",
        lambda: build_ui_card_page(
            "fairy-garden",
            "garden",
            "ios-iphone-16-pro-raw-terrarium.png",
            crop_box=(0, 140, 1206, 2560),
            card_width=1010,
        ),
    ),
    Page("04-poses.png", build_poses),
    Page(
        "05-chat.png",
        lambda: build_ui_card_page(
            "fairy-garden",
            "chat",
            "ios-iphone-16-pro-raw-chat.png",
            crop_box=(0, 140, 1206, 1760),
            card_width=1010,
        ),
    ),
    Page(
        "06-walks.png",
        lambda: build_ui_card_page(
            "autumn-woods",
            "walks",
            "ios-iphone-16-pro-raw-walk.png",
            crop_box=(0, 260, 1206, 2560),
            card_width=1010,
        ),
    ),
    Page("07-letter.png", build_letter),
    Page(
        "08-themes.png",
        lambda: build_ui_card_page(
            "winter-lights",
            "themes",
            "ios-iphone-16-pro-raw-shop-themes.png",
            crop_box=(0, 140, 1206, 1770),
            card_width=1010,
        ),
    ),
]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for page in PAGES:
        img = page.build()
        assert img.size == (CANVAS_W, CANVAS_H), f"{page.output_name} wrong size: {img.size}"
        out_path = OUTPUT_DIR / page.output_name
        img.save(out_path, "PNG")
        print(f"wrote {out_path} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
