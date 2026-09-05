import fs from 'node:fs/promises';
import { load } from 'cheerio';
import { env } from '../../config/env.js';
import { matchPage, resolveContent } from './content.js';
import { cachedCard, fallbackCard } from './render.js';

export function injectMetadata(html, content, pathname, base = env.publicBaseUrl) {
  const $ = load(html);
  $('title, meta[name="description"], meta[property^="og:"], meta[property^="twitter:"], meta[name^="twitter:"], link[rel="canonical"]').remove();
  const title = content ? `${content.title} | Kingdom Network` : 'Page unavailable | Kingdom Network';
  const description = content?.description || 'This page is not available.';
  const canonical = new URL(content?.path || pathname, base).href;
  const image = new URL(content ? `/api/og/${content.type}/${content.slug}.png?v=${content.version}` : '/api/og/default.png', base).href;
  $('head').append($('<title>').text(title));
  const add = (key, value, attr = 'property') => $('head').append($('<meta>').attr(attr, key).attr('content', value));
  add('description', description, 'name');
  $('head').append($('<link>').attr('rel', 'canonical').attr('href', canonical));
  for (const [key, value] of Object.entries({
    'og:title': content?.title || 'Page unavailable', 'og:description': description,
    'og:type': 'website', 'og:url': canonical, 'og:site_name': 'Kingdom Network',
    'og:image': image, 'og:image:width': '1200', 'og:image:height': '630',
    'og:image:type': 'image/png', 'og:image:alt': content ? `${content.title} — ${content.subtitle || 'Kingdom Network'}` : 'Kingdom Network',
  })) add(key, value);
  for (const [key, value] of Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': content?.title || 'Page unavailable', 'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': content?.title || 'Kingdom Network' })) add(key, value, 'name');
  if (!content) add('robots', 'noindex', 'name');
  return $.html();
}

export function metadataMiddleware(indexPath, resolve = resolveContent) {
  return async (req, res, next) => {
    const legacy = /^\/resources\/([a-z0-9][a-z0-9-]{0,199})\/?$/.exec(req.path);
    if (legacy) return res.redirect(301, `/materials/${legacy[1]}`);
    const page = matchPage(req.path);
    if (!page) return next();
    let content;
    try { content = await resolve(page.type, page.slug); }
    catch (error) {
      console.warn('[og] Metadata lookup failed:', error.message);
      // Continue to the normal SPA rather than taking down navigation.
      return next();
    }
    try {
      const html = await fs.readFile(indexPath, 'utf8');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(content ? 200 : 404).type('html').send(injectMetadata(html, content, req.path));
    } catch (error) { next(error); }
  };
}

export function imageHandler({ resolve = resolveContent, render = cachedCard, fallback = fallbackCard } = {}) {
  return async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    try {
      if (req.path === '/default.png') return res.type('png').send(await fallback());
      const content = await resolve(req.params.type, req.params.slug);
      // Always resolve visibility before touching the render cache, even on 304.
      if (!content) return res.status(404).type('png').send(await fallback());
      const etag = `"${content.version}"`;
      if (req.get('If-None-Match') === etag) return res.status(304).end();
      let image;
      try { image = await render(content); }
      catch (error) {
        console.warn('[og] Rendering failed:', error.message);
        res.setHeader('Cache-Control', 'no-store');
        return res.type('png').send(await fallback());
      }
      res.setHeader('ETag', etag);
      return res.type('png').send(image);
    } catch (error) { next(error); }
  };
}
