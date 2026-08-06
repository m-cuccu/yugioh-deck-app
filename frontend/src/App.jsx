import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DeckListPage from './pages/DeckListPage';
import DeckEditorPage from './pages/DeckEditorPage';
import FriendsPage from './pages/FriendsPage';
import SuggestionsPage from './pages/SuggestionsPage';

function App() {
  const { user, loading } = useAuth();

  if (loading) return <p className="page-message">Caricamento...</p>;

  if (!user) return <LoginPage />;

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DeckListPage />} />
          <Route path="/deck/:deckId" element={<DeckEditorPage />} />
          <Route path="/suggerimenti" element={<SuggestionsPage />} />
          <Route path="/amici" element={<FriendsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App
