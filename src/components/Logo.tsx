// Qaid mark: the Arabic letter ق (qaf, the Q of قيد), outlined from Reem Kufi, in gold on issuing green.
// tile=false is for dark headers (gold only); tile=true is the app-icon version.
const QAF =
  'M31.4 52Q28.46 52 26.28 50.99Q24.11 49.98 22.71 48.35Q21.31 46.72 20.64 44.81Q19.97 42.89 19.97 41.13Q19.97 37.72 21.16 35Q22.35 32.28 24.21 30.63Q24.32 31.61 24.29 32.52Q24.26 33.42 23.54 34.41Q23.95 34.35 24.86 34.74Q25.76 35.13 26.02 36.58Q24.94 36.42 24.24 36.5Q23.54 36.58 22.97 36.94Q22.25 37.41 21.88 38.62Q21.52 39.84 21.52 41.13Q21.52 43.1 22.66 44.78Q23.8 46.46 26 47.5Q28.2 48.53 31.4 48.53Q35.39 48.53 37.12 46.59Q38.86 44.65 38.86 40.36V36.84L44.03 33.11V38.29Q44.03 39.12 43.85 40.75Q43.67 42.38 43.02 44.29Q42.38 46.2 41 47.96Q39.63 49.72 37.3 50.86Q34.98 52 31.4 52ZM36.37 40.87Q34.25 40.87 32.49 39.84Q30.73 38.8 29.7 37.02Q28.66 35.23 28.66 33.11Q28.66 30.94 29.7 29.18Q30.73 27.42 32.49 26.39Q34.25 25.35 36.37 25.35Q38.49 25.35 40.23 26.39Q41.96 27.42 43 29.18Q44.03 30.94 44.03 33.11Q44.03 35.23 43 37.02Q41.96 38.8 40.23 39.84Q38.49 40.87 36.37 40.87ZM36.37 35.7Q37.46 35.7 38.21 34.95Q38.96 34.2 38.96 33.11Q38.96 32.03 38.21 31.28Q37.46 30.53 36.37 30.53Q35.29 30.53 34.54 31.28Q33.79 32.03 33.79 33.11Q33.79 34.2 34.54 34.95Q35.29 35.7 36.37 35.7ZM40.72 18Q39.48 18 38.6 17.12Q37.72 16.24 37.72 15Q37.72 13.76 38.6 12.88Q39.48 12 40.72 12Q41.96 12 42.84 12.88Q43.72 13.76 43.72 15Q43.72 16.24 42.84 17.12Q41.96 18 40.72 18ZM31.77 18Q30.53 18 29.65 17.12Q28.77 16.24 28.77 15Q28.77 13.76 29.65 12.88Q30.53 12 31.77 12Q33.01 12 33.89 12.88Q34.77 13.76 34.77 15Q34.77 16.24 33.89 17.12Q33.01 18 31.77 18Z';

export function LogoMark({ size = 32, tile = true, className }: { size?: number; tile?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Qaid" className={className} fill="none">
      {tile && (
        <>
          <rect width="64" height="64" rx="15" fill="#0d4a43" />
          <g stroke="#c8a24a" opacity=".4">
            <circle cx="32" cy="32" r="29.5" strokeWidth=".7" />
            <circle cx="32" cy="32" r="26" strokeWidth=".7" />
          </g>
        </>
      )}
      <path d={QAF} fill="#c8a24a" stroke="#c8a24a" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ name = 'Qaid', size = 36, tile = false, className = '' }: { name?: string; size?: number; tile?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} tile={tile} />
      <span className="font-disp text-3xl font-bold leading-none">{name}</span>
    </span>
  );
}
