/// <reference lib="webworker" />

import SevenZip from '7z-wasm'
import wasmUrl from '7z-wasm/7zz.wasm?url'
import { ArchiveError, toArchiveError } from './errors'
import { normalizePath } from './files'
import type {
  ArchiveEntry,
  CompressionMode,
  ExtractedFile,
  PickedFile,
} from './types'

interface CreateRequest {
  id: string
  action: 'create'
  files: Array<Pick<PickedFile, 'path' | 'file'>>
  password: string
  encryptNames: boolean
  mode: CompressionMode
}

interface InspectRequest {
  id: string
  action: 'inspect'
  archive: File
  password: string
}

interface ExtractRequest {
  id: string
  action: 'extract'
  archive: File
  password: string
  paths?: string[]
}

type WorkerRequest = CreateRequest | InspectRequest | ExtractRequest

interface SevenZipFs {
  mkdir: (path: string, mode?: number) => unknown
  chdir: (path: string) => void
  writeFile: (path: string, data: Uint8Array) => void
  readFile: (path: string) => Uint8Array
  readdir: (path: string) => string[]
  stat: (path: string) => {
    size: number
    mode: number
    mtime: Date
  }
  isDir: (mode: number) => boolean
  isLink: (mode: number) => boolean
  utime: (path: string, atime: Date, mtime: Date) => void
}

interface SevenZipModule {
  FS: SevenZipFs
  callMain: (args: string[]) => number
}

const workerSelf = self as unknown as DedicatedWorkerGlobalScope
const factory = SevenZip as unknown as (options: {
  locateFile: (path: string) => string
  print: (text: string) => void
  printErr: (text: string) => void
}) => Promise<SevenZipModule>

let sevenZipPromise: Promise<SevenZipModule> | null = null
let currentId = ''
let outText = ''
let errText = ''

function resetLogs(): void {
  outText = ''
  errText = ''
}

async function getSevenZip(): Promise<SevenZipModule> {
  if (!sevenZipPromise) {
    sevenZipPromise = factory({
      locateFile: () => wasmUrl,
      print: (text) => {
        outText += `${text}\n`
      },
      printErr: (text) => {
        errText += `${text}\n`
      },
    })
  }
  return sevenZipPromise
}

function postProgress(stage: string, percent?: number): void {
  workerSelf.postMessage({
    id: currentId,
    type: 'progress',
    stage,
    percent,
  })
}

function ensureDirectory(fs: SevenZipFs, path: string): void {
  const parts = path.split('/').filter(Boolean)
  let current = ''
  for (const part of parts) {
    current += `/${part}`
    try {
      fs.mkdir(current)
    } catch (error) {
      const errno = (error as { errno?: number }).errno
      if (errno !== 20) throw error
    }
  }
}

function classifyFailure(passwordProvided: boolean): ArchiveError {
  const all = `${outText}\n${errText}`.toLowerCase()
  if (
    all.includes('wrong password') ||
    all.includes('encrypted archive') ||
    all.includes('password')
  ) {
    return passwordProvided
      ? new ArchiveError(
          'INVALID_PASSWORD',
          'That password did not unlock the archive.',
        )
      : new ArchiveError(
          'PASSWORD_REQUIRED',
          'This archive needs a password to reveal its contents.',
        )
  }
  if (
    all.includes('can not open the file as archive') ||
    all.includes('is not archive') ||
    all.includes('unexpected end') ||
    all.includes('headers error')
  ) {
    return new ArchiveError(
      'INVALID_ARCHIVE',
      'This file could not be read as an archive.',
    )
  }
  return new ArchiveError(
    'INVALID_ARCHIVE',
    'The archive could not be processed. It may be damaged or use an unsupported method.',
  )
}

/**
 * 7-Zip can throw a raw C++ exception value when an encrypted header cannot
 * be decoded. That bypasses the normal exit code and used to surface as a
 * meaningless number (for example "264792"). Treat those throws as password
 * failures, and keep every other exception intact.
 */
function callSevenZip(
  sevenZip: SevenZipModule,
  args: string[],
  passwordProvided: boolean,
  action: WorkerRequest['action'],
): number {
  try {
    return sevenZip.callMain(args)
  } catch (error) {
    if (typeof error !== 'number') throw error
    if (action === 'create') {
      throw new ArchiveError(
        'INVALID_ARCHIVE',
        'The archive could not be created.',
      )
    }
    throw passwordProvided
      ? new ArchiveError(
          'INVALID_PASSWORD',
          'That password did not unlock the archive.',
        )
      : new ArchiveError(
          'PASSWORD_REQUIRED',
          'This archive needs a password to reveal its contents.',
        )
  }
}

