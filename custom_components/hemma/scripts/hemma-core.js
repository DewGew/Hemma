window.hemmaMenuGlass = {
  radius: 'var(--hemma-menu-radius, var(--ha-card-border-radius, 28px))',

  _ensure: function () {
    if (document.getElementById('hemma-menu-radius-style')) return;
    var st = document.createElement('style');
    st.id = 'hemma-menu-radius-style';
    st.textContent = '.hemma-menu-glass,.hemma-menu-glass *{'
      + 'scrollbar-width:none;-ms-overflow-style:none;}'
      + '.hemma-menu-glass ::-webkit-scrollbar{display:none;width:0;height:0;}'
      // The panel's menus, not the card radius: a dropdown is chrome and reads as
      // a different object from the cards it floats over.
      + '.hemma-menu-glass{--hemma-menu-radius:'
      + ' var(--hemma-menu-radius-desktop, 16px);'
      + '--hemma-menu-pane-auto: rgba(30,33,38,0.30);'
      + '--hemma-popup-chev-opacity: .35;'
      + '--hemma-menu-shadow: var(--hemma-elevation-floating, 0 8px 20px rgba(0,0,0,0.13));}'
      + '@media (max-width: 767px), (max-height: 500px){'
      + '.hemma-menu-glass{--hemma-menu-radius:'
      + ' var(--hemma-tile-radius-phone, 26px);'
      + '--hemma-menu-pane-auto: rgba(30,33,38,0.44);'
      + '--hemma-popup-chev-opacity: .55;'
      // The phone floats over a busy photo and needs a little more.
      + '--hemma-menu-shadow: var(--hemma-elevation-floating-phone, 0 10px 26px rgba(0,0,0,0.18));}}';
    (document.head || document.documentElement).appendChild(st);
  },

  _vars: ['--hemma-menu-pane', '--hemma-menu-edge', '--hemma-menu-rim-top',
    '--hemma-menu-rim-bottom', '--ha-card-border-radius',
    '--hemma-tile-radius-phone',
    '--hemma-popup-ui-good', '--hemma-popup-ui-warn', '--hemma-popup-ui-bad',
    '--hemma-elevation-floating', '--hemma-elevation-floating-phone',
    '--hemma-popup-ui-action', '--hemma-color-teal', '--hemma-color-blue',
    '--hemma-color-green', '--hemma-color-purple', '--hemma-color-yellow',
    '--hemma-u'],

  _theme: function (el) {
    var src = document.querySelector('home-assistant');
    if (!src) return;
    try {
      var cs = window.getComputedStyle(src);
      this._vars.forEach(function (n) {
        var v = cs.getPropertyValue(n);
        if (v && v.trim()) el.style.setProperty(n, v.trim());
      });
    } catch (e) {}
  },

  apply: function (el) {
    var b = 'blur(40px) saturate(170%)';
    this._ensure();
    el.classList.add('hemma-menu-glass');
    this._theme(el);
    el.style.borderRadius = this.radius;
    el.style.color = '#fff';
    el.style.backgroundColor = 'var(--hemma-menu-pane,'
      + ' var(--hemma-menu-pane-auto, rgba(30,33,38,0.30)))';
    el.style.backgroundImage = 'none';
    el.style.backdropFilter = b;
    el.style.webkitBackdropFilter = b;
    var edge = 'var(--hemma-menu-edge, rgba(0,0,0,0.11))';
    var rimT = 'var(--hemma-menu-rim-top, rgba(255,255,255,0.26))';
    var rimB = 'var(--hemma-menu-rim-bottom, rgba(255,255,255,0.16))';
    el.style.boxShadow = 'inset 0 1px 0 ' + rimT + ','
      + ' inset 0 -1px 0 ' + rimB + ','
      + ' inset 1px 0 0 ' + edge + ','
      + ' inset -1px 0 0 ' + edge + ','
      + ' var(--hemma-menu-shadow, 0 8px 20px rgba(0,0,0,0.13))';
  },

  enter: function (el) {
    el.style.opacity = '0';
    el.style.transformOrigin = 'top right';
    el.style.transform = 'scale(0.92) translateY(-8px)';
    requestAnimationFrame(function () {
      el.style.transition = 'opacity 200ms cubic-bezier(0.32,0.72,0,1),'
        + ' transform 260ms cubic-bezier(0.32,0.72,0,1)';
      el.style.transform = 'scale(1) translateY(0)';
      el.style.opacity = '1';
    });
  },

  exit: function (el, done) {
    el.style.transition = 'opacity 150ms cubic-bezier(0.4,0,1,1),'
      + ' transform 170ms cubic-bezier(0.4,0,1,1)';
    el.style.transform = 'scale(0.95) translateY(-6px)';
    el.style.opacity = '0';
    setTimeout(function () { if (done) done(); }, 190);
  },

  dropTop: function (rect, gap) {
    var y = rect.bottom;
    var bar = this._navRow();
    if (bar) {
      var r = bar.getBoundingClientRect();
      if (r.height && r.top <= rect.bottom) y = Math.max(y, r.bottom);
    }
    return Math.round(y + (gap == null ? 10 : gap));
  },

  _navRow: function () {
    if (this._row && this._row.isConnected) return this._row;
    this._row = null;
    var walk = function (root, depth) {
      if (!root || depth > 12 || !root.querySelectorAll) return null;
      var hit = root.querySelector('hemma-nav-bar');
      if (hit && hit.shadowRoot) return hit.shadowRoot.querySelector('.bar');
      var kids = root.querySelectorAll('*');
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].shadowRoot) {
          var f = walk(kids[i].shadowRoot, depth + 1);
          if (f) return f;
        }
      }
      return null;
    };
    try { this._row = walk(document, 0); } catch (e) {}
    return this._row;
  },

  lockScroll: function (panel, list) {
    if (!panel || panel._hemmaScrollLocked) return;
    panel._hemmaScrollLocked = true;
    panel.style.overscrollBehavior = 'contain';

    var y = 0;
    panel.addEventListener('touchstart', function (ev) {
      y = ev.touches && ev.touches[0] ? ev.touches[0].clientY : 0;
    }, { passive: true });

    // Non-passive: the whole point is to be able to preventDefault.
    panel.addEventListener('touchmove', function (ev) {
      if (!ev.touches || ev.touches.length !== 1) return;
      var dy = ev.touches[0].clientY - y;
      y = ev.touches[0].clientY;

      if (!list || !list.contains(ev.target)) { ev.preventDefault(); return; }

      var over = list.scrollHeight - list.clientHeight;
      if (over <= 0) { ev.preventDefault(); return; }

      var atTop = list.scrollTop <= 0;
      var atEnd = list.scrollTop >= over - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atEnd)) ev.preventDefault();
    }, { passive: false });
  },
};


(function () {
  if (window._hemmaSidebarSurface) return;
  window._hemmaSidebarSurface = true;

  var ID = 'hemma-sidebar-surface';

  var FILL = 'var(--hemma-sidebar-fill, rgba(0,0,0,0.42))';
  var BLUR = 'var(--hemma-sidebar-backdrop, blur(20px) saturate(1.2))';
  var SCRIM = 'var(--hemma-sidebar-scrim, rgba(0,0,0,0.24))';

  var SURFACE = [
    '  background-color: ' + FILL + ' !important;',
    '  -webkit-backdrop-filter: ' + BLUR + ';',
    '  backdrop-filter: ' + BLUR + ';',
    '  border: none !important;',
    '  box-shadow: none !important;',
  ].join('\n');

  var DRAWER_CSS = [
    '.sidebar-shell {', SURFACE, '}',
    'wa-drawer::part(dialog) {', SURFACE, '}',
  ].join('\n');

  /* The element that actually paints the modal panel. */
  var PANEL_CSS = [
    '.drawer {', SURFACE, '}',
    '.drawer::backdrop { background-color: ' + SCRIM + '; }',
  ].join('\n');

  function sheet(root, css) {
    if (!root) return false;
    var el = root.querySelector('#' + ID);
    if (el) { if (el.textContent !== css) el.textContent = css; return true; }
    var s = document.createElement('style');
    s.id = ID;
    s.textContent = css;
    root.appendChild(s);
    return true;
  }

  function findDeep(root, tag, depth) {
    if (!root || depth > 10 || !root.querySelector) return null;
    var hit = root.querySelector(tag);
    if (hit) return hit;
    var kids = root.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].shadowRoot) {
        var f = findDeep(kids[i].shadowRoot, tag, depth + 1);
        if (f) return f;
      }
    }
    return null;
  }

  var _observed = null;

  function apply() {
    var drawer = findDeep(document, 'ha-drawer', 0);
    if (!drawer || !drawer.shadowRoot) return false;
    sheet(drawer.shadowRoot, DRAWER_CSS);

    if (_observed !== drawer.shadowRoot) {
      _observed = drawer.shadowRoot;
      new MutationObserver(function () { apply(); })
        .observe(drawer.shadowRoot, { childList: true, subtree: true });
    }

    var wa = drawer.shadowRoot.querySelector('wa-drawer');
    if (wa) {
      wa.style.setProperty('--wa-color-surface-raised', FILL);
      wa.style.setProperty('--wa-color-overlay-modal', SCRIM);
      if (wa.shadowRoot) sheet(wa.shadowRoot, PANEL_CSS);
    }
    return true;
  }

  var tries = 0;
  (function tick() {
    apply();
    if (++tries < 20) setTimeout(tick, tries < 6 ? 250 : 1500);
  })();
  window.addEventListener('hass-drawer-opened', apply, true);
  window.addEventListener('location-changed', apply, true);
})();

(function () {
  if (window._hemmaHeaderHide) return;
  window._hemmaHeaderHide = true;

  var ID = 'hemma-header-hide';
  var CSS = '.header { display: none !important; }';
  var OFF = /[?&](hemma_header=1|disable_km)/.test(location.search);
  // kiosk-mode's breakpoint, so one dashboard reads the same under either.
  var NARROW = window.matchMedia('(max-width: 812px)');

  function findDeep(root, tag, depth) {
    if (!root || depth > 10 || !root.querySelector) return null;
    var hit = root.querySelector(tag);
    if (hit) return hit;
    var kids = root.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].shadowRoot) {
        var f = findDeep(kids[i].shadowRoot, tag, depth + 1);
        if (f) return f;
      }
    }
    return null;
  }

  var _root = null;
  function huiRoot() {
    if (_root && _root.isConnected && _root.shadowRoot) return _root;
    _root = findDeep(document, 'hui-root', 0);
    return _root;
  }

  function wanted(cfg) {
    var km = cfg && cfg.kiosk_mode;
    if (!km) return false;
    var m = km.mobile_settings;
    if (m && m.hide_header !== undefined && NARROW.matches) return !!m.hide_header;
    return !!km.hide_header;
  }

  var _sr = null;
  var _head = null;

  function apply() {
    var root = huiRoot();
    var sr = root && root.shadowRoot;
    if (!sr) return false;

    if (_sr !== sr) {
      _sr = sr;
      new MutationObserver(function () { apply(); }).observe(sr, { childList: true });
    }
    var head = sr.querySelector('.header');
    if (head && _head !== head) {
      _head = head;
      new MutationObserver(function () { apply(); }).observe(head, { childList: true, subtree: true });
    }

    var ll = root.lovelace || {};
    var on = !OFF && !ll.editMode && wanted(ll.config);
    var el = sr.querySelector('#' + ID);
    if (on === !!el) return true;
    if (!on) { el.remove(); return true; }
    var st = document.createElement('style');
    st.id = ID;
    st.textContent = CSS;
    sr.appendChild(st);
    return true;
  }

  function kick() {
    var n = 0;
    (function tick() {
      apply();
      if (++n < 12) setTimeout(tick, n < 5 ? 200 : 1200);
    })();
  }
  kick();
  window.addEventListener('location-changed', kick, true);
  window.addEventListener('popstate', kick, true);
  NARROW.addEventListener('change', apply);
})();

(function () {
  if (window._hemmaEnergyOn) return;
  window._hemmaEnergyOn = function (V) {
    if (!V || V.show_energy === false) return false;
    if (V.energy_power_entity) return true;
    if (V.energy_usage_today || V.energy_usage_month
      || V.energy_cost_today || V.energy_cost_month) return true;
    for (var i = 1; i <= 6; i++) if (V['energy_entity_' + i]) return true;
    return false;
  };
})();

// ── Performance mode ─────────────────────────────────────────────────────────
(function () {
  if (window._hemmaPerf) return;

  var ID = 'hemma-perf-style';
  var KEY = 'hemma_perf';
  var MODES = { off: 1, on: 1, auto: 1 };

  var DKEY = 'hemma_perf_dash';
  // Seeded from the last resolved Studio setting: it only reaches us when
  // hemma_room renders, by which time the entrance has already started.
  var dashboard = (function () {
    try { return clean(localStorage.getItem(DKEY)) || 'off'; } catch (e) { return 'off'; }
  })();
  var device = null;

  // A backdrop blur costs a full-screen readback per layer per frame. Nulling the
  // variables reaches every card: a document stylesheet cannot cross a shadow
  // boundary, but custom properties inherit through it.
  // Performance mode is about what is on screen the whole time. Popups and
  // dialogs keep their blur: they paint only while open, and the lights
  // popup has no plate, so its rows rely on that blur to read as a layer.
  var CSS = 'html{'
    + '--app-header-backdrop-filter:none!important;'
    + '--ha-card-backdrop-filter:none!important;'
    + '--hemma-toolbar-backdrop:none!important;'
    + '--hemma-glass-backdrop:none!important;'
    + '--hemma-pill-backdrop:none!important;'
    + '--hemma-pill-highlight:none!important;'
    + '--hemma-sidebar-backdrop:none!important;'
    + '--hemma-scene-chip-backdrop:none!important;'
    + '--badge-blur:0px!important;'
    + '--hemma-badge-media-backdrop:none!important;'
    + '--hemma-badge-ring-backdrop:none!important;'
    // The room photo is the one full-screen filter, and it repaints on every swap.
    + '--hemma-view-photo-filter:none!important;'
    + '--hero-img-blur:0px!important;'
    + '--hero-img-blur-mobile:0px!important;'
    + '--hemma-mobile-hero-blur:0px!important;'
    + '--hemma-card-will-change:auto!important;'
    // The entrance is the heaviest moment on a slow tablet: every tile, the
    // photo and the title compositing at once, while the page is still loading.
    + '--hemma-anim-duration:0s!important;'
    + '--hemma-anim-delay:0s!important;'
    + '--hemma-hero-anim-dur:0s!important;'
    + '--hemma-hero-anim-delay:0s!important;'
    // Opaque stand-ins, or every surface above turns into clear glass.
    + '--hemma-glass-background:var(--hemma-perf-glass-fill,rgb(44,46,52))!important;'
    + '--hemma-pill-fill:var(--hemma-perf-pill-fill,rgb(38,40,46))!important;'
    + '--hemma-sidebar-fill:var(--hemma-perf-sidebar-fill,rgb(18,20,24))!important;'
    + '--badge-background:var(--hemma-perf-badge-fill,rgb(10,12,14))!important;'
    // The tiles. rgba(0,0,0,0.40) was a tint on a blurred photo; with the
    // blur gone it is a window onto the lawn.
    + '--hemma-entity-background:var(--hemma-perf-tile-fill,rgb(32,34,38))!important;'
    + '--ha-card-background:var(--hemma-perf-card-fill,rgb(32,34,38))!important;'
    + '}';

  function clean(v) {
    v = String(v == null ? '' : v).trim().toLowerCase();
    return MODES[v] ? v : '';
  }

  // Fully Kiosk and the companion app each get one start URL, so ?hemma_perf=on
  // has to stick to the device. Every other screen in the house keeps the glass.
  function pinned() {
    var m = /[?&]hemma_perf=([a-z]+)/.exec(location.search || '');
    var v = m ? clean(m[1]) : '';
    if (v) { try { localStorage.setItem(KEY, v); } catch (e) {} return v; }
    try { return clean(localStorage.getItem(KEY)); } catch (e) { return ''; }
  }

  function weak() {
    var n = navigator || {};
    var mem = n.deviceMemory, cpu = n.hardwareConcurrency;
    if (mem && mem <= 4) return true;
    if (cpu && cpu <= 4) return true;
    // Neither is exposed on iOS, where the floor is fast enough not to guess.
    return false;
  }

  function resolve() {
    var v = pinned() || dashboard || 'off';
    if (v === 'auto') {
      if (device === null) device = weak();
      return device;
    }
    return v === 'on';
  }

  function apply() {
    var head = document.head || document.documentElement;
    var el = document.getElementById(ID);
    var want = resolve();
    if (want === !!el) return;
    if (!want) { el.remove(); return; }
    el = document.createElement('style');
    el.id = ID;
    el.textContent = CSS;
    head.appendChild(el);
  }

  window._hemmaPerf = {
    // Called from hemma_room's variable block so the Studio setting lands too.
    // The device pin still wins: the tablet is the one that knows it is slow.
    dashboard: function (v) {
      var next = clean(v) || 'off';
      try { localStorage.setItem(DKEY, next); } catch (e) {}
      if (next !== dashboard) { dashboard = next; apply(); }
      return resolve() ? '1' : '0';
    },
    on: function () { return resolve(); }
  };

  apply();
})();

