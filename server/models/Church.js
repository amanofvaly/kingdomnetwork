import mongoose from 'mongoose';

const leaderSchema = new mongoose.Schema(
  {
    name: String,
    title: String,
    image: String,
    bio: String,
  },
  { _id: false },
);

const churchSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    shortName: String,
    tagline: String,
    about: String,
    story: [String],

    city: String,
    country: String,
    region: { type: String, index: true },
    website: String,
    foundedYear: Number,

    coverImage: String,
    coverAlt: String,
    portraitImage: String,
    monogram: String,

    leaders: [leaderSchema],
    specialties: { type: [String], index: true },
    languages: [String],
    deliveryModes: [String],

    verified: { type: Boolean, default: false },
    demo: { type: Boolean, default: true },

    stats: {
      learners: Number,
      courses: Number,
      credentialsIssued: Number,
      yearsTeaching: Number,
    },

    rating: Number,
    ratingCount: Number,
  },
  { timestamps: true },
);

churchSchema.index({ name: 'text', about: 'text', specialties: 'text' });

export const Church = mongoose.model('Church', churchSchema);
