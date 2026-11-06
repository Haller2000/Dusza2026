import React, { useEffect, useState, type FormEvent } from 'react';
import axios, { AxiosError } from 'axios';
import PasswordInput from '../Auth/PasswordInput';
import AvatarPicker from './AvatarPicker';
import styles from './ProfilePage.module.css';

interface ProfileData {
  username: string;
  avatar_id: number;
  date_joined: string;
}

interface ApiError {
  error?: string;
}

interface ProfilePageProps {
  onBack: () => void;
  onAvatarChange: (avatarId: number) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onBack, onAvatarChange }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<number>(1);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(() => Boolean(localStorage.getItem('authToken')));
  const [savingAvatar, setSavingAvatar] = useState<boolean>(false);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>(() =>
    localStorage.getItem('authToken') ? '' : 'A profil betöltéséhez be kell jelentkezni.'
  );
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    axios.get<ProfileData>('http://127.0.0.1:8000/api/profile/', {
      headers: { Authorization: `Token ${token}` },
    }).then(response => {
      setProfile(response.data);
      setSelectedAvatarId(response.data.avatar_id);
      localStorage.setItem('username', response.data.username);
      localStorage.setItem('avatarId', String(response.data.avatar_id));
    }).catch((err: AxiosError<ApiError>) => {
      setErrorMessage(err.response?.data?.error || 'Nem sikerült betölteni a profilt.');
    }).finally(() => {
      setLoadingProfile(false);
    });
  }, []);

  const handleSaveAvatar = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setErrorMessage('A profil módosításához be kell jelentkezni.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setSavingAvatar(true);
    try {
      const response = await axios.patch<ProfileData>(
        'http://127.0.0.1:8000/api/profile/',
        { avatar_id: selectedAvatarId },
        { headers: { Authorization: `Token ${token}` } }
      );
      setProfile(response.data);
      localStorage.setItem('avatarId', String(response.data.avatar_id));
      onAvatarChange(response.data.avatar_id);
      setSuccessMessage('Az avatár megváltozott.');
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      setErrorMessage(error.response?.data?.error || 'Nem sikerült elmenteni az avatárt.');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const token = localStorage.getItem('authToken');
    if (!token) {
      setErrorMessage('A jelszó módosításához be kell jelentkezni.');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await axios.post<{ message: string }>(
        'http://127.0.0.1:8000/api/change-password/',
        {
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
        { headers: { Authorization: `Token ${token}` } }
      );
      setSuccessMessage(response.data.message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      setErrorMessage(error.response?.data?.error || 'Nem sikerült megváltoztatni a jelszót.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <main className={styles.profilePage}>
      <button type="button" onClick={onBack} className={styles.backButton}>
        Vissza a főoldalra
      </button>
      <h1>Profilom</h1>
      <p className={styles.description}>A fiókadataid és biztonsági beállításaid.</p>

      {errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
      {successMessage && <div role="status" className={styles.successMessage}>{successMessage}</div>}
      {loadingProfile ? (
        <p>Profil betöltése...</p>
      ) : profile ? (
        <>
          <section className={styles.profileCard}>
            <h2>Fiókadatok</h2>
            <dl className={styles.accountDetails}>
              <div>
                <dt>Felhasználónév</dt>
                <dd>{profile.username}</dd>
              </div>
              <div>
                <dt>Regisztráció dátuma</dt>
                <dd>{new Date(profile.date_joined).toLocaleDateString('hu-HU')}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.profileCard}>
            <h2>Profil ikon</h2>
            <AvatarPicker
              selectedAvatarId={selectedAvatarId}
              onSelect={setSelectedAvatarId}
              disabled={savingAvatar}
            />
            <button
              type="button"
              onClick={handleSaveAvatar}
              disabled={savingAvatar || selectedAvatarId === profile.avatar_id}
              className={styles.primaryButton}
            >
              {savingAvatar ? 'Mentés...' : 'Ikon mentése'}
            </button>
          </section>

          <section className={styles.profileCard}>
            <h2>Jelszó megváltoztatása</h2>
            <form onSubmit={handleChangePassword} className={styles.passwordForm}>
              <label>
                Jelenlegi jelszó
                <PasswordInput
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={event => setOldPassword(event.target.value)}
                  required
                  disabled={changingPassword}
                />
              </label>
              <label>
                Új jelszó
                <PasswordInput
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  required
                  disabled={changingPassword}
                />
              </label>
              <label>
                Új jelszó megerősítése
                <PasswordInput
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  required
                  disabled={changingPassword}
                />
              </label>
              <button type="submit" disabled={changingPassword} className={styles.primaryButton}>
                {changingPassword ? 'Mentés...' : 'Jelszó mentése'}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
};

export default ProfilePage;
