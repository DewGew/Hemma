// ── Chrome right reserve ─────────────────────────────────────────────────────
// MEASURED, not derived from config: deciding the settings button's inset from
// cached state dropped it on top of the waveform. What is drawn cannot
// disagree with itself.
(function () {
  // One 34px control plus one gap. Every chrome button steps by the same
  // amount, so no two of them can end up a different distance apart.
  var SIZE = 34;
  var GAP = 12;
  var STEP = SIZE + GAP;
  var last = null;
  // Where the dots have to sit to clear the waveform, once measured. The
  // waveform is drawn by the Now Playing header, whose box is not the gutter,
  // so its position cannot be derived from this side.
  var waveTarget = null;

  function find(sel) {
    var out = null;
    (function walk(root, depth) {
      if (!root || out || depth > 14 || !root.querySelectorAll) return;
      var hit = root.querySelector(sel);
      if (hit) { out = hit; return; }
      root.querySelectorAll('*').forEach(function (el) {
        if (!out && el.shadowRoot) walk(el.shadowRoot, depth + 1);
      });
    })(document, 0);
    return out;
  }

  function findAll(sel) {
    var out = [];
    (function walk(root, depth) {
      if (!root || depth > 14 || !root.querySelectorAll) return;
      root.querySelectorAll(sel).forEach(function (el) {
        if (out.indexOf(el) === -1) out.push(el);
      });
      root.querySelectorAll('*').forEach(function (el) {
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      });
    })(document, 0);
    return out;
  }

  function showing(sel) {
    var w = find(sel);
    if (!w) return false;
    var r = w.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    var cs = getComputedStyle(w);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    return parseFloat(cs.opacity || '1') > 0.05;
  }

  // The shift is written on the slot ITSELF, not inherited from :root: a
  // transition fires off the element's own inline style change, and an
  // ancestor's custom property has not reliably started one here before.
  function shift(sel, px) {
    findAll(sel).forEach(function (el) {
      // Only the fixed chrome row slides. The phone puts its bell in an
      // absolutely positioned corner that has nothing to make room for.
      if (getComputedStyle(el).position !== 'fixed') return;
      var v = px + 'px';
      if (el.style.getPropertyValue('--hemma-chrome-shift') !== v) {
        el.style.setProperty('--hemma-chrome-shift', v);
      }
    });
  }

  function fixedSlot(sel) {
    var out = null;
    findAll(sel).forEach(function (el) {
      if (!out && getComputedStyle(el).position === 'fixed') out = el;
    });
    return out;
  }

  // How far the dots must travel to leave exactly GAP beside the waveform.
  // Returns null while the waveform is still scaling in: measuring then would
  // line the dots up against a size it is about to stop being.
  function measureWave() {
    var wave = find('.np-head-wave');
    var slot = fixedSlot('#settings') || fixedSlot('#notifications');
    if (!wave || !slot) return null;
    var r = wave.getBoundingClientRect();
    if (!r.width || Math.abs(r.width - wave.offsetWidth) > 1) return null;
    // The resolved `right` rather than the live rect: the slot may be
    // mid-transition, and its rest position is what this is measured against.
    var inset = parseFloat(getComputedStyle(slot).right);
    if (!isFinite(inset)) return null;
    return Math.max(0, Math.round((window.innerWidth - inset) - (r.left - GAP)));
  }

  function sync() {
    var waveOn = showing('.np-head-wave');
    var settingsOn = showing('.hemma-settings');

    // Right to left: the waveform owns the gutter when it is there, otherwise
    // the dots slide out to take it, and the bell follows either way.
    if (waveOn) {
      var m = measureWave();
      if (m != null) waveTarget = m;
    }
    var settingsShift = waveOn ? (waveTarget != null ? waveTarget : STEP) : 0;
    var bellShift = settingsShift + (settingsOn ? STEP : 0);

    var key = settingsShift + '|' + bellShift;
    // Only on change: rewriting inline styles every tick has broken native UI
    // elsewhere in this dashboard.
    if (key === last) return;
    last = key;
    shift('#settings', settingsShift);
    shift('#notifications', bellShift);
  }

  function boot() {
    sync();
    setInterval(sync, 400);
    window.addEventListener('location-changed', function () { setTimeout(sync, 60); }, true);
    window.addEventListener('popstate', function () { setTimeout(sync, 60); }, true);
    window.addEventListener('resize', sync);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

// ── Energy badge gate ────────────────────────────────────────────────────────
// Any energy source counts, not just a whole-room power meter. ONE definition:
// the dashboard checked this in six places and the preview in a seventh, and
// they have to agree or the preview lies.
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

  // Mirrors each template's variables.mobile_filter_category, so a card's
  // category can be resolved from its template name alone.
  if (typeof window.hemmaPsnStateTitle !== 'function') {
    // The states a PlayStation sensor reports INSTEAD of a game. Anything else
    // its state says is the game.
    const PSN_NOT_A_TITLE = new Set([
      'playing', 'paused', 'idle', 'on', 'off', 'home', 'away', 'online',
      'offline', 'standby', 'unavailable', 'unknown', 'none', 'null', '',
    ]);
    window.hemmaPsnStateTitle = (st) => !PSN_NOT_A_TITLE.has(String(st || '').trim());
  }

  // Tapping the waveform calls a service, so nothing moved until HA had written
  // the helper and pushed it back - a round trip before the animation could even
  // start. The tap records an intent instead and the panel animates off that,
  // reconciling when the real state lands.
  if (typeof window.hemmaOptimistic !== 'function') {
    const PENDING = (window._hemmaIntent = window._hemmaIntent || {});
    // How long an unconfirmed intent is trusted. Past this the service call is
    // assumed lost and the entity is the answer again.
    const TTL = 1500;

    window.hemmaIntend = (key, value) => {
      PENDING[key] = { value: value, at: Date.now() };
    };

    // Forcing a button-card to re-render with no state change takes BOTH steps:
    // shouldUpdate rejects a hass clone carrying identical states, and a bare
    // requestUpdate never reaches render(). _config is a reactive @state, so
    // marking it dirty is what actually re-evaluates the templates.
    window.hemmaKick = (el) => {
      if (!el) return;
      try {
        const h = el._hass || el.hass;
        if (h) el.hass = Object.assign({}, h);
        if (typeof el.requestUpdate === 'function') el.requestUpdate('_config', undefined);
      } catch (e) { /* the next state push will do it */ }
    };

    // The value to render for `key`: the intent while it is newer than the
    // entity's own last_changed, else the entity. An intent the state has
    // already caught up with is dropped rather than left to expire.
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
      hemma_energy:        'energy',
      hemma_lock:          'security',
      hemma_camera:        'security',
      hemma_doorbell:      'security',   // deprecated alias for hemma_camera
      hemma_cameras:       'security',
      hemma_vacuum:        'unfiltered',
      hemma_plant:         'unfiltered',
    };
  }

  // Discord's game-database name and Steam's store name rarely match exactly:
  // trademark marks, punctuation, and edition suffixes differ. Treat a whole-token
  // prefix as the same game, but only when the remainder carries no digit, so
  // "Portal" and "Portal 2" stay separate while "… Definitive Edition" folds in.
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

  // Shared by the media badge row and the Now Playing panel so both agree on
  // which PC sources are live and which duplicate is dropped. Returns at most
  // one entry per source, already reconciled per V.duplicate_game.
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

      // One sensor carries the lot: its STATE is the presence, its attributes
      // hold game, details and artwork. The older per-attribute entities still
      // work and still win wherever they are set.
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

      // Steam the same way: steam_online's own sensor carries game and artwork
      // on the account entity, so one field is enough.
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

  // ── Now Playing collector ────────────────────────────────────────────────
  // The ONE definition. It used to live here and in both Now Playing
  // templates, all three behind `typeof !== 'function'`, so whichever
  // rendered first won and this copy - the one a resource loads before any
  // card renders - was the one nobody edited. Five fixes sat in the templates
  // and never ran. Nothing else may define these.
  // Who is hidden. The collector and the media badge both decide whether a
  // Plex stream counts, so the rule lives in one place.
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
      // Discord's game-database name and Steam's store name rarely match exactly:
      // trademark marks, punctuation, and edition suffixes differ. Treat a whole-token
      // prefix as the same game, but only when the remainder carries no digit, so
      // "Portal" and "Portal 2" stay separate while "… Definitive Edition" folds in.
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
        // buffering counts: pointed straight at a Tautulli session sensor, which
        // reports it verbatim, a strict 'playing' test dropped the row. A
        // wrapper template sensor collapses it, which is why this only showed
        // up without one. The real filtering is the upstream check below.
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
        // A sensor naming a game IN ITS STATE is telling us one is
        // running - `st === 'playing'` can never be true for it, which
        // left the row not-playing: no waveform, and bottom of the rank.
        const stateIsTitle = !attrTitle && !notATitle.has(st);
        const title = attrTitle || (stateIsTitle ? norm(s.state) : '');
        if (!title) continue;
        out.push({
          key: 'psn' + i,
          kind: 'activity',
          entity: eid,
          // The PlayStation integration splits one session across two
          // entities: sensor.X carries the title, image.X the cover. The
          // template sensor people are told to build is only those two
          // married up, so marry them here and the integration's own
          // sensor works on its own.
          art: abs(a.entity_picture_local || a.entity_picture || a.image_url
            || a.media_image_url
            || (function () {
              const iid = String(eid).replace(/^sensor\./, 'image.');
              const im = states[iid];
              const iat = (im && im.attributes) || {};
              // entity_picture first; the image integration also
              // publishes access_token, and the proxy URL is built from
              // it exactly the way the frontend builds one. The state is
              // the last-updated stamp, which busts the cache when the
              // cover changes but the token does not.
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

      // ── Steam ─────────────────────────────────────────────────────
      // steam_game is the gate; steam_online is an optional presence guard. The
      // Steam API only reports a game when the profile's game details are public.
      if (V.show_steam && (V.steam_account || V.steam_game)) {
        // The account sensor's state is the presence and its attributes carry
        // game and artwork; the per-part entities still win where they are set.
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

      // ── One game, two reporters ───────────────────────────────────
      // Discord reports every launcher, so a Steam game arrives twice when both are
      // wired. Keep one tile and let it inherit whatever the dropped row had.
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

  // --np-open flips immediately (exit animation fires on time), but tiles/chips keep last
  // content briefly - otherwise the collapsing tile shows an empty placeholder.
  // The card's own source set, which is what makes one Now Playing card a
  // different card from another. Not the room's name: two rooms can name the
  // same players, and a disabled card still has a configuration.
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

  // Per-card scratch space. Every room card builds a Now Playing card and a
  // page can hold a second dashboard's, so state keyed by anything the cards
  // share - a slot name, a row key, nothing at all - is state they trample.
  // Ask for it by name and it comes back scoped to the configuration.
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
      // One hold PER CONFIGURATION. Every room card builds one of these -
      // hemma_room's now_playing field is always present and merely disabled -
      // and a page can carry a second dashboard's as well. Sharing one hold
      // handed a card with no sources of its own another card's list for up to
      // 900ms, which is the empty ghost tile beside the real one, and why only
      // a reload cleared it.
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
      // Artwork belongs in the signature: Plex, PSN and Discord can publish a
      // title before its image, and a title-only signature freezes art:null.
      const artSig = (u) => String(u || '').split('?')[0];
      const parts = [];
      for (let i = 1; i <= 10; i++) {
        const e = V['show_media_player_' + i] && V['media_player_' + i];
        if (e) {
          const s = states[e]; const a = s?.attributes || {};
          parts.push(e + s?.state + (a.media_title || '') + (a.media_position || '') +
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
          // The sibling image.X entity has to be in here too. It is where
          // the integration's cover lives, it arrives AFTER the title, and
          // a signature blind to it froze art:null in the cache forever -
          // which is the very failure the note at the top warns about.
          // Reading it here is also what subscribes the card to it.
          const pim = states[String(p).replace(/^sensor\./, 'image.')];
          const pia = (pim && pim.attributes) || {};
          parts.push(p + states[p]?.state + (pa.full_title || '') +
            artSig(pa.entity_picture_local || pa.entity_picture || pa.image_url || pa.media_image_url) +
            artSig(pia.entity_picture_local || pia.entity_picture) +
            // The image entity's own state is its last-updated stamp, so
            // it changes whenever the cover does even when the token
            // does not - and it is what subscribes the card to it.
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

        // Every source gets the same short departure hold, just so its exit
        // animation has content to animate away with.
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


    // The phone's slot planner. Nine fixed wrappers; a source keeps its wrapper
    // while it lives so a re-render cannot recycle one mid-animation, and a
    // departing source keeps its own for EXIT_MS so it has something to animate
    // out with. This lived in hemma_mobile_now_playing.yaml until the collector
    // moved here and took it along by accident, leaving the phone with no Now
    // Playing section at all.
    if (typeof window._hemmaNPPlan !== 'function') {
      window._hemmaNPPlan = function (states, V) {
        const EXIT_MS = 480;
        // Cap on waiting for artwork before opening an arrival anyway.
        const ART_CAP = 400;
        // An arrival must paint at least one frame closed, or there is no start value to
        // transition from and it appears fully formed.
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

          // Anchor on the head so the leftmost (only fully visible) tile never changes
          // wrapper. A new head takes the wrapper immediately left of the old head.
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
            /* One object, not five. The poster, the title, the progress and the
               four detail tiles are all one thing - what is playing - so the
               player is a single plate rather than a set of floating widgets.
               The tiles inside it are panels of that object, not objects. */
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
  // Same breakpoints the card templates use for "mobile": narrow (phone
  // portrait) OR short (phone landscape / very short windows).
  const MOBILE_MQ = window.matchMedia('(max-width: 767px), (max-height: 500px)');
  const MOBILE_RE = /^\/dashboard-hemma-mobile(\/|$)/;
  // Build marker: a missing --hemma-wallpaper-js in the console means an OLD
  // cached script is serving this module and the theme's fallbacks are painting
  // - silently, since they are valid CSS. Resources are pinned per file, so
  // moving code between files means bumping BOTH pins.
  const WALLPAPER_JS = 3;
  // Refuse to run twice. A stale hemma-redirect.js still ships its own copy of
  // this module, and two of them would both publish variables and both paint
  // <html>.
  if ((window.__hemmaWallpaperJs || 0) >= WALLPAPER_JS) return;
  window.__hemmaWallpaperJs = WALLPAPER_JS;
  try {
    document.documentElement.style.setProperty(
      '--hemma-wallpaper-js', String(WALLPAPER_JS));
  } catch (e) {}

  // Phone landscape. MOBILE_MQ cannot stand in for this: 393x852 and 852x393
  // both satisfy it, so it never fires on rotation.
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
      // The mesh has to be here too, in the same order as the card's ::before.
      // Without it <html> paints a clean wash+gradient and the card then adds the
      // mesh on top a beat later, so the wallpaper visibly changes at the exact
      // moment the cards appear.
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
    // Portrait sizes the photo by HEIGHT so the join sits in the same place on
    // every phone. Landscape cannot: 28% of a short viewport is a photo only a
    // quarter of the screen wide, a strip down the middle. There it goes
    // width-driven, matching the card's own landscape media query.
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
    // Read at paint time, not captured once: applyHtmlBackground re-runs on the
    // media query's own change event, so rotating the phone repaints rather than
    // keeping a stale snapshot.
    h.style.backgroundSize     = LANDSCAPE_MQ.matches ? BG.sizeLandscape : BG.sizePortrait;
    h.style.backgroundPosition = BG.position;
    h.style.backgroundRepeat   = 'no-repeat';
    h.style.backgroundColor    = BG.color;
  }

  // ── Gradient sampling ────────────────────────────────────────────────────────
  const SAMPLE_KEYS = ['handoff', 'upper', 'mid', 'lower', 'base'];
  // VERSIONED: bump it whenever paletteFrom's SHAPE changes. A palette cached
  // before a field existed is served forever and the field falls through to its
  // fallback, which looks like the feature never shipped. localStorage survives
  // a hard refresh, so nobody can clear it themselves.
  const CACHE_PREFIX = 'hemma-hero-sample:v2:';
  const CACHE_ROOT = 'hemma-hero-sample:';

  const CACHE_FIELDS = SAMPLE_KEYS.concat(['meshA', 'meshB']);

  // Drop entries from earlier cache versions so localStorage does not accumulate
  // a dead palette per version per photo.
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
  // Set a color's brightness while keeping its hue. Luminance is driven
  // separately from color below, and this is the join between the two.
  const atLum = (c, target) => { const l = lum(c) || 1; return c.map((v) => v * target / l); };
  // Positive is warm (red side), negative cool (blue side). Crude next to a real
  // hue angle, but it only ever has to rank two colors against each other.
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
    // Tainted canvas throws here. /local/ is same-origin so it should not, but a
    // reverse proxy serving media off another host would.
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
        // Shape-checked as well as versioned. Either guard alone is one thing to
        // forget; together, a stale or partial entry just misses and recomputes.
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

    // Each view hands the bar its own copy of the same config. Rebuilding on
    // that would throw away the indicator mid-travel, so only a real change
    // to the routes or the variant is allowed through.
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
      // The first placement can land before the nav has been laid out, where
      // _placeIndicator bails and never marks the bar visible. Re-run after a
      // frame; unchanged geometry returns early, so a travel is not snapped.
      this._syncHeaderOffset();
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        this._syncHeaderOffset();
        this._placeIndicator();
      });
      // Web fonts land after first layout and every label changes width. Only
      // the first nav of the page needs this; on a remount they are cached and
      // the promise resolves instantly, which would snap a travel in progress.
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
      // The glass is a SIBLING of the routes, never their ancestor: a
      // backdrop-filter composites its whole subtree as one, which would stop
      // the indicator getting its own layer and drop the travel back onto the
      // main thread - the same thread HA blocks building a view.
      const glass = document.createElement('div');
      glass.className = 'glass';
      bar.appendChild(glass);
      const scroller = document.createElement('div');
      scroller.className = 'scroller';
      bar.appendChild(scroller);
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
      if (route.url) { navigate(route.url); return; }
      const ta = route.tap_action;
      if (ta && ta.action === 'navigate' && ta.navigation_path) navigate(ta.navigation_path);
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

    // Leading the edge that moves first is what gives it the stretch.
    // --hemma-header-offset resolves through vars HA does not always set, so it
    // reads 0 and the bar rides into the header. Measure instead.
    _syncHeaderOffset() {
      let view = null;
      // The bar lives in ha-app-layout, inside hui-root's shadow root - and
      // hui-view is a sibling subtree in that same root. Ask there first; the
      // document-wide walk below is only for when the bar has been parked on
      // body because no app layout was found.
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

    // Travels the fill (tablet) or the underline (desktop) to the active label.
    // Width is written once per move; the travel itself is transform only.
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
      ind.style.width = to.width + 'px';

      if (instant || !from) {
        ind.classList.add('instant');
        ind.style.transform  = 'translateX(' + to.left + 'px)';
        fill.style.transform = 'scaleX(1)';
        ind.classList.add('on');
        void ind.offsetWidth;
        ind.classList.remove('instant');
      } else {
        // Render the OLD box exactly, using the new width as the base, then let
        // both transforms resolve to their identity at the destination.
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
      // Same glass tokens as the tablet pill, so the menu reads as the same
      // material. Radii stay concentric - outer less the padding is what a row
      // carries - so the corners nest instead of fighting. macOS 26 rounds a
      // menu highlight to roughly half its height; this sits just under that.
      Object.assign(menu.style, {
        position: 'fixed', zIndex: '99999', boxSizing: 'border-box',
        padding: '6px', borderRadius: '26px',
        maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', overflowX: 'hidden',
        width: 'max-content', maxWidth: 'calc(100vw - 24px)',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', rowGap: '2px',
        background: 'var(--hemma-glass-background, rgba(255,255,255,0.10))',
        backdropFilter: 'var(--hemma-glass-backdrop, blur(24px) saturate(180%))',
        WebkitBackdropFilter: 'var(--hemma-glass-backdrop, blur(24px) saturate(180%))',
        boxShadow: 'var(--hemma-glass-rim, inset 0 1px .5px -0.5px rgba(255,255,255,0.55))'
          + ', 0 12px 34px rgba(0,0,0,0.26)',
        scrollbarWidth: 'none',
        opacity: '0', transform: 'scale(.96)', transformOrigin: 'top center',
        transition: 'opacity .14s ease, transform .16s cubic-bezier(.2,.9,.3,1)',
      });

      const build = () => {
        const items = this._menuItems(route);
        // hass lands many times a second, and every one of those was tearing
        // the menu down and rebuilding it - destroying the row under the
        // cursor mid-hover, which is what made the fill flicker.
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
            minHeight: '46px', padding: '0 16px 0 13px', borderRadius: '20px',
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
          // Object.assign cannot set a custom property - it silently does
          // nothing - so the icon kept rendering at its 24px default, spilling
          // out of its column and sitting off-center against the label. Sized
          // under its box so the glyph centres rather than filling to the edge.
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
        menu.style.top = Math.round(r.bottom + 10) + 'px';
        menu.style.left = Math.round(
          Math.max(12, Math.min(cx - w / 2, window.innerWidth - w - 12))
        ) + 'px';
      };
      place();

      requestAnimationFrame(() => {
        menu.style.opacity = '1';
        menu.style.transform = 'scale(1)';
      });

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
        menu.style.opacity = '0';
        menu.style.transform = 'scale(.96)';
        setTimeout(() => { if (menu.parentNode) menu.remove(); }, 170);
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

        /* Split across two elements so one edge can lead the other, and both move
           by TRANSFORM - a compositor property, so the travel survives a busy
           main thread. left/right are layout, and on tablet they also re-blur
           the glass pill. */
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
          }

          @media (orientation: portrait) {
            :host {
              top: calc(var(--hemma-chrome-row-top-tablet-portrait, 32px)
                + var(--hemma-nav-header-offset, var(--hemma-header-offset, 0px)));
            }
          }

          .bar {
            width: fit-content;
            max-width: min(
              calc(75vw - 35px),
              calc(100vw - 2 * (var(--hero-gutter, 23px)
                + var(--hemma-chrome-side-reserve-tablet, 118px)))
            );
            margin: 0 auto;
            height: var(--hemma-nav-pill-height-tablet, 46px);
            padding: 0 var(--hemma-nav-pill-inset-x-tablet, 4px);
            border-radius: 9999px;
            overflow: hidden;
          }

          .glass {
            background: var(--hemma-glass-background, rgba(255,255,255,0.10));
            -webkit-backdrop-filter: var(--hemma-nav-glass-backdrop, blur(24px) saturate(120%));
            backdrop-filter: var(--hemma-nav-glass-backdrop, blur(24px) saturate(120%));
            box-shadow: var(--hemma-nav-glass-rim,
              inset 0 1px .5px -0.5px rgba(255,255,255,0.55),
              inset 0 -1px .5px -0.5px rgba(255,255,255,0.48),
              inset 0 3px 6px -3px rgba(255,255,255,0.20),
              inset 0 -3px 6px -3px rgba(255,255,255,0.12),
              2px 0 3px -2px rgba(0,0,0,0.45),
              -2px 0 3px -2px rgba(0,0,0,0.45),
              0 4px 28px 2px rgba(0,0,0,0.07));
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

          .badge { top: 9px; left: 44px; }
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

        .badge { top: 35px; right: 10px; }
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

  // ha-app-layout survives navigation - only the hui-view inside it is swapped -
  // and the theme scopes the nav variables to it, so the bar both persists and
  // still inherits its own tokens. document.body would do neither.
  function persistentHost() {
    const found = [];
    walkFind(document, 'ha-app-layout', found, 0);
    for (const el of found) if (el.isConnected) return el;
    return document.body;
  }

  // The card is per view and is destroyed on every navigation. It owns no UI:
  // it just keeps the one long-lived bar alive and fed, so the indicator can
  // animate as an uninterrupted element instead of being handed between mounts.
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
      // A view swap disconnects this card a frame before the next one connects.
      // Only retire the bar once nothing has claimed it in between.
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

// ── Hemma popup ──────────────────────────────────────────────────────────────
// Hemma renders the popup itself rather than restyling someone else's dialog.
// Templates fire an ll-custom carrying `hemma_popup`, which nothing else listens
// for - so browser_mod keeps hiding the sidebar without ever seeing a popup.
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

  // popup_styles reaches the dialog by TAG NAME, so those tags point at Hemma's
  // one surface element until the templates stop naming them.
  // How long a chart has to draw before the popup stops hiding it. The widgets
  // never wait on this - see _gateOnCharts.
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

  // Scan on a slow cadence, paint every time: doing both per hass update meant
  // walking every shadow root under the popup on every state change in the
  // house. Not one-shot - button-cards render async, so nodes appear late.
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
      // One entity's value as a share of another's. The row's value had a live
      // hook and its sub-line was a baked string, so the watts moved and the
      // percentage stayed where it was rendered.
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
      // Averaged across the group, so a popup driving several covers tracks all
      // of them, and inverted where the fill means how much still covers the
      // window. Baked at render, the control did not follow its own rows.
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
      // An action, not a reading. First matching rule wins, else the default.
      // The color moves with the word: "Updating" in the same teal as "Update"
      // reads as a button you can still press.
      if (el.dataset.hemmaLive === 'act') {
        var aspec;
        try { aspec = JSON.parse(el.dataset.hemmaAct || '{}'); } catch (e) { continue; }
        var arules = aspec.rules || [];
        var apick = null;
        for (var ai = 0; ai < arules.length && !apick; ai++) {
          var ar = arules[ai];
          var aval = ar.attr === 'state' ? st.state : (st.attributes || {})[ar.attr];
          var ahit = ar.eq !== undefined ? aval === ar.eq : !!aval;
          if (ahit) apick = ar;
        }
        if (!apick) apick = aspec;
        el.textContent = apick.text != null ? apick.text : '';
        if (apick.color) el.style.color = apick.color;
        el.style.display = apick.text === '' ? 'none' : '';
        continue;
      }
      // A word, not a number: covers read "45% open" / "Closed" / "Opening...".
      // This has to run before the isNaN guard below, which drops anything
      // non-numeric.
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
        /* Only a real navigation closes this: more-info pushes a history entry on
           the SAME path, and closing it pops that entry - neither is leaving.
           Looking for the dialog is not enough on its own, since
           location-changed fires before HA has mounted it. */
        if (location.pathname === this._navPath) return;
        var ha = document.querySelector('home-assistant');
        if (ha && ha.shadowRoot && ha.shadowRoot.querySelector('ha-more-info-dialog')) return;
        if (Date.now() - (this._miOpenedAt || 0) < 1000) return;
        this.close();
      };

      this.scrim.addEventListener('click', () => this.dismiss());

      // Tapping the ground between widgets closes the popup, but only where a
      // popup asks for it: a sheet whose content fills the surface has no
      // "outside", and closing between its controls would be a trap.
      // A pointer that moved is a scroll or a drag, not a tap.
      this.content.addEventListener('pointerdown', (e) => {
        // A finger never lands and lifts on exactly one pixel, so the tolerance
        // has to be bigger for touch than for a mouse - at 10px a perfectly
        // still tap was being read as a drag and the dismiss never ran, which
        // is why tapping the room worked on desktop and not on a phone.
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
      // touchend as well as click: inline handlers have been eaten here before.
      // The guard is what stops the pair double-firing on a real tap.
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
        // The header is built once and reused, so its entrance ran at page load
        // and has been finished ever since - the content IS rebuilt per open and
        // animated in around it. Re-apply so it plays on this open too.
        this._replayChrome();
        document.addEventListener('keydown', this._onKey, true);
        this._navPath = location.pathname;
        window.addEventListener('location-changed', this._onNav, true);
        window.addEventListener('popstate', this._onNav, true);
        this._prevOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
      }

      if (isCard) await this._buildCard(cfg.content);
      else if (cfg.content) this.container.textContent = String(cfg.content);

      if (hasHeader && cfg.header_actions && typeof cfg.header_actions === 'object') {
        await this._buildCard(cfg.header_actions, this._headerActions);
      }

      setTimeout(() => this._probe(), 900);   // after card_mod has landed

      this._gateOnCharts(isCard ? cfg.content : null);
    }


    /* The popup never waits for a chart: the widgets arrive at once and the
       chart fades itself in when it stamps data-hemma-ready. Its space is
       already held by the widget it sits in, so nothing moves. */
    _gateOnCharts(config) {
      if (this.hasAttribute('open')) this.setAttribute('data-hemma-charts-ready', '');
      var hasChart = false;
      try { hasChart = JSON.stringify(config || '').indexOf('custom:apexcharts-card') > -1; }
      catch (e) { hasChart = false; }
      if (!hasChart) return;
      // A chart that errors, or genuinely has no data, never stamps itself and
      // would stay invisible for good. One deferred sweep, after the cards have
      // settled - no polling, and no walk at all in the common case.
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

    // Diagnostic, off unless the URL carries ?hemmaprobe=1. Walks the popup and
    // every nested shadow root and lists anything large enough to be the seam
    // that carries a fill, a backdrop-filter, a blend mode, a promoted layer or
    // partial opacity - what is actually painting, not what should be.
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

    // Widget or ground? POSITIONAL, not path-based: composedPath fails on any
    // card that re-renders while the tap is dispatching, and a detached node
    // reports no background. The test is whether anything at the point PAINTS.
    _overWidget(ev) {
      var x = ev.clientX, y = ev.clientY;
      if (typeof x !== 'number' || typeof y !== 'number') return false;
      // A SYNTHETIC click carries no coordinates: clientX/clientY are 0, which
      // passes the guard above, and (0,0) is off the popup - so nothing is found
      // there and the tap reads as bare ground.
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

    _replayChrome() {
      var els = [this._headerClose, this._headerContent, this._headerActions];
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!el) continue;
        el.style.animation = 'none';
        // Read it back, or the two writes coalesce and nothing restarts.
        void el.offsetWidth;
        el.style.animation = '';
      }
    }

    dismiss() {
      // A control claims its own tap by stamping this, and the background
      // dismiss stands down briefly. Identifying such a tap from the EVENT
      // cannot work: the control re-renders itself while the tap is still
      // dispatching. The control is the only thing that knows for certain.
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
      // Read off the config, the way the chart gate does: a popup whose content
      // carries no live markers must not pay for a scan that can only ever find
      // none. light and the media popups are entirely in this case.
      if (this._bridge) {
        var hasLive = false;
        try { hasLive = JSON.stringify(config || '').indexOf('data-hemma-live') > -1; }
        catch (e) { hasLive = true; }
        this._bridge._liveCache = { none: !hasLive, nodes: null, at: 0 };
      }
      /* Charts are the only cards worth keeping. Everything else builds in a
         frame; a chart fetches history and draws, which is the wait. */
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
      // One permanent registration on the bridge - provideHass has no matching
      // unprovide, so registering each card would grow that list per open.
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

    // Drag the whole sheet, not just the handle - but only from the handle or
    // with the scroller already at the top, or this fights the content. Nothing
    // is prevented until the finger has committed 8px, so a tap is still a tap:
    // swallowing touchstart outright is what killed inline handlers before.
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

  // Sits in the home-assistant shadow root beside HA's own dialogs, so a
  // more-info opened from inside the popup is appended after it and lands on
  // top without either of them needing a z-index fight.
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

  // The templates carry `hemma_popup:` now, not `browser_mod:`. That is what
  // guarantees browser_mod cannot pick a popup up even while it stays installed
  // for the sidebar and header hiding it still does.
  window.addEventListener('ll-custom', function (ev) {
    if (!flagOn()) return;
    var cfg = ev.detail && ev.detail.hemma_popup;
    if (!cfg) return;
    ev.stopPropagation();
    window.hemmaPopup.open(cfg);
  }, true);
})();

// ── HA dialog chrome ─────────────────────────────────────────────────────────
// HA dialogs bottom out in a native <dialog> four hops down:
// ha-more-info-dialog > ha-adaptive-dialog > ha-dialog > wa-dialog > dialog.
// A keyframe, not a transition: the ::backdrop does not exist until it opens.
(function () {
  if (window._hemmaDialogChrome) return;
  window._hemmaDialogChrome = true;

  var MARK = '_hemmaChrome';

  // The scrim has no entrance: HA fades its own in, and a second reads as two
  // events. The blur weakening during HA's slide is a browser constraint - a
  // transform above a backdrop-filter suspends it.
  // Backticks, not quotes: the data URI contains both kinds.
  var SHEET_RADIUS =
    ':host([placement="bottom"]) dialog {' +
    '  border-start-start-radius: var(--hemma-sheet-radius, 24px) !important;' +
    '  border-start-end-radius: var(--hemma-sheet-radius, 24px) !important;' +
    '}';

  // A blend layer composites the subtree as one group, and returning from
  // another tab that group is rebuilt before anything paints - until it lands
  // the area is a flat dark rectangle. Off by default.
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

  // Over a hemma-popup the room already has its scrim, and that one never
  // toggles - this one standing down whole is what leaves the blur unbroken
  // when the dialog goes. The dialog's own surface still blurs what is behind it.
  var STACKED_SCRIM =
    ':host([hemma-stacked]) dialog::backdrop {' +
    '  background-color: var(--hemma-stacked-scrim, transparent) !important;' +
    '  background-image: none !important;' +
    '  backdrop-filter: var(--hemma-stacked-scrim-backdrop, none) !important;' +
    '  -webkit-backdrop-filter: var(--hemma-stacked-scrim-backdrop, none) !important;' +
    '}';

  // HA's drawer animates translate AND opacity. The opacity is the problem:
  // below 1 the element is a backdrop root, so its own backdrop-filter samples
  // nothing and the blur only lands when the ramp reaches 1. Same motion, same
  // 300ms, translate only.
  var DRAWER_SLIDE =
    '@keyframes hemma-drawer-in { from { translate: 0 100%; } to { translate: 0 0; } }' +
    ':host([placement="bottom"]) dialog { animation-name: hemma-drawer-in !important; }';

  // Desktop more-info is a wa-dialog; on mobile it is a wa-drawer, which none
  // of this was reaching. The offset is dialog-only - a bottom sheet is
  // already flush against the edge.
  var CSS_BY_HOST = {
    // Pushing the dialog down without shrinking it sends the bottom off
    // screen - the UA's max-height is measured from the viewport, not from
    // where the margin puts it, so the last controls become unreachable.
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

  // The one moment that is guaranteed correct: showModal() is what creates the
  // ::backdrop, so a stylesheet added immediately before it cannot be late.
  // Element lifecycle hooks were not reliable here - the patch applied but the
  // style still arrived after the dialog had opened.
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

  // The sweep alone is too late: a cold open builds and opens wa-dialog before
  // any observer fires, so the stylesheet lands mid-open. Patching
  // connectedCallback puts it in first. Lit builds the shadow root on first
  // update, hence the retry.
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
    // wa-dialog is built a beat after the dialog element lands, and only its
    // own shadow root can be reached once it is - hence the retry rather than
    // a subtree observer, which cannot see across the boundary anyway.
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

  // A backdrop-filter's first paint builds its texture; until then the element
  // paints UNFILTERED, which on the ::backdrop is a snap rather than a fade. One
  // 1px pixel does the building up front. BOTH filters: warming the cheap one
  // does nothing for the expensive one.
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

  // The compositor reclaims those textures when the tab is hidden, so on the way
  // back every backdrop-filter on screen builds again at once - a dozen of them
  // with a popup open. Warm once on return, as at boot.
  patchShowModal();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(); warmFilter(); });
  } else {
    boot();
    warmFilter();
  }
})();

// ── Popup body components ────────────────────────────────────────────────────
// One source for the shared popup anatomy: header (drawn by hemma-popup), then
// hero, then grouped rows. Templates build HTML strings, so these return HTML
// strings with inline styles - card_mod cannot reach into button-card's root.
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
    // The action tint. Teal, not a one-off blue that appears nowhere else
    // in the dashboard - an app gets one tint color, and this is Hemma's.
    blue: 'var(--hemma-popup-ui-action, var(--hemma-color-teal, #00C3D0))',
    green:'var(--hemma-popup-ui-good, #30D158)',
    amber:'var(--hemma-popup-ui-warn, #FF9F0A)',
    red:  'var(--hemma-popup-ui-bad, #FF453A)',
    accent: 'var(--hemma-color-teal, #00C3D0)',
    font: 'var(--primary-font-family, system-ui)',
    // One size for every tall control, so the lock toggle and the cover
    // slider line up when a popup shows both.
    controlH: 314,
    controlW: 120,
  };

  var tone = function (t) {
    return t === 'good' ? T.green : t === 'warn' ? T.amber : t === 'bad' ? T.red
      : t === 'accent' ? T.accent : null;
  };

  // A title with no card under it. Apple's device sheets put the name and the
  // state bare on the blurred room and let the controls be the only surfaces.
  // { title, state, stateTone }
  function headline(o) {
    o = o || {};
    // The chrome carries the name, so what is left here is the live state line -
    // which the chrome cannot carry, since its title is evaluated once on open.
    // Nothing to say, nothing to draw: an empty block still spends its padding.
    if (o.barTitle && !o.state) return '';
    var out = '<div style="font-family:' + T.font + ';text-align:center;'
      + 'padding:' + (o.padTop != null ? o.padTop : 2) + 'px 8px '
      // A caption adds its own 5px lead and a line box below the state, so the
      // block's own bottom padding comes off or the widget below sits too low.
      + (o.barTitle ? ((o.caption != null || o.captionSlot) ? 3 : 10) : 18)
      + 'px;">';
    if (!o.barTitle) {
      out += '<div style="font-size:clamp(28px, 4.2vw, 38px);font-weight:700;'
        + 'letter-spacing:-0.02em;line-height:1.1;color:' + T.ink + ';">'
        + esc(o.title || '') + '</div>';
    }
    if (o.state) {
      // A size down and a shade back, never in the accent: it is what the thing
      // IS, not something you can act on.
      // sheet: the measure the lock and cover popups set by hand - a size up
      // and in the full text color, not the dimmer ink.
      var sheet = o.measure === 'sheet';
      out += '<div style="font-size:' + (sheet ? '22px' : 'clamp(17px, 2.1vw, 21px)')
        + ';font-weight:400;letter-spacing:' + (sheet ? '-0.5px' : '-0.01em')
        + ';margin-top:3px;color:'
        + (tone(o.stateTone) || (sheet ? T.ink : T.ink2)) + ';">'
        + esc(o.state) + '</div>';
    }
    // A caption under the state, for a fact that has to be computed after the
    // popup is already up. Emitted empty and filled in later, so the line does
    // not pop the layout when its answer arrives.
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

  // { label, value, unit, sub, subTone, chip: { text, tone }, center, compact,
  //   trailing, trailingLabel }
  // `center` PINS the type size, or a length-based size jumps while you drag.
  // `compact` puts the headline INSIDE a chart's plate, so the number and its
  // curve read as one object.
  function hero(o) {
    o = o || {};
    if (o.compact) {
      var cInk = tone(o.subTone);
      // Two columns from the same top edge: inside the value's flex row, the
      // trailing caption sat level with a 30px word and read as dropped however
      // the baselines were aligned. Side by side, captions share a line and
      // readings share a line.
      var out = '<div style="font-family:' + T.font + ';text-align:left;'
        + 'display:flex;align-items:flex-start;justify-content:space-between;'
        + 'gap:12px;padding:2px 2px 10px;">'
        + '<div style="display:flex;flex-direction:column;gap:1px;min-width:0;">';
      if (o.label) {
        // A knob because the label carries different weight per popup: where the
        // popup keeps its header title this is a caption, and where the header
        // is stripped back to a close control it is the only thing naming the
        // widget.
        out += '<div style="font-size:var(--hemma-popup-hero-label-size, 13px);'
          + 'letter-spacing:-0.01em;color:' + T.ink2 + ';">'
          + esc(o.label) + '</div>';
      }
      // The headline is a state word. A word at 30px reads as a title and fills
      // the block - a two-digit number does not, and a same-size unit competes
      // with it rather than supporting it. Keeping every popup worded here is
      // what makes them read as one family.
      /* Scales with the sheet it sits in. A flat 30px was comfortable on a
         desktop and ran into the reading on its right on a phone, where the
         plate is a third of the width. The unit follows it so the pair keeps
         its proportion. */
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
        // Mirrors the left: caption over value. A number with no name is a
        // number you have to guess at - "15 ms" could be anything.
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
      // subTone lets the sub carry a verdict. A chip said the same thing, but a
      // chip is a fixed-width object beside the value and on a phone it landed
      // on top of the sub-line it was competing with.
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

  // The Settings row idiom: a solid color tile with a white glyph. Hemma icons
  // are masked so they take currentColor; an mdi: name falls through to ha-icon.
  // Hues are the dashboard's own tile palette, so a device reads the same in the
  // popup as on its tile.
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
    // No tile kind owns these, so they were falling through to the teal
    // default and a battery list came out entirely one color. Motion takes
    // purple; the personal devices share blue, because they are the same kind
    // of thing and should not be told apart by hue.
    motion: 'var(--hemma-color-purple, #9333ea)',
    occupancy: 'var(--hemma-color-purple, #9333ea)',
    presence: 'var(--hemma-color-purple, #9333ea)',
    cellphone: 'var(--hemma-color-blue, #0088FF)',
    phone: 'var(--hemma-color-blue, #0088FF)',
    tablet: 'var(--hemma-color-blue, #0088FF)',
    // A sun is yellow like the bulbs it stands in for. Conductivity is soil
    // chemistry, not a status, so it takes the one hue nothing else in a plant
    // popup uses.
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

  // `contain`, not `auto <h>`: these viewBoxes run 0.59:1 to 1.92:1, so sizing by
  // height alone overflows the wide ones. ha-icon does not self-center, so the
  // mdi branch needs its own. iconTone takes a keyword or a literal color, so a
  // row can match something outside the palette - a chart series, say.
  function icon(name, t) {
    if (!name) return '';
    var literal = (typeof t === 'string' && /^(var\(|#|rgb|hsl)/.test(t)) ? t : null;
    var fill = tone(t) || literal || hueFor(name);
    var tile = 'width:29px;height:29px;border-radius:7px;background:' + fill + ';flex:none;'
      + 'display:flex;align-items:center;justify-content:center;line-height:0;pointer-events:none;';
    if (String(name).indexOf(':') !== -1) {
      return '<div style="' + tile + '"><ha-icon icon="' + esc(name) + '" style="--mdc-icon-size:18px;'
        + 'width:18px;height:18px;color:#fff;display:flex;align-items:center;justify-content:center;'
        + 'line-height:0;"></ha-icon></div>';
    }
    var url = (typeof window.hemmaIconUrl === 'function')
      ? window.hemmaIconUrl(name) : '/local/hemma/icons/' + name + '.svg';
    return '<div style="' + tile + '"><div style="width:17px;height:17px;background-color:#fff;'
      + "-webkit-mask:url('" + url + "') center / contain no-repeat;"
      + "mask:url('" + url + "') center / contain no-repeat;\"></div></div>";
  }

  // group(rows, label, labelAction, opts)
  // rows: [{ icon, iconTone, label, sub, value, valueTone, action, bar: 0..1, barTone,
  //          liveAttr | liveWords, image, labelTone, subLive }]
  // Dividers are real elements so they can inset without a pseudo.
  // labelAction acts on the whole GROUP, not a row.
  // opts.labelInside moves the caption onto the plate: with no pane there is
  // nothing behind a floating caption but the room.
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
      // button-card adds .disabled to ha-card when tap_action is none, and that
      // carries pointer-events:none to every descendant. The card should stay
      // inert; the rows inside it must not.
      + 'ha-card.disabled{pointer-events:auto!important;}'
      + '.hui-row{transition:background-color .18s ease;}'
      // The entrance rides the PLATE, never a wrapper: an animated opacity on an
      // ancestor paints the subtree into its own layer and every
      // backdrop-filter inside goes flat for the animation. Transform on an
      // ancestor is fine; opacity is the one that kills it.
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
      + '.hui-chev{opacity:.35;flex:none;pointer-events:none;}'
      // One line down to 340, where it stacks. inline-block, not inline: an
      // INLINE box ignores overflow and text-overflow, so a long sub ran under
      // the row's action instead of ellipsising before it.
      + '@media (min-width: 340px){'
      +   '.hui-sub{display:inline-block;max-width:100%;vertical-align:bottom;'
      +     'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      +   '.hui-sub2::before{content:"  \\00b7  ";opacity:.6}'
      + '}'
      // Two-step confirm inside the row, ported from the Studio panel's tile
      // editing: the row clips, Confirm is parked outside the trailing edge, and
      // arming slides it in while the row content slides out the same distance.
      + '.hui-row{overflow:hidden;position:relative;--cf-w:88px;}'
      // Inset from the row rather than filling it. 12px either side leaves
      // 28px in a 52px row, so the chip reads as sitting IN the row instead of
      // being the row.
      + '.hui-cf{position:absolute;top:12px;bottom:12px;right:8px;width:var(--cf-w);'
      // Concentric: the group's radius less its inset, so the curves stay
      // parallel. It cannot simply BE the radius - at 28px tall anything from 14
      // up clamps to a capsule.
      // The action's own tint, not red: red is for destroying something
      // unrecoverable.
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
    // Its own knob, not T.fill: this surface repeats the whole length of a popup
    // and wants to sit heavier than the incidental fills that share T.fill.
    // Off by default; a popup that drops its pane sets it, and every group in it
    // starts casting like a card in front of the room.
    out += '<div class="hui-plate" style="background:var(--hemma-popup-row-fill, rgba(255,255,255,0.10));'
      + 'border-radius:var(--hemma-popup-row-radius, 20px);overflow:hidden;'
      + 'box-shadow:var(--hemma-popup-plate-shadow, none);'
      + 'backdrop-filter:var(--hemma-popup-plate-backdrop, none);'
      + '-webkit-backdrop-filter:var(--hemma-popup-plate-backdrop, none);">';
    if (label && inside) {
      // 2px under the caption put it right on top of the first row's hover
      // band. The gap has to clear that highlight, not just the text.
      out += '<div style="padding:var(--hemma-popup-row-pad-y, 8px)'
        + ' var(--hemma-popup-row-pad-x, 16px)'
        + ' var(--hemma-popup-group-label-gap, 10px);'
        + 'font-size:15px;font-weight:600;'
        + 'letter-spacing:-0.01em;color:' + T.ink + ';">' + esc(label) + '</div>';
    }
    rows.forEach(function (r, i) {
      // Measured off an iOS grouped list at 3x: the separator is inset ~16px
      // from BOTH edges of the card, not flush to the trailing edge. With an
      // icon the leading inset moves out to where the label starts.
      if (i) {
        // Same inset both sides: clearing the icon on the left reads as
        // off-center rather than as a list rule.
        out += '<div class="hui-div" style="height:1px;background:' + T.div
          + ';margin-left:calc(var(--hemma-popup-row-pad-x, 16px)'
          + ' + var(--hemma-popup-divider-inset, 0px));'
          + 'margin-right:var(--hemma-popup-row-pad-x, 16px);"></div>';
      }

      var arming = !!(r.svc && r.confirm);
      // Two controls, not one: the row opens the device, the action arms the
      // confirm. The delegated handler walks the composed path innermost-first,
      // so the label wins wherever it is tapped.
      var armOnAction = !!(arming && r.entity && r.action);
      var tap = armOnAction
        ? ' data-hemma-mi="' + esc(r.entity) + '"'
        : arming
          ? ' data-hemma-arm=""'
          : (r.svc ? ' data-hemma-svc="' + esc(JSON.stringify(r.svc)) + '"'
                   : (r.entity ? ' data-hemma-mi="' + esc(r.entity) + '"' : ''));
      var tappable = arming || r.svc || r.entity;

      // A brand logo, when the row has one. Both states sit on the same plate,
      // so a row with a logo and a row without still read as one set - which is
      // the thing that goes wrong if you only draw the ones you have.
      var lead;
      if (r.image !== undefined) {
        // 28 in a 32 plate: the logo is the thing, the plate only gives it an
        // edge. At 22-in-29 the container was doing the talking.
        lead = '<div style="width:32px;height:32px;border-radius:9px;flex:none;'
          + 'background:' + T.fill2 + ';display:grid;place-items:center;overflow:hidden;">'
          + (r.image
              ? '<img src="' + esc(r.image) + '" alt="" '
                + 'style="width:28px;height:28px;object-fit:contain;display:block;">'
              : '<ha-icon icon="mdi:package-variant" style="--mdc-icon-size:19px;'
                + 'width:19px;height:19px;color:' + T.ink3 + ';"></ha-icon>')
          + '</div>';
      } else {
        lead = icon(r.icon, r.iconTone);
      }

      out += '<div class="hui-row' + (tappable ? ' hui-tap' : '') + '"' + tap
        + ' style="' + (tappable ? 'cursor:pointer;' : '')
        + 'display:flex;align-items:center;gap:12px;min-height:52px;'
        + 'padding:var(--hemma-popup-row-pad-y, 8px) var(--hemma-popup-row-pad-x, 16px);">'
        + '<div class="hui-inner">'
        + lead
        + '<div style="flex:1;min-width:0;pointer-events:none;">'
        + '<div style="font-size:var(--hemma-popup-row-label-size, 17px);'
        + 'letter-spacing:-0.022em;color:'
        + (tone(r.labelTone) || T.ink) + ';overflow:hidden;'
        + 'text-overflow:ellipsis;white-space:nowrap;">' + esc(r.label) + '</div>';

      if (r.sub) {
        // An array stacks: on a phone "Door closed · 62% battery" does not fit
        // on one line, so each part gets its own.
        var subs = Array.isArray(r.sub) ? r.sub : [r.sub];
        subs.forEach(function (line, si) {
          // subLive rides the first line only: it is the one describing the
          // row's own reading, and the rest are static detail.
          var sLive = '';
          if (si === 0 && r.subLive && r.entity && r.subLive.total) {
            sLive = ' data-hemma-live="share" data-hemma-ent="' + esc(r.entity) + '"'
              + ' data-hemma-total="' + esc(r.subLive.total) + '"'
              + ' data-hemma-suffix="' + esc(r.subLive.suffix || '%') + '"';
          }
          out += '<div class="hui-sub' + (si ? ' hui-sub2' : '') + '"' + sLive
            + ' style="font-size:13px;color:'
            + T.ink3 + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
            + esc(line) + '</div>';
        });
      }
      if (r.bar != null) {
        var bt = tone(r.barTone) || T.ink2;
        var pct = Math.max(0, Math.min(1, r.bar)) * 100;
        // data-hemma-live lets the hass bridge repaint this without the whole
        // popup being rebuilt - the content card is generated once.
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
        // actionLive hands the label to the bridge, which is the only thing
        // that repaints after a popup is built - the content card is generated
        // once and never re-evaluated.
        var aLive = '';
        if (r.actionLive && r.entity) {
          aLive = ' data-hemma-live="act" data-hemma-ent="' + esc(r.entity) + '"'
            + ' data-hemma-act="' + esc(JSON.stringify(r.actionLive)) + '"';
        }
        // Negative margin so the target is finger-sized without the label
        // pushing the row taller than the ones beside it.
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
        out += '<div' + vlive + ' style="font-size:17px;letter-spacing:-0.022em;color:'
          + (tone(r.valueTone) || T.ink2)
          + ';margin-inline-start:var(--hemma-popup-value-gap, 0px)'
          + ';white-space:nowrap;pointer-events:none;">'
          + esc(r.value) + '</div>';
      }
      if (r.entity && (!r.svc || armOnAction)) {
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
      // Nothing fires while a scroll is still settling. _hemmaLastScrollTs was
      // read here before but never assigned anywhere, so this had never once
      // been true; the touch tracking below is what sets it.
      if (Date.now() - (window._hemmaLastScrollTs || 0) < 400) return;
      // Retargeting means ev.target is the outermost host here; composedPath
      // is the only thing that sees the row inside the card's shadow root.
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
        // A media tile opens its detail over the shelf. The popup dismisses on
        // a background tap, so this claims the tap the same way the light
        // popup's pills do - the overlay is opened by script, not by a path the
        // dismiss test could recognize.
        if (t && t.dataset && t.dataset.hemmaMedia !== undefined) {
          if (Date.now() - (window._hemmaUILastTap || 0) < 400) return;
          window._hemmaUILastTap = Date.now();
          window._hemmaSuppressDismiss = Date.now() + 600;
          /* The tile's OWN shelf. Both shelves are custom fields of one card,
             so they share a shadow root - querying it returned the first
             overlay every time, and a TV Shows tile opened the film above it. */
          var shelf = t.closest && t.closest('.hui-mrow');
          var wrapM = shelf && shelf.parentElement;
          var ov = wrapM && wrapM.querySelector && wrapM.querySelector('.hui-mov');
          if (ov) {
            /* position:fixed resolves against the nearest TRANSFORMED ancestor, not
               the viewport, and the sheet has one on a phone - so each shelf's
               overlay landed at its own offset. Measure where it landed and pull
               it back to the screen's origin. */
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
              /* Back sits on the close control's row. Reading the close's own
                 position keeps them together at any breakpoint, rather than
                 restating the sheet's offset and header padding here. */
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
                  /* Back takes the close control's place rather than sitting
                     beside it - two controls stacked in the same corner is the
                     one thing this view must not show. */
                  var bk = ov.querySelector('.hui-mback');
                  var col = ov.querySelector('.hui-movin');
                  if (bk && col) {
                    bk.style.marginLeft = '0px';
                    var br = col.getBoundingClientRect();
                    // May be negative: the popup's gutter is often tighter
                    // than the overlay's own padding.
                    bk.style.marginLeft = (cr.left - br.left) + 'px';
                  }
                  ov._hemmaHidX = cls;
                  cls.style.visibility = 'hidden';
                }
              }
            };
            ov.hidden = false;
            place();
            // Twice: the first pass reveals it, and a sheet that is still
            // settling moves under it.
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
    // A touchend is not a tap. Scrolling a popup with a finger resting on a row
    // ends over that row, and binding touchend directly bypasses the browser's
    // own post-scroll click suppression - so every swipe opened whatever the
    // finger happened to be over. Only a finger that stayed put gets through.
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
      // A finger put down to stop momentum has not moved either - the guard
      // inside fire() is what tells that apart from a real tap.
      if (moved) return;
      fire(ev);
    }, true);

    // Vertical drag. Bottom of the track is 0, top is 100, and the service is
    // called once on release rather than on every frame.
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

  // A horizontally scrolling row of artwork, the way the TV app shows Recently
  // Added. items: [{ image, title, meta, badge, unwatched }]
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

  // The popup's card config is baked when the tile renders, not when it opens,
  // so the artwork can be in cache long before anyone taps.
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

  // Landscape media row: fanart with three caption lines beneath it.
  // items: [{ image, when, title, summary, watched, titleMobile, sub }]
  // titleMobile/sub are the phone's split of a title that reads as one line on
  // a wide shelf - "Show \u00b7 Episode" becomes the show, then S01E02 - Episode.
  function mediaRow(items, label, opts) {
    items = items || [];
    opts = opts || {};
    // Lead-in clears the popup's own 260ms fade / 300ms sheet slide, so the
    // shelf builds inside a surface that has already arrived.
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
      // The cell owns the padding and the row has no gap, so a hover lights art
      // AND caption together. A grid, not a scroller, so nothing hides off the
      // edge. The gutter lives HERE: this card's extra_styles zero ha-card and
      // #container padding with !important, beating any inline value.
      + '.hui-mrow{display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));'
      +   'gap:26px 30px;padding:2px var(--hui-gutter, var(--hemma-popup-gutter, 26px)) 4px;}'
      // Two across still gave each poster about 150px on a phone, which is
      // narrower than the summary needs. One per row instead: the art gets
      // the full width and the caption stops being a column of fragments.
      + '@media (max-width: 900px){.hui-mrow{grid-template-columns:repeat(2, minmax(0, 1fr));}}'
      // One column has no border or plate to separate the items, so the gap is
      // the only grouping cue - it has to beat the 10px under each fanart by
      // enough that the caption reads as belonging to the art above it.
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
      // button-card's container is white-space:nowrap, which collapses the clamp
      // to a single clipped line unless it is overridden here.
      + '.hui-m .s{font-size:14px;line-height:1.42;color:' + T.ink2 + ';margin-top:4px;'
      +   'white-space:normal !important;overflow-wrap:anywhere;'
      +   'display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;'
      +   'overflow:hidden;max-height:calc(1.42em * 5);}'
      // Inset, not flush: at top:0 the fanart's 14px radius clipped the corner
      // off the marker itself. The rim keeps it legible on bright artwork now
      // that the fill is lighter.
      + '.hui-m .ck{position:absolute;top:8px;right:8px;width:26px;height:26px;'
      +   'border-radius:50%;background:rgba(0,0,0,.64);display:grid;'
      +   'place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.30),'
      +   'inset 0 0 0 0.5px rgba(255,255,255,.18);}'
      + '.hui-m .ck svg{width:15px;height:15px;display:block;}'
      // One column is where a cell gets the full width, and where four lines of
      // summary per item turned the sheet into a wall of text. The episode line
      // carries what the summary was standing in for.
      + '@media (max-width: 640px){'
      +   '.hui-m.split .h{display:none;}'
      +   '.hui-m .hm,.hui-m .e{display:block;}'
      +   '.hui-m .s{display:none;}'
      // One column stacks the two shelves into one scroll, so the heading is
      // the only thing saying where Movies stops and TV Shows starts.
      +   '.hui-mlabel{--hui-label-size:24px;--hui-label-gap:10px;'
      +     '--hui-label-weight:700;--hui-label-track:-0.02em;}}'
      // A shelf heading must not outweigh the popup's own title, which is
      // 22px - on a phone 24px read as the larger of the two.
      + '@media (max-width: 640px){.hui-mlabel{--hui-label-size:17px;}}'
      // Entrance. Cells rise on the smart-tile curve and stagger; the caption
      // lines follow with the mobile header's depth motion - a small scale up
      // from a low origin on the sheet spring.
      + '@keyframes hui-m-in{from{opacity:0;transform:translateY(10px) scale(0.986);}'
      +   'to{opacity:1;transform:none;}}'
      // The lines fade against a parent that is itself still fading, so the
      // two multiply - starting at 0.2 keeps the text from double-dipping to
      // invisible and reading as a second, slower entrance.
      + '@keyframes hui-tx-in{from{opacity:0.2;transform:scale(0.972) translateY(5px);}'
      +   'to{opacity:1;transform:none;}}'
      + '.hui-mlabel{font-size:var(--hui-label-size, 17px);'
      +   'font-weight:var(--hui-label-weight, 600);'
      +   'letter-spacing:var(--hui-label-track, -0.01em);color:' + T.ink + ';'
      +   'padding:0 var(--hui-gutter, var(--hemma-popup-gutter, 26px)) var(--hui-label-gap, 10px);'
      +   'transform-origin:0% 40%;'
      +   'animation:hui-tx-in var(--hui-tx-dur, .28s) cubic-bezier(0.32, 0.72, 0, 1) both;'
      +   'animation-delay:var(--hui-d, 0s);}'
      // backwards, not both: a filled `to` keyframe outranks a normal
      // declaration forever, which left .hui-m:hover unable to apply.
      + '.hui-m{animation:hui-m-in var(--hui-cell-dur, .28s) cubic-bezier(0.16, 1, 0.3, 1) backwards;'
      +   'animation-delay:var(--hui-d, 0s);}'
      + '.hui-m .w,.hui-m .h,.hui-m .hm,.hui-m .e,.hui-m .s{transform-origin:0% 40%;'
      +   'animation:hui-tx-in var(--hui-tx-dur, .28s) cubic-bezier(0.32, 0.72, 0, 1) both;}'
      + '.hui-m .w{animation-delay:calc(var(--hui-d, 0s) + .03s);}'
      + '.hui-m .h,.hui-m .hm{animation-delay:calc(var(--hui-d, 0s) + .045s);}'
      + '.hui-m .e,.hui-m .s{animation-delay:calc(var(--hui-d, 0s) + .06s);}'
      // Held back until the bitmap is actually decoded, so a slow fanart
      // dissolves onto its plate instead of popping in over a settled cell.
      + '.hui-m .fa img{opacity:0;transition:opacity .24s ease;}'
      + '.hui-m .fa.rdy img{opacity:1;}'
      + '@media (prefers-reduced-motion:reduce){'
      +   '.hui-mlabel,.hui-m,.hui-m .w,.hui-m .h,.hui-m .hm,.hui-m .e,'
      +   '.hui-m .s{animation:none;}'
      +   '.hui-m .fa img{transition:none;}}'
      + (opts.tiles
          // The art is the tile: it fills the frame, and the caption is set on
          // it over a gradient. Nothing here is a plate.
          ? '.hui-m{position:relative;border-radius:var(--hemma-popup-row-radius, 20px);'
          +   'overflow:hidden;box-shadow:var(--hemma-popup-plate-shadow, none);'
          +   'background:var(--hemma-popup-row-fill, rgba(255,255,255,0.10));}'
          + '.hui-m .fa{position:relative;width:100%;aspect-ratio:16/9;'
          +   'border-radius:0;margin:0;overflow:hidden;}'
          + '.hui-m .fa img{width:100%;height:100%;object-fit:cover;display:block;}'
          + '.hui-m .ph{width:100%;height:100%;display:flex;align-items:center;'
          +   'justify-content:center;color:' + T.ink3 + ';font-size:26px;}'
          // Lower half only, and eased rather than linear so the ramp does not
          // draw a visible band across the middle of the frame.
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
          // The rating is a badge, not a caption - both references put it in
          // the corner where it reads at a glance without fighting the title.
          + '.hui-m .rt{position:absolute;top:10px;left:10px;'
          +   'font-size:12px;font-weight:600;color:#fff;'
          +   'padding:4px 9px;border-radius:999px;'
          +   'background:rgba(0,0,0,0.55);'
          +   'backdrop-filter:var(--hemma-popup-tile-backdrop, none);'
          +   '-webkit-backdrop-filter:var(--hemma-popup-tile-backdrop, none);}'
          + '.hui-m .ck{top:10px;right:10px;}'
          // The same lift a light tile gets: the tile is a thing you can act
          // on, so it answers the pointer like one.
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
          // The overlay covers the shelf and blurs it, so the detail reads as
          // being in front of the row rather than replacing it.
          + '.hui-mov{position:fixed;inset:0;z-index:20;display:grid;'
          +   'align-items:start;justify-items:center;padding:24px;'
          +   'box-sizing:border-box;'
          // Blur only - the darkening read as a scrim on top of the popup's own.
          /* Blur only. The popup's own scrim already saturates what is behind
             it, so saturating again here put the room through it twice. */
          +   'backdrop-filter:blur(18px);'
          +   '-webkit-backdrop-filter:blur(18px);}'
          + '.hui-mov[hidden]{display:none;}'
          /* Leaves the way the scrim does: the frost lifts and the card settles
             back a touch, over one short beat. Dismissing was instant, which
             read as the card being cut rather than closed. */
          + '.hui-mov{transition:opacity .19s ease,'
          +   'backdrop-filter .19s ease,-webkit-backdrop-filter .19s ease;}'
          + '.hui-mov.hui-closing{opacity:0;'
          +   'backdrop-filter:blur(0px);'
          +   '-webkit-backdrop-filter:blur(0px);}'
          + '.hui-mdet{transition:transform .19s cubic-bezier(0.4, 0, 1, 1);}'
          + '.hui-mov.hui-closing .hui-mdet{transform:scale(0.97);}'
          + '.hui-mdet[hidden]{display:none;}'
          /* The card and its Back button are one column, so the control sits
             above the card and on its left edge rather than floating in the
             overlay. Same disc as the filter overlay's back. */
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
          // Its own shadow, far softer than a plate's: the card sits under the
          // header on a phone and a plate shadow read as a clipped edge there.
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
          // white-space inherits too, and the shelf's captions set nowrap:
          // the summary ran off the card on one line instead of wrapping.
          + '.hui-mdet .t,.hui-mdet .s,.hui-mdet .c{white-space:normal;'
          +   'overflow:visible;text-overflow:clip;}'
          + '.hui-mdet .s{overflow-wrap:anywhere;'
          +   'font-size:15px;line-height:1.45;margin-top:14px;'
          +   'color:' + T.ink2 + ';}'
          + '@keyframes hemma-plate-in{'
          +   'from{opacity:0;transform:perspective(900px) translateZ(-70px);}'
          +   'to{opacity:1;transform:perspective(900px) translateZ(0);}}'
          // The tiles arrive together, coming forward - the same depth entrance
          // the plates and the chrome use, so the popup reads as one object
          // rather than a queue. Every delay is zeroed, including the ones the
          // markup stamps per item.
          + '.hui-m{animation:hemma-plate-in var(--hui-cell-dur, .42s) '
          +   'cubic-bezier(0.16, 1, 0.3, 1) backwards;animation-delay:0s;}'
          + '.hui-mlabel{animation-delay:0s;}'
          + '.hui-m,.hui-mrow,.hui-mov{pointer-events:auto;}'
          /* A real column width, not 1fr: a sheet cannot size itself to a shelf
             whose columns are shares of a width it has not decided yet.
             Re-stated after the base rule - a media query carries no extra
             specificity. */
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
    /* Short shelves start at the gutter. Centering moved the tiles away from the
       heading and the close control, which live in different subtrees - so
       nothing could keep the three together. One shared edge, no arithmetic. */
    var nT = items.length;
    out += '<div class="hui-mrow"'
      + (opts.tiles ? ' style="--hui-cols:' + Math.min(nT, 3) + ';"' : '')
      + '>';
    // Tile mode: the art IS the tile. Everything the item says is set over it,
    // on a gradient rather than a plate - a caption plate under the art made
    // each item two objects, and padding the art inside one tile left cover art
    // that does not fill its frame, which reads as a mistake.
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
          // The scrim is the whole point of setting text on artwork: without it
          // a title lands on whatever the frame happens to be and half of them
          // are unreadable. Transparent to near-black over the lower half only.
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
      // The detail lives in the same popup, not a second one: hemma-popup is a
      // singleton, so opening another would replace this shelf rather than sit
      // over it. An overlay inside the popup keeps the shelf behind, blurred,
      // which is what "expands to the center" actually looks like.
      out += '<div class="hui-mov" hidden><div class="hui-movin">'
        // The same back control the filter overlay uses, on the card's left
        // edge rather than floating in the middle of the blur.
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
    // Same plate a row group gets, so a shelf can stand as its own widget in a
    // popup that has dropped its pane. The frost rides this element, never a
    // wrapper around it.
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
      // Content-sized and centered, like more-info's. A cap on a flex:1 1 0
      // pill still filled the row, so the horizontal padding still could not
      // show - the width has to come from the text. Wrap is a safety for a very
      // narrow phone: five presets would rather stack than clip "Close".
      + '.hui-seg{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;}'
      // Pills, and solid enough to read as controls: at the list fill (6%) they
      // were ghosts on a bright photo. They sit under a control, so they are
      // things you press, not a grouped list you read.
      // flex:0 1 auto - sized by its label, allowed to shrink but never to grow.
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

  // A grab-anywhere control, the way Home does blinds: the body is the track,
  // the fill is the value, no thumb.
  // o: { value 0..100, svc, invert, icon, width, height }
  // invert is the blind metaphor - 100 (open) is an EMPTY track and the fill
  // grows down as it closes. The position maths is unchanged; only the fill's
  // anchor moves.
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
      // Flat, not glass: no top highlight and no rim. Consistent with the
      // inactive-tile material rather than the pill one.
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

  // One cover taxonomy, read by both the tile template and the popup, so a
  // blind can never fall back to a curtain glyph in one place and not the other.
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


  /* The recorder keeps 2 days, so the watering CYCLE can only come from
     long-term statistics, which survive the purge; history is the fallback and
     usually only reaches the drying rate. Whatever cannot be established is
     left unsaid rather than guessed. */
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

  /* A watering is a jump upward that a drying curve cannot produce. The decay
     after it gives the rate, and the rate gives the days left. */
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
      // Calendar days, not 24-hour blocks: statistics are hourly, so a watering
      // 23.9 hours ago would otherwise read as "today".
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
        // The condition line above is the verdict, so this says what to DO - a
        // plant can be healthy and due for water at once, and a second judgment
        // reads as the popup contradicting itself. Forecast only: once it is
        // actually due, the line above already says so.
        if (left >= 1 && left < 60) {
          bits.push('dry in about ' + Math.round(left)
            + (Math.round(left) === 1 ? ' day' : ' days'));
        }
      }
    }
    return bits.join(' · ');
  }

  window._hemmaUI = { hero: hero, headline: headline, group: group, legend: legend, note: note, shelf: shelf, mediaRow: mediaRow, segments: segments, slider: slider, icon: icon, esc: esc, prime: prime, plantWater: plantWater, tokens: T, v: 144 };
})();
// ── Notification center ──────────────────────────────────────────────────────
// History comes from the logbook, so a fresh install has a populated bell with
// no automations and no helper to set up. Standing conditions (updates, low
// battery, restart pending) are not events at all and are read live instead.
(function () {
  if (window._hemmaNotify) return;

  var HOURS = 24;
  var MAX_ROWS = 40;
  // Two integrations on one physical lock each report it, so the same line
  // arrives twice a second apart. Collapse identical labels landing close
  // together, whichever entity produced them.
  var DEDUPE_MS = 5 * 60 * 1000;
  // One flapping device must not be able to fill the panel on its own.
  var PER_ENTITY_MAX = 3;
  var POLL_MS = 60000;
  var KEY = 'hemma_notify_read_v1';
  // true: an app-icon badge carrying the number. false: Apple's bell.badge,
  // which is a bare dot drawn into the glyph itself.
  var COUNT_IN_BADGE = true;

  function iconUrl(name) {
    return (typeof window.hemmaIconUrl === 'function')
      ? window.hemmaIconUrl(name) : '/local/hemma/icons/' + name + '.svg';
  }

  function ha() { return document.querySelector('home-assistant'); }
  function hassOf() { var h = ha(); return h && h.hass; }

  function watermark() {
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
    try { localStorage.setItem(KEY, String(ts)); } catch (e) {}
  }

  function nameOf(st) {
    return (st && st.attributes && st.attributes.friendly_name) || (st && st.entity_id) || '';
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

  // ── Catalog ────────────────────────────────────────────────────────────────
  // Which entities are worth a line, and what that line says.

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

  // device_class "running" is add-ons and services on a normal install, never
  // white goods, so an appliance has to be named rather than detected.
  function appliances() {
    var list = window.HEMMA_NOTIFY_APPLIANCES;
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }

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
  function watched(hass) {
    var out = [];
    var appl = appliances();
    Object.keys(hass.states).forEach(function (id) {
      var st = hass.states[id];
      if (id.indexOf('lock.') === 0) return void out.push(id);
      if (id.indexOf('alarm_control_panel.') === 0) return void out.push(id);
      if (id.indexOf('vacuum.') === 0) return void out.push(id);
      if (isDoorbell(id, st)) return void out.push(id);
      if (appl.indexOf(id) !== -1) return void out.push(id);
    });
    return out;
  }

  // entry: a logbook row. prev: that entity's previous state in the window.
  function describe(entry, st, prev) {
    var id = entry.entity_id || '';
    var s = String(entry.state == null ? '' : entry.state);
    var name = entry.name || nameOf(st);

    if (id.indexOf('lock.') === 0) {
      if (s === 'locked') return { label: name + ' locked', icon: 'lock-fill', tone: 'good' };
      if (s === 'unlocked') return { label: name + ' unlocked', icon: 'lock-open-fill', tone: 'warn' };
      if (s === 'jammed') return { label: name + ' jammed', icon: 'exclamation', tone: 'bad' };
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

    if (appliances().indexOf(id) !== -1) {
      if (APPLIANCE_DONE.test(s) && APPLIANCE_BUSY.test(prev || '')) {
        return { label: name + ' finished', icon: 'default', tone: 'good' };
      }
      return null;
    }

    return null;
  }

  // ── Live conditions ────────────────────────────────────────────────────────
  // Not events: these are true right now, and their age is last_changed.

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

    if (updates.length) {
      rows.push({
        id: 'hemma:updates',
        when: newest(updates) || Date.now(),
        label: updates.length === 1
          ? nameOf(updates[0]).replace(/\s+Update$/i, '') + ' update available'
          : updates.length + ' updates available',
        icon: 'updates',
        tone: 'accent',
        entity: updates[0].entity_id,
        opens: 'updates',
      });
    }

    if (restarts.length) {
      rows.push({
        id: 'hemma:restart',
        when: newest(restarts) || Date.now(),
        label: 'Restart pending',
        // What the restart is FOR. The bare integration name read as a stray
        // technical word sitting under a sentence.
        sub: restarts.length === 1
          ? 'Finishes the ' + nameOf(restarts[0]).replace(/\s+Update$/i, '') + ' update'
          : 'Finishes ' + restarts.length + ' updates',
        icon: 'exclamation',
        tone: 'warn',
        entity: restarts[0].entity_id,
        opens: 'updates',
      });
    }

    var lowPct = Number(window.HEMMA_NOTIFY_BATTERY);
    if (!isFinite(lowPct)) lowPct = 20;
    var low = [];
    ids.forEach(function (id) {
      var st = S[id];
      if (id.indexOf('sensor.') === 0 && dc(st) === 'battery') {
        var n = parseFloat(st.state);
        if (isFinite(n) && n <= lowPct) low.push({ st: st, pct: n });
      } else if (id.indexOf('binary_sensor.') === 0 && dc(st) === 'battery' && st.state === 'on') {
        low.push({ st: st, pct: null });
      }
    });
    if (low.length) {
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
      });
    }

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
      (entries || []).forEach(function (e) {
        var id = e.entity_id;
        if (!id) return;
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
          entity: id,
        });
      });

      events.sort(function (a, b) { return b.when - a.when; });

      var kept = [];
      var perEntity = {};
      events.forEach(function (e) {
        var n = (perEntity[e.entity] || 0);
        if (n >= PER_ENTITY_MAX) return;
        var dupe = kept.some(function (k) {
          return k.label === e.label && Math.abs(k.when - e.when) < DEDUPE_MS;
        });
        if (dupe) return;
        perEntity[e.entity] = n + 1;
        kept.push(e);
      });

      // Standing conditions are not events and never compete for a slot: they
      // are true right now, which is the whole reason to show them.
      var room = Math.max(0, MAX_ROWS - live.length);
      _rows = live.concat(kept.slice(0, room))
        .sort(function (a, b) { return b.when - a.when; });
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

  // ── Bell badge ─────────────────────────────────────────────────────────────
  // Written into the button rather than rendered by it: a button-card cannot
  // await the logbook, and re-rendering the card to change a number would
  // restart the chrome row's entrance.

  var _bells = [];
  var _lastCount = -1;

  function findBells() {
    var out = [];
    (function walk(root, depth) {
      if (!root || depth > 14 || !root.querySelectorAll) return;
      root.querySelectorAll('.hemma-bell-count').forEach(function (el) {
        if (out.indexOf(el) === -1) out.push(el);
      });
      root.querySelectorAll('*').forEach(function (el) {
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      });
    })(document, 0);
    return out;
  }

  // The walk crosses every shadow root on the page, so it runs only when the
  // cache is actually empty or stale, never on a timer.
  function bells() {
    _bells = _bells.filter(function (el) { return el.isConnected; });
    if (!_bells.length) _bells = findBells();
    return _bells;
  }

  function announce() {
    var n = unread();
    var text = n > 99 ? '99+' : String(n);
    var show = (n > 0 && COUNT_IN_BADGE) ? 'grid' : 'none';
    var src = iconUrl(!COUNT_IN_BADGE && n > 0 ? 'bell-badge' : 'bell');
    bells().forEach(function (el) {
      if (el.textContent !== text) el.textContent = text;
      if (el.style.display !== show) el.style.display = show;
      var glyph = el.parentNode && el.parentNode.querySelector('.hemma-bell');
      if (glyph && glyph.getAttribute('src') !== src) glyph.setAttribute('src', src);
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
        sub: r.sub ? [r.sub, ago(r.when)] : ago(r.when),
        value: r.value || null,
        entity: r.entity || null,
      };
    };

    // labelInside puts the caption on the row inset rather than floating it
    // above a plate, which is what it would be doing with no plate there.
    var opts = { labelInside: true };
    var out = '';
    if (g.fresh.length) out += UI.group(g.fresh.map(toRow), g.old.length ? 'New' : null, null, opts);
    if (g.old.length) out += UI.group(g.old.map(toRow), g.fresh.length ? 'Earlier' : null, null, opts);
    return out;
  }

  // Rows whose tap is not a more-info are retagged in the DOM: group() has no
  // hook for a custom action, but it has already drawn the chevron and the
  // hover, so only the tap target changes hands.
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

  // The card that already knows how to open the Updates popup. Re-firing its
  // own action is the only way to get that popup with its templates evaluated
  // in their own card's context; rebuilding the config here would be a copy
  // that drifts.
  function updatesCard() {
    var out = null;
    (function walk(root, depth) {
      if (!root || out || depth > 14 || !root.querySelectorAll) return;
      root.querySelectorAll('button-card').forEach(function (el) {
        if (out) return;
        var t = el._config && el._config.template;
        var list = Array.isArray(t) ? t : (t ? [t] : []);
        if (list.indexOf('hemma_updates') !== -1
          || list.indexOf('hemma_popup_updates') !== -1) out = el;
      });
      root.querySelectorAll('*').forEach(function (el) {
        if (!out && el.shadowRoot) walk(el.shadowRoot, depth + 1);
      });
    })(document, 0);
    return out;
  }

  function openTarget(what, fallbackEntity) {
    if (what === 'updates') {
      var card = updatesCard();
      var node = card && ((card.shadowRoot && card.shadowRoot.querySelector('ha-card')) || card);
      if (node) {
        ['pointerdown', 'pointerup', 'click'].forEach(function (type) {
          var ev;
          try {
            ev = new PointerEvent(type, { bubbles: true, composed: true, cancelable: true });
          } catch (e) {
            ev = new MouseEvent(type, { bubbles: true, composed: true, cancelable: true });
          }
          node.dispatchEvent(ev);
        });
        return true;
      }
    }
    if (fallbackEntity && window.hemmaPopup) {
      window.hemmaPopup.moreInfo(fallbackEntity);
      return true;
    }
    return false;
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

  // The bell inverts while its panel is up, the same way the waveform and the
  // settings dots do. Fill says active; the geometry never moves.
  function lift(anchor, on) {
    if (!anchor || !anchor.style) return;
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

    // The sheet owns its own dismissal and emits nothing on close, so the seal
    // waits on the attribute it toggles.
    var watch = setInterval(function () {
      if (el && el.hasAttribute('open')) return;
      clearInterval(watch);
      lift(anchor, false);
      seal();
    }, 300);
  }

  var _menu = null;

  function openMenu(anchor) {
    var card = anchor && anchor.shadowRoot && anchor.shadowRoot.querySelector('ha-card');
    var r = (card || anchor).getBoundingClientRect();

    var menu = document.createElement('div');
    _menu = menu;
    lift(anchor, true);
    menu.className = 'hemma-notify-menu';
    menu.setAttribute('role', 'dialog');
    Object.assign(menu.style, {
      position: 'fixed', zIndex: '99999', boxSizing: 'border-box',
      width: 'min(392px, calc(100vw - 24px))',
      padding: '0', borderRadius: '26px',
      // No inner plate: the panel IS the surface, so the rows run to its edge
      // and it clips them to its own radius. A plate inside it was a box in a
      // box, and its square bottom corners cut across the panel's round ones.
      overflow: 'hidden',
      background: 'var(--hemma-popup-pane, rgba(28,28,32,0.72))',
      backdropFilter: 'blur(40px) saturate(170%)',
      WebkitBackdropFilter: 'blur(40px) saturate(170%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16),'
        + ' inset 0 -1px 0 rgba(255,255,255,0.07),'
        + ' 0 18px 48px rgba(0,0,0,0.34)',
      color: '#fff',
      opacity: '0',
      transform: 'scale(0.92) translateY(-8px)',
      transformOrigin: 'top right',
      transition: 'opacity 200ms cubic-bezier(0.32,0.72,0,1),'
        + ' transform 260ms cubic-bezier(0.32,0.72,0,1)',
    });

    var head = document.createElement('div');
    Object.assign(head.style, {
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: '12px', padding: '15px 16px 9px',
      fontFamily: 'var(--primary-font-family, system-ui)',
    });
    var title = document.createElement('div');
    title.textContent = 'Notifications';
    Object.assign(title.style, {
      fontSize: '18px', fontWeight: '600', letterSpacing: '-0.015em',
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
    head.appendChild(title);
    head.appendChild(clear);
    menu.appendChild(head);

    var body = document.createElement('div');
    Object.assign(body.style, {
      maxHeight: 'min(62vh, 560px)', overflowY: 'auto', overscrollBehavior: 'contain',
      paddingBottom: '8px',
    });
    // A cut list ends on the NEXT row's divider, which promises a row that is
    // not there. Dissolving the last few pixels says "more below" instead of
    // drawing a line under nothing, and it holds wherever the cut lands -
    // these rows are not a uniform height, so no max-height can align to them.
    var FADE = 'linear-gradient(to bottom, #000 calc(100% - 26px), transparent 100%)';
    var fade = function () {
      var over = body.scrollHeight - body.clientHeight;
      var atEnd = body.scrollTop >= over - 1;
      var on = over > 4 && !atEnd;
      var v = on ? FADE : '';
      if (body.style.webkitMaskImage !== v) {
        body.style.webkitMaskImage = v;
        body.style.maskImage = v;
      }
    };
    body.addEventListener('scroll', fade, { passive: true });
    // Custom properties never land through Object.assign.
    body.style.setProperty('--hemma-popup-row-fill', 'transparent');
    body.style.setProperty('--hemma-popup-row-radius', '0px');
    body.innerHTML = sections();
    menu.appendChild(body);
    document.body.appendChild(menu);
    fade();
    paint(body);
    bindOpens(body, function () { menu._close(); });

    var w = menu.offsetWidth;
    menu.style.top = Math.round(r.bottom + 10) + 'px';
    menu.style.left = Math.round(
      Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12))
    ) + 'px';
    requestAnimationFrame(function () {
      menu.style.opacity = '1';
      menu.style.transform = 'scale(1) translateY(0)';
    });

    var onKey = function (e) { if (e.key === 'Escape') menu._close(); };
    var onAway = function (e) {
      var path = (e.composedPath && e.composedPath()) || [e.target];
      if (path.indexOf(menu) !== -1) return;
      // contains() cannot cross a shadow boundary, so the bell inside its own
      // card read as "outside" and every tap on it closed and reopened.
      if (anchor && path.indexOf(anchor) !== -1) return;
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        var tag = (n && n.tagName) ? String(n.tagName).toLowerCase() : '';
        // A more-info opened FROM a row is not somewhere else.
        if (tag === 'dialog' || /-dialog$/.test(tag) || tag === 'hemma-popup') return;
      }
      menu._close();
    };
    var idle = setTimeout(function () { menu._close(); }, 20000);

    menu._close = function () {
      if (_menu !== menu) return;
      _menu = null;
      clearTimeout(idle);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onAway, true);
      window.removeEventListener('resize', menu._close);
      lift(anchor, false);
      seal();
      // Out faster than in, and on a curve that starts quickly: a menu that
      // leaves on the same easing it arrived with reads as sluggish.
      menu.style.transition = 'opacity 150ms cubic-bezier(0.4,0,1,1),'
        + ' transform 170ms cubic-bezier(0.4,0,1,1)';
      menu.style.opacity = '0';
      menu.style.transform = 'scale(0.95) translateY(-6px)';
      setTimeout(function () { if (menu.parentNode) menu.remove(); }, 190);
    };

    setTimeout(function () {
      window.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onAway, true);
      window.addEventListener('resize', menu._close);
    }, 0);
  }

  function open(anchor) {
    // Toggling closes SYNCHRONOUSLY. Deciding it after the logbook answered
    // let a second tap open a fresh panel beside the one it should have shut.
    if (_menu) { _menu._close(); return; }
    var pop = window.hemmaPopup && window.hemmaPopup.element;
    if (pop && pop.hasAttribute('open')) { window.hemmaPopup.close(); return; }

    var phone = isPhone();
    var show = function () { if (phone) openSheet(anchor); else openMenu(anchor); };
    // Opening waits on the network only the very first time.
    if (_rows.length) { show(); collect(); } else { collect().then(show); }
  }

  window._hemmaNotify = {
    open: open,
    close: function () { if (_menu) _menu._close(); },
    refresh: collect,
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
