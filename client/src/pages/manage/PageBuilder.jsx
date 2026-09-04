import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, RefreshCw } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Panel, Textarea } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

/**
 * The church's public page, as a list of blocks it can reorder and hide.
 *
 * Some blocks curate themselves from live data — what it issues, what it
 * teaches, who teaches — so a church that publishes a new credential never has
 * to remember to add it to its own page as well.
 */
export const PageBuilder = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/page`);
  const [sections, setSections] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => { if (data?.sections) setSections(data.sections); }, [data]);

  const move = (i, by) => {
    const to = i + by;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[i], next[to]] = [next[to], next[i]];
    setSections(next.map((s, n) => ({ ...s, order: n })));
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/manage/${churchSlug}/page`, { sections });
      ok('Saved');
      setNonce((n) => n + 1);
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !sections) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  const types = data.types ?? {};

  return (
    <>
      <ConsoleHeader title="Your public page" sub="Arrange the sections on your public page">
        <a className="btn btn-ghost btn-sm" href={`/churches/${churchSlug}`} target="_blank" rel="noreferrer">
          Open it <ExternalLink size={14} strokeWidth={1.8} />
        </a>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </ConsoleHeader>

      <div className="console-body">
        <div className="builder">
          <div className="stack stack-3">
            <Panel title="Blocks">
              <p className="muted small" style={{ marginTop: 0 }}>
                Blocks marked <span className="auto" style={{ fontSize: 'var(--text-xs)' }}>automatic</span> update themselves as you publish.
              </p>
              <div className="stack stack-2">
                {sections.map((section, i) => {
                  const meta = types[section.type] ?? {};
                  return (
                    <div key={section.id ?? section.type} className={`builder-block ${section.visible ? '' : 'is-hidden'}`}>
                      <span className="name">{meta.label ?? section.type}</span>
                      {meta.managed === 'auto' ? <span className="auto">automatic</span> : null}
                      <button type="button" className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                        <ChevronUp size={14} strokeWidth={1.8} />
                      </button>
                      <button type="button" className="a-icon-btn" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Move down">
                        <ChevronDown size={14} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="a-icon-btn"
                        onClick={() => setSections(sections.map((s, n) => (n === i ? { ...s, visible: !s.visible } : s)))}
                        aria-label={section.visible ? 'Hide' : 'Show'}
                        title={meta.always ? 'This one always shows' : section.visible ? 'Hide it' : 'Show it'}
                        disabled={meta.always}
                      >
                        {section.visible ? <Eye size={14} strokeWidth={1.8} /> : <EyeOff size={14} strokeWidth={1.8} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {sections.filter((s) => s.type === 'richText' || s.type === 'video' || s.type === 'cta').map((section) => (
              <Panel key={section.type} title={types[section.type]?.label}>
                {section.type === 'video' ? (
                  <input
                    className="input"
                    placeholder="A link to a video"
                    value={section.data?.url ?? ''}
                    onChange={(e) => setSections(sections.map((s) => (s.type === section.type ? { ...s, data: { ...s.data, url: e.target.value } } : s)))}
                  />
                ) : (
                  <Textarea
                    label="Text"
                    rows={5}
                    value={(section.data?.body ?? []).join('\n\n')}
                    onChange={(e) => setSections(sections.map((s) => (s.type === section.type ? { ...s, data: { ...s.data, body: e.target.value.split('\n\n') } } : s)))}
                  />
                )}
              </Panel>
            ))}

            <p className="muted small">
              The words in About, Your story, Leadership and Service times come from your profile.{' '}
              <a className="link" href={`/manage/${churchSlug}/settings`}>Edit them there</a>.
            </p>
          </div>

          <div className="builder-preview">
            <div className="row row-between" style={{ padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--line)' }}>
              <button type="button" className="a-icon-btn" onClick={() => setNonce((n) => n + 1)} aria-label="Refresh">
                <RefreshCw size={14} strokeWidth={1.8} />
              </button>
            </div>
            <iframe key={nonce} src={`/churches/${churchSlug}`} title="Your page as visitors see it" />
          </div>
        </div>
      </div>
    </>
  );
};
