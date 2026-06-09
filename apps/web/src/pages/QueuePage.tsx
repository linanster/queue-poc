import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { TicketStatus } from '@queue/shared';
import type { TicketView, StoreView, TicketStreamEvent } from '@queue/shared';
import { api } from '../api';
import { detectLang, t } from '../i18n';

type Phase = 'taking' | 'active' | 'error';

export function QueuePage() {
  const { storeId = '' } = useParams();
  const [params] = useSearchParams();
  const sig = params.get('sig') ?? '';
  const lang = useMemo(() => detectLang(), []);

  const [phase, setPhase] = useState<Phase>('taking');
  const [store, setStore] = useState<StoreView | null>(null);
  const [ticket, setTicket] = useState<TicketView | null>(null);
  const [live, setLive] = useState(true);

  // Take (or recover) a ticket on load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.getStore(storeId);
        if (cancelled) return;
        setStore(s);
        const tk = await api.takeTicket({ storeId, sig });
        if (cancelled) return;
        setTicket(tk);
        setPhase('active');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, sig]);

  // Live updates via SSE (design.md §2.3). EventSource auto-reconnects.
  useEffect(() => {
    if (phase !== 'active') return;
    const es = new EventSource(`/api/tickets/me/stream?storeId=${storeId}`);
    es.onopen = () => setLive(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as TicketStreamEvent;
        if (data.ticket && data.ticket.storeId === storeId) setTicket(data.ticket);
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [phase, storeId]);

  async function leave() {
    await api.cancel(storeId);
    setTicket((prev) => (prev ? { ...prev, status: TicketStatus.CANCELLED } : prev));
  }

  if (phase === 'taking') {
    return <Screen>{t('taking', lang)}</Screen>;
  }
  if (phase === 'error') {
    return <Screen>{t('errorGeneric', lang)}</Screen>;
  }

  return (
    <div className="screen queue">
      <header className="queue__header">
        <h1>{store?.name ?? t('appTitle', lang)}</h1>
        {!live && <span className="badge badge--warn">{t('reconnecting', lang)}</span>}
      </header>

      <div className={`ticket ticket--${ticket?.status.toLowerCase()}`}>
        <div className="ticket__label">{t('yourNumber', lang)}</div>
        <div className="ticket__number">{ticket ? ticket.number : '--'}</div>
        <div className="ticket__status">{ticket ? statusText(ticket.status, lang) : ''}</div>
        {ticket?.status === TicketStatus.WAITING && (
          <div className="ticket__ahead">
            {t('peopleAhead', lang)} <strong>{ticket.peopleAhead}</strong> {t('people', lang)}
          </div>
        )}
      </div>

      <p className="hint">{t('saveHint', lang)}</p>

      {ticket &&
        (ticket.status === TicketStatus.WAITING ||
          ticket.status === TicketStatus.READY) && (
          <button className="btn btn--ghost" onClick={leave}>
            {t('leaveQueue', lang)}
          </button>
        )}

      <footer className="privacy">{t('privacyNote', lang)}</footer>
    </div>
  );
}

function statusText(status: TicketStatus, lang: ReturnType<typeof detectLang>): string {
  switch (status) {
    case TicketStatus.WAITING:
      return t('statusWaiting', lang);
    case TicketStatus.READY:
      return t('statusReady', lang);
    case TicketStatus.SERVING:
      return t('statusServing', lang);
    case TicketStatus.DONE:
      return t('statusDone', lang);
    case TicketStatus.MISSED:
      return t('statusMissed', lang);
    case TicketStatus.CANCELLED:
      return t('statusCancelled', lang);
    default:
      return status;
  }
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="screen">{children}</div>;
}
