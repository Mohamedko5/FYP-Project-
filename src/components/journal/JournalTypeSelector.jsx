export default function JournalTypeSelector({ journalType, onChange, t }) {
  return (
    <div className="journal-type-selector" role="group" aria-label={t('journal.journalType')}>
      <button
        type="button"
        className={`journal-type-selector__button ${journalType === 'cash' ? 'is-active' : ''}`}
        onClick={() => onChange('cash')}
      >
        {t('journal.cashJournal')}
      </button>
      <button
        type="button"
        className={`journal-type-selector__button ${journalType === 'commodity' ? 'is-active' : ''}`}
        onClick={() => onChange('commodity')}
      >
        {t('journal.commodityJournal')}
      </button>
    </div>
  );
}
