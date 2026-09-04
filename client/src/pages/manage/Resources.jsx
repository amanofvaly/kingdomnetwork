import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Dialog, FileDrop, Input, Money, ParagraphEditor, Select, StatusPill } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

const KINDS = [
  { value: 'book', label: 'Book' },
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'study-guide', label: 'Study guide' },
  { value: 'sermon-series', label: 'Sermon series' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'album', label: 'Album' },
];

/**
 * Books and materials.
 *
 * Kept apart from what a church issues. A book is a thing you buy; a credential
 * is standing you apply for. Collapsing them would drag commerce language back
 * onto ordination, which is what the application flow exists to prevent.
 */
export const Resources = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/resources`);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(null);

  const create = async () => {
    try {
      const created = await api.post(`/manage/${churchSlug}/resources`, { title });
      setCreating(false);
      setTitle('');
      setEditing(created);
      await reload();
    } catch (err) { fail(err); }
  };

  const save = async (status) => {
    try {
      const saved = await api.patch(`/manage/${churchSlug}/resources/${editing.slug}`, { ...editing, ...(status ? { status } : {}) });
      setEditing(saved);
      ok('Saved');
      await reload();
    } catch (err) { fail(err); }
  };

  const attach = async (file, field) => {
    setUploading(field);
    try {
      const kind = file.type.startsWith('audio') ? 'audio'
        : file.type.startsWith('video') ? 'video'
        : file.type.startsWith('image') ? 'image'
        : 'document';

      const asset = await api.upload(`/manage/${churchSlug}/media`, file, {
        headers: {
          'x-media-kind': kind,
          'x-media-folder': 'resources',
          // What people pay for is private. The cover and the sample are the
          // parts that sell it, so they stay readable by anyone.
          ...(field === 'file' ? { 'x-media-visibility': 'private' } : {}),
        },
      });

      setEditing((r) => {
        if (field === 'cover') return { ...r, coverImage: asset.url, coverMediaId: asset.id };
        if (field === 'sample') return { ...r, previewMediaId: asset.id, previewUrl: asset.url };
        return { ...r, fileMediaIds: [...(r.fileMediaIds ?? []), asset.id] };
      });
    } catch (err) { fail(err); } finally { setUploading(null); }
  };

  return (
    <>
      <ConsoleHeader title="Books and materials" sub="Things people buy outright">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus size={15} strokeWidth={2} /> New
        </button>
      </ConsoleHeader>

      <div className="console-body">
        {loading ? <Spinner /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}

        {data && !data.length ? (
          <div className="a-empty">
            <h3>Nothing here yet</h3>
            <p className="muted small" style={{ maxWidth: 440 }}>
              Upload a book, a recording or a video once and it is delivered to every buyer.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Add the first</button>
          </div>
        ) : null}

        <div className="grid grid-3">
          {(data ?? []).map((r) => (
            <button
              key={r.slug}
              type="button"
              className="panel"
              style={{ padding: 'var(--s-4)', textAlign: 'left', cursor: 'pointer', background: 'var(--bg)' }}
              onClick={() => setEditing(r)}
            >
              <div className="row row-between" style={{ marginBottom: 8 }}>
                <span className="dim xs">{KINDS.find((k) => k.value === r.kind)?.label}</span>
                <StatusPill status={r.status} />
              </div>
              <b className="small">{r.title}</b>
              <p className="dim xs" style={{ margin: '4px 0 0' }}>{r.price ? money(r.price) : 'Free'}</p>
            </button>
          ))}
        </div>
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New item"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!title.trim()} onClick={create}>Create</button>
          </>
        }
      >
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        wide
        onClose={() => setEditing(null)}
        title={editing?.title ?? ''}
        footer={
          <>
            {editing?.status === 'published' ? (
              <a className="btn btn-ghost" href={`/materials/${editing.slug}`} target="_blank" rel="noreferrer">
                View it
              </a>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Close</button>
            <button type="button" className="btn btn-outline" onClick={() => save()}>Save</button>
            <button type="button" className="btn btn-primary" onClick={() => save(editing?.status === 'published' ? 'draft' : 'published')}>
              {editing?.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </>
        }
      >
        {editing ? (
          <>
            <div className="a-row">
              <Input label="Title" value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <Select label="Name" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })} options={KINDS} />
              <Money label="Price" value={editing.price ?? 0} onChange={(price) => setEditing({ ...editing, price })} />
            </div>
            <Input label="Author" value={editing.authorName ?? ''} onChange={(e) => setEditing({ ...editing, authorName: e.target.value })} />
            <Input label="Subtitle" value={editing.subtitle ?? ''} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} />
            <ParagraphEditor label="Description" value={editing.description ?? []} onChange={(description) => setEditing({ ...editing, description })} />
            <div className="a-row">
              <Input label="Pages" type="number" value={editing.pages ?? ''} onChange={(e) => setEditing({ ...editing, pages: Number(e.target.value) || undefined })} />
              <Input label="Minutes, if audio" type="number" value={editing.durationMinutes ?? ''} onChange={(e) => setEditing({ ...editing, durationMinutes: Number(e.target.value) || undefined })} />
            </div>

            {editing.coverImage ? (
              <img src={editing.coverImage} alt="" style={{ width: 140, borderRadius: 'var(--r-md)' }} />
            ) : (
              <FileDrop label="Add a cover" busy={uploading === 'cover'} onFile={(f) => attach(f, 'cover')} />
            )}

            <div className="a-field">
              <label>Files</label>
              <p className="help">
                {(editing.fileMediaIds ?? []).length} file(s) attached. Required before publishing.
                Only someone who has bought this can open them.
              </p>
              <FileDrop
                label="Attach the file"
                accept="application/pdf,audio/*,video/*"
                hint="A PDF, an audio file or a video"
                busy={uploading === 'file'}
                onFile={(f) => attach(f, 'file')}
              />
            </div>

            <div className="a-field">
              <label>Sample</label>
              <p className="help">
                The part anyone may see before buying — a first chapter, or a few minutes
                of the recording. Items without one sell badly.
              </p>
              {editing.previewMediaId ? (
                <p className="small muted" style={{ margin: 0 }}>
                  A sample is attached.{' '}
                  <button type="button" className="link"
                    onClick={() => setEditing({ ...editing, previewMediaId: null, previewUrl: undefined })}>
                    Replace it
                  </button>
                </p>
              ) : (
                <FileDrop
                  label="Attach a sample"
                  accept="application/pdf,audio/*,video/*"
                  hint="Shown on the public page"
                  busy={uploading === 'sample'}
                  onFile={(f) => attach(f, 'sample')}
                />
              )}
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
};
