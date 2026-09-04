import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Award, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle,
  FileText, Headphones, PlayCircle, Sparkles, X,
} from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useAsync.js';
import { duration, plural } from '../lib/format.js';

const KIND_ICON = { video: PlayCircle, audio: Headphones, reading: FileText, quiz: Sparkles, assignment: Award };
const KIND_LABEL = { video: 'Video lesson', audio: 'Audio lesson', reading: 'Written lesson', quiz: 'Quiz', assignment: 'Assignment' };

const Quiz = ({ lecture }) => {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const total = lecture.questions.length;
  const correct = lecture.questions.filter((q, i) => answers[i] === q.answer).length;

  return (
    <div className="stack stack-6">
      {lecture.questions.map((q, qi) => (
        <fieldset key={qi} className="stack stack-3" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="strong" style={{ padding: 0, marginBottom: 'var(--s-2)' }}>
            {qi + 1}. {q.prompt}
          </legend>
          <div className="stack stack-2">
            {q.options.map((opt, oi) => {
              const picked = answers[qi] === oi;
              const right = checked && oi === q.answer;
              const wrong = checked && picked && oi !== q.answer;
              return (
                <button key={oi} type="button" disabled={checked}
                  className={`quiz-option ${picked && !checked ? 'is-picked' : ''} ${right ? 'is-right' : ''} ${wrong ? 'is-wrong' : ''}`}
                  onClick={() => setAnswers({ ...answers, [qi]: oi })}>
                  <span className="radio-dot" style={{ borderColor: picked || right ? 'var(--blue-600)' : undefined }}>
                    {(picked || right) && <span style={{ width: 9, height: 9, borderRadius: '50%', background: right ? 'var(--blue-600)' : wrong ? 'var(--red-600)' : 'var(--blue-600)' }} />}
                  </span>
                  <span className="grow small">{opt}</span>
                  {right && <Check size={16} color="var(--blue-600)" />}
                  {wrong && <X size={16} color="var(--red-600)" />}
                </button>
              );
            })}
          </div>
          {checked && (
            <p className="small muted" style={{ margin: 0, paddingLeft: 'var(--s-4)', borderLeft: '2px solid var(--line)' }}>
              {q.explanation}
            </p>
          )}
        </fieldset>
      ))}

      {checked ? (
        <div className={`notice ${correct === total ? 'notice-blue' : 'notice-gold'}`}>
          <span>You answered {correct} of {total} correctly. {correct === total ? 'Move on to the next lesson.' : 'Read the explanations above before you continue.'}</span>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}
          disabled={Object.keys(answers).length < total} onClick={() => setChecked(true)}>
          Check my answers
        </button>
      )}
      {checked && (
        <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}
          onClick={() => { setAnswers({}); setChecked(false); }}>
          Try again
        </button>
      )}
    </div>
  );
};

