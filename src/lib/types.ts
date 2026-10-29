export type ArchiveFormat = 'zip' | '7z'

export type CompressionMode = 'store' | 'fast' | 'balanced' | 'maximum'

export type AppTab = 'compress' | 'extract'

export interface PickedFile {
  id: string
  file: File
  path: string
}

export interface ArchiveEntry {
  path: string
  size: number
  compressedSize?: number
  isDirectory: boolean
  encrypted: boolean
}

export interface ExtractedFile {
  path: string
  data: ArrayBuffer
}

export interface CreatedArchive {
  blob: Blob
  fileName: string
  format: ArchiveFormat
  mode: CompressionMode
  originalSize: number
  durationMs: number
}

export interface InspectedArchive {
  name: string
  size: number
  format: string
  entries: ArchiveEntry[]
  encrypted: boolean
  encryptedNames: boolean
  passwordRequired: boolean
}

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: number
  kind: ToastKind
  title: string
  detail?: string
}
