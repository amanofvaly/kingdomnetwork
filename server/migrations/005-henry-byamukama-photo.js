export const id = '005-henry-byamukama-photo';
export const description = 'Use Henry Byamukama’s Faith Life photograph on his profile';

const henryImage = '/media/churches/faith-life-pastor-speaking.jpg';

export const up = async (db) => {
  const churches = db.collection('churches');
  const instructors = db.collection('instructors');

  await instructors.updateOne(
    { slug: 'henry-byamukama', churchSlug: 'faith-life-church' },
    { $set: { image: henryImage, avatar: henryImage } },
  );

  const church = await churches.findOne({ slug: 'faith-life-church', demo: true });
  if (!church?.leaders?.length) return;

  const leaders = church.leaders.map((leader) => (
    leader.name?.trim().toLowerCase() === 'henry byamukama'
      ? { ...leader, image: henryImage }
      : leader
  ));
  await churches.updateOne({ _id: church._id }, { $set: { leaders } });
};
