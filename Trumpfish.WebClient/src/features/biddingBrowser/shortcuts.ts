/**
 * Every keyboard command the browser answers to, as it is shown to the reader.
 */
/*
 * The list lives here rather than beside the handler because it is the part that has to be right: a key that stops working
 * is discovered the first time somebody presses it, whereas a help panel that quietly falls behind is believed. Anything
 * added to the handler in `BiddingBrowserPage` belongs here in the same commit.
 *
 * Grouped the way the work is, not the way the chords are, so somebody looking for "how do I duplicate this" reads one
 * short group rather than scanning ten rows of modifiers.
 */
export interface Shortcut {
  keys: string;
  what: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

export const shortcutGroups: readonly ShortcutGroup[] = [
  {
    title: 'Odzywki',
    shortcuts: [
      { keys: 'Ctrl + Shift + A', what: 'Dodaj odzywkę obok zaznaczonej' },
      { keys: 'Ctrl + Shift + D', what: 'Powiel zaznaczoną odzywkę' },
      { keys: 'Ctrl + Shift + F', what: 'Pokaż zaznaczoną odzywkę w drzewie' },
    ],
  },
  {
    title: 'Schowek',
    shortcuts: [
      { keys: 'Ctrl + C', what: 'Kopiuj odzywkę' },
      { keys: 'Ctrl + X', what: 'Wytnij odzywkę' },
      { keys: 'Ctrl + V', what: 'Wklej odzywkę' },
      { keys: 'Alt + C', what: 'Kopiuj same odzywki podrzędne' },
      { keys: 'Ctrl + Shift + X', what: 'Wytnij same odzywki podrzędne' },
    ],
  },
  {
    title: 'System',
    shortcuts: [
      { keys: 'Ctrl + Shift + S', what: 'Zapisz' },
      { keys: 'Ctrl + Shift + V', what: 'Zapisz i sprawdź' },
    ],
  },
];
