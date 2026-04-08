(function () {
  'use strict';

  var doc = document;
  var win = window;
  var cookieConsentLoaded = false;
  var cookieConsentQueued = false;

  function runWhenIdle(task, timeout) {
    var wait = typeof timeout === 'number' ? timeout : 2000;
    if (typeof win.requestIdleCallback === 'function') {
      win.requestIdleCallback(
        function () {
          task();
        },
        { timeout: wait }
      );
      return;
    }
    win.setTimeout(task, 900);
  }

  function initMobileMenu() {
    var menu = doc.getElementById('mm');
    var toggle = doc.querySelector('[data-menu-toggle]');

    if (!menu || !toggle) return;

    function setOpen(isOpen) {
      menu.classList.toggle('show', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute(
        'aria-label',
        isOpen ? 'Close navigation menu' : 'Open navigation menu'
      );
    }

    toggle.addEventListener('click', function () {
      setOpen(!menu.classList.contains('show'));
    });

    menu.addEventListener('click', function (event) {
      if (event.target && event.target.closest('a')) {
        setOpen(false);
      }
    });

    doc.addEventListener('click', function (event) {
      var target = event.target;
      if (
        menu.classList.contains('show') &&
        target &&
        !menu.contains(target) &&
        !toggle.contains(target)
      ) {
        setOpen(false);
      }
    });

    win.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.classList.contains('show')) {
        setOpen(false);
      }
    });
  }

  function initRevealAnimations() {
    var revealItems = doc.querySelectorAll('.rv');
    if (!revealItems.length) return;

    var reducedMotion =
      typeof win.matchMedia === 'function' &&
      win.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || !('IntersectionObserver' in win)) {
      for (var i = 0; i < revealItems.length; i += 1) {
        revealItems[i].classList.add('in');
      }
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) {
            entries[i].target.classList.add('in');
            io.unobserve(entries[i].target);
          }
        }
      },
      { threshold: 0.08 }
    );

    for (var i = 0; i < revealItems.length; i += 1) {
      io.observe(revealItems[i]);
    }
  }

  function initScrollUi() {
    var backTop = doc.getElementById('backTop');
    if (!backTop) return;

    var ticking = false;

    function updateBackTopState() {
      var y = win.scrollY || win.pageYOffset || 0;
      backTop.classList.toggle('show', y > 400);
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      win.requestAnimationFrame(updateBackTopState);
    }

    updateBackTopState();
    win.addEventListener('scroll', onScroll, { passive: true });

    backTop.addEventListener('click', function () {
      win.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initPolicyToc() {
    var tocLinks = doc.querySelectorAll('.toc-link');
    var sections = doc.querySelectorAll('.pp-section');

    if (!tocLinks.length || !sections.length || !('IntersectionObserver' in win)) {
      return;
    }

    var tocObserver = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) {
            for (var j = 0; j < tocLinks.length; j += 1) {
              tocLinks[j].classList.remove('active');
            }
            var current = doc.querySelector(
              '.toc-link[href="#' + entries[i].target.id + '"]'
            );
            if (current) current.classList.add('active');
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    for (var i = 0; i < sections.length; i += 1) {
      tocObserver.observe(sections[i]);
    }
  }

  function getSiteAssetPrefix() {
    var scriptTag = doc.querySelector('script[src*="site-core"]');
    if (!scriptTag) return '';

    var src = scriptTag.getAttribute('src') || '';
    if (src.indexOf('../') === 0) {
      return '../';
    }

    return '';
  }

  function ensureFooterCertificationStyles() {
    if (doc.getElementById('ft-certifications-style')) return;

    var style = doc.createElement('style');
    style.id = 'ft-certifications-style';
    style.textContent =
      '.ft-certifications{' +
      'display:grid;' +
      'grid-template-columns:repeat(2,minmax(0,1fr));' +
      'gap:12px;' +
      'margin-top:18px;' +
      'width:100%;' +
      'max-width:360px' +
      '}' +
      '.ft-cert-link{' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:center;' +
      'min-height:74px;' +
      'padding:6px 8px;' +
      'border:1px solid rgba(255,255,255,.94);' +
      'border-radius:14px;' +
      'background:#ffffff;' +
      'box-shadow:0 10px 24px rgba(2,12,24,.18);' +
      'text-decoration:none;' +
      'transition:transform .2s,background .2s,border-color .2s,box-shadow .2s' +
      '}' +
      '.ft-cert-link:hover{' +
      'transform:translateY(-2px);' +
      'background:#ffffff;' +
      'border-color:#ffffff;' +
      'box-shadow:0 16px 30px rgba(2,12,24,.24)' +
      '}' +
      '.ft-cert-link img{' +
      'display:block;' +
      'width:100%;' +
      'max-width:138px;' +
      'height:62px;' +
      'object-fit:contain' +
      '}' +
      '@media (max-width:640px){' +
      '.ft-certifications{max-width:320px}' +
      '.ft-cert-link{min-height:68px;padding:5px 7px}' +
      '.ft-cert-link img{max-width:124px;height:54px}' +
      '}';
    doc.head.appendChild(style);
  }

  function initFooterCertifications() {
    var footers = doc.querySelectorAll('footer');
    if (!footers.length) return;

    ensureFooterCertificationStyles();

    var pathPrefix = getSiteAssetPrefix();
    var certificates = [
      {
        alt: 'Cyber Essentials certification logo',
        href: pathPrefix + 'public/Cyber%20Certifcate.pdf',
        image: pathPrefix + 'public/cyberEssentials-1.png',
        title: 'Cyber Essentials'
      },
      {
        alt: "Information Commissioner's Office logo",
        href: pathPrefix + 'public/Data_Protection_Certificate.pdf',
        image:
          pathPrefix + 'public/Information_Commissioner%27s_Office_logo.svg.png',
        title: "Information Commissioner's Office"
      }
    ];

    for (var i = 0; i < footers.length; i += 1) {
      var footer = footers[i];
      if (footer.querySelector('.ft-certifications')) continue;

      var wrapper = doc.createElement('div');
      wrapper.className = 'ft-certifications';

      for (var j = 0; j < certificates.length; j += 1) {
        var certificate = certificates[j];
        var link = doc.createElement('a');
        link.className = 'ft-cert-link';
        link.href = certificate.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute(
          'aria-label',
          'Open ' + certificate.title + ' certificate in a new tab'
        );
        link.innerHTML =
          '<img src="' +
          certificate.image +
          '" alt="' +
          certificate.alt +
          '" loading="lazy" decoding="async">';
        wrapper.appendChild(link);
      }

      var columns = footer.querySelectorAll('.ft-col');
      var targetColumn = null;

      for (var k = 0; k < columns.length; k += 1) {
        var heading = columns[k].querySelector('h4');
        if (heading && heading.textContent && heading.textContent.trim() === 'Services') {
          targetColumn = columns[k];
          break;
        }
      }

      if (!targetColumn && columns.length) {
        targetColumn = columns[columns.length - 1];
      }

      if (!targetColumn) {
        targetColumn = footer.querySelector('.ft-brand');
      }

      var insertionTarget = targetColumn ? targetColumn.querySelector('ul') : null;

      if (insertionTarget && insertionTarget.parentNode === targetColumn) {
        insertionTarget.parentNode.insertBefore(wrapper, insertionTarget.nextSibling);
      } else if (targetColumn) {
        targetColumn.appendChild(wrapper);
      } else {
        footer.appendChild(wrapper);
      }
    }
  }

  function getCookieConsentSrc() {
    var scriptTag = doc.querySelector('script[src*="site-core"]');
    if (!scriptTag) return 'js/cookie-consent.min.js';

    var src = scriptTag.getAttribute('src') || '';
    if (src.indexOf('../') === 0) {
      return '../js/cookie-consent.min.js';
    }
    return 'js/cookie-consent.min.js';
  }

  function lazyLoadCookieConsent() {
    if (cookieConsentLoaded) return;
    if (doc.querySelector('script[src*="cookie-consent"]')) {
      cookieConsentLoaded = true;
      return;
    }

    var script = doc.createElement('script');
    script.src = getCookieConsentSrc();
    script.defer = true;
    script.onload = function () {
      cookieConsentLoaded = true;
    };
    doc.body.appendChild(script);
  }

  function queueCookieConsentLoad() {
    if (cookieConsentQueued) return;
    cookieConsentQueued = true;
    runWhenIdle(lazyLoadCookieConsent, 5000);
  }

  function scheduleCookieConsentLoad() {
    var interactionEvents = ['pointerdown', 'keydown', 'touchstart'];
    for (var i = 0; i < interactionEvents.length; i += 1) {
      win.addEventListener(interactionEvents[i], queueCookieConsentLoad, {
        once: true,
        passive: true
      });
    }

    win.setTimeout(queueCookieConsentLoad, 3200);
  }

  function start() {
    initMobileMenu();
    initScrollUi();
    initFooterCertifications();

    runWhenIdle(initRevealAnimations, 2500);
    runWhenIdle(initPolicyToc, 3000);

    if (doc.readyState === 'complete') {
      scheduleCookieConsentLoad();
      return;
    }

    win.addEventListener(
      'load',
      function () {
        scheduleCookieConsentLoad();
      },
      { once: true }
    );
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
