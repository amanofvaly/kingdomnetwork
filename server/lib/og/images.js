import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import sharp from 'sharp';
import { env } from '../../config/env.js';
import { MediaAsset } from '../../models/MediaAsset.js';
import { storage } from '../storage/index.js';

const publicRoot = path.resolve(fileURLToPath(new URL('../../../client/public/', import.meta.url)));
const MAX_BYTES = 8 * 1024 * 1024;
export const isPublicAddress = (address) => {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
};
function localPath(src) {
  const url = new URL(src, env.publicBaseUrl);
  if (url.origin !== new URL(env.publicBaseUrl).origin) return null;
  return decodeURIComponent(url.pathname);
}
async function localAsset(src) {
  const pathname = localPath(src);
  if (!pathname) return null;
  if (pathname.startsWith('/api/media/file/')) {
    const asset = await MediaAsset.findOne({ storageKey: pathname.slice(16), visibility: 'public', kind: 'image' }, 'storageKey checksum updatedAt bytes').lean();
    return asset ? { asset } : { missing: true };
  }
  if (!pathname.startsWith('/media/')) return { missing: true };
  const filename = path.resolve(publicRoot, `.${pathname}`);
  if (!filename.startsWith(publicRoot + path.sep)) return { missing: true };
  // Realpath also prevents a public-directory symlink from escaping the root.
  const real = await fs.realpath(filename);
  if (!real.startsWith(publicRoot + path.sep)) return { missing: true };
  const stat = await fs.stat(real);
  return { filename: real, stat };
}
export async function artworkRevision(src) {
  if (!src) return null;
  try {
    const local = await localAsset(src);
    if (!local) return src;
    if (local.asset) return [local.asset.checksum, local.asset.updatedAt];
    return local.stat ? [local.stat.size, local.stat.mtimeMs] : 'missing';
  } catch { return 'missing'; }
}

// DNS is resolved and checked at every redirect; the socket uses that exact
// address, so a second DNS response cannot redirect a request into the LAN.
export async function fetchRemote(src, signal = AbortSignal.timeout(5000), redirects = 0) {
  const url = new URL(src);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || redirects > 3) throw new Error('Unsupported image URL');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await Promise.race([
    lookup(hostname, { all: true }),
    new Promise((_, reject) => {
      if (signal.aborted) reject(new Error('Image timeout'));
      else signal.addEventListener('abort', () => reject(new Error('Image timeout')), { once: true });
    }),
  ]);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('Non-public image host');
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      signal,
      lookup: (_host, options, callback) => options.all ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, addresses[0].family),
      headers: { Accept: 'image/*' },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(fetchRemote(new URL(res.headers.location, url).href, signal, redirects + 1));
        return;
      }
      if (res.statusCode !== 200 || !res.headers['content-type']?.startsWith('image/') || Number(res.headers['content-length']) > MAX_BYTES) {
        res.destroy(); reject(new Error('Invalid image response')); return;
      }
      const chunks = []; let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) res.destroy(new Error('Image too large'));
        else chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

export async function loadArtwork(src) {
  if (!src) return null;
  try {
    const local = await localAsset(src);
    let buffer;
    if (!local) buffer = await fetchRemote(src);
    else if (local.asset && local.asset.bytes <= MAX_BYTES) buffer = await storage.get(local.asset.storageKey);
    else if (local.filename && local.stat.size <= MAX_BYTES) buffer = await fs.readFile(local.filename);
    else return null;
    if (buffer.length > MAX_BYTES) return null;
    const image = await sharp(buffer, { limitInputPixels: 25_000_000 }).rotate().resize(1200, 630, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${image.toString('base64')}`;
  } catch { return null; }
}
