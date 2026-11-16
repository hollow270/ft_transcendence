import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Icon, PageHeader } from '../components';
import { ScanChamber, ScanOptions, useScannerCapabilities } from '../scanner';

const SUGGESTIONS = [
  'What is an EICAR test file?',
  'Why would one engine flag a file that others call clean?',
  'Is a macro-enabled .docm attachment risky?',
];

export default function ScanPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const capabilities = useScannerCapabilities();

  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scan(file: File, options: ScanOptions) {
    const result = await api.uploadFile(file, options, token);
    navigate('/app/artifact/' + result.artifact.id, {
      state: { reusedScan: result.reusedScan, submissionVisibility: result.submission.visibility },
    });
  }

  async function ask(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const question = (preset ?? prompt).trim();
    if (!question || !token) return;

    setBusy(true);
    setAnswer('');
    setAsked(question);
    setPrompt('');
    setError(null);
    try {
      await api.askAi(question, token, (text) => setAnswer((current) => current + text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant could not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Scan a file"
        description="Upload anything up to the size limit. Public files are checked by every configured engine; private files stay on the local ClamAV engine."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {capabilities && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {capabilities.engines.map((engine) => (
                <span
                  key={engine.name}
                  className={
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ' +
                    (engine.configured
                      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/25 bg-amber-500/10 text-amber-300')
                  }
                >
                  <span className={'h-1.5 w-1.5 rounded-full ' + (engine.configured ? 'bg-emerald-400' : 'bg-amber-400')} />
                  {engine.name} {engine.configured ? 'online' : 'not configured'}
                </span>
              ))}
            </div>
          )}

          {capabilities?.provider === 'development' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              The development scanner is active. Results are placeholders, not real antivirus verdicts.
            </div>
          )}

          <ScanChamber capabilities={capabilities} onScan={scan} showOptions allowPrivate />
        </div>

        <aside className="surface flex min-h-[460px] flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-slate-800 px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
              <Icon name="spark" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Ask the assistant</p>
              <p className="text-xs text-slate-500">Malware, detections and security terms</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {asked ? (
              <div className="space-y-4">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white">{asked}</p>
                {error ? (
                  <div className="gv-inline-error mt-0">{error}</div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    {answer || <span className="text-slate-500">Thinking…</span>}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-400">Try asking</p>
                <div className="mt-3 space-y-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
                      onClick={() => void ask(undefined, suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form className="flex gap-2 border-t border-slate-800 p-3" onSubmit={ask}>
            <input
              className="app-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask a question"
              disabled={busy}
              maxLength={4000}
            />
            <button className="primary-button px-3" disabled={busy || !prompt.trim()} aria-label="Send question">
              <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
