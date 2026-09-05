import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Calendar, ExternalLink, Globe2, GraduationCap, HeartHandshake, Images, Mail, MapPin, Phone, Share2, Users, X } from 'lucide-react';

import { CourseCard, MaterialCard } from '../components/cards.jsx';
import { OfferingCard } from '../components/market.jsx';
import { CHURCH_PLACEHOLDER, ErrorState, PERSON_PLACEHOLDER, Spinner, Stars, Verified } from '../components/ui.jsx';
import { FollowButton } from '../components/me/feed.jsx';
import { ShareCard } from '../components/ShareCard.jsx';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { compact, plural } from '../lib/format.js';

const FALLBACK_COVER = '/media/church-registration-cross.jpg';
const absoluteUrl = (value) => value && (/^https?:\/\//i.test(value) ? value : `https://${value}`);
const cleanText = (value) => value?.replace(/\s+/g, ' ').trim();
const shorten = (value, limit = 120) => {
  const text = cleanText(value);
  if (!text || text.length <= limit) return text;
  const clipped = text.slice(0, limit + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > limit * 0.65 ? lastSpace : limit).replace(/[.,;:!?-]+$/, '')}…`;
};

const EmptyBlock = ({ icon: Icon, title, copy, action, to }) => (
  <div className="church-profile-empty">
    <span className="church-profile-empty-icon"><Icon size={21} strokeWidth={1.7} /></span>
    <div><h3>{title}</h3><p>{copy}</p></div>
    {action && to ? <Link to={to} className="link">{action} <ArrowUpRight size={14} /></Link> : null}
  </div>
);

/**
 * Handing the church's page to someone else.
 *
 * A church asked for its banner and a code it could put on a screen, so this
 * hands back the same image the console produces rather than a bare URL.
 */
const SharePanel = ({ church, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="share-overlay" role="dialog" aria-modal="true" aria-label={`Share ${church.name}`}>
      <button type="button" className="share-overlay-scrim" aria-label="Close" onClick={onClose} />
      <div className="share-overlay-panel">
        <div className="row-between" style={{ marginBottom: 'var(--s-4)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Share {church.shortName ?? church.name}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <ShareCard church={church} path={`/churches/${church.slug}`} caption="Scan to open" fileName="profile" />
      </div>
    </div>
  );
};

export const ChurchDetail = () => {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/churches/${slug}`);
  const { user } = useAuth();

  // A church account cannot follow a church; there is nothing for it to do
  // with a feed. Signed out, the button would only lead to a sign-in wall.
  const canFollow = Boolean(user && user.accountKind !== 'church');
  const [followers, setFollowers] = useState(0);
  const [sharing, setSharing] = useState(false);
  useEffect(() => { if (data) setFollowers(data.followers ?? 0); }, [data]);
  if (loading) return <div className="wrap band"><Spinner label="Loading church" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const church = data?.church ?? {};
  const listings = data?.listings ?? [];
  const courses = data?.courses ?? [];
  const faculty = data?.faculty ?? [];
  const resources = data?.resources ?? [];
  const gallery = data?.gallery ?? [];
  const donations = data?.donations ?? { enabled: false };
  const sections = data?.sections ?? [];
  const specialties = church.specialties ?? [];
  const languages = church.languages ?? [];
  const deliveryModes = church.deliveryModes ?? [];
  const story = (church.story ?? []).filter(Boolean);
  const stats = church.stats ?? {};
  const contact = church.contact ?? {};
  const location = [church.city, church.country].filter(Boolean).join(', ');
  const shortName = church.shortName || church.name || 'This church';
  const description = cleanText(church.about) || `${shortName}${location ? ` serves its community in ${location}` : ' is part of the Kingdom Network'}.`;
  const profileCaption = shorten(church.tagline) || (location ? `Church community in ${location}.` : 'Church community.');
  const website = absoluteUrl(church.website);
  const visible = new Set(sections.filter((x) => x.visible !== false).map((x) => x.type));
  const shows = (type) => !sections.length || visible.has(type);
  const hasOfferings = listings.length > 0 || courses.length > 0 || resources.length > 0;
  const profileFacts = [
    location && { icon: MapPin, label: location },
    church.foundedYear && { icon: Calendar, label: `Founded ${church.foundedYear}` },
    church.denomination && { icon: BookOpen, label: church.denomination },
    languages.length && { icon: Globe2, label: languages.join(', ') },
    deliveryModes.length && { icon: GraduationCap, label: deliveryModes.join(', ') },
  ].filter(Boolean);
  const facultyBySlug = new Map(faculty.map((person) => [person.slug, person]));
  const leaderNames = new Set((church.leaders ?? []).map((person) => cleanText(person.name)?.toLowerCase()));
  const people = [
    ...(church.leaders ?? []).map((leader) => ({
      ...leader,
      ...(leader.instructorSlug ? facultyBySlug.get(leader.instructorSlug) : null),
    })),
    ...faculty.filter((person) => !leaderNames.has(cleanText(person.name)?.toLowerCase())),
  ];

  return (
    <main className="church-profile">
      {sharing ? <SharePanel church={church} onClose={() => setSharing(false)} /> : null}
      <div className="wrap church-profile-top">
        <div className="church-profile-cover media">
          <img src={church.coverImage || FALLBACK_COVER} alt={church.coverAlt || `${church.name || 'Church'} cover`} width={1600} height={600} fetchPriority="high"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_COVER; }} />
        </div>
          <section className="church-profile-identity" aria-labelledby="church-name">
            <div className="church-profile-toolbar">
            <div className="church-profile-mark">
              <img src={church.logoImage || CHURCH_PLACEHOLDER} alt="" />
            </div>
              <div className="church-profile-social" role="group" aria-label="Connect with this church">
              {canFollow ? (
                <FollowButton
                  slug={church.slug}
                  following={data.following}
                  size=""
                  className="church-profile-util"
                  variant="icon"
                  onChange={(_, on) => setFollowers((n) => n + (on ? 1 : -1))}
                />
              ) : null}
              <button type="button" className="church-profile-util"
                onClick={() => setSharing(true)} aria-label="Share" title="Share">
                <Share2 size={20} />
              </button>
              </div>
            </div>
            <div className="church-profile-name">
              <div className="church-profile-title-row">
                <div className="row-wrap" style={{ gap: 8 }}><h1 id="church-name">{church.name || 'Church profile'}</h1>{church.verified ? <Verified label="Verified church" /> : null}</div>
              </div>
              <p>{profileCaption}</p>
              <div className="church-profile-meta">
                {location ? <span><MapPin size={14} />{location}</span> : null}
                {stats.credentialsIssued ? <span>{compact(stats.credentialsIssued)} credentials issued</span> : null}
                {stats.learners ? <span>{compact(stats.learners)} learners</span> : null}
                <span>{compact(followers)} {followers === 1 ? 'follower' : 'followers'}</span>
              </div>
            </div>
            <div className="church-profile-actions">
              {/* Giving is an action, not one of the page's content sections —
                  it was previously also gated on `shows('donate')`, so a church
                  that had arranged its sections at all lost the button. */}
              {donations.enabled ? (
                <Link className="btn btn-give church-profile-give" to={`/give/${church.slug}`}>
                  <HeartHandshake size={16} /> Give
                </Link>
              ) : null}
            </div>
          </section>

        <nav className="church-profile-tabs" aria-label="Church page sections">
          <a href="#about">About</a><a href="#offerings">Credentials and learning</a>
          {people.length ? <a href="#people">People</a> : null}
          {gallery.length ? <a href="#photos">Photos</a> : null}
        </nav>
      </div>

      <div className="church-profile-body">
        <div className="wrap church-profile-layout">
          <aside className="church-profile-aside" id="about">
            <section className="church-profile-panel">
              <h2>About</h2><p>{description}</p>{story.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {specialties.length ? <div className="row-wrap church-profile-tags">{specialties.map((item) => <span className="tag" key={item}>{item}</span>)}</div> : null}
            </section>
            <section className="church-profile-panel">
              <h2>Church information</h2>
              {profileFacts.length ? <ul className="church-profile-facts">{profileFacts.map(({ icon: Icon, label }) => <li key={label}><Icon size={16} strokeWidth={1.7} /><span>{label}</span></li>)}</ul> : <p className="muted">More church information will be added here.</p>}
              <div className="church-profile-contact">
                {contact.email ? <a href={`mailto:${contact.email}`}><Mail size={15} />{contact.email}</a> : null}
                {contact.phone ? <a href={`tel:${contact.phone}`}><Phone size={15} />{contact.phone}</a> : null}
                {website ? <a href={website} target="_blank" rel="noreferrer noopener"><Globe2 size={15} />{church.website}</a> : null}
              </div>
            </section>
            {church.serviceTimes?.length ? <section className="church-profile-panel"><h2>Gather with us</h2><ul className="church-profile-services">
              {church.serviceTimes.map((service, index) => <li key={`${service.day}-${service.time}-${index}`}><span>{service.label || 'Service'}</span><strong>{[service.day, service.time].filter(Boolean).join(' · ')}</strong></li>)}
            </ul></section> : null}
          </aside>

          <div className="church-profile-feed" id="offerings">
            <section className="church-profile-section">
              <div className="church-profile-section-head"><div><h2>Credentials, courses and resources</h2><p>Published by {shortName}.</p></div>{hasOfferings ? <span>{plural(listings.length + courses.length + resources.length, 'item')}</span> : null}</div>
              {listings.length && shows('whatWeIssue') ? <div className="church-profile-rail"><h3>Credentials</h3><div className="grid grid-3">{listings.map((offering) => <OfferingCard key={offering.slug} offering={offering} />)}</div></div> : null}
              {courses.length && shows('courses') ? <div className="church-profile-rail"><h3>Courses</h3><div className="grid grid-3">{courses.map((course) => <CourseCard key={course.slug} course={{ ...course, church }} />)}</div></div> : null}
              {resources.length && shows('resources') ? <div className="church-profile-rail"><h3>Books and materials</h3><div className="grid grid-3">{resources.map((resource) => (
                <MaterialCard key={resource.slug} item={{ ...resource, church }} />
              ))}</div></div> : null}
              {!hasOfferings ? <EmptyBlock icon={BookOpen} title="Nothing published yet" copy={`${shortName} has not published credentials, courses or resources yet.`} action="Browse credentials and courses" to="/search" /> : null}
            </section>

            {people.length ? <section className="church-profile-section" id="people">
              <div className="church-profile-section-head"><div><h2>People</h2><p>Leaders and teachers serving this community.</p></div></div>
              <div className="church-profile-people">{people.map((person) => <article className="church-profile-person" key={person.slug || person.name}>
                <img src={person.image || PERSON_PLACEHOLDER} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = PERSON_PLACEHOLDER; }} /><div><h3>{person.name}</h3><p>{person.title || 'Church team'}</p>{person.bio ? <span>{person.bio}</span> : null}</div>{person.rating ? <Stars rating={person.rating} size={13} /> : null}{person.learners ? <small><Users size={13} />{compact(person.learners)} learners</small> : null}
              </article>)}</div>
            </section> : null}

            {gallery.length && shows('gallery') ? <section className="church-profile-section" id="photos"><div className="church-profile-section-head"><div><h2>Photos</h2><p>A view into the life of {shortName}.</p></div></div><div className="church-profile-gallery">{gallery.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.alt || ''} loading="lazy" /></figure>)}</div></section> : <section className="church-profile-section church-profile-photos-empty"><EmptyBlock icon={Images} title="More from this community soon" copy="Photos and community updates will appear here as they are added." /></section>}
          </div>
        </div>
      </div>
    </main>
  );
};
