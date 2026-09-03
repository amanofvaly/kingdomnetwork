import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Checkbox, DataTable, Dialog, Input, Panel, ParagraphEditor, Problems, RepeatableList, Select, StatusPill, Textarea } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

/**
 * A church writes its own papers.
 *
 * The catalogue used to share one bank of ten questions between every church
 * on the platform, and silently cut every paper down to ten questions no matter
 * what a listing claimed to ask.
 */

const TYPES = [
  { value: 'single', label: 'One right answer' },
  { value: 'multiple', label: 'Several right answers' },
  { value: 'true-false', label: 'True or false' },
  { value: 'short-answer', label: 'A short written answer' },
  { value: 'essay', label: 'An essay you mark yourself' },
];

export const Assessments = () => {
  const { churchSlug } = useOutletContext();
  const navigate = useNavigate();
  const { fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/assessments`);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const create = async () => {
    try {
      const created = await api.post(`/manage/${churchSlug}/assessments`, { title });
      navigate(`/manage/${churchSlug}/assessments/${created.slug}`);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <ConsoleHeader title="Papers" sub={data ? `${data.length} paper${data.length === 1 ? '' : 's'}` : ''}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus size={15} strokeWidth={2} /> New paper
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
              onRowClick={(r) => navigate(`/manage/${churchSlug}/assessments/${r.slug}`)}
              empty={{
                title: 'No papers yet',
                body: 'Set your own questions, pass mark, time limit and number of attempts.',
                action: <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Write one</button>,
              }}
              columns={[
                { key: 'title', label: 'Paper' },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'questionCount', label: 'Questions', align: 'right' },
                { key: 'passMark', label: 'Pass mark', align: 'right', render: (r) => `${r.passMark}%` },
                { key: 'durationMinutes', label: 'Time', align: 'right', render: (r) => `${r.durationMinutes} min` },
                { key: 'needsGrading', label: '', render: (r) => (r.needsGrading ? <span className="pill pill-wait">You mark it</span> : null) },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New assessment"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!title.trim()} onClick={create}>Create</button>
          </>
        }
      >
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Ordination paper" />
      </Dialog>
    </>
  );
};

export const AssessmentEditor = () => {
  const { churchSlug, slug } = useParams();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/assessments/${slug}`);
  const [draft, setDraft] = useState(null);
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data?.assessment) setDraft(data.assessment); }, [data]);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.patch(`/manage/${churchSlug}/assessments/${slug}`, draft);
      setDraft(saved.assessment);
      setProblems(saved.problems ?? []);
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
      await api.post(`/manage/${churchSlug}/assessments/${slug}/status`, { status: 'published' });
      ok('Published');
      await reload();
    } catch (err) {
      fail(err);
      setProblems(err.data?.problems ?? problems);
    }
  };

  if (loading || !draft) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  const total = (draft.questions ?? []).reduce((n, q) => n + (q.points ?? 1), 0);

  return (
    <>
      <ConsoleHeader title={draft.title} sub={`${draft.questions?.length ?? 0} questions · ${total} marks`}>
        <StatusPill status={draft.status} />
        <button type="button" className="btn btn-outline btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {draft.status !== 'published' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={publish}>Publish</button>
        ) : null}
      </ConsoleHeader>

      <div className="console-body">
        <Problems problems={problems} />

        {data.usedBy?.length ? (
          <div className="notice">
            <strong>Used by {data.usedBy.map((u) => u.title).join(', ')}.</strong>{' '}
            Editing a question does not change a paper someone has already sat — an attempt keeps the version served
            to them.
          </div>
        ) : null}

        <Panel title="Settings">
          <div className="a-form">
            <Input label="Title" value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
            <ParagraphEditor label="Instructions" value={draft.instructions ?? []} onChange={(instructions) => set({ instructions })} />
            <div className="a-row">
              <Input label="Pass mark (%)" type="number" min="1" max="100" value={draft.passMark ?? 70} onChange={(e) => set({ passMark: Number(e.target.value) })} />
              <Input label="Time allowed (minutes)" type="number" value={draft.durationMinutes ?? 30} onChange={(e) => set({ durationMinutes: Number(e.target.value) })} />
              <Input label="Attempts allowed" type="number" value={draft.attemptsAllowed ?? 3} onChange={(e) => set({ attemptsAllowed: Number(e.target.value) })} />
              <Input
                label="Questions per attempt"
                type="number"
                help="Leave at 0 to use every question."
                value={draft.drawCount ?? 0}
                onChange={(e) => set({ drawCount: Number(e.target.value) })}
              />
            </div>
            <div className="a-row">
              <Checkbox label="Shuffle the questions" checked={draft.shuffleQuestions} onChange={(shuffleQuestions) => set({ shuffleQuestions })} />
              <Checkbox label="Shuffle the options" checked={draft.shuffleOptions} onChange={(shuffleOptions) => set({ shuffleOptions })} />
            </div>
            <Select
              label="Show answers"
              value={draft.showAnswers ?? 'after-each'}
              onChange={(e) => set({ showAnswers: e.target.value })}
              options={[
                { value: 'after-each', label: 'After every attempt' },
                { value: 'after-pass', label: 'Only once they have passed' },
                { value: 'never', label: 'Never' },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Questions">
          <RepeatableList
            items={draft.questions ?? []}
            onChange={(questions) => set({ questions })}
            makeItem={() => ({ type: 'single', prompt: '', options: ['', '', '', ''], answers: [0], points: 1 })}
            addLabel="Add a question"
            title={(q) => q.prompt || 'New question'}
            empty="No questions yet."
            renderItem={(q, i, update) => (
              <>
                <Textarea label="Question" rows={2} value={q.prompt ?? ''} onChange={(e) => update({ ...q, prompt: e.target.value })} />
                <div className="a-row">
                  <Select
                    label="Answer type"
                    value={q.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      update({
                        ...q,
                        type,
                        options: type === 'true-false' ? ['True', 'False'] : q.options?.length ? q.options : ['', '', '', ''],
                        answers: [],
                      });
                    }}
                    options={TYPES}
                  />
                  <Input label="Marks" type="number" min="1" value={q.points ?? 1} onChange={(e) => update({ ...q, points: Number(e.target.value) })} />
                </div>

                {['single', 'multiple', 'true-false'].includes(q.type) ? (
                  <div className="a-field">
                    <label>Options — tick the right one{q.type === 'multiple' ? 's' : ''}</label>
                    <div className="stack stack-2">
                      {(q.options ?? []).map((option, oi) => (
                        <div key={oi} className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <input
                            type={q.type === 'multiple' ? 'checkbox' : 'radio'}
                            name={`answer-${i}`}
                            checked={(q.answers ?? []).includes(oi)}
                            onChange={(e) => {
                              const answers = q.type === 'multiple'
                                ? e.target.checked ? [...(q.answers ?? []), oi] : (q.answers ?? []).filter((n) => n !== oi)
                                : [oi];
                              update({ ...q, answers });
                            }}
                            style={{ width: 16, height: 16, accentColor: 'var(--green-700)' }}
                          />
                          <input
                            className="input grow"
                            value={option}
                            placeholder={`Option ${oi + 1}`}
                            onChange={(e) => update({ ...q, options: q.options.map((o, n) => (n === oi ? e.target.value : o)) })}
                            disabled={q.type === 'true-false'}
                          />
                          {q.type !== 'true-false' ? (
                            <button
                              type="button"
                              className="a-icon-btn danger"
                              onClick={() => update({
                                ...q,
                                options: q.options.filter((_, n) => n !== oi),
                                answers: (q.answers ?? []).filter((n) => n !== oi).map((n) => (n > oi ? n - 1 : n)),
                              })}
                              disabled={(q.options?.length ?? 0) <= 2}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {q.type !== 'true-false' ? (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => update({ ...q, options: [...(q.options ?? []), ''] })}>
                        <Plus size={13} strokeWidth={2} /> Add an option
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {q.type === 'short-answer' ? (
                  <Textarea
                    label="Accepted answers, one per line"
                    help="Case and spacing are ignored."
                    rows={3}
                    value={(q.accepted ?? []).join('\n')}
                    onChange={(e) => update({ ...q, accepted: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                  />
                ) : null}

                {q.type === 'essay' ? (
                  <Textarea
                    label="Marking criteria, one per line"
                    rows={3}
                    value={(q.rubric ?? []).join('\n')}
                    onChange={(e) => update({ ...q, rubric: e.target.value.split('\n').filter(Boolean) })}
                  />
                ) : null}

                <Input label="Explanation" help="Shown in the results, if answers are visible." value={q.explanation ?? ''} onChange={(e) => update({ ...q, explanation: e.target.value })} />
              </>
            )}
          />
        </Panel>
      </div>
    </>
  );
};
