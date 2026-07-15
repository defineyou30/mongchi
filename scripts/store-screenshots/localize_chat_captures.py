#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=10.0"]
# ///
# Run with: uv run scripts/store-screenshots/localize_chat_captures.py

from __future__ import annotations

from pathlib import Path
from statistics import median
from typing import Final

from PIL import Image, ImageDraw, ImageFont

from store_screenshot_copy import LOCALIZED_LOCALES, LOCALE_COPY


ROOT: Final = Path(__file__).resolve().parents[2]
RAW_DIR: Final = ROOT / "scripts/store-screenshots/raw"
FONT_DIR: Final = ROOT / "apps/mobile/assets/fonts"
INK: Final = (63, 45, 42)
CAPTURE_SIZE: Final = (1206, 2622)
CJK_LOCALES: Final = frozenset(("ko-KR", "ja-JP", "zh-TW"))


def erase_text(image: Image.Image, box: tuple[int, int, int, int]) -> None:
    """Restore a bubble region using the median surface color from each row."""

    pixels = image.load()
    x0, y0, x1, y1 = box
    row_colors: list[tuple[int, int, int]] = []
    for y in range(y0, y1):
        candidates = [
            pixels[x, y][:3]
            for x in range(x0, x1)
            if sum(pixels[x, y][:3]) > 430
        ]
        if not candidates:
            candidates = [pixels[(x0 + x1) // 2, y][:3]]
        row_colors.append(
            tuple(int(median(channel)) for channel in zip(*candidates, strict=True))
        )

    draw = ImageDraw.Draw(image)
    for index, _color in enumerate(row_colors):
        neighborhood = row_colors[max(0, index - 3) : min(len(row_colors), index + 4)]
        color = tuple(int(median(channel)) for channel in zip(*neighborhood, strict=True))
        draw.line((x0, y0 + index, x1, y0 + index), fill=color, width=1)


def wrap_cjk(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> str:
    draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    lines: list[str] = []
    for paragraph in text.splitlines():
        current = ""
        for character in paragraph:
            candidate = current + character
            if current and draw.textlength(candidate, font=font) > max_width:
                lines.append(current.rstrip())
                current = character.lstrip()
            else:
                current = candidate
        if current:
            lines.append(current.rstrip())
    return "\n".join(lines)


def wrap_latin(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> str:
    draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = word if not current else f"{current} {word}"
        if current and draw.textlength(candidate, font=font) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return "\n".join(lines)


def localize_capture(locale: str) -> Path:
    locale_copy = LOCALE_COPY[locale]
    source = RAW_DIR / locale / "4-chat-original-history.png"
    output = RAW_DIR / locale / "4-chat.png"
    image = Image.open(source).convert("RGB")
    if image.size != CAPTURE_SIZE:
        message = f"Unexpected {locale} chat capture size: {image.size}"
        raise RuntimeError(message)

    first_user_x, second_user_x = locale_copy.chat.user_body_x
    conversations = (
        ((first_user_x - 16, 402, 1135, 500), (first_user_x, 410), 41, 1110 - first_user_x),
        ((193, 593, 1019, 913), (198, 606), 41, 805),
        ((second_user_x - 16, 982, 1135, 1110), (second_user_x, 997), 39, 1100 - second_user_x),
        ((193, 1168, 1019, 1557), (198, 1210), 41, 805),
    )
    font_path = FONT_DIR / locale_copy.font_filename
    wrap = wrap_cjk if locale in CJK_LOCALES else wrap_latin

    for layout, message in zip(conversations, locale_copy.chat.messages, strict=True):
        erase_box, position, font_size, max_width = layout
        erase_text(image, erase_box)
        font = ImageFont.truetype(font_path, font_size)
        ImageDraw.Draw(image).multiline_text(
            position,
            wrap(message, font, max_width),
            font=font,
            fill=INK,
            spacing=11,
        )

    image.save(output)
    return output


def main() -> None:
    for locale in LOCALIZED_LOCALES:
        output = localize_capture(locale)
        print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
