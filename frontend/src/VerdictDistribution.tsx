import { useState } from 'react';

const VERDICT_SLICES = [
  { key: 'MALICIOUS', label: 'Malicious', color: '#FB7185' },
  { key: 'SUSPICIOUS', label: 'Suspicious', color: '#FBBF24' },
  { key: 'HARMLESS', label: 'No detections', color: '#34D399' },
  { key: 'UNKNOWN', label: 'Inconclusive', color: '#8792B0' },
] as const;

const CENTER = 70;
const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function VerdictDistribution({ verdicts }: { verdicts: Record<string, number> }) {
  const [active, setActive] = useState<string | null>(null);

  const slices = VERDICT_SLICES.map((slice) => ({ ...slice, value: verdicts[slice.key] ?? 0 }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  const arcs = slices
    .filter((slice) => slice.value > 0)
    .reduce<Array<(typeof slices)[number] & { length: number; start: number }>>((list, slice) => {
      const length = (slice.value / total) * CIRCUMFERENCE;
      const start = list.length ? list[list.length - 1].start + list[list.length - 1].length : 0;
      return [...list, { ...slice, length, start }];
    }, []);

  const summary = slices.map((slice) => slice.label + ': ' + slice.value).join(', ');

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg
        viewBox="0 0 140 140"
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label={'Verdict distribution. ' + summary}
      >
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#232A43" strokeWidth="18" />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth={active === arc.key ? 22 : 18}
            strokeDasharray={arc.length + ' ' + (CIRCUMFERENCE - arc.length)}
            strokeDashoffset={-arc.start}
            transform={'rotate(-90 ' + CENTER + ' ' + CENTER + ')'}
            opacity={active && active !== arc.key ? 0.35 : 1}
          />
        ))}
        <text x={CENTER} y={CENTER - 2} textAnchor="middle" className="fill-slate-100 text-[22px] font-semibold">
          {total.toLocaleString()}
        </text>
        <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-slate-400 text-[9px]">
          scans
        </text>
      </svg>

      <ul className="w-full space-y-2">
        {slices.map((slice) => (
          <li key={slice.key}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-800/60 focus-visible:bg-slate-800/60"
              onMouseEnter={() => setActive(slice.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(slice.key)}
              onBlur={() => setActive(null)}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: slice.color }} aria-hidden="true" />
              <span className="flex-1 text-slate-200">{slice.label}</span>
              <span className="font-medium text-slate-100">{slice.value.toLocaleString()}</span>
              <span className="w-12 text-right text-slate-400">
                {total ? Math.round((slice.value / total) * 100) : 0}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
