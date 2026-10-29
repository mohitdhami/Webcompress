import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  PenTool,
} from 'lucide-react'
import type { FileCategory } from '../lib/format'

const icons = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  code: FileCode2,
  archive: FileArchive,
  design: PenTool,
  pdf: FileText,
  sheet: FileSpreadsheet,
  other: File,
} satisfies Record<FileCategory, typeof File>

export function FileGlyph({
  category,
  size = 38,
}: {
  category: FileCategory
  size?: number
}) {
  const Icon = icons[category]
  return (
    <span
      className={`file-glyph tone-${category}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={size * 0.48} strokeWidth={1.9} />
    </span>
  )
}

export function ArchiveGlyph({ format }: { format: 'zip' | '7z' }) {
  return (
    <span className={`archive-glyph format-${format}`} aria-hidden="true">
      <FileArchive size={24} strokeWidth={1.8} />
      <span>{format === 'zip' ? 'ZIP' : '7Z'}</span>
    </span>
  )
}
