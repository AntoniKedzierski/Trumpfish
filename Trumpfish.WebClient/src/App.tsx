import { Route, Routes } from 'react-router-dom';
import { BiddingBrowserPage } from '@/features/biddingBrowser/pages/BiddingBrowserPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/tools/bidding-browser" element={<BiddingBrowserPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
