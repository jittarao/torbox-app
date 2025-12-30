'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import NotificationBell from '@/components/notifications/NotificationBell';
import SystemStatusIndicator from '@/components/shared/SystemStatusIndicator';
import { useTheme } from '@/contexts/ThemeContext';
import { getVersion } from '@/utils/version';

export default function Header({ apiKey }) {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const { darkMode, toggleDarkMode, isClient } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [activeKeyLabel, setActiveKeyLabel] = useState('');
  const moreMenuRef = useRef(null);

  useEffect(() => {
    const fetchActiveKeyLabel = async () => {
      if (!apiKey) return;
      try {
        const response = await fetch('/api/keys');
        if (response.ok) {
          const keys = await response.json();
          const currentKey = keys.find(k => k.key === apiKey);
          if (currentKey) {
            setActiveKeyLabel(currentKey.label);
          }
        }
      } catch (error) {
        console.error('Error fetching keys in header:', error);
      }
    };
    fetchActiveKeyLabel();
  }, [apiKey]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreMenuOpen(false);
      }
    };

    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMoreMenuOpen]);

  const isActive = (path) => {
    return pathname === path || pathname === `/en${path}`;
  };

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-border/50 dark:border-border-dark/50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 group-hover:scale-110 transition-transform">
              <Image
                src="/images/TBM-logo.png"
                alt={t('logo')}
                width={28}
                height={28}
                className="drop-shadow-sm"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-500 dark:to-indigo-300">
                {t('title')}
              </h1>
              <span className="text-[10px] uppercase tracking-widest font-bold text-primary-text/40 dark:text-primary-text-dark/40 flex gap-2">
                <span>v{getVersion()}</span>
                <span className="text-primary/60">•</span>
                <span>Author: Onkar</span>
              </span>
            </div>
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={toggleMenu}
            aria-label={t('menu.toggle')}
            className="md:hidden p-2 rounded-lg hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="w-6 h-6"
            >
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-1 bg-surface-alt/50 dark:bg-surface-alt-dark/50 p-1 rounded-2xl border border-border/30 dark:border-border-dark/30">
              {activeKeyLabel && (
                <div className="px-3 py-2 flex items-center gap-2 border-r border-border/20 dark:border-border-dark/20 mr-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-tighter text-primary-text/40 dark:text-primary-text-dark/40">
                    Active: <span className="text-primary font-black">{activeKeyLabel}</span>
                  </span>
                </div>
              )}

              <Link
                href="/"
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2
                  ${isActive('/')
                    ? 'bg-surface dark:bg-surface-dark shadow-premium dark:shadow-premium-dark text-primary'
                    : 'text-primary-text/60 dark:text-primary-text-dark/60 hover:text-primary'}`}
              >
                <Icons.Download className="w-4 h-4" />
                {t('menu.downloads')}
              </Link>

              <Link
                href="/search"
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2
                  ${isActive('/search')
                    ? 'bg-white dark:bg-slate-800 shadow-premium text-primary'
                    : 'text-primary-text/60 dark:text-primary-text-dark/60 hover:text-primary'}`}
              >
                <Icons.MagnifyingGlass className="w-4 h-4" />
                {t('menu.search')}
              </Link>

              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2
                    ${isActive('/archived') || isActive('/link-history') || isActive('/rss') || isActive('/user') || isActive('/manage-keys')
                      ? 'bg-white dark:bg-slate-800 shadow-premium text-primary'
                      : 'text-primary-text/60 dark:text-primary-text-dark/60 hover:text-primary'}`}
                >
                  <Icons.VerticalEllipsis className="w-4 h-4" />
                  <span>{t('menu.more') || 'More'}</span>
                </button>

                {isMoreMenuOpen && (
                  <div className="absolute right-0 mt-3 py-2 w-56 glass rounded-2xl shadow-xl border border-border/50 dark:border-border-dark/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { href: '/user', icon: Icons.User, label: t('menu.user') },
                      { href: '/manage-keys', icon: Icons.Preferences, label: t('menu.manageKeys') || 'Manage Keys' },
                      { href: '/link-history', icon: Icons.History, label: t('menu.linkHistory') },
                      { href: '/archived', icon: Icons.Archive, label: t('menu.archived') },
                      { href: '/rss', icon: Icons.Rss, label: t('menu.rss') }
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMoreMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-xl ${isActive(item.href)
                          ? 'text-primary bg-primary/10'
                          : 'text-primary-text/70 dark:text-primary-text-dark/70 hover:bg-surface-alt/50 dark:hover:bg-surface-alt-dark/50'
                          }`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-6 w-px bg-border/50 dark:bg-border-dark/50"></div>

            <div className="flex items-center gap-3">
              {apiKey && <NotificationBell apiKey={apiKey} />}
              <SystemStatusIndicator apiKey={apiKey} />
            </div>

            <div className="h-6 w-px bg-border/50 dark:bg-border-dark/50"></div>

            <div className="flex items-center gap-4">
              {isClient && (
                <button
                  onClick={toggleDarkMode}
                  aria-label={darkMode ? t('theme.toggleLight') : t('theme.toggleDark')}
                  className="group relative flex items-center justify-center w-10 h-10 rounded-xl bg-surface-alt/50 dark:bg-surface-alt-dark/50 border border-border/30 dark:border-border-dark/30 hover:scale-110 active:scale-95 transition-all"
                >
                  <div className="relative overflow-hidden w-5 h-5">
                    <div className={`transition-transform duration-500 ${darkMode ? 'translate-y-0' : 'translate-y-8'}`}>
                      <Icons.Moon className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className={`absolute top-0 transition-transform duration-500 ${darkMode ? '-translate-y-8' : 'translate-y-0'}`}>
                      <Icons.Sun className="w-5 h-5 text-amber-500" />
                    </div>
                  </div>
                </button>
              )}

              <a
                href="https://github.com/onkarvelhals/torbox-app-enhanced"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl text-primary-text/60 dark:text-primary-text-dark/60 hover:text-primary hover:bg-primary/10 transition-all"
              >
                <Icons.GitHub className="w-5 h-5" />
              </a>
            </div>
          </nav>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-6 pb-6 animate-in slide-in-from-top-4 duration-300">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/"
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${isActive('/') ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 text-primary-text/60'
                    }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Icons.Download className="w-6 h-6" />
                  <span className="text-xs font-bold">{t('menu.downloads')}</span>
                </Link>
                <Link
                  href="/search"
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${isActive('/search') ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 text-primary-text/60'
                    }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Icons.MagnifyingGlass className="w-6 h-6" />
                  <span className="text-xs font-bold">{t('menu.search')}</span>
                </Link>
              </div>

              <div className="glass rounded-3xl p-2 space-y-1">
                {[
                  { href: '/user', icon: Icons.User, label: t('menu.user') },
                  { href: '/manage-keys', icon: Icons.Preferences, label: t('menu.manageKeys') || 'Manage Keys' },
                  { href: '/link-history', icon: Icons.History, label: t('menu.linkHistory') },
                  { href: '/archived', icon: Icons.Archive, label: t('menu.archived') },
                  { href: '/rss', icon: Icons.Rss, label: t('menu.rss') }
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-4 p-3 rounded-2xl text-sm font-medium transition-colors ${isActive(item.href) ? 'bg-primary/10 text-primary' : 'hover:bg-surface-alt/50'
                      }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>

              <div className="glass rounded-3xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-primary-text/60 uppercase tracking-wider">{t('menu.settings') || 'Settings'}</span>
                  <div className="flex items-center gap-2">
                    {isClient && (
                      <button
                        onClick={toggleDarkMode}
                        className="p-2 rounded-xl bg-surface-alt/50 dark:bg-surface-alt-dark/50 border border-border/30"
                      >
                        {darkMode ? <Icons.Moon className="w-5 h-5 text-indigo-400" /> : <Icons.Sun className="w-5 h-5 text-amber-500" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/30"></div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    {apiKey && <NotificationBell apiKey={apiKey} />}
                    <SystemStatusIndicator apiKey={apiKey} />
                  </div>
                  <a
                    href="https://github.com/onkarvelhals/torbox-app-enhanced"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-surface-alt/50 border border-border/30"
                  >
                    <Icons.GitHub className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
