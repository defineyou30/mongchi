import { inflateSync } from "node:zlib";

import { MAX_SOURCE_PHOTO_BYTES, supportedSourcePhotoContentTypes } from "@mongchi/shared";
import type { SourcePhotoContentType } from "@mongchi/shared";
import sharp from "sharp";

export type PhotoIntakeIssue =
  | "empty_file"
  | "too_large"
  | "unsupported_type"
  | "corrupt_or_unreadable"
  | "content_type_mismatch"
  | "invalid_dimensions";

export type PhotoIntakeResult =
  | {
      ok: true;
      contentType: SourcePhotoContentType;
      byteSize: number;
      width: number;
      height: number;
      providerSafeBytes: Uint8Array;
      metadataRemoved: boolean;
      warnings: string[];
    }
  | {
      ok: false;
      issue: PhotoIntakeIssue;
      messageSafe: string;
    };

export interface SourcePhotoIntakeInput {
  declaredContentType: string;
  bytes: Uint8Array;
  maxByteSize?: number;
}

export interface SourcePhotoPixelDecodeInput {
  bytes: Uint8Array;
  contentType: SourcePhotoContentType;
  dimensions: ImageDimensions;
}

export type SourcePhotoPixelDecoder = (input: SourcePhotoPixelDecodeInput) => Promise<boolean>;

export interface SourcePhotoIntakePixelDecodeOptions {
  pixelDecoder?: SourcePhotoPixelDecoder;
}

const supportedContentTypeSet = new Set<string>(supportedSourcePhotoContentTypes);

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const riffSignature = [0x52, 0x49, 0x46, 0x46];
const webpSignature = [0x57, 0x45, 0x42, 0x50];
const exifSignature = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
const MIN_SOURCE_PHOTO_SIDE_PX = 128;
const MAX_SOURCE_PHOTO_SIDE_PX = 4096;
const MAX_SOURCE_PHOTO_PIXELS = 16_777_216;
const PNG_SUPPORTED_BIT_DEPTHS_BY_COLOR_TYPE: Record<number, ReadonlySet<number>> = {
  0: new Set([1, 2, 4, 8, 16]),
  2: new Set([8, 16]),
  3: new Set([1, 2, 4, 8]),
  4: new Set([8, 16]),
  6: new Set([8, 16])
};
const PNG_SAMPLES_PER_PIXEL_BY_COLOR_TYPE: Record<number, number> = {
  0: 1,
  2: 3,
  3: 1,
  4: 2,
  6: 4
};
const PNG_ADAM7_PASSES = [
  { startX: 0, startY: 0, stepX: 8, stepY: 8 },
  { startX: 4, startY: 0, stepX: 8, stepY: 8 },
  { startX: 0, startY: 4, stepX: 4, stepY: 8 },
  { startX: 2, startY: 0, stepX: 4, stepY: 4 },
  { startX: 0, startY: 2, stepX: 2, stepY: 4 },
  { startX: 1, startY: 0, stepX: 2, stepY: 2 },
  { startX: 0, startY: 1, stepX: 1, stepY: 2 }
] as const;
const pngCrcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

const bytesStartWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean => {
  if (bytes.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[offset + index] === byte);
};

const isSupportedContentType = (contentType: string): contentType is SourcePhotoContentType =>
  supportedContentTypeSet.has(contentType);

export const detectImageContentType = (bytes: Uint8Array): SourcePhotoContentType | null => {
  if (bytesStartWith(bytes, pngSignature)) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (bytesStartWith(bytes, riffSignature) && bytesStartWith(bytes, webpSignature, 8)) {
    return "image/webp";
  }

  return null;
};

const readUInt16BigEndian = (bytes: Uint8Array, offset: number): number | null => {
  if (offset + 1 >= bytes.length) {
    return null;
  }

  const high = bytes[offset];
  const low = bytes[offset + 1];

  return high === undefined || low === undefined ? null : (high << 8) + low;
};

const readUInt32BigEndian = (bytes: Uint8Array, offset: number): number | null => {
  if (offset + 3 >= bytes.length) {
    return null;
  }

  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];

  return a === undefined || b === undefined || c === undefined || d === undefined
    ? null
    : a * 0x1000000 + (b << 16) + (c << 8) + d;
};

const readUInt16LittleEndian = (bytes: Uint8Array, offset: number): number | null => {
  if (offset + 1 >= bytes.length) {
    return null;
  }

  const low = bytes[offset];
  const high = bytes[offset + 1];

  return high === undefined || low === undefined ? null : low + (high << 8);
};

