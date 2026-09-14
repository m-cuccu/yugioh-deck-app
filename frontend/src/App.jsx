import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DeckListPage from './pages/DeckListPage';
import DeckEditorPage from './pages/DeckEditorPage';
import FriendsPage from './pages/FriendsPage';
import SuggestionsPage from './pages/SuggestionsPage';
import BanlistPage from './pages/BanlistPage';
import WantedPage from './pages/WantedPage';
import SpoilerPage from './pages/SpoilerPage';
import SpoilerSetPage from './pages/SpoilerSetPage';
import CollectionPage from './pages/CollectionPage';
import CommunityDecksPage from './pages/CommunityDecksPage';
import DuelPage from './pages/DuelPage';

function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isFullscreenPage = location.pathname === '/duello';

  if (loading) return <p className="page-message">Caricamento...</p>;

  if (!user) return <LoginPage />;

  return (
    <div className="app-shell">
      {!isFullscreenPage && <Navbar />}
      <main className={`app-main ${isFullscreenPage ? 'app-main-fullscreen' : ''}`}>
        <Routes>
          <Route path="/" element={<DeckListPage />} />
          <Route path="/deck/:deckId" element={<DeckEditorPage />} />
          <Route path="/suggerimenti" element={<SuggestionsPage />} />
          <Route path="/cercasi" element={<WantedPage />} />
          <Route path="/banlist" element={<BanlistPage />} />
          <Route path="/amici" element={<FriendsPage />} />
          <Route path="/spoiler" element={<SpoilerPage />} />
          <Route path="/spoiler/:setName" element={<SpoilerSetPage />} />
          <Route path="/collezione" element={<CollectionPage />} />
          <Route path="/liste-community" element={<CommunityDecksPage />} />
          <Route path="/duello" element={<DuelPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App
