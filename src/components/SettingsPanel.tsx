import { useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  FileArchive,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import {
  formatBytes,
  getPasswordStrength,
  sanitizeArchiveBase,
} from '../lib/format'
import type {
  ArchiveFormat,
  CompressionMode,
} from '../lib/types'

interface SettingsPanelProps {
  format: ArchiveFormat
  mode: CompressionMode
  archiveBase: string
  protect: boolean
  password: string
  confirmPassword: string
  encryptNames: boolean
  filesCount: number
  totalBytes: number
  estimatedBytes: number
  passwordValid: boolean
  working: boolean
  progress: number
  stage: string
  onFormatChange: (format: ArchiveFormat) => void
  onModeChange: (mode: CompressionMode) => void
  onArchiveBaseChange: (name: string) => void
  onProtectChange: (value: boolean) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onEncryptNamesChange: (value: boolean) => void
  onReset: () => void
  onCreate: () => void
  onBrowse: () => void
}

const modes: Array<{
  id: CompressionMode
  name: string
  hint: string
  bars: number
}> = [
  { id: 'store', name: 'Store', hint: 'None', bars: 1 },
  { id: 'fast', name: 'Fast', hint: 'Light', bars: 2 },
  { id: 'balanced', name: 'Balanced', hint: 'Smart', bars: 3 },
  { id: 'maximum', name: 'Maximum', hint: 'Smallest', bars: 4 },
]

const modeDescriptions: Record<CompressionMode, string> = {
  store: 'Packages files as-is. The quickest option.',
  fast: 'Light compression for files you need right away.',
  balanced: 'The sweet spot for everyday files.',
  maximum: 'Smallest archive. Takes a little longer.',
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  )
}

