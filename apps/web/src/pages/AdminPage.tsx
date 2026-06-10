import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { TicketStatus } from '@queue/shared';
import type { AdminQueueView, AdminTicketView } from '@queue/shared';
import { api } from '../api';

type AdminTab = 'board' | 'lookup';

export function AdminPage() {
  const { storeId = '' } = useParams();
  const [tab, setTab] = useState<AdminTab>('board');
  const [data, setData] = useState<AdminQueueView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [ruleDraft, setRuleDraft] = useState({
    readyTimeoutMinutes: 1,
    recallWindowMinutes: 1,
    servingAlertMinutes: 1,
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
        <nav className="admin__tabs">
          <button
            className={`tab ${tab === 'board' ? 'tab--active' : ''}`}
            onClick={() => setTab('board')}
          >
            Live board
          </button>
          <button
            className={`tab ${tab === 'lookup' ? 'tab--active' : ''}`}
            onClick={() => setTab('lookup')}
          >
            All tickets
          </button>
        </nav>
        {tab === 'board' && (
          <>
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
            Call next 1
          </button>
          <button className="btn" onClick={() => act(() => api.callNextBatch(storeId, 10))}>
            Call next 10
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
          </>
        )}
      </header>

      {tab === 'lookup' && <TicketsLookup storeId={storeId} />}

      {tab === 'board' && (
        <>
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
        <Column title={`Waiting (${waiting.length})`} accent="waiting">
          {waiting.map((tk) => (
            <Row key={tk.id} number={tk.number} status={tk.status} muted>
              <span className="row__hint">#{tk.peopleAhead} ahead</span>
            </Row>
          ))}
        </Column>

        <Column title={`Ready (${ready.length})`} accent="ready">
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

        <Column title={`Serving (${serving.length})`} accent="serving">
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

        <Column title={`Missed (${missed.length})`} accent="missed">
          {missed.map((tk) => (
            <Row key={tk.id} number={tk.number} status={tk.status} muted>
              <button className="btn btn--sm" onClick={() => act(() => api.recall(tk.id))}>
                Recall
              </button>
            </Row>
          ))}
        </Column>
      </section>
        </>
      )}
    </div>
  );
}

function Column({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: 'ready' | 'serving' | 'waiting' | 'missed';
  children: React.ReactNode;
}) {
  return (
    <div className="col">
      <h2>
        {accent && <span className={`col__dot col__dot--${accent}`} />}
        {title}
      </h2>
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

const STATUS_ACCENT: Record<TicketStatus, string> = {
  [TicketStatus.WAITING]: 'waiting',
  [TicketStatus.READY]: 'ready',
  [TicketStatus.SERVING]: 'serving',
  [TicketStatus.MISSED]: 'missed',
  [TicketStatus.DONE]: 'done',
  [TicketStatus.CANCELLED]: 'cancelled',
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function TicketsLookup({ storeId }: { storeId: string }) {
  const [tickets, setTickets] = useState<AdminTicketView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    try {
      setTickets(await api.allTickets(storeId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return tickets;
    return tickets.filter((t) => String(t.number).includes(q));
  }, [tickets, query]);

  return (
    <section className="lookup">
      <div className="lookup__bar">
        <input
          className="lookup__search"
          type="search"
          inputMode="numeric"
          placeholder="Search by ticket number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn--sm btn--ghost" onClick={() => void refresh()}>
          Refresh
        </button>
        <span className="lookup__count">{filtered.length} tickets</span>
      </div>

      {error && <div className="lookup__error">Error: {error}</div>}

      <table className="lookup__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Status</th>
            <th>Taken</th>
            <th>Called</th>
            <th>Served</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            <tr key={t.id}>
              <td className="lookup__num">{t.number}</td>
              <td>
                <span className={`col__dot col__dot--${STATUS_ACCENT[t.status]}`} />
                {t.status}
              </td>
              <td>{fmt(t.createdAt)}</td>
              <td>{fmt(t.calledAt)}</td>
              <td>{fmt(t.servedAt)}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="lookup__empty">
                No tickets found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
