'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useWallet } from '@/context/WalletContext';
import { useTheme } from '@/hooks/useTheme';
import WalletButton from './WalletButton';
import NotificationBell from './NotificationBell';
import { useState, useRef, useEffect } from 'react';

export default function Navbar() {
  useWallet();
  const { theme, toggleTheme, mounted } = useTheme();
  const { i18n, t } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setLangOpen(false);
  };

  const currentLang = i18n.language === 'es' ? 'es' : 'en';
  const navLinks = [
    { href: '/freelancer', label: t('nav.forFreelancers') },
    { href: '/governance', label: t('nav.governance') },
    { href: '/payer', label: t('nav.payInvoices') },
    { href: '/dashboard', label: t('nav.dashboard') },
    { href: '/analytics', label: t('nav.analytics') },
    { href: '/stats', label: t('nav.stats') },
    { href: '/leaderboard', label: t('nav.leaderboard') },
    { href: '/referrals', label: 'Referrals' },
  ];

  return (
    <nav
      aria-label={t('nav.mainNavigation')}
      className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant/15 shadow-sm h-20 transition-colors duration-300"
    >
      <div className="flex justify-between items-center px-8 h-full max-w-7xl mx-auto">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-2xl font-bold text-primary tracking-tight transition-opacity hover:opacity-80"
        >
          ILN
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {/* <a className="text-on-surface-variant hover:text-primary text-sm font-medium" href="#">
            {t("nav.howItWorks")}
          </a> */}
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="/freelancer"
          >
            {t('nav.forFreelancers')}
          </Link>
          <a
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="#for-lps"
          >
            {t('nav.forLPs')}
          </a>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="/governance"
          >
            {t('nav.governance')}
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="/payer"
          >
            {t('nav.payInvoices')}
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="/dashboard"
          >
            {t('nav.dashboard')}
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="/analytics"
          >
            {t('nav.analytics')}
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="/stats"
          >
            {t('nav.stats')}
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="/leaderboard"
          >
            {t('nav.leaderboard')}
          </Link>
          {/* <a
            className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-sm font-medium"
            href="#"
          >
            {t("nav.docs")}
          </a> */}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-variant transition-colors md:hidden"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            <span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span>
          </button>

          <NotificationBell />

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-variant transition-colors"
              aria-label={t('language.select')}
              aria-expanded={langOpen}
            >
              <span className="material-symbols-outlined">globe</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/20 overflow-hidden z-50">
                <button
                  onClick={() => changeLanguage('en')}
                  className={`w-full px-4 py-3 text-sm text-left hover:bg-surface-variant transition-colors flex items-center gap-3 ${
                    currentLang === 'en'
                      ? 'bg-primary-container text-on-primary-container font-bold'
                      : 'text-on-surface-variant'
                  }`}
                >
                  <span className="text-base">🇺🇸</span>
                  {t('language.en')}
                </button>
                <button
                  onClick={() => changeLanguage('es')}
                  className={`w-full px-4 py-3 text-sm text-left hover:bg-surface-variant transition-colors flex items-center gap-3 ${
                    currentLang === 'es'
                      ? 'bg-primary-container text-on-primary-container font-bold'
                      : 'text-on-surface-variant'
                  }`}
                >
                  <span className="text-base">🇪🇸</span>
                  {t('language.es')}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-variant transition-colors"
            aria-label="Toggle dark mode"
          >
            <span className="material-symbols-outlined">
              {!mounted ? 'dark_mode' : theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          <div className="hidden sm:flex sm:items-center sm:gap-4">
            <span className="h-6 w-px bg-outline-variant/20" aria-hidden="true" />
            <WalletButton />
          </div>
        </div>
      </div>
      <div
        id="mobile-navigation"
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="border-t border-outline-variant/15 bg-background/95 px-6 py-4 shadow-lg">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-variant hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-outline-variant/15 pt-3">
              <WalletButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
