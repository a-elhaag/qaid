import { tool } from '@openai/agents';
import { z } from 'zod';
import { buildReminderMessages } from '@/brain/draft/reminder';
import { priceChanges, profitAndLoss, vatSummary } from '@/brain/ledger';
import { chatText } from './ai';
import { db } from './db';
import { loadBoard, mapEntry, monthKey, shiftMonth } from './queries';

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
const notFound = (n: string) => ({ error: `client not found or ambiguous: ${n}` });

/** Every tool only sees the given office's clients; numbers come from deterministic code on stored records. */
export function buildTools(officeId: string) {
  return [
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
        return { client: c.name, month: monthKey(new Date()), draft: await chatText(buildReminderMessages({ clientName: c.name, month: monthKey(new Date()), missing: row.counts.missing })) };
      },
    }),
  ];
}
