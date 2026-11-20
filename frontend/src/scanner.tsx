import { DragEvent, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { formatBytes, Icon } from './components';
import type { ScannerCapabilities } from './types';

export function useScannerCapabilities() {
  const [capabilities, setCapabilities] = useState<ScannerCapabilities | null>(null);

  useEffect(() => {
    api.scannerCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
  }, []);

  return capabilities;
}

const MIME_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;

export function validateFile(file: File, maxMb: number): string | null {
  if (file.size <= 0) return 'This file is empty. Choose a file that has content.';
  if (file.size > maxMb * 1024 * 1024) return 'This file is larger than ' + maxMb + ' MB. Choose a smaller file.';
  if (!file.name || file.name.length > 255) return 'The file name must be between 1 and 255 characters.';
  if (/[\u0000-\u001F\u007F]/.test(file.name)) return 'The file name contains characters that are not allowed.';
  if (file.type && !MIME_TYPE_PATTERN.test(file.type)) return 'The type of this file is not valid.';
  return null;
}

export type ScanOptions = { visibility: 'PUBLIC' | 'PRIVATE'; forceRescan: boolean };

type FilePreview = { kind: 'image'; url: string } | { kind: 'text'; text: string } | null;

const TEXT_MIME_TYPES = /^(text\/|application\/(json|xml|javascript))/;
const TEXT_EXTENSIONS = /\.(txt|md|csv|json|xml|log|ini|ya?ml|js|ts|py|sh|html|css)$/i;
const PREVIEW_CHARACTERS = 600;

function useFilePreview(file: File | null) {
  const [preview, setPreview] = useState<FilePreview>(null);

  useEffect(() => {
    setPreview(null);
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview({ kind: 'image', url });
      return () => URL.revokeObjectURL(url);
    }

    if (TEXT_MIME_TYPES.test(file.type) || TEXT_EXTENSIONS.test(file.name)) {
      let active = true;
      void file
        .slice(0, 2048)
        .text()
        .then((text) => {
          if (!active) return;
          const readable = text.slice(0, PREVIEW_CHARACTERS).replace(/[^\t\n\r\u0020-\u007E\u00A0-\uFFFF]/g, '·');
          setPreview({ kind: 'text', text: readable });
        });
      return () => {
        active = false;
      };
    }
  }, [file]);

  return preview;
}

const STAGES = [
  'Computing SHA-256, SHA-1 and MD5',
  'Checking for an existing report',
  'Streaming to the local ClamAV engine',
  'Collecting engine verdicts',
  'Writing the report',
];

/**
 * The scanner "chamber": a drop target that turns into a live scan readout
 * while the parent's onScan promise is pending.
 */
