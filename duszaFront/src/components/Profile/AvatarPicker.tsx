import React from 'react';
import UserAvatar from './UserAvatar';
import { AVATAR_OPTIONS } from './avatarOptions';
import styles from './AvatarPicker.module.css';

interface AvatarPickerProps {
  selectedAvatarId: number;
  onSelect: (avatarId: number) => void;
  disabled?: boolean;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ selectedAvatarId, onSelect, disabled = false }) => (
  <fieldset className={styles.avatarFieldset} disabled={disabled}>
    <legend className={styles.legend}>Válassz avatárt</legend>
    <div className={styles.avatarGrid}>
      {AVATAR_OPTIONS.map(avatar => (
        <button
          key={avatar.id}
          type="button"
          aria-label={avatar.name}
          aria-pressed={selectedAvatarId === avatar.id}
          title={avatar.name}
          onClick={() => onSelect(avatar.id)}
          className={`${styles.avatarOption} ${selectedAvatarId === avatar.id ? styles.selected : ''}`}
        >
          <UserAvatar avatarId={avatar.id} size={48} />
        </button>
      ))}
    </div>
  </fieldset>
);

export default AvatarPicker;
