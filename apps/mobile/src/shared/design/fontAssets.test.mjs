import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const fontDirectory = resolve(process.cwd(), "apps/mobile/assets/fonts");
const resourceDirectory = resolve(process.cwd(), "apps/mobile/src/localization/resources");

const getCmapFormat12Groups = (fontFileName) => {
  const font = readFileSync(resolve(fontDirectory, fontFileName));
  const tableCount = font.readUInt16BE(4);
  let cmapOffset = -1;

  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;

    if (font.toString("ascii", recordOffset, recordOffset + 4) === "cmap") {
      cmapOffset = font.readUInt32BE(recordOffset + 8);
      break;
    }
  }

  expect(cmapOffset).toBeGreaterThanOrEqual(0);
  const encodingCount = font.readUInt16BE(cmapOffset + 2);

  for (let index = 0; index < encodingCount; index += 1) {
    const recordOffset = cmapOffset + 4 + index * 8;
    const subtableOffset = cmapOffset + font.readUInt32BE(recordOffset + 4);

    if (font.readUInt16BE(subtableOffset) !== 12) {
      continue;
    }

    const groupCount = font.readUInt32BE(subtableOffset + 12);

    return Array.from({ length: groupCount }, (_, groupIndex) => {
      const groupOffset = subtableOffset + 16 + groupIndex * 12;
      return [font.readUInt32BE(groupOffset), font.readUInt32BE(groupOffset + 4)];
    });
  }

  throw new Error(`${fontFileName} does not contain a Unicode cmap format 12 table`);
};

const collectNonAsciiCodePoints = (locale) => {
  const source = readFileSync(resolve(resourceDirectory, `${locale}.ts`), "utf8");

  return Array.from(new Set(Array.from(source, (character) => character.codePointAt(0) ?? 0)))
    .filter((codePoint) => codePoint > 0x7f);
};

const expectFontToCoverResource = (fontFileName, locale) => {
  const groups = getCmapFormat12Groups(fontFileName);
  const missing = collectNonAsciiCodePoints(locale)
    .filter((codePoint) => !groups.some(([start, end]) => codePoint >= start && codePoint <= end));

  expect(missing.map((codePoint) => String.fromCodePoint(codePoint))).toEqual([]);
};

describe("CJK pixel font assets", () => {
  it("cover every non-ASCII glyph used by the current localized resources", () => {
    expectFontToCoverResource("FusionPixel10Proportional-ko.ttf", "ko-KR");
    expectFontToCoverResource("FusionPixel10Proportional-ja.ttf", "ja-JP");
    expectFontToCoverResource("FusionPixel10Proportional-zh-TW.ttf", "zh-TW");
  });

  it("include the complete modern Hangul syllable range", () => {
    const groups = getCmapFormat12Groups("FusionPixel10Proportional-ko.ttf");

    expect(groups.some(([start, end]) => start <= 0xac00 && end >= 0xd7a3)).toBe(true);
  });
});
