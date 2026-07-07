// Chroma-key background removal (postprocessing) for generate-avatar.
//
// Why: background=transparent (both the FormData field and prompt-only
// instructions) is not honored by /images/edits on gpt-image-1 or
// gpt-image-1.5 — the model paints in a background regardless. Instead the
// prompt (see stylePromptLines in index.ts) forces a uniform pure-green
// canvas, and we key it out here before upload. Verified experimentally:
// border pixels come back within +/-3 of the requested green (e.g.
// RGB(96,191,1) on a gpt-image-1.5 result used as the sampled key), which is
// uniform enough for a simple Euclidean-distance key with a soft edge band.
//
// Library choice: npm:fast-png. It's pure JS (zlib via pako, no wasm/native
// bindings), which Deno's npm compat layer runs without extra flags, and its
// decode/encode API is small enough to reason about under the Edge Function
// CPU budget. Considered @jsquash/png (wasm) as an alternative — skipped
// because it needs a wasm instantiation step per isolate and doesn't buy
// meaningfully more speed than fast-png's zlib deflate for our image size.
//
// CPU budget (1024x1024 RGBA, ~4.2MB raw): fast-png decode of a lightly-
// compressed PNG is typically ~40-80ms, our per-pixel key pass over 1.05M
// pixels is simple arithmetic (~15-30ms), and re-encoding (deflate at
// fast-png's default level) is the dominant cost at ~150-300ms. Total
// ~200-400ms per state image, run sequentially after each generation call
// completes — well inside the Edge Function's CPU budget alongside the
// network-bound OpenAI calls.
//
// This module is kept dependency-light and free of any top-level
// Deno.serve/handler side effects specifically so it can be imported from
// chromakey_test.ts without booting the HTTP entrypoint in index.ts.

import { decode as decodePng, encode as encodePng } from "npm:fast-png@7";

export const CHROMA_KEY_FULL_TRANSPARENT_DISTANCE = 60;
export const CHROMA_KEY_FULL_OPAQUE_DISTANCE = 90;
export const CHROMA_KEY_MIN_OPAQUE_RATIO = 0.05;
const CHROMA_KEY_SAMPLE_INSET = 2;

// Ratio-based "strong green" test used by the BFS shadow pass. The model
// sometimes paints a soft ground shadow onto the green canvas; shading is
// multiplicative, so a shadowed background pixel keeps the key's extreme
// green-to-red/blue channel RATIO even though its Euclidean distance from
// the key exceeds the opaque threshold. Green spill on fur, by contrast, is
// additive on top of a bright warm base, so its ratio stays modest — this is
// what lets the BFS eat shadowed background without eating spilled fur.
export const CHROMA_KEY_STRONG_GREEN_RATIO = 1.4;
export const CHROMA_KEY_STRONG_GREEN_BIAS = 10;
// Opaque pixels within this many pixels of transparency get green-spill
// clamping (fur fringe cleanup).
export const CHROMA_KEY_SPILL_EDGE_RADIUS = 3;
export const CHROMA_KEY_SPILL_GREEN_EXCESS = 15;

export const isStrongGreen = (r: number, g: number, b: number): boolean =>
  g > r * CHROMA_KEY_STRONG_GREEN_RATIO + CHROMA_KEY_STRONG_GREEN_BIAS &&
  g > b * CHROMA_KEY_STRONG_GREEN_RATIO + CHROMA_KEY_STRONG_GREEN_BIAS;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface DecodedImage {
  width: number;
  height: number;
  // Always RGBA, one byte per channel, row-major.
  data: Uint8Array;
}

export const colorDistance = (a: RgbColor, b: RgbColor): number => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;

  return Math.sqrt(dr * dr + dg * dg + db * db);
};

// Samples the four inset corner pixels and averages them into a single key
// color. Using an inset of 2px (rather than the very corner pixel) avoids
// PNG edge-compression artifacts skewing the sample.
export const sampleKeyColor = (image: DecodedImage): RgbColor => {
  const inset = CHROMA_KEY_SAMPLE_INSET;
  const corners: Array<[number, number]> = [
    [inset, inset],
    [image.width - 1 - inset, inset],
    [inset, image.height - 1 - inset],
    [image.width - 1 - inset, image.height - 1 - inset]
  ];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const [x, y] of corners) {
    const offset = (y * image.width + x) * 4;
    sumR += image.data[offset];
    sumG += image.data[offset + 1];
    sumB += image.data[offset + 2];
  }

  return {
    r: sumR / corners.length,
    g: sumG / corners.length,
    b: sumB / corners.length
  };
};

// A key color only counts as "green" if green is the strictly dominant
// channel — this guards against keying out a background the model rendered
// in some other flat color (e.g. if it ignored the prompt), where blindly
// applying the green-distance key would carve holes out of the pet.
export const isGreenDominant = (color: RgbColor): boolean => color.g > color.r && color.g > color.b;

