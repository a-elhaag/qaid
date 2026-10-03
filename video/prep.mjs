// Trims and speed-adjusts raw recordings into clips Remotion plays at normal rate.
// Writes public/clips/*.mp4 and clips.json (seconds per clip).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const START = 1.6; // webm starts with a blank frame
const plan = {
  board: [['board', START, 13.7, 1.1]],
  phone: [['upload', 3, 16.5, 1.3]],
  review: [['upload', 28, 49, 1.5]],
  chat: [['chat', 3, 9, 1.4], ['chat', 9, 25.6, 2.4]],
  reminder: [['reminder', START, 17, 2]],
  pack: [['pack', 1, 6.2, 1.3], ['arabic', START, 6.5, 1.3]],
};
mkdirSync('public/clips', { recursive: true });
const out = {};
for (const [seg, clips] of Object.entries(plan)) {
  out[seg] = clips.map(([src, from, to, rate], i) => {
    const file = `clips/${seg}-${i}.mp4`;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(from), '-t', String(to - from), '-i', `raw/${src}.webm`, '-vf', `setpts=PTS/${rate},fps=30,scale=1280:720`, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', `public/${file}`]);
    const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `public/${file}`]).toString());
    return { file, seconds };
  });
}
writeFileSync('clips.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
