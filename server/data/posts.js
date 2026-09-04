/**
 * Demonstration posts, so a new account never meets an empty feed.
 *
 * `daysAgo` and `reactions` are shaped rather than random: a feed where every
 * post has the same weight and the same age reads as a fixture, not as a
 * place people actually are. Photography is already in `client/public/media`.
 */

export const posts = [
  {
    churchSlug: 'faith-life-church',
    daysAgo: 1,
    body: 'Sunday gathering. Pastor Henry opened in Colossians 3 — "whatever you do, work at it with all your heart". We have put the audio up for anyone who could not be with us.',
    images: [{ url: '/media/scenes/preacher-and-congregation.jpg', alt: 'A pastor preaching to a seated congregation' }],
    reactions: { amen: 34, pray: 8, love: 21, celebrate: 3 },
  },
  {
    churchSlug: 'new-horizon-bible-college',
    daysAgo: 2,
    body: 'Nineteen students sat their pastoral theology papers this week. Marking is under way and results go out on Friday. Pray for steady hands and honest work.',
    images: [{ url: '/media/scenes/students-writing.webp', alt: 'Students writing at desks in an examination hall' }],
    reactions: { amen: 12, pray: 41, love: 6, celebrate: 9 },
  },
  {
    churchSlug: 'rock-woi',
    daysAgo: 3,
    body: 'The new term of the leadership school begins on the 14th. Doors open at six, and there is food before we start. Bring someone with you.',
    images: [{ url: '/media/scenes/seminar-room.webp', alt: 'A seminar room set out with chairs' }],
    reactions: { amen: 18, pray: 4, love: 15, celebrate: 11 },
  },
  {
    churchSlug: 'christian-international',
    daysAgo: 4,
    body: 'A word for anyone in the long middle of something: faithfulness is not measured on the day it is rewarded. Keep going.',
    reactions: { amen: 62, pray: 27, love: 44, celebrate: 5 },
  },
  {
    churchSlug: 'seminole-assembly',
    daysAgo: 5,
    body: 'Our benevolence fund covered forty-one families this month — rent, school fees and two funerals. Thank you to everyone who gave. Every shilling of it went out.',
    images: [{ url: '/media/scenes/congregation-gathering.webp', alt: 'A congregation gathered together' }],
    reactions: { amen: 29, pray: 12, love: 57, celebrate: 14 },
  },
  {
    churchSlug: 'cornerstone-theological',
    daysAgo: 6,
    body: 'Reading week. The library is open until nine every evening and the theology stacks have been reorganised — the systematics are now on the second floor.',
    images: [{ url: '/media/scenes/library-stacks.webp', alt: 'Rows of library shelving' }],
    reactions: { amen: 7, pray: 2, love: 13, celebrate: 1 },
  },
  {
    churchSlug: 'grace-covenant-institute',
    daysAgo: 8,
    body: 'Ordination service on Sunday. Four men and two women who have studied with us for three years will be set apart. If you have walked with any of them, come.',
    images: [{ url: '/media/scenes/graduation-caps.webp', alt: 'Graduation caps thrown into the air' }],
    reactions: { amen: 88, pray: 19, love: 63, celebrate: 71 },
  },
  {
    churchSlug: 'ndw-ministries',
    daysAgo: 10,
    body: 'Back from two weeks in the villages north of here. Eleven new believers, one new fellowship meeting under a mango tree, and a great deal of walking.',
    images: [{ url: '/media/scenes/village-east-africa.webp', alt: 'A village path in East Africa' }],
    reactions: { amen: 45, pray: 33, love: 38, celebrate: 22 },
  },
  {
    churchSlug: 'divine-touch',
    daysAgo: 12,
    body: 'Midweek prayer has moved to Thursdays at seven. Same room, same kettle.',
    reactions: { amen: 16, pray: 24, love: 9, celebrate: 0 },
  },
  {
    churchSlug: 'forerunner-christian-church',
    daysAgo: 14,
    body: 'The children’s ministry needs two more volunteers for the Sunday second hour. No experience needed — you will be paired with someone who has done it for years.',
    images: [{ url: '/media/scenes/kids-classroom.webp', alt: 'Children in a classroom' }],
    reactions: { amen: 11, pray: 6, love: 19, celebrate: 2 },
  },
  {
    churchSlug: 'beacon-hill-ministry',
    daysAgo: 17,
    body: 'We have finished recording the whole of the pastoral care series. Eight sessions, and the workbook is going out to everyone who asked for it.',
    images: [{ url: '/media/scenes/pastoral-care-group.webp', alt: 'A small group in conversation' }],
    reactions: { amen: 23, pray: 5, love: 31, celebrate: 8 },
  },
  {
    churchSlug: 'riverside-divinity',
    daysAgo: 21,
    body: 'Applications for the autumn intake close at the end of the month. If you have been putting off the decision, this is the part where you make it.',
    images: [{ url: '/media/scenes/cathedral-nave.webp', alt: 'The nave of a cathedral' }],
    reactions: { amen: 14, pray: 9, love: 12, celebrate: 4 },
  },
];
