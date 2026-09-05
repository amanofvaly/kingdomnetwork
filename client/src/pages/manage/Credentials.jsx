import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Plus } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import {
  Checkbox, DataTable, Dialog, Field, Input, Money, Panel, ParagraphEditor, Problems, RepeatableList,
  Select, StatusPill, Switch, Textarea,
} from '../../components/admin/kit.jsx';
import { ACQUISITION } from '../../components/market.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

/**
 * The credential builder.
 *
 * Its job is to make one rule impossible to miss: a credential needs a decision
 * by the church behind it. Publishing is blocked until a review or an interview
 * is required, and the page says why.
 */

const TYPES = [
  { value: 'ordination', label: 'Ordination' },
  { value: 'license', label: 'Ministry licence' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'letter-of-standing', label: 'Letter of standing' },
  { value: 'affiliation', label: 'Affiliation' },
  { value: 'invitation-letter', label: 'Invitation letter' },
];

/**
 * The comparison pages, and which kinds may be listed on them.
 *
 * A kind is what the credential is and it decides the rules; the page it is
 * compared on follows from that, so it is never asked for twice. Only a letter
 * of standing reads two ways — as a licence or as an affiliation — and it is
 * the one kind offered a choice. Mirrors `OUTCOMES_BY_TYPE` in
 * `server/lib/derive.js`, which is what actually enforces it.
 */
const OUTCOMES = [
  { value: 'ordination', label: 'Ordination', types: ['ordination'] },
  { value: 'certification', label: 'Certification', types: ['certificate', 'diploma'] },
  { value: 'ministry-license', label: 'Ministry licence', types: ['license', 'letter-of-standing'] },
  { value: 'church-affiliation', label: 'Church affiliation', types: ['affiliation', 'letter-of-standing'] },
  { value: 'invitation-letter', label: 'Invitation letter', types: ['invitation-letter'] },
];

const outcomesForType = (type) => OUTCOMES.filter((o) => o.types.includes(type));
const outcomeLabel = (value) => OUTCOMES.find((o) => o.value === value)?.label ?? value;

const TIERS = [
  { value: 'certified', label: 'Certified' },
  { value: 'licensed', label: 'Licensed' },
  { value: 'ordained', label: 'Ordained' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'other', label: 'Not part of a progression' },
];

const CONFERS_STANDING = ['ordination', 'license', 'certificate', 'diploma', 'letter-of-standing'];

