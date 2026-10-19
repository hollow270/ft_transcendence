import { FormEvent, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';

export default function LlmPage() {
  const { token, user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || !prompt.trim()) return;

    setBusy(true);
    setAnswer('');
    setError(null);

    try {
      await api.askAi(prompt.trim(), token, (text) => {
        setAnswer((current) => current + text);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-page">
      <PageHeader
        title="AI assistant"
        description="Ask cybersecurity questions. For file-specific explanations, use the AI tab on an artifact report."
      />

      {!user ? (
        <StatusNotice title="Sign in required">
          The AI assistant is available to registered users.
        </StatusNotice>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="surface">
            <div className="surface-header">
              <h2 className="text-sm font-semibold text-slate-200">New question</h2>
            </div>
            <div className="surface-body">
              <form onSubmit={submit}>
                <textarea
                  className="app-input min-h-36 resize-y"
                  value={prompt}
                  maxLength={4000}
                  placeholder="Ask about a malware concept, scan terminology, or security practice…"
                  onChange={(event) => setPrompt(event.target.value)}
                />

                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-600">{prompt.length}/4000</span>
                  <button className="primary-button" disabled={busy || !prompt.trim()}>
                    {busy ? 'Generating…' : 'Ask'}
                  </button>
                </div>
              </form>

              {error && (
                <div className="mt-5 rounded-md border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {(answer || busy) && (
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      GO VIRUS assistant
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {answer || 'Generating response…'}
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="surface">
              <div className="surface-body">
                <h2 className="text-sm font-semibold text-slate-200">Data handling</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  GO VIRUS does not persist the prompt or generated answer. Usage metrics such as model, token counts, latency and success are logged.
                </p>
              </div>
            </section>

            <section className="surface">
              <div className="surface-body">
                <h2 className="text-sm font-semibold text-slate-200">Scan explanations</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Open an artifact report and use its AI tab to explain the structured scan evidence for that specific analysis.
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
