import { tool } from '@openai/agents';
import { z } from 'zod';
import { buildReminderMessages } from '@/brain/draft/reminder';
import { priceChanges, profitAndLoss, vatSummary } from '@/brain/ledger';
import { chatText } from './ai';
import { db } from './db';
import { loadBoard, mapEntry, missingLabels, monthKey, shiftMonth } from './queries';

type C = { id: string; name: string; name_en: string };

export function resolveClient(q: string, clients: C[]) {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const m = clients.filter((c) => c.name.toLowerCase().includes(s) || c.name_en.toLowerCase().includes(s));
  return m.length === 1 ? { id: m[0].id, name: m[0].name } : null;
}

const month = z.string().regex(/^\d{4}-\d{2}$/).describe('Month as YYYY-MM. Use the current month if the user does not say.');
const client = z.string().describe('Client name in Arabic or English');

async function entriesOf(clientId: string, m: string) {
  const { data } = await db().from('entries').select('*').eq('client_id', clientId).gte('entry_date', `${m}-01`).lt('entry_date', `${shiftMonth(m, 1)}-01`);
  return (data ?? []).map(mapEntry);
}
const allClients = async (officeId: string) => ((await db().from('clients').select('id,name,name_en').eq('office_id', officeId)).data ?? []) as C[];
export const allClientsOf = allClients;
const notFound = (n: string) => ({ error: `client not found or ambiguous: ${n}` });

/** Every tool only sees the given office's clients; numbers come from deterministic code on stored records. */
const pct = (m: number | null) => (m == null ? null : Math.round(m * 100));

