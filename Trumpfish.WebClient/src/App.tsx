import { Route, Routes } from 'react-router-dom';
import { BiddingBrowserPage } from '@/features/biddingBrowser/pages/BiddingBrowserPage';
import { SimulationPage } from '@/features/simulation/pages/SimulationPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/tools/bidding-browser" element={<BiddingBrowserPage />} />
      <Route path="/tools/simulation" element={<SimulationPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
