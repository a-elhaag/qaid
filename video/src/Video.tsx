import { AbsoluteFill, Audio, Easing, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont as bodoni } from '@remotion/google-fonts/BodoniModa';
import { loadFont as hanken } from '@remotion/google-fonts/HankenGrotesk';
import { loadFont as mono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as kufi } from '@remotion/google-fonts/ReemKufi';
import timeline from '../timeline.json';
import clips from '../clips.json';

const DISP = bodoni().fontFamily, UI = hanken().fontFamily, MONO = mono().fontFamily, KUFI = kufi().fontFamily;
const C = { note: '#0d4a43', deep: '#082f2b', foil: '#c8a24a', paper: '#f1ead6', hi: '#f8f3e4', ink: '#16201e', soft: '#4b5b57', void: '#7a1f2b', rule: '#b9c4b4' };
const FPS = 30, LEAD = 6, TAIL = 22;

const txt = (id: string) => timeline.find((t) => t.id === id)!;
type ClipInfo = { file: string; seconds: number };
const clipsOf = (id: string) => ((clips as Record<string, ClipInfo[]>)[id] ?? []);
const segFrames = (id: string) => {
  const narr = Math.ceil(txt(id).seconds * FPS) + LEAD + TAIL;
  const foot = clipsOf(id).reduce((a, c) => a + Math.round(c.seconds * FPS), 0);
  return Math.max(narr, foot);
};

const ramp = (f: number, a: number, b: number, easing = Easing.out(Easing.cubic)) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

/* ---------- shared pieces ---------- */

function Subtitles({ id }: { id: string }) {
  const f = useCurrentFrame();
  const { text, seconds } = txt(id);
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];
  const total = sentences.reduce((a, s) => a + s.length, 0);
  const span = seconds * FPS;
  let acc = 0;
  const t = f - LEAD;
  for (const s of sentences) {
    const a = (acc / total) * span, b = ((acc + s.length) / total) * span;
    acc += s.length;
    if (t >= a - 2 && t < b + 4) {
      const o = ramp(t, a - 2, a + 6) * (1 - ramp(t, b - 2, b + 4));
      return (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center', opacity: o }}>
          <div style={{ maxWidth: 1000, padding: '12px 26px', borderRadius: 18, background: 'rgba(8,47,43,.9)', color: C.paper, fontFamily: UI, fontSize: 27, lineHeight: 1.35, textAlign: 'center', border: `1px solid ${C.foil}` }}>{s}</div>
        </div>
      );
    }
  }
  return null;
}

function Fade({ children, dur }: { children: React.ReactNode; dur: number }) {
  const f = useCurrentFrame();
  const o = Math.min(ramp(f, 0, 7), 1 - ramp(f, dur - 7, dur));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: 22, top: 18, padding: '7px 16px', borderRadius: 99, background: C.deep, color: C.foil, border: `1px solid ${C.foil}`, fontFamily: MONO, fontSize: 16, letterSpacing: '.14em', textTransform: 'uppercase' }}>{children}</div>
  );
}

function Pattern() {
  return (
    <svg width="1280" height="720" style={{ position: 'absolute', inset: 0, opacity: 0.16 }}>
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx="640" cy="360" r={90 + i * 62} fill="none" stroke={C.foil} strokeWidth="1.2" strokeDasharray={`${4 + i * 3} ${6 + i * 2}`} />
      ))}
    </svg>
  );
}

const Source = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'absolute', right: 72, top: 26, fontFamily: MONO, fontSize: 12, color: C.soft, textAlign: 'right', maxWidth: 640 }}>{children}</div>
);

const Title = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div style={{ position: 'absolute', left: 72, top: 56, right: 72 }}>
    {sub && <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '.2em', color: C.foil, textTransform: 'uppercase', marginBottom: 8 }}>{sub}</div>}
    <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 46, lineHeight: 1.1, color: C.note }}>{children}</div>
  </div>
);

/* ---------- footage ---------- */

