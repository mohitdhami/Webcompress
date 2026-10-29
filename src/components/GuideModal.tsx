import { useEffect } from 'react'
import {
  Fingerprint,
  LockKeyhole,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'

interface GuideModalProps {
  onClose: () => void
}

export function GuideModal({ onClose }: GuideModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
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

        <span className="eyebrow eyebrow-small">How it works</span>
        <h2 id="guide-title">A full archive studio, minus the cloud.</h2>
        <p className="guide-intro">
          WebCompress uses WebAssembly and browser-native APIs to do the work
          inside this tab. Your files are never sent to a server.
        </p>

        <div className="guide-steps">
          <div className="guide-step">
            <span className="guide-icon">
              <MousePointerClick size={19} />
            </span>
            <div>
              <strong>Drop, tune, pack</strong>
              <p>
                Add files or whole folders, pick ZIP or 7Z, and choose how hard
                the compressor should work.
              </p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-icon">
              <ShieldCheck size={19} />
            </span>
            <div>
              <strong>Lock it down</strong>
              <p>
                Add AES-256 password protection. Choose 7Z with encrypted file
                names when the names themselves are sensitive.
              </p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-icon">
              <Fingerprint size={19} />
            </span>
            <div>
              <strong>Stay in control</strong>
              <p>
                Download the finished archive. Close the tab and nothing is
                left behind — no account, no upload, no copy.
              </p>
            </div>
          </div>
        </div>

        <div className="guide-note">
          <LockKeyhole size={15} />
          <span>
            <strong>Format note:</strong> ZIP opens almost anywhere. 7Z adds
            LZMA2 compression and encrypted headers. RAR, TAR, GZ, and more can
            be opened in the Extract tab.
          </span>
        </div>

        <div className="guide-foot">
          <span>
            <Sparkles size={13} />
            No accounts. No trackers. No upload limits.
          </span>
          <button type="button" className="button button-dark button-small" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
