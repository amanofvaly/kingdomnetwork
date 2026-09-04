export const id = '004-faith-life-imagery';
export const description = 'Give Faith Life Church and each of its demo listings distinct imagery';

const image = (coverImage, coverAlt) => ({ $set: { coverImage, coverAlt } });

export const up = async (db) => {
  const churches = db.collection('churches');
  const courses = db.collection('courses');
  const offerings = db.collection('offerings');

  await Promise.all([
    churches.updateOne(
      { slug: 'faith-life-church', demo: true },
      image('/media/scenes/church-sanctuary.webp', 'A welcoming church sanctuary with rows of wooden pews'),
    ),
    courses.updateOne(
      { slug: 'foundations-of-pastoral-theology', churchSlug: 'faith-life-church', demo: true },
      image('/media/scenes/bible-being-taught.jpg', 'A teacher leading a Bible study from an open Bible'),
    ),
    courses.updateOne(
      { slug: 'planting-a-rural-congregation', churchSlug: 'faith-life-church', demo: true },
      image('/media/scenes/village-east-africa.webp', 'A rural East African village surrounded by green countryside'),
    ),
    courses.updateOne(
      { slug: 'biblical-greek-for-preachers', churchSlug: 'faith-life-church', demo: true },
      image('/media/scenes/open-book-library.webp', 'An open study book on a table in a library'),
    ),
    offerings.updateOne(
      { slug: 'ordained-minister-faith-life', churchSlug: 'faith-life-church', demo: true },
      image('/media/scenes/preacher-and-congregation.jpg', 'A preacher addressing a gathered congregation'),
    ),
    offerings.updateOne(
      { slug: 'ministry-license-faith-life', churchSlug: 'faith-life-church', demo: true },
      image('/media/scenes/minister-supporting-congregant.jpg', 'A minister offering support to a member of the congregation'),
    ),
    offerings.updateOne(
      { slug: 'affiliation-faith-life', churchSlug: 'faith-life-church', demo: true },
      image('/media/scenes/congregation-praying.jpg', 'A congregation gathered together in prayer'),
    ),
  ]);

  const church = await churches.findOne({ slug: 'faith-life-church', demo: true });
  if (church?.leaders?.length) {
    const instructorSlugs = new Map([
      ['henry byamukama', 'henry-byamukama'],
      ['grace nakato', 'grace-nakato'],
    ]);
    const leaders = church.leaders.map((leader) => ({
      ...leader,
      instructorSlug: leader.instructorSlug ?? instructorSlugs.get(leader.name?.trim().toLowerCase()),
    }));
    await churches.updateOne({ _id: church._id }, { $set: { leaders } });
  }
};
