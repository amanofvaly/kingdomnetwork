import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ExternalLink, Plus, Trash2 } from 'lucide-react';

import { Checkbox, FileDrop, Input, Money, ParagraphEditor, Problems, RepeatableList, Select, Switch, Textarea } from '../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * Ten steps, each saved on the server as it is finished, so a church can leave
 * and come back without losing what it has already written.
 *
 * Steps six to nine are skippable. A church that wants to publish today and
 * decide about donations, payouts and verification later should be able to.
 */

const STEPS = [
  { key: 'account', label: 'You and your church' },
  { key: 'identity', label: 'Church identity' },
  { key: 'location', label: 'Location and contact' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'story', label: 'Story and imagery' },
  { key: 'offerings', label: 'Credentials', skippable: true },
  { key: 'donations', label: 'Donations', skippable: true },
  { key: 'payouts', label: 'Payouts', skippable: true },
  { key: 'verification', label: 'Verification', skippable: true },
  { key: 'publish', label: 'Preview and publish' },
];

const OUTCOME_KINDS = [
  { value: 'ordination', label: 'Ordination', help: 'Ministerial standing you grant on your own authority.' },
  { value: 'license', label: 'Ministry licences', help: 'Usually renewable, held under a relationship with you.' },
  { value: 'certificate', label: 'Certificates', help: 'A record of study completed with you.' },
  { value: 'diploma', label: 'Diplomas', help: 'A longer programme of study.' },
  { value: 'affiliation', label: 'Affiliation', help: 'A relationship with your ministry, not a title.' },
  { value: 'invitation-letter', label: 'Invitation letters', help: 'Supporting documents for ministers travelling to you.' },
  { value: 'courses', label: 'Coursework', help: 'Teaching, whether or not it leads to a credential.' },
];

/* --- step one: no church exists yet ------------------------------------- */

