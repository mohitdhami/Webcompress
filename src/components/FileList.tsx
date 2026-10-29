import { FolderOpen, Plus, Trash2, Upload, X } from 'lucide-react'
import {
  baseName,
  dirName,
  formatBytes,
  getCategory,
} from '../lib/format'
import type { PickedFile } from '../lib/types'
import { FileGlyph } from './FileGlyph'

interface FileListProps {
  files: PickedFile[]
  onAddFiles: () => void
  onAddFolder: () => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function FileList({
  files,
  onAddFiles,
  onAddFolder,
  onRemove,
  onClear,
}: FileListProps) {
  const total = files.reduce((sum, item) => sum + item.file.size, 0)

  return (
    <div className="files-view">
      <div className="panel-heading">
        <div className="heading-left">
          <span className="eyebrow eyebrow-small">To pack</span>
          <h2>
            {files.length} {files.length === 1 ? 'file' : 'files'}
            <span className="heading-size">{formatBytes(total)}</span>
          </h2>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="icon-text-button"
            onClick={onAddFiles}
          >
            <Plus size={15} />
            Add files
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onAddFolder}
            aria-label="Add folder"
            title="Add folder"
          >
            <FolderOpen size={16} />
          </button>
          <button
            type="button"
            className="icon-button danger-hover"
            onClick={onClear}
            aria-label="Clear all files"
            title="Clear all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="file-list" role="list">
        {files.map((item) => {
          const folder = dirName(item.path)
          return (
            <div className="file-row" role="listitem" key={item.id}>
              <FileGlyph category={getCategory(item.path)} />
              <div className="file-meta">
                <span className="file-name" title={item.path}>
                  {baseName(item.path)}
                </span>
                <span className="file-path">
                  {folder ? (
                    <>
                      <FolderOpen size={11} />
                      {folder}
                    </>
                  ) : (
                    'Top level'
                  )}
                </span>
              </div>
              <span className="file-size">{formatBytes(item.file.size)}</span>
              <button
                type="button"
                className="row-remove"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${baseName(item.path)}`}
                title="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="list-foot">
        <span>
          <Upload size={13} />
          Drop more files or folders anywhere
        </span>
        <span className="list-foot-note">All processing stays on-device</span>
      </div>
    </div>
  )
}
