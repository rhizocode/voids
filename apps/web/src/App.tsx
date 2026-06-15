import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StatusPage } from './pages/StatusPage';
import { ConfigPage } from './pages/ConfigPage';
import { AboutPage } from './pages/AboutPage';
import { ComingSoon } from './pages/ComingSoon';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StatusPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="libraries" element={<ComingSoon title="Libraries" />} />
        <Route path="recommended" element={<ComingSoon title="Recommended" />} />
        <Route path="rss" element={<ComingSoon title="RSS" />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<ComingSoon title="Not found" />} />
      </Route>
    </Routes>
  );
}
