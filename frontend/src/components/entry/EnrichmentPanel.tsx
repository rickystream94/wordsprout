import { useState } from 'react';
import { enrichApi } from '../../services/api';
import { getEnrichment, upsertEnrichment, type DBEnrichment } from '../../services/db';
import styles from './EnrichmentPanel.module.css';

interface EnrichmentPanelProps {
  entryId: string;
  enrichment: DBEnrichment | undefined;
  isOnline: boolean;
  onEnriched: (enrichment: DBEnrichment) => void;
}

// Editable multi-value list field
function EditableList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function addItem() {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft('');
  }

  function removeItem(item: string) {
    onChange(values.filter((v) => v !== item));
  }

  return (
    <div className={styles.listField}>
      <span className={styles.listLabel}>{label}</span>
      <div className={styles.chips}>
        {values.map((v) => (
          <span key={v} className={styles.chip}>
            {v}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => removeItem(v)}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className={styles.listInput}>
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
          onBlur={addItem}
          placeholder={`Add ${label.toLowerCase()}…`}
        />
      </div>
    </div>
  );
}

export default function EnrichmentPanel({
  entryId,
  enrichment: initialEnrichment,
  isOnline,
  onEnriched,
}: EnrichmentPanelProps) {
  const [enrichment, setEnrichment] = useState<DBEnrichment | undefined>(initialEnrichment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleEnrich() {
    setLoading(true);
    setError(null);
    try {
      const result = await enrichApi.enrich(entryId);
      await upsertEnrichment(result);
      setEnrichment(result);
      onEnriched(result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 429) {
        setError('Daily AI quota reached. Try again tomorrow.');
      } else if (e.statusCode === 503) {
        setError('AI service is temporarily unavailable. Please try again shortly.');
      } else {
        setError(e.message ?? 'Enrichment failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function patchField(patch: Partial<DBEnrichment>) {
    if (!enrichment) return;
    const updated = { ...enrichment, ...patch, editedAt: new Date().toISOString() };
    setSaving(true);
    try {
      const result = await enrichApi.patchEnrichment(entryId, patch);
      await upsertEnrichment(result);
      setEnrichment(result);
    } catch {
      // Persist locally even if the network call fails
      await upsertEnrichment(updated);
      setEnrichment(updated);
    } finally {
      setSaving(false);
    }
  }

  if (!enrichment) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyState}>
          <p className={styles.emptyHint}>No enrichment yet. Click "Enrich" to generate AI content.</p>
          <button
            type="button"
            className={styles.enrichBtn}
            onClick={handleEnrich}
            disabled={!isOnline || loading}
            aria-busy={loading}
          >
            {loading ? 'Enriching…' : !isOnline ? 'Offline — connect to enrich' : 'Enrich'}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h4 className={styles.heading}>AI Enrichment</h4>
        <div className={styles.headerActions}>
          {saving && <span className={styles.saving}>Saving…</span>}
          <button
            type="button"
            className={styles.reEnrichBtn}
            onClick={handleEnrich}
            disabled={!isOnline || loading}
            aria-busy={loading}
            title="Re-generate enrichment"
          >
            {loading ? '⟳ Regenerating…' : '⟳ Re-enrich'}
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {enrichment.register && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Register</span>
          <input
            className={styles.input}
            defaultValue={enrichment.register}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== enrichment.register) patchField({ register: v || undefined });
            }}
          />
        </div>
      )}

      {enrichment.falseFriendWarning && (
        <div className={`${styles.field} ${styles.warning}`}>
          <span className={styles.fieldLabel}>⚠ False-friend warning</span>
          <input
            className={styles.input}
            defaultValue={enrichment.falseFriendWarning}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== enrichment.falseFriendWarning)
                patchField({ falseFriendWarning: v || undefined });
            }}
          />
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Example sentences</span>
        {enrichment.exampleSentences.map((s, i) => (
          <p key={i} className={styles.sentence}>{s}</p>
        ))}
      </div>

      <EditableList
        label="Synonyms"
        values={enrichment.synonyms}
        onChange={(synonyms) => patchField({ synonyms })}
      />
      <EditableList
        label="Antonyms"
        values={enrichment.antonyms}
        onChange={(antonyms) => patchField({ antonyms })}
      />
      <EditableList
        label="Collocations"
        values={enrichment.collocations}
        onChange={(collocations) => patchField({ collocations })}
      />

      <p className={styles.meta}>
        Generated {new Date(enrichment.generatedAt).toLocaleDateString()}
        {enrichment.editedAt && ` · Edited ${new Date(enrichment.editedAt).toLocaleDateString()}`}
      </p>
    </div>
  );
}
