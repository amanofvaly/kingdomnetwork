import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import {
  Checkbox, DataTable, Dialog, FileDrop, Input, Money, Panel, ParagraphEditor,
  RepeatableList, Select, StatusPill, Textarea,
} from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { duration, money } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

const KINDS = [
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'reading', label: 'Reading' },
  { value: 'quiz', label: 'Knowledge check' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'live-session', label: 'Live session' },
];

export const Courses = () => {
  const { churchSlug } = useOutletContext();
  const navigate = useNavigate();
  const { fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/courses`);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const create = async () => {
    try {
      const course = await api.post(`/manage/${churchSlug}/courses`, { title });
      navigate(`/manage/${churchSlug}/courses/${course.slug}`);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <ConsoleHeader title="Coursework" sub={data ? `${data.length} course${data.length === 1 ? '' : 's'}` : ''}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus size={15} strokeWidth={2} /> New course
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
              onRowClick={(r) => navigate(`/manage/${churchSlug}/courses/${r.slug}`)}
              empty={{
                title: 'No coursework yet',
                body: 'Add sections and lessons with video, audio, reading and quizzes.',
                action: <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Build one</button>,
              }}
              columns={[
                { key: 'title', label: 'Course' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'level', label: 'Level', render: (r) => <span className="dim small">{r.level}</span> },
                { key: 'lectureCount', label: 'Lessons', align: 'right' },
                { key: 'totalMinutes', label: 'Length', align: 'right', render: (r) => (r.totalMinutes ? duration(r.totalMinutes) : '—') },
                { key: 'price', label: 'Price', align: 'right', render: (r) => (r.price ? money(r.price) : <span className="dim">Free</span>) },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New course"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!title.trim()} onClick={create}>Create</button>
          </>
        }
      >
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Foundations of Pastoral Theology" />
      </Dialog>
    </>
  );
};

export const CourseEditor = () => {
  const { churchSlug, slug } = useParams();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/courses/${slug}`);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(null);

  useEffect(() => { if (data?.course) setDraft(data.course); }, [data]);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      setDraft(await api.patch(`/manage/${churchSlug}/courses/${slug}`, draft));
      ok('Saved');
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    if (!(await save())) return;
    try {
      await api.post(`/manage/${churchSlug}/courses/${slug}/status`, { status });
      ok(status === 'published' ? 'Published' : 'Back to draft');
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  const uploadMedia = async (file, sectionIdx, lectureIdx) => {
    const key = `${sectionIdx}-${lectureIdx}`;
    setUploading(key);
    try {
      const kind = file.type.startsWith('audio') ? 'audio' : file.type.startsWith('video') ? 'video' : 'document';
      const asset = await api.upload(`/manage/${churchSlug}/media`, file, {
        headers: { 'x-media-kind': kind, 'x-media-folder': 'lessons' },
      });
      const curriculum = draft.curriculum.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          lectures: s.lectures.map((l, li) => (li !== lectureIdx ? l : { ...l, mediaId: asset.id, source: asset.url })),
        },
      );
      set({ curriculum });
      ok('Attached');
    } catch (err) {
      fail(err);
    } finally {
      setUploading(null);
    }
  };

  if (loading || !draft) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <>
      <ConsoleHeader title={draft.title} sub={`${draft.lectureCount ?? 0} lessons · ${duration(draft.totalMinutes ?? 0)}`}>
        <StatusPill status={draft.status} />
        {draft.status === 'published' ? (
          <a className="btn btn-ghost btn-sm" href={`/courses/${draft.slug}`} target="_blank" rel="noreferrer">
            View <ExternalLink size={14} strokeWidth={1.8} />
          </a>
        ) : null}
        <button type="button" className="btn btn-outline btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(draft.status === 'published' ? 'draft' : 'published')}>
          {draft.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
      </ConsoleHeader>

      <div className="console-body">
        {data.dependants?.length ? (
          <div className="notice">
            <strong>{data.dependants.length} credential{data.dependants.length === 1 ? '' : 's'} require this course.</strong>{' '}
            {data.dependants.map((d) => d.title).join(', ')}
          </div>
        ) : null}

        <Panel title="About the course">
          <div className="a-form">
            <Input label="Title" value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
            <Input label="Subtitle" value={draft.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} />
            <ParagraphEditor label="Description" value={draft.description ?? []} onChange={(description) => set({ description })} />
            <div className="a-row">
              <Input label="Subject" value={draft.category ?? ''} onChange={(e) => set({ category: e.target.value })} placeholder="Pastoral Ministry" />
              <Select label="Level" value={draft.level ?? 'All levels'} onChange={(e) => set({ level: e.target.value })} options={['Beginner', 'Intermediate', 'Advanced', 'All levels']} />
              <Money label="Price" value={draft.price ?? 0} onChange={(price) => set({ price })} />
              <Input label="Credit units" type="number" value={draft.creditUnits ?? ''} onChange={(e) => set({ creditUnits: Number(e.target.value) || undefined })} />
            </div>
            <ParagraphEditor label="Learning outcomes" value={draft.outcomes ?? []} onChange={(outcomes) => set({ outcomes })} placeholder="Build a chart of accounts appropriate to a congregation" />
            <div className="a-field">
              <label>Cover image</label>
              {draft.coverImage ? (
                <div className="stack stack-2">
                  <img src={draft.coverImage} alt="" style={{ width: 260, borderRadius: 'var(--r-md)', aspectRatio: '3/2', objectFit: 'cover' }} />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ coverImage: undefined })}>Remove</button>
                </div>
              ) : (
                <FileDrop
                  label="Add a cover image"
                  busy={uploading === 'cover'}
                  onFile={async (file) => {
                    setUploading('cover');
                    try {
                      const asset = await api.upload(`/manage/${churchSlug}/media`, file, { headers: { 'x-media-kind': 'image', 'x-media-folder': 'courses' } });
                      set({ coverImage: asset.url });
                    } catch (err) { fail(err); } finally { setUploading(null); }
                  }}
                />
              )}
            </div>
          </div>
        </Panel>

        <Panel title="The curriculum">
          <p className="muted small" style={{ marginTop: 0 }}>
            Renaming a section or lesson is safe. Learner progress is unaffected.
          </p>
          <RepeatableList
            items={draft.curriculum ?? []}
            onChange={(curriculum) => set({ curriculum })}
            makeItem={() => ({ title: '', summary: '', lectures: [] })}
            addLabel="Add a section"
            title={(s) => s.title || 'New section'}
            empty="No sections yet."
            renderItem={(section, si, updateSection) => (
              <>
                <div className="a-row">
                  <Input label="Section title" value={section.title ?? ''} onChange={(e) => updateSection({ ...section, title: e.target.value })} />
                  <Input label="Summary" value={section.summary ?? ''} onChange={(e) => updateSection({ ...section, summary: e.target.value })} />
                </div>

                <RepeatableList
                  items={section.lectures ?? []}
                  onChange={(lectures) => updateSection({ ...section, lectures })}
                  makeItem={() => ({ title: '', kind: 'video', minutes: 10, body: [], questions: [] })}
                  addLabel="Add a lesson"
                  title={(l) => l.title || 'New lesson'}
                  empty="No lessons in this section."
                  renderItem={(lecture, li, updateLecture) => (
                    <>
                      <div className="a-row">
                        <Input label="Lesson title" value={lecture.title ?? ''} onChange={(e) => updateLecture({ ...lecture, title: e.target.value })} />
                        <Select label="Kind" value={lecture.kind} onChange={(e) => updateLecture({ ...lecture, kind: e.target.value })} options={KINDS} />
                        <Input label="Minutes" type="number" value={lecture.minutes ?? 0} onChange={(e) => updateLecture({ ...lecture, minutes: Number(e.target.value) })} />
                      </div>
                      <Checkbox label="Anyone can preview this lesson" checked={lecture.preview} onChange={(preview) => updateLecture({ ...lecture, preview })} />

                      {['video', 'audio'].includes(lecture.kind) ? (
                        lecture.source ? (
                          <div className="row row-between panel" style={{ padding: '8px 12px' }}>
                            <span className="small clamp-1">Media attached</span>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateLecture({ ...lecture, source: undefined, mediaId: undefined })}>Remove</button>
                          </div>
                        ) : (
                          <FileDrop
                            label={`Attach the ${lecture.kind}`}
                            hint={lecture.kind === 'audio' ? 'MP3, M4A or OGG' : 'MP4 or WebM'}
                            accept={lecture.kind === 'audio' ? 'audio/*' : 'video/*'}
                            busy={uploading === `${si}-${li}`}
                            onFile={(file) => uploadMedia(file, si, li)}
                          />
                        )
                      ) : null}

                      {lecture.kind === 'reading' || lecture.kind === 'video' || lecture.kind === 'audio' ? (
                        <ParagraphEditor
                          label={lecture.kind === 'reading' ? 'The lesson' : 'Lesson notes'}
                          help={lecture.kind === 'reading' ? undefined : 'Shown below the player, and used as the full lesson on slow connections.'}
                          value={lecture.body ?? []}
                          onChange={(body) => updateLecture({ ...lecture, body })}
                        />
                      ) : null}

                      {lecture.kind === 'quiz' ? (
                        <RepeatableList
                          items={lecture.questions ?? []}
                          onChange={(questions) => updateLecture({ ...lecture, questions })}
                          makeItem={() => ({ prompt: '', options: ['', ''], answer: 0, explanation: '' })}
                          addLabel="Add a question"
                          collapsible={false}
                          title={(q) => q.prompt || 'New question'}
                          renderItem={(q, qi, updateQ) => (
                            <>
                              <Input label="Question" value={q.prompt ?? ''} onChange={(e) => updateQ({ ...q, prompt: e.target.value })} />
                              <Textarea
                                label="Options, one per line"
                                rows={4}
                                value={(q.options ?? []).join('\n')}
                                onChange={(e) => updateQ({ ...q, options: e.target.value.split('\n') })}
                              />
                              <Select
                                label="Correct answer"
                                value={String(q.answer ?? 0)}
                                onChange={(e) => updateQ({ ...q, answer: Number(e.target.value) })}
                                options={(q.options ?? []).map((o, i) => ({ value: String(i), label: o || `Option ${i + 1}` }))}
                              />
                              <Input label="Explanation" value={q.explanation ?? ''} onChange={(e) => updateQ({ ...q, explanation: e.target.value })} />
                            </>
                          )}
                        />
                      ) : null}

                      {lecture.kind === 'assignment' ? (
                        <>
                          <Textarea label="Assignment brief" rows={3} value={lecture.assignment?.brief ?? ''} onChange={(e) => updateLecture({ ...lecture, assignment: { ...lecture.assignment, brief: e.target.value } })} />
                          <Textarea
                            label="Marking criteria, one per line"
                            rows={3}
                            value={(lecture.assignment?.rubric ?? []).map((r) => r.criterion ?? r).join('\n')}
                            onChange={(e) => updateLecture({ ...lecture, assignment: { ...lecture.assignment, rubric: e.target.value.split('\n').filter(Boolean).map((criterion) => ({ criterion, outOf: 5 })) } })}
                          />
                        </>
                      ) : null}

                      {lecture.kind === 'live-session' ? (
                        <div className="a-row">
                          <Input label="When" type="datetime-local" value={(lecture.liveSession?.startsAt ?? '').slice(0, 16)} onChange={(e) => updateLecture({ ...lecture, liveSession: { ...lecture.liveSession, startsAt: e.target.value } })} />
                          <Input label="Joining link" value={lecture.liveSession?.joinUrl ?? ''} onChange={(e) => updateLecture({ ...lecture, liveSession: { ...lecture.liveSession, joinUrl: e.target.value } })} placeholder="https://…" />
                        </div>
                      ) : null}
                    </>
                  )}
                />
              </>
            )}
          />
        </Panel>
      </div>
    </>
  );
};
