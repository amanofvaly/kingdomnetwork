/**
 * The church's public page, as an ordered list of blocks it controls.
 *
 * Some blocks hold copy the church writes. Others are curated automatically
 * from live data — what it issues, what it teaches, who teaches — so a church
 * that publishes a new credential does not also have to remember to add it to
 * its own page, and a page cannot quietly go stale.
 *
 * A church that has never opened the page builder still has a page: the
 * defaults below are derived from what onboarding already collected, and are
 * exactly the layout the site shipped with.
 */

export const SECTION_TYPES = {
  hero: { label: 'Header', managed: 'church', always: true },
  about: { label: 'About', managed: 'church' },
  story: { label: 'Our story', managed: 'church' },
  statementOfFaith: { label: 'What we believe', managed: 'church' },
  leadership: { label: 'Leadership', managed: 'church' },
  serviceTimes: { label: 'Service times', managed: 'church' },
  gallery: { label: 'Gallery', managed: 'church' },
  video: { label: 'Video', managed: 'church' },
  richText: { label: 'Text block', managed: 'church' },
  cta: { label: 'Call to action', managed: 'church' },
  contact: { label: 'Contact', managed: 'church' },
  donate: { label: 'Give', managed: 'church' },
  whatWeIssue: { label: 'What we issue', managed: 'auto' },
  courses: { label: 'Coursework', managed: 'auto' },
  resources: { label: 'Books and materials', managed: 'auto' },
  faculty: { label: 'Faculty', managed: 'auto' },
};

export const AUTO_SECTIONS = Object.entries(SECTION_TYPES)
  .filter(([, meta]) => meta.managed === 'auto')
  .map(([type]) => type);

const section = (type, data = {}, order = 0) => ({ id: type, type, order, visible: true, data });

/** The layout the site has always rendered, expressed as blocks. */
export const defaultSections = (church) =>
  [
    section('hero', {}, 0),
    church?.about ? section('about', {}, 1) : null,
    church?.story?.length ? section('story', {}, 2) : null,
    church?.statementOfFaith?.length ? section('statementOfFaith', {}, 3) : null,
    church?.leaders?.length ? section('leadership', {}, 4) : null,
    church?.serviceTimes?.length ? section('serviceTimes', {}, 5) : null,
    section('whatWeIssue', {}, 6),
    section('courses', {}, 7),
    section('resources', {}, 8),
    section('faculty', {}, 9),
    church?.donations?.enabled ? section('donate', {}, 10) : null,
    section('contact', {}, 11),
  ].filter(Boolean);

export const sectionsFor = (church) => {
  const stored = church?.page?.sections ?? [];
  if (!stored.length) return defaultSections(church);

  // Auto sections added since this church last saved its page are appended
  // rather than lost — a church should not miss a new surface because it
  // arranged its page before that surface existed.
  const present = new Set(stored.map((s) => s.type));
  const missing = AUTO_SECTIONS.filter((type) => !present.has(type)).map((type, i) => ({
    id: type,
    type,
    order: stored.length + i,
    visible: true,
    data: {},
  }));

  return [...stored.map((s) => s.toObject?.() ?? s), ...missing].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

/** Only blocks that will actually render something. */
export const visibleSections = (church, counts = {}) =>
  sectionsFor(church).filter((s) => {
    if (!s.visible) return false;
    if (s.type === 'whatWeIssue') return (counts.offerings ?? 0) > 0;
    if (s.type === 'courses') return (counts.courses ?? 0) > 0;
    if (s.type === 'resources') return (counts.resources ?? 0) > 0;
    if (s.type === 'faculty') return (counts.faculty ?? 0) > 0;
    if (s.type === 'donate') return church?.donations?.enabled === true;
    if (s.type === 'leadership') return (church?.leaders?.length ?? 0) > 0;
    if (s.type === 'serviceTimes') return (church?.serviceTimes?.length ?? 0) > 0;
    if (s.type === 'gallery') return (s.data?.mediaIds?.length ?? 0) > 0;
    if (s.type === 'video') return Boolean(s.data?.url);
    if (s.type === 'about') return Boolean(church?.about);
    if (s.type === 'story') return (church?.story?.length ?? 0) > 0;
    if (s.type === 'statementOfFaith') return (church?.statementOfFaith?.length ?? 0) > 0;
    if (s.type === 'richText') return (s.data?.body?.length ?? 0) > 0;
    return true;
  });

/** The ten steps of onboarding, and what each one is allowed to write. */
export const ONBOARDING_STEPS = [
  { step: 1, key: 'account', label: 'You and your church', fields: ['name'] },
  { step: 2, key: 'identity', label: 'Church identity', fields: ['name', 'shortName', 'tagline', 'denomination', 'tradition', 'foundedYear', 'languages', 'legal'] },
  { step: 3, key: 'location', label: 'Location and contact', fields: ['city', 'country', 'region', 'timezone', 'website', 'contact'] },
  { step: 4, key: 'leadership', label: 'Leadership', fields: ['leaders', 'signatory'] },
  { step: 5, key: 'story', label: 'Story and imagery', fields: ['about', 'story', 'statementOfFaith', 'coverImage', 'coverAlt', 'portraitImage', 'logoImage', 'monogram', 'galleryMediaIds', 'serviceTimes', 'specialties', 'deliveryModes'] },
  { step: 6, key: 'offerings', label: 'What you issue', fields: [] },
  { step: 7, key: 'donations', label: 'Donations', fields: ['donations'] },
  { step: 8, key: 'payouts', label: 'Payouts', fields: ['payout'] },
  { step: 9, key: 'verification', label: 'Verification', fields: [] },
  { step: 10, key: 'publish', label: 'Preview and publish', fields: [] },
];

export const SKIPPABLE_STEPS = [6, 7, 8, 9];
