import { describe, expect, it } from 'vitest';
import { buildReminderMessages } from './reminder';

describe('buildReminderMessages', () => {
  it('lists exactly the missing items and forbids inventing', () => {
    const m = buildReminderMessages({
      clientName: 'كافيه النيل',
      month: '2026-10',
      missing: ['إيصال الإيجار', 'فاتورة المورد'],
    });
    const all = m.map((x) => x.content).join('\n');
    expect(all).toContain('إيصال الإيجار');
    expect(all).toContain('فاتورة المورد');
    expect(all).toContain('كافيه النيل');
    expect(all).toMatch(/do not add|لا تضف/i);
  });

  it('empty missing list still returns 2 messages with Missing: line', () => {
    const m = buildReminderMessages({ clientName: 'x', month: '2026-10', missing: [] });
    expect(m).toHaveLength(2);
    const userMessage = m.find((msg) => msg.role === 'user');
    expect(userMessage?.content).toContain('Missing:');
  });
});
