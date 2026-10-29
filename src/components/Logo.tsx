export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 38 38"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <rect width="38" height="38" rx="11" fill="#181a16" />
        <rect
          x="9.5"
          y="7.5"
          width="19"
          height="23"
          rx="4.5"
          fill="#f7f4e9"
        />
        <path d="M19 9v20" stroke="#181a16" strokeWidth="1.8" />
        <path
          d="M15.5 12.5h3.2M19 15.5h3.2M15.5 18.5h3.2M19 21.5h3.2M15.5 24.5h3.2"
          stroke="#a9d839"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="28.5" cy="9.5" r="3" fill="#c9f158" />
      </svg>
    </span>
  )
}

export function Logo() {
  return (
    <div className="brand">
      <LogoMark />
      <span className="brand-name">WebCompress</span>
      <span className="brand-beta">LOCAL</span>
    </div>
  )
}
