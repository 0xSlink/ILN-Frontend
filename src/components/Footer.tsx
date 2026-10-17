'use client';

import { useTranslation } from 'react-i18next';
import { useRef } from 'react';

export default function Footer() {
  const { t } = useTranslation();
  const footerRef = useRef<HTMLDivElement>(null);

  const skipToMain = () => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView();
    }
  };

  return (
    <footer className="bg-primary-container py-16 px-8" ref={footerRef}>
      <a
        href="#main-content"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded"
      >
        Skip to main content
      </a>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="text-2xl font-bold text-primary mb-6">ILN</div>
            <p className="text-on-primary-container/70 max-w-xs mb-8 font-body text-sm leading-relaxed">
              {t('footer.tagline')}
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                className="w-10 h-10 rounded-full bg-on-primary-container/10 flex items-center justify-center text-on-primary-container hover:bg-on-primary-container/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container"
                aria-label={t('footer.website') || 'Visit our website'}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  public
                </span>
              </button>
              <button
                type="button"
                className="w-10 h-10 rounded-full bg-on-primary-container/10 flex items-center justify-center text-on-primary-container hover:bg-on-primary-container/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container"
                aria-label={t('footer.github') || 'View our GitHub repository'}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  terminal
                </span>
              </button>
            </div>
          </div>
          <nav aria-labelledby="footer-network-heading">
            <h5
              id="footer-network-heading"
              className="text-xs font-bold uppercase tracking-widest text-on-primary-container mb-6"
            >
              {t('footer.network')}
            </h5>
            <ul className="space-y-4 text-sm text-on-primary-container/80">
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.howItWorks')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.forFreelancers')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.forLPs')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.dashboard')}
                </button>
              </li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-developers-heading">
            <h5
              id="footer-developers-heading"
              className="text-xs font-bold uppercase tracking-widest text-on-primary-container mb-6"
            >
              {t('footer.developers')}
            </h5>
            <ul className="space-y-4 text-sm text-on-primary-container/80">
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.documentation')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.githubRepository')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.technicalSpecs')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-primary-container focus:rounded px-1"
                >
                  {t('footer.openSourcePolicy')}
                </button>
              </li>
            </ul>
          </nav>
        </div>
        <div className="pt-8 border-t border-on-primary-container/10 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary-container/60">
          <div className="flex items-center gap-4">
            <span>{t('footer.builtOnStellar')}</span>
            <span aria-hidden="true">•</span>
            <span>{t('footer.mitLicense')}</span>
          </div>
          <div>{t('footer.copyright')}</div>
        </div>
      </div>
    </footer>
  );
}