function Footage({ id, chip, dur }: { id: string; chip: string; dur: number }) {
  const list = clipsOf(id);
  let at = 0;
  const f = useCurrentFrame();
  const scale = 1 + 0.035 * ramp(f, 0, dur, Easing.linear);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: '50% 40%' }}>
        {list.map((c, i) => {
          const n = Math.round(c.seconds * FPS);
          const start = at;
          at += n;
          const len = i === list.length - 1 ? dur - start : n;
          return (
            <Sequence key={c.file} from={start} durationInFrames={Math.max(len, 1)}>
              <FrozenClip src={c.file} frames={n} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
      <Chip>{chip}</Chip>
      <Subtitles id={id} />
    </AbsoluteFill>
  );
}

function FrozenClip({ src, frames }: { src: string; frames: number }) {
  const f = useCurrentFrame();
  return (
    <Freeze frame={Math.min(f, frames - 2)}>
      <OffthreadVideo src={staticFile(src)} muted />
    </Freeze>
  );
}

/* ---------- motion scenes ---------- */

function Receipt({ x, y, r, w = 150, scan = 0, label }: { x: number; y: number; r: number; w?: number; scan?: number; label?: string }) {
  const h = w * 1.35;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, transform: `rotate(${r}deg)`, background: C.hi, borderRadius: 8, boxShadow: '0 14px 26px -10px #0009', border: `2px solid ${scan > 0.5 ? C.foil : '#0002'}`, padding: w * 0.1 }}>
      <div style={{ height: 8, width: '60%', background: C.ink, opacity: 0.8, borderRadius: 4, margin: '0 auto 10px' }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
          <div style={{ height: 6, width: `${30 + ((i * 17) % 25)}%`, background: C.soft, opacity: 0.55, borderRadius: 3 }} />
          <div style={{ height: 6, width: '20%', background: C.soft, opacity: 0.55, borderRadius: 3 }} />
        </div>
      ))}
      <div style={{ height: 9, width: '50%', background: C.ink, opacity: 0.85, borderRadius: 4, marginLeft: 'auto', marginTop: 14 }} />
      {label && <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 12, color: C.note }}>{label}</div>}
    </div>
  );
}

function Intro({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const p = f / dur;
  const cards = [[130, 330, -9], [215, 300, 6], [165, 250, -3], [270, 340, 11], [110, 215, 4], [235, 205, -8], [190, 160, 2]];
  const scanX = interpolate(p, [0.56, 0.84], [60, 470], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.note }}>
      <Pattern />
      {cards.map(([x, y, r], i) => {
        const t = ramp(f, i * 5, i * 5 + 22, Easing.out(Easing.back(1.4)));
        const scanned = p > 0.56 && x + 75 < scanX ? 1 : 0;
        return (
          <div key={i} style={{ opacity: t }}>
            <Receipt x={x} y={y - (1 - t) * 260 + 30} r={r} w={150} scan={scanned} />
          </div>
        );
      })}
      {p > 0.56 && p < 0.9 && <div style={{ position: 'absolute', left: scanX, top: 130, width: 4, height: 460, background: C.foil, boxShadow: `0 0 28px 6px ${C.foil}` }} />}
      <div style={{ position: 'absolute', left: 130, top: 600, fontFamily: MONO, fontSize: 17, letterSpacing: '.16em', color: '#c9dcd6', textTransform: 'uppercase', opacity: ramp(f, 40, 60) * (1 - ramp(p, 0.55, 0.62)) }}>typed in by hand, one by one</div>
      <div style={{ position: 'absolute', left: 670, top: 205, width: 520 }}>
        <img src={staticFile('logo-mark.svg')} width={110} style={{ borderRadius: 24, opacity: ramp(f, 14, 34), transform: `scale(${0.7 + 0.3 * ramp(f, 14, 40, Easing.out(Easing.back(1.6)))})` }} />
        <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 104, color: C.paper, lineHeight: 1.05, marginTop: 14, opacity: ramp(f, 24, 46) }}>
          Qaid <span style={{ fontFamily: KUFI, color: C.foil }}>قيد</span>
        </div>
        <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 31, color: C.foil, marginTop: 10, opacity: ramp(p, 0.62, 0.8) }}>Qaid prepares. The accountant decides.</div>
      </div>
      <Subtitles id="intro" />
    </AbsoluteFill>
  );
}