const readUInt24LittleEndian = (bytes: Uint8Array, offset: number): number | null => {
  if (offset + 2 >= bytes.length) {
    return null;
  }

  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];

  return a === undefined || b === undefined || c === undefined ? null : a + (b << 8) + (c << 16);
};

const readUInt32LittleEndian = (bytes: Uint8Array, offset: number): number | null => {
  if (offset + 3 >= bytes.length) {
    return null;
  }

  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];

  return a === undefined || b === undefined || c === undefined || d === undefined
    ? null
    : a + (b << 8) + (c << 16) + d * 0x1000000;
};

const asciiAt = (bytes: Uint8Array, offset: number, value: string): boolean =>
  [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

const pngCrc32 = (bytes: Uint8Array, start: number, end: number): number => {
  let crc = 0xffffffff;

  for (let index = start; index < end; index += 1) {
    const byte = bytes[index];

    if (byte === undefined) {
      return 0;
    }

    crc = (pngCrcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

export interface ImageDimensions {
  width: number;
  height: number;
}

const isJpegStartOfFrameMarker = (marker: number | undefined): boolean =>
  marker !== undefined &&
  ((marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf));

const readJpegDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (detectImageContentType(bytes) !== "image/jpeg") {
    return null;
  }

  let cursor = 2;

  while (cursor + 3 < bytes.length) {
    if (bytes[cursor] !== 0xff) {
      cursor += 1;
      continue;
    }

    const marker = bytes[cursor + 1];

    if (marker === 0xda || marker === 0xd9) {
      return null;
    }

    const segmentLength = readUInt16BigEndian(bytes, cursor + 2);

    if (!segmentLength || segmentLength < 2) {
      return null;
    }

    const segmentEnd = cursor + 2 + segmentLength;

    if (segmentEnd > bytes.length) {
      return null;
    }

    if (isJpegStartOfFrameMarker(marker)) {
      const height = readUInt16BigEndian(bytes, cursor + 5);
      const width = readUInt16BigEndian(bytes, cursor + 7);

      return width && height ? { width, height } : null;
    }

    cursor = segmentEnd;
  }

  return null;
};

const readPngDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (!bytesStartWith(bytes, pngSignature) || !asciiAt(bytes, 12, "IHDR")) {
    return null;
  }

  const width = readUInt32BigEndian(bytes, 16);
  const height = readUInt32BigEndian(bytes, 20);

  return width && height ? { width, height } : null;
};

const readWebpDimensionsFromChunk = (bytes: Uint8Array, chunkTypeOffset: number, chunkSize: number): ImageDimensions | null => {
  const dataOffset = chunkTypeOffset + 8;

  if (asciiAt(bytes, chunkTypeOffset, "VP8X")) {
    if (chunkSize < 10 || dataOffset + 9 >= bytes.length) {
      return null;
    }

    const widthMinusOne = readUInt24LittleEndian(bytes, dataOffset + 4);
    const heightMinusOne = readUInt24LittleEndian(bytes, dataOffset + 7);

    return widthMinusOne === null || heightMinusOne === null
      ? null
      : {
          width: widthMinusOne + 1,
          height: heightMinusOne + 1
        };
  }

  if (asciiAt(bytes, chunkTypeOffset, "VP8L")) {
    if (chunkSize < 5 || bytes[dataOffset] !== 0x2f || dataOffset + 4 >= bytes.length) {
      return null;
    }

    const b1 = bytes[dataOffset + 1] ?? 0;
    const b2 = bytes[dataOffset + 2] ?? 0;
    const b3 = bytes[dataOffset + 3] ?? 0;
    const b4 = bytes[dataOffset + 4] ?? 0;

    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10))
    };
  }

  if (asciiAt(bytes, chunkTypeOffset, "VP8 ")) {
    if (chunkSize < 10 || dataOffset + 9 >= bytes.length || !bytesStartWith(bytes, [0x9d, 0x01, 0x2a], dataOffset + 3)) {
      return null;
    }

    const rawWidth = readUInt16LittleEndian(bytes, dataOffset + 6);
    const rawHeight = readUInt16LittleEndian(bytes, dataOffset + 8);

    return rawWidth && rawHeight
      ? {
          width: rawWidth & 0x3fff,
          height: rawHeight & 0x3fff
        }
      : null;
  }

  return null;
};

const readWebpDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (!bytesStartWith(bytes, riffSignature) || !bytesStartWith(bytes, webpSignature, 8)) {
    return null;
  }

  let cursor = 12;

  while (cursor + 7 < bytes.length) {
    const chunkSize = readUInt32LittleEndian(bytes, cursor + 4);

    if (chunkSize === null) {
      return null;
    }

    const dataOffset = cursor + 8;
    const chunkEnd = dataOffset + chunkSize;

    if (chunkEnd > bytes.length) {
      return null;
    }

    const dimensions = readWebpDimensionsFromChunk(bytes, cursor, chunkSize);

    if (dimensions) {
      return dimensions;
    }

    cursor = chunkEnd + (chunkSize % 2);
  }

  return null;
};

const hasValidJpegContainer = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[bytes.length - 2] === 0xff &&
  bytes[bytes.length - 1] === 0xd9;

const isJpegRestartMarker = (marker: number | undefined): boolean => marker !== undefined && marker >= 0xd0 && marker <= 0xd7;

const isJpegStandaloneMarker = (marker: number | undefined): boolean =>
  marker === 0x01 || isJpegRestartMarker(marker) || marker === 0xd8 || marker === 0xd9;

const findNextJpegMarker = (bytes: Uint8Array, cursor: number): { markerOffset: number; marker: number; nextOffset: number } | null => {
  if (cursor >= bytes.length || bytes[cursor] !== 0xff) {
    return null;
  }

  let markerOffset = cursor;
  let markerCursor = cursor + 1;

  while (bytes[markerCursor] === 0xff) {
    markerOffset = markerCursor;
    markerCursor += 1;
  }

  const marker = bytes[markerCursor];

  return marker === undefined || marker === 0x00
    ? null
    : {
        markerOffset,
        marker,
        nextOffset: markerCursor + 1
      };
};

const findJpegEntropyScanEnd = (
  bytes: Uint8Array,
  scanDataOffset: number
): { markerOffset: number; payloadByteCount: number } | null => {
  let cursor = scanDataOffset;
  let payloadByteCount = 0;

  while (cursor < bytes.length) {
    const byte = bytes[cursor];

    if (byte === undefined) {
      return null;
    }

    if (byte !== 0xff) {
      payloadByteCount += 1;
      cursor += 1;
      continue;
    }

    let markerCursor = cursor + 1;

    while (bytes[markerCursor] === 0xff) {
      markerCursor += 1;
    }

    const marker = bytes[markerCursor];

    if (marker === undefined) {
      return null;
    }

    if (marker === 0x00) {
      payloadByteCount += 1;
      cursor = markerCursor + 1;
      continue;
    }

    if (isJpegRestartMarker(marker)) {
      cursor = markerCursor + 1;
      continue;
    }

    return {
      markerOffset: cursor,
      payloadByteCount
    };
  }

  return null;
};

const readJpegScanComponentIds = (bytes: Uint8Array, segmentDataOffset: number, segmentLength: number): number[] | null => {
  const componentCount = bytes[segmentDataOffset];

  if (componentCount === undefined || componentCount < 1 || componentCount > 4 || segmentLength !== 6 + componentCount * 2) {
    return null;
  }

  const componentIds: number[] = [];

  for (let index = 0; index < componentCount; index += 1) {
    const componentId = bytes[segmentDataOffset + 1 + index * 2];

    if (componentId === undefined) {
      return null;
    }

    componentIds.push(componentId);
  }

  return componentIds;
};

