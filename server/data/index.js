import { finalise } from './helpers.js';
import { addLessonContent } from './lesson-content.js';
import { churches } from './churches.js';
import { instructors } from './instructors.js';
import { offerings } from './offerings.js';
import { outcomes } from './outcomes.js';
import { reviews } from './reviews.js';
import { africaCourses } from './courses/africa.js';
import { usMinistryCourses } from './courses/ministries-us.js';
import { seminaryCourses } from './courses/seminaries.js';

export const courses = addLessonContent(
  finalise([...africaCourses, ...usMinistryCourses, ...seminaryCourses]),
  { instructors, churches },
);

export const categories = [
  { slug: 'pastoral-ministry', name: 'Pastoral Ministry' },
  { slug: 'theology-doctrine', name: 'Theology & Doctrine' },
  { slug: 'biblical-studies', name: 'Biblical Studies' },
  { slug: 'preaching-teaching', name: 'Preaching & Teaching' },
  { slug: 'counselling-care', name: 'Counselling & Care' },
  { slug: 'church-leadership-operations', name: 'Church Leadership & Operations' },
  { slug: 'missions-outreach', name: 'Missions & Outreach' },
  { slug: 'chaplaincy', name: 'Chaplaincy' },
];

export { churches, instructors, offerings, outcomes, reviews };
