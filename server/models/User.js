import mongoose from 'mongoose';

/**
 * `role` is platform-level only. Authority over a church lives in
 * ChurchMembership, because one person can administer two ministries and still
 * be an applicant at a third — see `server/models/ChurchMembership.js`.
 */
export const USER_ROLES = ['member', 'platform_admin'];

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
    passwordHash: { type: String, select: false },

    role: { type: String, enum: USER_ROLES, default: 'member', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },

    // Kept as a convenience for the church a person most recently acted for.
    // ChurchMembership is the source of truth for what they may actually do.
    churchSlug: { type: String, default: null },

    avatar: String,
    country: String,
    city: String,
    phone: String,
    timezone: String,
    ministryRole: String,
    bio: String,

    // Asked for once, at application time, rather than re-typed into every form.
    ministry: {
      yearsInMinistry: Number,
      currentRole: String,
      congregation: String,
      denomination: String,
      priorCredentials: [String],
    },

    emailVerifiedAt: Date,
    emailVerifyToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },

    notificationPrefs: {
      applicationUpdates: { type: Boolean, default: true },
      interviewReminders: { type: Boolean, default: true },
      courseProgress: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
    },

    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status,
    churchSlug: this.churchSlug,
    avatar: this.avatar,
    country: this.country,
    city: this.city,
    phone: this.phone,
    timezone: this.timezone,
    hasPassword: Boolean(this.passwordHash),
    ministryRole: this.ministryRole,
    ministry: this.ministry,
    bio: this.bio,
    emailVerified: Boolean(this.emailVerifiedAt),
    notificationPrefs: this.notificationPrefs,
    createdAt: this.createdAt,
  };
};

userSchema.methods.isPlatformAdmin = function isPlatformAdmin() {
  return this.role === 'platform_admin';
};

export const User = mongoose.model('User', userSchema);