const hasDecodableJpegRaster = (bytes: Uint8Array, dimensions: ImageDimensions): boolean => {
  if (!hasValidJpegContainer(bytes)) {
    return false;
  }

  let cursor = 2;
  let frameMatchesDimensions = false;
  let sawEntropyScan = false;
  const frameComponentIds = new Set<number>();

  while (cursor < bytes.length) {
    const marker = findNextJpegMarker(bytes, cursor);

    if (!marker) {
      return false;
    }

    if (marker.marker === 0xd9) {
      return frameMatchesDimensions && sawEntropyScan && marker.nextOffset === bytes.length;
    }

    if (marker.marker === 0xda) {
      const segmentLength = readUInt16BigEndian(bytes, marker.nextOffset);

      if (!segmentLength || segmentLength < 6) {
        return false;
      }

      const segmentDataOffset = marker.nextOffset + 2;
      const scanDataOffset = marker.nextOffset + segmentLength;

      if (scanDataOffset > bytes.length) {
        return false;
      }

      const scanComponentIds = readJpegScanComponentIds(bytes, segmentDataOffset, segmentLength);

      if (!scanComponentIds || scanComponentIds.some((componentId) => !frameComponentIds.has(componentId))) {
        return false;
      }

      const scanEnd = findJpegEntropyScanEnd(bytes, scanDataOffset);

      if (!scanEnd || scanEnd.payloadByteCount === 0) {
        return false;
      }

      sawEntropyScan = true;
      cursor = scanEnd.markerOffset;
      continue;
    }

    if (isJpegStandaloneMarker(marker.marker)) {
      cursor = marker.nextOffset;
      continue;
    }

    const segmentLength = readUInt16BigEndian(bytes, marker.nextOffset);

    if (!segmentLength || segmentLength < 2) {
      return false;
    }

    const segmentDataOffset = marker.nextOffset + 2;
    const segmentEnd = marker.nextOffset + segmentLength;

    if (segmentEnd > bytes.length) {
      return false;
    }

    if (isJpegStartOfFrameMarker(marker.marker)) {
      const precision = bytes[segmentDataOffset];
      const height = readUInt16BigEndian(bytes, segmentDataOffset + 1);
      const width = readUInt16BigEndian(bytes, segmentDataOffset + 3);
      const componentCount = bytes[segmentDataOffset + 5];

      if (
        precision === undefined ||
        height === null ||
        width === null ||
        componentCount === undefined ||
        componentCount < 1 ||
        componentCount > 4 ||
        segmentLength !== 8 + componentCount * 3
      ) {
        return false;
      }

      frameComponentIds.clear();

      for (let index = 0; index < componentCount; index += 1) {
        const componentId = bytes[segmentDataOffset + 6 + index * 3];

        if (componentId === undefined || frameComponentIds.has(componentId)) {
          return false;
        }

        frameComponentIds.add(componentId);
      }

      frameMatchesDimensions = width === dimensions.width && height === dimensions.height;
    }

    cursor = segmentEnd;
  }

  return false;
};

const hasValidPngContainer = (bytes: Uint8Array): boolean => {
  if (!bytesStartWith(bytes, pngSignature)) {
    return false;
  }

  let cursor = pngSignature.length;
  let hasIHDR = false;
  let hasIDAT = false;
  let hasIEND = false;

  while (cursor < bytes.length) {
    const chunkLength = readUInt32BigEndian(bytes, cursor);

    if (chunkLength === null || cursor + 12 > bytes.length) {
      return false;
    }

    const chunkTypeOffset = cursor + 4;
    const chunkDataOffset = cursor + 8;
    const chunkDataEnd = chunkDataOffset + chunkLength;
    const crcOffset = chunkDataEnd;
    const nextCursor = crcOffset + 4;
    const storedCrc = readUInt32BigEndian(bytes, crcOffset);

    if (chunkDataEnd > bytes.length || nextCursor > bytes.length || storedCrc === null) {
      return false;
    }

    if (pngCrc32(bytes, chunkTypeOffset, chunkDataEnd) !== storedCrc) {
      return false;
    }

    if (asciiAt(bytes, chunkTypeOffset, "IHDR")) {
      if (hasIHDR || cursor !== pngSignature.length || chunkLength !== 13) {
        return false;
      }

      hasIHDR = true;
    } else if (asciiAt(bytes, chunkTypeOffset, "IDAT")) {
      if (!hasIHDR || hasIEND || chunkLength === 0) {
        return false;
      }

      hasIDAT = true;
    } else if (asciiAt(bytes, chunkTypeOffset, "IEND")) {
      if (!hasIHDR || !hasIDAT || chunkLength !== 0) {
        return false;
      }

      hasIEND = true;
      cursor = nextCursor;
      break;
    }

    cursor = nextCursor;
  }

  return hasIHDR && hasIDAT && hasIEND && cursor === bytes.length;
};

interface PngRasterDescriptor extends ImageDimensions {
  bitDepth: number;
  colorType: number;
  compressionMethod: number;
  filterMethod: number;
  interlaceMethod: number;
  idatChunks: Uint8Array[];
  totalIdatLength: number;
}

