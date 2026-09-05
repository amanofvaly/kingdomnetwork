import fs from 'node:fs/promises';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { load } from 'cheerio';
import sharp from 'sharp';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Offering } from '../models/Offering.js';
import { Resource } from '../models/Resource.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { matchPage, resolveContent } from '../lib/og/content.js';
import { injectMetadata, metadataMiddleware, imageHandler } from '../lib/og/http.js';
import { renderCard, cachedCard } from '../lib/og/render.js';
import { isPublicAddress, fetchRemote, loadArtwork, artworkRevision } from '../lib/og/images.js';

vi.mock('../lib/visibility.js', () => ({ publicFilter: vi.fn(async () => ({ demo: { $ne: true } })) }));
const church = { slug: 'grace', name: 'Grace Church', city: 'Kampala', country: 'Uganda', donations: { enabled: true }, updatedAt: '2026-09-01' };
const item = { slug: 'ministry', title: 'Ministry foundations', subtitle: 'Study with us', churchSlug: 'grace', updatedAt: '2026-09-01' };
const query = (value) => ({ lean: async () => value });
const content = { type: 'churches', slug: 'grace', title: 'Grace Church', description: 'A community', subtitle: 'Kampala', path: '/churches/grace', version: 'abc' };
const response = () => {
  const res = { headers: {}, statusCode: 200 };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.type = (type) => { res.mime = type; return res; };
  res.send = (body) => { res.body = body; return res; };
  res.end = () => res;
  res.redirect = (code, url) => { res.statusCode = code; res.location = url; return res; };
  return res;
};

beforeEach(() => {
  vi.spyOn(Church, 'findOne').mockImplementation(() => query(church));
  for (const model of [Course, Offering, Resource]) vi.spyOn(model, 'findOne').mockImplementation(() => query(item));
});
afterEach(() => vi.restoreAllMocks());

describe('public preview resolution', () => {
  it.each(['churches', 'courses', 'listing', 'materials', 'give'])('resolves %s with publication and demo filters', async (type) => {
    const result = await resolveContent(type, type === 'churches' || type === 'give' ? 'grace' : 'ministry');
    expect(result.type).toBe(type);
    expect(result.version).toHaveLength(24);
    expect(Church.findOne.mock.calls[0][0]).toMatchObject({ status: 'published', demo: { $ne: true } });
    if (!['churches', 'give'].includes(type)) {
      const model = { courses: Course, listing: Offering, materials: Resource }[type];
      expect(model.findOne.mock.calls[0][0]).toMatchObject({ status: 'published', demo: { $ne: true } });
    }
  });
  it('does not expose a listing whose church is unavailable', async () => {
    Church.findOne.mockReturnValue(query(null));
    expect(await resolveContent('courses', 'ministry')).toBeNull();
  });
  it('does not expose missing listings or disabled giving', async () => {
    Course.findOne.mockReturnValue(query(null));
    Church.findOne.mockReturnValue(query({ ...church, donations: { enabled: false } }));
    expect(await resolveContent('courses', 'missing')).toBeNull();
    expect(await resolveContent('give', 'grace')).toBeNull();
  });
  it('changes the image version when church identity or listing content changes', async () => {
    const first = await resolveContent('courses', 'ministry');
    Church.findOne.mockReturnValue(query({ ...church, name: 'New name' }));
    expect((await resolveContent('courses', 'ministry')).version).not.toBe(first.version);
    Course.findOne.mockReturnValue(query({ ...item, title: 'New title' }));
    expect((await resolveContent('courses', 'ministry')).title).toBe('New title');
  });
  it('rejects unknown types and traversal without querying', async () => {
    expect(await resolveContent('constructor', 'grace')).toBeNull();
    expect(await resolveContent('churches', '../private')).toBeNull();
    expect(Church.findOne).not.toHaveBeenCalled();
    expect(matchPage('/give/grace/thanks')).toBeNull();
    expect(matchPage('/courses/ministry/')).toEqual({ type: 'courses', slug: 'ministry' });
  });
});

