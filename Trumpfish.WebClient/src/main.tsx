import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { keepWheelOffNumberInputs } from './numberInputWheel';
import { RealtimeProvider } from './realtime/RealtimeProvider';
import { routes } from './routes';
import './styles/theme.css';
import './index.css';

keepWheelOffNumberInputs();

const router = createBrowserRouter(routes);

// Both providers sit above the router: neither uses routing itself, and everything the routes render reads them as context.
// The realtime one in particular has to outlive every view, since closing its connection is what ends a two-player session.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RealtimeProvider>
        <RouterProvider router={router} />
      </RealtimeProvider>
    </AuthProvider>
  </StrictMode>,
);
