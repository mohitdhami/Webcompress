import {
  BlobReader,
  BlobWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { ArchiveError, toArchiveError } from './errors'
import { normalizePath } from './files'
import type {
  ArchiveEntry,
  CompressionMode,
  ExtractedFile,
  PickedFile,
} from './types'

const zipLevels: Record<CompressionMode, number> = {
  store: 0,
  fast: 1,
  balanced: 6,
  maximum: 9,
}

interface CreateZipOptions {
  mode: CompressionMode
  password?: string
  onProgress?: (percent: number) => void
}

export async function createZipArchive(
  files: PickedFile[],
  options: CreateZipOptions,
): Promise<Blob> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    password: options.password || undefined,
    encryptionStrength: 3,
    bufferedWrite: true,
  })

  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0)
  let completedBytes = 0
  let lastPercent = -1

  try {
    for (const item of files) {
      await writer.add(item.path, new BlobReader(item.file), {
        level: zipLevels[options.mode],
        lastModDate:
          item.file.lastModified > 0
            ? new Date(item.file.lastModified)
            : undefined,
        onprogress: (progress) => {
          const percent =
            totalBytes > 0
              ? Math.min(99, ((completedBytes + progress) / totalBytes) * 100)
              : 0
          if (percent >= lastPercent + 0.8) {
            lastPercent = percent
            options.onProgress?.(percent)
          }
        },
      })
      completedBytes += item.file.size
      options.onProgress?.(
        totalBytes > 0 ? Math.min(99, (completedBytes / totalBytes) * 100) : 99,
      )
    }

    const blob = await writer.close()
    options.onProgress?.(100)
    return blob
  } catch (error) {
    try {
      await writer.close()
    } catch {
      // Ignore cleanup errors and surface the original failure.
    }
    throw toArchiveError(error)
  }
}

export async function inspectZipArchive(file: File): Promise<ArchiveEntry[]> {
  const reader = new ZipReader(new BlobReader(file))
  try {
    const entries = await reader.getEntries()
    return entries.map((entry) => ({
      path: entry.filename,
      size: entry.uncompressedSize,
      compressedSize: entry.compressedSize,
      isDirectory: entry.directory,
      encrypted: entry.encrypted,
    }))
  } catch (error) {
    throw toArchiveError(error)
  } finally {
    await reader.close()
  }
}

export async function extractZipArchive(
  file: File,
  password: string,
  onlyPaths?: string[],
): Promise<ExtractedFile[]> {
  const reader = new ZipReader(new BlobReader(file), {
    password: password || undefined,
  })
  const wanted = onlyPaths ? new Set(onlyPaths) : null
  const output: ExtractedFile[] = []

  try {
    const entries = await reader.getEntries()
    for (const entry of entries) {
      if (entry.directory || entry.symlink) continue
      if (wanted && !wanted.has(entry.filename)) continue
      try {
        const blob = await entry.getData(new BlobWriter(), {
          password: password || undefined,
        })
        output.push({
          path: normalizePath(entry.filename, 'file'),
          data: await blob.arrayBuffer(),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.toLowerCase().includes('password')) {
          throw new ArchiveError(
            'INVALID_PASSWORD',
            'The password did not work. Check it and try again.',
          )
        }
        throw error
      }
    }
    return output
  } catch (error) {
    throw toArchiveError(error)
  } finally {
    await reader.close()
  }
}
