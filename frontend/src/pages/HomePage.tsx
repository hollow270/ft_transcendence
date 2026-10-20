import { DragEvent, FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { BrandMark } from '../components';

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-16 w-16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 45H14a9 9 0 0 1-.7-18A16 16 0 0 1 44 22a11 11 0 0 1 6 21h-5" />
      <path d="M32 48V27" />
      <path d="m24 35 8-8 8 8" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 2c.8 4.6 2.8 6.6 7.5 7.5C14.8 10.3 12.8 12.3 12 17c-.8-4.7-2.8-6.7-7.5-7.5C9.2 8.6 11.2 6.6 12 2Z" />
      <path d="M19 16c.4 2.2 1.3 3.2 3.5 3.5-2.2.4-3.1 1.3-3.5 3.5-.4-2.2-1.3-3.1-3.5-3.5 2.2-.3 3.1-1.3 3.5-3.5Z" />
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

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  async function askAi(event: FormEvent) {
    event.preventDefault();

    if (!token) {
      setAiError('Sign in to use the AI assistant.');
      return;
    }

    const prompt = aiPrompt.trim();
    if (!prompt) return;

    setAiBusy(true);
    setAiAnswer('');
    setAiError(null);

    try {
      await api.askAi(prompt, token, (text) => {
        setAiAnswer((current) => current + text);
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI request failed');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <main className="gv-home">
      <section className="gv-center-stage">
        <div className="gv-home-brand">
          <BrandMark className="h-20 w-20 sm:h-24 sm:w-24" />
          <div>
            <h1>
              <span>go </span>
              <strong>virus</strong>
            </h1>
            <p>ANALYZE · DETECT · STAY AHEAD</p>
          </div>
        </div>

        <form className="gv-upload-wrap" onSubmit={submit}>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />

          <div
            className={
              'gv-upload-card ' +
              (dragging ? 'gv-upload-card-dragging' : '')
            }
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                inputRef.current?.click();
              }
            }}
          >
            <div className="text-sky-400">
              <UploadIcon />
            </div>

            <div className="mt-4 text-2xl font-semibold tracking-wide text-white">
              FILE
            </div>

            {file ? (
              <>
                <p className="mt-2 max-w-md break-all text-sm font-medium text-slate-200">
                  {file.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatBytes(file.size)} · {file.type || 'Unknown type'}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                Drag and drop a file here, or click to upload
              </p>
            )}
          </div>

          <div className="gv-upload-controls">
            <label>
              <span>Visibility</span>
              <select
                className="gv-compact-select"
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')
                }
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE" disabled={!user}>Private</option>
              </select>
            </label>

            <label className="gv-checkbox">
              <input
                type="checkbox"
                checked={forceRescan}
                onChange={(event) => setForceRescan(event.target.checked)}
              />
              <span>Force rescan</span>
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={!file || busy}
            >
              {busy ? 'Scanning…' : 'Scan file'}
            </button>
          </div>

          {message && (
            <div className="gv-inline-error">{message}</div>
          )}
        </form>
      </section>

      <aside className="gv-ai-panel">
        <div className="gv-ai-header">
          <span className="text-cyan-400"><SparkleIcon /></span>
          <span>AI ASSISTANT</span>
        </div>

        <div className="gv-ai-body">
          {!user ? (
            <div className="gv-ai-empty">
              <div className="text-cyan-400"><SparkleIcon /></div>
              <p>Sign in to ask the GO VIRUS assistant.</p>
            </div>
          ) : aiAnswer || aiBusy || aiError ? (
            <div className="gv-ai-response">
              {aiError && <div className="gv-inline-error">{aiError}</div>}
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {aiAnswer || (aiBusy ? 'Generating response…' : '')}
              </div>
            </div>
          ) : (
            <div className="gv-ai-empty">
              <div className="text-cyan-400"><SparkleIcon /></div>
              <p>Ask about malware, scan terminology, or security findings.</p>
            </div>
          )}
        </div>

        <form className="gv-ai-compose" onSubmit={askAi}>
          <input
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder={user ? 'Ask the assistant…' : 'Sign in to use AI'}
            disabled={!user || aiBusy}
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={!user || aiBusy || !aiPrompt.trim()}
            aria-label="Send question"
          >
            ↑
          </button>
        </form>
      </aside>
    </main>
  );
}
