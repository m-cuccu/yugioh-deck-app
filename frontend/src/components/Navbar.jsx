import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { profile, signOut } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-brand">🎴 Deck Builder</div>
      <div className="navbar-links">
        <NavLink to="/" end>
          I miei deck
        </NavLink>
        <NavLink to="/amici">Amici</NavLink>
      </div>
      <div className="navbar-user">
        <span>{profile?.username}</span>
        <button className="btn-link" onClick={signOut} type="button">
          Esci
        </button>
      </div>
    </nav>
  );
}
