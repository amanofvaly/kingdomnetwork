/**
 * Outcomes are the comparison buckets. A buyer arrives wanting to become
 * something; every church selling into that outcome competes on one page.
 * These are platform taxonomy — churches define the title itself however they
 * want, but they do not invent the bucket.
 *
 * Which credential types land in which bucket is not decided here: a type is
 * what a credential is and it decides the rules, so the bucket follows from it.
 * That map lives in `server/lib/derive.js`, next to the other values a record
 * computes from what it already carries.
 */
export const outcomes = [
  {
    slug: 'ordination',
    name: 'Ordination',
    plural: 'Ordinations',
    verb: 'Get ordained',
    lede: 'Recognised ministerial standing, issued and signed by a church.',
    blurb:
      'Ordination is granted by a church, on its own authority and under its own name. Compare what each ministry requires, what it costs, and how long it takes.',
    coverImage: '/media/scenes/congregation-praying.jpg',
    coverAlt: 'A congregation praying together during a church service',
    icon: 'flame',
  },
  {
    slug: 'certification',
    name: 'Certification',
    plural: 'Certificates',
    verb: 'Get certified',
    lede: 'Church-issued certificates in ministry, care, chaplaincy and doctrine.',
    blurb:
      'A certificate names a competence and the church that vouches for it. Some are issued on purchase, some after a short assessment, some after coursework.',
    coverImage: '/media/scenes/students-laptop.webp',
    coverAlt: 'Smiling students learning together around a laptop',
    icon: 'award',
  },
  {
    slug: 'ministry-license',
    name: 'Ministry licence',
    plural: 'Licences',
    verb: 'Get licensed',
    lede: 'Authority to preach, marry, bury and serve under a named church.',
    blurb:
      'A licence carries permissions rather than a title. What it authorises depends entirely on the issuing church and on local law.',
    coverImage: '/media/scenes/preacher-and-congregation.jpg',
    coverAlt: 'A preacher addressing a congregation from the stage',
    icon: 'scroll',
  },
  {
    slug: 'church-affiliation',
    name: 'Church affiliation',
    plural: 'Affiliations',
    verb: 'Get affiliated',
    lede: 'Standing with an established ministry, renewable each year.',
    blurb:
      'Affiliation puts an independent minister or congregation under a named church. It is a relationship with obligations on both sides, and it lapses if it is not renewed.',
    coverImage: '/media/scenes/discussion-table.webp',
    coverAlt: 'Church leaders talking around a table',
    icon: 'link',
  },
  {
    slug: 'invitation-letter',
    name: 'Invitation letter',
    plural: 'Invitation letters',
    verb: 'Get invited',
    lede: 'A signed invitation from a host church in the country you are travelling to.',
    blurb:
      'Churches abroad invite ministers to conferences, pulpit exchanges and mission engagements. The letter is issued on the host church’s letterhead and names them as your host for the visit.',
    coverImage: '/media/scenes/friends-overlook.webp',
    coverAlt: 'Friends travelling together and looking across a new city',
    icon: 'plane',
  },
];

export const outcomeBySlug = Object.fromEntries(outcomes.map((o) => [o.slug, o]));

/**
 * Every credential at once.
 *
 * The five buckets above are how a church lists; they are not how everyone
 * shops. Someone who knows they want standing but not which kind needs one
 * page carrying all of it, with the bucket demoted to a filter.
 */
export const everyCredential = {
  slug: 'all',
  name: 'Credentials',
  plural: 'Credentials',
  verb: 'Get recognised',
  lede: 'Ordination, certificates, licences, affiliation and invitation letters.',
  // No blurb. The five buckets each define an unfamiliar idea and need a
  // sentence; the index defines nothing. Heading, counts, listings.
  blurb: '',
  coverImage: '/media/scenes/congregation-praying.jpg',
  coverAlt: 'A congregation praying together during a church service',
  icon: 'award',
};