const Lesson = ({ lecture, course }) => {
  const Icon = KIND_ICON[lecture.kind] ?? PlayCircle;
  const paragraphs = lecture.body.filter((b) => !b.startsWith('•'));
  const points = lecture.body.filter((b) => b.startsWith('•')).map((b) => b.slice(1).trim());

  return (
    <div className="stack stack-6">
      <div className="stack stack-3">
        <div className="row-wrap" style={{ gap: 10 }}>
          <span className="tag"><Icon size={12} />{KIND_LABEL[lecture.kind]}</span>
          <span className="xs dim">{lecture.minutes} minutes</span>
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)' }}>{lecture.title}</h1>
      </div>

      {(lecture.kind === 'video' || lecture.kind === 'audio') && (
        <figure className="media-shell" style={{ margin: 0 }}>
          <img src={course.coverImage} alt="" />
          <div className="overlay">
            <Icon size={40} strokeWidth={1.4} />
            <div className="stack stack-1">
              <span className="strong">{KIND_LABEL[lecture.kind]} · {lecture.minutes} min</span>
              <span className="small" style={{ color: 'rgba(255,255,255,.7)' }}>
                Media upload pending from {course.churchSlug ? 'the issuing church' : 'the church'}. The full lesson notes are below.
              </span>
            </div>
          </div>
        </figure>
      )}

      {lecture.summary && <p className="lede" style={{ fontSize: 'var(--text-md)' }}>{lecture.summary}</p>}

      {lecture.kind === 'quiz' ? (
        <Quiz lecture={lecture} />
      ) : (
        <div className="stack stack-5">
          <div className="lesson-notes">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {points.length > 0 && (
            <div className="panel panel-warm stack stack-3">
              <h5>What this lesson covers</h5>
              <ul className="stack stack-2">
                {points.map((p) => (
                  <li key={p} className="row small muted" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <Check size={15} strokeWidth={2.4} style={{ marginTop: 3, flex: 'none', color: 'var(--blue-600)' }} />{p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Learn = () => {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, error, loading, reload } = useApi(`/learn/${slug}`);

  const [done, setDone] = useState(new Set());
  const [progress, setProgress] = useState(0);
  const [openSections, setOpenSections] = useState(new Set());
  const [justEarned, setJustEarned] = useState(null);
  const [saving, setSaving] = useState(false);

  const flat = useMemo(() => {
    if (!data) return [];
    return data.course.curriculum.flatMap((s) =>
      s.lectures.map((l) => ({ id: l.key, lecture: l, section: s })),
    );
  }, [data]);

  useEffect(() => {
    if (!data) return;
    setDone(new Set(data.enrollment.completedLectures));
    setProgress(data.enrollment.progress);
    const start = params.get('l') ?? data.enrollment.lastLectureKey ?? null;
    // `start` is null on a fresh enrolment, and ''.split('/')[0] is '' rather
    // than undefined, so fall through on falsy rather than on nullish.
    const sectionId = (start ?? '').split('/')[0] || data.course.curriculum[0]?.id;
    setOpenSections(new Set([sectionId]));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="wrap band"><Spinner label="Opening course" /></div>;
  if (error) {
    return (
      <div className="wrap band stack stack-4" style={{ alignItems: 'center', textAlign: 'center' }}>
        <ErrorState error={error} onRetry={reload} />
        <Link to={`/courses/${slug}`} className="btn btn-primary">View the course page</Link>
      </div>
    );
  }

  const { course, church } = data;
  const currentId = params.get('l') ?? data.enrollment.lastLectureKey ?? flat[0]?.id;
  const index = Math.max(0, flat.findIndex((f) => f.id === currentId));
  const current = flat[index];

  const go = (id) => {
    const next = new URLSearchParams(params);
    next.set('l', id);
    setParams(next, { replace: true });
    setOpenSections((prev) => new Set([...prev, id.split('/')[0]]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const mark = async (id, completed) => {
    setSaving(true);
    const optimistic = new Set(done);
    if (completed) optimistic.add(id); else optimistic.delete(id);
    setDone(optimistic);
    try {
      const res = await api.post(`/learn/${slug}/progress`, { lectureKey: id, completed });
      setProgress(res.enrollment.progress);
      setDone(new Set(res.enrollment.completedLectures));
      if (res.justCompleted && res.advanced?.length) setJustEarned(res.advanced[0]);
    } catch {
      setDone(new Set(done));
    } finally {
      setSaving(false);
    }
  };

  const completeAndNext = async () => {
    await mark(current.id, true);
    if (index < flat.length - 1) go(flat[index + 1].id);
  };

  return (
    <div className="player">
      <div className="player-main">
        <div className="player-bar">
          <Link to="/me/learning" className="icon-btn" aria-label="Back to my learning"><ChevronLeft size={20} /></Link>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="small strong clamp-1">{course.title}</div>
            <div className="xs dim">{church?.shortName ?? church?.name}</div>
          </div>
          <div className="row hide-on-narrow" style={{ gap: 10, minWidth: 190 }}>
            <div className="progress grow"><span style={{ width: `${progress}%` }} /></div>
            <span className="xs dim num">{progress}%</span>
          </div>
        </div>

        <div className="player-body stack stack-6">
          {justEarned && (
            <div className="notice notice-gold" style={{ alignItems: 'center' }}>
              <Award size={20} />
              <div className="grow">
                <div className="strong small">Course finished — {justEarned.title}</div>
                <div className="xs">
                  {justEarned.outstanding === 0
                    ? 'Nothing else is outstanding. Your application is with the church.'
                    : `${justEarned.outstanding} requirement${justEarned.outstanding === 1 ? '' : 's'} still to go.`}
                </div>
              </div>
              <Link to="/me/passport" className="btn btn-sm btn-outline">Open passport</Link>
            </div>
          )}

          {current ? <Lesson lecture={current.lecture} course={course} /> : <p>Select a lesson to begin.</p>}

          <div className="row-between" style={{ paddingTop: 'var(--s-5)', borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
            <button type="button" className="btn btn-outline" disabled={index <= 0} onClick={() => go(flat[index - 1].id)}>
              <ChevronLeft size={16} /> Previous
            </button>
            <div className="row" style={{ gap: 10 }}>
              {done.has(current?.id) ? (
                <>
                  <span className="row small" style={{ gap: 6, color: 'var(--blue-600)' }}><CheckCircle2 size={16} /> Completed</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => mark(current.id, false)} disabled={saving}>Undo</button>
                  {index < flat.length - 1 && (
                    <button type="button" className="btn btn-primary" onClick={() => go(flat[index + 1].id)}>
                      Next lesson <ChevronRight size={16} />
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={completeAndNext} disabled={saving}>
                  {saving ? <span className="spinner" /> : <Check size={16} />}
                  Mark complete {index < flat.length - 1 && 'and continue'}
                </button>
              )}
            </div>
          </div>

          {progress === 100 && (
            <div className="panel" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
              <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
                <CheckCircle2 size={22} color="var(--blue-600)" style={{ flex: 'none', marginTop: 2 }} />
                <div className="stack stack-2">
                  <h4>You have finished this course.</h4>
                  <p className="small muted" style={{ margin: 0 }}>
                    {course.certificate?.awarded
                      ? `${course.certificate.title} has been issued by ${church?.shortName ?? church?.name} and recorded in your passport.`
                      : 'Every lesson is complete.'}
                  </p>
                  <div className="row-wrap" style={{ gap: 10 }}>
                    <Link to="/me/passport" className="btn btn-primary btn-sm">View credential</Link>
                    <Link to="/courses" className="btn btn-outline btn-sm">Find your next course</Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="player-side" aria-label="Course contents">
        <div className="player-side-head stack stack-2">
          <div className="row-between">
            <h5>Course contents</h5>
            <span className="xs dim num">{done.size}/{flat.length}</span>
          </div>
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="player-side-scroll">
          {course.curriculum.map((section) => {
            const open = openSections.has(section.id);
            const secDone = section.lectures.filter((l) => done.has(l.key)).length;
            return (
              <div key={section.id}>
                <button type="button" className="p-sec-head" aria-expanded={open}
                  onClick={() => setOpenSections((prev) => {
                    const next = new Set(prev);
                    if (next.has(section.id)) next.delete(section.id); else next.add(section.id);
                    return next;
                  })}>
                  <ChevronDown size={15} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s', flex: 'none', color: 'var(--ink-3)' }} />
                  <span className="grow">{section.title}</span>
                  <span className="xs dim num">{secDone}/{section.lectures.length}</span>
                </button>
                {open && section.lectures.map((l) => {
                  const id = l.key;
                  const Icon = KIND_ICON[l.kind] ?? PlayCircle;
                  const isDone = done.has(id);
                  return (
                    <button key={id} type="button"
                      className={`p-lec ${id === currentId ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}
                      onClick={() => go(id)}>
                      <span className="tick">{isDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}</span>
                      <span className="grow">
                        <span style={{ display: 'block' }}>{l.title}</span>
                        <span className="xs dim row" style={{ gap: 5, marginTop: 2 }}>
                          <Icon size={11} />{KIND_LABEL[l.kind]} · {l.minutes}m
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--line)' }}>
          <span className="xs dim">
            {plural(flat.length, 'lesson')} · {duration(course.totalMinutes)}
          </span>
        </div>
      </aside>
    </div>
  );
};
