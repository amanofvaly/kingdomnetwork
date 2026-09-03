import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { FileDrop, Input, Panel, ParagraphEditor, RepeatableList, Select, Textarea } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

const list = (a) => (a ?? []).join(', ');
const parse = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export const Settings = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/profile`);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(null);

  useEffect(() => { if (data?.church) setDraft(data.church); }, [data]);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/manage/${churchSlug}/profile`, draft);
      ok('Saved');
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const savePayout = async () => {
    try {
      await api.patch(`/manage/${churchSlug}/onboarding/payouts`, { payout: draft.payout });
      ok('Payout details saved');
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  const upload = async (file, folder, onDone) => {
    setUploading(folder);
    try {
      const asset = await api.upload(`/manage/${churchSlug}/media`, file, { headers: { 'x-media-kind': 'image', 'x-media-folder': folder } });
      onDone(asset);
      ok('Uploaded');
    } catch (err) { fail(err); } finally { setUploading(null); }
  };

  if (loading || !draft) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <>
      <ConsoleHeader title="Settings" sub={draft.slug}>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </ConsoleHeader>

      <div className="console-body">
        <Panel title="Your church">
          <div className="a-form">
            <div className="a-row">
              <Input label="Name" value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
              <Input label="Short name" value={draft.shortName ?? ''} onChange={(e) => set({ shortName: e.target.value })} />
              <Input label="Monogram" maxLength={2} value={draft.monogram ?? ''} onChange={(e) => set({ monogram: e.target.value.toUpperCase() })} />
            </div>
            <Input label="Tagline" value={draft.tagline ?? ''} onChange={(e) => set({ tagline: e.target.value })} />
            <Textarea label="About" rows={4} value={draft.about ?? ''} onChange={(e) => set({ about: e.target.value })} />
            <ParagraphEditor label="Our story" value={draft.story ?? []} onChange={(story) => set({ story })} />
            <ParagraphEditor label="Statement of faith" value={draft.statementOfFaith ?? []} onChange={(statementOfFaith) => set({ statementOfFaith })} />
            <div className="a-row">
              <Input label="City" value={draft.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
              <Input label="Country" value={draft.country ?? ''} onChange={(e) => set({ country: e.target.value })} />
              <Input label="Founded" type="number" value={draft.foundedYear ?? ''} onChange={(e) => set({ foundedYear: Number(e.target.value) || undefined })} />
              <Input label="Time zone" value={draft.timezone ?? ''} onChange={(e) => set({ timezone: e.target.value })} />
            </div>
            <div className="a-row">
              <Input label="Denomination" value={draft.denomination ?? ''} onChange={(e) => set({ denomination: e.target.value })} />
              <Input label="Specialties" value={list(draft.specialties)} onChange={(e) => set({ specialties: parse(e.target.value) })} />
              <Input label="Languages" value={list(draft.languages)} onChange={(e) => set({ languages: parse(e.target.value) })} />
            </div>
          </div>
        </Panel>

        <Panel title="Contact">
          <div className="a-form">
            <div className="a-row">
              <Input label="Email" type="email" value={draft.contact?.email ?? ''} onChange={(e) => set({ contact: { ...draft.contact, email: e.target.value } })} />
              <Input label="Phone" value={draft.contact?.phone ?? ''} onChange={(e) => set({ contact: { ...draft.contact, phone: e.target.value } })} />
              <Input label="WhatsApp" value={draft.contact?.whatsapp ?? ''} onChange={(e) => set({ contact: { ...draft.contact, whatsapp: e.target.value } })} />
              <Input label="Website" value={draft.website ?? ''} onChange={(e) => set({ website: e.target.value })} />
            </div>
            <Textarea
              label="Address"
              rows={3}
              value={(draft.contact?.addressLines ?? []).join('\n')}
              onChange={(e) => set({ contact: { ...draft.contact, addressLines: e.target.value.split('\n') } })}
            />
          </div>
        </Panel>

        <Panel title="Leadership">
          <RepeatableList
            items={draft.leaders ?? []}
            onChange={(leaders) => set({ leaders })}
            makeItem={() => ({ name: '', title: '', bio: '' })}
            addLabel="Add a leader"
            title={(l) => l.name || 'New leader'}
            renderItem={(leader, i, update) => (
              <>
                <div className="a-row">
                  <Input label="Name" value={leader.name ?? ''} onChange={(e) => update({ ...leader, name: e.target.value })} />
                  <Input label="Title" value={leader.title ?? ''} onChange={(e) => update({ ...leader, title: e.target.value })} />
                </div>
                <Textarea label="Biography" rows={3} value={leader.bio ?? ''} onChange={(e) => update({ ...leader, bio: e.target.value })} />
                {leader.image ? (
                  <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                    <img src={leader.image} alt="" width="48" height="48" style={{ borderRadius: '50%', objectFit: 'cover' }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ ...leader, image: undefined })}>Remove photo</button>
                  </div>
                ) : (
                  <FileDrop label="Add a photograph" busy={uploading === `leader-${i}`} onFile={(f) => upload(f, `leader-${i}`, (a) => update({ ...leader, image: a.url, mediaId: a.id }))} />
                )}
              </>
            )}
          />

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 'var(--s-4) 0' }} />

          <p className="muted small">Whose name appears on everything you issue.</p>
          <div className="a-row">
            <Select
              label="Signatory"
              placeholder="Choose a leader"
              value={draft.signatory?.name ?? ''}
              onChange={(e) => {
                const leader = (draft.leaders ?? []).find((l) => l.name === e.target.value);
                set({ signatory: { ...draft.signatory, name: leader?.name, title: leader?.title } });
              }}
              options={(draft.leaders ?? []).map((l) => ({ value: l.name, label: `${l.name} — ${l.title}` }))}
            />
          </div>
        </Panel>

        <Panel title="Payout details">
          <div className="a-form">
            {draft.payout?.accountRefMasked ? (
              <p className="muted small" style={{ margin: 0 }}>
                Currently paid to <b>{draft.payout.accountName}</b> · {draft.payout.method} {draft.payout.accountRefMasked}.
                Enter a new number to change it.
              </p>
            ) : null}
            <Select
              label="Payment method"
              placeholder="Choose one"
              value={draft.payout?.method ?? ''}
              onChange={(e) => set({ payout: { ...draft.payout, method: e.target.value } })}
              options={[
                { value: 'mpesa', label: 'M-Pesa' },
                { value: 'mobile-money', label: 'Other mobile money' },
                { value: 'bank', label: 'Bank transfer' },
              ]}
            />
            <div className="a-row">
              <Input label="Account name" value={draft.payout?.accountName ?? ''} onChange={(e) => set({ payout: { ...draft.payout, accountName: e.target.value } })} />
              <Input
                label={draft.payout?.method === 'bank' ? 'Account number' : 'Mobile number'}
                value={draft.payout?.accountRef ?? ''}
                onChange={(e) => set({ payout: { ...draft.payout, accountRef: e.target.value } })}
                placeholder={draft.payout?.accountRefMasked ?? ''}
              />
            </div>
            <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: 'start' }} onClick={savePayout}>
              Save payout details
            </button>
          </div>
        </Panel>

        <Panel title="Verification">
          <div className={`notice ${draft.verification?.state === 'verified' ? 'notice-green' : ''}`}>
            <strong>
              {draft.verification?.state === 'verified' ? 'Verified' : draft.verification?.state === 'pending' ? 'With us for review' : 'Not verified'}
            </strong>
            <p style={{ margin: '4px 0 0' }}>
              Confirms we have checked your registration documents. It does not change what you can do.
            </p>
            {draft.verification?.notes ? <p className="small" style={{ margin: '8px 0 0' }}>{draft.verification.notes}</p> : null}
          </div>
        </Panel>
      </div>
    </>
  );
};
