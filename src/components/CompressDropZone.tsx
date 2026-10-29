import { FileArchive, FileImage, FileText, FolderOpen, Plus, Upload } from 'lucide-react'

interface CompressDropZoneProps {
  onBrowse: () => void
  onFolder: () => void
}

export function CompressDropZone({ onBrowse, onFolder }: CompressDropZoneProps) {
  return (
    <div
      className="dropzone"
      role="button"
      tabIndex={0}
      aria-label="Drop files here or browse your device"
      onClick={onBrowse}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onBrowse()
        }
      }}
    >
      <div className="drop-art" aria-hidden="true">
        <span className="drop-orbit" />
        <div className="stack-card stack-back">
          <FileText size={20} strokeWidth={1.7} />
        </div>
        <div className="stack-card stack-middle">
          <FileImage size={20} strokeWidth={1.7} />
        </div>
        <div className="stack-card stack-front">
          <FileArchive size={28} strokeWidth={1.8} />
          <span className="zipper-line" />
        </div>
        <span className="stack-plus">
          <Plus size={14} strokeWidth={2.5} />
        </span>
      </div>

      <div className="drop-copy">
        <span className="eyebrow eyebrow-small">Drop zone</span>
        <h2>Drop files here</h2>
        <p>or choose what you want to pack. Folders are welcome.</p>
      </div>

      <div className="drop-actions">
        <button
          type="button"
          className="button button-dark button-small"
          onClick={(event) => {
            event.stopPropagation()
            onBrowse()
          }}
        >
          <Upload size={15} />
          Browse files
        </button>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={(event) => {
            event.stopPropagation()
            onFolder()
          }}
        >
          <FolderOpen size={15} />
          Add folder
        </button>
      </div>

      <div className="drop-footnote">
        <span className="secure-dot" />
        Files never leave this tab
        <span className="dot-separator" />
        ZIP + 7Z
        <span className="dot-separator" />
        AES-256
      </div>
    </div>
  )
}
