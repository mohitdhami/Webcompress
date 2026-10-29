export type ArchiveErrorCode =
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'INVALID_ARCHIVE'
  | 'UNSUPPORTED'
  | 'UNKNOWN'

export class ArchiveError extends Error {
  code: ArchiveErrorCode

  constructor(code: ArchiveErrorCode, message: string) {
    super(message)
    this.name = 'ArchiveError'
    this.code = code
  }
}

export function toArchiveError(error: unknown): ArchiveError {
  if (error instanceof ArchiveError) return error
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  if (
    lower.includes('password') ||
    lower.includes('encrypted archive') ||
    lower.includes('wrong password')
  ) {
    return new ArchiveError(
      'INVALID_PASSWORD',
      'The password did not work. Check it and try again.',
    )
  }
  if (
    lower.includes('format') ||
    lower.includes('corrupt') ||
    lower.includes('invalid') ||
    lower.includes('unexpected end') ||
    lower.includes('end of central directory') ||
    lower.includes('central directory') ||
    lower.includes('not a zip') ||
    lower.includes('signature') ||
    lower.includes('headers error') ||
    lower.includes('data error')
  ) {
    return new ArchiveError(
      'INVALID_ARCHIVE',
      'This file could not be read as an archive.',
    )
  }
  return new ArchiveError(
    'UNKNOWN',
    message || 'Something went wrong while working on this archive.',
  )
}