const readPngRasterDescriptor = (bytes: Uint8Array): PngRasterDescriptor | null => {
  if (!bytesStartWith(bytes, pngSignature)) {
    return null;
  }

  let cursor = pngSignature.length;
  let descriptor: Omit<PngRasterDescriptor, "idatChunks" | "totalIdatLength"> | null = null;
  const idatChunks: Uint8Array[] = [];
  let totalIdatLength = 0;

  while (cursor < bytes.length) {
    const chunkLength = readUInt32BigEndian(bytes, cursor);

    if (chunkLength === null || cursor + 12 > bytes.length) {
      return null;
    }

    const chunkTypeOffset = cursor + 4;
    const chunkDataOffset = cursor + 8;
    const chunkDataEnd = chunkDataOffset + chunkLength;
    const nextCursor = chunkDataEnd + 4;

    if (chunkDataEnd > bytes.length || nextCursor > bytes.length) {
      return null;
    }

    if (asciiAt(bytes, chunkTypeOffset, "IHDR")) {
      const width = readUInt32BigEndian(bytes, chunkDataOffset);
      const height = readUInt32BigEndian(bytes, chunkDataOffset + 4);
      const bitDepth = bytes[chunkDataOffset + 8];
      const colorType = bytes[chunkDataOffset + 9];
      const compressionMethod = bytes[chunkDataOffset + 10];
      const filterMethod = bytes[chunkDataOffset + 11];
      const interlaceMethod = bytes[chunkDataOffset + 12];

      if (
        width === null ||
        height === null ||
        bitDepth === undefined ||
        colorType === undefined ||
        compressionMethod === undefined ||
        filterMethod === undefined ||
        interlaceMethod === undefined
      ) {
        return null;
      }

      descriptor = {
        width,
        height,
        bitDepth,
        colorType,
        compressionMethod,
        filterMethod,
        interlaceMethod
      };
    } else if (asciiAt(bytes, chunkTypeOffset, "IDAT")) {
      idatChunks.push(bytes.slice(chunkDataOffset, chunkDataEnd));
      totalIdatLength += chunkLength;
    } else if (asciiAt(bytes, chunkTypeOffset, "IEND")) {
      break;
    }

    cursor = nextCursor;
  }

  return descriptor && totalIdatLength > 0
    ? {
        ...descriptor,
        idatChunks,
        totalIdatLength
      }
    : null;
};

const getPngBitsPerPixel = (bitDepth: number, colorType: number): number | null => {
  const supportedBitDepths = PNG_SUPPORTED_BIT_DEPTHS_BY_COLOR_TYPE[colorType];
  const samplesPerPixel = PNG_SAMPLES_PER_PIXEL_BY_COLOR_TYPE[colorType];

  if (!supportedBitDepths?.has(bitDepth) || samplesPerPixel === undefined) {
    return null;
  }

  return bitDepth * samplesPerPixel;
};

const getPngScanlineByteLength = (width: number, bitsPerPixel: number): number => Math.ceil((width * bitsPerPixel) / 8);

const countPngAdam7PassPixels = (totalPixels: number, start: number, step: number): number =>
  totalPixels <= start ? 0 : Math.floor((totalPixels - start + step - 1) / step);

const getPngExpectedDecodedByteLength = (descriptor: PngRasterDescriptor, bitsPerPixel: number): number | null => {
  if (descriptor.interlaceMethod === 0) {
    const rowBytes = getPngScanlineByteLength(descriptor.width, bitsPerPixel);
    return descriptor.height * (rowBytes + 1);
  }

  if (descriptor.interlaceMethod !== 1) {
    return null;
  }

  return PNG_ADAM7_PASSES.reduce((total, pass) => {
    const passWidth = countPngAdam7PassPixels(descriptor.width, pass.startX, pass.stepX);
    const passHeight = countPngAdam7PassPixels(descriptor.height, pass.startY, pass.stepY);

    if (passWidth === 0 || passHeight === 0) {
      return total;
    }

    return total + passHeight * (getPngScanlineByteLength(passWidth, bitsPerPixel) + 1);
  }, 0);
};

const hasValidPngRasterScanlines = (
  decodedRaster: Uint8Array,
  descriptor: PngRasterDescriptor,
  bitsPerPixel: number
): boolean => {
  let cursor = 0;

  const validateRows = (width: number, height: number): boolean => {
    const rowBytes = getPngScanlineByteLength(width, bitsPerPixel);

    for (let row = 0; row < height; row += 1) {
      if (cursor + 1 + rowBytes > decodedRaster.length) {
        return false;
      }

      const filterType = decodedRaster[cursor];

      if (filterType === undefined || filterType > 4) {
        return false;
      }

      cursor += 1 + rowBytes;
    }

    return true;
  };

  if (descriptor.interlaceMethod === 0) {
    return validateRows(descriptor.width, descriptor.height) && cursor === decodedRaster.length;
  }

  if (descriptor.interlaceMethod !== 1) {
    return false;
  }

  for (const pass of PNG_ADAM7_PASSES) {
    const passWidth = countPngAdam7PassPixels(descriptor.width, pass.startX, pass.stepX);
    const passHeight = countPngAdam7PassPixels(descriptor.height, pass.startY, pass.stepY);

    if (passWidth > 0 && passHeight > 0 && !validateRows(passWidth, passHeight)) {
      return false;
    }
  }

  return cursor === decodedRaster.length;
};

