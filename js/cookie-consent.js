(function () {
  'use strict';

  var STORAGE_KEY = 'welltech_cookie_consent_v1';
  var COOKIE_NAME = 'welltech_cookie_consent';
  var CONSENT_DAYS = 90;
  var analyticsLoaded = false;
  var DEFAULT_GA_MEASUREMENT_ID = 'G-XH0FWBZKRB';

  function safeJsonParse(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }

  function readCookie(name) {
    var target = name + '=';
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i += 1) {
      var cookie = parts[i].trim();
      if (cookie.indexOf(target) === 0) {
        return decodeURIComponent(cookie.substring(target.length));
      }
    }
    return '';
  }

  function writeCookie(name, value, days) {
    var maxAge = days * 24 * 60 * 60;
    var secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      name +
      '=' +
      encodeURIComponent(value) +
      '; Max-Age=' +
      maxAge +
      '; path=/; SameSite=Lax' +
      secure;
  }

  function deleteCookie(name, domain) {
    var secure = window.location.protocol === 'https:' ? '; Secure' : '';
    var domainPart = domain ? '; domain=' + domain : '';
    document.cookie =
      name +
      '=; Max-Age=0; path=/; SameSite=Lax' +
      domainPart +
      secure;
  }

  function normalizePreferences(input) {
    var raw = input || {};
    return {
      necessary: true,
      analytics: !!raw.analytics
    };
  }

  function loadConsent() {
    var fromStorage = null;
    try {
      fromStorage = safeJsonParse(window.localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      fromStorage = null;
    }

    if (fromStorage && fromStorage.preferences) {
      fromStorage.preferences = normalizePreferences(fromStorage.preferences);
      return fromStorage;
    }

    var fromCookie = safeJsonParse(readCookie(COOKIE_NAME));
    if (fromCookie && fromCookie.preferences) {
      fromCookie.preferences = normalizePreferences(fromCookie.preferences);
      return fromCookie;
    }

    return null;
  }

  function saveConsent(preferences) {
    var payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      preferences: normalizePreferences(preferences)
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Continue with cookie storage only.
    }

    writeCookie(COOKIE_NAME, JSON.stringify(payload), CONSENT_DAYS);
    return payload;
  }

  function getGaMeasurementId() {
    if (DEFAULT_GA_MEASUREMENT_ID && DEFAULT_GA_MEASUREMENT_ID.trim()) {
      return DEFAULT_GA_MEASUREMENT_ID.trim();
    }

    var fromWindow = window.WELLTECH_GA_ID || window.GA_MEASUREMENT_ID;
    if (typeof fromWindow === 'string' && fromWindow.trim()) {
      return fromWindow.trim();
    }

    var meta = document.querySelector('meta[name="ga-measurement-id"]');
    if (meta && meta.content && meta.content.trim()) {
      return meta.content.trim();
    }

    return '';
  }

  function clearAnalyticsCookies(measurementId) {
    var names = ['_ga', '_gid', '_gat'];
    if (measurementId) {
      names.push('_ga_' + measurementId.replace(/^G-/, '').replace(/-/g, ''));
    }

    var host = window.location.hostname;
    var rootDomain = host.replace(/^www\./i, '');

    for (var i = 0; i < names.length; i += 1) {
      deleteCookie(names[i]);
      if (rootDomain && rootDomain !== host) {
        deleteCookie(names[i], '.' + rootDomain);
      }
      if (host) {
        deleteCookie(names[i], '.' + host);
      }
    }
  }

  function loadGoogleAnalytics(measurementId) {
    if (!measurementId || analyticsLoaded) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };

    // Start in denied mode until explicit consent is granted.
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted'
    });

    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      anonymize_ip: true
    });

    var script = document.createElement('script');
    script.async = true;
    script.src =
      'https://www.googletagmanager.com/gtag/js?id=' +
      encodeURIComponent(measurementId);
    document.head.appendChild(script);
    analyticsLoaded = true;
  }

  function applyAnalyticsPreference(allowed) {
    var measurementId = getGaMeasurementId();
    if (!measurementId) return;

    // Block GA by default until consent.
    window['ga-disable-' + measurementId] = !allowed;

    if (allowed) {
      loadGoogleAnalytics(measurementId);
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
      }
      return;
    }

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    clearAnalyticsCookies(measurementId);
  }

  function emitConsentUpdate(consent) {
    if (typeof window.CustomEvent !== 'function') return;
    window.dispatchEvent(
      new CustomEvent('welltech:cookie-consent-updated', {
        detail: consent
      })
    );
  }

  function bindFooterSettingsLinks(openPanel) {
    var links = document.querySelectorAll('[data-cookie-settings]');
    for (var i = 0; i < links.length; i += 1) {
      links[i].addEventListener('click', function (event) {
        event.preventDefault();
        openPanel();
      });
    }
  }

  function buildConsentUI() {
    var root = document.createElement('div');
    root.id = 'wt-cookie-root';
    root.innerHTML =
      '<div class="wt-cookie-overlay" id="wtCookieOverlay" hidden></div>' +
      '<section class="wt-cookie-banner" id="wtCookieBanner" aria-label="Cookie consent banner" hidden>' +
      '  <div class="wt-cookie-banner-inner">' +
      '    <h2 class="wt-cookie-title">Cookies on this site</h2>' +
      '    <p class="wt-cookie-copy">We use strictly necessary cookies to keep this site secure and working. With your permission, we also use optional analytics cookies to understand site usage and improve performance.</p>' +
      '    <p class="wt-cookie-copy wt-cookie-copy-small">You can accept all, reject optional cookies, or change settings at any time.</p>' +
      '    <div class="wt-cookie-actions">' +
      '      <button type="button" class="wt-btn wt-btn-choice" id="wtCookieAcceptAll">Accept all</button>' +
      '      <button type="button" class="wt-btn wt-btn-choice" id="wtCookieRejectOptional">Reject optional</button>' +
      '      <button type="button" class="wt-btn wt-btn-settings" id="wtCookieManage">Cookie settings</button>' +
      '    </div>' +
      '  </div>' +
      '</section>' +
      '<section class="wt-cookie-panel" id="wtCookiePanel" role="dialog" aria-modal="true" aria-labelledby="wtCookiePanelTitle" hidden>' +
      '  <div class="wt-cookie-panel-inner">' +
      '    <h2 id="wtCookiePanelTitle" class="wt-cookie-title">Cookie preferences</h2>' +
      '    <p class="wt-cookie-copy">Choose which optional cookies you want us to use. Strictly necessary cookies are always on.</p>' +
      '    <div class="wt-cookie-row">' +
      '      <div class="wt-cookie-row-content">' +
      '        <h3>Strictly necessary</h3>' +
      '        <p>Required for core site functionality and to remember your cookie choices.</p>' +
      '        <p class="wt-cookie-meta">Cookie used: <code>' +
      COOKIE_NAME +
      '</code> (90 days)</p>' +
      '      </div>' +
      '      <label class="wt-switch" aria-label="Strictly necessary cookies are always enabled">' +
      '        <input type="checkbox" checked disabled>' +
      '        <span class="wt-slider"></span>' +
      '      </label>' +
      '    </div>' +
      '    <div class="wt-cookie-row">' +
      '      <div class="wt-cookie-row-content">' +
      '        <h3>Analytics (optional)</h3>' +
      '        <p>Helps us measure visits and improve content. These cookies stay off unless you enable them.</p>' +
      '        <p class="wt-cookie-meta">Typical cookies: <code>_ga</code>, <code>_gid</code></p>' +
      '      </div>' +
      '      <label class="wt-switch" for="wtCookieAnalyticsToggle">' +
      '        <input type="checkbox" id="wtCookieAnalyticsToggle">' +
      '        <span class="wt-slider"></span>' +
      '      </label>' +
      '    </div>' +
      '    <p class="wt-cookie-copy wt-cookie-copy-small">Read more in our <a href="/cookies-policy.html">Cookie Policy</a>.</p>' +
      '    <div class="wt-cookie-actions wt-cookie-actions-panel">' +
      '      <button type="button" class="wt-btn wt-btn-choice" id="wtCookieSave">Save choices</button>' +
      '      <button type="button" class="wt-btn wt-btn-settings" id="wtCookieClose">Cancel</button>' +
      '    </div>' +
      '  </div>' +
      '</section>';

    document.body.appendChild(root);
    return root;
  }

  function init() {
    var consent = loadConsent();
    applyAnalyticsPreference(consent ? consent.preferences.analytics : false);

    var uiRoot = buildConsentUI();

    var banner = uiRoot.querySelector('#wtCookieBanner');
    var panel = uiRoot.querySelector('#wtCookiePanel');
    var overlay = uiRoot.querySelector('#wtCookieOverlay');
    var manageButton = uiRoot.querySelector('#wtCookieManage');
    var acceptAllButton = uiRoot.querySelector('#wtCookieAcceptAll');
    var rejectButton = uiRoot.querySelector('#wtCookieRejectOptional');
    var saveButton = uiRoot.querySelector('#wtCookieSave');
    var closeButton = uiRoot.querySelector('#wtCookieClose');
    var analyticsToggle = uiRoot.querySelector('#wtCookieAnalyticsToggle');

    function showBanner() {
      banner.hidden = false;
    }

    function hideBanner() {
      banner.hidden = true;
    }

    function openPanel() {
      var current = consent ? consent.preferences : normalizePreferences();
      analyticsToggle.checked = !!current.analytics;
      hideBanner();
      panel.hidden = false;
      overlay.hidden = false;
    }

    function closePanel() {
      panel.hidden = true;
      overlay.hidden = true;
      if (!consent) {
        showBanner();
      }
    }

    function updateConsent(preferences) {
      consent = saveConsent(preferences);
      applyAnalyticsPreference(consent.preferences.analytics);
      hideBanner();
      closePanel();
      emitConsentUpdate(consent);
    }

    if (!consent) {
      showBanner();
    } else {
      hideBanner();
    }

    bindFooterSettingsLinks(openPanel);
    manageButton.addEventListener('click', openPanel);
    overlay.addEventListener('click', closePanel);
    closeButton.addEventListener('click', closePanel);

    acceptAllButton.addEventListener('click', function () {
      updateConsent({ analytics: true });
    });

    rejectButton.addEventListener('click', function () {
      updateConsent({ analytics: false });
    });

    saveButton.addEventListener('click', function () {
      updateConsent({ analytics: analyticsToggle.checked });
    });

    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        closePanel();
      }
    });

    window.WellTechCookieConsent = {
      getConsent: function () {
        return consent;
      },
      hasConsent: function (key) {
        if (!consent || !consent.preferences) return false;
        return !!consent.preferences[key];
      },
      openSettings: openPanel,
      reset: function () {
        consent = null;
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
          // Ignore localStorage errors.
        }
        deleteCookie(COOKIE_NAME);
        applyAnalyticsPreference(false);
        showBanner();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
