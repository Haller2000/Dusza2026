import React, { useState } from 'react';
import UserAvatar from '../../Profile/UserAvatar';
import styles from './Navbar.module.css';

interface NavbarProps {
	username: string;
	avatarId: number;
	handleLogout: () => void;
	onNavigate: (page: 'profile' | 'statistics' | 'maps') => void;
}

const Navbar: React.FC<NavbarProps> = ({ username, avatarId, handleLogout, onNavigate }) => {
	const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);

	const navigateTo = (page: 'profile' | 'statistics' | 'maps') => {
		setAccountMenuOpen(false);
		onNavigate(page);
	};

	return (
		<nav className={styles.navbar}>
			<div
				className={styles.accountMenu}
				onMouseEnter={() => setAccountMenuOpen(true)}
				onMouseLeave={() => setAccountMenuOpen(false)}
			>
				<button
					type="button"
					aria-expanded={accountMenuOpen}
					aria-haspopup="true"
					aria-controls="account-menu"
					onClick={() => setAccountMenuOpen(!accountMenuOpen)}
					className={styles.accountButton}
					aria-label={`Fiókmenü: ${username}`}
					title={username}
				>
					<UserAvatar avatarId={avatarId} size={44} />
				</button>
				{accountMenuOpen && (
					<div id="account-menu" className={styles.accountPanel}>
						<div className={styles.accountName}>{username}</div>
						<button
							type="button"
							onClick={() => navigateTo('profile')}
							className={styles.menuLink}
						>
							<span className={styles.menuIcon} aria-hidden="true">👤</span>
							<span>
								<strong>Profilom</strong>
								<small>Fiókadatok és beállítások</small>
							</span>
							<span className={styles.menuArrow} aria-hidden="true">›</span>
						</button>
						<button
							type="button"
							onClick={() => navigateTo('statistics')}
							className={styles.menuLink}
						>
							<span className={styles.menuIcon} aria-hidden="true">▤</span>
							<span>
								<strong>Statisztika</strong>
								<small>Játékok és eredmények</small>
							</span>
							<span className={styles.menuArrow} aria-hidden="true">›</span>
						</button>
						<button
							type="button"
							onClick={() => navigateTo('maps')}
							className={styles.menuLink}
						>
							<span className={styles.menuIcon} aria-hidden="true">▦</span>
							<span>
								<strong>Saját pályák</strong>
								<small>Az általad készített pályák</small>
							</span>
							<span className={styles.menuArrow} aria-hidden="true">›</span>
						</button>

						<button
							type="button"
							onClick={handleLogout}
							className={styles.logoutButton}
						>
							Kijelentkezés
						</button>
					</div>
				)}
			</div>
		</nav>
	);
};

export default Navbar;
