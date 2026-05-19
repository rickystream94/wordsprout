import type { DBEntry, DBEnrichment } from '../../services/db';
import styles from './RehearseCard.module.css';

export interface RehearseCardProps {
  entry: DBEntry;
  enrichment: DBEnrichment | undefined;
  targetLanguageName?: string;
  sourceLanguageName?: string;
}

export default function RehearseCard({ entry, enrichment }: RehearseCardProps) {
  const { sourceText, targetText, partOfSpeech, tags, notes } = entry;

  return (
    <article className={styles.card} aria-label={sourceText}>
      <div className={styles.primary}>
        <p className={styles.sourceText}>{sourceText}</p>
        {targetText && <p className={styles.targetText}>{targetText}</p>}
      </div>

      {(partOfSpeech || (tags && tags.length > 0)) && (
        <div className={styles.meta}>
          {partOfSpeech && <span className={styles.pos}>{partOfSpeech}</span>}
          {tags && tags.map((tag) => (
            <span key={tag} className={styles.tag}>#{tag}</span>
          ))}
        </div>
      )}

      {notes && (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Notes</h3>
          <p>{notes}</p>
        </section>
      )}

      {enrichment && (
        <>
          {enrichment.exampleSentences.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Example sentences</h3>
              <ul className={styles.list}>
                {enrichment.exampleSentences.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {enrichment.synonyms.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Synonyms</h3>
              <ul className={styles.list}>
                {enrichment.synonyms.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {enrichment.antonyms.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Antonyms</h3>
              <ul className={styles.list}>
                {enrichment.antonyms.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {enrichment.collocations.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Collocations</h3>
              <ul className={styles.list}>
                {enrichment.collocations.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {enrichment.register && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Register</h3>
              <p>{enrichment.register}</p>
            </section>
          )}

          {enrichment.falseFriendWarning && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>⚠ False friend</h3>
              <p>{enrichment.falseFriendWarning}</p>
            </section>
          )}
        </>
      )}
    </article>
  );
}
