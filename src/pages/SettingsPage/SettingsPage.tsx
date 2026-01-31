import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Folder,
  Globe,
  Calendar as CalendarIcon,
  RefreshCw,
} from 'lucide-react';
import { useSettingsStore, type AutoScanInterval } from '../../stores';
import { openFolderDialog, scanTelemetryFolder } from '../../services/tauri';
import type { DateFormat } from '../../utils/dateFormat';
import { Button, Panel } from '../../components/common';
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
    if (isDialogOpen) return;

    setDialogOpen(true);
    try {
      const folder = await openFolderDialog();
      if (folder) {
        await setTelemetryFolder(folder);
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
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{t('settings')}</h1>
        </div>
        <Button
          variant="ghost"
          icon={<X size={20} />}
          onClick={onClose}
          aria-label="Close settings"
        />
      </header>

      <div className={styles.content}>
        <div className={styles.settingsGrid}>
          <Panel
            title={t('telemetryFolder')}
            icon={<Folder size={16} />}
            className={styles.section}
          >
            <div className={styles.sectionBody}>
              <p className={styles.sectionDescription}>
                {t('telemetryFolderDescription')}
              </p>

              <div className={styles.folderSelector}>
                <div className={styles.folderPath}>
                  {telemetryFolder ? (
                    <span className={styles.path}>{telemetryFolder}</span>
                  ) : (
                    <span className={styles.noFolder}>
                      {t('noFolderSelected')}
                    </span>
                  )}
                </div>
                <div className={styles.folderActions}>
                  <Button
                    variant="primary"
                    onClick={handleSelectFolder}
                    disabled={isDialogOpen}
                  >
                    {isDialogOpen ? t('loading') : t('selectFolder')}
                  </Button>
                  {telemetryFolder && (
                    <Button variant="outline" onClick={handleClearFolder}>
                      {t('clear')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title={t('autoScan')}
            icon={<RefreshCw size={16} />}
            className={styles.section}
          >
            <div className={styles.sectionBody}>
              <p className={styles.sectionDescription}>
                {t('autoScanDescription')}
              </p>
              <AutoScanSelector />
            </div>
          </Panel>

          <Panel
            title={t('language')}
            icon={<Globe size={16} />}
            className={styles.section}
          >
            <div className={styles.sectionBody}>
              <LanguageSelector />
            </div>
          </Panel>

          <Panel
            title={t('dateFormat')}
            icon={<CalendarIcon size={16} />}
            className={styles.section}
          >
            <div className={styles.sectionBody}>
              <p className={styles.sectionDescription}>
                {t('dateFormatDescription')}
              </p>
              <DateFormatSelector />
            </div>
          </Panel>
        </div>
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
        <Button
          key={lang.code}
          variant={currentLang === lang.code ? 'primary' : 'secondary'}
          onClick={() => handleLanguageChange(lang.code)}
          className={styles.langButton}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  );
}

function DateFormatSelector() {
  const { t } = useTranslation();
  const { dateFormat, setDateFormat } = useSettingsStore();

  const formats: { code: DateFormat; label: string; example: string }[] = [
    {
      code: 'locale',
      label: t('dateFormatLocale'),
      example: new Date().toLocaleDateString(),
    },
    {
      code: 'iso',
      label: 'ISO',
      example: new Date().toISOString().split('T')[0],
    },
    { code: 'eu', label: 'EU', example: formatExampleDate('eu') },
    { code: 'us', label: 'US', example: formatExampleDate('us') },
  ];

  return (
    <div className={styles.dateFormatSelector}>
      {formats.map((fmt) => (
        <Button
          key={fmt.code}
          variant={dateFormat === fmt.code ? 'primary' : 'secondary'}
          onClick={() => setDateFormat(fmt.code)}
          className={styles.formatButton}
        >
          <div className={styles.formatButtonContent}>
            <span className={styles.formatLabel}>{fmt.label}</span>
            <span className={styles.formatExample}>{fmt.example}</span>
          </div>
        </Button>
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

function AutoScanSelector() {
  const { t } = useTranslation();
  const {
    autoScanEnabled,
    autoScanInterval,
    setAutoScanEnabled,
    setAutoScanInterval,
  } = useSettingsStore();

  const intervals: { value: AutoScanInterval; label: string }[] = [
    { value: 30, label: t('seconds', { count: 30 }) },
    { value: 60, label: t('minute', { count: 1 }) },
    { value: 120, label: t('minutes', { count: 2 }) },
    { value: 300, label: t('minutes', { count: 5 }) },
  ];

  const handleToggle = useCallback(() => {
    setAutoScanEnabled(!autoScanEnabled);
  }, [autoScanEnabled, setAutoScanEnabled]);

  const handleIntervalChange = useCallback(
    (interval: AutoScanInterval) => {
      setAutoScanInterval(interval);
    },
    [setAutoScanInterval]
  );

  return (
    <div className={styles.autoScanSettings}>
      <div className={styles.autoScanToggle}>
        <button
          type="button"
          className={`${styles.toggleSwitch} ${autoScanEnabled ? styles.active : ''}`}
          onClick={handleToggle}
          aria-pressed={autoScanEnabled}
          aria-label={t('autoScanEnabled')}
        />
        <span className={styles.toggleLabel}>{t('autoScanEnabled')}</span>
      </div>

      <div
        className={`${styles.intervalSelector} ${!autoScanEnabled ? styles.disabled : ''}`}
      >
        {intervals.map((interval) => (
          <Button
            key={interval.value}
            variant={
              autoScanInterval === interval.value ? 'primary' : 'secondary'
            }
            onClick={() => handleIntervalChange(interval.value)}
            disabled={!autoScanEnabled}
            className={styles.intervalButton}
            size="small"
          >
            {interval.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default SettingsPage;
