import SevenZipWorker from './sevenzip.worker?worker&inline'
import { ArchiveError } from './errors'
import type {
  ArchiveEntry,
  CompressionMode,
  ExtractedFile,
  PickedFile,
} from './types'

export type SevenZipProgress = (stage: string, percent?: number) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  onProgress?: SevenZipProgress
}

interface WorkerProgress {
  id: string
  type: 'progress'
  stage: string
  percent?: number
}

interface WorkerResult {
  id: string
  type: 'result'
  data?: Uint8Array
  entries?: ArchiveEntry[]
  files?: ExtractedFile[]
}

interface WorkerError {
  id: string
  type: 'error'
  error: { code: string; message: string }
}

type WorkerResponse = WorkerProgress | WorkerResult | WorkerError

let worker: Worker | null = null
let sequence = 0
let queue: Promise<unknown> = Promise.resolve()
const pending = new Map<string, PendingRequest>()

function rejectAll(error: Error): void {
  for (const request of pending.values()) {
    request.reject(error)
  }
  pending.clear()
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new SevenZipWorker({ name: 'webcompress-7zip' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    const request = pending.get(message.id)
    if (!request) return

    if (message.type === 'progress') {
      request.onProgress?.(message.stage, message.percent)
      return
    }

    pending.delete(message.id)
    if (message.type === 'error') {
      request.reject(
        new ArchiveError(
          message.error.code as ConstructorParameters<typeof ArchiveError>[0],
          message.error.message,
        ),
      )
      return
    }
    request.resolve(message)
  }
  worker.onerror = (event) => {
    rejectAll(
      new ArchiveError(
        'UNKNOWN',
        event.message || 'The 7-Zip engine stopped unexpectedly.',
      ),
    )
    worker?.terminate()
    worker = null
  }
  return worker
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

function send<T>(
  payload: Record<string, unknown>,
  onProgress?: SevenZipProgress,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `job-${++sequence}-${Date.now()}`
    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      onProgress,
    })
    try {
      getWorker().postMessage({ ...payload, id })
    } catch (error) {
      pending.delete(id)
      reject(
        new ArchiveError(
          'UNKNOWN',
          error instanceof Error
            ? error.message
            : 'The archive engine could not start.',
        ),
      )
    }
  })
}

export function create7zArchive(
  files: PickedFile[],
  options: {
    mode: CompressionMode
    password: string
    encryptNames: boolean
    onProgress?: SevenZipProgress
  },
): Promise<Blob> {
  return enqueue(async () => {
    const response = await send<WorkerResult>(
      {
        action: 'create',
        files: files.map((item) => ({ path: item.path, file: item.file })),
        mode: options.mode,
        password: options.password,
        encryptNames: options.encryptNames,
      },
      options.onProgress,
    )
    if (!response.data) {
      throw new ArchiveError('UNKNOWN', 'The archive was created without data.')
    }
    return new Blob([response.data as unknown as BlobPart], {
      type: 'application/x-7z-compressed',
    })
  })
}

export function inspect7zArchive(
  archive: File,
  password: string,
): Promise<ArchiveEntry[]> {
  return enqueue(async () => {
    const response = await send<WorkerResult>({
      action: 'inspect',
      archive,
      password,
    })
    return response.entries ?? []
  })
}

export function extract7zArchive(
  archive: File,
  password: string,
  paths?: string[],
  onProgress?: SevenZipProgress,
): Promise<ExtractedFile[]> {
  return enqueue(async () => {
    const response = await send<WorkerResult>(
      {
        action: 'extract',
        archive,
        password,
        paths,
      },
      onProgress,
    )
    return response.files ?? []
  })
}
