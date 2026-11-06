import { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import AuthContainer from './components/Auth/AuthContainer';
import HomePage from './components/HomePage/HomePage';

interface ProfileResponse {
	username: string;
	avatar_id: number;
}

const App = () => {
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('authToken'));
	const [username, setUsername] = useState<string>(localStorage.getItem('username') || 'Fiók');
	const [avatarId, setAvatarId] = useState<number>(Number(localStorage.getItem('avatarId')) || 1);
	const [profileError, setProfileError] = useState<string>('');

	useEffect(() => {
		if (!isLoggedIn) return;

		const token = localStorage.getItem('authToken');
		if (!token) return;

		axios.get<ProfileResponse>('http://127.0.0.1:8000/api/profile/', {
			headers: { Authorization: `Token ${token}` },
		}).then(response => {
			setUsername(response.data.username);
			setAvatarId(response.data.avatar_id);
			localStorage.setItem('username', response.data.username);
			localStorage.setItem('avatarId', String(response.data.avatar_id));
			setProfileError('');
		}).catch((error: AxiosError<{ detail?: string }>) => {
			setProfileError(error.response?.data?.detail || 'Nem sikerült betölteni a fiók adatait.');
		});
	}, [isLoggedIn]);

	const handleAuthSuccess = (data?: { username?: string; avatar_id?: number }) => {
		const loggedInUsername = data?.username || localStorage.getItem('username') || 'Fiók';
		const loggedInAvatarId = data?.avatar_id ?? (Number(localStorage.getItem('avatarId')) || 1);
		setUsername(loggedInUsername);
		setAvatarId(loggedInAvatarId);
		localStorage.setItem('username', loggedInUsername);
		localStorage.setItem('avatarId', String(loggedInAvatarId));
		setProfileError('');
		setIsLoggedIn(true);
	};

	const handleAvatarChange = (nextAvatarId: number) => {
		setAvatarId(nextAvatarId);
		localStorage.setItem('avatarId', String(nextAvatarId));
	};

	const handleLogout = () => {
		localStorage.removeItem('authToken');
		localStorage.removeItem('username');
		localStorage.removeItem('avatarId');
		setUsername('Fiók');
		setAvatarId(1);
		setIsLoggedIn(false);
	};

	return (
		<main>
			{isLoggedIn ? (
				<HomePage
					username={username}
					avatarId={avatarId}
					onAvatarChange={handleAvatarChange}
					handleLogout={handleLogout}
					profileError={profileError}
				/>
			) : (
				<AuthContainer onAuthSuccess={handleAuthSuccess} />
			)}
		</main>
	);
};

export default App;