import { Agent, run, type AgentInputItem, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import { ASK_SYSTEM_PROMPT } from '@/brain/ask/prompt';
import { openai } from './ai';
import { buildTools } from './askTools';
import { route } from './models';
import { monthKey } from './queries';

let ready = false;
function setup() {
  if (ready) return;
  setTracingDisabled(true); // no traces to the OpenAI platform
  setDefaultOpenAIClient(openai('chat')); // Responses API is the default and is what GPT-6 needs for tools
  ready = true;
}

export async function askAgent(officeId: string, messages: { role: 'user' | 'assistant'; content: string }[]) {
  setup();
  const agent = new Agent({
    name: 'Qaid',
    model: route('chat').model,
    instructions: `${ASK_SYSTEM_PROMPT}\nCurrent month: ${monthKey(new Date())}.`,
    tools: buildTools(officeId),
  });
  const input: AgentInputItem[] = messages.map((m) =>
    m.role === 'user'
      ? { role: 'user', content: m.content }
      : { role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: m.content }] },
  );
  const r = await run(agent, input);
  return String(r.finalOutput ?? '');
}
