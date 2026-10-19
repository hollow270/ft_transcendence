import { FormEvent, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

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
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="border-b border-[#263753] pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">GO VIRUS AI</p>
        <h1 className="mt-2 text-2xl font-semibold">Cybersecurity assistant</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Ask for explanations of cybersecurity concepts. Scan-specific explanations are
          available directly from an artifact result page.
        </p>
      </div>

      {!user ? (
        <div className="mt-6 border border-[#263753] bg-[#11192b] p-5 text-sm text-slate-400">
          Sign in to use the AI assistant.
        </div>
      ) : (
        <>
          <form className="mt-6" onSubmit={submit}>
            <textarea
              className="dark-control min-h-32 resize-y"
              value={prompt}
              maxLength={4000}
              placeholder="Example: Explain the difference between a trojan and a worm."
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                GO VIRUS does not persist prompts or generated answers.
              </p>
              <button className="scan-button" disabled={busy || !prompt.trim()}>
                {busy ? 'Generating…' : 'Ask AI'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-5 border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {(answer || busy) && (
            <section className="mt-6 border border-[#263753] bg-[#11192b] p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-400">
                Response
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {answer || 'Generating…'}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
