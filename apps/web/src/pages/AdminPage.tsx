import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { TicketStatus } from '@queue/shared';
import type { AdminQueueView } from '@queue/shared';
import { api } from '../api';

export function AdminPage() {
  const { storeId = '' } = useParams();
  const [data, setData] = useState<AdminQueueView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [ruleDraft, setRuleDraft] = useState({
    readyTimeoutMinutes: 5,
    recallWindowMinutes: 15,
    servingAlertMinutes: 20,
  });
  const [ruleDirty, setRuleDirty] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await api.adminQueue(storeId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!data || ruleDirty) return;
    setRuleDraft(data.rules);
  }, [data, ruleDirty]);

  async function act(fn: () => Promise<unknown>) {
    await fn();
    await refresh();
  }

  if (error) return <div className="screen">Error: {error}</div>;
  if (!data) return <div className="screen">Loading…</div>;

  const ready = data.tickets.filter((t) => t.status === TicketStatus.READY);
  const serving = data.tickets.filter((t) => t.status === TicketStatus.SERVING);
  const waiting = data.tickets.filter((t) => t.status === TicketStatus.WAITING);
  const missed = data.tickets.filter((t) => t.status === TicketStatus.MISSED);
  const servingAlertMs = data.rules.servingAlertMinutes * 60_000;

  return (
    <div className="admin">
      <header className="admin__header">
        <h1>{data.store.name}</h1>
        <div className="admin__meta">
          <label>
            Staff on shift:{' '}
            <input
              type="number"
              min={0}
              value={data.store.staffCount}
              onChange={(e) =>
                act(() => api.setStaffCount(storeId, Number(e.target.value)))
              }
            />
          </label>
          <span className="badge">Ready Pool capacity: {data.capacity}</span>
          <span className="badge">
            Ready timeout: {data.rules.readyTimeoutMinutes}m
          </span>
          <span className="badge">
            Recall window: {data.rules.recallWindowMinutes}m
          </span>
          <span className="badge badge--warn">
            Serving alert: {data.rules.servingAlertMinutes}m
          </span>
        </div>
        <div className="admin__rules">
          <label>
            Ready timeout(min)
            <input
              type="number"
              min={1}
              value={ruleDraft.readyTimeoutMinutes}
              onChange={(e) => {
                setRuleDirty(true);
                setRuleDraft((v) => ({
                  ...v,
                  readyTimeoutMinutes: Number(e.target.value),
                }));
              }}
            />
          </label>
          <label>
            Recall window(min)
            <input
              type="number"
              min={1}
              value={ruleDraft.recallWindowMinutes}
              onChange={(e) => {
                setRuleDirty(true);
                setRuleDraft((v) => ({
                  ...v,
                  recallWindowMinutes: Number(e.target.value),
                }));
              }}
            />
          </label>
          <label>
            Serving alert(min)
            <input
              type="number"
              min={1}
              value={ruleDraft.servingAlertMinutes}
              onChange={(e) => {
                setRuleDirty(true);
                setRuleDraft((v) => ({
                  ...v,
                  servingAlertMinutes: Number(e.target.value),
                }));
              }}
            />
          </label>
          <button
            className="btn btn--sm"
            disabled={!ruleDirty}
            onClick={() =>
              act(async () => {
                await api.setQueueRules(
                  storeId,
                  ruleDraft.readyTimeoutMinutes,
                  ruleDraft.recallWindowMinutes,
                  ruleDraft.servingAlertMinutes,
                );
                setRuleDirty(false);
              })
            }
          >
            Save rules
          </button>
        </div>
        <div className="admin__actions">
          <button className="btn btn--ghost" onClick={() => setShowQr((v) => !v)}>
            {showQr ? 'Hide store QR' : 'Show store QR'}
          </button>
          <button className="btn" onClick={() => act(() => api.callNext(storeId))}>
            Call next
          </button>
          <button
            className="btn btn--danger"
            onClick={() => {
              if (confirm('Clear the entire queue?')) act(() => api.reset(storeId));
            }}
          >
            Reset / clear
          </button>
        </div>
      </header>

      {showQr && (
        <section className="qr-panel">
          <div className="qr-panel__code">
            <QRCodeSVG value={data.scanUrl} size={220} marginSize={2} />
          </div>
          <div className="qr-panel__info">
            <h2>Store QR (static, printable)</h2>
            <p>Customers scan this to take a ticket. Print and post it in-store.</p>
            <code className="qr-panel__url">{data.scanUrl}</code>
            <button className="btn btn--sm" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </section>
      )}

      <section className="admin__cols">
        <Column title={`Ready (${ready.length})`}>
          {ready.map((tk) => (
            <Row key={tk.id} number={tk.number} status={tk.status}>
              <button className="btn btn--sm" onClick={() => act(() => api.serve(tk.id))}>
                Serve
              </button>
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => act(() => api.miss(tk.id))}
              >
                Miss
              </button>
            </Row>
          ))}
        </Column>

        <Column title={`Serving (${serving.length})`}>
          {serving.map((tk) => (
            <Row
              key={tk.id}
              number={tk.number}
              status={tk.status}
              warn={
                Boolean(tk.servedAt) &&
                Date.now() - new Date(tk.servedAt as string).getTime() > servingAlertMs
              }
            >
              <button className="btn btn--sm" onClick={() => act(() => api.done(tk.id))}>
                Done
              </button>
            </Row>
          ))}
        </Column>

        <Column title={`Waiting (${waiting.length})`}>
          {waiting.map((tk) => (
            <Row key={tk.id} number={tk.number} status={tk.status} muted>
              <span className="row__hint">#{tk.peopleAhead} ahead</span>
            </Row>
          ))}
        </Column>

        <Column title={`Missed (${missed.length})`}>
          {missed.map((tk) => (
            <Row key={tk.id} number={tk.number} status={tk.status} muted>
              <button className="btn btn--sm" onClick={() => act(() => api.recall(tk.id))}>
                Recall
              </button>
            </Row>
          ))}
        </Column>
      </section>
    </div>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="col">
      <h2>{title}</h2>
      <div className="col__body">{children}</div>
    </div>
  );
}

function Row({
  number,
  status,
  muted,
  warn,
  children,
}: {
  number: number;
  status: TicketStatus;
  muted?: boolean;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`row row--${status.toLowerCase()} ${muted ? 'row--muted' : ''} ${warn ? 'row--warn' : ''}`}
    >
      <span className="row__number">{number}</span>
      {warn && <span className="badge badge--warn">Overdue</span>}
      <span className="row__actions">{children}</span>
    </div>
  );
}
