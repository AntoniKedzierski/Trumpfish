import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { BiddingBrowserPage } from '@/features/biddingBrowser/pages/BiddingBrowserPage';
import { ManageSystemsPage } from '@/features/biddingBrowser/pages/ManageSystemsPage';
import { PracticePage } from '@/features/practice/pages/PracticePage';
import { SimulationPage } from '@/features/simulation/pages/SimulationPage';
import { AccountPage } from '@/pages/AccountPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Declared as data rather than as `<Routes>` elements so the application runs on a data router, which is what lets a page
 * block a navigation it is not ready for - the Bidding Browser uses it to hold on to unsaved edits.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <RequireAuth><HomePage /></RequireAuth> },
  { path: '/account', element: <RequireAuth><AccountPage /></RequireAuth> },
  { path: '/tools/bidding-browser', element: <RequireAuth><BiddingBrowserPage /></RequireAuth> },
  { path: '/tools/bidding-browser/systems', element: <RequireAuth><ManageSystemsPage /></RequireAuth> },
  { path: '/tools/simulation', element: <RequireAuth><SimulationPage /></RequireAuth> },
  { path: '/tools/practice', element: <RequireAuth><PracticePage /></RequireAuth> },
  { path: '*', element: <NotFoundPage /> },
];