async function prepareWorkspace(
  fs: SevenZipFs,
  files: CreateRequest['files'],
  root: string,
): Promise<void> {
  fs.mkdir(root)
  fs.chdir(root)
  const total = files.reduce((sum, item) => sum + item.file.size, 0) || 1
  let written = 0

  for (const item of files) {
    const path = normalizePath(item.path, item.file.name)
    const slash = path.lastIndexOf('/')
    if (slash > 0) {
      ensureDirectory(fs, `${root}/${path.slice(0, slash)}`)
    }
    const data = new Uint8Array(await item.file.arrayBuffer())
    fs.writeFile(`${root}/${path}`, data)
    if (item.file.lastModified > 0) {
      try {
        const date = new Date(item.file.lastModified)
        fs.utime(`${root}/${path}`, date, date)
      } catch {
        // Modification time is a nicety, not a requirement.
      }
    }
    written += item.file.size
    postProgress('Reading files', Math.min(24, (written / total) * 24))
  }
}

const compoundTarPattern = /\.(?:tar\.(?:gz|bz2|xz)|tgz|tbz2|txz)$/i

function isCompoundTar(name: string): boolean {
  return compoundTarPattern.test(name)
}

/**
 * 7-Zip treats .tar.gz (and friends) as a compressed single file. Unpack the
 * outer compression layer first so the app can inspect and extract the actual
 * files inside the inner tar.
 */
async function unpackCompoundTar(
  sevenZip: SevenZipModule,
  root: string,
  archivePath: string,
  password: string,
  action: 'inspect' | 'extract',
): Promise<string> {
  const outer = `${root}/outer`
  sevenZip.FS.mkdir(outer)
  const code = callSevenZip(
    sevenZip,
    [
      'x',
      archivePath,
      `-o${outer}`,
      '-y',
      '-bso0',
      '-bsp0',
      `-p${password}`,
    ],
    Boolean(password),
    action,
  )
  if (code !== 0) {
    throw classifyFailure(Boolean(password))
  }

  const names = sevenZip.FS.readdir(outer).filter(
    (name) => name !== '.' && name !== '..',
  )
  const tarName = names.find((name) => /\.tar$/i.test(name)) ?? names[0]
  if (!tarName) {
    throw new ArchiveError(
      'INVALID_ARCHIVE',
      'This compressed file did not contain a tar archive.',
    )
  }
  return `${outer}/${tarName}`
}

async function createArchive(request: CreateRequest): Promise<Uint8Array> {
  const sevenZip = await getSevenZip()
  const fs = sevenZip.FS
  postProgress('Preparing', 2)
  const root = `/work-${request.id.replace(/[^a-z0-9-]/gi, '')}`
  await prepareWorkspace(fs, request.files, root)

  const archivePath = `${root}/archive.7z`
  const levels: Record<CompressionMode, number> = {
    store: 0,
    fast: 1,
    balanced: 5,
    maximum: 9,
  }
  const args = [
    'a',
    archivePath,
    '.',
    `-mx=${levels[request.mode]}`,
    '-bso0',
    '-bsp0',
  ]
  if (request.password) {
    args.push(`-p${request.password}`)
    args.push(`-mhe=${request.encryptNames ? 'on' : 'off'}`)
  }

  postProgress('Compressing', 70)
  const code = callSevenZip(
    sevenZip,
    args,
    Boolean(request.password),
    'create',
  )
  if (code !== 0) {
    throw classifyFailure(Boolean(request.password))
  }

  const archive = fs.readFile(archivePath)
  postProgress('Finishing', 98)
  return archive.slice()
}

function parseListing(output: string): ArchiveEntry[] {
  const separator = output.indexOf('----------')
  const body = separator >= 0 ? output.slice(separator + 10) : output
  const entries: ArchiveEntry[] = []

  for (const block of body.split(/\n\s*\n/)) {
    if (!block.trim()) continue
    const fields: Record<string, string> = {}
    for (const line of block.split(/\r?\n/)) {
      const index = line.indexOf(' = ')
      if (index === -1) continue
      fields[line.slice(0, index)] = line.slice(index + 3)
    }
    if (!fields.Path) continue
    if (!fields.Attributes && !fields.Size) continue
    if (fields.Type) continue

    const attributes = fields.Attributes ?? ''
    const isDirectory =
      fields.Folder === '+' || /(^|\s)D/.test(attributes)
    entries.push({
      path: normalizePath(fields.Path, 'file'),
      size: Number(fields.Size || 0),
      compressedSize: fields['Packed Size']
        ? Number(fields['Packed Size'])
        : undefined,
      isDirectory,
      encrypted: fields.Encrypted === '+',
    })
  }

  return entries
}

