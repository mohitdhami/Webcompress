import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Clock3,
  Download,
  FileArchive,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { formatBytes, formatDuration } from '../lib/format'
import type { CreatedArchive } from '../lib/types'

interface ResultModalProps {
  result: CreatedArchive
  encrypted: boolean
  namesEncrypted: boolean
  onClose: () => void
  onDownload: () => void
  onStartOver: () => void
}

export function ResultModal({
  result,
  encrypted,
  namesEncrypted,
  onClose,
  onDownload,
  onStartOver,
}: ResultModalProps) {
  const downloadRef = useRef<HTMLButtonElement>(null)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    downloadRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!downloaded) return
    const timer = window.setTimeout(() => setDownloaded(false), 2400)
    return () => window.clearTimeout(timer)
  }, [downloaded])

  const handleDownload = () => {
    onDownload()
    setDownloaded(true)
  }

  const savings =
    result.originalSize > 0
      ? Math.round((1 - result.blob.size / result.originalSize) * 100)
      : 0
  const isSmaller = savings > 0
  const sizeLabel = isSmaller
    ? `${Math.min(99, savings)}% smaller`
    : `${Math.abs(savings)}% overhead`

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="result-art" aria-hidden="true">
          <span className="result-ring result-ring-one" />
          <span className="result-ring result-ring-two" />
          <span className="result-check">
            <Check size={18} strokeWidth={3} />
          </span>
          <span className="result-archive-icon">
            <FileArchive size={46} strokeWidth={1.5} />
          </span>
          <span className="result-format">{result.format.toUpperCase()}</span>
        </div>

        <span className="eyebrow eyebrow-small">Packed and ready</span>
        <h2 id="result-title">Your archive is ready.</h2>
        <p className="result-file-name" title={result.fileName}>
          {result.fileName}
        </p>

        <div className="result-stats">
          <div>
            <span>Archive size</span>
            <strong>{formatBytes(result.blob.size)}</strong>
          </div>
          <div>
            <span>Original</span>
            <strong>{formatBytes(result.originalSize)}</strong>
          </div>
          <div className="result-savings">
            <span>Saved</span>
            <strong>{sizeLabel}</strong>
          </div>
        </div>

        <div className="result-chips">
          <span>
            <Clock3 size={12} />
            {formatDuration(result.durationMs)}
          </span>
          {encrypted && (
            <span>
              <ShieldCheck size={12} />
              AES-256
            </span>
          )}
          {namesEncrypted && (
            <span>
              <LockKeyhole size={12} />
              Names hidden
            </span>
          )}
          <span>
            <Sparkles size={12} />
            {result.format === 'zip'
              ? 'Universal'
              : result.mode === 'store'
                ? 'Stored'
                : 'LZMA2'}
          </span>
        </div>

        <button
          type="button"
          ref={downloadRef}
          className="button button-primary button-wide"
          onClick={handleDownload}
        >
          {downloaded ? (
            <Check size={17} strokeWidth={3} />
          ) : (
            <Download size={17} />
          )}
          {downloaded ? 'Download started' : 'Download archive'}
        </button>
        <button
          type="button"
          className="button button-quiet button-wide"
          onClick={onStartOver}
        >
          <Plus size={16} />
          Start a new archive
        </button>
      </div>
    </div>
  )
}
