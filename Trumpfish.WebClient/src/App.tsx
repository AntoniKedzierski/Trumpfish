import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { BiddingBrowserPage } from '@/features/biddingBrowser/pages/BiddingBrowserPage';
import { ManageSystemsPage } from '@/features/biddingBrowser/pages/ManageSystemsPage';
import { SimulationPage } from '@/features/simulation/pages/SimulationPage';
import { AccountPage } from '@/pages/AccountPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
      <Route path="/tools/bidding-browser" element={<RequireAuth><BiddingBrowserPage /></RequireAuth>} />
      <Route path="/tools/bidding-browser/systems" element={<RequireAuth><ManageSystemsPage /></RequireAuth>} />
      <Route path="/tools/simulation" element={<RequireAuth><SimulationPage /></RequireAuth>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
