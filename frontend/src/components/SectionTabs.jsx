import { useLocation, useNavigate } from 'react-router-dom';

// Barra di tab che naviga tra rotte reali (non solo stato locale), usata per raggruppare
// pagine "figlie" (es. Liste Community sotto I miei deck, Cercasi sotto Collezione) senza
// rimuoverle dalle rotte dirette: i link condivisi verso quelle rotte restano validi.
export default function SectionTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="suggest-kind-tabs section-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.to}
          type="button"
          className={pathname === tab.to ? 'active' : ''}
          onClick={() => navigate(tab.to)}
        >
          {tab.label}
          {tab.badge}
        </button>
      ))}
    </div>
  );
}
