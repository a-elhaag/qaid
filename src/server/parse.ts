import { CohereClientV2 } from 'cohere-ai';
import { route } from './models';

type ParseClient = Pick<CohereClientV2, 'parse'>;

let client: ParseClient | null = null;
const defaultClient = (): ParseClient => {
  const r = route('parse');
  return (client ??= new CohereClientV2({ token: r.apiKey, environment: r.cohereBaseURL }));
};

/** Markdown (HTML table markup) for one image. Shape per docs/notes/parse-api.md. */
export async function parseToMarkdown(imageBase64: string, mime: string, co: ParseClient = defaultClient()): Promise<string> {
  const r = await co.parse({
    model: route('parse').model,
    document: { type: 'image_url', imageUrl: `data:${mime};base64,${imageBase64}` },
    outputFormat: 'markdown',
  });
  const md = r.pages.flatMap((p) => (p.type === 'markdown' ? [p.markdown.content] : [])).join('\n');
  if (!md.trim()) throw new Error('parse returned empty markdown');
  return md;
}
