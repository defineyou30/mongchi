import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  detectImageContentType,
  hasFullyDecodableImageRaster,
  hasDecodableImageRaster,
  hasValidImageContainer,
  readImageDimensions,
  stripJpegApp1Metadata,
  validateSourcePhotoIntake,
  validateSourcePhotoIntakeWithPixelDecode
} from "../photoIntake";

const asciiBytes = (value: string): number[] => [...value].map((char) => char.charCodeAt(0));

const makeSegment = (marker: number, payload: number[]) => {
  const length = payload.length + 2;

  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
};

const uint16BigEndian = (value: number) => [(value >> 8) & 0xff, value & 0xff];
const uint24LittleEndian = (value: number) => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
const uint32BigEndian = (value: number) => [(value >>> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
const uint32LittleEndian = (value: number) => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
const pngCrcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

const pngCrc32 = (bytes: readonly number[]): number => {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (pngCrcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const makePngChunk = (type: string, data: number[]) => {
  const typeBytes = asciiBytes(type);
  const crc = pngCrc32([...typeBytes, ...data]);

  return [...uint32BigEndian(data.length), ...typeBytes, ...data, ...uint32BigEndian(crc)];
};

const makeJpegWithExif = (width = 800, height = 600) =>
  new Uint8Array([
    0xff,
    0xd8,
    ...makeSegment(0xe1, [...asciiBytes("Exif"), 0x00, 0x00, ...asciiBytes("secret-camera-metadata")]),
    ...makeSegment(0xdb, [0x00, 0x01, 0x02, 0x03]),
    ...makeSegment(0xc0, [
      0x08,
      ...uint16BigEndian(height),
      ...uint16BigEndian(width),
      0x03,
      0x01,
      0x11,
      0x00,
      0x02,
      0x11,
      0x00,
      0x03,
      0x11,
      0x00
    ]),
    ...makeSegment(0xda, [0x03, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x00, 0x3f, 0x00]),
    0x12,
    0x34,
    0xff,
    0xd9
  ]);

const makePngRaster = (width: number, height: number, filterType = 0) => {
  const rowBytes = width * 4;
  const raster = new Uint8Array(height * (rowBytes + 1));

  for (let row = 0; row < height; row += 1) {
    raster[row * (rowBytes + 1)] = filterType;
  }

  return raster;
};

const makePngBytes = (
  width = 800,
  height = 600,
  options: {
    filterType?: number;
    idatData?: number[];
  } = {}
) =>
  new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...makePngChunk("IHDR", [...uint32BigEndian(width), ...uint32BigEndian(height), 0x08, 0x06, 0x00, 0x00, 0x00]),
    ...makePngChunk("IDAT", options.idatData ?? [...deflateSync(makePngRaster(width, height, options.filterType ?? 0))]),
    ...makePngChunk("IEND", [])
  ]);

const makeWebpChunk = (type: string, data: number[]) => [
  ...asciiBytes(type),
  ...uint32LittleEndian(data.length),
  ...data,
  ...(data.length % 2 === 1 ? [0x00] : [])
];

const makeVp8lPayload = (width: number, height: number) => {
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;

  return [
    0x2f,
    widthMinusOne & 0xff,
    ((widthMinusOne >> 8) & 0x3f) | ((heightMinusOne & 0x03) << 6),
    (heightMinusOne >> 2) & 0xff,
    (heightMinusOne >> 10) & 0x0f,
    0x00
  ];
};

const makeWebpBytes = (width = 800, height = 600) => {
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  const chunks = [
    ...makeWebpChunk("VP8X", [
      0x00,
      0x00,
      0x00,
      0x00,
      ...uint24LittleEndian(widthMinusOne),
      ...uint24LittleEndian(heightMinusOne)
    ]),
    ...makeWebpChunk("VP8L", makeVp8lPayload(width, height))
  ];

  return new Uint8Array([
    ...asciiBytes("RIFF"),
    ...uint32LittleEndian(4 + chunks.length),
    ...asciiBytes("WEBP"),
    ...chunks
  ]);
};

const makeWebpHeaderOnlyBytes = (width = 800, height = 600) => {
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  const chunks = [
    ...makeWebpChunk("VP8X", [
      0x00,
      0x00,
      0x00,
      0x00,
      ...uint24LittleEndian(widthMinusOne),
      ...uint24LittleEndian(heightMinusOne)
    ])
  ];

  return new Uint8Array([...asciiBytes("RIFF"), ...uint32LittleEndian(4 + chunks.length), ...asciiBytes("WEBP"), ...chunks]);
};

const makeSharpImageBytes = async (format: "jpeg" | "webp", width = 128, height = 128): Promise<Uint8Array> => {
  const image = sharp({
    create: {
      width,
      height,
      channels: format === "jpeg" ? 3 : 4,
      background: {
        r: 180,
        g: 128,
        b: 96,
        alpha: 1
      }
    }
  });

  const buffer = format === "jpeg" ? await image.jpeg({ quality: 82 }).toBuffer() : await image.webp({ lossless: true }).toBuffer();

  return new Uint8Array(buffer);
};

const pngBytes = makePngBytes();
const webpBytes = makeWebpBytes();

describe("photo intake validation", () => {
  it("detects supported image container signatures", () => {
    expect(detectImageContentType(makeJpegWithExif())).toBe("image/jpeg");
    expect(detectImageContentType(pngBytes)).toBe("image/png");
    expect(detectImageContentType(webpBytes)).toBe("image/webp");
    expect(detectImageContentType(new Uint8Array([0x47, 0x49, 0x46]))).toBeNull();
  });

  it("reads dimensions from JPEG SOF, PNG IHDR, and WebP VP8X headers", () => {
    expect(readImageDimensions(makeJpegWithExif(1024, 768), "image/jpeg")).toEqual({ width: 1024, height: 768 });
    expect(readImageDimensions(makePngBytes(640, 480), "image/png")).toEqual({ width: 640, height: 480 });
    expect(readImageDimensions(makeWebpBytes(512, 384), "image/webp")).toEqual({ width: 512, height: 384 });
  });

  it("rejects image containers with broken terminal structure or checksums", () => {
    const pngWithBrokenCrc = makePngBytes();
    pngWithBrokenCrc[pngWithBrokenCrc.length - 1] = (pngWithBrokenCrc[pngWithBrokenCrc.length - 1] ?? 0) ^ 0xff;
    const truncatedWebp = webpBytes.slice(0, webpBytes.length - 1);
    const jpegWithoutEoi = makeJpegWithExif().slice(0, -2);

    expect(hasValidImageContainer(makePngBytes(), "image/png")).toBe(true);
    expect(hasValidImageContainer(pngWithBrokenCrc, "image/png")).toBe(false);
    expect(hasValidImageContainer(webpBytes, "image/webp")).toBe(true);
    expect(hasValidImageContainer(truncatedWebp, "image/webp")).toBe(false);
    expect(hasValidImageContainer(makeJpegWithExif(), "image/jpeg")).toBe(true);
    expect(hasValidImageContainer(jpegWithoutEoi, "image/jpeg")).toBe(false);
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: pngWithBrokenCrc })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
  });

  it("rejects PNG containers whose IDAT payload cannot inflate to valid raster scanlines", () => {
    const validPng = makePngBytes();
    const dimensions = readImageDimensions(validPng, "image/png");

    if (!dimensions) {
      throw new Error("Expected PNG dimensions");
    }

    const shortRasterPng = makePngBytes(800, 600, {
      idatData: [...deflateSync(new Uint8Array([0x00]))]
    });
    const badFilterPng = makePngBytes(800, 600, { filterType: 5 });

    expect(hasValidImageContainer(shortRasterPng, "image/png")).toBe(true);
    expect(hasValidImageContainer(badFilterPng, "image/png")).toBe(true);
    expect(hasDecodableImageRaster(validPng, "image/png", dimensions)).toBe(true);
    expect(hasDecodableImageRaster(shortRasterPng, "image/png", dimensions)).toBe(false);
    expect(hasDecodableImageRaster(badFilterPng, "image/png", dimensions)).toBe(false);
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: shortRasterPng })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: badFilterPng })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
  });

  it("rejects JPEG and WebP containers whose encoded raster payload is incomplete", () => {
    const validJpeg = makeJpegWithExif();
    const validWebp = makeWebpBytes();
    const jpegDimensions = readImageDimensions(validJpeg, "image/jpeg");
    const webpDimensions = readImageDimensions(validWebp, "image/webp");
    const jpegWithoutScanPayload = new Uint8Array([
      ...[...validJpeg].slice(0, -4),
      0xff,
      0xd9
    ]);
    const headerOnlyWebp = makeWebpHeaderOnlyBytes();

    if (!jpegDimensions || !webpDimensions) {
      throw new Error("Expected image dimensions");
    }

    expect(hasValidImageContainer(jpegWithoutScanPayload, "image/jpeg")).toBe(true);
    expect(hasValidImageContainer(headerOnlyWebp, "image/webp")).toBe(true);
    expect(hasDecodableImageRaster(validJpeg, "image/jpeg", jpegDimensions)).toBe(true);
    expect(hasDecodableImageRaster(validWebp, "image/webp", webpDimensions)).toBe(true);
    expect(hasDecodableImageRaster(jpegWithoutScanPayload, "image/jpeg", jpegDimensions)).toBe(false);
    expect(hasDecodableImageRaster(headerOnlyWebp, "image/webp", webpDimensions)).toBe(false);
    expect(validateSourcePhotoIntake({ declaredContentType: "image/jpeg", bytes: jpegWithoutScanPayload })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/webp", bytes: headerOnlyWebp })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
  });

  it("uses pixel decoding to reject structurally plausible but undecodable JPEG and WebP rasters", async () => {
    const jpegBytes = await makeSharpImageBytes("jpeg");
    const webpBytes = await makeSharpImageBytes("webp");
    const jpegDimensions = readImageDimensions(jpegBytes, "image/jpeg");
    const webpDimensions = readImageDimensions(webpBytes, "image/webp");
    const fakeJpeg = makeJpegWithExif();
    const fakeWebp = makeWebpBytes();

    if (!jpegDimensions || !webpDimensions) {
      throw new Error("Expected decodable test image dimensions");
    }

    expect(await hasFullyDecodableImageRaster(jpegBytes, "image/jpeg", jpegDimensions)).toBe(true);
    expect(await hasFullyDecodableImageRaster(webpBytes, "image/webp", webpDimensions)).toBe(true);
    expect(validateSourcePhotoIntake({ declaredContentType: "image/jpeg", bytes: fakeJpeg })).toMatchObject({
      ok: true,
      contentType: "image/jpeg"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/webp", bytes: fakeWebp })).toMatchObject({
      ok: true,
      contentType: "image/webp"
    });
    expect(await validateSourcePhotoIntakeWithPixelDecode({ declaredContentType: "image/jpeg", bytes: jpegBytes })).toMatchObject({
      ok: true,
      contentType: "image/jpeg",
      width: 128,
      height: 128
    });
    expect(await validateSourcePhotoIntakeWithPixelDecode({ declaredContentType: "image/webp", bytes: webpBytes })).toMatchObject({
      ok: true,
      contentType: "image/webp",
      width: 128,
      height: 128
    });
    expect(await validateSourcePhotoIntakeWithPixelDecode({ declaredContentType: "image/jpeg", bytes: fakeJpeg })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
    expect(await validateSourcePhotoIntakeWithPixelDecode({ declaredContentType: "image/webp", bytes: fakeWebp })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
  });

  it("rejects empty, oversized, unsupported, corrupt, and mismatched files with safe messages", () => {
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: new Uint8Array([]) })).toMatchObject({
      ok: false,
      issue: "empty_file"
    });
    expect(
      validateSourcePhotoIntake({
        declaredContentType: "image/png",
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        maxByteSize: 2
      })
    ).toMatchObject({
      ok: false,
      issue: "too_large"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/gif", bytes: pngBytes })).toMatchObject({
      ok: false,
      issue: "unsupported_type"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: new Uint8Array([0x01, 0x02]) })).toMatchObject({
      ok: false,
      issue: "corrupt_or_unreadable"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: makeJpegWithExif() })).toMatchObject({
      ok: false,
      issue: "content_type_mismatch"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: makePngBytes(64, 64) })).toMatchObject({
      ok: false,
      issue: "invalid_dimensions"
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/webp", bytes: makeWebpBytes(4097, 600) })).toMatchObject({
      ok: false,
      issue: "invalid_dimensions"
    });
  });

  it("strips JPEG APP1 EXIF metadata before provider input", () => {
    const source = makeJpegWithExif();
    const stripped = stripJpegApp1Metadata(source);
    const output = [...stripped.bytes];

    expect(stripped.removed).toBe(true);
    expect(output.slice(0, 2)).toEqual([0xff, 0xd8]);
    expect(output).not.toEqual(expect.arrayContaining(asciiBytes("Exif")));
    expect(output).not.toEqual(expect.arrayContaining(asciiBytes("secret-camera-metadata")));
    expect(output).toEqual(expect.arrayContaining([0xff, 0xdb]));
    expect(output).toEqual(expect.arrayContaining([0xff, 0xda]));
    expect(output.slice(-2)).toEqual([0xff, 0xd9]);
  });

  it("returns provider-safe bytes and metadata warning for valid JPEG intake", () => {
    const result = validateSourcePhotoIntake({
      declaredContentType: "image/jpeg",
      bytes: makeJpegWithExif()
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.messageSafe);
    }

    expect(result.contentType).toBe("image/jpeg");
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.metadataRemoved).toBe(true);
    expect(result.warnings).toEqual(["jpeg_app1_exif_removed"]);
    expect([...result.providerSafeBytes]).not.toEqual(expect.arrayContaining(asciiBytes("Exif")));
  });

  it("accepts PNG and WebP without metadata stripping", () => {
    expect(validateSourcePhotoIntake({ declaredContentType: "image/png", bytes: pngBytes })).toMatchObject({
      ok: true,
      contentType: "image/png",
      width: 800,
      height: 600,
      metadataRemoved: false
    });
    expect(validateSourcePhotoIntake({ declaredContentType: "image/webp", bytes: webpBytes })).toMatchObject({
      ok: true,
      contentType: "image/webp",
      width: 800,
      height: 600,
      metadataRemoved: false
    });
  });
});
