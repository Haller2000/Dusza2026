import React from 'react';
import { AVATAR_OPTIONS } from './avatarOptions';

interface UserAvatarProps {
  avatarId: number;
  size?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ avatarId, size = 48 }) => {
  const avatar = AVATAR_OPTIONS.find(option => option.id === avatarId) ?? AVATAR_OPTIONS[0];

  return (
    <svg
      role="img"
      aria-label={`${avatar.name} avatar`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="31" fill={avatar.background} />
      <circle cx="32" cy="32" r="28" fill="none" stroke={avatar.foreground} strokeOpacity="0.22" strokeWidth="2" />
      <text x="32" y="34" dominantBaseline="central" fontSize="34" textAnchor="middle">
        {avatar.symbol}
      </text>
    </svg>
  );
};

export default UserAvatar;
