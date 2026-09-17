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
/** Znak zapytania w kółku: „co to znaczy" i „jakie są skróty". */
export function HelpIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M9.4 9.3a2.7 2.7 0 1 1 3.4 2.6c-.6.2-1 .8-1 1.4v.5" {...stroke} />
      <path d="M11.9 17.1h.01" {...stroke} />
    </Icon>
  );
}

/** Wejście: te same drzwi co przy wylogowaniu, tylko strzałka idzie do środka. */
export function LogInIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M14.5 3.5h4a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4" {...stroke} />
      <path d="m9.5 16.5 4.5-4.5-4.5-4.5" {...stroke} />
      <path d="M14 12H3" {...stroke} />
    </Icon>
  );
}

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

/** A magnifier: one deal put under it. */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="6.5" {...stroke} />
      <path d="m15.8 15.8 4.7 4.7" {...stroke} />
    </Icon>
  );
}

/** A plus: one more of whatever the list holds. */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 5.5v13M5.5 12h13" {...stroke} />
    </Icon>
  );
}

/** A bin: the row goes away for good. */
export function TrashIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4.5 6.8h15M9.5 6.8V4.5h5v2.3M10 11v6M14 11v6" {...stroke} />
      <path d="M6.6 6.8 7.6 19a1.6 1.6 0 0 0 1.6 1.5h5.6A1.6 1.6 0 0 0 16.4 19l1-12.2" {...stroke} />
    </Icon>
  );
}

/** A pencil: the words beside it can be changed. */
export function PencilIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4.5 19.5h3.2L18.6 8.6a2.2 2.2 0 0 0-3.2-3.2L4.5 16.3z" {...stroke} />
      <path d="M14.2 6.6l3.2 3.2" {...stroke} />
    </Icon>
  );
}

/** Three points and the lines between them: handing something to somebody else. */
export function ShareIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="17.5" cy="5.8" r="2.8" {...stroke} />
      <circle cx="6.5" cy="12" r="2.8" {...stroke} />
      <circle cx="17.5" cy="18.2" r="2.8" {...stroke} />
      <path d="m9 10.6 6-3.4M9 13.4l6 3.4" {...stroke} />
    </Icon>
  );
}

/** A branch: a bid and what is said after it. */
export function BranchIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M6.5 4.5v9a3 3 0 0 0 3 3h8" {...stroke} />
      <path d="M14 13l3.5 3.5L14 20" {...stroke} />
      <circle cx="6.5" cy="4.5" r="1.8" {...stroke} fill="currentColor" />
    </Icon>
  );
}

/** An arrow up: the row moves ahead of the one above it. */
export function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 19.5v-15M5.5 11 12 4.5 18.5 11" {...stroke} />
    </Icon>
  );
}

/** An arrow down: the row moves behind the one below it. */
export function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 4.5v15M5.5 13 12 19.5 18.5 13" {...stroke} />
    </Icon>
  );
}

/** An arrow back: the way to where you were. */
export function BackIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M19.5 12h-15M11 5.5 4.5 12 11 18.5" {...stroke} />
    </Icon>
  );
}

/** Into a file: what the application has goes out to the disk. */
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" {...stroke} />
      <path d="M4.5 17.5v1.2a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-1.2" {...stroke} />
    </Icon>
  );
}

/** Out of a file: what is on the disk comes into the application. */
export function UploadIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9" {...stroke} />
      <path d="M4.5 17.5v1.2a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-1.2" {...stroke} />
    </Icon>
  );
}

/** A broom of sorts: what is left over is swept out. */
export function BroomIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M14.5 4.5 19 9M16.5 6.5 8 15l-3.5 4.5L9 16z" {...stroke} />
      <path d="M9.5 13.5 11 15" {...stroke} />
    </Icon>
  );
}

/** Dwie strzałki w pierścieniu: to samo jeszcze raz. */
export function RepeatIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 11.5a7.5 7.5 0 0 1 12.8-5.3L20 9.3" {...stroke} />
      <path d="M20 4.5v4.8h-4.8" {...stroke} />
      <path d="M20 12.5a7.5 7.5 0 0 1-12.8 5.3L4 14.7" {...stroke} />
      <path d="M4 19.5v-4.8h4.8" {...stroke} />
    </Icon>
  );
}

/** Prostokąt przecięty w pionie: widok podzielony na dwie kolumny. */
export function SplitIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" {...stroke} />
      <path d="M13.5 4.5v15" {...stroke} />
    </Icon>
  );
}

/** Strzałka w prawo: przejdź tam, gdzie to wskazuje. */
export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4.5 12h15M13 5.5 19.5 12 13 18.5" {...stroke} />
    </Icon>
  );
}
