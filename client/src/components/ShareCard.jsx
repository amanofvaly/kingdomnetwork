import { useRef, useState } from 'react';
import { Check, Download, Link2 } from 'lucide-react';

import { QrCode, qrPath } from './QrCode.jsx';
import { CHURCH_PLACEHOLDER } from './ui.jsx';
import { useToast } from '../lib/toast.jsx';

const FALLBACK_COVER = '/media/church-registration-cross.jpg';

/** Absolute, because the point of the thing is that it leaves this browser. */
export const shareUrl = (path) => `${window.location.origin}${path}`;

const load = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** Cover the box, the way object-fit: cover would. */
const drawCover = (ctx, img, x, y, w, h) => {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

const roundedClip = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
};

/**
 * The image a church actually sends people: its own banner, its name, and the
 * code that lands on the page.
 *
 * Drawn to a canvas rather than screenshotted from the DOM, so it comes out at
 * print resolution and does not depend on a rendering library. A cover hosted
 * somewhere that refuses cross-origin reads will taint the canvas — the export
 * is caught and reported rather than silently producing a blank file.
 */
const CARD_W = 1080;
const CARD_H = 1350;

const paint = async ({ canvas, church, url, caption }) => {
  const ctx = canvas.getContext('2d');
  canvas.width = CARD_W;
  canvas.height = CARD_H;

  if (document.fonts?.ready) await document.fonts.ready;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // --- banner ---
  const cover = await load(church.coverImage || FALLBACK_COVER) ?? await load(FALLBACK_COVER);
  const bannerH = 620;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CARD_W, bannerH);
  ctx.clip();
  if (cover) drawCover(ctx, cover, 0, 0, CARD_W, bannerH);
  else { ctx.fillStyle = '#24204a'; ctx.fillRect(0, 0, CARD_W, bannerH); }
  const veil = ctx.createLinearGradient(0, bannerH * 0.35, 0, bannerH);
  veil.addColorStop(0, 'rgba(17,14,40,0)');
  veil.addColorStop(1, 'rgba(17,14,40,0.72)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, CARD_W, bannerH);
  ctx.restore();

  // --- mark, sitting across the banner edge ---
  const logo = await load(church.logoImage || CHURCH_PLACEHOLDER) ?? await load(CHURCH_PLACEHOLDER);
  const markSize = 168;
  const markX = 72;
  const markY = bannerH - markSize / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(17,14,40,0.22)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(markX, markY, markSize, markSize, 26);
  ctx.fill();
  ctx.restore();
  if (logo) {
    ctx.save();
    roundedClip(ctx, markX + 8, markY + 8, markSize - 16, markSize - 16, 20);
    drawCover(ctx, logo, markX + 8, markY + 8, markSize - 16, markSize - 16);
    ctx.restore();
  }

  // --- name and place ---
  let y = markY + markSize + 76;
  ctx.fillStyle = '#211e3b';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 62px "Geist Variable", Geist, system-ui, sans-serif';

  const words = (church.name ?? 'Church').split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > CARD_W - 144 && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  for (const l of lines.slice(0, 2)) { ctx.fillText(l, 72, y); y += 74; }

  const place = [church.city, church.country].filter(Boolean).join(', ');
  if (place) {
    ctx.fillStyle = '#57546c';
    ctx.font = '400 32px "Geist Variable", Geist, system-ui, sans-serif';
    ctx.fillText(place, 72, y);
    y += 26;
  }

  // --- the code and what it does ---
  const qrSize = 300;
  const qrX = CARD_W - 72 - qrSize;
  const qrY = CARD_H - 72 - qrSize;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX, qrY, qrSize, qrSize);
  const { d, extent } = qrPath(url, 4);
  const unit = qrSize / extent;
  ctx.save();
  ctx.translate(qrX, qrY);
  ctx.scale(unit, unit);
  ctx.fillStyle = '#211e3b';
  ctx.fill(new Path2D(d));
  ctx.restore();

  ctx.fillStyle = '#211e3b';
  ctx.font = '600 40px "Geist Variable", Geist, system-ui, sans-serif';
  ctx.fillText(caption, 72, qrY + 92);
  ctx.fillStyle = '#57546c';
  ctx.font = '400 28px "Geist Variable", Geist, system-ui, sans-serif';
  ctx.fillText(url.replace(/^https?:\/\//, ''), 72, qrY + 140);

  ctx.fillStyle = '#77738a';
  ctx.font = '500 24px "Geist Variable", Geist, system-ui, sans-serif';
  ctx.fillText('Kingdom Network', 72, CARD_H - 72);
};

export const ShareCard = ({ church, path, caption = 'Scan to open', fileName = 'share' }) => {
  const url = shareUrl(path);
  const canvas = useRef(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ok, fail } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      fail({ message: 'Could not copy the link. Select it and copy it by hand.' });
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      await paint({ canvas: canvas.current, church, url, caption });
      const href = canvas.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = href;
      a.download = `${church.slug ?? 'church'}-${fileName}.png`;
      a.click();
      ok('Image downloaded');
    } catch {
      fail({ message: 'The banner could not be read for download. The link and code above still work.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="share-card">
      <figure className="share-card-preview">
        <img
          src={church.coverImage || FALLBACK_COVER}
          alt=""
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_COVER; }}
        />
        <figcaption>
          <span className="share-card-name">{church.shortName ?? church.name}</span>
          <span className="share-card-place">{[church.city, church.country].filter(Boolean).join(', ')}</span>
        </figcaption>
      </figure>

      <div className="share-card-body">
        <QrCode value={url} size={148} label={`QR code linking to ${url}`} />
        <div className="share-card-detail">
          <p className="small muted">{caption} — point a phone camera at the code, or send the link.</p>
          <code className="share-card-url">{url.replace(/^https?:\/\//, '')}</code>
          <div className="share-card-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={copy}>
              {copied ? <><Check size={14} /> Copied</> : <><Link2 size={14} /> Copy link</>}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={download} disabled={busy}>
              <Download size={14} /> {busy ? 'Preparing…' : 'Download image'}
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvas} hidden />
    </div>
  );
};
