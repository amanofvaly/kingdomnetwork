import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Check, X } from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useAsync.js';
import { plural } from '../lib/format.js';

export const Assessment = () => {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/me/credentials/${id}/assessment`);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="wrap band"><Spinner label="Loading the paper" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const answered = Object.keys(answers).length;
  const total = data.questions.length;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/me/credentials/${id}/assessment`, {
        answers: data.questions.map((_, i) => answers[i] ?? -1),
      });
      setResult(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const retake = () => { setAnswers({}); setResult(null); window.scrollTo({ top: 0 }); };

  return (
    <div className="wrap band-tight">
      <div className="wrap-narrow stack stack-6" style={{ padding: 0, margin: '0 auto' }}>
        <Link to="/passport" className="link small" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={15} /> Back to passport
        </Link>

        <div className="stack stack-2">
          <span className="eyebrow">Assessment</span>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>{data.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {plural(total, 'question')} · {data.minutes} minutes · pass mark {data.passMark}%. You can retake it as many times as you need.
          </p>
        </div>

        {result && (
          <div className={`panel ${result.passed ? '' : ''}`} style={{
            background: result.passed ? 'var(--green-50)' : 'var(--gold-50)',
            borderColor: result.passed ? 'var(--green-100)' : 'var(--gold-100)',
          }}>
            <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
              {result.passed ? <Award size={24} color="var(--green-600)" /> : <X size={24} color="var(--gold-700)" />}
              <div className="stack stack-2 grow">
                <h3>{result.passed ? 'Passed.' : 'Not this time.'}</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  You scored {result.score}% ({result.correct} of {result.total}). Pass mark is {result.passMark}%.
                  {result.passed
                    ? ' Your credential has been issued and is in your passport now.'
                    : ' Read the explanations below and take it again when you are ready.'}
                </p>
                <div className="row-wrap" style={{ gap: 10 }}>
                  {result.passed
                    ? <Link to="/passport" className="btn btn-primary btn-sm">Open my passport</Link>
                    : <button type="button" className="btn btn-primary btn-sm" onClick={retake}>Take it again</button>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          {(result ? result.review : data.questions).map((q, qi) => {
            const given = result ? q.given : answers[qi];
            return (
              <fieldset key={qi} className="q stack stack-3" style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="row" style={{ gap: 10, alignItems: 'flex-start', padding: 0, marginBottom: 'var(--s-2)' }}>
                  <span className="q-num">{qi + 1}</span>
                  <span className="strong grow">{q.prompt}</span>
                </legend>
                <div className="stack stack-2">
                  {q.options.map((opt, oi) => {
                    const picked = given === oi;
                    const right = result && oi === q.answer;
                    const wrong = result && picked && oi !== q.answer;
                    return (
                      <button key={oi} type="button" disabled={Boolean(result)}
                        className={`quiz-option ${picked && !result ? 'is-picked' : ''} ${right ? 'is-right' : ''} ${wrong ? 'is-wrong' : ''}`}
                        onClick={() => setAnswers({ ...answers, [qi]: oi })}>
                        <span className="radio-dot" style={{ borderColor: picked || right ? 'var(--green-600)' : undefined }}>
                          {(picked || right) && (
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: wrong ? 'var(--red-600)' : 'var(--green-600)' }} />
                          )}
                        </span>
                        <span className="grow small">{opt}</span>
                        {right && <Check size={16} color="var(--green-600)" />}
                        {wrong && <X size={16} color="var(--red-600)" />}
                      </button>
                    );
                  })}
                </div>
                {result && (
                  <p className="small muted" style={{ margin: 0, paddingLeft: 'var(--s-4)', borderLeft: '2px solid var(--line)' }}>
                    {q.explanation}
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>

        {!result && (
          <div className="row-between" style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: 'var(--s-4) 0', borderTop: '1px solid var(--line)' }}>
            <span className="small muted num">{answered} of {total} answered</span>
            <button type="button" className="btn btn-primary btn-lg" disabled={answered < total || busy} onClick={submit}>
              {busy ? <span className="spinner" /> : 'Submit answers'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
