import React, { useEffect, useRef, useState } from 'react';
import UserAvatar from '../../Profile/UserAvatar';
import styles from './Navbar.module.css';

interface NavbarProps {
	username: string;
	avatarId: number;
	handleLogout: () => void;
	onNavigate: (page: 'profile' | 'statistics' | 'maps' | 'leaderboard') => void;
}

const Navbar: React.FC<NavbarProps> = ({ username, avatarId, handleLogout, onNavigate }) => {
	const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);
	const accountMenuRef = useRef<HTMLDivElement>(null);
	const closeMenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => {
		if (closeMenuTimeout.current) clearTimeout(closeMenuTimeout.current);
	}, []);

	useEffect(() => {
		if (!accountMenuOpen) return;

		const handleOutsidePointerDown = (event: PointerEvent) => {
			if (!accountMenuRef.current?.contains(event.target as Node)) {
				setAccountMenuOpen(false);
			}
		};
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setAccountMenuOpen(false);
		};

		document.addEventListener('pointerdown', handleOutsidePointerDown);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('pointerdown', handleOutsidePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [accountMenuOpen]);

	const handleMenuMouseEnter = () => {
		if (closeMenuTimeout.current) clearTimeout(closeMenuTimeout.current);
		setAccountMenuOpen(true);
	};

	const handleMenuMouseLeave = () => {
		closeMenuTimeout.current = setTimeout(() => {
			setAccountMenuOpen(false);
		}, 250);
	};

	const navigateTo = (page: 'profile' | 'statistics' | 'maps' | 'leaderboard') => {
		if (closeMenuTimeout.current) clearTimeout(closeMenuTimeout.current);
		setAccountMenuOpen(false);
		onNavigate(page);
	};

	return (
		<nav className={styles.navbar}>
			<div className={styles.brand}>
				<span className={styles.brandMark} aria-hidden="true">◆</span>
				<span>KincsKereső Robot</span>
			</div>
			<div
				className={styles.accountMenu}
				ref={accountMenuRef}
				onMouseEnter={handleMenuMouseEnter}
				onMouseLeave={handleMenuMouseLeave}
			>
				<button
					type="button"
					aria-expanded={accountMenuOpen}
					aria-haspopup="true"
					aria-controls="account-menu"
					onClick={() => {
						if (closeMenuTimeout.current) clearTimeout(closeMenuTimeout.current);
						setAccountMenuOpen(true);
					}}
					className={styles.accountButton}
					aria-label={`Fiókmenü: ${username}`}
					title={username}
				>
					<UserAvatar avatarId={avatarId} size={24} />
					<span>{username}</span>
					<span className={styles.accountChevron} aria-hidden="true">⌄</span>
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