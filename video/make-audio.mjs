import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const key = process.env.FOUNDRY_API_KEY;
const voice = process.env.VOICE ?? 'en-US-AndrewNeural';
const items = JSON.parse(readFileSync('narration.json', 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const it of items) {
  const ssml = `<speak version="1.0" xml:lang="en-US" xmlns="http://www.w3.org/2001/10/synthesis"><voice name="${voice}"><prosody rate="-4%">${esc(it.text)}</prosody></voice></speak>`;
  const r = await fetch('https://uaenorth.tts.speech.microsoft.com/cognitiveservices/v1', { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'qaid' }, body: ssml });
  if (!r.ok) throw new Error(it.id + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  writeFileSync(`audio/${it.id}.mp3`, Buffer.from(await r.arrayBuffer()));
  it.seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `audio/${it.id}.mp3`]).toString());
  console.log(it.id, it.seconds.toFixed(1));
}
writeFileSync('timeline.json', JSON.stringify(items, null, 1));
