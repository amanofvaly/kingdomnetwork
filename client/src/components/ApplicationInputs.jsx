import { useState } from 'react';
import { api } from '../lib/api.js';

export const ApplicationInputs = ({ application: a, onSaved }) => {
  const [answers, setAnswers] = useState(a.answers ?? {});
  const [references, setReferences] = useState(a.references ?? []);
  const [agreed, setAgreed] = useState((a.attestations ?? []).filter((x) => x.agreedAt).map((x) => x.key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields = a.offering?.applicationForm ?? [];
  const attestations = a.offering?.requires?.attestations ?? [];
  const wantedReferences = a.offering?.requires?.references ?? [];
  if (!fields.length && !attestations.length && !wantedReferences.length) return null;
  const editable = !['approved', 'issued', 'declined', 'withdrawn', 'expired'].includes(a.status);
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.patch(`/applications/${a.reference}`, { answers, references, attestations: agreed }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="ap-section" id="application-details">
    <div className="ap-section-head"><h3>Your application details</h3></div>
    <form className="stack stack-4" onSubmit={save}>
      <fieldset disabled={!editable || busy} className="application-inputs">
        {fields.map((f) => {
          const value = answers[f.key] ?? '';
          const set = (next) => setAnswers((prev) => ({ ...prev, [f.key]: next }));
          const props = { id: `answer-${f.key}`, value, onChange: (e) => set(e.target.value) };
          return <label key={f.key} className="field" htmlFor={props.id}>
            <span>{f.label}{f.required ? ' (required)' : ' (optional)'}</span>
            {f.help ? <small>{f.help}</small> : null}
            {f.type === 'textarea' ? <textarea {...props} rows={4} />
              : f.type === 'select' ? <select {...props}><option value="">Choose an answer</option>{(f.options ?? []).map((o) => <option key={o}>{o}</option>)}</select>
                : f.type === 'multiselect' ? <select {...props} multiple value={Array.isArray(value) ? value : []} onChange={(e) => set([...e.target.selectedOptions].map((o) => o.value))}>{(f.options ?? []).map((o) => <option key={o}>{o}</option>)}</select>
                  : f.type === 'checkbox' ? <input id={props.id} type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />
                    : <input {...props} type={['number', 'date'].includes(f.type) ? f.type : 'text'} />}
          </label>;
        })}
        {attestations.map((t) => <label key={t.key} className="row small" style={{ alignItems: 'start' }}>
          <input type="checkbox" checked={agreed.includes(t.key)} onChange={(e) => setAgreed((prev) => e.target.checked ? [...prev, t.key] : prev.filter((key) => key !== t.key))} />
          <span>{t.statement}{t.required === false ? ' (optional)' : ''}</span>
        </label>)}
        {wantedReferences.map((r) => {
          const current = references.find((x) => x.key === r.key) ?? { key: r.key };
          const update = (key, value) => setReferences((prev) => [...prev.filter((x) => x.key !== r.key), { ...current, [key]: value }]);
          return <fieldset key={r.key} className="application-reference" disabled={current.status === 'received'}>
            <legend>{r.label}{r.required === false ? ' (optional)' : ''}</legend>
            {current.status === 'received' ? <p className="small muted">Reference received. Thank you.</p> : <>
              <p className="small muted">{current.status === 'sent' ? 'The request has been sent to this referee.' : 'After you save and submit, we email your referee a private link to respond.'}</p>
              <label className="field"><span>Name</span><input value={current.name ?? ''} onChange={(e) => update('name', e.target.value)} /></label>
              <label className="field"><span>Email</span><input type="email" value={current.email ?? ''} onChange={(e) => update('email', e.target.value)} /></label>
              <label className="field"><span>Relationship</span><input value={current.relationship ?? r.relationship ?? ''} onChange={(e) => update('relationship', e.target.value)} /></label>
            </>}
          </fieldset>;
        })}
      </fieldset>
      {error ? <p role="alert" className="notice notice-gold">{error}</p> : null}
      {editable ? <div><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save application details'}</button><p className="small muted">You can save your progress before every answer is complete.</p></div> : null}
    </form>
  </section>;
};
