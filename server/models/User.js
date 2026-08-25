import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    // Absent for accounts created at checkout, which never set one.
    passwordHash: { type: String, select: false },

    role: { type: String, enum: ['learner', 'church', 'admin'], default: 'learner' },
    churchSlug: { type: String, default: null },

    avatar: String,
    country: String,
    city: String,
    phone: String,
    ministryRole: String,
    bio: String,
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    churchSlug: this.churchSlug,
    avatar: this.avatar,
    country: this.country,
    city: this.city,
    phone: this.phone,
    ministryRole: this.ministryRole,
    bio: this.bio,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