export function ScanChamber({
  onScan,
  capabilities,
  showOptions = false,
  allowPrivate = false,
  compact = false,
  buttonLabel = 'Scan file',
}: {
  onScan: (file: File, options: ScanOptions, onProgress: (fraction: number) => void) => Promise<void>;
  capabilities: ScannerCapabilities | null;
  showOptions?: boolean;
  allowPrivate?: boolean;
  compact?: boolean;
  buttonLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [forceRescan, setForceRescan] = useState(false);

  const maxMb = capabilities?.maxFileSizeMb ?? 25;
  const preview = useFilePreview(file);
  const uploading = busy && progress < 1;
  const analysing = busy && progress >= 1;
  const percent = Math.round(progress * 100);

  useEffect(() => {
    if (!analysing) return;
    setStage(0);
    const timer = window.setInterval(() => {
      setStage((value) => Math.min(value + 1, STAGES.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [analysing]);

  function accept(next?: File | null) {
    if (!next) return;
    const problem = validateFile(next, maxMb);
    setError(problem);
    setFile(problem ? null : next);
  }

  async function start(target = file) {
    if (!target || busy) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      await onScan(target, { visibility, forceRescan }, setProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The scan could not start. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped) return;
    const problem = validateFile(dropped, maxMb);
    setError(problem);
    if (problem) return;
    setFile(dropped);
  }

  const padding = compact ? 'p-6' : 'p-6 sm:p-8';

  return (
    <div className={'chamber ' + padding}>
      <span className="chamber-corner tl" />
      <span className="chamber-corner tr" />
      <span className="chamber-corner bl" />
      <span className="chamber-corner br" />
      {busy && <div className="chamber-beam" />}

      <input
        ref={inputRef}
        aria-label="Choose a file to scan"
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {busy && file ? (
        <div className={'relative flex flex-col justify-center ' + (compact ? 'min-h-[180px]' : 'min-h-[300px]')}>
          <p className="text-sm text-beam" role="status">
            {uploading ? 'Uploading' : 'Scanning'}
          </p>
          <p className="display-tight mt-1 break-all text-xl text-white sm:text-2xl">{file.name}</p>
          <p className="mt-1 text-sm text-slate-400">{formatBytes(file.size)}</p>
          {uploading ? (
            <div className="mt-6">
              <div
                className="h-2 overflow-hidden rounded-full bg-slate-800"
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="h-full rounded-full bg-beam transition-[width] duration-150" style={{ width: percent + '%' }} />
              </div>
              <p className="mt-2 text-sm text-slate-300">{percent}% uploaded</p>
            </div>
          ) : (
            <ol className="mt-6 space-y-2 text-sm">
              {STAGES.slice(0, stage + 1).map((label, index) => (
                <li key={label} className="engine-tick flex items-center gap-3">
                  {index < stage ? (
                    <Icon name="check" className="h-4 w-4 text-emerald-400" strokeWidth={2.4} />
                  ) : (
                    <span className="h-4 w-4 animate-pulse rounded-full border-2 border-beam/70" />
                  )}
                  <span className={index < stage ? 'text-slate-400' : 'text-slate-100'}>{label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div
          className={
            'chamber-drop relative flex cursor-pointer flex-col items-center justify-center text-center ' +
            (compact ? 'min-h-[180px] px-4 py-6' : 'min-h-[300px] px-6 py-10') +
            (dragging ? ' chamber-drop-active' : '')
          }
          role="button"
          tabIndex={0}
          aria-label="Choose a file to scan"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span
            className={
              'flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-beam ' +
              (compact ? 'h-12 w-12' : 'h-16 w-16')
            }
          >
            <Icon name={file ? 'file' : 'upload'} className={compact ? 'h-6 w-6' : 'h-7 w-7'} />
          </span>

          {file ? (
            <>
              <p className="display-tight mt-4 max-w-md break-all text-lg text-white">{file.name}</p>
              <p className="mt-1 text-sm text-slate-400">
                {formatBytes(file.size)}
                {file.type ? ', ' + file.type : ''}
              </p>
              {preview?.kind === 'image' && (
                <img
                  src={preview.url}
                  alt={'Preview of ' + file.name}
                  className="mt-4 max-h-32 max-w-full rounded-lg border border-slate-700 object-contain"
                />
              )}
              {preview?.kind === 'text' && (
                <pre
                  className="mt-4 max-h-32 w-full max-w-md overflow-hidden whitespace-pre-wrap break-all rounded-lg border border-slate-700 bg-slate-950 p-3 text-left font-mono text-xs text-slate-300"
                  aria-label={'Start of ' + file.name}
                >
                  {preview.text}
                </pre>
              )}
              <p className="mt-3 text-xs text-slate-400">Click to choose a different file</p>
            </>
          ) : (
            <>
              <p className={'display-tight mt-4 text-white ' + (compact ? 'text-base' : 'text-xl')}>
                Drop a file to scan it
              </p>
              <p className="mt-1.5 text-sm text-slate-400">
                or <span className="text-blue-300 underline underline-offset-4">browse your computer</span>. Up to {maxMb} MB.
              </p>
            </>
          )}
        </div>
      )}

      {!busy && (
        <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showOptions ? (
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5" role="radiogroup" aria-label="Visibility">
                {(['PUBLIC', 'PRIVATE'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={visibility === value}
                    disabled={value === 'PRIVATE' && (!allowPrivate || capabilities?.supportsPrivate === false)}
                    onClick={() => setVisibility(value)}
                    className={
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition ' +
                      (visibility === value ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200') +
                      ' disabled:opacity-40'
                    }
                  >
                    {value === 'PUBLIC' ? 'Public' : 'Private'}
                  </button>
                ))}
              </div>
              <label className="gv-checkbox cursor-pointer">
                <input type="checkbox" checked={forceRescan} onChange={(event) => setForceRescan(event.target.checked)} />
                Force a fresh scan
              </label>
            </div>
          ) : (
            <p className="text-xs leading-5 text-slate-500">
              Files are deleted after scanning. Only hashes and verdicts are kept.
            </p>
          )}

          <div className="flex shrink-0 items-center gap-2">
            {file && (
              <button type="button" className="ghost-button" onClick={() => setFile(null)}>
                Remove file
              </button>
            )}
            <button
              type="button"
              className="primary-button px-5"
              disabled={!file}
              onClick={() => void start()}
            >
              <Icon name="shield" className="h-4 w-4" strokeWidth={2} />
              {buttonLabel}
            </button>
          </div>
        </div>
      )}

      {showOptions && !busy && visibility === 'PRIVATE' && (
        <p className="relative mt-3 text-xs leading-5 text-sky-300/90">
          Private scans stay on the local ClamAV engine. The file and its hash are never sent to VirusTotal.
        </p>
      )}

      {error && <div className="gv-inline-error relative">{error}</div>}
    </div>
  );
}
