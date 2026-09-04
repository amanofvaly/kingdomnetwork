import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Image as ImageIcon, Send, Trash2, X } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Panel, Stat, Textarea } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { dateShort, plural } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

/**
 * What this church says to the people who follow it.
 *
 * Pictures come from the media library the church already has rather than a
 * second upload path — anything it has put on its page can go in a post.
 */

const KIND = {
  update: ['Post', 'tag'],
  offering: ['New credential', 'tag tag-blue'],
  credential: ['Someone shared', 'tag tag-gold'],
};

export const Posts = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const feed = useApi(`/manage/${churchSlug}/posts`);
  const media = useApi(`/manage/${churchSlug}/media`);

  const [body, setBody] = useState('');
  const [picked, setPicked] = useState([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const images = (media.data?.assets ?? media.data ?? []).filter((a) => a.kind === 'image');

  const publish = async () => {
    setBusy(true);
    try {
      await api.post(`/manage/${churchSlug}/posts`, {
        body,
        images: picked.map((a) => ({ mediaId: a._id, url: `/api/media/file/${a.storageKey}`, alt: a.alt ?? '' })),
      });
      setBody('');
      setPicked([]);
      setPicking(false);
      feed.reload();
      ok('Posted');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.del(`/manage/${churchSlug}/posts/${id}`);
      feed.reload();
      ok('Removed');
    } catch (err) {
      fail(err);
    }
  };

  if (feed.loading) return <div className="console-body"><Spinner /></div>;
  if (feed.error) return <div className="console-body"><ErrorState error={feed.error} onRetry={feed.reload} /></div>;

  const posts = feed.data.posts ?? [];
  const mine = posts.filter((p) => p.kind === 'update');
  const reactions = posts.reduce((n, p) => n + (p.reactionTotal ?? 0), 0);

  return (
    <>
      <ConsoleHeader
        title="Posts"
        sub="Everything you have said to the people who follow this church."
      />

      <div className="console-body stack stack-5">
        <div className="a-stats">
          <Stat label="Posts" value={posts.length} />
          <Stat label="Written by you" value={mine.length} />
          <Stat label="Reactions" value={reactions} />
        </div>

        <Panel title="Write a post">
          <div className="stack stack-4">
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="A gathering, a word, something you want the people who follow you to know."
            />

            {picked.length ? (
              <div className="row-wrap" style={{ gap: 'var(--s-2)' }}>
                {picked.map((a) => (
                  <span key={a._id} style={{ position: 'relative' }}>
                    <img
                      src={`/api/media/file/${a.storageKey}`}
                      alt=""
                      style={{ width: 92, height: 68, objectFit: 'cover', borderRadius: 'var(--r-md)' }}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Remove picture"
                      onClick={() => setPicked((p) => p.filter((x) => x._id !== a._id))}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,.6)', color: '#fff' }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPicking((v) => !v)}>
                <ImageIcon size={15} /> {picking ? 'Close library' : 'Add a picture'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={publish}
                disabled={busy || (!body.trim() && !picked.length)}
              >
                <Send size={15} /> {busy ? 'Posting…' : 'Post'}
              </button>
            </div>

            {picking ? (
              images.length ? (
                <div className="grid grid-4" style={{ gap: 'var(--s-2)' }}>
                  {images.slice(0, 24).map((a) => {
                    const on = picked.some((p) => p._id === a._id);
                    return (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => setPicked((p) => (on ? p.filter((x) => x._id !== a._id) : [...p, a].slice(0, 4)))}
                        style={{
                          borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: '4/3',
                          outline: on ? '3px solid var(--blue-700)' : '1px solid var(--line)',
                        }}
                      >
                        <img src={`/api/media/file/${a.storageKey}`} alt={a.alt ?? ''}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="small muted">
                  Nothing in the media library yet. Upload pictures under Media and they will be available here.
                </p>
              )
            ) : null}
          </div>
        </Panel>

        <Panel title="Posted">
          {posts.length ? (
            <div className="stack stack-3">
              {posts.map((p) => {
                const [label, cls] = KIND[p.kind] ?? KIND.update;
                return (
                  <div key={p.id} className="panel row-between" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 6 }}>
                        <span className={cls}>{label}</span>
                        <span className="xs dim">{dateShort(p.publishedAt)}</span>
                        <span className="xs dim">· {plural(p.reactionTotal ?? 0, 'reaction')}</span>
                      </div>
                      <p className="small" style={{ margin: 0 }}>
                        {p.body || (p.offering ? p.offering.title : p.credential?.title) || '—'}
                      </p>
                    </div>
                    {p.images?.length ? (
                      <img src={p.images[0].url} alt=""
                        style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 'var(--r-md)', flex: 'none' }} />
                    ) : null}
                    {p.kind === 'update' ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(p.id)} aria-label="Remove post">
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="small muted">
              Nothing posted yet. Anything you write here reaches everyone who follows this church.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
};
