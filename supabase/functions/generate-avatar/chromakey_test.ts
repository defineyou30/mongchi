// Unit tests for the pure chroma-key pixel logic in chromakey.ts.
//
// These operate on small synthetic RGBA pixel arrays rather than real PNG
// bytes, so they exercise applyChromaKey / colorDistance / isGreenDominant /
// suppressGreenSpill directly without needing fast-png's decode/encode round
// trip. Run with: deno test chromakey_test.ts
//
// Grid size: 10x10, not the more obvious 4x4. sampleKeyColor reads the four
// corners at a 2px inset (see CHROMA_KEY_SAMPLE_INSET in chromakey.ts) to
// dodge PNG edge-compression artifacts. On a 4x4 (or even 8x8, with a pet
// block sized to touch the edges) grid the four inset corners land exactly
// on the pet block's own corners, sampling the pet instead of the
// background. A 10x10 grid with a centered 4x4 pet block (x,y in [3,6])
// keeps the sampled corners (2,2)/(7,2)/(2,7)/(7,7) cleanly outside the pet
// region (opaque ratio 16/100 = 16%, comfortably above the 5% floor) while
// staying small enough to reason about by hand.
//
// Importantly, this file imports only from ./chromakey.ts (not index.ts),
// so it never triggers index.ts's top-level Deno.serve(...) HTTP listener.

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  applyChromaKey,
  colorDistance,
  type DecodedImage,
  isGreenDominant,
  suppressGreenSpill
} from "./chromakey.ts";

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

const PURE_GREEN: RgbaColor = { r: 0, g: 255, b: 0 };
const PET_BROWN: RgbaColor = { r: 150, g: 90, b: 60 };
const GRID_SIZE = 10;

// Builds a 10x10 RGBA image: every pixel starts as `background`, and the
// centered 4x4 block (x,y in [3,6]) is filled with `pet`. This keeps the
// four inset-sampled corners (see module doc comment) cleanly inside the
// background region and away from the pet block, and gives an opaque ratio
// (16/100 = 16%) comfortably above the 5% floor for the "normal" cases.
const buildImage = (
  background: RgbaColor,
  pet: RgbaColor = PET_BROWN
): DecodedImage => {
  const width = GRID_SIZE;
  const height = GRID_SIZE;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isPet = x >= 3 && x <= 6 && y >= 3 && y <= 6;
      const pixel = isPet ? pet : background;
      const offset = (y * width + x) * 4;
      data[offset] = pixel.r;
      data[offset + 1] = pixel.g;
      data[offset + 2] = pixel.b;
      data[offset + 3] = pixel.a ?? 255;
    }
  }

  return { width, height, data };
};

// Builds a 10x10 RGBA image with a single 1px pet pixel at (4,4) against a
// green field: opaque ratio = 1/100 = 1%, below the 5% floor. Used for the
// boundary/near-empty cases.
const buildImageWithTinyPetPixel = (background: RgbaColor): DecodedImage => {
  const width = GRID_SIZE;
  const height = GRID_SIZE;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isPet = x === 4 && y === 4;
      const pixel = isPet ? PET_BROWN : background;
      const offset = (y * width + x) * 4;
      data[offset] = pixel.r;
      data[offset + 1] = pixel.g;
      data[offset + 2] = pixel.b;
      data[offset + 3] = pixel.a ?? 255;
    }
  }

  return { width, height, data };
};

// Sets a single pixel in-place, used to punch one edge/spill pixel into an
// otherwise uniform background or pet region.
const setPixel = (image: DecodedImage, x: number, y: number, pixel: RgbaColor): void => {
  const offset = (y * image.width + x) * 4;
  image.data[offset] = pixel.r;
  image.data[offset + 1] = pixel.g;
  image.data[offset + 2] = pixel.b;
  image.data[offset + 3] = pixel.a ?? 255;
};

const readPixel = (image: DecodedImage, x: number, y: number) => {
  const offset = (y * image.width + x) * 4;
  return {
    r: image.data[offset],
    g: image.data[offset + 1],
    b: image.data[offset + 2],
    a: image.data[offset + 3]
  };
};

const countOpaquePixels = (image: DecodedImage): number => {
  let count = 0;

  for (let pixelIndex = 0; pixelIndex < image.width * image.height; pixelIndex += 1) {
    if (image.data[pixelIndex * 4 + 3] === 255) {
      count += 1;
    }
  }

  return count;
};

Deno.test("colorDistance: identical colors are zero distance", () => {
  assertEquals(colorDistance({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 }), 0);
});

Deno.test("colorDistance: pure red vs pure green is the full 3D diagonal", () => {
  const distance = colorDistance({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });
  assertEquals(Math.round(distance), Math.round(Math.sqrt(255 * 255 * 2)));
});

Deno.test("isGreenDominant: pure green is dominant", () => {
  assert(isGreenDominant(PURE_GREEN));
});

