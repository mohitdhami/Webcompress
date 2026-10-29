import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Download,
  FileArchive,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react'
import { Header } from './components/Header'
import { CompressDropZone } from './components/CompressDropZone'
import { FileList } from './components/FileList'
import { SettingsPanel } from './components/SettingsPanel'
import { ExtractWorkspace } from './components/ExtractWorkspace'
import { ResultModal } from './components/ResultModal'
import { GuideModal } from './components/GuideModal'
import { ToastStack } from './components/ToastStack'
import {
  estimateArchiveSize,
  formatBytes,
  sanitizeArchiveBase,
  suggestArchiveName,
} from './lib/format'
import {
  downloadBlob,
  filesFromDataTransfer,
  filesFromFileList,
  mergeFiles,
  totalSize,
} from './lib/files'
import { createZipArchive } from './lib/zip'
import { create7zArchive } from './lib/sevenzip'
import type {
  AppTab,
  ArchiveFormat,
  CompressionMode,
  CreatedArchive,
  PickedFile,
  ToastKind,
  ToastMessage,
} from './lib/types'

const preferencesKey = 'webcompress-preferences'

function readPreference<T extends string>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(preferencesKey)
    if (!stored) return fallback
    const value = JSON.parse(stored) as Record<string, unknown>
    return typeof value[key] === 'string' ? (value[key] as T) : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [tab, setTab] = useState<AppTab>('compress')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [format, setFormat] = useState<ArchiveFormat>(() =>
    readPreference('format', 'zip'),
  )
  const [mode, setMode] = useState<CompressionMode>(() =>
    readPreference('mode', 'balanced'),
  )
  const [archiveBase, setArchiveBase] = useState('archive')
  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [encryptNames, setEncryptNames] = useState(false)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [result, setResult] = useState<CreatedArchive | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [dragging, setDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const toastId = useRef(0)
  const nameTouchedRef = useRef(false)
  const addFilesRef = useRef<(incoming: PickedFile[]) => void>(() => undefined)

  const totalBytes = useMemo(() => totalSize(files), [files])
  const estimatedBytes = useMemo(
    () => estimateArchiveSize(files, mode, format, protect),
    [files, mode, format, protect],
  )
  const passwordValid =
    !protect ||
    (password.length >= 4 && password === confirmPassword)
  const archiveName = `${sanitizeArchiveBase(archiveBase)}.${format}`

  useEffect(() => {
    try {
      localStorage.setItem(
        preferencesKey,
        JSON.stringify({ format, mode }),
      )
    } catch {
      // Preferences are optional.
    }
  }, [format, mode])

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
    folderInputRef.current?.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    document.body.style.overflow = resultOpen || guideOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [resultOpen, guideOpen])

  useEffect(() => {
    if (!result) return
    setResult(null)
    setResultOpen(false)
    // A changed configuration invalidates the finished archive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, format, mode, protect, password, confirmPassword, encryptNames, archiveBase])

  useEffect(() => {
    if (resultOpen || guideOpen) setToasts([])
  }, [resultOpen, guideOpen])

  useEffect(() => {
    if (!working || format !== '7z' || stage !== 'Compressing') return
    const interval = window.setInterval(() => {
      setProgress((value) =>
        value < 92 ? Math.min(92, value + Math.max(0.15, (92 - value) * 0.012)) : value,
      )
    }, 600)
    return () => window.clearInterval(interval)
  }, [working, format, stage])

  const pushToast = (kind: ToastKind, title: string, detail?: string) => {
    const id = ++toastId.current
    setToasts((current) => [...current, { id, kind, title, detail }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 5600)
  }

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  const addFiles = (incoming: PickedFile[]) => {
    if (incoming.length === 0) return
    setFiles((current) => {
      const merged = mergeFiles(current, incoming)
      if (!nameTouchedRef.current) {
        setArchiveBase(suggestArchiveName(merged))
      }
      return merged
    })
  }
  addFilesRef.current = addFiles

  const removeFile = (id: string) => {
    setFiles((current) => {
      const next = current.filter((item) => item.id !== id)
      if (!nameTouchedRef.current) {
        setArchiveBase(suggestArchiveName(next))
      }
      return next
    })
  }

  const clearFiles = () => {
    setFiles([])
    setArchiveBase('archive')
    nameTouchedRef.current = false
  }

  const handleTabChange = (nextTab: AppTab) => {
    if (working) {
      pushToast('info', 'Archive in progress', 'Wait for the current archive to finish.')
      return
    }
    setTab(nextTab)
  }

  const handleFormatChange = (nextFormat: ArchiveFormat) => {
    if (nextFormat === 'zip' && encryptNames) {
      setEncryptNames(false)
      pushToast(
        'info',
        'Switched off name encryption',
        'ZIP keeps file names visible. Choose 7Z if names must stay secret.',
      )
    }
    setFormat(nextFormat)
  }

  const handleProtectChange = (value: boolean) => {
    setProtect(value)
    if (!value) {
      setEncryptNames(false)
      setPassword('')
      setConfirmPassword('')
    }
  }

  const handleEncryptNamesChange = (value: boolean) => {
    setEncryptNames(value)
    if (value && format !== '7z') {
      setFormat('7z')
      pushToast(
        'info',
        'Switched to 7Z',
        'Encrypted file names need the 7Z format. The password still protects every file.',
      )
    }
  }

  const handleArchiveBaseChange = (value: string) => {
    nameTouchedRef.current = true
    setArchiveBase(value)
  }

  const resetSettings = () => {
    setFormat('zip')
    setMode('balanced')
    setProtect(false)
    setEncryptNames(false)
    setPassword('')
    setConfirmPassword('')
    nameTouchedRef.current = false
    setArchiveBase(suggestArchiveName(files))
  }

  const handleCreate = async () => {
    if (files.length === 0) {
      fileInputRef.current?.click()
      return
    }
    if (!passwordValid) {
      pushToast(
        'error',
        'Check your password',
        'Use at least 4 characters and make sure both passwords match.',
      )
      return
    }

    setWorking(true)
    setProgress(format === '7z' ? 2 : 0)
    setStage(format === '7z' ? 'Loading 7-Zip engine' : 'Preparing files')
    setResult(null)
    setResultOpen(false)
    const started = performance.now()

    try {
      let blob: Blob
      if (format === 'zip') {
        blob = await createZipArchive(files, {
          mode,
          password: protect ? password : undefined,
          onProgress: (percent) => {
            setProgress(percent)
            setStage(percent < 99 ? 'Compressing files' : 'Finishing up')
          },
        })
      } else {
        blob = await create7zArchive(files, {
          mode,
          password: protect ? password : '',
          encryptNames: protect && encryptNames,
          onProgress: (nextStage, percent) => {
            setStage(nextStage)
            if (typeof percent === 'number') setProgress(percent)
          },
        })
      }

      const finished: CreatedArchive = {
        blob,
        fileName: archiveName,
        format,
        mode,
        originalSize: totalBytes,
        durationMs: performance.now() - started,
      }
      setProgress(100)
      setResult(finished)
      setResultOpen(true)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The archive could not be created.'
      pushToast('error', 'Could not create archive', message)
    } finally {
      setWorking(false)
      setStage('')
    }
  }

  const downloadResult = () => {
    if (!result) return
    downloadBlob(result.blob, result.fileName)
    if (!resultOpen) pushToast('success', 'Download started', result.fileName)
  }

  const startOver = () => {
    setResult(null)
    setResultOpen(false)
    clearFiles()
  }

  useEffect(() => {
    const isFileDrag = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      dragDepth.current += 1
      if (tab === 'compress' && !working) setDragging(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    const onDrop = async (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      if (tab !== 'compress' || working) return
      const incoming = await filesFromDataTransfer(event.dataTransfer!)
      addFilesRef.current(incoming)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [tab, working])

  return (
    <div className="app">
      <Header
        tab={tab}
        onTabChange={handleTabChange}
        onGuide={() => setGuideOpen(true)}
      />

      <main className="page">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-line" />
              {tab === 'compress'
                ? 'Browser-native archiver'
                : 'Read-only archive explorer'}
            </span>
            <h1>
              {tab === 'compress' ? (
                <>
                  Compress anything. <em>Keep it yours.</em>
                </>
              ) : (
                <>
                  Open anything. <em>Keep it local.</em>
                </>
              )}
            </h1>
            <p>
              {tab === 'compress'
                ? 'Real ZIP and 7Z archives, AES-256 encryption, and encrypted file names — all built in your browser.'
                : 'Look inside ZIP, 7Z, RAR, and TAR archives, then pull out only what you need. No uploads, no accounts.'}
            </p>
          </div>

          <div className="hero-note">
            <div className="hero-note-item">
              <span className="hero-note-icon">
                <ShieldCheck size={17} />
              </span>
              <div>
                <strong>Private by design</strong>
                <span>0 bytes uploaded</span>
              </div>
            </div>
            <span className="hero-note-rule" />
            <div className="hero-note-item">
              <span className="hero-note-icon hero-note-icon-alt">
                <FileArchive size={17} />
              </span>
              <div>
                <strong>{tab === 'compress' ? 'Open formats' : 'Wide support'}</strong>
                <span>{tab === 'compress' ? 'ZIP + 7Z' : 'ZIP · 7Z · RAR'}</span>
              </div>
            </div>
          </div>
        </section>

        {tab === 'compress' ? (
          <div className="workspace-grid">
            <section className={`files-panel ${files.length ? 'has-files' : ''}`} aria-label="Files to compress">
              {files.length === 0 ? (
                <CompressDropZone
                  onBrowse={() => fileInputRef.current?.click()}
                  onFolder={() => folderInputRef.current?.click()}
                />
              ) : (
                <FileList
                  files={files}
                  onAddFiles={() => fileInputRef.current?.click()}
                  onAddFolder={() => folderInputRef.current?.click()}
                  onRemove={removeFile}
                  onClear={clearFiles}
                />
              )}
            </section>

            <SettingsPanel
              format={format}
              mode={mode}
              archiveBase={archiveBase}
              protect={protect}
              password={password}
              confirmPassword={confirmPassword}
              encryptNames={encryptNames}
              filesCount={files.length}
              totalBytes={totalBytes}
              estimatedBytes={estimatedBytes}
              passwordValid={passwordValid}
              working={working}
              progress={progress}
              stage={stage}
              onFormatChange={handleFormatChange}
              onModeChange={setMode}
              onArchiveBaseChange={handleArchiveBaseChange}
              onProtectChange={handleProtectChange}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onEncryptNamesChange={handleEncryptNamesChange}
              onReset={resetSettings}
              onCreate={() => void handleCreate()}
              onBrowse={() => fileInputRef.current?.click()}
            />
          </div>
        ) : (
          <ExtractWorkspace onToast={pushToast} />
        )}

        <footer className="site-footer">
          <span>Built for files that shouldn’t travel.</span>
          <div className="footer-format-list">
            <span>ZIP</span>
            <span>7Z</span>
            <span>RAR</span>
            <span>AES-256</span>
          </div>
          <button
            type="button"
            className="footer-link"
            onClick={() => setGuideOpen(true)}
          >
            How it works
            <ArrowUpRight size={13} />
          </button>
        </footer>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="visually-hidden"
        onChange={(event) => {
          if (event.target.files) {
            addFiles(filesFromFileList(event.target.files))
          }
          event.target.value = ''
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="visually-hidden"
        onChange={(event) => {
          if (event.target.files) {
            addFiles(filesFromFileList(event.target.files))
          }
          event.target.value = ''
        }}
      />

      {dragging && (
        <div className="drag-overlay" aria-hidden="true">
          <div className="drag-overlay-card">
            <span className="drag-overlay-icon">
              <UploadCloud size={30} />
            </span>
            <h2>Drop to pack</h2>
            <p>Files and folders welcome. Everything stays on this device.</p>
          </div>
        </div>
      )}

      {tab === 'compress' && result && !resultOpen && (
        <div className="ready-bar">
          <span className="ready-icon">
            <Check size={16} strokeWidth={3} />
          </span>
          <div className="ready-copy">
            <strong>{result.fileName}</strong>
            <span>{formatBytes(result.blob.size)} · ready to download</span>
          </div>
          <button
            type="button"
            className="ready-download"
            onClick={downloadResult}
          >
            <Download size={15} />
            Download
          </button>
          <button
            type="button"
            className="ready-close"
            onClick={() => setResult(null)}
            aria-label="Dismiss finished archive"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {result && resultOpen && (
        <ResultModal
          result={result}
          encrypted={protect}
          namesEncrypted={protect && encryptNames && format === '7z'}
          onClose={() => setResultOpen(false)}
          onDownload={downloadResult}
          onStartOver={startOver}
        />
      )}

      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
      <ToastStack
        toasts={resultOpen || guideOpen ? [] : toasts}
        onDismiss={dismissToast}
      />
    </div>
  )
}

export default App