describe('metadata in initial HTML', () => {
  it('replaces generic tags once, escapes user content, and preserves SPA scripts', async () => {
    const html = await fs.readFile('client/index.html', 'utf8');
    const malicious = 'Church "><script>alert(1)</script> & friends';
    const $ = load(injectMetadata(html, { ...content, title: malicious }, content.path, 'https://example.org'));
    expect($('meta[property="og:title"]')).toHaveLength(1);
    expect($('meta[property="og:title"]').attr('content')).toBe(malicious);
    expect($('script')).toHaveLength(1);
    expect($('script').attr('src')).toBe('/src/main.jsx');
    expect($('meta[property="og:image"]').attr('content')).toBe('https://example.org/api/og/churches/grace.png?v=abc');
    expect($('link[rel="canonical"]').attr('href')).toBe('https://example.org/churches/grace');
    expect($('meta[name="twitter:card"]').attr('content')).toBe('summary_large_image');
  });
  it('returns generic 404 metadata for hidden pages', async () => {
    const res = response();
    await metadataMiddleware('client/index.html', async () => null)({ path: '/churches/grace' }, res, vi.fn());
    expect(res.statusCode).toBe(404);
    const $ = load(res.body);
    expect($('meta[name="robots"]').attr('content')).toBe('noindex');
    expect($('meta[property="og:title"]').attr('content')).toBe('Page unavailable');
    expect($('meta[property="og:image"]').attr('content')).toContain('/api/og/default.png');
  });
  it('redirects legacy resources and ignores unrelated/private routes', async () => {
    const res = response(); const next = vi.fn(); const resolve = vi.fn();
    const handler = metadataMiddleware('client/index.html', resolve);
    await handler({ path: '/resources/book' }, res, next);
    expect(res.location).toBe('/materials/book');
    expect(res.statusCode).toBe(301);
    await handler({ path: '/me/profile' }, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('images and caching', () => {
  it('reuses and deduplicates cached generation, replacing the entry on edits', async () => {
    const files = new Map();
    const store = { get: async (k) => files.get(k), put: async (k, v) => files.set(k, v) };
    const render = vi.fn(async (c) => Buffer.from(c.version));
    const results = await Promise.all([cachedCard(content, { store, render }), cachedCard(content, { store, render })]);
    expect(results[0].toString()).toBe('abc');
    expect(render).toHaveBeenCalledOnce();
    await cachedCard(content, { store, render });
    expect(render).toHaveBeenCalledOnce();
    await cachedCard({ ...content, version: 'def' }, { store, render });
    expect(render).toHaveBeenCalledTimes(2);
    expect(files.size).toBe(1);
  });
  it('checks visibility before cache or conditional 304 responses', async () => {
    const render = vi.fn(); const res = response();
    await imageHandler({ resolve: async () => null, render, fallback: async () => Buffer.from('fallback') })({ params: { type: 'churches', slug: 'grace' }, get: () => '"abc"' }, res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(render).not.toHaveBeenCalled();
    expect(res.body.toString()).toBe('fallback');
  });
  it('serves a conditional response and an uncached fallback on render errors', async () => {
    const render = vi.fn(async () => { throw new Error('broken image'); });
    const handler = imageHandler({ resolve: async () => content, render, fallback: async () => Buffer.from('fallback') });
    const res = response();
    await handler({ params: {}, get: () => '"abc"' }, res, vi.fn());
    expect(res.statusCode).toBe(304);
    expect(render).not.toHaveBeenCalled();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failed = response();
    await handler({ params: {}, get: () => null }, failed, vi.fn());
    expect(failed.headers['Cache-Control']).toBe('no-store');
    expect(failed.body.toString()).toBe('fallback');
  });
  it.each(['churches', 'courses', 'listing', 'materials', 'give'])('renders a valid %s PNG with long text and missing artwork', async (type) => {
    const png = await renderCard({ ...content, type, title: 'An exceptionally long church and ministry title '.repeat(8) }, async () => null);
    expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
    expect(png.length).toBeGreaterThan(10000);
  });
  it('keeps a three-line title and its location above the card footer', async () => {
    const title = 'An exceptionally long church and ministry title '.repeat(8);
    const nodes = [];
    await renderCard({ ...content, title, artwork: '/media/scenes/church-sanctuary.webp' }, undefined, (node) => nodes.push(node));
    const heading = nodes.find((node) => node.textContent === title);
    const location = nodes.find((node) => node.textContent === content.subtitle);
    expect(heading.height).toBeLessThanOrEqual(148);
    expect(location.top).toBeGreaterThanOrEqual(heading.top + heading.height);
    expect(location.top + location.height).toBeLessThan(550);
  });
  it('revalidates redirect destinations before opening another socket', async () => {
    const { default: https } = await import('node:https');
    const { EventEmitter } = await import('node:events');
    const get = vi.spyOn(https, 'get').mockImplementation((_url, _options, callback) => {
      const request = new EventEmitter();
      queueMicrotask(() => callback({ statusCode: 302, headers: { location: 'https://127.0.0.1/private' }, resume() {} }));
      return request;
    });
    await expect(fetchRemote('https://8.8.8.8/image.png')).rejects.toThrow('Non-public');
    expect(get).toHaveBeenCalledOnce();
  });
  it('loads local artwork and refuses private stored images', async () => {
    expect(await loadArtwork('/media/scenes/church-sanctuary.webp')).toMatch(/^data:image\/png;base64,/);
    vi.spyOn(MediaAsset, 'findOne').mockReturnValue(query(null));
    expect(await loadArtwork('/api/media/file/private/secret.png')).toBeNull();
    expect(MediaAsset.findOne).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public', kind: 'image' }), expect.any(String));
    expect(await artworkRevision('/api/media/file/private/secret.png')).toBe('missing');
    expect(await loadArtwork('/media/../../.env')).toBeNull();
  });
  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '0.0.0.0'])('blocks non-public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it('accepts public addresses and rejects unsupported remote URL forms', async () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    await expect(fetchRemote('http://example.org/image.png')).rejects.toThrow('Unsupported');
    await expect(fetchRemote('https://user:pass@example.org/image.png')).rejects.toThrow('Unsupported');
    await expect(fetchRemote('https://example.org:444/image.png')).rejects.toThrow('Unsupported');
  });
});

describe('HTTP route integration', () => {
  it('serves previews to anonymous crawlers and normal browsers through Express', async () => {
    const { default: express } = await import('express');
    const app = express();
    const router = express.Router();
    const resolve = async (type, slug) => slug === 'grace' ? { ...content, type } : null;
    const png = await renderCard(content, async () => null);
    router.get('/default.png', imageHandler({ fallback: async () => png }));
    router.get('/:type/:slug.png', imageHandler({ resolve, render: async () => png, fallback: async () => png }));
    app.use('/api/og', router);
    app.use(metadataMiddleware('client/index.html', resolve));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const agent of ['facebookexternalhit/1.1', 'Mozilla/5.0']) {
        const response = await fetch(`${base}/churches/grace`, { headers: { 'User-Agent': agent } });
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('Grace Church');
      }
      const image = await fetch(`${base}/api/og/churches/grace.png?v=abc`);
      expect(image.headers.get('content-type')).toContain('image/png');
      expect(image.headers.get('etag')).toBe('"abc"');
      expect(await sharp(Buffer.from(await image.arrayBuffer())).metadata()).toMatchObject({ width: 1200, height: 630 });
      const hidden = await fetch(`${base}/api/og/churches/hidden.png?v=abc`, { headers: { 'If-None-Match': '"abc"' } });
      expect(hidden.status).toBe(404);
      expect((await fetch(`${base}/api/og/default.png`)).status).toBe(200);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
});
