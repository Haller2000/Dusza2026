import React, { useState, type InputHTMLAttributes } from 'react';
import styles from './PasswordInput.module.css';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const PasswordInput: React.FC<PasswordInputProps> = props => {
  const [visible, setVisible] = useState<boolean>(false);

  return (
    <div className={styles.passwordInput}>
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className={styles.visibilityButton}
        onClick={() => setVisible(current => !current)}
        aria-label={visible ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
        aria-pressed={visible}
        disabled={props.disabled}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.9 5.2A10.7 10.7 0 0112 5c5.5 0 9 7 9 7a14.6 14.6 0 01-3.1 3.8M6.2 6.2C3.9 7.8 3 12 3 12s3.5 7 9 7a9.9 9.9 0 004.1-.9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default PasswordInput;
