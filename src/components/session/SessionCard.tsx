import React, { memo } from 'react';
import { Calendar, Clock, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/dateFormat';
import type { TelemetryFileInfo } from '../../types';
import { Card, CardHeader, CardBody, CardFooter } from '../common';
import styles from './SessionDashboard.module.scss'; // Keeping specific styles for content

interface SessionCardProps {
  file: TelemetryFileInfo;
  onClick: (file: TelemetryFileInfo) => void;
  isLoading?: boolean;
  dateFormat: string;
}

export const SessionCard = memo(function SessionCard({
  file,
  onClick,
  isLoading = false,
  dateFormat,
}: SessionCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      onClick={() => onClick(file)}
      disabled={isLoading}
      className={styles.sessionCardWrapper} // Use wrapper class if needed or inline styles
    >
      <CardHeader>
        <span className={styles.trackName}>
          {file.trackName || t('unknownTrack')}
        </span>
      </CardHeader>

      <CardBody>
        <div className={styles.infoRow}>
          <Database size={14} />
          <span>{file.carName || t('unknownCar')}</span>
        </div>
        <div className={styles.infoRow}>
          <Clock size={14} />
          <span>{file.sessionType || 'Session'}</span>
        </div>
      </CardBody>

      <CardFooter>
        <div className={styles.date}>
          <Calendar size={12} />
          {formatDate(file.modifiedTime, dateFormat)}
        </div>
        <div className={styles.arrow}>→</div>
      </CardFooter>
    </Card>
  );
});