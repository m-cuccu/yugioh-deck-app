import { useLanguage } from '../context/LanguageContext';
import { translateAttribute, translateCardType, translateRace } from '../lib/cardI18n';
import { ATTRIBUTE_FILTERS, MONSTER_TYPE_FILTERS, SPELL_SUBTYPE_FILTERS, TRAP_SUBTYPE_FILTERS } from '../lib/ygoApi';

export const EMPTY_CARD_FILTERS = { category: '', monsterType: '', attribute: '', level: '', subtype: '' };

export function hasActiveCardFilters(filters) {
  return Boolean(filters.category || filters.monsterType || filters.attribute || filters.level || filters.subtype);
}

const LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);

// Pannello di filtri per sfogliare le carte per tipo/sottotipo/attributo/livello, anche
// senza conoscerne il nome (usato sia nella ricerca del deck editor sia in "AAA Cercasi").
export default function CardFilters({ value, onChange }) {
  const { lang } = useLanguage();

  function update(patch) {
    onChange({ ...value, ...patch });
  }

  function setCategory(category) {
    onChange({ ...EMPTY_CARD_FILTERS, category });
  }

  return (
    <div className="card-filters">
      <select value={value.category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Tutti i tipi</option>
        <option value="monster">Mostro</option>
        <option value="spell">Magia</option>
        <option value="trap">Trappola</option>
      </select>

      {value.category === 'monster' && (
        <>
          <select value={value.monsterType} onChange={(e) => update({ monsterType: e.target.value })}>
            <option value="">Qualsiasi tipo mostro</option>
            {MONSTER_TYPE_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>{translateCardType(t.value, lang)}</option>
            ))}
          </select>

          <select value={value.attribute} onChange={(e) => update({ attribute: e.target.value })}>
            <option value="">Qualsiasi attributo</option>
            {ATTRIBUTE_FILTERS.map((a) => (
              <option key={a} value={a}>{translateAttribute(a, lang)}</option>
            ))}
          </select>

          <select value={value.level} onChange={(e) => update({ level: e.target.value })}>
            <option value="">Qualsiasi livello</option>
            {LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>Liv./Rank {lvl}</option>
            ))}
          </select>
        </>
      )}

      {(value.category === 'spell' || value.category === 'trap') && (
        <select value={value.subtype} onChange={(e) => update({ subtype: e.target.value })}>
          <option value="">Qualsiasi sottotipo</option>
          {(value.category === 'spell' ? SPELL_SUBTYPE_FILTERS : TRAP_SUBTYPE_FILTERS).map((s) => (
            <option key={s} value={s}>{translateRace(s, lang)}</option>
          ))}
        </select>
      )}

      {hasActiveCardFilters(value) && (
        <button type="button" className="btn-link" onClick={() => onChange(EMPTY_CARD_FILTERS)}>
          Azzera filtri
        </button>
      )}
    </div>
  );
}