export function SettingsPanel({
  format,
  mode,
  archiveBase,
  protect,
  password,
  confirmPassword,
  encryptNames,
  filesCount,
  totalBytes,
  estimatedBytes,
  passwordValid,
  working,
  progress,
  stage,
  onFormatChange,
  onModeChange,
  onArchiveBaseChange,
  onProtectChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onEncryptNamesChange,
  onReset,
  onCreate,
  onBrowse,
}: SettingsPanelProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const strength = getPasswordStrength(password)
  const savings =
    totalBytes > 0
      ? Math.min(99, Math.max(0, Math.round((1 - estimatedBytes / totalBytes) * 100)))
      : 0
  const primaryDisabled = filesCount > 0 && !passwordValid
  const mismatch =
    protect && confirmPassword.length > 0 && password !== confirmPassword

  const handlePrimary = () => {
    if (working) return
    if (filesCount === 0) {
      onBrowse()
      return
    }
    if (passwordValid) onCreate()
  }

  return (
    <aside className="settings-panel" aria-label="Archive settings">
      <div className="settings-head">
        <div className="settings-title">
          <span className="settings-icon">
            <SlidersHorizontal size={16} />
          </span>
          <div>
            <span className="eyebrow eyebrow-dark">Output</span>
            <h2>Archive settings</h2>
          </div>
        </div>
        <button
          type="button"
          className="reset-button"
          onClick={onReset}
          disabled={working}
          title="Reset settings"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="settings-body">
        <div className="field-group">
          <label htmlFor="archive-name">Archive name</label>
          <div className="name-field">
            <input
              id="archive-name"
              value={archiveBase}
              onChange={(event) => onArchiveBaseChange(event.target.value)}
              onBlur={() =>
                onArchiveBaseChange(sanitizeArchiveBase(archiveBase))
              }
              spellCheck={false}
              autoComplete="off"
              disabled={working}
            />
            <span>.{format}</span>
          </div>
        </div>

        <section className="settings-section">
          <div className="section-head">
            <span className="section-label">Format</span>
            <span className="section-aside">ZIP stays universal</span>
          </div>
          <div className="format-grid">
            <button
              type="button"
              className={`format-card ${format === 'zip' ? 'is-selected' : ''}`}
              aria-pressed={format === 'zip'}
              onClick={() => onFormatChange('zip')}
              disabled={working}
            >
              <span className="format-top">
                <span className="format-icon">
                  <FileArchive size={18} strokeWidth={1.8} />
                </span>
                {format === 'zip' && (
                  <span className="format-check">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="format-name">ZIP</span>
              <span className="format-hint">Universal</span>
              <span className="format-badge">AES-256</span>
            </button>

            <button
              type="button"
              className={`format-card ${format === '7z' ? 'is-selected' : ''}`}
              aria-pressed={format === '7z'}
              onClick={() => onFormatChange('7z')}
              disabled={working}
            >
              <span className="format-top">
                <span className="format-icon format-icon-7z">
                  <LockKeyhole size={18} strokeWidth={1.8} />
                </span>
                {format === '7z' && (
                  <span className="format-check">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="format-name">7Z</span>
              <span className="format-hint">Maximum control</span>
              <span className="format-badge format-badge-accent">
                Hidden names
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-head">
            <span className="section-label">Compression</span>
            <span className="section-aside">
              {mode === 'store' ? 'No compression' : modeDescriptions[mode]}
            </span>
          </div>
          <div className="mode-grid">
            {modes.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`mode-button ${mode === item.id ? 'is-selected' : ''}`}
                aria-pressed={mode === item.id}
                onClick={() => onModeChange(item.id)}
                disabled={working}
              >
                <span className="mode-name">{item.name}</span>
                <span className="mode-bars" aria-hidden="true">
                  {[1, 2, 3, 4].map((bar) => (
                    <span
                      key={bar}
                      className={bar <= item.bars ? 'is-filled' : ''}
                    />
                  ))}
                </span>
                <span className="mode-hint">{item.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={`security-card ${protect ? 'is-open' : ''}`}>
          <div className="security-head">
            <span className="security-icon">
              <ShieldCheck size={18} />
            </span>
            <div className="security-copy">
              <strong>Password protection</strong>
              <span>AES-256 encryption</span>
            </div>
            <Switch
              checked={protect}
              onChange={onProtectChange}
              label="Password protection"
            />
          </div>

          {protect && (
            <div className="security-body">
              <div className="password-field">
                <label htmlFor="archive-password">Password</label>
                <div className="password-input">
                  <input
                    id="archive-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="Enter a strong password"
                    autoComplete="new-password"
                    disabled={working}
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
              </div>

              <div className="strength-row">
                <div className="strength-bars" aria-hidden="true">
                  {[1, 2, 3, 4].map((bar) => (
                    <span
                      key={bar}
                      className={`strength-bar ${
                        password && bar <= strength.score ? 'is-filled' : ''
                      } strength-${strength.score}`}
                    />
                  ))}
                </div>
                <span className="strength-label">
                  {password ? strength.label : '8+ characters recommended'}
                </span>
              </div>

              <div className="password-field">
                <label htmlFor="archive-password-confirm">Confirm</label>
                <div className="password-input">
                  <input
                    id="archive-password-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) =>
                      onConfirmPasswordChange(event.target.value)
                    }
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    disabled={working}
                    aria-invalid={mismatch}
                  />
                  <button
                    type="button"
                    className="reveal-button"
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label={
                      showConfirm ? 'Hide confirmation' : 'Show confirmation'
                    }
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mismatch && (
                  <span className="field-error">Passwords do not match.</span>
                )}
              </div>

              <div className="encrypt-row">
                <span className="encrypt-icon">
                  <Fingerprint size={15} />
                </span>
                <div className="encrypt-copy">
                  <strong>Encrypt file names</strong>
                  <span>
                    {format === '7z'
                      ? 'Names hidden in encrypted headers'
                      : 'Switches to 7Z to hide names'}
                  </span>
                </div>
                <Switch
                  checked={encryptNames}
                  onChange={onEncryptNamesChange}
                  label="Encrypt file names"
                />
              </div>

              {format === 'zip' && (
                <p className="security-note">
                  ZIP protects file contents, but file names stay visible. Use
                  7Z to hide them.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="settings-footer">
        {working && (
          <div className="working-state" aria-live="polite">
            <div className="working-meta">
              <span>{stage || 'Working on it'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className={`progress-track ${format === '7z' ? 'is-animated' : ''}`}>
              <span style={{ width: `${Math.max(3, progress)}%` }} />
            </div>
          </div>
        )}

        {!working && (
          <div className="summary-row">
            <div className="summary-item">
              <span>Original</span>
              <strong>{filesCount ? formatBytes(totalBytes) : '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Estimated</span>
              <strong>
                {filesCount ? formatBytes(estimatedBytes) : '—'}
              </strong>
            </div>
            <span className={`savings-chip ${filesCount ? 'is-visible' : ''}`}>
              <Sparkles size={11} />−{savings}%
            </span>
          </div>
        )}

        <button
          type="button"
          className={`create-button ${working ? 'is-working' : ''}`}
          onClick={handlePrimary}
          disabled={primaryDisabled || working}
          aria-busy={working}
        >
          {working ? (
            <>
              <LoaderCircle size={18} className="spin" />
              {format === '7z' ? 'Packing with 7-Zip' : 'Creating archive'}
              <span className="create-progress">{Math.round(progress)}%</span>
            </>
          ) : filesCount === 0 ? (
            <>
              Choose files
              <ArrowUpRight size={18} />
            </>
          ) : (
            <>
              Create archive
              <span className="create-format">.{format}</span>
              <ArrowUpRight size={18} />
            </>
          )}
        </button>

        <p className="local-note">
          <LockKeyhole size={12} />
          Processed on this device. Nothing is uploaded.
          <span className="footer-encryption">AES-256</span>
        </p>
      </div>
    </aside>
  )
}
