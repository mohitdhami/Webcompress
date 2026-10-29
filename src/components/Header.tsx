import { Archive, HelpCircle, PackageOpen, ShieldCheck } from 'lucide-react'
import type { AppTab } from '../lib/types'
import { Logo } from './Logo'

interface HeaderProps {
  tab: AppTab
  onTabChange: (tab: AppTab) => void
  onGuide: () => void
}

export function Header({ tab, onTabChange, onGuide }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Logo />

        <nav className="tab-switcher" aria-label="Workspace">
          <button
            type="button"
            className={`tab-button ${tab === 'compress' ? 'is-active' : ''}`}
            aria-current={tab === 'compress' ? 'page' : undefined}
            onClick={() => onTabChange('compress')}
          >
            <Archive size={15} strokeWidth={2} />
            Compress
          </button>
          <button
            type="button"
            className={`tab-button ${tab === 'extract' ? 'is-active' : ''}`}
            aria-current={tab === 'extract' ? 'page' : undefined}
            onClick={() => onTabChange('extract')}
          >
            <PackageOpen size={15} strokeWidth={2} />
            Extract
          </button>
        </nav>

        <div className="topbar-actions">
          <span className="local-pill">
            <span className="local-dot" />
            <ShieldCheck size={13} />
            100% local
          </span>
          <button type="button" className="text-button" onClick={onGuide}>
            <HelpCircle size={15} />
            How it works
          </button>
        </div>
      </div>
    </header>
  )
}
