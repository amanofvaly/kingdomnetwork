import crypto from 'node:crypto';
import path from 'node:path';

import { storage } from './storage/index.js';

/**
 * Accepting files from churches and applicants is the largest new attack
 * surface in the platform. Rules, in order of how much they matter:
 *
 *  1. The kind of file is decided by sniffing its bytes, never by trusting the
 *     browser's Content-Type or the extension on the name.
 *  2. Only formats on this list are stored at all.
 *  3. The stored name is generated here. The client's filename is kept as a
 *     label and never touches the filesystem.
 */

const SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg', kind: 'image', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', kind: 'image', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/gif', ext: 'gif', kind: 'image', test: (b) => b.subarray(0, 6).toString('latin1').startsWith('GIF8') },
  { mime: 'image/webp', ext: 'webp', kind: 'image', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', kind: 'document', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'audio/mpeg', ext: 'mp3', kind: 'audio', test: (b) => b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { mime: 'audio/mp4', ext: 'm4a', kind: 'audio', test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' && b.subarray(8, 11).toString('latin1') === 'M4A' },
  { mime: 'video/mp4', ext: 'mp4', kind: 'video', test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' && b.subarray(8, 11).toString('latin1') !== 'M4A' },
  { mime: 'audio/ogg', ext: 'ogg', kind: 'audio', test: (b) => b.subarray(0, 4).toString('latin1') === 'OggS' },
  { mime: 'video/webm', ext: 'webm', kind: 'video', test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
];

export const MAX_BYTES = {
  image: 8 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  audio: 120 * 1024 * 1024,
  video: 500 * 1024 * 1024,
};

export const identify = (buffer) => {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((s) => {
    try {
      return s.test(buffer);
    } catch {
      return false;
    }
  }) ?? null;
};

/** SVG is deliberately absent: it is a script container, not an image. */
export const describeAccepted = () => 'JPEG, PNG, GIF, WebP, PDF, MP3, M4A, OGG, MP4 or WebM';

export const sanitiseName = (name) =>
  path
    .basename(String(name ?? 'file'))
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'file';

/**
 * Reads a request body straight into memory with a hard ceiling, so a client
 * cannot stream an unbounded upload at us. Larger media would want a streaming
 * multipart parser; nothing the platform accepts today is close to the cap.
 */
export const readBody = (req, limitBytes) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(Object.assign(new Error('That file is larger than the limit for its type.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

/**
 * The pixel dimensions of an image, read from its header. Only enough parsing
 * to fill in width and height for the media library — an unreadable header is
 * not an error, it just means the record carries no dimensions.
 */
export const imageSize = (buffer, mime) => {
  try {
    if (mime === 'image/png') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (mime === 'image/gif') {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (mime === 'image/webp' && buffer.subarray(12, 16).toString('latin1') === 'VP8X') {
      return {
        width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
        height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
      };
    }
    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        // SOF0..SOF15, excluding the four markers in that range that are not
        // start-of-frame, all carry height then width at the same offset.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    // A truncated or unusual header is not worth failing an upload over.
  }
  return {};
};

export const storeUpload = async ({ buffer, filename, churchSlug, folder = 'general' }) => {
  const signature = identify(buffer);
  if (!signature) {
    throw Object.assign(new Error(`That file type is not accepted. Upload ${describeAccepted()}.`), { status: 415 });
  }

  const limit = MAX_BYTES[signature.kind];
  if (buffer.length > limit) {
    throw Object.assign(
      new Error(`${signature.kind} files must be under ${Math.round(limit / 1024 / 1024)}MB.`),
      { status: 413 },
    );
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const key = `${churchSlug ?? 'platform'}/${folder}/${checksum.slice(0, 24)}.${signature.ext}`;

  await storage.ensureReady();
  await storage.put(key, buffer);

  return {
    key,
    checksum,
    kind: signature.kind,
    mimeType: signature.mime,
    bytes: buffer.length,
    filename: sanitiseName(filename),
    ...(signature.kind === 'image' ? imageSize(buffer, signature.mime) : {}),
  };
};
