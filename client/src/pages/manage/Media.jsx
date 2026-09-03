import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Confirm, FileDrop, Input, Panel } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

const size = (bytes) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`);

export const Media = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const [kind, setKind] = useState('');
  const [progress, setProgress] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/media?${new URLSearchParams(kind ? { kind } : {})}`);

  const upload = async (file) => {
    const mediaKind = file.type.startsWith('image') ? 'image'
      : file.type.startsWith('audio') ? 'audio'
        : file.type.startsWith('video') ? 'video' : 'document';
    setProgress(0);
    try {
      await api.upload(`/manage/${churchSlug}/media`, file, {
        headers: { 'x-media-kind': mediaKind, 'x-media-folder': 'general' },
        onProgress: setProgress,
      });
      ok('Uploaded');
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/manage/${churchSlug}/media/${deleting.id}`);
      ok('Deleted');
      setDeleting(null);
      setSelected(null);
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <ConsoleHeader title="Media" sub={data ? `${data.total} file${data.total === 1 ? '' : 's'}` : ''}>
        <select className="select select-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Everything</option>
          <option value="image">Images</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
          <option value="document">Documents</option>
        </select>
      </ConsoleHeader>

      <div className="console-body">
        <FileDrop
          label="Drop a file here, or choose one"
          hint="Images, audio, video and PDFs, for use across your listings and pages."
          accept="image/*,audio/*,video/*,application/pdf"
          busy={progress !== null}
          progress={progress}
          onFile={upload}
        />

        {loading ? <Spinner /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}

        {data ? (
          data.assets.length ? (
            <Panel>
              <div className="a-media-grid">
                {data.assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={`a-media ${selected?.id === asset.id ? 'is-selected' : ''}`}
                    onClick={() => setSelected(asset)}
                  >
                    <figure>
                      {asset.kind === 'image' ? (
                        <img src={asset.url} alt={asset.alt ?? ''} loading="lazy" />
                      ) : (
                        <span className="dim small">{asset.kind}</span>
                      )}
                    </figure>
                    <figcaption>
                      <b className="clamp-1">{asset.filename}</b>
                      {size(asset.bytes)}{asset.width ? ` · ${asset.width}×${asset.height}` : ''}
                    </figcaption>
                  </button>
                ))}
              </div>
            </Panel>
          ) : (
            <div className="a-empty">
              <h3>No media yet</h3>
              <p className="muted small" style={{ maxWidth: 420 }}>
                Upload images, audio, video and documents to use across your listings and pages.
              </p>
            </div>
          )
        ) : null}

        {selected ? (
          <Panel title={selected.filename}>
            <div className="a-row">
              <Input
                label="Title"
                value={selected.title ?? ''}
                onChange={(e) => setSelected({ ...selected, title: e.target.value })}
              />
              <Input
                label="Alt text"
                help="Used by screen readers and if the image fails to load."
                value={selected.alt ?? ''}
                onChange={(e) => setSelected({ ...selected, alt: e.target.value })}
              />
            </div>
            <div className="row" style={{ gap: 12, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  try {
                    await api.patch(`/manage/${churchSlug}/media/${selected.id}`, { title: selected.title, alt: selected.alt });
                    ok('Saved');
                    await reload();
                  } catch (err) { fail(err); }
                }}
              >
                Save
              </button>
              <a className="btn btn-ghost btn-sm" href={selected.url} target="_blank" rel="noreferrer">Open</a>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(selected)}>Delete</button>
            </div>
          </Panel>
        ) : null}
      </div>

      <Confirm
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this file?"
        body={`${deleting?.filename} will be removed permanently. Anywhere it is used will lose it.`}
        confirmLabel="Delete"
      />
    </>
  );
};
