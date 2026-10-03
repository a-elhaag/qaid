import { NextResponse } from 'next/server';
import { askAgentStream } from '@/server/agent';
import { requireOffice } from '@/server/auth';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { officeId } = await requireOffice();
  const body = (await req.json().catch(() => null)) as { messages?: { role: string; content: unknown }[] } | null;
  const messages = (body?.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-12)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return NextResponse.json({ error: 'no messages' }, { status: 400 });
  try {
    const text = (await askAgentStream(officeId, messages)) as unknown as ReadableStream<string>; // agents-core ships its own stream type
    return new Response(text.pipeThrough(new TextEncoderStream()), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'agent' }, { status: 502 });
  }
}