export function buildTools(officeId: string) {
  return [
    tool({
      name: 'list_clients',
      description: 'Every client of the office with its status, items waiting for review, open flags, missing documents and uploads this month',
      parameters: z.object({}),
      execute: async () => {
        const clients = await allClients(officeId);
        const board = await loadBoard(officeId);
        return {
          month: monthKey(new Date()),
          clients: board.map((b) => ({
            name: b.name,
            nameEn: clients.find((c) => c.id === b.id)?.name_en,
            status: b.status,
            waitingForReview: b.counts.review,
            openFlags: b.counts.flags,
            missingDocuments: b.counts.missing.length,
            uploadsThisMonth: b.counts.uploads,
          })),
        };
      },
    }),
    tool({
      name: 'client_overview',
      description: 'A picture of one client: last three months of revenue, expenses and margin, top vendors, expense categories, open flags, missing documents, employees. Use it to describe a client or guess what business it is in.',
      parameters: z.object({ client }),
      execute: async ({ client: q }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        const cur = monthKey(new Date());
        const months = [shiftMonth(cur, -2), shiftMonth(cur, -1), cur];
        const entries = (await db().from('entries').select('*').eq('client_id', c.id)).data?.map(mapEntry) ?? [];
        const inMonth = (m: string) => entries.filter((e) => e.date.slice(0, 7) === m);
        const spend = new Map<string, number>();
        for (const e of entries.filter((x) => x.category !== 'sales')) spend.set(e.vendor, (spend.get(e.vendor) ?? 0) + e.total);
        const flags = (await db().from('flags').select('kind,detail').eq('client_id', c.id).eq('open', true)).data ?? [];
        const row = (await loadBoard(officeId)).find((r) => r.id === c.id);
        const emps = (await db().from('employees').select('name').eq('client_id', c.id)).data ?? [];
        return {
          client: c.name,
          status: row?.status,
          months: months.map((m) => {
            const pl = profitAndLoss(inMonth(m));
            return { month: m, revenue: pl.revenue, expenses: pl.totalExpenses, net: pl.net, marginPercent: pct(pl.margin) };
          }),
          topVendorsBySpend: [...spend].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([vendor, total]) => ({ vendor, total })),
          categoriesUsed: [...new Set(entries.map((e) => e.category))],
          openFlags: flags,
          missingDocuments: row ? await missingLabels(c.id, row.counts.missing) : [],
          employees: emps.length,
        };
      },
    }),
    tool({
      name: 'open_flags',
      description: 'All open flags (duplicate invoices, price jumps, VAT spikes) across every client, with the client and a detail line',
      parameters: z.object({}),
      execute: async () => {
        const clients = await allClients(officeId);
        const { data } = await db().from('flags').select('client_id,kind,detail').eq('open', true).in('client_id', clients.map((c) => c.id));
        return { flags: (data ?? []).map((f) => ({ client: clients.find((c) => c.id === f.client_id)?.name, kind: f.kind, detail: f.detail })) };
      },
    }),
    tool({
      name: 'recent_entries',
      description: 'The latest entries for a client (vendor, date, amounts, category, confirmed or not)',
      parameters: z.object({ client, limit: z.number().int().min(1).max(30).default(10) }),
      execute: async ({ client: q, limit }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        const { data } = await db().from('entries').select('*').eq('client_id', c.id).order('entry_date', { ascending: false }).limit(limit);
        return { client: c.name, entries: (data ?? []).map(mapEntry).map((e) => ({ date: e.date, vendor: e.vendor, category: e.category, subtotal: e.subtotal, vat: e.vat, total: e.total, confirmed: e.confirmed })) };
      },
    }),
    tool({
      name: 'month_summary',
      description: 'Revenue, expenses, net profit and margin for every client in a month (confirmed entries only)',
      parameters: z.object({ month }),
      execute: async ({ month: m }) => ({
        month: m,
        clients: await Promise.all(
          (await allClients(officeId)).map(async (c) => {
            const pl = profitAndLoss(await entriesOf(c.id, m));
            return { client: c.name, revenue: pl.revenue, expenses: pl.totalExpenses, net: pl.net, marginPercent: pct(pl.margin) };
          }),
        ),
      }),
    }),
    tool({
      name: 'clients_without_uploads',
      description: 'Clients that have no uploads or entries in the month',
      parameters: z.object({ month }),
      execute: async ({ month: m }) => ({ month: m, clients: (await loadBoard(officeId, new Date(`${m}-15`))).filter((r) => r.counts.uploads === 0).map((r) => r.name) }),
    }),
    tool({
      name: 'margin_change',
      description: 'Profit and loss and margin for a client in a month versus the previous month, with the vendors whose prices changed most',
      parameters: z.object({ client, month }),
      execute: async ({ client: q, month: m }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        const [cur, prev] = [await entriesOf(c.id, m), await entriesOf(c.id, shiftMonth(m, -1))];
        return { client: c.name, month: m, current: profitAndLoss(cur), previous: { month: shiftMonth(m, -1), ...profitAndLoss(prev) }, priceChanges: priceChanges(prev, cur).slice(0, 3) };
      },
    }),
    tool({
      name: 'vat_by_client',
      description: 'VAT payable per client for a month (confirmed entries only)',
      parameters: z.object({ month }),
      execute: async ({ month: m }) => ({
        month: m,
        clients: await Promise.all((await allClients(officeId)).map(async (c) => ({ client: c.name, ...vatSummary(await entriesOf(c.id, m)) }))),
      }),
    }),
    tool({
      name: 'top_price_changes',
      description: 'Vendors whose average price changed most for a client versus the previous month',
      parameters: z.object({ client, month }),
      execute: async ({ client: q, month: m }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        return { client: c.name, month: m, changes: priceChanges(await entriesOf(c.id, shiftMonth(m, -1)), await entriesOf(c.id, m)) };
      },
    }),
    tool({
      name: 'draft_reminder',
      description: 'Draft (never send) an Arabic reminder to a client listing their missing documents',
      parameters: z.object({ client }),
      execute: async ({ client: q }) => {
        const c = resolveClient(q, await allClients(officeId));
        if (!c) return notFound(q);
        const row = (await loadBoard(officeId)).find((r) => r.id === c.id);
        if (!row?.counts.missing.length) return { client: c.name, draft: null, note: 'nothing is missing' };
        return { client: c.name, month: monthKey(new Date()), draft: await chatText(buildReminderMessages({ clientName: c.name, month: monthKey(new Date()), missing: await missingLabels(c.id, row.counts.missing) })) };
      },
    }),
  ];
}
