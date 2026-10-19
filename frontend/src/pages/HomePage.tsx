import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { BrandMark } from '../components';

function FileScanIcon() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="mx-auto h-28 w-28 text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <path d="M34 16h35l18 18v70H34z" />
      <path d="M69 16v20h18" />
      <path d="M18 59h84" stroke="#38bdf8" strokeWidth="4" />
      <path d="M50 82c0-10 20-10 20 0 0 5-4 8-4 13" />
      <path d="M44 82c0-18 32-18 32 0 0 9-7 13-7 22" />
      <path d="M55 94c0-5 10-5 10 0" />
    </svg>
  );
}

export default function HomePage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [forceRescan, setForceRescan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!file) {
      setMessage('Choose a file first.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result = await api.uploadFile(
        file,
        { visibility, forceRescan },
        token,
      );

      navigate('/artifact/' + result.artifact.id, {
        state: {
          reusedScan: result.reusedScan,
          submissionVisibility: result.submission.visibility,
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="hero-grid relative overflow-hidden border-b border-[#1d2b48]">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-10 text-center sm:pt-12">
          <BrandMark className="mx-auto h-40 w-40 sm:h-48 sm:w-48" />

          <h1 className="mt-1 text-5xl font-bold tracking-[0.08em] sm:text-6xl">
            <span className="text-slate-100">GO </span>
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-lime-300 bg-clip-text text-transparent">
              VIRUS
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Analyse suspicious files to detect malware and other security threats,
            and share results with the security community.
          </p>

          <div className="mx-auto mt-10 max-w-3xl">
            <div className="border-b border-[#445473] pb-3 text-sm font-semibold tracking-wide text-[#8eb7ff]">
              FILE
            </div>

            <form onSubmit={submit} className="pt-8">
              <label className="mx-auto block w-fit cursor-pointer">
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <FileScanIcon />
                <span className="choose-button mt-3">
                  {file ? file.name : 'Choose file'}
                </span>
              </label>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  <span>Visibility</span>
                  <select
                    className="dark-select"
                    value={visibility}
                    onChange={(event) =>
                      setVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')
                    }
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE" disabled={!user}>Private</option>
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={forceRescan}
                    onChange={(event) => setForceRescan(event.target.checked)}
                  />
                  Force rescan
                </label>

                <button className="scan-button" disabled={!file || busy}>
                  {busy ? 'Scanning…' : 'Scan file'}
                </button>
              </div>
            </form>

            {message && (
              <div className="mx-auto mt-5 max-w-3xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
                {message}
              </div>
            )}

            <p className="mx-auto mt-8 max-w-3xl text-xs leading-5 text-slate-400">
              Public submissions can appear in community features. Private mode is
              available to registered users. Uploaded binaries are temporary; scan
              metadata and results remain available according to the project rules.
            </p>

            <div className="mx-auto mt-10 max-w-3xl border border-[#223657] bg-[#121d34] px-4 py-3 text-xs text-slate-300">
              Want to automate submissions? <span className="text-[#69a7ff]">API access</span>{' '}
              is part of the project roadmap.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
