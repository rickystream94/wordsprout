import { useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { pullFromServer } from '../services/sync';
import { generateExportPackage, triggerDownload, validateImportFile } from '../services/export';
import type { ExportPackage } from '../services/export';
import { importData } from '../services/api';
import type { DBPhrasebook, DBEntry, DBEnrichment } from '../services/db';
import { clearUserContent, bulkRestoreFromExport } from '../services/db';
import { rebuildIndex } from '../services/search';
import styles from './Settings.module.css';

type ImportStatus = 'idle' | 'validating' | 'confirming' | 'importing' | 'done' | 'error';

export default function Settings() {
  const { userId } = useAuth();

  // ── Export state ──────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Import state ──────────────────────────────────────────────────────────
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ phrasebooks: number; entries: number } | null>(null);
  const [pendingPkg, setPendingPkg] = useState<ExportPackage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export handler ────────────────────────────────────────────────────────
  async function handleExport() {
    if (!userId) return;
    setIsExporting(true);
    setExportStatus(null);
    try {
      if (navigator.onLine) {
        await Promise.race([
          pullFromServer().catch(() => {}),
          new Promise<void>((res) => setTimeout(res, 5000)),
        ]);
      }
      const pkg = await generateExportPackage(userId);
      triggerDownload(pkg);
      const ua = navigator.userAgent;
      const hint =
        /iphone|ipad|ipod/i.test(ua)
          ? ' Check your Files app (Downloads folder).'
          : /android/i.test(ua)
            ? ' Check your Downloads folder.'
            : '';
      setExportStatus({ type: 'success', message: `Your data has been exported successfully.${hint}` });
    } catch {
      setExportStatus({ type: 'error', message: 'Export failed. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  }

  // ── Import: file selection ────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset file input so the same file can be re-selected after an error
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setImportStatus('validating');
    setImportError(null);
    setPendingPkg(null);

    const result = await validateImportFile(file);
    if (!result.valid) {
      setImportStatus('error');
      setImportError(result.error);
      return;
    }
    setImportSummary(result.summary);
    setPendingPkg(result.pkg);
    setImportStatus('confirming');
  }

  // ── Import: confirmed ─────────────────────────────────────────────────────
  async function handleConfirmImport() {
    if (!pendingPkg || !userId) return;
    setImportStatus('importing');
    setImportError(null);
    try {
      const result = await importData(pendingPkg);
      // Only clear and restore after the server confirms success
      await clearUserContent(userId);
      await bulkRestoreFromExport(
        result.phrasebooks as DBPhrasebook[],
        result.entries as DBEntry[],
        result.enrichments as DBEnrichment[],
      );
      await rebuildIndex();
      setImportSummary({ phrasebooks: result.phrasebooksImported, entries: result.entriesImported });
      setImportStatus('done');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Import failed. Please try again.';
      setImportStatus('error');
      setImportError(message);
    }
  }

  function handleCancelImport() {
    setPendingPkg(null);
    setImportSummary(null);
    setImportStatus('idle');
    setImportError(null);
  }

  return (
    <div className={styles.page}>
      <h1>Settings</h1>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Account Data</h2>
        <p className={styles.description}>
          Export a backup of all your phrasebooks, entries, and enrichments, or restore
          from a previously exported backup file.
        </p>

        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleExport}
            disabled={isExporting || importStatus === 'importing'}
          >
            {isExporting ? 'Exporting…' : 'Export my data'}
          </button>

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isExporting || importStatus === 'importing' || importStatus === 'validating'}
          >
            Import data
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {exportStatus && (
          <p className={`${styles.statusMessage} ${styles[exportStatus.type]}`}>
            {exportStatus.message}
          </p>
        )}

        {importStatus === 'done' && importSummary && (
          <p className={`${styles.statusMessage} ${styles.success}`}>
            Imported {importSummary.phrasebooks} phrasebook{importSummary.phrasebooks !== 1 ? 's' : ''} and{' '}
            {importSummary.entries} {importSummary.entries !== 1 ? 'entries' : 'entry'}.
          </p>
        )}

        {importStatus === 'error' && importError && (
          <p className={`${styles.statusMessage} ${styles.error}`}>{importError}</p>
        )}
      </section>

      {/* Import confirmation modal */}
      {(importStatus === 'confirming' || importStatus === 'importing') && importSummary && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
          <div className={styles.confirmDialog}>
            <h2 id="import-dialog-title">Replace your current data?</h2>
            <p>
              This will replace <strong>all</strong> your current data with{' '}
              <strong>{importSummary.phrasebooks} phrasebook{importSummary.phrasebooks !== 1 ? 's' : ''}</strong> and{' '}
              <strong>{importSummary.entries} {importSummary.entries !== 1 ? 'entries' : 'entry'}</strong> from the backup file.
              This cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCancelImport} disabled={importStatus === 'importing'}>
                Cancel
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleConfirmImport}
                disabled={importStatus === 'importing'}
                aria-busy={importStatus === 'importing'}
              >
                {importStatus === 'importing'
                  ? <><span className={styles.spinner} aria-hidden="true" />{' '}Importing…</>
                  : 'Import and replace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
