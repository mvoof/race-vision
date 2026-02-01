import React, { ReactNode } from 'react';
import styles from './Card.module.scss';

export interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function Card({ children, className = '', onClick, disabled = false }: CardProps) {
  return (
    <div
      className={`${styles.card} ${disabled ? styles.disabled : ''} ${className}`}
      onClick={!disabled ? onClick : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// Sub-components for structured layout
export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.header} ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.body} ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.footer} ${className}`}>{children}</div>;
}