function CountCard({ x, n, label, f, at }: { x: number; n: number; label: string; f: number; at: number }) {
  const v = Math.round(n * ramp(f, at, at + 36));
  return (
    <div style={{ position: 'absolute', left: x, top: 215, width: 340, height: 215, borderRadius: 24, background: C.hi, border: `1px solid ${C.ink}`, padding: 26, opacity: ramp(f, at - 6, at + 8), transform: `translateY(${(1 - ramp(f, at - 6, at + 14)) * 30}px)` }}>
      <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 92, color: C.note, lineHeight: 1 }}>{v}%</div>
      <div style={{ fontFamily: UI, fontSize: 22, color: C.soft, marginTop: 8, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function Stats({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const p = f / dur;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Title sub="The problem">Egypt runs on small businesses. Their books run on paper.</Title>
      <CountCard x={72} n={90} label="of the private sector is micro, small or medium" f={f} at={30} />
      <CountCard x={470} n={43} label="of GDP, about EGP 1.2 trillion of output" f={f} at={46} />
      <CountCard x={868} n={75} label="of the workforce" f={f} at={62} />
      <div style={{ position: 'absolute', left: 72, top: 462, width: 1136, opacity: ramp(p, 0.5, 0.62) }}>
        <div style={{ fontFamily: UI, fontSize: 26, color: C.ink, marginBottom: 12 }}>Typing a receipt by hand</div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 34, borderRadius: 17, background: '#e3dcc3', overflow: 'hidden' }}>
            <div style={{ width: `${ramp(p, 0.55, 0.75) * 100}%`, height: '100%', background: C.void, borderRadius: 17 }} />
          </div>
          <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 38, color: C.void, width: 270 }}>3 to 5 minutes</div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 16, opacity: ramp(p, 0.72, 0.82) }}>
          <div style={{ flex: 1, height: 34, borderRadius: 17, background: '#e3dcc3', overflow: 'hidden' }}>
            <div style={{ width: `${ramp(p, 0.75, 0.9) * 22}%`, height: '100%', background: C.foil, borderRadius: 17 }} />
          </div>
          <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 38, color: '#8a6a1c', width: 270 }}>1 to 3% wrong</div>
        </div>
      </div>
      <Source>Sources: MSMEDA CEO via Ahram Online (Nov 2024); DocuClipper (vendor blog, indicative)</Source>
      <Subtitles id="stats" />
    </AbsoluteFill>
  );
}