// ── Now Playing collector ────────────────────────────────────────────────────
(function () {
  if (!window.HEMMA_ACTIVE_STATES) {
    window.HEMMA_ACTIVE_STATES = new Set([
      'on', 'open', 'opening', 'playing', 'unlocked', 'unlocking',
      'cleaning', 'returning', 'cool', 'heat', 'washing', 'rinsing',
      'spinning', 'drying', 'running', 'active', 'problem',
    ]);
  }

  if (!window.HEMMA_TEMPLATE_SIZES) {
    window.HEMMA_TEMPLATE_SIZES = {};
  }

  window.hemmaDeviceId = function () {
    try {
      var k = 'hemma_device_id';
      var v = localStorage.getItem(k);
      if (!v) {
        v = Math.random().toString(36).slice(2, 8);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return 'nostore';
    }
  };

  window.hemmaOverlayKey = function (eid) {
    return window.hemmaDeviceId() + '|' + String(eid || '');
  };

  // A card can render before its variables resolve, so the weather entity is
  // remembered - but per dashboard, and never on a Hemma-managed one, where
  // the config is the whole truth. The unscoped key this replaces was shared
  // by every dashboard, so a second dashboard with no weather inherited the
  // first one's sensors.
  var wxDash = function () {
    return (window.location.pathname || '').split('/').filter(Boolean)[0] || '';
  };
  window.hemmaWx = function (variables, which) {
    var v = variables || {};
    var name = which === 'temp' ? 'weather_temp_sensor' : 'weather_entity';
    var val = v[name] || '';
    var key = 'hemma_' + name + ':' + wxDash();
    try {
      if (val) localStorage.setItem(key, val);
      else if (v.hemma_ui_managed) localStorage.removeItem(key);
    } catch (e) { /* private mode */ }
    if (val) return val;
    if (v.hemma_ui_managed) return '';
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  };
  // Cards saved before the scoping still read the shared key, so it is cleared
  // on every load and the window cache is dropped whenever the dashboard changes.
  try {
    localStorage.removeItem('hemma_weather_entity');
    localStorage.removeItem('hemma_weather_temp_sensor');
  } catch (e) { /* private mode */ }
  setInterval(function () {
    var d = wxDash();
    if (window._hemmaWxDash === d) return;
    window._hemmaWxDash = d;
    window._hemmaWx = null;
    window._hemmaWxTemp = null;
    try {
      localStorage.removeItem('hemma_weather_entity');
      localStorage.removeItem('hemma_weather_temp_sensor');
    } catch (e) { /* private mode */ }
  }, 1000);

  window.HEMMA_DOMAIN_GLYPH = {
    light: 'light', switch: 'plug', input_boolean: 'plug',
    fan: 'fan', climate: 'thermostat', humidifier: 'humidifier',
    media_player: 'speaker', lock: 'lock-fill', cover: 'curtain-open',
    vacuum: 'vacuum', script: 'scenes', scene: 'scenes',
    automation: 'scenes', button: 'power_on', input_button: 'power_on',
    binary_sensor: 'motion', remote: 'tv', water_heater: 'hot_water',
    valve: 'curtain-open', siren: 'motion',
  };

  window.hemmaDomainGlyph = function (eid) {
    var dom = String(eid || '').split('.')[0];
    return window.HEMMA_DOMAIN_GLYPH[dom] || 'default';
  };

  window.HEMMA_MDI = {
    alert: 'mdi:alert', automation: 'mdi:robot', binary_sensor: 'mdi:radiobox-blank',
    button: 'mdi:gesture-tap-button', calendar: 'mdi:calendar', camera: 'mdi:video',
    climate: 'mdi:thermostat', cover: 'mdi:window-shutter', fan: 'mdi:fan',
    humidifier: 'mdi:air-humidifier', input_boolean: 'mdi:check-circle-outline',
    input_button: 'mdi:gesture-tap-button', input_number: 'mdi:ray-vertex',
    input_select: 'mdi:format-list-bulleted', input_text: 'mdi:form-textbox',
    lawn_mower: 'mdi:robot-mower', light: 'mdi:lightbulb', lock: 'mdi:lock',
    media_player: 'mdi:cast', number: 'mdi:ray-vertex', person: 'mdi:account',
    remote: 'mdi:remote', scene: 'mdi:palette', script: 'mdi:script-text',
    select: 'mdi:format-list-bulleted', sensor: 'mdi:eye', siren: 'mdi:bullhorn',
    switch: 'mdi:toggle-switch-variant', text: 'mdi:form-textbox',
    todo: 'mdi:clipboard-list', vacuum: 'mdi:robot-vacuum', valve: 'mdi:pipe-valve',
    water_heater: 'mdi:water-boiler',
  };

  function mdiDefault(states, eid) {
    var dom = String(eid || '').split('.')[0];
    var st = states && states[eid];
    var a = (st && st.attributes) || {};
    var on = st && st.state === 'on';
    var dc = a.device_class;

    if (dom === 'switch') {
      if (dc === 'outlet') return on ? 'mdi:power-plug' : 'mdi:power-plug-off';
      return on ? 'mdi:toggle-switch-variant' : 'mdi:toggle-switch-variant-off';
    }
    if (dom === 'input_boolean') {
      return on ? 'mdi:check-circle-outline' : 'mdi:close-circle-outline';
    }
    if (dom === 'automation') return on ? 'mdi:robot' : 'mdi:robot-off';
    if (dom === 'lock') {
      var ls = st && st.state;
      if (ls === 'unlocked') return 'mdi:lock-open';
      if (ls === 'jammed') return 'mdi:lock-alert';
      return 'mdi:lock';
    }
    if (dom === 'media_player') {
      if (dc === 'tv') return 'mdi:television';
      if (dc === 'speaker') return 'mdi:speaker';
      if (dc === 'receiver') return 'mdi:audio-video';
      return st && st.state === 'playing' ? 'mdi:cast-connected' : 'mdi:cast';
    }
    return window.HEMMA_MDI[dom] || 'mdi:bookmark';
  }

  window.HEMMA_ICON_TR = window.HEMMA_ICON_TR || {};
  var _trCards = [];
  var TR_KEY = 'hemma_icon_tr_v1';

  function trStore() {
    try { return JSON.parse(localStorage.getItem(TR_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function trVersion(hass) {
    return (hass && hass.config && hass.config.version) || '';
  }

  function trLoad(hass, integration) {
    var all = trStore();
    var hit = all[integration];
    if (hit && hit.v === trVersion(hass)) return hit.icons;
    return undefined;
  }

  function trSave(hass, integration, icons) {
    try {
      var all = trStore();
      all[integration] = { v: trVersion(hass), icons: icons };
      localStorage.setItem(TR_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function fetchIconTr(hass, integration) {
    if (window.HEMMA_ICON_TR[integration] !== undefined) return;
    window.HEMMA_ICON_TR[integration] = null;
    var send = hass.callWS
      ? function (m) { return hass.callWS(m); }
      : function (m) { return hass.connection.sendMessagePromise(m); };
    try {
      send({ type: 'frontend/get_icons', category: 'entity', integration: integration })
        .then(function (res) {
          var r = res && res.resources;
          var icons = (r && r[integration]) || null;
          window.HEMMA_ICON_TR[integration] = icons;
          if (icons) trSave(hass, integration, icons);
          _trCards.forEach(function (c) {
            try { if (c && c.requestUpdate) c.requestUpdate(); } catch (e) {}
          });
        }, function () {});
    } catch (e) {}
  }

  window.hemmaIconCardSeen = function (card) {
    if (card && _trCards.indexOf(card) === -1) _trCards.push(card);
  };

  window.hemmaEntityIcon = function (hass, states, eid) {
    if (!eid) return 'mdi:bookmark';
    var reg = hass && hass.entities && hass.entities[eid];
    if (reg && reg.icon) return reg.icon;

    if (hass && reg && reg.platform && reg.translation_key) {
      var tr = window.HEMMA_ICON_TR[reg.platform];
      if (tr === undefined) {
        var cached = trLoad(hass, reg.platform);
        if (cached) {
          tr = window.HEMMA_ICON_TR[reg.platform] = cached;
          // Refreshed in the background, in case the integration changed.
          setTimeout(function () {
            window.HEMMA_ICON_TR[reg.platform] = undefined;
            fetchIconTr(hass, reg.platform);
            if (!window.HEMMA_ICON_TR[reg.platform]) window.HEMMA_ICON_TR[reg.platform] = cached;
          }, 0);
        } else {
          fetchIconTr(hass, reg.platform);
        }
      }
      if (tr) {
        var dom = String(eid).split('.')[0];
        var node = tr[dom] && tr[dom][reg.translation_key];
        if (node) {
          var st = states && states[eid];
          var byState = node.state && st && node.state[st.state];
          if (byState) return byState;
          if (node.default) return node.default;
        }
      }
    }
    return mdiDefault(states, eid);
  };

  // Set outside the guard: a first-wins init would freeze this map at load.
  window.HEMMA_TEMPLATE_SIZES.hemma_entity_actions = 'large';

  // Works off the RAW config: both callers run before button-card merges templates.
  if (typeof window.hemmaCardSize !== 'function') {
    window.hemmaCardSize = function (cfg) {
      if (!cfg) return 'small';
      const direct = cfg.variables?.size;
      if (direct) return String(direct).toLowerCase() === 'large' ? 'large' : 'small';
      const tmpl = cfg.template;
      const list = Array.isArray(tmpl) ? tmpl : (tmpl ? [tmpl] : []);
      const sizes = window.HEMMA_TEMPLATE_SIZES || {};
      for (const t of list) {
        if (sizes[t] === 'large') return 'large';
      }
      return 'small';
    };
  }

  window._hemmaActions = (function () {
    var OFF = ['false', '0', 'no', 'off', 'disabled'];
    var ON_STATES = [
      'on', 'open', 'opening', 'unlocked', 'unlocking',
      'playing', 'buffering', 'home', 'connected', 'online',
      'cooling', 'heating', 'cleaning', 'running', 'active',
    ];
    var DEAD = ['unknown', 'unavailable', 'none', ''];

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function enabled(variables, idx) {
      var v = variables['action_' + idx + '_enabled'];
      var ok = (v === undefined || v === null) ? true
        : (typeof v === 'boolean') ? v
        : (typeof v === 'number') ? v !== 0
        : OFF.indexOf(String(v).trim().toLowerCase()) === -1;
      return ok && !!variables['action_' + idx + '_entity'];
    }

    function order(variables) {
      return [1, 2].filter(function (i) { return enabled(variables, i); });
    }

    function any(variables) {
      return enabled(variables, 1) || enabled(variables, 2);
    }

    // Counted from the end, so slot 0 is always the bottom pill.
    function slot(variables, idx) {
      var o = order(variables);
      var p = o.indexOf(idx);
      return p < 0 ? 0 : (o.length - 1 - p);
    }

    function stateClass(states, eid) {
      if (!eid || !states[eid]) return 'unavailable';
      var st = String(states[eid].state || '').toLowerCase().replace(/_/g, ' ');
      if (DEAD.indexOf(st) !== -1) return 'unavailable';
      return ON_STATES.indexOf(st) !== -1 ? 'active' : 'normal';
    }

    function glyph(variables, idx, states, cls, hass) {
      var eid = variables['action_' + idx + '_entity'];
      var attrs = (states[eid] && states[eid].attributes) || {};
      var raw = String(variables['action_' + idx + '_icon'] || attrs.icon || '').trim();

      if (!raw && window.hemmaEntityIcon) raw = window.hemmaEntityIcon(hass, states, eid);
      if (!raw) raw = 'mdi:bookmark';

      if (raw.indexOf(':') !== -1) {
        return '<ha-icon class="hemma-act-icon hemma-act-ha-icon ' + cls + '"'
          + ' icon="' + esc(raw) + '"></ha-icon>';
      }

      var src;
      if (/^(\/|https?:\/\/)/.test(raw) || /\.(svg|png|webp)$/.test(raw)) {
        src = raw;
      } else {
        var base = String(variables.svg_path || '/local/hemma/icons').replace(/\/$/, '');
        src = base + '/' + raw + '.svg';
      }
      return '<img class="hemma-act-icon hemma-act-svg ' + cls + '" src="' + esc(src) + '" alt="">';
    }

    function label(variables, idx, states, prefix) {
      var explicit = variables['action_' + idx + '_label'];
      if (explicit) return String(explicit);

      var eid = variables['action_' + idx + '_entity'];
      var attrs = (states[eid] && states[eid].attributes) || {};
      var name = String(attrs.friendly_name || eid || '');
      var p = String(prefix || '').trim();

      if (p && name.toLowerCase().indexOf(p.toLowerCase() + ' ') === 0) {
        var rest = name.slice(p.length).trim();
        if (rest) name = rest.charAt(0).toUpperCase() + rest.slice(1);
      }
      return name;
    }

    var FIT_REF_PX = 12;
    var fitCtx = null;
    var fitFam = null;

    function fitEm(text, weight) {
      if (!fitCtx) {
        if (!document.createElement) return 0;
        fitCtx = document.createElement('canvas').getContext('2d');
      }
      if (!fitFam) {
        fitFam = getComputedStyle(document.documentElement)
          .getPropertyValue('--primary-font-family').trim() || 'system-ui, sans-serif';
      }
      fitCtx.font = (weight || 500) + ' ' + FIT_REF_PX + 'px ' + fitFam;
      return (fitCtx.measureText(String(text)).width / FIT_REF_PX) * 1.015;
    }

    function fitStyle(variables, states, prefix) {
      var em = 0;
      try {
        order(variables).forEach(function (i) {
          var w = fitEm(label(variables, i, states, prefix), 500);
          if (w > em) em = w;
        });
      } catch (e) { return ''; }
      if (!(em > 0)) return '';
      return ' style="font-size:clamp(var(--hemma-actions-label-min, 12px),'
        + ' calc((100cqi - var(--hemma-actions-label-inset, 0px)) / ' + em.toFixed(3) + '),'
        + ' var(--hemma-actions-label-size, 15px))"';
    }

    function markup(variables, idx, states, prefix, hass) {
      if (!enabled(variables, idx)) return '';
      var cls = stateClass(states, variables['action_' + idx + '_entity']);
      var text = label(variables, idx, states, prefix);
      return '<div class="hemma-act-hit hemma-act-pill ' + cls + '" data-action-index="' + idx + '">'
        + '<span class="hemma-act-glyphbox">' + glyph(variables, idx, states, cls, hass) + '</span>'
        + '<span class="hemma-act-label"' + fitStyle(variables, states, prefix)
        + '>' + esc(text) + '</span></div>';
    }

    var TOGGLE_SCRIPT = 'script.hemma_actions_overlay_toggle';

    function moreMarkup(variables, eid) {
      if (!any(variables)) return '';
      return '<div class="hemma-act-hit hemma-act-more" role="button" aria-label="Actions"'
        + ' data-more-key="' + esc(openKey(eid)) + '">'
        + '<svg class="hemma-act-dots" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        + '<circle cx="3" cy="12" r="2.5"></circle>'
        + '<circle cx="12" cy="12" r="2.5"></circle>'
        + '<circle cx="21" cy="12" r="2.5"></circle>'
        + '</svg></div>';
    }

    function run(card, variables, idx, fallbackHass) {
      var eid = variables['action_' + idx + '_entity'];
      if (!eid) return;

      var H = (card && card._hass) || fallbackHass;
      if (!H) return;

      var action = variables['action_' + idx + '_action'] || 'more-info';

      if (action === 'more-info') {
        card.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true, composed: true, detail: { entityId: eid },
        }));
        return;
      }

      if (action === 'toggle') {
        var domain = String(eid).split('.')[0];
        if (domain) H.callService(domain, 'toggle', { entity_id: eid });
        return;
      }

      if (action === 'call-service') {
        var full = variables['action_' + idx + '_service'];
        if (!full || String(full).indexOf('.') === -1) return;
        var parts = String(full).split('.');
        var data = Object.assign({}, variables['action_' + idx + '_service_data'] || {});
        if (!data.entity_id) data.entity_id = eid;
        H.callService(parts[0], parts[1], data);
        return;
      }

      if (action === 'navigate') {
        var path = variables['action_' + idx + '_navigation_path'];
        if (!path) return;
        history.pushState(null, '', path);
        window.dispatchEvent(new CustomEvent('location-changed', { bubbles: true, composed: true }));
      }
    }

    function armRelease() {
      if (window._hemmaActReleaseArmed) return;
      window._hemmaActReleaseArmed = true;
      var clear = function () {
        var held = window._hemmaActHeld;
        window._hemmaActHeld = null;
        if (held && held.classList) held.classList.remove('pressed');
      };
      ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'blur']
        .forEach(function (t) { window.addEventListener(t, clear, true); });
    }

    function press(el, on) {
      if (!el || !el.classList) return;
      if (on) {
        var prev = window._hemmaActHeld;
        if (prev && prev !== el && prev.classList) prev.classList.remove('pressed');
        window._hemmaActHeld = el;
        el.classList.add('pressed');
      } else {
        if (window._hemmaActHeld === el) window._hemmaActHeld = null;
        el.classList.remove('pressed');
      }
    }

    function bind(card, variables, hass) {
      armRelease();
      // So a late icon-translation answer can ask this card to redraw.
      if (window.hemmaIconCardSeen) window.hemmaIconCardSeen(card);
      setTimeout(function () {
        try {
          var root = card && card.shadowRoot;
          if (!root) return;
          root.querySelectorAll('.hemma-act-hit').forEach(function (el) {
            if (el._hemmaActBound) return;
            el._hemmaActBound = true;

            el.addEventListener('click', function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              var key = el.getAttribute('data-more-key');
              if (key) {
                var H = (card && card._hass) || hass;
                if (H) H.callService('script', 'turn_on', {
                  entity_id: TOGGLE_SCRIPT, variables: { actions_entity_id: key },
                });
                return;
              }
              run(card, variables, el.getAttribute('data-action-index'), hass);
            });

            el.addEventListener('pointerdown', function (ev) {
              ev.stopPropagation();
              press(el, true);
              try {
                window.dispatchEvent(new CustomEvent('haptic', { detail: 'light' }));
              } catch (e) {}
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
              el.addEventListener(t, function () { press(el, false); });
            });

            ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (t) {
              el.addEventListener(t, function (ev) { ev.stopPropagation(); }, { passive: true });
            });
          });
        } catch (e) {}
      }, 0);
    }

    function repeat(term, n) {
      var out = '';
      for (var i = 0; i < n; i++) out += term;
      return out;
    }

    function deviceId() { return window.hemmaDeviceId(); }
    function openKey(eid) { return window.hemmaOverlayKey(eid); }

    function isOpen(variables, states, eid) {
      var t = states[variables.actions_toggle_helper];
      var a = states[variables.actions_active_helper];
      return !!(t && t.state === 'on' && a && a.state === openKey(eid));
    }

    // Safari cannot evaluate calc() over a clamp(), so every length is a sum of whole variables.
    function cornerWidth(variables, entityState) {
      if (variables.show_progress) {
        var active = variables.progress_active_states || [];
        var st = String(entityState || '').toLowerCase();
        if (active.indexOf(st) !== -1) return 'var(--hemma-progress-size-mq)';
      }
      if (variables.show_toggle) return 'var(--hemma-toggle-width)';
      return null;
    }

    function moreGeom(variables, entityState) {
      var corner = cornerWidth(variables, entityState);
      var lineTop = 'var(--hemma-icon-center-y) - var(--hemma-actions-hit) / 2';
      return {
        top: corner
          ? 'calc(' + lineTop + ')'
          : 'calc(' + lineTop + ' - var(--hemma-actions-more-inset))',
        right: corner
          ? 'calc(var(--hemma-actions-pad) + ' + corner
            + ' + var(--hemma-actions-corner-gap) - var(--hemma-actions-more-inset))'
          : 'calc(var(--hemma-actions-pad) - var(--hemma-actions-more-inset))',
        width: 'var(--hemma-actions-hit)',
        height: 'var(--hemma-actions-hit)',
      };
    }

    function pillGeom(variables, idx) {
      var s = slot(variables, idx);
      var n = Math.max(1, order(variables).length);
      var h = 'max(24px, min(var(--hemma-actions-pill-h), calc((100% - var(--hemma-actions-pad)'
        + ' - var(--hemma-icon-circle-size, 44px) - var(--hemma-actions-pill-clear, 10px)'
        + ' - var(--hemma-actions-pill-bottom)' + repeat(' - var(--hemma-actions-pill-gap)', n - 1)
        + ') / ' + n + ')))';
      return {
        top: 'calc(100% - var(--hemma-actions-pill-bottom)'
          + repeat(' - ' + h, s + 1)
          + repeat(' - var(--hemma-actions-pill-gap)', s) + ')',
        right: 'var(--hemma-actions-pad)',
        width: 'calc(100% - var(--hemma-actions-pad) - var(--hemma-actions-pad))',
        height: h,
      };
    }

    function motion(variables, states, eid, idx) {
      var open = isOpen(variables, states, eid);
      var s = slot(variables, idx);
      var step = open ? s : (order(variables).length - 1 - s);
      return {
        opacity: open ? '1' : '0',
        transform: open
          ? 'scale(1) translateY(0)'
          : 'scale(var(--hemma-actions-pill-scale, 0.94)) translateY(var(--hemma-actions-pill-rise, 6px))',
        pointerEvents: open ? 'auto' : 'none',
        duration: open
          ? 'var(--hemma-actions-dur-in, 0.30s)'
          : 'var(--hemma-actions-dur-out, 0.14s)',
        easing: open
          ? 'var(--hemma-actions-ease-in, cubic-bezier(0.32, 0.72, 0, 1))'
          : 'var(--hemma-actions-ease-out, cubic-bezier(0.4, 0, 0.7, 1))',
        delay: open ? (60 + step * 40) + 'ms' : (step * 25) + 'ms',
      };
    }

    return {
      enabled: enabled, any: any, order: order, slot: slot, stateClass: stateClass,
      markup: markup, moreMarkup: moreMarkup, run: run, bind: bind, esc: esc,
      isOpen: isOpen, motion: motion,
      deviceId: deviceId, openKey: openKey,
      cornerWidth: cornerWidth, moreGeom: moreGeom, pillGeom: pillGeom,
    };
  }());

  if (typeof window.hemmaStateFit !== 'function') {
    const emCache = new Map();
    let ctx = null;
    let fam = null;

    window.hemmaTextEm = function (text, weight) {
      const w = weight || 500;
      const key = w + '|' + text;
      const hit = emCache.get(key);
      if (hit !== undefined) return hit;
      if (!ctx) ctx = document.createElement('canvas').getContext('2d');
      if (!fam) {
        fam = getComputedStyle(document.documentElement)
          .getPropertyValue('--primary-font-family').trim() || 'system-ui, sans-serif';
      }
      // Measured at 100px and divided back down, so the result is a ratio.
      ctx.font = w + ' 100px ' + fam;
      // 2% slack for letter-spacing and sub-pixel rounding.
      const em = (ctx.measureText(String(text)).width / 100) * 1.02;
      emCache.set(key, em);
      return em;
    };

    window.hemmaStateFit = function (text, weight) {
      const t = text == null ? '' : String(text);
      if (!t) return '';
      const em = window.hemmaTextEm(t, weight);
      if (!(em > 0)) return t;
      const esc = t.replace(/[&<>"]/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
      ));
      return '<span style="display:inline-block;white-space:nowrap;font-size:min(1em,'
        + 'calc((100cqi - var(--hemma-tile-state-inset, 0px)) / ' + em.toFixed(3) + '))">'
        + esc + '</span>';
    };
  }

  if (typeof window.hemmaPsnStateTitle !== 'function') {
    const PSN_NOT_A_TITLE = new Set([
      'playing', 'paused', 'idle', 'on', 'off', 'home', 'away', 'online',
      'offline', 'standby', 'unavailable', 'unknown', 'none', 'null', '',
    ]);
    window.hemmaPsnStateTitle = (st) => !PSN_NOT_A_TITLE.has(String(st || '').trim());
  }

  if (typeof window.hemmaOptimistic !== 'function') {
    const PENDING = (window._hemmaIntent = window._hemmaIntent || {});
    const TTL = 1500;

    window.hemmaIntend = (key, value) => {
      PENDING[key] = { value: value, at: Date.now() };
    };

    window.hemmaKick = (el) => {
      if (!el) return;
      try {
        const h = el._hass || el.hass;
        if (h) el.hass = Object.assign({}, h);
        if (typeof el.requestUpdate === 'function') el.requestUpdate('_config', undefined);
      } catch (e) { /* the next state push will do it */ }
    };

    window.hemmaOptimistic = (key, state, actual) => {
      const p = PENDING[key];
      if (!p) return actual;
      const age = Date.now() - p.at;
      if (age > TTL) { delete PENDING[key]; return actual; }
      const changed = state && state.last_changed ? Date.parse(state.last_changed) : 0;
      if (changed && changed >= p.at) { delete PENDING[key]; return actual; }
      return p.value;
    };
  }

  if (!window.HEMMA_FILTER_CATEGORIES) {
    window.HEMMA_FILTER_CATEGORIES = {
      hemma_thermostat:    'climate',
      hemma_air_purifier:  'climate',
      hemma_cover:         'climate',
      hemma_fan:           'climate',
      hemma_humidifier:    'climate',
      hemma_light:         'lights',
      hemma_media:         'media',
      hemma_game:          'media',
      hemma_energy:        'energy',
      hemma_lock:          'security',
      hemma_camera:        'security',
      hemma_doorbell:      'security',   // deprecated alias for hemma_camera
      hemma_cameras:       'security',
      hemma_vacuum:        'unfiltered',
      hemma_plant:         'unfiltered',
    };
  }

  if (typeof window._hemmaSameGame !== 'function') {
    window._hemmaSameGame = function (x, y) {
      const flat = (v) => String(v || '').toLowerCase()
        .replace(/[™®©]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      const a = flat(x), b = flat(y);
      if (!a || !b) return false;
      if (a === b) return true;
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      if (!long.startsWith(short + ' ')) return false;
      return !/[0-9]/.test(long.slice(short.length));
    };
  }

  if (typeof window._hemmaPCSources !== 'function') {
    window._hemmaPCSources = function (states, V) {
      const norm = (x) => String(x ?? '').trim();
      const low = (x) => norm(x).toLowerCase();
      const dead = (v, extra) => !v ||
        ['unknown', 'unavailable', ''].concat(extra || []).includes(low(v));
      const url = (key) => {
        const s = key && states[key];
        const raw = s?.attributes?.entity_picture || s?.state;
        return (raw && String(raw).startsWith('http')) ? String(raw) : null;
      };

      const dcResolve = () => {
        const u = V.discord_user && states[V.discord_user];
        const a = (u && u.attributes) || {};
        const pick = (...xs) => xs.find((x) => x && String(x).startsWith('http')) || null;
        return {
          status: V.discord_online ? states[V.discord_online]?.state : u?.state,
          game: V.discord_game ? states[V.discord_game]?.state : a.game,
          details: V.discord_details ? states[V.discord_details]?.state
            : (a.game_details || a.game_state),
          img: V.discord_image ? url(V.discord_image)
            : pick(a.game_image_large, a.game_image_header, a.game_image_hero_capsule),
        };
      };

      // Discord: presence must not be offline (DND and idle are normal in-game).
      let discord = null;
      if (V.discord_user || (V.discord_online && V.discord_game)) {
        const d = dcResolve();
        const status = low(d.status);
        const game = norm(d.game);
        if (!dead(status, ['offline', 'none']) && !dead(game)) {
          const details = norm(d.details);
          discord = {
            game: game,
            details: dead(details) ? '' : details,
            img: d.img,
            label: norm(V.discord_label) || 'PC',
          };
        }
      }

      const stResolve = () => {
        const u = V.steam_account && states[V.steam_account];
        const a = (u && u.attributes) || {};
        const pick = (...xs) => xs.find((x) => x && String(x).startsWith('http')) || null;
        return {
          status: V.steam_online ? states[V.steam_online]?.state : u?.state,
          game: V.steam_game ? states[V.steam_game]?.state : a.game,
          img: V.steam_image ? url(V.steam_image)
            : pick(a.game_image_main, a.game_image_header, a.game_icon),
        };
      };

      let steam = null;
      if (V.steam_account || V.steam_game) {
        const t = stResolve();
        const status = low(t.status);
        const game = norm(t.game);
        const guard = !(V.steam_account || V.steam_online)
          || !dead(status, ['offline', 'none']);
        if (guard && !dead(game, ['none'])) {
          steam = {
            game: game,
            details: '',
            img: t.img,
            label: norm(V.steam_label) || 'Steam',
          };
        }
      }

      if (discord && steam && window._hemmaSameGame(discord.game, steam.game)) {
        const policy = low(V.duplicate_game) || 'discord';
        if (policy !== 'both') {
          const keepSteam = policy === 'steam';
          const win = keepSteam ? steam : discord;
          const lose = keepSteam ? discord : steam;
          if (!win.img) win.img = lose.img;
          if (!win.details) win.details = lose.details;
          if (keepSteam) discord = null; else steam = null;
        }
      }

      return { discord: discord, steam: steam };
    };
  }

  if (typeof window._hemmaPlexHidden !== 'function') {
    window._hemmaPlexHidden = function (V, user) {
      const raw = String((V || {}).plex_hide_users || '');
      const u = String(user || '').trim().toLowerCase();
      if (!raw.trim() || !u) return false;
      return raw.split(',').map((x) => x.trim().toLowerCase())
        .filter(Boolean).indexOf(u) !== -1;
    };
  }

  if (typeof window._hemmaNPSources !== 'function') {
    window._hemmaNPSources = function (states, V) {
      const norm = (x) => String(x ?? '').trim();
      const low  = (x) => norm(x).toLowerCase();
      const abs  = (u) => {
        if (!u) return null;
        const s = String(u);
        const full = s.startsWith('/') ? (location.origin + s) : s;
        // Strip Plex's cache-busting ?refresh= so images don't flash on each poll.
        try {
          const p = new URL(full, location.origin);
          // authSig signs the exact param list, so editing the query of a signed URL 401s it.
          if (p.searchParams.has('authSig')) return full;
          p.searchParams.delete('refresh');
          return p.toString();
        } catch (e) { return full; }
      };
      const ms = (t) => { const n = t ? Date.parse(t) : NaN; return Number.isFinite(n) ? n : 0; };
      const sameGame = (x, y) => {
        const flat = (v) => String(v || '').toLowerCase()
          .replace(/[\u2122\u00ae\u00a9]/g, ' ')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        const a = flat(x), b = flat(y);
        if (!a || !b) return false;
        if (a === b) return true;
        const [short, long] = a.length <= b.length ? [a, b] : [b, a];
        if (!long.startsWith(short + ' ')) return false;
        return !/[0-9]/.test(long.slice(short.length));
      };

      const pauseTimeout = Number(V.pause_timeout_minutes ?? 10);
      const out = [];

      for (let i = 1; i <= 10; i++) {
        if (!V['show_media_player_' + i]) continue;
        const eid = V['media_player_' + i];
        const s = eid && states[eid];
        if (!s) continue;

        const st = low(s.state);
        const a  = s.attributes || {};
        const rawTitle = norm(a.media_title);
        let artist = norm(a.media_artist || a.artist || a.media_album_artist);
        const hasContent = !!(rawTitle || artist);

        const feats = Number(a.supported_features || 0);
        const controls = {
          toggle: !!(feats & 16385),
          next: !!(feats & 32),
          prev: !!(feats & 16),
        };
        const hasControls = !!(controls.toggle || controls.next || controls.prev);

        let active = false;
        let pauseUntil = 0;
        if (st === 'playing' || st === 'buffering') active = true;
        else if (st === 'paused' && hasContent && hasControls) {
          if (pauseTimeout <= 0) active = true;
          else {
            pauseUntil = ms(s.last_changed) + (pauseTimeout * 60000);
            active = Date.now() <= pauseUntil;
          }
        }
        if (!active) continue;

        // Same title/artist derivation as the media player badge, to stay in sync.
        let title = rawTitle;
        if (!artist && a.media_content_type === 'tvshow') {
          const series  = norm(a.media_series_title);
          const season  = a.media_season  ? 'S' + String(a.media_season).padStart(2, '0')  : '';
          const episode = a.media_episode ? 'E' + String(a.media_episode).padStart(2, '0') : '';
          artist = [series, [season, episode].filter(Boolean).join('')].filter(Boolean).join(' · ');
        }
        if (!artist) {
          const parts = rawTitle.split(/\s+[-–—]\s+/);
          if (parts.length >= 3) {
            title = parts[parts.length - 1];
            artist = parts.slice(0, -1).join(' – ');
          }
        }

        let art = abs(a.entity_picture || a.media_image_url || a.media_album_cover_url || a.image_url);
        if (!art) {
          const app = low(a.app_name || a.source) + ' ' + low(a.app_id);
          if (app.includes('youtube')) art = '/local/hemma/icons/youtube.png';
        }

        out.push({
          key: 'mp' + i,
          kind: 'player',
          entity: eid,
          art: art,
          title: title || norm(a.friendly_name) || 'Media',
          subtitle: artist,
          source: norm(a.app_name || a.source || a.friendly_name),
          started: ms(s.last_changed),
          state: st,
          playing: st === 'playing' || st === 'buffering',
          controls: controls,
          pauseUntil: pauseUntil,
          pos: Number(a.media_position),
          dur: Number(a.media_duration),
          posAt: ms(a.media_position_updated_at),
        });
      }

      for (let i = 1; i <= 2; i++) {
        if (!V['show_plex_' + i]) continue;
        const sid = V['plex_stream_' + i];
        const sState = sid && states[sid];
        if (!sState) continue;
        const sSt = low(sState.state);
        if (sSt !== 'playing' && sSt !== 'buffering') continue;
        const a = sState.attributes || {};
        if (window._hemmaPlexHidden(V, a.user)) continue;
        const full = norm(a.full_title || a.title);
        if (!full) continue;
        // Upstream Tautulli session entity.
        const tau = sid.replace(/^(sensor\.)plex_stream_(\d+)$/, '$1plex_session_$2_tautulli');
        const pst = low((states[tau]?.state) || sState.state || '');
        if (pst !== 'playing' && pst !== 'buffering') continue;
        out.push({
          key: 'plex' + i,
          kind: 'plex',
          entity: sid,
          art: abs(a.image_url || a.entity_picture_local || a.entity_picture || a.media_image_url),
          title: full,
          subtitle: '',
          source: 'Plex · ' + (norm(a.user) || 'Unknown'),
          started: ms(sState.last_changed),
          state: 'playing',
          playing: true,
          controls: { toggle: false, next: false, prev: false },
        });
      }

      for (let i = 1; i <= 2; i++) {
        if (!V['show_psn_' + i]) continue;
        const eid = V['psn_' + i];
        const s = eid && states[eid];
        if (!s) continue;
        const st = low(s.state);
        if (['unavailable', 'unknown', 'off', 'standby', 'none', ''].includes(st)) continue;
        const a = s.attributes || {};
        // The integration's own sensor carries the game in its STATE.
        const notATitle = (window.HEMMA_PSN_NOT_A_TITLE || (window.HEMMA_PSN_NOT_A_TITLE =
          new Set(['playing', 'paused', 'idle', 'on', 'off', 'home', 'away',
            'online', 'offline', 'standby', 'unavailable', 'unknown',
            'none', 'null', ''])));
        const attrTitle = norm(a.full_title || a.media_title || a.title);
        const stateIsTitle = !attrTitle && !notATitle.has(st);
        const title = attrTitle || (stateIsTitle ? norm(s.state) : '');
        if (!title) continue;
        out.push({
          key: 'psn' + i,
          kind: 'activity',
          entity: eid,
          art: abs(a.entity_picture_local || a.entity_picture || a.image_url
            || a.media_image_url
            || (function () {
              const iid = String(eid).replace(/^sensor\./, 'image.');
              const im = states[iid];
              const iat = (im && im.attributes) || {};
              if (iat.entity_picture_local || iat.entity_picture) {
                return iat.entity_picture_local || iat.entity_picture;
              }
              if (!im || !iat.access_token) return '';
              return '/api/image_proxy/' + iid + '?token=' + iat.access_token;
            })()),
          title: title,
          subtitle: norm(a.user),
          // Friendly name ("PS5"), not a.source (verbose "PlayStation Network").
          source: norm(a.friendly_name) || norm(a.source) || 'PlayStation',
          started: ms(s.last_changed),
          state: stateIsTitle ? 'playing' : st,
          playing: stateIsTitle ? true : st === 'playing',
          controls: { toggle: false, next: false, prev: false },
        });
      }

      const dcOnline = V.discord_online;
      const dcGame = V.discord_game;
      const dcImage = V.discord_image;
      const dcDetails = V.discord_details;
      const dcU = V.discord_user && states[V.discord_user];
      const dcA = (dcU && dcU.attributes) || {};
      const dcHttp = (...xs) => xs.find((x) => x && String(x).startsWith('http')) || null;
      if (V.show_discord && (V.discord_user || (dcOnline && dcGame))) {
        // Any presence but offline counts - DND and idle are normal while gaming.
        const status = low(dcOnline ? states[dcOnline]?.state : dcU?.state);
        const live = !!status && !['offline', 'unknown', 'unavailable', 'none'].includes(status);
        const game = norm(dcGame ? states[dcGame]?.state : dcA.game);
        const dead = !game || ['unknown', 'unavailable'].includes(game.toLowerCase());
        if (live && !dead) {
          const imgS = dcImage && states[dcImage];
          const ia = (imgS && imgS.attributes) || {};
          const dcSub = dcDetails ? states[dcDetails]?.state : (dcA.game_details || dcA.game_state);
          out.push({
            key: 'discord',
            kind: 'activity',
            entity: dcImage || dcGame || V.discord_user,
            art: dcImage
              ? abs(ia.entity_picture_local || ia.entity_picture || ia.image_url
                || (function(){ const v = String(states[dcImage]?.state || ''); return /^(https?:)?\/\//.test(v) || v.charAt(0) === '/' ? v : ''; })())
              : abs(dcHttp(dcA.game_image_large, dcA.game_image_header, dcA.game_image_hero_capsule)),
            title: game,
            subtitle: norm(dcSub).replace(/^(unknown|unavailable)$/i, ''),
            source: norm(V.discord_label) || 'PC',
            started: ms((dcGame ? states[dcGame] : dcU)?.last_changed),
            state: 'playing',
            playing: true,
            controls: { toggle: false, next: false, prev: false },
          });
        }
      }

      if (V.show_steam && (V.steam_account || V.steam_game)) {
        const stU = V.steam_account && states[V.steam_account];
        const stA = (stU && stU.attributes) || {};
        const stStatus = low(V.steam_online ? states[V.steam_online]?.state : stU?.state);
        const stLive = !(V.steam_account || V.steam_online) ||
          (!!stStatus && !['offline', 'unknown', 'unavailable', 'none'].includes(stStatus));
        const game = norm(V.steam_game ? states[V.steam_game]?.state : stA.game);
        const dead = !game || ['none', 'unknown', 'unavailable'].includes(game.toLowerCase());
        if (stLive && !dead) {
          const imgS = V.steam_image && states[V.steam_image];
          const ia = (imgS && imgS.attributes) || {};
          // An override entity may be a template sensor whose STATE is the URL.
          const raw = V.steam_image
            ? (ia.entity_picture_local || ia.entity_picture || ia.image_url ||
               (String(imgS?.state || '').startsWith('http') ? imgS.state : null))
            : [stA.game_image_main, stA.game_image_header, stA.game_icon]
                .find((x) => x && String(x).startsWith('http'));
          out.push({
            key: 'steam',
            kind: 'activity',
            entity: V.steam_image || V.steam_game || V.steam_account,
            art: abs(raw),
            title: game,
            subtitle: '',
            source: norm(V.steam_label) || 'Steam',
            started: ms(states[V.steam_game || V.steam_account]?.last_changed),
            state: 'playing',
            playing: true,
            controls: { toggle: false, next: false, prev: false },
          });
        }
      }

      const dcRow = out.find((r) => r.key === 'discord');
      const stRow = out.find((r) => r.key === 'steam');
      if (dcRow && stRow && sameGame(dcRow.title, stRow.title)) {
        const policy = low(V.duplicate_game) || 'discord';
        if (policy !== 'both') {
          const win = policy === 'steam' ? stRow : dcRow;
          const lose = win === dcRow ? stRow : dcRow;
          if (!win.art) win.art = lose.art;
          if (!win.subtitle) win.subtitle = lose.subtitle;
          out.splice(out.indexOf(lose), 1);
        }
      }

      const rank = (r) => {
        const c = r.controls;
        const hasCtl = !!(c && (c.toggle || c.next || c.prev));
        const isMedia = r.kind !== 'activity';
        return (hasCtl ? 4 : 0) + (r.playing ? 2 : 0) + (isMedia ? 1 : 0);
      };
      out.sort((x, y) => (rank(y) - rank(x)) || (y.started - x.started));

      // No stability/hysteresis here by design - hold_src covers that.

      // Manual pin overrides ranking; ignored if that source is no longer active.
      const pin = String(V.pinned_key || '').trim();
      if (pin) {
        const i = out.findIndex(r => r.key === pin);
        if (i > 0) out.unshift(out.splice(i, 1)[0]);
      }
      return out;
    };
  }

  if (typeof window._hemmaNPCfgKey !== 'function') {
    window._hemmaNPCfgKey = function (V) {
      const v = V || {};
      const out = [];
      for (let i = 1; i <= 10; i++) out.push(v['media_player_' + i] || '');
      for (let i = 1; i <= 2; i++) out.push(v['plex_stream_' + i] || '', v['psn_' + i] || '');
      out.push(v.plex_hide_users || '');
      out.push(v.discord_user || '', v.discord_game || '', v.discord_online || '',
        v.discord_image || '', v.steam_account || '', v.steam_game || '',
        v.steam_online || '', v.steam_image || '');
      return out.join('|');
    };
  }

  if (typeof window._hemmaNPStore !== 'function') {
    window._hemmaNPStore = function (V, name) {
      const all = window._hemmaNPStores = window._hemmaNPStores || {};
      const k = window._hemmaNPCfgKey(V) + '|' + name;
      return all[k] = all[k] || {};
    };
  }

  if (typeof window._hemmaNPView !== 'function') {
    window._hemmaNPView = function (states, V) {
      const live = window._hemmaNP(states, V);
      const st = window._hemmaNPStore(V, 'hold');
      if (live.length) { st.last = live; st.emptyAt = 0; return live; }
      if (st.last && st.last.length) {
        if (!st.emptyAt) st.emptyAt = Date.now();
        // Comfortably past the 420ms exit animation; overshoot costs nothing.
        if (Date.now() - st.emptyAt < 900) return st.last;
      }
      return live;
    };
  }

  // Memoised per render pass - avoids re-running the sweep for every consumer.
  if (typeof window._hemmaNP !== 'function') {
    window._hemmaNP = function (states, V) {
      const artSig = (u) => {
        const t = String(u || '');
        const q = t.indexOf('?');
        if (q < 0) return t;
        const rest = t.slice(q + 1).split('&')
          .filter((p) => p.slice(0, 6) !== 'token=' && p.slice(0, 8) !== 'authSig=')
          .sort().join('&');
        return t.slice(0, q) + (rest ? '?' + rest : '');
      };
      const parts = [];
      for (let i = 1; i <= 10; i++) {
        const e = V['show_media_player_' + i] && V['media_player_' + i];
        if (e) {
          const s = states[e]; const a = s?.attributes || {};
          parts.push(e + s?.state + (a.media_title || '') +
            (a.media_position_updated_at || '') +
            artSig(a.entity_picture || a.media_image_url || a.media_album_cover_url || a.image_url));
        }
      }
      for (let i = 1; i <= 2; i++) {
        const t = V['show_plex_' + i] && V['plex_stream_' + i];
        if (t) {
          const ta = states[t]?.attributes || {};
          parts.push(t + states[t]?.state + String(ta.full_title || '') +
            String((states[t.replace(/^(sensor\.)plex_stream_(\d+)$/, '$1plex_session_$2_tautulli')]?.state) || states[t]?.state || '') +
            artSig(ta.image_url || ta.entity_picture_local || ta.entity_picture || ta.media_image_url));
        }
        const p = V['show_psn_' + i] && V['psn_' + i];
        if (p) {
          const pa = states[p]?.attributes || {};
          const pim = states[String(p).replace(/^sensor\./, 'image.')];
          const pia = (pim && pim.attributes) || {};
          parts.push(p + states[p]?.state + (pa.full_title || '') +
            artSig(pa.entity_picture_local || pa.entity_picture || pa.image_url || pa.media_image_url) +
            artSig(pia.entity_picture_local || pia.entity_picture) +
            String(pim?.state || ''));
        }
      }
      if (V.show_steam) {
        const si = states[V.steam_image];
        const sa = states[V.steam_account];
        const saa = sa?.attributes || {};
        parts.push(String(states[V.steam_online]?.state) + String(states[V.steam_game]?.state) +
          String(sa?.state || '') + String(saa.game || '') +
          artSig(si?.attributes?.entity_picture || si?.state || '') +
          artSig(saa.game_image_main || saa.game_image_header || saa.game_icon || ''));
      }
      if (V.show_discord) {
        const ia = (V.discord_image && states[V.discord_image]?.attributes) || {};
        const dcSt = String(states[V.discord_image]?.state || '');
        parts.push(String(states[V.discord_user]?.state) +
          String(states[V.discord_user]?.attributes?.game) +
          String(states[V.discord_user]?.attributes?.game_details));
        parts.push(String(states[V.discord_online]?.state) +
          String(states[V.discord_game]?.state) +
          artSig(ia.entity_picture_local || ia.entity_picture || ia.image_url || dcSt));
      }
      parts.push('pin:' + String(V.pinned_key || ''));
      const sig = parts.join('|');
      const c = window._hemmaNPStore(V, 'memo');
      if (c.sig === sig) return c.list;
      c.sig = sig;
      c.list = window._hemmaNPSources(states, V);
      return c.list;
    };
  }



    if (typeof window._hemmaNPSyncMobileRow !== 'function') {
      window._hemmaNPSyncMobileRow = function (cardEl, states) {
        const root = cardEl && cardEl.getRootNode && cardEl.getRootNode();
        const rowHost = root && root.host;
        if (!rowHost || !rowHost.shadowRoot) return;
        // Cached so a later recheck can re-run without a live slot element.
        window._hemmaNPMobileRowHostCache = rowHost;
        const shadow = rowHost.shadowRoot;

        const flipIds = ['media1','media2','media3','media4','media5','media6','media7','media8','media9'];
        const slotState = window._hemmaNPSlotState || {};
        const settled = flipIds.map(id => slotState[id]?._npHoldSrc || null);
        const activeCount = settled.filter(Boolean).length;

        const outerRoot = rowHost.getRootNode && rowHost.getRootNode();
        const outerHost = outerRoot && outerRoot.host;
        const outerTpl  = outerHost && outerHost._config && outerHost._config.template;
        const isNpCard  = outerTpl === 'hemma_mobile_now_playing'
          || (Array.isArray(outerTpl) && outerTpl.includes('hemma_mobile_now_playing'));
        if (outerHost && isNpCard) {
          const shown = activeCount > 0;
          if (outerHost._npAnyActive !== shown) {
            outerHost._npAnyActive = shown;
            const ov = shown ? 'visible' : 'hidden';
            outerHost.style.setProperty('display', 'grid', 'important');
            outerHost.style.setProperty('overflow', ov, 'important');
            outerHost.style.setProperty('grid-template-rows', shown ? '1fr' : '0fr', 'important');
            outerHost.style.setProperty('grid-template-columns', 'minmax(0,1fr)', 'important');
            outerHost.style.setProperty('opacity', shown ? '1' : '0');
            outerHost.style.setProperty('pointer-events', shown ? 'auto' : 'none');
            outerHost.style.setProperty(
              'transition',
              `grid-template-rows .5s cubic-bezier(0.32,0.72,0,1), opacity ${shown ? '.35s ease .12s' : '.25s ease'}`
            );
            const aspectRatio = outerHost.shadowRoot?.getElementById('aspect-ratio');
            if (aspectRatio) aspectRatio.style.setProperty('overflow', ov, 'important');
            const haCard = outerHost.shadowRoot?.querySelector('ha-card.button-card-main');
            if (haCard) {
              haCard.style.setProperty('min-height', '0', 'important');
              haCard.style.setProperty('overflow', ov, 'important');
            }
          }
        }

        const filter = states?.['input_select.hemma_mobile_filter']?.state ?? 'all';
        const inColumn = filter === 'media';
        const usesPeek = !inColumn && activeCount > 1;

        const gutters = '(max(var(--hemma-measured-safe-left, 0px), var(--hemma-rail-left, 16px)) + var(--hemma-rail-left, 16px))';
        const activeW = usesPeek
          ? `calc(100vw - ${gutters} - var(--np-peek, 26px))`
          : `calc(100vw - ${gutters})`;
        const activeGap = usesPeek ? 'var(--np-gap, 10px)' : '0px';

        const prevPeek = rowHost._npRowUsesPeek;
        const firstRun = prevPeek === undefined;
        rowHost._npRowUsesPeek = usesPeek;

        const curKeys = flipIds.map((_, i) => settled[i]?.key || null);
        const prevKeys = rowHost._npSlotKeys || [];
        const slotKeyChanged = new Set();
        curKeys.forEach((k, i) => { if (prevKeys[i] !== k) slotKeyChanged.add(flipIds[i]); });
        rowHost._npSlotKeys = curKeys;

        if (firstRun || prevPeek === usesPeek) {
          rowHost.style.setProperty('--np-active-w', activeW);
          rowHost.style.setProperty('--np-active-gap', activeGap);
          return;
        }

        if (rowHost._npFlipPending) {
          rowHost.style.setProperty('--np-active-w', activeW);
          rowHost.style.setProperty('--np-active-gap', activeGap);
          return;
        }
        rowHost._npFlipPending = true;

        const beforeRects = {};
        for (const id of flipIds) {
          const el = shadow.getElementById(id);
          if (el) beforeRects[id] = el.getBoundingClientRect();
        }

        rowHost.style.setProperty('--np-active-w', activeW);
        rowHost.style.setProperty('--np-active-gap', activeGap);

        const reduceMotion = window.matchMedia
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) { rowHost._npFlipPending = false; return; }

        requestAnimationFrame(() => {
          rowHost._npFlipPending = false;
          for (const id of flipIds) {
            if (slotKeyChanged.has(id)) continue;
            const el = shadow.getElementById(id);
            if (!el) continue;
            const before = beforeRects[id];
            if (!before || before.width < 2) continue;
            const after = el.getBoundingClientRect();
            if (after.width < 2) continue;
            if (Math.abs(before.width - after.width) < 1) continue;
            const ratio = before.width / after.width;
            el.style.transformOrigin = 'left center';
            try { el._npWidthFlip?.cancel(); } catch (e) {}
            el._npWidthFlip = el.animate(
              [{ transform: `scaleX(${ratio})` }, { transform: 'scaleX(1)' }],
              { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }
            );
          }
        });
      };
    }

    if (!window._hemmaNPResizeGuardInstalled) {
      window._hemmaNPResizeGuardInstalled = true;
      window.addEventListener('resize', () => {
        const slots = window._hemmaNPSlotState || {};
        for (const key of Object.keys(slots)) {
          const s = slots[key];
          try { s._npChipAnim?.cancel(); } catch (e) {}
          try { s._npShiftAnim?.cancel(); } catch (e) {}
        }
      });
    }

    if (typeof window._hemmaNPMobileRecheck !== 'function') {
      window._hemmaNPMobileRecheck = function (states) {
        const rowHost = window._hemmaNPMobileRowHostCache;
        if (!rowHost || !rowHost.isConnected) return;
        window._hemmaNPSyncMobileRow({ getRootNode: () => ({ host: rowHost }) }, states);
      };
    }

    if (typeof window._hemmaNPDesktopSettle !== 'function') {
      window._hemmaNPDesktopSettle = function (states, V) {
        const DEPART_HOLD_MS = 500;

        const raw = window._hemmaNP(states, V);
        const rawByKey = new Map(raw.map(r => [r.key, r]));
        const rawKeys = raw.map(r => r.key);

        // Keys here are slot names (psn1, mp3), which every card shares.
        const state = window._hemmaNPStore(V, 'desktop');
        state.keys = state.keys || {};

        for (const key of rawKeys) {
          const k = state.keys[key] = state.keys[key] || {};
          k.lastRecord = rawByKey.get(key);
          k.departedAt = null;
        }

        let anyPending = false;
        for (const key of Object.keys(state.keys)) {
          if (rawByKey.has(key)) continue;
          const k = state.keys[key];
          if (!k.departedAt) k.departedAt = Date.now();
          if (Date.now() - k.departedAt >= DEPART_HOLD_MS) { delete state.keys[key]; continue; }
          anyPending = true;
        }

        const departingKeys = Object.keys(state.keys).filter(k => !rawByKey.has(k));
        const orderedKeys = rawKeys.concat(departingKeys);

        for (const key of rawKeys) {
          if (rawByKey.get(key)?.state === 'paused') { anyPending = true; break; }
        }

        return { list: orderedKeys.map(k => state.keys[k].lastRecord), pending: anyPending };
      };
    }


    if (typeof window._hemmaNPPlan !== 'function') {
      window._hemmaNPPlan = function (states, V) {
        const EXIT_MS = 480;
        // Cap on waiting for artwork before opening an arrival anyway.
        const ART_CAP = 400;
        const OPEN_MIN = 60;
        const ANCHOR = 4;
        // Per card, like every other Now Playing store.
        const S = window._hemmaNPStore(V, 'plan');
        if (!S.order) Object.assign(S, {
          order: [], pos: {}, slotKeys: [], exits: [], exitSrc: {}, lastRec: {},
          changed: {}, done: {}, pending: {}, aliveN: -1, sig: null, timer: 0, gen: 0,
        });

        const live = (typeof window._hemmaNPView === 'function')
          ? window._hemmaNPView(states, V) : [];
        const now = Date.now();
        const liveKeys = live.map((x) => x && x.key).filter(Boolean);
        const sig = liveKeys.join(',');

        live.forEach((r) => {
          if (!r || !r.key) return;
          S.lastRec[r.key] = r;
          delete S.done[r.key];
        });

        const forceRender = () => {
          const targets = [window._hemmaNPRowCard, window._hemmaNPShell]
            .filter((t) => t && t.isConnected);
          for (const t of targets) {
            try {
              const h = t._hass || t.hass;
              if (h) t.hass = Object.assign({}, h);
              if (typeof t.requestUpdate === 'function') t.requestUpdate('_config', undefined);
            } catch (err) {}
          }
        };

        const alive = [];
        for (const e of S.exits) {
          if ((now - e.at) < EXIT_MS) alive.push(e);
          else S.done[e.key] = 1;
        }

        if (S.sig !== sig || alive.length !== S.aliveN) {
          S.exits = alive;
          const liveSet = {};
          liveKeys.forEach((k) => { liveSet[k] = 1; });
          const exiting = {};
          S.exits.forEach((e) => { exiting[e.key] = 1; });

          const prevOrder = S.order.slice();

          for (const k of prevOrder) {
            if (!k || liveSet[k] || exiting[k] || S.done[k]) continue;
            if (!S.lastRec[k]) continue;
            S.exits.push({ key: k, at: now });
            S.exitSrc[k] = S.lastRec[k];
            exiting[k] = 1;
          }

          // Existing sources hold their relative order; only genuinely new keys are placed.
          const order = prevOrder.filter((k) => liveSet[k] || exiting[k]);
          const fresh = [];
          for (const k of liveKeys) {
            if (order.indexOf(k) !== -1) continue;
            const rk = liveKeys.indexOf(k);
            let at = order.length;
            for (let i = 0; i < order.length; i++) {
              const oi = liveKeys.indexOf(order[i]);
              if (oi !== -1 && oi > rk) { at = i; break; }
            }
            order.splice(at, 0, k);
            fresh.push(k);
          }

          let base = ANCHOR;
          if (order.length) {
            const head = order[0];
            if (S.pos[head] !== undefined) base = S.pos[head];
            else {
              const prevHead = prevOrder.filter((k) => S.pos[k] !== undefined)[0];
              base = (prevHead !== undefined) ? (S.pos[prevHead] - 1) : ANCHOR;
            }
          }
          if (base + order.length > 9) base = 9 - order.length;
          if (base < 0) base = 0;

          const next = new Array(9).fill(null);
          const pos = {};
          order.forEach((k, i) => {
            const idx = base + i;
            if (idx >= 0 && idx < 9) { next[idx] = k; pos[k] = idx; }
          });

          const changed = {};
          for (let i = 0; i < 9; i++) {
            if ((S.slotKeys[i] || null) !== (next[i] || null)) changed['media' + (i + 1)] = true;
          }

          for (const k of Object.keys(S.exitSrc)) if (!exiting[k]) delete S.exitSrc[k];
          for (const k of Object.keys(S.pending)) if (!liveSet[k]) delete S.pending[k];

          const rowWasEmpty = !prevOrder.length;
          for (const k of fresh) {
            if (rowWasEmpty) continue;
            S.pending[k] = 1;
            const rec = S.lastRec[k];
            const art = rec && rec.art;
            let fired = false;
            const open = () => {
              if (fired) return;
              fired = true;
              setTimeout(() => {
                if (!S.pending[k]) return;
                delete S.pending[k];
                forceRender();
              }, OPEN_MIN);
            };
            if (art) {
              try {
                const img = new Image();
                img.decoding = 'async';
                img.src = art;
                if (img.decode) img.decode().then(open).catch(open);
                else { img.onload = open; img.onerror = open; }
              } catch (err) { open(); }
              setTimeout(open, ART_CAP);
            } else {
              open();
            }
          }

          S.order = order;
          S.pos = pos;
          S.slotKeys = next;
          S.changed = changed;
          S.sig = sig;
          S.aliveN = S.exits.length;
          S.gen = (S.gen || 0) + 1;

          try { clearTimeout(S.timer); } catch (err) {}
          if (S.exits.length) {
            const due = Math.min.apply(null, S.exits.map((e) => e.at + EXIT_MS));
            const delay = Math.max(30, (due - Date.now()) + 40);
            if (window._hemmaNPDebug === true) {
              console.log('%c[NP release scheduled]', 'color:#fa0', delay + 'ms');
            }
            S.timer = setTimeout(() => {
              forceRender();
              if (window._hemmaNPDebug === true) {
                console.log('%c[NP release fired]', 'color:#fa0');
              }
            }, delay);
          }
        }

        const byKey = {};
        live.forEach((r) => { if (r && r.key) byKey[r.key] = r; });
        return S.slotKeys.map((k) => (k ? (byKey[k] || S.exitSrc[k] || null) : null));
      };
    }


    // ── Plex session popup ─────────────────────────────────────────────────
    if (typeof window._hemmaPlexPopupCard !== 'function') {
      window._hemmaPlexPopupCard = function (sid, states) {
        const resolveTau = (id) => {
          if (!id) return null;
          const indexed = id.replace(/^(sensor\.)plex_stream_(\d+)$/, '$1plex_session_$2_tautulli');
          if (indexed !== id && states[indexed]) return indexed;
          const want = String(states[id]?.attributes?.full_title || '').trim();
          if (!want) return null;
          for (let n = 1; n <= 8; n++) {
            const cand = 'sensor.plex_session_' + n + '_tautulli';
            const ca = states[cand]?.attributes;
            if (ca && String(ca.full_title || '').trim() === want) return cand;
          }
          return null;
        };
        const tauEntity = resolveTau(sid) || sid || '';

        const a = states[tauEntity]?.attributes || {};

        /* Poster */
        const esc = (s) => String(s ?? '')
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

        const resolveUrl = (raw) => {
          if (!raw) return null;
          const s = String(raw);
          return s.startsWith('/') ? location.origin + s : s;
        };

        const posterUrl = resolveUrl(a.image_url);

        const posterHtml = posterUrl
          ? '<div style="position:relative;width:90px;height:135px;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.32);">'
              + '<img src="' + esc(posterUrl) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:12px;display:block;" />'
              + '<div style="position:absolute;inset:0;border-radius:12px;pointer-events:none;'
                + 'box-shadow:var(--hemma-media-poster-highlight, inset 0 1px 1px -0.5px rgba(255,255,255,0.15), inset 0 -1px 1px -0.5px rgba(255,255,255,0.05));'
                + 'background:var(--hemma-media-poster-glow-top, linear-gradient(to bottom, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.12) 10%, rgba(255,255,255,0) 38%)), '
                + 'var(--hemma-media-poster-glow-bottom, linear-gradient(to top, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.07) 10%, rgba(255,255,255,0) 35%));"></div>'
            + '</div>'
          : '<div style="width:90px;height:135px;background:rgba(255,255,255,0.07);border-radius:12px;display:flex;align-items:center;justify-content:center;"><ha-icon icon="mdi:plex" style="--mdc-icon-size:32px;color:rgba(255,255,255,0.35);"></ha-icon></div>';

        const padTop = 24;
        const padBottom = 14;

        /* Card */
        const mainCard = {
          type: 'custom:button-card',
          entity: sid || tauEntity,
          tap_action: { action: 'none' },
          show_icon: false, show_name: false, show_label: false, show_state: false,
          variables: {
            tau_entity: tauEntity,
            pad_top: padTop,
            pad_bottom: padBottom,
          },
          styles: {
            card: [
              { border: 'none' },
              { padding: '0' },
              { background: 'var(--hemma-popup-chart-fill, rgba(0,0,0,0.26))' },
              { 'border-radius': 'var(--hemma-popup-row-radius, 20px)' },
              { 'backdrop-filter': 'var(--hemma-popup-plate-backdrop, none)' },
              { '-webkit-backdrop-filter': 'var(--hemma-popup-plate-backdrop, none)' },
              { 'box-shadow': 'var(--hemma-popup-plate-shadow, none)' },
              { '--ha-card-box-shadow': 'none' },
              { '--ha-card-border-color': 'transparent' },
            ],
            grid: [
              { 'grid-template-areas': '"c"' },
              { 'grid-template-columns': '1fr' },
            ],
            custom_fields: {
              poster: [
                { position: 'absolute' },
                { top: padTop + 'px' },
                { left: '28px' },
                { 'z-index': '2' },
              ],
              c: [{ 'justify-self': 'stretch' }],
            },
          },
          extra_styles: `[[[
            const tauEid = variables?.tau_entity || entity?.entity_id || '';
            const a = states[tauEid]?.attributes || entity?.attributes || {};
            const progress = Math.min(100, Math.max(0, parseFloat(a.progress_percent || '0') || 0));
            const remSecs = (() => {
              const t = String(a.stream_remaining || '');
              if (!t) return 0;
              const p = t.split(':').map(Number);
              return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2] : p.length === 2 ? p[0]*60 + p[1] : 0;
            })();
            const isPlaying = (states[tauEid]?.state || '').toLowerCase() === 'playing';
            const totalSecs = (progress > 0 && progress < 100 && remSecs > 0)
              ? remSecs / (1 - progress / 100) : 0;
            const elapsedSecs = Math.max(0, totalSecs - remSecs);
            const animPart = (isPlaying && totalSecs > 0)
              ? \`animation: plexProgressFill \${totalSecs.toFixed(1)}s linear -\${elapsedSecs.toFixed(1)}s forwards;\`
              : '';
            return \`
              @keyframes plexProgressFill {
                from { width: 0%; }
                to { width: 100%; }
              }
              #plex-prog-fill { \${animPart} }
              :host {
                --ha-card-box-shadow: none !important;
                --button-card-box-shadow: none !important;
                --button-card-box-shadow-hover: none !important;
                --button-card-padding: 0px;
                overflow: visible !important;
              }
              ha-card {
                --ha-card-background: transparent !important;
                --card-background-color: transparent !important;
                --ha-card-box-shadow: none !important;
                --ha-card-border-color: transparent !important;
                overflow: visible !important;
                /* Here, not in styles.card: these are !important and beat an
                   inline style, so a transparent default left the player
                   floating on the room. will-change:auto because the theme's
                   will-change on ha-card makes the frost inert. */
                background: var(--hemma-popup-chart-fill, rgba(0,0,0,0.26)) !important;
                backdrop-filter: var(--hemma-popup-plate-backdrop, none) !important;
                -webkit-backdrop-filter: var(--hemma-popup-plate-backdrop, none) !important;
                border: none !important;
                border-radius: var(--hemma-popup-row-radius, 20px) !important;
                box-shadow: var(--hemma-popup-plate-shadow, none) !important;
                will-change: auto !important;
                cursor: default !important;
                position: relative !important;
                padding: 0 !important;
              }
              #container {
                padding: 0 !important;
                text-align: left !important;
                position: relative !important;
                z-index: 2 !important;
                overflow: visible !important;
              }
              /* button-card's .ellipsis class clips every custom_field tightly
               * to content, which cuts the poster's corner anti-aliasing and
               * shadow. Override #poster only - text truncation elsewhere still
               * relies on the shared class. */
              #poster { overflow: visible !important; }
              /* A phone sheet leaves the text column about 190px wide. The
                 avatar still says who is watching; the name is what does not
                 fit beside a title. */
              @media (max-width: 600px) {
                .plex-user-name { display: none !important; }
              }
              ha-ripple { display: none !important; }
              ha-card:hover { box-shadow: none !important; }
            \`;
          ]]]`,
          custom_fields: {
            poster: posterHtml,
            c: `[[[
              /* Resolution */
              const tauEid = variables?.tau_entity || entity?.entity_id || '';
              const a = states[tauEid]?.attributes || entity?.attributes || {};

              /* Helpers */
              const esc = (s) => String(s ?? '')
                .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

              /* Media Data */
              const mediaType = (a.media_type || '').toLowerCase();
              const isEpisode = mediaType === 'episode';
              const showTitle = isEpisode
                ? (a.grandparent_title || a.full_title || 'Unknown')
                : (a.title || a.full_title || 'Unknown');
              const episodeTitle = isEpisode ? (a.title || '') : '';
              const seasonEpisode = isEpisode
                ? 'S' + (a.parent_media_index || '?') + ' · E' + (a.media_index || '?')
                : (a.year ? String(a.year) : '');

              const progress = Math.min(100, Math.max(0, parseFloat(a.progress_percent || '0') || 0));

              const remSecs = (() => {
                const t = String(a.stream_remaining || '');
                if (!t) return null;
                const p = t.split(':').map(Number);
                return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2]
                     : p.length === 2 ? p[0]*60 + p[1] : null;
              })();
              const timeLeft = (remSecs == null || remSecs <= 0) ? ''
                : remSecs < 90   ? 'Less than 1 min left'
                : remSecs < 3600 ? Math.floor(remSecs/60) + ' min left'
                : Math.floor(remSecs/3600) + ' hr ' + Math.floor((remSecs%3600)/60) + ' min left';

              /* Video / Audio Formatting */
              const fmtVCodec = (c) => {
                const m = {h264:'H.264',hevc:'H.265',h265:'H.265',av1:'AV1',vp9:'VP9',vc1:'VC1',mpeg4:'MPEG-4',mpeg2video:'MPEG-2'};
                return m[(c||'').toLowerCase()] || (c||'').toUpperCase();
              };
              const fmtACodec = (c) => {
                const m = {dts:'DTS',dca:'DTS','dts-hd ma':'DTS-HD MA','dts-hd':'DTS-HD',eac3:'EAC3','e-ac-3':'EAC3',ac3:'AC3',aac:'AAC',mp3:'MP3',truehd:'TrueHD',flac:'FLAC',opus:'Opus',pcm:'PCM'};
                return m[(c||'').toLowerCase()] || (c||'').toUpperCase();
              };
              const fmtCh = (l) => {
                const m = {'7.1':'7.1','5.1':'5.1','5.1(side)':'5.1','5.1(back)':'5.1',stereo:'Stereo','2.0':'Stereo',mono:'Mono','1.0':'Mono'};
                return m[(l||'').toLowerCase()] || l || '';
              };
              const fmtRes = (r) => { const m = {'4k':'4K','8k':'8K','2k':'2K'}; return m[(r||'').trim().toLowerCase()] || (r||''); };
              const fmtVideoDR = (dr) => {
                const d = (dr||'').toLowerCase();
                if (!d) return '';
                if (d.includes('dolby vision') && d.includes('hdr10+')) return 'Dolby Vision · HDR10+';
                if (d.includes('dolby vision') && d.includes('hdr10')) return 'Dolby Vision · HDR10';
                if (d.includes('dolby vision')) return 'Dolby Vision';
                if (d.includes('hdr10+')) return 'HDR10+';
                if (d.includes('hdr10')) return 'HDR10';
                if (d.includes('hdr')) return 'HDR';
                if (d === 'sdr') return 'SDR';
                return '';
              };
              const fmtAudioExtra = (prof) => {
                const p = (prof||'').toLowerCase();
                if (!p) return '';
                if (p.includes('atmos')) return 'Dolby Atmos';
                if (p.includes('truehd')) return 'TrueHD';
                if (p.includes('dts:x') || p.includes('dts-x')) return 'DTS:X';
                if (p.includes('auro-3d')) return 'Auro-3D';
                return '';
              };

              const videoRes = fmtRes(a.stream_video_full_resolution || (a.video_resolution ? a.video_resolution+'p' : ''));
              const videoCodec = fmtVCodec(a.stream_video_codec || a.video_codec || '');
              const vBrKbps = parseInt(a.stream_video_bitrate || '0');
              const videoBitrate = vBrKbps > 0 ? (vBrKbps >= 1000 ? (vBrKbps/1000).toFixed(1)+' Mbps' : vBrKbps+' Kbps') : '';
              const videoDR = fmtVideoDR(a.stream_video_dynamic_range || a.video_dynamic_range || '');
              const hasDV = videoDR.startsWith('Dolby Vision');
              const videoDVExtra = hasDV ? 'Dolby Vision' : '';
              const videoDRLine = hasDV ? videoDR.replace('Dolby Vision · ', '').replace('Dolby Vision', '').trim() : videoDR;
              const videoStr = [videoRes, videoDRLine, videoCodec].filter(Boolean).join(' · ');

              const audioLang = a.stream_audio_language || a.audio_language || '';
              const audioCodec = fmtACodec(a.stream_audio_codec || a.audio_codec || '');
              const audioCh = fmtCh(a.stream_audio_channel_layout || a.audio_channel_layout || '');
              const audioStr = [audioLang, audioCodec, audioCh].filter(Boolean).join(' · ');
              const audioExtra = fmtAudioExtra(a.audio_profile || '');

              /* Stream Quality */
              const qualityProfile = a.quality_profile || '';
              const streamBrKbps = parseInt(a.stream_bitrate || a.bitrate || '0');
              const streamBrStr = streamBrKbps > 0
                ? (streamBrKbps >= 1000 ? (streamBrKbps/1000).toFixed(1)+' Mbps' : streamBrKbps+' Kbps')
                : '';

              /* ip_address is NOT part of hasConn: without location or the local
               * flag an address cannot tell lan from wan. Geo is tooltip-only
               * and remote-only, since Tautulli derives it from the public ip
               * even on a lan session. */
              const locRaw = String(a.location || '').toLowerCase();
              const hasConn = !!(locRaw || a.local != null);
              const isLocal = locRaw ? locRaw === 'lan' : String(a.local ?? '') === '1';
              const relayed = String(a.relayed ?? '') === '1' || String(a.relay ?? '') === '1';
              const playerStr = String(a.player || a.device || a.platform || '').trim();
              const connValue = [
                hasConn ? (isLocal ? 'Local' : 'Remote') : '',
                playerStr,
              ].filter(Boolean).join(' · ');
              const connHint = [
                (hasConn && !isLocal)
                  ? ([a.geo_city || '', a.geo_region || ''].filter(Boolean).join(', ')
                     || String(a.geo_country || ''))
                  : '',
                relayed ? 'Proxied by Plex Relay rather than served directly' : '',
              ].filter(Boolean).join(' — ');

              /* Doubled backslashes, and they must stay: this block is a template
               * literal, so the JS engine consumes escapes BEFORE button-card
               * evals it. A single \\s arrives as a bare s and matches the wrong
               * thing silently. */
              const decisionLabel = (raw) => raw === 'direct play' ? 'Direct Play'
                : raw === 'direct stream' || raw === 'copy' ? 'Direct Stream'
                : raw === 'transcode' ? 'Transcode'
                : raw ? raw.replace(/(^|\\s)\\S/g, c => c.toUpperCase()) : '';
              const decisionColor = (raw) => raw === 'direct play'
                ? 'var(--hemma-popup-primary-color,#00c3d0)'
                : raw === 'direct stream' || raw === 'copy'
                ? 'var(--hemma-popup-yellow-color,#ffd600)'
                : raw === 'transcode' ? 'var(--hemma-popup-orange-color,#ff9230)'
                : 'rgba(255,255,255,0.4)';

              /* Transcode Chips - Video */
              const tdRaw = (a.transcode_decision || a.stream_video_decision || '').toLowerCase();
              const tdLabel = decisionLabel(tdRaw);
              const tdColor = decisionColor(tdRaw);

              /* Transcode Chips - Audio */
              const adRaw = (a.stream_audio_decision || a.audio_decision || '').toLowerCase();
              const adLabel = decisionLabel(adRaw);
              const adColor = decisionColor(adRaw);

              /* An indicator, not a control: a Plex session exposes no transport.
               * 14px against the text's 13px, and a shade more alpha: these
               * glyphs fill ~15 of 24 viewBox units, so matching the numbers
               * leaves the triangle reading weedy. Optical, not arithmetic. */
              const rawState = (states[tauEid]?.state || entity?.state || '').toLowerCase();
              const svgGlyph = (inner) => '<svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink:0;display:block;fill:rgba(255,255,255,0.58);">' + inner + '</svg>';
              const stateIconHtml = rawState === 'playing'   ? svgGlyph('<path d="M8.2 4.6a1.2 1.2 0 0 0-1.85 1.01v12.78A1.2 1.2 0 0 0 8.2 19.4l10.1-6.39a1.2 1.2 0 0 0 0-2.02L8.2 4.6z"/>')
                : rawState === 'paused'     ? svgGlyph('<rect x="6" y="4.5" width="4.2" height="15" rx="1.7"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.7"/>')
                : rawState === 'buffering'  ? svgGlyph('<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>')
                : rawState === 'stopped'    ? svgGlyph('<rect x="6" y="6" width="12" height="12" rx="2.4"/>')
                : '';

              /* User. The device tooltip only earns its keep when device and
               * player actually differ ("Apple TV → Living Room") - the player
               * is on the Connection tile now, so when they match, as they do on
               * a phone, this was just "iPhone → iPhone". */
              const userName = a.user_friendly_name || a.user || '';
              const userThumb = a.user_thumb || '';
              const devName = String(a.device || '').trim();
              const deviceStr = (devName && devName !== playerStr)
                ? [devName, playerStr].filter(Boolean).join(' → ')
                : '';

              /* HTML Fragments */
              /* Rounded square rather than a circle, so the avatar matches the
               * poster beside it. The rim is an inset box-shadow - a border
               * would pull the background-image away from the rounded edge. */
              const thumbUrl = userThumb.replace(/[()'" ]/g, encodeURIComponent);
              const avatarHtml = userThumb
                ? '<div style="width:28px;height:28px;border-radius:20%;flex-shrink:0;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);background:rgba(255,255,255,0.1) url(' + thumbUrl + ') center/cover no-repeat;"></div>'
                : '<div style="width:28px;height:28px;border-radius:20%;background:rgba(255,255,255,0.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);"><ha-icon icon="mdi:account" style="--mdc-icon-size:16px;width:16px;height:16px;color:rgba(255,255,255,0.45);"></ha-icon></div>';

              const userBlock = (userName || userThumb)
                ? '<div style="display:flex;align-items:center;gap:9px;flex-shrink:0;"'
                    + (deviceStr ? ' title="' + esc(deviceStr) + '"' : '') + '>'
                    + (userName ? '<span class="plex-user-name" style="font-size:13px;font-weight:500;letter-spacing:-0.08px;color:rgba(255,255,255,0.72);white-space:nowrap;">' + esc(userName) + '</span>' : '')
                    + avatarHtml
                  + '</div>'
                : '';

              /* Type scale */
              const fsTitle = 'clamp(18px, 4.6vw, 20px)';
              const fsMeta = '14px';
              const fsValue = '15px';
              const fsCaption = '13px';

              const tilePrimary = 'var(--hemma-popup-tiles-text-primary, rgba(255,255,255,0.95))';
              const tileSecondary = 'var(--hemma-popup-tiles-text-secondary, rgba(255,255,255,0.75))';
              const tileMuted = 'var(--hemma-popup-tiles-text-muted, rgba(255,255,255,0.52))';

              /* Glass tiles */
              /* Flat. These sit INSIDE the player's own plate, so they get a
                 fill and nothing else: a specular rim would make them read as
                 glass objects resting on a surface that is not glass, and a
                 drop shadow inside a shadowed plate just muddies both. */
              const tileStyle = 'display:flex;flex-direction:column;box-sizing:border-box;'
                + 'flex:1 1 calc(50% - 4px);min-width:min(100%, 220px);'
                + 'padding:18px 18px 16px 18px;'
                + 'border-radius:var(--hemma-popup-row-radius, 20px);'
                + 'background:var(--hemma-media-tile-fill, rgba(255,255,255,0.055));';

              const tileHead = (icon, label, status, statusColor) =>
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;">'
                  + '<div style="display:flex;align-items:center;gap:7px;min-width:0;">'
                    + '<ha-icon icon="' + icon + '" style="--mdc-icon-size:14px;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:' + tileMuted + ';"></ha-icon>'
                    + '<span style="font-size:' + fsCaption + ';font-weight:400;letter-spacing:-0.01em;white-space:nowrap;color:' + tileSecondary + ';">' + esc(label) + '</span>'
                  + '</div>'
                  + (status ? '<span style="font-size:' + fsCaption + ';font-weight:500;letter-spacing:-0.01em;white-space:nowrap;color:' + statusColor + ';">' + esc(status) + '</span>' : '')
                + '</div>';

              const tileValue = (text) =>
                '<span style="font-size:' + fsValue + ';font-weight:500;line-height:1.35;letter-spacing:-0.2px;color:' + tilePrimary + ';">' + esc(text) + '</span>';

              const tileSub = (text) => text
                ? '<span style="font-size:' + fsCaption + ';font-weight:400;line-height:1.3;margin-top:4px;color:' + tileMuted + ';">' + esc(text) + '</span>'
                : '';

              const videoTile = '<div style="' + tileStyle + '">'
                + tileHead('mdi:movie-open-outline', 'Video', tdLabel, tdColor)
                + tileValue(videoStr || '—')
                + tileSub(videoDVExtra)
              + '</div>';

              const audioTile = '<div style="' + tileStyle + '">'
                + tileHead('mdi:volume-high', 'Audio', adLabel, adColor)
                + tileValue(audioStr || '—')
                + tileSub(audioExtra)
              + '</div>';

              const qualityTile = '<div style="' + tileStyle + '">'
                + tileHead('mdi:quality-high', 'Quality', '', '')
                + tileValue([qualityProfile, streamBrStr].filter(Boolean).join(' · ') || '—')
              + '</div>';

              /* Relay gets the status slot rather than a line of its own - it is
               * the same kind of fact as Transcode, and worth the orange: a
               * relayed stream is proxied by Plex instead of coming from the
               * server directly, and is bandwidth-capped. */
              const connectionTile = '<div style="' + tileStyle + '"'
                  + (connHint ? ' title="' + esc(connHint) + '"' : '') + '>'
                + tileHead(isLocal ? 'mdi:lan-connect' : 'mdi:earth', 'Connection',
                    relayed ? 'Relayed' : '', 'var(--hemma-popup-orange-color,#ff9230)')
                + tileValue(connValue || '—')
              + '</div>';

              /* Scrubber */
              const progressHtml = '<div style="margin-top:14px;height:4px;border-radius:999px;overflow:hidden;background:var(--hemma-popup-progress-track, rgba(255,255,255,0.16));">'
                + '<div id="plex-prog-fill" style="height:100%;width:' + progress.toFixed(1) + '%;border-radius:999px;background:linear-gradient(90deg,#D28512,#e5a00d 55%,#F2BC1A);"></div>'
              + '</div>';

              /* Keep every line single-line: the poster is pinned 50px from the
               * top while this column centres against a 135px spacer, so a
               * taller column slides out from under it. */
              return '<div style="text-align:left;position:relative;">'
                + '<div style="padding:' + (variables?.pad_top ?? 24) + 'px 28px 26px 28px;display:flex;align-items:center;gap:20px;">'
                  + '<div style="width:90px;height:135px;flex-shrink:0;"></div>'
                  + '<div style="display:flex;flex-direction:column;min-width:0;flex:1;text-align:left;">'
                    /* The title gets the whole line - it is the one thing here that
                       must not be cut. Who is watching is secondary, so it drops
                       to the metadata line's trailing edge. */
                    /* The title wraps rather than truncating, which is what lets the
                       viewer share the row. On a phone the name drops and the
                       avatar stands alone. */
                    + '<div style="display:flex;align-items:flex-start;gap:12px;">'
                      + '<div style="flex:1;min-width:0;font-size:' + fsTitle + ';font-weight:700;letter-spacing:-0.4px;color:#fff;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + esc(showTitle) + '</div>'
                      + '<div style="flex:none;">' + userBlock + '</div>'
                    + '</div>'
                    + (episodeTitle ? '<div style="font-size:' + fsMeta + ';font-weight:500;letter-spacing:-0.2px;color:rgba(255,255,255,0.8);line-height:1.35;margin-top:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(episodeTitle) + '</div>' : '')
                    + (seasonEpisode ? '<div style="font-size:' + fsMeta + ';font-weight:400;letter-spacing:-0.2px;color:rgba(255,255,255,0.5);line-height:1.35;margin-top:10px;">' + esc(seasonEpisode) + '</div>' : '')
                    + progressHtml
                    + (timeLeft ? '<div style="display:flex;align-items:center;gap:6px;margin-top:9px;">'
                        + stateIconHtml
                        + '<span style="font-size:' + fsCaption + ';font-weight:400;letter-spacing:-0.08px;color:rgba(255,255,255,0.5);">' + esc(timeLeft) + '</span>'
                      + '</div>' : '')
                  + '</div>'
                + '</div>'
                + '<div style="padding:0 28px ' + (variables?.pad_bottom ?? 14) + 'px 28px;display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;">'
                  + videoTile
                  + audioTile
                  + qualityTile
                  + connectionTile
                + '</div>'
              + '</div>';
            ]]]`,
          },
        };

        return mainCard;
      };
    }
})();

// ── Mobile wallpaper ─────────────────────────────────────────────────────────
(function () {
  const MOBILE_MQ = window.matchMedia('(max-width: 767px), (max-height: 500px)');
  const MOBILE_RE = /^\/[^/]*[-_]mobile(\/|$)/i;
  const WALLPAPER_JS = 3;
  if ((window.__hemmaWallpaperJs || 0) >= WALLPAPER_JS) return;
  window.__hemmaWallpaperJs = WALLPAPER_JS;
  try {
    document.documentElement.style.setProperty(
      '--hemma-wallpaper-js', String(WALLPAPER_JS));
  } catch (e) {}

  // Phone landscape needs its own query: MOBILE_MQ matches 393x852 and 852x393 alike.
  const LANDSCAPE_MQ = window.matchMedia('(orientation: landscape) and (max-height: 500px)');

  // ── Background injection ─────────────────────────────────────────────────────

  const SAFE = 'env(safe-area-inset-top, 0px)';
  const off = (v) => `calc(${v} + ${SAFE})`;

  const BG = {
    image:
      'linear-gradient(to bottom,'
      + ' var(--hemma-mobile-hero-tint-top, rgba(170,170,170,0.30)) 0%,'
      + ' var(--hemma-mobile-hero-tint-bot, rgba(170,170,170,0.12))'
      + ` ${off('var(--hemma-mobile-hero-wash-mid, 34%)')},`
      + ` transparent ${off('var(--hemma-mobile-hero-wash-end, 70%)')}),`
      // Same order as the card's ::before, or the two meshes disagree.
      + ' radial-gradient('
      + ' var(--hemma-mobile-hero-mesh-a-size, 120% 46%) at'
      + ' var(--hemma-mobile-hero-mesh-a-pos, 18% 58%),'
      + ' var(--hemma-mobile-hero-mesh-a, transparent) 0%,'
      + ' transparent 72%),'
      + ' radial-gradient('
      + ' var(--hemma-mobile-hero-mesh-b-size, 130% 50%) at'
      + ' var(--hemma-mobile-hero-mesh-b-pos, 88% 92%),'
      + ' var(--hemma-mobile-hero-mesh-b, transparent) 0%,'
      + ' transparent 70%),'
      + ' linear-gradient(var(--hemma-mobile-hero-angle, 190deg),'
      + ` transparent ${off('var(--hemma-mobile-hero-fade-start, 0%)')},`
      + ' var(--hemma-mobile-hero-c-handoff, #967f67)'
      + ` ${off('var(--hemma-mobile-hero-p-handoff, 33%)')},`
      + ' var(--hemma-mobile-hero-c-upper, #7e6d59)'
      + ` ${off('var(--hemma-mobile-hero-p-upper, 43%)')},`
      + ' var(--hemma-mobile-hero-c-mid, #685a4b)'
      + ` ${off('var(--hemma-mobile-hero-p-mid, 63%)')},`
      + ' var(--hemma-mobile-hero-c-lower, #51473d)'
      + ` ${off('var(--hemma-mobile-hero-p-lower, 83%)')},`
      + ' var(--hemma-mobile-hero-c-base, #3b352e)'
      + ` ${off('var(--hemma-mobile-hero-p-base, 100%)')}),`
      + ' var(--hemma-mobile-hero-img, url("/local/hemma/rooms/home-demo.jpg"))',
    sizePortrait: '100% 100%, 100% 100%, 100% 100%, 100% 100%, auto '
      + off('var(--hemma-mobile-hero-height, 36.5%)'),
    sizeLandscape: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% auto',
    position: '0 0, 0 0, 0 0, 0 0, '
      + 'var(--hemma-mobile-hero-x, 50%) var(--hemma-mobile-hero-y, 0%)',
    color: 'var(--hemma-mobile-hero-floor, #3b352e)',
  };

  function applyHtmlBackground() {
    if (!MOBILE_MQ.matches) return;
    const h = document.documentElement;
    if (!MOBILE_RE.test(window.location.pathname)) {
      h.style.backgroundImage = 'none';
      h.style.backgroundColor = 'var(--primary-background-color, #0d1117)';
      return;
    }
    h.style.backgroundImage    = BG.image;
    h.style.backgroundSize     = LANDSCAPE_MQ.matches ? BG.sizeLandscape : BG.sizePortrait;
    h.style.backgroundPosition = BG.position;
    h.style.backgroundRepeat   = 'no-repeat';
    h.style.backgroundColor    = BG.color;
  }

  // ── Gradient sampling ────────────────────────────────────────────────────────
  const SAMPLE_KEYS = ['handoff', 'upper', 'mid', 'lower', 'base'];
  // VERSIONED: bump this whenever paletteFrom's shape changes, or a cached palette wins forever.
  const CACHE_PREFIX = 'hemma-hero-sample:v2:';
  const CACHE_ROOT = 'hemma-hero-sample:';

  const CACHE_FIELDS = SAMPLE_KEYS.concat(['meshA', 'meshB']);

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_ROOT) && !k.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {}

  const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const hex = (c) => '#' + c.map((v) => clamp8(v).toString(16).padStart(2, '0')).join('');
  const mute = (c, k) => { const l = lum(c); return c.map((v) => v + (l - v) * k); };
  const atLum = (c, target) => { const l = lum(c) || 1; return c.map((v) => v * target / l); };
  const warmth = (c) => c[0] - c[2];

  function readVarUrl(name) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    const m = raw && raw.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
    return m ? m[1] : null;
  }

  function handoffRow() {
    const cs = getComputedStyle(document.documentElement);
    const pct = (name, dflt) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v / 100 : dflt;
    };
    const photoFrac = pct('--hemma-mobile-hero-height', 0.31);
    const pHandoff = pct('--hemma-mobile-hero-p-handoff', 0.30);
    if (!Number.isFinite(photoFrac) || photoFrac <= 0) return 0.85;
    return Math.max(0.05, Math.min(1, pHandoff / photoFrac));
  }

  function paletteFrom(img, slot) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return null;
    const w = 64, h = Math.max(8, Math.round(w * ih / iw));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    let data;
    try { data = ctx.getImageData(0, 0, w, h).data; } catch (e) { return null; }

    const band = (y0, y1) => {
      const a = Math.max(0, Math.floor(y0 * h));
      const b = Math.min(h, Math.max(a + 1, Math.ceil(y1 * h)));
      let r = 0, g = 0, bl = 0, n = 0;
      for (let y = a; y < b; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; bl += data[i + 2]; n++;
        }
      }
      return n ? [r / n, g / n, bl / n] : [128, 128, 128];
    };

    const row = Math.min(handoffRow(), 0.92);
    const handoff = band(row - 0.06, row + 0.02);
    // The subject: the house fills the middle of a home photo.
    const body = band(0.30, 0.75);

    const cs = getComputedStyle(document.documentElement);
    const num = (name, dflt) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : dflt;
    };
    const lift = num('--hemma-mobile-hero-sample-lift', 0.86);
    const depth = num('--hemma-mobile-hero-sample-depth-' + slot, slot === 'night' ? 0.47 : 0.60);
    const muteTop = num('--hemma-mobile-hero-sample-mute-top', 0.41);
    const muteBase = num('--hemma-mobile-hero-sample-mute-base', 0.63);

    const anchor = (slot === 'night')
      ? (warmth(handoff) <= warmth(body) ? handoff : body)
      : (warmth(body) >= warmth(handoff) ? body : handoff);

    const lStart = lift * (lum(handoff) + lum(body)) / 2;
    const lEnd = Math.max(16, lStart * depth);

    let meshOut = null;

    // ── Mesh fields ──────────────────────────────────────────────────────
    const cell = (x0, x1, y0, y1) => {
      const a = Math.max(0, Math.floor(y0 * h)), b = Math.min(h, Math.ceil(y1 * h));
      const c = Math.max(0, Math.floor(x0 * w)), d = Math.min(w, Math.ceil(x1 * w));
      let r = 0, g = 0, bl = 0, n = 0;
      for (let y = a; y < b; y++) {
        for (let x = c; x < d; x++) {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; bl += data[i + 2]; n++;
        }
      }
      return n ? [r / n, g / n, bl / n] : null;
    };
    const mTop = num('--hemma-mobile-hero-mesh-sample-top', 55) / 100;
    const mBot = num('--hemma-mobile-hero-mesh-sample-bottom', 94) / 100;
    const ROWS = 3, COLS = 6;
    const span = Math.max(0.01, (mBot - mTop) / ROWS);
    const cells = [];
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        const c = cell(gx / COLS, (gx + 1) / COLS, mTop + gy * span, mTop + (gy + 1) * span);
        if (c) cells.push(c);
      }
    }
    if (cells.length >= 2) {
      cells.sort((p, q) => warmth(p) - warmth(q));
      const half = Math.max(1, Math.floor(cells.length / 2));
      const meanOf = (arr) => [0, 1, 2].map((i) =>
        arr.reduce((t, c) => t + c[i], 0) / arr.length);
      const cooler = meanOf(cells.slice(0, half));
      const warmer = meanOf(cells.slice(-half));

      const lMesh = lum(body) * num('--hemma-mobile-hero-mesh-lum', 0.95);
      const kMesh = num('--hemma-mobile-hero-mesh-mute', 0.45);
      const aA = num('--hemma-mobile-hero-mesh-a-alpha-' + slot, 0.46);
      const aB = num('--hemma-mobile-hero-mesh-b-alpha-' + slot, 0.42);
      const asRgba = (c, alpha) => {
        const v = mute(atLum(c, lMesh), kMesh).map(clamp8);
        return `rgba(${v[0]},${v[1]},${v[2]},${alpha})`;
      };
      meshOut = { a: asRgba(warmer, aA), b: asRgba(cooler, aB) };
    }

    const pal = {};
    if (meshOut) { pal.meshA = meshOut.a; pal.meshB = meshOut.b; }
    SAMPLE_KEYS.forEach((k, i) => {
      const t = i / (SAMPLE_KEYS.length - 1);
      pal[k] = hex(mute(atLum(anchor, lStart + (lEnd - lStart) * t),
                        muteTop + (muteBase - muteTop) * t));
    });
    return pal;
  }

  function publish(slot, pal) {
    if (!pal) return;
    const h = document.documentElement;
    SAMPLE_KEYS.forEach((k) => h.style.setProperty(`--hemma-sampled-${slot}-${k}`, pal[k]));
    if (pal.meshA) h.style.setProperty(`--hemma-sampled-${slot}-mesh-a`, pal.meshA);
    if (pal.meshB) h.style.setProperty(`--hemma-sampled-${slot}-mesh-b`, pal.meshB);
  }

  function sampleInto(slot, url) {
    if (!url) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const key = `${CACHE_PREFIX}${url}|${slot}|${handoffRow().toFixed(2)}`;
      let pal = null;
      try {
        const hit = JSON.parse(localStorage.getItem(key) || 'null');
        if (hit && CACHE_FIELDS.every((f) => typeof hit[f] === 'string')) pal = hit;
      } catch (e) {}
      if (!pal) {
        pal = paletteFrom(img, slot);
        try { if (pal) localStorage.setItem(key, JSON.stringify(pal)); } catch (e) {}
      }
      publish(slot, pal);
    };
    img.onerror = () => {};
    img.src = url;
  }

  let _sampledFor = null;
  function sampleWallpapers(attempt) {
    if (!MOBILE_MQ.matches) return;
    const day = readVarUrl('--hemma-mobile-hero-img-day');
    const night = readVarUrl('--hemma-mobile-hero-img-night');
    if (!day && !night) {
      if ((attempt || 0) < 20) setTimeout(() => sampleWallpapers((attempt || 0) + 1), 250);
      return;
    }
    const sig = `${day}|${night}|${handoffRow().toFixed(2)}`;
    if (sig === _sampledFor) return;
    _sampledFor = sig;
    sampleInto('day', day);
    sampleInto('night', night);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  function init() {
    applyHtmlBackground();
    sampleWallpapers();
  }

  function waitForHA() {
    if (document.querySelector('home-assistant')) {
      init();
    } else {
      requestAnimationFrame(waitForHA);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForHA);
  } else {
    waitForHA();
  }

  window.addEventListener('location-changed', () => setTimeout(applyHtmlBackground, 50), true);
  window.addEventListener('popstate', () => setTimeout(applyHtmlBackground, 50), true);
  MOBILE_MQ.addEventListener('change', () => { applyHtmlBackground(); sampleWallpapers(); });
  window.addEventListener('orientationchange', () => setTimeout(() => {
    applyHtmlBackground();
    sampleWallpapers();
  }, 120));
  LANDSCAPE_MQ.addEventListener('change', applyHtmlBackground);
  // The wallpaper is keyed on dark mode, so repaint when the OS flips it.
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', applyHtmlBackground);
})();