const hasDecodablePngRaster = (bytes: Uint8Array, dimensions: ImageDimensions): boolean => {
  const descriptor = readPngRasterDescriptor(bytes);

  if (!descriptor || descriptor.width !== dimensions.width || descriptor.height !== dimensions.height) {
    return false;
  }

  const bitsPerPixel = getPngBitsPerPixel(descriptor.bitDepth, descriptor.colorType);

  if (
    bitsPerPixel === null ||
    descriptor.compressionMethod !== 0 ||
    descriptor.filterMethod !== 0 ||
    (descriptor.interlaceMethod !== 0 && descriptor.interlaceMethod !== 1)
  ) {
    return false;
  }

  const expectedByteLength = getPngExpectedDecodedByteLength(descriptor, bitsPerPixel);

  if (expectedByteLength === null || expectedByteLength <= 0) {
    return false;
  }

  let decodedRaster: Uint8Array;

  try {
    decodedRaster = inflateSync(concatUint8Arrays(descriptor.idatChunks, descriptor.totalIdatLength), {
      maxOutputLength: expectedByteLength + 1
    });
  } catch {
    return false;
  }

  return decodedRaster.length === expectedByteLength && hasValidPngRasterScanlines(decodedRaster, descriptor, bitsPerPixel);
};

const hasValidWebpContainer = (bytes: Uint8Array): boolean => {
  if (!bytesStartWith(bytes, riffSignature) || !bytesStartWith(bytes, webpSignature, 8)) {
    return false;
  }

  const riffSize = readUInt32LittleEndian(bytes, 4);

  if (riffSize === null || riffSize + 8 !== bytes.length) {
    return false;
  }

  let cursor = 12;

  while (cursor < bytes.length) {
    const chunkSize = readUInt32LittleEndian(bytes, cursor + 4);

    if (chunkSize === null || cursor + 8 > bytes.length) {
      return false;
    }

    const chunkEnd = cursor + 8 + chunkSize;

    if (chunkEnd > bytes.length) {
      return false;
    }

    cursor = chunkEnd + (chunkSize % 2);
  }

  return cursor === bytes.length;
};

const hasMatchingDimensions = (a: ImageDimensions, b: ImageDimensions): boolean => a.width === b.width && a.height === b.height;

const hasDecodableWebpRaster = (bytes: Uint8Array, dimensions: ImageDimensions): boolean => {
  if (!hasValidWebpContainer(bytes)) {
    return false;
  }

  let cursor = 12;
  let canvasDimensions: ImageDimensions | null = null;
  let imageChunkDimensions: ImageDimensions | null = null;
  let imageChunkCount = 0;

  while (cursor < bytes.length) {
    const chunkSize = readUInt32LittleEndian(bytes, cursor + 4);

    if (chunkSize === null || cursor + 8 > bytes.length) {
      return false;
    }

    const dataOffset = cursor + 8;
    const chunkEnd = dataOffset + chunkSize;

    if (chunkEnd > bytes.length) {
      return false;
    }

    if (asciiAt(bytes, cursor, "VP8X")) {
      const featureFlags = bytes[dataOffset];
      const declaredCanvasDimensions = readWebpDimensionsFromChunk(bytes, cursor, chunkSize);

      if (
        featureFlags === undefined ||
        (featureFlags & 0x02) !== 0 ||
        canvasDimensions ||
        !declaredCanvasDimensions ||
        !hasMatchingDimensions(declaredCanvasDimensions, dimensions)
      ) {
        return false;
      }

      canvasDimensions = declaredCanvasDimensions;
    } else if (asciiAt(bytes, cursor, "VP8 ") || asciiAt(bytes, cursor, "VP8L")) {
      const declaredImageDimensions = readWebpDimensionsFromChunk(bytes, cursor, chunkSize);

      if (!declaredImageDimensions || !hasMatchingDimensions(declaredImageDimensions, dimensions)) {
        return false;
      }

      if (asciiAt(bytes, cursor, "VP8 ") && ((bytes[dataOffset] ?? 1) & 0x01) !== 0) {
        return false;
      }

      if (chunkSize <= (asciiAt(bytes, cursor, "VP8 ") ? 10 : 5)) {
        return false;
      }

      imageChunkCount += 1;
      imageChunkDimensions = declaredImageDimensions;
    } else if (asciiAt(bytes, cursor, "ANIM") || asciiAt(bytes, cursor, "ANMF")) {
      return false;
    }

    cursor = chunkEnd + (chunkSize % 2);
  }

  return imageChunkCount === 1 && !!imageChunkDimensions && (!canvasDimensions || hasMatchingDimensions(canvasDimensions, imageChunkDimensions));
};

