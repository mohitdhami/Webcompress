import type {
  ArchiveFormat,
  CompressionMode,
  PickedFile,
} from './types'

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'code'
  | 'archive'
  | 'design'
  | 'pdf'
  | 'sheet'
  | 'other'

const categories: Record<string, FileCategory> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
  heic: 'image',
  svg: 'image',
  bmp: 'image',
  tif: 'image',
  tiff: 'image',
  mp4: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video',
  webm: 'video',
  m4v: 'video',
  mp3: 'audio',
  wav: 'audio',
  flac: 'audio',
  aac: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  pdf: 'pdf',
  doc: 'document',
  docx: 'document',
  txt: 'document',
  rtf: 'document',
  md: 'document',
  pages: 'document',
  key: 'design',
  ppt: 'design',
  pptx: 'design',
  psd: 'design',
  ai: 'design',
  sketch: 'design',
  fig: 'design',
  xd: 'design',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  numbers: 'sheet',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  bz2: 'archive',
  xz: 'archive',
  dmg: 'archive',
  iso: 'archive',
  js: 'code',
  jsx: 'code',
  ts: 'code',
  tsx: 'code',
  css: 'code',
  scss: 'code',
  html: 'code',
  json: 'code',
  py: 'code',
  rb: 'code',
  go: 'code',
  rs: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  h: 'code',
  sh: 'code',
  yml: 'code',
  yaml: 'code',
  toml: 'code',
}

export function getExtension(name: string): string {
  const clean = name.split(/[?#]/)[0]
  const last = clean.split('.').pop()
  return last && last !== clean ? last.toLowerCase() : ''
}

export function getCategory(name: string): FileCategory {
  return categories[getExtension(name)] ?? 'other'
}

export function categoryLabel(category: FileCategory): string {
  const labels: Record<FileCategory, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    code: 'Code',
    archive: 'Archive',
    design: 'Design',
    pdf: 'PDF',
    sheet: 'Spreadsheet',
    other: 'File',
  }
  return labels[category]
}

const compressionRatios: Record<
  CompressionMode,
  Record<FileCategory, number>
> = {
  store: {
    image: 1,
    video: 1,
    audio: 1,
    document: 1,
    code: 1,
    archive: 1,
    design: 1,
    pdf: 1,
    sheet: 1,
    other: 1,
  },
  fast: {
    image: 0.95,
    video: 0.98,
    audio: 0.94,
    document: 0.62,
    code: 0.55,
    archive: 0.99,
    design: 0.93,
    pdf: 0.9,
    sheet: 0.58,
    other: 0.78,
  },
  balanced: {
    image: 0.9,
    video: 0.97,
    audio: 0.9,
    document: 0.45,
    code: 0.38,
    archive: 0.99,
    design: 0.84,
    pdf: 0.82,
    sheet: 0.42,
    other: 0.68,
  },
  maximum: {
    image: 0.86,
    video: 0.96,
    audio: 0.87,
    document: 0.36,
    code: 0.3,
    archive: 0.99,
    design: 0.78,
    pdf: 0.75,
    sheet: 0.34,
    other: 0.6,
  },
}

export function estimateArchiveSize(
  files: PickedFile[],
  mode: CompressionMode,
  format: ArchiveFormat,
  encrypted: boolean,
): number {
  if (mode === 'store' && format === '7z') {
    // 7z still applies a small amount of entropy coding in its store mode.
    return files.reduce((sum, item) => sum + item.file.size, 0)
  }

  let total = 0
  for (const item of files) {
    const ratio = compressionRatios[mode][getCategory(item.path)]
    total += Math.max(24, Math.round(item.file.size * ratio))
  }

  const header = format === '7z' ? 420 : 180
  const perEntry = encrypted ? 46 : 20
  return Math.max(0, total + header + files.length * perEntry)
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  const value = bytes / 1024 ** exponent
  const precision = exponent === 0 ? 0 : value >= 100 ? 0 : decimals
  return `${value.toFixed(precision)} ${units[exponent]}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
}

export function stripArchiveExtension(name: string): string {
  return name.replace(/\.(zip|7z)$/i, '')
}

export function sanitizeArchiveBase(name: string): string {
  const cleaned = name
    .replace(/\.(zip|7z)$/i, '')
    // Strip characters that are invalid in downloaded file names.
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'archive'
}

export function suggestArchiveName(files: PickedFile[]): string {
  if (files.length === 0) return 'archive'
  if (files.length === 1) {
    return stripArchiveExtension(files[0].file.name) || 'archive'
  }

  const firstSegments = files.map((item) => item.path.split('/')[0])
  const shared = firstSegments.every((segment) => segment === firstSegments[0])
  if (shared && firstSegments[0]) {
    return stripArchiveExtension(firstSegments[0]) || 'archive'
  }

  return 'archive'
}

export function getPasswordStrength(password: string): {
  score: number
  label: string
} {
  if (!password) return { score: 0, label: 'No password' }
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  score = Math.min(4, score)
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}

export type DetectedFormat =
  | 'zip'
  | '7z'
  | 'rar'
  | 'tar'
  | 'gzip'
  | 'bzip2'
  | 'xz'
  | 'other'

export function detectArchiveFormat(name: string): DetectedFormat {
  const lower = name.toLowerCase()
  if (lower.endsWith('.zip')) return 'zip'
  if (lower.endsWith('.7z')) return '7z'
  if (lower.endsWith('.rar')) return 'rar'
  if (lower.endsWith('.tar')) return 'tar'
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.gz'))
    return 'gzip'
  if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2') || lower.endsWith('.bz2'))
    return 'bzip2'
  if (lower.endsWith('.tar.xz') || lower.endsWith('.txz') || lower.endsWith('.xz'))
    return 'xz'
  return 'other'
}

export function formatLabel(format: DetectedFormat | string): string {
  const labels: Record<string, string> = {
    zip: 'ZIP',
    '7z': '7Z',
    rar: 'RAR',
    tar: 'TAR',
    gzip: 'GZIP',
    bzip2: 'BZIP2',
    xz: 'XZ',
    other: 'ARCHIVE',
  }
  return labels[format] ?? format.toUpperCase()
}

export function baseName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

export function dirName(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}
