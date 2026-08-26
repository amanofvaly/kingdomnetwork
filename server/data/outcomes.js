/**
 * Outcomes are the comparison buckets. A buyer arrives wanting to become
 * something; every church selling into that outcome competes on one page.
 * These are platform taxonomy — churches pick which bucket they list into,
 * and define the title itself however they want.
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
    types: ['ordination'],
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
    types: ['certificate'],
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
    types: ['license'],
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
    types: ['affiliation'],
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
    types: ['invitation-letter'],
    coverImage: '/media/scenes/friends-overlook.webp',
    coverAlt: 'Friends travelling together and looking across a new city',
    icon: 'plane',
  },
];

export const outcomeBySlug = Object.fromEntries(outcomes.map((o) => [o.slug, o]));
