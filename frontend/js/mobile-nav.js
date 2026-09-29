/* ==========================================================================
   IoT Saathi - Universal Mobile Navigation Menu Toggle
   ========================================================================== */
(function() {
    'use strict';

    function initMobileNav() {
        const toggleBtn = document.getElementById('mobile-nav-toggle');
        const mainNav = document.querySelector('nav.main-nav');
        if (!toggleBtn || !mainNav) return;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mainNav.classList.contains('open');
            if (isOpen) {
                mainNav.classList.remove('open');
                toggleBtn.classList.remove('open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            } else {
                mainNav.classList.add('open');
                toggleBtn.classList.add('open');
                toggleBtn.setAttribute('aria-expanded', 'true');
            }
        });

        // Close on link click
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('open');
                toggleBtn.classList.remove('open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!mainNav.contains(e.target) && !toggleBtn.contains(e.target)) {
                mainNav.classList.remove('open');
                toggleBtn.classList.remove('open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mainNav.classList.contains('open')) {
                mainNav.classList.remove('open');
                toggleBtn.classList.remove('open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
        initMobileNav();
    }
})();