// ── Navigation ───────────────────────────────────────────────────────────────
(function () {
  if (customElements.get('hemma-nav')) return;

  const CHEVRON =
    "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%3E" +
    "%3Cpath%20d%3D'M8.59%2C16.58L13.17%2C12L8.59%2C7.41L10%2C6L16%2C12L10%2C18L8.59%2C16.58Z'%2F%3E%3C%2Fsvg%3E";

  const MENU_CSS = `
    .hemma-nav-menu > button { background: transparent; transition: background .12s ease; }
    .hemma-nav-menu > button:hover { background: rgba(255,255,255,0.14); }
    @media (prefers-reduced-motion: reduce) {
      .hemma-nav-menu > button { transition: none; }
    }
  `;

  function ensureMenuCss() {
    if (document.getElementById('hemma-nav-menu-css')) return;
    const el = document.createElement('style');
    el.id = 'hemma-nav-menu-css';
    el.textContent = MENU_CSS;
    document.head.appendChild(el);
  }

  const tplCache = new Map();

  function isTpl(v) {
    return typeof v === 'string' && v.trim().slice(0, 3) === '[[[';
  }

  function compile(src) {
    if (tplCache.has(src)) return tplCache.get(src);
    let fn = null;
    try {
      const body = String(src).trim().replace(/^\[\[\[/, '').replace(/\]\]\]$/, '');
      fn = new Function('hass', 'states', 'entity', 'variables', body);
    } catch (_) {}
    tplCache.set(src, fn);
    return fn;
  }

  function evalTpl(src, hass, fallback) {
    const fn = compile(src);
    if (!fn) return fallback;
    try {
      const r = fn(hass, hass && hass.states, null, {});
      return r === undefined ? fallback : r;
    } catch (_) {
      return fallback;
    }
  }

  function resolve(v, hass, fallback) {
    return isTpl(v) ? evalTpl(v, hass, fallback) : (v === undefined ? fallback : v);
  }

  function normalize(p) {
    return String(p || '').replace(/\/+$/, '') || '/';
  }

  function navigate(url) {
    if (!url) return;
    if (normalize(url) === normalize(location.pathname)) return;
    history.pushState(null, '', url);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  function fire(node, type, detail) {
    node.dispatchEvent(new CustomEvent(type, {
      detail: detail, bubbles: true, composed: true,
    }));
  }

  class HemmaNavBar extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._hass    = null;
      this._config  = null;
      this._routes  = [];
      this._els     = [];
      this._built   = false;
      this._path    = normalize(location.pathname);
      this._menu    = null;
      this._onRoute  = () => this._syncRoute();
      this._onResize = () => { this._syncHeaderOffset(); this._placeIndicator(true); };
    }

    static getStubConfig() { return { variant: 'desktop', routes: [] }; }

    setConfig(config) {
      if (!config || !Array.isArray(config.routes)) {
        throw new Error('hemma-nav: routes array required');
      }
      this._config  = config;
      this._variant = config.variant === 'tablet' ? 'tablet' : 'desktop';
      this._routes  = config.routes.slice();
      this._sig     = JSON.stringify([this._variant, this._routes]);
      this._built   = false;
      this.shadowRoot.innerHTML = '';
      if (this.isConnected) this._build();
    }

    updateConfig(config) {
      if (!config || !Array.isArray(config.routes)) return;
      const sig = JSON.stringify([
        config.variant === 'tablet' ? 'tablet' : 'desktop', config.routes,
      ]);
      if (sig === this._sig) return;
      this.setConfig(config);
      if (this.isConnected && !this._built) this._build();
      this._syncRoute();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._built) return;
      this._syncBadges();
      if (this._menu) this._menu._refresh && this._menu._refresh();
    }

    get hass() { return this._hass; }

    getCardSize() { return 1; }

    connectedCallback() {
      window.addEventListener('location-changed', this._onRoute, true);
      window.addEventListener('popstate', this._onRoute, true);
      window.addEventListener('resize', this._onResize);
      if (this._config && !this._built) this._build();
      this._syncRoute();
      this._syncHeaderOffset();
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        this._syncHeaderOffset();
        this._placeIndicator();
      });
      if (document.fonts && document.fonts.ready && !HemmaNavBar._fontsReady) {
        document.fonts.ready.then(() => {
          HemmaNavBar._fontsReady = true;
          this._placeIndicator(true);
        }).catch(() => {});
      }
    }

    disconnectedCallback() {
      window.removeEventListener('location-changed', this._onRoute, true);
      window.removeEventListener('popstate', this._onRoute, true);
      window.removeEventListener('resize', this._onResize);
      this._closeMenu();
    }


    _build() {
      const root = this.shadowRoot;
      root.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = this._css();
      root.appendChild(style);

      const bar = document.createElement('div');
      bar.className = 'bar';
      // The glass is a SIBLING of the routes, never their ancestor: an ancestor kills backdrop-filter.
      const glass = document.createElement('div');
      glass.className = 'glass';
      bar.appendChild(glass);
      if (this._variant === 'tablet') {
        const rim = document.createElement('div');
        rim.className = 'rim';
        bar.appendChild(rim);
      }
      const scroller = document.createElement('div');
      scroller.className = 'scroller';
      bar.appendChild(scroller);
      if (this._variant === 'tablet') {
        const flash = document.createElement('div');
        flash.className = 'flash';
        bar.appendChild(flash);
        bar.addEventListener('pointerdown', (ev) => this._flash(ev), true);
        this._flashEl = flash;
      }
      root.appendChild(bar);

      const indicator = document.createElement('div');
      indicator.className = 'indicator instant';
      const fill = document.createElement('div');
      fill.className = 'fill';
      indicator.appendChild(fill);
      scroller.appendChild(indicator);
      this._fill = fill;

      this._bar       = bar;
      this._scroller  = scroller;
      this._indicator = indicator;
      this._els       = [];

      this._routes.forEach((route, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'route';
        btn.setAttribute('role', 'link');

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = route.label || '';
        btn.appendChild(label);

        const badge = document.createElement('span');
        badge.className = 'badge';
        btn.appendChild(badge);

        if (this._isMenuRoute(route)) btn.setAttribute('data-has-popup', '');

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._activate(route, btn);
        });

        scroller.appendChild(btn);
        this._els.push({ btn: btn, label: label, badge: badge, route: route });
      });

      this._built = true;
      this._syncRoute();
      this._syncBadges();
    }

    _isMenuRoute(route) {
      if (route.menu) return true;
      const ta = route.tap_action;
      return !!(ta && ta.action === 'open-popup');
    }

    _activate(route, btn) {
      if (this._isMenuRoute(route)) {
        if (this._menu && this._menu._owner === btn) { this._closeMenu(); return; }
        this._closeMenu();
        this._openMenu(route, btn);
        return;
      }
      const ta = route.tap_action;
      const to = route.url || (ta && ta.action === 'navigate' && ta.navigation_path) || null;
      if (!to) return;
      if (this._variant !== 'tablet') { navigate(to); return; }
      const idx = this._els.findIndex((el) => el.btn === btn);
      if (idx >= 0 && idx !== this._activeIdx) {
        this._els.forEach((el, i) => el.btn.classList.toggle('active', i === idx));
        this._activeIdx = idx;
        this._placeIndicator();
      }
      requestAnimationFrame(() => requestAnimationFrame(() => navigate(to)));
    }

    // The phone capsule's tap: light blooms from the thumb, rises fast and leaves slowly.
    _flash(ev) {
      const f = this._flashEl;
      if (!f || !this._bar || !f.animate) return;
      const r = this._bar.getBoundingClientRect();
      const x = r.width ? Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)) : 50;
      f.style.background = 'radial-gradient(90px circle at ' + x.toFixed(1) + '% 50%,'
        + ' rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0) 100%)';
      f.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25, easing: 'cubic-bezier(0.4,0,0.6,1)' }, { opacity: 0 }],
        { duration: 560, easing: 'ease-out' });
    }

    _syncRoute() {
      if (!this._built) return;
      const path = normalize(location.pathname);
      this._path = path;

      let bestIdx = -1;
      let bestLen = -1;
      this._els.forEach((el, i) => {
        const u = el.route.url ? normalize(el.route.url) : null;
        if (!u) return;
        if (path === u || path.indexOf(u + '/') === 0) {
          if (u.length > bestLen) { bestLen = u.length; bestIdx = i; }
        }
      });

      this._els.forEach((el, i) => {
        el.btn.classList.toggle('active', i === bestIdx);
      });

      this._activeIdx = bestIdx;
      this._syncHeaderOffset();
      this._placeIndicator();
    }

    _syncHeaderOffset() {
      let view = null;
      // The bar lives in ha-app-layout, inside hui-root's shadow root.
      try {
        const near = this.getRootNode();
        if (near && near.querySelector) {
          view = near.querySelector('hui-view, hui-view-container');
        }
      } catch (_) {}

      const walk = (root, depth) => {
        if (!root || depth > 12 || view || !root.querySelectorAll) return;
        const hit = root.querySelector('hui-view, hui-view-container');
        if (hit) { view = hit; return; }
        root.querySelectorAll('*').forEach((el) => {
          if (!view && el.shadowRoot) walk(el.shadowRoot, depth + 1);
        });
      };
      if (!view) { try { walk(document, 0); } catch (_) {} }

      let px = 0;
      if (view) {
        const t = view.getBoundingClientRect().top;
        if (isFinite(t) && t > 0 && t < 240) px = Math.round(t);
      }
      if (px !== this._headerPx) {
        this._headerPx = px;
        this.style.setProperty('--hemma-nav-header-offset', px + 'px');
        this._placeIndicator(true);
      }
    }

    _labelBox(idx) {
      const el = this._els[idx];
      const sc = this._scroller;
      if (!el || !sc) return null;
      const sRect = sc.getBoundingClientRect();
      const lRect = el.label.getBoundingClientRect();
      if (!lRect.width || !sRect.width) return null;
      return { left: lRect.left - sRect.left + sc.scrollLeft, width: lRect.width };
    }

    _placeIndicator(instant) {
      const ind  = this._indicator;
      const fill = this._fill;
      if (!ind || !fill || !this._scroller) return;

      if (this._activeIdx < 0 || !this._els[this._activeIdx]) {
        ind.classList.remove('on');
        return;
      }

      const to = this._labelBox(this._activeIdx);
      if (!to) return;

      const from = this._from;
      if (!instant && from && from.left === to.left && from.width === to.width
          && ind.classList.contains('on')) return;

      ind.classList.remove('to-right', 'to-left');

      const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // No travel on any surface. The underline has nothing to move alongside:
      // the tap replaces the whole view, so a journey competing with that
      // rebuild lands late however it is eased. It leaves one name and arrives
      // under the other instead, which is what a sidebar selection does.
      if (!instant && from && ind.classList.contains('on') && ind.animate && !still) {
        const ghost = ind.cloneNode(true);
        ghost.classList.add('instant');
        ghost.classList.remove('on');
        ghost.style.opacity = '1';
        this._scroller.insertBefore(ghost, ind);
        const gone = () => ghost.remove();
        ghost.animate([{ opacity: 1 }, { opacity: 0 }],
          { duration: 110, easing: 'ease-out', fill: 'forwards' }).finished.then(gone, gone);
        ind.classList.add('instant');
        ind.style.width = to.width + 'px';
        ind.style.transform = 'translateX(' + to.left + 'px)';
        fill.style.transform = 'scaleX(1)';
        void ind.offsetWidth;
        ind.classList.remove('instant');
        // A whisper of width on the way in, so it reads as arriving rather than
        // being switched on. Anchored center: from the left edge it looks like
        // a short slide, which is the thing being removed.
        ind.animate(
          [{ opacity: 0, transform: ind.style.transform + ' scaleX(0.88)' },
           { opacity: 1, transform: ind.style.transform + ' scaleX(1)' }],
          { duration: 150, easing: 'cubic-bezier(0.2,0.8,0.2,1)' });
        this._from = to;
        return;
      }

      ind.style.width = to.width + 'px';

      if (instant || !from) {
        ind.classList.add('instant');
        ind.style.transform  = 'translateX(' + to.left + 'px)';
        fill.style.transform = 'scaleX(1)';
        ind.classList.add('on');
        void ind.offsetWidth;
        ind.classList.remove('instant');
      } else {
        ind.classList.add('instant');
        ind.style.transform  = 'translateX(' + from.left + 'px)';
        fill.style.transform = 'scaleX(' + (from.width / to.width) + ')';
        ind.classList.add('on');
        void ind.offsetWidth;
        ind.classList.remove('instant');

        if (to.left !== from.left) {
          ind.classList.add(to.left > from.left ? 'to-right' : 'to-left');
        }
        ind.style.transform  = 'translateX(' + to.left + 'px)';
        fill.style.transform = 'scaleX(1)';
      }

      this._from = to;
    }

    _syncBadges() {
      const hass = this._hass;
      this._els.forEach((el) => {
        const cfg = el.route.badge;
        let show = false;
        if (cfg && hass) show = !!resolve(cfg.show, hass, false);
        el.badge.style.display = show ? 'block' : 'none';
        if (show && cfg.color) el.badge.style.background = cfg.color;
      });
    }

    // ── Scenes menu ──────────────────────────────────────────────────────────
    _menuItems(route) {
      const hass = this._hass;
      const SC = window._hemmaSC;

      if (route.menu === 'scenes' || !route.popup) {
        if (SC && SC.list) {
          const ids = SC.list(hass.states, hass, this._config || {});
          if (SC.noteColors) SC.noteColors((this._config || {}).scene_colors);
          if (SC.prefetch) { try { SC.prefetch(ids, hass.states); } catch (_) {} }
          return ids.map((id) => ({
            id: id,
            label: (hass.states[id].attributes || {}).friendly_name
              || id.replace('scene.', '').replace(/_/g, ' '),
            icon: (hass.states[id].attributes || {}).icon || 'mdi:layers',
            active: SC.isActive ? !!SC.isActive(id, hass.states) : false,
            run: () => SC.apply(id, this._transition()),
          }));
        }
        return this._sceneFallback();
      }

      const items = evalTpl(route.popup, hass, []) || [];
      return items.map((it) => ({
        id: it.entity || null,
        label: it.label || '',
        icon: it.icon || 'mdi:layers',
        active: false,
        run: () => {
          const ta = it.tap_action || {};
          if (ta.action === 'call-service' || ta.action === 'perform-action') {
            const svc = String(ta.service || ta.perform_action || '');
            const dot = svc.indexOf('.');
            if (dot > 0) {
              hass.callService(svc.slice(0, dot), svc.slice(dot + 1),
                ta.service_data || ta.data || {});
            }
          } else if (ta.action === 'navigate' && ta.navigation_path) {
            navigate(ta.navigation_path);
          }
        },
      }));
    }

    _transition() {
      const t = (this._config || {}).scene_transition;
      return t === undefined ? 3 : t;
    }

    _sceneFallback() {
      const hass = this._hass;
      const states = hass.states || {};
      const reg = hass.entities || {};
      const getReg = (id) => reg[id] || (reg.get && reg.get(id)) || null;
      return Object.keys(states)
        .filter((id) => id.indexOf('scene.') === 0 && id.indexOf('scene.hemma') !== 0)
        .filter((id) => {
          const e = getReg(id);
          return e && !(e.hidden || e.hidden_by || e.disabled || e.disabled_by);
        })
        .map((id) => ({
          id: id,
          label: (states[id].attributes || {}).friendly_name
            || id.replace('scene.', '').replace(/_/g, ' '),
          icon: (states[id].attributes || {}).icon || 'mdi:layers',
          active: false,
          run: () => hass.callService('scene', 'turn_on',
            { entity_id: id, transition: this._transition() }),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    _openMenu(route, btn) {
      const hass = this._hass;
      if (!hass) return;

      const menu = document.createElement('div');
      menu.className = 'hemma-nav-menu';
      menu._owner = btn;
      Object.assign(menu.style, {
        position: 'fixed', zIndex: '99999', boxSizing: 'border-box',
        padding: '6px',
        maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', overflowX: 'hidden',
        width: 'max-content', maxWidth: 'calc(100vw - 24px)',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', rowGap: '2px',
        scrollbarWidth: 'none',
      });
      window.hemmaMenuGlass.apply(menu);

      const build = () => {
        const items = this._menuItems(route);
        const sig = items.map((i) => [i.id, i.label, i.icon, i.active].join('\u0001')).join('\u0002');
        if (sig === menu._sig) return;
        menu._sig = sig;
        menu.textContent = '';
        items.forEach((it) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.setAttribute('role', 'menuitem');
          Object.assign(row.style, {
            display: 'grid', gridTemplateColumns: '20px 1fr', alignItems: 'center',
            justifyItems: 'start', columnGap: '15px', width: '100%',
            minHeight: '46px', padding: '0 16px 0 13px',
            borderRadius: 'calc(var(--hemma-menu-radius, 28px) - 6px)',
            border: '0', textAlign: 'left',
            font: 'inherit', fontSize: 'var(--hemma-popup-label-size, 15px)',
            // 600 blanks these on re-render; 500 is the heaviest safe weight.
            fontWeight: it.active ? '500' : '400',
            color: '#fff', opacity: it.active ? '1' : '.86',
            cursor: 'default', outline: 'none', boxSizing: 'border-box',
          });

          const ico = document.createElement('ha-icon');
          ico.setAttribute('icon', it.icon);
          Object.assign(ico.style, {
            width: '20px', height: '20px', color: 'currentColor',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            placeSelf: 'center',
          });
          // Object.assign cannot set a custom property; it fails silently.
          ico.style.setProperty('--mdc-icon-size', '18px');

          const txt = document.createElement('span');
          txt.textContent = it.label;
          Object.assign(txt.style, {
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: '100%',
          });

          row.appendChild(ico);
          row.appendChild(txt);

          row.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { it.run(); } catch (_) {}
            close();
          };
          menu.appendChild(row);
        });
      };

      ensureMenuCss();
      build();
      menu._refresh = build;
      document.body.appendChild(menu);

      const place = () => {
        const r = btn.getBoundingClientRect();
        const w = menu.offsetWidth;
        const cx = r.left + r.width / 2;
        menu.style.top = window.hemmaMenuGlass.dropTop(r, 10) + 'px';
        menu.style.left = Math.round(
          Math.max(12, Math.min(cx - w / 2, window.innerWidth - w - 12))
        ) + 'px';
      };
      place();

      window.hemmaMenuGlass.enter(menu);

      btn.setAttribute('data-popup-open', '');

      const onKey = (e) => { if (e.key === 'Escape') close(); };
      const onAway = (e) => {
        const t = e.composedPath ? e.composedPath()[0] : e.target;
        if (!menu.contains(t) && t !== btn && !btn.contains(t)) close();
      };
      const close = () => {
        if (menu._closing) return;
        menu._closing = true;
        btn.removeAttribute('data-popup-open');
        window.removeEventListener('keydown', onKey, true);
        document.removeEventListener('pointerdown', onAway, true);
        window.removeEventListener('resize', close);
        window.removeEventListener('location-changed', close, true);
        window.hemmaMenuGlass.exit(menu, () => {
          if (menu.parentNode) menu.remove();
        });
        if (this._menu === menu) this._menu = null;
      };
      menu._close = close;

      setTimeout(() => {
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('pointerdown', onAway, true);
        window.addEventListener('resize', close);
        window.addEventListener('location-changed', close, true);
      }, 0);

      this._menu = menu;
    }

    _closeMenu() {
      if (this._menu && this._menu._close) this._menu._close();
      this._menu = null;
    }

    _css() {
      const shared = `
        :host {
          position: fixed;
          left: 0;
          right: 0;
          height: 0;
          z-index: 50;
          display: block;
          pointer-events: none;
          text-size-adjust: 100%;
          -webkit-text-size-adjust: 100%;
        }

        .bar {
          position: relative;
          pointer-events: auto;
          box-sizing: border-box;
        }

        .glass {
          position: absolute;
          inset: 0;
          z-index: 0;
          border-radius: inherit;
          pointer-events: none;
        }

        .scroller {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: row;
          align-items: center;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          touch-action: pan-x;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .scroller::-webkit-scrollbar { height: 0; width: 0; }

        /* Placed by TRANSFORM, a compositor property: left/right are layout, and
           on tablet they also re-blur the glass pill behind it. */
        .indicator {
          position: absolute;
          left: 0;
          z-index: 0;
          opacity: 0;
          pointer-events: none;
          transform-origin: left center;
          will-change: transform;
          transition:
            transform var(--hemma-nav-indicator-duration, 0.42s) var(--hemma-nav-indicator-ease, cubic-bezier(0.32, 0.72, 0, 1)),
            opacity 0.2s ease;
        }

        .indicator .fill {
          width: 100%;
          height: 100%;
          border-radius: 9999px;
          transform-origin: left center;
          will-change: transform;
          transition: transform var(--hemma-nav-indicator-duration, 0.42s) var(--hemma-nav-indicator-ease, cubic-bezier(0.32, 0.72, 0, 1));
        }

        .indicator.on { opacity: 1; }

        .indicator.to-right       { transition-delay: var(--hemma-nav-indicator-lead, 0.07s), 0s; }
        .indicator.to-left .fill  { transition-delay: var(--hemma-nav-indicator-lead, 0.07s); }

        .indicator.instant,
        .indicator.instant .fill  { transition: none; }

        @media (prefers-reduced-motion: reduce) {
          .indicator,
          .indicator .fill { transition: opacity 0.2s ease !important; }
        }

        .route {
          position: relative;
          z-index: 1;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          box-shadow: none;
          font: inherit;
          color: inherit;
          cursor: pointer;
          overflow: visible;
          -webkit-tap-highlight-color: transparent;
        }

        .route:focus-visible { outline: none; }

        .label {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          white-space: nowrap;
          color: var(--hemma-nav-label-color, #fff);
          /* Per variant, not shared: how far an unselected label drops depends
             on how much work the indicator is doing. */
          opacity: var(--hemma-nav-label-inactive-opacity, 0.82);
        }

        .route.active .label { opacity: 1; }

        .route[data-has-popup] .label::after {
          content: "";
          display: inline-block;
          flex: none;
          width: 20px;
          height: 20px;
          margin-left: 2px;
          background-color: rgba(255,255,255,0.42);
          -webkit-mask: url("${CHEVRON}") no-repeat center / contain;
          mask: url("${CHEVRON}") no-repeat center / contain;
          transform: rotate(0deg);
          transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .route[data-has-popup][data-popup-open] .label::after {
          transform: rotate(90deg);
        }

        @keyframes hemma-badge-pulse {
          0%, 100% { opacity: .9; transform: scale(1); }
          50%      { opacity: 0;  transform: scale(0.85); }
        }

        .badge {
          position: absolute;
          display: none;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #ffd700;
          pointer-events: none;
          animation: hemma-badge-pulse 3s ease-in-out infinite;
        }
      `;

      if (this._variant === 'tablet') {
        return shared + `
          /* The clock and chrome buttons are custom fields of the room card, whose
             position:fixed is captured by a transformed ancestor, so they ride
             down under HA's header. This bar hangs off the viewport and would
             not - hence the offset. */
          :host {
            top: calc(var(--hemma-chrome-row-top-tablet, 30px)
              + var(--hemma-nav-header-offset, var(--hemma-header-offset, 0px)));
            --hemma-nav-reserve-current: var(--hemma-chrome-side-reserve-tablet, 188px);
          }

          /* Both orientation-dependent values ride the one block that is known
             to match here. A second bar rule in its own media query is the same
             cascade on paper and was not worth the doubt. */
          @media (orientation: portrait) {
            :host {
              top: calc(var(--hemma-chrome-row-top-tablet-portrait, 32px)
                + var(--hemma-nav-header-offset, var(--hemma-header-offset, 0px)));
              --hemma-nav-reserve-current:
                var(--hemma-chrome-side-reserve-tablet-portrait, 96px);
            }
          }

          .bar {
            width: fit-content;
            max-width: min(
              calc(75vw - 35px),
              calc(100vw - 2 * (var(--hero-gutter, 23px)
                + var(--hemma-nav-reserve-current, 188px)))
            );
            margin: 0 auto;
            height: var(--hemma-nav-pill-height-tablet, 46px);
            padding: 0 var(--hemma-nav-pill-inset-x-tablet, 4px);
            border-radius: 9999px;
            overflow: hidden;
          }

          /* The capsule the phone dashboard and the panel share, from the same theme variables. */
          .glass {
            background: var(--hemma-pill-fill, rgba(255,255,255,0.10));
            -webkit-backdrop-filter: var(--hemma-pill-backdrop, blur(12px) saturate(1.4));
            backdrop-filter: var(--hemma-pill-backdrop, blur(12px) saturate(1.4));
            box-shadow: var(--hemma-pill-rim, inset 0 0.5px 0 rgba(255,255,255,0.10), inset 0 -0.5px 0 rgba(255,255,255,0.10)),
              inset 1px 0 0 var(--hemma-pill-edge, rgba(0,0,0,0.50)), inset -1px 0 0 var(--hemma-pill-edge, rgba(0,0,0,0.50));
          }

          .rim {
            position: absolute;
            inset: 0;
            z-index: 0;
            border-radius: inherit;
            pointer-events: none;
            -webkit-backdrop-filter: var(--hemma-pill-highlight, brightness(1.45));
            backdrop-filter: var(--hemma-pill-highlight, brightness(1.45));
            padding: 1px;
            box-sizing: border-box;
            -webkit-mask: linear-gradient(to bottom, #000 0, rgba(0,0,0,.45) 13%, transparent 31%, transparent 69%, rgba(0,0,0,.45) 87%, #000 100%), linear-gradient(#000 0 0), linear-gradient(#000 0 0) content-box;
            -webkit-mask-composite: source-in, source-out;
            mask: linear-gradient(to bottom, #000 0, rgba(0,0,0,.45) 13%, transparent 31%, transparent 69%, rgba(0,0,0,.45) 87%, #000 100%), linear-gradient(#000 0 0), linear-gradient(#000 0 0) content-box;
            mask-composite: intersect, subtract;
          }

          .flash {
            position: absolute;
            inset: 0;
            z-index: 2;
            border-radius: inherit;
            opacity: 0;
            pointer-events: none;
          }

          .scroller { height: 100%; }

          .route + .route { margin-left: var(--hemma-nav-route-gap-tablet, 4px); }

          .label {
            box-sizing: border-box;
            height: calc(var(--hemma-nav-pill-height-tablet, 46px)
              - 2 * var(--hemma-nav-pill-inset-y-tablet, 4px));
            padding: 0 var(--hemma-nav-label-pad-x-tablet, 16px);
            border-radius: 9999px;
            font-size: 16px;
            font-weight: var(--hemma-chrome-font-weight, 500);
            /* The pill fill is the selection cue, so the labels barely drop. */
            opacity: var(--hemma-nav-label-inactive-opacity, 0.84);
            background: transparent;
            transition: opacity .18s ease;
          }

          .indicator {
            top: var(--hemma-nav-pill-inset-y-tablet, 4px);
            height: calc(var(--hemma-nav-pill-height-tablet, 46px)
              - 2 * var(--hemma-nav-pill-inset-y-tablet, 4px));
          }

          .indicator .fill {
            background: var(--hemma-nav-active-fill, rgba(200,200,200,0.25));
          }

          .route[data-has-popup] .label::after {
            margin-left: -1px;
            margin-right: -6px;
          }

          .badge { top: 8px; right: 12px; }
        `;
      }

      return shared + `
        :host {
          top: calc(var(--hemma-chrome-row-center-desktop, 56px)
            - var(--hemma-nav-label-pad-top, 8px)
            - (var(--hemma-chrome-font-size, 18px) / 2)
            + var(--hemma-nav-header-offset, var(--hemma-header-offset, 0px)));
        }

        .bar {
          display: flex;
          justify-content: center;
          width: fit-content;
          max-width: calc(100vw - 2 * var(--hemma-nav-margin-current, 8vw));
          margin: 0 auto;
        }

        @supports (animation-timeline: scroll()) {
          .scroller {
            animation: hemma-fade-mask linear;
            animation-timeline: scroll(self inline);
          }
        }

        @keyframes hemma-fade-mask {
          0% {
            -webkit-mask-image: linear-gradient(to right, transparent 0px, black 0px, black calc(100% - 80px), transparent 100%);
            mask-image: linear-gradient(to right, transparent 0px, black 0px, black calc(100% - 80px), transparent 100%);
          }
          100% {
            -webkit-mask-image: linear-gradient(to right, transparent 0px, black 80px, black 100%, transparent calc(100% + 80px));
            mask-image: linear-gradient(to right, transparent 0px, black 80px, black 100%, transparent calc(100% + 80px));
          }
        }

        .route { padding: 0 20px; }

        .label {
          box-sizing: border-box;
          height: calc(var(--hemma-chrome-font-size, 18px)
            + var(--hemma-nav-label-pad-top, 8px) + 14px);
          padding: var(--hemma-nav-label-pad-top, 8px) 0 14px;
          font-size: var(--hemma-chrome-font-size, 18px);
          font-weight: var(--hemma-chrome-font-weight, 500);
          letter-spacing: var(--hemma-chrome-letter-spacing, 0.2px);
          /* Only a 2px underline marks the active room, so unselected labels
             carry more of the contrast than they do on the tablet pill. */
          opacity: var(--hemma-nav-label-inactive-opacity, 0.74);
        }

        .indicator {
          bottom: var(--hemma-nav-underline-gap, 4px);
          height: var(--hemma-nav-underline-thickness, 2px);
        }

        .indicator .fill { background: rgba(255,255,255,0.85); }

        .badge { top: 6px; right: 10px; }
      `;
    }
  }

  customElements.define('hemma-nav-bar', HemmaNavBar);

  function walkFind(root, selector, out, depth) {
    if (!root || depth > 20 || !root.querySelectorAll) return;
    root.querySelectorAll(selector).forEach((el) => out.push(el));
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) walkFind(el.shadowRoot, selector, out, depth + 1);
    });
  }

  function persistentHost() {
    const found = [];
    walkFind(document, 'ha-app-layout', found, 0);
    for (const el of found) if (el.isConnected) return el;
    return document.body;
  }

  class HemmaNav extends HTMLElement {
    static getStubConfig() { return { variant: 'desktop', routes: [] }; }

    setConfig(config) {
      if (!config || !Array.isArray(config.routes)) {
        throw new Error('hemma-nav: routes array required');
      }
      this._config = config;
      this._adopt();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._bar) this._bar.hass = hass;
    }

    get hass() { return this._hass; }

    getCardSize() { return 0; }

    connectedCallback() {
      this.style.display = 'none';
      (HemmaNav._live || (HemmaNav._live = new Set())).add(this);
      this._adopt();
    }

    disconnectedCallback() {
      if (HemmaNav._live) HemmaNav._live.delete(this);
      requestAnimationFrame(() => {
        if (HemmaNav._live && HemmaNav._live.size) return;
        if (HemmaNav._bar) { HemmaNav._bar.remove(); HemmaNav._bar = null; }
      });
    }

    _adopt() {
      if (!this._config || !this.isConnected) return;
      const variant = this._config.variant === 'tablet' ? 'tablet' : 'desktop';

      let bar = HemmaNav._bar;
      if (bar && bar._variant !== variant) { bar.remove(); bar = null; }

      if (!bar) {
        bar = document.createElement('hemma-nav-bar');
        bar.setConfig(this._config);
        HemmaNav._bar = bar;
      } else {
        bar.updateConfig(this._config);
      }

      const host = persistentHost();
      if (bar.parentNode !== host) host.appendChild(bar);

      this._bar = bar;
      if (this._hass) bar.hass = this._hass;
    }
  }

  customElements.define('hemma-nav', HemmaNav);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'hemma-nav',
    name: 'Hemma Navigation',
    description: 'Hemma navigation bar — desktop labels or tablet glass pill',
  });
})();