function Node({ x, y, w, h, title, sub, dark, o = 1, color }: { x: number; y: number; w: number; h: number; title: string; sub?: string; dark?: boolean; o?: number; color?: string }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 20, background: dark ? C.note : C.hi, border: `1.5px solid ${color ?? C.ink}`, opacity: o, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', transform: `translateY(${(1 - o) * 16}px)` }}>
      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 25, color: dark ? C.paper : C.ink }}>{title}</div>
      {sub && <div style={{ fontFamily: UI, fontSize: 18, color: dark ? C.foil : C.soft, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Audience({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const p = f / dur;
  const line = (x1: number, x2: number, a: number) => (
    <div style={{ position: 'absolute', left: x1, top: 372, width: (x2 - x1) * ramp(p, a, a + 0.1), height: 5, background: C.foil, borderRadius: 3 }} />
  );
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Title sub="Who we sell to">Small businesses keep their accountant. So we serve the accountant.</Title>
      <Node x={72} y={310} w={310} h={130} title="Shop owner" sub="taps a link, photographs a receipt" o={ramp(p, 0.1, 0.22)} />
      {line(382, 484, 0.24)}
      <Node x={484} y={310} w={310} h={130} title="Qaid" sub="reads, checks, flags, prepares" dark o={ramp(p, 0.3, 0.42)} />
      {line(794, 896, 0.46)}
      <Node x={896} y={310} w={312} h={130} title="Accounting office" sub="reviews, confirms, files" o={ramp(p, 0.52, 0.64)} color={C.foil} />
      <div style={{ position: 'absolute', left: 72, top: 500, width: 1136, fontFamily: UI, fontSize: 25, color: C.ink, lineHeight: 1.4, opacity: ramp(p, 0.68, 0.82) }}>
        The state keeps adding compliance (e-invoice, e-receipt, the 2025 simplified tax regime). More rules, more reason to keep an accountant.
      </div>
      <Source>Sources: EY, Andersen, ClearTax Egypt. The buyer is the office; the owner pays nothing extra.</Source>
      <Subtitles id="audience" />
    </AbsoluteFill>
  );
}

function Pipeline({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const p = f / dur;
  const run = ramp(p, 0.2, 0.55, Easing.linear);
  const fields: [string, string, boolean][] = [['vendor', 'agree', true], ['date', 'agree', true], ['subtotal', 'agree', true], ['vat', 'agree', true], ['total', 'agree', true]];
  const bar = (y: number, label: string, secs: number, col: string) => (
    <div style={{ position: 'absolute', left: 340, top: y, width: 330, height: 96, borderRadius: 18, background: C.hi, border: `1.5px solid ${C.ink}`, padding: '12px 18px', opacity: ramp(p, 0.1, 0.2) }}>
      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 21, color: C.ink }}>{label}</div>
      <div style={{ height: 14, borderRadius: 7, background: '#e3dcc3', marginTop: 10, overflow: 'hidden' }}><div style={{ width: `${Math.min(1, run * (5.9 / secs)) * 100}%`, height: '100%', background: col }} /></div>
      <div style={{ fontFamily: MONO, fontSize: 15, color: C.soft, marginTop: 6 }}>{(Math.min(secs, run * 5.9)).toFixed(1)} s</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Title sub="How it works">Two readers. One referee. Nothing fixed silently.</Title>
      <div style={{ opacity: ramp(p, 0.02, 0.12), transform: `translateX(${(1 - ramp(p, 0.02, 0.14)) * -60}px)` }}><Receipt x={90} y={270} r={-4} w={170} label="phone photo" /></div>
      {bar(210, 'A  Cohere Parse + GPT-6', 5.9, C.note)}
      {bar(350, 'B  GPT-6 vision', 4.0, C.foil)}
      <div style={{ position: 'absolute', left: 262, top: 340, width: 78, height: 4, background: C.foil, opacity: ramp(p, 0.1, 0.18) }} />
      <div style={{ position: 'absolute', left: 710, top: 205, width: 300, height: 300, borderRadius: 24, background: C.note, padding: 20, opacity: ramp(p, 0.52, 0.62) }}>
        <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '.16em', color: C.foil, textTransform: 'uppercase' }}>fuse()</div>
        {fields.map(([n, a], i) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: UI, fontSize: 21, color: C.paper, marginTop: 12, opacity: ramp(p, 0.58 + i * 0.03, 0.62 + i * 0.03) }}>
            <span>{n}</span>
            <span style={{ color: n === 'date' && p > 0.76 ? '#ff9aa6' : C.foil }}>{n === 'date' && p > 0.76 ? 'disputed' : a}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 1040, top: 270, width: 168, borderRadius: 20, border: `2px solid ${C.void}`, padding: '14px 12px', textAlign: 'center', fontFamily: MONO, fontSize: 15, letterSpacing: '.1em', color: C.void, background: C.hi, opacity: ramp(p, 0.78, 0.88), transform: `rotate(${-4 * ramp(p, 0.78, 0.88)}deg) scale(${0.8 + 0.2 * ramp(p, 0.78, 0.88, Easing.out(Easing.back(2)))})` }}>FLAGGED<br />FOR THE ACCOUNTANT</div>
      <div style={{ position: 'absolute', left: 90, top: 522, width: 1100, fontFamily: UI, fontSize: 20, color: C.soft, opacity: ramp(p, 0.84, 0.94) }}>Both readers run in parallel: the receipt takes as long as the slower one, not the sum. If one reader is down, the entry says so.</div>
      <Subtitles id="pipeline" />
    </AbsoluteFill>
  );
}

function Results({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const p = f / dur;
  const rows: [string, number][] = [['Subtotal', 10], ['VAT', 10], ['Total', 10], ['Date', 9], ['Vendor', 9]];
  const tile = (x: number, big: string, small: string, at: number) => (
    <div style={{ position: 'absolute', left: x, top: 185, width: 215, height: 120, borderRadius: 20, background: C.note, padding: '18px 22px', opacity: ramp(p, at, at + 0.08), transform: `translateY(${(1 - ramp(p, at, at + 0.1)) * 20}px)` }}>
      <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 52, color: C.paper }}>{big}</div>
      <div style={{ fontFamily: UI, fontSize: 18, color: C.foil }}>{small}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Title sub="Measured result">Money fields perfect. Misses stated openly.</Title>
      <div style={{ position: 'absolute', left: 72, top: 200, width: 640 }}>
        {rows.map(([l, n], i) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, opacity: ramp(p, 0.1 + i * 0.05, 0.16 + i * 0.05) }}>
            <div style={{ width: 120, fontFamily: UI, fontWeight: 600, fontSize: 24 }}>{l}</div>
            <div style={{ flex: 1, height: 34, borderRadius: 17, background: '#e3dcc3', overflow: 'hidden' }}>
              <div style={{ width: `${n * 10 * ramp(p, 0.14 + i * 0.05, 0.32 + i * 0.05)}%`, height: '100%', background: n === 10 ? C.note : C.foil, borderRadius: 17 }} />
            </div>
            <div style={{ width: 70, fontFamily: MONO, fontWeight: 600, fontSize: 22 }}>{n}/10</div>
          </div>
        ))}
        <div style={{ fontFamily: MONO, fontSize: 14, color: C.soft, marginTop: 6 }}>10 receipts, both readers on. Clean renders, not phone photos.</div>
      </div>
      {tile(760, '6.5 s', 'median per receipt', 0.4)}
      {tile(995, '45/50', 'fields read by both', 0.48)}
      <div style={{ position: 'absolute', left: 760, top: 335, width: 450, borderRadius: 20, border: `1.5px solid ${C.void}`, padding: '16px 20px', background: C.hi, opacity: ramp(p, 0.6, 0.72) }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '.14em', color: C.void, textTransform: 'uppercase', marginBottom: 6 }}>what we are not claiming</div>
        <div style={{ fontFamily: UI, fontSize: 20, color: C.ink, lineHeight: 1.4 }}>One date read as 2021, one Arabic name lost a letter. Ten receipts is a small sample.</div>
      </div>
      <Subtitles id="results" />
    </AbsoluteFill>
  );
}

