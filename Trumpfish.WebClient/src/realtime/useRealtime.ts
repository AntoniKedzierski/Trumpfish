import { useContext } from 'react';
import { RealtimeContext, type RealtimeContextValue } from './realtimeContext';

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (context === null) {
    throw new Error('useRealtime must be used inside a RealtimeProvider.');
  }

  return context;
}