// Suppresses green spill on partially-keyed edge pixels by clamping the
// green channel down to the brighter of red/blue, so soft edges don't carry
// a green fringe once composited onto a non-green scene.
export const suppressGreenSpill = (r: number, g: number, b: number): number => Math.min(g, Math.max(r, b));

export interface ChromaKeyResult {
  image: DecodedImage;
  applied: boolean;
  suspicious: boolean;
}

// Pure pixel-level keying function, factored out so it can be unit tested
// without going through PNG encode/decode. Returns a fresh RGBA buffer when
// applied; does not mutate the input.
//
// Four passes over n = width*height pixels (CPU math for 1024², n ≈ 1.05M):
//   1. distance-band alpha map            — simple arithmetic, ~15-30ms
//   2. BFS shadow pass                    — each pixel enqueued at most once,
//      Int32Array ring queue, ~20-50ms
//   3. compose output + soft-edge spill   — ~15-30ms
//   4. 3x dilation + edge spill clamp     — O(3n), ~30ms
// Total added on top of decode/encode: ~80-140ms, keeping the whole
// removeChromaKeyBackground call around ~250-450ms — inside the 2000ms
// Edge Function CPU budget even for three states processed sequentially.
export const applyChromaKey = (image: DecodedImage): ChromaKeyResult => {
  const keyColor = sampleKeyColor(image);

  if (!isGreenDominant(keyColor)) {
    // Safety valve: the sampled background isn't green, so we can't trust a
    // green-distance key. Skip keying rather than risk carving up the pet;
    // the original opaque image still ships.
    return { image, applied: false, suspicious: false };
  }

  const { width, height } = image;
  const source = image.data;
  const pixelCount = width * height;

  // Pass 1: distance-band alpha map.
  const alphaMap = new Uint8Array(pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const r = source[offset];
    const g = source[offset + 1];
    const b = source[offset + 2];

    const distance = colorDistance({ r, g, b }, keyColor);

    if (distance < CHROMA_KEY_FULL_TRANSPARENT_DISTANCE) {
      alphaMap[pixelIndex] = 0;
    } else if (distance < CHROMA_KEY_FULL_OPAQUE_DISTANCE) {
      const t =
        (distance - CHROMA_KEY_FULL_TRANSPARENT_DISTANCE) /
        (CHROMA_KEY_FULL_OPAQUE_DISTANCE - CHROMA_KEY_FULL_TRANSPARENT_DISTANCE);
      alphaMap[pixelIndex] = Math.round(t * 255);
    } else {
      alphaMap[pixelIndex] = 255;
    }
  }

  // Pass 2: BFS shadow pass. Ground shadows the model paints onto the green
  // canvas darken the key color past the opaque distance threshold, but keep
  // its extreme green channel ratio. Flood-fill outward from every fully
  // transparent pixel into strong-green neighbors, so shadowed background
  // connected to the keyed field is removed while isolated green inside the
  // pet (e.g. a green collar in the source photo) is preserved.
  const queue = new Int32Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  let head = 0;
  let tail = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (alphaMap[pixelIndex] === 0) {
      visited[pixelIndex] = 1;
      queue[tail] = pixelIndex;
      tail += 1;
    }
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;
    const x = pixelIndex % width;
    const y = (pixelIndex - x) / width;

    for (let direction = 0; direction < 4; direction += 1) {
      const nx = direction === 0 ? x - 1 : direction === 1 ? x + 1 : x;
      const ny = direction === 2 ? y - 1 : direction === 3 ? y + 1 : y;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        continue;
      }

      const neighborIndex = ny * width + nx;

      if (visited[neighborIndex]) {
        continue;
      }

      visited[neighborIndex] = 1;

      const neighborOffset = neighborIndex * 4;
      const nr = source[neighborOffset];
      const ng = source[neighborOffset + 1];
      const nb = source[neighborOffset + 2];

      if (alphaMap[neighborIndex] > 0 && isStrongGreen(nr, ng, nb)) {
        // Fully opaque strong-green = shadowed background: remove it. Soft-
        // band (partial alpha) strong-green pixels keep their feathered alpha
        // but still act as BFS bridges, so shadow blobs ringed by the soft
        // band are still reached and removed.
        if (alphaMap[neighborIndex] === 255) {
          alphaMap[neighborIndex] = 0;
        }

        queue[tail] = neighborIndex;
        tail += 1;
      }
    }
  }

  // Pass 3: compose the output buffer, combining with source alpha and
  // suppressing green spill on soft-edge (partially transparent) pixels.
  const output = new Uint8Array(source.length);
  let opaqueCount = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const r = source[offset];
    const g = source[offset + 1];
    const b = source[offset + 2];
    const srcAlpha = source[offset + 3];

    // Combine with the source alpha in case the PNG already carried partial
    // transparency (defensive; OpenAI returns fully-opaque PNGs today).
    const combinedAlpha = Math.round((alphaMap[pixelIndex] * srcAlpha) / 255);

    output[offset] = r;
    output[offset + 1] = combinedAlpha < 255 ? suppressGreenSpill(r, g, b) : g;
    output[offset + 2] = b;
    output[offset + 3] = combinedAlpha;

    if (combinedAlpha === 255) {
      opaqueCount += 1;
    }
  }

  const opaqueRatio = opaqueCount / pixelCount;

  if (opaqueRatio < CHROMA_KEY_MIN_OPAQUE_RATIO) {
    // Keying wiped out almost everything, including presumably the pet
    // itself (e.g. the model rendered a near-all-green frame). Bail out and
    // ship the original opaque image rather than an empty sprite.
    return { image, applied: false, suspicious: true };
  }

  // Pass 4: green-spill cleanup on opaque fur fringes. Dilate the
  // transparency mask CHROMA_KEY_SPILL_EDGE_RADIUS times; opaque pixels
  // inside the dilated band whose green channel clearly exceeds both warm
  // channels get their green clamped down, so composited edges don't glow.
  let nearTransparent = new Uint8Array(pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    nearTransparent[pixelIndex] = output[pixelIndex * 4 + 3] === 0 ? 1 : 0;
  }

  for (let iteration = 0; iteration < CHROMA_KEY_SPILL_EDGE_RADIUS; iteration += 1) {
    const next = new Uint8Array(nearTransparent);

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      if (nearTransparent[pixelIndex]) {
        continue;
      }

      const x = pixelIndex % width;
      const y = (pixelIndex - x) / width;

      if (
        (x > 0 && nearTransparent[pixelIndex - 1]) ||
        (x < width - 1 && nearTransparent[pixelIndex + 1]) ||
        (y > 0 && nearTransparent[pixelIndex - width]) ||
        (y < height - 1 && nearTransparent[pixelIndex + width])
      ) {
        next[pixelIndex] = 1;
      }
    }

    nearTransparent = next;
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;

    if (!nearTransparent[pixelIndex] || output[offset + 3] !== 255) {
      continue;
    }

    const r = output[offset];
    const g = output[offset + 1];
    const b = output[offset + 2];
    const warmMax = Math.max(r, b);

    if (g > warmMax + CHROMA_KEY_SPILL_GREEN_EXCESS) {
      output[offset + 1] = warmMax;
    }
  }

  return { image: { width, height, data: output }, applied: true, suspicious: false };
};

