(function () {
  const navbar = document.querySelector('.navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  function openMobileMenu() {
    hamburger?.classList.add('is-open');
    mobileMenu?.classList.add('is-open');
  }

  function closeMobileMenu() {
    hamburger?.classList.remove('is-open');
    mobileMenu?.classList.remove('is-open');
  }

  function toggleMobileMenu() {
    if (mobileMenu?.classList.contains('is-open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  hamburger?.addEventListener('click', toggleMobileMenu);

  mobileMenu?.querySelectorAll('.mobile-nav-link').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  function updateScrolled() {
    if (!navbar) return;
    if (window.scrollY > 10) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', () => {
    updateScrolled();
    closeMobileMenu();
  });

  updateScrolled();

  const pathname = window.location.pathname.replace(/\/$/, '') || '/';

  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    let linkPath = href;
    try {
      linkPath = new URL(href, window.location.origin).pathname;
    } catch {
      /* relative path */
    }
    linkPath = linkPath.replace(/\/$/, '') || '/';

    if (linkPath === pathname) {
      link.classList.add('active');
    }
  });
})();
