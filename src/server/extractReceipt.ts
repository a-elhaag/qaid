import { fuse, type Fused } from '@/brain/extract/fuse';
import type { Extracted } from '@/brain/types';
import { env } from './env';
import { structureReceipt } from './ai';
import { parseToMarkdown } from './parse';

export interface Lanes {
  laneA: (b64: string, mime: string) => Promise<{ fields: Extracted; markdown: string }>;
  laneB: (b64: string, mime: string) => Promise<{ fields: Extracted }>;
}

const defaultLanes: Lanes = {
  async laneA(b64, mime) {
    const markdown = await parseToMarkdown(b64, mime);
    return { fields: await structureReceipt({ text: markdown }), markdown };
  },
  async laneB(b64, mime) {
    return { fields: await structureReceipt({ imageDataUrl: `data:${mime};base64,${b64}` }) };
  },
};

export async function extractReceipt(b64: string, mime: string, lanes: Lanes = defaultLanes): Promise<Fused> {
  const useB = lanes !== defaultLanes || env.fusion;
  const [a, b] = await Promise.allSettled([lanes.laneA(b64, mime), useB ? lanes.laneB(b64, mime) : Promise.reject(new Error('fusion off'))]);
  return fuse(a.status === 'fulfilled' ? a.value.fields : null, b.status === 'fulfilled' ? b.value.fields : null, a.status === 'fulfilled' ? a.value.markdown : null);
}
