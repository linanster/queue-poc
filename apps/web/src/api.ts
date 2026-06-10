import type {
  AdminQueueView,
  AdminTicketView,
  CreateTicketRequest,
  StoreView,
  TicketView,
} from '@queue/shared';

// Same-origin (Vite proxies /api → API), so the HttpOnly client cookie flows.
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  getStore: (storeId: string) => http<StoreView>(`/api/stores/${storeId}`),

  takeTicket: (body: CreateTicketRequest) =>
    http<TicketView>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  myTicket: (storeId: string) =>
    http<{ ticket: TicketView | null }>(`/api/tickets/me?storeId=${storeId}`),

  cancel: (storeId: string) =>
    http<{ ok: true }>(`/api/tickets/me?storeId=${storeId}`, { method: 'DELETE' }),

  // --- admin ---
  adminQueue: (storeId: string) =>
    http<AdminQueueView>(`/api/admin/stores/${storeId}/queue`),

  allTickets: (storeId: string) =>
    http<AdminTicketView[]>(`/api/admin/stores/${storeId}/tickets`),

  callNext: (storeId: string) =>
    http<{ ok: true }>(`/api/admin/stores/${storeId}/call-next`, { method: 'POST' }),

  callNextBatch: (storeId: string, count: number) =>
    http<{ ok: true }>(`/api/admin/stores/${storeId}/call-next-batch`, {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),

  reset: (storeId: string) =>
    http<{ ok: true }>(`/api/admin/stores/${storeId}/reset`, { method: 'POST' }),

  setStaffCount: (storeId: string, staffCount: number) =>
    http<{ ok: true }>(`/api/admin/stores/${storeId}/staff-count`, {
      method: 'POST',
      body: JSON.stringify({ staffCount }),
    }),

  setQueueRules: (
    storeId: string,
    readyTimeoutMinutes: number,
    recallWindowMinutes: number,
    servingAlertMinutes: number,
  ) =>
    http<{ ok: true }>(`/api/admin/stores/${storeId}/rules`, {
      method: 'POST',
      body: JSON.stringify({
        readyTimeoutMinutes,
        recallWindowMinutes,
        servingAlertMinutes,
      }),
    }),

  serve: (ticketId: string) =>
    http<{ ok: true }>(`/api/admin/tickets/${ticketId}/serve`, { method: 'POST' }),
  done: (ticketId: string) =>
    http<{ ok: true }>(`/api/admin/tickets/${ticketId}/done`, { method: 'POST' }),
  miss: (ticketId: string) =>
    http<{ ok: true }>(`/api/admin/tickets/${ticketId}/miss`, { method: 'POST' }),
  recall: (ticketId: string) =>
    http<{ ok: true }>(`/api/admin/tickets/${ticketId}/recall`, { method: 'POST' }),
};
