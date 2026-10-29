import type { PickedFile } from './types'

interface FileSystemEntryLike {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
  file?: (success: (file: File) => void, error?: (error: DOMException) => void) => void
  createReader?: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: DOMException) => void,
    ) => void
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function normalizePath(rawPath: string, fallback: string): string {
  const cleaned = rawPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')
  return cleaned || fallback
}

export function filesFromFileList(files: FileList | File[]): PickedFile[] {
  return Array.from(files).map((file) => {
    const relative =
      'webkitRelativePath' in file && file.webkitRelativePath
        ? file.webkitRelativePath
        : file.name
    return {
      id: makeId(),
      file,
      path: normalizePath(relative, file.name),
    }
  })
}

function fileFromEntry(entry: FileSystemEntryLike): Promise<File | null> {
  return new Promise((resolve) => {
    if (!entry.file) {
      resolve(null)
      return
    }
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    )
  })
}

function readDirectory(entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader?.()
    if (!reader) {
      resolve([])
      return
    }
    const all: FileSystemEntryLike[] = []
    const readBatch = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(all)
            return
          }
          all.push(...entries)
          readBatch()
        },
        () => resolve(all),
      )
    }
    readBatch()
  })
}

async function walkEntry(
  entry: FileSystemEntryLike,
  parentPath: string,
  output: PickedFile[],
): Promise<void> {
  const nextPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
  if (entry.isFile) {
    const file = await fileFromEntry(entry)
    if (file) {
      output.push({
        id: makeId(),
        file,
        path: normalizePath(nextPath, file.name),
      })
    }
    return
  }

  if (entry.isDirectory) {
    const children = await readDirectory(entry)
    await Promise.all(
      children.map((child) => walkEntry(child, nextPath, output)),
    )
  }
}

export async function filesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<PickedFile[]> {
  const items = Array.from(dataTransfer.items ?? [])
  const entries = items
    .map((item) => {
      if (item.kind !== 'file') return null
      const getEntry = (
        item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntryLike | null
        }
      ).webkitGetAsEntry
      return getEntry ? getEntry.call(item) : null
    })
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry))

  if (entries.length === 0) {
    return filesFromFileList(dataTransfer.files)
  }

  const output: PickedFile[] = []
  await Promise.all(entries.map((entry) => walkEntry(entry, '', output)))
  output.sort((a, b) => a.path.localeCompare(b.path))
  return output
}

export function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path)
    return path
  }

  const slash = path.lastIndexOf('/')
  const folder = slash === -1 ? '' : path.slice(0, slash + 1)
  const name = slash === -1 ? path : path.slice(slash + 1)
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''

  let index = 1
  let candidate = `${folder}${stem} (${index})${ext}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${folder}${stem} (${index})${ext}`
  }
  used.add(candidate)
  return candidate
}

export function mergeFiles(
  current: PickedFile[],
  incoming: PickedFile[],
): PickedFile[] {
  const used = new Set(current.map((item) => item.path))
  const merged = [...current]
  for (const item of incoming) {
    const path = uniquePath(item.path, used)
    merged.push(path === item.path ? item : { ...item, path })
  }
  return merged
}

export function totalSize(files: PickedFile[]): number {
  return files.reduce((sum, item) => sum + item.file.size, 0)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
