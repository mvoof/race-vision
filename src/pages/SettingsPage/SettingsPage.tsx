import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores';
import { openFolderDialog, scanTelemetryFolder } from '../../services/tauri';
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
  } = useSettingsStore();

  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const isDialogOpenRef = useRef(false);

  const handleSelectFolder = useCallback(async () => {
    // Prevent multiple dialogs
    if (isDialogOpenRef.current || isSelectingFolder) {
      return;
    }

    isDialogOpenRef.current = true;
    setIsSelectingFolder(true);

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
      isDialogOpenRef.current = false;
      setIsSelectingFolder(false);
    }
  }, [
    isSelectingFolder,
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
                disabled={isSelectingFolder}
              >
                {isSelectingFolder ? t('loading') : t('selectFolder')}
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

export default SettingsPage;