(function () {
  if (window.hemmaPopup) return;

  var SHEET_MAX = 768;

  function flagOn() {
    if (typeof window.HEMMA_POPUP === 'boolean') return window.HEMMA_POPUP;
    try {
      var q = new URLSearchParams(location.search).get('hemma_popup');
      if (q === '1') return true;
      if (q === '0') return false;
      return localStorage.getItem('hemma_popup') !== '0';
    } catch (e) { return true; }
  }

  var CHART_WAIT_MAX = 1600;

  var FOREIGN = /([^\w.#-]|^)(ha-adaptive-dialog|ha-bottom-sheet|ha-dialog|wa-dialog|wa-drawer)(?![\w-])/g;
  function retarget(css) { return String(css == null ? '' : css).replace(FOREIGN, '$1.surface'); }

  var BASE_CSS = `
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--hemma-popup-z, 2147483000);
      display: none;
      color: var(--primary-text-color, #fff);
      --hemma-popup-grain-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    :host([open]) { display: block; }

    .scrim {
      position: absolute;
      inset: 0;
      background: var(--hemma-popup-scrim, var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.40)));
      backdrop-filter: var(--hemma-popup-scrim-backdrop, var(--hemma-scrim-backdrop, blur(6px) saturate(1.35)));
      -webkit-backdrop-filter: var(--hemma-popup-scrim-backdrop, var(--hemma-scrim-backdrop, blur(6px) saturate(1.35)));
      opacity: 0;
      /* Deliberately slower than the pane and on its own curve: the panel
         arrives, then the room settles back behind it. Sharing the pane's
         260ms is what made the blur read as a snap. */
      transition: opacity var(--hemma-popup-scrim-enter, 480ms)
                  var(--hemma-popup-scrim-ease, cubic-bezier(0.25, 0.6, 0.3, 1));
    }
    :host([shown]) .scrim { opacity: 1; }
    /* Out faster than in, and inside the 400ms teardown or it gets cut off. */
    :host([closing]) .scrim {
      transition-duration: var(--hemma-popup-scrim-exit, 200ms);
      transition-timing-function: ease-in;
    }

    .layer {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      pointer-events: none;
    }

    .surface {
      pointer-events: auto;
      position: relative;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: var(--popup-min-width, 580px);
      max-width: min(var(--popup-max-width, 600px), calc(100vw - 16px));
      margin-top: var(--hemma-popup-top, 112px);
      max-height: calc(100svh - var(--hemma-popup-top, 112px) - 8px - var(--safe-area-inset-bottom, 0px));
      border-radius: var(--hemma-popup-radius, 38px);
      background: transparent;
      overflow: hidden;
    }
    /* A sheet may size itself to its content - see hemma_popup_recently_added,
       where two shelves of two tiles must not sit in a sheet built for three.
       Below the two-column breakpoint the shelves go fluid and have no
       intrinsic width, so a popup that opts in names what to use instead. */
    @media (max-width: 900px) {
      .surface { width: var(--popup-min-width-narrow, var(--popup-min-width, 580px)); }
    }
    /* A landscape tablet is wide but short: 112px above the sheet plus the
       header was 22% of the screen gone before any content. The offset follows
       the height it has to fit into, not the width. */
    @media (max-height: 900px) and (min-width: 601px) {
      :host { --hemma-popup-top: 64px; }
    }
    @media (max-height: 720px) and (min-width: 601px) {
      :host { --hemma-popup-top: 40px; }
    }

    /* The frost is a sibling of the content, not a wrapper around it. As an
       ancestor it would make every backdrop-filter inside the popup a silent
       no-op, which is what pinned --hemma-glass-pill-backdrop to none. */
    .glass {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      animation: hemma-popup-fade var(--hemma-popup-enter, 260ms) ease-out;
      isolation: isolate;
      box-shadow: var(--hemma-popup-shadow,
        0 40px 90px -32px rgba(0, 0, 0, 0.78),
        0 10px 28px -14px rgba(0, 0, 0, 0.55));
      background: var(--hemma-popup-tint,
        var(--ha-dialog-surface-background, var(--ha-dialog-background, rgba(0, 0, 5, 0.5))));
    }
    :host(:not([flat])) .glass {
      backdrop-filter: var(--hemma-popup-backdrop,
        var(--hemma-surface-backdrop, blur(28px) saturate(200%)));
      -webkit-backdrop-filter: var(--hemma-popup-backdrop,
        var(--hemma-surface-backdrop, blur(28px) saturate(200%)));
    }
    :host([flat]) .glass { background: var(--hemma-popup-tint-flat, rgba(8, 8, 12, 0.24)); }

    /* A mix-blend-mode layer makes the browser read the backdrop back and
       composite the subtree as one group, and zero opacity does not remove it -
       an invisible grain costs exactly what a visible one costs. Every widget
       popup runs at grain 0, so the layer has to be able to go entirely. */
    .glass::before, .glass::after {
      content: var(--hemma-popup-grain-content, "");
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background-image: var(--hemma-popup-grain-image);
      background-size: 180px 180px;
    }
    /* overlay is midpoint-relative and goes weak on dark ground; screen falls
       off the opposite way, so the pair holds roughly flat across the ramp. */
    .glass::before { mix-blend-mode: overlay; opacity: var(--hemma-popup-grain, 0.10); }
    .glass::after  { mix-blend-mode: screen;  opacity: var(--hemma-popup-grain-dark, 0.04); }

    /* Decoration, off by default - the popups read flat now, matching HA's
       dialogs. Set --hemma-popup-rim to a box-shadow to bring it back. */
    .rim {
      display: var(--hemma-popup-rim-display, none);
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      animation: hemma-popup-fade var(--hemma-popup-enter, 260ms) ease-out;
      box-shadow: var(--hemma-popup-rim,
        inset 0 1px 0 -0.5px rgba(255, 255, 255, 0.34),
        inset 0 8px 14px -12px rgba(255, 255, 255, 0.22),
        inset 0 -1px 0 -0.5px rgba(255, 255, 255, 0.11),
        inset 1px 0 0 -0.5px rgba(255, 255, 255, 0.13),
        inset -1px 0 0 -0.5px rgba(255, 255, 255, 0.13));
    }

    :host([closing]) .surface { animation: hemma-popup-out 140ms ease-in forwards; }

    @keyframes hemma-popup-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes hemma-popup-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    /* Transform, deliberately - a margin slide relayouts every frame and drops
       them. No opacity here: opacity below 1 makes the surface a backdrop root
       and kills the frost inside it, which is what HA's own drawer does wrong. */
    @keyframes hemma-sheet-in {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    @keyframes hemma-sheet-out {
      from { transform: translateY(0); }
      to   { transform: translateY(100%); }
    }

    /* The entrance starts off-screen, so anything that stalls the animation
       clock would strand the surface there. Opting out restores the resting
       state, which is the laid-out one. */
    @media (prefers-reduced-motion: reduce) {
      .surface, .glass, .rim, .content { animation: none !important; }
      .scrim { transition: none !important; }
    }

    .grab { display: none; }

    /* .glass is absolutely positioned, so it paints above in-flow siblings.
       .content escapes that only because animating opacity makes it paint in
       the positioned step; the header has no animation, so it needs this or
       the frost fades in over the title. */
    /* The header was never part of the entrance. .content animates, and in a
       widget popup even that is off because each plate animates itself - so the
       close, the actions and the title were simply present on frame one while
       everything under them faded in. They arrive with the first plate now. */
    /* The same depth entrance the plates use, so the chrome arrives as part of
       the popup rather than ahead of it. */
    @keyframes hemma-popup-chrome-in {
      from { opacity: 0; transform: perspective(900px) translateZ(-70px); }
      to   { opacity: 1; transform: perspective(900px) translateZ(0); }
    }
    .header {
      flex: 0 0 auto;
      position: relative;
      z-index: 1;
    }
    /* On each control, never on .header. An animated opacity on an ANCESTOR
       paints the subtree into its own layer and every backdrop-filter inside it
       has nothing left to sample - animating the bar would flatten the close
       button's frost for the length of its own entrance. */
    .header-close,
    .header-content,
    .header-actions {
      animation: var(--hemma-popup-chrome-enter, none);
    }
    @media (prefers-reduced-motion: reduce) {
      .header-close, .header-content, .header-actions { animation: none; }
    }
    .header[hidden] { display: none; }
    .header-bar {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
      /* The close glyph's ink sits on the same left margin as the body content
         (8px container + 26px card gutter = 34px), so the popup has one left
         edge instead of three. Measured, not derived: the glyph's ink starts
         5/24 into its own box, so 17px of bar padding is what lands it on 34. */
      /* The SAME gutter the content pads by. These were two independent
         numbers, so every popup that padded its content differently put the
         close button somewhere else, and each one had to be found and tuned by
         hand. One value, read by both, cannot disagree. */
      padding: 0 var(--hemma-popup-gutter, 26px);
      box-sizing: border-box;
    }
    /* Room under the row, so the close control is not against the edge of the
       header and the title has somewhere to breathe. */
    .header { padding-bottom: var(--hemma-popup-header-gap, 10px); }
    .header-nav, .header-actions {
      flex: none;
      min-width: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
    }
    /* The close glyph sits 25px in because a 24px icon is centered in a 48px
       target. An action pill has no such target, so without this it lands 8px
       from the edge and crowds the 28px corner radius. */
    .header-actions { padding-right: var(--hemma-popup-header-actions-pad, 12px); }
    /* Centered on the BAR, not between the nav and the actions - those are
       different widths, so centering between them is off by half the difference.
       Absolute, so the actions cannot push it; pointer-events off so it never
       eats a tap meant for the close control. */
    .header-content {
      position: absolute;
      /* Centered with auto margins, NOT a translate. The chrome entrance
         animates transform, and its final keyframe replaced a centering
         translateX(-50%) outright - which shifted the title right by half its
         own width once the animation settled. Nothing here may use transform. */
      left: 0;
      right: 0;
      margin-inline: auto;
      width: fit-content;
      max-width: calc(100% - 132px);
      padding: 10px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
      pointer-events: none;
    }
    /* .header-content is out of the flow now, so the actions need to be told
       to hold the trailing edge rather than sliding up against the close. */
    .header-actions { margin-left: auto; }
    .header-eyebrow {
      font-size: var(--ha-font-size-m, 14px);
      line-height: 16px;
      color: var(--hemma-popup-header-subtitle-color,
        var(--secondary-text-color, rgba(255, 255, 255, 0.55)));
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-title {
      font-size: var(--hemma-popup-header-title-size, 22px);
      line-height: var(--ha-line-height-condensed, 1.2);
      font-weight: var(--ha-font-weight-medium, 500);
      color: var(--hemma-popup-header-title-color,
        var(--primary-text-color, #fff));
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-eyebrow:empty, .header-title:empty { display: none; }
    /* A circle and a rectangle set to the same x do not read as aligned: the
       circle's edge is a tangent and only its widest point reaches the margin,
       so it looks further left than the flat edge beside it. A few pixels of
       indent is what makes them read as one gutter. */
    /* One gutter, two widths. A popup sets the desktop value; the phone value
       is the same for all of them because the content cards narrow together. */
    :host { --hemma-popup-gutter: var(--hemma-popup-gutter-wide, 26px);
            --hemma-popup-value-gap: var(--hemma-popup-value-gap-wide, 0px); }
    @media (max-width: 600px) {
      :host { --hemma-popup-gutter: var(--hemma-popup-gutter-phone, 14px);
              --hemma-popup-value-gap: 0px; }
    }
    /* Parked chart cards. Off screen but connected, so apexcharts keeps the
       chart it already drew instead of fetching and drawing it again. */
    .keep { position: absolute; left: -99999px; top: 0; width: 1px; height: 1px;
            overflow: hidden; pointer-events: none; }
    .header-close {
      transition: opacity 0.16s ease;
      appearance: none;
      -webkit-appearance: none;
      background: none;
      border: 0;
      margin: 0;
      padding: 0;
      width: 48px;
      height: 48px;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      cursor: pointer;
      position: relative;
      isolation: isolate;
      color: var(--hemma-popup-header-title-color,
        var(--primary-text-color, #fff));
      -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    }
    .header-close[hidden] { display: none; }
    .header-close svg {
      width: 24px;
      height: 24px;
      display: block;
      fill: currentColor;
    }
    /* HA's ha-icon-button: a currentColor disc at opacity 0 that comes up to
       0.1 on hover. Never visible at rest, so it never shows on a phone. */
    .header-close::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background-color: currentColor;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    }
    @media (hover: hover) {
      .header-close:hover:not([disabled])::after { opacity: 0.1; }
    }

    /* A chart fetches history first, so the shell is hidden and cross-dissolves
       in. The rule cannot live here - a popup's chart sits inside a
       button-card's shadow root, so this selector matches nothing. What stays
       is the safety net below, which walks shadow roots. */

    .content {
      /* Every ha-card inherits the theme's --ha-card-backdrop-filter and lays a
         SECOND one over .glass - the haze under the header. Null the VARIABLE,
         not the property: it is what ha-card's own :host rule reads, and it
         inherits through shadow boundaries to nested cards. */
      --ha-card-backdrop-filter: none;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
      outline: none !important;
      scrollbar-width: none;
      -ms-overflow-style: none;
      animation: hemma-popup-fade var(--hemma-popup-enter, 260ms) ease-out;
    }
    .content::-webkit-scrollbar { display: none; }
    .content .container {
      padding: 8px 8px 20px 8px;
      -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
      outline: none !important;
    }

    hemma-popup-hass { display: none; }

    @media (max-width: 768px) {
      .layer { align-items: flex-end; }

      /* The sheet's top edge IS the line the popup is cut off at, and the header
         bar has no vertical padding - so the close control sits hard against
         it. A negative value moves the clearance above the button instead. */
      .header-bar { padding-top: var(--hemma-popup-header-top-mobile, 10px); }
      .surface {
        width: 100%;
        max-width: none;
        margin-top: 0;
        /* Full height on every popup, the way more-info sizes its mobile sheet.
           Detents were tried and rejected: a sheet that is sometimes short and
           sometimes tall reads as a bug, and the hero needs the room. */
        height: var(--hemma-sheet-height, calc(100dvh - env(safe-area-inset-top, 0px)));
        min-height: var(--hemma-sheet-min, calc(100dvh - env(safe-area-inset-top, 0px)));
        max-height: calc(100dvh - env(safe-area-inset-top, 0px));
        border-radius: var(--hemma-sheet-radius, 24px) var(--hemma-sheet-radius, 24px) 0 0;
        box-shadow: none;
        animation: hemma-sheet-in 300ms cubic-bezier(0.32, 0.72, 0, 1);
      }
      .glass, .rim, .content { animation: none; }

      :host([closing]) .surface {
        animation: hemma-sheet-out 220ms ease-in forwards;
      }
      /* A swipe has already put the sheet where the keyframe would end. */
      :host([swipe-out]) .surface { animation: none !important; }
      .grab {
        display: block;
        flex: 0 0 auto;
        padding: 10px 0 2px;
        touch-action: none;
      }
      .grab span {
        display: block;
        width: 36px;
        height: 4px;
        margin: 0 auto;
        border-radius: 2px;
        background: var(--hemma-popup-grabber, rgba(255, 255, 255, 0.28));
      }
    }
  `;

  var LIVE_SCAN_MS = 2000;

  function collectLive(root, out) {
    var nodes;
    try { nodes = root.querySelectorAll('[data-hemma-live]'); } catch (e) { return out; }
    for (var i = 0; i < nodes.length; i++) out.push(nodes[i]);
    var kids;
    try { kids = root.querySelectorAll('*'); } catch (e) { return out; }
    for (var j = 0; j < kids.length; j++) {
      if (kids[j].shadowRoot) collectLive(kids[j].shadowRoot, out);
    }
    return out;
  }

  function refreshLive(root, hass, cache) {
    if (!root || !hass) return;
    // A popup with no live markers in its config never scans at all.
    if (cache && cache.none) return;
    var now = Date.now();
    if (!cache) {
      cache = { nodes: null, at: 0 };
    }
    if (!cache.nodes || now - cache.at > LIVE_SCAN_MS) {
      cache.nodes = collectLive(root, []);
      cache.at = now;
    }
    paintLive(cache.nodes, hass);
  }

  function paintLive(nodes, hass) {
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var st = hass.states[el.dataset.hemmaEnt];
      if (!st && el.dataset.hemmaLive !== 'fill') continue;
      if (el.dataset.hemmaLive === 'share') {
        var shSt = hass.states[el.dataset.hemmaEnt];
        var shTot = hass.states[el.dataset.hemmaTotal];
        if (!shSt || !shTot) continue;
        var shV = Number(shSt.state);
        var shT = Number(shTot.state);
        if (isNaN(shV) || isNaN(shT) || shT <= 0) { el.textContent = ''; continue; }
        var shPct = Math.round((shV / shT) * 100);
        el.textContent = shPct > 0
          ? shPct + (el.dataset.hemmaSuffix || '%') : '';
        continue;
      }
      if (el.dataset.hemmaLive === 'fill') {
        var fIds;
        try { fIds = JSON.parse(el.dataset.hemmaEnts || '[]'); } catch (e) { continue; }
        var fAttr = el.dataset.hemmaAttr || 'current_position';
        var fVals = [];
        for (var f = 0; f < fIds.length; f++) {
          var fSt = hass.states[fIds[f]];
          if (!fSt) continue;
          var fv = Number((fSt.attributes || {})[fAttr]);
          if (!isNaN(fv)) fVals.push(fv);
        }
        if (!fVals.length) continue;
        var fAvg = 0;
        for (var g = 0; g < fVals.length; g++) fAvg += fVals[g];
        fAvg = Math.max(0, Math.min(100, Math.round(fAvg / fVals.length)));
        el.style.height = (el.dataset.hemmaInvert === '1' ? 100 - fAvg : fAvg) + '%';
        continue;
      }
      if (el.dataset.hemmaLive === 'act') {
        var aspec;
        try { aspec = JSON.parse(el.dataset.hemmaAct || '{}'); } catch (e) { continue; }
        var arules = aspec.rules || [];
        var atest = function (c) {
          var v = c.attr === 'state' ? st.state : (st.attributes || {})[c.attr];
          if (c.has !== undefined) {
            return String(v == null ? '' : v).toLowerCase()
              .indexOf(String(c.has).toLowerCase()) !== -1;
          }
          if (c.eq !== undefined) return v === c.eq;
          return !!v;
        };
        var apick = null;
        for (var ai = 0; ai < arules.length && !apick; ai++) {
          var ar = arules[ai];
          if (atest(ar) && (ar.and || []).every(atest)) apick = ar;
        }
        if (!apick) apick = aspec;
        el.textContent = apick.text != null ? apick.text : '';
        if (apick.color) el.style.color = apick.color;
        el.style.display = apick.text === '' ? 'none' : '';
        continue;
      }
      if (el.dataset.hemmaLive === 'word') {
        var spec;
        try { spec = JSON.parse(el.dataset.hemmaWords || '{}'); } catch (e) { continue; }
        var sw = spec.state && spec.state[st.state];
        if (sw) { el.textContent = sw; continue; }
        var av = Number((st.attributes || {})[spec.attr]);
        if (isNaN(av)) {
          var fw = spec.fallbackState && spec.fallbackState[st.state];
          if (fw) el.textContent = fw;
          continue;
        }
        av = Math.round(av);
        var ex = spec.exact && spec.exact[String(av)];
        el.textContent = ex != null ? ex
          : String(spec.tpl || '{n}').replace('{n}', String(av));
        continue;
      }
      var raw = el.dataset.hemmaAttr === 'state'
        ? st.state : (st.attributes || {})[el.dataset.hemmaAttr];
      var n = Number(raw);
      if (isNaN(n)) continue;
      if (el.dataset.hemmaLive === 'bar') {
        el.style.width = Math.max(0, Math.min(100, n)) + '%';
      } else {
        el.textContent = Math.round(n) + (el.dataset.hemmaSuffix || '');
      }
    }
  }

  class HemmaPopupHass extends HTMLElement {
    set hass(h) {
      this._hass = h;
      var t = this._targets || [];
      for (var i = 0; i < t.length; i++) { if (t[i]) t[i].hass = h; }
      var host = this.getRootNode && this.getRootNode();
      if (host) refreshLive(host, h, this._liveCache || (this._liveCache = {}));
    }
    get hass() { return this._hass; }
    set target(el) { this._targets = el ? [el] : []; }
    get target() { return (this._targets || [])[0] || null; }
    set targets(list) { this._targets = list || []; }
  }
  customElements.define('hemma-popup-hass', HemmaPopupHass);

  class HemmaPopup extends HTMLElement {
    constructor() {
      super();
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + BASE_CSS + '</style><style id="dyn"></style>' +
        '<div class="scrim" part="scrim"></div>' +
        '<div class="layer">' +
          '<div class="surface" part="surface">' +
            '<div class="glass" part="glass"></div>' +
            '<div class="grab"><span></span></div>' +
            '<div class="header" hidden>' +
              '<div class="header-bar">' +
                '<section class="header-nav">' +
                  '<button class="header-close" type="button" aria-label="Close">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
                      '<path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"></path>' +
                    '</svg>' +
                  '</button>' +
                '</section>' +
                '<section class="header-content">' +
                  '<div class="header-eyebrow"></div>' +
                  '<div class="header-title"></div>' +
                '</section>' +
                '<section class="header-actions"></section>' +
              '</div>' +
            '</div>' +
            '<div class="content" tabindex="-1"><div class="container"></div></div>' +
            '<div class="rim" part="rim"></div>' +
            '<div class="keep" aria-hidden="true"></div>' +
            '<hemma-popup-hass></hemma-popup-hass>' +
          '</div>' +
        '</div>';

      this.scrim = root.querySelector('.scrim');
      this.surface = root.querySelector('.surface');
      this.container = root.querySelector('.container');
      this.content = root.querySelector('.content');
      this._header = root.querySelector('.header');
      this._headerTitle = root.querySelector('.header-title');
      this._headerEyebrow = root.querySelector('.header-eyebrow');
      this._headerActions = root.querySelector('.header-actions');
      this._headerClose = root.querySelector('.header-close');
      this._headerContent = root.querySelector('.header-content');
      this._dyn = root.querySelector('#dyn');
      this._keep = root.querySelector('.keep');
      this._parked = new Map();
      this._bridge = root.querySelector('hemma-popup-hass');

      this._dismissable = true;

      this._onKey = (e) => {
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        e.stopPropagation();
        this.dismiss();
      };
      this._onNav = () => {
        if (location.pathname === this._navPath) return;
        var ha = document.querySelector('home-assistant');
        if (ha && ha.shadowRoot && ha.shadowRoot.querySelector('ha-more-info-dialog')) return;
        if (Date.now() - (this._miOpenedAt || 0) < 1000) return;
        this.close();
      };

      // Only a gesture that BEGAN on the scrim dismisses. A tap on a tile can
      // finish on the scrim: the tile re-renders while the tap is dispatching,
      // so the click lands on whatever is underneath. Timing flags have to win
      // that race; where the finger went down does not.
      this.scrim.addEventListener('pointerdown', () => { this._scrimDown = true; }, true);
      document.addEventListener('pointerdown', (e) => {
        if (e.target !== this.scrim) this._scrimDown = false;
      }, true);
      this.scrim.addEventListener('click', () => {
        var began = this._scrimDown;
        this._scrimDown = false;
        if (began) this.dismiss();
      });

      this.content.addEventListener('pointerdown', (e) => {
        this._bgTap = { x: e.clientX, y: e.clientY,
                        slop: e.pointerType === 'mouse' ? 10 : 24 };
      }, true);
      this.content.addEventListener('click', (e) => {
        if (!this._bgDismiss || !this._dismissable) return;
        var d = this._bgTap;
        this._bgTap = null;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.slop || 10)) return;
        if (this._overWidget(e)) return;
        this.dismiss();
      });
      var closeTap = (e) => {
        var now = Date.now();
        if (now - (this._lastClose || 0) < 400) return;
        this._lastClose = now;
        e.preventDefault();
        e.stopPropagation();
        this.close();
      };
      this._headerClose.addEventListener('click', closeTap);
      this._headerClose.addEventListener('touchend', closeTap, { passive: false });
      this._bindSheetDrag(this.surface, root.querySelector('.grab'), this.content);
    }

    async open(data) {
      var cfg = data || {};
      var wasOpen = this.hasAttribute('open');

      this._dismissable = cfg.dismissable !== false;
      this._bgDismiss = cfg.dismiss_on_background === true;

      var isCard = !!cfg.content && typeof cfg.content === 'object';
      this.toggleAttribute('card', isCard);
      this.toggleAttribute('flat', cfg.flat === true);
      var hasHeader = !!(cfg.title || cfg.eyebrow);
      this._headerTitle.textContent = cfg.title || '';
      this._headerEyebrow.textContent = cfg.eyebrow || '';
      this._headerClose.hidden = cfg.close === false;
      this._header.hidden = !hasHeader;
      this._headerActions.textContent = '';
      this._dyn.textContent = this._dynamicCss(cfg);

      this.container.textContent = '';
      this._bridge.target = null;
      this.removeAttribute('data-hemma-charts-ready');
      if (this._chartPoll) { clearTimeout(this._chartPoll); this._chartPoll = null; }

      if (!wasOpen) {
        this.setAttribute('open', '');
        requestAnimationFrame(() => this.setAttribute('shown', ''));
        // Pinned invisible, entrance replayed below once the cards are in.
        this._holdChrome();
        document.addEventListener('keydown', this._onKey, true);
        this._navPath = location.pathname;
        window.addEventListener('location-changed', this._onNav, true);
        window.addEventListener('popstate', this._onNav, true);
        this._prevOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
      }

      if (hasHeader && cfg.header_actions && typeof cfg.header_actions === 'object') {
        await this._buildCard(cfg.header_actions, this._headerActions);
      }

      if (isCard) await this._buildCard(cfg.content);
      else if (cfg.content) this.container.textContent = String(cfg.content);

      if (!wasOpen) this._replayChrome();

      setTimeout(() => this._probe(), 900);   // after card_mod has landed

      this._gateOnCharts(isCard ? cfg.content : null);
    }


    _gateOnCharts(config) {
      if (this.hasAttribute('open')) this.setAttribute('data-hemma-charts-ready', '');
      var hasChart = false;
      try { hasChart = JSON.stringify(config || '').indexOf('custom:apexcharts-card') > -1; }
      catch (e) { hasChart = false; }
      if (!hasChart) return;
      if (this._chartPoll) clearTimeout(this._chartPoll);
      this._chartPoll = setTimeout(() => {
        this._chartPoll = null;
        if (!this.hasAttribute('open')) return;
        (function walk(node) {
          if (!node || !node.querySelectorAll) return;
          node.querySelectorAll('*').forEach((el) => {
            if (el.tagName === 'APEXCHARTS-CARD' && !el.hasAttribute('data-hemma-ready')) {
              el.setAttribute('data-hemma-ready', 'timeout');
            }
            if (el.shadowRoot) walk(el.shadowRoot);
          });
        })(this.shadowRoot);
      }, CHART_WAIT_MAX);
    }

    _probe() {
      if (!/[?&]hemmaprobe=1/.test(location.search)) return;
      var rows = [];
      var seen = new Set();
      var walk = (root, depth) => {
        if (!root || depth > 12 || seen.has(root)) return;
        seen.add(root);
        var els;
        try { els = root.querySelectorAll('*'); } catch (e) { return; }
        els.forEach((el) => {
          var cs, r;
          try { cs = getComputedStyle(el); r = el.getBoundingClientRect(); }
          catch (e) { return; }
          if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
          if (r.width * r.height < 20000) return;
          var bg = cs.backgroundColor || '';
          var bd = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
          var bl = cs.mixBlendMode || 'normal';
          var wc = cs.willChange || 'auto';
          var op = cs.opacity;
          var painted = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
          if (!painted && bd === 'none' && bl === 'normal' && wc === 'auto' && op === '1') return;
          rows.push([
            el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
              + (typeof el.className === 'string' && el.className.trim()
                  ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
            Math.round(r.width) + 'x' + Math.round(r.height)
              + '@' + Math.round(r.left) + ',' + Math.round(r.top),
            painted ? 'bg=' + bg : '',
            bd !== 'none' ? 'backdrop=' + bd : '',
            bl !== 'normal' ? 'blend=' + bl : '',
            wc !== 'auto' ? 'wc=' + wc : '',
            op !== '1' ? 'opacity=' + op : '',
          ].filter(Boolean).join('  '));
        });
      };
      walk(this.shadowRoot, 0);
      var box = document.createElement('div');
      box.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;max-height:62vh;'
        + 'overflow:auto;z-index:2147483647;background:#000;color:#0f0;'
        + 'font:10px/1.35 ui-monospace,Menlo,monospace;padding:8px;white-space:pre-wrap;');
      box.textContent = 'HEMMA PROBE  (' + rows.length + ' painting elements, tap to dismiss)\n\n'
        + rows.join('\n');
      box.addEventListener('click', function () { box.remove(); });
      document.body.appendChild(box);
    }

    // Positional, not path-based: composedPath fails on a retargeted event.
    _overWidget(ev) {
      var x = ev.clientX, y = ev.clientY;
      if (typeof x !== 'number' || typeof y !== 'number') return false;
      var box;
      try { box = this.content.getBoundingClientRect(); } catch (e) { return true; }
      if (!box || !box.width || !box.height) return true;
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) return true;
      var hit = false;
      (function walk(root) {
        if (hit || !root || !root.querySelectorAll) return;
        var all;
        try { all = root.querySelectorAll('*'); } catch (e) { return; }
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (el.shadowRoot) walk(el.shadowRoot);
          if (hit) return;
          var r;
          try { r = el.getBoundingClientRect(); } catch (e) { continue; }
          if (!r.width || !r.height) continue;
          if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
          if (el.dataset && el.dataset.hemmaNodismiss !== undefined) { hit = true; return; }
          if (el.classList && el.classList.contains('hui-plate')) { hit = true; return; }
          var cs;
          try { cs = window.getComputedStyle(el); } catch (e) { continue; }
          if (!cs || cs.visibility === 'hidden' || cs.display === 'none') continue;
          var bd = cs.backdropFilter || cs.webkitBackdropFilter;
          if (bd && bd !== 'none') { hit = true; return; }
          var m = /^rgba?\(([^)]+)\)/.exec(cs.backgroundColor || '');
          if (!m) continue;
          var parts = m[1].split(',');
          if ((parts.length > 3 ? parseFloat(parts[3]) : 1) > 0.01) { hit = true; return; }
        }
      })(this.content);
      return hit;
    }

    _parkedHas(el) {
      var found = false;
      this._parked.forEach(function (v) { if (v === el) found = true; });
      return found;
    }

    // animation-name before opacity, never the other way round.
    _holdChrome() {
      var els = [this._headerClose, this._headerContent, this._headerActions];
      for (var i = 0; i < els.length; i++) {
        if (!els[i]) continue;
        els[i].style.animationName = 'none';
        els[i].style.opacity = '0';
      }
    }

    _replayChrome() {
      var els = [this._headerClose, this._headerContent, this._headerActions];
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!el) continue;
        el.style.animationName = 'none';
        el.style.opacity = '';
        // Read it back, or the two writes coalesce and nothing restarts.
        void el.offsetWidth;
        el.style.animationName = '';
      }
    }

    dismiss() {
      if (Date.now() < (window._hemmaSuppressDismiss || 0)) return;
      if (this._dismissable) this.close();
    }

    close() {
      if (!this.hasAttribute('open') || this.hasAttribute('closing')) return;
      document.removeEventListener('keydown', this._onKey, true);
      window.removeEventListener('location-changed', this._onNav, true);
      window.removeEventListener('popstate', this._onNav, true);
      document.documentElement.style.overflow = this._prevOverflow || '';

      this.removeAttribute('shown');
      this.setAttribute('closing', '');

      var done = false;
      var finish = () => {
        if (done) return;
        done = true;
        this.removeAttribute('closing');
        this.removeAttribute('swipe-out');
        this.removeAttribute('open');
        this.removeAttribute('data-hemma-charts-ready');
        if (this._chartPoll) { clearTimeout(this._chartPoll); this._chartPoll = null; }
        this.surface.style.removeProperty('transform');
        this.surface.style.removeProperty('transition');
        var live = this.container.firstElementChild;
        if (live && this._keep && this._parkedHas(live)) this._keep.appendChild(live);
        this.container.textContent = '';
        this._bridge.target = null;
        this._dyn.textContent = '';
        this.dispatchEvent(new CustomEvent('hemma-popup-closed', { bubbles: true, composed: true }));
      };
      this.surface.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 400);
    }

    _dynamicCss(cfg) {
      var out = ':host {\n' + (cfg.style || '') + '\n}\n';
      var list = Array.isArray(cfg.popup_styles) ? cfg.popup_styles : [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e || !e.styles) continue;
        var sel = (!e.style || e.style === 'all') ? ':host' : ':host([' + e.style + '])';
        out += sel + ' {\n' + retarget(e.styles) + '\n}\n';
      }
      return out;
    }

    async _buildCard(config, host) {
      var target = host || this.container;
      if (this._bridge) {
        var hasLive = false;
        try { hasLive = JSON.stringify(config || '').indexOf('data-hemma-live') > -1; }
        catch (e) { hasLive = true; }
        this._bridge._liveCache = { none: !hasLive, nodes: null, at: 0 };
      }
      var key = null;
      try {
        var cfgStr = JSON.stringify(config || '');
        if (cfgStr.indexOf('custom:apexcharts-card') > -1) key = target === this.container ? cfgStr : null;
      } catch (e) { key = null; }
      if (key && this._parked.has(key)) {
        var kept = this._parked.get(key);
        if (kept && kept.isConnected) {
          kept.hass = (this._bridge.hass || (document.querySelector('home-assistant') || {}).hass);
          target.textContent = '';
          target.appendChild(kept);
          this._syncTargets();
          return;
        }
        this._parked.delete(key);
      }

      var helpers = await cardHelpers();
      if (!helpers || !this.hasAttribute('open')) return;

      var el;
      try {
        el = await helpers.createCardElement(config);
      } catch (err) {
        console.error('hemma-popup: could not build the popup card', err);
        return;
      }
      if (!this.hasAttribute('open')) return;

      var ha = document.querySelector('home-assistant');
      if (ha && !this._bridge._provided) {
        this._bridge._provided = true;
        try { ha.provideHass(this._bridge); } catch (e) { this._bridge._provided = false; }
      }
      el.hass = (this._bridge.hass || (ha && ha.hass));

      el.addEventListener('ll-rebuild', () => {
        if (this.hasAttribute('open')) this._buildCard(config, target);
      }, { once: true });

      target.textContent = '';
      target.appendChild(el);
      this._syncTargets();
      if (key) {
        this._parked.set(key, el);
        // Two is enough to cover going back and forth between two popups.
        while (this._parked.size > 2) {
          var oldest = this._parked.keys().next().value;
          var drop = this._parked.get(oldest);
          this._parked.delete(oldest);
          if (drop && drop.parentNode) drop.parentNode.removeChild(drop);
        }
      }

      if (!customElements.get(el.localName)) {
        customElements.whenDefined(el.localName).then(() => {
          if (this.hasAttribute('open')) this._buildCard(config, target);
        });
      }
    }

    _syncTargets() {
      var list = [];
      var a = this.container.firstElementChild;
      var b = this._headerActions && this._headerActions.firstElementChild;
      if (a) list.push(a);
      if (b) list.push(b);
      this._bridge.targets = list;
    }

    _isSheet() {
      try { return window.matchMedia('(max-width: ' + SHEET_MAX + 'px)').matches; }
      catch (e) { return window.innerWidth <= SHEET_MAX; }
    }

    _bindSheetDrag(surface, grab, content) {
      var y0 = 0, dy = 0, tracking = false, dragging = false;

      var start = (e) => {
        if (!this._isSheet() || !this._dismissable) return;
        var t = e.touches ? e.touches[0] : e;
        y0 = t.clientY;
        dy = 0;
        dragging = false;
        var onGrab = e.composedPath && e.composedPath().indexOf(grab) !== -1;
        tracking = onGrab || content.scrollTop <= 0;
      };

      var move = (e) => {
        if (!tracking) return;
        var t = e.touches ? e.touches[0] : e;
        var d = t.clientY - y0;
        if (!dragging) {
          if (d < -4) { tracking = false; return; }
          if (d < 8) return;
          dragging = true;
          surface.style.transition = 'none';
        }
        dy = Math.max(0, d);
        if (e.cancelable) e.preventDefault();
        surface.style.transform = 'translateY(' + dy + 'px)';
      };

      var end = () => {
        if (!tracking) return;
        var moved = dragging, traveled = dy;
        tracking = false;
        dragging = false;
        if (!moved) return;

        if (traveled > Math.min(120, surface.offsetHeight * 0.25)) {
          this.setAttribute('swipe-out', '');
          surface.style.transition = 'transform 200ms ease-in';
          surface.style.transform = 'translateY(100%)';
          setTimeout(() => this.close(), 170);
          return;
        }
        surface.style.transition = 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)';
        surface.style.transform = 'translateY(0)';
        setTimeout(() => {
          surface.style.removeProperty('transform');
          surface.style.removeProperty('transition');
        }, 260);
      };

      surface.addEventListener('touchstart', start, { passive: true });
      surface.addEventListener('touchmove', move, { passive: false });
      surface.addEventListener('touchend', end);
      surface.addEventListener('touchcancel', end);
    }
  }
  customElements.define('hemma-popup', HemmaPopup);

  async function cardHelpers() {
    for (var i = 0; i < 120 && !window.loadCardHelpers; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return window.loadCardHelpers ? window.loadCardHelpers() : null;
  }

  function popupHost() {
    var ha = document.querySelector('home-assistant');
    return (ha && ha.shadowRoot) || document.body;
  }

  var _el = null;
  function instance() {
    if (!_el) _el = document.createElement('hemma-popup');
    var host = popupHost();
    if (_el.parentNode !== host) host.appendChild(_el);
    return _el;
  }

  window.hemmaPopupAction = function () {
    return window.hemmaPopup ? 'fire-dom-event' : 'more-info';
  };

  window.hemmaPopup = {
    open: function (data) { return instance().open(data || {}); },
    close: function () { if (_el) _el.close(); },
    moreInfo: function (entityId, view) {
      var ha = document.querySelector('home-assistant');
      if (!ha || !entityId) return;
      ha.dispatchEvent(new CustomEvent('hass-more-info', {
        bubbles: true, composed: true, detail: { entityId: entityId, view: view },
      }));
    },
    get element() { return _el; },
    get surface() { return _el && _el.hasAttribute('open') ? _el.surface : null; },
    get enabled() { return flagOn(); },
    setEnabled: function (on) {
      window.HEMMA_POPUP = !!on;
      try { localStorage.setItem('hemma_popup', on ? '1' : '0'); } catch (e) {}
    },
  };

  window.addEventListener('ll-custom', function (ev) {
    if (!flagOn()) return;
    var cfg = ev.detail && ev.detail.hemma_popup;
    if (!cfg) return;
    ev.stopPropagation();
    window.hemmaPopup.open(cfg);
  }, true);
})();

