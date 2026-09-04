/**
 * Books, recordings and workbooks the seeded ministries sell.
 *
 * These are materials, not standing: a thing you buy outright and keep, with a
 * price and a basket, rather than something you apply for and are granted. They
 * are spread deliberately — every kind the model allows, across nine of the
 * twelve churches, two of them free and two in a language the platform's own
 * churches actually preach in — so the catalogue's filters have something real
 * to bite on rather than one book repeated.
 *
 * Covers live in `client/public/media/materials` and are drawn rather than
 * photographed. A book cover is designed artwork; borrowing a stock photograph
 * of a library for one is the visual equivalent of lorem ipsum.
 */

const cover = (slug) => `/media/materials/${slug}.svg`;

const material = (r) => ({
  ...r,
  currency: 'USD',
  language: r.language ?? 'English',
  coverImage: cover(r.slug),
  status: 'published',
  publishedAt: new Date(),
  demo: true,
});

export const resources = [
  material({
    slug: 'the-shepherds-handbook',
    churchSlug: 'faith-life-church',
    kind: 'book',
    title: 'The Shepherd’s Handbook',
    subtitle: 'What a pastor owes the people in his care',
    authorName: 'Grace Nakalema',
    coverAlt: 'The Shepherd’s Handbook, a book by Grace Nakalema',
    description: [
      'A short book on the ordinary work of pastoring: visiting, teaching, correcting, and burying. It assumes the reader serves a congregation without a staff, a budget, or a seminary behind them, because most do.',
      'Each chapter closes with the questions a pastor should be able to answer about their own congregation, and the records a church ought to keep whether or not anyone asks to see them.',
    ],
    pages: 214,
    tags: ['pastoral care', 'first years', 'church records'],
    price: 14,
  }),
  material({
    slug: 'letters-to-a-young-minister',
    churchSlug: 'rock-woi',
    kind: 'book',
    title: 'Letters to a Young Minister',
    subtitle: 'Twelve letters on the first five years',
    authorName: 'Bishop Wendell Carr',
    coverAlt: 'Letters to a Young Minister, a book by Bishop Wendell Carr',
    description: [
      'Twelve letters written to a man ordained at twenty-six, covering the years most ministers leave the work in: money, loneliness, the second congregation, and what to do when the calling stops feeling like one.',
      'Published with the replies, which are frequently sharper than the letters.',
    ],
    pages: 176,
    tags: ['ordination', 'perseverance', 'mentoring'],
    price: 13,
    compareAtPrice: 18,
  }),
  material({
    slug: 'the-doctrine-of-the-church',
    churchSlug: 'cornerstone-theological',
    kind: 'book',
    title: 'The Doctrine of the Church',
    subtitle: 'Ecclesiology for people who have to run one',
    authorName: 'Dr Miriam Vance',
    coverAlt: 'The Doctrine of the Church, a book by Dr Miriam Vance',
    description: [
      'A systematic treatment of the church — its marks, its offices, its discipline — written for pastors rather than for the seminar room, and tested on eleven years of students who were pastoring while they studied.',
      'Includes the Reformed, Baptist and Pentecostal positions on church government set side by side, argued fairly, with the practical consequence of each spelled out.',
    ],
    pages: 288,
    tags: ['ecclesiology', 'systematic theology', 'church government'],
    price: 18,
  }),
  material({
    slug: 'romans-the-gospel-unashamed',
    churchSlug: 'beacon-hill-ministry',
    kind: 'sermon-series',
    title: 'Romans: The Gospel Unashamed',
    subtitle: 'Eleven messages through Paul’s letter to the church at Rome',
    authorName: 'Dr Alan Whitfield',
    coverAlt: 'Romans: The Gospel Unashamed, a sermon series in eleven parts',
    description: [
      'Eleven messages preached over a year, working from Paul’s greeting to the doxology that closes the letter. Each runs about forty minutes.',
      'Supplied as audio with a printed outline for each message, which congregations have used to run the series again in small groups.',
    ],
    durationMinutes: 440,
    tags: ['expository preaching', 'Romans', 'series'],
    price: 9,
    compareAtPrice: 14,
  }),
  material({
    slug: 'the-upper-room',
    churchSlug: 'ndw-ministries',
    kind: 'sermon-series',
    title: 'The Upper Room',
    subtitle: 'Seven nights on prayer that will not let go',
    authorName: 'Apostle Nii Doku Wellington',
    coverAlt: 'The Upper Room, a sermon series in seven parts',
    description: [
      'Seven nights recorded live in Accra during the ministry’s annual week of prayer, with the congregation audible throughout — which is the point.',
      'Given away because the ministry would rather it were played in a hundred prayer meetings than bought by ten people.',
    ],
    durationMinutes: 315,
    tags: ['intercession', 'prayer', 'live'],
    price: 0,
  }),
  material({
    slug: 'sitting-with-the-dying',
    churchSlug: 'riverside-divinity',
    kind: 'audiobook',
    title: 'Sitting With the Dying',
    subtitle: 'A chaplain’s account of the last hours',
    authorName: 'Rev. Dr Helen Marsh',
    coverAlt: 'Sitting With the Dying, an audiobook read by Rev. Dr Helen Marsh',
    description: [
      'Twenty years of hospital chaplaincy, told through the bedsides the author remembers. On what to say, on when to say nothing, and on the difference between comfort and reassurance.',
      'Read by the author. Used as set listening on the college’s chaplaincy track.',
    ],
    durationMinutes: 372,
    tags: ['chaplaincy', 'bereavement', 'ethics'],
    price: 12,
  }),
  material({
    slug: 'first-steps',
    churchSlug: 'new-horizon-bible-college',
    kind: 'study-guide',
    title: 'First Steps',
    subtitle: 'Eight weeks for someone who has just believed',
    coverAlt: 'First Steps, an eight-week study guide',
    description: [
      'Eight sessions covering repentance, baptism, the Scriptures, prayer, the church, giving, witness, and the return of Christ. Designed to be worked through with one other person rather than read alone.',
      'Free, and licensed for a church to print as many copies as it needs.',
    ],
    pages: 48,
    tags: ['new believers', 'discipleship', 'eight weeks'],
    price: 0,
  }),
  material({
    slug: 'safeguarding-in-the-local-church',
    churchSlug: 'grace-covenant-institute',
    kind: 'study-guide',
    title: 'Safeguarding in the Local Church',
    subtitle: 'Policy, practice, and the conversations nobody wants to have',
    authorName: 'Yvette Aduma',
    coverAlt: 'Safeguarding in the Local Church, a study guide in five parts',
    description: [
      'Five sessions for a leadership team: what a safeguarding policy must contain, who it names, how a concern is recorded, and what happens in the first hour after one is raised.',
      'Written against the standards required in the United States, the United Kingdom and Kenya, with the differences marked where they matter.',
    ],
    pages: 96,
    tags: ['safeguarding', 'governance', 'policy'],
    price: 11,
  }),
  material({
    slug: 'before-you-marry-them',
    churchSlug: 'seminole-assembly',
    kind: 'workbook',
    title: 'Before You Marry Them',
    subtitle: 'Six sessions of premarital counselling, with the forms',
    authorName: 'Pastor Dale and Ruth Kimball',
    coverAlt: 'Before You Marry Them, a premarital counselling workbook in six sessions',
    description: [
      'Six sessions a pastor can run with a couple, covering money, family, conflict, sex, faith, and the wedding itself — in that order, deliberately.',
      'Includes the counsellor’s notes, the couple’s worksheets, and the record a church should keep afterwards.',
    ],
    pages: 120,
    tags: ['marriage', 'counselling', 'premarital'],
    price: 16,
  }),
  material({
    slug: 'preparing-to-preach',
    churchSlug: 'beacon-hill-ministry',
    kind: 'workbook',
    title: 'Preparing to Preach',
    subtitle: 'A worksheet for every step from the text to the pulpit',
    authorName: 'Dr Alan Whitfield',
    coverAlt: 'Preparing to Preach, a homiletics workbook',
    description: [
      'One worksheet per stage: the text, the structure of the passage, the single sentence the sermon exists to say, the shape, the illustrations, and the delivery.',
      'Meant to be written in and thrown away weekly. Sold as a pad of twelve.',
    ],
    pages: 72,
    tags: ['homiletics', 'sermon preparation', 'worksheets'],
    price: 8,
  }),
  material({
    slug: 'hymns-in-luganda-and-english',
    churchSlug: 'faith-life-church',
    kind: 'album',
    title: 'Hymns in Luganda and English',
    subtitle: 'Fourteen hymns as the village churches sing them',
    authorName: 'Faith Life Singers',
    coverAlt: 'Hymns in Luganda and English, an album of fourteen hymns',
    description: [
      'Fourteen hymns recorded in one room in Kampala with a single microphone, in the arrangements the rural congregations actually use — which are slower, and in a lower key, than the books print.',
      'Both languages on every track. Sheet music included as a PDF.',
    ],
    durationMinutes: 58,
    language: 'Luganda',
    tags: ['worship', 'hymns', 'Luganda'],
    price: 7,
  }),
  material({
    slug: 'songs-from-the-accra-night',
    churchSlug: 'ndw-ministries',
    kind: 'album',
    title: 'Songs from the Accra Night',
    subtitle: 'Live worship from three nights of prayer',
    authorName: 'NDW Worship',
    coverAlt: 'Songs from the Accra Night, a live worship album',
    description: [
      'Recorded across three nights without overdubs. The congregation carries most of the singing, and on two tracks all of it.',
    ],
    durationMinutes: 74,
    language: 'Twi',
    tags: ['worship', 'live', 'Twi'],
    price: 9,
  }),
];