Deno.test("isGreenDominant: a near-white key where green is not the max channel is not dominant", () => {
  assertFalse(isGreenDominant({ r: 248, g: 245, b: 238 }));
});

Deno.test("isGreenDominant: a tie between green and another channel is not strictly dominant", () => {
  assertFalse(isGreenDominant({ r: 200, g: 200, b: 50 }));
});

Deno.test("isGreenDominant: pure red is not green-dominant", () => {
  assertFalse(isGreenDominant({ r: 255, g: 0, b: 0 }));
});

Deno.test("suppressGreenSpill: clamps green down to the brighter of red/blue", () => {
  // A half-keyed edge pixel with green spill: green channel is inflated
  // relative to red/blue because of chroma bleed.
  assertEquals(suppressGreenSpill(40, 200, 30), 40);
  assertEquals(suppressGreenSpill(10, 200, 90), 90);
});

Deno.test("suppressGreenSpill: leaves green alone when it's not the max channel", () => {
  assertEquals(suppressGreenSpill(220, 100, 50), 100);
});

Deno.test("applyChromaKey: pure green background pixel becomes fully transparent", () => {
  // Corners (sampled for the key) are pure green; the inner 4x4 pet block
  // (a warm brown, far from green) stays opaque.
  const image = buildImage(PURE_GREEN);

  const result = applyChromaKey(image);

  assert(result.applied);
  assertFalse(result.suspicious);

  const backgroundPixel = readPixel(result.image, 0, 0);
  assertEquals(backgroundPixel.a, 0);

  const petPixel = readPixel(result.image, 4, 4);
  assertEquals(petPixel.a, 255);
  assertEquals(petPixel.r, PET_BROWN.r);
  assertEquals(petPixel.g, PET_BROWN.g);
  assertEquals(petPixel.b, PET_BROWN.b);
});

Deno.test("applyChromaKey: distance inside the soft edge band gets a partial alpha and green-spill suppression", () => {
  // A pixel roughly halfway between the green key and the opaque threshold
  // (distance ~75, inside the 60-90 soft band) should land on a fractional
  // alpha, not a hard 0/255 cutoff, and have its green channel clamped.
  const edgeColor = { r: 40, g: 210, b: 40 };
  const image = buildImage(PURE_GREEN);
  // Punch one edge pixel into the green background region (outside the
  // pet block, e.g. (0,3)) so it's keyed against the sampled corners.
  setPixel(image, 0, 3, edgeColor);

  const distance = colorDistance(edgeColor, PURE_GREEN);
  assert(distance >= 60 && distance < 90, `expected edge color distance in [60,90), got ${distance}`);

  const result = applyChromaKey(image);
  assert(result.applied, "expected keying to apply against a green-dominant sampled key");

  const edgePixel = readPixel(result.image, 0, 3);
  assert(edgePixel.a > 0 && edgePixel.a < 255, `expected partial alpha, got ${edgePixel.a}`);
  // Green-spill suppression: green channel clamped down to max(r, b).
  assertEquals(edgePixel.g, Math.max(edgePixel.r, edgePixel.b));
});

Deno.test("applyChromaKey: opaque pixels far from the key color are untouched in color", () => {
  const image = buildImage(PURE_GREEN);

  const result = applyChromaKey(image);
  const petPixel = readPixel(result.image, 4, 4);

  assertEquals(petPixel.r, PET_BROWN.r);
  assertEquals(petPixel.g, PET_BROWN.g);
  assertEquals(petPixel.b, PET_BROWN.b);
  assertEquals(petPixel.a, 255);
});

Deno.test("applyChromaKey: non-green key color skips keying entirely (safety valve)", () => {
  // Corners sampled as a flat blue-ish background (not green-dominant) --
  // keying must be skipped rather than risk carving up the pet.
  const nonGreenKey = { r: 40, g: 40, b: 220 };
  const image = buildImage(nonGreenKey);

  const result = applyChromaKey(image);

  assertFalse(result.applied);
  assertFalse(result.suspicious);
  // Original image returned unchanged.
  assertEquals(result.image, image);
});

Deno.test("applyChromaKey: near-all-green image (opaque ratio below threshold) is flagged suspicious", () => {
  // Every pixel (including what would be the pet block) is pure green, so
  // the opaque ratio after keying is 0% -- below the 5% floor. Keying must
  // bail out and flag the result as suspicious rather than ship an empty
  // sprite that lost the pet entirely.
  const image = buildImage(PURE_GREEN, PURE_GREEN);

  const result = applyChromaKey(image);

  assertFalse(result.applied);
  assert(result.suspicious);
  assertEquals(result.image, image);
});

