import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores';
import { openFolderDialog, scanTelemetryFolder } from '../../services/tauri';
import type { DateFormat } from '../../utils/dateFormat';
import styles from './SettingsPage.module.scss';

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const { t } = useTranslation();
  const {
    telemetryFolder,
    setTelemetryFolder,
    setTelemetryFiles,
    setScanning,
    setScanError,
    isDialogOpen,
    setDialogOpen,
  } = useSettingsStore();

  const handleSelectFolder = useCallback(async () => {
    // Prevent multiple dialogs
    if (isDialogOpen) {
      return;
    }

    setDialogOpen(true);

    try {
      const folder = await openFolderDialog();
      if (folder) {
        await setTelemetryFolder(folder);

        // Scan the folder for telemetry files
        setScanning(true);
        setScanError(null);
        try {
          const files = await scanTelemetryFolder(folder);
          setTelemetryFiles(files);
        } catch (err) {
          setScanError(err instanceof Error ? err.message : String(err));
          setTelemetryFiles([]);
        } finally {
          setScanning(false);
        }
      }
    } finally {
      setDialogOpen(false);
    }
  }, [
    isDialogOpen,
    setDialogOpen,
    setTelemetryFolder,
    setTelemetryFiles,
    setScanning,
    setScanError,
  ]);

  const handleClearFolder = useCallback(async () => {
    await setTelemetryFolder(null);
    setTelemetryFiles([]);
  }, [setTelemetryFolder, setTelemetryFiles]);

  return (
    <div className={styles.settingsPage}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('settings')}</h1>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" className={styles.icon}>
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('telemetryFolder')}</h2>
          <p className={styles.sectionDescription}>
            {t('telemetryFolderDescription')}
          </p>

          <div className={styles.folderSelector}>
            <div className={styles.folderPath}>
              {telemetryFolder ? (
                <span className={styles.path}>{telemetryFolder}</span>
              ) : (
                <span className={styles.noFolder}>{t('noFolderSelected')}</span>
              )}
            </div>
            <div className={styles.folderActions}>
              <button
                className={styles.selectButton}
                onClick={handleSelectFolder}
                disabled={isDialogOpen}
              >
                {isDialogOpen ? t('loading') : t('selectFolder')}
              </button>
              {telemetryFolder && (
                <button
                  className={styles.clearButton}
                  onClick={handleClearFolder}
                >
                  {t('clear')}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('language')}</h2>
          <LanguageSelector />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('dateFormat')}</h2>
          <p className={styles.sectionDescription}>
            {t('dateFormatDescription')}
          </p>
          <DateFormatSelector />
        </section>
      </div>
    </div>
  );
}

function LanguageSelector() {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      i18n.changeLanguage(lang);
      setCurrentLang(lang);
    },
    [i18n]
  );

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
  ];

  return (
    <div className={styles.languageSelector}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          className={`${styles.langButton} ${currentLang === lang.code ? styles.active : ''}`}
          onClick={() => handleLanguageChange(lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}

function DateFormatSelector() {
  const { t } = useTranslation();
  const { dateFormat, setDateFormat } = useSettingsStore();

  const formats: { code: DateFormat; label: string; example: string }[] = [
    { code: 'locale', label: t('dateFormatLocale'), example: new Date().toLocaleDateString() },
    { code: 'iso', label: 'ISO', example: new Date().toISOString().split('T')[0] },
    { code: 'eu', label: 'EU', example: formatExampleDate('eu') },
    { code: 'us', label: 'US', example: formatExampleDate('us') },
  ];

  return (
    <div className={styles.dateFormatSelector}>
      {formats.map((fmt) => (
        <button
          key={fmt.code}
          className={`${styles.formatButton} ${dateFormat === fmt.code ? styles.active : ''}`}
          onClick={() => setDateFormat(fmt.code)}
        >
          <span className={styles.formatLabel}>{fmt.label}</span>
          <span className={styles.formatExample}>{fmt.example}</span>
        </button>
      ))}
    </div>
  );
}

function formatExampleDate(format: 'eu' | 'us'): string {
  const d = new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  if (format === 'eu') return `${day}.${month}.${year}`;
  return `${month}/${day}/${year}`;
}

export default SettingsPage;