async function inspectArchive(request: InspectRequest): Promise<ArchiveEntry[]> {
  const sevenZip = await getSevenZip()
  const fs = sevenZip.FS
  const root = `/inspect-${request.id.replace(/[^a-z0-9-]/gi, '')}`
  fs.mkdir(root)
  fs.chdir(root)
  const archivePath = `${root}/archive`
  fs.writeFile(archivePath, new Uint8Array(await request.archive.arrayBuffer()))

  let target = archivePath
  if (isCompoundTar(request.archive.name)) {
    target = await unpackCompoundTar(
      sevenZip,
      root,
      archivePath,
      request.password,
      'inspect',
    )
    resetLogs()
  }

  const args = ['l', '-slt', target, '-bso1', '-bsp0']
  args.push(`-p${request.password}`)
  const code = callSevenZip(
    sevenZip,
    args,
    Boolean(request.password),
    'inspect',
  )
  if (code !== 0) {
    throw classifyFailure(Boolean(request.password))
  }

  const entries = parseListing(outText)
  if (entries.length === 0) {
    throw new ArchiveError(
      'INVALID_ARCHIVE',
      'No files were found in this archive.',
    )
  }
  return entries
}

function walkExtractedFiles(
  fs: SevenZipFs,
  root: string,
  relative: string,
  output: ExtractedFile[],
): void {
  const current = relative ? `${root}/${relative}` : root
  for (const name of fs.readdir(current)) {
    if (name === '.' || name === '..') continue
    const path = relative ? `${relative}/${name}` : name
    const fullPath = `${root}/${path}`
    const stat = fs.stat(fullPath)
    if (fs.isLink(stat.mode)) continue
    if (fs.isDir(stat.mode)) {
      walkExtractedFiles(fs, root, path, output)
      continue
    }
    const data = fs.readFile(fullPath)
    output.push({
      path: normalizePath(path, 'file'),
      data: data.slice().buffer,
    })
  }
}

async function extractArchive(request: ExtractRequest): Promise<ExtractedFile[]> {
  const sevenZip = await getSevenZip()
  const fs = sevenZip.FS
  const root = `/extract-${request.id.replace(/[^a-z0-9-]/gi, '')}`
  fs.mkdir(root)
  fs.chdir(root)
  const archivePath = `${root}/archive`
  fs.writeFile(archivePath, new Uint8Array(await request.archive.arrayBuffer()))

  let target = archivePath
  if (isCompoundTar(request.archive.name)) {
    target = await unpackCompoundTar(
      sevenZip,
      root,
      archivePath,
      request.password,
      'extract',
    )
    resetLogs()
  }

  fs.mkdir(`${root}/out`)

  const args = [
    'x',
    target,
    `-o${root}/out`,
    '-y',
    '-bso0',
    '-bsp0',
  ]
  args.push(`-p${request.password}`)
  postProgress('Unpacking', 40)
  const code = callSevenZip(
    sevenZip,
    args,
    Boolean(request.password),
    'extract',
  )
  if (code !== 0) {
    throw classifyFailure(Boolean(request.password))
  }

  const output: ExtractedFile[] = []
  walkExtractedFiles(fs, `${root}/out`, '', output)
  postProgress('Finishing', 95)

  if (request.paths && request.paths.length > 0) {
    const wanted = new Set(request.paths)
    return output.filter((file) => wanted.has(file.path))
  }
  return output
}

workerSelf.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  currentId = request.id
  resetLogs()

  try {
    if (request.action === 'create') {
      const data = await createArchive(request)
      workerSelf.postMessage(
        { id: request.id, type: 'result', data },
        [data.buffer],
      )
      return
    }

    if (request.action === 'inspect') {
      const entries = await inspectArchive(request)
      workerSelf.postMessage({ id: request.id, type: 'result', entries })
      return
    }

    const files = await extractArchive(request)
    workerSelf.postMessage(
      { id: request.id, type: 'result', files },
      files.map((file) => file.data),
    )
  } catch (error) {
    const archiveError = toArchiveError(error)
    workerSelf.postMessage({
      id: request.id,
      type: 'error',
      error: { code: archiveError.code, message: archiveError.message },
    })
  }
}
