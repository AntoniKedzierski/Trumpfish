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

/** A triangle pointing forward: begin the exercise. */
export function PlayIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M8 5.5 18.5 12 8 18.5V5.5Z" {...stroke} />
    </Icon>
  );
}

/** A tick: the change is kept. */
export function CheckIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m4.5 12.5 5 5 10-11" {...stroke} />
    </Icon>
  );
}

/**
 * A floppy disk: writing the system back to the server.
 */
/*
 * The shutter at the top and the label at the bottom, because the outline alone is a rounded square and reads as nothing.
 * The clipped corner is on the right, where the notch on the real thing was.
 */
export function SaveIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h9l4 4v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" {...stroke} />
      <path d="M8.5 4.5v5h6v-5" {...stroke} />
      <path d="M8 19.5v-5h8v5" {...stroke} />
    </Icon>
  );
}

/** Three lines: the navigation, folded away because the bar ran out of room for it. */
export function MenuIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" {...stroke} />
    </Icon>
  );
}

/** A key: the password. */
export function KeyIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="8" cy="16" r="3.75" {...stroke} />
      <path d="m10.75 13.25 8-8" {...stroke} />
      <path d="m16.5 7.5 2.25 2.25" {...stroke} />
      <path d="m19 5 2 2" {...stroke} />
    </Icon>
  );
}

/**
 * Three cards spread in a fan: a hand being dealt, which is what the simulator does.
 */
/*
 * The two behind are outlines and the one in front is solid. Drawn as three outlines the back cards' edges would carry on
 * straight through the front one, and at this size that reads as a scribble rather than as cards.
 */
export function CardsIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="3.6" y="6.4" width="9.2" height="13.2" rx="2.2" transform="rotate(-20 8.2 13)" {...stroke} />
      <rect x="11.2" y="6.4" width="9.2" height="13.2" rx="2.2" transform="rotate(20 15.8 13)" {...stroke} />
      <rect x="7.4" y="4.6" width="9.2" height="15" rx="2.2" {...stroke} fill="currentColor" />
    </Icon>
  );
}

/** Sliders: the run is set up here. */
export function SettingsIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M5 7.5h14M5 16.5h14" {...stroke} />
      <circle cx="9.5" cy="7.5" r="2.4" {...stroke} fill="currentColor" />
      <circle cx="15.5" cy="16.5" r="2.4" {...stroke} fill="currentColor" />
    </Icon>
  );
}

/** A funnel: the filters. */
export function FilterIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3.5 4.5h17l-6.6 7.8v6.2l-3.8 1.9v-8.1L3.5 4.5Z" {...stroke} />
    </Icon>
  );
}

/** Three bars of falling length: the sort order. */
export function SortIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 6.5h15M4 12h10M4 17.5h5" {...stroke} />
    </Icon>
  );
}

/** A cross: clear what was typed, or clear the whole filter. */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" {...stroke} />
    </Icon>
  );
}
