import React from 'react';
import { Calendar, Clock, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/dateFormat';
import type { TelemetryFileInfo } from '../../types';
import styles from './SessionDashboard.module.scss'; // Temporarily sharing styles or I should duplicate/move

interface SessionCardProps {
  file: TelemetryFileInfo;
  onClick: (file: TelemetryFileInfo) => void;
  isLoading?: boolean;
  dateFormat: string;
}

export function SessionCard({
  file,
  onClick,
  isLoading = false,
  dateFormat,
}: SessionCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`${styles.sessionCard} ${isLoading ? styles.disabled : ''}`}
      onClick={() => !isLoading && onClick(file)}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cardHeader}>
        <span className={styles.trackName}>
          {file.trackName || t('unknownTrack')}
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.infoRow}>
          <Database size={14} />
          <span>{file.carName || t('unknownCar')}</span>
        </div>
        <div className={styles.infoRow}>
          <Clock size={14} />
          <span>{file.sessionType || 'Session'}</span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.date}>
          <Calendar size={12} />
          {formatDate(file.modifiedTime, dateFormat)}
        </div>
        <div className={styles.arrow}>→</div>
      </div>
    </div>
  );
}
