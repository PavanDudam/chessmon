type Props = {
  label: string
  size?: number
}

/** Shape-coded icons so classification is not color-alone. */
export function ClassificationIcon({ label, size = 22 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 22 22',
    'aria-hidden': true as const,
    className: `class-icon class-icon-${label.toLowerCase()}`,
  }

  switch (label) {
    case 'Brilliant':
      return (
        <svg {...common}>
          <path
            d="M11 2l1.8 5.4H18l-4.4 3.2 1.7 5.4L11 13.6 6.7 16l1.7-5.4L4 7.4h5.2z"
            fill="currentColor"
          />
          <path
            d="M11 6l1 3H15l-2.4 1.7.9 3L11 12.2 8.5 13.7l.9-3L7 9h3z"
            fill="var(--ink-0)"
            opacity="0.35"
          />
        </svg>
      )
    case 'Best':
      return (
        <svg {...common}>
          <path
            d="M11 2l1.8 5.4H18l-4.4 3.2 1.7 5.4L11 13.6 6.7 16l1.7-5.4L4 7.4h5.2z"
            fill="currentColor"
          />
        </svg>
      )
    case 'Excellent':
      return (
        <svg {...common}>
          <path
            d="M5 11.5l4 4 8-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'Good':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="3.5" fill="currentColor" />
        </svg>
      )
    case 'Book':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="14" height="14" rx="3" fill="currentColor" opacity="0.25" />
          <text
            x="11"
            y="15"
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            fill="currentColor"
          >
            B
          </text>
        </svg>
      )
    case 'Inaccuracy':
      return (
        <svg {...common}>
          <text
            x="11"
            y="15"
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            fill="currentColor"
          >
            ?!
          </text>
        </svg>
      )
    case 'Mistake':
      return (
        <svg {...common}>
          <text
            x="11"
            y="15"
            textAnchor="middle"
            fontSize="12"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            fill="currentColor"
          >
            ?
          </text>
        </svg>
      )
    case 'Blunder':
      return (
        <svg {...common}>
          <text
            x="11"
            y="15"
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            fill="currentColor"
          >
            ??
          </text>
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="3" fill="currentColor" />
        </svg>
      )
  }
}

export function showDeltaForLabel(label: string): boolean {
  return label === 'Inaccuracy' || label === 'Mistake' || label === 'Blunder'
}
