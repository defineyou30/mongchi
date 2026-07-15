#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=10.0"]
# ///

from __future__ import annotations

from pathlib import Path
from typing import Final

from PIL import Image


ROOT: Final = Path(__file__).resolve().parents[3]
SOURCE_ROOT: Final = ROOT / "docs/release/store-assets/v4-pixel/final"
OUTPUT_ROOT: Final = ROOT / "apps/landing/public/assets/campaign"

LOCALES: Final = (
    "en-US",
    "ko-KR",
    "ja-JP",
    "zh-TW",
    "de-DE",
    "fr-FR",
    "pt-BR",
    "es-MX",
)

POSTERS: Final = {
    "01-your-pet": "01-your-pet-living-in-your-phone.png",
    "02-care": "02-care-in-little-moments.png",
    "03-poses": "03-meet-every-side.png",
    "04-chat": "04-tell-them-about-your-day.png",
    "05-memory": "05-every-day-becomes-a-memory.png",
    "06-world": "06-a-cozy-world-of-their-own.png",
}

EXPORTS: Final = ((720, 1564), (360, 782))


def source_directory(locale: str) -> Path:
    return SOURCE_ROOT if locale == "en-US" else SOURCE_ROOT / locale


def output_directory(locale: str) -> Path:
    return OUTPUT_ROOT if locale == "en-US" else OUTPUT_ROOT / locale


def export_locale(locale: str) -> None:
    destination = output_directory(locale)
    destination.mkdir(parents=True, exist_ok=True)

    for slug, filename in POSTERS.items():
        source = source_directory(locale) / filename
        if not source.is_file():
            raise FileNotFoundError(f"Missing App Store source: {source}")

        with Image.open(source) as opened:
            image = opened.convert("RGB")
            for width, height in EXPORTS:
                resized = image.resize((width, height), Image.Resampling.LANCZOS)
                output = destination / f"{slug}-{width}.webp"
                resized.save(output, "WEBP", quality=86, method=6)
                print(output.relative_to(ROOT))


def main() -> None:
    for locale in LOCALES:
        export_locale(locale)


if __name__ == "__main__":
    main()