(function () {
  if (window._hemmaDialogChrome) return;
  window._hemmaDialogChrome = true;

  var MARK = '_hemmaChrome';

  var SHEET_RADIUS =
    ':host([placement="bottom"]) dialog {' +
    '  border-start-start-radius: var(--hemma-sheet-radius, 24px) !important;' +
    '  border-start-end-radius: var(--hemma-sheet-radius, 24px) !important;' +
    '}';

  var GRAIN = `
    dialog { isolation: isolate; }
    dialog::before, dialog::after {
      content: var(--hemma-dialog-grain-content, none); position: absolute; inset: 0; border-radius: inherit;
      pointer-events: none; background-size: 180px 180px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    dialog::before { mix-blend-mode: overlay; opacity: var(--hemma-popup-grain, 0.10); }
    dialog::after  { mix-blend-mode: screen;  opacity: var(--hemma-popup-grain-dark, 0.04); }
  `;

  var NO_ENTRANCE =
    'dialog::backdrop { animation: none !important; transition: none !important; }';

  var STACKED_SCRIM =
    ':host([hemma-stacked]) dialog::backdrop {' +
    '  background-color: var(--hemma-stacked-scrim, transparent) !important;' +
    '  background-image: none !important;' +
    '  backdrop-filter: var(--hemma-stacked-scrim-backdrop, none) !important;' +
    '  -webkit-backdrop-filter: var(--hemma-stacked-scrim-backdrop, none) !important;' +
    '}';

  var DRAWER_SLIDE =
    '@keyframes hemma-drawer-in { from { translate: 0 100%; } to { translate: 0 0; } }' +
    ':host([placement="bottom"]) dialog { animation-name: hemma-drawer-in !important; }';

  var CSS_BY_HOST = {
    'wa-dialog':
      'dialog {' +
      '  margin-block-start: var(--hemma-popup-top, 112px) !important;' +
      '  max-block-size: calc(100dvh - var(--hemma-popup-top, 112px)' +
      '                  - var(--hemma-dialog-bottom-gap, 16px)) !important;' +
      '}' + NO_ENTRANCE + STACKED_SCRIM + GRAIN,
    'wa-drawer': NO_ENTRANCE + STACKED_SCRIM + DRAWER_SLIDE + SHEET_RADIUS + GRAIN,
  };

  // The sidebar is a wa-drawer too; only the bottom sheet counts as a dialog.
  function isDialogHost(el) {
    if (!el || !CSS_BY_HOST[el.localName]) return false;
    return el.localName !== 'wa-drawer' || el.getAttribute('placement') === 'bottom';
  }

  function injectInto(el) {
    if (!el || el[MARK] || !el.shadowRoot) return false;
    if (!isDialogHost(el)) return false;
    el[MARK] = true;
    var css = CSS_BY_HOST[el.localName];
    var st = document.createElement('style');
    st.textContent = css;
    el.shadowRoot.appendChild(st);
    return true;
  }

  function inject(root, depth) {
    if (!root || depth > 12 || !root.querySelectorAll) return;
    root.querySelectorAll('*').forEach(function (el) {
      if (CSS_BY_HOST[el.localName]) injectInto(el);
      if (el.shadowRoot) inject(el.shadowRoot, depth + 1);
    });
  }

  function sweep() { inject(document, 0); }

  function patchShowModal() {
    var P = window.HTMLDialogElement && HTMLDialogElement.prototype;
    if (!P || P._hemmaPatched) return;
    P._hemmaPatched = true;
    var orig = P.showModal;
    P.showModal = function () {
      try {
        var root = this.getRootNode();
        if (root && root.host && isDialogHost(root.host)) {
          injectInto(root.host);
          var hp = window.hemmaPopup && window.hemmaPopup.element;
          root.host.toggleAttribute('hemma-stacked', !!(hp && hp.hasAttribute('open')));
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  function patchClass() {
    if (!window.customElements || !customElements.whenDefined) return;
    customElements.whenDefined('wa-dialog').then(function () {
      var C = customElements.get('wa-dialog');
      if (!C || C.prototype._hemmaPatched) return;
      C.prototype._hemmaPatched = true;
      var orig = C.prototype.connectedCallback;
      C.prototype.connectedCallback = function () {
        if (orig) orig.apply(this, arguments);
        var self = this;
        if (injectInto(self)) return;
        requestAnimationFrame(function () { injectInto(self); });
        [0, 8, 30, 120].forEach(function (d) {
          setTimeout(function () { injectInto(self); }, d);
        });
      };
    }).catch(function () {});
  }

  function boot() {
    var ha = document.querySelector('home-assistant');
    if (!ha || !ha.shadowRoot) { setTimeout(boot, 200); return; }
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        for (var j = 0; j < recs[i].addedNodes.length; j++) {
          var n = recs[i].addedNodes[j];
          if (n.localName && /-dialog$/.test(n.localName)) {
            [0, 30, 120, 300].forEach(function (d) { setTimeout(sweep, d); });
            return;
          }
        }
      }
    }).observe(ha.shadowRoot, { childList: true });
    patchShowModal();
    patchClass();
    sweep();
  }

  // A backdrop-filter's first paint builds its texture, so it cannot be animated from nothing.
  var WARM = ['--hemma-scrim-backdrop, blur(6px) saturate(1.35)'];

  function warmFilter() {
    try {
      WARM.forEach(function (f, i) {
        var w = document.createElement('div');
        w.style.cssText =
          'position:fixed;left:' + i + 'px;bottom:0;width:1px;height:1px;'
          + 'z-index:0;pointer-events:none;'
          + 'backdrop-filter:var(' + f + ');'
          + '-webkit-backdrop-filter:var(' + f + ');';
        document.body.appendChild(w);
        w.getBoundingClientRect();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { w.remove(); });
        });
      });
    } catch (e) {}
  }

  patchShowModal();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(); warmFilter(); });
  } else {
    boot();
    warmFilter();
  }
})();

