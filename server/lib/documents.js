import PDFDocument from 'pdfkit';

/**
 * Renders the documents a church may issue after its requirements and decision. These are the record — the thing the
 * buyer downloads, prints and shows to someone — so they are laid out as
 * documents rather than as receipts.
 *
 * Every renderer takes `{ preview }`. A preview is the same document with the
 * holder's name in place and a watermark across it, which is what we show
 * before payment.
 */

const INK = '#14171a';
const MUTED = '#4c535c';
const RULE = '#c9c2b4';
const GOLD = '#8a6a1f';
const GREEN = '#0c3b2e';

const stamp = (doc, text) => {
  doc.save();
  doc.rotate(-32, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc
    .fontSize(64)
    .fillColor('#000000')
    .opacity(0.07)
    .font('Helvetica-Bold')
    .text(text, 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center' });
  doc.opacity(1).restore();
};

const finish = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

const longDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** A certificate, ordination, licence or affiliation. Landscape, ruled border. */
export const renderCertificate = async ({ credential, church, offering, preview = false }) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const W = doc.page.width;
  const H = doc.page.height;
  const pad = 34;

  doc.rect(0, 0, W, H).fill('#fffdf8');
  doc.lineWidth(2.5).strokeColor(GREEN).rect(pad, pad, W - pad * 2, H - pad * 2).stroke();
  doc.lineWidth(0.75).strokeColor(GOLD).rect(pad + 8, pad + 8, W - (pad + 8) * 2, H - (pad + 8) * 2).stroke();

  const cx = W / 2;
  let y = 92;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(GOLD)
    .text((church?.name ?? 'Issuing Church').toUpperCase(), pad, y, { width: W - pad * 2, align: 'center', characterSpacing: 2.4 });

  y += 22;
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text([church?.city, church?.country].filter(Boolean).join(', '), pad, y, { width: W - pad * 2, align: 'center', characterSpacing: 1 });

  y += 34;
  doc.moveTo(cx - 42, y).lineTo(cx + 42, y).lineWidth(1).strokeColor(RULE).stroke();

  y += 26;
  doc.font('Helvetica').fontSize(11).fillColor(MUTED)
    .text(credential.kind === 'ordination' ? 'Certificate of Ordination' : (offering?.award?.documentTitle ?? 'Certificate'),
      pad, y, { width: W - pad * 2, align: 'center', characterSpacing: 0.6 });

  y += 34;
  doc.font('Helvetica-Bold').fontSize(30).fillColor(INK)
    .text(credential.title, pad + 40, y, { width: W - (pad + 40) * 2, align: 'center' });

  y = doc.y + 26;
  doc.font('Helvetica').fontSize(10.5).fillColor(MUTED)
    .text('This is to certify that', pad, y, { width: W - pad * 2, align: 'center' });

  y = doc.y + 12;
  doc.font('Helvetica-BoldOblique').fontSize(34).fillColor(GREEN)
    .text(credential.holderName ?? '', pad + 40, y, { width: W - (pad + 40) * 2, align: 'center' });

  y = doc.y + 8;
  doc.moveTo(cx - 130, y).lineTo(cx + 130, y).lineWidth(0.75).strokeColor(RULE).stroke();

  y += 20;
  const body =
    offering?.award?.documentBody ??
    `has satisfied the requirements set by ${church?.name ?? 'the issuing church'} and is granted this credential in good standing as of ${longDate(credential.issuedAt ?? Date.now())}.`;
  doc.font('Helvetica').fontSize(10.5).fillColor(MUTED)
    .text(body, pad + 90, y, { width: W - (pad + 90) * 2, align: 'center', lineGap: 3.5 });

  // An embossed seal fills the space between the citation and the signatures,
  // which is where a printed certificate would carry one.
  const sealY = H - pad - 150;
  const r = 34;
  doc.save();
  doc.lineWidth(1.2).strokeColor(GOLD).circle(cx, sealY, r).stroke();
  doc.lineWidth(0.5).strokeColor(GOLD).circle(cx, sealY, r - 5).stroke();
  doc.font('Helvetica-Bold').fontSize(13).fillColor(GOLD)
    .text(church?.monogram ?? 'KN', cx - r, sealY - 7, { width: r * 2, align: 'center', characterSpacing: 1 });
  doc.font('Helvetica').fontSize(5.2).fillColor(GOLD)
    .text('ISSUED UNDER SEAL', cx - r, sealY + 11, { width: r * 2, align: 'center', characterSpacing: 0.7 });
  doc.restore();

  // Footer: signature on the left, credential number on the right.
  const fy = H - pad - 74;
  const leader = church?.leaders?.[0];
  doc.moveTo(pad + 70, fy).lineTo(pad + 260, fy).lineWidth(0.75).strokeColor(INK).stroke();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(leader?.name ?? 'Authorised signatory', pad + 70, fy + 7, { width: 190 });
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(leader?.title ?? 'For the issuing church', pad + 70, fy + 19, { width: 190 });

  doc.moveTo(W - pad - 260, fy).lineTo(W - pad - 70, fy).lineWidth(0.75).strokeColor(INK).stroke();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(credential.credentialId, W - pad - 260, fy + 7, { width: 190, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(`Issued ${longDate(credential.issuedAt ?? Date.now())}`, W - pad - 260, fy + 19, { width: 190, align: 'right' });

  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    .text(`Verify at kingdom.network/verify/${credential.verifyCode ?? ''}`, pad, H - pad - 24, { width: W - pad * 2, align: 'center', characterSpacing: 0.6 });

  if (preview) stamp(doc, 'PREVIEW');
  return finish(doc);
};

/** An invitation letter, on the host church's letterhead. Portrait, correspondence layout. */
export const renderInvitationLetter = async ({ credential, church, offering, preview = false }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 62;

  doc.rect(0, 0, W, H).fill('#ffffff');
  doc.rect(0, 0, W, 6).fill(GREEN);

  let y = 58;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(GREEN).text(church?.name ?? 'Host Church', M, y, { width: W - M * 2 });
  y = doc.y + 3;
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text([church?.city, church?.country, church?.website].filter(Boolean).join('  ·  '), M, y, { width: W - M * 2 });

  y = doc.y + 16;
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.75).strokeColor(RULE).stroke();

  y += 26;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(longDate(credential.issuedAt ?? Date.now()), M, y);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(`Ref. ${credential.credentialId}`, M, y, { width: W - M * 2, align: 'right' });

  y = doc.y + 26;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('To Whom It May Concern', M, y);

  y = doc.y + 6;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(`Subject: Invitation to ${offering?.letter?.purpose ?? 'ministry engagement'}${offering?.letter?.destinationCity ? `, ${offering.letter.destinationCity}` : ''}`, M, y, { width: W - M * 2 });

  y = doc.y + 22;
  const p = (text, opts = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(opts.bold ? INK : MUTED)
      .text(text, M, y, { width: W - M * 2, align: 'left', lineGap: 4.5 });
    y = doc.y + 13;
  };

  p(`We write to invite ${credential.holderName ?? ''} to ${offering?.letter?.destinationCity ?? 'our location'} to take part in ${offering?.letter?.purpose ?? 'ministry engagements'} hosted by this ministry.`);

  if (credential.notes) p(credential.notes);

  p(offering?.letter?.hostCommitment ?? 'This ministry acts as the receiving host for the visit and will make arrangements for the visitor throughout their stay.');

  p(`This invitation is valid for ${offering?.letter?.validityMonths ?? 6} months from the date above. Any questions about it may be directed to this ministry using the contact details on this letterhead.`);

  p('Yours faithfully,');

  y += 34;
  const leader = church?.leaders?.[0];
  doc.moveTo(M, y).lineTo(M + 200, y).lineWidth(0.75).strokeColor(INK).stroke();
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(leader?.name ?? 'Authorised signatory', M, y + 8, { width: 230 });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(leader?.title ?? 'For the host church', M, y + 21, { width: 230 });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(church?.name ?? '', M, y + 33, { width: 230 });

  // Footer band with verification.
  doc.rect(0, H - 56, W, 56).fill('#faf8f3');
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text(`Issued through Kingdom Network on behalf of ${church?.name ?? 'the host church'}.  Verify this document at kingdom.network/verify/${credential.verifyCode ?? ''}`,
      M, H - 38, { width: W - M * 2, align: 'center', lineGap: 2 });

  if (preview) stamp(doc, 'PREVIEW');
  return finish(doc);
};

export const renderDocument = (args) =>
  args.credential.kind === 'invitation-letter' ? renderInvitationLetter(args) : renderCertificate(args);