export const hasValidImageContainer = (bytes: Uint8Array, contentType: SourcePhotoContentType): boolean => {
  switch (contentType) {
    case "image/jpeg":
      return hasValidJpegContainer(bytes);
    case "image/png":
      return hasValidPngContainer(bytes);
    case "image/webp":
      return hasValidWebpContainer(bytes);
    default:
      return false;
  }
};

export const hasDecodableImageRaster = (
  bytes: Uint8Array,
  contentType: SourcePhotoContentType,
  dimensions: ImageDimensions
): boolean => {
  switch (contentType) {
    case "image/png":
      return hasDecodablePngRaster(bytes, dimensions);
    case "image/jpeg":
      return hasDecodableJpegRaster(bytes, dimensions);
    case "image/webp":
      return hasDecodableWebpRaster(bytes, dimensions);
    default:
      return false;
  }
};

const sharpFormatByContentType: Record<SourcePhotoContentType, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp"
};

export const decodeImageRasterWithSharp: SourcePhotoPixelDecoder = async ({ bytes, contentType, dimensions }) => {
  try {
    const source = Buffer.from(bytes);
    const metadata = await sharp(source, {
      failOn: "error",
      limitInputPixels: MAX_SOURCE_PHOTO_PIXELS
    }).metadata();

    if (
      metadata.format !== sharpFormatByContentType[contentType] ||
      metadata.width !== dimensions.width ||
      metadata.height !== dimensions.height
    ) {
      return false;
    }

    const decoded = await sharp(source, {
      failOn: "error",
      limitInputPixels: MAX_SOURCE_PHOTO_PIXELS
    })
      .raw()
      .toBuffer({ resolveWithObject: true });

    return (
      decoded.info.width === dimensions.width &&
      decoded.info.height === dimensions.height &&
      decoded.info.channels > 0 &&
      decoded.data.byteLength >= dimensions.width * dimensions.height * decoded.info.channels
    );
  } catch {
    return false;
  }
};

export const hasFullyDecodableImageRaster = async (
  bytes: Uint8Array,
  contentType: SourcePhotoContentType,
  dimensions: ImageDimensions,
  pixelDecoder: SourcePhotoPixelDecoder = decodeImageRasterWithSharp
): Promise<boolean> => {
  if (!hasDecodableImageRaster(bytes, contentType, dimensions)) {
    return false;
  }

  try {
    return await pixelDecoder({ bytes, contentType, dimensions });
  } catch {
    return false;
  }
};

export const readImageDimensions = (bytes: Uint8Array, contentType: SourcePhotoContentType): ImageDimensions | null => {
  switch (contentType) {
    case "image/jpeg":
      return readJpegDimensions(bytes);
    case "image/png":
      return readPngDimensions(bytes);
    case "image/webp":
      return readWebpDimensions(bytes);
    default:
      return null;
  }
};

const hasSupportedDimensions = ({ width, height }: ImageDimensions): boolean =>
  width >= MIN_SOURCE_PHOTO_SIDE_PX &&
  height >= MIN_SOURCE_PHOTO_SIDE_PX &&
  width <= MAX_SOURCE_PHOTO_SIDE_PX &&
  height <= MAX_SOURCE_PHOTO_SIDE_PX &&
  width * height <= MAX_SOURCE_PHOTO_PIXELS;

const concatUint8Arrays = (parts: Uint8Array[], totalLength: number): Uint8Array => {
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
};

const hasExifPayload = (bytes: Uint8Array, payloadOffset: number): boolean => bytesStartWith(bytes, exifSignature, payloadOffset);

