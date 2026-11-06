import React, { useState } from 'react';
import styles from './Navbar.module.css';

interface NavbarProps {
	username: string;
	handleLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ username, handleLogout }) => {
	const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);

	return (
		<nav className={styles.navbar}>
			<div className={styles.accountMenu}>
				<button
					type="button"
					aria-expanded={accountMenuOpen}
					aria-haspopup="true"
					onClick={() => setAccountMenuOpen(!accountMenuOpen)}
					className={styles.accountButton}
				>
					{username}
				</button>
				{accountMenuOpen && (
					<button
						type="button"
						onClick={handleLogout}
						className={styles.logoutButton}
					>
						Kijelentkezés
					</button>
				)}
			</div>
		</nav>
	);
};

export default Navbar;
