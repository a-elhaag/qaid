export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

export function buildReminderMessages(i: { clientName: string; month: string; missing: string[] }): ChatMsg[] {
  return [
    {
      role: 'system',
      content:
        'You write short, polite WhatsApp-style reminders in Egyptian Arabic from an accounting office to a small business owner. ' +
        'List exactly the missing items given. Do not add items, amounts, deadlines or threats. Do not claim anything was filed or paid. Two to four lines.',
    },
    {
      role: 'user',
      content: `Client: ${i.clientName}\nMonth: ${i.month}\nMissing:\n${i.missing.map((m) => `- ${m}`).join('\n')}`,
    },
  ];
}
