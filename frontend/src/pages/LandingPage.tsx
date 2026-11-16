import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { BrandMark, formatBytes, Icon, VERDICT_STYLE, Wordmark } from '../components';
import { savePendingScan } from '../lib/pending';
import { ScanChamber, useScannerCapabilities } from '../scanner';
import type { Artifact, EngineResult, UploadResponse } from '../types';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const NON_RESULTS = new Set(['TIMEOUT', 'FAILURE', 'TYPE-UNSUPPORTED', 'CONFIRMED-TIMEOUT']);

function detectionSummary(results: EngineResult[]) {
  const usable = results.filter((result) => !NON_RESULTS.has(result.verdict));
  const flagged = usable.filter((result) => result.verdict === 'MALICIOUS' || result.verdict === 'SUSPICIOUS');
  return { flagged: flagged.length, total: usable.length };
}

function Redacted({ width }: { width: number | string }) {
  return <span className="redact" style={{ width }} aria-label="Hidden until you sign in" />;
}

const VERDICT_HEADLINE: Record<string, string> = {
  HARMLESS: 'No engine flagged this file',
  SUSPICIOUS: 'Some engines found suspicious behaviour',
  MALICIOUS: 'Engines flagged this file as malicious',
  UNKNOWN: 'No engine reached a firm verdict',
};

const VERDICT_TEXT: Record<string, string> = {
  HARMLESS: 'text-emerald-300',
  SUSPICIOUS: 'text-amber-300',
  MALICIOUS: 'text-rose-300',
  UNKNOWN: 'text-slate-200',
};

/* ------------------------------------------------------------------ */
/* Teaser report (anonymous)                                          */
/* ------------------------------------------------------------------ */

