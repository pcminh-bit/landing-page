(function () {
  const gallery = document.getElementById('awardGallery');
  if (!gallery) return;

  const wrap = gallery.closest('.award-gallery-wrap');
  const track = gallery.querySelector('.award-gallery-track');
  const slides = track ? [...track.children] : [];
  const UNIQUE_COUNT = 3;
  const AUTO_MS = 4000;
  const TRANSITION_MS = 450;

  if (slides.length < UNIQUE_COUNT) return;

  let index = 0;
  let autoplayId = null;
  let isAnimating = false;

  track.classList.add('is-js-driven');

  function stepWidth() {
    return gallery.clientWidth;
  }

  function setTransform(i, animate) {
    track.style.transition = animate
      ? `transform ${TRANSITION_MS}ms ease`
      : 'none';
    track.style.transform = `translateX(-${i * stepWidth()}px)`;
  }

  function onTransitionEnd(fn) {
    function handler(e) {
      if (e.target !== track || e.propertyName !== 'transform') return;
      track.removeEventListener('transitionend', handler);
      fn();
    }
    track.addEventListener('transitionend', handler);
  }

  function next() {
    if (isAnimating) return;
    isAnimating = true;
    index += 1;
    setTransform(index, true);

    if (index >= UNIQUE_COUNT) {
      onTransitionEnd(() => {
        index = 0;
        setTransform(0, false);
        isAnimating = false;
      });
    } else {
      onTransitionEnd(() => {
        isAnimating = false;
      });
    }
  }

  function prev() {
    if (isAnimating) return;
    isAnimating = true;

    if (index <= 0) {
      index = UNIQUE_COUNT;
      setTransform(index, false);
      requestAnimationFrame(() => {
        index = UNIQUE_COUNT - 1;
        setTransform(index, true);
        onTransitionEnd(() => {
          isAnimating = false;
        });
      });
      return;
    }

    index -= 1;
    setTransform(index, true);
    onTransitionEnd(() => {
      isAnimating = false;
    });
  }

  function stopAutoplay() {
    if (autoplayId) {
      clearInterval(autoplayId);
      autoplayId = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayId = setInterval(next, AUTO_MS);
  }

  function resetAfterUserNav() {
    stopAutoplay();
    startAutoplay();
  }

  wrap?.querySelector('.award-gallery-btn--next')?.addEventListener('click', () => {
    next();
    resetAfterUserNav();
  });

  wrap?.querySelector('.award-gallery-btn--prev')?.addEventListener('click', () => {
    prev();
    resetAfterUserNav();
  });

  wrap?.addEventListener('mouseenter', stopAutoplay);
  wrap?.addEventListener('mouseleave', startAutoplay);

  window.addEventListener('resize', () => setTransform(index, false));

  setTransform(0, false);
  startAutoplay();
})();
