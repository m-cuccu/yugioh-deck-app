import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const { unreadCount } = useNotifications();

  return (
    <nav className="navbar">
      <div className="navbar-brand">🎴 Deck Builder</div>
      <div className="navbar-links">
        <NavLink to="/" end>
          I miei deck
        </NavLink>
        <NavLink to="/suggerimenti">
          Suggerimenti
          {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
        </NavLink>
        <NavLink to="/amici">Amici</NavLink>
      </div>
      <div className="navbar-user">
        <div className="lang-switch" title="Lingua dei nomi delle carte">
          <button
            type="button"
            className={lang === 'it' ? 'active' : ''}
            onClick={() => setLang('it')}
          >
            IT
          </button>
          <button
            type="button"
            className={lang === 'en' ? 'active' : ''}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
        <span>{profile?.username}</span>
        <button className="btn-link" onClick={signOut} type="button">
          Esci
        </button>
      </div>
    </nav>
  );
}
