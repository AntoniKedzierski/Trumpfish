import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { keepWheelOffNumberInputs } from './numberInputWheel';
import { routes } from './routes';
import './styles/theme.css';
import './index.css';

keepWheelOffNumberInputs();

const router = createBrowserRouter(routes);

// The auth provider sits above the router: it uses no routing itself, and everything the routes render reads it as context.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
