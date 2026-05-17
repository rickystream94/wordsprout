import type { DBEnrichment } from '../../services/db';
import Tooltip from '../common/Tooltip';
import styles from './EnrichmentPanel.module.css';

const DATETIME_FMT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function formatDateTime(iso: string): string {
  try { return DATETIME_FMT.format(new Date(iso)); } catch { return ''; }
}

export interface EnrichmentPanelProps {
  enrichment: DBEnrichment | undefined;
}

// ─── Read-only chip list ─────────────────────────────────────────────────────

function ReadOnlyList({ label, tooltip, values }: { label: string; tooltip: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className={styles.listField}>
      <Tooltip text={tooltip}>
        <span className={styles.listLabel}>{label}</span>
      </Tooltip>
      <div className={styles.chips}>
        {values.map((v) => (
          <span key={v} className={styles.chip}>{v}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function EnrichmentPanel({ enrichment }: EnrichmentPanelProps) {
  if (!enrichment) return null;

  const sentences = enrichment.exampleSentences ?? [];
  const synonyms = enrichment.synonyms ?? [];
  const antonyms = enrichment.antonyms ?? [];
  const collocations = enrichment.collocations ?? [];
  const register = enrichment.register ?? '';
  const falseFriendWarning = enrichment.falseFriendWarning ?? '';

  // Don't render at all if completely empty
  const hasAny =
    sentences.length > 0 ||
    synonyms.length > 0 ||
    antonyms.length > 0 ||
    collocations.length > 0 ||
    register ||
    falseFriendWarning;

  if (!hasAny) return null;

  return (
    <div className={styles.fields}>
      {/* Example sentences */}
      {sentences.length > 0 && (
        <div className={styles.field}>
          <Tooltip text="Sentences demonstrating natural usage of this word">
            <span className={styles.fieldLabel}>Example sentences</span>
          </Tooltip>
          {sentences.map((s, i) => (
            <p key={i} className={styles.sentence}>{s}</p>
          ))}
        </div>
      )}

      {/* Synonyms */}
      <ReadOnlyList
        label="Synonyms"
        tooltip="Words or phrases with similar meaning in the target language"
        values={synonyms}
      />

      {/* Antonyms */}
      <ReadOnlyList
        label="Antonyms"
        tooltip="Words or phrases with opposite meaning in the target language"
        values={antonyms}
      />

      {/* Collocations */}
      <ReadOnlyList
        label="Collocations"
        tooltip="Common word combinations that naturally go with this term in the target language"
        values={collocations}
      />

      {/* Register */}
      {register && (
        <div className={styles.field}>
          <Tooltip text="The formality level of this word (formal, informal, colloquial, neutral)">
            <span className={styles.fieldLabel}>Register</span>
          </Tooltip>
          <span className={styles.value}>{register}</span>
        </div>
      )}

      {/* False-friend warning */}
      {falseFriendWarning && (
        <div className={`${styles.field} ${styles.warning}`}>
          <Tooltip text="A warning about similar-looking words in other languages that have different meanings">
            <span className={styles.fieldLabel}>⚠ False-friend warning</span>
          </Tooltip>
          <span className={styles.value}>{falseFriendWarning}</span>
        </div>
      )}

      {/* Meta */}
      {enrichment.generatedAt && (
        <dl className={styles.meta}>
          <dt>AI enriched</dt>
          <dd>{formatDateTime(enrichment.generatedAt)}</dd>
          {enrichment.editedAt && (
            <>
              <dt>Manually edited</dt>
              <dd>{formatDateTime(enrichment.editedAt)}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