(function () {
  if (window._hemmaUI) return;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var T = {
    ink:  'var(--hemma-popup-tiles-text-primary, #fff)',
    ink2: 'var(--hemma-popup-tiles-text-secondary, rgba(255,255,255,0.56))',
    ink3: 'var(--hemma-popup-ui-tertiary, rgba(255,255,255,0.42))',
    fill: 'var(--hemma-popup-ui-fill, rgba(255,255,255,0.06))',
    fill2:'var(--hemma-popup-ui-fill-2, rgba(255,255,255,0.10))',
    div:  'var(--hemma-popup-ui-divider, rgba(255,255,255,0.08))',
    blue: 'var(--hemma-popup-ui-action, var(--hemma-color-teal, #00C3D0))',
    green:'var(--hemma-popup-ui-good, #30D158)',
    amber:'var(--hemma-popup-ui-warn, #FF9F0A)',
    red:  'var(--hemma-popup-ui-bad, #FF453A)',
    accent: 'var(--hemma-color-teal, #00C3D0)',
    font: 'var(--primary-font-family, system-ui)',
    controlH: 314,
    controlW: 120,
  };

  var tone = function (t) {
    return t === 'good' ? T.green : t === 'warn' ? T.amber : t === 'bad' ? T.red
      : t === 'accent' ? T.accent : null;
  };

  function headline(o) {
    o = o || {};
    if (o.barTitle && !o.state) return '';
    var out = '<div style="font-family:' + T.font + ';text-align:center;'
      + 'padding:' + (o.padTop != null ? o.padTop : 2) + 'px 8px '
      + (o.barTitle ? ((o.caption != null || o.captionSlot) ? 3 : 10) : 18)
      + 'px;">';
    if (!o.barTitle) {
      out += '<div style="font-size:clamp(28px, 4.2vw, 38px);font-weight:700;'
        + 'letter-spacing:-0.02em;line-height:1.1;color:' + T.ink + ';">'
        + esc(o.title || '') + '</div>';
    }
    if (o.state) {
      var sheet = o.measure === 'sheet';
      out += '<div style="font-size:' + (sheet ? '22px' : 'clamp(17px, 2.1vw, 21px)')
        + ';font-weight:400;letter-spacing:' + (sheet ? '-0.5px' : '-0.01em')
        + ';margin-top:3px;color:'
        + (tone(o.stateTone) || (sheet ? T.ink : T.ink2)) + ';">'
        + esc(o.state) + '</div>';
    }
    if (o.caption != null || o.captionSlot) {
      out += '<div' + (o.captionId ? ' id="' + esc(o.captionId) + '"' : '')
        + ' style="font-size:' + (o.measure === 'sheet' ? '15px' : '14px')
        + ';font-weight:400;letter-spacing:-0.006em;'
        + 'margin-top:5px;min-height:18px;color:' + T.ink3 + ';'
        + 'transition:opacity .3s ease;opacity:' + (o.caption ? '1' : '0') + ';">'
        + esc(o.caption || '') + '</div>';
    }
    return out + '</div>';
  }

  function hero(o) {
    o = o || {};
    if (o.compact) {
      var cInk = tone(o.subTone);
      var out = '<div style="font-family:' + T.font + ';text-align:left;'
        + 'display:flex;align-items:flex-start;justify-content:space-between;'
        + 'gap:12px;padding:2px 2px 10px;">'
        + '<div style="display:flex;flex-direction:column;gap:1px;min-width:0;">';
      if (o.label) {
        out += '<div style="font-size:var(--hemma-popup-hero-label-size, 13px);'
          + 'letter-spacing:-0.01em;color:' + T.ink2 + ';">'
          + esc(o.label) + '</div>';
      }
      out += '<div style="font-size:var(--hemma-popup-hero-value-size,'
        + ' clamp(21px, 3.4vw, 28px));font-weight:600;letter-spacing:-0.02em;'
        + 'line-height:1.1;min-width:0;color:' + T.ink + ';">' + esc(o.value);
      if (o.unit) {
        out += '<span style="font-size:var(--hemma-popup-hero-unit-size,'
          + ' clamp(13px, 1.9vw, 17px));font-weight:400;letter-spacing:0;'
          + 'color:' + T.ink2 + ';"> ' + esc(o.unit) + '</span>';
      }
      out += '</div>';
      if (o.sub) {
        out += '<div style="font-size:13px;margin-top:2px;color:'
          + (cInk || T.ink2) + ';">' + esc(o.sub) + '</div>';
      }
      out += '</div>';
      if (o.trailing) {
        out += '<div style="flex:none;text-align:right;white-space:nowrap;'
          + 'display:flex;flex-direction:column;gap:1px;">';
        if (o.trailingLabel) {
          out += '<div style="font-size:var(--hemma-popup-hero-label-size, 13px);'
            + 'letter-spacing:-0.01em;color:' + T.ink3 + ';">'
            + esc(o.trailingLabel) + '</div>';
        }
        out += '<div style="font-size:17px;font-weight:600;letter-spacing:-0.01em;'
          + 'color:' + T.ink2 + ';">' + esc(o.trailing) + '</div></div>';
      }
      return out + '</div>';
    }
    var c = !!o.center;
    var left = '<div style="display:flex;flex-direction:column;min-width:0;'
      + 'gap:' + (c ? '6px' : '2px') + ';'
      + (c ? 'align-items:center;text-align:center;' : '') + '">';
    if (o.label) {
      left += '<div style="font-size:15px;font-weight:400;letter-spacing:-0.01em;'
        + 'color:' + T.ink2 + ';">' + esc(o.label) + '</div>';
    }
    var big = String(o.value == null ? '' : o.value).length <= 6;
    left += '<div style="font-size:' + (c ? '36px' : big ? '40px' : '28px') + ';'
      + 'font-weight:' + (c ? '400' : '600') + ';'
      + 'letter-spacing:' + (c ? '-0.01em' : '-0.025em') + ';line-height:1.08;'
      + 'font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:7px;'
      + (c ? 'justify-content:center;' : '') + 'color:' + T.ink + ';">'
      + esc(o.value);
    if (o.unit) {
      left += '<span style="font-size:19px;font-weight:400;letter-spacing:0;color:' + T.ink2 + ';">'
        + esc(o.unit) + '</span>';
    }
    left += '</div>';
    if (o.sub) {
      left += '<div style="font-size:' + (c ? '16px' : '14px') + ';'
        + 'color:' + (tone(o.subTone) || (c ? T.ink : T.ink2)) + ';">'
        + esc(o.sub) + '</div>';
    }
    left += '</div>';

    var right = '';
    if (o.chip && o.chip.text) {
      var chipInk = tone(o.chip.tone) || T.ink2;
      right = '<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;'
        + 'font-weight:500;padding:5px 11px;border-radius:999px;background:' + T.fill + ';color:' + chipInk + ';">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:currentColor;"></span>'
        + esc(o.chip.text) + '</span>';
    }

    return '<div style="font-family:' + T.font + ';display:flex;'
      + (c
          ? 'flex-direction:column;align-items:center;justify-content:center;gap:10px;'
            + 'padding:2px 4px 18px;text-align:center;'
          : 'align-items:flex-end;justify-content:space-between;gap:20px;'
            + 'padding:6px 4px 2px;text-align:left;')
      + '">' + left + right + '</div>';
  }

  var ICON_HUE = {
    light: 'var(--hemma-color-yellow, #FFCC00)',
    lamp: 'var(--hemma-color-yellow, #FFCC00)',
    bulb: 'var(--hemma-color-yellow, #FFCC00)',
    plex: 'var(--hemma-color-yellow, #FFCC00)',
    battery: 'var(--hemma-color-green, #30D158)',
    plant: 'var(--hemma-color-green, #30D158)',
    leaf: 'var(--hemma-color-green, #30D158)',
    energy: 'var(--hemma-color-green, #30D158)',
    power: 'var(--hemma-color-green, #30D158)',
    motion: 'var(--hemma-color-purple, #9333ea)',
    occupancy: 'var(--hemma-color-purple, #9333ea)',
    presence: 'var(--hemma-color-purple, #9333ea)',
    cellphone: 'var(--hemma-color-blue, #0A84FF)',
    phone: 'var(--hemma-color-blue, #0A84FF)',
    tablet: 'var(--hemma-color-blue, #0A84FF)',
    sunny: 'var(--hemma-color-yellow, #FFCC00)',
    beaker: 'var(--hemma-color-purple, #9333ea)',
  };

  function hueFor(name) {
    var n = String(name || '').toLowerCase();
    var keys = Object.keys(ICON_HUE);
    for (var i = 0; i < keys.length; i++) {
      if (n.indexOf(keys[i]) !== -1) return ICON_HUE[keys[i]];
    }
    return T.accent;
  }

  function icon(name, t) {
    if (!name) return '';
    var literal = (typeof t === 'string' && /^(var\(|#|rgb|hsl)/.test(t)) ? t : null;
    var fill = tone(t) || literal || hueFor(name);
    var tsz = 'var(--hemma-popup-icon-tile, 29px)';
    var tile = 'width:' + tsz + ';height:' + tsz + ';border-radius:7px;background:' + fill + ';flex:none;'
      + 'display:flex;align-items:center;justify-content:center;line-height:0;pointer-events:none;';
    if (String(name).indexOf(':') !== -1) {
      return '<div style="' + tile + '"><ha-icon icon="' + esc(name) + '" style="--mdc-icon-size:calc(' + tsz + ' * .62);'
        + 'width:calc(' + tsz + ' * .62);height:calc(' + tsz + ' * .62);color:#fff;display:flex;align-items:center;justify-content:center;'
        + 'line-height:0;"></ha-icon></div>';
    }
    var url = (typeof window.hemmaIconUrl === 'function')
      ? window.hemmaIconUrl(name) : '/local/hemma/icons/' + name + '.svg';
    return '<div style="' + tile + '"><div style="width:calc(' + tsz + ' * .586);height:calc(' + tsz + ' * .586);'
      + 'background-color:#fff;'
      + "-webkit-mask:url('" + url + "') center / contain no-repeat;"
      + "mask:url('" + url + "') center / contain no-repeat;\"></div></div>";
  }

  function group(rows, label, labelAction, opts) {
    rows = rows || [];
    var inside = !!(opts && opts.labelInside);
    var out = '';
    if (label && !inside) {
      out += '<div style="display:flex;align-items:baseline;justify-content:space-between;'
        + 'gap:12px;padding:0 4px 8px;">'
        + '<div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;'
        + 'color:' + T.ink + ';">' + esc(label) + '</div>';
      if (labelAction && labelAction.text) {
        out += '<div class="hui-ga" style="font-size:15px;font-weight:500;'
          + 'color:' + (tone(labelAction.tone) || T.blue) + ';'
          + 'cursor:pointer;white-space:nowrap;letter-spacing:-0.01em;"'
          + (labelAction.svc ? ' data-hemma-svc="' + esc(JSON.stringify(labelAction.svc)) + '"' : '')
          + '>' + esc(labelAction.text) + '</div>';
      }
      out += '</div>';
    }
    out += '<style>'
      + 'ha-card.disabled{pointer-events:auto!important;}'
      + '.hui-row{transition:background-color .18s ease;}'
      + '@keyframes hemma-plate-hold{from,to{opacity:0;}}'
      + '@keyframes hemma-plate-in{'
      + 'from{opacity:0;transform:perspective(900px) translateZ(-70px);}'
      + 'to{opacity:1;transform:perspective(900px) translateZ(0);}}'
      + '.hui-plate{animation:var(--hemma-popup-plate-enter, none);'
      + 'animation-delay:var(--hemma-popup-plate-delay, 0ms);}'
      + '.hui-div{transition:opacity .18s ease;}'
      + '.hui-tap:active{background:' + T.fill2 + ';}'
      + '.hui-tap:active + .hui-div{opacity:0;}'
      + '.hui-div:has(+ .hui-tap:active){opacity:0;}'
      + '@media (hover:hover){'
      +   '.hui-tap:hover{background:var(--hemma-popup-row-hover, rgba(255,255,255,0.045));}'
      +   '.hui-tap:hover + .hui-div{opacity:0;}'
      +   '.hui-div:has(+ .hui-tap:hover){opacity:0;}'
      + '}'
      + '.hui-chev{opacity:var(--hemma-popup-chev-opacity, .35);'
      +   'flex:none;pointer-events:none;'
      +   'margin-inline-start:var(--hemma-popup-chev-gap, 0px);}'
      + '@media (min-width: 340px){'
      +   '.hui-sub{display:inline-block;max-width:100%;vertical-align:bottom;'
      +     'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      +   '.hui-sub2::before{content:"  \\00b7  ";opacity:.6}'
      + '}'
      + '.hui-row{overflow:hidden;position:relative;--cf-w:88px;}'
      + '.hui-cf{position:absolute;top:12px;bottom:12px;right:8px;width:var(--cf-w);'
      +   'border-radius:calc(var(--hemma-popup-row-radius, 20px) - 9px);'
      +   'background:' + T.blue + ';color:#fff;font-size:14px;'
      +   'font-weight:560;display:grid;place-items:center;cursor:pointer;'
      +   'transform:translateX(calc(var(--cf-w) + 16px));'
      +   'transition:transform .36s cubic-bezier(.36,0,.16,1);}'
      // It is a button, so it answers the pointer like one.
      + '@media (hover:hover){.hui-cf:hover{filter:brightness(1.12);}}'
      + '.hui-cf:active{filter:brightness(0.94);}'
      + '.hui-row:not(.armed) .hui-cf{pointer-events:none;}'
      + '.hui-row.armed .hui-cf{transform:none;}'
      + '.hui-inner{display:flex;align-items:center;gap:12px;flex:1;min-width:0;'
      +   '--armed-x:0px;transform:translateX(var(--armed-x));'
      +   'transition:transform .36s cubic-bezier(.36,0,.16,1);}'
      + '.hui-row.armed .hui-inner{--armed-x:calc((var(--cf-w) + 16px) * -1);}'
      + '@media (prefers-reduced-motion:reduce){.hui-cf,.hui-inner{transition:none;}}'
      + '</style>';
    out += '<div class="hui-plate" style="background:var(--hemma-popup-row-fill, rgba(255,255,255,0.10));'
      + 'border-radius:var(--hemma-popup-row-radius, 20px);overflow:hidden;'
      + 'box-shadow:var(--hemma-popup-plate-shadow, none);'
      + 'backdrop-filter:var(--hemma-popup-plate-backdrop, none);'
      + '-webkit-backdrop-filter:var(--hemma-popup-plate-backdrop, none);">';
    if (label && inside) {
      out += '<div style="padding:var(--hemma-popup-row-pad-y, 8px)'
        + ' var(--hemma-popup-row-pad-x, 16px)'
        + ' var(--hemma-popup-group-label-gap, 10px);'
        + 'font-size:var(--hemma-popup-group-label-size, 15px);font-weight:600;'
        + 'letter-spacing:-0.01em;color:' + T.ink + ';">' + esc(label) + '</div>';
    }
    rows.forEach(function (r, i) {
      if (i) {
        out += '<div class="hui-div" style="height:1px;background:' + T.div
          + ';margin-left:calc(var(--hemma-popup-row-pad-x, 16px)'
          + ' + var(--hemma-popup-divider-inset, 0px));'
          + 'margin-right:var(--hemma-popup-row-pad-x, 16px);"></div>';
      }

      var arming = !!(r.svc && r.confirm);
      var armOnAction = !!(arming && r.entity && r.action);
      var tap = armOnAction
        ? ' data-hemma-mi="' + esc(r.entity) + '"'
        : arming
          ? ' data-hemma-arm=""'
          : (r.svc ? ' data-hemma-svc="' + esc(JSON.stringify(r.svc)) + '"'
                   : (r.entity ? ' data-hemma-mi="' + esc(r.entity) + '"' : ''));
      var tappable = arming || r.svc || r.entity || r.tappable;

      var lead;
      if (r.image !== undefined) {
        var plate = tone(r.iconTone)
          || ((typeof r.iconTone === 'string' && /^(var\(|#|rgb|hsl)/.test(r.iconTone))
                ? r.iconTone : null)
          || T.fill2;
        var psz = 'var(--hemma-popup-lead-plate, 32px)';
        lead = '<div style="width:' + psz + ';height:' + psz + ';border-radius:9px;flex:none;'
          + 'background:' + plate + ';display:grid;place-items:center;overflow:hidden;">'
          + (r.image
              ? '<img src="' + esc(r.image) + '" alt="" '
                + 'style="' + (r.imageFit === 'cover'
                    ? 'width:calc(' + psz + ' * .875);height:calc(' + psz + ' * .875);'
                      + 'border-radius:7px;object-fit:cover;'
                    : 'width:calc(' + psz + ' * .875);height:calc(' + psz + ' * .875);'
                      + 'object-fit:contain;')
                + 'display:block;">'
              : '<ha-icon icon="mdi:package-variant" style="--mdc-icon-size:19px;'
                + 'width:19px;height:19px;color:' + T.ink3 + ';"></ha-icon>')
          + '</div>';
      } else {
        lead = icon(r.icon, r.iconTone);
      }

      out += '<div class="hui-row' + (tappable ? ' hui-tap' : '') + '"' + tap
        + ' style="' + (tappable ? 'cursor:pointer;' : '')
        + 'display:flex;align-items:center;gap:12px;'
        + 'min-height:var(--hemma-popup-row-min, 52px);'
        + 'padding:var(--hemma-popup-row-pad-y, 8px) var(--hemma-popup-row-pad-x, 16px);">'
        + '<div class="hui-inner">'
        + lead
        + '<div style="flex:1;min-width:0;pointer-events:none;">'
        + '<div style="font-size:var(--hemma-popup-row-label-size, 17px);'
        + 'font-weight:var(--hemma-popup-row-label-weight, 400);'
        + 'letter-spacing:-0.022em;color:'
        + (tone(r.labelTone) || T.ink) + ';overflow:hidden;'
        + 'text-overflow:ellipsis;white-space:nowrap;">' + esc(r.label) + '</div>';

      if (r.sub) {
        var subs = Array.isArray(r.sub) ? r.sub : [r.sub];
        subs.forEach(function (line, si) {
          var sLive = '';
          if (si === 0 && r.subLive && r.entity && r.subLive.total) {
            sLive = ' data-hemma-live="share" data-hemma-ent="' + esc(r.entity) + '"'
              + ' data-hemma-total="' + esc(r.subLive.total) + '"'
              + ' data-hemma-suffix="' + esc(r.subLive.suffix || '%') + '"';
          }
          out += '<div class="hui-sub' + (si ? ' hui-sub2' : '') + '"' + sLive
            + ' style="font-size:var(--hemma-popup-sub-size, 13px);'
            + 'color:var(--hemma-popup-sub-color, ' + T.ink3 + ');overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
            + esc(line) + '</div>';
        });
      }
      if (r.bar != null) {
        var bt = tone(r.barTone) || T.ink2;
        var pct = Math.max(0, Math.min(1, r.bar)) * 100;
        var live = r.liveAttr && r.entity
          ? ' data-hemma-live="bar" data-hemma-ent="' + esc(r.entity)
            + '" data-hemma-attr="' + esc(r.liveAttr) + '"'
          : '';
        out += '<div style="height:4px;border-radius:999px;background:' + T.fill2
          + ';margin-top:7px;overflow:hidden;">'
          + '<div' + live + ' style="height:100%;width:' + pct.toFixed(1) + '%;'
          + 'border-radius:999px;background:' + bt + ';'
          + 'transition:width .3s cubic-bezier(.36,0,.16,1);"></div></div>';
      }
      out += '</div>';

      if (r.action) {
        var aLive = '';
        if (r.actionLive && r.entity) {
          aLive = ' data-hemma-live="act" data-hemma-ent="' + esc(r.entity) + '"'
            + ' data-hemma-act="' + esc(JSON.stringify(r.actionLive)) + '"';
        }
        out += '<div' + aLive + (armOnAction ? ' data-hemma-arm=""' : '')
          + ' style="font-size:var(--hemma-popup-row-action-size, 16px);'
          + 'font-weight:500;color:'
          + (tone(r.actionTone) || T.blue) + ';white-space:nowrap;'
          + (armOnAction
              ? 'pointer-events:auto;cursor:pointer;padding:8px 10px;margin:-8px -10px;'
              : 'pointer-events:none;')
          + '">' + esc(r.action) + '</div>';
      }
      if (r.value != null && r.value !== '') {
        var vlive = '';
        if (r.liveWords && r.entity) {
          vlive = ' data-hemma-live="word" data-hemma-ent="' + esc(r.entity)
            + '" data-hemma-words="' + esc(JSON.stringify(r.liveWords)) + '"';
        } else if (r.liveAttr && r.entity) {
          vlive = ' data-hemma-live="text" data-hemma-ent="' + esc(r.entity)
            + '" data-hemma-attr="' + esc(r.liveAttr) + '"'
            + ' data-hemma-suffix="' + esc(r.liveSuffix || '') + '"';
        }
        out += '<div' + vlive + ' style="font-size:var(--hemma-popup-row-value-size, 17px);'
          + 'letter-spacing:-0.022em;color:'
          + (tone(r.valueTone) || T.ink2)
          + ';margin-inline-start:var(--hemma-popup-value-gap, 0px)'
          + ';white-space:nowrap;pointer-events:none;">'
          + esc(r.value) + '</div>';
      }
      if ((r.entity || r.tappable) && (!r.svc || armOnAction)) {
        out += '<svg class="hui-chev" width="7" height="12" viewBox="0 0 7 12" aria-hidden="true">'
          + '<path d="M1 1L6 6L1 11" fill="none" stroke="' + T.ink3 + '" stroke-width="2" '
          + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      out += '</div>';   // .hui-inner

      if (arming) {
        out += '<div class="hui-cf" data-hemma-cf="' + esc(JSON.stringify(r.svc)) + '">'
          + esc(r.confirm === true ? 'Confirm' : r.confirm) + '</div>';
      }
      out += '</div>';   // .hui-row
    });
    out += '</div>';

    return '<div style="font-family:' + T.font + ';text-align:left;">' + out + '</div>';
  }

  // series: [{ color, value, label }]
  function legend(series) {
    var out = '<div style="font-family:' + T.font + ';display:flex;gap:16px;padding:8px 4px 0;">';
    (series || []).forEach(function (s) {
      out += '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:' + T.ink2 + ';'
        + 'font-variant-numeric:tabular-nums;">'
        + '<span style="width:8px;height:8px;border-radius:2px;background:' + s.color + ';"></span>'
        + '<b style="color:' + T.ink + ';font-weight:500;">' + esc(s.value) + '</b> ' + esc(s.label) + '</div>';
    });
    return out + '</div>';
  }

  if (!window._hemmaUIBound) {
    window._hemmaUIBound = true;
    var closeMediaOverlay = function (ov) {
      if (!ov || ov.hidden) return;
      if (ov._hemmaHidX) {
        ov._hemmaHidX.style.removeProperty('visibility');
        ov._hemmaHidX = null;
      }
      ov.classList.add('hui-closing');
      setTimeout(function () {
        ov.hidden = true;
        ov.classList.remove('hui-closing');
      }, 190);
    };
    var fire = function (ev) {
      if (Date.now() - (window._hemmaLastScrollTs || 0) < 400) return;
      var path = (ev.composedPath && ev.composedPath()) || [ev.target];
      for (var i = 0; i < path.length; i++) {
        var t = path[i];
        if (t && t.classList && t.classList.contains('hui-cf')) {
          if (Date.now() - (window._hemmaUILastTap || 0) < 400) return;
          window._hemmaUILastTap = Date.now();
          try {
            var cs = JSON.parse(t.dataset.hemmaCf);
            var ha3 = document.querySelector('home-assistant');
            if (ha3 && ha3.hass && cs && cs.domain) {
              ha3.hass.callService(cs.domain, cs.service, cs.data || {}, cs.target || undefined);
            }
          } catch (err) { console.error('hemma: bad confirm row', err); }
          if (t.parentNode && t.parentNode.classList) t.parentNode.classList.remove('armed');
          ev.preventDefault(); ev.stopPropagation();
          return;
        }
        if (t && t.dataset && t.dataset.hemmaMedia !== undefined) {
          if (Date.now() - (window._hemmaUILastTap || 0) < 400) return;
          window._hemmaUILastTap = Date.now();
          window._hemmaSuppressDismiss = Date.now() + 600;
          var shelf = t.closest && t.closest('.hui-mrow');
          var wrapM = shelf && shelf.parentElement;
          var ov = wrapM && wrapM.querySelector && wrapM.querySelector('.hui-mov');
          if (ov) {
            var vv = window.visualViewport;
            var vw = (vv && vv.width) || window.innerWidth;
            var vh = (vv && vv.height) || window.innerHeight;
            var place = function () {
              ov.style.left = '0px'; ov.style.top = '0px';
              ov.style.right = 'auto'; ov.style.bottom = 'auto';
              ov.style.width = vw + 'px';
              ov.style.height = vh + 'px';
              var r0 = ov.getBoundingClientRect();
              ov.style.left = (r0.left ? -r0.left : 0) + 'px';
              ov.style.top = (r0.top ? -r0.top : 0) + 'px';
              var host = ov.getRootNode && ov.getRootNode().host;
              var pop = host;
              while (pop && !(pop.shadowRoot
                     && pop.shadowRoot.querySelector('.header-close'))) {
                pop = pop.parentElement
                  || (pop.getRootNode && pop.getRootNode().host);
              }
              var cls = pop && pop.shadowRoot.querySelector('.header-close');
              if (cls) {
                var cr = cls.getBoundingClientRect();
                if (cr.height) {
                  ov.style.paddingTop = Math.max(0, cr.top) + 'px';
                  var bk = ov.querySelector('.hui-mback');
                  var col = ov.querySelector('.hui-movin');
                  if (bk && col) {
                    bk.style.marginLeft = '0px';
                    var br = col.getBoundingClientRect();
                    bk.style.marginLeft = (cr.left - br.left) + 'px';
                  }
                  ov._hemmaHidX = cls;
                  cls.style.visibility = 'hidden';
                }
              }
            };
            ov.hidden = false;
            place();
            requestAnimationFrame(place);
            if (ov._hemmaPlace) window.removeEventListener('resize', ov._hemmaPlace);
            ov._hemmaPlace = function () {
              if (ov.hidden) return;
              vw = (vv && vv.width) || window.innerWidth;
              vh = (vv && vv.height) || window.innerHeight;
              place();
            };
            window.addEventListener('resize', ov._hemmaPlace);
            var want = t.dataset.hemmaMedia;
            ov.querySelectorAll('.hui-mdet').forEach(function (d) {
              d.hidden = d.dataset.i !== want;
              if (!d.hidden) { d.style.animation = 'none'; void d.offsetWidth; d.style.animation = ''; }
            });
            ov.hidden = false;
          }
          ev.preventDefault(); ev.stopPropagation();
          return;
        }
        if (t && t.classList && t.classList.contains('hui-mback')) {
          window._hemmaSuppressDismiss = Date.now() + 600;
          closeMediaOverlay(t.closest ? t.closest('.hui-mov') : null);
          ev.preventDefault(); ev.stopPropagation();
          return;
        }
        // Anywhere on the overlay that is not the detail itself closes it.
        if (t && t.classList && t.classList.contains('hui-mov')) {
          window._hemmaSuppressDismiss = Date.now() + 600;
          closeMediaOverlay(t);
          ev.preventDefault(); ev.stopPropagation();
          return;
        }
        if (t && t.dataset && t.dataset.hemmaArm !== undefined) {
          if (Date.now() - (window._hemmaUILastTap || 0) < 400) return;
          window._hemmaUILastTap = Date.now();
          // The marker may sit on the row or on its action label.
          var armRow = (t.classList && t.classList.contains('hui-row')) ? t
            : (t.closest ? t.closest('.hui-row') : null);
          if (!armRow) return;
          var rt = t.getRootNode && t.getRootNode();
          if (rt && rt.querySelectorAll) {
            rt.querySelectorAll('.hui-row.armed').forEach(function (o) {
              if (o !== armRow) o.classList.remove('armed');
            });
          }
          armRow.classList.toggle('armed');
          ev.preventDefault(); ev.stopPropagation();
          return;
        }
        if (t && t.dataset && t.dataset.hemmaSvc) {
          if (Date.now() - (window._hemmaUILastTap || 0) < 400) return;
          window._hemmaUILastTap = Date.now();
          try {
            var spec = JSON.parse(t.dataset.hemmaSvc);
            var ha2 = document.querySelector('home-assistant');
            if (ha2 && ha2.hass && spec && spec.domain && spec.service) {
              ha2.hass.callService(spec.domain, spec.service, spec.data || {}, spec.target || undefined);
            }
          } catch (err) { console.error('hemma: bad service row', err); }
          ev.preventDefault(); ev.stopPropagation();
          return;
        }
        if (t && t.dataset && t.dataset.hemmaMi) {
          if (Date.now() - (window._hemmaUILastTap || 0) < 400) return;
          window._hemmaUILastTap = Date.now();
          var ha = document.querySelector('home-assistant');
          if (ha) {
            var el = window.hemmaPopup && window.hemmaPopup.element;
            if (el) el._miOpenedAt = Date.now();
            ha.dispatchEvent(new CustomEvent('hass-more-info', {
              bubbles: true, composed: true, detail: { entityId: t.dataset.hemmaMi },
            }));
          }
          return;
        }
      }
    };
    var TAP_SLOP = 10;
    var tp = null;
    document.addEventListener('touchstart', function (ev) {
      var t0 = ev.touches && ev.touches[0];
      tp = t0 ? { x: t0.clientX, y: t0.clientY, moved: false } : null;
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', function (ev) {
      if (!tp) return;
      var t1 = ev.touches && ev.touches[0];
      if (!t1) return;
      if (Math.abs(t1.clientX - tp.x) > TAP_SLOP
        || Math.abs(t1.clientY - tp.y) > TAP_SLOP) {
        tp.moved = true;
        window._hemmaLastScrollTs = Date.now();
      }
    }, { capture: true, passive: true });
    document.addEventListener('touchcancel', function () { tp = null; },
      { capture: true, passive: true });
    document.addEventListener('click', fire, true);
    document.addEventListener('touchend', function (ev) {
      var moved = !!(tp && tp.moved);
      tp = null;
      if (moved) return;
      fire(ev);
    }, true);

    var drag = null;
    var pctFrom = function (el, clientY) {
      var b = el.getBoundingClientRect();
      if (!b.height) return 0;
      var p = (b.bottom - clientY) / b.height * 100;
      return Math.max(0, Math.min(100, Math.round(p)));
    };
    var paint = function (el, pct) {
      var fill = el.querySelector('.hui-sl-fill');
      if (!fill) return;
      var inv = false;
      try { inv = !!JSON.parse(el.dataset.hemmaSlider).invert; } catch (e) {}
      fill.style.height = (inv ? 100 - pct : pct) + '%';
    };
    document.addEventListener('pointerdown', function (ev) {
      var path = (ev.composedPath && ev.composedPath()) || [ev.target];
      for (var i = 0; i < path.length; i++) {
        var el = path[i];
        if (el && el.dataset && el.dataset.hemmaSlider !== undefined) {
          drag = { el: el, pct: pctFrom(el, ev.clientY) };
          el.classList.add('drag');
          paint(el, drag.pct);
          ev.preventDefault();
          return;
        }
      }
    }, true);
    document.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      drag.pct = pctFrom(drag.el, ev.clientY);
      paint(drag.el, drag.pct);
      ev.preventDefault();
    }, true);
    var endDrag = function () {
      if (!drag) return;
      var d = drag; drag = null;
      d.el.classList.remove('drag');
      try {
        var spec = JSON.parse(d.el.dataset.hemmaSlider);
        var ha = document.querySelector('home-assistant');
        if (ha && ha.hass && spec && spec.domain) {
          var data = {};
          data[spec.field || 'position'] = d.pct;
          ha.hass.callService(spec.domain, spec.service, data, spec.target || undefined);
        }
      } catch (err) { console.error('hemma: bad slider', err); }
    };
    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);
  }

  function shelf(items, label) {
    items = items || [];
    var out = '';
    if (label) {
      out += '<div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;color:'
        + T.ink + ';padding:0 4px 10px;">' + esc(label) + '</div>';
    }
    out += '<style>'
      + '.hui-shelf{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x proximity;'
      +   '-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px 4px 4px;}'
      + '.hui-shelf::-webkit-scrollbar{display:none;}'
      + '.hui-art{flex:0 0 auto;width:136px;scroll-snap-align:start;}'
      + '.hui-art .p{position:relative;width:136px;height:204px;border-radius:12px;'
      +   'overflow:hidden;background:' + T.fill + ';'
      +   'box-shadow:0 8px 22px -10px rgba(0,0,0,.75);'
      +   'transition:transform .2s cubic-bezier(.36,0,.16,1);}'
      + '.hui-art .p::after{content:"";position:absolute;inset:0;border-radius:inherit;'
      +   'box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);pointer-events:none;}'
      + '.hui-art img{width:100%;height:100%;object-fit:cover;display:block;}'
      + '.hui-art .t{font-size:15px;font-weight:500;color:' + T.ink + ';margin-top:9px;'
      +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      + '.hui-cap{display:flex;align-items:center;gap:6px;margin-top:4px;}'
      + '.hui-pill{font-size:11px;font-weight:600;letter-spacing:.02em;padding:2px 7px;'
      +   'border-radius:999px;white-space:nowrap;flex:none;background:' + T.fill2 + ';'
      +   'color:' + T.ink2 + ';font-variant-numeric:tabular-nums;}'
      + '.hui-when{font-size:13px;color:' + T.ink3 + ';overflow:hidden;'
      +   'text-overflow:ellipsis;white-space:nowrap;}'
      + '.hui-art .n{position:absolute;top:8px;right:8px;width:10px;height:10px;'
      +   'border-radius:50%;background:' + T.blue + ';box-shadow:0 0 0 2px rgba(0,0,0,.45);}'
      + '@media (hover:hover){.hui-art:hover .p{transform:scale(1.035);}}'
      + '@media (prefers-reduced-motion:reduce){.hui-art .p{transition:none;}}'
      + '</style>';
    out += '<div class="hui-shelf">';
    items.forEach(function (it) {
      out += '<div class="hui-art"><div class="p">'
        + (it.image
            ? '<img src="' + esc(it.image) + '" loading="lazy" alt=""/>'
            : '<div style="width:100%;height:100%;display:flex;align-items:center;'
              + 'justify-content:center;color:' + T.ink3 + ';font-size:24px;">\u25b6</div>')
        + (it.unwatched ? '<div class="n"></div>' : '')
        + '</div>'
        + '<div class="t">' + esc(it.title) + '</div>';
      if (it.badge || it.meta) {
        out += '<div class="hui-cap">';
        if (it.badge) out += '<span class="hui-pill">' + esc(it.badge) + '</span>';
        if (it.meta) out += '<span class="hui-when">' + esc(it.meta) + '</span>';
        out += '</div>';
      }
      out += '</div>';
    });
    out += '</div>';
    return '<div style="font-family:' + T.font + ';text-align:left;">' + out + '</div>';
  }

  function prime(urls) {
    var seen = window._hemmaImgPrimed || (window._hemmaImgPrimed = new Set());
    var todo = [];
    (urls || []).forEach(function (u) {
      if (!u || seen.has(u)) return;
      seen.add(u);
      todo.push(u);
    });
    if (!todo.length) return;
    var go = function () {
      todo.forEach(function (u) {
        var im = new Image();
        try { im.fetchPriority = 'low'; } catch (e) {}
        im.decoding = 'async';
        im.src = u;
      });
    };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 1200);
  }

  function mediaRow(items, label, opts) {
    items = items || [];
    opts = opts || {};
    var base = opts.base == null ? 0.08 : Number(opts.base);
    var step = opts.step == null ? 0.028 : Number(opts.step);
    var first = Number(opts.index) || 0;
    var delay = function (i) { return (base + (first + i) * step).toFixed(3) + 's'; };
    var out = '';
    if (label) {
      out += '<div class="hui-mlabel" style="--hui-d:' + delay(0) + ';">'
        + esc(label) + '</div>';
    }
    out += '<style>'
      + '.hui-mrow{display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));'
      +   'gap:26px 30px;padding:2px var(--hui-gutter, var(--hemma-popup-gutter, 26px)) 4px;}'
      + '@media (max-width: 900px){.hui-mrow{grid-template-columns:repeat(2, minmax(0, 1fr));}}'
      + '@media (max-width: 640px){.hui-mrow{grid-template-columns:minmax(0, 1fr);'
      +   'gap:var(--hui-mrow-gap-phone, 32px);}}'
      + '.hui-m{min-width:0;padding:0;border-radius:18px;}'
      + '.hui-m .fa{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;'
      +   'overflow:hidden;background:' + T.fill + ';'
      +   'box-shadow:0 10px 26px -12px rgba(0,0,0,.8);}'
      + '.hui-m .fa::after{content:"";position:absolute;inset:0;border-radius:inherit;'
      +   'box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);pointer-events:none;}'
      + '.hui-m img{width:100%;height:100%;object-fit:cover;display:block;}'
      + '.hui-m .w{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
      +   'color:' + T.ink3 + ';margin-top:10px;overflow:hidden;'
      +   'text-overflow:ellipsis;white-space:nowrap;}'
      + '.hui-m .h,.hui-m .hm{font-size:16px;font-weight:600;letter-spacing:-0.01em;'
      +   'color:' + T.ink + ';margin-top:2px;overflow:hidden;'
      +   'text-overflow:ellipsis;white-space:nowrap;}'
      + '.hui-m .e{font-size:13px;color:' + T.ink2 + ';margin-top:2px;overflow:hidden;'
      +   'text-overflow:ellipsis;white-space:nowrap;}'
      + '.hui-m .hm,.hui-m .e{display:none;}'
      + '.hui-m .s{font-size:14px;line-height:1.42;color:' + T.ink2 + ';margin-top:4px;'
      +   'white-space:normal !important;overflow-wrap:anywhere;'
      +   'display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;'
      +   'overflow:hidden;max-height:calc(1.42em * 5);}'
      + '.hui-m .ck{position:absolute;top:8px;right:8px;width:26px;height:26px;'
      +   'border-radius:50%;background:rgba(0,0,0,.64);display:grid;'
      +   'place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.30),'
      +   'inset 0 0 0 0.5px rgba(255,255,255,.18);}'
      + '.hui-m .ck svg{width:15px;height:15px;display:block;}'
      + '@media (max-width: 640px){'
      +   '.hui-m.split .h{display:none;}'
      +   '.hui-m .hm,.hui-m .e{display:block;}'
      +   '.hui-m .s{display:none;}'
      +   '.hui-mlabel{--hui-label-size:24px;--hui-label-gap:10px;'
      +     '--hui-label-weight:700;--hui-label-track:-0.02em;}}'
      + '@media (max-width: 640px){.hui-mlabel{--hui-label-size:17px;}}'
      + '@keyframes hui-m-in{from{opacity:0;transform:translateY(10px) scale(0.986);}'
      +   'to{opacity:1;transform:none;}}'
      + '@keyframes hui-tx-in{from{opacity:0.2;transform:scale(0.972) translateY(5px);}'
      +   'to{opacity:1;transform:none;}}'
      + '.hui-mlabel{font-size:var(--hui-label-size, 17px);'
      +   'font-weight:var(--hui-label-weight, 600);'
      +   'letter-spacing:var(--hui-label-track, -0.01em);color:' + T.ink + ';'
      +   'padding:0 var(--hui-gutter, var(--hemma-popup-gutter, 26px)) var(--hui-label-gap, 10px);'
      +   'transform-origin:0% 40%;'
      +   'animation:hui-tx-in var(--hui-tx-dur, .28s) cubic-bezier(0.32, 0.72, 0, 1) both;'
      +   'animation-delay:var(--hui-d, 0s);}'
      + '.hui-m{animation:hui-m-in var(--hui-cell-dur, .28s) cubic-bezier(0.16, 1, 0.3, 1) backwards;'
      +   'animation-delay:var(--hui-d, 0s);}'
      + '.hui-m .w,.hui-m .h,.hui-m .hm,.hui-m .e,.hui-m .s{transform-origin:0% 40%;'
      +   'animation:hui-tx-in var(--hui-tx-dur, .28s) cubic-bezier(0.32, 0.72, 0, 1) both;}'
      + '.hui-m .w{animation-delay:calc(var(--hui-d, 0s) + .03s);}'
      + '.hui-m .h,.hui-m .hm{animation-delay:calc(var(--hui-d, 0s) + .045s);}'
      + '.hui-m .e,.hui-m .s{animation-delay:calc(var(--hui-d, 0s) + .06s);}'
      + '.hui-m .fa img{opacity:0;transition:opacity .24s ease;}'
      + '.hui-m .fa.rdy img{opacity:1;}'
      + '@media (prefers-reduced-motion:reduce){'
      +   '.hui-mlabel,.hui-m,.hui-m .w,.hui-m .h,.hui-m .hm,.hui-m .e,'
      +   '.hui-m .s{animation:none;}'
      +   '.hui-m .fa img{transition:none;}}'
      + (opts.tiles
          ? '.hui-m{position:relative;border-radius:var(--hemma-popup-row-radius, 20px);'
          +   'overflow:hidden;box-shadow:var(--hemma-popup-plate-shadow, none);'
          +   'background:var(--hemma-popup-row-fill, rgba(255,255,255,0.10));}'
          + '.hui-m .fa{position:relative;width:100%;aspect-ratio:16/9;'
          +   'border-radius:0;margin:0;overflow:hidden;}'
          + '.hui-m .fa img{width:100%;height:100%;object-fit:cover;display:block;}'
          + '.hui-m .ph{width:100%;height:100%;display:flex;align-items:center;'
          +   'justify-content:center;color:' + T.ink3 + ';font-size:26px;}'
          + '.hui-m .sc{position:absolute;inset:auto 0 0 0;height:48%;'
          +   'background:linear-gradient(to top,'
          +     'rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.44) 38%,'
          +     'rgba(0,0,0,0.16) 70%,rgba(0,0,0,0) 100%);'
          +   'pointer-events:none;}'
          + '.hui-m .cap{position:absolute;left:0;right:0;bottom:0;'
          +   'padding:0 14px 12px;pointer-events:none;}'
          + '.hui-m .cap .t{font-size:16px;font-weight:600;letter-spacing:-0.01em;'
          +   'color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.5);'
          +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
          + '.hui-m .cap .yr{font-weight:400;color:rgba(255,255,255,0.72);}'
          + '.hui-m .cap .l2{font-size:13px;margin-top:1px;'
          +   'color:rgba(255,255,255,0.62);text-shadow:0 1px 3px rgba(0,0,0,0.5);'
          +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
          + '.hui-m .rt{position:absolute;top:10px;left:10px;'
          +   'font-size:12px;font-weight:600;color:#fff;'
          +   'padding:4px 9px;border-radius:999px;'
          +   'background:rgba(0,0,0,0.55);'
          +   'backdrop-filter:var(--hemma-popup-tile-backdrop, none);'
          +   '-webkit-backdrop-filter:var(--hemma-popup-tile-backdrop, none);}'
          + '.hui-m .ck{top:10px;right:10px;}'
          + '.hui-m{transition:transform .2s ease, box-shadow .2s ease;'
          +   'transform:scale(1);}'
          + '@media (hover:hover){'
          +   '.hui-m:hover{transform:scale(1.014);'
          +     'box-shadow:var(--hemma-popup-plate-shadow-hover,'
          +     ' 0 22px 48px -20px rgba(0,0,0,0.58), 0 3px 10px -5px rgba(0,0,0,0.34));}'
          + '}'
          + '@media (hover:hover){.hui-m:hover .fa img{transform:scale(1.022);}}'
          + '.hui-m .fa img{transition:transform .3s cubic-bezier(0.16, 1, 0.3, 1);}'
          + '.hui-m:active{transform:scale(0.99);}'
          + '.hui-m{cursor:pointer;}'
          + '.hui-mov{position:fixed;inset:0;z-index:20;display:grid;'
          +   'align-items:start;justify-items:center;padding:24px;'
          +   'box-sizing:border-box;'
          // Blur only - the darkening read as a scrim on top of the popup's own.
          +   'backdrop-filter:var(--hemma-media-overlay-backdrop,blur(18px));'
          +   '-webkit-backdrop-filter:var(--hemma-media-overlay-backdrop,blur(18px));}'
          + '.hui-mov[hidden]{display:none;}'
          + '.hui-mov{transition:opacity .19s ease,'
          +   'backdrop-filter .19s ease,-webkit-backdrop-filter .19s ease;}'
          + '.hui-mov.hui-closing{opacity:0;'
          +   'backdrop-filter:var(--hemma-media-overlay-backdrop,blur(0px));'
          +   '-webkit-backdrop-filter:var(--hemma-media-overlay-backdrop,blur(0px));}'
          + '.hui-mdet{transition:transform .19s cubic-bezier(0.4, 0, 1, 1);}'
          + '.hui-mov.hui-closing .hui-mdet{transform:scale(0.97);}'
          + '.hui-mdet[hidden]{display:none;}'
          + '.hui-movin{width:min(760px, 100%);max-height:100%;min-height:0;'
          +   'display:flex;flex-direction:column;align-items:flex-start;gap:18px;}'
          + '.hui-mback{width:48px;height:48px;border-radius:50%;position:relative;'
          +   'flex:none;display:flex;align-items:center;justify-content:center;'
          +   'cursor:pointer;pointer-events:auto;transition:transform .15s ease;'
          +   'background:var(--hemma-popup-row-fill, rgba(255,255,255,0.10));'
          +   'backdrop-filter:var(--hemma-popup-plate-backdrop, none);'
          +   '-webkit-backdrop-filter:var(--hemma-popup-plate-backdrop, none);'
          +   'box-shadow:var(--hemma-popup-plate-shadow, none);}'
          + '.hui-mback:active{transform:scale(0.94);}'
          + '.hui-mdet{width:100%;flex:1 1 auto;min-height:0;overflow:auto;'
          +   'scrollbar-width:none;'
          +   'border-radius:var(--hemma-popup-row-radius, 20px);'
          +   'background:var(--hemma-popup-row-fill, rgba(255,255,255,0.10));'
          +   'box-shadow:var(--hemma-popup-detail-shadow,'
          +   ' 0 10px 30px -22px rgba(0,0,0,0.45));'
          // The same depth entrance everything else uses.
          +   'animation:hemma-plate-in 320ms cubic-bezier(0.2,0.8,0.3,1) both;}'
          + '.hui-mdet::-webkit-scrollbar{display:none;}'
          + '.hui-mdet .fa{width:100%;aspect-ratio:16/9;overflow:hidden;'
          +   'border-radius:var(--hemma-popup-row-radius, 20px)'
          +   ' var(--hemma-popup-row-radius, 20px) 0 0;}'
          + '.hui-mdet .fa img{width:100%;height:100%;object-fit:cover;display:block;}'
          + '.hui-mdet .meta{padding:18px 22px 22px;}'
          + '.hui-mdet .t{font-size:24px;font-weight:700;letter-spacing:-0.02em;'
          +   'color:' + T.ink + ';}'
          + '.hui-mdet .yr{font-weight:400;color:' + T.ink2 + ';}'
          + '.hui-mdet .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}'
          + '.hui-mdet .c{font-size:12px;font-weight:600;color:' + T.ink2 + ';'
          +   'background:' + T.fill2 + ';border-radius:999px;padding:5px 10px;}'
          + '.hui-mdet .t,.hui-mdet .s,.hui-mdet .c{white-space:normal;'
          +   'overflow:visible;text-overflow:clip;}'
          + '.hui-mdet .s{overflow-wrap:anywhere;'
          +   'font-size:15px;line-height:1.45;margin-top:14px;'
          +   'color:' + T.ink2 + ';}'
          + '@keyframes hemma-plate-in{'
          +   'from{opacity:0;transform:perspective(900px) translateZ(-70px);}'
          +   'to{opacity:1;transform:perspective(900px) translateZ(0);}}'
          + '.hui-m{animation:hemma-plate-in var(--hui-cell-dur, .42s) '
          +   'cubic-bezier(0.16, 1, 0.3, 1) backwards;animation-delay:0s;}'
          + '.hui-mlabel{animation-delay:0s;}'
          + '.hui-m,.hui-mrow,.hui-mov{pointer-events:auto;}'
          + '.hui-mrow{grid-template-columns:'
          +   'repeat(var(--hui-cols, 3), var(--hui-tile-w, min(381px, (min(1260px, 94vw) - 116px) / 3)));}'
          + '@media (max-width: 900px){.hui-mrow{'
          +   'grid-template-columns:repeat(2, minmax(0, 1fr));}}'
          + '@media (max-width: 640px){.hui-mrow{'
          +   'grid-template-columns:minmax(0, 1fr);}}'
          + '@media (max-width: 640px){'
          +   '.hui-mrow{grid-template-columns:minmax(0, 1fr);}'
          +   '.hui-m,.hui-m:first-child{grid-column:auto;}}'
          : '')
      + '</style>';
    var nT = items.length;
    out += '<div class="hui-mrow"'
      + (opts.tiles ? ' style="--hui-cols:' + Math.min(nT, 3) + ';"' : '')
      + '>';
    if (opts.tiles) {
      items.forEach(function (it, i) {
        out += '<div class="hui-m" data-hemma-media="' + i + '"'
          + ' style="--hui-d:' + delay(i + 1) + ';">'
          + '<div class="fa">'
          + (it.image
              ? '<img src="' + esc(it.image) + '" alt="" decoding="async" '
                + 'onload="this.parentNode.classList.add(\'rdy\')" '
                + 'onerror="this.onerror=null;this.style.display=\'none\'"/>'
              : '<div class="ph">\u25b6</div>')
          + '<div class="sc"></div>'
          + (it.rating ? '<div class="rt">' + esc(it.rating) + '</div>' : '')
          + (it.watched
              ? '<div class="ck"><svg viewBox="0 0 24 24" aria-hidden="true">'
                + '<path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" fill="none" stroke="#fff" '
                + 'stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
                + '</svg></div>'
              : '')
          + '<div class="cap">'
          + (it.title ? '<div class="t">' + esc(it.title)
              + (it.year ? '<span class="yr"> \u00b7 ' + esc(it.year) + '</span>' : '')
              + '</div>' : '')
          + (it.line2 ? '<div class="l2">' + esc(it.line2) + '</div>' : '')
          + '</div></div></div>';
      });
      out += '</div>';
      out += '<div class="hui-mov" hidden><div class="hui-movin">'
        + '<div class="hui-mback" role="button" aria-label="Back">'
        +   '<svg width="14" height="24" viewBox="0 0 14 24" fill="none"'
        +   ' style="margin-right:2px;pointer-events:none;">'
        +   '<path d="M12 2.5 L2.8 12 L12 21.5" stroke="#fff" stroke-width="3"'
        +   ' stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '</div>';
      items.forEach(function (it, i) {
        out += '<div class="hui-mdet" data-i="' + i + '" hidden>'
          + '<div class="fa">'
          + (it.image ? '<img src="' + esc(it.image) + '" alt=""/>' : '')
          + '</div>'
          + '<div class="meta">'
          + (it.title ? '<div class="t">' + esc(it.title)
              + (it.year ? '<span class="yr"> \u00b7 ' + esc(it.year) + '</span>' : '')
              + '</div>' : '')
          + '<div class="chips">'
          +   (it.rating ? '<span class="c">' + esc(it.rating) + '</span>' : '')
          +   (it.line2 ? '<span class="c">' + esc(it.line2) + '</span>' : '')
          +   (it.runtime ? '<span class="c">' + esc(it.runtime) + '</span>' : '')
          +   (it.added ? '<span class="c">' + esc(it.added) + '</span>' : '')
          + '</div>'
          + (it.summary ? '<div class="s">' + esc(it.summary) + '</div>' : '')
          + '</div></div>';
      });
      out += '</div></div>';
      return '<div style="font-family:' + T.font + ';text-align:left;">'
        + out + '</div>';
    }

    items.forEach(function (it, i) {
      var tm = it.titleMobile && it.titleMobile !== it.title ? it.titleMobile : null;
      out += '<div class="hui-m' + (tm ? ' split' : '')
        + '" style="--hui-d:' + delay(i + 1) + ';"><div class="fa">'
        + (it.image
            ? '<img src="' + esc(it.image) + '" alt="" decoding="async" '
              + 'onload="this.parentNode.classList.add(\'rdy\')" '
              + 'onerror="this.onerror=null;this.style.display=\'none\'"/>'
            : '<div style="width:100%;height:100%;display:flex;align-items:center;'
              + 'justify-content:center;color:' + T.ink3 + ';font-size:26px;">\u25b6</div>')
        + (it.watched
            ? '<div class="ck"><svg viewBox="0 0 24 24" aria-hidden="true">'
              + '<path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" fill="none" stroke="#fff" '
              + 'stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
              + '</svg></div>'
            : '')
        + '</div>';
      if (it.when)    out += '<div class="w">' + esc(it.when) + '</div>';
      if (it.title)   out += '<div class="h">' + esc(it.title) + '</div>';
      if (tm)         out += '<div class="hm">' + esc(tm) + '</div>';
      if (it.sub)     out += '<div class="e">' + esc(it.sub) + '</div>';
      if (it.summary) out += '<div class="s">' + esc(it.summary) + '</div>';
      out += '</div>';
    });
    out += '</div>';
    if (opts.plate) {
      return '<div class="hui-plate" style="font-family:' + T.font + ';text-align:left;'
        + 'background:var(--hemma-popup-row-fill, rgba(255,255,255,0.10));'
        + 'border-radius:var(--hemma-popup-row-radius, 20px);'
        + 'box-shadow:var(--hemma-popup-plate-shadow, none);'
        + 'backdrop-filter:var(--hemma-popup-plate-backdrop, none);'
        + '-webkit-backdrop-filter:var(--hemma-popup-plate-backdrop, none);'
        + 'padding:var(--hemma-popup-shelf-pad, 18px 0 22px);">' + out + '</div>';
    }
    return '<div style="font-family:' + T.font + ';text-align:left;">' + out + '</div>';
  }

  // A row of preset pills. items: [{ label, svc, active }]
  function segments(items, label) {
    items = items || [];
    var out = '';
    if (label) {
      out += '<div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;color:'
        + T.ink + ';padding:0 4px 8px;">' + esc(label) + '</div>';
    }
    out += '<style>'
      + 'ha-card.disabled{pointer-events:auto!important;}'
      + '.hui-seg{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;}'
      + '.hui-sg{flex:0 1 auto;text-align:center;'
      +   'font-size:14px;font-weight:500;'
      +   'padding:11px 13px;border-radius:var(--hemma-popup-seg-radius, 999px);'
      +   'background:var(--hemma-popup-seg-fill, rgba(255,255,255,0.16));'
      +   'color:' + T.ink + ';'
      +   'cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      +   'transition:background-color .16s ease;}'
      + '.hui-sg.on{background:' + T.ink + ';color:#000;}'
      + '@media (hover:hover){.hui-sg:not(.on):hover{background:var(--hemma-popup-seg-fill-hover, rgba(255,255,255,0.24));}}'
      + '@media (prefers-reduced-motion:reduce){.hui-sg{transition:none;}}'
      + '</style>';
    out += '<div class="hui-seg">';
    items.forEach(function (it) {
      out += '<div class="hui-sg' + (it.active ? ' on' : '') + '"'
        + (it.svc ? ' data-hemma-svc="' + esc(JSON.stringify(it.svc)) + '"' : '')
        + '>' + esc(it.label) + '</div>';
    });
    out += '</div>';
    return '<div style="font-family:' + T.font + ';text-align:left;">' + out + '</div>';
  }

  function slider(o) {
    o = o || {};
    var v = Math.max(0, Math.min(100, Number(o.value) || 0));
    var inv = !!o.invert;
    var h = o.height || T.controlH;
    var w = o.width || T.controlW;
    var fillPct = inv ? (100 - v) : v;
    var payload = esc(JSON.stringify(Object.assign({ invert: inv }, o.svc || {})));

    var glyph = '';
    if (o.icon) {
      var url = (typeof window.hemmaIconUrl === 'function')
        ? window.hemmaIconUrl(o.icon) : '/local/hemma/icons/' + o.icon + '.svg';
      glyph = '<div class="hui-sl-ic" style="-webkit-mask:url(\'' + url + '\') center / contain no-repeat;'
        + 'mask:url(\'' + url + '\') center / contain no-repeat;"></div>';
    }

    var live = '';
    if (o.live && o.live.entities && o.live.entities.length) {
      live = ' data-hemma-live="fill"'
        + ' data-hemma-ents="' + esc(JSON.stringify(o.live.entities)) + '"'
        + ' data-hemma-attr="' + esc(o.live.attr || 'current_position') + '"'
        + (inv ? ' data-hemma-invert="1"' : '');
    }

    var out = '<style>'
      + 'ha-card.disabled{pointer-events:auto!important;}'
      + '.hui-sl-wrap{display:flex;justify-content:center;}'
      + '.hui-sl{position:relative;width:' + w + 'px;height:' + h + 'px;'
      +   'border-radius:var(--hemma-popup-control-radius, 37px);overflow:hidden;'
      +   'background:var(--hemma-popup-slider-track, rgba(0,0,0,0.34));'
      +   'cursor:ns-resize;touch-action:none;user-select:none;-webkit-user-select:none;}'
      + '.hui-sl-fill{position:absolute;left:0;right:0;'
      +   (inv ? 'top:0;' : 'bottom:0;')
      +   'background:var(--hemma-popup-slider-fill, var(--hemma-color-teal, #00C3D0));'
      +   'transition:height .18s cubic-bezier(.36,0,.16,1);}'
      + '.hui-sl.drag .hui-sl-fill{transition:none;}'
      + '.hui-sl-ic{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);'
      +   'width:30px;height:30px;pointer-events:none;'
      +   'background-color:var(--hemma-popup-slider-icon, #ffffff);}'
      + '@media (prefers-reduced-motion:reduce){.hui-sl-fill{transition:none;}}'
      + '</style>'
      + '<div class="hui-sl-wrap"><div class="hui-sl" data-hemma-slider="' + payload + '">'
      +   '<div class="hui-sl-fill"' + live + ' style="height:' + fillPct + '%"></div>'
      +   glyph
      + '</div></div>';
    return '<div style="font-family:' + T.font + ';">' + out + '</div>';
  }

  function note(text) {
    return '<div style="font-family:' + T.font + ';font-size:13px;color:' + T.ink3
      + ';padding:2px 4px 0;text-align:left;">' + esc(text) + '</div>';
  }

  var COVER_KINDS = {
    curtain: { key: 'curtain', label: 'Curtains', open: 'curtain-open',         closed: 'curtain-closed' },
    blind:   { key: 'blind',   label: 'Blinds',   open: 'blinds-vertical-open', closed: 'blinds-vertical-closed' },
    shade:   { key: 'shade',   label: 'Shades',   open: 'roller-shade-open',    closed: 'roller-shade-closed' },
    shutter: { key: 'shutter', label: 'Shutters', open: 'window-shade-open',    closed: 'window-shade-closed' },
    awning:  { key: 'awning',  label: 'Awnings',  open: 'window-shade-open',    closed: 'window-shade-closed' },
    window:  { key: 'window',  label: 'Windows',  open: 'window-shade-open',    closed: 'window-shade-closed' },
    door:    { key: 'door',    label: 'Doors',    open: 'door-open',            closed: 'door-closed' },
    garage:  { key: 'garage',  label: 'Garage',   open: 'door-open',            closed: 'door-closed' },
    gate:    { key: 'gate',    label: 'Gates',    open: 'door-open',            closed: 'door-closed' },
  };
  // device_class first, then a guess from the entity_id, then curtain.
  window.hemmaCoverKind = function (dc, id) {
    var k = String(dc == null ? '' : dc).toLowerCase();
    if (COVER_KINDS[k]) return COVER_KINDS[k];
    var n = String(id == null ? '' : id).toLowerCase();
    var keys = Object.keys(COVER_KINDS);
    for (var i = 0; i < keys.length; i++) {
      if (n.indexOf(keys[i]) !== -1) return COVER_KINDS[keys[i]];
    }
    return COVER_KINDS.curtain;
  };


  var PLANT_CACHE_V = 1;
  function plantWater(node, entityId, dryPct) {
    if (!node || !entityId) return;
    var hass = (document.querySelector('home-assistant') || {}).hass;
    if (!hass || !hass.callWS) return;
    var key = 'v' + PLANT_CACHE_V + ':' + entityId;
    window._hemmaPlantW = window._hemmaPlantW || {};
    var hit = window._hemmaPlantW[key];
    if (hit && Date.now() - hit.at < 300000) { paintPlant(node, hit.txt); return; }

    var end = new Date();
    var start = new Date(end.getTime() - 14 * 86400000);
    var stat = hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(), end_time: end.toISOString(),
      statistic_ids: [entityId], period: 'hour', types: ['mean'],
    }).then(function (r) {
      var pts = (r && r[entityId]) || [];
      return pts.map(function (p) { return { t: p.start, v: p.mean }; });
    }).catch(function () { return []; });

    stat.then(function (pts) {
      if (pts.length >= 6) return pts;
      // Statistics are not being kept for this sensor - take what history has.
      return hass.callWS({
        type: 'history/history_during_period',
        start_time: start.toISOString(), end_time: end.toISOString(),
        entity_ids: [entityId], minimal_response: true, no_attributes: true,
      }).then(function (r) {
        var raw = (r && r[entityId]) || [];
        return raw.map(function (p) {
          return { t: (p.lu != null ? p.lu * 1000 : p.last_updated), v: parseFloat(p.s || p.state) };
        }).filter(function (p) { return isFinite(p.v); });
      }).catch(function () { return []; });
    }).then(function (pts) {
      var txt = readPlant(pts, dryPct);
      window._hemmaPlantW[key] = { at: Date.now(), txt: txt };
      paintPlant(node, txt);
    });
  }

  function paintPlant(node, txt) {
    if (!node) return;
    node.textContent = txt || '';
    node.style.opacity = txt ? '1' : '0';
  }

  function readPlant(pts, dryPct) {
    pts = (pts || []).filter(function (p) { return p && isFinite(p.v) && p.t; })
      .sort(function (a, b) { return new Date(a.t) - new Date(b.t); });
    if (pts.length < 4) return '';
    var ms = function (p) { return new Date(p.t).getTime(); };
    var watered = null;
    for (var i = pts.length - 1; i > 0; i--) {
      if (pts[i].v - pts[i - 1].v >= 8) { watered = pts[i]; break; }
    }
    var bits = [];
    if (watered) {
      var d0 = new Date(); d0.setHours(0, 0, 0, 0);
      var dw = new Date(ms(watered)); dw.setHours(0, 0, 0, 0);
      var days = Math.round((d0 - dw) / 86400000);
      bits.push(days <= 0 ? 'Watered today'
        : days === 1 ? 'Watered yesterday' : 'Watered ' + days + ' days ago');
    }
    // Drying rate from the tail since the last watering, in points per day.
    var tail = watered ? pts.filter(function (p) { return ms(p) >= ms(watered); }) : pts;
    if (tail.length >= 4) {
      var first = tail[0], last = tail[tail.length - 1];
      var spanD = (ms(last) - ms(first)) / 86400000;
      var drop = first.v - last.v;
      if (spanD >= 0.4 && drop > 0.5) {
        var perDay = drop / spanD;
        var floorPct = isFinite(dryPct) ? dryPct : 20;
        var left = (last.v - floorPct) / perDay;
        if (left >= 1 && left < 60) {
          bits.push('dry in about ' + Math.round(left)
            + (Math.round(left) === 1 ? ' day' : ' days'));
        }
      }
    }
    return bits.join(' · ');
  }

  window._hemmaUI = { hero: hero, headline: headline, group: group, legend: legend, note: note, shelf: shelf, mediaRow: mediaRow, segments: segments, slider: slider, icon: icon, esc: esc, prime: prime, plantWater: plantWater, tokens: T, v: 146 };
})();
(function () {
  if (window._hemmaNotify) return;

  var HOURS = 24;
  var MAX_ROWS = 40;
  var DEDUPE_MS = 5 * 60 * 1000;
  // One flapping device must not be able to fill the panel on its own.
  var PER_ENTITY_MAX = 3;
  var POLL_MS = 60000;
  // A battery has to read low for this long before it counts; devices glitch.
  var BATTERY_HOLD_MIN = 30;
  var KEY = 'hemma_notify_read_v1';
  var COUNT_IN_BADGE = true;

  function iconUrl(name) {
    return (typeof window.hemmaIconUrl === 'function')
      ? window.hemmaIconUrl(name) : '/local/hemma/icons/' + name + '.svg';
  }

  function ha() { return document.querySelector('home-assistant'); }
  function hassOf() { var h = ha(); return h && h.hass; }

  var READ_ENTITY = 'input_datetime.hemma_notifications_read';

  function readEntityId() {
    if (window.HEMMA_NOTIFY_READ_ENTITY) return window.HEMMA_NOTIFY_READ_ENTITY;
    var h = hassOf();
    if (h && h.states && h.states[READ_ENTITY]) return READ_ENTITY;
    return null;
  }

  function sharedRead() {
    var id = readEntityId();
    if (!id) return null;
    var h = hassOf();
    var st = h && h.states && h.states[id];
    if (!st) return null;
    var ms;
    if (id.indexOf('input_datetime.') === 0) {
      var ts = st.attributes && Number(st.attributes.timestamp);
      ms = isFinite(ts) ? ts * 1000 : NaN;
    } else {
      ms = parseFloat(st.state);
    }
    if (!isFinite(ms)) return null;
    if (ms < Date.now() - 90 * 864e5) return null;
    return ms;
  }

  function writeShared(ts) {
    var id = readEntityId();
    if (!id) return false;
    var h = hassOf();
    if (!h || !h.callService) return false;
    var dom = String(id).split('.')[0];
    try {
      if (dom === 'input_datetime') {
        h.callService('input_datetime', 'set_datetime',
          { entity_id: id, timestamp: Math.round(ts / 1000) });
      } else if (dom === 'input_text') {
        h.callService('input_text', 'set_value',
          { entity_id: id, value: String(ts) });
      } else if (dom === 'input_number') {
        h.callService('input_number', 'set_value', { entity_id: id, value: ts });
      } else {
        return false;
      }
    } catch (e) { return false; }
    return true;
  }

  var _sealedAt = 0;

  function watermark() {
    var shared = sharedRead();
    if (shared !== null) return Math.max(shared, _sealedAt);
    if (_sealedAt) return _sealedAt;
    try {
      var v = parseFloat(localStorage.getItem(KEY));
      if (isFinite(v)) return v;
    } catch (e) {}
    // A first run must not open on 24 hours of red.
    var now = Date.now();
    try { localStorage.setItem(KEY, String(now)); } catch (e) {}
    return now;
  }

  function setWatermark(ts) {
    _sealedAt = ts;
    if (writeShared(ts)) return;
    try { localStorage.setItem(KEY, String(ts)); } catch (e) {}
  }

  function nameOf(st) {
    return (st && st.attributes && st.attributes.friendly_name) || (st && st.entity_id) || '';
  }

  function tidyName(n) {
    var s = String(n || '').trim().replace(/\s+/g, ' ');
    var out = s.replace(/\s+(sensor|contact)$/i, '');
    var w = out.split(' ');
    while (w.length > 1
      && w[w.length - 1].toLowerCase() === w[w.length - 2].toLowerCase()) {
      w.pop();
    }
    out = w.join(' ');
    return out || s;
  }

  function dc(st) {
    return (st && st.attributes && st.attributes.device_class) || '';
  }

  function ago(ms) {
    var s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'Just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hr ago' : ' hrs ago');
    var d = Math.round(h / 24);
    return d === 1 ? 'Yesterday' : d + ' days ago';
  }


  var ALARM_WORD = {
    armed_home: 'Alarm armed (Home)',
    armed_away: 'Alarm armed (Away)',
    armed_night: 'Alarm armed (Night)',
    armed_vacation: 'Alarm armed (Vacation)',
    armed_custom_bypass: 'Alarm armed (Custom)',
    disarmed: 'Alarm disarmed',
    triggered: 'Alarm triggered',
  };

  var VACUUM_BUSY = { cleaning: 1, returning: 1 };
  var VACUUM_DONE = { docked: 1, idle: 1 };

  // Every category is on unless a dashboard turns it off.
  function on(type) {
    var t = window.HEMMA_NOTIFY_TYPES;
    return !t || t[type] !== false;
  }

  function appliances() {
    var list = window.HEMMA_NOTIFY_APPLIANCES;
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean).map(function (a) {
      return typeof a === 'string' ? { entity: a } : a;
    }).filter(function (a) { return a && a.entity; });
  }

  function applianceFor(id) {
    var all = appliances();
    for (var i = 0; i < all.length; i++) if (all[i].entity === id) return all[i];
    return null;
  }

  function minutesLeft(st) {
    if (!st) return null;
    var a = st.attributes || {};
    if (a.device_class === 'timestamp') {
      var t = Date.parse(st.state);
      if (!isFinite(t)) return null;
      return Math.max(0, Math.round((t - Date.now()) / 60000));
    }
    var n = parseFloat(st.state);
    if (!isFinite(n)) return null;
    var u = String(a.unit_of_measurement || '').toLowerCase();
    if (u === 's' || u === 'sec' || u === 'seconds') return Math.round(n / 60);
    if (u === 'h' || u === 'hr' || u === 'hours') return Math.round(n * 60);
    return Math.round(n);
  }

  var PLANT_WORD = {
    'moisture:Low': 'needs water',
    'moisture:High': 'has been overwatered',
    'conductivity:Low': 'needs feeding',
    'conductivity:High': 'has too much fertilizer',
    'illuminance:Low': 'needs more light',
    'illuminance:High': 'is getting too much light',
    'dli:Low': 'needs more light',
    'dli:High': 'is getting too much light',
    'temperature:Low': 'is too cold',
    'temperature:High': 'is too warm',
    'humidity:Low': 'is in air that is too dry',
    'humidity:High': 'is in air that is too humid',
  };

  var APPLIANCE_DONE = /^(off|idle|finished|complete|completed|standby|end|ready)$/i;
  var APPLIANCE_BUSY = /^(on|run|running|active|washing|rinsing|spinning|drying|printing|busy)$/i;

  function isDoorbell(id, st) {
    if (id.indexOf('event.') === 0) return dc(st) === 'doorbell';
    if (id.indexOf('binary_sensor.') === 0) {
      return dc(st) === 'occupancy' && /doorbell|ding|chime/i.test(id);
    }
    return false;
  }

  // Entities whose past matters. Everything else is read from current state.
  // Custom notification sources, so a letterbox or a bin collection does not
  // mean patching this file and merging it again on every update. See #71.
  function exts() {
    var x = window.HEMMA_NOTIFY_EXTENSIONS;
    return Array.isArray(x) ? x : [];
  }

  function extApi() {
    return { on: on, nameOf: nameOf, tidyName: tidyName, dc: dc };
  }

  function eachExt(name, fn) {
    exts().forEach(function (e) {
      if (!e || typeof e[name] !== 'function') return;
      try { fn(e); } catch (err) {
        console.warn('Hemma notify extension (' + name + '):', err);
      }
    });
  }

  function watched(hass) {
    var out = [];
    var appl = appliances().map(function (a) { return a.entity; });
    Object.keys(hass.states).forEach(function (id) {
      var st = hass.states[id];
      if (on('locks') && id.indexOf('lock.') === 0) return void out.push(id);
      if (on('alarm') && id.indexOf('alarm_control_panel.') === 0) return void out.push(id);
      if (on('vacuum') && id.indexOf('vacuum.') === 0) return void out.push(id);
      if (on('doorbell') && isDoorbell(id, st)) return void out.push(id);
      if (on('people') && id.indexOf('person.') === 0) return void out.push(id);
      if (on('appliances') && appl.indexOf(id) !== -1) return void out.push(id);
    });
    eachExt('watch', function (e) {
      (e.watch(hass, extApi()) || []).forEach(function (id) {
        if (out.indexOf(id) === -1) out.push(id);
      });
    });
    return out;
  }

  // entry: a logbook row. prev: that entity's previous state in the window.
  function describe(entry, st, prev) {
    // undefined means "not mine", so the built-in rules still run. null means
    // "mine, and deliberately not a row".
    var ex = exts();
    for (var xi = 0; xi < ex.length; xi++) {
      if (!ex[xi] || typeof ex[xi].describe !== 'function') continue;
      try {
        var xr = ex[xi].describe(entry, st, prev, extApi());
        if (xr !== undefined) return xr;
      } catch (err) { console.warn('Hemma notify extension (describe):', err); }
    }
    var id = entry.entity_id || '';
    var s = String(entry.state == null ? '' : entry.state);
    var name = entry.name || nameOf(st);

    if (id.indexOf('lock.') === 0) {
      var lk = { opens: ['hemma_badge_lock_group', 'hemma_popup_lock'] };
      if (s === 'locked') return { label: name + ' locked', icon: 'lock-fill', tone: 'good', opens: lk.opens };
      if (s === 'unlocked') return { label: name + ' unlocked', icon: 'lock-open-fill', tone: 'warn', opens: lk.opens };
      if (s === 'jammed') return { label: name + ' jammed', icon: 'exclamation', tone: 'bad', opens: lk.opens };
      return null;
    }

    if (id.indexOf('person.') === 0) {
      var AWAY = 'var(--hemma-color-blue, #0A84FF)';
      var pic = st && st.attributes && st.attributes.entity_picture;
      var who = {
        once: 'person:' + name, icon: 'person',
        image: pic || undefined, imageFit: 'cover',
      };
      if (s === 'home') {
        return { label: name + ' arrived', tone: 'good', icon: who.icon,
          image: who.image, imageFit: who.imageFit, once: who.once };
      }
      if (s === 'not_home') {
        return { label: name + ' left', tone: AWAY, icon: who.icon,
          image: who.image, imageFit: who.imageFit, once: who.once };
      }
      if (s && s !== 'unknown' && s !== 'unavailable') {
        return { label: name + ' is at ' + s, tone: AWAY, icon: who.icon,
          image: who.image, imageFit: who.imageFit, once: who.once };
      }
      return null;
    }

    if (id.indexOf('alarm_control_panel.') === 0) {
      var word = ALARM_WORD[s];
      if (!word) return null;
      return {
        label: word,
        icon: s === 'disarmed' ? 'lock-open-fill' : 'lock-fill',
        tone: s === 'triggered' ? 'bad' : s === 'disarmed' ? 'warn' : 'good',
      };
    }

    if (id.indexOf('vacuum.') === 0) {
      if (VACUUM_DONE[s] && VACUUM_BUSY[prev]) {
        return { label: name + ' finished cleaning', icon: 'vacuum-charge', tone: 'good' };
      }
      if (s === 'error') return { label: name + ' needs attention', icon: 'vacuum', tone: 'bad' };
      return null;
    }

    if (isDoorbell(id, st)) {
      // "Front Door Ding" is the entity, "Front Door" is the thing that rang.
      var who = name.replace(/\s+(ding|doorbell|chime|button)$/i, '');
      return { label: (who || name) + ' rang', icon: 'doorbell', tone: 'accent' };
    }

    var appl = applianceFor(id);
    if (appl) {
      var done = appl.done ? new RegExp('^' + appl.done + '$', 'i') : APPLIANCE_DONE;
      if (done.test(s) && APPLIANCE_BUSY.test(prev || '')) {
        return { label: (appl.name || name) + ' finished', icon: 'default', tone: 'good' };
      }
      return null;
    }

    return null;
  }


  var _lowSince = {};

  function standing(hass) {
    var rows = [];
    var S = hass.states;
    var ids = Object.keys(S);

    var updates = [];
    var restarts = [];
    ids.forEach(function (id) {
      if (id.indexOf('update.') !== 0) return;
      var st = S[id];
      var a = st.attributes || {};
      if (st.state === 'on' && !a.in_progress) { updates.push(st); return; }
      var rs = String(a.release_summary || '').toLowerCase();
      if (rs.indexOf('restart') !== -1 && st.state === 'off'
        && a.installed_version && a.installed_version === a.latest_version) {
        restarts.push(st);
      }
    });

    var newest = function (list) {
      return list.reduce(function (t, st) {
        var v = Date.parse(st.last_changed || '') || 0;
        return v > t ? v : t;
      }, 0);
    };

    if (updates.length && on('updates')) {
      rows.push({
        id: 'hemma:updates',
        when: newest(updates) || Date.now(),
        label: updates.length === 1
          ? nameOf(updates[0]).replace(/\s+Update$/i, '') + ' update available'
          : updates.length + ' updates available',
        icon: 'updates',
        tone: 'accent',
        entity: updates[0].entity_id,
        opens: ['hemma_updates', 'hemma_popup_updates'],
      });
    }

    if (restarts.length && on('restart')) {
      rows.push({
        id: 'hemma:restart',
        when: newest(restarts) || Date.now(),
        label: 'Restart pending',
        sub: restarts.length === 1
          ? 'Finishes the ' + nameOf(restarts[0]).replace(/\s+Update$/i, '') + ' update'
          : 'Finishes ' + restarts.length + ' updates',
        icon: 'exclamation',
        tone: 'warn',
        entity: restarts[0].entity_id,
        opens: ['hemma_updates', 'hemma_popup_updates'],
      });
    }

    var lowPct = Number(window.HEMMA_NOTIFY_BATTERY);
    if (!isFinite(lowPct)) lowPct = 20;
    var holdMin = Number(window.HEMMA_NOTIFY_BATTERY_HOLD);
    if (!isFinite(holdMin) || holdMin < 0) holdMin = BATTERY_HOLD_MIN;
    var nowMs = Date.now();
    var low = [];
    ids.forEach(function (id) {
      var st = S[id];
      if (dc(st) !== 'battery') return;
      var pct = null;
      var isLow;
      if (id.indexOf('sensor.') === 0) {
        pct = parseFloat(st.state);
        // Unavailable is no news: hold the clock rather than start it over.
        if (!isFinite(pct)) return;
        isLow = pct <= lowPct;
      } else if (id.indexOf('binary_sensor.') === 0) {
        if (st.state !== 'on' && st.state !== 'off') return;
        isLow = st.state === 'on';
      } else {
        return;
      }
      if (!isLow) { delete _lowSince[id]; return; }
      // 19 -> 18 moves last_changed, so only the first sighting starts the clock.
      if (!_lowSince[id]) {
        _lowSince[id] = Math.min(Date.parse(st.last_changed || '') || nowMs, nowMs);
      }
      if (nowMs - _lowSince[id] >= holdMin * 60000) low.push({ st: st, pct: pct });
    });
    if (low.length && on('battery')) {
      low.sort(function (a, b) { return (a.pct == null ? -1 : a.pct) - (b.pct == null ? -1 : b.pct); });
      rows.push({
        id: 'hemma:battery',
        when: newest(low.map(function (x) { return x.st; })) || Date.now(),
        label: low.length === 1
          ? nameOf(low[0].st).replace(/\s+Battery$/i, '') + ' battery low'
          : low.length + ' devices low on battery',
        value: low.length === 1 && low[0].pct != null ? low[0].pct + '%' : null,
        icon: 'battery',
        tone: 'bad',
        entity: low.length === 1 ? low[0].st.entity_id : null,
        opens: ['hemma_battery', 'hemma_popup_battery'],
      });
    }

    var SAFETY = {
      moisture: { word: 'Water detected', icon: 'exclamation' },
      smoke: { word: 'Smoke detected', icon: 'exclamation' },
      gas: { word: 'Gas detected', icon: 'gas' },
      carbon_monoxide: { word: 'Carbon monoxide detected', icon: 'exclamation' },
      safety: { word: 'Safety alert', icon: 'exclamation' },
    };
    if (on('safety')) {
      ids.forEach(function (id) {
        if (id.indexOf('binary_sensor.') !== 0) return;
        var st = S[id];
        if (st.state !== 'on') return;
        var kind = SAFETY[dc(st)];
        if (!kind) return;
        rows.push({
          id: 'hemma:safety:' + id,
          when: Date.parse(st.last_changed || '') || Date.now(),
          label: kind.word,
          sub: nameOf(st),
          icon: kind.icon,
          tone: 'bad',
          entity: id,
          rank: 1,
        });
      });
    }

    var openMins = Number(window.HEMMA_NOTIFY_OPEN_MINUTES);
    if (!isFinite(openMins)) openMins = 10;
    if (on('doors') && openMins > 0) {
      ids.forEach(function (id) {
        if (id.indexOf('binary_sensor.') !== 0) return;
        var st = S[id];
        if (st.state !== 'on') return;
        var kind = dc(st);
        if (kind !== 'door' && kind !== 'window' && kind !== 'garage_door'
          && kind !== 'opening') return;
        var since = Date.parse(st.last_changed || '');
        if (!isFinite(since)) return;
        var mins = Math.round((Date.now() - since) / 60000);
        if (mins < openMins) return;
        rows.push({
          id: 'hemma:open:' + id,
          when: since,
          label: tidyName(nameOf(st)) + ' is open',
          sub: 'For ' + (mins < 60 ? mins + ' min'
            : Math.round(mins / 60) + (mins < 120 ? ' hr' : ' hrs')),
          ongoing: true,
          icon: kind === 'window' ? 'window-shade-open' : 'door-open',
          tone: 'warn',
          entity: id,
          // Door and window sensors sit beside their lock in that popup.
          opens: ['hemma_badge_lock_group', 'hemma_popup_lock'],
        });
      });
    }

    var co2Limit = Number(window.HEMMA_NOTIFY_CO2);
    if (!isFinite(co2Limit)) co2Limit = 1800;
    if (on('air') && co2Limit > 0) {
      var CO2_KEY = 'hemma_co2_since';
      var co2Since = {};
      try { co2Since = JSON.parse(localStorage.getItem(CO2_KEY) || '{}') || {}; }
      catch (e) { co2Since = {}; }
      var co2Now = {};
      var plants = ids.filter(function (id) { return id.indexOf('plant.') === 0; })
        .map(function (id) { return id.slice(6); });
      ids.forEach(function (id) {
        if (id.indexOf('sensor.') !== 0) return;
        var st = S[id];
        if (dc(st) !== 'carbon_dioxide') return;
        var bare = id.slice(7);
        if (plants.some(function (n) { return bare.indexOf(n) === 0; })) return;
        var ppm = parseFloat(st.state);
        if (!isFinite(ppm) || ppm < co2Limit) return;
        var bad = ppm >= 2000;
        var crossed = Number(co2Since[id]);
        if (!isFinite(crossed)) crossed = Date.now();
        co2Now[id] = crossed;
        rows.push({
          id: 'hemma:co2:' + id,
          when: crossed,
          label: 'Carbon dioxide is high',
          sub: (function () {
            var where = nameOf(st)
              .replace(/\s*(carbon dioxide|co2)\s*/gi, ' ')
              .replace(/\s+/g, ' ').trim();
            return Math.round(ppm) + ' ppm' + (where ? ' in ' + where : '');
          })(),
          icon: 'co2-fill',
          tone: bad ? 'bad' : 'warn',
          entity: id,
          opens: ['hemma_badge_air_quality'],
          rank: bad ? 1 : 0,
        });
      });
      try {
        if (JSON.stringify(co2Now) !== JSON.stringify(co2Since)) {
          localStorage.setItem(CO2_KEY, JSON.stringify(co2Now));
        }
      } catch (e) {}
    }

    if (on('plants')) {
      var midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      ids.forEach(function (id) {
        if (id.indexOf('plant.') !== 0) return;
        var st = S[id];
        if (st.state !== 'problem') return;
        var probs = (st.attributes || {}).problems;
        if (!Array.isArray(probs) || !probs.length) return;
        // Watering is the one you can act on standing there, so it leads.
        var first = probs.filter(function (x) { return x.sensor_type === 'moisture'; })[0]
          || probs[0];
        var word = PLANT_WORD[first.sensor_type + ':' + first.status];
        if (!word) return;
        var soil = parseFloat(first.current);
        rows.push({
          id: 'hemma:plant:' + id,
          when: Math.max(Date.parse(st.last_changed || '') || 0, midnight.getTime()),
          label: nameOf(st) + ' ' + word,
          sub: (first.sensor_type === 'moisture' && isFinite(soil))
            ? 'Soil at ' + Math.round(soil) + '%' : null,
          icon: 'plant',
          tone: 'warn',
          entity: id,
          opens: ['hemma_plant', 'hemma_popup_plant'],
        });
      });
    }

    if (on('appliances')) {
      appliances().forEach(function (a) {
        var st = S[a.entity];
        if (!st) return;
        var done = a.done ? new RegExp('^' + a.done + '$', 'i') : APPLIANCE_DONE;
        if (done.test(st.state)) return;
        var left = a.remaining ? minutesLeft(S[a.remaining]) : null;
        if (left == null) return;
        rows.push({
          id: 'hemma:appliance:' + a.entity,
          when: Date.now(),
          label: (a.name || nameOf(st)) + (left > 0 ? ' is running' : ' is finishing up'),
          sub: left > 0
            ? (left < 60 ? left + ' min left'
               : Math.floor(left / 60) + ' hr ' + (left % 60) + ' min left')
            : 'Almost done',
          icon: 'default',
          tone: 'accent',
          entity: a.entity,
        });
      });
    }

    eachExt('standing', function (e) {
      var next = e.standing(hass, rows, extApi());
      if (Array.isArray(next)) rows = next;
    });

    return rows;
  }

  // ── Collection ─────────────────────────────────────────────────────────────

  var _rows = [];
  var _busy = null;

  function collect() {
    var hass = hassOf();
    if (!hass) return Promise.resolve(_rows);
    if (_busy) return _busy;

    var live = standing(hass);
    var ids = watched(hass);
    var since = new Date(Date.now() - HOURS * 3600 * 1000).toISOString();

    var fetch = (ids.length && hass.callWS)
      ? hass.callWS({ type: 'logbook/get_events', start_time: since, entity_ids: ids })
      : Promise.resolve([]);

    _busy = fetch.catch(function () { return []; }).then(function (entries) {
      var prev = {};
      var events = [];
      var asked = {};
      ids.forEach(function (id) { asked[id] = 1; });
      (entries || []).forEach(function (e) {
        var id = e.entity_id;
        if (!id || !asked[id]) return;
        var st = hass.states[id];
        var was = prev[id];
        prev[id] = String(e.state == null ? '' : e.state);
        var d = describe(e, st, was);
        if (!d) return;
        // `when` is epoch seconds, and float on some HA versions.
        var when = Math.round(Number(e.when) * 1000);
        if (!isFinite(when)) return;
        events.push({
          id: id + '@' + when,
          when: when,
          label: d.label,
          sub: d.sub || null,
          icon: d.icon,
          tone: d.tone,
          image: d.image,
          imageFit: d.imageFit,
          entity: id,
          opens: d.opens || null,
          once: d.once || null,
        });
      });

      events.sort(function (a, b) { return b.when - a.when; });

      var kept = [];
      var perEntity = {};
      var onlyOnce = {};
      events.forEach(function (e) {
        if (e.once) {
          if (onlyOnce[e.once]) return;
          onlyOnce[e.once] = 1;
          kept.push(e);
          return;
        }
        var n = (perEntity[e.entity] || 0);
        if (n >= PER_ENTITY_MAX) return;
        var dupe = kept.some(function (k) {
          return k.label === e.label && Math.abs(k.when - e.when) < DEDUPE_MS;
        });
        if (dupe) return;
        perEntity[e.entity] = n + 1;
        kept.push(e);
      });

      var room = Math.max(0, MAX_ROWS - live.length);
      _rows = live.concat(kept.slice(0, room))
        .sort(function (a, b) {
          return ((b.rank || 0) - (a.rank || 0)) || (b.when - a.when);
        });
      _busy = null;
      announce();
      return _rows;
    });

    return _busy;
  }

  function unread() {
    var w = watermark();
    return _rows.filter(function (r) { return r.when > w; }).length;
  }


  var _bells = [];
  var _lastCount = -1;

  function mountCount(glyph) {
    var root = glyph.getRootNode();
    if (!root || !root.querySelector || !root.appendChild) return null;
    var have = root.querySelector('.hemma-bell-count');
    if (have) return have;
    var span = document.createElement('span');
    span.className = 'hemma-bell-count';
    span.style.display = 'none';
    root.appendChild(span);
    return span;
  }

  function findBells() {
    var out = [];
    (function walk(root, depth) {
      if (!root || depth > 14 || !root.querySelectorAll) return;
      root.querySelectorAll('.hemma-bell').forEach(function (glyph) {
        var el = mountCount(glyph);
        if (el && out.indexOf(el) === -1) out.push(el);
      });
      root.querySelectorAll('*').forEach(function (el) {
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      });
    })(document, 0);
    return out;
  }

  function bells() {
    _bells = _bells.filter(function (el) { return el.isConnected; });
    if (!_bells.length) _bells = findBells();
    return _bells;
  }

  function announce() {
    var n = unread();
    var text = n > 99 ? '99+' : String(n);
    var inBadge = COUNT_IN_BADGE && !isPhone();
    var show = (n > 0 && inBadge) ? 'grid' : 'none';
    var src = iconUrl(!inBadge && n > 0 ? 'bell-badge' : 'bell');
    bells().forEach(function (el) {
      if (el.textContent !== text) el.textContent = text;
      if (el.style.display !== show) el.style.display = show;
      var glyph = el.parentNode && el.parentNode.querySelector('.hemma-bell');
      if (glyph && glyph.getAttribute('src') !== src) glyph.setAttribute('src', src);
      if (glyph) glyph.classList.toggle('badged', !inBadge && n > 0);
    });
    if (n !== _lastCount) {
      _lastCount = n;
      window.dispatchEvent(new CustomEvent('hemma-notify-count', { detail: { count: n } }));
    }
  }

  // ── Panel body ─────────────────────────────────────────────────────────────

  function ordered() {
    var w = watermark();
    return {
      fresh: _rows.filter(function (r) { return r.when > w; }),
      old: _rows.filter(function (r) { return r.when <= w; }),
    };
  }

  function configure(cfg) {
    cfg = cfg || {};
    if (cfg.types !== undefined) window.HEMMA_NOTIFY_TYPES = cfg.types;
    if (cfg.appliances !== undefined) window.HEMMA_NOTIFY_APPLIANCES = cfg.appliances;
    if (cfg.battery !== undefined) window.HEMMA_NOTIFY_BATTERY = cfg.battery;
    if (cfg.battery_hold !== undefined) window.HEMMA_NOTIFY_BATTERY_HOLD = cfg.battery_hold;
    if (cfg.open_minutes !== undefined) window.HEMMA_NOTIFY_OPEN_MINUTES = cfg.open_minutes;
    if (cfg.co2 !== undefined) window.HEMMA_NOTIFY_CO2 = cfg.co2;
    if (cfg.read_entity !== undefined) {
      window.HEMMA_NOTIFY_READ_ENTITY = cfg.read_entity || null;
    }
    return true;
  }

  function sections() {
    var UI = window._hemmaUI;
    if (!UI) return '';
    var g = ordered();

    if (!_rows.length) {
      return '<div style="font-family:' + UI.tokens.font + ';text-align:center;'
        + 'padding:34px 16px 38px;color:' + UI.tokens.ink3 + ';font-size:15px;">'
        + 'Nothing new</div>';
    }

    var toRow = function (r) {
      return {
        icon: r.icon,
        iconTone: r.tone,
        label: r.label,
        // Something still happening says how long, not when it started as well.
        sub: r.ongoing ? r.sub : (r.sub ? [r.sub, ago(r.when)] : ago(r.when)),
        value: r.value || null,
        entity: r.entity || null,
        image: r.image,
        imageFit: r.imageFit,
        tappable: !!(r.entity || r.opens),
      };
    };

    var opts = { labelInside: true };
    var out = '';
    if (g.fresh.length) out += UI.group(g.fresh.map(toRow), g.old.length ? 'New' : null, null, opts);
    if (g.old.length) out += UI.group(g.old.map(toRow), g.fresh.length ? 'Earlier' : null, null, opts);
    return out;
  }

  function paint(root) {
    if (!root) return;
    var g = ordered();
    var list = g.fresh.concat(g.old);
    var els = root.querySelectorAll('.hui-row');
    for (var i = 0; i < els.length && i < list.length; i++) {
      els[i]._hemmaRow = list[i];
      if (!list[i].opens) continue;
      els[i].removeAttribute('data-hemma-mi');
      els[i].dataset.hemmaOpen = list[i].opens;
    }
  }

  function templatesOf(cfg) {
    var t = cfg && cfg.template;
    return Array.isArray(t) ? t : (t ? [t] : []);
  }

  function wants(cfg, names, entityId) {
    var list = templatesOf(cfg);
    var hit = names.some(function (n) { return list.indexOf(n) !== -1; });
    if (!hit) return false;
    if (!entityId) return true;
    var v = cfg.variables || {};
    return cfg.entity === entityId
      || Object.keys(v).some(function (k) { return v[k] === entityId; });
  }

  function cardWithTemplate(names, entityId) {
    var out = null;
    var scan = function (id) {
      (function walk(root, depth) {
        if (!root || out || depth > 14 || !root.querySelectorAll) return;
        root.querySelectorAll('button-card').forEach(function (el) {
          if (!out && wants(el._config, names, id)) out = el;
        });
        root.querySelectorAll('*').forEach(function (el) {
          if (!out && el.shadowRoot) walk(el.shadowRoot, depth + 1);
        });
      })(document, 0);
    };
    if (entityId) scan(entityId);
    if (!out) scan(null);
    return out;
  }

  function cardFromConfig(names, entityId) {
    var h = hassOf();
    if (!h || !h.callWS) return Promise.resolve(null);
    var seg = (location.pathname || '').split('/').filter(Boolean);
    var url = seg[0] || 'lovelace';
    return h.callWS({ type: 'lovelace/config', url_path: url }).then(function (cfg) {
      var found = null;
      (function walk(cards) {
        (cards || []).forEach(function (c) {
          if (found || !c || typeof c !== 'object') return;
          if (wants(c, names, entityId)) { found = c; return; }
          walk(c.cards);
        });
      })((cfg.views || []).reduce(function (a, v) {
        return a.concat(v.cards || []);
      }, []));
      if (!found && entityId) {
        (function walk(cards) {
          (cards || []).forEach(function (c) {
            if (found || !c || typeof c !== 'object') return;
            if (wants(c, names, null)) { found = c; return; }
            walk(c.cards);
          });
        })((cfg.views || []).reduce(function (a, v) {
          return a.concat(v.cards || []);
        }, []));
      }
      if (!found) return null;
      var el = document.createElement('button-card');
      try { el.setConfig(JSON.parse(JSON.stringify(found))); } catch (e) { return null; }
      el.hass = h;
      el.style.cssText = 'position:fixed;left:-9999px;top:0;'
        + 'width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(el);
      return el;
    }).catch(function () { return null; });
  }

  function tapCard(card, done) {
    if (!card || typeof card._handleAction !== 'function' || !card._config) {
      return done(false);
    }
    if (typeof card._isActionDoingSomething === 'function') {
      try {
        if (!card._isActionDoingSomething(card._stateObj, card._config.tap_action)) {
          return done(false);
        }
      } catch (e) {}
    }
    var settled = false;
    var take = function (ev) {
      var cfg = ev.detail && ev.detail.config;
      var act = cfg && cfg[((ev.detail && ev.detail.action) || 'tap') + '_action'];
      if (act && act.hemma_popup && window.hemmaPopup) {
        // Only ours gets intercepted; anything else stays HA's to handle.
        ev.stopPropagation();
        window.hemmaPopup.open(act.hemma_popup);
        return finish(true);
      }
      finish(false);
    };
    var finish = function (ok) {
      if (settled) return;
      settled = true;
      card.removeEventListener('hass-action', take, true);
      done(ok);
    };
    card.addEventListener('hass-action', take, true);
    try {
      card._handleAction({ detail: { action: 'tap' } }, { isIcon: false });
    } catch (e) { return finish(false); }
    // hass-action arrives a microtask later, so the miss cannot be decided yet.
    setTimeout(function () { finish(false); }, 400);
  }

  function openTarget(what, fallbackEntity) {
    // dataset stringifies an array, so a retagged row arrives comma-joined.
    var names = Array.isArray(what) ? what
      : (what ? String(what).split(',').map(function (n) { return n.trim(); })
                .filter(Boolean)
              : []);
    var fall = function () {
      if (fallbackEntity && window.hemmaPopup) window.hemmaPopup.moreInfo(fallbackEntity);
    };
    if (!names.length) return fall();
    tapCard(cardWithTemplate(names, fallbackEntity), function (hit) {
      if (hit) return;
      cardFromConfig(names, fallbackEntity).then(function (el) {
        if (!el) return fall();
        // One frame for button-card to evaluate its config before the tap.
        setTimeout(function () {
          tapCard(el, function (ok) {
            if (!ok) fall();
            setTimeout(function () { if (el.parentNode) el.remove(); }, 1500);
          });
        }, 80);
      });
    });
  }

  function bindOpens(root, close) {
    if (!root) return;
    root.addEventListener('click', function (e) {
      var path = (e.composedPath && e.composedPath()) || [e.target];
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        if (n && n.dataset && n.dataset.hemmaOpen) {
          e.preventDefault();
          e.stopPropagation();
          var row = n._hemmaRow;
          if (close) close();
          openTarget(n.dataset.hemmaOpen, row && row.entity);
          return;
        }
      }
    }, true);
  }

  // ── Presentation ───────────────────────────────────────────────────────────

  function isPhone() {
    try {
      return window.matchMedia('(max-width: 767px), (max-height: 500px)').matches;
    } catch (e) { return false; }
  }

  function seal() {
    setWatermark(Date.now());
    announce();
  }

  function lift(anchor, on) {
    if (!anchor || !anchor.style) return;
    if (isPhone()) return;
    if (on) {
      anchor.style.setProperty('--hemma-bell-fill', '#fff');
      anchor.style.setProperty('--hemma-bell-filter', 'brightness(0)');
    } else {
      anchor.style.removeProperty('--hemma-bell-fill');
      anchor.style.removeProperty('--hemma-bell-filter');
    }
  }

  function openSheet(anchor) {
    if (!window.hemmaPopup) return;
    lift(anchor, true);
    window.hemmaPopup.open({
      title: 'Notifications',
      dismissable: true,
      popup_styles: [{
        style: 'all',
        styles: '--hemma-popup-gutter-wide: 40px;'
          + '--hemma-popup-row-fill: transparent;'
          + '--hemma-popup-row-radius: 0px;'
          + '.header { padding-top: var(--hemma-popup-header-gap, 10px);'
          + ' padding-bottom: var(--hemma-popup-header-gap, 10px); }'
          + '.header-title { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }'
          + '.content .container { padding-top: 6px !important; }',
      }],
      content: {
        type: 'custom:button-card',
        tap_action: { action: 'none' },
        show_icon: false, show_name: false, show_label: false, show_state: false,
        card_mod: {
          style: ':host { --ha-card-box-shadow: none !important;'
            + ' --button-card-box-shadow: none !important; }\n'
            + 'ha-card { background: transparent !important; border: none !important;'
            + ' box-shadow: none !important; backdrop-filter: none !important;'
            + ' -webkit-backdrop-filter: none !important; cursor: default !important; }\n'
            + 'ha-ripple { display: none !important; }',
        },
        styles: {
          card: [{ background: 'transparent' }, { border: 'none' }, { 'box-shadow': 'none' },
                 { padding: '0 10px 22px 10px' }],
          grid: [{ 'grid-template-areas': '"list"' }, { 'grid-template-columns': '1fr' }],
          custom_fields: { list: [{ 'justify-self': 'stretch' }] },
        },
        custom_fields: { list: sections() },
      },
    });

    var el = window.hemmaPopup.element;
    // The sheet builds its card asynchronously, so the retag waits for it.
    setTimeout(function () {
      var surface = window.hemmaPopup.surface;
      paint(surface);
      if (surface && !surface._hemmaNotifyBound) {
        surface._hemmaNotifyBound = true;
        bindOpens(surface, function () { window.hemmaPopup.close(); });
      }
    }, 260);

    var watch = setInterval(function () {
      if (el && el.hasAttribute('open')) return;
      clearInterval(watch);
      lift(anchor, false);
      seal();
    }, 300);
  }

  var _menu = null;


  function openMenu(anchor) {
    var GLASS = window.hemmaMenuGlass;
    var card = anchor && anchor.shadowRoot && anchor.shadowRoot.querySelector('ha-card');
    var r = (card || anchor).getBoundingClientRect();
    for (var up = anchor, i = 0; up && i < 6; i++) {
      var rootNode = up.getRootNode && up.getRootNode();
      up = rootNode && rootNode.host;
      var tpl = up && up._config && up._config.template;
      if (tpl && [].concat(tpl).indexOf('hemma_mobile_chrome') >= 0) {
        var cap = up.shadowRoot && up.shadowRoot.querySelector('ha-card');
        if (cap) r = cap.getBoundingClientRect();
        break;
      }
    }

    var menu = document.createElement('div');
    _menu = menu;
    lift(anchor, true);
    menu.className = 'hemma-notify-menu';
    menu.setAttribute('role', 'dialog');
    Object.assign(menu.style, {
      position: 'fixed', zIndex: '99999', boxSizing: 'border-box',
      width: 'max-content',
      minWidth: '256px',
      maxWidth: 'min(392px, calc(100vw - 24px))',
      padding: '0',
      overflow: 'hidden',
    });
    GLASS.apply(menu);

    var inner = document.createElement('div');
    // Safari lets a descendant's background paint past a rounded parent's radius.
    Object.assign(inner.style, {
      opacity: '0', willChange: 'opacity',
      borderRadius: 'inherit', overflow: 'hidden',
      clipPath: 'inset(0 round ' + GLASS.radius + ')',
    });

    var head = document.createElement('div');
    Object.assign(head.style, {
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: '12px', padding: '15px 16px 9px',
      fontFamily: 'var(--primary-font-family, system-ui)',
    });
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Mark all read';
    Object.assign(clear.style, {
      border: '0', background: 'transparent', font: 'inherit', fontSize: '14px',
      fontWeight: '500', letterSpacing: '-0.01em', cursor: 'pointer', padding: '0',
      color: 'var(--hemma-popup-ui-action, var(--hemma-color-teal, #00C3D0))',
    });
    clear.onclick = function (e) { e.stopPropagation(); seal(); menu._close(); };
    clear.style.display = unread() ? 'block' : 'none';
    head.appendChild(clear);
    head.style.justifyContent = 'flex-end';
    head.style.padding = '11px calc(var(--hemma-popup-row-pad-x, 16px) + 8px) 5px';
    if (unread()) inner.appendChild(head);

    var body = document.createElement('div');
    Object.assign(body.style, {
      maxHeight: 'min(62vh, 560px)', overflowY: 'auto', overscrollBehavior: 'contain',
    });
    var fade = function () {
      var over = body.scrollHeight - body.clientHeight;
      var top = over > 4 && body.scrollTop > 1;
      var bot = over > 4 && body.scrollTop < over - 1;
      var v = (top || bot)
        ? 'linear-gradient(to bottom, '
          + (top ? 'transparent 0, #000 26px' : '#000 0')
          + ', '
          + (bot ? '#000 calc(100% - 26px), transparent 100%' : '#000 100%')
          + ')'
        : '';
      if (body.style.webkitMaskImage !== v) {
        body.style.webkitMaskImage = v;
        body.style.maskImage = v;
      }
    };
    body.addEventListener('scroll', fade, { passive: true });
    GLASS.lockScroll(menu, body);
    // Custom properties never land through Object.assign.
    body.style.setProperty('--hemma-popup-row-fill', 'transparent');
    body.style.setProperty('--hemma-popup-row-hover', 'rgba(255,255,255,0.10)');
    body.style.setProperty('--hemma-popup-chev-gap', '16px');
    body.style.setProperty('--hemma-popup-group-label-gap', '4px');
    var U_MIN = 10, U_VW = 0.575, U_MAX = 11.5;
    body.style.setProperty('--hemma-popup-row-label-weight', '600');
    body.style.setProperty('--hemma-popup-sub-color', 'rgba(255,255,255,0.62)');
    [['--hemma-popup-row-label-size', 1.53],
     ['--hemma-popup-sub-size', 1.25],
     ['--hemma-popup-row-min', 4.68],
     ['--hemma-popup-icon-tile', 2.61],
     ['--hemma-popup-lead-plate', 2.88],
     ['--hemma-popup-group-label-size', 1.35]].forEach(function (p) {
      var k = p[1];
      body.style.setProperty(p[0], 'clamp(' + (U_MIN * k).toFixed(2) + 'px, '
        + (U_VW * k).toFixed(4) + 'vw, ' + (U_MAX * k).toFixed(2) + 'px)');
    });
    body.style.setProperty('--hemma-popup-row-radius', '0px');
    body.innerHTML = sections();
    inner.appendChild(body);
    menu.appendChild(inner);
    document.body.appendChild(menu);
    fade();
    paint(body);
    bindOpens(body, null);

    var w = menu.offsetWidth;
    menu.style.top = GLASS.dropTop(r, 10) + 'px';
    menu.style.left = Math.round(
      Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12))
    ) + 'px';

    inner.style.opacity = '1';
    inner.style.willChange = 'auto';
    GLASS.enter(menu);

    var onKey = function (e) { if (e.key === 'Escape') menu._close(); };
    var onAway = function (e) {
      var path = (e.composedPath && e.composedPath()) || [e.target];
      if (path.indexOf(menu) !== -1) return;
      // contains() cannot cross a shadow boundary.
      if (anchor && path.indexOf(anchor) !== -1) return;
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        var tag = (n && n.tagName) ? String(n.tagName).toLowerCase() : '';
        // A more-info opened FROM a row is not somewhere else.
        if (tag === 'dialog' || /-dialog$/.test(tag) || tag === 'hemma-popup') return;
      }
      menu._close();
    };
    var idle = setTimeout(function () { menu._idle = true; menu._close(); }, 20000);

    menu._close = function () {
      if (_menu !== menu) return;
      _menu = null;
      clearTimeout(idle);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onAway, true);
      window.removeEventListener('resize', menu._close);
      lift(anchor, false);
      if (!menu._idle) seal();
      GLASS.exit(menu, function () { if (menu.parentNode) menu.remove(); });
    };

    setTimeout(function () {
      window.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onAway, true);
      window.addEventListener('resize', menu._close);
    }, 0);
  }

  function open(anchor) {
    if (_menu) { _menu._close(); return; }
    var pop = window.hemmaPopup && window.hemmaPopup.element;
    if (pop && pop.hasAttribute('open')) { window.hemmaPopup.close(); return; }

    var show = function () { openMenu(anchor); };
    // Opening waits on the network only the very first time.
    if (_rows.length) { show(); collect(); } else { collect().then(show); }
  }

  // The categories a dashboard can switch off, as the panel writes them.
  var TYPES = ['safety', 'air', 'locks', 'alarm', 'doorbell', 'doors', 'people',
    'vacuum', 'appliances', 'plants', 'battery', 'updates', 'restart'];

  function configureFrom(V) {
    V = V || {};
    var types = {};
    TYPES.forEach(function (k) {
      if (V['notify_' + k] === false) types[k] = false;
    });

    var list = Array.isArray(V.notification_appliances) ? V.notification_appliances : [];
    var timers = (V.notification_appliance_timers
      && typeof V.notification_appliance_timers === 'object')
      ? V.notification_appliance_timers : {};

    var num = function (x) {
      if (x === null || x === undefined || x === '') return undefined;
      var n = Number(x);
      return isFinite(n) ? n : undefined;
    };

    return configure({
      types: types,
      appliances: list.filter(Boolean).map(function (e) {
        return { entity: e, remaining: timers[e] || undefined };
      }),
      battery: num(V.notification_battery_threshold),
      battery_hold: num(V.notification_battery_hold_minutes),
      open_minutes: num(V.notification_open_minutes),
      co2: num(V.notification_co2_ppm),
      read_entity: V.notification_read_entity || null,
    });
  }

  if (window._hemmaNotifyCfg) {
    try { configureFrom(window._hemmaNotifyCfg); } catch (e) {}
  }

  window._hemmaNotify = {
    open: open,
    close: function () { if (_menu) _menu._close(); },
    refresh: collect,
    configure: configure,
    configureFrom: configureFrom,
    markAll: seal,
    get count() { return unread(); },
    get rows() { return _rows.slice(); },
  };

  function boot() {
    var tick = function () { if (!document.hidden) collect(); };
    var wait = setInterval(function () {
      if (!hassOf()) return;
      clearInterval(wait);
      tick();
      setInterval(tick, POLL_MS);
      // A new bell arrives with every view change and starts out empty.
      window.addEventListener('location-changed', function () {
        _bells = [];
        setTimeout(announce, 120);
      }, true);
      setInterval(announce, 2000);
    }, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

// HACS serves button-card cached, so some cards render before this file runs.
(function () {
  var waiting = window._hemmaCoreWaiters;
  window._hemmaCoreWaiters = null;
  // Retained so a sibling resource landing after this flush can re-kick them.
  window._hemmaKicked = waiting;
  if (!waiting || typeof window.hemmaKick !== 'function') return;
  setTimeout(function () {
    waiting.forEach(function (el) { window.hemmaKick(el); });
  }, 0);
})();

// Return to Home after a spell without input, for wall tablets. Off unless a
// dashboard asks for it in Hemma Studio under General > Dashboard.
(function () {
  if (window._hemmaIdleHome) return;
  window._hemmaIdleHome = true;

  var POLL_MS = 10000;
  var OFF = /[?&]hemma_idle=0/.test(location.search);
  // The tablet navbar's own test, so one dashboard reads the same under either.
  var TABLET = window.matchMedia
    ? window.matchMedia('(hover: none) and (pointer: coarse) and (min-width: 600px)')
    : null;

  var last = Date.now();
  function bump() { last = Date.now(); }

  ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach(function (t) {
    window.addEventListener(t, bump, { capture: true, passive: true });
  });
  window.addEventListener('location-changed', bump, true);

  function deep(root, tag, depth) {
    if (!root || depth > 10 || !root.querySelector) return null;
    var hit = root.querySelector(tag);
    if (hit) return hit;
    var kids = root.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].shadowRoot) {
        var f = deep(kids[i].shadowRoot, tag, depth + 1);
        if (f) return f;
      }
    }
    return null;
  }

  var _root = null;
  function huiRoot() {
    if (_root && _root.isConnected) return _root;
    _root = deep(document, 'hui-root', 0);
    return _root;
  }

  function config() {
    var root = huiRoot();
    var ll = (root && root.lovelace) || {};
    return ll.editMode ? null : (ll.config || null);
  }

  // The setting is a room variable, like every other dashboard-scoped one, so
  // it rides along in the hero card of each view.
  function minutes(cfg) {
    var views = (cfg && cfg.views) || [];
    for (var i = 0; i < views.length; i++) {
      var card = ((views[i].cards || [])[0]) || {};
      var v = (card.variables || {}).hemma_idle_home;
      if (v !== undefined && v !== null && v !== '') return parseFloat(v) || 0;
    }
    return 0;
  }

  // Never hard-code the path: dashboards get renamed and people run more than one.
  function homePath(cfg) {
    var views = (cfg && cfg.views) || [];
    if (!views.length) return null;
    var home = null;
    for (var i = 0; i < views.length; i++) {
      if (views[i].path === 'home') { home = views[i]; break; }
    }
    if (!home) home = views[0];
    var parts = String(location.pathname).split('/').filter(Boolean);
    if (!parts.length) return null;
    return '/' + parts[0] + '/' + (home.path || '');
  }

  function norm(p) { return String(p || '').replace(/\/+$/, '') || '/'; }

  function check() {
    if (OFF || !TABLET || !TABLET.matches) return bump();
    var cfg = config();
    if (!cfg) return bump();
    var mins = minutes(cfg);
    if (!mins) return bump();
    var home = homePath(cfg);
    if (!home || norm(location.pathname) === norm(home)) return bump();
    // Never pull the view out from under someone reading a popup.
    if (window.hemmaPopup && window.hemmaPopup.surface) return bump();
    if (Date.now() - last < mins * 60000) return;
    history.pushState(null, '', home);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    bump();
  }

  setInterval(check, POLL_MS);
  // A tablet coming back from sleep has been idle the whole time.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) check();
  });
})();