function ScanTeaser({
  artifact,
  upload,
  onReset,
}: {
  artifact: Artifact;
  upload: UploadResponse;
  onReset: () => void;
}) {
  const scan = artifact.latestScan;
  const verdict = scan?.overallVerdict ?? 'UNKNOWN';
  const running = scan?.status === 'RUNNING' || scan?.status === 'QUEUED';
  const results = scan?.engineResults ?? [];
  const { flagged, total } = detectionSummary(results);
  const style = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.UNKNOWN;
  const next = '/app/artifact/' + artifact.id;

  // Flagged engines first, then show only two rows in the clear.
  const ordered = [...results].sort((a, b) => {
    const rank = (r: EngineResult) => (r.verdict === 'MALICIOUS' ? 0 : r.verdict === 'SUSPICIOUS' ? 1 : 2);
    return rank(a) - rank(b);
  });
  const visibleRows = ordered.slice(0, 2);
  const hiddenCount = Math.max(ordered.length - visibleRows.length, 0);
  const placeholderRows = Math.min(Math.max(hiddenCount, 3), 4);

  return (
    <div className="chamber reveal p-5 sm:p-7">
      <span className="chamber-corner tl" />
      <span className="chamber-corner tr" />
      <span className="chamber-corner bl" />
      <span className="chamber-corner br" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-400">Report for</p>
            <p className="display-tight mt-0.5 break-all text-lg text-white">
              {upload.submission.originalFilename ?? 'Uploaded file'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {artifact.file ? formatBytes(Number(artifact.file.size)) : '—'}
              {artifact.file?.mimeType ? ', ' + artifact.file.mimeType : ''}
            </p>
          </div>
          <button className="ghost-button shrink-0 text-xs" onClick={onReset}>
            Scan another
          </button>
        </div>

        {/* Verdict */}
        <div className="mt-6 grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="relative flex h-[88px] w-[88px] items-center justify-center">
            <svg viewBox="0 0 88 88" className="absolute inset-0 -rotate-90">
              <circle cx="44" cy="44" r="38" fill="none" stroke="#232A43" strokeWidth="7" />
              <circle
                cx="44"
                cy="44"
                r="38"
                fill="none"
                stroke={verdict === 'MALICIOUS' ? '#FB4D6D' : verdict === 'SUSPICIOUS' ? '#FBBF24' : verdict === 'HARMLESS' ? '#34D399' : '#66708E'}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={
                  total ? 2 * Math.PI * 38 * (1 - Math.max(flagged / total, verdict === 'HARMLESS' ? 1 : 0.04)) : 2 * Math.PI * 38
                }
              />
            </svg>
            <div className="text-center leading-none">
              <span className="display-tight block text-[26px] text-white">{flagged}</span>
              <span className="mt-1 block text-xs text-slate-500">of {total || '—'}</span>
            </div>
          </div>
          <div>
            <p className={'display text-[28px] sm:text-[34px] ' + VERDICT_TEXT[verdict]}>{style.label}</p>
            <p className="mt-2 text-sm leading-5 text-slate-300">{VERDICT_HEADLINE[verdict]}</p>
            {running && (
              <p className="mt-2 flex items-center gap-2 text-xs text-blue-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                More engines are still reporting. The full report updates live.
              </p>
            )}
          </div>
        </div>

        {/* Engines */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-4 py-2.5 text-xs text-slate-500">
            <span>Engine</span>
            <span>Result</span>
          </div>
          {visibleRows.map((result) => {
            const flaggedRow = result.verdict === 'MALICIOUS' || result.verdict === 'SUSPICIOUS';
            return (
              <div key={result.engine} className="flex items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-2.5 text-sm">
                <span className="text-slate-200">{result.engine}</span>
                <span className={flaggedRow ? 'text-rose-300' : 'text-slate-400'}>
                  {flaggedRow ? result.detectionName ?? result.verdict.toLowerCase() : 'Undetected'}
                </span>
              </div>
            );
          })}
          {Array.from({ length: placeholderRows }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-3 last:border-b-0">
              <Redacted width={70 + ((index * 37) % 60)} />
              <Redacted width={60 + ((index * 53) % 50)} />
            </div>
          ))}
        </div>

        {/* Locked detail */}
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">SHA-256</dt>
            <dd className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-300">
              {artifact.file?.sha256.slice(0, 8)}
              <Redacted width="70%" />
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">AI explanation</dt>
            <dd className="mt-1.5"><Redacted width="90%" /></dd>
          </div>
          <div>
            <dt className="text-slate-500">Community votes</dt>
            <dd className="mt-1.5"><Redacted width="55%" /></dd>
          </div>
          <div>
            <dt className="text-slate-500">Scan history</dt>
            <dd className="mt-1.5"><Redacted width="65%" /></dd>
          </div>
        </dl>

        {/* Unlock */}
        <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/[0.07] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-blue-300"><Icon name="lock" /></span>
            <div>
              <p className="font-semibold text-white">Read the full report</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {hiddenCount > 0
                  ? 'See all ' + ordered.length + ' engine results, '
                  : 'See every engine result, '}
                the complete hashes and a plain-language explanation. This scan is saved to your new account.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link className="primary-button flex-1" to={'/signup?next=' + encodeURIComponent(next)}>
              Create free account
            </Link>
            <Link className="secondary-button flex-1" to={'/login?next=' + encodeURIComponent(next)}>
              I have an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing page                                                       */
/* ------------------------------------------------------------------ */

function LandingNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={
        'fixed inset-x-0 top-0 z-40 transition-colors ' +
        (scrolled ? 'border-b border-slate-800/80 bg-ink/80 backdrop-blur-xl' : 'border-b border-transparent')
      }
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#report" className="hover:text-white">The report</a>
          <a href="#plans" className="hover:text-white">Free account</a>
          <a href="#developers" className="hover:text-white">API</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Link to="/app" className="primary-button h-9 py-0">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="ghost-button hidden sm:inline-flex">
                Sign in
              </Link>
              <Link to="/signup" className="primary-button h-9 py-0">
                Get started free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const STEPS = [
  {
    title: 'Fingerprint',
    body: 'We compute SHA-256, SHA-1 and MD5. If the file was scanned before, you get that report instantly.',
  },
  {
    title: 'Scan',
    body: 'ClamAV runs on our own servers. Public files are also checked against the VirusTotal engine network.',
  },
  {
    title: 'Read',
    body: 'Every engine verdict lands in one report, with an AI explanation of what the findings actually mean.',
  },
];

const REPORT_PARTS = [
  { title: 'Engine-by-engine verdicts', body: 'Which scanners flagged the file, the detection name each one used, and how long it took.' },
  { title: 'Full fingerprints', body: 'SHA-256, SHA-1 and MD5, ready to paste into a ticket or block list.' },
  { title: 'Plain-language explanation', body: 'The assistant reads the evidence and tells you what it means for you, without the jargon.' },
  { title: 'Community signal', body: 'Votes and comments from other analysts who have seen the same file.' },
  { title: 'Scan history', body: 'Every rescan of the artifact over time, so you can see if a verdict changed.' },
];

const COMPARE: Array<{ label: string; guest: boolean | string; member: boolean | string }> = [
  { label: 'Scan files and URLs', guest: true, member: true },
  { label: 'Overall verdict and detection count', guest: true, member: true },
  { label: 'Every engine result and detection name', guest: 'First 2', member: true },
  { label: 'SHA-256, SHA-1, MD5', guest: false, member: true },
  { label: 'AI explanation of the scan', guest: false, member: true },
  { label: 'Private scans that never leave our servers', guest: false, member: true },
  { label: 'Scan history and dashboard', guest: false, member: true },
  { label: 'Comments, votes and notifications', guest: false, member: true },
  { label: 'API keys for automation', guest: false, member: true },
  { label: 'Two-factor sign-in', guest: false, member: true },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') return <span className="text-sm text-slate-300">{value}</span>;
  return value ? (
    <Icon name="check" className="mx-auto h-5 w-5 text-emerald-400" strokeWidth={2.4} />
  ) : (
    <span className="mx-auto block h-px w-4 bg-slate-600" aria-label="Not included" />
  );
}

export default function LandingPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const capabilities = useScannerCapabilities();
  const [result, setResult] = useState<{ upload: UploadResponse; artifact: Artifact } | null>(null);

  const engines = useMemo(
    () => capabilities?.engines.filter((engine) => engine.configured).map((engine) => engine.name) ?? [],
    [capabilities],
  );

  // While external engines are still reporting, refresh the teaser quietly.
  useEffect(() => {
    if (!result) return;
    const status = result.artifact.latestScan?.status;
    if (status !== 'RUNNING' && status !== 'QUEUED') return;

    const timer = window.setInterval(async () => {
      try {
        await api.refreshArtifactScan(result.artifact.id).catch(() => undefined);
        const artifact = await api.artifact(result.artifact.id);
        setResult((current) => (current ? { ...current, artifact } : current));
      } catch {
        // Keep the current teaser.
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [result]);

  async function scan(file: File) {
    const upload = await api.uploadFile(file, { visibility: 'PUBLIC', forceRescan: false }, token);

    if (user) {
      navigate('/app/artifact/' + upload.artifact.id, {
        state: { reusedScan: upload.reusedScan, submissionVisibility: upload.submission.visibility },
      });
      return;
    }

    const artifact = await api.artifact(upload.artifact.id);

    if (upload.claimToken) {
      savePendingScan({
        artifactId: upload.artifact.id,
        submissionId: upload.submission.id,
        claimToken: upload.claimToken,
        name: upload.submission.originalFilename ?? 'your file',
        verdict: artifact.latestScan?.overallVerdict,
        createdAt: Date.now(),
      });
    }

    setResult({ upload, artifact });
  }

  return (
    <div className="landing min-h-screen">
      <LandingNav />

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="landing-grid-bg" />
        <div className="landing-glow -right-64 -top-72" />

        <div className={'relative mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-24 ' + (result ? 'items-start' : 'items-center')}>
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-sm text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {engines.length ? 'Scanning with ' + engines.join(' and ') : 'Multi-engine malware scanning'}
            </p>

            <h1 className="display mt-6 text-[44px] text-white sm:text-[60px] xl:text-[72px]">
              Know what a file does before you open it.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Drop any file and GO VIRUS checks it against multiple antivirus engines in seconds, then explains the
              result in plain language. The verdict is free, no account needed.
            </p>

            <dl className="mt-10 hidden max-w-xl gap-6 border-t border-slate-800 pt-6 sm:grid sm:grid-cols-3">
              <div>
                <dt className="text-sm font-semibold text-white">Nothing kept</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-400">Files are deleted once scanned. Only hashes stay.</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-white">Private mode</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-400">Private scans never leave our servers.</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-white">Free account</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-400">Full reports and history. No card asked.</dd>
              </div>
            </dl>
          </div>

          <div id="scan" className="relative scroll-mt-24">
            {result ? (
              <ScanTeaser artifact={result.artifact} upload={result.upload} onReset={() => setResult(null)} />
            ) : (
              <ScanChamber capabilities={capabilities} onScan={scan} buttonLabel="Scan for free" />
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- How it works */}
      <section id="how" className="relative scroll-mt-16 border-t border-slate-800/80 py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="display text-[34px] text-white sm:text-[44px]">From upload to answer in three steps.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-400">
              The same pipeline runs whether you drop one file from your inbox or push thousands through the API.
            </p>
          </div>

          <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
            <div className="absolute left-0 right-0 top-[22px] hidden h-px bg-gradient-to-r from-beam/60 via-blue-500/40 to-transparent md:block" />
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                <span className="display-tight relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-ink text-beam">
                  {index + 1}
                </span>
                <h3 className="display-tight mt-6 text-xl text-white">{step.title}</h3>
                <p className="mt-2 max-w-sm leading-7 text-slate-400">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------- Full report */}
      <section id="report" className="relative scroll-mt-16 overflow-hidden border-t border-slate-800/80 py-24">
        <div className="landing-glow -left-96 top-0 opacity-60" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 className="display text-[34px] text-white sm:text-[44px]">The full report, with nothing blacked out.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-400">
              Guests see the verdict. Members see the evidence behind it.
            </p>
            <ul className="mt-10 divide-y divide-slate-800 border-y border-slate-800">
              {REPORT_PARTS.map((part) => (
                <li key={part.title} className="grid gap-1 py-4 sm:grid-cols-[220px_1fr] sm:gap-6">
                  <span className="font-semibold text-white">{part.title}</span>
                  <span className="text-[15px] leading-6 text-slate-400">{part.body}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Static illustration of a full report */}
          <div className="chamber p-6" aria-hidden="true">
            <span className="chamber-corner tl" />
            <span className="chamber-corner tr" />
            <span className="chamber-corner bl" />
            <span className="chamber-corner br" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">invoice_march.docm</p>
                  <p className="display mt-1 text-3xl text-rose-300">Malicious</p>
                </div>
                <div className="text-right">
                  <p className="display-tight text-3xl text-white">23<span className="text-slate-500">/64</span></p>
                  <p className="text-xs text-slate-500">engines flagged it</p>
                </div>
              </div>
              <div className="mt-6 space-y-px overflow-hidden rounded-xl border border-slate-800 text-sm">
                {[
                  ['ClamAV', 'Doc.Downloader.Emotet-9'],
                  ['Kaspersky', 'HEUR:Trojan.MSOffice.SAgent'],
                  ['ESET-NOD32', 'VBA/TrojanDownloader.Agent'],
                  ['Microsoft', 'TrojanDownloader:O97M/Emotet'],
                  ['Sophos', 'Undetected'],
                ].map(([engine, name]) => (
                  <div key={engine} className="flex justify-between gap-4 bg-slate-950/60 px-4 py-2.5">
                    <span className="text-slate-300">{engine}</span>
                    <span className={'truncate ' + (name === 'Undetected' ? 'text-slate-500' : 'text-rose-300')}>{name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-blue-200">
                  <Icon name="spark" className="h-4 w-4" /> What this means
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  This Word document carries a macro that downloads a second-stage payload when editing is enabled.
                  Delete it and do not enable content if it reached other inboxes.
                </p>
              </div>
              <p className="mt-4 truncate font-mono text-xs text-slate-500">
                sha256 4f3c9a0e1b7d2c86e5a91f0b3d74c2e8a6b1f5d09e3c7a2b48f6d1e0c9b3a7f2
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Compare */}
      <section id="plans" className="scroll-mt-16 border-t border-slate-800/80 py-24">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="display text-[34px] text-white sm:text-[44px]">A free account unlocks the rest.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-400">No trial and no card. Sign up with an email and a password.</p>
          </div>

          <div className="mt-12 overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="px-5 py-4 text-sm font-medium text-slate-400">What you get</th>
                  <th className="w-36 px-5 py-4 text-center text-sm font-semibold text-slate-200">Guest</th>
                  <th className="w-44 bg-blue-500/[0.08] px-5 py-4 text-center">
                    <span className="text-sm font-semibold text-white">Free account</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.label} className="border-b border-slate-800/70 last:border-b-0">
                    <td className="px-5 py-3.5 text-[15px] text-slate-200">{row.label}</td>
                    <td className="px-5 py-3.5 text-center"><Cell value={row.guest} /></td>
                    <td className="bg-blue-500/[0.05] px-5 py-3.5 text-center"><Cell value={row.member} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-800">
                  <td className="px-5 py-4" />
                  <td className="px-5 py-4 text-center">
                    <a href="#scan" className="text-link">Scan as guest</a>
                  </td>
                  <td className="bg-blue-500/[0.05] px-5 py-4 text-center">
                    <Link to="/signup" className="primary-button w-full">Create account</Link>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Developers */}
      <section id="developers" className="scroll-mt-16 border-t border-slate-800/80 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="display text-[34px] text-white sm:text-[44px]">Put scanning inside your own tools.</h2>
            <p className="mt-4 max-w-lg text-lg leading-8 text-slate-400">
              Create an API key from your dashboard and submit files or URLs from scripts, CI pipelines or mail
              gateways. Keys are stored as hashes and rate-limited per key.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup?next=%2Fapp%2Fapi-keys" className="primary-button">Get an API key</Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#070A13]">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              <span className="ml-2">terminal</span>
            </div>
            <pre className="code-block overflow-x-auto p-5 text-slate-300">
              <code>
                <span className="text-slate-500"># Submit a file</span>{'\n'}
                <span className="text-beam">curl</span> -X POST \{'\n'}
                {'  '}-H <span className="text-emerald-300">"X-API-Key: gv_your_key"</span> \{'\n'}
                {'  '}-F <span className="text-emerald-300">"file=@suspicious.zip"</span> \{'\n'}
                {'  '}https://your-host/api/v1/files{'\n\n'}
                <span className="text-slate-500"># Look up a report</span>{'\n'}
                <span className="text-beam">curl</span> -H <span className="text-emerald-300">"X-API-Key: gv_your_key"</span> \{'\n'}
                {'  '}https://your-host/api/v1/artifacts/ARTIFACT_ID
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Trust */}
      <section className="border-t border-slate-800/80 py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="display-tight text-2xl text-white">Built the way a security tool should be.</h2>
          <div className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Behind a WAF', 'Every request passes the OWASP Core Rule Set before it reaches the app.'],
              ['TLS 1.2 and 1.3 only', 'Older protocols are refused at the edge.'],
              ['Two-factor sign-in', 'Protect your account with any authenticator app.'],
              ['Session control', 'See every signed-in device and sign any of them out.'],
            ].map(([title, body]) => (
              <div key={title} className="border-l border-slate-700 pl-4">
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- CTA */}
      <section className="relative overflow-hidden border-t border-slate-800/80 py-24">
        <div className="landing-glow left-1/2 top-0 -translate-x-1/2 opacity-70" />
        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="display text-[38px] text-white sm:text-[52px]">Got a file you're not sure about?</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-400">Scan it now. It takes a few seconds and costs nothing.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#scan" className="primary-button px-6 py-3 text-base">Scan a file</a>
            <Link to="/signup" className="secondary-button px-6 py-3 text-base">Create free account</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <Wordmark className="text-[15px]" />
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#how" className="hover:text-slate-300">How it works</a>
            <a href="#report" className="hover:text-slate-300">The report</a>
            <a href="#developers" className="hover:text-slate-300">API</a>
            <Link to="/login" className="hover:text-slate-300">Sign in</Link>
          </nav>
          <p>Built for ft_transcendence at 42.</p>
        </div>
      </footer>
    </div>
  );
}
