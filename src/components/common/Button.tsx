import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  className = '',
  ...props
}: ButtonProps) {
  const isIconOnly = !children && !!icon;

  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    isIconOnly ? styles.iconOnly : '',
    className,
  ].join(' ');

  return (
    <button className={classNames} {...props}>
      {icon && iconPosition === 'left' && (
        <span className={styles.icon}>{icon}</span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className={styles.icon}>{icon}</span>
      )}
    </button>
  );
}
