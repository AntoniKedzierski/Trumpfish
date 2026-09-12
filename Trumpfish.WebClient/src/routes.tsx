import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from '@/components/AppLayout';
import { BiddingBrowserPage } from '@/features/biddingBrowser/pages/BiddingBrowserPage';
import { ManageSystemsPage } from '@/features/biddingBrowser/pages/ManageSystemsPage';
import { DuoPracticePage } from '@/features/duoPractice/pages/DuoPracticePage';
import { duoRoute } from '@/features/duoPractice/route';
import { PracticePage } from '@/features/practice/pages/PracticePage';
import { SimulationPage } from '@/features/simulation/pages/SimulationPage';
import { AccountPage } from '@/pages/AccountPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Declared as data rather than as `<Routes>` elements so the application runs on a data router, which is what lets a page
 * block a navigation it is not ready for - the Bidding Browser uses it to hold on to unsaved edits, and the two-player table
 * to warn that leaving ends the session.
 */
/*
 * Every signed in page hangs off one layout route. That layout owns the top bar, and therefore the friends dropdown and the
 * table invitations, which have to be reachable from wherever the user happens to be.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/account', element: <AccountPage /> },
      { path: '/tools/bidding-browser', element: <BiddingBrowserPage /> },
      { path: '/tools/bidding-browser/systems', element: <ManageSystemsPage /> },
      { path: '/tools/simulation', element: <SimulationPage /> },
      { path: '/tools/practice', element: <PracticePage /> },
      { path: duoRoute, element: <DuoPracticePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