const Begin = () => {
  const navigate = useNavigate();
  const { user, ready, refresh } = useAuth();
  const { fail } = useToast();
  const [form, setForm] = useState({ name: '', yourRole: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { churchSlug } = await api.post('/manage/start', form);
      await refresh();
      navigate(`/onboarding/${churchSlug}/identity`);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  if (!ready) return <div className="wrap band"><Spinner /></div>;

  if (!user) {
    return (
      <div className="wrap band-warm band">
        <div className="wrap-narrow stack stack-4">
          <span className="eyebrow">List what you issue</span>
          <h1>First, create your account.</h1>
          <p className="lede">
            You will set up your church next. You can invite others to help manage it later.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Link className="btn btn-primary" to="/signup" state={{ from: '/onboarding' }}>Create an account</Link>
            <Link className="btn btn-outline" to="/login" state={{ from: '/onboarding' }}>I already have one</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-5">
        <div className="stack stack-2">
          <span className="eyebrow">Step 1 of 10</span>
          <h1>Church name</h1>
          <p className="lede">
            Your page address is set from this and cannot be changed later.
          </p>
        </div>

        <form className="a-form panel" onSubmit={submit} style={{ padding: 'var(--s-5)' }}>
          <Input
            label="Church name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Faith Life Church"
            required
            autoFocus
          />
          <Input
            label="Your role"
            help="Internal only. Not shown publicly."
            value={form.yourRole}
            onChange={(e) => setForm({ ...form, yourRole: e.target.value })}
            placeholder="Senior Pastor"
          />
          <button className="btn btn-primary" disabled={busy || !form.name.trim()}>
            {busy ? 'Setting up…' : 'Continue'} <ArrowRight size={16} strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
};

/* --- the wizard --------------------------------------------------------- */

const StepRail = ({ current, completed, churchSlug }) => {
  const navigate = useNavigate();
  return (
    <nav className="wizard-rail" aria-label="Onboarding steps">
      {STEPS.map((step, i) => {
        const n = i + 1;
        const done = completed.includes(n);
        const reachable = done || n <= Math.max(...completed, 0) + 1;
        return (
          <button
            key={step.key}
            type="button"
            className={`wizard-step ${step.key === current ? 'is-current' : ''} ${done ? 'is-done' : ''}`}
            disabled={!reachable}
            onClick={() => navigate(`/onboarding/${churchSlug}/${step.key}`)}
          >
            <span className="n">{done ? <Check size={13} strokeWidth={2.6} /> : n}</span>
            <span>{step.label}</span>
            {step.skippable && !done ? <span className="skip">optional</span> : null}
          </button>
        );
      })}
    </nav>
  );
};

export const Onboarding = () => {
  const { churchSlug, step = 'identity' } = useParams();
  const navigate = useNavigate();
  const { ok, fail } = useToast();
  const { refresh } = useAuth();

  const { data, error, loading, reload } = useApi(churchSlug ? `/manage/${churchSlug}/onboarding` : null, { skip: !churchSlug });
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.church) setDraft(data.church);
  }, [data]);

  const index = STEPS.findIndex((s) => s.key === step);
  const stepMeta = STEPS[index];

  const set = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), []);

  const save = async (extra = {}) => {
    setBusy(true);
    try {
      const body = {};
      for (const field of FIELDS[step] ?? []) body[field] = draft?.[field];
      await api.patch(`/manage/${churchSlug}/onboarding/${step}`, { ...body, ...extra });
      ok('Saved');
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (!(await save())) return;
    await reload();
    const following = STEPS[index + 1];
    if (following) navigate(`/onboarding/${churchSlug}/${following.key}`);
  };

  const publish = async () => {
    setBusy(true);
    try {
      await api.post(`/manage/${churchSlug}/publish`);
      await refresh();
      ok('Your page is live');
      navigate(`/manage/${churchSlug}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (!churchSlug) return <Begin />;
  if (loading || !draft) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <div className="wrap band">
      <div className="stack stack-5">
        <div className="stack stack-2">
          <span className="eyebrow">Setting up {draft.name}</span>
          <h1>{stepMeta?.label}</h1>
        </div>

        <div className="wizard">
          <StepRail current={step} completed={data.completedSteps ?? []} churchSlug={churchSlug} />

          <div>
            <div className="wizard-panel">
              <StepBody
                step={step}
                draft={draft}
                set={set}
                churchSlug={churchSlug}
                onPublish={publish}
                busy={busy}
              />
            </div>

            <div className="wizard-foot">
              {index > 0 ? (
                <Link className="btn btn-ghost" to={`/onboarding/${churchSlug}/${STEPS[index - 1].key}`}>
                  <ArrowLeft size={16} strokeWidth={2} /> Back
                </Link>
              ) : <span />}

              <div className="row" style={{ gap: 12 }}>
                {stepMeta?.skippable && STEPS[index + 1] ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate(`/onboarding/${churchSlug}/${STEPS[index + 1].key}`)}
                  >
                    Skip for now
                  </button>
                ) : null}

                {step === 'publish' ? (
                  <button type="button" className="btn btn-primary btn-lg" onClick={publish} disabled={busy}>
                    {busy ? 'Publishing…' : 'Publish my page'}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>
                    {busy ? 'Saving…' : 'Save and continue'} <ArrowRight size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** What each step is allowed to write. Mirrors ONBOARDING_STEPS on the server. */
const FIELDS = {
  account: ['name'],
  identity: ['name', 'shortName', 'tagline', 'denomination', 'tradition', 'foundedYear', 'languages', 'legal'],
  location: ['city', 'country', 'region', 'timezone', 'website', 'contact'],
  leadership: ['leaders', 'signatory'],
  story: ['about', 'story', 'statementOfFaith', 'coverImage', 'coverAlt', 'logoImage', 'monogram', 'serviceTimes', 'specialties', 'deliveryModes'],
  offerings: [],
  donations: ['donations'],
  payouts: ['payout'],
  verification: [],
  publish: [],
};

const listValue = (arr) => (arr ?? []).join(', ');
const parseList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

const StepBody = ({ step, draft, set, churchSlug, onPublish, busy }) => {
  const { ok, fail } = useToast();
  const [uploading, setUploading] = useState(null);
  const [kinds, setKinds] = useState([]);

  const upload = async (file, folder, onDone) => {
    setUploading(folder);
    try {
      const asset = await api.upload(`/manage/${churchSlug}/media`, file, {
        headers: { 'x-media-kind': 'image', 'x-media-folder': folder },
      });
      onDone(asset);
      ok('Uploaded');
    } catch (err) {
      fail(err);
    } finally {
      setUploading(null);
    }
  };

  switch (step) {
    case 'identity':
      return (
        <div className="a-form">
          <div className="a-row">
            <Input label="Church name" value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
            <Input label="Short name" help="Used on cards and in narrow layouts." value={draft.shortName ?? ''} onChange={(e) => set({ shortName: e.target.value })} />
          </div>
          <Input
            label="Tagline"
            help="A single line shown under your church name."
            value={draft.tagline ?? ''}
            onChange={(e) => set({ tagline: e.target.value })}
            placeholder="Pastoral formation for the churches of the Great Lakes region."
          />
          <div className="a-row">
            <Input label="Denomination" value={draft.denomination ?? ''} onChange={(e) => set({ denomination: e.target.value })} placeholder="Independent · Pentecostal · Anglican…" />
            <Input label="Tradition" value={draft.tradition ?? ''} onChange={(e) => set({ tradition: e.target.value })} placeholder="Evangelical, Reformed, Charismatic…" />
            <Input label="Founded" type="number" value={draft.foundedYear ?? ''} onChange={(e) => set({ foundedYear: Number(e.target.value) || undefined })} />
          </div>
          <Input
            label="Languages"
            help="Separate them with commas."
            value={listValue(draft.languages)}
            onChange={(e) => set({ languages: parseList(e.target.value) })}
            placeholder="English, Luganda, Swahili"
          />
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="eyebrow" style={{ marginBottom: 8 }}>Registration</legend>
            <p className="muted small" style={{ marginTop: 0 }}>
              Used for verification only.
            </p>
            <div className="a-row">
              <Input label="Registered name" value={draft.legal?.registeredName ?? ''} onChange={(e) => set({ legal: { ...draft.legal, registeredName: e.target.value } })} />
              <Input label="Registration number" value={draft.legal?.registrationNumber ?? ''} onChange={(e) => set({ legal: { ...draft.legal, registrationNumber: e.target.value } })} />
              <Input label="Country of registration" value={draft.legal?.registrationCountry ?? ''} onChange={(e) => set({ legal: { ...draft.legal, registrationCountry: e.target.value } })} />
            </div>
          </fieldset>
        </div>
      );

    case 'location':
      return (
        <div className="a-form">
          <div className="a-row">
            <Input label="City" value={draft.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
            <Input label="Country" value={draft.country ?? ''} onChange={(e) => set({ country: e.target.value })} />
            <Select
              label="Region"
              value={draft.region ?? ''}
              placeholder="Choose one"
              onChange={(e) => set({ region: e.target.value })}
              options={['East Africa', 'West Africa', 'Southern Africa', 'North America', 'Europe', 'Asia', 'Latin America', 'Oceania']}
            />
          </div>
          <div className="a-row">
            <Input label="Contact email" type="email" value={draft.contact?.email ?? ''} onChange={(e) => set({ contact: { ...draft.contact, email: e.target.value } })} />
            <Input label="Phone" value={draft.contact?.phone ?? ''} onChange={(e) => set({ contact: { ...draft.contact, phone: e.target.value } })} />
            <Input label="WhatsApp" value={draft.contact?.whatsapp ?? ''} onChange={(e) => set({ contact: { ...draft.contact, whatsapp: e.target.value } })} />
          </div>
          <Input label="Website" value={draft.website ?? ''} onChange={(e) => set({ website: e.target.value })} placeholder="example.org" />
          <Textarea
            label="Address"
            help="One line per row. Shown on your page."
            rows={3}
            value={(draft.contact?.addressLines ?? []).join('\n')}
            onChange={(e) => set({ contact: { ...draft.contact, addressLines: e.target.value.split('\n') } })}
          />
          <Input
            label="Time zone"
            help="Used when publishing interview times."
            value={draft.timezone ?? ''}
            onChange={(e) => set({ timezone: e.target.value })}
            placeholder="Africa/Kampala"
          />
        </div>
      );

    case 'leadership':
      return (
        <div className="a-form">
          <p className="muted small" style={{ margin: 0 }}>
            Add your leadership team. One of them signs your certificates.
          </p>
          <RepeatableList
            items={draft.leaders ?? []}
            onChange={(leaders) => set({ leaders })}
            makeItem={() => ({ name: '', title: '', bio: '' })}
            addLabel="Add a leader"
            title={(l) => l.name || 'New leader'}
            empty="No leaders added yet."
            renderItem={(leader, i, update) => (
              <>
                <div className="a-row">
                  <Input label="Name" value={leader.name ?? ''} onChange={(e) => update({ ...leader, name: e.target.value })} />
                  <Input label="Title" value={leader.title ?? ''} onChange={(e) => update({ ...leader, title: e.target.value })} placeholder="Senior Pastor" />
                </div>
                <Textarea label="Short biography" rows={3} value={leader.bio ?? ''} onChange={(e) => update({ ...leader, bio: e.target.value })} />
                {leader.image ? (
                  <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                    <img src={leader.image} alt="" width="56" height="56" style={{ borderRadius: '50%', objectFit: 'cover' }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ ...leader, image: undefined, mediaId: undefined })}>
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <FileDrop
                    label="Add a photograph"
                    hint="JPEG, PNG or WebP, up to 8MB"
                    busy={uploading === `leader-${i}`}
                    onFile={(file) => upload(file, `leader-${i}`, (asset) => update({ ...leader, image: asset.url, mediaId: asset.id }))}
                  />
                )}
                <Checkbox
                  label="This person signs what we issue"
                  checked={draft.signatory?.name === leader.name && Boolean(leader.name)}
                  onChange={(on) => set({ signatory: on ? { name: leader.name, title: leader.title } : { name: '', title: '' } })}
                />
              </>
            )}
          />
        </div>
      );

    case 'story':
      return (
        <div className="a-form">
          <Textarea
            label="Your detailsr church"
            help="A paragraph or two. This leads your public page."
            rows={4}
            value={draft.about ?? ''}
            onChange={(e) => set({ about: e.target.value })}
          />
          <ParagraphEditor
            label="Our story"
            help="One paragraph per box."
            value={draft.story ?? []}
            onChange={(story) => set({ story })}
          />
          <ParagraphEditor
            label="Statement of faith"
            help="Optional. Shown as its own section."
            value={draft.statementOfFaith ?? []}
            onChange={(statementOfFaith) => set({ statementOfFaith })}
          />
          <div className="a-row">
            <Input
              label="Specialties"
              help="Comma separated. Used in search results."
              value={listValue(draft.specialties)}
              onChange={(e) => set({ specialties: parseList(e.target.value) })}
              placeholder="Pastoral formation, Church planting"
            />
            <Input
              label="Delivery methods"
              help="Comma separated."
              value={listValue(draft.deliveryModes)}
              onChange={(e) => set({ deliveryModes: parseList(e.target.value) })}
              placeholder="Online, Audio-first, Regional cohorts"
            />
          </div>

          <div className="a-row">
            <div className="a-field">
              <label>Cover photograph</label>
              {draft.coverImage ? (
                <div className="stack stack-2">
                  <img src={draft.coverImage} alt="" style={{ width: '100%', borderRadius: 'var(--r-md)', aspectRatio: '24/7', objectFit: 'cover' }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ coverImage: undefined })}>Remove</button>
                </div>
              ) : (
                <FileDrop
                  label="Add a cover photograph"
                  hint="Wide images work best."
                  busy={uploading === 'cover'}
                  onFile={(file) => upload(file, 'cover', (asset) => set({ coverImage: asset.url }))}
                />
              )}
            </div>
            <div className="a-field">
              <label>Logo</label>
              {draft.logoImage ? (
                <div className="stack stack-2">
                  <img src={draft.logoImage} alt="" style={{ width: 96, height: 96, objectFit: 'contain' }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ logoImage: undefined })}>Remove</button>
                </div>
              ) : (
                <FileDrop label="Add your logo" busy={uploading === 'logo'} onFile={(file) => upload(file, 'logo', (asset) => set({ logoImage: asset.url }))} />
              )}
              <Input
                label="Monogram"
                help="Two letters, used where the logo does not fit."
                maxLength={2}
                value={draft.monogram ?? ''}
                onChange={(e) => set({ monogram: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="a-field">
            <label>Service times</label>
            <RepeatableList
              items={draft.serviceTimes ?? []}
              onChange={(serviceTimes) => set({ serviceTimes })}
              makeItem={() => ({ day: 'Sunday', time: '', label: '' })}
              addLabel="Add a service"
              collapsible={false}
              title={(s) => [s.day, s.time].filter(Boolean).join(' ') || 'New service'}
              empty="No service times listed."
              renderItem={(service, i, update) => (
                <div className="a-row">
                  <Select
                    label="Day"
                    value={service.day ?? ''}
                    onChange={(e) => update({ ...service, day: e.target.value })}
                    options={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']}
                  />
                  <Input label="Time" value={service.time ?? ''} onChange={(e) => update({ ...service, time: e.target.value })} placeholder="9:00am" />
                  <Input label="Name" value={service.label ?? ''} onChange={(e) => update({ ...service, label: e.target.value })} placeholder="Morning service" />
                </div>
              )}
            />
          </div>
        </div>
      );

    case 'offerings':
      return (
        <div className="a-form">
          <p className="muted" style={{ marginTop: 0 }}>
            Select what you plan to offer. You can change this later.
          </p>
          <div className="stack stack-3">
            {OUTCOME_KINDS.map((kind) => (
              <Checkbox
                key={kind.value}
                label={kind.label}
                help={kind.help}
                checked={kinds.includes(kind.value)}
                onChange={(on) => setKinds(on ? [...kinds, kind.value] : kinds.filter((k) => k !== kind.value))}
              />
            ))}
          </div>
          <div className="notice">
            <strong>Please note</strong> Every ordination, licence, certificate and diploma must include a review, an interview, or both. A fee starts an application; it does not guarantee the credential.
          </div>
        </div>
      );

    case 'donations':
      return (
        <div className="a-form">
          <Switch
            label="Receive gifts through your page"
            help="A giving section appears on your page and at its own address."
            checked={draft.donations?.enabled}
            onChange={(enabled) => set({ donations: { ...draft.donations, enabled } })}
          />
          {draft.donations?.enabled ? (
            <>
              <Input
                label="Headline"
                value={draft.donations?.headline ?? ''}
                onChange={(e) => set({ donations: { ...draft.donations, headline: e.target.value } })}
                placeholder="Support pastoral training in Uganda"
              />
              <Textarea
                label="Description"
                rows={3}
                value={draft.donations?.blurb ?? ''}
                onChange={(e) => set({ donations: { ...draft.donations, blurb: e.target.value } })}
              />
              <div className="a-row">
                <Input
                  label="Suggested amounts"
                  help="Comma separated, in US dollars."
                  value={listValue(draft.donations?.suggestedAmounts)}
                  onChange={(e) => set({ donations: { ...draft.donations, suggestedAmounts: parseList(e.target.value).map(Number).filter(Boolean) } })}
                />
                <Money
                  label="Minimum donation"
                  value={draft.donations?.minAmount ?? 5}
                  onChange={(minAmount) => set({ donations: { ...draft.donations, minAmount } })}
                />
              </div>
              <RepeatableList
                items={draft.donations?.causes ?? []}
                onChange={(causes) => set({ donations: { ...draft.donations, causes } })}
                makeItem={() => ({ id: `cause-${Date.now()}`, title: '', blurb: '', active: true })}
                addLabel="Add a fund"
                title={(c) => c.title || 'New cause'}
                empty="Gifts will go to your general fund unless you name something specific."
                renderItem={(cause, i, update) => (
                  <>
                    <Input label="Name" value={cause.title ?? ''} onChange={(e) => update({ ...cause, title: e.target.value })} />
                    <Textarea label="Description" rows={2} value={cause.blurb ?? ''} onChange={(e) => update({ ...cause, blurb: e.target.value })} />
                    <Money label="Fundraising goal" value={cause.goalAmount} onChange={(goalAmount) => update({ ...cause, goalAmount })} />
                  </>
                )}
              />
              <Checkbox
                label="Allow anonymous gifts"
                checked={draft.donations?.allowAnonymous !== false}
                onChange={(allowAnonymous) => set({ donations: { ...draft.donations, allowAnonymous } })}
              />
            </>
          ) : null}
        </div>
      );

    case 'payouts':
      return (
        <div className="a-form">
          <p className="muted" style={{ marginTop: 0 }}>
            Payout details. Gifts and fees are collected on your behalf and settled to this account by a
            Kingdom Network administrator. Only the last four digits are ever shown back to you.
          </p>
          <Select
            label="Payment method"
            placeholder="Choose one"
            value={draft.payout?.method ?? ''}
            onChange={(e) => set({ payout: { ...draft.payout, method: e.target.value } })}
            options={[
              { value: 'mpesa', label: 'M-Pesa' },
              { value: 'mobile-money', label: 'Other mobile money' },
              { value: 'bank', label: 'Bank transfer' },
            ]}
          />
          <div className="a-row">
            <Input label="Account name" value={draft.payout?.accountName ?? ''} onChange={(e) => set({ payout: { ...draft.payout, accountName: e.target.value } })} />
            <Input
              label={draft.payout?.method === 'bank' ? 'Account number' : 'Mobile number'}
              value={draft.payout?.accountRef ?? ''}
              onChange={(e) => set({ payout: { ...draft.payout, accountRef: e.target.value } })}
              placeholder={draft.payout?.accountRefMasked ?? ''}
            />
          </div>
          {draft.payout?.method === 'bank' ? (
            <div className="a-row">
              <Input label="Bank" value={draft.payout?.bankName ?? ''} onChange={(e) => set({ payout: { ...draft.payout, bankName: e.target.value } })} />
              <Input label="Branch" value={draft.payout?.branch ?? ''} onChange={(e) => set({ payout: { ...draft.payout, branch: e.target.value } })} />
              <Input label="SWIFT" value={draft.payout?.swift ?? ''} onChange={(e) => set({ payout: { ...draft.payout, swift: e.target.value } })} />
            </div>
          ) : null}
        </div>
      );

    case 'verification':
      return <Verification churchSlug={churchSlug} draft={draft} />;

    case 'publish':
      return (
        <div className="a-form">
          <Problems
            title="Before you can publish"
            problems={[
              !draft.name?.trim() && 'The church’s name',
              !(draft.city && draft.country) && 'Where you are',
              !draft.contact?.email && 'A contact email address',
              !draft.about?.trim() && 'A description of the church',
            ].filter(Boolean)}
          />
          <p className="muted" style={{ marginTop: 0 }}>
            Your page goes live immediately and can be edited at any time. Listings are published separately.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <a className="btn btn-outline" href={`/churches/${churchSlug}`} target="_blank" rel="noreferrer">
              Preview your page <ExternalLink size={15} strokeWidth={1.8} />
            </a>
            <button type="button" className="btn btn-primary" onClick={onPublish} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
};

const Verification = ({ churchSlug, draft }) => {
  const { ok, fail } = useToast();
  const [documents, setDocuments] = useState(draft.verification?.documents ?? []);
  const [uploading, setUploading] = useState(false);
  const state = draft.verification?.state ?? 'unverified';

  const add = async (file, label) => {
    setUploading(true);
    try {
      const asset = await api.upload(`/manage/${churchSlug}/media`, file, {
        headers: { 'x-media-kind': 'document', 'x-media-folder': 'verification' },
      });
      setDocuments((d) => [...d, { label, mediaId: asset.id, filename: asset.filename }]);
    } catch (err) {
      fail(err);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    try {
      await api.post(`/manage/${churchSlug}/verification`, { documents });
      ok('Sent for review');
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className="a-form">
      <div className={`notice ${state === 'verified' ? 'notice-green' : state === 'rejected' ? 'notice-red' : ''}`}>
        <strong>
          {state === 'verified' ? 'Verified' : state === 'pending' ? 'With us for review' : state === 'rejected' ? 'Not verified yet' : 'Not verified'}
        </strong>
        <p style={{ margin: '4px 0 0' }}>
          {state === 'verified'
            ? 'Your page carries the verified mark.'
            : 'Verification is a badge, not a permission. Your page and listings work the same without it.'}
        </p>
        {draft.verification?.notes ? <p className="small" style={{ margin: '8px 0 0' }}>{draft.verification.notes}</p> : null}
      </div>

      {state !== 'verified' ? (
        <>
          <div className="stack stack-2">
            {documents.map((doc, i) => (
              <div key={i} className="row row-between panel" style={{ padding: '10px 14px' }}>
                <span className="small">{doc.label} — {doc.filename ?? 'attached'}</span>
                <button type="button" className="a-icon-btn danger" onClick={() => setDocuments(documents.filter((_, n) => n !== i))}>
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>

          <FileDrop
            label="Add a registration document"
            hint="Government registration, non-profit status or fellowship credentials. PDF or image."
            accept="application/pdf,image/*"
            busy={uploading}
            onFile={(file) => add(file, 'Registration document')}
          />

          <button type="button" className="btn btn-primary" onClick={submit} disabled={!documents.length}>
            <Plus size={15} strokeWidth={2} /> Send for review
          </button>
        </>
      ) : null}
    </div>
  );
};
