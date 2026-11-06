import { useState } from 'react';
import AuthContainer from './components/Auth/AuthContainer';
import HomePage from './components/HomePage/HomePage';

const App = () => {
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('authToken'));
	const [username, setUsername] = useState<string>(localStorage.getItem('username') || 'Fiók');

	const handleAuthSuccess = (data?: { username?: string }) => {
		const loggedInUsername = data?.username || localStorage.getItem('username') || 'Fiók';
		setUsername(loggedInUsername);
		localStorage.setItem('username', loggedInUsername);
		setIsLoggedIn(true);
	};

	const handleLogout = () => {
		localStorage.removeItem('authToken');
		localStorage.removeItem('username');
		setUsername('Fiók');
		setIsLoggedIn(false);
	};

	return (
		<main>
			{isLoggedIn ? (
				<HomePage
					username={username}
					handleLogout={handleLogout}
				/>
			) : (
				<AuthContainer onAuthSuccess={handleAuthSuccess} />
			)}
		</main>
	);
};

export default App;