Deno.test("applyChromaKey: a single surviving pet pixel below the opaque-ratio floor is flagged suspicious", () => {
  // 10x10 image where only one pixel is pet and the rest is green; opaque
  // ratio = 1/100 = 1%, below the 5% floor. This is the boundary case
  // verifying the ratio math itself picks up a near-empty (but not
  // completely empty) result, distinct from the all-green 0% case above.
  const image = buildImageWithTinyPetPixel(PURE_GREEN);
  const sourceOpaqueCount = countOpaquePixels(image);

  // Sanity check on the fixture itself: only the single pet pixel starts
  // opaque-and-distinct from green here (everything else is the pure-green
  // background, which also happens to carry srcAlpha 255 pre-keying -- the
  // 1/100 ratio only shows up *after* keying assigns alpha by distance).
  assertEquals(sourceOpaqueCount, GRID_SIZE * GRID_SIZE);

  const result = applyChromaKey(image);

  // 1/100 = 1%, below CHROMA_KEY_MIN_OPAQUE_RATIO (5%): keying must bail
  // out and flag suspicious rather than shipping a near-empty sprite.
  assertFalse(result.applied);
  assert(result.suspicious);
  assertEquals(result.image, image);
});

Deno.test("applyChromaKey: a 4x4 pet block against a green field applies normally", () => {
  // 10x10 image where a 4x4 pet block sits in a green field; opaque ratio
  // = 16/100 = 16%, comfortably above the 5% floor.
  const image = buildImage(PURE_GREEN);

  const result = applyChromaKey(image);
  const opaqueCount = countOpaquePixels(result.image);

  assertEquals(opaqueCount, 16);
  assert(result.applied);
  assertFalse(result.suspicious);
});

// ---------------------------------------------------------------------------
// BFS shadow pass + edge spill clamp (added after production E2E findings)
// ---------------------------------------------------------------------------

// Shadowed background green: multiplicatively darkened key color. Distance
// from pure green exceeds the opaque threshold (so pass 1 leaves it opaque),
// but the green channel ratio stays extreme, and it touches the keyed field.
const SHADOWED_GREEN: RgbaColor = { r: 30, g: 120, b: 25 };
// Green-spilled fur: bright warm base with additive green — the ratio test
// must NOT classify this as background even when it touches transparency.
const SPILLED_FUR: RgbaColor = { r: 150, g: 200, b: 60 };

const pixelAt = (image: DecodedImage, x: number, y: number) => {
  const offset = (y * image.width + x) * 4;
  return {
    r: image.data[offset],
    g: image.data[offset + 1],
    b: image.data[offset + 2],
    a: image.data[offset + 3]
  };
};

Deno.test("applyChromaKey: shadowed green connected to the background is removed by the BFS pass", () => {
  const image = buildImage(PURE_GREEN);
  // Paint a "ground shadow" row just below the pet block, touching the green
  // field on both sides: distance from key ≈ 141 (> 90, opaque in pass 1),
  // but strong-green by ratio and connected to transparency → BFS removes it.
  for (let x = 3; x <= 6; x += 1) {
    setPixel(image, x, 7, SHADOWED_GREEN);
  }

  const result = applyChromaKey(image);

  assert(result.applied);
  assertEquals(pixelAt(result.image, 4, 7).a, 0);
  assertEquals(pixelAt(result.image, 6, 7).a, 0);
  // The pet block above the shadow stays opaque.
  assertEquals(pixelAt(result.image, 4, 6).a, 255);
});

Deno.test("applyChromaKey: isolated strong green inside the pet is preserved", () => {
  const image = buildImage(PURE_GREEN);
  // A strong-green pixel fully surrounded by opaque pet brown (e.g. a green
  // collar in the source photo). BFS can only reach it through a strong-green
  // chain from transparency; brown neighbors block it, so it must survive.
  setPixel(image, 4, 4, SHADOWED_GREEN);
  setPixel(image, 5, 5, SHADOWED_GREEN);

  const result = applyChromaKey(image);

  assert(result.applied);
  assertEquals(pixelAt(result.image, 4, 4).a, 255);
  assertEquals(pixelAt(result.image, 5, 5).a, 255);
});

Deno.test("applyChromaKey: spilled fur at the silhouette edge stays opaque but gets its green clamped", () => {
  const image = buildImage(PURE_GREEN);
  // A fur pixel with green spill on the pet's top-left silhouette corner:
  // touches transparency, but its green ratio (200 vs 150*1.4+10=220) is
  // below the strong-green threshold, so the BFS must NOT remove it. It sits
  // within the 3px dilated edge band and g (200) > max(r,b) (150) + 15, so
  // the spill clamp pulls green down to the warm max.
  setPixel(image, 3, 3, SPILLED_FUR);

  const result = applyChromaKey(image);
  const fur = pixelAt(result.image, 3, 3);

  assert(result.applied);
  assertEquals(fur.a, 255);
  assertEquals(fur.g, 150);
  assertEquals(fur.r, 150);
  assertEquals(fur.b, 60);
});
