/**
 * The handful of vector icons the shell needs, drawn to the same recipe as the `Chevron` in `Select.tsx`: a 24 unit box,
 * sized in `em` so a glyph follows the text beside it, and stroked in `currentColor` so it inherits every hover and state
 * colour for free.
 */
/*
 * Written out here rather than pulled from an icon package because the shell needs two of them. Should a third screen start
 * asking for icons by the dozen, this file is the seam to replace with Phosphor or Heroicons - the call sites would not move.
 */

/** Geometry shared by every icon below, so none of them can drift in stroke weight or cap shape. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Icon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      className={className === undefined ? 'icon' : `icon ${className}`}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Two figures: the friends list. */
export function UsersIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M15.5 20.5v-1.6a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.9v1.6" {...stroke} />
      <circle cx="9.25" cy="7.75" r="3.75" {...stroke} />
      <path d="M21 20.5v-1.6a3.6 3.6 0 0 0-2.7-3.48" {...stroke} />
      <path d="M15.75 4.25a3.75 3.75 0 0 1 0 7" {...stroke} />
    </Icon>
  );
}

/** A single figure: the signed in account. */
export function UserIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M19 20.5v-1.75A3.75 3.75 0 0 0 15.25 15h-6.5A3.75 3.75 0 0 0 5 18.75v1.75" {...stroke} />
      <circle cx="12" cy="7.75" r="3.75" {...stroke} />
    </Icon>
  );
}

/** A machine at the table: practising against the bots. */
export function BotIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="3.5" y="8.5" width="17" height="11" rx="3" {...stroke} />
      <path d="M12 5.5v3" {...stroke} />
      <circle cx="12" cy="4" r="1.4" {...stroke} />
      <path d="M9 13v1.5M15 13v1.5" {...stroke} />
    </Icon>
  );
}

/** Stacked sheets: the systems a user keeps. */
export function LayersIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m12 3.5 8.5 4.25L12 12 3.5 7.75 12 3.5Z" {...stroke} />
      <path d="m3.5 12.25 8.5 4.25 8.5-4.25" {...stroke} />
      <path d="m3.5 16.5 8.5 4.25 8.5-4.25" {...stroke} />
    </Icon>
  );
}

/** A door with an arrow leaving through it: signing out. */
export function LogOutIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4" {...stroke} />
      <path d="m15.5 16.5 4.5-4.5-4.5-4.5" {...stroke} />
      <path d="M20 12H9" {...stroke} />
    </Icon>
  );
}
