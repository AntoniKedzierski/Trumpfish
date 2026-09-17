import { SystemWorkspace } from '../components/SystemWorkspace';

/**
 * Edytor systemu jako własne narzędzie: całe okno dla drzewa odzywek.
 */
/*
 * Sama trasa i nic więcej. Edytor jest komponentem (`components/SystemWorkspace.tsx`), bo stoi w dwóch miejscach - tutaj
 * i w lewej kolumnie widoku analizy - a dwie kopie drzewa odzywek rozjechałyby się pierwszego dnia.
 */
export function BiddingBrowserPage() {
  return <SystemWorkspace />;
}
