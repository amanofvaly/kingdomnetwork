import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Clock, X } from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * Sitting a paper the church wrote.
 *
 * The served questions come from the server with no answers attached, and are
 * marked there — nothing on this page knows what is correct until the result
 * comes back.
 */
export const Assessment = () => {
  const { reference } = useParams();
  const { fail } = useToast();
  const { data, error, loading, reload } = useApi(`/applications/${reference}/assessment`);

  const [responses, setResponses] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!data?.dueAt || result) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data?.dueAt, result]);

  const remaining = useMemo(() => {
    if (!data?.dueAt) return null;
    const ms = new Date(data.dueAt) - now;
    if (ms <= 0) return '0:00';
    return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  }, [data?.dueAt, now]);

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  if (data.passed && !result) {
    return (
      <div className="wrap band">
        <div className="wrap-narrow stack stack-4">
          <span className="pill pill-good"><Check size={11} strokeWidth={3} /> Passed</span>
          <h1>You have already passed this.</h1>
          <p className="lede">You scored {data.score}%. Nothing more is needed here.</p>
          <Link className="btn btn-primary" to={`/applications/${reference}`}>Back to your application</Link>
        </div>
      </div>
    );
  }

  const questions = data.questions ?? [];
  const answered = questions.filter((q) =>
    q.type === 'short-answer' || q.type === 'essay'
      ? (responses[q.key]?.text ?? '').trim().length > 0
      : (responses[q.key]?.chosen ?? []).length > 0,
  ).length;

  const submit = async () => {
    setBusy(true);
    try {
      setResult(await api.post(`/applications/${reference}/assessment`, {
        responses: questions.map((q) => ({ key: q.key, ...(responses[q.key] ?? {}) })),
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const choose = (q, index) => {
    setResponses((r) => {
      const current = r[q.key]?.chosen ?? [];
      if (q.type === 'multiple') {
        return { ...r, [q.key]: { chosen: current.includes(index) ? current.filter((n) => n !== index) : [...current, index] } };
      }
      return { ...r, [q.key]: { chosen: [index] } };
    });
  };

  if (result) return <Result result={result} reference={reference} />;

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-5">
        <div className="stack stack-2">
          <h1>{data.title}</h1>
          <p className="lede">
            {questions.length} question{questions.length === 1 ? '' : 's'} · {data.passMark}% to pass
            {remaining ? <> · <Clock size={14} strokeWidth={1.9} style={{ verticalAlign: -2 }} /> {remaining} left</> : null}
          </p>
        </div>

        {data.instructions?.length ? (
          <div className="notice">
            {data.instructions.map((line, i) => <p key={i} style={{ margin: i ? '6px 0 0' : 0 }}>{line}</p>)}
          </div>
        ) : null}

        <ol className="stack stack-4" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {questions.map((q, i) => (
            <li key={q.key} className="panel" style={{ padding: 'var(--s-5)' }}>
              <p className="strong" style={{ marginTop: 0 }}>
                <span className="dim">{i + 1}.</span> {q.prompt}
                {q.points > 1 ? <span className="dim small"> ({q.points} marks)</span> : null}
              </p>

              {['single', 'multiple', 'true-false'].includes(q.type) ? (
                <div className="stack stack-2">
                  {q.options.map((option, oi) => (
                    <button
                      key={oi}
                      type="button"
                      className={`quiz-option ${(responses[q.key]?.chosen ?? []).includes(oi) ? 'is-chosen' : ''}`}
                      onClick={() => choose(q, oi)}
                    >
                      {option}
                    </button>
                  ))}
                  {q.type === 'multiple' ? <p className="dim xs" style={{ margin: 0 }}>Choose every one that applies.</p> : null}
                </div>
              ) : (
                <textarea
                  className="textarea"
                  rows={q.type === 'essay' ? 8 : 2}
                  value={responses[q.key]?.text ?? ''}
                  onChange={(e) => setResponses({ ...responses, [q.key]: { text: e.target.value } })}
                  placeholder={q.type === 'essay' ? 'Write your answer.' : 'Your answer'}
                />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="buy-bar" style={{ display: 'flex' }}>
        <span className="small">{answered} of {questions.length} answered</span>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || answered < questions.length}>
          {busy ? 'Sending…' : 'Submit'}
        </button>
      </div>
    </div>
  );
};

const Result = ({ result, reference }) => {
  if (result.awaitingGrading) {
    return (
      <div className="wrap band">
        <div className="wrap-narrow stack stack-4">
          <h1>Submitted.</h1>
          <p className="lede">
            Part of this paper is marked by a person at the church rather than automatically, so your result is not
            final yet. You will be told when it has been read.
          </p>
          <Link className="btn btn-primary" to={`/applications/${reference}`}>Back to your application</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-5">
        <div className="stack stack-3">
          <span className={`pill pill-${result.passed ? 'good' : 'bad'}`}>
            {result.passed ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
            {result.passed ? 'Passed' : 'Not passed'}
          </span>
          <h1>{result.score}%</h1>
          <p className="lede">
            {result.correct} of {result.total} right. The pass mark is {result.passMark}%.
            {result.passed ? ' This requirement is now met.' : ' You can sit it again.'}
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Link className="btn btn-primary" to={`/applications/${reference}`}>Back to your application</Link>
            {!result.passed ? <Link className="btn btn-outline" to={`/applications/${reference}/assessment`} reloadDocument>Try again</Link> : null}
          </div>
        </div>

        {result.review ? (
          <section className="stack stack-4">
            <h2>How it was marked</h2>
            {result.review.map((q, i) => (
              <div key={i} className={`panel ${q.correct ? '' : 'panel-warm'}`} style={{ padding: 'var(--s-5)' }}>
                <p className="strong" style={{ marginTop: 0 }}>
                  <span className="dim">{i + 1}.</span> {q.prompt}
                </p>
                {q.options?.length ? (
                  <div className="stack stack-2">
                    {q.options.map((option, oi) => {
                      const right = (q.answers ?? []).includes(oi);
                      const chosen = Array.isArray(q.given) && q.given.includes(oi);
                      return (
                        <div key={oi} className={`quiz-option ${right ? 'is-right' : chosen ? 'is-wrong' : ''}`}>
                          {option}
                          {right ? <Check size={14} strokeWidth={2.4} /> : chosen ? <X size={14} strokeWidth={2.4} /> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="small">
                    You wrote: <b>{q.given || '—'}</b>
                    {q.accepted?.length ? <span className="dim"> · accepted: {q.accepted.join(', ')}</span> : null}
                  </p>
                )}
                {q.explanation ? <p className="muted small" style={{ marginBottom: 0 }}>{q.explanation}</p> : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
};
