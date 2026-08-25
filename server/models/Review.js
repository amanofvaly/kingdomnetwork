import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    courseSlug: { type: String, index: true },
    pathwaySlug: { type: String, index: true },
    authorName: { type: String, required: true },
    authorAvatar: String,
    authorLocation: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    title: String,
    body: String,
    helpful: { type: Number, default: 0 },
    monthsAgo: Number,
    demo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Review = mongoose.model('Review', reviewSchema);
