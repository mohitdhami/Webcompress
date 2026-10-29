import { useRef, useState, type DragEvent } from 'react'
import {
  AlertTriangle,
  Archive,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  Folder,
  FolderOpen,
  LoaderCircle,
  LockKeyhole,
  PackageOpen,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { ArchiveError } from '../lib/errors'
import {
  baseName,
  detectArchiveFormat,
  dirName,
  formatBytes,
  formatLabel,
  getCategory,
} from '../lib/format'
import { downloadBlob } from '../lib/files'
import {
  createZipArchive,
  extractZipArchive,
  inspectZipArchive,
} from '../lib/zip'
import { extract7zArchive, inspect7zArchive } from '../lib/sevenzip'
import type { ArchiveEntry, ToastKind } from '../lib/types'
import type { DetectedFormat } from '../lib/format'
import { FileGlyph } from './FileGlyph'

interface ExtractWorkspaceProps {
  onToast: (kind: ToastKind, title: string, detail?: string) => void
}

interface ExtractState {
  format: DetectedFormat
  entries: ArchiveEntry[]
  encryptedNames: boolean
}

function formatName(name: string): string {
  return name
    .replace(/\.(tar\.(gz|bz2|xz)|tgz|tbz2|txz|gz|bz2|xz)$/i, '')
    .replace(/\.(zipx?|7z|rar|tar)$/i, '')
}

export function ExtractWorkspace({ onToast }: ExtractWorkspaceProps) {
  const [archive, setArchive] = useState<File | null>(null)
  const [state, setState] = useState<ExtractState | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractStage, setExtractStage] = useState('')
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const requiresPassword = Boolean(
    needsPassword ||
      (state &&
        (state.encryptedNames ||
          state.entries.some((entry) => entry.encrypted))),
  )
  const fileEntries = state?.entries.filter((entry) => !entry.isDirectory) ?? []
  const folderCount =
    state?.entries.filter((entry) => entry.isDirectory).length ?? 0
  const unpackedSize = fileEntries.reduce((sum, entry) => sum + entry.size, 0)
  const canExtract = Boolean(
    archive &&
      state &&
      fileEntries.length > 0 &&
      (!requiresPassword || password.length > 0) &&
      !loading &&
      !extracting,
  )
  const canUnlock = Boolean(
    archive && needsPassword && password.length > 0 && !loading,
  )

  const reset = () => {
    setArchive(null)
    setState(null)
    setPassword('')
    setError(null)
    setNeedsPassword(false)
    setLoading(false)
    setExtracting(false)
    setBusyPath(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const inspectArchive = async (
    file: File,
    secret = '',
    unlocking = false,
  ) => {
    setLoading(true)
    setError(null)
    const format = detectArchiveFormat(file.name)

    try {
      let entries: ArchiveEntry[]
      let namesEncrypted = false

      if (format === 'zip') {
        entries = await inspectZipArchive(file)
      } else {
        try {
          entries = await inspect7zArchive(file, secret)
          if (unlocking) namesEncrypted = true
        } catch (inspectError) {
          if (
            inspectError instanceof ArchiveError &&
            inspectError.code === 'PASSWORD_REQUIRED'
          ) {
            setNeedsPassword(true)
            setState(null)
            setError(null)
            return
          }
          if (
            inspectError instanceof ArchiveError &&
            inspectError.code === 'INVALID_PASSWORD'
          ) {
            setNeedsPassword(true)
            setState(null)
            setError(
              'That password did not unlock the archive. Check it and try again.',
            )
            return
          }
          throw inspectError
        }
      }

      setState({
        format,
        entries,
        encryptedNames: namesEncrypted,
      })
      setNeedsPassword(false)
      if (entries.some((entry) => entry.encrypted) && !secret) {
        setError(null)
      }
    } catch (inspectError) {
      const archiveError =
        inspectError instanceof ArchiveError
          ? inspectError
          : new ArchiveError(
              'INVALID_ARCHIVE',
              'This file could not be read as an archive.',
            )
      setState(null)
      setError(archiveError.message)
      onToast('error', 'Could not open archive', archiveError.message)
    } finally {
      setLoading(false)
    }
  }

  const chooseArchive = (file: File) => {
    setArchive(file)
    setState(null)
    setPassword('')
    setNeedsPassword(false)
    setError(null)
    void inspectArchive(file)
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const picked = Array.from(files)
    if (inputRef.current) inputRef.current.value = ''
    if (picked.length > 1) {
      onToast('info', 'One archive at a time', `Opening ${picked[0].name}.`)
    }
    chooseArchive(picked[0])
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragActive(false)
    handleFiles(event.dataTransfer.files)
  }

  const handleUnlock = () => {
    if (!archive) return
    void inspectArchive(archive, password, true)
  }

  const handleExtractAll = async () => {
    if (!archive || !state || !canExtract) return
    setExtracting(true)
    setError(null)
    setExtractStage('Unpacking archive')

    try {
      let files
      if (state.format === 'zip') {
        files = await extractZipArchive(archive, password)
      } else {
        files = await extract7zArchive(
          archive,
          password,
          undefined,
          (stage) => setExtractStage(stage),
        )
      }

      if (files.length === 0) {
        throw new ArchiveError(
          'INVALID_ARCHIVE',
          'There were no files to extract.',
        )
      }

      if (files.length === 1) {
        downloadBlob(
          new Blob([files[0].data]),
          baseName(files[0].path) || 'extracted-file',
        )
      } else {
        setExtractStage('Packaging files')
        const now = Date.now()
        const picked = files.map((file, index) => ({
          id: `extracted-${index}-${now}`,
          path: file.path,
          file: new File([file.data], baseName(file.path) || 'file', {
            lastModified: now,
          }),
        }))
        const blob = await createZipArchive(picked, { mode: 'store' })
        downloadBlob(
          blob,
          `${formatName(archive.name) || 'archive'}-extracted.zip`,
        )
      }

      onToast(
        'success',
        'Files extracted',
        `${files.length} ${files.length === 1 ? 'file' : 'files'} saved from ${archive.name}.`,
      )
    } catch (extractError) {
      const archiveError =
        extractError instanceof ArchiveError
          ? extractError
          : new ArchiveError(
              'UNKNOWN',
              'The archive could not be extracted.',
            )
      setError(archiveError.message)
      onToast('error', 'Extraction failed', archiveError.message)
    } finally {
      setExtracting(false)
      setExtractStage('')
    }
  }

  const handleDownloadEntry = async (entry: ArchiveEntry) => {
    if (!archive || !state) return
    if (requiresPassword && !password) {
      setError('Enter the archive password before downloading files.')
      return
    }
    setBusyPath(entry.path)
    setError(null)
    try {
      let files
      if (state.format === 'zip') {
        files = await extractZipArchive(archive, password, [entry.path])
      } else {
        files = await extract7zArchive(archive, password, [entry.path])
      }
      if (!files[0]) {
        throw new ArchiveError(
          'INVALID_ARCHIVE',
          'That file could not be found in the archive.',
        )
      }
      downloadBlob(new Blob([files[0].data]), baseName(entry.path) || 'file')
      onToast('success', 'File saved', baseName(entry.path))
    } catch (downloadError) {
      const archiveError =
        downloadError instanceof ArchiveError
          ? downloadError
          : new ArchiveError('UNKNOWN', 'The file could not be extracted.')
      setError(archiveError.message)
      onToast('error', 'Could not save file', archiveError.message)
    } finally {
      setBusyPath(null)
    }
  }

  return (
    <div className="workspace-grid extract-grid">
      <section
        className={`files-panel extract-panel ${archive ? 'has-archive' : ''}`}
        aria-label="Archive contents"
      >
        {!archive ? (
          <div
            className={`dropzone extract-dropzone ${dragActive ? 'is-dragging' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Drop an archive here or browse"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragActive(false)
              }
            }}
            onDrop={handleDrop}
          >
            <div className="extract-art" aria-hidden="true">
              <span className="extract-ring" />
              <span className="extract-box">
                <PackageOpen size={40} strokeWidth={1.4} />
              </span>
              <span className="extract-lock">
                <LockKeyhole size={15} />
              </span>
            </div>
            <div className="drop-copy">
              <span className="eyebrow eyebrow-small">Open archive</span>
              <h2>Drop an archive here</h2>
              <p>Look inside first, then pull out only what you need.</p>
            </div>
            <button
              type="button"
              className="button button-dark button-small"
              onClick={(event) => {
                event.stopPropagation()
                inputRef.current?.click()
              }}
            >
              <Upload size={15} />
              Browse archive
            </button>
            <div className="format-chips">
              <span>ZIP</span>
              <span>7Z</span>
              <span>RAR</span>
              <span>TAR</span>
              <span>GZ</span>
            </div>
            <div className="drop-footnote">
              <span className="secure-dot" />
              Passwords never leave this tab
              <span className="dot-separator" />
              Read-only
            </div>
          </div>
        ) : (
          <div className="extract-view">
            <div className="panel-heading archive-heading">
              <div className="archive-title-wrap">
                <span className="archive-format-badge">
                  {formatLabel(state?.format ?? detectArchiveFormat(archive.name))}
                </span>
                <div>
                  <h2 title={archive.name}>{archive.name}</h2>
                  <span className="archive-subline">
                    {formatBytes(archive.size)}
                    {state && ` · ${fileEntries.length} files`}
                    {(state?.encryptedNames || needsPassword) && (
                      <span className="inline-lock">
                        <LockKeyhole size={10} />
                        Names hidden
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="heading-actions">
                <button
                  type="button"
                  className="icon-text-button"
                  onClick={() => inputRef.current?.click()}
                >
                  <FolderOpen size={14} />
                  Change
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={reset}
                  aria-label="Close archive"
                  title="Close archive"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="archive-state">
                <LoaderCircle size={26} className="spin" />
                <h3>Reading archive</h3>
                <p>Inspecting headers and file names.</p>
                <div className="skeleton-list" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : needsPassword && !state ? (
              <div className="archive-state locked-state">
                <span className="state-icon">
                  <LockKeyhole size={26} />
                </span>
                <h3>This archive is locked</h3>
                <p>
                  Its file names are encrypted. Enter the archive password to
                  reveal what is inside.
                </p>
                {error && <span className="state-note">{error}</span>}
              </div>
            ) : error && !state ? (
              <div className="archive-state error-state">
                <span className="state-icon">
                  <AlertTriangle size={26} />
                </span>
                <h3>Could not read this file</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={reset}
                >
                  Try another archive
                </button>
              </div>
            ) : state ? (
              <>
                {error && (
                  <div className="inline-error">
                    <AlertTriangle size={14} />
                    {error}
                  </div>
                )}
                <div className="file-list extract-list" role="list">
                  {state.entries.map((entry) => {
                    const folder = dirName(entry.path.replace(/\/+$/, ''))
                    if (entry.isDirectory) {
                      return (
                        <div
                          className="file-row folder-row"
                          role="listitem"
                          key={`dir-${entry.path}`}
                        >
                          <span className="file-glyph folder-glyph">
                            <Folder size={18} strokeWidth={1.8} />
                          </span>
                          <div className="file-meta">
                            <span className="file-name" title={entry.path}>
                              {baseName(entry.path)}
                            </span>
                            <span className="file-path">
                              <Folder size={11} />
                              {folder || 'Top level'}
                            </span>
                          </div>
                          <span className="folder-tag">Folder</span>
                        </div>
                      )
                    }
                    return (
                      <div
                        className="file-row"
                        role="listitem"
                        key={entry.path}
                      >
                        <FileGlyph category={getCategory(entry.path)} />
                        <div className="file-meta">
                          <span className="file-name" title={entry.path}>
                            {baseName(entry.path)}
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
                        {entry.encrypted && (
                          <span className="entry-lock" title="Encrypted">
                            <LockKeyhole size={12} />
                          </span>
                        )}
                        <span className="file-size">
                          {formatBytes(entry.size)}
                        </span>
                        <button
                          type="button"
                          className="row-download"
                          onClick={() => void handleDownloadEntry(entry)}
                          disabled={busyPath === entry.path}
                          aria-label={`Download ${baseName(entry.path)}`}
                          title="Download file"
                        >
                          {busyPath === entry.path ? (
                            <LoaderCircle size={14} className="spin" />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="list-foot">
                  <span>
                    <Archive size={13} />
                    {fileEntries.length} files
                    {folderCount > 0 && ` · ${folderCount} folders`}
                  </span>
                  <span className="list-foot-note">
                    {formatBytes(unpackedSize)} unpacked
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          className="visually-hidden"
          accept=".zip,.zipx,.7z,.rar,.tar,.gz,.tgz,.bz2,.tbz2,.xz,.txz"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </section>

      <aside className="settings-panel extract-settings" aria-label="Extraction settings">
        <div className="settings-head">
          <div className="settings-title">
            <span className="settings-icon">
              <PackageOpen size={16} />
            </span>
            <div>
              <span className="eyebrow eyebrow-dark">Unpack</span>
              <h2>Extraction</h2>
            </div>
          </div>
          {archive && (
            <button type="button" className="reset-button" onClick={reset}>
              <X size={14} />
              Close
            </button>
          )}
        </div>

        <div className="settings-body">
          {!archive ? (
            <div className="extract-empty">
              <span className="empty-icon">
                <FileArchive size={22} />
              </span>
              <strong>Nothing open yet</strong>
              <p>
                Drop a ZIP, 7Z, RAR or TAR archive on the left. You can preview
                its contents before saving anything.
              </p>
              <div className="supported-list">
                <span>ZIP</span>
                <span>7Z</span>
                <span>RAR</span>
                <span>TAR · GZ</span>
              </div>
            </div>
          ) : (
            <>
              <div className="archive-summary-card">
                <span className="archive-summary-icon">
                  <FileArchive size={18} />
                </span>
                <div>
                  <strong>{archive.name}</strong>
                  <span>
                    {formatLabel(state?.format ?? detectArchiveFormat(archive.name))}{' '}
                    · {formatBytes(archive.size)}
                  </span>
                </div>
                {requiresPassword && (
                  <span className="encrypted-badge">
                    <LockKeyhole size={11} />
                    Locked
                  </span>
                )}
              </div>

              <div className="field-group password-group">
                <label htmlFor="extract-password">
                  {requiresPassword ? 'Password required' : 'Archive password'}
                  <span className="optional-label">
                    {requiresPassword ? 'AES-256' : 'if any'}
                  </span>
                </label>
                <div className="password-input">
                  <input
                    id="extract-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && needsPassword) {
                        handleUnlock()
                      }
                    }}
                    placeholder={
                      requiresPassword ? 'Enter archive password' : 'Optional'
                    }
                    autoComplete="off"
                    disabled={loading || extracting}
                  />
                  <button
                    type="button"
                    className="reveal-button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="field-hint">
                  {needsPassword
                    ? 'Needed to decrypt the archive headers.'
                    : requiresPassword
                      ? 'This archive needs its password to extract files.'
                      : 'Only needed for password-protected archives.'}
                </p>
              </div>

              <div className="detail-list">
                <div>
                  <span>Format</span>
                  <strong>
                    {formatLabel(state?.format ?? detectArchiveFormat(archive.name))}
                  </strong>
                </div>
                <div>
                  <span>Files</span>
                  <strong>{state ? fileEntries.length : '—'}</strong>
                </div>
                <div>
                  <span>Unpacked</span>
                  <strong>{state ? formatBytes(unpackedSize) : '—'}</strong>
                </div>
                <div>
                  <span>Protection</span>
                  <strong>
                    {state?.encryptedNames || needsPassword
                      ? 'Names hidden'
                      : requiresPassword
                        ? 'Encrypted'
                        : state
                          ? 'None'
                          : '—'}
                  </strong>
                </div>
              </div>

              {error && (
                <div className="inline-error dark-error">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              <div className="extract-tip">
                <ShieldCheck size={15} />
                <p>
                  Files are unpacked in this tab. Multi-file archives download
                  as a single ZIP bundle.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="settings-footer">
          {extracting && (
            <div className="working-state" aria-live="polite">
              <div className="working-meta">
                <span>{extractStage || 'Extracting files'}</span>
                <LoaderCircle size={12} className="spin" />
              </div>
              <div className="progress-track is-animated">
                <span style={{ width: '68%' }} />
              </div>
            </div>
          )}

          <button
            type="button"
            className="create-button"
            disabled={!archive || loading || extracting || (needsPassword ? !canUnlock : !canExtract)}
            onClick={() => {
              if (needsPassword) {
                handleUnlock()
              } else {
                void handleExtractAll()
              }
            }}
            aria-busy={loading || extracting}
          >
            {loading ? (
              <>
                <LoaderCircle size={18} className="spin" />
                Reading archive
              </>
            ) : extracting ? (
              <>
                <LoaderCircle size={18} className="spin" />
                Extracting files
              </>
            ) : needsPassword ? (
              <>
                <LockKeyhole size={17} />
                Unlock archive
              </>
            ) : (
              <>
                <Download size={17} />
                Save all files
                <span className="create-format">
                  {fileEntries.length > 0 ? fileEntries.length : ''}
                </span>
              </>
            )}
          </button>
          <p className="local-note">
            <LockKeyhole size={12} />
            Unpacked locally. Nothing is uploaded.
            <span className="footer-encryption">Read-only</span>
          </p>
        </div>
      </aside>
    </div>
  )
}