function Outro({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const p = f / dur;
  return (
    <AbsoluteFill style={{ background: C.note, alignItems: 'center', justifyContent: 'center' }}>
      <Pattern />
      <img src={staticFile('logo-mark.svg')} width={140} style={{ borderRadius: 30, opacity: ramp(f, 0, 20), transform: `scale(${0.8 + 0.2 * ramp(f, 0, 24, Easing.out(Easing.back(1.6)))})` }} />
      <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 96, color: C.paper, marginTop: 18, opacity: ramp(f, 8, 28) }}>Qaid <span style={{ fontFamily: KUFI, color: C.foil }}>قيد</span></div>
      <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 34, color: C.foil, marginTop: 8, opacity: ramp(f, 18, 40) }}>Qaid prepares. The accountant decides.</div>
      <div style={{ fontFamily: MONO, fontSize: 24, color: C.paper, marginTop: 34, letterSpacing: '.06em', opacity: ramp(p, 0.4, 0.6) }}>qaid-bay.vercel.app &nbsp;&middot;&nbsp; github.com/a-elhaag/qaid</div>
      <div style={{ fontFamily: MONO, fontSize: 15, color: '#b8cdc7', marginTop: 12, opacity: ramp(p, 0.5, 0.7) }}>Demo data is invented. Press &ldquo;Enter as Ahmed&rdquo; to try it.</div>
      <Subtitles id="outro" />
    </AbsoluteFill>
  );
}

/* ---------- timeline ---------- */

const SEGS: { id: string; node: (d: number) => React.ReactNode }[] = [
  { id: 'intro', node: (d) => <Intro dur={d} /> },
  { id: 'stats', node: (d) => <Stats dur={d} /> },
  { id: 'audience', node: (d) => <Audience dur={d} /> },
  { id: 'board', node: (d) => <Footage id="board" chip="Live app · the ledger" dur={d} /> },
  { id: 'phone', node: (d) => <Footage id="phone" chip="Live app · client phone page" dur={d} /> },
  { id: 'pipeline', node: (d) => <Pipeline dur={d} /> },
  { id: 'review', node: (d) => <Footage id="review" chip="Live app · review and confirm" dur={d} /> },
  { id: 'chat', node: (d) => <Footage id="chat" chip="Live app · ask Qaid" dur={d} /> },
  { id: 'reminder', node: (d) => <Footage id="reminder" chip="Live app · Arabic reminder" dur={d} /> },
  { id: 'pack', node: (d) => <Footage id="pack" chip="Live app · pack and Arabic" dur={d} /> },
  { id: 'results', node: (d) => <Results dur={d} /> },
  { id: 'outro', node: (d) => <Outro dur={d} /> },
];

export const totalFrames = () => SEGS.reduce((a, s) => a + segFrames(s.id), 0);

export function Video() {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.deep }}>
      {SEGS.map((s) => {
        const d = segFrames(s.id);
        const from = at;
        at += d;
        return (
          <Sequence key={s.id} from={from} durationInFrames={d}>
            <Fade dur={d}>{s.node(d)}</Fade>
            <Sequence from={LEAD}>
              <Audio src={staticFile(`audio/${s.id}.mp3`)} />
            </Sequence>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