export interface ChromaKeyOutcome {
  bytes: Uint8Array;
  quality: "chromakey_applied" | "chromakey_skipped" | "chromakey_suspicious";
}

// fast-png can decode 8-bit RGB (no alpha channel) PNGs as 3-channel output;
// normalize to RGBA with full opacity so applyChromaKey has a single shape
// to work with.
const expandRgbToRgba = (rgb: Uint8Array, width: number, height: number): Uint8Array => {
  const rgba = new Uint8Array(width * height * 4);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const srcOffset = pixelIndex * 3;
    const dstOffset = pixelIndex * 4;
    rgba[dstOffset] = rgb[srcOffset];
    rgba[dstOffset + 1] = rgb[srcOffset + 1];
    rgba[dstOffset + 2] = rgb[srcOffset + 2];
    rgba[dstOffset + 3] = 255;
  }

  return rgba;
};

// PNG-bytes-in, PNG-bytes-out wrapper around applyChromaKey. Never throws:
// any decode/encode failure falls back to shipping the original bytes
// untouched, tagged chromakey_skipped, so a postprocessing bug can never
// fail the whole generation job — the pet must still arrive.
export const removeChromaKeyBackground = (pngBytes: Uint8Array): ChromaKeyOutcome => {
  try {
    const decoded = decodePng(pngBytes);

    if (decoded.channels !== 4 && decoded.channels !== 3) {
      return { bytes: pngBytes, quality: "chromakey_skipped" };
    }

    const width = decoded.width;
    const height = decoded.height;
    const rgba =
      decoded.channels === 4
        ? new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength)
        : expandRgbToRgba(decoded.data as Uint8Array, width, height);

    const result = applyChromaKey({ width, height, data: rgba });

    if (!result.applied) {
      return { bytes: pngBytes, quality: result.suspicious ? "chromakey_suspicious" : "chromakey_skipped" };
    }

    const encoded = encodePng(
      { width, height, data: result.image.data, channels: 4, depth: 8 },
      { zlib: { level: 6 } }
    );

    return { bytes: new Uint8Array(encoded), quality: "chromakey_applied" };
  } catch {
    return { bytes: pngBytes, quality: "chromakey_skipped" };
  }
};
