import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StatusPage } from './pages/StatusPage';
import { ConfigPage } from './pages/ConfigPage';
import { AboutPage } from './pages/AboutPage';
import { LibrariesPage } from './pages/LibrariesPage';
import { RecommendedPage } from './pages/RecommendedPage';
import { MislabeledPage } from './pages/MislabeledPage';
import { RssPage } from './pages/RssPage';
import { ComingSoon } from './pages/ComingSoon';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StatusPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="libraries" element={<LibrariesPage />} />
        <Route path="recommended" element={<RecommendedPage />} />
        <Route path="mislabeled" element={<MislabeledPage />} />
        <Route path="rss" element={<RssPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<ComingSoon title="Not found" />} />
      </Route>
    </Routes>
  );
}
