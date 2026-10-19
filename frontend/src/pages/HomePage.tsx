import { DragEvent, FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader } from '../components';

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function HomePage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [forceRescan, setForceRescan] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function acceptFile(nextFile?: File | null) {
    if (!nextFile) return;
    setMessage(null);
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!file) {
      setMessage('Choose a file before starting the scan.');
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
    <main className="app-page">
      <PageHeader
        title="File analysis"
        description="Submit a file to identify it by hash, check previous analysis, and create a new scan when required."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface">
          <div className="surface-header">
            <h2 className="text-sm font-semibold text-slate-200">Submit a file</h2>
            <p className="mt-1 text-xs text-slate-500">Maximum size: 25 MB</p>
          </div>

          <form onSubmit={submit} className="surface-body">
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={(event) => acceptFile(event.target.files?.[0])}
            />

            <div
              className={
                'rounded-lg border border-dashed px-6 py-12 text-center transition ' +
                (dragging
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-slate-700 bg-slate-950/40')
              }
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400">
                <FileIcon />
              </div>

              {file ? (
                <div className="mt-4">
                  <p className="break-all text-sm font-medium text-slate-200">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatBytes(file.size)} · {file.type || 'Unknown type'}
                  </p>
                  <button
                    type="button"
                    className="text-link mt-3"
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose another file
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-200">
                    Drag and drop a file here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">or select it from your computer</p>
                  <button
                    type="button"
                    className="secondary-button mt-4"
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose file
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-400">
                  Visibility
                </span>
                <select
                  className="app-select w-full"
                  value={visibility}
                  onChange={(event) =>
                    setVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')
                  }
                >
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE" disabled={!user}>Private</option>
                </select>
                {!user && (
                  <span className="mt-1.5 block text-xs text-slate-600">
                    Sign in to create private submissions.
                  </span>
                )}
              </label>

              <label className="flex items-start gap-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={forceRescan}
                  onChange={(event) => setForceRescan(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-300">Force rescan</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    Ignore a reusable fresh result and create a new scan.
                  </span>
                </span>
              </label>
            </div>

            {message && (
              <div className="mt-4 rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {message}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              {file && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setFile(null)}
                  disabled={busy}
                >
                  Clear
                </button>
              )}
              <button className="primary-button min-w-28" disabled={!file || busy}>
                {busy ? 'Scanning…' : 'Scan file'}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-5">
          <section className="surface">
            <div className="surface-header">
              <h2 className="text-sm font-semibold text-slate-200">How it works</h2>
            </div>
            <div className="surface-body space-y-4 text-sm">
              <div>
                <p className="font-medium text-slate-300">1. Identify the file</p>
                <p className="mt-1 leading-5 text-slate-500">
                  GO VIRUS calculates the file hashes and checks whether the artifact already exists.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-300">2. Check scan freshness</p>
                <p className="mt-1 leading-5 text-slate-500">
                  A recent completed result can be reused instead of scanning the same file again.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-300">3. Store engine results</p>
                <p className="mt-1 leading-5 text-slate-500">
                  Each engine result is kept separately so the report shows exactly what was detected.
                </p>
              </div>
            </div>
          </section>

          <section className="surface">
            <div className="surface-body">
              <h2 className="text-sm font-semibold text-slate-200">Privacy</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Uploaded binaries are temporary. Public submissions may be visible in community features.
                Private submissions require an account and are excluded from public discussion.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