export const Credentials = () => {
  const { churchSlug } = useOutletContext();
  const navigate = useNavigate();
  const { fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/offerings`);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'certificate' });

  const create = async () => {
    try {
      const created = await api.post(`/manage/${churchSlug}/offerings`, form);
      navigate(`/manage/${churchSlug}/credentials/${created.slug}`);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <ConsoleHeader title="Credentials" sub={data ? `${data.length} listing${data.length === 1 ? '' : 's'}` : ''}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus size={15} strokeWidth={2} /> New listing
        </button>
      </ConsoleHeader>

      <div className="console-body">
        {loading ? <Spinner /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}

        {data ? (
          <Panel flush>
            <DataTable
              rows={data}
              rowKey={(r) => r.slug}
              onRowClick={(r) => navigate(`/manage/${churchSlug}/credentials/${r.slug}`)}
              empty={{
                title: 'No credentials yet',
                body: 'Add an ordination, licence, certificate or invitation letter, and set its requirements and fee.',
                action: <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Add a credential</button>,
              }}
              columns={[
                {
                  key: 'title',
                  label: 'Title',
                  render: (r) => (
                    <span>
                      <span className="name" style={{ fontWeight: 500 }}>{r.title}</span>
                      <span className="sub dim xs" style={{ display: 'block' }}>{TYPES.find((t) => t.value === r.type)?.label}</span>
                    </span>
                  ),
                },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'acquisition', label: 'Requirements', render: (r) => <span className="small dim">{ACQUISITION[r.acquisition]?.label ?? r.acquisition}</span> },
                { key: 'fee', label: 'Fee', align: 'right', render: (r) => (r.fee ? money(r.fee) : <span className="dim">Free</span>) },
                { key: 'applicationCount', label: 'Applied', align: 'right', render: (r) => r.applicationCount ?? 0 },
                { key: 'issuedCount', label: 'Issued', align: 'right', render: (r) => r.issuedCount ?? 0 },
                {
                  key: 'problems',
                  label: '',
                  render: (r) =>
                    r.status !== 'published' && r.problems?.length ? (
                      <span className="pill pill-wait" title={r.problems.join('\n')}>
                        <AlertTriangle size={11} strokeWidth={2} /> {r.problems.length}
                      </span>
                    ) : null,
                },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New credential"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!form.title.trim()} onClick={create}>Create draft</button>
          </>
        }
      >
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ordained Minister" autoFocus />
        <Select
          label="Kind"
          help={`Sets what this must satisfy, and lists it under ${outcomeLabel(outcomesForType(form.type)[0]?.value)}.`}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          options={TYPES}
        />
      </Dialog>
    </>
  );
};

/* --- the builder -------------------------------------------------------- */

export const CredentialEditor = () => {
  const { churchSlug, slug } = useParams();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/offerings/${slug}`);

  const [draft, setDraft] = useState(null);
  const [savedProblems, setSavedProblems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('what');

  useEffect(() => { if (data?.offering) { setDraft(data.offering); setSavedProblems(data.problems ?? []); } }, [data]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setRequires = (patch) => setDraft((d) => ({ ...d, requires: { ...d.requires, ...patch } }));

  const confersStanding = CONFERS_STANDING.includes(draft?.type);
  const hasDecision = Boolean(draft?.requires?.review?.required || draft?.requires?.interview?.required);

  const save = async () => {
    setBusy(true);
    try {
      const payload = draft.type === 'ordination'
        ? {
            ...draft,
            requires: {
              ...draft.requires,
              interview: { ...draft.requires?.interview, required: true, faceToFace: true },
            },
          }
        : draft;
      const saved = await api.patch(`/manage/${churchSlug}/offerings/${slug}`, payload);
      setDraft(saved.offering);
      setSavedProblems(saved.problems ?? []);
      ok('Saved');
      return saved;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const saved = await save();
    if (!saved) return;
    try {
      await api.post(`/manage/${churchSlug}/offerings/${slug}/status`, { status: 'published' });
      ok('Published — people can apply now');
      await reload();
    } catch (err) {
      if (err.data?.problems) setSavedProblems(err.data.problems);
      fail(err);
    }
  };

  const unpublish = async () => {
    try {
      await api.post(`/manage/${churchSlug}/offerings/${slug}/status`, { status: 'draft' });
      ok('Back to draft');
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  if (loading || !draft) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  const problems = savedProblems ?? data.problems ?? [];
  const options = data.options ?? {};

  const TABS = [
    { key: 'what', label: 'Details' },
    { key: 'requires', label: 'Requirements' },
    { key: 'apply', label: 'Application' },
    { key: 'award', label: 'Certificate' },
  ];

  return (
    <>
      <ConsoleHeader title={draft.title} sub={`${TYPES.find((t) => t.value === draft.type)?.label} · ${draft.slug}`}>
        <StatusPill status={draft.status} />
        {draft.status === 'published' ? (
          <>
            <Link className="btn btn-ghost btn-sm" to={`/listing/${draft.slug}`}>
              View <ExternalLink size={14} strokeWidth={1.8} />
            </Link>
            <button type="button" className="btn btn-outline btn-sm" onClick={unpublish}>Unpublish</button>
          </>
        ) : null}
        <button type="button" className="btn btn-outline btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {draft.status !== 'published' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={publish} disabled={busy}>Publish</button>
        ) : null}
      </ConsoleHeader>

      <div className="console-body">
        {confersStanding && !hasDecision ? (
          <div className="notice notice-gold">
            <strong>Not ready to publish</strong>
            <p style={{ margin: '4px 0 0' }}>
              A credential is never issued on payment alone. Require a review of the applicant, an interview, or
              both — under <button type="button" className="link" onClick={() => setTab('requires')}>Requirements</button>.
              The fee begins an application; it does not confer the title.
            </p>
          </div>
        ) : null}

        <Problems problems={problems} />
        <p className="small muted">Saved changes apply to new applications. Existing applicants keep the requirements and fee they started with.</p>

        {data.dependants?.length ? (
          <div className="notice">
            <strong>{data.dependants.length} listing{data.dependants.length === 1 ? '' : 's'} at other churches require this.</strong>{' '}
            {data.dependants.map((d) => d.title).join(', ')}. Its address will not change, so those keep working.
          </div>
        ) : null}

        <div className="row" style={{ gap: 4, borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn btn-ghost btn-sm ${tab === t.key ? 'strong' : 'muted'}`}
              style={tab === t.key ? { borderBottom: '2px solid var(--blue-700)', borderRadius: 0 } : { borderRadius: 0 }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'what' ? <WhatItIs draft={draft} set={set} /> : null}
        {tab === 'requires' ? <WhatYouRequire draft={draft} set={set} setRequires={setRequires} options={options} churchSlug={churchSlug} /> : null}
        {tab === 'apply' ? <TheApplication draft={draft} set={set} /> : null}
        {tab === 'award' ? <TheDocument draft={draft} set={set} /> : null}
      </div>
    </>
  );
};

const WhatItIs = ({ draft, set }) => {
  // The comparison page follows from the kind, so changing the kind moves the
  // listing with it. A letter of standing is the one kind that sits in two.
  const buckets = outcomesForType(draft.type);
  const setType = (type) => {
    const allowed = outcomesForType(type);
    set({ type, outcome: allowed.some((o) => o.value === draft.outcome) ? draft.outcome : allowed[0]?.value });
  };

  return (
    <Panel>
      <div className="a-form">
        <div className="a-row">
          <Input label="Title" value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
          <Select
            label="Kind"
            help="What it is. Sets what it must satisfy before it can be issued."
            value={draft.type}
            onChange={(e) => setType(e.target.value)}
            options={TYPES}
          />
          {buckets.length > 1 ? (
            <Select
              label="Compared under"
              help="Either page fits this kind. Pick where applicants should find it."
              value={draft.outcome}
              onChange={(e) => set({ outcome: e.target.value })}
              options={buckets}
            />
          ) : (
            <Field label="Compared under" help="Follows from the kind. This is the page applicants compare churches on.">
              <p className="a-static">{outcomeLabel(draft.outcome)}</p>
            </Field>
          )}
        </div>

        <Input
          label="Subtitle"
          value={draft.subtitle ?? ''}
          onChange={(e) => set({ subtitle: e.target.value })}
          placeholder="Full pastoral formation, a credential review, and ordination in Kampala."
        />

        <ParagraphEditor
          label="Description"
          help="Who it is for and what it involves."
          value={draft.description ?? []}
          onChange={(description) => set({ description })}
        />

        <Textarea
          label="Important information"
          help="Required. Shown on the listing and the certificate, alongside our standard notices."
          rows={4}
          value={draft.disclosure ?? ''}
          onChange={(e) => set({ disclosure: e.target.value })}
          placeholder="Ordination is granted by this church, on its own authority. What civil authority it carries varies by country and you should check locally."
        />

        <div className="a-row">
          <Select
            label="Level"
            help="Where this sits in your progression."
            value={draft.tier ?? 'other'}
            onChange={(e) => set({ tier: e.target.value })}
            options={TIERS}
          />
          <Input
            label="Credit units"
            type="number"
            help="Credits earned toward larger awards."
            value={draft.creditValue ?? ''}
            onChange={(e) => set({ creditValue: Number(e.target.value) || undefined })}
          />
        </div>

        {draft.type === 'invitation-letter' ? (
          <fieldset style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 'var(--s-4)' }}>
            <legend className="eyebrow">Travel details</legend>
            <div className="a-row">
              <Input label="Country" value={draft.letter?.destinationCountry ?? ''} onChange={(e) => set({ letter: { ...draft.letter, destinationCountry: e.target.value } })} />
              <Input label="City" value={draft.letter?.destinationCity ?? ''} onChange={(e) => set({ letter: { ...draft.letter, destinationCity: e.target.value } })} />
              <Input label="Valid for (months)" type="number" value={draft.letter?.validityMonths ?? ''} onChange={(e) => set({ letter: { ...draft.letter, validityMonths: Number(e.target.value) || undefined } })} />
            </div>
            <Input label="Purpose of the visit" value={draft.letter?.purpose ?? ''} onChange={(e) => set({ letter: { ...draft.letter, purpose: e.target.value } })} />
            <Textarea label="What your church commits to as host" rows={2} value={draft.letter?.hostCommitment ?? ''} onChange={(e) => set({ letter: { ...draft.letter, hostCommitment: e.target.value } })} />
            <p className="muted small" style={{ marginBottom: 0 }}>
              Kingdom Network states on every letter that it is a supporting document, is not a visa, and does not
              guarantee one will be granted.
            </p>
          </fieldset>
        ) : null}
      </div>
    </Panel>
  );
};

const PrerequisitePicker = ({ value = [], onChange, options = [], exclude }) => {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState({});
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);
  const { data, loading, error, reload } = useApi(`/search?q=${encodeURIComponent(query)}&limit=12`, { skip: query.length < 2 });
  const by = { ...Object.fromEntries(options.map((o) => [o.slug, o])), ...picked };
  const found = (data?.offerings ?? []).filter((o) => o.slug !== exclude && !value.includes(o.slug));
  return (
    <div className="stack stack-3">
      {value.map((slug) => (
        <div key={slug} className="prerequisite-choice">
          <span className="stack">
            <strong className="small">{by[slug]?.title ?? 'Unavailable prerequisite'}</strong>
            <span className="dim xs">{by[slug]?.church?.shortName ?? by[slug]?.churchSlug ?? 'Remove this choice and select a published credential.'}</span>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${by[slug]?.title ?? 'prerequisite'}`} onClick={() => onChange(value.filter((s) => s !== slug))}>Remove</button>
        </div>
      ))}
      <Input label="Search credentials across churches" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Preaching certificate, ordination…" help="Type at least two characters, then choose a credential." />
      <div aria-live="polite">
        {loading && query.length >= 2 ? <p className="small muted">Searching credentials…</p> : null}
        {error ? <p className="small">Could not search credentials. <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>Try again</button></p> : null}
        {!loading && !error && query.length >= 2 && !found.length ? <p className="small muted">No other published credentials match. Try a different name.</p> : null}
      </div>
      {query.length >= 2 && !loading ? found.map((o) => (
        <button key={o.slug} type="button" className="prerequisite-choice prerequisite-result" onClick={() => {
          setPicked((p) => ({ ...p, [o.slug]: o })); onChange([...value, o.slug]); setTerm(''); setQuery('');
        }}>
          <span className="stack"><strong className="small">{o.title}</strong><span className="dim xs">{o.church?.shortName ?? o.churchSlug}</span></span>
          <Plus size={16} aria-hidden="true" />
        </button>
      )) : null}
    </div>
  );
};

const WhatYouRequire = ({ draft, set, setRequires, options, churchSlug }) => {
  const r = draft.requires ?? {};
  const [preview, setPreview] = useState(null);

  const runPreview = async () => {
    try {
      setPreview(await api.post(`/manage/${churchSlug}/offerings/preview`, draft));
    } catch {
      setPreview(null);
    }
  };
  useEffect(() => { runPreview(); /* eslint-disable-next-line */ }, [JSON.stringify(draft.requires), draft.type, draft.fee?.amount]);

  return (
    <div className="credential-requirements-grid">
      <div className="stack stack-4">
        <Panel title="Church review">
          <p className="muted small" style={{ marginTop: 0 }}>
            Every service requires a church decision. Ordination also requires a live face-to-face interview.
          </p>
          <div className="stack stack-4">
            <Switch
              label="Church reviews the application"
              help="Read the application and decide."
              checked={r.review?.required}
              onChange={(required) => setRequires({ review: { ...r.review, required } })}
            />
            {r.review?.required ? (
              <div className="a-row" style={{ paddingLeft: 52 }}>
                <Input
                  label="Turnaround (days)"
                  type="number"
                  value={r.review?.turnaroundDays ?? ''}
                  onChange={(e) => setRequires({ review: { ...r.review, turnaroundDays: Number(e.target.value) || undefined } })}
                />
              </div>
            ) : null}

            <Switch
              label="Interview the applicant"
              help={draft.type === 'ordination'
                ? 'Required for ordination. The meeting must be by live video or in person.'
                : 'Publish your availability and applicants book a slot. Works with video, phone or an in-person meeting.'}
              checked={draft.type === 'ordination' || r.interview?.required}
              disabled={draft.type === 'ordination'}
              onChange={(required) => setRequires({ interview: { ...r.interview, required } })}
            />
            {(draft.type === 'ordination' || r.interview?.required) ? (
              <div style={{ paddingLeft: 52 }} className="stack stack-3">
                <div className="a-row">
                  <Input label="Duration (minutes)" type="number" value={r.interview?.durationMinutes ?? 30} onChange={(e) => setRequires({ interview: { ...r.interview, durationMinutes: Number(e.target.value) } })} />
                  <Input label="Panel size" type="number" value={r.interview?.panelSize ?? 1} onChange={(e) => setRequires({ interview: { ...r.interview, panelSize: Number(e.target.value) } })} />
                </div>
                <Textarea label="Instructions for the applicant" rows={2} value={r.interview?.instructions ?? ''} onChange={(e) => setRequires({ interview: { ...r.interview, instructions: e.target.value } })} />
                <Link className="link small" to={`/manage/${churchSlug}/interviews`}>Add availability →</Link>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Coursework">
          <p className="muted small" style={{ marginTop: 0 }}>Courses that must be completed first.</p>
          <div className="stack stack-3">
            {(options.courses ?? []).length ? (
              options.courses.map((c) => (
                <Checkbox
                  key={c.slug}
                  label={c.title}
                  help={c.status !== 'published' ? 'Not published yet — applicants will not be able to take it.' : undefined}
                  checked={(r.courses ?? []).includes(c.slug)}
                  onChange={(on) => setRequires({ courses: on ? [...(r.courses ?? []), c.slug] : (r.courses ?? []).filter((s) => s !== c.slug) })}
                />
              ))
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                You have not built any coursework. <Link to={`/manage/${churchSlug}/courses`}>Build a course →</Link>
              </p>
            )}
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 'var(--s-4) 0' }} />

          <label className="eyebrow">Or a group of courses</label>
          <RepeatableList
            items={r.courseGroups ?? []}
            onChange={(courseGroups) => setRequires({ courseGroups })}
            makeItem={() => ({ key: crypto.randomUUID(), label: '', mode: 'atLeast', count: 2, courseSlugs: [] })}
            addLabel="Add a group"
            title={(g) => g.label || 'A choice of courses'}
            empty="For example, any two of four courses, or a number of credits."
            renderItem={(group, i, update) => (
              <>
                <Input label="Group name" value={group.label ?? ''} onChange={(e) => update({ ...group, label: e.target.value })} placeholder="Any two electives" />
                <div className="a-row">
                  <Select
                    label="How many required"
                    value={group.mode}
                    onChange={(e) => update({ ...group, mode: e.target.value })}
                    options={[{ value: 'all', label: 'All of them' }, { value: 'any', label: 'Any one' }, { value: 'atLeast', label: 'At least…' }]}
                  />
                  {group.mode === 'atLeast' ? (
                    <>
                      <Input label="Number required" type="number" value={group.count ?? 1} onChange={(e) => update({ ...group, count: Number(e.target.value) })} />
                      <Input label="Or credits required" type="number" value={group.creditUnits ?? ''} onChange={(e) => update({ ...group, creditUnits: Number(e.target.value) || undefined })} />
                    </>
                  ) : null}
                </div>
                <div className="stack stack-2">
                  {(options.courses ?? []).map((c) => (
                    <Checkbox
                      key={c.slug}
                      label={c.title}
                      checked={(group.courseSlugs ?? []).includes(c.slug)}
                      onChange={(on) => update({ ...group, courseSlugs: on ? [...(group.courseSlugs ?? []), c.slug] : (group.courseSlugs ?? []).filter((s) => s !== c.slug) })}
                    />
                  ))}
                </div>
              </>
            )}
          />
        </Panel>

        <Panel title="Prerequisites">
          <p className="muted small" style={{ marginTop: 0 }}>
            From any church, including your own.
          </p>

          <PrerequisitePicker value={r.credentials ?? []} onChange={(credentials) => setRequires({ credentials })} options={options.prerequisites} exclude={draft.slug} />

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 'var(--s-4) 0' }} />

          <label className="eyebrow">Or a group of prerequisites</label>
          <RepeatableList
            items={r.credentialGroups ?? []}
            onChange={(credentialGroups) => setRequires({ credentialGroups })}
            makeItem={() => ({ key: crypto.randomUUID(), label: '', mode: 'atLeast', count: 2, offeringSlugs: [] })}
            addLabel="Add a group"
            title={(g) => g.label || 'A choice of credentials'}
            empty="For example, any three of six certificates."
            renderItem={(group, i, update) => (
              <>
                <Input label="Group name" value={group.label ?? ''} onChange={(e) => update({ ...group, label: e.target.value })} placeholder="Any three foundation certificates" />
                <div className="a-row">
                  <Select
                    label="How many required"
                    value={group.mode}
                    onChange={(e) => update({ ...group, mode: e.target.value })}
                    options={[{ value: 'all', label: 'All of them' }, { value: 'any', label: 'Any one' }, { value: 'atLeast', label: 'At least…' }]}
                  />
                  {group.mode === 'atLeast' ? (
                    <>
                      <Input label="Number required" type="number" value={group.count ?? 1} onChange={(e) => update({ ...group, count: Number(e.target.value) })} />
                      <Input label="Or credits required" type="number" value={group.creditUnits ?? ''} onChange={(e) => update({ ...group, creditUnits: Number(e.target.value) || undefined })} />
                    </>
                  ) : null}
                </div>
                <PrerequisitePicker value={group.offeringSlugs ?? []} onChange={(offeringSlugs) => update({ ...group, offeringSlugs })} options={options.prerequisites} exclude={draft.slug} />
              </>
            )}
          />
        </Panel>

        <Panel title="Assessment">
          <Switch
            label="They sit an assessment"
            checked={r.assessment?.required}
            onChange={(required) => setRequires({ assessment: { ...r.assessment, required } })}
          />
          {r.assessment?.required ? (
            <div className="stack stack-3" style={{ paddingLeft: 52, marginTop: 12 }}>
              <Select
                label="Which paper"
                placeholder="Choose one you have written"
                value={draft.assessmentSlug ?? ''}
                onChange={(e) => set({ assessmentSlug: e.target.value })}
                options={(options.assessments ?? []).map((a) => ({
                  value: a.slug,
                  label: `${a.title} — ${a.questionCount} questions${a.status !== 'published' ? ' (draft)' : ''}`,
                }))}
                help={
                  (options.assessments ?? []).length
                    ? undefined
                    : 'You have not written a paper yet.'
                }
              />
              <Link className="link small" to={`/manage/${churchSlug}/assessments`}>Write a paper →</Link>
              <p className="small muted">These settings override the paper for this application. Leave a field empty to use the paper’s setting. Attempts are counted separately for each application.</p>
              <div className="a-row">
                <Input label="Pass mark (%)" type="number" value={r.assessment?.passMark ?? ''} onChange={(e) => setRequires({ assessment: { ...r.assessment, passMark: e.target.value === '' ? null : Number(e.target.value) } })} />
                <Input label="Time allowed (minutes)" type="number" value={r.assessment?.minutes ?? ''} onChange={(e) => setRequires({ assessment: { ...r.assessment, minutes: e.target.value === '' ? null : Number(e.target.value) } })} />
                <Input label="Attempts" type="number" value={r.assessment?.attemptsAllowed ?? ''} onChange={(e) => setRequires({ assessment: { ...r.assessment, attemptsAllowed: e.target.value === '' ? null : Number(e.target.value) } })} />
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="Documents and references">
          <label className="eyebrow">Documents</label>
          <RepeatableList
            items={r.documents ?? []}
            onChange={(documents) => setRequires({ documents })}
            makeItem={() => ({ key: `doc-${Date.now()}`, label: '', description: '', required: true })}
            addLabel="Ask for a document"
            title={(d) => d.label || 'A document'}
            empty="Ministry records, identity documents, prior certificates."
            renderItem={(doc, i, update) => (
              <>
                <Input label="Document name" value={doc.label ?? ''} onChange={(e) => update({ ...doc, label: e.target.value })} placeholder="Ministry record" />
                <Input label="Help text" value={doc.description ?? ''} onChange={(e) => update({ ...doc, description: e.target.value })} placeholder="Where you have served, and for how long." />
                <Checkbox label="Required" checked={doc.required !== false} onChange={(required) => update({ ...doc, required })} />
              </>
            )}
          />

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 'var(--s-4) 0' }} />

          <label className="eyebrow">References</label>
          <RepeatableList
            items={r.references ?? []}
            onChange={(references) => setRequires({ references })}
            makeItem={() => ({ key: `ref-${Date.now()}`, label: '', relationship: '', required: true })}
            addLabel="Ask for a reference"
            title={(x) => x.label || 'A reference'}
            empty="Referees receive an email link. No account required."
            renderItem={(ref, i, update) => (
              <div className="a-row">
                <Input label="Reference name" value={ref.label ?? ''} onChange={(e) => update({ ...ref, label: e.target.value })} placeholder="Reference from your senior leader" />
                <Input label="Relationship" value={ref.relationship ?? ''} onChange={(e) => update({ ...ref, relationship: e.target.value })} placeholder="senior leader" />
              </div>
            )}
          />

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 'var(--s-4) 0' }} />

          <label className="eyebrow">Things they must agree to</label>
          <RepeatableList
            items={r.attestations ?? []}
            onChange={(attestations) => setRequires({ attestations })}
            makeItem={() => ({ key: `att-${Date.now()}`, statement: '', required: true })}
            addLabel="Add a statement"
            title={(x) => x.statement?.slice(0, 60) || 'A statement'}
            empty="For example a statement of faith, code of conduct or safeguarding policy."
            renderItem={(att, i, update) => (
              <Textarea label="Statement" rows={2} value={att.statement ?? ''} onChange={(e) => update({ ...att, statement: e.target.value })} />
            )}
          />
        </Panel>

        <Panel title="Eligibility">
          <div className="a-row">
            <Input label="Minimum months in ministry" type="number" value={r.minMonthsInMinistry ?? ''} onChange={(e) => setRequires({ minMonthsInMinistry: Number(e.target.value) || undefined })} />
            <Input label="Minimum age" type="number" value={r.minAge ?? ''} onChange={(e) => setRequires({ minAge: Number(e.target.value) || undefined })} />
          </div>
          <ParagraphEditor
            label="Other requirements"
            value={r.eligibility ?? []}
            onChange={(eligibility) => setRequires({ eligibility })}
            placeholder="No unresolved disciplinary matter"
          />
        </Panel>
      </div>

      <aside style={{ position: 'sticky', top: 'var(--s-5)' }}>
        <Panel title="Applicant preview">
          {preview ? (
            <>
              <p className="dim xs" style={{ marginTop: 0 }}>
                Shown on the listing as <b>{preview.acquisition}</b>
              </p>
              <div className="checklist">
                {preview.steps.map((s) => (
                  <div key={s.key} className="check-step">
                    <span className="mark" />
                    <span className="body">
                      <span className="label">{s.label}</span>
                      {s.detail ? <span className="detail">{s.detail}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
              {preview.eligibility?.length ? (
                <>
                  <p className="eyebrow" style={{ marginTop: 16 }}>Additional requirements</p>
                  <ul className="a-problems small">{preview.eligibility.map((e) => <li key={e}>{e}</li>)}</ul>
                </>
              ) : null}
            </>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>Add a requirement and the checklist appears here.</p>
          )}
        </Panel>
      </aside>
    </div>
  );
};

const TheApplication = ({ draft, set }) => (
  <div className="stack stack-4">
    <Panel title="The fee">
      <p className="muted small" style={{ marginTop: 0 }}>
        Covers your assessment of the application. It does not guarantee the credential.
      </p>
      <div className="a-row">
        <Money label="Amount" value={draft.fee?.amount ?? 0} onChange={(amount) => set({ fee: { ...draft.fee, amount }, price: amount })} />
        <Input label="Label" value={draft.fee?.label ?? 'Application fee'} onChange={(e) => set({ fee: { ...draft.fee, label: e.target.value } })} />
      </div>
      <Textarea
        label="Refund policy"
        help="Required if you charge a fee."
        rows={2}
        value={draft.fee?.refundPolicy ?? ''}
        onChange={(e) => set({ fee: { ...draft.fee, refundPolicy: e.target.value } })}
        placeholder="Refunded in full if you withdraw before we begin the review; not refunded once the board has read your file."
      />
    </Panel>

    <Panel title="Application form">
      <RepeatableList
        items={draft.applicationForm ?? []}
        onChange={(applicationForm) => set({ applicationForm })}
        makeItem={() => ({ key: `q-${Date.now()}`, label: '', type: 'text', required: false })}
        addLabel="Add a question"
        title={(f) => f.label || 'A question'}
        empty="Optional. Anything you want to know that is not a document or a reference."
        renderItem={(field, i, update) => (
          <>
            <Input label="Question" value={field.label ?? ''} onChange={(e) => update({ ...field, label: e.target.value })} />
            <div className="a-row">
              <Select
                label="Answer type"
                value={field.type}
                onChange={(e) => update({ ...field, type: e.target.value })}
                options={[
                  { value: 'text', label: 'A line of text' },
                  { value: 'textarea', label: 'A paragraph' },
                  { value: 'select', label: 'Choose one' },
                  { value: 'number', label: 'A number' },
                  { value: 'date', label: 'A date' },
                  { value: 'checkbox', label: 'Yes or no' },
                ]}
              />
              <Checkbox label="Required" checked={field.required} onChange={(required) => update({ ...field, required })} />
            </div>
            {field.type === 'select' ? (
              <Textarea
                label="The options, one per line"
                rows={3}
                value={(field.options ?? []).join('\n')}
                onChange={(e) => update({ ...field, options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
              />
            ) : null}
            <Input label="Help text" value={field.help ?? ''} onChange={(e) => update({ ...field, help: e.target.value })} />
          </>
        )}
      />
    </Panel>

    <Panel title="Intake">
      <Input label="Total places" type="number" min="1" step="1" help="Limits submitted applications across all intakes. Drafts do not take a place. Declined or withdrawn applications release their place. Leave empty for no limit." value={draft.capacity ?? ''} onChange={(e) => set({ capacity: e.target.value === '' ? null : Number(e.target.value) })} />
      <Select
        label="Intake"
        value={draft.intake?.mode ?? 'rolling'}
        onChange={(e) => set({ intake: { ...draft.intake, mode: e.target.value } })}
        options={[{ value: 'rolling', label: 'Any time' }, { value: 'windows', label: 'Only during a window' }]}
      />
      {draft.intake?.mode === 'windows' ? (
        <RepeatableList
          items={draft.intake?.windows ?? []}
          onChange={(windows) => set({ intake: { ...draft.intake, windows } })}
          makeItem={() => ({ key: crypto.randomUUID(), opensAt: '', closesAt: '', seats: undefined })}
          addLabel="Add a window"
          collapsible={false}
          title={(w) => (w.opensAt ? `${w.opensAt.slice(0, 10)} → ${(w.closesAt ?? '').slice(0, 10)}` : 'New window')}
          renderItem={(w, i, update) => (
            <div className="a-row">
              <Input label="Opens (UTC)" type="date" required value={(w.opensAt ?? '').slice(0, 10)} onChange={(e) => update({ ...w, opensAt: e.target.value })} />
              <Input label="Closes (UTC, end of day)" type="date" required value={(w.closesAt ?? '').slice(0, 10)} onChange={(e) => update({ ...w, closesAt: e.target.value ? `${e.target.value}T23:59:59.999Z` : null })} />
              <Input label="Places in this window" type="number" min="1" step="1" help="Leave empty for no window limit." value={w.seats ?? ''} onChange={(e) => update({ ...w, seats: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
          )}
        />
      ) : null}
    </Panel>
  </div>
);

const TheDocument = ({ draft, set }) => (
  <div className="stack stack-4">
    <Panel title="Certificate details">
      <div className="a-row">
        <Input label="Title awarded" value={draft.award?.title ?? ''} onChange={(e) => set({ award: { ...draft.award, title: e.target.value } })} placeholder="Ordained Minister" />
        <Input label="Post-nominal" value={draft.award?.postNominal ?? ''} onChange={(e) => set({ award: { ...draft.award, postNominal: e.target.value } })} placeholder="Rev." />
      </div>
      <Input label="Document heading" value={draft.award?.documentTitle ?? ''} onChange={(e) => set({ award: { ...draft.award, documentTitle: e.target.value } })} placeholder="Certificate of Ordination" />
      <Textarea label="Document wording" rows={3} value={draft.award?.documentBody ?? ''} onChange={(e) => set({ award: { ...draft.award, documentBody: e.target.value } })} />
      <div className="a-row">
        <Input label="Valid for (months)" type="number" help="Leave empty for no expiry." value={draft.award?.validityMonths ?? ''} onChange={(e) => set({ award: { ...draft.award, validityMonths: Number(e.target.value) || undefined } })} />
        <Checkbox label="Can be renewed" checked={draft.award?.renewable} onChange={(renewable) => set({ award: { ...draft.award, renewable } })} />
      </div>
    </Panel>

    <Panel title="Renewal">
      <Switch label="Requires renewal" checked={draft.renewal?.required} onChange={(required) => set({ renewal: { ...draft.renewal, required } })} />
      {draft.renewal?.required ? (
        <div className="a-row" style={{ marginTop: 12 }}>
          <Input label="Every (months)" type="number" value={draft.renewal?.everyMonths ?? 12} onChange={(e) => set({ renewal: { ...draft.renewal, everyMonths: Number(e.target.value) } })} />
          <Input label="Hours of study each time" type="number" value={draft.renewal?.continuingEducationHours ?? ''} onChange={(e) => set({ renewal: { ...draft.renewal, continuingEducationHours: Number(e.target.value) || undefined } })} />
          <Money label="Renewal fee" value={draft.fee?.renewalAmount} onChange={(renewalAmount) => set({ fee: { ...draft.fee, renewalAmount } })} />
        </div>
      ) : null}
    </Panel>
  </div>
);
