import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';
import { loadArtwork } from './images.js';
import { storage } from '../storage/index.js';

const require = createRequire(import.meta.url);
let fontsPromise;
const subsets = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'vietnamese'];
const fontFamily = subsets.map((subset) => `Geist-${subset}`).join(', ');
const fonts = () => fontsPromise ??= Promise.all(subsets.flatMap((subset) => [400, 600].map(async (weight) => ({
  name: `Geist-${subset}`, weight, style: 'normal',
  data: await fs.readFile(require.resolve(`@fontsource/geist/files/geist-${subset}-${weight}-normal.woff`)),
}))));
const node = (type, style, children, props = {}) => ({ type, props: { style, children, ...props } });
const text = (value, style = {}) => node('div', { display: 'block', ...style }, value);
const img = (src, style) => node('img', style, undefined, { src });
const ink = '#211e3b';
const blue = '#073fbd';

export async function renderCard(content, load = loadArtwork, onNodeDetected) {
  const [artwork, logo, fontData] = await Promise.all([load(content.artwork), load(content.logo), fonts()]);
  const isChurch = ['churches', 'give'].includes(content.type);
  const cover = artwork ? img(artwork, {
    position: 'absolute', left: 0, top: 0,
    width: isChurch ? 1200 : 440, height: isChurch ? 280 : 630,
    objectFit: content.type === 'materials' ? 'contain' : 'cover',
    padding: content.type === 'materials' ? 40 : 0,
    backgroundColor: '#f5f2ff',
  }) : null;
  const left = !isChurch && artwork ? 484 : 56;
  const width = 1200 - left - 56;
  const titleSize = content.title.length > 100 ? 44 : content.title.length > 65 ? 50 : 58;
  const title = text(content.title, {
    fontSize: titleSize, fontWeight: 600, lineHeight: 1.12, letterSpacing: '-1.5px',
    width, lineClamp: 3, overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word',
  });
  const identity = node('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
    ...(logo ? [img(logo, { width: 64, height: 64, objectFit: 'contain', borderRadius: 10, backgroundColor: '#fff' })] : []),
    text(content.subtitle || content.label || 'Kingdom Network', { fontSize: 24, color: '#57546c', lineClamp: 2, overflow: 'hidden', flex: 1 }),
  ]);
  const children = [
    ...(cover ? [cover] : []),
    ...(isChurch && artwork ? [node('div', {
      position: 'absolute', left: 56, top: 218, width: 100, height: 100,
      padding: 6, backgroundColor: '#fff', borderRadius: 16, display: 'flex',
    }, [logo ? img(logo, { width: 88, height: 88, objectFit: 'contain', borderRadius: 10 }) : text(content.title.slice(0, 1), { fontSize: 60, color: blue, margin: 'auto' })])] : []),
    node('div', {
      position: 'absolute', left, top: isChurch && artwork ? 340 : 76,
      width, display: 'flex', flexDirection: 'column', gap: 24,
    }, [title, isChurch && artwork ? text(content.subtitle, { fontSize: 24, color: '#57546c', lineClamp: 1, overflow: 'hidden' }) : identity]),
    node('div', { position: 'absolute', left, right: 56, bottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e6e1f0', paddingTop: 20 }, [
      text('Kingdom Network', { fontSize: 21, fontWeight: 600, color: blue }),
      text(content.label || '', { fontSize: 18, color: '#57546c', textTransform: 'capitalize' }),
    ]),
  ];
  const svg = await satori(node('div', { width: 1200, height: 630, position: 'relative', display: 'flex', backgroundColor: '#fff', fontFamily, color: ink }, children), { width: 1200, height: 630, fonts: fontData, onNodeDetected });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const inFlight = new Map();
export async function cachedCard(content, { store = storage, render = renderCard } = {}) {
  // One replaceable cache entry per page bounds storage across repeated edits.
  const key = `og/${content.type}/${content.slug}.json`;
  const flightKey = `${key}:${content.version}`;
  if (inFlight.has(flightKey)) return inFlight.get(flightKey);
  const work = (async () => {
    try {
      const cached = JSON.parse((await store.get(key)).toString());
      if (cached.version === content.version && Date.now() - cached.createdAt < 6 * 60 * 60 * 1000) return Buffer.from(cached.image, 'base64');
    } catch { /* A missing or interrupted cache entry is regenerated. */ }
    const image = await render(content);
    try { await store.put(key, Buffer.from(JSON.stringify({ version: content.version, createdAt: Date.now(), image: image.toString('base64') }))); }
    catch (error) { console.warn('[og] Cache write failed:', error.message); }
    return image;
  })();
  inFlight.set(flightKey, work);
  try { return await work; } finally { inFlight.delete(flightKey); }
}

let fallback;
export const fallbackCard = () => fallback ??= renderCard({ type: 'fallback', title: 'Kingdom Network', subtitle: 'Church-issued courses and credentials', label: '' }).catch((error) => { fallback = undefined; throw error; });