export const stripJpegApp1Metadata = (bytes: Uint8Array): { bytes: Uint8Array; removed: boolean } => {
  if (detectImageContentType(bytes) !== "image/jpeg") {
    return {
      bytes,
      removed: false
    };
  }

  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  let totalLength = 2;
  let cursor = 2;
  let removed = false;

  while (cursor < bytes.length) {
    if (bytes[cursor] !== 0xff || cursor + 1 >= bytes.length) {
      const rest = bytes.slice(cursor);
      parts.push(rest);
      totalLength += rest.length;
      break;
    }

    const marker = bytes[cursor + 1];

    if (marker === 0xda) {
      const rest = bytes.slice(cursor);
      parts.push(rest);
      totalLength += rest.length;
      break;
    }

    if (marker === 0xd9) {
      const end = bytes.slice(cursor, cursor + 2);
      parts.push(end);
      totalLength += end.length;
      cursor += 2;
      continue;
    }

    const segmentLength = readUInt16BigEndian(bytes, cursor + 2);

    if (!segmentLength || segmentLength < 2) {
      const rest = bytes.slice(cursor);
      parts.push(rest);
      totalLength += rest.length;
      break;
    }

    const segmentEnd = cursor + 2 + segmentLength;

    if (segmentEnd > bytes.length) {
      const rest = bytes.slice(cursor);
      parts.push(rest);
      totalLength += rest.length;
      break;
    }

    const isApp1 = marker === 0xe1;
    const payloadOffset = cursor + 4;

    if (isApp1 && hasExifPayload(bytes, payloadOffset)) {
      removed = true;
      cursor = segmentEnd;
      continue;
    }

    const segment = bytes.slice(cursor, segmentEnd);
    parts.push(segment);
    totalLength += segment.length;
    cursor = segmentEnd;
  }

  return {
    bytes: removed ? concatUint8Arrays(parts, totalLength) : bytes,
    removed
  };
};

export const validateSourcePhotoIntake = (input: SourcePhotoIntakeInput): PhotoIntakeResult => {
  const maxByteSize = input.maxByteSize ?? MAX_SOURCE_PHOTO_BYTES;

  if (input.bytes.length === 0) {
    return {
      ok: false,
      issue: "empty_file",
      messageSafe: "Choose a photo file that can be read."
    };
  }

  if (input.bytes.length > maxByteSize) {
    return {
      ok: false,
      issue: "too_large",
      messageSafe: "Choose an image under 10 MB with your pet clearly visible."
    };
  }

  if (!isSupportedContentType(input.declaredContentType)) {
    return {
      ok: false,
      issue: "unsupported_type",
      messageSafe: "Choose a JPEG, PNG, or WebP pet photo."
    };
  }

  const detectedContentType = detectImageContentType(input.bytes);

  if (!detectedContentType) {
    return {
      ok: false,
      issue: "corrupt_or_unreadable",
      messageSafe: "We could not read that photo. Try another image with your pet clearly visible."
    };
  }

  if (detectedContentType !== input.declaredContentType) {
    return {
      ok: false,
      issue: "content_type_mismatch",
      messageSafe: "Photo file type does not match its upload metadata."
    };
  }

  const dimensions = readImageDimensions(input.bytes, detectedContentType);

  if (!dimensions) {
    return {
      ok: false,
      issue: "corrupt_or_unreadable",
      messageSafe: "We could not read that photo. Try another image with your pet clearly visible."
    };
  }

  if (!hasValidImageContainer(input.bytes, detectedContentType)) {
    return {
      ok: false,
      issue: "corrupt_or_unreadable",
      messageSafe: "We could not read that photo. Try another image with your pet clearly visible."
    };
  }

  if (!hasSupportedDimensions(dimensions)) {
    return {
      ok: false,
      issue: "invalid_dimensions",
      messageSafe: "Choose a clear image between 128 and 4096 pixels per side."
    };
  }

  if (!hasDecodableImageRaster(input.bytes, detectedContentType, dimensions)) {
    return {
      ok: false,
      issue: "corrupt_or_unreadable",
      messageSafe: "We could not read that photo. Try another image with your pet clearly visible."
    };
  }

  const sanitized = detectedContentType === "image/jpeg" ? stripJpegApp1Metadata(input.bytes) : { bytes: input.bytes, removed: false };

  return {
    ok: true,
    contentType: detectedContentType,
    byteSize: input.bytes.length,
    width: dimensions.width,
    height: dimensions.height,
    providerSafeBytes: sanitized.bytes,
    metadataRemoved: sanitized.removed,
    warnings: sanitized.removed ? ["jpeg_app1_exif_removed"] : []
  };
};

export const validateSourcePhotoIntakeWithPixelDecode = async (
  input: SourcePhotoIntakeInput,
  options: SourcePhotoIntakePixelDecodeOptions = {}
): Promise<PhotoIntakeResult> => {
  const result = validateSourcePhotoIntake(input);

  if (!result.ok) {
    return result;
  }

  const fullyDecodable = await hasFullyDecodableImageRaster(
    result.providerSafeBytes,
    result.contentType,
    {
      width: result.width,
      height: result.height
    },
    options.pixelDecoder ?? decodeImageRasterWithSharp
  );

  if (!fullyDecodable) {
    return {
      ok: false,
      issue: "corrupt_or_unreadable",
      messageSafe: "We could not read that photo. Try another image with your pet clearly visible."
    };
  }

  return result;
};
