import mongoose from 'mongoose';

const instructorSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    title: String,
    churchSlug: { type: String, index: true },
    image: String,
    avatar: String,
    bio: String,
    credentials: [String],
    yearsExperience: Number,
    rating: Number,
    ratingCount: Number,
    learners: Number,
    courseCount: Number,
  },
  { timestamps: true },
);

export const Instructor = mongoose.model('Instructor', instructorSchema);
