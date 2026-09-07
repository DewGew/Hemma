// Hemma config panel.
// Generator and form schema carried over verbatim from the tested slice.

// Kept in step with manifest.json by harnesses/versioncheck.js - the panel is
// served as a static file and cannot read the manifest at runtime.
const PANEL_VERSION = "2.1.0";
const TEMPLATES_URL = "/hemma_panel/hemma-templates.json";


const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function stable(x) {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stable).join(",") + "]";
  return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + stable(x[k])).join(",") + "}";
}

const omit = (obj, keys) => {
  const out = {};
  Object.keys(obj || {}).forEach((k) => { if (!keys.includes(k)) out[k] = clone(obj[k]); });
  return out;
};

// ─── generator ────────────────────────────────────────────────────────────────

function extractConfig(lovelace) {
  const views = lovelace.views || [];
  if (!views.length) throw new Error("dashboard has no views");

  const first = views[0];
  const scaffold = {
    view_type: first.type,
    layout: clone(first.layout),
    nav: clone((first.cards || [])[1]),
  };
  const navNorm = stable(scaffold.nav);

  const warnings = [];
  const rooms = [];

  views.forEach((v) => {
    const cards = v.cards || [];
    if (cards.length < 3) {
      warnings.push(`view "${v.path}" has ${cards.length} cards, expected at least 3 - skipped`);
      return;
    }
    if (cards.length > 3) {
      warnings.push(`view "${v.path}" has ${cards.length - 3} extra card(s) after the smart row - preserved as-is`);
    }
    const [hero, nav, row] = cards;
    if (hero.template !== "hemma_room") warnings.push(`view "${v.path}" card[0] template is ${hero.template}`);
    if (stable(nav) !== navNorm) warnings.push(`view "${v.path}" nav stack differs from view[0]`);
    if (row.type !== "custom:hemma-smart-row") warnings.push(`view "${v.path}" card[2] is ${row.type}`);

    rooms.push({
      title: v.title,
      path: v.path,
      name: hero.name,
      variables: clone(hero.variables) || {},
      tiles: clone(row.cards) || [],
      _hero: omit(hero, ["name", "variables"]),
      _row: omit(row, ["cards"]),
      _view: omit(v, ["type", "layout", "title", "path", "cards"]),
      _extraCards: clone(cards.slice(3)),
    });
  });

  return {
    compact: { rooms },
    scaffold,
    extras: omit(lovelace, ["views", "button_card_templates"]),
    templates: lovelace.button_card_templates,
    warnings,
    surface: "desktop",
  };
}

function expandConfig(compact, scaffold, extras, templates) {
  const views = (compact.rooms || []).map((room) => ({
    type: scaffold.view_type,
    title: room.title,
    path: room.path,
    layout: clone(scaffold.layout),
    ...clone(room._view),
    cards: [
      { ...clone(room._hero), name: room.name, variables: clone(room.variables) },
      clone(scaffold.nav),
      { ...clone(room._row), cards: clone(room.tiles) },
      ...(clone(room._extraCards) || []),
    ],
  }));

  const out = clone(extras) || {};
  if (templates) out.button_card_templates = templates;
  out.views = views;
  return out;
}

// ─── mobile generator ─────────────────────────────────────────────────────────
// A phone "room" has no container: a header card, the nested smart row after it,
// a filter overlay whose `room:` matches the header, and a `room_chips` entry.
// Only the first two are structure, so that pair is what the extractor reads.

const MOBILE_SHELL = "hemma_mobile_bg";
const MOBILE_HEADER = "hemma_mobile_header";
const SMART_ROW = "custom:hemma-smart-row";

// A declaration, not a const: the harnesses eval the generator slice out of
// this file, and only declarations survive that into the calling scope.
function isMobileConfig(lovelace) {
  return ((((lovelace || {}).views || [])[0] || {}).cards || [])
    .some((c) => (c || {}).template === MOBILE_SHELL);
}

// Absent and empty are different: a header with no `variables` must come back
// with no `variables`, or the round trip fails on a key it invented.
const put = (obj, key, val) => { if (val !== undefined) obj[key] = val; return obj; };

function extractMobileConfig(lovelace) {
  const views = lovelace.views || [];
  if (!views.length) throw new Error("dashboard has no views");

  const first = views[0];
  const cards = first.cards || [];
  const warnings = [];

  const outer = cards[1];
  if (!outer || outer.type !== SMART_ROW) {
    throw new Error(`mobile view "${first.path}" card[1] is ${
      outer ? outer.type || outer.template : "missing"}, expected ${SMART_ROW}`);
  }
  if (views.length > 1) {
    warnings.push(`${views.length - 1} view(s) after the first - preserved as-is`);
  }
  if (cards.length > 2) {
    warnings.push(`view "${first.path}" has ${cards.length - 2} card(s) after the smart row - preserved as-is`);
  }

  const scaffold = {
    view_type: first.type,
    layout: clone(first.layout),
    shell: clone(cards[0]),
    row: omit(outer, ["cards"]),
  };

  // One pass, in order. A header followed by a smart row is a room; anything
  // else is chrome and keeps its place by index. The Scenes header is chrome
  // by this rule and correctly so - a scene row follows it, not tiles.
  const kids = outer.cards || [];
  const rooms = [];
  const items = [];

  for (let i = 0; i < kids.length; i++) {
    const card = kids[i] || {};
    const next = kids[i + 1];
    if (card.template === MOBILE_HEADER && next && next.type === SMART_ROW) {
      const room = { tiles: clone(next.cards) || [], variables: clone(card.variables) || {} };
      put(room, "name", clone(card.name));
      room._header = omit(card, ["name", "variables"]);
      room._row = omit(next, ["cards"]);
      rooms.push(room);
      items.push({ room: rooms.length - 1 });
      i++;
      continue;
    }
    // A header with no row after it is not a mistake: Scenes is one, and its
    // scene row is a card in its own right. Headers label sections, not tiles.
    items.push({ card: clone(card) });
  }

  if (!rooms.length) warnings.push(`view "${first.path}" has no header + smart row pair - skipped`);

  return {
    compact: { rooms },
    scaffold,
    extras: omit(lovelace, ["views", "button_card_templates"]),
    templates: lovelace.button_card_templates,
    warnings,
    surface: "mobile",
    chrome: { items, view: omit(first, ["type", "layout", "cards"]), extraCards: clone(cards.slice(2)), extraViews: clone(views.slice(1)) },
  };
}

function expandMobileConfig(compact, scaffold, extras, templates, chrome) {
  const rooms = compact.rooms || [];
  const kids = [];

  (chrome.items || []).forEach((item) => {
    if (item.card !== undefined) { kids.push(clone(item.card)); return; }
    const room = rooms[item.room];
    if (!room) return;
    const header = clone(room._header) || {};
    put(header, "name", clone(room.name));
    // Empty means the header never had one. Writing `variables: {}` back would
    // invent a key the file did not carry and fail the round trip.
    const hv = clone(room.variables);
    if (hv && Object.keys(hv).length) header.variables = hv;
    kids.push(header);
    kids.push({ ...clone(room._row), cards: clone(room.tiles) });
  });

  const view = {
    type: scaffold.view_type,
    ...clone(chrome.view),
    layout: clone(scaffold.layout),
    cards: [
      clone(scaffold.shell),
      { ...clone(scaffold.row), cards: kids },
      ...(clone(chrome.extraCards) || []),
    ],
  };

  const out = clone(extras) || {};
  if (templates) out.button_card_templates = templates;
  out.views = [view, ...(clone(chrome.extraViews) || [])];
  return out;
}

// ─── building a phone dashboard ───────────────────────────────────────────────
// Chrome comes from the shipped example verbatim; only the three room-derived
// things are made fresh, since each carries a name a new dashboard does not
// share. YOUR_* placeholders are dropped or the dashboard draws broken badges.
const FILTER_OVERLAY = "custom:hemma-filter-overlay";
const MOBILE_CHIPS = "hemma_mobile_sensor_chips";
const MOBILE_FAVORITES = "Favorites";

// The six the phone's filter row offers, in the order it offers them. The badge
// model can describe more than this; the filter row is only ever these.
const PHONE_FILTERS = ["climate", "lights", "people", "media", "security", "energy"];

// The badge pills, in the order the dashboards draw them with no badge_order
// set. Same six the phone filters by, and the ids badge_order is written in.
const BADGE_ORDER_IDS = ["climate", "lights", "people", "media", "security", "energy"];

// hemma-core's HEMMA_FILTER_CATEGORIES, which is what the row itself filters on.
// A tile states its category outright with mobile_filter_category; otherwise its
// template decides, and a template that names none is never filtered in.
const FILTER_CATEGORIES = {
  hemma_thermostat: "climate",
  hemma_air_purifier: "climate",
  hemma_cover: "climate",
  hemma_fan: "climate",
  hemma_humidifier: "climate",
  hemma_light: "lights",
  hemma_media: "media",
  hemma_energy: "energy",
  hemma_lock: "security",
  hemma_camera: "security",
  hemma_doorbell: "security",
  hemma_cameras: "security",
  hemma_vacuum: "unfiltered",
  hemma_plant: "unfiltered",
};

const tileCategory = (tile) => {
  const direct = (tile.variables || {}).mobile_filter_category;
  if (direct !== null && direct !== undefined) return direct;
  const t = tile.template;
  const list = Array.isArray(t) ? t : (t ? [t] : []);
  for (const name of list) {
    if (Object.prototype.hasOwnProperty.call(FILTER_CATEGORIES, name)) {
      return FILTER_CATEGORIES[name];
    }
  }
  return null;
};

// hemma_mobile_header strips every non-alphanumeric rather than hyphenating, so
// "Living Room" is room_livingroom. The panel's own slug() hyphenates; using it
// here would key the chips map to something the header never looks up.
const roomKeyOf = (name) =>
  "room_" + String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const dropPlaceholders = (val) => {
  if (typeof val === "string") return val.indexOf("YOUR_") === -1 ? val : undefined;
  if (Array.isArray(val)) {
    const out = val.map(dropPlaceholders).filter((x) => x !== undefined);
    return out.length ? out : undefined;
  }
  if (val && typeof val === "object") {
    const out = {};
    Object.keys(val).forEach((k) => {
      const v = dropPlaceholders(val[k]);
      if (v !== undefined) out[k] = v;
    });
    return Object.keys(out).length ? out : undefined;
  }
  return val;
};

// Structure kept, sample content gone. A nested card whose own entity is a
// sample is DROPPED, not stripped: a stripped one still draws, pointing at
// nothing. Sample entities also hide under `sections`, not just `variables`.
const isSample = (v) => typeof v === "string" && v.indexOf("YOUR_") !== -1;

const pruneSampleCards = (val) => {
  if (Array.isArray(val)) {
    return val.filter((x) => !(x && typeof x === "object" && isSample(x.entity)))
      .map(pruneSampleCards);
  }
  if (val && typeof val === "object") {
    const out = {};
    Object.keys(val).forEach((k) => { out[k] = pruneSampleCards(val[k]); });
    return out;
  }
  return val;
};

const blankChrome = (card) => {
  const out = dropPlaceholders(pruneSampleCards(clone(card)));
  return out === undefined ? clone(card) : out;
};

function blankMobileState(mobile, names) {
  const kids = clone(mobile.children) || [];
  const isHeader = (c) => (c || {}).template === MOBILE_HEADER;
  const isRow = (c) => (c || {}).type === SMART_ROW;
  const isRoomOverlay = (c) =>
    (c || {}).type === FILTER_OVERLAY && (c || {}).room !== undefined;

  let hdrProto = null, rowProto = null, hdrVars = null, ovProto = null;
  let firstPair = -1, firstOverlay = -1, chipsAt = -1;
  kids.forEach((c, i) => {
    if (isHeader(c) && isRow(kids[i + 1])) {
      if (firstPair < 0) {
        firstPair = i;
        hdrProto = omit(c, ["name", "variables"]);
        rowProto = omit(kids[i + 1], ["cards"]);
      }
      if (!hdrVars && c.name !== MOBILE_FAVORITES && c.variables) hdrVars = clone(c.variables);
    }
    if (isRoomOverlay(c) && firstOverlay < 0) { firstOverlay = i; ovProto = omit(c, ["room"]); }
    if ((c || {}).template === MOBILE_CHIPS && chipsAt < 0) chipsAt = i;
  });
  if (firstPair < 0) throw new Error("the bundled mobile example has no section to copy");

  const isRoom = (n) => n !== MOBILE_FAVORITES;

  const rooms = names.map((n) => {
    const r = { tiles: [], _header: clone(hdrProto), _row: clone(rowProto) };
    put(r, "name", n);
    if (isRoom(n) && hdrVars) r.variables = clone(hdrVars);
    return r;
  });

  const chips = {};
  names.filter(isRoom).forEach((n) => { chips[roomKeyOf(n)] = {}; });

  const skip = new Set();
  kids.forEach((c, i) => {
    if (isHeader(c) && isRow(kids[i + 1])) { skip.add(i); skip.add(i + 1); }
    if (isRoomOverlay(c)) skip.add(i);
  });

  const overlays = () => names.filter(isRoom)
    .map((n) => ({ card: { ...clone(ovProto), room: n } }));

  const items = [];
  kids.forEach((c, i) => {
    // The overlays sit where the example put them; with none to copy they go
    // immediately before the first section, which is where they read.
    if (ovProto && (i === firstOverlay || (firstOverlay < 0 && i === firstPair))) {
      overlays().forEach((o) => items.push(o));
    }
    if (i === firstPair) rooms.forEach((_, n) => items.push({ room: n }));
    if (skip.has(i)) return;
    const card = blankChrome(c);
    if (i === chipsAt && Object.keys(chips).length) {
      card.variables = { ...(card.variables || {}), room_chips: chips };
    }
    items.push({ card });
  });

  return {
    compact: { rooms },
    scaffold: {
      view_type: mobile.view_type,
      layout: clone(mobile.layout),
      shell: clone(mobile.shell),
      row: clone(mobile.row),
    },
    surface: "mobile",
    chrome: { items, view: { title: "Home", path: "home" }, extraCards: [], extraViews: [] },
  };
}

// The two halves share a vocabulary, so a chrome card is filled by asking its
// template which variables it declares. Only the sub badge row needs a table:
// it reads the same sensors under names of its own.
const CHIPS_FROM_ROOM = {
  temp_entity: "temp_sensor_1",
  humidity_entity: "humidity_sensor",
  entity_quality: "quality_sensor",
};
const CHIPS_AQI_FROM_ROOM = ["aqi_entity_pm25", "aqi_entity_pm10",
  "aqi_entity_voc", "aqi_entity_co2"];

function seedChrome(card, templates, src) {
  const t = (card || {}).template;
  const decl = typeof t === "string" && templates && templates[t]
    ? templates[t].variables : null;
  if (!decl) return card;
  const out = clone(card);
  const vars = { ...(out.variables || {}) };
  // Mirror exactly: CLEAR where the room does not set it, or the example's own
  // value survives and the pair disagrees from birth.
  const roomDecl = ((templates || {}).hemma_room || {}).variables || {};
  Object.keys(decl).forEach((k) => {
    const shared = Object.prototype.hasOwnProperty.call(roomDecl, k);
    const v = src[k];
    if (v !== undefined && v !== null && v !== "") vars[k] = clone(v);
    else if (shared) delete vars[k];
  });
  if (t === MOBILE_CHIPS) {
    Object.keys(CHIPS_FROM_ROOM).forEach((k) => {
      const v = src[CHIPS_FROM_ROOM[k]];
      if (v !== undefined && v !== null) vars[k] = clone(v);
    });
    const aqi = CHIPS_AQI_FROM_ROOM.map((k) => src[k]).filter(Boolean);
    if (aqi.length) vars.aqi_sensors = aqi;
  }
  if (Object.keys(vars).length) out.variables = vars; else delete out.variables;
  return out;
}

// The overview room becomes Favorites; every other room becomes a section. The
// tile vocabulary is identical across the two, so tiles carry over as they are.
function mobileFromRooms(mobile, templates, rooms) {
  const list = rooms || [];
  const home = list.find((r) => r.path === "home") || list[0] || {};
  const others = list.filter((r) => r !== home);
  const names = [MOBILE_FAVORITES].concat(others.map((r) => r.name || r.path));
  const st = blankMobileState(mobile, names);
  if (st.compact.rooms[0]) st.compact.rooms[0].tiles = clone(home.tiles) || [];
  others.forEach((r, i) => {
    if (st.compact.rooms[i + 1]) st.compact.rooms[i + 1].tiles = clone(r.tiles) || [];
  });
  const src = home.variables || {};
  st.chrome.items = st.chrome.items.map((it) => (it.card !== undefined
    ? { card: seedChrome(it.card, templates, src) } : it));
  // The overview room's photo becomes the phone's single hero. Its rooms are
  // sections of one view, so there is nowhere for a second one to go.
  st.scaffold.shell = seedChrome(st.scaffold.shell, templates, src);
  return st;
}

// A sibling is the same stem plus -mobile, never just any mobile dashboard.
// A declaration, not a const arrow: harnesses eval this slice.
function mobilePathOf(url_path) {
  return String(url_path || "").replace(/[-_]mobile$/i, "") + "-mobile";
}

// Which generator a dashboard belongs to is decided once, on load, and rides on
// the state as `surface`. Save must not sniff the config again: by then it is
// holding edits, and a second guess could route them to the other expander.
function extractAny(lovelace) {
  return isMobileConfig(lovelace) ? extractMobileConfig(lovelace) : extractConfig(lovelace);
}

function expandAny(state, parts) {
  const p = parts || {};
  const compact = p.compact || state.compact;
  const scaffold = p.scaffold || state.scaffold;
  const extras = p.extras || state.extras;
  const templates = p.templates !== undefined ? p.templates : state.templates;
  return state.surface === "mobile"
    ? expandMobileConfig(compact, scaffold, extras, templates, state.chrome)
    : expandConfig(compact, scaffold, extras, templates);
}

// ─── the pair ─────────────────────────────────────────────────────────────────
// Each half keeps its own config; the pair adds single entry, routed off the
// bundle. The wide half holds badge sources per ROOM, the phone one set for the
// whole dashboard - which is why the overview room becomes Favorites.

// Which mobile cards read a key. EVERY one gets written: media_player_1 is read
// by the badge row and by Now Playing, and writing one is how they drift.
function mobileTargetsFor(key, templates) {
  const out = [];
  Object.keys(templates || {}).forEach((name) => {
    if (name.indexOf("hemma_mobile_") !== 0 && name !== "hemma_scene_row") return;
    const decl = (templates[name] || {}).variables;
    if (decl && Object.prototype.hasOwnProperty.call(decl, key)) out.push(name);
  });
  return out;
}

// The chips row reads three of the same sensors under names of its own, so a
// shared key has an alias there. Inverted from the seeding table so both
// directions come from one declaration.
const CHIPS_ALIAS_OF = (() => {
  const out = {};
  Object.keys(CHIPS_FROM_ROOM).forEach((mobileKey) => {
    out[CHIPS_FROM_ROOM[mobileKey]] = mobileKey;
  });
  return out;
})();

const sameRoomName = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Which mobile section a wide room corresponds to. The overview room pairs with
// Favorites by position, not by name - nothing is called both.
function linkPair(dstate, mstate) {
  const rooms = (dstate.compact || {}).rooms || [];
  const sections = (mstate.compact || {}).rooms || [];
  const usedSection = new Set();
  const links = rooms.map((r, i) => {
    const overview = r.path === "home" || i === 0;
    let at = -1;
    if (overview) {
      at = sections.findIndex((sc, n) => !usedSection.has(n) && sc.name === MOBILE_FAVORITES);
    }
    if (at < 0) {
      at = sections.findIndex((sc, n) => !usedSection.has(n) && sameRoomName(sc.name, r.name));
    }
    if (at >= 0) usedSection.add(at);
    return { room: i, section: at < 0 ? null : at, overview };
  });
  const orphanSections = sections
    .map((sc, n) => (usedSection.has(n) ? null : { section: n, name: sc.name }))
    .filter(Boolean);
  const orphanRooms = links.filter((l) => l.section === null)
    .map((l) => ({ room: l.room, name: rooms[l.room].name }));
  return { links, orphanRooms, orphanSections };
}

// Every mobile card that holds `key`, as live references into the state, so a
// write lands in the config the expander will read.
function mobileHoldersOf(mstate, key, templates) {
  const wanted = mobileTargetsFor(key, templates);
  const alias = CHIPS_ALIAS_OF[key];
  if (alias) wanted.push(MOBILE_CHIPS);
  const out = [];
  const take = (card) => {
    if (!card || typeof card.template !== "string") return;
    if (wanted.indexOf(card.template) === -1) return;
    out.push({ card, key: card.template === MOBILE_CHIPS && alias ? alias : key });
  };
  (((mstate.chrome || {}).items) || []).forEach((it) => take(it.card));
  // The background card is the view's shell, not one of the row's children, so
  // it is not in chrome.items. Without this the hero photo is the one shared
  // setting a write could never reach.
  take((mstate.scaffold || {}).shell);
  return out;
}

// What the two halves say about one key. Absent is not a value: a key the phone
// simply does not carry is not a disagreement, it is a key with one home.
function pairValues(pair, roomIdx, key) {
  const room = ((pair.desktop.compact || {}).rooms || [])[roomIdx];
  const link = pair.link.links[roomIdx];
  const out = { desktop: room ? (room.variables || {})[key] : undefined, mobile: [] };
  if (!link || link.section === null || !link.overview) return out;
  mobileHoldersOf(pair.mobile, key, pair.templates).forEach((h) => {
    out.mobile.push({ template: h.card.template, key: h.key, value: (h.card.variables || {})[h.key] });
  });
  return out;
}

const emptyVal = (v) => v === undefined || v === null || v === ""
  || (Array.isArray(v) && !v.length);

// The phone side of a shared write, on its own so the form and pairWrite cannot
// drift apart: the form has already written the wide room by the time it gets
// here, and calling pairWrite would write that room twice.
function pairWriteMobile(pair, roomIdx, key, value) {
  const link = (pair.link.links || [])[roomIdx];
  if (!link || link.section === null || !link.overview) return 0;
  let n = 0;
  mobileHoldersOf(pair.mobile, key, pair.templates).forEach((h) => {
    h.card.variables = h.card.variables || {};
    if (emptyVal(value)) delete h.card.variables[h.key];
    else h.card.variables[h.key] = clone(value);
    if (!Object.keys(h.card.variables).length) delete h.card.variables;
    n++;
  });
  return n;
}

// Set a shared field once. Returns how many places took it, so the caller can
// say so rather than claiming a write it did not make.
function pairWrite(pair, roomIdx, key, value) {
  const room = ((pair.desktop.compact || {}).rooms || [])[roomIdx];
  let n = 0;
  if (room) {
    room.variables = room.variables || {};
    if (emptyVal(value)) delete room.variables[key];
    else room.variables[key] = clone(value);
    n++;
  }
  return n + pairWriteMobile(pair, roomIdx, key, value);
}

// Every key both halves can hold. Walking this rather than the values actually
// set is what catches the commonest drift of all: a source filled in on one
// dashboard and never on the other.
function sharedKeys(templates, editable) {
  const room = ((templates || {}).hemma_room || {}).variables || {};
  return Object.keys(room).filter((k) => {
    // Only what the panel can edit. hemma_room declares 152 variables and many
    // are internal, so reporting them offers a choice with no control behind it.
    if (editable && !editable.has(k)) return false;
    return mobileTargetsFor(k, templates).length > 0 || CHIPS_ALIAS_OF[k] !== undefined;
  });
}

const isSet = (v) => v !== undefined && v !== null && v !== "";

// Where the two already disagree, for a pair set up by hand twice. `differs` is
// a contradiction; the two `only` kinds are a gap. A key neither half sets is
// not reported.
function pairConflicts(pair) {
  const out = [];
  const keys = sharedKeys(pair.templates, pair.editable);
  (((pair.desktop.compact || {}).rooms) || []).forEach((room, i) => {
    const link = pair.link.links[i];
    if (!link || link.section === null || !link.overview) return;
    keys.forEach((key) => {
      const dv = (room.variables || {})[key];
      mobileHoldersOf(pair.mobile, key, pair.templates).forEach((h) => {
        const mv = (h.card.variables || {})[h.key];
        if (!isSet(dv) && !isSet(mv)) return;
        if (isSet(dv) && isSet(mv) && stable(dv) === stable(mv)) return;
        const kind = isSet(dv) && isSet(mv) ? "differs"
          : isSet(dv) ? "onlyDesktop" : "onlyMobile";
        out.push({ room: i, roomName: room.name, key, kind,
          mobileKey: h.key, template: h.card.template, desktop: dv, mobile: mv });
      });
    });
  });
  return out;
}

// Phone-only tile keys a sync must not wipe. `size` is NOT one: it is inert on
// a wide tile, and setting it in one place is the point.
const MOBILE_ONLY_TILE_KEYS = ["mobile_filter_category"];

// A declaration, like isMobileConfig and mobilePathOf: the harnesses eval this
// slice and const arrows do not survive into the calling scope.
function tileTwinKey(t) {
  return stable([t.template, t.entity || ""]);
}

// Matched by template AND entity, never by position. A wide tile with no twin is
// COPIED, a phone tile with no twin REMOVED. Exceptions: hemma_derived is left
// alone, and a tile with no entity does not cross - two unconfigured tiles of
// one type share a twin key.
// Desktop expands the Security badge into sub badges; the phone filters to
// TILES, so a camera has no path there unless one is made. Derived like the
// People cards, into the camera's own area or else the first section.
function syncCamerasMobile(pair, hass) {
  const rooms = ((pair.desktop || {}).compact || {}).rooms || [];
  const home = rooms.find((r) => r.path === "home") || rooms[0];
  const V = (home && home.variables) || {};
  const sections = ((pair.mobile || {}).compact || {}).rooms || [];
  if (!sections.length) return 0;

  const cams = (Array.isArray(V.security_cameras) ? V.security_cameras : [])
    .filter(Boolean);

  // Only ever the one this made. A camera tile someone placed by hand is
  // theirs, and is left exactly where they put it.
  let owned = null, ownedSec = null;
  sections.forEach((sec) => {
    (sec.tiles || []).forEach((t) => {
      if (t && t.variables && t.variables.hemma_derived === "cameras") {
        owned = t; ownedSec = sec;
      }
    });
  });
  const byHand = sections.some((sec) => (sec.tiles || []).some((t) =>
    t && t.template === "hemma_cameras"
    && !(t.variables && t.variables.hemma_derived === "cameras")));

  if (!cams.length || V.show_security === false || byHand) {
    if (owned && ownedSec) {
      ownedSec.tiles = (ownedSec.tiles || []).filter((t) => t !== owned);
    }
    return 0;
  }

  if (owned) {
    // Keep it in step rather than rebuilding it: the object identity is what
    // the preview keys its tiles on.
    owned.entity = cams[0];
    owned.variables.cameras = cams.slice();
    return cams.length;
  }

  const area = hemmaAreaOf(hass, cams[0]);
  const target = sections.find((sec) => sameRoomName(sec.name, area)) || sections[0];
  target.tiles = target.tiles || [];
  target.tiles.push({
    type: "custom:button-card",
    template: "hemma_cameras",
    entity: cams[0],
    name: "Cameras",
    variables: { cameras: cams.slice(), hemma_derived: "cameras" },
  });
  return cams.length;
}

// The area an entity belongs to, by way of its device when it has no area of
// its own. Same walk _miniModel does for the light group's name.
function hemmaAreaOf(hass, id) {
  const H = hass || {};
  const reg = (H.entities || {})[id];
  if (!reg) return null;
  const aid = reg.area_id
    || (reg.device_id ? ((H.devices || {})[reg.device_id] || {}).area_id : null);
  return aid ? (((H.areas || {})[aid] || {}).name || null) : null;
}

// The wide half puts Scenes on a nav route; the phone has no nav, so it gets an
// overlay, a header and the row. None are in the shipped example, so they are
// made here. The row is written bare: applyScenePick puts the scene list on the
// hemma_scene_row TEMPLATE at save, and a copy on the card would drift.
function syncScenesMobile(pair, on) {
  const chrome = (pair.mobile || {}).chrome;
  if (!chrome || !Array.isArray(chrome.items)) return 0;
  const items = chrome.items;
  const isCard = (it, test) => it && it.card && test(it.card);
  const findIdx = (test) => items.findIndex((it) => isCard(it, test));

  const overlayAt = findIdx((c) => c.type === FILTER_OVERLAY && c.room === "Scenes");
  const headerAt = findIdx((c) => c.template === MOBILE_HEADER && c.name === "Scenes");
  const rowAt = findIdx((c) => c.template === "hemma_scene_row");

  if (!on) {
    // Highest index first, or removing one shifts the next.
    [overlayAt, headerAt, rowAt].filter((i) => i >= 0)
      .sort((a, b) => b - a)
      .forEach((i) => items.splice(i, 1));
    return 0;
  }

  // The overlay joins the others, so the whole set stays together.
  if (overlayAt < 0) {
    let last = -1;
    items.forEach((it, i) => { if (isCard(it, (c) => c.type === FILTER_OVERLAY)) last = i; });
    items.splice(last + 1, 0, { card: { type: FILTER_OVERLAY, room: "Scenes" } });
  }

  // Header and row go ahead of the first section, which is where the phone
  // shows them: above Favorites, not buried under the rooms.
  if (headerAt < 0 || rowAt < 0) {
    if (rowAt >= 0) items.splice(rowAt, 1);
    if (headerAt >= 0) items.splice(headerAt, 1);
    let firstRoom = items.findIndex((it) => it && it.room !== undefined);
    if (firstRoom < 0) firstRoom = items.length;
    items.splice(firstRoom, 0,
      { card: { type: "custom:button-card", template: MOBILE_HEADER, name: "Scenes" } },
      { card: { type: "custom:button-card", template: "hemma_scene_row" } });
  }
  return 1;
}

// Presence does not filter tiles - no tile carries the category, and
// filter-overlay skips sub badges for it. The popup carries its OWN cards, one
// per person, derived from the wide half's presence_entity_*.
function syncPresenceOverlay(pair) {
  const rooms = ((pair.desktop || {}).compact || {}).rooms || [];
  const home = rooms.find((r) => r.path === "home") || rooms[0];
  const V = (home && home.variables) || {};
  const items = ((pair.mobile || {}).chrome || {}).items || [];
  const entry = items.find((it) => it.card
    && it.card.type === FILTER_OVERLAY
    && it.card.filter_category === "presence");
  if (!entry) return 0;

  const people = [1, 2, 3, 4]
    .map((n) => V["presence_entity_" + n])
    .filter(Boolean);

  if (V.show_people === false || !people.length) {
    delete entry.card.sections;
    return 0;
  }
  entry.card.sections = [{
    cards: people.map((id) => ({
      type: "custom:button-card",
      template: "hemma_presence",
      entity: id,
      // person_name is left off on purpose: the template derives it from the
      // entity's friendly name, so a rename in HA follows without a re-save.
      variables: { person_entity: id },
    })),
  }];
  return people.length;
}

function syncPairTiles(pair) {
  const rooms = (pair.desktop.compact || {}).rooms || [];
  const sections = (pair.mobile.compact || {}).rooms || [];
  let synced = 0;
  let added = 0;
  let dropped = 0;
  const unmatched = [];
  (pair.link.links || []).forEach((link) => {
    if (link.section === null) return;
    const room = rooms[link.room];
    const sec = sections[link.section];
    if (!room || !sec) return;
    const byKey = new Map();
    (room.tiles || []).forEach((t) => { if (t) byKey.set(tileTwinKey(t), t); });
    const onPhone = new Set();
    (sec.tiles || []).forEach((mt) => {
      if (!mt) return;
      onPhone.add(tileTwinKey(mt));
      const twin = byKey.get(tileTwinKey(mt));
      if (!twin) { unmatched.push({ section: sec.name, tile: mt.name || mt.entity || "?" }); return; }
      const keep = {};
      MOBILE_ONLY_TILE_KEYS.forEach((k) => {
        if (mt.variables && mt.variables[k] !== undefined) keep[k] = clone(mt.variables[k]);
      });
      const next = { ...clone(twin.variables || {}), ...keep };
      if (Object.keys(next).length) mt.variables = next; else delete mt.variables;
      if (twin.name !== undefined) mt.name = twin.name; else delete mt.name;
      synced++;
    });

    // Anything on the wide side the phone has not got. In the room's own order,
    // appended - the phone sorts itself anyway when Smart Sort is on, and where
    // it is off, the order set on the wide half is the one that was meant.
    (room.tiles || []).forEach((t) => {
      if (!t || !t.entity) return;
      const key = tileTwinKey(t);
      if (onPhone.has(key)) return;
      onPhone.add(key);
      sec.tiles = sec.tiles || [];
      sec.tiles.push(clone(t));
      added++;
    });

    // And anything the phone has that the wide half does not. A tile deleted
    // before _removePairTwin existed, or deleted outside the panel, is an
    // orphan nothing can reach - it stays on the phone dashboard for good
    // otherwise. Hemma's own additions carry hemma_derived and are kept.
    const before = (sec.tiles || []).length;
    sec.tiles = (sec.tiles || []).filter((mt) => {
      if (!mt) return false;
      if (mt.variables && mt.variables.hemma_derived) return true;
      return byKey.has(tileTwinKey(mt));
    });
    dropped += before - sec.tiles.length;
  });
  return { synced, added, dropped, unmatched };
}

function extractPair(desktopCfg, mobileCfg, templates, editable) {
  const desktop = extractConfig(desktopCfg);
  const mobile = extractMobileConfig(mobileCfg);
  const pair = {
    surface: "pair",
    desktop, mobile,
    templates: templates || desktopCfg.button_card_templates || {},
    editable: editable || null,
    warnings: desktop.warnings.concat(mobile.warnings),
  };
  pair.link = linkPair(desktop, mobile);
  pair.conflicts = pairConflicts(pair);
  return pair;
}

// Both halves, each rebuilt by its own expander. Neither is derived from the
// other, so a round trip check still means what it meant per dashboard.
function expandPair(pair, parts) {
  const p = parts || {};
  return {
    desktop: expandAny(pair.desktop, p.desktop),
    mobile: expandAny(pair.mobile, p.mobile),
  };
}

// ─── form schema ──────────────────────────────────────────────────────────────

const E = (key, label, domains) => ({ key, label, domains });
const T = (key, label) => ({ key, label, type: "text" });
const LIST = (key, label, domains) => ({ key, label, type: "list", domains });
// A map is keyed by the entities in another field's list - one row per lock,
// not a free-floating second list that happens to be the same length.
const MAP = (key, label, over, domains) => ({ key, label, type: "map", over, domains });

// Groups follow the anatomy of a room card rather than the variable prefixes,
// so the panel reads in the order you meet things on the dashboard.
const GROUPS = [
  // lead: the photos card is tall, so it takes a column and the short ones stack
  // beside it. Alternating strands a nearly empty card next to the photos.
  { id: "rooms", label: "Room", lead: true, icon: "room",
    iconColor: "var(--hemma-color-blue, #0088FF)",
    blurb: "This room's name and photo, and everything that runs across the top." },
  { id: "badges", label: "Badges", icon: "badge",
    iconColor: "var(--hemma-color-purple, #9333ea)",
    // Said once here, not on each of the six: the same switch is a readout on
    // the wide dashboard and the filter on the phone.
    blurb: "The pills under the room name. Lights, climate, media, who's home. "
      + "On a phone these are the filters, so turning one off takes its filter "
      + "away too." },
  { id: "tiles", label: "Tiles", icon: "tile",
    iconColor: "var(--hemma-color-teal, #00C3D0)",
    blurb: "The cards along the bottom of the room. Tap one to open its controls." },
];

// A "unit" is a set of fields you add together; menuGroup files popup detail
// under its own heading. A repeat is a family of numbered slots: the + offers
// the family once and reveals the next free slot.
const R = (id, label, max, fields, menuGroup, kinds) => ({ id, label, max, fields, menuGroup: menuGroup || null, kinds: kinds || null });

// The Media pill and the Now Playing panel are the same sources in two
// presentations, so both sections offer the same list and write the same keys -
// set a player under either and it is set for both. Fresh objects per call:
// sectionFields caches its flattening on the section it was called with.
const mediaRepeats = () => [
  R("player", "Media player", 10, [{ ...E("media_player_%", "Media player %", ["media_player"]), ord: 10 }]),
  R("plex", "Plex stream", 2, [{ ...E("plex_stream_%", "Plex stream %", ["sensor"]), ord: 12 }]),
  // Either shape works: the collector reads the title from an attribute or,
  // failing that, from the state.
  R("psn", "PlayStation", 2, [{ ...E("psn_%", "PlayStation %", ["sensor"]), ord: 14,
    hint: "The account's now-playing or session sensor - either one" }]),
];
// Discord and Steam report the same PC two ways, so they stay two units with
// their own labels rather than one blended source.
const mediaSources = () => [
  // One entity: the user sensor carries presence, game, details and artwork.
  // discord_game and its siblings still work as overrides, just aren't offered.
  { ...E("discord_user", "Discord account", ["sensor"]), unit: "discord", unitLabel: "Discord", ord: 20,
    // The Presence intent is privileged and off by default, and without it the
    // sensor exists and looks healthy but never reports a game - which reads as
    // a Hemma bug rather than a Discord setting. Worth the extra sentence.
    hint: "Your user sensor from Discord Game - game, details and artwork all follow. "
      + "If it never shows a game, enable your bot's Presence intent in Discord" },
  { ...T("discord_label", "Discord shown as"), unit: "discord", advanced: true, ord: 25, placeholder: "PC" },

  { ...E("steam_game", "Steam game", ["sensor"]), unit: "steam", unitLabel: "Steam", ord: 30 },
  { ...E("steam_online", "Steam presence", ["sensor", "binary_sensor"]), unit: "steam", ord: 31 },
  { ...E("steam_image", "Steam artwork", ["sensor"]), unit: "steam", ord: 32 },
  { ...T("steam_label", "Steam shown as"), unit: "steam", advanced: true, ord: 33, placeholder: "Steam" },
  { key: "duplicate_game", label: "Same game on both", type: "select", advanced: true, ord: 34,
    options: ["", "discord", "steam", "both"], needs: "steam",
    optionLabels: { "": "Default (keep Discord)", discord: "Keep Discord",
      steam: "Keep Steam", both: "Show both" } },
];

// A dashboard cannot report either of these - a widget fed a dead entity just
// fails to appear - so the panel is the only place they can be seen.
const fieldFault = (f, val, hass) => {
  if (!f.domains || !val || !hass) return "";
  const st = hass.states[val];
  if (!st) return "This entity no longer exists. Pick another one.";
  return (f.check && f.check(st, hass)) || "";
};

const SECTIONS = [
  {
    label: "Appearance", icon: "home", iconColor: "var(--hemma-color-blue, #0088FF)", group: "rooms",
    fields: [
      { key: "__name", label: "Room name", type: "text", always: true },
      { key: "image", label: "Background image", type: "image", always: true },
      // kiosk-mode reads a root-level key at page load; the panel holds the
      // choice as a room variable and projects it there on save.
      { key: "hemma_hide_header", label: "Hide the HA header", type: "bool",
        boolDefault: true, auto: true, scope: "dashboard",
        hint: "The toolbar with the edit pencil - everything here is configured in this panel" },
      { key: "font", label: "Font", type: "select", auto: true, scope: "dashboard",
        options: ["", "inter", "hanken", "system"],
        optionLabels: { "": "Default (theme)", inter: "Inter",
          hanken: "Hanken Grotesk", system: "System font" },
        hint: "System uses SF Pro on Apple devices and the platform font elsewhere" },
    ],
  },
  {
    label: "Weather", icon: "weather", iconColor: "var(--hemma-color-blue, #0088FF)", iconRaw: true, group: "rooms",
    fields: [
      E("weather_entity", "Weather", ["weather"]),
      // The weather entity already reports a temperature; this only exists for
      // people whose own outdoor sensor is better than their provider's.
      { ...E("weather_temp_sensor", "Temperature override", ["sensor"]),
        advanced: true, noAdd: true,
        hint: "Leave empty to use the weather entity's own reading" },
    ],
  },
  {
    label: "Time", icon: "clock", iconColor: "var(--hemma-color-orange, #FF9230)", group: "rooms", scope: "dashboard",
    fields: [
      E("time_entity", "Time sensor", ["sensor"]),
      { key: "use_12h", label: "12-hour clock", type: "bool", boolDefault: true, auto: true },
      // Follows the sensor like the 12-hour switch, but tucked into Advanced:
      // it is there when you expand it, with nothing to add first.
      { ...T("time_suffix", "Suffix"),
        auto: true, advanced: true, noAdd: true },
    ],
  },
  {
    label: "Scenes", icon: "scenes", iconColor: "var(--hemma-color-purple, #9333ea)", group: "rooms",
    scope: "dashboard", col: "a",
    toggleFn: "scenes",
    fields: [
      { ...LIST("scenes", "Scenes to show", ["scene"]), always: true, ord: 1,
        hint: "Every scene shows automatically, sorted by name. Add scenes here "
          + "to pin a fixed list in the order you choose instead." },
      { ...LIST("scene_exclude", "Scenes to hide"), domains: ["scene"],
        auto: true, advanced: true, noAdd: true, ord: 2,
        hint: "Never shown, whether the list above is automatic or one you pinned" },
    ],
  },
  {
    // Its own panel above the tiles, owning every source it can draw. The Media
    // pill is the same list in its other presentation.
    label: "Now Playing", icon: "music", iconColor: "var(--hemma-color-pink, #ff4d70)", group: "rooms",
    toggleFn: "nowplaying",
    fields: [
      { ...T("pause_timeout_minutes", "Hide paused after (minutes)"), advanced: true, ord: 41,
        placeholder: "10" },
      // The collapse lives in one HA helper shared by every room, so this is
      // written to every room too - two rooms could not disagree about it
      // without one of them lying.
      { key: "start_minimized", label: "Start minimized", type: "bool", boolDefault: false,
        auto: true, scope: "dashboard", ord: 45,
        hint: "Only the waveform shows until you tap it; it collapses again on every reload" },

      ...mediaSources(),
    ],
    repeats: mediaRepeats(),
  },
  {
    label: "Climate", bid: "climate", icon: "fan", toggle: "show_climate",
    iconColor: "var(--hemma-badge-climate-color, var(--hemma-color-teal, #00C3D0))", group: "badges",
    fields: [
      { ...E("humidity_sensor", "Humidity", ["sensor"]), ord: 3 },
      { ...E("quality_sensor", "Air quality", ["sensor"]), ord: 4 },
      { key: "temp_unit", label: "Unit", type: "select", options: ["", "F", "C"], auto: true, ord: 1,
        optionLabels: { "": "Default (\u00b0F)", F: "Fahrenheit \u00b0F", C: "Celsius \u00b0C" } },
      // "Show inline, not as a pill" said nothing about what either one is.
      // What it does is swap the one Climate pill - which expands into
      // Temperature, Humidity and Air Quality - for those three, always shown.
      { key: "show_climate_inline", label: "Separate climate badges", type: "bool",
        boolDefault: false, advanced: true,
        hint: "Shows Temperature, Humidity and Air Quality on the row instead of one Climate pill that expands into them." },
      { ...E("aqi_entity_pm25", "PM2.5", ["sensor"]), unit: "aqi", unitLabel: "Air quality popup", menuGroup: "Popup detail" },
      { ...E("aqi_entity_pm10", "PM10", ["sensor"]), unit: "aqi" },
      { ...E("aqi_entity_voc", "VOC", ["sensor"]), unit: "aqi" },
      { ...E("aqi_entity_co2", "CO2", ["sensor"]), unit: "aqi" },
      { ...E("aqi_entity_temp", "Temperature", ["sensor"]), unit: "aqi" },
      { ...E("aqi_entity_humidity", "Humidity reading", ["sensor"]), unit: "aqi" },
    ],
    repeats: [
      R("thermostat", "Thermostat", 3, [{ ...E("climate_entity_%", "Thermostat %", ["climate"]), ord: 0 }]),
      R("temp", "Temperature sensor", 5, [{ ...E("temp_sensor_%", "Temperature %", ["sensor"]), ord: 2 }]),
    ],
  },
  {
    label: "Lights", bid: "lights", icon: "light", toggle: "show_lights",
    iconColor: "var(--hemma-badge-light-color, var(--hemma-color-yellow, #FFCC00))", group: "badges",
    fields: [
      { ...E("light_group_entity", "Light group", ["light"]), ord: 1,
        hint: "The pill totals this group, and each light in it becomes a sub badge" },
    ],
    repeats: [
      R("light", "Light", 10, [
        { ...E("light_entity_%", "Light %", ["light"]), ord: 2,
          hint: "Listing lights here replaces the group's members as the sub badges" },
      ]),
    ],
  },
  {
    label: "People", bid: "people", icon: "person", toggle: "show_people", iconColor: "var(--hemma-color-green, #30D158)", group: "badges",
    fields: [],
    repeats: [R("person", "Person", 4, [E("presence_entity_%", "Person %", ["sensor", "person"])])],
  },
  {
    label: "Media", bid: "media", icon: "media", toggle: "show_media", iconColor: "var(--hemma-color-pink, #ff4d70)", group: "badges",
    // This switch is the master for the pill AND the panel, which is why
    // turning Now Playing on turns it back on.
    fields: mediaSources(),
    repeats: mediaRepeats(),
  },
  {
    label: "Security", bid: "security", icon: "lock-fill", toggle: "show_security",
    iconColor: "var(--hemma-color-teal, #00C3D0)", group: "badges",
    fields: [
      // Rooms set up before the group badges existed point at one lock directly.
      { ...E("security_lock_entity", "Lock", ["lock"]), noAdd: true, ord: 0 },
      { ...E("security_lock_entity_2", "Lock 2", ["lock"]), noAdd: true, ord: 0 },

      // Not "group": how many locks you own is not a decision to make here.
      // One or six, it is one badge and Hemma's lock popup either way.
      { ...LIST("security_locks", "Locks", ["lock"]), unitLabel: "Locks", ord: 2,
        hint: "One badge for all of them - one lock is fine" },
      { ...T("security_locks_label", "Heading"), unitLabel: "Lock group heading",
        advanced: true, needs: "security_locks", ord: 3 },
      { ...MAP("security_door_sensors", "Door sensor", "security_locks", ["binary_sensor"]),
        unitLabel: "Door and window sensors", advanced: true, needs: "security_locks", ord: 4,
        hint: "One contact sensor per lock, shown beside it in the popup",
        emptyHint: "Add locks to the group first." },
      { ...MAP("security_lock_batteries", "Battery", "security_locks", ["sensor"]),
        unitLabel: "Lock batteries", advanced: true, needs: "security_locks", ord: 5,
        emptyHint: "Add locks to the group first." },

      { ...LIST("security_cameras", "Cameras", ["camera"]), unitLabel: "Cameras", ord: 6,
        hint: "One badge for all of them - one camera is fine" },
      { ...T("security_cameras_label", "Heading"), unitLabel: "Camera group heading",
        advanced: true, needs: "security_cameras", ord: 7 },
    ],
    repeats: [
      // hemma_badge_security already switches on domain - lock, camera, contact
      // sensor, garage cover - so one slot covers all of them and the kind only
      // decides which entities the picker offers.
      R("secbadge", "Badge", 8, [
        { ...E("security_entity_%", "Device %", ["lock", "camera", "binary_sensor", "cover"]), ord: 1 },
        { ...T("security_label_%", "Label"), advanced: true, ord: 1 },
      ], "One badge each", [
        { id: "lock", label: "Lock", domains: ["lock"] },
        { id: "camera", label: "Camera", domains: ["camera"] },
      ]),
    ],
  },
  {
    label: "Energy", bid: "energy", icon: "energy", toggle: "show_energy",
    iconColor: "var(--hemma-badge-energy-color, var(--hemma-color-green, #30D158))", group: "badges",
    fields: [
      // NOT auto: sectionLive means "some ADDABLE unit has a value", so auto
      // would leave Energy with nothing addable and the section could never
      // start.
      { ...E("energy_power_entity", "Room power", ["sensor"]), classes: ["power"], ord: 1,
        hint: "The room's total draw - this is the number the Energy badge shows. "
          + "Without it the badge falls back to today's cost" },
      { ...E("energy_usage_today", "Usage today", ["sensor"]), classes: ["energy"], auto: true, ord: 2 },
      { ...E("energy_usage_month", "Usage this month", ["sensor"]), classes: ["energy"], auto: true, ord: 3 },
      { ...E("energy_cost_today", "Cost today", ["sensor"]), classes: ["monetary"], auto: true, ord: 4 },
      { ...E("energy_cost_month", "Cost this month", ["sensor"]), classes: ["monetary"], auto: true, ord: 5 },
    ],
    repeats: [
      R("enitem", "Sub-badge", 6, [
        { ...E("energy_entity_%", "Sensor", ["sensor"]), ord: 6 },
        { key: "energy_unit_%", label: "Shows", type: "select", ord: 6,
          options: ["", "cost", "power", "energy"],
          optionLabels: { "": "Automatic", cost: "Running cost",
            power: "Power now (W)", energy: "Energy used (kWh)" },
          hint: "Automatic reads the sensor itself - a cost sensor shows money, "
            + "a kWh sensor shows kWh, anything else shows watts" },
        { ...T("energy_label_%", "Label"), advanced: true, ord: 6 },
        { ...E("energy_cost_%", "Also show cost", ["sensor"]), classes: ["monetary"],
          advanced: true, ord: 6, placeholder: "Optional",
          hint: "Only for a badge showing watts or kWh that should carry its cost "
            + "as well, as \"8 W \u00b7 $1.23\". Leave empty when the sensor above "
            + "is already a cost sensor" },
      ]),
      R("endev", "Popup device", 6, [
        { ...T("energy_popup_name_%", "Name"), needs: "energy_entity_%", ord: 7 },
        { ...E("energy_popup_power_%", "Power", ["sensor"]), classes: ["power"], needs: "energy_entity_%", ord: 7 },
        { ...E("energy_popup_today_%", "Today", ["sensor"]), classes: ["energy"], needs: "energy_entity_%", ord: 7 },
        { ...E("energy_popup_month_%", "This month", ["sensor"]), classes: ["energy"], needs: "energy_entity_%", ord: 7 },
        { ...E("energy_popup_cost_today_%", "Cost today", ["sensor"]), classes: ["monetary"], needs: "energy_entity_%", ord: 7 },
        { ...E("energy_popup_cost_month_%", "Cost this month", ["sensor"]), classes: ["monetary"], needs: "energy_entity_%", ord: 7 },
      ], "Popup detail"),   // one per sub-badge: what its popup shows instead of the room's totals
    ],
  },
];

// Repeats are flattened once per section; visibility then works on units as before.
function sectionFields(sec) {
  if (sec._flat) return sec._flat;
  const out = (sec.fields || []).slice();
  (sec.repeats || []).forEach((rep) => {
    for (let n = 1; n <= rep.max; n++) {
      rep.fields.forEach((f) => {
        out.push({
          ...f,
          key: f.key.replace("%", n),
          label: f.label.replace("%", n),
          // So a repeat can depend on its OWN index - "Popup device 3" is only
          // offered once sub-badge 3 exists, rather than all six showing up
          // whether or not there is anything for them to override.
          needs: f.needs ? f.needs.replace("%", n) : f.needs,
          unit: rep.id + "#" + n,
          unitLabel: rep.label + " " + n,
          repeatOf: rep.id,
          repeatLabel: rep.label,
          repeatKinds: rep.kinds,
          menuGroup: f.menuGroup || rep.menuGroup || null,
        });
      });
    }
  });
  const popup = new Set(out.filter((f) => f.menuGroup === "Popup detail").map(unitOf));
  sec._flat = out.map((f) =>
    (popup.has(unitOf(f)) && !f.advanced) ? { ...f, advanced: true } : f);
  return sec._flat;
}

const unitOf = (f) => f.unit || f.key;

// One entry per unit, in declaration order, for the + menu.
const unitsOf = (sec) => {
  const seen = new Map();
  sectionFields(sec).forEach((f) => {
    const id = unitOf(f);
    if (!seen.has(id)) seen.set(id, { id, label: f.unitLabel || f.label, group: f.menuGroup || null, fields: [] });
    seen.get(id).fields.push(f);
  });
  return [...seen.values()];
};

const FINGERPRINT_KEY = "hemma_template_fingerprint";
const LAST_DASH_KEY = "hemma_panel_last_dashboard";

const hashStr = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
};

const fingerprintOf = (templates) => {
  const out = {};
  Object.keys(templates || {}).forEach((k) => { out[k] = hashStr(stable(templates[k])); });
  return out;
};

// The bundle is built from dashboards/templates/**, where these are authored, so
// it wins. Templates the bundle does not carry are left alone.
// The scene row is built in filter-overlay.js, so its variables live in the
// template defaults that refreshTemplates replaces on every save - the rooms
// hold the choice and this projects it back. Null, not deleted: _hemmaSC.list
// reads that as "discover everything".
// The Home badge's sub badges are the OTHER rooms' energy costs, derived here
// because only the panel sees across rooms. Any entry pins the list.
function energySubsAuto(rooms) {
  const home = (rooms || [])[0];
  const V = home && home.variables;
  if (!V || V.show_energy === false || V.energy_subs_auto === false) return false;
  return !(rooms || []).slice(1).some((r) => r && r.variables && r.variables.energy_cost_month);
}

function deriveEnergyRooms(rooms) {
  const list = rooms || [];
  const home = list[0];
  if (!home || !home.variables) return 0;
  const V = home.variables;
  if (V.show_energy === false) return 0;

  // Auto until you edit a slot. Absent means auto too, but only from an empty
  // list - so a dashboard configured by hand before this existed is never
  // rewritten out from under it.
  if (V.energy_subs_auto === false) return 0;
  if (V.energy_subs_auto === undefined) {
    for (let i = 1; i <= 6; i++) if (V["energy_entity_" + i]) return 0;
  }

  // Rebuilt from scratch each time, so a room added, removed or renamed is
  // picked up rather than appended around.
  for (let i = 1; i <= 6; i++) {
    ["energy_entity_", "energy_label_", "energy_unit_", "energy_popup_name_",
     "energy_popup_power_", "energy_popup_today_", "energy_popup_month_",
     "energy_popup_cost_today_", "energy_popup_cost_month_"]
      .forEach((k) => { delete V[k + i]; });
  }

  const others = list.slice(1)
    .filter((r) => r && r.variables && r.variables.energy_cost_month);
  V.energy_subs_auto = true;
  let n = 0;
  others.slice(0, 6).forEach((r) => {
    const RV = r.variables;
    n += 1;
    V["energy_entity_" + n] = RV.energy_cost_month;
    V["energy_label_" + n] = r.name || r.path;
    V["energy_unit_" + n] = "cost";
    V["energy_popup_name_" + n] = r.name || r.path;
    if (RV.energy_power_entity) V["energy_popup_power_" + n] = RV.energy_power_entity;
    if (RV.energy_usage_today) V["energy_popup_today_" + n] = RV.energy_usage_today;
    if (RV.energy_usage_month) V["energy_popup_month_" + n] = RV.energy_usage_month;
    if (RV.energy_cost_today) V["energy_popup_cost_today_" + n] = RV.energy_cost_today;
    if (RV.energy_cost_month) V["energy_popup_cost_month_" + n] = RV.energy_cost_month;
  });
  return n;
}

function applyScenePick(cfg, rooms) {
  const t = cfg && cfg.button_card_templates;
  if (!t) return;
  const src = ((rooms || [])[0] || {}).variables || {};
  const pick = (k) => (Array.isArray(src[k]) && src[k].length ? src[k].slice() : null);
  ["hemma_scene_row", "hemma_popup_scenes"].forEach((name) => {
    if (!t[name] || !t[name].variables) return;
    t[name].variables.scenes = pick("scenes");
    t[name].variables.scene_exclude = pick("scene_exclude");
  });
}

// A root-level key, not a card, so the preference rides in the rooms and is
// written out here. Anything else under kiosk_mode is preserved - hide_sidebar
// especially, since Hemma's hamburger is the only way back to the sidebar.
function applyKiosk(cfg, rooms) {
  const v = (((rooms || [])[0] || {}).variables) || {};
  const hide = v.hemma_hide_header !== false;
  const prev = cfg.kiosk_mode || {};
  cfg.kiosk_mode = {
    ...prev,
    hide_header: hide,
    mobile_settings: { ...(prev.mobile_settings || {}), hide_header: hide },
  };
}

// Routes are per-dashboard and retargetRoutes rewrites them at save, so they
// are never evidence that the card itself changed.
function withoutRoutes(o) {
  if (Array.isArray(o)) return o.map(withoutRoutes);
  if (o && typeof o === "object") {
    const out = {};
    Object.keys(o).forEach((k) => { if (k !== "routes") out[k] = withoutRoutes(o[k]); });
    return out;
  }
  return o;
}

// Routes carried over from a navbar-card dashboard open their menu through a
// popup template; hemma-nav names the menu instead.
function upgradeNavExtra(r) {
  const legacy = r && (r.popup !== undefined
    || (r.tap_action && r.tap_action.action === "open-popup"));
  if (!legacy) return r;
  const out = { ...r, menu: r.menu || "scenes" };
  delete out.popup;
  delete out.tap_action;
  return out;
}

function refreshTemplates(current, bundleTemplates) {
  const next = { ...(current || {}) };
  const prints = {};
  const adopted = [];
  let updated = 0, added = 0;

  Object.keys(bundleTemplates).forEach((k) => {
    const mine = next[k];
    if (mine === undefined) added += 1;
    else if (stable(mine) !== stable(bundleTemplates[k])) updated += 1;
    next[k] = bundleTemplates[k];
    prints[k] = hashStr(stable(bundleTemplates[k]));
    adopted.push(k);
  });

  return { templates: next, prints, adopted, updated, added, kept: 0 };
}

const slug = (s) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "room";

function blankRoom(name, path, image) {
  return {
    title: path,
    path: path,
    name: name,
    variables: { image: image },
    tiles: [],
    _hero: { type: "custom:button-card", template: "hemma_room" },
    _row: { type: "custom:hemma-smart-row" },
    _view: {},
    _extraCards: [],
  };
}

const ROOM_ICONS = {
  "home": "mdi:home-variant", "living room": "mdi:sofa", "lounge": "mdi:sofa",
  "kitchen": "mdi:fridge", "bedroom": "mdi:bed-king", "bathroom": "mdi:shower",
  "office": "mdi:desk", "garage": "mdi:garage", "dining room": "mdi:silverware-fork-knife",
  "basement": "mdi:stairs-down", "attic": "mdi:home-roof", "hallway": "mdi:door-open",
  "laundry": "mdi:washing-machine", "garden": "mdi:flower", "outside": "mdi:tree",
  "nursery": "mdi:teddy-bear", "study": "mdi:bookshelf", "gym": "mdi:dumbbell",
};

const roomIcon = (name) => ROOM_ICONS[String(name || "").toLowerCase().trim()] || "mdi:home-variant";

// Hemma's own glyphs, not MDI. An unknown name resolves to the set's "?" rather
// than borrowing another room's icon, so a gap is visible.
const ROOM_GLYPHS = {
  "home": "home",
  "living room": "living-room", "lounge": "living-room",
  "family room": "living-room", "sitting room": "living-room", "den": "living-room",
  "kitchen": "kitchen",
  "pantry": "fridge",
  "bedroom": "bedroom",
  "master bedroom": "bedroom", "primary bedroom": "bedroom",
  "guest room": "bedroom", "guest bedroom": "bedroom", "nursery": "bedroom",
  "dining room": "chair", "dining": "chair",
  "office": "desktop", "study": "desktop", "desk": "desktop",
  "media room": "tv", "theater": "tv", "theatre": "tv", "cinema": "tv", "tv room": "tv",
  "game room": "console", "games room": "console", "gaming": "console",
  "hallway": "door-closed", "hall": "door-closed", "entry": "door-closed",
  "entryway": "door-closed", "foyer": "door-closed", "porch": "door-closed",
  "garden": "plant", "patio": "plant", "backyard": "plant", "yard": "plant",
  "outdoor": "plant", "outside": "plant",
  "studio": "music",
  // The phone layout's first section. Not a room, but it is a row in the rail
  // like the rest and the fallback marker read as a missing glyph.
  "favorites": "favorites",
};

// Offered when the name gives nothing away, or when the auto pick is wrong.
// Rooms only - the full set is mostly device glyphs, and scrolling past forty
// of those to find a door is not a picker.
const ROOM_ICON_CHOICES = [
  "home", "living-room", "kitchen", "bedroom", "chair", "desktop",
  "tv", "console", "media", "music", "door-closed", "plant", "fridge",
  "lamp", "pendant-light", "light", "fan", "thermostat", "energy",
  "network", "vacuum", "person", "favorites", "scenes", "default",
];

const ROOM_ICON_LABEL = {
  "living-room": "Living Room", "door-closed": "Door", "pendant-light": "Pendant",
  "desktop": "Desk", "default": "No Icon",
};

const titleCase = (s) => String(s).replace(/-/g, " ")
  .replace(/\b[a-z]/g, (c) => c.toUpperCase());

const roomIconLabel = (g) => ROOM_ICON_LABEL[g] || titleCase(g);

const autoRoomGlyph = (name) =>
  ROOM_GLYPHS[String(name || "").toLowerCase().trim()] || "default";

// A picked icon sticks; everything else follows the room's name, so renaming
// moves the glyph. The pick lives on the header card's variables, so it survives
// a save for free.
const roomGlyph = (name, room) => {
  const chosen = ((room || {}).variables || {}).room_icon;
  return chosen || autoRoomGlyph(name);
};

// macOS menus scale out of the control that opened them. Scale and opacity
// only: these carry backdrop-filter, and a filter here would take the blur with
// it.
const MAP_IN = [
  { opacity: 0, transform: "scale(0.70)" },
  { opacity: 1, transform: "scale(1.03)", offset: 0.52 },
  { opacity: 1, transform: "scale(1)" },
];
const MAP_OUT = [
  { opacity: 1, transform: "scale(1)" },
  { opacity: 0, transform: "scale(0.72)" },
];

const MENU_IN = [{ opacity: 0, transform: "scale(0.92)" }, { opacity: 1, transform: "none" }];
const MENU_OUT = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.96)" }];
// macOS decelerates into place and never travels past the target.
const EASE = "cubic-bezier(.32,.72,0,1)";
// Safari's own toggle is the reference: smooth, not snappy. EASE front-loads
// too hard to read as a spring - released from rest means ZERO velocity, so the
// curve eases in as well as out. Critically damped, no overshoot.
const SEG_EASE = "cubic-bezier(.36,0,.16,1)";
const SEG_MS = 380;

// The preview and the Appearance card's photo slots fade in together on a room
// change. Same keyframes, same timing, one place - they were two identical
// literals and the preview still ran late, see _swapMap.
const ROOM_FADE = [{ opacity: 0, filter: "blur(7px)" }, { opacity: 1, filter: "blur(0px)" }];
// One dial for the whole room-switch morph, so the tab growing into its caret,
// the tabs sliding along and the cards settling all stay in step. 1 is the
// original pacing.
const ROOM_MOTION = 1.35;
const RT = (ms) => Math.round(ms * ROOM_MOTION);
const ROOM_FADE_MS = RT(400);

// Drawn at the real dashboard's size and SCALED, the way a design tool shows an
// artboard: reflowing needs a minimum width and a definite container height, and
// scaling needs neither. Returns null before layout - never invent a size.
// Both shapes are drawn to the same rendered width, so a switch changes only the
// height. The budget uses the taller of the two so neither overflows.
const MAP_TALLEST = 486 / 700;
// The layout breaks on the PANEL's width, never the viewport's: a media query
// asks the window, and HA docks its sidebar at 256px, so a 1180px tablet hands
// this element 924.
const PANEL_NARROW = 1000;
const PANEL_TIGHT = 900;
const PANEL_PHONE = 700;
// Measured off the host's own left edge rather than its parent's clientWidth:
// the host is width:var(--vpw), so reading a parent that shrink-wraps it would
// feed this back into itself. Where HA starts the panel does not depend on how
// wide the panel is, so the subtraction cannot loop.
const panelW = (el) => {
  if (!el || !el.getBoundingClientRect) return window.innerWidth;
  const left = Math.max(0, el.getBoundingClientRect().left);
  const w = Math.round(window.innerWidth - left);
  return w > 40 ? w : window.innerWidth;
};
const isNarrow = (el) => panelW(el) < PANEL_NARROW;
const isPhone = (el) => panelW(el) < PANEL_PHONE;
// A CONSTANT, not the container's measured height: that keeps changing while the
// page loads - header settling, pills arriving, the font swapping - and each
// change re-fitted the preview. The viewport height does not change during
// load.
const MAP_SHADOW_ROOM = 0;
// `tallest` is the aspect the height budget is spent against. It was always
// MAP_TALLEST, which is the tablet's - fine while every shape was landscape,
// and wrong the moment a 390x844 phone joined them: a phone fitted to a
// landscape ratio is three times too wide for the height it has.
function fitWidth(availW, availH, cap, tallest) {
  if (!(availW >= 40)) return null;
  const ratio = tallest || MAP_TALLEST;
  let w = Math.min(availW, cap);
  if (availH >= 40) w = Math.min(w, availH / ratio);
  return Math.max(60, w);
}
const MENU_IN_T = { duration: 160, easing: EASE };
const MENU_OUT_T = { duration: 110, easing: "cubic-bezier(.4,0,1,1)" };
const menuStill = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const playMenuIn = (menu, dropDown, fromRight) => {
  menu.style.transformOrigin = (fromRight ? "right " : "left ") + (dropDown ? "top" : "bottom");
  if (!menuStill()) menu.animate(MENU_IN, MENU_IN_T);
};

const closeMenu = (menu, after) => {
  if (!menu.parentNode || menu._closing) return;
  menu._closing = true;
  const done = () => {
    if (menu.parentNode) menu.parentNode.removeChild(menu);
    menu._closing = false;
    if (after) after();
  };
  if (menuStill()) return done();
  menu.animate(MENU_OUT, MENU_OUT_T).finished.then(done, done);
};

const FONT_STACKS = {
  inter: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  hanken: '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  system: '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
};
// The @font-face blocks are a Lovelace resource, which only loads on a
// dashboard - this is a panel, so the faces have to be asked for here or the
// preview would letter Hanken in the panel's own font and lie about it.
const FONT_CSS = "/local/hemma/fonts/hanken-grotesk.css";
function ensureFontCss() {
  const ID = "hemma-panel-fontfaces";
  if (document.getElementById(ID)) return;
  const l = document.createElement("link");
  l.id = ID;
  l.rel = "stylesheet";
  l.href = FONT_CSS;
  document.head.appendChild(l);
}

const ICON_DEFAULT = "Default";
// Held DECODED for the life of the page: the bytes are cached, but a fresh <img>
// still has to decode them and a decoded bitmap is dropped under memory
// pressure. Keeping the element alive keeps the decode alive with it.
const PHOTO_CACHE = new Map();
const warmPhoto = (url) => {
  if (!url || PHOTO_CACHE.has(url)) return;
  const img = new Image();
  img.decoding = "async";
  PHOTO_CACHE.set(url, img);
  img.src = url;
  if (img.decode) img.decode().catch(() => {});
};

const iconUrl = (name) => {
  const n = String(name || "").trim();
  const k = !n || n === ICON_DEFAULT ? "default" : n;
  return ICON_DATA[k] || ICON_DATA.default;
};

// The shipped nav links to the author's own dashboard, embedded eleven times
// over, so every route list is rewritten. `extras` goes on EVERY list, which is
// what makes the Scenes switch stick - the template's own copy is replaced from
// the bundle on every save.
function retargetRoutes(root, urlPath, rooms, extras) {
  const out = clone(root);
  let rewritten = 0;

  (function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (Array.isArray(node.routes)) {
      const keep = extras === undefined ? node.routes.filter((r) => !r.url) : extras;
      node.routes = rooms
        .map((r) => ({ url: `/${urlPath}/${r.path}`, label: r.name, icon: roomIcon(r.name) }))
        .concat(clone(keep));
      rewritten += 1;
    }
    Object.keys(node).forEach((k) => walk(node[k]));
  })(out);

  return { config: out, rewritten };
}


// ─── tile catalog ─────────────────────────────────────────────────────────────
// Types people set up by hand. Anything else in a room's row is preserved
// untouched and shown read-only, so unknown tiles can be reordered but not
// edited into something the template does not understand.

// Inlined as data URIs: a fetch, even from cache, races the render that asks for
// it, and this panel rebuilds on every keystroke. Regenerate with:
//   cd /config/www/hemma/icons && python3 -c "
//     import glob
//     from urllib.parse import quote
//     for f in sorted(glob.glob('*.svg')):
//         print(f\"  \\\"{f[:-4]}\\\": \\\"data:image/svg+xml,{quote(open(f).read())}\\\",\")"
const ICON_DATA = {
  "access_point": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2275%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2075%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M37.5%2050c-1.12%200-2.093-.41-2.919-1.232-.825-.822-1.238-1.79-1.238-2.905%200-1.115.413-2.084%201.238-2.905.826-.822%201.799-1.233%202.919-1.233s2.093.411%202.919%201.233c.825.821%201.238%201.79%201.238%202.905%200%201.115-.413%202.083-1.238%202.905C39.593%2049.589%2038.62%2050%2037.5%2050ZM16.893%2032.658l-1.858-1.848c3.125-3.17%206.565-5.575%2010.32-7.218%203.753-1.644%207.806-2.465%2012.16-2.465%204.353%200%208.402.821%2012.146%202.465%203.744%201.643%207.179%204.02%2010.304%207.13l-1.858%201.936c-2.889-2.875-6.087-5.061-9.596-6.558A27.78%2027.78%200%200%200%2037.5%2023.856%2027.78%2027.78%200%200%200%2026.489%2026.1c-3.509%201.497-6.707%203.683-9.596%206.558ZM1.946%2017.694%200%2015.757c4.835-4.812%2010.436-8.641%2016.804-11.488C23.172%201.423%2030.071%200%2037.5%200c7.43%200%2014.328%201.423%2020.696%204.27C64.564%207.115%2070.166%2010.944%2075%2015.756l-1.946%201.937a53.94%2053.94%200%200%200-16.14-10.96C50.87%204.064%2044.398%202.73%2037.5%202.73c-6.899%200-13.37%201.335-19.413%204.005a53.94%2053.94%200%200%200-16.141%2010.96Z%22/%3E%0A%3C/svg%3E%0A",
  "apple": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2248px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2248px%22%20fill%3D%22%23FFFFFF%22%3E%0A%20%20%3Cg%20id%3D%22Layer_2%22%20transform%3D%22matrix%2818.386274%2C%20-0.004319%2C%200.004132%2C%2017.590906%2C%20-436.051978%2C%208.103295%29%22%20style%3D%22transform-origin%3A%20916.048px%20-488.096px%3B%22%3E%0A%20%20%20%20%3Cg%20id%3D%22Layer_1-2%22%20data-name%3D%22Layer%201%22%20transform%3D%22matrix%281%2C%200%2C%200%2C%201%2C%20895.148193%2C%20-513.098267%29%22%3E%0A%20%20%20%20%20%20%3Cpath%20class%3D%22cls-1%22%20d%3D%22M40.9%2C38.97c-.75%2C1.75-1.64%2C3.35-2.67%2C4.83-1.4%2C2.02-2.55%2C3.41-3.43%2C4.19-1.37%2C1.27-2.84%2C1.92-4.41%2C1.96-1.13%2C0-2.49-.32-4.08-.98-1.59-.65-3.05-.98-4.39-.98s-2.91.32-4.51.98c-1.61.66-2.91%2C1-3.9%2C1.03-1.51.06-3.01-.6-4.51-2.01-.96-.84-2.16-2.29-3.59-4.33-1.54-2.19-2.81-4.72-3.8-7.61-1.06-3.12-1.6-6.14-1.6-9.07%2C0-3.35.72-6.24%2C2.16-8.66%2C1.13-1.95%2C2.63-3.48%2C4.52-4.61%2C1.88-1.13%2C3.92-1.7%2C6.11-1.74%2C1.2%2C0%2C2.77.37%2C4.72%2C1.11%2C1.95.74%2C3.2%2C1.11%2C3.75%2C1.11.41%2C0%2C1.8-.44%2C4.15-1.31%2C2.23-.81%2C4.11-1.14%2C5.65-1.01%2C4.17.34%2C7.31%2C2%2C9.39%2C4.99-3.73%2C2.28-5.58%2C5.47-5.54%2C9.57.03%2C3.19%2C1.18%2C5.85%2C3.44%2C7.95%2C1.02.98%2C2.16%2C1.73%2C3.43%2C2.27-.28.81-.57%2C1.58-.88%2C2.32h0ZM31.33%2C1c0%2C2.5-.91%2C4.84-2.71%2C7-2.18%2C2.57-4.82%2C4.05-7.67%2C3.82-.04-.3-.06-.62-.06-.95%2C0-2.4%2C1.04-4.97%2C2.88-7.07.92-1.06%2C2.09-1.95%2C3.51-2.65%2C1.41-.69%2C2.75-1.08%2C4.01-1.15.04.33.05.67.05%2C1h0Z%22%20style%3D%22fill%3A%20rgb%28255%2C%20255%2C%20255%29%3B%22/%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%3C/g%3E%0A%3C/svg%3E",
  "apple_tv": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2023.7539%2023.332%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2223.332%22%20opacity%3D%220%22%20width%3D%2223.7539%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M22.0312%201.40625C23.2266%202.60156%2023.4023%204.26562%2023.4023%206.26953L23.4023%2017.0742C23.4023%2019.0781%2023.2266%2020.7539%2022.0312%2021.9492C20.8359%2023.1445%2019.1484%2023.332%2017.1445%2023.332L6.24609%2023.332C4.25391%2023.332%202.56641%2023.1445%201.37109%2021.9492C0.175781%2020.7539%200%2019.0781%200%2017.0742L0%206.24609C0%204.27734%200.175781%202.60156%201.37109%201.40625C2.56641%200.210938%204.25391%200.0234375%206.22266%200.0234375L17.1445%200.0234375C19.1484%200.0234375%2020.8359%200.210938%2022.0312%201.40625ZM6.31641%209.62109C6%209.62109%205.64844%209.24609%205.0625%209.24609C4.41797%209.24609%203.90234%209.50391%203.5625%209.94922C3.15234%2010.4531%202.98828%2011.0625%202.98828%2011.707C2.98828%2012.7617%203.44531%2013.9922%204.13672%2014.7656C4.51172%2015.1641%204.78125%2015.375%205.10938%2015.375C5.60156%2015.375%205.87109%2015.0117%206.46875%2015.0117C6.72656%2015.0117%206.94922%2015.1172%207.10156%2015.1641C7.34766%2015.2461%207.51172%2015.3516%207.79297%2015.3516C8.09766%2015.3516%208.33203%2015.2344%208.49609%2015.0938C9.01172%2014.5664%209.43359%2013.8398%209.60938%2013.2188C9.14062%2013.0078%208.84766%2012.7148%208.67188%2012.2812C8.49609%2011.8008%208.51953%2011.3203%208.67188%2010.9102C8.76562%2010.6289%208.94141%2010.2891%209.41016%2010.0195C9.05859%209.49219%208.50781%209.23438%207.85156%209.23438C7.11328%209.23438%206.69141%209.62109%206.31641%209.62109ZM11.6602%207.80469L11.6602%209.23438L10.793%209.23438L10.793%2010.1953L11.6602%2010.1953L11.6602%2013.6992C11.6602%2014.918%2012.1406%2015.3516%2013.3711%2015.3516C13.6406%2015.3516%2013.9453%2015.3164%2014.0508%2015.3047L14.0508%2014.2852C13.9922%2014.3203%2013.7695%2014.3203%2013.6406%2014.3203C13.1484%2014.3203%2012.9141%2014.1094%2012.9141%2013.5586L12.9141%2010.1953L14.0742%2010.1953L14.0742%209.23438L12.9141%209.23438L12.9141%207.80469ZM14.6367%209.23438L16.8633%2015.3047L18.1758%2015.3047L20.3672%209.23438L19.0078%209.23438L17.5312%2014.1094L15.9609%209.23438ZM6.26953%209.03516C7.25391%209.14062%208.01562%208.07422%207.94531%207.20703C6.97266%207.25391%206.24609%208.12109%206.26953%209.03516Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "aqi-high": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2037.3242%2031.3711%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2231.3711%22%20opacity%3D%220%22%20width%3D%2237.3242%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M20.0273%2028.6758C20.0273%2029.543%2019.3477%2030.2109%2018.4805%2030.2109C17.625%2030.2109%2016.9453%2029.5312%2016.9453%2028.6758C16.9453%2027.832%2017.6367%2027.1406%2018.4805%2027.1406C19.3359%2027.1406%2020.0273%2027.8203%2020.0273%2028.6758ZM14.4258%2025.4531C14.4258%2026.3203%2013.7578%2026.9883%2012.8906%2026.9883C12.0352%2026.9883%2011.3438%2026.3086%2011.3438%2025.4531C11.3438%2024.6094%2012.0469%2023.9062%2012.8906%2023.9062C13.7461%2023.9062%2014.4258%2024.5977%2014.4258%2025.4531ZM8.83594%2022.1719C8.83594%2023.0508%208.15625%2023.7188%207.28906%2023.7188C6.43359%2023.7188%205.75391%2023.0391%205.75391%2022.1719C5.75391%2021.3398%206.45703%2020.6367%207.28906%2020.6367C8.14453%2020.6367%208.83594%2021.3281%208.83594%2022.1719ZM8.83594%2015.6797C8.83594%2016.5469%208.15625%2017.2148%207.28906%2017.2148C6.43359%2017.2148%205.75391%2016.5352%205.75391%2015.6797C5.75391%2014.8359%206.44531%2014.1445%207.28906%2014.1445C8.14453%2014.1445%208.83594%2014.8242%208.83594%2015.6797ZM31.2188%2015.6797C31.2188%2016.0704%2031.0745%2016.4245%2030.8352%2016.6928C30.3508%2016.399%2029.7961%2016.2422%2029.2383%2016.2422C28.9196%2016.2422%2028.6038%2016.2912%2028.3027%2016.3874C28.1958%2016.1778%2028.1367%2015.9376%2028.1367%2015.6797C28.1367%2014.8242%2028.8164%2014.1445%2029.6719%2014.1445C30.5156%2014.1445%2031.2188%2014.8359%2031.2188%2015.6797ZM8.83594%209.17578C8.83594%2010.043%208.15625%2010.7227%207.28906%2010.7227C6.43359%2010.7227%205.75391%2010.0312%205.75391%209.17578C5.75391%208.33203%206.44531%207.64062%207.28906%207.64062C8.14453%207.64062%208.83594%208.32031%208.83594%209.17578ZM31.1719%209.17578C31.1719%2010.043%2030.5039%2010.7227%2029.625%2010.7227C28.7812%2010.7227%2028.0898%2010.0312%2028.0898%209.17578C28.0898%208.34375%2028.793%207.64062%2029.625%207.64062C30.4922%207.64062%2031.1719%208.32031%2031.1719%209.17578ZM14.4258%205.90625C14.4258%206.77344%2013.7578%207.45312%2012.8906%207.45312C12.0352%207.45312%2011.3438%206.76172%2011.3438%205.90625C11.3438%205.0625%2012.0469%204.37109%2012.8906%204.37109C13.7461%204.37109%2014.4258%205.05078%2014.4258%205.90625ZM25.6172%205.90625C25.6172%206.77344%2024.9492%207.45312%2024.082%207.45312C23.2266%207.45312%2022.5352%206.76172%2022.5352%205.90625C22.5352%205.0625%2023.2383%204.37109%2024.082%204.37109C24.9375%204.37109%2025.6172%205.05078%2025.6172%205.90625ZM20.0273%202.68359C20.0273%203.55078%2019.3477%204.21875%2018.4805%204.21875C17.625%204.21875%2016.9453%203.53906%2016.9453%202.68359C16.9453%201.83984%2017.6484%201.13672%2018.4805%201.13672C19.3359%201.13672%2020.0273%201.82812%2020.0273%202.68359Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M20.4492%2022.1719C20.4492%2023.2734%2019.582%2024.1523%2018.4805%2024.1523C17.4023%2024.1523%2016.5117%2023.2617%2016.5117%2022.1719C16.5117%2021.1055%2017.4141%2020.2031%2018.4805%2020.2031C19.5586%2020.2031%2020.4492%2021.0938%2020.4492%2022.1719ZM14.8594%2018.9375C14.8594%2020.0391%2013.9805%2020.9062%2012.8906%2020.9062C11.8008%2020.9062%2010.9219%2020.0156%2010.9219%2018.9375C10.9219%2017.8594%2011.8125%2016.957%2012.8906%2016.957C13.9688%2016.957%2014.8594%2017.8477%2014.8594%2018.9375ZM26.0351%2018.7039L24.9068%2020.72C24.656%2020.84%2024.376%2020.9062%2024.082%2020.9062C22.9805%2020.9062%2022.1133%2020.0391%2022.1133%2018.9375C22.1133%2017.8477%2022.9922%2016.957%2024.082%2016.957C25.0703%2016.957%2025.9176%2017.7319%2026.0351%2018.7039ZM14.8594%2012.4219C14.8594%2013.5234%2013.9922%2014.3906%2012.8906%2014.3906C11.8008%2014.3906%2010.9219%2013.5117%2010.9219%2012.4219C10.9219%2011.3555%2011.8242%2010.4531%2012.8906%2010.4531C13.9688%2010.4531%2014.8594%2011.332%2014.8594%2012.4219ZM26.0508%2012.4219C26.0508%2013.5234%2025.1836%2014.3906%2024.082%2014.3906C22.9922%2014.3906%2022.1133%2013.5117%2022.1133%2012.4219C22.1133%2011.3555%2023.0156%2010.4531%2024.082%2010.4531C25.1602%2010.4531%2026.0508%2011.332%2026.0508%2012.4219ZM20.4492%209.17578C20.4492%2010.2773%2019.582%2011.1562%2018.4805%2011.1562C17.4023%2011.1562%2016.5117%2010.2656%2016.5117%209.17578C16.5117%208.10938%2017.4141%207.20703%2018.4805%207.20703C19.5703%207.20703%2020.4492%208.09766%2020.4492%209.17578Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M20.7422%2015.6797C20.7422%2016.9336%2019.7344%2017.9297%2018.4805%2017.9297C17.2383%2017.9297%2016.2305%2016.9219%2016.2305%2015.6797C16.2305%2014.4492%2017.2617%2013.4297%2018.4805%2013.4297C19.7227%2013.4297%2020.7422%2014.4375%2020.7422%2015.6797Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M30.5625%2018.6211L35.5195%2027.4805C35.6719%2027.7266%2035.7422%2027.9727%2035.7422%2028.2305C35.7422%2029.1094%2035.1328%2029.7773%2034.1836%2029.7773L24.2812%2029.7773C23.332%2029.7773%2022.7461%2029.1094%2022.7461%2028.2305C22.7461%2027.9727%2022.8164%2027.7266%2022.957%2027.4805L27.9023%2018.6211C28.1836%2018.1055%2028.7227%2017.8359%2029.2383%2017.8359C29.7539%2017.8359%2030.2695%2018.1055%2030.5625%2018.6211ZM28.2656%2027.0703C28.2656%2027.5977%2028.7109%2028.0312%2029.2383%2028.0312C29.7656%2028.0312%2030.2109%2027.5977%2030.2109%2027.0703C30.2109%2026.543%2029.7773%2026.0977%2029.2383%2026.0977C28.7227%2026.0977%2028.2656%2026.543%2028.2656%2027.0703ZM28.4531%2021.375L28.5469%2024.6328C28.5586%2025.0195%2028.8398%2025.3008%2029.2383%2025.3008C29.6367%2025.3008%2029.918%2025.0195%2029.9297%2024.6328L30.0234%2021.375C30.0352%2020.9062%2029.7188%2020.5781%2029.2383%2020.5781C28.7695%2020.5781%2028.4414%2020.9062%2028.4531%2021.375Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "aqi-low": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2024.5977%2027.9258%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2227.9258%22%20opacity%3D%220%22%20width%3D%2224.5977%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M12.1523%201.91016C12.6914%201.91016%2013.1016%201.51172%2013.1016%200.960938C13.1016%200.421875%2012.6797%200%2012.1523%200C11.625%200%2011.1914%200.433594%2011.1914%200.960938C11.1914%201.48828%2011.6133%201.91016%2012.1523%201.91016ZM6.55078%205.14453C7.10156%205.14453%207.51172%204.73438%207.51172%204.18359C7.51172%203.64453%207.08984%203.22266%206.55078%203.22266C6.03516%203.22266%205.58984%203.66797%205.58984%204.18359C5.58984%204.72266%206.01172%205.14453%206.55078%205.14453ZM17.7422%205.14453C18.293%205.14453%2018.7031%204.73438%2018.7031%204.18359C18.7031%203.64453%2018.2812%203.22266%2017.7422%203.22266C17.2266%203.22266%2016.7812%203.66797%2016.7812%204.18359C16.7812%204.72266%2017.2031%205.14453%2017.7422%205.14453ZM0.960938%208.41406C1.5%208.41406%201.91016%208.00391%201.91016%207.45312C1.91016%206.92578%201.48828%206.50391%200.960938%206.50391C0.433594%206.50391%200%206.9375%200%207.45312C0%207.99219%200.421875%208.41406%200.960938%208.41406ZM23.2969%208.41406C23.8477%208.41406%2024.2461%208.00391%2024.2461%207.45312C24.2461%206.91406%2023.8359%206.50391%2023.2969%206.50391C22.7695%206.50391%2022.3359%206.9375%2022.3359%207.45312C22.3359%207.99219%2022.7578%208.41406%2023.2969%208.41406ZM0.960938%2014.9062C1.5%2014.9062%201.91016%2014.5078%201.91016%2013.957C1.91016%2013.418%201.48828%2012.9961%200.960938%2012.9961C0.433594%2012.9961%200%2013.4297%200%2013.957C0%2014.4844%200.421875%2014.9062%200.960938%2014.9062ZM23.2969%2014.9062C23.8477%2014.9062%2024.2461%2014.5078%2024.2461%2013.957C24.2461%2013.418%2023.8359%2012.9961%2023.2969%2012.9961C22.7695%2012.9961%2022.3359%2013.4414%2022.3359%2013.957C22.3359%2014.4844%2022.7578%2014.9062%2023.2969%2014.9062ZM0.960938%2021.4102C1.5%2021.4102%201.91016%2021%201.91016%2020.4492C1.91016%2019.9219%201.48828%2019.5%200.960938%2019.5C0.433594%2019.5%200%2019.9336%200%2020.4492C0%2020.9883%200.421875%2021.4102%200.960938%2021.4102ZM23.2969%2021.4102C23.8477%2021.4102%2024.2461%2021.0117%2024.2461%2020.4492C24.2461%2019.9219%2023.8242%2019.5%2023.2969%2019.5C22.7695%2019.5%2022.3359%2019.9336%2022.3359%2020.4492C22.3359%2020.9883%2022.7578%2021.4102%2023.2969%2021.4102ZM6.55078%2024.6797C7.10156%2024.6797%207.51172%2024.2812%207.51172%2023.7305C7.51172%2023.1914%207.08984%2022.7695%206.55078%2022.7695C6.03516%2022.7695%205.58984%2023.2031%205.58984%2023.7305C5.58984%2024.2578%206.01172%2024.6797%206.55078%2024.6797ZM17.7422%2024.6797C18.293%2024.6797%2018.7031%2024.2812%2018.7031%2023.7305C18.7031%2023.1914%2018.2812%2022.7695%2017.7422%2022.7695C17.2266%2022.7695%2016.7812%2023.2031%2016.7812%2023.7305C16.7812%2024.2578%2017.2031%2024.6797%2017.7422%2024.6797ZM12.1523%2027.9141C12.6914%2027.9141%2013.1016%2027.5039%2013.1016%2026.9531C13.1016%2026.4141%2012.6797%2025.9922%2012.1523%2025.9922C11.625%2025.9922%2011.1914%2026.4375%2011.1914%2026.9531C11.1914%2027.4922%2011.6133%2027.9141%2012.1523%2027.9141Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M12.1523%208.41406C12.6914%208.41406%2013.1016%208.00391%2013.1016%207.45312C13.1016%206.92578%2012.6797%206.50391%2012.1523%206.50391C11.625%206.50391%2011.1914%206.9375%2011.1914%207.45312C11.1914%207.99219%2011.6133%208.41406%2012.1523%208.41406ZM6.55078%2011.6602C7.10156%2011.6602%207.51172%2011.25%207.51172%2010.6992C7.51172%2010.1602%207.08984%209.73828%206.55078%209.73828C6.03516%209.73828%205.58984%2010.1719%205.58984%2010.6992C5.58984%2011.2383%206.01172%2011.6602%206.55078%2011.6602ZM17.7422%2011.6602C18.293%2011.6602%2018.7031%2011.25%2018.7031%2010.6992C18.7031%2010.1602%2018.2812%209.73828%2017.7422%209.73828C17.2266%209.73828%2016.7812%2010.1719%2016.7812%2010.6992C16.7812%2011.2383%2017.2031%2011.6602%2017.7422%2011.6602ZM6.55078%2018.1641C7.10156%2018.1641%207.51172%2017.7656%207.51172%2017.2148C7.51172%2016.6758%207.08984%2016.2539%206.55078%2016.2539C6.03516%2016.2539%205.58984%2016.6875%205.58984%2017.2148C5.58984%2017.7539%206.01172%2018.1641%206.55078%2018.1641ZM17.7422%2018.1641C18.293%2018.1641%2018.7031%2017.7656%2018.7031%2017.2148C18.7031%2016.6758%2018.2812%2016.2539%2017.7422%2016.2539C17.2266%2016.2539%2016.7812%2016.6875%2016.7812%2017.2148C16.7812%2017.7539%2017.2031%2018.1641%2017.7422%2018.1641ZM12.1523%2021.4102C12.6914%2021.4102%2013.1016%2021%2013.1016%2020.4492C13.1016%2019.9219%2012.6797%2019.5%2012.1523%2019.5C11.625%2019.5%2011.1914%2019.9336%2011.1914%2020.4492C11.1914%2020.9883%2011.6133%2021.4102%2012.1523%2021.4102Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M12.1523%2014.9062C12.6914%2014.9062%2013.1016%2014.5078%2013.1016%2013.957C13.1016%2013.418%2012.6797%2012.9961%2012.1523%2012.9961C11.625%2012.9961%2011.1914%2013.4297%2011.1914%2013.957C11.1914%2014.4844%2011.6133%2014.9062%2012.1523%2014.9062Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "aqi-medium": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2025.1719%2028.4883%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2228.4883%22%20opacity%3D%220%22%20width%3D%2225.1719%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M12.4336%202.48438C13.1367%202.48438%2013.6641%201.94531%2013.6641%201.24219C13.6641%200.550781%2013.125%200%2012.4336%200C11.7539%200%2011.1914%200.5625%2011.1914%201.24219C11.1914%201.93359%2011.7422%202.48438%2012.4336%202.48438ZM6.83203%205.70703C7.53516%205.70703%208.07422%205.16797%208.07422%204.46484C8.07422%203.77344%207.52344%203.22266%206.83203%203.22266C6.16406%203.22266%205.58984%203.78516%205.58984%204.46484C5.58984%205.15625%206.14062%205.70703%206.83203%205.70703ZM18.0234%205.70703C18.7266%205.70703%2019.2656%205.16797%2019.2656%204.46484C19.2656%203.77344%2018.7148%203.22266%2018.0234%203.22266C17.3555%203.22266%2016.7812%203.78516%2016.7812%204.46484C16.7812%205.15625%2017.332%205.70703%2018.0234%205.70703ZM1.24219%208.97656C1.94531%208.97656%202.47266%208.4375%202.47266%207.73438C2.47266%207.05469%201.93359%206.50391%201.24219%206.50391C0.5625%206.50391%200%207.06641%200%207.73438C0%208.42578%200.550781%208.97656%201.24219%208.97656ZM23.5781%208.97656C24.2812%208.97656%2024.8203%208.4375%2024.8203%207.73438C24.8203%207.04297%2024.2695%206.50391%2023.5781%206.50391C22.8984%206.50391%2022.3359%207.06641%2022.3359%207.73438C22.3359%208.42578%2022.8867%208.97656%2023.5781%208.97656ZM1.24219%2015.4805C1.93359%2015.4805%202.47266%2014.9297%202.47266%2014.2383C2.47266%2013.5469%201.93359%2012.9961%201.24219%2012.9961C0.5625%2012.9961%200%2013.5586%200%2014.2383C0%2014.9297%200.550781%2015.4805%201.24219%2015.4805ZM23.5781%2015.4805C24.2812%2015.4805%2024.8203%2014.9414%2024.8203%2014.2383C24.8203%2013.5469%2024.2695%2012.9961%2023.5781%2012.9961C22.8984%2012.9961%2022.3359%2013.5586%2022.3359%2014.2383C22.3359%2014.9297%2022.8867%2015.4805%2023.5781%2015.4805ZM1.24219%2021.9727C1.94531%2021.9727%202.47266%2021.4336%202.47266%2020.7305C2.47266%2020.0508%201.93359%2019.5%201.24219%2019.5C0.5625%2019.5%200%2020.0625%200%2020.7305C0%2021.4219%200.550781%2021.9727%201.24219%2021.9727ZM23.5781%2021.9727C24.2812%2021.9727%2024.8203%2021.4453%2024.8203%2020.7305C24.8203%2020.0508%2024.2695%2019.5%2023.5781%2019.5C22.8984%2019.5%2022.3359%2020.0625%2022.3359%2020.7305C22.3359%2021.4219%2022.8867%2021.9727%2023.5781%2021.9727ZM6.83203%2025.2422C7.53516%2025.2422%208.07422%2024.7148%208.07422%2024.0117C8.07422%2023.3203%207.52344%2022.7695%206.83203%2022.7695C6.16406%2022.7695%205.58984%2023.332%205.58984%2024.0117C5.58984%2024.7031%206.14062%2025.2422%206.83203%2025.2422ZM18.0234%2025.2422C18.7266%2025.2422%2019.2656%2024.7148%2019.2656%2024.0117C19.2656%2023.3203%2018.7148%2022.7695%2018.0234%2022.7695C17.3555%2022.7695%2016.7812%2023.332%2016.7812%2024.0117C16.7812%2024.7031%2017.332%2025.2422%2018.0234%2025.2422ZM12.4336%2028.4766C13.1367%2028.4766%2013.6641%2027.9375%2013.6641%2027.2344C13.6641%2026.543%2013.125%2025.9922%2012.4336%2025.9922C11.7539%2025.9922%2011.1914%2026.5547%2011.1914%2027.2344C11.1914%2027.9258%2011.7422%2028.4766%2012.4336%2028.4766Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M12.4336%209.41016C13.3594%209.41016%2014.0977%208.67188%2014.0977%207.73438C14.0977%206.82031%2013.3477%206.07031%2012.4336%206.07031C11.5195%206.07031%2010.7578%206.83203%2010.7578%207.73438C10.7578%208.66016%2011.5078%209.41016%2012.4336%209.41016ZM6.83203%2012.6562C7.76953%2012.6562%208.50781%2011.918%208.50781%2010.9805C8.50781%2010.0547%207.75781%209.30469%206.83203%209.30469C5.92969%209.30469%205.16797%2010.0781%205.16797%2010.9805C5.16797%2011.9062%205.91797%2012.6562%206.83203%2012.6562ZM18.0234%2012.6562C18.9609%2012.6562%2019.6992%2011.918%2019.6992%2010.9805C19.6992%2010.0547%2018.9492%209.30469%2018.0234%209.30469C17.1211%209.30469%2016.3594%2010.0781%2016.3594%2010.9805C16.3594%2011.9062%2017.1094%2012.6562%2018.0234%2012.6562ZM6.83203%2019.1719C7.76953%2019.1719%208.50781%2018.4336%208.50781%2017.4961C8.50781%2016.5703%207.75781%2015.8203%206.83203%2015.8203C5.92969%2015.8203%205.16797%2016.582%205.16797%2017.4961C5.16797%2018.4102%205.91797%2019.1719%206.83203%2019.1719ZM18.0234%2019.1719C18.9609%2019.1719%2019.6992%2018.4336%2019.6992%2017.4961C19.6992%2016.5703%2018.9492%2015.8203%2018.0234%2015.8203C17.1211%2015.8203%2016.3594%2016.582%2016.3594%2017.4961C16.3594%2018.4102%2017.1094%2019.1719%2018.0234%2019.1719ZM12.4336%2022.4062C13.3594%2022.4062%2014.0977%2021.668%2014.0977%2020.7305C14.0977%2019.8164%2013.3477%2019.0664%2012.4336%2019.0664C11.5312%2019.0664%2010.7578%2019.8281%2010.7578%2020.7305C10.7578%2021.6562%2011.5078%2022.4062%2012.4336%2022.4062Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M12.4336%2016.1953C13.5234%2016.1953%2014.3906%2015.3281%2014.3906%2014.2383C14.3906%2013.1602%2013.5%2012.2812%2012.4336%2012.2812C11.3672%2012.2812%2010.4766%2013.1719%2010.4766%2014.2383C10.4766%2015.3047%2011.3555%2016.1953%2012.4336%2016.1953Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "arrow-down": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2018.1172%2022.1367%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2222.1367%22%20opacity%3D%220%22%20width%3D%2218.1172%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.88281%2022.1367C9.17578%2022.1367%209.44531%2022.0195%209.66797%2021.7852L17.4492%2013.9922C17.6719%2013.7578%2017.7656%2013.5117%2017.7656%2013.2305C17.7656%2012.6562%2017.3438%2012.2109%2016.7578%2012.2109C16.4766%2012.2109%2016.207%2012.3047%2016.0195%2012.4922L13.3477%2015.1172L8.87109%2020.0156L4.41797%2015.1172L1.74609%2012.4922C1.57031%2012.3047%201.28906%2012.2109%201.00781%2012.2109C0.421875%2012.2109%200%2012.6562%200%2013.2305C0%2013.5117%200.105469%2013.7578%200.328125%2013.9922L8.09766%2021.7852C8.32031%2022.0195%208.58984%2022.1367%208.88281%2022.1367ZM8.88281%2020.8828C9.43359%2020.8828%209.80859%2020.5078%209.80859%2019.957L9.92578%2016.4648L9.92578%201.03125C9.92578%200.421875%209.49219%200%208.88281%200C8.27344%200%207.83984%200.421875%207.83984%201.03125L7.83984%2016.4648L7.95703%2019.957C7.95703%2020.5078%208.33203%2020.8828%208.88281%2020.8828Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "arrow-up": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2018.1172%2022.1367%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2222.1367%22%20opacity%3D%220%22%20width%3D%2218.1172%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M1.00781%209.92578C1.28906%209.92578%201.57031%209.83203%201.74609%209.64453L4.41797%207.01953L8.87109%202.12109L13.3477%207.01953L16.0195%209.64453C16.207%209.83203%2016.4766%209.92578%2016.7578%209.92578C17.3438%209.92578%2017.7656%209.48047%2017.7656%208.90625C17.7656%208.625%2017.6719%208.37891%2017.4492%208.14453L9.66797%200.351562C9.44531%200.117188%209.17578%200%208.88281%200C8.58984%200%208.32031%200.117188%208.09766%200.351562L0.328125%208.14453C0.105469%208.37891%200%208.625%200%208.90625C0%209.48047%200.421875%209.92578%201.00781%209.92578ZM8.88281%2022.1367C9.49219%2022.1367%209.92578%2021.7148%209.92578%2021.1055L9.92578%205.67188L9.80859%202.17969C9.80859%201.62891%209.43359%201.25391%208.88281%201.25391C8.33203%201.25391%207.95703%201.62891%207.95703%202.17969L7.83984%205.67188L7.83984%2021.1055C7.83984%2021.7148%208.27344%2022.1367%208.88281%2022.1367Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "backward": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2022.0312%2017.918%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2217.918%22%20opacity%3D%220%22%20width%3D%2222.0312%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M21.6797%2016.2773L21.6797%201.61719C21.6797%200.515625%2021.0352%200%2020.2852%200C19.9453%200%2019.6055%200.09375%2019.2656%200.292969L6.94922%207.46484C6.07031%207.98047%205.73047%208.36719%205.73047%208.95312C5.73047%209.53906%206.07031%209.92578%206.94922%2010.4414L19.2656%2017.6133C19.6055%2017.8008%2019.9453%2017.9062%2020.2852%2017.9062C21.0352%2017.9062%2021.6797%2017.3789%2021.6797%2016.2773ZM4.23047%2017.8359C5.25%2017.8359%205.78906%2017.2969%205.78906%2016.2656L5.78906%201.62891C5.78906%200.597656%205.25%200.0585938%204.23047%200.0585938L1.55859%200.0585938C0.539062%200.0585938%200%200.550781%200%201.62891L0%2016.2656C0%2017.2969%200.539062%2017.8359%201.55859%2017.8359Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "battery": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21DOCTYPE%20svg%20PUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2035.0391%2018.234%22%3E%0A%20%3Cg%20transform%3D%22scale%281%2C%201.15%29%22%3E%0A%20%20%3Crect%20height%3D%2215.8555%22%20opacity%3D%220%22%20width%3D%2235.0391%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M6.24609%2015.8555L24.668%2015.8555C26.6719%2015.8555%2028.3594%2015.668%2029.5547%2014.4727C30.75%2013.2773%2030.9258%2011.6133%2030.9258%209.60938L30.9258%206.24609C30.9258%204.24219%2030.75%202.57812%2029.5547%201.38281C28.3594%200.1875%2026.6719%200%2024.668%200L6.22266%200C4.25391%200%202.56641%200.1875%201.37109%201.38281C0.175781%202.57812%200%204.25391%200%206.21094L0%209.60938C0%2011.6133%200.175781%2013.2773%201.37109%2014.4727C2.56641%2015.668%204.25391%2015.8555%206.24609%2015.8555ZM5.92969%2013.9688C4.72266%2013.9688%203.45703%2013.8047%202.74219%2013.1016C2.03906%2012.3867%201.88672%2011.1328%201.88672%209.92578L1.88672%205.95312C1.88672%204.72266%202.03906%203.46875%202.74219%202.75391C3.45703%202.03906%204.73438%201.88672%205.96484%201.88672L24.9961%201.88672C26.2031%201.88672%2027.4688%202.05078%2028.1719%202.75391C28.8867%203.46875%2029.0391%204.71094%2029.0391%205.91797L29.0391%209.92578C29.0391%2011.1328%2028.8867%2012.3867%2028.1719%2013.1016C27.4688%2013.8047%2026.2031%2013.9688%2024.9961%2013.9688ZM32.5195%2010.957C33.4453%2010.8984%2034.6875%209.71484%2034.6875%207.92188C34.6875%206.14062%2033.4453%204.95703%2032.5195%204.89844Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M5.30859%2012.6094L25.6172%2012.6094C26.4258%2012.6094%2026.8945%2012.4922%2027.2227%2012.1641C27.5391%2011.8359%2027.668%2011.3672%2027.668%2010.5586L27.668%205.29688C27.668%204.48828%2027.5391%204.01953%2027.2227%203.69141C26.8945%203.36328%2026.4141%203.24609%2025.6172%203.24609L5.34375%203.24609C4.5%203.24609%204.01953%203.36328%203.70312%203.69141C3.375%204.01953%203.25781%204.5%203.25781%205.32031L3.25781%2010.5586C3.25781%2011.3672%203.375%2011.8359%203.70312%2012.1641C4.03125%2012.4922%204.51172%2012.6094%205.30859%2012.6094Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "bedroom": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2030.0469%2019.793%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.793%22%20opacity%3D%220%22%20width%3D%2230.0469%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%2018.7734C0%2019.3828%200.386719%2019.7695%200.996094%2019.7695L1.69922%2019.7695C2.29688%2019.7695%202.69531%2019.3828%202.69531%2018.7734L2.69531%2017.0391C2.82422%2017.0742%203.21094%2017.0977%203.49219%2017.0977L26.2031%2017.0977C26.4844%2017.0977%2026.8711%2017.0742%2027%2017.0391L27%2018.7734C27%2019.3828%2027.3984%2019.7695%2027.9961%2019.7695L28.6992%2019.7695C29.3086%2019.7695%2029.6953%2019.3828%2029.6953%2018.7734L29.6953%2011.7891C29.6953%209.55078%2028.4531%208.32031%2026.2148%208.32031L3.48047%208.32031C1.24219%208.32031%200%209.55078%200%2011.7891Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.8125%206.64453L5.78906%206.64453L5.78906%204.95703C5.78906%203.86719%206.39844%203.26953%207.51172%203.26953L11.8828%203.26953C12.9844%203.26953%2013.5938%203.86719%2013.5938%204.95703L13.5938%206.64453L16.2539%206.64453L16.2539%204.95703C16.2539%203.86719%2016.8633%203.26953%2018.0352%203.26953L22.1367%203.26953C23.3086%203.26953%2023.918%203.86719%2023.918%204.95703L23.918%206.64453L26.9062%206.64453L26.9062%203.28125C26.9062%201.11328%2025.7344%200%2023.625%200L6.08203%200C3.97266%200%202.8125%201.11328%202.8125%203.28125Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "blinds-horizontal-closed": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2020.744%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2220.744%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.66635%203.31542L2.66635%205.56693C2.66635%205.98598%202.94853%206.2557%203.3718%206.2557L19.2511%206.2557C19.6971%206.2557%2019.9586%205.97563%2019.9586%205.55658L19.9586%203.30507C19.9586%202.88813%2019.6868%202.61841%2019.2511%202.61841L3.3718%202.61841C2.93818%202.61841%202.66635%202.89848%202.66635%203.31542ZM2.66635%207.86598L2.66635%2010.1382C2.66635%2010.5386%202.93818%2010.8063%203.3718%2010.8063L19.2614%2010.8063C19.6868%2010.8063%2019.9586%2010.5283%2019.9586%2010.1382L19.9586%207.85563C19.9586%207.45939%2019.6868%207.17932%2019.2614%207.17932L3.3718%207.17932C2.94853%207.17932%202.66635%207.45939%202.66635%207.86598ZM2.66635%2012.4186L2.66635%2014.6887C2.66635%2015.0995%202.93818%2015.3775%203.3718%2015.3775L19.2511%2015.3775C19.6971%2015.3775%2019.9586%2015.0995%2019.9586%2014.6887L19.9586%2012.4083C19.9586%2012.0203%2019.6971%2011.7402%2019.2511%2011.7402L3.3718%2011.7402C2.94853%2011.7402%202.66635%2012.0203%202.66635%2012.4186ZM2.66635%2016.9899L2.66635%2019.2393C2.66635%2019.6604%202.92783%2019.9302%203.36145%2019.9302L19.2407%2019.9302C19.6764%2019.9302%2019.9586%2019.6604%2019.9586%2019.2393L19.9586%2016.9899C19.9586%2016.5605%2019.6868%2016.3011%2019.2511%2016.3011L3.3718%2016.3011C2.92783%2016.3011%202.66635%2016.5708%202.66635%2016.9899Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.0232123%200.785347C0.0232123%201.21224%200.381668%201.57069%200.806449%201.57069L19.9586%201.57069C20.3937%201.57069%2020.744%201.21224%2020.744%200.785347C20.744%200.360566%2020.3937%200%2019.9586%200L0.806449%200C0.381668%200%200.0232123%200.360566%200.0232123%200.785347ZM0.806449%203.84511C1.17355%203.84511%201.48045%203.52997%201.48045%203.17323C1.48045%202.80613%201.17355%202.51169%200.806449%202.51169C0.441462%202.51169%200.14491%202.80613%200.14491%203.17323C0.14491%203.52997%200.441462%203.84511%200.806449%203.84511ZM0.806449%206.10074C1.17355%206.10074%201.48045%205.79595%201.48045%205.43921C1.48045%205.06176%201.17355%204.76732%200.806449%204.76732C0.441462%204.76732%200.14491%205.06176%200.14491%205.43921C0.14491%205.79595%200.441462%206.10074%200.806449%206.10074ZM0.806449%208.36059C1.17355%208.36059%201.48045%208.05369%201.48045%207.69695C1.48045%207.33196%201.17355%207.03541%200.806449%207.03541C0.441462%207.03541%200.14491%207.33196%200.14491%207.69695C0.14491%208.05369%200.441462%208.36059%200.806449%208.36059ZM0.806449%2010.6266C1.17355%2010.6266%201.48045%2010.3093%201.48045%209.95258C1.48045%209.58759%201.17355%209.29104%200.806449%209.29104C0.441462%209.29104%200.14491%209.58759%200.14491%209.95258C0.14491%2010.3093%200.441462%2010.6266%200.806449%2010.6266ZM0.806449%2012.8843C1.17355%2012.8843%201.48045%2012.5774%201.48045%2012.2207C1.48045%2011.8453%201.17355%2011.5488%200.806449%2011.5488C0.441462%2011.5488%200.14491%2011.8453%200.14491%2012.2207C0.14491%2012.5774%200.441462%2012.8843%200.806449%2012.8843ZM0.806449%2015.1399C1.17355%2015.1399%201.48045%2014.833%201.48045%2014.4784C1.48045%2014.1113%201.17355%2013.8148%200.806449%2013.8148C0.441462%2013.8148%200.14491%2014.1113%200.14491%2014.4784C0.14491%2014.833%200.441462%2015.1399%200.806449%2015.1399ZM0.806449%2019.9405C1.23123%2019.9405%201.5918%2019.58%201.5918%2019.1552L1.5918%2016.8578C1.5918%2016.4331%201.24369%2016.0725%200.806449%2016.0725C0.381668%2016.0725%200.0253225%2016.4331%200.0253225%2016.8578L0.0253225%2019.1552C0.0253225%2019.58%200.383778%2019.9405%200.806449%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "blinds-horizontal-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2020.744%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2220.744%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.0852%204.61809L17.9327%204.61809C18.4054%204.61809%2018.702%204.51228%2018.9592%204.2715L19.7989%203.43963C20.0644%203.17202%2019.9772%202.63298%2019.492%202.63298L4.65699%202.63298C4.18427%202.63298%203.88772%202.7388%203.63046%202.97958L2.79076%203.80933C2.52526%204.07694%202.61248%204.61809%203.0852%204.61809ZM3.0852%209.65904L17.9327%209.65904C18.4054%209.65904%2018.702%209.56358%2018.9592%209.31245L19.7989%208.48058C20.0644%208.22332%2019.9772%207.68429%2019.492%207.68429L4.65699%207.68429C4.18427%207.68429%203.88772%207.77975%203.63046%208.03088L2.79076%208.86275C2.52526%209.12824%202.61248%209.65904%203.0852%209.65904ZM3.0852%2014.6793L17.9327%2014.6793C18.4054%2014.6793%2018.702%2014.5631%2018.9592%2014.3223L19.7989%2013.4926C20.0644%2013.2353%2019.9772%2012.6942%2019.492%2012.6942L4.65699%2012.6942C4.18427%2012.6942%203.88772%2012.7897%203.63046%2013.0408L2.79076%2013.8726C2.52526%2014.1403%202.61248%2014.6793%203.0852%2014.6793ZM3.0852%2019.7224L17.9327%2019.7224C18.4054%2019.7224%2018.702%2019.6062%2018.9592%2019.3551L19.7989%2018.5335C20.0644%2018.2659%2019.9772%2017.7269%2019.492%2017.7269L4.65699%2017.7269C4.18427%2017.7269%203.88772%2017.8327%203.63046%2018.0838L2.79076%2018.9136C2.52526%2019.1709%202.61248%2019.7224%203.0852%2019.7224Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.0232123%200.785347C0.0232123%201.21224%200.381668%201.57069%200.806449%201.57069L19.9586%201.57069C20.3937%201.57069%2020.744%201.21224%2020.744%200.785347C20.744%200.360566%2020.3937%200%2019.9586%200L0.806449%200C0.381668%200%200.0232123%200.360566%200.0232123%200.785347ZM0.806449%203.84511C1.17355%203.84511%201.48045%203.52997%201.48045%203.17323C1.48045%202.80613%201.17355%202.51169%200.806449%202.51169C0.441462%202.51169%200.14491%202.80613%200.14491%203.17323C0.14491%203.52997%200.441462%203.84511%200.806449%203.84511ZM0.806449%206.10074C1.17355%206.10074%201.48045%205.79595%201.48045%205.43921C1.48045%205.06176%201.17355%204.76732%200.806449%204.76732C0.441462%204.76732%200.14491%205.06176%200.14491%205.43921C0.14491%205.79595%200.441462%206.10074%200.806449%206.10074ZM0.806449%208.36059C1.17355%208.36059%201.48045%208.05369%201.48045%207.69695C1.48045%207.33196%201.17355%207.03541%200.806449%207.03541C0.441462%207.03541%200.14491%207.33196%200.14491%207.69695C0.14491%208.05369%200.441462%208.36059%200.806449%208.36059ZM0.806449%2010.6266C1.17355%2010.6266%201.48045%2010.3093%201.48045%209.95258C1.48045%209.58759%201.17355%209.29104%200.806449%209.29104C0.441462%209.29104%200.14491%209.58759%200.14491%209.95258C0.14491%2010.3093%200.441462%2010.6266%200.806449%2010.6266ZM0.806449%2012.8843C1.17355%2012.8843%201.48045%2012.5774%201.48045%2012.2207C1.48045%2011.8453%201.17355%2011.5488%200.806449%2011.5488C0.441462%2011.5488%200.14491%2011.8453%200.14491%2012.2207C0.14491%2012.5774%200.441462%2012.8843%200.806449%2012.8843ZM0.806449%2015.1399C1.17355%2015.1399%201.48045%2014.833%201.48045%2014.4784C1.48045%2014.1113%201.17355%2013.8148%200.806449%2013.8148C0.441462%2013.8148%200.14491%2014.1113%200.14491%2014.4784C0.14491%2014.833%200.441462%2015.1399%200.806449%2015.1399ZM0.806449%2019.9405C1.23123%2019.9405%201.5918%2019.58%201.5918%2019.1552L1.5918%2016.8578C1.5918%2016.4331%201.24369%2016.0725%200.806449%2016.0725C0.381668%2016.0725%200.0253225%2016.4331%200.0253225%2016.8578L0.0253225%2019.1552C0.0253225%2019.58%200.383778%2019.9405%200.806449%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "blinds-vertical-closed": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2020.744%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2220.744%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.87546%2019.9405L5.99713%2019.9405C6.41829%2019.9405%206.6859%2019.6583%206.6859%2019.233L6.6859%203.16458C6.6859%202.72885%206.41829%202.45702%205.99713%202.45702L3.87546%202.45702C3.46676%202.45702%203.18669%202.72885%203.18669%203.16458L3.18669%2019.233C3.18669%2019.6583%203.46676%2019.9405%203.87546%2019.9405ZM8.29618%2019.9405L10.4282%2019.9405C10.8287%2019.9405%2011.1087%2019.6583%2011.1087%2019.233L11.1087%203.16458C11.1087%202.72885%2010.8287%202.45702%2010.4282%202.45702L8.29618%202.45702C7.88959%202.45702%207.60952%202.72885%207.60952%203.16458L7.60952%2019.233C7.60952%2019.6583%207.88959%2019.9405%208.29618%2019.9405ZM12.719%2019.9405L14.851%2019.9405C15.2597%2019.9405%2015.5295%2019.6583%2015.5295%2019.233L15.5295%203.16458C15.5295%202.72885%2015.2597%202.45702%2014.851%202.45702L12.719%202.45702C12.3103%202.45702%2012.0406%202.72885%2012.0406%203.16458L12.0406%2019.233C12.0406%2019.6583%2012.3103%2019.9405%2012.719%2019.9405ZM17.1397%2019.9405L19.2614%2019.9405C19.6826%2019.9405%2019.9523%2019.6583%2019.9523%2019.233L19.9523%203.16458C19.9523%202.72885%2019.6826%202.45702%2019.2614%202.45702L17.1397%202.45702C16.7331%202.45702%2016.4531%202.72885%2016.4531%203.16458L16.4531%2019.233C16.4531%2019.6583%2016.7331%2019.9405%2017.1397%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.0232123%200.785347C0.0232123%201.21224%200.381668%201.57069%200.806449%201.57069L19.9586%201.57069C20.3937%201.57069%2020.744%201.21224%2020.744%200.785347C20.744%200.360566%2020.3937%200%2019.9586%200L0.806449%200C0.381668%200%200.0232123%200.360566%200.0232123%200.785347ZM0.806449%203.84511C1.17355%203.84511%201.48045%203.52997%201.48045%203.17323C1.48045%202.80613%201.17355%202.51169%200.806449%202.51169C0.441462%202.51169%200.14491%202.80613%200.14491%203.17323C0.14491%203.52997%200.441462%203.84511%200.806449%203.84511ZM0.806449%206.10074C1.17355%206.10074%201.48045%205.79595%201.48045%205.43921C1.48045%205.06176%201.17355%204.76732%200.806449%204.76732C0.441462%204.76732%200.14491%205.06176%200.14491%205.43921C0.14491%205.79595%200.441462%206.10074%200.806449%206.10074ZM0.806449%208.36059C1.17355%208.36059%201.48045%208.05369%201.48045%207.69695C1.48045%207.33196%201.17355%207.03541%200.806449%207.03541C0.441462%207.03541%200.14491%207.33196%200.14491%207.69695C0.14491%208.05369%200.441462%208.36059%200.806449%208.36059ZM0.806449%2010.6266C1.17355%2010.6266%201.48045%2010.3093%201.48045%209.95258C1.48045%209.58759%201.17355%209.29104%200.806449%209.29104C0.441462%209.29104%200.14491%209.58759%200.14491%209.95258C0.14491%2010.3093%200.441462%2010.6266%200.806449%2010.6266ZM0.806449%2012.8843C1.17355%2012.8843%201.48045%2012.5774%201.48045%2012.2207C1.48045%2011.8453%201.17355%2011.5488%200.806449%2011.5488C0.441462%2011.5488%200.14491%2011.8453%200.14491%2012.2207C0.14491%2012.5774%200.441462%2012.8843%200.806449%2012.8843ZM0.806449%2015.1399C1.17355%2015.1399%201.48045%2014.833%201.48045%2014.4784C1.48045%2014.1113%201.17355%2013.8148%200.806449%2013.8148C0.441462%2013.8148%200.14491%2014.1113%200.14491%2014.4784C0.14491%2014.833%200.441462%2015.1399%200.806449%2015.1399ZM0.806449%2019.9405C1.23123%2019.9405%201.5918%2019.58%201.5918%2019.1552L1.5918%2016.8578C1.5918%2016.4331%201.24369%2016.0725%200.806449%2016.0725C0.381668%2016.0725%200.0253225%2016.4331%200.0253225%2016.8578L0.0253225%2019.1552C0.0253225%2019.58%200.383778%2019.9405%200.806449%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "blinds-vertical-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2020.744%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2220.744%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.19282%2017.9374C3.19282%2018.4122%203.29864%2018.7088%203.54976%2018.9536L4.38163%2019.7954C4.63889%2020.0713%205.18828%2019.984%205.18828%2019.4989L5.18828%204.47047C5.18828%203.99776%205.08246%203.70121%204.83133%203.44395L4.00158%202.60424C3.74432%202.33874%203.19282%202.42597%203.19282%202.91115ZM8.12042%2017.9374C8.12042%2018.4122%208.22624%2018.7088%208.47736%2018.9536L9.30923%2019.7954C9.56438%2020.0713%2010.1159%2019.984%2010.1159%2019.4989L10.1159%204.47047C10.1159%203.99776%2010.0101%203.70121%209.75893%203.44395L8.92707%202.60424C8.66981%202.33874%208.12042%202.42597%208.12042%202.91115ZM13.048%2017.9374C13.048%2018.4122%2013.1517%2018.7088%2013.4029%2018.9536L14.2244%2019.7954C14.492%2020.0713%2015.031%2019.984%2015.031%2019.4989L15.031%204.47047C15.031%203.99776%2014.9355%203.70121%2014.6844%203.44395L13.8547%202.60424C13.5871%202.33874%2013.048%202.42597%2013.048%202.91115ZM17.9735%2017.9374C17.9735%2018.4122%2018.0793%2018.7088%2018.3201%2018.9536L19.152%2019.7954C19.4175%2020.0713%2019.9586%2019.984%2019.9586%2019.4989L19.9586%204.47047C19.9586%203.99776%2019.8528%203.70121%2019.612%203.44395L18.7802%202.60424C18.5125%202.33874%2017.9735%202.42597%2017.9735%202.91115Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.0232123%200.785347C0.0232123%201.21224%200.381668%201.57069%200.806449%201.57069L19.9586%201.57069C20.3937%201.57069%2020.744%201.21224%2020.744%200.785347C20.744%200.360566%2020.3937%200%2019.9586%200L0.806449%200C0.381668%200%200.0232123%200.360566%200.0232123%200.785347ZM0.806449%203.84511C1.17355%203.84511%201.48045%203.52997%201.48045%203.17323C1.48045%202.80613%201.17355%202.51169%200.806449%202.51169C0.441462%202.51169%200.14491%202.80613%200.14491%203.17323C0.14491%203.52997%200.441462%203.84511%200.806449%203.84511ZM0.806449%206.10074C1.17355%206.10074%201.48045%205.79595%201.48045%205.43921C1.48045%205.06176%201.17355%204.76732%200.806449%204.76732C0.441462%204.76732%200.14491%205.06176%200.14491%205.43921C0.14491%205.79595%200.441462%206.10074%200.806449%206.10074ZM0.806449%208.36059C1.17355%208.36059%201.48045%208.05369%201.48045%207.69695C1.48045%207.33196%201.17355%207.03541%200.806449%207.03541C0.441462%207.03541%200.14491%207.33196%200.14491%207.69695C0.14491%208.05369%200.441462%208.36059%200.806449%208.36059ZM0.806449%2010.6266C1.17355%2010.6266%201.48045%2010.3093%201.48045%209.95258C1.48045%209.58759%201.17355%209.29104%200.806449%209.29104C0.441462%209.29104%200.14491%209.58759%200.14491%209.95258C0.14491%2010.3093%200.441462%2010.6266%200.806449%2010.6266ZM0.806449%2012.8843C1.17355%2012.8843%201.48045%2012.5774%201.48045%2012.2207C1.48045%2011.8453%201.17355%2011.5488%200.806449%2011.5488C0.441462%2011.5488%200.14491%2011.8453%200.14491%2012.2207C0.14491%2012.5774%200.441462%2012.8843%200.806449%2012.8843ZM0.806449%2015.1399C1.17355%2015.1399%201.48045%2014.833%201.48045%2014.4784C1.48045%2014.1113%201.17355%2013.8148%200.806449%2013.8148C0.441462%2013.8148%200.14491%2014.1113%200.14491%2014.4784C0.14491%2014.833%200.441462%2015.1399%200.806449%2015.1399ZM0.806449%2019.9405C1.23123%2019.9405%201.5918%2019.58%201.5918%2019.1552L1.5918%2016.8578C1.5918%2016.4331%201.24369%2016.0725%200.806449%2016.0725C0.381668%2016.0725%200.0253225%2016.4331%200.0253225%2016.8578L0.0253225%2019.1552C0.0253225%2019.58%200.383778%2019.9405%200.806449%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "clock": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20d%3D%22M%201%2C10%20A%209%2C9%200%201%2C1%2019%2C10%20A%209%2C9%200%201%2C1%201%2C10%20Z%20M%209.35%2C10.65%20L%2015.0%2C10.65%20L%2015.0%2C9.35%20L%2010.65%2C9.35%20L%2010.65%2C5.9%20L%209.35%2C5.9%20Z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E",
  "close": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2250%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2050%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M1.653%2050%200%2048.347%2023.347%2025%200%201.653%201.653%200%2025%2023.347%2048.347%200%2050%201.653%2026.653%2025%2050%2048.347%2048.347%2050%2025%2026.653%201.653%2050Z%22/%3E%0A%3C/svg%3E%0A",
  "console": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2270%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2070%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M10.267%2050c-2.885%200-5.317-.992-7.297-2.976C.99%2045.04%200%2042.59%200%2039.676c0-.43.014-.844.042-1.24.029-.398.1-.823.213-1.276L7.382%208.588c.664-2.555%202.016-4.625%204.056-6.21S15.803%200%2018.412%200h33.091c2.61%200%204.934.793%206.974%202.378s3.392%203.655%204.056%206.21l7.128%2028.572c.113.453.198.893.254%201.318.057.425.085.853.085%201.283%200%202.914-1.004%205.35-3.012%207.305C64.98%2049.022%2062.535%2050%2059.654%2050c-1.983%200-3.795-.524-5.436-1.573a10.738%2010.738%200%200%201-3.818-4.21l-2.46-5.016a4.517%204.517%200%200%200-2.037-2.105%206.196%206.196%200%200%200-2.885-.701H26.897a6.375%206.375%200%200%200-2.874.68c-.912.453-1.595%201.162-2.047%202.126l-2.46%205.017c-.85%201.814-2.113%203.231-3.792%204.251A10.32%2010.32%200%200%201%2010.267%2050Zm.212-1.87c1.555%200%203.003-.41%204.341-1.231a7.641%207.641%200%200%200%202.998-3.362l2.376-4.932c.664-1.287%201.592-2.29%202.783-3.006a7.467%207.467%200%200%201%203.92-1.075h16.121c1.454%200%202.766.388%203.936%201.163a9.213%209.213%200%200%201%202.852%203.004l2.376%204.846a7.627%207.627%200%200%200%203.005%203.362%208.2%208.2%200%200%200%204.35%201.23c2.358%200%204.366-.793%206.024-2.38%201.658-1.588%202.487-3.544%202.487-5.868%200-.284-.084-1.049-.254-2.296L60.667%209.099C60.1%207%2058.97%205.272%2057.273%203.912c-1.697-1.361-3.62-2.041-5.77-2.041h-33.09c-2.21%200-4.162.678-5.858%202.035-1.696%201.357-2.798%203.088-3.307%205.193L2.121%2037.585c0%20.227-.085.964-.254%202.21%200%202.411.841%204.403%202.525%205.975%201.683%201.573%203.712%202.36%206.087%202.36Zm29.586-27.807c.555%200%201.044-.218%201.468-.654.425-.436.637-.932.637-1.488%200-.556-.218-1.047-.653-1.472-.435-.425-.93-.638-1.485-.638-.554%200-1.044.218-1.468.654-.425.437-.637.933-.637%201.488%200%20.557.218%201.047.653%201.472.435.425.93.638%201.485.638Zm6.788-6.803c.554%200%201.044-.218%201.468-.653.425-.437.637-.933.637-1.489s-.218-1.046-.653-1.472c-.435-.425-.93-.637-1.485-.637s-1.044.218-1.468.654c-.425.436-.637.932-.637%201.488%200%20.556.218%201.046.653%201.472.435.425.93.637%201.484.637Zm0%2013.606c.554%200%201.044-.218%201.468-.654.425-.437.637-.933.637-1.488%200-.556-.218-1.047-.653-1.472-.435-.425-.93-.638-1.485-.638s-1.044.218-1.468.654c-.425.437-.637.933-.637%201.488%200%20.556.218%201.047.653%201.472.435.425.93.638%201.484.638Zm6.787-6.803c.555%200%201.045-.218%201.47-.654.423-.436.636-.932.636-1.488%200-.556-.218-1.047-.653-1.472-.436-.425-.93-.638-1.485-.638s-1.044.218-1.469.654c-.424.437-.636.933-.636%201.488%200%20.557.218%201.047.653%201.472.435.425.93.638%201.484.638ZM23.067%2025.17c.29%200%20.55-.096.775-.289a.92.92%200%200%200%20.34-.731v-4.932h4.836c.277%200%20.53-.096.76-.286a.9.9%200%200%200%20.343-.723c0-.291-.114-.55-.343-.777-.23-.227-.483-.34-.76-.34h-4.836v-4.847c0-.278-.115-.532-.345-.761-.23-.23-.491-.345-.782-.345a.88.88%200%200%200-.715.345%201.18%201.18%200%200%200-.28.76v4.848h-4.92a.91.91%200%200%200-.73.346%201.19%201.19%200%200%200-.289.783c0%20.291.096.53.289.717.192.186.435.28.73.28h4.92v4.932a1%201%200%200%200%20.286.731c.19.193.43.29.72.29Z%22/%3E%0A%3C/svg%3E%0A",
  "cooling": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2021.1344%2023.6842%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2223.6842%22%20opacity%3D%220%22%20width%3D%2221.1344%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M9.85195%2012.133L9.80944%2012.8353L6.28398%2015.1761L5.0072%2015.9134L5.01836%2019.1487C5.01836%2019.5941%204.69023%2019.9456%204.2332%2019.9339C3.78789%2019.9456%203.47148%2019.5941%203.4832%2019.1487L3.46662%2016.803L1.29179%2018.0589C0.834762%2018.3167%200.37773%2018.1995%200.131637%2017.7425C-0.126176%2017.2972%200.00273026%2016.8636%200.448043%2016.5941L2.62236%2015.3436L0.588668%2014.1566C0.213668%2013.9456%200.0730428%2013.5003%200.295699%2013.1136C0.506637%2012.7034%200.998824%2012.6097%201.36211%2012.8323L4.16512%2014.4563L5.44023%2013.723L9.23374%2011.8262ZM17.2879%204.51202L17.3045%206.8762L19.491%205.61359C19.9246%205.35577%2020.3816%205.46124%2020.6277%205.90655C20.909%206.35187%2020.7801%206.8089%2020.323%207.06671L18.1474%208.32816L20.1824%209.51593C20.5574%209.72687%2020.698%2010.1722%2020.4871%2010.5472C20.2644%2010.9573%2019.784%2011.0628%2019.409%2010.8401L16.6165%209.21582L15.3309%209.96124L11.5561%2011.8297L10.9109%2011.5071L10.9548%2010.8338L14.4988%208.4964L15.7639%207.76585L15.7527%204.51202C15.7527%204.07843%2016.0809%203.72687%2016.5496%203.73859C16.9832%203.72687%2017.2996%204.07843%2017.2879%204.51202Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M15.3426%2013.723L16.6058%2014.4512L19.409%2012.8206C19.784%2012.598%2020.2644%2012.6917%2020.4871%2013.1019C20.698%2013.4886%2020.5574%2013.9339%2020.1824%2014.1448L18.1412%2015.3363L20.323%2016.5941C20.7684%2016.8519%2020.909%2017.2972%2020.6512%2017.7308C20.4051%2018.1995%2019.9363%2018.305%2019.491%2018.0589L17.3044%2016.7992L17.2879%2019.137C17.2996%2019.5823%2016.9832%2019.9339%2016.5496%2019.9222C16.0809%2019.9339%2015.7527%2019.5823%2015.7527%2019.137L15.7639%2015.9116L14.4871%2015.1761L10.9536%2012.8204L10.8894%2011.8362L10.9109%2011.5071ZM5.01836%204.52374L5.00726%207.75372L6.27226%208.48468L9.8084%2010.82L9.86992%2011.8362L9.85195%2012.133L5.45195%209.94952L4.18477%209.21652L1.36211%2010.8519C0.998824%2011.0745%200.506637%2010.9691%200.295699%2010.5589C0.0730428%2010.1839%200.213668%209.73859%200.588668%209.52765L2.64637%208.32662L0.448043%207.05499C-0.00898849%206.8089-0.126176%206.34015%200.143355%205.90655C0.412887%205.46124%200.84648%205.35577%201.30351%205.61359L3.46672%206.86355L3.4832%204.52374C3.47148%204.09015%203.78789%203.73859%204.2332%203.7503C4.69023%203.73859%205.01836%204.09015%205.01836%204.52374Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M10.3738%2023.6722C10.8894%2023.6839%2011.2293%2023.3558%2011.2293%2022.8167L11.2293%2017.0511L10.8894%2011.8362L11.2293%206.6214L11.2293%200.844054C11.2293%200.31671%2010.8894-0.011415%2010.3738%200.000303796C9.86992%200.000303796%209.55351%200.328429%209.55351%200.844054L9.55351%206.60968L9.86992%2011.8362L9.55351%2017.0628L9.55351%2022.8167C9.55351%2023.3441%209.86992%2023.6722%2010.3738%2023.6722ZM14.323%202.44952C14.1004%202.0628%2013.6434%201.96905%2013.2684%202.19171L10.3855%203.84405L7.50273%202.19171C7.12773%201.96905%206.6707%202.0628%206.44804%202.44952C6.20195%202.84796%206.36601%203.30499%206.72929%203.52765L9.69414%205.21515C9.90507%205.33234%2010.1394%205.39093%2010.3855%205.39093C10.6199%205.39093%2010.8777%205.33234%2011.0769%205.21515L14.0418%203.52765C14.4168%203.30499%2014.5691%202.84796%2014.323%202.44952ZM6.44804%2021.223C6.6707%2021.6097%207.12773%2021.6917%207.50273%2021.4808L10.3855%2019.8284L13.2684%2021.4808C13.6434%2021.6917%2014.1004%2021.6097%2014.323%2021.223C14.5691%2020.8245%2014.4168%2020.3675%2014.0418%2020.1448L11.0769%2018.4573C10.866%2018.3401%2010.6316%2018.2816%2010.3855%2018.2816C10.1512%2018.2816%209.89336%2018.3401%209.69414%2018.4573L6.72929%2020.1448C6.36601%2020.3675%206.20195%2020.8245%206.44804%2021.223Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "curtain-closed": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2029.8945%2025.6992%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.6992%22%20opacity%3D%220%22%20width%3D%2229.8945%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.35156%201.06641L4.33594%201.06641L4.33594%202.95313L3.35156%202.95312C3.04688%203.48047%202.46094%203.83203%201.81641%203.83203C0.820312%203.83203%200%203.01172%200%202.00391C0%201.00781%200.820312%200.1875%201.81641%200.1875C2.46094%200.1875%203.04688%200.550781%203.35156%201.06641ZM29.543%202.00391C29.543%203.01172%2028.7227%203.83203%2027.7266%203.83203C27.082%203.83203%2026.4961%203.48047%2026.1914%202.95312L25.207%202.95313L25.207%201.06641L26.1914%201.06641C26.4961%200.550781%2027.082%200.1875%2027.7266%200.1875C28.7227%200.1875%2029.543%201.00781%2029.543%202.00391ZM15.5742%202.95313L13.9688%202.95313L13.9688%201.06641L15.5742%201.06641Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M5.16797%2024.8086L13.1367%2024.8086C13.6172%2024.8086%2013.9688%2024.457%2013.9688%2023.9648L13.9688%200.855469C13.9688%200.363281%2013.6172%200%2013.1367%200L5.16797%200C4.6875%200%204.33594%200.363281%204.33594%200.855469L4.33594%2023.9648C4.33594%2024.457%204.6875%2024.8086%205.16797%2024.8086ZM16.4062%2024.8086L24.375%2024.8086C24.8555%2024.8086%2025.207%2024.457%2025.207%2023.9648L25.207%200.855469C25.207%200.363281%2024.8555%200%2024.375%200L16.4062%200C15.9258%200%2015.5742%200.363281%2015.5742%200.855469L15.5742%2023.9648C15.5742%2024.457%2015.9258%2024.8086%2016.4062%2024.8086Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "curtain-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2029.8945%2025.6992%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.6992%22%20opacity%3D%220%22%20width%3D%2229.8945%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.35156%201.06641L4.33594%201.06641L4.33594%202.95313L3.35156%202.95312C3.04688%203.48047%202.46094%203.83203%201.81641%203.83203C0.820312%203.83203%200%203.01172%200%202.00391C0%201.00781%200.820312%200.1875%201.81641%200.1875C2.46094%200.1875%203.04688%200.550781%203.35156%201.06641ZM29.543%202.00391C29.543%203.01172%2028.7227%203.83203%2027.7266%203.83203C27.082%203.83203%2026.4961%203.48047%2026.1914%202.95312L25.207%202.95313L25.207%201.06641L26.1914%201.06641C26.4961%200.550781%2027.082%200.1875%2027.7266%200.1875C28.7227%200.1875%2029.543%201.00781%2029.543%202.00391ZM21.5039%202.95313L8.03906%202.95313L8.03906%201.06641L21.5039%201.06641Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M5.16797%2024.8086L7.20703%2024.8086C7.6875%2024.8086%208.03906%2024.457%208.03906%2023.9648L8.03906%200.855469C8.03906%200.363281%207.6875%200%207.20703%200L5.16797%200C4.6875%200%204.33594%200.363281%204.33594%200.855469L4.33594%2023.9648C4.33594%2024.457%204.6875%2024.8086%205.16797%2024.8086ZM22.3359%2024.8086L24.375%2024.8086C24.8555%2024.8086%2025.207%2024.457%2025.207%2023.9648L25.207%200.855469C25.207%200.363281%2024.8555%200%2024.375%200L22.3359%200C21.8555%200%2021.5039%200.363281%2021.5039%200.855469L21.5039%2023.9648C21.5039%2024.457%2021.8555%2024.8086%2022.3359%2024.8086Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "decrease": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2021%2012.8%22%3E%3Cpath%20d%3D%22M1.9%202.2%20L10.5%2010.6%20L19.1%202.2%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222.9%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E%0A",
  "default": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2028%2028%22%3E%0A%20%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-opacity%3D%220.85%22%20stroke-width%3D%222.2%22/%3E%0A%20%3Ctext%20x%3D%2214%22%20y%3D%2219%22%20font-family%3D%22-apple-system%2Csystem-ui%2Csans-serif%22%20font-size%3D%2214%22%20font-weight%3D%22600%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22%20text-anchor%3D%22middle%22%3E%3F%3C/text%3E%0A%3C/svg%3E%0A",
  "door-closed": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2018.2109%2024.8789%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.8789%22%20opacity%3D%220%22%20width%3D%2218.2109%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.9375%2024.8672C1.46484%2024.8672%201.88672%2024.4453%201.88672%2023.9297L1.88672%202.50781C1.88672%202.13281%202.13281%201.88672%202.48438%201.88672L15.375%201.88672C15.7266%201.88672%2015.9727%202.13281%2015.9727%202.50781L15.9727%2023.9297C15.9727%2024.4453%2016.3945%2024.8672%2016.9219%2024.8672C17.4375%2024.8672%2017.8594%2024.4453%2017.8594%2023.9297L17.8594%202.39062C17.8594%200.960938%2016.8867%200%2015.4102%200L2.44922%200C0.984375%200%200%200.960938%200%202.39062L0%2023.9297C0%2024.4453%200.421875%2024.8672%200.9375%2024.8672Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.65625%2024.457L14.2148%2024.457C14.4258%2024.457%2014.6016%2024.2695%2014.6016%2024.0586L14.6016%203.64453C14.6016%203.42188%2014.4258%203.24609%2014.2148%203.24609L3.65625%203.24609C3.43359%203.24609%203.25781%203.42188%203.25781%203.64453L3.25781%2024.0586C3.25781%2024.2695%203.43359%2024.457%203.65625%2024.457ZM11.8125%2015.0352C11.2969%2015.0352%2010.875%2014.6133%2010.875%2014.0977C10.875%2013.5703%2011.2969%2013.1602%2011.8125%2013.1602C12.3398%2013.1602%2012.75%2013.5703%2012.75%2014.0977C12.75%2014.6133%2012.3398%2015.0352%2011.8125%2015.0352Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "door-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2018.2109%2024.8789%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.8789%22%20opacity%3D%220%22%20width%3D%2218.2109%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%2023.9297C0%2024.4453%200.421875%2024.8672%200.9375%2024.8672C1.46484%2024.8672%201.88672%2024.4453%201.88672%2023.9297L1.88672%202.50781C1.88672%202.13281%202.13281%201.88672%202.48438%201.88672L15.375%201.88672C15.7266%201.88672%2015.9727%202.13281%2015.9727%202.50781L15.9727%2023.9297C15.9727%2024.4453%2016.3945%2024.8672%2016.9219%2024.8672C17.4375%2024.8672%2017.8594%2024.4453%2017.8594%2023.9297L17.8594%202.39062C17.8594%200.960938%2016.8867%200%2015.4102%200L2.44922%200C0.984375%200%200%200.960938%200%202.39062Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.25781%2024.1992C3.25781%2024.4219%203.44531%2024.5391%203.66797%2024.4453L7.34766%2022.8164C7.64062%2022.6875%207.75781%2022.5938%207.75781%2022.2891L7.75781%205.40234C7.75781%205.10938%207.64062%205.00391%207.35938%204.88672L3.66797%203.24609C3.44531%203.15234%203.25781%203.26953%203.25781%203.50391Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "doorbell": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.4725%20-0.8033%2016.695%2028.3839%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2228.3839%22%20opacity%3D%220%22%20width%3D%2216.695%22%20x%3D%22-0.4725%22%20y%3D%22-0.8033%22/%3E%0A%20%20%3Cpath%20d%3D%22M15.3984%207.33594L15.3984%2019.4297C15.3984%2023.7305%2012.2227%2026.7656%207.69922%2026.7656C3.1875%2026.7656%200%2023.7305%200%2019.4297L0%207.33594C0%203.02344%203.1875%200%207.69922%200C12.2227%200%2015.3984%203.02344%2015.3984%207.33594ZM3.21094%2018.8906C3.21094%2021.3984%205.19141%2023.3789%207.69922%2023.3789C10.207%2023.3789%2012.1758%2021.3984%2012.1758%2018.8906C12.1758%2016.3828%2010.207%2014.4141%207.69922%2014.4141C5.19141%2014.4141%203.21094%2016.3828%203.21094%2018.8906ZM10.582%2018.8906C10.582%2020.5312%209.32812%2021.7852%207.69922%2021.7852C6.05859%2021.7852%204.80469%2020.5312%204.80469%2018.8906C4.80469%2017.25%206.05859%2015.9961%207.69922%2015.9961C9.32812%2015.9961%2010.582%2017.25%2010.582%2018.8906ZM3.21094%207.83984C3.21094%2010.3477%205.19141%2012.3164%207.69922%2012.3164C10.207%2012.3164%2012.1758%2010.3477%2012.1758%207.83984C12.1758%205.33203%2010.207%203.35156%207.69922%203.35156C5.19141%203.35156%203.21094%205.33203%203.21094%207.83984ZM9.33984%207.83984C9.33984%208.77734%208.625%209.50391%207.69922%209.50391C6.77344%209.50391%206.04688%208.77734%206.04688%207.83984C6.04688%206.90234%206.77344%206.17578%207.69922%206.17578C8.625%206.17578%209.33984%206.90234%209.33984%207.83984Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "electric": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2245%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2045%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M15.633%2050v-5.93c-4.578-1.464-8.328-4.148-11.25-8.052C1.461%2032.113%200%2027.623%200%2022.548c0-3.124.584-6.052%201.753-8.785%201.17-2.733%202.776-5.125%204.822-7.174%202.045-2.05%204.432-3.66%207.159-4.832C16.46.586%2019.359%200%2022.427%200c3.117%200%206.039.586%208.766%201.757%202.727%201.171%205.114%202.782%207.16%204.832%202.045%202.05%203.664%204.44%204.857%207.174%201.193%202.733%201.79%205.661%201.79%208.785%200%205.026-1.461%209.492-4.383%2013.396-2.922%203.905-6.672%206.589-11.25%208.053V50H27.76v-5.49a24.83%2024.83%200%200%201-2.63.439%2024.419%2024.419%200%200%201-5.333%200%2021.519%2021.519%200%200%201-2.557-.44V50h-1.607Zm6.867-6.369c5.796%200%2010.727-2.038%2014.793-6.113%204.067-4.075%206.1-9.016%206.1-14.824s-2.033-10.75-6.1-14.824C33.227%203.795%2028.296%201.757%2022.5%201.757c-5.796%200-10.726%202.038-14.793%206.113-4.067%204.075-6.1%209.016-6.1%2014.824s2.033%2010.75%206.1%2014.824c4.067%204.075%208.997%206.113%2014.793%206.113Zm-9.789-28.916h19.578v-1.611H12.711v1.61Zm7.451%2022.693%205.552-5.563-3.652-3.66%204.164-4.173-1.388-1.391-5.552%205.564%203.652%203.66-4.164%204.173%201.388%201.39Z%22/%3E%0A%3C/svg%3E%0A",
  "energy": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2016.8633%2026.3734%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2226.3734%22%20opacity%3D%220%22%20width%3D%2216.8633%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%2014.5402C0%2014.9972%200.351562%2015.3371%200.84375%2015.3371L7.46484%2015.3371L3.97266%2024.8293C3.51562%2026.0363%204.76953%2026.6808%205.55469%2025.6965L16.207%2012.384C16.4062%2012.1379%2016.5117%2011.9035%2016.5117%2011.634C16.5117%2011.1887%2016.1602%2010.8371%2015.668%2010.8371L9.04688%2010.8371L12.5391%201.34491C12.9961%200.137874%2011.7422-0.506657%2010.957%200.489437L0.304688%2013.7902C0.105469%2014.048%200%2014.2824%200%2014.5402Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "exclamation": "data:image/svg+xml,%3C?xml%20version=%221.0%22%20encoding=%22UTF-8%22?%3E%0A%3C!--Generator:%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C!DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version=%221.1%22%20xmlns=%22http://www.w3.org/2000/svg%22%20xmlns:xlink=%22http://www.w3.org/1999/xlink%22%20viewBox=%220%200%2020.4656%2018.6498%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height=%2218.6498%22%20opacity=%220%22%20width=%2220.4656%22%20x=%220%22%20y=%220%22/%3E%0A%20%20%3Cpath%20d=%22M2.66464%2018.5493L17.8009%2018.5493C19.4592%2018.5493%2020.4656%2017.3912%2020.4656%2015.8952C20.4656%2015.4405%2020.3327%2014.9609%2020.0835%2014.5247L12.5082%201.33001C11.9998%200.450103%2011.1302%200%2010.2338%200C9.33535%200%208.45545%200.450103%207.95741%201.33001L0.382069%2014.5247C0.122499%2014.9712%201.55431e-15%2015.4405%201.55431e-15%2015.8952C1.55431e-15%2017.3912%201.00642%2018.5493%202.66464%2018.5493ZM2.6771%2017.0097C1.99688%2017.0097%201.57491%2016.4775%201.57491%2015.8931C1.57491%2015.6995%201.62285%2015.4684%201.72907%2015.2727L9.29195%202.07184C9.49574%201.7162%209.86997%201.5521%2010.2338%201.5521C10.5853%201.5521%2010.9491%201.7162%2011.1633%202.07184L18.7262%2015.283C18.8324%2015.4788%2018.8803%2015.6995%2018.8803%2015.8931C18.8803%2016.4775%2018.4584%2017.0097%2017.7781%2017.0097Z%22%20fill=%22white%22%20fill-opacity=%220.425%22/%3E%0A%20%20%3Cpath%20d=%22M10.2317%2011.9625C10.6939%2011.9625%2010.9634%2011.6991%2010.9738%2011.1871L11.1189%206.03592C11.1292%205.54461%2010.7334%205.16947%2010.2214%205.16947C9.68868%205.16947%209.32389%205.53426%209.33424%206.02556L9.45865%2011.1871C9.469%2011.6888%209.73852%2011.9625%2010.2317%2011.9625ZM10.2317%2015.1365C10.798%2015.1365%2011.2771%2014.6926%2011.2771%2014.1223C11.2771%2013.5478%2010.8084%2013.108%2010.2317%2013.108C9.65723%2013.108%209.17607%2013.5581%209.17607%2014.1223C9.17607%2014.6822%209.66758%2015.1365%2010.2317%2015.1365Z%22%20fill=%22white%22%20fill-opacity=%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "fan": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2025.4062%2025.0664%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.0664%22%20opacity%3D%220%22%20width%3D%2225.4062%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.49609%2012.8789C9.39844%2011.2969%2010.418%209.82031%2011.5898%208.49609L11.5898%203.26953C11.5898%201.125%2010.5%200%208.42578%200C4.65234%200%200.832031%203.41016%200.832031%206.63281C0.832031%209.62109%203.62109%2011.0508%208.49609%2012.8789ZM12.1758%208.49609C13.7578%209.39844%2015.2344%2010.418%2016.5586%2011.5898L21.7852%2011.5898C23.9297%2011.5898%2025.0547%2010.5%2025.0547%208.42578C25.0547%204.66406%2021.6445%200.832031%2018.4219%200.832031C15.4336%200.832031%2013.9922%203.62109%2012.1758%208.49609ZM16.5586%2012.1758C15.6562%2013.7578%2014.625%2015.2344%2013.4648%2016.5586L13.4648%2021.7852C13.4648%2023.9297%2014.5547%2025.0547%2016.6172%2025.0547C20.3906%2025.0547%2024.2227%2021.6445%2024.2227%2018.4219C24.2227%2015.4336%2021.4336%2013.9922%2016.5586%2012.1758ZM12.8789%2016.5586C11.2852%2015.6562%209.82031%2014.625%208.49609%2013.4648L3.25781%2013.4648C1.125%2013.4648%200%2014.5547%200%2016.6172C0%2020.3906%203.41016%2024.2227%206.63281%2024.2227C9.62109%2024.2227%2011.0508%2021.4336%2012.8789%2016.5586ZM12.5273%2016.8984C14.9414%2016.8984%2016.8984%2014.9414%2016.8984%2012.5273C16.8984%2010.1133%2014.9414%208.15625%2012.5273%208.15625C10.1016%208.15625%208.15625%2010.1133%208.15625%2012.5273C8.15625%2014.9414%2010.1016%2016.8984%2012.5273%2016.8984ZM12.5273%2015.2461C11.0273%2015.2461%209.80859%2014.0273%209.80859%2012.5273C9.80859%2011.0273%2011.0273%209.80859%2012.5273%209.80859C14.0273%209.80859%2015.2461%2011.0273%2015.2461%2012.5273C15.2461%2014.0273%2014.0273%2015.2461%2012.5273%2015.2461ZM12.5273%2014.1328C13.418%2014.1328%2014.1211%2013.418%2014.1211%2012.5273C14.1211%2011.6367%2013.418%2010.9219%2012.5273%2010.9219C11.6367%2010.9219%2010.9219%2011.6367%2010.9219%2012.5273C10.9219%2013.418%2011.6367%2014.1328%2012.5273%2014.1328Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "favorites": "data:image/svg+xml,%3C?xml%20version=%221.0%22%20encoding=%22UTF-8%22?%3E%0A%3C!--Generator:%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C!DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version=%221.1%22%20xmlns=%22http://www.w3.org/2000/svg%22%20xmlns:xlink=%22http://www.w3.org/1999/xlink%22%20viewBox=%220%200%2021.6893%2022.1138%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height=%2222.1138%22%20opacity=%220%22%20width=%2221.6893%22%20x=%220%22%20y=%220%22/%3E%0A%20%20%3Cpath%20d=%22M4.15748%2020.5424C4.57%2020.8533%205.06955%2020.7394%205.67913%2020.2978L10.8436%2016.5086L16.0184%2020.2978C16.6197%2020.7394%2017.1193%2020.8533%2017.5318%2020.5424C17.9319%2020.2418%2018.017%2019.734%2017.7681%2019.029L15.7366%2012.9526L20.9467%209.20694C21.5563%208.78598%2021.8049%208.32783%2021.6391%207.84075C21.4836%207.37225%2021.0215%207.14203%2020.2729%207.14203L13.8786%207.14203L11.932%201.07597C11.7039%200.362676%2011.3556%200%2010.8436%200C10.344%200%209.99362%200.362676%209.75726%201.07597L7.81065%207.14203L1.41638%207.14203C0.667817%207.14203%200.213894%207.37225%200.0501921%207.84075C-0.105269%208.32783%200.141239%208.78598%200.742582%209.20694L5.95266%2012.9526L3.92112%2019.029C3.6723%2019.734%203.75742%2020.2418%204.15748%2020.5424Z%22%20fill=%22white%22%20fill-opacity=%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "forward": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2022.0312%2017.918%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2217.918%22%20opacity%3D%220%22%20width%3D%2222.0312%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%2016.2773C0%2017.3789%200.632812%2017.9062%201.39453%2017.9062C1.72266%2017.9062%202.07422%2017.8008%202.41406%2017.6133L14.7188%2010.4414C15.6094%209.92578%2015.9492%209.53906%2015.9492%208.95312C15.9492%208.36719%2015.6094%207.98047%2014.7188%207.46484L2.41406%200.292969C2.07422%200.09375%201.72266%200%201.39453%200C0.632812%200%200%200.515625%200%201.61719ZM17.4492%2017.8359L20.1094%2017.8359C21.1406%2017.8359%2021.6797%2017.2969%2021.6797%2016.2656L21.6797%201.62891C21.6797%200.550781%2021.1406%200.0585938%2020.1094%200.0585938L17.4492%200.0585938C16.418%200.0585938%2015.8906%200.597656%2015.8906%201.62891L15.8906%2016.2656C15.8906%2017.2969%2016.418%2017.8359%2017.4492%2017.8359Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "fridge": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2016.6406%2026.5195%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2226.5195%22%20opacity%3D%220%22%20width%3D%2216.6406%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%208.8125L16.2891%208.8125L16.2891%202.44922C16.2891%200.972656%2015.3398%200%2013.9219%200L2.35547%200C0.949219%200%200%200.972656%200%202.44922ZM3.24609%206.60938C2.90625%206.60938%202.64844%206.36328%202.64844%206.01172L2.64844%203.33984C2.64844%203%202.89453%202.75391%203.24609%202.75391C3.58594%202.75391%203.83203%202.98828%203.83203%203.33984L3.83203%206.01172C3.83203%206.35156%203.59766%206.60938%203.24609%206.60938ZM0%2021.8203L16.2891%2021.8203L16.2891%2010.1836L0%2010.1836ZM3.24609%2015.7852C2.90625%2015.7852%202.64844%2015.5508%202.64844%2015.1992L2.64844%2012.5273C2.64844%2012.1875%202.89453%2011.9414%203.24609%2011.9414C3.58594%2011.9414%203.83203%2012.1758%203.83203%2012.5273L3.83203%2015.1992C3.83203%2015.5391%203.59766%2015.7852%203.24609%2015.7852ZM0%2023.1914L0%2024.0703C0%2025.5469%200.949219%2026.5195%202.35547%2026.5195L13.9219%2026.5195C15.3398%2026.5195%2016.2891%2025.5469%2016.2891%2024.0703L16.2891%2023.1914Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "gas": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2238%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2038%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M7.657%2050c-2.106%200-3.908-.76-5.407-2.28C.75%2046.202%200%2044.376%200%2042.242V13.506c0-2.134.75-3.96%202.25-5.48%201.499-1.52%203.301-2.279%205.407-2.279h4.892V0h1.56v5.747h9.783V0h1.56v5.747h4.891c2.106%200%203.909.76%205.408%202.279%201.5%201.52%202.249%203.346%202.249%205.48V42.24c0%202.134-.75%203.96-2.249%205.48-1.5%201.52-3.301%202.28-5.408%202.28H7.657Zm0-1.58h22.686c1.712%200%203.156-.596%204.333-1.788%201.176-1.192%201.764-2.655%201.764-4.39V13.505c0-1.735-.588-3.198-1.764-4.39-1.177-1.192-2.62-1.788-4.333-1.788H7.657c-1.713%200-3.157.596-4.333%201.788-1.176%201.192-1.764%202.655-1.764%204.39V42.24c0%201.736.588%203.199%201.764%204.39%201.176%201.193%202.62%201.788%204.333%201.788ZM9.5%2016.953h19v-1.58h-19v1.58Zm9.488%2022.198c1.331%200%202.446-.455%203.344-1.365.898-.91%201.347-1.998%201.347-3.265%200-1.032-.3-1.919-.899-2.66-.6-.742-1.86-2.263-3.78-4.563-1.938%202.299-3.202%203.82-3.793%204.566-.59.745-.886%201.614-.886%202.608%200%201.3.445%202.404%201.335%203.314.89.91%202%201.365%203.332%201.365Z%22/%3E%0A%3C/svg%3E%0A",
  "heating": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2019.875%2027.4805%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2227.4805%22%20opacity%3D%220%22%20width%3D%2219.875%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M9.21094%2025.3477C15.3984%2025.3477%2019.5234%2021.1641%2019.5234%2014.8594C19.5234%204.37109%2010.5938%200%204.39453%200C3.29297%200%202.58984%200.386719%202.58984%201.13672C2.58984%201.42969%202.71875%201.73438%202.96484%202.01562C4.35938%203.67969%205.75391%205.66016%205.77734%207.96875C5.77734%208.49609%205.71875%208.96484%205.34375%209.62109L5.92969%209.50391C5.40234%207.78125%203.98438%206.5625%202.74219%206.5625C2.26172%206.5625%201.93359%206.91406%201.93359%207.44141C1.93359%207.74609%202.01562%208.46094%202.01562%208.97656C2.01562%2011.6016%200%2013.1367%200%2017.3672C0%2022.1602%203.66797%2025.3477%209.21094%2025.3477ZM9.32812%2023.707C4.73438%2023.707%201.65234%2021.1523%201.65234%2017.3672C1.65234%2013.5234%203.72656%2012.2227%203.72656%209.17578C3.72656%208.71875%203.63281%208.30859%203.52734%207.95703L3.25781%208.42578C4.21875%209%204.875%2010.043%205.25%2011.6484C5.29688%2011.8945%205.4375%2012.0117%205.61328%2012.0117C6.5625%2012.0117%207.24219%209.65625%207.24219%208.16797C7.24219%205.47266%206.08203%202.91797%204.19531%201.17188L3.87891%201.54688C12.3047%201.72266%2017.8008%207.3125%2017.8008%2014.8008C17.8008%2020.1211%2014.4023%2023.707%209.32812%2023.707ZM9.48047%2022.0547C12.2695%2022.0547%2013.6289%2020.0039%2013.6289%2017.6836C13.6289%2015.3984%2012.293%2012.8438%209.72656%2011.6367C9.62109%2011.6016%209.55078%2011.6602%209.5625%2011.7656C9.76172%2013.6875%209.46875%2015.4688%208.84766%2016.3125C8.55469%2015.6328%208.20312%2015.0469%207.66406%2014.5664C7.58203%2014.4961%207.51172%2014.5312%207.48828%2014.6367C7.30078%2015.9609%205.83594%2016.6992%205.83594%2018.7617C5.83594%2020.7305%207.28906%2022.0547%209.48047%2022.0547Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "home": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2028.3359%2024.668%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.668%22%20opacity%3D%220%22%20width%3D%2228.3359%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M10.8281%2022.7578L10.8281%2015.8672C10.8281%2015.3281%2011.1914%2014.9766%2011.7305%2014.9766L16.2656%2014.9766C16.8164%2014.9766%2017.1562%2015.3281%2017.1562%2015.8672L17.1562%2022.7578ZM3.65625%2022.0664C3.65625%2023.6953%204.64062%2024.6445%206.29297%2024.6445L21.7031%2024.6445C23.3555%2024.6445%2024.3281%2023.6953%2024.3281%2022.0664L24.3281%2012.7617L14.6953%204.6875C14.25%204.3125%2013.7227%204.32422%2013.2891%204.6875L3.65625%2012.7617ZM1.00781%2012.5156C1.33594%2012.5156%201.60547%2012.3398%201.85156%2012.1406L13.582%202.28516C13.7109%202.17969%2013.8633%202.12109%2013.9922%202.12109C14.1328%202.12109%2014.2734%202.17969%2014.4023%202.28516L26.1445%2012.1406C26.3789%2012.3398%2026.6484%2012.5156%2026.9766%2012.5156C27.6094%2012.5156%2027.9844%2012.0586%2027.9844%2011.5781C27.9844%2011.3086%2027.8789%2011.0273%2027.6094%2010.8164L15.3984%200.5625C14.9531%200.1875%2014.4727%200%2013.9922%200C13.5117%200%2013.0312%200.1875%2012.5859%200.5625L0.375%2010.8164C0.117188%2011.0273%200%2011.3086%200%2011.5781C0%2012.0586%200.375%2012.5156%201.00781%2012.5156ZM21.6211%206.29297L24.5625%208.77734L24.5625%203.49219C24.5625%202.97656%2024.2344%202.64844%2023.7188%202.64844L22.4648%202.64844C21.9609%202.64844%2021.6211%202.97656%2021.6211%203.49219Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "homepod": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2023.4258%2021.2227%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2221.2227%22%20opacity%3D%220%22%20width%3D%2223.4258%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M11.543%2021.2227C15.7969%2021.2227%2017.5898%2020.6836%2019.2891%2019.1016C21.6797%2016.9219%2023.0742%2013.7695%2023.0742%2010.418C23.0742%207.71094%2022.1719%205.13281%2020.3086%203.01172C19.875%202.47266%2019.4297%202.42578%2018.9609%202.76562C17.2266%204.07812%2015.2227%204.73438%2011.543%204.73438C7.85156%204.73438%205.84766%204.07812%204.125%202.76562C3.65625%202.42578%203.19922%202.47266%202.76562%203.01172C0.914062%205.13281%200%207.71094%200%2010.418C0%2013.7695%201.39453%2016.9219%203.78516%2019.1016C5.48438%2020.6836%207.27734%2021.2227%2011.543%2021.2227Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.5%22/%3E%0A%20%20%3Cpath%20d%3D%22M11.543%203.14062C14.8008%203.14062%2017.0742%202.48438%2017.0742%201.64062C17.0742%200.785156%2014.8008%200.152344%2011.543%200.152344C8.27344%200.152344%206%200.785156%206%201.64062C6%202.48438%208.27344%203.14062%2011.543%203.14062Z%22%20fill%3D%22white%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "hot_water": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2238%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2038%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M5.994%2040.46c-.663%200-1.216-.22-1.66-.663-.445-.443-.667-.99-.667-1.645%200-.654.224-1.2.672-1.639.448-.438%201.004-.658%201.667-.658s1.216.222%201.66.664c.445.442.667.99.667%201.645%200%20.654-.224%201.2-.672%201.639-.448.438-1.004.658-1.667.658Zm13%200c-.663%200-1.216-.22-1.66-.663-.445-.443-.667-.99-.667-1.645%200-.654.224-1.2.672-1.639.449-.438%201.004-.658%201.667-.658s1.216.222%201.66.664c.445.442.667.99.667%201.645%200%20.654-.224%201.2-.672%201.639-.449.438-1.004.658-1.667.658Zm13%200c-.663%200-1.216-.22-1.66-.663-.445-.443-.667-.99-.667-1.645%200-.654.224-1.2.672-1.639.449-.438%201.004-.658%201.667-.658s1.216.222%201.66.664c.445.442.667.99.667%201.645%200%20.654-.224%201.2-.672%201.639-.449.438-1.004.658-1.667.658ZM0%2027.633V25.33c0-4.99%201.736-9.28%205.208-12.87%203.473-3.591%207.68-5.551%2012.625-5.88V0h2.334v6.579c4.944.329%209.152%202.289%2012.625%205.88%203.472%203.59%205.208%207.88%205.208%2012.87v2.303H0Zm2.333-2.303h33.334c0-4.55-1.625-8.43-4.875-11.637-3.25-3.207-7.18-4.81-11.792-4.81-4.611%200-8.542%201.603-11.792%204.81S2.333%2020.78%202.333%2025.33ZM5.994%2050c-.663%200-1.216-.221-1.66-.664-.445-.442-.667-.99-.667-1.644%200-.654.224-1.2.672-1.64.448-.438%201.004-.657%201.667-.657s1.216.221%201.66.663c.445.443.667.991.667%201.645s-.224%201.2-.672%201.64c-.448.438-1.004.657-1.667.657Zm13%200c-.663%200-1.216-.221-1.66-.664-.445-.442-.667-.99-.667-1.644%200-.654.224-1.2.672-1.64.449-.438%201.004-.657%201.667-.657s1.216.221%201.66.663c.445.443.667.991.667%201.645s-.224%201.2-.672%201.64c-.449.438-1.004.657-1.667.657Zm13%200c-.663%200-1.216-.221-1.66-.664-.445-.442-.667-.99-.667-1.644%200-.654.224-1.2.672-1.64.449-.438%201.004-.657%201.667-.657s1.216.221%201.66.663c.445.443.667.991.667%201.645s-.224%201.2-.672%201.64c-.449.438-1.004.657-1.667.657Z%22/%3E%0A%3C/svg%3E%0A",
  "humidifier": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2021.9023%2022.8164%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2222.8164%22%20opacity%3D%220%22%20width%3D%2221.9023%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.98438%205.49609L17.5547%205.49609C16.6992%204.18359%2015.7266%202.83594%2014.7188%201.47656C13.9688%200.492188%2013.5234%200%2012.2578%200L9.29297%200C8.02734%200%207.58203%200.492188%206.83203%201.47656C5.8125%202.83594%204.85156%204.18359%203.98438%205.49609ZM10.7812%2012.0234C12.1875%2012.0234%2013.3477%2012.9141%2013.7578%2014.1914L21.5039%2014.1914C21.2344%2012.2227%2020.2383%209.91406%2018.7969%207.45312L2.74219%207.45312C1.3125%209.91406%200.316406%2012.2227%200.0351562%2014.1914L7.79297%2014.1914C8.20312%2012.9141%209.375%2012.0234%2010.7812%2012.0234ZM10.7812%2016.5703C11.5781%2016.5703%2012.1875%2015.9609%2012.1875%2015.1523C12.1875%2014.3672%2011.5781%2013.7344%2010.7812%2013.7344C9.98438%2013.7344%209.36328%2014.3672%209.36328%2015.1523C9.36328%2015.9609%209.98438%2016.5703%2010.7812%2016.5703ZM7.93359%2022.793L13.6055%2022.793C18.5508%2022.793%2021.2227%2020.3438%2021.5508%2016.1484L13.7578%2016.1484C13.3594%2017.3906%2012.1992%2018.2812%2010.7812%2018.2812C9.375%2018.2812%208.19141%2017.3906%207.79297%2016.1484L0%2016.1484C0.316406%2020.3438%202.98828%2022.793%207.93359%2022.793Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "humidity": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2030.0938%2025.3008%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.3008%22%20opacity%3D%220%22%20width%3D%2230.0938%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M16.7578%2018.7382C14.0189%2020.0473%2011.5801%2022.0898%208.03906%2022.0898C6.53906%2022.0898%205.16797%2021.7266%203.84375%2020.9531C3.19922%2020.5898%203.17578%2019.9453%203.45703%2019.5234C3.69141%2019.1602%204.17188%2018.9727%204.66406%2019.2539C5.85938%2019.9453%206.87891%2020.2031%208.03906%2020.2031C11.5552%2020.2031%2013.9952%2017.8651%2017.1058%2016.5916C16.8968%2017.2704%2016.7578%2017.9939%2016.7578%2018.7382Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M19.5525%2011.5191C15.4844%2012.2422%2012.73%2015.8086%208.05078%2015.8086C6.55078%2015.8086%205.17969%2015.4336%203.85547%2014.6719C3.21094%2014.2969%203.1875%2013.6641%203.46875%2013.2422C3.70312%2012.8789%204.18359%2012.6914%204.67578%2012.9727C5.87109%2013.6523%206.89062%2013.9219%208.05078%2013.9219C12.773%2013.9219%2015.554%209.70493%2020.6239%209.51154Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M25.1836%204.33594C25.8398%204.72266%2025.8633%205.35547%2025.5703%205.77734C25.3242%206.12891%2024.8555%206.31641%2024.3633%206.03516C23.168%205.35547%2022.1367%205.09766%2020.9883%205.09766C16.0781%205.09766%2013.2539%209.51562%208.03906%209.51562C6.53906%209.51562%205.16797%209.15234%203.84375%208.39062C3.19922%208.01562%203.17578%207.38281%203.45703%206.96094C3.69141%206.59766%204.17188%206.41016%204.66406%206.69141C5.85938%207.37109%206.87891%207.62891%208.03906%207.62891C12.8789%207.62891%2015.6797%203.21094%2020.9883%203.21094C22.4883%203.21094%2023.8594%203.57422%2025.1836%204.33594Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M23.4258%2023.6953C26.25%2023.6953%2028.5%2021.4922%2028.5%2018.7383C28.5%2017.2148%2027.7383%2015.7266%2027.0938%2014.5195L24.4805%209.65625C24.1992%209.12891%2023.9414%208.90625%2023.4258%208.90625C22.8984%208.90625%2022.6523%209.12891%2022.3711%209.65625L19.7695%2014.5195C19.125%2015.7266%2018.3633%2017.2148%2018.3633%2018.7383C18.3633%2021.4922%2020.6133%2023.6953%2023.4258%2023.6953Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "increase": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2021%2012.8%22%3E%3Cpath%20d%3D%22M1.9%2010.6%20L10.5%202.2%20L19.1%2010.6%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222.9%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E%0A",
  "kitchen": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2016.6406%2026.5195%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2226.5195%22%20opacity%3D%220%22%20width%3D%2216.6406%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%208.8125L16.2891%208.8125L16.2891%202.44922C16.2891%200.972656%2015.3398%200%2013.9219%200L2.35547%200C0.949219%200%200%200.972656%200%202.44922ZM3.24609%206.60938C2.90625%206.60938%202.64844%206.36328%202.64844%206.01172L2.64844%203.33984C2.64844%203%202.89453%202.75391%203.24609%202.75391C3.58594%202.75391%203.83203%202.98828%203.83203%203.33984L3.83203%206.01172C3.83203%206.35156%203.59766%206.60938%203.24609%206.60938ZM0%2021.8203L16.2891%2021.8203L16.2891%2010.1836L0%2010.1836ZM3.24609%2015.7852C2.90625%2015.7852%202.64844%2015.5508%202.64844%2015.1992L2.64844%2012.5273C2.64844%2012.1875%202.89453%2011.9414%203.24609%2011.9414C3.58594%2011.9414%203.83203%2012.1758%203.83203%2012.5273L3.83203%2015.1992C3.83203%2015.5391%203.59766%2015.7852%203.24609%2015.7852ZM0%2023.1914L0%2024.0703C0%2025.5469%200.949219%2026.5195%202.35547%2026.5195L13.9219%2026.5195C15.3398%2026.5195%2016.2891%2025.5469%2016.2891%2024.0703L16.2891%2023.1914Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "lamp": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2251%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2051%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M0%2050V33.333h1.947V50H0Zm14.865-25.71h34.33L42.56%201.95H21.59l-6.725%2022.34Zm-5.84%2018.352v-1.95h15.927c1.71%200%203.156-.592%204.335-1.774%201.18-1.182%201.77-2.63%201.77-4.343V26.24H15.396c-.826%200-1.46-.34-1.903-1.02-.442-.679-.545-1.373-.31-2.083l6.378-21.49c.114-.507.392-.91.834-1.205.442-.295.93-.443%201.46-.443h20.35c.532%200%201.018.148%201.46.443.443.296.72.698.834%201.206l6.378%2021.49c.236.709.133%201.403-.31%202.083-.442.68-1.076%201.02-1.902%201.02H33.004v8.322c0%202.253-.78%204.162-2.338%205.729-1.558%201.566-3.463%202.349-5.714%202.349H9.025Z%22/%3E%0A%3C/svg%3E%0A",
  "light": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.4809%20-0.8399%2016.9931%2029.6759%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2229.6759%22%20opacity%3D%220%22%20width%3D%2216.9931%22%20x%3D%22-0.4809%22%20y%3D%22-0.8399%22/%3E%0A%20%20%3Cpath%20d%3D%22M4.13672%2023.8711L11.5547%2023.8711C11.9414%2023.8711%2012.2344%2023.5664%2012.2344%2023.1797C12.2344%2022.8047%2011.9414%2022.5%2011.5547%2022.5L4.13672%2022.5C3.75%2022.5%203.44531%2022.8047%203.44531%2023.1797C3.44531%2023.5664%203.75%2023.8711%204.13672%2023.8711ZM7.83984%2027.2695C9.65625%2027.2695%2011.168%2026.3789%2011.2852%2025.0312L4.40625%2025.0312C4.48828%2026.3789%206.01172%2027.2695%207.83984%2027.2695Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.5%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%207.21875C0%2011.7188%202.96484%2012.832%203.44531%2020.6484C3.46875%2021.0703%203.72656%2021.3398%204.17188%2021.3398L11.5078%2021.3398C11.9648%2021.3398%2012.2109%2021.0703%2012.2461%2020.6484C12.7266%2012.832%2015.6797%2011.7188%2015.6797%207.21875C15.6797%203.17578%2012.2227%200%207.83984%200C3.45703%200%200%203.17578%200%207.21875Z%22%20fill%3D%22white%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "living-room": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2023.6133%2020.5898%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2220.5898%22%20opacity%3D%220%22%20width%3D%2223.6133%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M6.75%2011.1797L16.5117%2011.1797L16.5117%208.49609C16.5117%206.43359%2017.8945%204.91016%2019.8516%204.91016L19.9805%204.91016L19.9805%202.54297C19.9805%201.00781%2018.9844%200%2017.5195%200L5.74219%200C4.26562%200%203.26953%201.00781%203.26953%202.54297L3.26953%204.91016L3.39844%204.91016C5.36719%204.91016%206.75%206.43359%206.75%208.49609ZM0%2015.6211C0%2017.0859%200.972656%2018.0586%202.40234%2018.0586L20.8594%2018.0586C22.2773%2018.0586%2023.2617%2017.0859%2023.2617%2015.6211L23.2617%208.49609C23.2617%207.04297%2022.2773%206.05859%2020.8594%206.05859L20.2734%206.05859C18.8555%206.05859%2017.8711%207.04297%2017.8711%208.49609L17.8711%2012.5391L5.37891%2012.5391L5.37891%208.49609C5.37891%207.04297%204.40625%206.05859%202.97656%206.05859L2.40234%206.05859C0.972656%206.05859%200%207.04297%200%208.49609ZM4.13672%2020.5664L4.875%2020.5664C5.50781%2020.5664%205.91797%2020.168%205.91797%2019.5352L5.91797%2017.0508L3.10547%2017.0508L3.10547%2019.5352C3.10547%2020.168%203.50391%2020.5664%204.13672%2020.5664ZM18.3867%2020.5664L19.1133%2020.5664C19.7461%2020.5664%2020.1445%2020.168%2020.1445%2019.5352L20.1445%2017.0508L17.3438%2017.0508L17.3438%2019.5352C17.3438%2020.168%2017.7539%2020.5664%2018.3867%2020.5664Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "lock-fill": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.4904%20-0.7084%2017.3286%2025.0301%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.0301%22%20opacity%3D%220%22%20width%3D%2217.3286%22%20x%3D%22-0.4904%22%20y%3D%22-0.7084%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.63672%2022.9922L13.3594%2022.9922C15.082%2022.9922%2015.9961%2022.0547%2015.9961%2020.2031L15.9961%2012.1289C15.9961%2010.2773%2015.082%209.35156%2013.3594%209.35156L2.63672%209.35156C0.914062%209.35156%200%2010.2773%200%2012.1289L0%2020.2031C0%2022.0547%200.914062%2022.9922%202.63672%2022.9922ZM2.05078%2010.2539L3.91406%2010.2539L3.91406%206.29297C3.91406%203.33984%205.80078%201.76953%207.99219%201.76953C10.1836%201.76953%2012.0938%203.33984%2012.0938%206.29297L12.0938%2010.2539L13.9453%2010.2539L13.9453%206.55078C13.9453%202.14453%2011.0625%200%207.99219%200C4.93359%200%202.05078%202.14453%202.05078%206.55078Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "lock-open-fill": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.7341%20-0.707%2025.9369%2024.9804%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.9804%22%20opacity%3D%220%22%20width%3D%2225.9369%22%20x%3D%22-0.7341%22%20y%3D%22-0.707%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.63672%2022.9688L13.3594%2022.9688C15.082%2022.9688%2015.9961%2022.0312%2015.9961%2020.1797L15.9961%2012.1055C15.9961%2010.2656%2015.082%209.32812%2013.3594%209.32812L2.63672%209.32812C0.914062%209.32812%200%2010.2656%200%2012.1055L0%2020.1797C0%2022.0312%200.914062%2022.9688%202.63672%2022.9688ZM12.2227%2010.2422L14.0742%2010.2422L14.0742%206.29297C14.0742%203.32812%2015.9727%201.76953%2018.1641%201.76953C20.3555%201.76953%2022.2539%203.32812%2022.2539%206.29297L22.2539%208.89453C22.2539%209.58594%2022.6641%209.9375%2023.1914%209.9375C23.6953%209.9375%2024.1172%209.62109%2024.1172%208.89453L24.1172%206.53906C24.1172%202.13281%2021.2227%200%2018.1641%200C15.0938%200%2012.2227%202.13281%2012.2227%206.53906Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "lock-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.7341%20-0.707%2025.9369%2024.9804%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.9804%22%20opacity%3D%220%22%20width%3D%2225.9369%22%20x%3D%22-0.7341%22%20y%3D%22-0.707%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.63672%2022.9688L13.3594%2022.9688C15.082%2022.9688%2015.9961%2022.0312%2015.9961%2020.1797L15.9961%2012.1055C15.9961%2010.2656%2015.082%209.32812%2013.3594%209.32812L2.63672%209.32812C0.914062%209.32812%200%2010.2656%200%2012.1055L0%2020.1797C0%2022.0312%200.914062%2022.9688%202.63672%2022.9688ZM2.69531%2021.1992C2.19141%2021.1992%201.89844%2020.8828%201.89844%2020.3086L1.89844%2011.9766C1.89844%2011.4023%202.19141%2011.0977%202.69531%2011.0977L13.3008%2011.0977C13.8164%2011.0977%2014.0977%2011.4023%2014.0977%2011.9766L14.0977%2020.3086C14.0977%2020.8828%2013.8164%2021.1992%2013.3008%2021.1992ZM12.2227%2010.2422L14.0742%2010.2422L14.0742%206.29297C14.0742%203.32812%2015.9727%201.76953%2018.1641%201.76953C20.3555%201.76953%2022.2539%203.32812%2022.2539%206.29297L22.2539%208.89453C22.2539%209.58594%2022.6641%209.9375%2023.1914%209.9375C23.6953%209.9375%2024.1172%209.62109%2024.1172%208.89453L24.1172%206.53906C24.1172%202.13281%2021.2227%200%2018.1641%200C15.0938%200%2012.2227%202.13281%2012.2227%206.53906Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "lock-unlocking-fill": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.4904%20-0.7084%2017.3286%2025.0301%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.0301%22%20opacity%3D%220%22%20width%3D%2217.3286%22%20x%3D%22-0.4904%22%20y%3D%22-0.7084%22/%3E%0A%20%20%3Cpath%20d%3D%22M13.9453%206.55078L13.9453%209.39253C15.2888%209.58779%2015.9961%2010.5002%2015.9961%2012.1289L15.9961%2020.2031C15.9961%2022.0547%2015.082%2022.9922%2013.3594%2022.9922L2.63672%2022.9922C0.914062%2022.9922%200%2022.0547%200%2020.2031L0%2012.1289C0%2010.5002%200.707303%209.58779%202.05078%209.39253L2.05078%206.55078C2.05078%202.14453%204.93359%200%207.99219%200C11.0625%200%2013.9453%202.14453%2013.9453%206.55078ZM7.00781%2019.2305C7.00781%2019.7578%207.46484%2020.1914%207.98047%2020.1914C8.53125%2020.1914%208.98828%2019.7578%208.98828%2019.2305C8.98828%2018.6797%208.53125%2018.2578%207.98047%2018.2578C7.45312%2018.2578%207.00781%2018.6914%207.00781%2019.2305ZM7.16016%2012.7266L7.27734%2016.6992C7.28906%2017.1562%207.54688%2017.4258%207.99219%2017.4258C8.4375%2017.4258%208.69531%2017.1562%208.70703%2016.6992L8.82422%2012.7383C8.83594%2012.2812%208.47266%2011.9297%207.99219%2011.9297C7.5%2011.9297%207.14844%2012.2695%207.16016%2012.7266ZM3.91406%206.29297L3.91406%209.35156L12.0937%209.35156L12.0938%206.29297C12.0938%203.33984%2010.1836%201.76953%207.99219%201.76953C5.80078%201.76953%203.91406%203.33984%203.91406%206.29297Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "lock-unlocking": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.4904%20-0.7077%2017.3286%2025.0052%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.0052%22%20opacity%3D%220%22%20width%3D%2217.3286%22%20x%3D%22-0.4904%22%20y%3D%22-0.7077%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.63672%2022.9805L13.3594%2022.9805C15.082%2022.9805%2015.9961%2022.043%2015.9961%2020.1914L15.9961%2012.1172C15.9961%2010.2773%2015.082%209.33984%2013.3594%209.33984L2.63672%209.33984C0.914062%209.33984%200%2010.2773%200%2012.1172L0%2020.1914C0%2022.043%200.914062%2022.9805%202.63672%2022.9805ZM2.69531%2021.2109C2.19141%2021.2109%201.89844%2020.8945%201.89844%2020.3203L1.89844%2011.9883C1.89844%2011.4141%202.19141%2011.1094%202.69531%2011.1094L13.3008%2011.1094C13.8164%2011.1094%2014.0977%2011.4141%2014.0977%2011.9883L14.0977%2020.3203C14.0977%2020.8945%2013.8164%2021.2109%2013.3008%2021.2109ZM2.05078%2010.2422L3.91406%2010.2422L3.91406%206.29297C3.91406%203.32812%205.80078%201.76953%207.99219%201.76953C10.1836%201.76953%2012.0938%203.32812%2012.0938%206.29297L12.0938%2010.2422L13.9453%2010.2422L13.9453%206.53906C13.9453%202.13281%2011.0625%200%207.99219%200C4.93359%200%202.05078%202.13281%202.05078%206.53906Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M7.99219%2017.3438C8.41406%2017.3438%208.64844%2017.0859%208.66016%2016.6641L8.77734%2012.9141C8.78906%2012.4805%208.44922%2012.1523%207.99219%2012.1523C7.52344%2012.1523%207.19531%2012.4688%207.20703%2012.9023L7.32422%2016.6641C7.33594%2017.0859%207.57031%2017.3438%207.99219%2017.3438ZM7.99219%2019.9219C8.50781%2019.9219%208.92969%2019.5117%208.92969%2019.0195C8.92969%2018.5039%208.50781%2018.1055%207.99219%2018.1055C7.48828%2018.1055%207.07812%2018.5156%207.07812%2019.0195C7.07812%2019.5117%207.5%2019.9219%207.99219%2019.9219Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "lock": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.4904%20-0.7077%2017.3286%2025.0052%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.0052%22%20opacity%3D%220%22%20width%3D%2217.3286%22%20x%3D%22-0.4904%22%20y%3D%22-0.7077%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.63672%2022.9805L13.3594%2022.9805C15.082%2022.9805%2015.9961%2022.043%2015.9961%2020.1914L15.9961%2012.1172C15.9961%2010.2773%2015.082%209.33984%2013.3594%209.33984L2.63672%209.33984C0.914062%209.33984%200%2010.2773%200%2012.1172L0%2020.1914C0%2022.043%200.914062%2022.9805%202.63672%2022.9805ZM2.69531%2021.2109C2.19141%2021.2109%201.89844%2020.8945%201.89844%2020.3203L1.89844%2011.9883C1.89844%2011.4141%202.19141%2011.1094%202.69531%2011.1094L13.3008%2011.1094C13.8164%2011.1094%2014.0977%2011.4141%2014.0977%2011.9883L14.0977%2020.3203C14.0977%2020.8945%2013.8164%2021.2109%2013.3008%2021.2109ZM2.05078%2010.2422L3.91406%2010.2422L3.91406%206.29297C3.91406%203.32812%205.80078%201.76953%207.99219%201.76953C10.1836%201.76953%2012.0938%203.32812%2012.0938%206.29297L12.0938%2010.2422L13.9453%2010.2422L13.9453%206.53906C13.9453%202.13281%2011.0625%200%207.99219%200C4.93359%200%202.05078%202.13281%202.05078%206.53906Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "mdi-fan": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M12%2C11A1%2C1%200%200%2C0%2011%2C12A1%2C1%200%200%2C0%2012%2C13A1%2C1%200%200%2C0%2013%2C12A1%2C1%200%200%2C0%2012%2C11M12.5%2C2C17%2C2%2017.11%2C5.57%2014.75%2C6.75C13.76%2C7.24%2013.32%2C8.29%2013.13%2C9.22C13.61%2C9.42%2014.03%2C9.73%2014.35%2C10.13C18.05%2C8.13%2022.03%2C8.92%2022.03%2C12.5C22.03%2C17%2018.46%2C17.1%2017.28%2C14.75C16.78%2C13.75%2015.72%2C13.31%2014.79%2C13.12C14.59%2C13.6%2014.28%2C14.02%2013.88%2C14.34C15.88%2C18.04%2015.09%2C22.02%2011.5%2C22.02C7%2C22.02%206.91%2C18.45%209.26%2C17.27C10.25%2C16.78%2010.69%2C15.72%2010.88%2C14.79C10.4%2C14.59%209.98%2C14.28%209.66%2C13.88C5.96%2C15.88%201.98%2C15.09%201.98%2C11.5C1.98%2C7%205.55%2C6.89%206.73%2C9.25C7.22%2C10.24%208.28%2C10.68%209.21%2C10.87C9.41%2C10.39%209.72%2C9.97%2010.12%2C9.65C8.12%2C5.95%208.91%2C1.97%2012.5%2C1.97V2Z%22/%3E%3C/svg%3E",
  "media": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2036.1289%2029.6133%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2229.6133%22%20opacity%3D%220%22%20width%3D%2236.1289%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M20.3555%2025.5C20.3555%2025.8658%2020.3859%2026.2059%2020.4452%2026.5195L9.99609%2026.5195C9.48047%2026.5195%209.05859%2026.0977%209.05859%2025.5703C9.05859%2025.043%209.48047%2024.6211%209.99609%2024.6211L20.3555%2024.6211ZM4.25391%203.08203L27.5391%203.08203C29.4023%203.08203%2030.5391%204.23047%2030.5391%206.09375L30.5391%2010.0781L24.4495%2010.0781C22.1885%2010.0781%2020.3555%2011.9111%2020.3555%2014.1721L20.3555%2022.5469L4.25391%2022.5469C2.39062%2022.5469%201.24219%2021.3984%201.24219%2019.5352L1.24219%206.09375C1.24219%204.23047%202.39062%203.08203%204.25391%203.08203Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.5%22/%3E%0A%20%20%3Cpath%20d%3D%22M24.4336%2028.0078L32.0508%2028.0078C33.6914%2028.0078%2034.5352%2027.1758%2034.5352%2025.5L34.5352%2014.1914C34.5352%2012.5156%2033.6914%2011.6719%2032.0508%2011.6719L24.4336%2011.6719C22.7695%2011.6719%2021.9492%2012.5156%2021.9492%2014.1914L21.9492%2025.5C21.9492%2027.1758%2022.7695%2028.0078%2024.4336%2028.0078ZM28.2539%2017.6484C27.1172%2017.6484%2026.2148%2016.7461%2026.2266%2015.6094C26.2383%2014.4844%2027.1172%2013.6055%2028.2539%2013.6055C29.3789%2013.6055%2030.2578%2014.4844%2030.2578%2015.6094C30.2578%2016.7461%2029.3789%2017.6484%2028.2539%2017.6484ZM28.2422%2025.9805C26.25%2025.9805%2024.6562%2024.375%2024.6562%2022.3828C24.6562%2020.3789%2026.25%2018.7852%2028.2422%2018.7734C30.2227%2018.7617%2031.8281%2020.3789%2031.8281%2022.3828C31.8281%2024.375%2030.2227%2025.9805%2028.2422%2025.9805ZM28.2422%2016.6172C28.793%2016.6172%2029.2266%2016.1719%2029.2266%2015.6094C29.2266%2015.0469%2028.793%2014.625%2028.2422%2014.625C27.6914%2014.625%2027.2461%2015.0703%2027.2461%2015.6094C27.2461%2016.1719%2027.6797%2016.6172%2028.2422%2016.6172ZM28.2422%2023.8828C29.0742%2023.8828%2029.7539%2023.2148%2029.7539%2022.3828C29.7539%2021.5039%2029.0977%2020.8477%2028.2422%2020.8477C27.4102%2020.8477%2026.7305%2021.5039%2026.7305%2022.3828C26.7305%2023.2148%2027.4102%2023.8828%2028.2422%2023.8828Z%22%20fill%3D%22white%22/%3E%0A%20%20%3Cpath%20d%3D%22M28.2539%2017.6484C27.1172%2017.6484%2026.2148%2016.7461%2026.2266%2015.6094C26.2383%2014.4844%2027.1172%2013.6055%2028.2539%2013.6055C29.3789%2013.6055%2030.2578%2014.4844%2030.2578%2015.6094C30.2578%2016.7461%2029.3789%2017.6484%2028.2539%2017.6484ZM28.2422%2025.9805C26.25%2025.9805%2024.6562%2024.375%2024.6562%2022.3828C24.6562%2020.3789%2026.25%2018.7852%2028.2422%2018.7734C30.2227%2018.7617%2031.8281%2020.3789%2031.8281%2022.3828C31.8281%2024.375%2030.2227%2025.9805%2028.2422%2025.9805ZM28.2422%2016.6172C28.793%2016.6172%2029.2266%2016.1719%2029.2266%2015.6094C29.2266%2015.0469%2028.793%2014.625%2028.2422%2014.625C27.6914%2014.625%2027.2461%2015.0703%2027.2461%2015.6094C27.2461%2016.1719%2027.6797%2016.6172%2028.2422%2016.6172ZM28.2422%2023.8828C29.0742%2023.8828%2029.7539%2023.2148%2029.7539%2022.3828C29.7539%2021.5039%2029.0977%2020.8477%2028.2422%2020.8477C27.4102%2020.8477%2026.7305%2021.5039%2026.7305%2022.3828C26.7305%2023.2148%2027.4102%2023.8828%2028.2422%2023.8828Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.18%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "menu": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2276%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2076%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M0%2050v-2.723h76V50H0Zm0-23.639V23.64h76v2.722H0ZM0%202.723V0h76v2.723H0Z%22/%3E%0A%3C/svg%3E%0A",
  "motion": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2028.9805%2027.2461%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2227.2461%22%20opacity%3D%220%22%20width%3D%2228.9805%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M4.92188%204.76953L11.6836%204.76953C12.0938%204.76953%2012.4219%204.42969%2012.4219%204.00781C12.4219%203.58594%2012.0938%203.23438%2011.6836%203.23438L4.92188%203.23438C4.5%203.23438%204.18359%203.58594%204.18359%204.00781C4.18359%204.42969%204.5%204.76953%204.92188%204.76953ZM0.726562%2010.6406L8.75391%2010.6406C9.17578%2010.6406%209.49219%2010.3008%209.49219%209.87891C9.49219%209.45703%209.17578%209.10547%208.75391%209.10547L0.726562%209.10547C0.316406%209.10547%200%209.46875%200%209.87891C0%2010.2891%200.316406%2010.6406%200.726562%2010.6406ZM4.23047%2016.5117L8.69531%2016.5117C9.10547%2016.5117%209.42188%2016.1719%209.42188%2015.75C9.42188%2015.3281%209.10547%2014.9766%208.69531%2014.9766L4.23047%2014.9766C3.80859%2014.9766%203.49219%2015.3281%203.49219%2015.75C3.49219%2016.1719%203.80859%2016.5117%204.23047%2016.5117ZM1.14844%2022.3125L7.26562%2022.3125C7.67578%2022.3125%207.99219%2021.9727%207.99219%2021.5508C7.99219%2021.1289%207.67578%2020.7773%207.26562%2020.7773L1.14844%2020.7773C0.738281%2020.7773%200.421875%2021.1289%200.421875%2021.5508C0.421875%2021.9727%200.738281%2022.3125%201.14844%2022.3125Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M14.1211%2026.332L17.8125%2021.9375C18.1758%2021.5156%2018.2227%2021.3984%2018.3633%2020.9531L18.668%2020.0508L16.6875%2017.5664L16.0664%2020.4141L12.4102%2024.7383C11.2383%2026.1211%2013.1484%2027.4805%2014.1211%2026.332ZM23.1211%2025.9688C23.8711%2027.5156%2026.1445%2026.5664%2025.3242%2024.9023L22.8164%2019.8164C22.6289%2019.4297%2022.3477%2019.0195%2022.125%2018.6914L20.5195%2016.418L20.6367%2016.0898C21.082%2014.8242%2021.2227%2014.0508%2021.3164%2012.7852L21.5625%209.23438C21.6797%207.54688%2020.6836%206.25781%2018.9609%206.25781C17.6602%206.25781%2016.7812%206.91406%2015.5859%208.08594L13.7109%209.9375C13.0898%2010.5469%2012.8906%2011.0391%2012.832%2011.8359L12.6094%2014.7422C12.5508%2015.4688%2012.9609%2015.9961%2013.6406%2016.0195C14.3203%2016.0664%2014.7305%2015.668%2014.8008%2014.8828L15.082%2011.6953L15.9844%2010.875C16.3125%2010.582%2016.7461%2010.7812%2016.7109%2011.1094L16.5117%2013.8164C16.4062%2015.1758%2016.7227%2015.8203%2017.6719%2016.9922L20.1562%2020.1211C20.4023%2020.4375%2020.4375%2020.5664%2020.543%2020.7539ZM27.3984%2011.0742L24.5508%2011.0742L22.6992%209.01172L22.5117%2012L23.2617%2012.75C23.6719%2013.1602%2024.0234%2013.2773%2024.75%2013.2773L27.3984%2013.2773C28.1367%2013.2773%2028.6289%2012.8555%2028.6289%2012.1641C28.6289%2011.5078%2028.125%2011.0742%2027.3984%2011.0742ZM20.332%205.15625C21.7617%205.15625%2022.9102%204.00781%2022.9102%202.57812C22.9102%201.14844%2021.7617%200%2020.332%200C18.9023%200%2017.7539%201.14844%2017.7539%202.57812C17.7539%204.00781%2018.9023%205.15625%2020.332%205.15625Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "music": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2248px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2248px%22%20fill%3D%22%23FFFFFF%22%3E%3Cpath%20d%3D%22M393-120q-63%200-106.5-43.5T243-270q0-63%2043.5-106.5T393-420q28%200%2050.5%208t39.5%2022v-450h234v135H543v435q0%2063-43.5%20106.5T393-120Z%22/%3E%3C/svg%3E",
  "mute": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2224px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2224px%22%20fill%3D%22%23FFFFFF%22%3E%3Cpath%20d%3D%22m584-356-20-20%20104-104-104-104%2020-20%20104%20104%20104-104%2020%2020-104%20104%20104%20104-20%2020-104-104-104%20104Zm-396-56v-136h130l126-126v388L318-412H188Zm228-194-86%2086H216v80h114l86%2086v-252ZM316-480Z%22/%3E%3C/svg%3E",
  "pause": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2014.6484%2019.3945%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.3945%22%20opacity%3D%220%22%20width%3D%2214.6484%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M1.55859%2019.3828L4.23047%2019.3828C5.25%2019.3828%205.78906%2018.8438%205.78906%2017.8125L5.78906%201.55859C5.78906%200.480469%205.25%200%204.23047%200L1.55859%200C0.539062%200%200%200.527344%200%201.55859L0%2017.8125C0%2018.8438%200.539062%2019.3828%201.55859%2019.3828ZM10.0781%2019.3828L12.7383%2019.3828C13.7695%2019.3828%2014.2969%2018.8438%2014.2969%2017.8125L14.2969%201.55859C14.2969%200.480469%2013.7695%200%2012.7383%200L10.0781%200C9.04688%200%208.50781%200.527344%208.50781%201.55859L8.50781%2017.8125C8.50781%2018.8438%209.04688%2019.3828%2010.0781%2019.3828Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "pendant-light": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2248px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2248px%22%20fill%3D%22%23FFFFFF%22%3E%3Cpath%20d%3D%22M480-120q-63%200-106.5-43.5T330-270H180q-24%200-42-18t-18-42q0-152%2093.5-258T450-705v-135h60v135q143%2011%20236.5%20117T840-330q0%2024-18%2042t-42%2018H630q0%2063-43.5%20106.5T480-120ZM180-330h600q0-132-87.5-223.5T480-645q-125%200-212.5%2091.5T180-330Zm300%20150q38%200%2064-26t26-64H390q0%2038%2026%2064t64%2026Zm0-90Z%22/%3E%3C/svg%3E",
  "pendent": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2256%22%20height%3D%2250%22%20fill%3D%22none%22%20viewBox%3D%220%200%2056%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M28%2050c-2.788%200-5.136-.958-7.046-2.874-1.909-1.916-2.863-4.273-2.863-7.071H2c-.504%200-.964-.208-1.378-.624C.207%2039.015%200%2038.554%200%2038.047c0-7.542%202.59-14.142%207.773-19.799C12.954%2012.591%2019.363%209.672%2027%209.49V0h2v9.49c7.636.182%2014.045%203.101%2019.227%208.758C53.41%2023.905%2056%2030.505%2056%2038.048c0%20.505-.207.967-.622%201.383-.414.416-.873.624-1.378.624H37.91c0%202.798-.955%205.155-2.864%207.07C33.136%2049.043%2030.787%2050%2028%2050ZM2%2038.047h52c0-7.36-2.526-13.625-7.578-18.795-5.052-5.17-11.189-7.756-18.41-7.756-7.22%200-13.36%202.585-18.421%207.756C4.53%2024.422%202%2030.687%202%2038.047Zm26.023%209.946c2.166%200%204.022-.781%205.568-2.343%201.545-1.561%202.318-3.427%202.318-5.595H20.091c0%202.19.78%204.06%202.34%205.611%201.561%201.551%203.425%202.327%205.592%202.327Z%22/%3E%0A%3C/svg%3E%0A",
  "person": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2020.0742%2021.082%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2221.082%22%20opacity%3D%220%22%20width%3D%2220.0742%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.00391%2021.0703L17.7188%2021.0703C18.9727%2021.0703%2019.7227%2020.4844%2019.7227%2019.5117C19.7227%2016.4883%2015.9375%2012.3164%209.85547%2012.3164C3.78516%2012.3164%200%2016.4883%200%2019.5117C0%2020.4844%200.75%2021.0703%202.00391%2021.0703ZM9.86719%2010.2188C12.375%2010.2188%2014.5547%207.96875%2014.5547%205.03906C14.5547%202.14453%2012.375%200%209.86719%200C7.35938%200%205.17969%202.19141%205.17969%205.0625C5.17969%207.96875%207.34766%2010.2188%209.86719%2010.2188Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "plant": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2025.6523%2022.2305%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2222.2305%22%20opacity%3D%220%22%20width%3D%2225.6523%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.339844%201.41797C0.09375%202.61328%200%204.17188%200%205.21484C0%2013.9805%205.21484%2019.7695%2013.1836%2019.7695C18.3164%2019.7695%2020.7305%2016.7461%2021.2578%2015.7734L19.793%2015.7383C21.3164%2017.332%2021.9961%2019.043%2022.7695%2021.4688C22.9453%2022.0312%2023.332%2022.2305%2023.7422%2022.2305C24.6094%2022.2305%2025.3008%2021.4805%2025.3008%2020.4492C25.3008%2018.832%2022.9805%2016.0195%2021.7734%2014.8828C16.6406%2010.1484%208.82422%2012.9492%206.80859%207.72266C6.65625%207.32422%207.07812%206.97266%207.46484%207.37109C11.5078%2011.4141%2016.7109%208.00391%2021.7734%2012.668C22.1719%2013.0195%2022.6406%2012.832%2022.7109%2012.4102C22.7695%2012.0703%2022.8047%2011.5312%2022.8047%2011.0156C22.8047%205.29688%2018.8203%202.54297%2013.2188%202.54297C11.3438%202.54297%209.15234%203%207.42969%203C5.54297%203%203.42188%202.84766%201.73438%201.04297C1.25391%200.550781%200.527344%200.621094%200.339844%201.41797Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "play-next": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2034.5117%2017.918%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2217.918%22%20opacity%3D%220%22%20width%3D%2234.5117%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%2016.2773C0%2017.3789%200.632812%2017.9062%201.39453%2017.9062C1.72266%2017.9062%202.07422%2017.8008%202.41406%2017.6133L14.7188%2010.4414C15.6094%209.92578%2015.9492%209.53906%2015.9492%208.95312C15.9492%208.36719%2015.6094%207.98047%2014.7188%207.46484L2.41406%200.292969C2.07422%200.09375%201.72266%200%201.39453%200C0.632812%200%200%200.515625%200%201.61719ZM21.4219%2017.8359L24.082%2017.8359C25.1133%2017.8359%2025.6406%2017.2969%2025.6406%2016.2656L25.6406%201.62891C25.6406%200.550781%2025.1133%200.0585938%2024.082%200.0585938L21.4219%200.0585938C20.3906%200.0585938%2019.8516%200.597656%2019.8516%201.62891L19.8516%2016.2656C19.8516%2017.2969%2020.3906%2017.8359%2021.4219%2017.8359ZM29.9297%2017.8359L32.5898%2017.8359C33.6211%2017.8359%2034.1602%2017.2969%2034.1602%2016.2656L34.1602%201.62891C34.1602%200.550781%2033.6211%200.0585938%2032.5898%200.0585938L29.9297%200.0585938C28.8984%200.0585938%2028.3711%200.597656%2028.3711%201.62891L28.3711%2016.2656C28.3711%2017.2969%2028.8984%2017.8359%2029.9297%2017.8359Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "play": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2019.6289%2019.6992%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.6992%22%20opacity%3D%220%22%20width%3D%2219.6289%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M2.13281%2017.9766C2.13281%2019.1367%202.80078%2019.6875%203.59766%2019.6875C3.94922%2019.6875%204.3125%2019.5703%204.67578%2019.3828L18.3281%2011.4023C19.3008%2010.8398%2019.6289%2010.4531%2019.6289%209.84375C19.6289%209.22266%2019.3008%208.84766%2018.3281%208.28516L4.67578%200.304688C4.3125%200.105469%203.94922%200%203.59766%200C2.80078%200%202.13281%200.550781%202.13281%201.71094Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "plex": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2220%22%20opacity%3D%220%22%20width%3D%2220%22%20x%3D%220%22%20y%3D%220%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M3.913%200L9.7101%200L16.087%2010L9.7101%2020L3.913%2020L10.2899%2010Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22%2F%3E%0A%20%3C%2Fg%3E%0A%3C%2Fsvg%3E",
  "plug": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-0.8%200%2015.6743%2022.2967%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2222.2967%22%20opacity%3D%220%22%20width%3D%2214.0743%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M5.87143%2022.2842L8.19257%2022.2842C9.43475%2022.2842%2010.1565%2021.581%2010.1565%2020.3222L10.1565%2016.4784C10.1565%2015.5242%2010.5985%2015.0583%2011.5251%2014.3789C13.1919%2013.1457%2014.0743%2011.2336%2014.0743%209.23416L14.0743%206.77354C14.0743%205.53558%2013.3651%204.99805%2012.1271%204.99805L11.2402%204.99805L11.2402%201.23836C11.2402%200.54768%2010.6967%200%2010.0122%200C9.32551%200%208.76959%200.54768%208.76959%201.23836L8.76959%204.99805L5.30666%204.99805L5.30666%201.23836C5.30666%200.54768%204.74039%200%204.07041%200C3.38375%200%202.82783%200.54768%202.82783%201.23836L2.82783%204.99805L1.91598%204.99805C0.663649%204.99805%200%205.53558%200%206.77354L0%209.23416C0%2011.2336%200.855584%2013.1457%202.54103%2014.3789C3.47178%2015.0583%203.91997%2015.5242%203.91997%2016.4784L3.91997%2020.3222C3.91997%2021.5707%204.59819%2022.2842%205.87143%2022.2842ZM5.87143%2020.7031C5.6404%2020.7031%205.49067%2020.5595%205.49067%2020.3222L5.49067%2016.4784C5.49067%2014.9938%204.79175%2014.0782%203.47973%2013.1149C2.14028%2012.1221%201.57069%2010.8648%201.57069%209.23416L1.57069%206.9495C1.57069%206.72059%201.70796%206.5791%201.91598%206.5791L12.1271%206.5791C12.3518%206.5791%2012.5036%206.72059%2012.5036%206.9495L12.5036%209.23416C12.5036%2010.8545%2011.9176%2012.1221%2010.5864%2013.1149C9.27858%2014.0761%208.57544%2014.9814%208.57544%2016.4784L8.57544%2020.3222C8.57544%2020.5595%208.42359%2020.7031%208.19257%2020.7031Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "power_off": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2024.2578%2023.918%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2223.918%22%20opacity%3D%220%22%20width%3D%2224.2578%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M11.9531%2023.9062C18.5508%2023.9062%2023.9062%2018.5508%2023.9062%2011.9531C23.9062%205.35547%2018.5508%200%2011.9531%200C5.35547%200%200%205.35547%200%2011.9531C0%2018.5508%205.35547%2023.9062%2011.9531%2023.9062ZM11.9531%2021.9141C6.44531%2021.9141%201.99219%2017.4609%201.99219%2011.9531C1.99219%206.44531%206.44531%201.99219%2011.9531%201.99219C17.4609%201.99219%2021.9141%206.44531%2021.9141%2011.9531C21.9141%2017.4609%2017.4609%2021.9141%2011.9531%2021.9141Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "power_on": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2024.2578%2025.2773%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2225.2773%22%20opacity%3D%220%22%20width%3D%2224.2578%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M11.9531%2024.5859C18.5508%2024.5859%2023.9062%2019.2305%2023.9062%2012.6328C23.9062%208.92969%2022.2891%205.89453%2020.0273%203.84375C18.9961%202.89453%2017.6602%204.32422%2018.6914%205.28516C20.6836%207.11328%2021.9141%209.71484%2021.9141%2012.6328C21.9141%2018.1406%2017.4609%2022.5938%2011.9531%2022.5938C6.44531%2022.5938%201.99219%2018.1406%201.99219%2012.6328C1.99219%209.69141%203.23438%207.10156%205.21484%205.27344C6.25781%204.30078%204.93359%202.92969%203.89062%203.85547C1.60547%205.85938%200%209.03516%200%2012.6328C0%2019.2305%205.35547%2024.5859%2011.9531%2024.5859ZM11.9531%2012.5156C12.5156%2012.5156%2012.9023%2012.1055%2012.9023%2011.5195L12.9023%200.996094C12.9023%200.398438%2012.5156%200%2011.9531%200C11.3906%200%2011.0156%200.398438%2011.0156%200.996094L11.0156%2011.5195C11.0156%2012.1055%2011.3906%2012.5156%2011.9531%2012.5156Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "ps5": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2050%2050%22%3E%0A%20%20%3Cstyle%3E%0A%20%20%20%20%40keyframes%20hemma-ps5-reveal%20%7B%0A%20%20%20%20%20%2050%25%20%20%7B%20transform%3A%20translateY%28-45%25%29%3B%20%7D%0A%20%20%20%20%20%20100%25%20%7B%20transform%3A%20translateY%280%29%3B%20%7D%0A%20%20%20%20%7D%0A%20%20%20%20.hemma-ps5-bars%20%7B%0A%20%20%20%20%20%20animation%3A%20hemma-ps5-reveal%201.4s%20cubic-bezier%280.550%2C%200.085%2C%200.680%2C%200.530%29%20both%3B%0A%20%20%20%20%7D%0A%20%20%3C/style%3E%0A%20%20%3Cg%20style%3D%22clip-path%3A%20url%28%23hemma-ps5-mask%29%3B%20opacity%3A%200.7%3B%22%3E%0A%20%20%20%20%3Cg%20class%3D%22hemma-ps5-bars%22%3E%0A%20%20%20%20%20%20%3Cpath%20fill%3D%22%2300aa9e%22%20d%3D%22M49.2%2038.9l-75.6-25.1v7.4l75.6%2025.2z%22/%3E%0A%20%20%20%20%20%20%3Cpath%20fill%3D%22%23f3c202%22%20d%3D%22M49.2%2046.4l-75.6-25.2v7.5l75.6%2025.1z%22/%3E%0A%20%20%20%20%20%20%3Cpath%20fill%3D%22%23326db3%22%20d%3D%22M49.2%2053.8l-75.6-25.1V51l75.6%2025.1zm0-22.3L-26.4%206.4v7.4l75.6%2025.1z%22/%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%3C/g%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3CclipPath%20id%3D%22hemma-ps5-mask%22%3E%0A%20%20%20%20%20%20%3Cpath%20d%3D%22M47.5%2033.2c-.5-2.2-3.9-3.5-9.1-3.9-3.8-.3-7.5.6-11.1%201.9l-.6.2v-5.7l-5.7.8-4.6%201.6L6%2031.9h-.1c-1.9.7-3.8%202.2-3.7%204.2.1%202.1%204.7%202.6%208.2%203.2%203.3.6%206.2.2%208.9-.7l7.3%204.8L33%2041l10.7-4h.1c2.8-1%204-2.5%203.7-3.8zm-31.3%202l-3.6%201.3c-2.2.8-4.1-1.1-2.1-1.9l1.7-.6%207.2-2.7v2.8l-3.2%201.1zm22.5-1.1l-1.9.7-10.2%203.7V36l6.5-2.4%203.8-1.3c4-.9%205.6.5%201.8%201.8z%22/%3E%0A%20%20%20%20%3C/clipPath%3E%0A%20%20%3C/defs%3E%0A%20%20%3Cpath%20fill%3D%22%23de0029%22%20d%3D%22M26.7%2014.6v28.7l-7.3-2.5V7.1l9.3%202.6c6%201.7%209.6%205%209.6%2010.7-.1%206.7-3%209.4-8.7%207.6V14.9c-.1-1.6-2.9-1.7-2.9-.3h0z%22/%3E%0A%3C/svg%3E%0A",
  "ps5_off": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2050%2050%22%3E%0A%20%20%3Cpath%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.55%22%20d%3D%22M47.5%2033.2c-.5-2.2-3.9-3.5-9.1-3.9-3.8-.3-7.5.6-11.1%201.9l-.6.2v-5.7l-5.7.8-4.6%201.6L6%2031.9h-.1c-1.9.7-3.8%202.2-3.7%204.2.1%202.1%204.7%202.6%208.2%203.2%203.3.6%206.2.2%208.9-.7l7.3%204.8L33%2041l10.7-4h.1c2.8-1%204-2.5%203.7-3.8zm-31.3%202l-3.6%201.3c-2.2.8-4.1-1.1-2.1-1.9l1.7-.6%207.2-2.7v2.8l-3.2%201.1zm22.5-1.1l-1.9.7-10.2%203.7V36l6.5-2.4%203.8-1.3c4-.9%205.6.5%201.8%201.8z%22/%3E%0A%20%20%3Cpath%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.95%22%20d%3D%22M26.7%2014.6v28.7l-7.3-2.5V7.1l9.3%202.6c6%201.7%209.6%205%209.6%2010.7-.1%206.7-3%209.4-8.7%207.6V14.9c-.1-1.6-2.9-1.7-2.9-.3h0z%22/%3E%0A%3C/svg%3E%0A",
  "purifier": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2028.0754%2027.5742%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2227.5742%22%20opacity%3D%220%22%20width%3D%2227.7234%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M22.4852%202.50603C20.6292%203.23708%2019.23%204.60547%2017.266%204.60547C16.6332%204.60547%2016.1058%204.46484%2015.4261%204.07812C15.0277%203.85547%2014.6293%204.00781%2014.4418%204.3125C14.2308%204.64062%2014.2543%205.15625%2014.7465%205.4375C15.5199%205.91797%2016.3754%206.11719%2017.266%206.11719C19.4839%206.11719%2020.9482%204.83939%2022.5863%204.09824L22.5863%205.72708C20.6885%206.45297%2019.2753%207.875%2017.2777%207.875C16.6332%207.875%2016.1058%207.72266%2015.4379%207.34766C15.0394%207.11328%2014.6293%207.27734%2014.4418%207.58203C14.2308%207.91016%2014.2543%208.42578%2014.7582%208.70703C15.5316%209.17578%2016.3871%209.38672%2017.2777%209.38672C19.4849%209.38672%2020.9518%208.10585%2022.5863%207.36087L22.5863%208.99188C20.6803%209.7138%2019.266%2011.1328%2017.266%2011.1328C16.6332%2011.1328%2016.1058%2010.9922%2015.4261%2010.6055C15.0277%2010.3828%2014.6293%2010.5352%2014.4418%2010.8398C14.2308%2011.168%2014.2543%2011.6836%2014.7465%2011.9648C15.5199%2012.4453%2016.3754%2012.6445%2017.266%2012.6445C19.4839%2012.6445%2020.9482%2011.3667%2022.5863%2010.6256L22.5863%2021.9141C22.5863%2023.8514%2021.7618%2025.0198%2020.1371%2025.3716L20.1371%2026.6016C20.1371%2027.1641%2019.7621%2027.5508%2019.1879%2027.5508C18.6254%2027.5508%2018.2504%2027.1641%2018.2504%2026.6016L18.2504%2025.4883L9.12146%2025.4883L9.12146%2026.6016C9.12146%2027.1641%208.74646%2027.5508%208.18396%2027.5508C7.62146%2027.5508%207.23474%2027.1641%207.23474%2026.6016L7.23474%2025.3696C5.61436%2025.0148%204.78552%2023.8473%204.78552%2021.9141L4.78552%203.5625C4.78552%201.19531%206.03943%200%208.40661%200L18.9769%200C20.96%200%2022.1535%200.83883%2022.4852%202.50603ZM8.5238%2020.8125C8.10193%2020.8125%207.76208%2021.1523%207.76208%2021.5859C7.76208%2022.0078%208.10193%2022.3477%208.5238%2022.3477L12.0394%2022.3477C12.473%2022.3477%2012.8129%2022.0078%2012.8129%2021.5859C12.8129%2021.1523%2012.473%2020.8125%2012.0394%2020.8125ZM15.3324%2020.8125C14.8988%2020.8125%2014.559%2021.1523%2014.559%2021.5859C14.559%2022.0078%2014.8988%2022.3477%2015.3324%2022.3477L18.848%2022.3477C19.2699%2022.3477%2019.6097%2022.0078%2019.6097%2021.5859C19.6097%2021.1523%2019.2699%2020.8125%2018.848%2020.8125ZM8.5238%2017.8008C8.10193%2017.8008%207.76208%2018.1289%207.76208%2018.5625C7.76208%2018.9961%208.10193%2019.3242%208.5238%2019.3242L12.0394%2019.3242C12.473%2019.3242%2012.8129%2018.9961%2012.8129%2018.5625C12.8129%2018.1289%2012.473%2017.8008%2012.0394%2017.8008ZM15.3324%2017.8008C14.8988%2017.8008%2014.559%2018.1289%2014.559%2018.5625C14.559%2018.9961%2014.8988%2019.3242%2015.3324%2019.3242L18.848%2019.3242C19.2699%2019.3242%2019.6097%2018.9961%2019.6097%2018.5625C19.6097%2018.1289%2019.2699%2017.8008%2018.848%2017.8008ZM8.5238%2014.7773C8.10193%2014.7773%207.76208%2015.1172%207.76208%2015.5391C7.76208%2015.9727%208.10193%2016.3008%208.5238%2016.3008L12.0394%2016.3008C12.473%2016.3008%2012.8129%2015.9727%2012.8129%2015.5391C12.8129%2015.1172%2012.473%2014.7773%2012.0394%2014.7773ZM15.3324%2014.7773C14.8988%2014.7773%2014.559%2015.1172%2014.559%2015.5391C14.559%2015.9727%2014.8988%2016.3008%2015.3324%2016.3008L18.848%2016.3008C19.2699%2016.3008%2019.6097%2015.9727%2019.6097%2015.5391C19.6097%2015.1172%2019.2699%2014.7773%2018.848%2014.7773ZM7.83239%204.76953C7.83239%205.71875%208.59411%206.49219%209.53161%206.49219C10.4691%206.49219%2011.2426%205.71875%2011.2426%204.76953C11.2426%203.84375%2010.4691%203.08203%209.53161%203.08203C8.59411%203.08203%207.83239%203.84375%207.83239%204.76953Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.5%22/%3E%0A%20%20%3Cpath%20d%3D%22M17.266%206.11719C16.3754%206.11719%2015.5199%205.91797%2014.7465%205.4375C14.2543%205.15625%2014.2308%204.64062%2014.4418%204.3125C14.6293%204.00781%2015.0277%203.85547%2015.4261%204.07812C16.1058%204.46484%2016.6332%204.60547%2017.266%204.60547C19.9496%204.60547%2021.5785%202.05078%2024.7543%202.05078C25.6449%202.05078%2026.4886%202.27344%2027.2738%202.73047C27.7894%203.02344%2027.8011%203.53906%2027.5785%203.87891C27.391%204.14844%2027.016%204.3125%2026.5941%204.07812C25.9144%203.70312%2025.3871%203.57422%2024.7543%203.57422C22.0238%203.57422%2020.3949%206.11719%2017.266%206.11719ZM17.2777%209.38672C16.3871%209.38672%2015.5316%209.17578%2014.7582%208.70703C14.2543%208.42578%2014.2308%207.91016%2014.4418%207.58203C14.6293%207.27734%2015.0394%207.11328%2015.4379%207.34766C16.1058%207.72266%2016.6332%207.875%2017.2777%207.875C19.9613%207.875%2021.5902%205.30859%2024.7543%205.30859C25.6449%205.30859%2026.5004%205.53125%2027.2972%205.98828C27.8011%206.28125%2027.8011%206.80859%2027.5902%207.13672C27.4027%207.41797%2027.016%207.58203%2026.6058%207.34766C25.9261%206.96094%2025.3988%206.83203%2024.7543%206.83203C22.0355%206.83203%2020.3949%209.38672%2017.2777%209.38672ZM17.266%2012.6445C16.3754%2012.6445%2015.5199%2012.4453%2014.7465%2011.9648C14.2543%2011.6836%2014.2308%2011.168%2014.4418%2010.8398C14.6293%2010.5352%2015.0277%2010.3828%2015.4261%2010.6055C16.1058%2010.9922%2016.6332%2011.1328%2017.266%2011.1328C19.9496%2011.1328%2021.5785%208.57812%2024.7543%208.57812C25.6449%208.57812%2026.4886%208.80078%2027.2738%209.25781C27.7894%209.55078%2027.8011%2010.0664%2027.5785%2010.4062C27.391%2010.6758%2027.016%2010.8398%2026.5941%2010.6055C25.9144%2010.2305%2025.3871%2010.1016%2024.7543%2010.1016C22.0238%2010.1016%2020.3949%2012.6445%2017.266%2012.6445Z%22%20fill%3D%22white%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "roller-shade-closed": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2021.7939%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2221.7939%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M1.19485%205.25431C1.19485%205.60895%201.4914%205.91585%201.85639%205.91585C2.22348%205.91585%202.53039%205.60895%202.53039%205.25431C2.53039%204.88721%202.22348%204.59066%201.85639%204.59066C1.4914%204.59066%201.19485%204.88721%201.19485%205.25431ZM1.19485%207.45527C1.19485%207.82237%201.4914%208.12927%201.85639%208.12927C2.22348%208.12927%202.53039%207.82237%202.53039%207.45527C2.53039%207.09029%202.22348%206.79374%201.85639%206.79374C1.4914%206.79374%201.19485%207.09029%201.19485%207.45527ZM1.07526%2012.0795C1.07526%2012.5146%201.43372%2012.8648%201.85639%2012.8648C2.29152%2012.8648%202.64173%2012.5146%202.64173%2012.0795L2.64173%209.78427C2.64173%209.35738%202.29363%208.99892%201.85639%208.99892C1.43161%208.99892%201.07526%209.35738%201.07526%209.78427Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%201.85639C0%202.881%200.829661%203.71066%201.85639%203.71066C2.88311%203.71066%203.71277%202.881%203.71277%201.85639C3.71277%200.831771%202.88311%200%201.85639%200C0.829661%200%200%200.831771%200%201.85639ZM6.70803%2019.9405L19.9375%2019.9405C20.9621%2019.9405%2021.7939%2019.1087%2021.7939%2018.0841L21.7939%201.85639C21.7939%200.831771%2020.9621%200%2019.9375%200L4.21081%200C4.65247%200.446083%204.85165%201.0415%204.85165%201.85639L4.85165%2018.0841C4.85165%2019.1087%205.68131%2019.9405%206.70803%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "roller-shade-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2021.0462%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2221.0462%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M1.85639%205.99563C2.22348%205.99563%202.53039%205.69084%202.53039%205.32164C2.53039%204.95665%202.22348%204.6601%201.85639%204.6601C1.4914%204.6601%201.19485%204.95665%201.19485%205.32164C1.19485%205.69084%201.4914%205.99563%201.85639%205.99563ZM1.85639%208.28061C2.22348%208.28061%202.53039%207.96335%202.53039%207.60872C2.53039%207.24162%202.22348%206.94507%201.85639%206.94507C1.4914%206.94507%201.19485%207.24162%201.19485%207.60872C1.19485%207.96335%201.4914%208.28061%201.85639%208.28061ZM1.85639%2010.5531C2.22348%2010.5531%202.53039%2010.2462%202.53039%209.89158C2.53039%209.52448%202.22348%209.22793%201.85639%209.22793C1.4914%209.22793%201.19485%209.52448%201.19485%209.89158C1.19485%2010.2462%201.4914%2010.5531%201.85639%2010.5531ZM1.85639%2012.8381C2.22348%2012.8381%202.53039%2012.5333%202.53039%2012.1766C2.53039%2011.8095%202.22348%2011.5047%201.85639%2011.5047C1.4914%2011.5047%201.19485%2011.8095%201.19485%2012.1766C1.19485%2012.5333%201.4914%2012.8381%201.85639%2012.8381ZM1.85639%2015.1231C2.22348%2015.1231%202.53039%2014.8162%202.53039%2014.4594C2.53039%2014.0841%202.22348%2013.7875%201.85639%2013.7875C1.4914%2013.7875%201.19485%2014.0841%201.19485%2014.4594C1.19485%2014.8162%201.4914%2015.1231%201.85639%2015.1231ZM1.85639%2019.9405C2.29152%2019.9405%202.64173%2019.58%202.64173%2019.1552L2.64173%2016.8578C2.64173%2016.4331%202.29363%2016.0725%201.85639%2016.0725C1.43161%2016.0725%201.07526%2016.4331%201.07526%2016.8578L1.07526%2019.1552C1.07526%2019.58%201.43372%2019.9405%201.85639%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M4.21081%203.71066L19.1899%203.71066C20.2145%203.71066%2021.0462%202.881%2021.0462%201.85639C21.0462%200.831771%2020.2145%200%2019.1899%200L4.21081%200C4.61107%200.508187%204.85165%201.1636%204.85165%201.85639C4.85165%202.56777%204.61107%203.20459%204.21081%203.71066ZM1.85639%203.71066C2.88311%203.71066%203.71277%202.881%203.71277%201.85639C3.71277%200.831771%202.88311%200%201.85639%200C0.829661%200%200%200.831771%200%201.85639C0%202.881%200.829661%203.71066%201.85639%203.71066Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "roman-shade-closed": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2020.744%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2220.744%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.3718%207.51314L19.2511%207.51314C19.6661%207.51314%2019.9586%207.21237%2019.9586%206.81191L19.9586%203.31542C19.9586%202.91708%2019.6661%202.62876%2019.2511%202.62876L3.3718%202.62876C2.95888%202.62876%202.66635%202.91708%202.66635%203.31542L2.66635%206.81191C2.66635%207.21237%202.95888%207.51314%203.3718%207.51314ZM3.3718%2013.7227L19.2511%2013.7227C19.6661%2013.7227%2019.9586%2013.4323%2019.9586%2013.0318L19.9586%209.53534C19.9586%209.13699%2019.6661%208.83833%2019.2511%208.83833L3.3718%208.83833C2.95888%208.83833%202.66635%209.13699%202.66635%209.53534L2.66635%2013.0318C2.66635%2013.4323%202.95888%2013.7227%203.3718%2013.7227ZM3.3718%2019.9426L19.2511%2019.9426C19.6661%2019.9426%2019.9586%2019.6522%2019.9586%2019.2414L19.9586%2015.7553C19.9586%2015.3569%2019.6661%2015.0561%2019.2511%2015.0561L3.3718%2015.0561C2.95888%2015.0561%202.66635%2015.3569%202.66635%2015.7553L2.66635%2019.2414C2.66635%2019.6522%202.95888%2019.9426%203.3718%2019.9426Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.0232123%200.785347C0.0232123%201.21224%200.381668%201.57069%200.806449%201.57069L19.9586%201.57069C20.3937%201.57069%2020.744%201.21224%2020.744%200.785347C20.744%200.360566%2020.3937%200%2019.9586%200L0.806449%200C0.381668%200%200.0232123%200.360566%200.0232123%200.785347ZM0.806449%203.84511C1.17355%203.84511%201.48045%203.52997%201.48045%203.17323C1.48045%202.80613%201.17355%202.51169%200.806449%202.51169C0.441462%202.51169%200.14491%202.80613%200.14491%203.17323C0.14491%203.52997%200.441462%203.84511%200.806449%203.84511ZM0.806449%206.10074C1.17355%206.10074%201.48045%205.79595%201.48045%205.43921C1.48045%205.06176%201.17355%204.76732%200.806449%204.76732C0.441462%204.76732%200.14491%205.06176%200.14491%205.43921C0.14491%205.79595%200.441462%206.10074%200.806449%206.10074ZM0.806449%208.36059C1.17355%208.36059%201.48045%208.05369%201.48045%207.69695C1.48045%207.33196%201.17355%207.03541%200.806449%207.03541C0.441462%207.03541%200.14491%207.33196%200.14491%207.69695C0.14491%208.05369%200.441462%208.36059%200.806449%208.36059ZM0.806449%2013.1569C1.23123%2013.1569%201.5918%2012.7985%201.5918%2012.3716L1.5918%2010.0764C1.5918%209.64949%201.24369%209.29104%200.806449%209.29104C0.381668%209.29104%200.0253225%209.64949%200.0253225%2010.0764L0.0253225%2012.3716C0.0253225%2012.7985%200.383778%2013.1569%200.806449%2013.1569Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "roman-shade-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2020.744%2019.953%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2219.953%22%20opacity%3D%220%22%20width%3D%2220.744%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.3718%205.70672L19.2511%205.70672C19.6661%205.70672%2019.9586%205.40806%2019.9586%205.0076L19.9586%203.31542C19.9586%202.91708%2019.6661%202.62876%2019.2511%202.62876L3.3718%202.62876C2.95888%202.62876%202.66635%202.91708%202.66635%203.31542L2.66635%205.0076C2.66635%205.40806%202.95888%205.70672%203.3718%205.70672ZM4.30577%209.91531L18.3067%209.91531C18.7197%209.91531%2019.0143%209.627%2019.0143%209.22654L19.0143%207.03191L3.60856%207.03191L3.60856%209.22654C3.60856%209.627%203.90109%209.91531%204.30577%209.91531Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M0.0232123%200.785347C0.0232123%201.21224%200.381668%201.57069%200.806449%201.57069L19.9586%201.57069C20.3937%201.57069%2020.744%201.21224%2020.744%200.785347C20.744%200.360566%2020.3937%200%2019.9586%200L0.806449%200C0.381668%200%200.0232123%200.360566%200.0232123%200.785347ZM0.806449%203.84511C1.17355%203.84511%201.48045%203.52997%201.48045%203.17323C1.48045%202.80613%201.17355%202.51169%200.806449%202.51169C0.441462%202.51169%200.14491%202.80613%200.14491%203.17323C0.14491%203.52997%200.441462%203.84511%200.806449%203.84511ZM0.806449%206.10074C1.17355%206.10074%201.48045%205.79595%201.48045%205.43921C1.48045%205.06176%201.17355%204.76732%200.806449%204.76732C0.441462%204.76732%200.14491%205.06176%200.14491%205.43921C0.14491%205.79595%200.441462%206.10074%200.806449%206.10074ZM0.806449%208.36059C1.17355%208.36059%201.48045%208.05369%201.48045%207.69695C1.48045%207.33196%201.17355%207.03541%200.806449%207.03541C0.441462%207.03541%200.14491%207.33196%200.14491%207.69695C0.14491%208.05369%200.441462%208.36059%200.806449%208.36059ZM0.806449%2010.6266C1.17355%2010.6266%201.48045%2010.3093%201.48045%209.95258C1.48045%209.58759%201.17355%209.29104%200.806449%209.29104C0.441462%209.29104%200.14491%209.58759%200.14491%209.95258C0.14491%2010.3093%200.441462%2010.6266%200.806449%2010.6266ZM0.806449%2012.8843C1.17355%2012.8843%201.48045%2012.5774%201.48045%2012.2207C1.48045%2011.8453%201.17355%2011.5488%200.806449%2011.5488C0.441462%2011.5488%200.14491%2011.8453%200.14491%2012.2207C0.14491%2012.5774%200.441462%2012.8843%200.806449%2012.8843ZM0.806449%2015.1399C1.17355%2015.1399%201.48045%2014.833%201.48045%2014.4784C1.48045%2014.1113%201.17355%2013.8148%200.806449%2013.8148C0.441462%2013.8148%200.14491%2014.1113%200.14491%2014.4784C0.14491%2014.833%200.441462%2015.1399%200.806449%2015.1399ZM0.806449%2019.9405C1.23123%2019.9405%201.5918%2019.58%201.5918%2019.1552L1.5918%2016.8578C1.5918%2016.4331%201.24369%2016.0725%200.806449%2016.0725C0.381668%2016.0725%200.0253225%2016.4331%200.0253225%2016.8578L0.0253225%2019.1552C0.0253225%2019.58%200.383778%2019.9405%200.806449%2019.9405Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "scenes": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2027.5039%2027.1289%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2227.1289%22%20opacity%3D%220%22%20width%3D%2227.5039%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M11.2852%2017.3555C12.1641%2017.8711%2012.8906%2018.0469%2013.5703%2018.0469C14.2617%2018.0469%2014.9883%2017.8711%2015.8672%2017.3555L20.3497%2014.7564L24.2344%2017.0039C25.1836%2017.5664%2025.5469%2017.9883%2025.5469%2018.6328C25.5469%2019.2773%2025.1836%2019.6992%2024.2344%2020.25L15.0703%2025.582C14.4961%2025.9102%2014.0508%2026.0625%2013.5703%2026.0625C13.1016%2026.0625%2012.6445%2025.9102%2012.082%2025.582L2.91797%2020.25C1.96875%2019.6992%201.60547%2019.2773%201.60547%2018.6328C1.60547%2017.9883%201.96875%2017.5664%202.91797%2017.0039L6.79609%2014.7559Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M13.5703%2016.4531C14.0508%2016.4531%2014.4961%2016.3008%2015.0703%2015.9727L24.2344%2010.6523C25.1836%2010.0898%2025.5469%209.66797%2025.5469%209.02344C25.5469%208.37891%2025.1836%207.95703%2024.2344%207.40625L15.0703%202.07422C14.4961%201.74609%2014.0508%201.59375%2013.5703%201.59375C13.1016%201.59375%2012.6445%201.74609%2012.082%202.07422L2.91797%207.40625C1.96875%207.95703%201.60547%208.37891%201.60547%209.02344C1.60547%209.66797%201.96875%2010.0898%202.91797%2010.6523L12.082%2015.9727C12.6445%2016.3008%2013.1016%2016.4531%2013.5703%2016.4531Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "skip_next": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2224px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2224px%22%20fill%3D%22%23FFFFFF%22%3E%3Cpath%20d%3D%22M636-312v-336h20v336h-20Zm-332-24v-288l228%20144-228%20144Zm20-144Zm0%20110%20169-110-169-110v220Z%22/%3E%3C/svg%3E",
  "skip_previous": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2224px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2224px%22%20fill%3D%22%23FFFFFF%22%3E%3Cpath%20d%3D%22M304-312v-336h20v336h-20Zm352-24L428-480l228-144v288Zm-20-144Zm0%20110v-220L467-480l169%20110Z%22/%3E%3C/svg%3E",
  "sony": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2031.4047%2024.0352%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.0352%22%20opacity%3D%220%22%20width%3D%2231.4047%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M11.6477%200C13.7922%200.457031%2016.8508%201.39453%2018.55%201.95703C22.8274%203.39844%2024.3391%205.21484%2024.3391%209.35156C24.3391%2012.3398%2022.9563%2013.9219%2020.8821%2013.9219C20.2024%2013.9219%2019.4524%2013.7461%2018.6438%2013.3594L18.6438%205.89453C18.6438%205.03906%2018.55%204.27734%2017.718%204.01953C17.0266%203.79688%2016.6867%204.39453%2016.6867%205.21484L16.6867%2024.0117L11.6477%2022.418ZM17.6242%2020.7422L17.6242%2023.6367L27.9367%2019.957C29.4719%2019.418%2030.4328%2018.8789%2030.7844%2018.3984C31.3586%2017.6602%2031.1008%2016.5%2028.8742%2015.7383C26.5657%2014.9414%2023.8821%2014.6836%2021.7258%2014.8477C20.3899%2014.9531%2018.7961%2015.3867%2017.6242%2015.7852L17.6242%2018.8789L23.0383%2016.9219C23.9524%2016.582%2025.2414%2016.5469%2026.0383%2016.8164C26.7766%2017.0625%2026.7063%2017.4844%2025.7453%2017.8477ZM1.86253%2020.2266C4.13596%2021.0352%207.04221%2021.6914%2010.6282%2020.9062L10.6282%2018.3047L8.23753%2019.1953C7.24143%2019.5469%205.6594%2019.6055%205.10862%2019.4297C4.31175%2019.1602%204.47581%2018.6328%205.5305%2018.2578L10.6282%2016.4414L10.6282%2013.5469L3.62034%2016.0781C2.68284%2016.418%201.74534%2016.6875%200.667214%2017.4258C-0.51638%2018.2344-0.129661%2019.5234%201.86253%2020.2266Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "speaker": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2018.3164%2024.2695%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.2695%22%20opacity%3D%220%22%20width%3D%2218.3164%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%203.32812L0%2020.9297C0%2023.1445%201.10156%2024.2578%203.29297%2024.2578L14.6836%2024.2578C16.875%2024.2578%2017.9648%2023.1445%2017.9648%2020.9297L17.9648%203.32812C17.9648%201.11328%2016.875%200%2014.6836%200L3.29297%200C1.10156%200%200%201.11328%200%203.32812ZM8.98828%2020.8594C6.25781%2020.8594%204.05469%2018.6797%204.05469%2015.9375C4.05469%2013.1836%206.25781%2010.9922%208.98828%2011.0039C11.7188%2011.0156%2013.9219%2013.1836%2013.9219%2015.9375C13.9219%2018.6797%2011.7188%2020.8594%208.98828%2020.8594ZM8.98828%208.87109C7.46484%208.87109%206.24609%207.65234%206.24609%206.12891C6.24609%204.59375%207.46484%203.38672%208.98828%203.39844C10.5%203.41016%2011.7188%204.60547%2011.7305%206.12891C11.7539%207.65234%2010.5%208.87109%208.98828%208.87109ZM8.98828%2018.0234C10.1602%2018.0234%2011.0742%2017.0859%2011.0742%2015.9375C11.0742%2014.7422%2010.1602%2013.8281%208.98828%2013.8281C7.80469%2013.8281%206.90234%2014.7422%206.90234%2015.9375C6.90234%2017.0859%207.83984%2018.0234%208.98828%2018.0234ZM8.98828%207.52344C9.76172%207.52344%2010.3828%206.89062%2010.3828%206.12891C10.3828%205.35547%209.75%204.73438%208.98828%204.73438C8.20312%204.73438%207.59375%205.32031%207.59375%206.12891C7.59375%206.89062%208.20312%207.52344%208.98828%207.52344Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.98828%2020.8594C6.25781%2020.8594%204.05469%2018.6797%204.05469%2015.9375C4.05469%2013.1836%206.25781%2010.9922%208.98828%2011.0039C11.7188%2011.0156%2013.9219%2013.1836%2013.9219%2015.9375C13.9219%2018.6797%2011.7188%2020.8594%208.98828%2020.8594ZM8.98828%208.87109C7.46484%208.87109%206.24609%207.65234%206.24609%206.12891C6.24609%204.59375%207.46484%203.38672%208.98828%203.39844C10.5%203.41016%2011.7188%204.60547%2011.7305%206.12891C11.7539%207.65234%2010.5%208.87109%208.98828%208.87109ZM8.98828%2018.0234C10.1602%2018.0234%2011.0742%2017.0859%2011.0742%2015.9375C11.0742%2014.7422%2010.1602%2013.8281%208.98828%2013.8281C7.80469%2013.8281%206.90234%2014.7422%206.90234%2015.9375C6.90234%2017.0859%207.83984%2018.0234%208.98828%2018.0234ZM8.98828%207.52344C9.76172%207.52344%2010.3828%206.89062%2010.3828%206.12891C10.3828%205.35547%209.75%204.73438%208.98828%204.73438C8.20312%204.73438%207.59375%205.32031%207.59375%206.12891C7.59375%206.89062%208.20312%207.52344%208.98828%207.52344Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.2125%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "temp-high": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2017.8828%2026.0742%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2226.0742%22%20opacity%3D%220%22%20width%3D%2217.8828%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M14.6484%2014.1797L17.1914%2014.1797C17.6016%2014.1797%2017.8828%2013.8633%2017.8828%2013.5C17.8828%2013.125%2017.6016%2012.8086%2017.1914%2012.8086L14.6484%2012.8086C14.2383%2012.8086%2013.957%2013.125%2013.957%2013.5C13.957%2013.8633%2014.2383%2014.1797%2014.6484%2014.1797Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M14.6484%2010.8867L17.1914%2010.8867C17.6016%2010.8867%2017.8828%2010.5703%2017.8828%2010.207C17.8828%209.84375%2017.6016%209.51562%2017.1914%209.51562L14.6484%209.51562C14.2383%209.51562%2013.957%209.84375%2013.957%2010.207C13.957%2010.5703%2014.2383%2010.8867%2014.6484%2010.8867Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M14.6484%207.59375L17.1914%207.59375C17.6016%207.59375%2017.8828%207.27734%2017.8828%206.91406C17.8828%206.55078%2017.6016%206.23438%2017.1914%206.23438L14.6484%206.23438C14.2383%206.23438%2013.957%206.55078%2013.957%206.91406C13.957%207.27734%2014.2383%207.59375%2014.6484%207.59375Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M14.6484%204.30078L17.1914%204.30078C17.6016%204.30078%2017.8828%203.98438%2017.8828%203.62109C17.8828%203.25781%2017.6016%202.94141%2017.1914%202.94141L14.6484%202.94141C14.2383%202.94141%2013.957%203.25781%2013.957%203.62109C13.957%203.98438%2014.2383%204.30078%2014.6484%204.30078Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.77734%2026.0391C12.1523%2026.0391%2014.8828%2023.2969%2014.8828%2019.9219C14.8828%2018.1406%2014.1562%2016.582%2012.75%2015.3164C12.5039%2015.0938%2012.4453%2014.9531%2012.4453%2014.6016L12.457%204.00781C12.457%201.62891%2010.957%200%208.77734%200C6.57422%200%205.0625%201.62891%205.0625%204.00781L5.07422%2014.6016C5.07422%2014.9531%205.02734%2015.0938%204.76953%2015.3164C3.375%2016.582%202.63672%2018.1406%202.63672%2019.9219C2.63672%2023.2969%205.37891%2026.0391%208.77734%2026.0391ZM8.77734%2024.3398C6.32812%2024.3398%204.35938%2022.3477%204.35938%2019.9219C4.35938%2018.457%205.05078%2017.1328%206.29297%2016.3008C6.65625%2016.0547%206.79688%2015.832%206.79688%2015.3516L6.79688%204.07812C6.79688%202.67188%207.60547%201.72266%208.77734%201.72266C9.92578%201.72266%2010.7344%202.67188%2010.7344%204.07812L10.7344%2015.3516C10.7344%2015.832%2010.875%2016.0547%2011.2383%2016.3008C12.4805%2017.1328%2013.1719%2018.457%2013.1719%2019.9219C13.1719%2022.3477%2011.1914%2024.3398%208.77734%2024.3398Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.2125%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.76562%2022.7578C10.3359%2022.7578%2011.6016%2021.4922%2011.6016%2019.9102C11.6016%2018.8086%2010.9805%2017.9062%2010.0781%2017.4141C9.70312%2017.2148%209.57422%2017.0742%209.57422%2016.5L9.57422%203.80859C9.57422%203.24609%209.21094%202.88281%208.76562%202.88281C8.30859%202.88281%207.95703%203.24609%207.95703%203.80859L7.95703%2016.5C7.95703%2017.0742%207.82812%2017.2148%207.45312%2017.4141C6.55078%2017.9062%205.92969%2018.8086%205.92969%2019.9102C5.92969%2021.4922%207.19531%2022.7578%208.76562%2022.7578Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "temp-low": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2017.8828%2026.0742%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2226.0742%22%20opacity%3D%220%22%20width%3D%2217.8828%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M14.6484%204.30078L17.1914%204.30078C17.6016%204.30078%2017.8828%203.98438%2017.8828%203.62109C17.8828%203.25781%2017.6016%202.94141%2017.1914%202.94141L14.6484%202.94141C14.2383%202.94141%2013.957%203.25781%2013.957%203.62109C13.957%203.98438%2014.2383%204.30078%2014.6484%204.30078ZM14.6484%207.59375L17.1914%207.59375C17.6016%207.59375%2017.8828%207.27734%2017.8828%206.91406C17.8828%206.55078%2017.6016%206.23438%2017.1914%206.23438L14.6484%206.23438C14.2383%206.23438%2013.957%206.55078%2013.957%206.91406C13.957%207.27734%2014.2383%207.59375%2014.6484%207.59375ZM14.6484%2010.8867L17.1914%2010.8867C17.6016%2010.8867%2017.8828%2010.5703%2017.8828%2010.207C17.8828%209.84375%2017.6016%209.51562%2017.1914%209.51562L14.6484%209.51562C14.2383%209.51562%2013.957%209.84375%2013.957%2010.207C13.957%2010.5703%2014.2383%2010.8867%2014.6484%2010.8867ZM14.6484%2014.1797L17.1914%2014.1797C17.6016%2014.1797%2017.8828%2013.8633%2017.8828%2013.5C17.8828%2013.125%2017.6016%2012.8086%2017.1914%2012.8086L14.6484%2012.8086C14.2383%2012.8086%2013.957%2013.125%2013.957%2013.5C13.957%2013.8633%2014.2383%2014.1797%2014.6484%2014.1797Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.77734%2026.0391C12.1523%2026.0391%2014.8828%2023.2969%2014.8828%2019.9219C14.8828%2018.1406%2014.1562%2016.582%2012.75%2015.3164C12.5039%2015.0938%2012.4453%2014.9531%2012.4453%2014.6016L12.4453%204.00781C12.4453%201.62891%2010.957%200%208.77734%200C6.57422%200%205.07422%201.62891%205.07422%204.00781L5.07422%2014.6016C5.07422%2014.9531%205.02734%2015.0938%204.76953%2015.3164C3.375%2016.582%202.63672%2018.1406%202.63672%2019.9219C2.63672%2023.2969%205.37891%2026.0391%208.77734%2026.0391ZM8.77734%2024.3398C6.32812%2024.3398%204.35938%2022.3477%204.35938%2019.9219C4.35938%2018.457%205.05078%2017.1328%206.29297%2016.3008C6.65625%2016.0547%206.79688%2015.832%206.79688%2015.3516L6.79688%204.07812C6.79688%202.67188%207.60547%201.72266%208.77734%201.72266C9.92578%201.72266%2010.7344%202.67188%2010.7344%204.07812L10.7344%2015.3516C10.7344%2015.832%2010.875%2016.0547%2011.2383%2016.3008C12.4805%2017.1328%2013.1719%2018.457%2013.1719%2019.9219C13.1719%2022.3477%2011.1914%2024.3398%208.77734%2024.3398Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.2125%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.76562%2022.7578C10.3359%2022.7578%2011.6016%2021.4922%2011.6016%2019.9102C11.6016%2018.8086%2010.9805%2017.9062%2010.0781%2017.4141C9.70312%2017.2148%209.57422%2017.0742%209.57422%2016.5L9.57422%2014.332C9.57422%2013.7695%209.21094%2013.4062%208.76562%2013.4062C8.30859%2013.4062%207.95703%2013.7695%207.95703%2014.332L7.95703%2016.5C7.95703%2017.0742%207.82812%2017.2148%207.45312%2017.4141C6.55078%2017.9062%205.92969%2018.8086%205.92969%2019.9102C5.92969%2021.4922%207.19531%2022.7578%208.76562%2022.7578Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "temp-medium": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2017.8828%2026.0742%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2226.0742%22%20opacity%3D%220%22%20width%3D%2217.8828%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M14.6484%204.30078L17.1914%204.30078C17.6016%204.30078%2017.8828%203.98438%2017.8828%203.62109C17.8828%203.25781%2017.6016%202.94141%2017.1914%202.94141L14.6484%202.94141C14.2383%202.94141%2013.957%203.25781%2013.957%203.62109C13.957%203.98438%2014.2383%204.30078%2014.6484%204.30078ZM14.6484%207.59375L17.1914%207.59375C17.6016%207.59375%2017.8828%207.27734%2017.8828%206.91406C17.8828%206.55078%2017.6016%206.23438%2017.1914%206.23438L14.6484%206.23438C14.2383%206.23438%2013.957%206.55078%2013.957%206.91406C13.957%207.27734%2014.2383%207.59375%2014.6484%207.59375ZM14.6484%2010.8867L17.1914%2010.8867C17.6016%2010.8867%2017.8828%2010.5703%2017.8828%2010.207C17.8828%209.84375%2017.6016%209.51562%2017.1914%209.51562L14.6484%209.51562C14.2383%209.51562%2013.957%209.84375%2013.957%2010.207C13.957%2010.5703%2014.2383%2010.8867%2014.6484%2010.8867ZM14.6484%2014.1797L17.1914%2014.1797C17.6016%2014.1797%2017.8828%2013.8633%2017.8828%2013.5C17.8828%2013.125%2017.6016%2012.8086%2017.1914%2012.8086L14.6484%2012.8086C14.2383%2012.8086%2013.957%2013.125%2013.957%2013.5C13.957%2013.8633%2014.2383%2014.1797%2014.6484%2014.1797Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.77734%2026.0391C12.1523%2026.0391%2014.8828%2023.2969%2014.8828%2019.9219C14.8828%2018.1406%2014.1562%2016.582%2012.75%2015.3164C12.5039%2015.0938%2012.4453%2014.9531%2012.4453%2014.6016L12.4453%204.00781C12.4453%201.62891%2010.957%200%208.77734%200C6.57422%200%205.07422%201.62891%205.07422%204.00781L5.07422%2014.6016C5.07422%2014.9531%205.02734%2015.0938%204.76953%2015.3164C3.375%2016.582%202.63672%2018.1406%202.63672%2019.9219C2.63672%2023.2969%205.37891%2026.0391%208.77734%2026.0391ZM8.77734%2024.3398C6.32812%2024.3398%204.35938%2022.3477%204.35938%2019.9219C4.35938%2018.457%205.05078%2017.1328%206.29297%2016.3008C6.65625%2016.0547%206.79688%2015.832%206.79688%2015.3516L6.79688%204.07812C6.79688%202.67188%207.60547%201.72266%208.77734%201.72266C9.92578%201.72266%2010.7344%202.67188%2010.7344%204.07812L10.7344%2015.3516C10.7344%2015.832%2010.875%2016.0547%2011.2383%2016.3008C12.4805%2017.1328%2013.1719%2018.457%2013.1719%2019.9219C13.1719%2022.3477%2011.1914%2024.3398%208.77734%2024.3398Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.2125%22/%3E%0A%20%20%3Cpath%20d%3D%22M8.76562%2022.7578C10.3359%2022.7578%2011.6016%2021.4922%2011.6016%2019.9102C11.6016%2018.8086%2010.9805%2017.9062%2010.0781%2017.4141C9.70312%2017.2148%209.57422%2017.0742%209.57422%2016.5L9.57422%2010.2305C9.57422%209.66797%209.21094%209.30469%208.76562%209.30469C8.30859%209.30469%207.95703%209.66797%207.95703%2010.2305L7.95703%2016.5C7.95703%2017.0742%207.82812%2017.2148%207.45312%2017.4141C6.55078%2017.9062%205.92969%2018.8086%205.92969%2019.9102C5.92969%2021.4922%207.19531%2022.7578%208.76562%2022.7578Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "thermostat": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2224px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2224px%22%20fill%3D%22%23FFFFFF%22%3E%3Cpath%20d%3D%22M520-520v-80h200v80H520Zm0-160v-80h320v80H520ZM320-120q-83%200-141.5-58.5T120-320q0-48%2021-89.5t59-70.5v-240q0-50%2035-85t85-35q50%200%2085%2035t35%2085v240q38%2029%2059%2070.5t21%2089.5q0%2083-58.5%20141.5T320-120ZM200-320h240q0-29-12.5-54T392-416l-32-24v-280q0-17-11.5-28.5T320-760q-17%200-28.5%2011.5T280-720v280l-32%2024q-23%2017-35.5%2042T200-320Z%22/%3E%3C/svg%3E",
  "tv-play": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2029.6484%2023.4492%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2223.4492%22%20opacity%3D%220%22%20width%3D%2229.6484%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.01172%2019.4531L26.2852%2019.4531C28.2891%2019.4531%2029.2969%2018.4805%2029.2969%2016.4414L29.2969%203.01172C29.2969%200.972656%2028.2891%200%2026.2852%200L3.01172%200C1.01953%200%200%200.972656%200%203.01172L0%2016.4414C0%2018.4805%201.01953%2019.4531%203.01172%2019.4531ZM8.75391%2023.4258L20.543%2023.4258C21.0586%2023.4258%2021.4922%2023.0039%2021.4922%2022.4766C21.4922%2021.9492%2021.0586%2021.5273%2020.543%2021.5273L8.75391%2021.5273C8.23828%2021.5273%207.80469%2021.9492%207.80469%2022.4766C7.80469%2023.0039%208.23828%2023.4258%208.75391%2023.4258Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.2125%22/%3E%0A%20%20%3Cpath%20d%3D%22M10.7109%2014.6953L10.7109%204.76953C10.7109%204.13672%2011.3789%203.91406%2011.8828%204.20703L20.0039%208.98828C20.5781%209.32812%2020.6016%2010.125%2020.0156%2010.4648L11.8828%2015.2578C11.3789%2015.5508%2010.7109%2015.3281%2010.7109%2014.6953Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "tv": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2029.6484%2023.4492%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2223.4492%22%20opacity%3D%220%22%20width%3D%2229.6484%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.04688%2017.5781C2.32031%2017.5781%201.88672%2017.1445%201.88672%2016.4297L1.88672%203.03516C1.88672%202.32031%202.32031%201.88672%203.04688%201.88672L26.25%201.88672C26.9766%201.88672%2027.4102%202.32031%2027.4102%203.03516L27.4102%2016.4297C27.4102%2017.1445%2026.9766%2017.5781%2026.25%2017.5781Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.18%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.01172%2019.4648L26.2852%2019.4648C28.1602%2019.4648%2029.2969%2018.3164%2029.2969%2016.4531L29.2969%203.01172C29.2969%201.14844%2028.1602%200%2026.2852%200L3.01172%200C1.14844%200%200%201.14844%200%203.01172L0%2016.4531C0%2018.3164%201.14844%2019.4648%203.01172%2019.4648ZM3.04688%2017.5781C2.32031%2017.5781%201.88672%2017.1445%201.88672%2016.4297L1.88672%203.03516C1.88672%202.32031%202.32031%201.88672%203.04688%201.88672L26.25%201.88672C26.9766%201.88672%2027.4102%202.32031%2027.4102%203.03516L27.4102%2016.4297C27.4102%2017.1445%2026.9766%2017.5781%2026.25%2017.5781ZM8.75391%2023.4375L20.543%2023.4375C21.0586%2023.4375%2021.4922%2023.0156%2021.4922%2022.4883C21.4922%2021.9609%2021.0586%2021.5391%2020.543%2021.5391L8.75391%2021.5391C8.23828%2021.5391%207.80469%2021.9609%207.80469%2022.4883C7.80469%2023.0156%208.23828%2023.4375%208.75391%2023.4375Z%22%20fill%3D%22white%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "unmute": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20height%3D%2224px%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2224px%22%20fill%3D%22%23FFFFFF%22%3E%3Cpath%20d%3D%22M340-436v-88h114l118-118v324L454-436H340Zm20-20h102l90%2090v-228l-90%2090H360v48Zm100-24Z%22/%3E%3C/svg%3E",
  "updates": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2021.1523%2026.0039%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2226.0039%22%20opacity%3D%220%22%20width%3D%2221.1523%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M20.8008%2011.1328L20.8008%2020.1562C20.8008%2023.3086%2019.043%2025.0547%2015.8906%2025.0547L4.89844%2025.0547C1.74609%2025.0547%200%2023.3086%200%2020.1562L0%2011.1328C0%207.99219%201.74609%206.23438%204.89844%206.23438L9.46875%206.23438L9.46875%2012.832L9.53906%2014.5781L8.88281%2013.8867L7.06641%2011.9531C6.90234%2011.7656%206.65625%2011.6719%206.42188%2011.6719C5.92969%2011.6719%205.57812%2012.0234%205.57812%2012.4922C5.57812%2012.75%205.68359%2012.9375%205.85938%2013.1133L9.72656%2016.8398C9.96094%2017.0742%2010.1602%2017.1562%2010.4062%2017.1562C10.6406%2017.1562%2010.8398%2017.0742%2011.0742%2016.8398L14.9414%2013.1133C15.1172%2012.9375%2015.2227%2012.75%2015.2227%2012.4922C15.2227%2012.0234%2014.8477%2011.6719%2014.3672%2011.6719C14.1328%2011.6719%2013.8984%2011.7656%2013.7344%2011.9531L11.918%2013.8867L11.2617%2014.5781L11.332%2012.832L11.332%206.23438L15.8906%206.23438C19.043%206.23438%2020.8008%207.99219%2020.8008%2011.1328Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.2125%22/%3E%0A%20%20%3Cpath%20d%3D%22M10.4062%200C10.9102%200%2011.332%200.410156%2011.332%200.902344L11.332%2012.832L11.2617%2014.5781L11.918%2013.8867L13.7344%2011.9531C13.8984%2011.7656%2014.1328%2011.6719%2014.3672%2011.6719C14.8477%2011.6719%2015.2227%2012.0234%2015.2227%2012.4922C15.2227%2012.75%2015.1172%2012.9375%2014.9414%2013.1133L11.0742%2016.8398C10.8398%2017.0742%2010.6406%2017.1562%2010.4062%2017.1562C10.1602%2017.1562%209.96094%2017.0742%209.72656%2016.8398L5.85938%2013.1133C5.68359%2012.9375%205.57812%2012.75%205.57812%2012.4922C5.57812%2012.0234%205.92969%2011.6719%206.42188%2011.6719C6.65625%2011.6719%206.90234%2011.7656%207.06641%2011.9531L8.88281%2013.8867L9.53906%2014.5781L9.46875%2012.832L9.46875%200.902344C9.46875%200.410156%209.90234%200%2010.4062%200Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "vacuum-charge": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2026.7422%2024.293%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2224.293%22%20opacity%3D%220%22%20width%3D%2226.7422%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M21.0469%2024.293C22.1484%2024.293%2023.0391%2023.4023%2023.0391%2022.2891C23.0391%2021.1875%2022.1484%2020.2969%2021.0469%2020.2969C19.9336%2020.2969%2019.043%2021.1875%2019.043%2022.2891C19.043%2023.4023%2019.9336%2024.293%2021.0469%2024.293Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M13.1953%2024.293C14.3086%2024.293%2015.1992%2023.4023%2015.1992%2022.2891C15.1992%2021.1875%2014.3086%2020.2969%2013.1953%2020.2969C12.0938%2020.2969%2011.2031%2021.1875%2011.2031%2022.2891C11.2031%2023.4023%2012.0938%2024.293%2013.1953%2024.293Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M5.35547%2024.293C6.48047%2024.293%207.37109%2023.4023%207.37109%2022.2891C7.37109%2021.1875%206.48047%2020.2969%205.35547%2020.2969C4.25391%2020.2969%203.36328%2021.1875%203.36328%2022.2891C3.36328%2023.4023%204.25391%2024.293%205.35547%2024.293Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M13.1953%2010.5703C19.3594%2010.5703%2026.2148%208.35547%2026.2148%205.74219C26.2148%203.16406%2020.3906%201.06641%2013.1953%201.06641C6%201.06641%200.175781%203.16406%200.175781%205.74219C0.175781%208.35547%207.04297%2010.5703%2013.1953%2010.5703ZM4.76953%2016.418C5.0625%2016.5117%205.25%2016.3594%205.25%2016.0664L5.25%2014.9648C5.25%2014.4727%205.64844%2014.2148%206.10547%2014.3438C8.50781%2015.0234%2011.2969%2015.2227%2013.2773%2015.2227C15.2812%2015.2227%2018.0586%2015.0234%2020.4609%2014.3438C20.918%2014.2148%2021.3164%2014.4727%2021.3164%2014.9648L21.3164%2016.0078C21.3164%2016.3125%2021.5039%2016.4531%2021.7969%2016.3594C24.5977%2015.3867%2026.3906%2013.8633%2026.3906%2011.9648L26.3906%208.12109C24.5859%2010.207%2019.1719%2011.9414%2013.1953%2011.9414C7.33594%2011.9414%201.80469%2010.207%200%208.12109L0%2011.9648C0%2013.9102%201.86328%2015.4453%204.76953%2016.418ZM13.1953%205.91797C10.8281%205.91797%209.50391%205.29688%209.50391%204.37109C9.50391%203.46875%2010.793%202.82422%2013.1953%202.82422C15.6094%202.82422%2016.8984%203.46875%2016.8984%204.37109C16.8984%205.29688%2015.5742%205.91797%2013.1953%205.91797ZM13.1953%204.99219C14.6953%204.99219%2015.4688%204.71094%2015.4688%204.37109C15.4688%204.03125%2014.7422%203.73828%2013.1953%203.73828C11.6484%203.73828%2010.9102%204.03125%2010.9102%204.37109C10.9102%204.71094%2011.6953%204.99219%2013.1953%204.99219ZM9.07031%208.42578C8.39062%208.42578%207.82812%208.15625%207.82812%207.81641C7.82812%207.48828%208.39062%207.21875%209.07031%207.21875C9.75%207.21875%2010.3125%207.48828%2010.3125%207.81641C10.3125%208.15625%209.75%208.42578%209.07031%208.42578ZM13.1953%208.90625C12.5273%208.90625%2011.9648%208.625%2011.9648%208.29688C11.9648%207.95703%2012.5273%207.67578%2013.1953%207.67578C13.875%207.67578%2014.4375%207.95703%2014.4375%208.29688C14.4375%208.625%2013.875%208.90625%2013.1953%208.90625ZM17.332%208.42578C16.6523%208.42578%2016.0898%208.15625%2016.0898%207.81641C16.0898%207.48828%2016.6523%207.21875%2017.332%207.21875C18.0117%207.21875%2018.5742%207.48828%2018.5742%207.81641C18.5742%208.15625%2018.0117%208.42578%2017.332%208.42578Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "vacuum-clean": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2026.7422%2032.5431%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2232.5431%22%20opacity%3D%220%22%20width%3D%2226.7422%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M13.1953%2021.4922C19.3594%2021.4922%2026.2148%2019.2774%2026.2148%2016.6641C26.2148%2014.086%2020.3906%2011.9883%2013.1953%2011.9883C6%2011.9883%200.175781%2014.086%200.175781%2016.6641C0.175781%2019.2774%207.04297%2021.4922%2013.1953%2021.4922ZM4.76953%2027.3399C5.0625%2027.4336%205.25%2027.2813%205.25%2026.9883L5.25%2025.8868C5.25%2025.3946%205.64844%2025.1368%206.10547%2025.2657C8.50781%2025.9336%2011.2969%2026.1446%2013.2773%2026.1446C15.2812%2026.1446%2018.0586%2025.9336%2020.4609%2025.2657C20.918%2025.1368%2021.3164%2025.3946%2021.3164%2025.8868L21.3164%2026.9297C21.3164%2027.2344%2021.5039%2027.3751%2021.7969%2027.2813C24.5977%2026.3086%2026.3906%2024.7852%2026.3906%2022.8868L26.3906%2019.043C24.5859%2021.129%2019.1719%2022.8633%2013.1953%2022.8633C7.33594%2022.8633%201.80469%2021.129%200%2019.043L0%2022.8868C0%2024.8321%201.86328%2026.3672%204.76953%2027.3399ZM13.1953%2016.8399C10.8281%2016.8399%209.50391%2016.2188%209.50391%2015.293C9.50391%2014.3907%2010.793%2013.7344%2013.1953%2013.7344C15.6094%2013.7344%2016.8984%2014.3907%2016.8984%2015.293C16.8984%2016.2188%2015.5742%2016.8399%2013.1953%2016.8399ZM13.1953%2015.9141C14.6953%2015.9141%2015.4688%2015.6329%2015.4688%2015.293C15.4688%2014.9532%2014.7422%2014.6602%2013.1953%2014.6602C11.6484%2014.6602%2010.9102%2014.9532%2010.9102%2015.293C10.9102%2015.6329%2011.6953%2015.9141%2013.1953%2015.9141ZM9.07031%2019.3477C8.39062%2019.3477%207.82812%2019.0782%207.82812%2018.7383C7.82812%2018.4102%208.39062%2018.129%209.07031%2018.129C9.75%2018.129%2010.3125%2018.4102%2010.3125%2018.7383C10.3125%2019.0782%209.75%2019.3477%209.07031%2019.3477ZM13.1953%2019.8282C12.5273%2019.8282%2011.9648%2019.5469%2011.9648%2019.2188C11.9648%2018.879%2012.5273%2018.5977%2013.1953%2018.5977C13.875%2018.5977%2014.4375%2018.879%2014.4375%2019.2188C14.4375%2019.5469%2013.875%2019.8282%2013.1953%2019.8282ZM17.332%2019.3477C16.6523%2019.3477%2016.0898%2019.0782%2016.0898%2018.7383C16.0898%2018.4102%2016.6523%2018.129%2017.332%2018.129C18.0117%2018.129%2018.5742%2018.4102%2018.5742%2018.7383C18.5742%2019.0782%2018.0117%2019.3477%2017.332%2019.3477Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M9.38672%207.86334L17.1914%207.86334C17.7305%207.86334%2017.9766%207.26568%2017.6602%206.73834L13.8984%200.351617C13.6172-0.128851%2012.9609-0.105414%2012.6914%200.351617L8.90625%206.73834C8.625%207.2188%208.84766%207.86334%209.38672%207.86334Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "vacuum": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2026.7422%2015.7148%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2215.7148%22%20opacity%3D%220%22%20width%3D%2226.7422%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M13.1953%209.51562C19.3594%209.51562%2026.2148%207.30078%2026.2148%204.6875C26.2148%202.09766%2020.3906%200%2013.1953%200C6%200%200.175781%202.09766%200.175781%204.6875C0.175781%207.30078%207.04297%209.51562%2013.1953%209.51562ZM4.76953%2015.3516C5.0625%2015.457%205.25%2015.3047%205.25%2015.0117L5.25%2013.8984C5.25%2013.418%205.64844%2013.1484%206.10547%2013.2773C8.50781%2013.957%2011.2969%2014.168%2013.2773%2014.168C15.2812%2014.168%2018.0586%2013.957%2020.4609%2013.2773C20.918%2013.1484%2021.3164%2013.418%2021.3164%2013.8984L21.3164%2014.9531C21.3164%2015.2578%2021.5039%2015.3984%2021.7969%2015.293C24.5977%2014.3203%2026.3906%2012.8086%2026.3906%2010.9102L26.3906%207.06641C24.5859%209.14062%2019.1719%2010.875%2013.1953%2010.875C7.33594%2010.875%201.80469%209.14062%200%207.06641L0%2010.9102C0%2012.8555%201.86328%2014.3789%204.76953%2015.3516ZM13.1953%204.86328C10.8281%204.86328%209.50391%204.24219%209.50391%203.31641C9.50391%202.41406%2010.793%201.75781%2013.1953%201.75781C15.6094%201.75781%2016.8984%202.41406%2016.8984%203.31641C16.8984%204.24219%2015.5742%204.86328%2013.1953%204.86328ZM13.1953%203.92578C14.6953%203.92578%2015.4688%203.65625%2015.4688%203.31641C15.4688%202.97656%2014.7422%202.67188%2013.1953%202.67188C11.6484%202.67188%2010.9102%202.97656%2010.9102%203.31641C10.9102%203.65625%2011.6953%203.92578%2013.1953%203.92578ZM9.07031%207.35938C8.39062%207.35938%207.82812%207.08984%207.82812%206.76172C7.82812%206.42188%208.39062%206.15234%209.07031%206.15234C9.75%206.15234%2010.3125%206.42188%2010.3125%206.76172C10.3125%207.08984%209.75%207.35938%209.07031%207.35938ZM13.1953%207.83984C12.5273%207.83984%2011.9648%207.57031%2011.9648%207.23047C11.9648%206.90234%2012.5273%206.60938%2013.1953%206.60938C13.875%206.60938%2014.4375%206.90234%2014.4375%207.23047C14.4375%207.57031%2013.875%207.83984%2013.1953%207.83984ZM17.332%207.35938C16.6523%207.35938%2016.0898%207.08984%2016.0898%206.76172C16.0898%206.42188%2016.6523%206.15234%2017.332%206.15234C18.0117%206.15234%2018.5742%206.42188%2018.5742%206.76172C18.5742%207.08984%2018.0117%207.35938%2017.332%207.35938Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "weather": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-%2F%2FW3C%2F%2FDTD%20SVG%201.1%2F%2FEN%22%0A%20%20%20%20%20%20%20%22http%3A%2F%2Fwww.w3.org%2FGraphics%2FSVG%2F1.1%2FDTD%2Fsvg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20viewBox%3D%220%200%2030.2189%2021.0966%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2221.0966%22%20opacity%3D%220%22%20width%3D%2230.2189%22%20x%3D%220%22%20y%3D%220%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M25.7751%2014.9444L27.2825%2016.4519C27.5996%2016.7668%2027.5975%2017.2868%2027.2825%2017.5893C26.9697%2017.8939%2026.4496%2017.9064%2026.145%2017.5997L24.6272%2016.0922C24.3226%2015.7773%2024.3226%2015.2572%2024.6272%2014.9444C24.9401%2014.6398%2025.4601%2014.6398%2025.7751%2014.9444ZM24.9481%2010.4253C24.9481%2012.1619%2024.0074%2013.7046%2022.6097%2014.5558C22.3354%2011.7107%2020.0552%209.5696%2017.0565%209.27405C16.7469%208.78252%2016.3913%208.33405%2015.9938%207.93705C16.8403%206.53402%2018.3795%205.58934%2020.1143%205.58934C22.7617%205.58934%2024.9481%207.77573%2024.9481%2010.4253ZM30.2189%2010.4274C30.2189%2010.8811%2029.8625%2011.2375%2029.4149%2011.2375L27.3043%2011.2375C26.8713%2011.2375%2026.4943%2010.8811%2026.4943%2010.4274C26.4943%209.99227%2026.8713%209.61522%2027.3043%209.61522L29.4149%209.61522C29.8625%209.61522%2030.2189%209.99227%2030.2189%2010.4274ZM27.2825%203.26949C27.5975%203.58444%2027.5996%204.10237%2027.2825%204.41943L25.7854%205.91654C25.4601%206.23972%2024.9401%206.22937%2024.6272%205.91654C24.3226%205.6016%2024.3226%205.08155%2024.6272%204.78731L26.145%203.26949C26.4496%202.95455%2026.9697%202.95666%2027.2825%203.26949ZM14.098%203.26949L15.6055%204.78731C15.908%205.08155%2015.908%205.61195%2015.5952%205.91654C15.2906%206.22937%2014.7705%206.22937%2014.4577%205.91654L12.9585%204.40908C12.6539%204.10237%2012.656%203.58444%2012.9688%203.26949C13.2838%202.95666%2013.8017%202.9649%2014.098%203.26949ZM20.9307%201.10391L20.9307%203.22276C20.9307%203.66402%2020.5597%204.02459%2020.1164%204.02459C19.6812%204.02459%2019.3021%203.66402%2019.3021%203.22276L19.3021%201.10391C19.3021%200.670888%2019.6812%200.293841%2020.1164%200.293841C20.5597%200.293841%2020.9307%200.670888%2020.9307%201.10391Z%22%20fill%3D%22%23ffd600%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M6.00386%2019.9577L16.5713%2019.9577C19.3516%2019.9577%2021.4987%2017.8543%2021.4987%2015.1365C21.4987%2012.4394%2019.3121%2010.4026%2016.3823%2010.3798C15.2608%208.24261%2013.2428%206.92959%2010.8414%206.92959C7.64569%206.92959%204.95684%209.40319%204.66199%2012.6118C3.03383%2013.1058%201.93245%2014.4926%201.93245%2016.2456C1.93245%2018.4168%203.55368%2019.9577%206.00386%2019.9577Z%22%20fill%3D%22white%22%2F%3E%0A%20%3C%2Fg%3E%0A%3C%2Fsvg%3E%0A",
  "wifi": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20341--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%22-1.0933%20-0.7795%2029.5182%2021.0474%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2221.0474%22%20opacity%3D%220%22%20width%3D%2229.5182%22%20x%3D%22-1.0933%22%20y%3D%22-0.7795%22/%3E%0A%20%20%3Cpath%20d%3D%22M1.77132%208.21484C2.00569%208.4375%202.33382%208.4375%202.55647%208.20312C5.43928%205.14453%209.23616%203.52734%2013.4901%203.52734C17.7674%203.52734%2021.5877%205.15625%2024.4471%208.21484C24.658%208.42578%2024.9744%208.41406%2025.2088%208.19141L26.826%206.57422C27.0369%206.36328%2027.0252%206.10547%2026.8612%205.90625C24.1073%202.50781%2018.9276%200.0117188%2013.4901%200.0117188C8.06428%200.0117188%202.86116%202.50781%200.118972%205.90625C-0.0450907%206.10547-0.0450907%206.36328%200.154128%206.57422Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M6.6346%2013.1133C6.89241%2013.3594%207.20882%2013.3242%207.44319%2013.0664C8.84944%2011.5078%2011.1463%2010.3711%2013.4901%2010.3828C15.8573%2010.3711%2018.1541%2011.543%2019.5838%2013.1016C19.7948%2013.3477%2020.0877%2013.3359%2020.3455%2013.1016L22.1619%2011.2969C22.3494%2011.1094%2022.3729%2010.8516%2022.1971%2010.6406C20.4276%208.47266%2017.1463%206.84375%2013.4901%206.84375C9.83382%206.84375%206.55257%208.47266%204.78303%2010.6406C4.60725%2010.8516%204.61897%2011.0859%204.81819%2011.2969Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%20%3Cpath%20d%3D%22M13.4901%2019.4883C13.7479%2019.4883%2013.9705%2019.3711%2014.4276%2018.9258L17.2869%2016.1836C17.4627%2016.0078%2017.5096%2015.75%2017.3455%2015.5391C16.5838%2014.5547%2015.1424%2013.6992%2013.4901%2013.6992C11.7908%2013.6992%2010.3494%2014.5898%209.58772%2015.6094C9.47053%2015.7969%209.51741%2016.0078%209.70491%2016.1836L12.5526%2018.9258C13.0096%2019.3594%2013.2323%2019.4883%2013.4901%2019.4883Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "tile": null,
  "window-shade-closed": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2016.7049%2020.7354%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2220.7354%22%20opacity%3D%220%22%20width%3D%2216.7049%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%2018.7286C0%2019.9165%200.81891%2020.723%202.04421%2020.723L14.6607%2020.723C15.8964%2020.723%2016.7049%2019.9165%2016.7049%2018.7286L16.7049%201.99436C16.7049%200.806449%2015.8964%200%2014.6607%200L2.04421%200C0.81891%200%200%200.806449%200%201.99436ZM1.5728%2018.631L1.5728%202.09194C1.5728%201.78042%201.77218%201.57069%202.06913%201.57069L14.6358%201.57069C14.9327%201.57069%2015.1321%201.78042%2015.1321%202.09194L15.1321%2018.631C15.1321%2018.9425%2014.9327%2019.1523%2014.6358%2019.1523L2.06913%2019.1523C1.77218%2019.1523%201.5728%2018.9425%201.5728%2018.631Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.04119%2018.0134L13.6616%2018.0134C13.8502%2018.0134%2013.9932%2017.86%2013.9932%2017.6818L13.9932%203.04119C13.9932%202.86292%2013.8502%202.70957%2013.6616%202.70957L3.04119%202.70957C2.86503%202.70957%202.71168%202.86292%202.71168%203.04119L2.71168%2017.6818C2.71168%2017.86%202.86503%2018.0134%203.04119%2018.0134ZM6.78891%2016.819C6.50462%2016.819%206.31158%2016.626%206.31158%2016.3417C6.31158%2016.0574%206.50462%2015.8747%206.78891%2015.8747L9.75411%2015.8747C10.0384%2015.8747%2010.2314%2016.0574%2010.2314%2016.3417C10.2314%2016.626%2010.0384%2016.819%209.75411%2016.819Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
  "window-shade-open": "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C%21--Generator%3A%20Apple%20Native%20CoreSVG%20362--%3E%0A%3C%21DOCTYPE%20svg%0APUBLIC%20%22-//W3C//DTD%20SVG%201.1//EN%22%0A%20%20%20%20%20%20%20%22http%3A//www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd%22%3E%0A%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%20viewBox%3D%220%200%2016.7049%2020.7354%22%3E%0A%20%3Cg%3E%0A%20%20%3Crect%20height%3D%2220.7354%22%20opacity%3D%220%22%20width%3D%2216.7049%22%20x%3D%220%22%20y%3D%220%22/%3E%0A%20%20%3Cpath%20d%3D%22M0%2018.7286C0%2019.9165%200.81891%2020.723%202.04421%2020.723L14.6607%2020.723C15.8964%2020.723%2016.7049%2019.9165%2016.7049%2018.7286L16.7049%201.99436C16.7049%200.806449%2015.8964%200%2014.6607%200L2.04421%200C0.81891%200%200%200.806449%200%201.99436ZM1.5728%2018.631L1.5728%202.09194C1.5728%201.78042%201.77218%201.57069%202.06913%201.57069L14.6358%201.57069C14.9327%201.57069%2015.1321%201.78042%2015.1321%202.09194L15.1321%2018.631C15.1321%2018.9425%2014.9327%2019.1523%2014.6358%2019.1523L2.06913%2019.1523C1.77218%2019.1523%201.5728%2018.9425%201.5728%2018.631Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.425%22/%3E%0A%20%20%3Cpath%20d%3D%22M3.04119%206.05503L13.6616%206.05503C13.8502%206.05503%2013.9932%205.90168%2013.9932%205.7234L13.9932%203.04119C13.9932%202.86292%2013.8502%202.70957%2013.6616%202.70957L3.04119%202.70957C2.86503%202.70957%202.71168%202.86292%202.71168%203.04119L2.71168%205.7234C2.71168%205.90168%202.86503%206.05503%203.04119%206.05503ZM6.86468%204.84823C6.59074%204.84823%206.3977%204.66553%206.3977%204.38124C6.3977%204.09695%206.59074%203.90391%206.86468%203.90391L9.84023%203.90391C10.1245%203.90391%2010.3072%204.09695%2010.3072%204.38124C10.3072%204.66553%2010.1245%204.84823%209.84023%204.84823Z%22%20fill%3D%22white%22%20fill-opacity%3D%220.85%22/%3E%0A%20%3C/g%3E%0A%3C/svg%3E%0A",
};

// Drawn by the preview but not offered in any picker: the climate group badge
// renders mdi:fan, which has no Hemma svg to write a name for.
const PREVIEW_ONLY_ICONS = ["mdi-fan", "tile", "badge", "room", "smartsort"];
ICON_DATA.smartsort = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2248%22%20height%3D%2248%22%20fill%3D%22none%22%20viewBox%3D%220%200%2048%2048%22%3E%0A%20%20%3Cg%20stroke%3D%22%23fff%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M16%2037V10%22/%3E%3Cpath%20d%3D%22M8%2018%2016%2010l8%208%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M33%2010v27%22/%3E%3Cpath%20d%3D%22M25%2029l8%208%208-8%22/%3E%0A%20%20%3C/g%3E%0A%3C/svg%3E%0A";
ICON_DATA.room = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2248%22%20height%3D%2248%22%20fill%3D%22none%22%20viewBox%3D%220%200%2048%2048%22%3E%0A%20%20%3Crect%20x%3D%223.5%22%20y%3D%225.5%22%20width%3D%2241%22%20height%3D%2237%22%20rx%3D%229.5%22%20stroke%3D%22%23fff%22%20stroke-width%3D%223%22/%3E%0A%20%20%3Crect%20x%3D%2210.5%22%20y%3D%2213%22%20width%3D%2217%22%20height%3D%223.4%22%20rx%3D%221.7%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%2210.5%22%20y%3D%2219.4%22%20width%3D%2210%22%20height%3D%223%22%20rx%3D%221.5%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%2210.5%22%20y%3D%2228.5%22%20width%3D%2212%22%20height%3D%229%22%20rx%3D%223%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%2225.5%22%20y%3D%2228.5%22%20width%3D%2212%22%20height%3D%229%22%20rx%3D%223%22%20fill%3D%22%23fff%22/%3E%0A%3C/svg%3E%0A";
ICON_DATA.badge = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2248%22%20height%3D%2248%22%20fill%3D%22none%22%20viewBox%3D%220%200%2048%2048%22%3E%0A%20%20%3Crect%20x%3D%223.5%22%20y%3D%226.25%22%20width%3D%2241%22%20height%3D%2214.5%22%20rx%3D%227.25%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222.8%22/%3E%0A%20%20%3Ccircle%20cx%3D%2213.6%22%20cy%3D%2213.5%22%20r%3D%223.2%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%2219.6%22%20y%3D%2212%22%20width%3D%2214%22%20height%3D%223%22%20rx%3D%221.5%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%223.5%22%20y%3D%2227.25%22%20width%3D%2233%22%20height%3D%2214.5%22%20rx%3D%227.25%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222.8%22/%3E%0A%20%20%3Ccircle%20cx%3D%2213.6%22%20cy%3D%2234.5%22%20r%3D%223.2%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%2219.6%22%20y%3D%2233%22%20width%3D%228.5%22%20height%3D%223%22%20rx%3D%221.5%22%20fill%3D%22%23fff%22/%3E%0A%3C/svg%3E%0A";
ICON_DATA.tile = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2248%22%20height%3D%2248%22%20fill%3D%22none%22%20viewBox%3D%220%200%2048%2048%22%3E%0A%20%20%3Crect%20x%3D%223.5%22%20y%3D%223.5%22%20width%3D%2241%22%20height%3D%2241%22%20rx%3D%2211.5%22%20stroke%3D%22%23fff%22%20stroke-width%3D%223%22/%3E%0A%20%20%3Ccircle%20cx%3D%2216.6%22%20cy%3D%2216.6%22%20r%3D%225.1%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%2211.5%22%20y%3D%2228%22%20width%3D%2221%22%20height%3D%223.6%22%20rx%3D%221.8%22%20fill%3D%22%23fff%22/%3E%0A%20%20%3Crect%20x%3D%2211.5%22%20y%3D%2234.2%22%20width%3D%2213.5%22%20height%3D%223.6%22%20rx%3D%221.8%22%20fill%3D%22%23fff%22/%3E%0A%3C/svg%3E%0A";
const HEMMA_ICONS = Object.keys(ICON_DATA)
  .filter((k) => ICON_DATA[k] && !PREVIEW_ONLY_ICONS.includes(k));

const ICON_FIELD = { key: "icon", label: "Icon", type: "icon" };

// Icon-circle tint per tile kind, matching the dashboard's own coloring.
const TILE_COLOR = {
  light: "var(--hemma-color-yellow, #FFCC00)",
  plex: "var(--hemma-color-yellow, #FFCC00)",
  energy_tile: "var(--hemma-color-green, #30D158)",
  battery: "var(--hemma-color-green, #30D158)",
  plant: "var(--hemma-color-green, #30D158)",
  entity_actions: "var(--hemma-color-teal, #00C3D0)",
};
// hemma_weather.yaml's own condition -> file map. The preview showed a fixed
// sun-and-cloud whatever the sky was doing, which is fine as a stand-in but
// wrong once there is a real entity to read.
const WEATHER_SVG = {
  "sunny": "clear-day",
  "clear-night": "clear-night",
  "partlycloudy": "partly-cloudy-day",
  "cloudy": "cloudy",
  "overcast": "cloudy",
  "rainy": "rain",
  "pouring": "rain-heavy",
  "snowy": "snow",
  "snow": "snow",
  "snowy-rainy": "weather-mixed",
  "hail": "rain-heavy",
  "lightning": "thunder",
  "lightning-rainy": "lightning-rainy",
  "fog": "fog",
  "windy": "wind",
  "windy-variant": "wind",
  "exceptional": "weather-mixed",
};

const TILE_TINT = "var(--hemma-color-teal, #00C3D0)";

// Fallback glyph per tile kind, for tiles that set no icon of their own.
const TILE_ICON = {
  light: "light", thermostat: "thermostat", media: "speaker", fan: "fan",
  cover: "curtain-open", vacuum: "vacuum", air_purifier: "purifier",
  humidifier: "humidifier", updates: "updates", plant: "plant",
  energy_tile: "energy", battery: "battery", network: "wifi", plex: "plex",
  lock: "lock-fill", lock_group: "lock-fill", cover_group: "curtain-open",
  cameras: "doorbell",
  entity_actions: "plug",
};

// A tile is a group because it holds more than one entity, not because anyone
// picked "group" - a second entity switches the template, removing it switches
// back. The group templates stay listed but hidden so existing tiles are still
// recognized.
const MEMBER_ID = /^[a-z_]+\.[a-z0-9_]+$/i;

const TILE_GROUP = {
  lock: {
    list: "locks", domains: ["lock"], add: "Add lock", noun: "Lock",
    single: "hemma_lock", group: ["hemma_lock", "hemma_popup_lock"],
    // Keyed by lock entity_id in hemma_popup_lock_group, not lists.
    perMember: [
      { key: "door_sensors", label: "Door sensor", domains: ["binary_sensor"] },
      { key: "battery_entities", label: "Battery", domains: ["sensor"] },
    ],
  },
  cover: {
    list: "covers", domains: ["cover"], add: "Add cover", noun: "Cover",
    single: "hemma_cover", group: ["hemma_cover", "hemma_popup_cover"],
    perMember: [],
  },
  // Entityless: every sensor lives in `batteries`, so rows start at slot 0 and
  // there is no template to switch. The two overrides are what the popup has
  // always read.
  battery: {
    list: "batteries", domains: ["sensor"], classes: ["battery"],
    add: "Add sensor", noun: "Sensor", entityless: true,
    single: null, group: null,
    perMember: [
      { key: "device_names", label: "Name", kind: "text" },
      { key: "device_icons", label: "Icon", kind: "icon" },
    ],
  },
};
// The group templates resolve to these ids, so map them back to the same rule.
TILE_GROUP.lock_group = TILE_GROUP.lock;
TILE_GROUP.cover_group = TILE_GROUP.cover;

// Offered only on domains that turn on and off. boolDefault is what the TEMPLATE
// does when the key is absent, so the switch sits at the real resting position
// rather than offering a third "Default" nobody can resolve.
const TOGGLE_FIELD = { key: "show_toggle", label: "Toggle button", type: "bool",
  boolDefault: false };
const TOGGLE_FIELD_ON = { ...TOGGLE_FIELD, boolDefault: true };

// Offered on the types whose states are in progress_active_states. The ring
// takes the toggle's corner, which is why show_progress suppresses it.
const PROGRESS_FIELDS = [
  { key: "show_progress", label: "Progress ring", type: "bool", boolDefault: false },
  // Almost never set, so Advanced.
  { key: "progress_entity", label: "Progress from",
    domains: ["media_player", "vacuum", "sensor"], advanced: true,
    placeholder: "This tile's entity",
    when: (vars) => !!vars.show_progress },
];

// Control Center's rule: Always Show, or Show When Active. Two answers that both
// need naming, which is what a menu is for and a switch is not. Not showing it
// at all is the switch at the top of the tile.
const WHEN_FIELD = (activeLabel) => ({ key: "show_when", label: "Show",
  type: "select", options: ["", "always"],
  optionLabels: { "": activeLabel, always: "Always" } });

// A different glyph either side of the state, so a pair rather than one Icon.
// The template swaps them automatically, so the pair is an override: Advanced.
const ICON_OPEN_FIELD = { key: "icon_open", label: "Open icon", type: "icon",
  iconDefault: "curtain-open", advanced: true };
const ICON_CLOSED_FIELD = { key: "icon_closed", label: "Closed icon", type: "icon",
  iconDefault: "curtain-closed", advanced: true };
const ICON_LOCKED_FIELD = { key: "icon_locked", label: "Locked icon", type: "icon",
  iconDefault: "lock-fill", advanced: true };
const ICON_UNLOCKED_FIELD = { key: "icon_unlocked", label: "Unlocked icon", type: "icon",
  iconDefault: "lock-open-fill", advanced: true };

// The popup reads ONE flat `sensors` list and infers each entry's type from its
// entity_id. Shown here as the six named slots it draws, so a sensor can be
// swapped without counting array positions. `battery` is last: it is not graded.
const PLANT_SLOTS = [
  { type: "moisture", label: "Moisture", match: (id) => id.includes("moisture") },
  { type: "illuminance", label: "Light", match: (id) => id.includes("illumin") || id.includes("lux") },
  { type: "temperature", label: "Temperature", match: (id) => id.includes("temp") },
  { type: "conductivity", label: "Fertility", match: (id) => id.includes("conductiv") },
  { type: "humidity", label: "Air humidity", match: (id) => id.includes("humid") },
  { type: "battery", label: "Battery", match: (id) => id.includes("battery") },
];
// Same first-match ladder hemma_popup_plant uses, so a sensor lands in the
// panel slot it will actually be read as.
const plantSlotOf = (id) => {
  const low = String(id || "").toLowerCase();
  const hit = PLANT_SLOTS.find((s) => s.match(low));
  return hit ? hit.type : null;
};

// Anything a button can act on, plus the read-only domains, because
// more-info is a legitimate action on a sensor. Not every domain in Home
// Assistant: a list you scroll past is not a list you choose from.
const ACTION_DOMAINS = [
  "automation", "binary_sensor", "button", "climate", "cover", "fan",
  "humidifier", "input_boolean", "input_button", "light", "lock",
  "media_player", "number", "remote", "scene", "script", "select", "sensor",
  "siren", "switch", "vacuum", "valve", "water_heater",
];

// The template hardcodes both buttons, so this is a helper rather than the
// repeat machinery. Everything past the entity stays hidden until there is one.
const actionFields = (n) => {
  const set = (v) => !!(v && String(v).trim());
  const has = (vars) => set(vars["action_" + n + "_entity"]);
  const does = (vars) => vars["action_" + n + "_action"] || "more-info";
  return [
    { key: "action_" + n + "_entity", label: "Button " + n,
      domains: ACTION_DOMAINS, reveals: true,
      // Button 2 is offered once button 1 is set, the way only the next free
      // slot of a repeat is offered - unless it is already set, in which case
      // hiding it would hide live config.
      when: n === 1 ? null
        : (vars) => set(vars.action_1_entity) || set(vars.action_2_entity),
      placeholder: n === 1 ? "The entity this button acts on" : "A second button" },
    { key: "action_" + n + "_action", label: "Button " + n + " action",
      type: "select", when: has, reveals: true,
      options: ["", "toggle", "call-service", "navigate"],
      optionLabels: { "": "Open more info", toggle: "Toggle it",
        "call-service": "Call a service", navigate: "Go to a page" } },
    { key: "action_" + n + "_service", label: "Button " + n + " service",
      type: "text", placeholder: "light.turn_on",
      when: (vars) => has(vars) && does(vars) === "call-service" },
    { key: "action_" + n + "_service_data", label: "Button " + n + " data",
      type: "json", placeholder: "{ \"brightness\": 255 }",
      when: (vars) => has(vars) && does(vars) === "call-service" },
    { key: "action_" + n + "_navigation_path", label: "Button " + n + " opens",
      type: "text", placeholder: "/hemma/kitchen",
      when: (vars) => has(vars) && does(vars) === "navigate" },
    { key: "action_" + n + "_icon", label: "Button " + n + " icon",
      type: "icon", advanced: true, when: has,
      // Its default is the button entity's own icon, which is an mdi name the
      // glyph picker cannot draw. Naming it beats ghosting something else.
      iconNoGhost: true, iconText: "The entity's own icon" },
    { key: "action_" + n + "_active_color", label: "Button " + n + " color",
      type: "color", advanced: true, when: has },
    { key: "action_" + n + "_enabled", label: "Button " + n + " shown",
      type: "bool", boolDefault: true, advanced: true, when: has },
  ];
};

// Live, on, and what color - all three copied verbatim from the card so the
// preview reaches the same answer. actioncheck holds the two together.
const ACTION_ACTIVE = ["on", "open", "opening", "unlocked", "unlocking",
  "playing", "buffering", "home", "connected", "online",
  "cooling", "heating", "cleaning", "running", "active"];
const ACTION_DEAD = ["unknown", "unavailable", "none", ""];
const ACTION_TEAL = "var(--hemma-color-teal, #00c3d0)";
const ACTION_ACCENT = {
  light: "var(--hemma-color-yellow, #FFCC00)",
  fan: "var(--hemma-color-teal, #00C3D0)",
  humidifier: "var(--hemma-color-teal, #00C3D0)",
  climate: "var(--hemma-color-teal, #00C3D0)",
  vacuum: "var(--hemma-color-teal, #00C3D0)",
  cover: ACTION_TEAL, media_player: ACTION_TEAL, lock: ACTION_TEAL,
  switch: ACTION_TEAL, input_boolean: ACTION_TEAL, script: ACTION_TEAL,
  automation: ACTION_TEAL,
};

// The accents the theme defines, stored as the var() rather than the hex so a
// button follows the theme the way everything else in Hemma does. The hex is
// the fallback inside the var, and what the swatch paints.
const HEMMA_ACCENTS = [
  ["Yellow", "yellow", "#FFCC00"], ["Amber", "amber", "#ffb254"],
  ["Orange", "orange", "#FF9230"], ["Red", "red", "#FF4245"],
  ["Pink", "pink", "#ff4d70"], ["Purple", "purple", "#9333ea"],
  ["Blue", "blue", "#0088FF"], ["Ice", "ice", "#3cd3fe"],
  ["Teal", "teal", "#00C3D0"], ["Mint", "mint", "#00C8B3"],
  ["Green", "green", "#30D158"], ["Gold", "gold", "#e5a00d"],
  ["Neutral", "neutral", "#CDCDCF"],
].map(([label, key, hex]) => ({
  label, hex, id: "var(--hemma-color-" + key + ", " + hex + ")",
}));
// What to paint a swatch for a value that may be a var(), a hex, or anything
// else CSS accepts. A var() cannot be resolved here, so its own fallback is.
const swatchOf = (v) => {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const known = HEMMA_ACCENTS.find((a) => a.id === raw);
  if (known) return known.hex;
  const inVar = raw.match(/^var\(\s*--[\w-]+\s*,\s*(.+?)\s*\)$/);
  return inVar ? inVar[1] : raw;
};
const colorLabel = (v) => {
  const raw = String(v || "").trim();
  if (!raw) return "From the entity's domain";
  const known = HEMMA_ACCENTS.find((a) => a.id === raw);
  return known ? known.label : raw;
};

// The one tile that takes any domain, so it cannot name a glyph up front.
// Copied from the card's map; actioncheck holds the two against each other.
const ACTION_GLYPH = {
  light: "light", switch: "plug", input_boolean: "plug",
  fan: "fan", climate: "thermostat", humidifier: "humidifier",
  media_player: "speaker", lock: "lock-fill", cover: "curtain-open",
  vacuum: "vacuum", script: "scenes", scene: "scenes",
  automation: "scenes", button: "power_on", input_button: "power_on",
  binary_sensor: "motion", remote: "tv", water_heater: "hot_water",
  valve: "curtain-open", siren: "motion",
};

const TILE_TYPES = [
  { id: "light", label: "Light", template: "hemma_light",
    domains: ["light"], fields: [ICON_FIELD, TOGGLE_FIELD] },
  // No Icon: the thermostat draws its reading in the circle instead of a
  // glyph, so there is nothing for one to replace.
  { id: "thermostat", label: "Thermostat", template: "hemma_thermostat",
    domains: ["climate"], fields: [
      { key: "temp_sensor", label: "Temperature sensor", domains: ["sensor"], classes: ["temperature"] },
      TOGGLE_FIELD_ON,
    ] },
  { id: "media", label: "Media player", template: "hemma_media",
    domains: ["media_player"], fields: [
      ICON_FIELD,
      ...PROGRESS_FIELDS,
      TOGGLE_FIELD,
    ] },
  { id: "fan", label: "Fan", template: "hemma_fan",
    domains: ["fan"], fields: [ICON_FIELD, TOGGLE_FIELD] },
  { id: "cover", label: "Cover", template: "hemma_cover",
    domains: ["cover"], fields: [ICON_OPEN_FIELD, ICON_CLOSED_FIELD] },
  { id: "lock", 
    label: "Lock", template: "hemma_lock",
    domains: ["lock"], fields: [TOGGLE_FIELD_ON, ICON_LOCKED_FIELD, ICON_UNLOCKED_FIELD] },
  { id: "vacuum", label: "Vacuum", template: "hemma_vacuum",
    domains: ["vacuum"], fields: [
      { ...ICON_FIELD },
      ...PROGRESS_FIELDS,
    ] },
  { id: "air_purifier", label: "Air purifier", template: "hemma_air_purifier",
    domains: ["fan"], fields: [ICON_FIELD, TOGGLE_FIELD] },
  { id: "humidifier", label: "Humidifier", template: "hemma_humidifier",
    domains: ["humidifier"], fields: [ICON_FIELD, TOGGLE_FIELD] },
  // A tile reading "Up to date" is chrome reporting that it has nothing to
  // report, so it ships conditional: whenDefault mirrors the `show_when` the
  // card template declares, and statecheck holds the two together.
  { id: "updates", label: "Updates", template: "hemma_updates",
    domains: ["sensor"], whenDefault: "active", fields: [
      ICON_FIELD,
      WHEN_FIELD("When updates are available"),
    ] },
  // The entity is a plant.*, and its device carries every reading the popup
  // wants - so picking one fills the slots below in. They stay editable.
  { id: "plant", label: "Plant", template: "hemma_plant",
    domains: ["plant"], fields: [
      ICON_FIELD,
      { key: "sensors", label: "Plant sensors", type: "plantsensors", advanced: true },
      { key: "room_name", label: "Popup title", type: "text",
        advanced: true, group: "Popup" },
    ] },
  // The tile IS the power reading: the tier word and the glow both come off the
  // card's own entity. Everything else here feeds the popup and says so.
  { id: "energy_tile", label: "Energy", template: "hemma_energy",
    domains: ["sensor"], classes: ["power"], entityLabel: "Power sensor",
    multiEntity: true, fields: [
      ICON_FIELD,
      { key: "entity_usage_today", label: "Usage today", domains: ["sensor"],
        classes: ["energy"], advanced: true, group: "Popup" },
      { key: "entity_usage_month", label: "Usage this month", domains: ["sensor"],
        classes: ["energy"], advanced: true },
      { key: "entity_cost_today", label: "Cost today", domains: ["sensor"],
        classes: ["monetary"], advanced: true },
      { key: "entity_cost_month", label: "Cost this month", domains: ["sensor"],
        classes: ["monetary"], advanced: true },
      // A chips LIST, not member rows: these carry no per-entity settings, so a
      // row would hold nothing. Named for what you add, not what it produces.
      { ...LIST("power_entities", "Power sensors", ["sensor"]),
        classes: ["power"], unitLabel: "Power sensors", advanced: true,
        placeholder: "add power sensor." },
      // Optional per-sensor glyph. Everything defaults to the socket it is
      // plugged into: guessing from the name put a gamepad on a home lab.
      { ...MAP("power_icons", "Icon", "power_entities", []), kind: "icon",
        iconDefault: "plug", unitLabel: "Consumer icons", advanced: true,
        needs: "power_entities",
        emptyHint: "Add power sensors above first." },
    ] },
  // The reading is the LIST, not the card's entity - hemma_battery scores every
  // sensor in `batteries`. Nothing opens the entity now that the tile has no
  // hold action, so it is never asked for: noEntity hides the row and the list
  // backfills tile.entity, which hemma_entity still wants for its icon color.
  { id: "battery", label: "Batteries", template: "hemma_battery",
    domains: ["sensor"], classes: ["battery"], noEntity: true,
    multiEntity: true, fields: [ICON_FIELD] },
  // Two WAN speed sensors make the tile - hemma_network's tier word and its glow
  // read the higher of download and upload, and nothing else on this card
  // touches either. The rest is popup detail, so it sits in Advanced under the
  // heading that says so rather than as eleven required-looking rows.
  { id: "network", label: "Network", template: "hemma_network",
    domains: ["sensor"], classes: ["data_rate"], entityLabel: "Download speed",
    // Every advanced field here is popup detail, so the drawer says so and its
    // groups name the parts rather than repeating the word.
    advancedLabel: "Popup",
    // Routers publish the pair under one name: picking the download sensor
    // fills the upload one in. See _twinOf for why it is a swap, not a search.
    twin: { from: "download", to: "upload", key: "entity_upload" },
    multiEntity: true, fields: [
      { key: "entity_upload", label: "Upload speed", domains: ["sensor"], classes: ["data_rate"] },
      ICON_FIELD,
      { key: "entity_status", label: "Internet status", domains: ["binary_sensor"],
        advanced: true, group: "Detail" },
      { key: "entity_ping", label: "Ping", domains: ["sensor"], classes: ["duration"], advanced: true },
      // Not four interchangeable slots: hemma_popup_network lays them out as a
      // 2x2 grid with a scale ceiling each (1000 / 200 / 500 / 200 Mbps), so
      // the position IS the meaning and the labels have to say so.
      { key: "entity_stat_1", label: "Wired download", domains: ["sensor"],
        classes: ["data_rate"], advanced: true },
      { key: "entity_stat_2", label: "Wired upload", domains: ["sensor"],
        classes: ["data_rate"], advanced: true },
      { key: "entity_stat_3", label: "Wi-Fi download", domains: ["sensor"],
        classes: ["data_rate"], advanced: true },
      { key: "entity_stat_4", label: "Wi-Fi upload", domains: ["sensor"],
        classes: ["data_rate"], advanced: true },
      { key: "action_1_entity", label: "Button 1", domains: ["button", "switch", "script"],
        advanced: true, group: "Buttons" },
      { key: "action_1_status", label: "Button 1 status", domains: ["binary_sensor", "sensor"], advanced: true },
      { key: "action_2_entity", label: "Button 2", domains: ["button", "switch", "script"], advanced: true },
      { key: "action_2_status", label: "Button 2 status", domains: ["binary_sensor", "sensor"], advanced: true },
    ] },
  { id: "plex", label: "Plex recently added", template: "hemma_plex_recently_added",
    domains: ["sensor"], whenDefault: "active", fields: [
      ICON_FIELD,
      { key: "show_watched", label: "Watched marker", type: "bool", boolDefault: true },
      WHEN_FIELD("When something has been added"),
    ] },
  // hemma_cameras already declares its filter category and takes the same list
  // the Security badge stores - it was simply never offered here, so a camera
  // could be configured on the badge and unreachable on a phone.
  { id: "cameras", label: "Cameras", template: "hemma_cameras",
    domains: ["camera"], fields: [
      { ...LIST("cameras", "Cameras", ["camera"]), always: true },
      ICON_FIELD,
      { key: "room_name", label: "Popup title", type: "text", advanced: true },
    ] },
  { id: "lock_group", label: "Lock group", hidden: true, multiEntity: true,
    template: ["hemma_lock", "hemma_popup_lock"],
    domains: ["lock"], fields: [
      TOGGLE_FIELD_ON, ICON_LOCKED_FIELD, ICON_UNLOCKED_FIELD,
      { key: "room_name", label: "Popup title", type: "text", advanced: true },
    ] },
  { id: "cover_group", label: "Cover group", hidden: true, multiEntity: true,
    template: ["hemma_cover", "hemma_popup_cover"],
    domains: ["cover"], fields: [
      // First in the drawer: a switch reads as a heading for what follows.
      // Sections the popup's rows by device_class; off is one plain list. Either
      // way a single kind draws no heading.
      { key: "group_by_type", label: "Group by type", type: "bool",
        boolDefault: true, advanced: true },
      ICON_OPEN_FIELD, ICON_CLOSED_FIELD,
      { key: "room_name", label: "Popup title", type: "text", advanced: true },
    ] },
  // Its entity is what the tile READS; the buttons act on their own entities,
  // which is the whole point of it - a fridge status sensor with mode and
  // super-cool beside it.
  { id: "entity_actions",
    label: "Entity with buttons", template: "hemma_entity_actions",
    domains: ACTION_DOMAINS,
    entityPlaceholder: "The entity this tile shows",
    // It takes any domain, so it cannot name a glyph up front. Declared here
    // rather than tested by id, so the preview and the icon field both read
    // the same thing off the type.
    glyphFromEntity: ACTION_GLYPH,
    fields: [
      ICON_FIELD,
      // The washer case: its status sensor reads "washing" or "spinning", both
      // of which progress_active_states already names.
      ...PROGRESS_FIELDS,
      ...actionFields(1),
      ...actionFields(2),
      // hemma_entity reads the tile's own entity for the lit state, and a
      // status sensor never reads as on. This hands that job to the buttons.
      { key: "active_entities", type: "list", label: "Lit when these are on",
        domains: ACTION_DOMAINS, advanced: true },
      { key: "active_entities_mode", label: "Lit when", type: "select",
        advanced: true, options: ["", "all"],
        optionLabels: { "": "Any of them is on", all: "All of them are on" },
        when: (vars) => Array.isArray(vars.active_entities)
          && vars.active_entities.length > 1 },
    ] },
];

// Every block the hints switch collapses. The CSS rule above lists the same
// five, and hintcheck holds the two against each other: a block the CSS hides
// but this misses would disappear instantly while the rest squeezed.
const HINT_BLOCKS = ".grouphead p, .band.detail .card > .chead .blurb, .hint,"
  + " .sortstrip .sortnote,"
  + " .band:not(.detail) .grouphead";

// Belongs to the SURFACE, not to any tile type - every type can be either - so
// it is offered on all of them at once. The templates test `size === 'large'`
// and nothing else, so absent is small.
const SIZE_FIELD = {
  key: "size", label: "Size", type: "select",
  options: ["", "large"],
  optionLabels: { "": "Small", large: "Large" },
};

const MOBILE_TILE_FIELDS = [SIZE_FIELD];

// "desktop" is a truthy string, so test the two affirmative values, not truth.
const tileFieldsFor = (type, phone) => (type && type.fields ? type.fields : [])
  .concat(phone === true || phone === "mobile" ? MOBILE_TILE_FIELDS : []);

const tileTypeOf = (tile) => {
  const t = tile.template;
  if (typeof t === "string") return TILE_TYPES.find((x) => x.template === t) || null;
  if (Array.isArray(t)) {
    return TILE_TYPES.find(
      (x) => Array.isArray(x.template) && stable(x.template) === stable(t)
    ) || null;
  }
  return null;
};

const tileLabel = (tile) => {
  const t = tile.template;
  return Array.isArray(t) ? t.join(" + ") : String(t || tile.type || "card");
};

function newTile(type) {
  // No eager variables map: every setter creates it on demand, and an empty one
  // is only noise in the saved YAML.
  return { type: "custom:button-card", template: type.template, entity: "", name: type.label };
}

// ── what a tile is doing, as its own template decides it ─────────────────────
// Each arm mirrors ONE template. Change a card's state_display or state: block
// and change the matching arm here; statecheck holds the two together.

// hemma_entity's own active list. A card is lit when its state is IN this list,
// never by not being off - which is the whole reason a power sensor reading
// 459.6 used to glow.
const ENTITY_ACTIVE_STATES = ["on", "open", "opening", "unlocked", "unlocking",
  "playing", "cleaning", "returning", "cool", "heat", "washing", "rinsing",
  "spinning", "drying", "running", "active", "problem"];

const numOf = (states, id) => {
  const raw = id && (states[id] || {}).state;
  if (!raw || raw === "unavailable" || raw === "unknown") return null;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
};

// hemma_light: one row per physical light, groups of groups flattened.
const lightUnits = (states, eid, seen) => {
  const memsOf = (id) => {
    const m = ((states[id] || {}).attributes || {}).entity_id;
    return Array.isArray(m) ? m.filter((x) => typeof x === "string" && x.startsWith("light.")) : [];
  };
  if (!eid || seen.has(eid)) return [];
  const mems = memsOf(eid);
  if (!mems.length || !mems.some((m) => memsOf(m).length)) return [eid];
  seen.add(eid);
  return mems.flatMap((m) => lightUnits(states, m, seen));
};
const lightWord = (states, eid) => {
  const all = [...new Set(lightUnits(states, eid, new Set()))];
  const lit = all.filter((e) => (states[e] || {}).state === "on").length;
  return lit === 0 ? "All Off" : lit === all.length ? "All On" : lit + " On";
};

// hemma_battery scores the LIST, not the card's entity. No list at all means
// every battery sensor in the house, which is the template's own fallback.
const batteryPack = (V, states) => {
  const list = V.batteries || V.entity_filter;
  const pool = Array.isArray(list)
    ? list.map((id) => states[id]).filter(Boolean)
    : Object.values(states);
  const pack = pool.filter((e) => {
    if (e.state === "unavailable" || e.state === "unknown") return false;
    if (Number.isNaN(parseFloat(e.state))) return false;
    return e.attributes && e.attributes.device_class === "battery";
  });
  return { count: pack.length, low: pack.some((e) => parseFloat(e.state) <= 20) };
};

// hemma_plex_recently_added counts titles added in the last three days.
const plexAdded = (states) => {
  const rows = (id) => {
    const d = ((states[id] || {}).attributes || {}).data;
    return Array.isArray(d) ? d.slice(1).filter((i) => i && i.title) : [];
  };
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return rows("sensor.recently_added_movies").concat(rows("sensor.recently_added_tv"))
    .filter((i) => i.airdate && new Date(i.airdate).getTime() >= cutoff).length;
};

// hemma_network: the tier and the direction both come off the two WAN speeds.
// The LAN stat sensors are popup tiles and deliberately do not count.
const networkWan = (V, ent, states) => {
  const dl = numOf(states, V.entity_download || (ent && ent.entity_id));
  const ul = numOf(states, V.entity_upload || V.upload_sensor);
  const vals = [dl, ul].filter((v) => v != null);
  return { dl: dl, ul: ul, max: vals.length ? Math.max(...vals) : 0 };
};
const networkWord = (V, ent, states) => {
  const w = networkWan(V, ent, states);
  if (w.max < Number(V.idle_threshold ?? 1)) return "Idle";
  const tier = w.max < Number(V.light_threshold ?? 10) ? "Light"
    : w.max < Number(V.heavy_threshold ?? 50) ? "Active" : "Heavy";
  const dir = (w.dl == null || (w.ul != null && w.ul > w.dl)) ? "Upload" : "Download";
  return tier + " " + dir;
};

// hemma_energy prints the same tier word its popup and sub-badges do.
const energyWord = (V, ent, states) => {
  const w = numOf(states, V.entity_power || (ent && ent.entity_id));
  if (w == null) return "Unavailable";
  if (w >= Number(V.extreme_threshold ?? 3000)) return "Extreme Usage";
  if (w >= Number(V.heavy_threshold ?? 1000)) return "Heavy Usage";
  if (w >= Number(V.normal_threshold ?? 200)) return "Normal";
  return "Idle";
};

const plantActive = (ent, V, states) => {
  const state = String(ent.state || "").toLowerCase();
  if (state === "problem") return true;
  if (state === "ok") return false;
  const attrs = ent.attributes || {};
  const sensors = Array.isArray(V.sensors) ? V.sensors.filter(Boolean) : [];
  // Battery is not graded - hemma_plant's own getSensorType leaves it out.
  const graded = (id) => { const t = plantSlotOf(id); return t === "battery" ? null : t; };
  if (sensors.some((id) => {
    if (numOf(states, id) == null) return false;
    const t = graded(id);
    if (!t) return false;
    const v = attrs[t + "_status"];
    return !!v && v !== "ok" && v !== "null";
  })) return true;
  const threshold = Number(V.low_threshold ?? 30);
  const val = parseFloat(ent.state);
  if (Number.isFinite(val)) return val <= threshold;
  const attr = parseFloat(attrs.moisture);
  return Number.isFinite(attr) && attr <= threshold;
};

// hemma_plant's state_display in full, scored breakdown included: a `sensors`
// list turns "Needs Attention" into Needs care / Struggling / Poor / Critical.
const plantWord = (ent, V, states) => {
  const state = String(ent.state || "");
  if (!state || state === "unavailable") return "— %";
  if (state === "ok") return "Healthy";
  const attrs = ent.attributes || {};
  const sensors = Array.isArray(V.sensors) ? V.sensors.filter(Boolean) : [];
  const graded = (id) => { const t = plantSlotOf(id); return t === "battery" ? null : t; };
  if (sensors.length && state === "problem") {
    const scorable = sensors.filter((id) => {
      const t = graded(id);
      return t && Object.prototype.hasOwnProperty.call(attrs, t + "_status");
    });
    const scored = scorable.filter((id) => numOf(states, id) != null);
    if (scorable.length && !scored.length) return "Unavailable";
    if (scored.length) {
      const bad = scored.filter((id) => {
        const v = attrs[graded(id) + "_status"];
        return v && v !== "ok" && v !== "null";
      }).length;
      const ratio = (scored.length - bad) / scored.length;
      if (ratio >= 1) return "Healthy";
      if (ratio >= 0.8) return "Needs care";
      if (ratio >= 0.6) return "Struggling";
      if (ratio >= 0.4) return "Poor";
      return "Critical";
    }
  }
  if (state === "problem") return "Needs Attention";
  const val = parseFloat(state);
  if (!Number.isNaN(val)) return Math.round(val) + " %";
  const attr = parseFloat(attrs.moisture);
  if (!Number.isNaN(attr)) return Math.round(attr) + " %";
  return "— %";
};

// hemma_media's playing label: artist and title for music, otherwise whatever
// names the thing - title, then app, then source.
const mediaWord = (ent) => {
  const cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1).replace(/_/g, " ") : "");
  const state = String(ent.state || "").toLowerCase();
  if (state !== "playing") return state ? cap(state) : "Off";
  const a = ent.attributes || {};
  const id = ent.entity_id || "";
  const type = String(a.media_content_type || "").toLowerCase();
  const title = String(a.media_title || a.title || "").trim();
  const artist = String(a.media_artist || a.artist || a.media_album_artist || "").trim();
  const app = String(a.app_name || "").trim();
  const source = String(a.source || a.media_channel || "").trim();
  const isMusic = type === "music" || id.includes("spotify")
    || (!!artist && !["movie", "video", "tvshow"].includes(type));
  if (isMusic) return (artist && title) ? artist + " - " + title : (title || artist || app || source || cap(state));
  return title || app || source || cap(state);
};

// hemma_cameras' state_display, and the alert rule it calls. A camera tile does
// not say "Idle" - it counts what is offline, and otherwise reports whatever
// event fired in the last few minutes, or No Alerts.
const cameraAlert = (hass, states, cams, windowMinutes) => {
  const reg = (hass && hass.entities) || {};
  const devs = {};
  cams.forEach((id) => {
    const d = reg[id] && reg[id].device_id;
    if (d) devs[d] = true;
  });
  const span = (Number(windowMinutes) > 0 ? Number(windowMinutes) : 5) * 60000;
  const now = Date.now();
  let ding = false, motion = false;
  Object.keys(reg).forEach((id) => {
    if (id.indexOf("event.") !== 0) return;
    if (!devs[reg[id].device_id]) return;
    const t = Date.parse(states[id] && states[id].state);
    if (!isFinite(t) || now - t > span) return;
    if (/ding|doorbell|button/.test(id)) ding = true;
    else if (/motion/.test(id)) motion = true;
  });
  return ding ? "Doorbell" : motion ? "Motion Detected" : "";
};

const cameraWord = (V, states, hass) => {
  const cams = (Array.isArray(V.cameras) ? V.cameras : []).filter(Boolean);
  if (!cams.length) return "No Cameras";
  const DEAD = ["unavailable", "unknown", ""];
  const dead = cams.filter((id) =>
    DEAD.includes(String((states[id] || {}).state || "").toLowerCase())).length;
  if (dead === cams.length) return cams.length === 1 ? "Offline" : "All Offline";
  if (dead > 0) return dead + " Offline";
  return cameraAlert(hass, states, cams, V.alert_window_minutes) || "No Alerts";
};

// The default lives on the type because the card template declares it: both
// conditional tiles ship `show_when: active`, so an untouched config writes
// nothing.
const tileShowWhen = (type, V) =>
  String((V || {}).show_when || (type && type.whenDefault) || "always");

// Whether the dashboard is drawing this tile at this moment. The card decides
// it from its own `idle` test; statecheck holds that test against tileActive,
// so asking it here in terms of tileActive cannot drift from the card.
const tileHidesNow = (type, kind, ent, V, states) =>
  tileShowWhen(type, V) === "active" && !tileActive(kind, ent, V || {}, states);

const tileActive = (kind, ent, V, states) => {
  if (!ent) return false;
  const state = String(ent.state || "").toLowerCase();
  switch (kind) {
    // Templates that override hemma_entity's state: block with their own rule.
    case "plant": return plantActive(ent, V, states);
    case "energy_tile": {
      // The real card holds its glow down to release_threshold once it is on.
      // The preview has no previous frame, so it uses the switch-on point.
      const w = numOf(states, ent.entity_id);
      return w != null && w >= Number(V.high_threshold ?? 500);
    }
    case "network":
      return networkWan(V, ent, states).max >= Number(V.light_threshold ?? 10);
    case "updates": {
      const n = Number(ent.state);
      return Number.isFinite(n) && n > 0;
    }
    case "plex": return plexAdded(states) > 0;
    case "battery": return batteryPack(V, states).low;
    default: break;
  }
  const extra = Array.isArray(V.active_states)
    ? V.active_states.map((x) => String(x).toLowerCase()) : [];
  return ENTITY_ACTIVE_STATES.includes(state) || extra.includes(state);
};

// hemma_media's own `has_artwork` + `art_url`, not "does the entity carry a
// picture": a paused Sonos keeps the last cover or a brand image, and the card
// ignores both. Returns "" when the card would draw its icon.
const mediaArtUrl = (ent, states) => {
  if (!ent) return "";
  if (String(ent.state || "").toLowerCase() !== "playing") return "";
  const a = ent.attributes || {};
  const id = ent.entity_id || "";
  const type = String(a.media_content_type || "").toLowerCase();
  const app = String(a.app_name || "").trim();
  const title = String(a.media_title || a.title || "").trim();
  const source = String(a.source || a.media_channel || "").trim();
  const isSonos = id.includes("sonos")
    || String(a.friendly_name || "").toLowerCase().includes("sonos");
  const bareInputs = ["tv", "hdmi", "arc", "hdmi arc", "optical", "line-in", "line in"];
  let looksLikeBareInput = false;
  if (isSonos && title) {
    const t = title.toLowerCase();
    looksLikeBareInput = bareInputs.indexOf(t) !== -1
      || (!!source && t === source.toLowerCase());
  }
  const isYouTube = app.toLowerCase().includes("youtube");
  const yt = states && states["sensor.youtube_watching"];
  const pic = isYouTube
    ? ((yt && yt.attributes && yt.attributes.thumbnail) || a.entity_picture || "")
    : (a.entity_picture || "");
  const hasRichMeta = !!(a.media_series_title || a.media_episode_title);
  const fromRichApp =
    /youtube|plex|netflix|hulu|disney|max|prime|spotify|apple tv|apple music|paramount|peacock/i
      .test(app);
  const rich = hasRichMeta
    || ["music", "movie", "video", "tvshow", "game"].indexOf(type) !== -1
    || fromRichApp;
  if (!pic || looksLikeBareInput || !rich) return "";
  return pic.startsWith("/") ? window.location.origin + pic : pic;
};

// ── Now Playing: _hemmaNPSources, ported ─────────────────────────────────────
const npAbs = (u) => {
  if (!u) return "";
  const raw = String(u);
  const full = raw.startsWith("/") ? (window.location.origin + raw) : raw;
  try {
    const p = new URL(full, window.location.origin);
    // authSig signs the exact param list, so editing the query 401s it.
    if (p.searchParams.has("authSig")) return full;
    p.searchParams.delete("refresh");
    return p.toString();
  } catch (e) { return full; }
};

// hemma-core.js's list, verbatim. Anything else the state says is the game.
const PSN_NOT_A_TITLE = new Set([
  "playing", "paused", "idle", "on", "off", "home", "away", "online",
  "offline", "standby", "unavailable", "unknown", "none", "null", "",
]);

const npStarted = (s) => {
  const n = s && s.last_changed ? Date.parse(s.last_changed) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const npSource = (kind, id, states) => {
  const s = id && states[id];
  if (!s) return null;
  const a = s.attributes || {};
  const norm = (x) => String(x == null ? "" : x).trim();
  const low = (x) => norm(x).toLowerCase();
  const st = low(s.state);

  if (kind === "plex") {
    const full = norm(a.full_title || a.title);
    if (!full) return null;
    // The stream sensor keeps reporting a title after the session ends; its
    // Tautulli twin is what says whether it is still running.
    const tau = String(id).replace(/^(sensor\.)plex_stream_(\d+)$/,
      "$1plex_session_$2_tautulli");
    const pst = low((states[tau] || {}).state || s.state);
    if (pst !== "playing" && pst !== "buffering") return null;
    return {
      kind: "plex", playing: true, started: npStarted(s),
      art: npAbs(a.image_url || a.entity_picture_local || a.entity_picture
        || a.media_image_url),
      title: full, subtitle: "",
      source: "Plex \u00b7 " + (norm(a.user) || "Unknown"),
      controls: { toggle: false, next: false, prev: false },
    };
  }

  if (kind === "psn") {
    if (["unavailable", "unknown", "off", "standby", "none", ""].includes(st)) return null;
    // The integration's sensor keeps the game in its state and its cover on a
    // sibling image.X; a hand-built template sensor carries both as attributes.
    const attrTitle = norm(a.full_title || a.media_title || a.title);
    // Naming a game in its STATE is the playing signal: st can never equal
    // "playing" for such a sensor.
    const stateIsTitle = !attrTitle && !PSN_NOT_A_TITLE.has(st);
    const title = attrTitle || (stateIsTitle ? norm(s.state) : "");
    if (!title) return null;
    const iid = String(id).replace(/^sensor\./, "image.");
    const im = states[iid];
    const iat = (im && im.attributes) || {};
    const sib = iat.entity_picture_local || iat.entity_picture
      || (im && iat.access_token ? "/api/image_proxy/" + iid + "?token=" + iat.access_token : "");
    return {
      kind: "activity", started: npStarted(s),
      playing: stateIsTitle ? true : st === "playing",
      art: npAbs(a.entity_picture_local || a.entity_picture || a.image_url
        || a.media_image_url || sib),
      title: title, subtitle: norm(a.user),
      source: norm(a.friendly_name) || norm(a.source) || "PlayStation",
      controls: { toggle: false, next: false, prev: false },
    };
  }

  const feats = Number(a.supported_features || 0);
  const controls = { toggle: !!(feats & 16385), next: !!(feats & 32),
    prev: !!(feats & 16) };
  const rawTitle = norm(a.media_title);
  let artist = norm(a.media_artist || a.artist || a.media_album_artist);
  const hasContent = !!(rawTitle || artist);
  // The card holds a paused player for pause_timeout_minutes; the preview has
  // no clock to expire it on, so it keeps one only while it still has content
  // and something to press - which is the card's own condition, minus the wait.
  if (st !== "playing" && st !== "buffering") {
    if (st !== "paused" || !hasContent
      || !(controls.toggle || controls.next || controls.prev)) return null;
  }

  let title = rawTitle;
  if (!artist && a.media_content_type === "tvshow") {
    const series = norm(a.media_series_title);
    const season = a.media_season ? "S" + String(a.media_season).padStart(2, "0") : "";
    const episode = a.media_episode ? "E" + String(a.media_episode).padStart(2, "0") : "";
    artist = [series, [season, episode].filter(Boolean).join("")]
      .filter(Boolean).join(" \u00b7 ");
  }
  if (!artist) {
    const parts = rawTitle.split(/\s+[-\u2013\u2014]\s+/);
    if (parts.length >= 3) {
      title = parts[parts.length - 1];
      artist = parts.slice(0, -1).join(" \u2013 ");
    }
  }
  let art = npAbs(a.entity_picture || a.media_image_url || a.media_album_cover_url
    || a.image_url);
  if (!art) {
    const app = low(a.app_name || a.source) + " " + low(a.app_id);
    if (app.includes("youtube")) art = npAbs("/local/hemma/icons/youtube.png");
  }
  return {
    kind: "player", playing: st === "playing" || st === "buffering",
    started: npStarted(s),
    art: art, title: title || norm(a.friendly_name) || "Media",
    subtitle: artist, source: norm(a.app_name || a.source || a.friendly_name),
    controls: controls,
    pos: Number(a.media_position), dur: Number(a.media_duration),
  };
};

// --np-art. HA rotates an image entity's ?token=, so an unchanged picture
// arrives as a new URL and refetching it paints a blank frame - compare paths,
// keep the URL already loaded. Holding also covers a poll that reports no
// picture, but only within one track.
const npArtHold = {};
const npArtWarm = new Map();
const npArtPath = (u) => String(u || "").split("?")[0];

const npArt = (src) => {
  if (!src) return "";
  const k = src.key || src.kind || "";
  const id = (src.title || "") + "|" + (src.subtitle || "");
  const cur = src.art || "";
  let u = cur;
  if (k) {
    const prev = npArtHold[k];
    const sameTrack = !!(prev && prev.id === id);
    if (cur && sameTrack && npArtPath(prev.url) === npArtPath(cur)
      && npArtWarm.has(npArtPath(cur))) u = prev.url;
    else if (cur) npArtHold[k] = { id: id, url: cur };
    else u = sameTrack ? prev.url : "";
  }
  if (u && !npArtWarm.has(npArtPath(u))) {
    try {
      const im = new Image();
      im.decoding = "async";
      im.src = u;
      npArtWarm.set(npArtPath(u), im);
      if (npArtWarm.size > 24) npArtWarm.delete(npArtWarm.keys().next().value);
      if (im.decode) im.decode().catch(() => {});
    } catch (e) { /* no decode support, the img still loads */ }
  }
  return u;
};

// A whole-token prefix is the same game, but only when the remainder carries no
// digit: "Portal" and "Portal 2" stay apart, "... Definitive Edition" folds in.
const npSameGame = (x, y) => {
  const flat = (v) => String(v || "").toLowerCase()
    .replace(/[\u2122\u00ae\u00a9]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const a = flat(x), b = flat(y);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (long.indexOf(short + " ") !== 0) return false;
  return !/[0-9]/.test(long.slice(short.length));
};

// The two sources that are a set of entities rather than one.
const npActivitySources = (V, states) => {
  const out = [];
  const norm = (x) => String(x == null ? "" : x).trim();
  const low = (x) => norm(x).toLowerCase();
  const dead = (g) => !g || ["none", "unknown", "unavailable"].includes(g.toLowerCase());
  const started = (id) => {
    const t = id && states[id] && states[id].last_changed;
    const n = t ? Date.parse(t) : NaN;
    return Number.isFinite(n) ? n : 0;
  };
  const NONE = { toggle: false, next: false, prev: false };

  const dcU = V.discord_user && states[V.discord_user];
  const dcA = (dcU && dcU.attributes) || {};
  if (V.discord_user || (V.discord_online && V.discord_game)) {
    // Any presence but offline counts: DND and idle are normal while gaming.
    const status = low(V.discord_online
      ? (states[V.discord_online] || {}).state : (dcU || {}).state);
    const live = !!status
      && !["offline", "unknown", "unavailable", "none"].includes(status);
    const game = norm(V.discord_game
      ? (states[V.discord_game] || {}).state : dcA.game);
    if (live && !dead(game)) {
      const imgS = V.discord_image && states[V.discord_image];
      const ia = (imgS && imgS.attributes) || {};
      const http = (...xs) => xs.find((x) => x && String(x).indexOf("http") === 0) || "";
      const stateUrl = String((imgS || {}).state || "");
      out.push({
        key: "discord", kind: "activity", playing: true,
        art: npAbs(V.discord_image
          ? (ia.entity_picture_local || ia.entity_picture || ia.image_url
            || (/^(https?:)?\/\//.test(stateUrl) || stateUrl.charAt(0) === "/" ? stateUrl : ""))
          : http(dcA.game_image_large, dcA.game_image_header, dcA.game_image_hero_capsule)),
        title: game,
        subtitle: norm(V.discord_details ? (states[V.discord_details] || {}).state
          : (dcA.game_details || dcA.game_state)).replace(/^(unknown|unavailable)$/i, ""),
        source: norm(V.discord_label) || "PC",
        started: started(V.discord_game || V.discord_user),
        controls: NONE,
      });
    }
  }

  // steam_game is the gate; steam_online is an optional presence guard.
  if (V.steam_game) {
    const status = low((states[V.steam_online] || {}).state);
    const live = !V.steam_online
      || (!!status && !["offline", "unknown", "unavailable", "none"].includes(status));
    const game = norm((states[V.steam_game] || {}).state);
    if (live && !dead(game)) {
      const imgS = V.steam_image && states[V.steam_image];
      const ia = (imgS && imgS.attributes) || {};
      // These are template sensors whose STATE is the artwork URL.
      const raw = ia.entity_picture_local || ia.entity_picture || ia.image_url
        || (String((imgS || {}).state || "").indexOf("http") === 0 ? imgS.state : "");
      out.push({
        key: "steam", kind: "activity", playing: true,
        art: npAbs(raw), title: game, subtitle: "",
        source: norm(V.steam_label) || "Steam",
        started: started(V.steam_game), controls: NONE,
      });
    }
  }
  return out;
};

// hemma_now_playing_primary's --np-accent.
// hemma_now_playing stacks seven.
const NP_STACK_SLOTS = 7;

const NP_ACCENT = {
  plex: "var(--hemma-color-orange, #FF9230)",
  activity: "var(--hemma-color-blue, #0088FF)",
};

const tileStateWord = (kind, tile, ent, states, hass) => {
  const V = (tile && tile.variables) || {};
  if (!ent) return tile && tile.entity ? "—" : "Not set";
  const cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1).replace(/_/g, " ") : "");
  switch (kind) {
    case "thermostat": {
      const mode = String(ent.state).toLowerCase();
      const target = ent.attributes && ent.attributes.temperature;
      if (mode !== "cool" && mode !== "heat") return "Off";
      if (target == null) return mode === "cool" ? "Cooling" : "Heating";
      return (mode === "cool" ? "Cooling to " : "Heating to ") + target + "°";
    }
    case "cameras": return cameraWord(V, states, hass);
    case "media": return mediaWord(ent);
    case "light": return lightWord(states, ent.entity_id);
    case "plant": return plantWord(ent, V, states);
    case "energy_tile": return energyWord(V, ent, states);
    case "network": return networkWord(V, ent, states);
    case "battery": {
      const p = batteryPack(V, states);
      return p.count === 0 ? "No Sensors" : p.low ? "Needs Attention" : "Healthy";
    }
    case "updates": {
      const n = Number(ent.state);
      if (!Number.isFinite(n) || n <= 0) return "Up to date";
      return n === 1 ? "1 Update" : n + " Updates";
    }
    case "plex": {
      const n = plexAdded(states);
      if (n <= 0) return "Up to date";
      return n === 1 ? "1 Added" : n + " Added";
    }
    default: break;
  }
  // hemma_entity's state_display is hass.formatEntityState - the localized word,
  // not the raw state. The capitalize is only for a stub with no hass.
  if (ent.state === "ok") return "Healthy";
  const formatted = hass && typeof hass.formatEntityState === "function"
    ? hass.formatEntityState(ent) : null;
  return formatted || cap(String(ent.state || "")) || "—";
};

// An absent show_toggle is not "no toggle" - the schema's boolDefault says what
// the template does, and the preview and the form read it from there.
// Badges are keyed by the section label _renderForm writes to data-k; tiles by
// the tile key. Anything else is not selectable.
const selKeyOf = (mk) => {
  const s = String(mk || "");
  if (s.indexOf("b:") === 0) {
    const id = s.slice(2);
    // The inline climate badges (climate:0..2) stand for the same card.
    const base = id.split(":")[0];
    const sec = SECTIONS.find((x) => x.group === "badges"
      && String(x.label).toLowerCase() === base);
    return sec ? { group: "badges", key: sec.label, label: sec.label } : null;
  }
  if (s.indexOf("t:") === 0) return { group: "tiles", key: s.slice(2) };
  return null;
};

// hemma_now_playing_button.yaml's SF Symbols, viewBoxes left whole so play.fill
// keeps sitting right of center.
const NP_GLYPH_REF = 19.3945;
const NP_GLYPHS = {
  pause: { w: 14.6484, h: 19.3945, d: "M1.55859 19.3828L4.23047 19.3828C5.25 19.3828 5.78906 18.8438 5.78906 17.8125L5.78906 1.55859C5.78906 0.480469 5.25 0 4.23047 0L1.55859 0C0.539062 0 0 0.527344 0 1.55859L0 17.8125C0 18.8438 0.539062 19.3828 1.55859 19.3828ZM10.0781 19.3828L12.7383 19.3828C13.7695 19.3828 14.2969 18.8438 14.2969 17.8125L14.2969 1.55859C14.2969 0.480469 13.7695 0 12.7383 0L10.0781 0C9.04688 0 8.50781 0.527344 8.50781 1.55859L8.50781 17.8125C8.50781 18.8438 9.04688 19.3828 10.0781 19.3828Z" },
  play: { w: 19.6289, h: 19.6992, d: "M2.13281 17.9766C2.13281 19.1367 2.80078 19.6875 3.59766 19.6875C3.94922 19.6875 4.3125 19.5703 4.67578 19.3828L18.3281 11.4023C19.3008 10.8398 19.6289 10.4531 19.6289 9.84375C19.6289 9.22266 19.3008 8.84766 18.3281 8.28516L4.67578 0.304688C4.3125 0.105469 3.94922 0 3.59766 0C2.80078 0 2.13281 0.550781 2.13281 1.71094Z" },
  next: { w: 22.0312, h: 17.918, d: "M0 16.2773C0 17.3789 0.632812 17.9062 1.39453 17.9062C1.72266 17.9062 2.07422 17.8008 2.41406 17.6133L14.7188 10.4414C15.6094 9.92578 15.9492 9.53906 15.9492 8.95312C15.9492 8.36719 15.6094 7.98047 14.7188 7.46484L2.41406 0.292969C2.07422 0.09375 1.72266 0 1.39453 0C0.632812 0 0 0.515625 0 1.61719ZM17.4492 17.8359L20.1094 17.8359C21.1406 17.8359 21.6797 17.2969 21.6797 16.2656L21.6797 1.62891C21.6797 0.550781 21.1406 0.0585938 20.1094 0.0585938L17.4492 0.0585938C16.418 0.0585938 15.8906 0.597656 15.8906 1.62891L15.8906 16.2656C15.8906 17.2969 16.418 17.8359 17.4492 17.8359Z" },
  prev: { w: 22.0312, h: 17.918, d: "M21.6797 16.2773L21.6797 1.61719C21.6797 0.515625 21.0352 0 20.2852 0C19.9453 0 19.6055 0.09375 19.2656 0.292969L6.94922 7.46484C6.07031 7.98047 5.73047 8.36719 5.73047 8.95312C5.73047 9.53906 6.07031 9.92578 6.94922 10.4414L19.2656 17.6133C19.6055 17.8008 19.9453 17.9062 20.2852 17.9062C21.0352 17.9062 21.6797 17.3789 21.6797 16.2773ZM4.23047 17.8359C5.25 17.8359 5.78906 17.2969 5.78906 16.2656L5.78906 1.62891C5.78906 0.597656 5.25 0.0585938 4.23047 0.0585938L1.55859 0.0585938C0.539062 0.0585938 0 0.550781 0 1.62891L0 16.2656C0 17.2969 0.539062 17.8359 1.55859 17.8359Z" },
};

// Height only, width auto (feedback_svg_icon_sizing). A number is phone points;
// a string is a CSS length, so the wide tiers can pass their per-tier var.
const npGlyphSvg = (shape, h) => {
  const g = NP_GLYPHS[shape] || NP_GLYPHS.play;
  const ratio = g.h / NP_GLYPH_REF;
  const height = typeof h === "number"
    ? (h * ratio).toFixed(2) + "px"
    : "calc(" + h + " * " + ratio.toFixed(4) + ")";
  return '<svg viewBox="0 0 ' + g.w + ' ' + g.h + '" aria-hidden="true"'
    + ' style="height:' + height + ';'
    + 'aspect-ratio:' + g.w + ' / ' + g.h + '">'
    + '<path d="' + g.d + '"></path></svg>';
};

// A player's second line is the artist alone; every other source names itself.
const npSubLine = (s) => (s.kind === "player" ? [s.subtitle] : [s.source, s.subtitle])
  .map((x) => String(x || "").trim()).filter(Boolean).join(" \u00b7 ");

const tileToggleOn = (tile, type) => {
  const v = (tile.variables || {}).show_toggle;
  if (v !== undefined) return !!v;
  const f = type && (type.fields || []).find((x) => x.key === "show_toggle");
  return !!(f && f.boolDefault);
};

// hemma_entity's progress_active_states default, verbatim. The switch arms the
// ring; the state decides, so a paused player draws none.
const PROGRESS_STATES = ["playing", "cleaning", "returning", "washing",
  "rinsing", "spinning", "drying", "running", "active"];

// --hemma-progress-display, property for property.
const tileProgressOn = (tile, ent) => {
  const tv = tile.variables || {};
  if (!tv.show_progress) return false;
  const on = tv.progress_active_states || PROGRESS_STATES;
  return on.includes(String((ent && ent.state) || "").toLowerCase());
};

// --hemma-progress-pct, in the order it tries them. Clamped: a stale
// media_position outruns its duration.
const tileProgressPct = (tile, ent, states) => {
  const tv = tile.variables || {};
  let v = tv.progress_value;
  if (v === null || v === undefined) {
    const st = (states || {})[tv.progress_entity || (ent && ent.entity_id)] || ent;
    if (!st) return 0;
    const a = st.attributes || {};
    const n = parseFloat(st.state);
    if (Number.isFinite(n)) v = n;
    else if (Number.isFinite(Number(a.percentage))) v = Number(a.percentage);
    else if (Number.isFinite(Number(a.progress))) v = Number(a.progress);
    else if (Number.isFinite(Number(a.media_position))
      && Number(a.media_duration) > 0) {
      v = (Number(a.media_position) / Number(a.media_duration)) * 100;
    }
  }
  const num = Number(v);
  return Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
};

// Gated on supported_features: a speaker with no play/pause draws a bare ring.
const tileProgressGlyph = (tile, ent) => {
  if ((tile.variables || {}).progress_transport === false) return "";
  if (!ent) return "";
  const dom = String(ent.entity_id || "").split(".")[0];
  const feats = Number((ent.attributes || {}).supported_features || 0);
  const paused = String(ent.state).toLowerCase() === "paused";
  if (dom === "media_player" && (feats & 16385)) return paused ? "play" : "pause";
  if (dom === "vacuum" && (feats & 4)) return paused ? "play" : "pause";
  return "";
};

// A rail when wide, a strip when narrow. Read off the pills rather than a flag,
// so the drag axis cannot fall out of step with the layout.
const tabAxis = (rects) => {
  const vertical = rects.length > 1
    && Math.abs(rects[1].top - rects[0].top) > Math.abs(rects[1].left - rects[0].left);
  return vertical
    ? { pos: "top", size: "height", client: "clientY", cross: "left", move: "translateY" }
    : { pos: "left", size: "width", client: "clientX", cross: "top", move: "translateX" };
};

// Where every pill lands once the dragged one is dropped into slot `to`. Pills
// are different sizes, so a slot has no fixed position: the track is
// accumulated from the sizes in the new order.
const tabSlots = (rects, from, to, ax, gap) => {
  const order = rects.map((_, k) => k).filter((k) => k !== from);
  order.splice(to, 0, from);
  let x = rects[0][ax.pos];
  const at = [];
  order.forEach((orig) => { at[orig] = x; x += rects[orig][ax.size] + gap; });
  return at;
};

// ─── panel ────────────────────────────────────────────────────────────────────

class HemmaPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._state = null;
    this._room = 0;
    // Was the header picker's .value, which read "" before anything loaded.
    this._dashUrl = "";
    this._saveBlocked = false;
    this._saving = false;
    this._bundle = null;
    this._revealed = new Set();
    this._advOpen = new Set();
    // Tile keys with an unfilled member row on screen. Never the config: an
    // empty slot pushed into the list saved as a member with no entity.
    this._pendingMember = new Set();
    this._miniOpen = null;
    // Which group the inspector is on, and what inside it is selected.
    this._group = null;
    this._sel = null;
    this._linked = null;
    this._slotKind = new Map();
    // Keyed off the object itself, so nothing is written into the saved config.
    this._tileKeys = new WeakMap();
    this._tileSeq = 0;
  }

  // Bound once, on the column rather than on the cards: _renderForm rebuilds
  // those on every keystroke, and a listener per card would go with them.
  _wireInspector() {
    if (this._inspectorWired) return;
    const pane = this.$("pane");
    if (!pane) return;
    this._inspectorWired = true;
    pane.addEventListener("mouseover", (ev) => {
      const card = ev.target.closest("[data-k]");
      const key = card && card.dataset.k;
      if (!key || key.indexOf("__") === 0) return this._link(null);
      this._link({ group: this._group, key: key }, "row");
    });
    pane.addEventListener("mouseleave", () => this._link(null));
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape" || !this._sel) return;
      // A combo or a menu owns Escape while it is open.
      if (this._openCombo) return;
      ev.stopPropagation();
      this._popRow();
    });
  }

  _tileKey(tile) {
    if (!this._tileKeys.has(tile)) this._tileKeys.set(tile, "tile-" + ++this._tileSeq);
    return this._tileKeys.get(tile);
  }

  set hass(hass) {
    this._hass = hass;
    const dark = !(hass.themes && hass.themes.darkMode === false);
    this.classList.toggle("is-light", !dark);
    if (!this._built) { this._built = true; this._build(); }
    else this._liveRefresh();
  }

  // hass is REPLACED on every update, not mutated, so this fires constantly -
  // hence the coalesce. _swapMap carries the decoded photo across and animates
  // only what is new, so a refresh is invisible unless something changed.
  _liveRefresh() {
    if (this._liveTimer) return;
    this._liveTimer = setTimeout(() => {
      this._liveTimer = null;
      // Never mid-gesture: a swap under a drag drops the tile being dragged,
      // and under an open menu it takes the anchor out from under it.
      if (this._tileDragged || this._openCombo) return;
      const mount = this.$("mapmount");
      // Not while the pointer is on it: a rebuild under the cursor drops hover
      // state and can move the thing about to be clicked.
      if (mount && mount.matches(":hover")) return this._liveRefresh();
      if (!mount || !mount.firstChild) return;
      const room = this._state && this._state.compact.rooms[this._room];
      if (!room) return;
      this._swapMap(mount, room);
    }, 1500);
  }
  set narrow(v) { this._narrow = v; }
  set route(v) { this._route = v; }

  // /hemma/<room-path>, or ?room=<room-path>. Unknown or absent lands on the
  // first room, which is what it always did.
  _roomFromRoute() {
    if (this._routeUsed) return 0;
    const rooms = (this._state && this._state.compact.rooms) || [];
    let want = "";
    const rp = this._route && this._route.path;
    if (rp) want = String(rp).replace(/^\/+/, "").split("/")[0];
    if (!want) {
      try { want = new URLSearchParams(window.location.search).get("room") || ""; } catch (e) { want = ""; }
    }
    if (!want) return 0;
    const i = rooms.findIndex((r) => r.path === want);
    return i < 0 ? 0 : i;
  }
  set panel(v) { this._panel = v; }

  $(id) { return this.shadowRoot.getElementById(id); }

  _log(msg, kind) {
    const el = this.$("log");
    if (!el) return;
    const line = document.createElement("div");
    line.className = "line " + (kind || "");
    line.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }
  _clearLog() { if (this.$("log")) this.$("log").innerHTML = ""; }

  _status(msg, kind) {
    const el = this.$("status");
    el.textContent = msg || "";
    el.className = "status " + (kind || "");
  }

  async _bundleOnce(fresh) {
    // A save must never write a bundle the panel read before the templates
    // changed - that is silent, and it looks like the save did nothing.
    if (fresh) this._bundle = null;
    if (this._bundle) return this._bundle;
    // Heuristic freshness: the static handler sets no Cache-Control, so a bundle
    // that has sat unchanged for hours gets reused without asking the server.
    // That silently feeds refreshTemplates yesterday's templates.
    const res = await fetch(TEMPLATES_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`templates ${res.status}`);
    this._bundle = await res.json();
    return this._bundle;
  }

  async _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          /* The form column is the only scroller. Without clamping the root,
             a wheel over the preview column falls through to the document,
             which drags the fixed header off screen and clips the columns. */
          display:block; overflow:hidden; overscroll-behavior:none;
          width:var(--vpw, 100vw); height:var(--vph, 100dvh);
          position:relative; isolation:isolate;
          --g-blur: var(--hemma-glass-backdrop, blur(24px) saturate(180%));
          --g-rim: var(--hemma-glass-rim,
            inset 0 1px .5px -0.5px rgba(255,255,255,0.55),
            inset 0 -1px .5px -0.5px rgba(255,255,255,0.48),
            inset 0 3px 6px -3px rgba(255,255,255,0.20),
            inset 0 -3px 6px -3px rgba(255,255,255,0.12),
            0 2px 8px rgba(0,0,0,0.18));
          --ease:cubic-bezier(.32,.72,0,1);
          --up:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 16V4m0 0L7 9m5-5 5 5'/%3E%3Cpath d='M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2'/%3E%3C/svg%3E");

          /* One material in both modes: a neutral gray glass carrying light
             text. Light and dark change how deep it sits, not what it is. */
          --ink:#ffffff;
          --ink-2:rgba(255,255,255,0.70);
          --ink-3:rgba(255,255,255,0.46);
          --hair:rgba(255,255,255,0.12);
          --accent:#0a84ff;

          --pane:linear-gradient(to bottom, rgba(142,142,152,0.30), rgba(122,122,132,0.24) 46%, rgba(112,112,122,0.22));
          --nested:rgba(255,255,255,0.09);
          --chip:rgba(255,255,255,0.15);
          --chip-hi:rgba(255,255,255,0.24);
          --chip-rim:rgba(255,255,255,0.18);
          /* Fields read as pressed into the glass, controls as lifted off it. */
          --field:rgba(0,0,0,0.20);
          --field-hi:rgba(0,0,0,0.26);
          --field-rim:rgba(255,255,255,0.14);
          --lift:linear-gradient(to bottom, rgba(96,96,106,0.62), rgba(78,78,88,0.68));
          --sw-off:rgba(0,0,0,0.30);
          --card-tint:rgba(255,255,255,0.07);
          /* --pane with its alpha resolved, for surfaces that cannot be glass. */
          --pane-solid:linear-gradient(to bottom, #6b6b75, #5d5d67 46%, #575761);
          --shadow:0 12px 34px rgba(0,0,0,0.34);
          --scrim-top:rgba(8,8,12,0.33); --scrim-bot:rgba(8,8,12,0.57);
          --photo:.46;

          --r-xl:30px; --r-lg:22px; --r-md:15px; --r-sm:11px;
          /* Measured off iOS Settings at 3x: ~11pt against a 52pt row. Its own
             number, so the genuinely big radii are not dragged down with it. */
          --r-group:16px;
          /* iOS puts the icon 10pt in from the group's edge. Cards and tiles
             share it; they were 24 and 20. */
          --card-pad-h:16px;
          /* The control row a heading sits in: the icon slot, which is also
             what the +, the caret and the switch fit inside. */
          --head-row:26px;
          --shut-h:52px;
          --card-pad-v:calc((var(--shut-h) - var(--head-row)) / 2);
          /* Where a hairline between rows starts - under the label, never under
             the icon, the way a grouped table divides itself. */
          --rule-inset:calc(var(--card-pad-h) + var(--sicon) + 12px);
          --gap:18px;
          /* The space between bands - Room, Badges, Tiles. The gap under the
             header is derived from it, so the first section sits the same
             distance below the bar as the sections sit from each other. */
          --band-gap:30px;
          /* The form's heading row and the preview's control row share this, so
             the first card in each column starts level. --ctl-h derives from it
             so the two cannot drift. */
          /* The pills were wide and thin. 39 gives the labels room without
             making the row a band; the icon options derive their square from
             the same number, so Day/Night stay circles. */
          --headrow:39px;
          /* What the cards' drop shadow needs to the left of the scrolling
             column, which clips at its padding box. */
          /* The icon chip. Radius and glyph inset derive from it, so the
             proportions hold at any size. The .chead grid gives it 34px. */
          --grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
          --sicon:30px;
          --shadow-room:12px;
          /* _syncTop measures the real bar and overwrites this ON THE HOST: the
             inspector is a sibling of .body and would never see it there. */
          --top-h:68px;
          /* macOS gives a source list about 220pt and holds it there. It is
             chrome, so it does not grow with the window. */
          --rail-w:220px;
          /* Fixed, the way a macOS inspector is. The form's rows are a
             110px label track plus a field, so this cannot go fluid without
             the field collapsing at the narrow end. */
          --insp-w:386px;
          /* What it stands off the window's trailing edge. The gutter between
             the panel and the preview is NOT this: that one is the plinth's
             own 14px, so it matches the rail's side of the preview exactly. */
          --insp-gap:26px;
          color:var(--ink);
          font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
          font-size:14px; -webkit-font-smoothing:antialiased;
          background:var(--primary-background-color,#0c0c0f);
        }

        /* HA reports darkMode from its own theme choice, which need not match
           how the panel reads. The palette above stands in both; only the
           depth cues move, so the panel never becomes a second design. */
        :host(.is-light) {
          --pane:linear-gradient(to bottom, rgba(128,128,140,0.40), rgba(108,108,120,0.34) 46%, rgba(98,98,110,0.32));
          --chip:rgba(255,255,255,0.18);
          --chip-hi:rgba(255,255,255,0.28);
          --chip-rim:rgba(255,255,255,0.22);
          --field:rgba(0,0,0,0.17);
          --field-hi:rgba(0,0,0,0.23);
          --lift:linear-gradient(to bottom, rgba(104,104,116,0.68), rgba(86,86,98,0.74));
          --card-tint:rgba(255,255,255,0.10);
          --pane-solid:linear-gradient(to bottom, #63636d, #56565f 46%, #50505a);
          --shadow:0 10px 28px rgba(0,0,0,0.22);
          --scrim-top:rgba(8,8,12,0.26); --scrim-bot:rgba(8,8,12,0.50);
          --photo:.52;
        }

        /* Blurred room photo behind the glass. Sibling, never an ancestor, so it
           cannot break backdrop-filter on the cards. Overhangs to keep the blur
           from darkening at the edges. */
        /* isolation seals the blend: the noise layers use mix-blend-mode, and
           .top and the columns gain compositing layers during an entrance and
           drop them after - which shifted the whole backdrop's brightness the
           moment the animation ended. */
        /* On the WRAPPER, under every layer inside it. On .bgtint - a later
           absolute sibling with no z-index - an opaque stop hides the photo and
           leaves the glass nothing to refract. */
        .bgwrap {
          position:fixed; inset:0; z-index:0; pointer-events:none;
          isolation:isolate; overflow:hidden;
          background:linear-gradient(to bottom, #15151c, #0f0f14);
        }
        .bg, .bgtint, .bgnoise, .bgnoise2 {
          position:absolute; inset:-160px; z-index:0; pointer-events:none;
        }
        /* The photo is defocused far past recognition, so it reads as the room's
           light rather than as a second copy of the picture in the preview.
           The overhang has to clear ~4x the blur radius or the edges darken. */
        .bg { inset:-280px; }
        /* Two alpha ramps over the viewport land as ~20px stripes in 8 bit. Raw
           feTurbulence is colored noise with noisy alpha, so at .04 almost none
           of it reached the screen. Flattened to opaque gray and blended as
           overlay it modulates around the midpoint instead of veiling, which is
           what actually breaks a band up. */
        .bgnoise, .bgnoise2 {
          background-image:var(--grain);
          background-size:180px 180px;
        }
        .bgnoise {
          mix-blend-mode:overlay;
          /* One knob. Too low and the stripes come back, too high and it reads
             as film grain. Somewhere around .12-.22 is the working range. */
          opacity:var(--bg-grain, .17);
        }
        /* overlay is midpoint-relative: below 0.5 it behaves as multiply, so the
           noise's deviation from gray is scaled by 2 x base. Measured against a
           #1b2130 backdrop the dither fell to sd 0.71 across 7 levels, under the
           ~1 level a dither needs to break a band - which is why the stripes are
           dark-mode only. screen falls off the opposite way, strongest where
           overlay is weakest, so the pair holds roughly flat:
               overlay .17 alone   dark sd 0.71 ( 7 lv)   light sd 2.27 (17 lv)
               + screen .06        dark sd 1.26 (12 lv)   light sd 2.43 (19 lv)
           It costs about nine levels of lift on the black point, accepted. */
        .bgnoise2 {
          mix-blend-mode:screen;
          opacity:var(--bg-grain-dark, .06);
        }
        /* The photograph is the subject INSIDE the preview. Out here at full
           strength the viewport swung blue to brown and took the form's
           hairlines with it. What is left is the room's light, not its picture. */
        .bg {
          width:calc(100% + 560px); height:calc(100% + 560px);
          object-fit:cover; filter:blur(80px) saturate(122%);
          opacity:0; transition:opacity .5s ease;
        }
        .bg.on { opacity:var(--photo); }
        .bgtint {
          background:
            radial-gradient(1300px 700px at 18% -14%, rgba(150,180,240,0.17), transparent 64%),
            linear-gradient(to bottom, var(--scrim-top), var(--scrim-bot));
        }
        .top, .body { position:relative; z-index:1; }

        /* left/right auto, not 0: the bar is fixed to the viewport but spans the
           PANEL, and with the sidebar docked left:0 runs out under it. auto puts
           the box at its static position - the host's own left edge. */
        /* One row: the rail down the leading edge, everything else beside it.
           The rail is chrome and holds its own height; .main is the window. */
        .shell {
          position:relative;
          display:flex; align-items:stretch;
          height:var(--vph, 100dvh);
        }
        /* The preview centers in what the panel leaves, but the toolbar is
           fixed and sets its own width, so this padding never reaches it - the
           bar still runs to the far edge with the panel below it. */
        .main {
          flex:1 1 auto; min-width:0; display:flex; flex-direction:column;
          padding-right:calc(var(--insp-w) + var(--insp-gap));
        }
        /* Fixed with left:auto, so its static position - the rail's trailing
           edge - is where it starts. That tracks HA's own sidebar docking and
           undocking for free, which a viewport-relative left could not. */
        /* One band across the window, like a unified toolbar: the rail and the
           bar share a fill and a blur, so the left of it reads as the rail's own
           top. It still starts from its STATIC position and is pulled back from
           there, so HA docking its sidebar moves it for free. */
        .top {
          position:fixed; top:0; left:auto; right:auto; z-index:6;
          margin-left:calc(var(--rail-w) * -1);
          width:var(--vpw, 100vw);
          display:flex; flex-direction:column; box-sizing:border-box;
          padding:calc(15px + env(safe-area-inset-top, 0px)) 0 13px;
          background:rgba(22,22,28,0.42);
          backdrop-filter:var(--g-blur); -webkit-backdrop-filter:var(--g-blur);
          box-shadow:inset 0 -1px 0 var(--hair);
        }
        /* One gutter, both sides, every row, so the bar and the columns cannot
           drift. --pad opens up past the 1680 cap: the burger needs 44px in
           front of the content edge and there is no centering margin left. */
        .toprow, .body {
          --pad:max(28px, calc(52px - max(0px, (100% - 1680px) / 2)));
          max-width:1680px; width:100%; margin:0 auto; box-sizing:border-box;
          padding-left:var(--pad); padding-right:var(--pad);
        }
        .toprow { display:flex; align-items:center; gap:14px; }
        /* The bar is the window now, so its content is placed against the rail
           rather than centered in a 1680 column: 20px past the rail's edge is
           where Home sets the name of what you are looking at. The right gutter
           still comes from --pad, which the wider box resolves to 28px. */
        :host(:not(.narrow)) .toprow {
          max-width:none; margin:0;
          padding-left:calc(var(--rail-w) + 20px);
        }
        /* One bar, one scope: burger, wordmark, then the controls that act on the
           DASHBOARD. Picking a room is picking a document, so rooms live in the
           rail; below PANEL_NARROW they come back here as a strip that SCROLLS
           rather than wraps. The scroller is #rooms itself, not the list inside
           it, so + travels with the pills while the rail can still pin it. */
        /* Where Home puts the name of what you are looking at. */
        .toprow > h1 { flex:0 0 auto; }
        .toprow #rooms {
          flex:0 1 auto; min-width:0; margin-left:6px;
          display:flex; align-items:center; gap:8px;
          overflow-x:auto; overflow-y:hidden;
          padding:3px 2px; scrollbar-width:none; -ms-overflow-style:none;
        }
        .toprow #rooms::-webkit-scrollbar { width:0; height:0; display:none; }
        .toprow #rooms .tabs { margin:0; flex-wrap:nowrap; }
        .toprow #rooms .tab, .toprow #rooms .tabadd { flex:0 0 auto; }
        /* A circle in the strip, a named row in the rail - the same split
           #save makes between its long and short label. */
        .toprow #rooms .addlabel { display:none; }
        /* The strip is a row of compact pills with no room for a glyph, and no
           pointer to reveal a menu on hover - so the caret stays parked on the
           selected pill, which is where it has always been. */
        .toprow .tab .roomglyph { display:none; }
        .toprow .tab .caret { display:none; }
        .toprow .tab.on .caret { display:grid; }
        .top .tabs { margin:0; }
        .top h1 { font-size:21px; font-weight:600; margin:0; letter-spacing:-0.022em; }
        .ver { font-size:11px; color:var(--ink-3); font-weight:450; margin-left:7px; letter-spacing:0; }
        /* The wordmark is the app; this is the document. A macOS titlebar names
           the file it has open and lets you act on it from that name, which is
           also the discoverable way to switch - the ... menu becomes a shortcut
           rather than the only route. */
        .burger {
          background:transparent; border:0; color:var(--ink); cursor:pointer;
          width:32px; height:32px; flex:0 0 32px; border-radius:50%; padding:0;
          /* Out into the gutter so the WORDMARK lines up with the pills, not the
             burger. 32 + 8 is the 40 it hangs out by. */
          margin-left:-40px; margin-right:-6px;
          display:flex; align-items:center; justify-content:center;
          box-shadow:none;
          transition:background .22s ease;
        }
        .burger svg { width:20px; height:20px; display:block; }
        .spacer { flex:1 1 0; min-width:0; }
        .toprow > button { flex:0 0 auto; }

        /* The body is the viewport, so the stage can flex into whatever the
           room switcher above it leaves behind - no magic offsets to keep in
           step with the header or the tab row. */
        /* The body starts BEHIND the header; each column pads itself clear, so
           the bar's own blur is the fade. No mask anywhere - one would kill
           backdrop-filter on every card inside. */
        .body {
          overflow:hidden;
          height:var(--vph, 100dvh); display:flex; flex-direction:column;
        }

        select, input[type=text], input:not([type]), textarea {
          font:inherit; color:var(--ink);
          background-color:var(--field);
          border:1px solid var(--field-rim);
          border-radius:13px; padding:9px 12px;
          transition:border-color .16s ease, background .16s ease;
        }
        input:focus, textarea:focus {
          outline:none; border-color:rgba(10,132,255,0.9); background-color:var(--field-hi);
        }
        input::placeholder, textarea::placeholder { color:var(--ink-3); }

        button {
          font:inherit; font-weight:590; cursor:pointer; color:#fff;
          background:var(--accent); border:0; border-radius:999px; padding:10px 20px;
          transition:filter .16s ease, transform .12s ease;
        }
        button:hover:not(:disabled) { filter:brightness(1.12); }
        button:active:not(:disabled) { transform:scale(0.97); }
        button.ghost {
          background:var(--chip); color:var(--ink);
          box-shadow:inset 0 0 0 1px var(--chip-rim);
          backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
        }
        button.ghost:hover:not(:disabled) { background:var(--chip-hi); filter:none; }
        /* No blur of their own: nested inside the header's glass a
           backdrop-filter samples that composited surface, and drops out while
           the bar animates. A stronger fill replaces it. */
        .toprow > button.ghost {
          backdrop-filter:none; -webkit-backdrop-filter:none;
          background:rgba(255,255,255,0.20);
        }
        .toprow > button.ghost:hover:not(:disabled) { background:rgba(255,255,255,0.28); }
        /* No resting fill: one chip fewer in the corner. It appears under the
           pointer and fades back out. */
        .burger:hover { background:rgba(255,255,255,0.20); }
        button:disabled { opacity:.35; cursor:default; transition:opacity .22s var(--ease); }
        /* On save the button goes green AND disabled at once, so the tick drew
           itself while fading. The dim waits for .ok to clear. */
        button:disabled.ok { opacity:1; }
        button.ok { background:#30d158; }
        button.ok svg { width:19px; height:19px; display:block; }
        #save .s-short { display:none; }
        #brand .s-short { display:none; }

        .combo > input { border-radius:13px; }
        .toprow > select, .toprow > button:not(.burger) {
          height:36px; box-sizing:border-box; display:inline-flex;
          align-items:center; justify-content:center; font-size:13.5px;
        }
        .toprow > button:not(.burger) { padding:0 18px; }
        .toprow > button.icon {
          width:36px; padding:0; border-radius:50%;
          background:var(--chip); box-shadow:inset 0 0 0 1px var(--chip-rim); color:var(--ink-2);
          transition:background .14s ease, color .14s ease;
        }
        .toprow > button.icon:hover { background:var(--chip-hi); color:var(--ink); filter:none; }
        .toprow > button.icon svg { width:18px; height:18px; display:block; }
        .toprow > button#more { color:var(--ink); }
        .toprow > button#more svg { width:20px; height:20px; }
        /* Blue only while an edit is pending, so the header reads as one row of
           neutral controls until there is something to save. */
        .toprow > button#save.dirty { background:var(--accent); color:#fff; box-shadow:none; }
        .toprow > button#save.dirty:hover:not(:disabled) {
          background:var(--accent); filter:brightness(1.12);
        }
        .toprow > button#save.ok { background:#30d158; color:#fff; box-shadow:none; }
        .status { min-height:20px; font-size:12.5px; margin:13px 2px 22px; color:var(--ink-2); }
        /* It is a flex child of .body, so an empty one still held 55px between
           the header and the columns. */
        .status:empty { display:none; }
        .status.ok { color:#30d158; } .status.err { color:#ff453a; } .status.warn { color:#ffd60a; }

        .tabs { display:flex; gap:8px; align-items:center; flex:0 0 auto; }
        .tab {
          display:inline-flex; align-items:center; gap:7px; touch-action:none;
          box-sizing:border-box; white-space:nowrap;
          padding:9px 16px; border-radius:999px; cursor:pointer; font-size:13.5px; font-weight:520;
          -webkit-touch-callout:none;
          /* No backdrop-filter: animating the row's opacity and transform
             suspends a descendant's blur until the animation ends, which is why
             the pills popped. */
          background:rgba(255,255,255,0.20);
          box-shadow:inset 0 0 0 1px var(--chip-rim);
          transition:background .16s ease;
          user-select:none; -webkit-user-select:none;
        }
        /* Every surface here is dragged or tapped, never read: the preview is a
           mock-up, and both card headings are drag handles that also fold. Form
           rows are deliberately left alone so entity ids stay copyable. */
        .card.map, .card.map *, .thead, .thead *, .card > .chead, .card > .chead * {
          user-select:none; -webkit-user-select:none;
        }
        .tab:hover { background:rgba(255,255,255,0.28); }
        .tab.on { background:var(--accent); box-shadow:none; }
        .tab.dragging {
          z-index:5; opacity:1; cursor:grabbing;
          background:var(--lift);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.16),
            inset 0 0 0 1px var(--chip-rim),
            0 10px 26px rgba(0,0,0,0.36);
        }
        .tab.on.dragging {
          background:linear-gradient(to bottom, #2b90ff, #0a7ae8);
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 26px rgba(0,0,0,0.44);
        }
        .tab .caret {
          width:15px; height:15px; flex:0 0 15px; opacity:.7; margin-right:-8px;
          display:grid; place-items:center; overflow:hidden;
        }
        .tab .caret svg { width:11px; height:11px; display:block; }
        .tab .caret:hover { opacity:1; }
        .tabadd {
          width:34px; height:34px; padding:0; border-radius:50%;
          display:inline-flex; align-items:center; justify-content:center;
          background:var(--chip); color:var(--ink);
          box-shadow:inset 0 0 0 1px var(--chip-rim);
        }
        .tabadd:hover { background:var(--chip-hi); filter:none; }
        .tabadd svg { width:16px; height:16px; display:block; }

        /* Two columns packed in JS. Browser column balancing put tall cards in
           unpredictable places, so sections go to whichever column is shorter. */
        #pane { display:block; }
        .band { margin:0 0 var(--band-gap, 30px); scroll-margin-top:92px; }
        /* One group at a time, so the last one is never a scroll away. The band
           headings went with it - the segment already names what you are
           looking at, and a heading under it would be the same word twice. */
        /* The column's one nav row. The switcher and the back bar are two
           contents of the SAME slot, never two rows: opening a section used to
           insert a bar above the group and push everything down a row. */
        .navrow {
          position:relative; width:100%; margin:0 0 14px;
          height:var(--headrow, 35px); box-sizing:border-box;
        }
        .navrow > * {
          position:absolute; inset:0;
          display:flex; align-items:center; box-sizing:border-box;
        }
        .groupseg {
          display:flex; width:100%; margin:0;
          /* --ctl-h is declared on .segrow, so out here .seg's min-height
             resolved to nothing and the row collapsed to its content, putting
             the two columns out of step. Declared locally, and on this rule so
             it beats .seg's later declaration at equal weight. */
          --ctl-h:var(--headrow, 35px);
          min-height:var(--headrow, 35px); box-sizing:border-box;
        }
        .groupseg .segopt { flex:1 1 0; }
        .band:last-child { margin-bottom:0; }
        /* Smart Sort, off the heading it was floating on. It sits with the list
           it governs rather than beside a label, and reads as a setting because
           it is on the same rail as the rows below it. */
        /* System Settings' shape: icon left, name beside it, description under.
           Centered it read as an onboarding splash. */
        .grouphead {
          position:relative;
          display:grid; grid-template-columns:auto minmax(0,1fr);
          align-items:center; column-gap:14px; row-gap:3px;
          padding:15px var(--card-pad-h); margin:0;
        }
        /* Rides ON the group's glass rather than carrying its own, so the column
           keeps ONE top edge - the one that lines up with the preview. */
        /* .tilewrap too: the tiles caption lives there rather than in the
           column, and was the only one of the three left floating. */
        .col > .grouphead, .tilegrid > .grouphead, .tilewrap > .grouphead {
          border-bottom-left-radius:0; border-bottom-right-radius:0;
        }
        /* And what follows it squares its own top, so the seam closes. */
        .tilewrap > .grouphead + .tilegrid {
          border-top-left-radius:0; border-top-right-radius:0;
        }
        /* Spanning both rows, so it centers against the title and the
           description together rather than lining up with the title alone. */
        .grouphead .sicon {
          --sicon:46px; border-radius:calc(var(--sicon) * .27);
          grid-column:1; grid-row:1 / span 2; align-self:center;
        }
        .grouphead h3 {
          grid-column:2; grid-row:1; align-self:end;
          margin:0; font-size:19px; font-weight:640; letter-spacing:-0.015em;
          color:var(--ink);
        }
        /* In the LIST the switcher above already names the group, so only the
           description survives as a caption. The DETAIL view keeps all three:
           there the back bar names the parent and the header names the thing you
           pushed into, which are different words. */
        :host(:not(.narrow)) .inspector .band:not(.detail) .grouphead {
          padding:6px var(--card-pad-h) 13px; column-gap:12px;
        }
        :host(:not(.narrow)) .inspector .band:not(.detail) .grouphead h3 {
          display:none;
        }
        /* A step up from the 30px chips on the rows below, not the 46px it was
           when it headed a splash. */
        :host(:not(.narrow)) .inspector .band:not(.detail) .grouphead .sicon {
          --sicon:34px; grid-row:1 / span 2; align-self:center;
        }
        :host(:not(.narrow)) .inspector .band:not(.detail) .grouphead p {
          grid-column:2; grid-row:1 / span 2; align-self:center;
        }
        /* Hints off: the prose goes, every label and control stays. Collapsed to
           ZERO rather than display:none, since a zero-height box can still be
           measured and animated between. Every inset goes with it. */
        :host(.nohints) .grouphead p,
        :host(.nohints) .band.detail .card > .chead .blurb,
        :host(.nohints) .hint,
        :host(.nohints) .sortstrip .sortnote,
        :host(.nohints) .inspector .band:not(.detail) .grouphead {
          height:0; min-height:0; opacity:0; overflow:hidden;
          padding-top:0; padding-bottom:0; margin-top:0; margin-bottom:0;
          border-top:0; border-bottom:0;
        }
        :host(.nohints) .grouphead,
        :host(.nohints) .band.detail .card > .chead,
        :host(.nohints) .sortstrip { row-gap:0; }
        :host(.nohints) .grouphead h3 { grid-row:1 / span 2; align-self:center; }
        :host(.nohints) .band.detail .card > .chead { align-items:center; }
        :host(.nohints) .band.detail .card > .chead h2 { grid-row:1 / span 2; }
        :host(.nohints) .sortstrip .bandtog { grid-row:1 / span 2; align-self:center; }
        .grouphead p {
          grid-column:2; grid-row:2; align-self:start;
          margin:0; font-size:13px; line-height:1.4; color:var(--ink-2);
          max-width:52ch;
        }
        /* Smart Sort and Edit were floating on the page above the list: text
           hard left, switch hard right, and blue-on-photograph for Edit. They
           are settings, so they sit on a surface like every other setting. */
        /* Built like the rows above it: name over its description, control at
           the end. */
        .sortstrip, .badgebar {
          display:grid; align-items:center;
          /* The name and the switch, nothing between them. */
          grid-template-columns:minmax(0,1fr) auto;
          column-gap:var(--head-gap, 9px); row-gap:2px;
          padding:12px var(--card-pad-h);
          /* No min-height: --shut-h is a shut row's WHOLE height, padding
             included, so imposing it on top of this padding doubled up. */
          position:relative;
        }
        .sortstrip .bandtog, .badgebar .bandtog {
          grid-column:1; grid-row:1; align-self:end;
          font-size:13.5px; font-weight:560; color:var(--ink);
        }
        .sortstrip .sortnote {
          grid-column:1; grid-row:2; align-self:start; margin:0;
          font-size:12px; line-height:1.35; color:var(--ink-2);
        }
        /* One line, always: this row's caption said its own label back. */
        .badgebar { row-gap:0; }
        .badgebar .bandtog { grid-row:1 / span 2; align-self:center; }
        .sortstrip .sw, .badgebar .badgeedit {
          grid-column:2; grid-row:1 / span 2; align-self:center;
        }
        .sortstrip + .sortstrip::before {
          content:""; position:absolute; top:0;
          left:var(--card-pad-h); right:var(--card-pad-h);
          height:1px; background:var(--hair);
        }


        /* iOS's nav-bar Edit: a glass pill that morphs into a blue tick circle.
           ONE element, so width, fill and contents travel together - two buttons
           swapped would pop - and the height never changes. */
        .addrowbar .editbtn {
          margin-left:auto;
          height:34px; min-width:74px; padding:0 17px; border-radius:999px;
          display:grid; place-items:center;
          font-size:14.5px; font-weight:500; color:var(--ink);
          background:var(--chip); box-shadow:inset 0 0 0 1px var(--chip-rim);
          transition:min-width .34s cubic-bezier(.36,0,.16,1),
                     width .34s cubic-bezier(.36,0,.16,1),
                     padding .34s cubic-bezier(.36,0,.16,1),
                     background-color .28s var(--ease),
                     box-shadow .28s var(--ease);
          overflow:hidden;
        }
        .addrowbar .editbtn:hover { background:var(--chip-hi); filter:none; }
        .addrowbar .editbtn > * { grid-area:1 / 1; transition:opacity .18s var(--ease); }
        .addrowbar .editbtn .tick { opacity:0; width:17px; height:17px; display:block; }
        .addrowbar .editbtn.on {
          min-width:34px; width:34px; padding:0;
          background:var(--accent); box-shadow:none; color:#fff;
        }
        .addrowbar .editbtn.on:hover { background:var(--accent); filter:brightness(1.1); }
        .addrowbar .editbtn.on .lbl { opacity:0; }
        .addrowbar .editbtn.on .tick { opacity:1; }
        @media (prefers-reduced-motion: reduce) {
          .addrowbar .editbtn { transition:none; }
        }
        /* The options group is a surface like any other, and the tiles group
           below it brings its own - .col:has(.tilewrap) strips the surface off
           the column that holds the tile list, and this one must keep it. */
        /* Rows of the tiles group, so they carry its insets and its dividers. */
        .tilegrid > .sortstrip { --rule-inset:var(--card-pad-h); }
        /* A full --gap put 30px between the last tile and this, and with one
           unheaded row below it the space read as a hole rather than as a
           break between two groups. Enough to separate them, not enough to
           strand it at the bottom of the panel. */
        .tilegrid.optgroup { margin-bottom:8px; }
        .tilegrid > .addrowbar {
          padding:11px var(--card-pad-h); margin:0;
          --rule-inset:var(--card-pad-h);
        }

        /* ── editing a list, the way iOS does it ────────────────────────────
           Edit reveals a minus; tapping it slides the row aside and brings
           Delete in. Two steps, and the confirmation is in the row. */
        /* The row clips, so anything parked outside it is genuinely hidden and
           has somewhere to come from. */
        .band:not(.detail) .tilegrid > .tile { overflow:hidden; }
        /* Parked on a negative margin outside the leading edge, with the MARGIN
           animating to nothing - so the button slides in and pushes what follows,
           as UIKit does. Animating the row drags the caret; growing the button
           inflates it in place. */
        /* The gap is the row's own inset, and it has to be: the button starts
           that far in from the edge, so parking it by button + gap is what puts
           its trailing edge exactly on the edge. Any smaller and its leading
           crescent stays inside the box, on every row, permanently. */
        .tile { --rm-w:22px; --rm-gap:var(--card-pad-h); --head-gap:9px; }
        .rmbtn {
          width:var(--rm-w); height:var(--rm-w); flex:0 0 var(--rm-w);
          padding:0; border-radius:50%;
          background:#ff453a; color:#fff; display:grid; place-items:center;
          box-shadow:none;
          /* The row's flex gap already supplies part of this. Adding the whole
             inset on top of it put the icon a gap further in than the rows
             below, and than every section card's icon. */
          margin-right:calc(var(--rm-gap) - var(--head-gap));
          margin-left:calc((var(--rm-w) + var(--rm-gap)) * -1);
          transition:margin-left .36s cubic-bezier(.36,0,.16,1);
        }
        .tilegrid.editing .rmbtn { margin-left:0; }
        .tilegrid:not(.editing) .rmbtn { pointer-events:none; }
        .rmbtn svg { width:12px; height:12px; display:block; }
        .rmbtn:hover { background:#ff6961; filter:none; }

        /* A detached rounded rectangle standing beside the row, not a slab
           welded to its edge - that is what iOS draws, and it is why ours read
           as a colored margin rather than a button. Inset top and bottom, its
           own radius, and a gap between it and the row it belongs to. */
        .delbtn {
          position:absolute; top:6px; bottom:6px; right:8px;
          width:var(--del-w, 84px);
          border-radius:12px; box-shadow:none; padding:0;
          background:#ff453a; color:#fff; font-size:14px; font-weight:560;
          display:grid; place-items:center;
          transform:translateX(calc(var(--del-w, 84px) + 16px));
          transition:transform .36s cubic-bezier(.36,0,.16,1);
        }
        .tile:not(.armed) .delbtn { pointer-events:none; }
        .tile.armed .delbtn { transform:none; }
        /* Nothing is parked in a row that is not armed: the button is built on
           the arm and removed after the slide back. The clip is only on .arming,
           where it cannot reach a combo's menu. */
        .row.arming { position:relative; overflow:hidden; }
        .row.arming > *:not(.delbtn) {
          transition:transform .36s cubic-bezier(.36,0,.16,1);
        }
        .row.armed > *:not(.delbtn) {
          transform:translateX(calc((var(--del-w, 84px) + 16px) * -1));
        }
        .row:not(.armed) .delbtn { pointer-events:none; }
        .row.armed .delbtn { transform:none; }
        /* A tile row is one line so Delete can stretch to it; a field row is
           not - stacked, it holds a label above the field. Takes the control's
           own height instead, which the row's bottom padding levels. */
        .row > .delbtn {
          top:auto; bottom:var(--row-pad-b, 12px); height:var(--ctl-h, 38px);
          right:0;
        }
        .delbtn:hover { background:#ff6961; filter:none; }
        /* The row moves for one reason only: to uncover Delete. Arriving in
           edit mode is the button's own margin, so the caret at the far end
           does not travel with it. */
        .tile > .thead {
          --armed-x:0px;
          transform:translateX(var(--armed-x));
          transition:transform .36s cubic-bezier(.36,0,.16,1);
        }
        .tile.armed > .thead { --armed-x:calc((var(--del-w, 84px) + 16px) * -1); }
        /* Editing is not browsing: the caret fades, keeping its place so the
           row's trailing edge holds still while the minus arrives. */
        /* .band:not(.detail) sets the caret's .45 at the SAME specificity and
           sits later, so match its ancestor and win on specificity, not order. */
        .band:not(.detail) .tilegrid.editing .tile > .thead .fold { opacity:0; }
        /* The handle takes the caret's PLACE: a row either opens or moves, never
           both. Absolute so the trailing edge does not shift, and specific
           enough to beat the rule making every head child position:relative. */
        /* Parked outside the trailing edge and slid in on Edit, mirroring the
           minus arriving on the other side. Absolute, so the row's trailing
           edge does not shift when it lands. */
        .tile > .thead .grip {
          position:absolute; right:var(--card-pad-h); top:50%; z-index:2;
          width:var(--rm-w); height:var(--rm-w); padding:0;
          background:none; box-shadow:none; color:var(--ink-2);
          display:grid; place-items:center; cursor:grab;
          --grip-x:calc(var(--rm-w) + var(--rm-gap));
          transform:translate(var(--grip-x), -50%);
          opacity:0; pointer-events:none;
          transition:transform .36s cubic-bezier(.36,0,.16,1),
                     opacity .36s cubic-bezier(.36,0,.16,1),
                     color .2s var(--ease);
        }
        .tilegrid.editing .tile > .thead .grip {
          --grip-x:0px; opacity:1; pointer-events:auto;
        }
        .tile > .thead .grip:hover { background:none; color:var(--ink); }
        .tile > .thead .grip:active { cursor:grabbing; }
        .grip svg { width:17px; height:17px; display:block; }
        @media (prefers-reduced-motion: reduce) {
          .rmbtn, .delbtn, .tile > .thead, .tile > .thead .fold,
          .tile > .thead .grip { transition:none; }
        }

        /* Selection. The inspector shows the thing you pointed at, so every
           other card in the band steps out rather than being scrolled past. */
        .band.detail .col > .card:not(.sel),
        .band.detail .tilegrid > .tile:not(.sel),
        .band.detail .addbar,
        .band.detail .sortstrip,
        .band.detail .badgebar,
        .band.detail .tilewrap > .hint { display:none; }
        .detailbar { gap:11px; }
        .detailbar .plus, .detailbar .sw { flex:0 0 auto; }

        /* Inside a section the head is a HEADER: larger chip, title, caption.
           Repeating the title from the bar above is the pattern, not a slip. */
        .band.detail .card > .chead {
          --sicon:38px;
          grid-template-columns:var(--sicon) 1fr auto auto;
          column-gap:14px; row-gap:3px;
          align-items:start;
          margin:0 calc(var(--card-pad-h) * -1) 0;
          /* Even inset: the same distance from the top as from the sides. */
          padding:calc(var(--card-pad-h) + 8px) var(--card-pad-h)
                  calc(var(--card-pad-h) + 4px);
          border-bottom:1px solid var(--hair);
        }
        /* Centered against the title AND its line of description together, the
           way System Settings sets an icon beside a two-line header - not
           pinned to the top of the first line, which sits it high. */
        .band.detail .card > .chead .sicon {
          grid-row:1 / span 2; align-self:center; margin:0;
          border-radius:calc(var(--sicon) * .27);
        }
        .band.detail .card > .chead h2 {
          grid-column:2; grid-row:1; align-self:center;
          font-size:17px; font-weight:640; letter-spacing:-0.01em;
        }
        .band.detail .card > .chead .blurb {
          grid-column:2; grid-row:2;
          margin:0; font-size:13px; line-height:1.4; color:var(--ink-2);
          max-width:52ch;
        }
        /* Only in the header. In the list the row is a name and a state. */
        .band:not(.detail) .blurb { display:none; }
        /* One title row and one blurb row: with no blurb the chip would center
           against a single line and sit low. */
        .band.detail .card > .chead:not(:has(.blurb)) {
          align-items:center; row-gap:0;
        }
        .band.detail .card > .chead:not(:has(.blurb)) h2 { grid-row:1 / span 2; }
        /* The header's own rule is the divider. The row under it drew a second
           one - :first-of-type counts divs, and the head is a div, so the first
           row was never "first" - with the head's margin holding them apart. */
        .band.detail .card > .chead + * { margin-top:0; border-top:0; }
        .detailbar .back {
          width:30px; height:30px; flex:0 0 30px; padding:0; border-radius:50%;
          background:var(--chip); color:var(--ink); display:grid; place-items:center;
          box-shadow:none;
        }
        .detailbar .back svg { width:16px; height:16px; display:block; }
        .detailbar .back:hover { background:var(--chip-hi); filter:none; }
        .detailbar h3 {
          margin:0; flex:1 1 auto; font-size:19px; font-weight:640;
          letter-spacing:-0.02em; color:var(--ink);
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        /* Hovering either side lights both. An inset pill, not a full-bleed
           fill: the fill ran into the group's rounded corners and stopped
           nowhere near the rule's inset. */
        .card > .chead, .tile > .thead { position:relative; }
        .card > .chead::after, .tile > .thead::after {
          content:""; position:absolute; z-index:0;
          left:var(--row-hi-inset, 8px); right:var(--row-hi-inset, 8px);
          top:4px; bottom:4px; border-radius:11px;
          background:rgba(255,255,255,0.085);
          opacity:0; transition:opacity .14s var(--ease);
          pointer-events:none;
        }
        /* The separators stay. They only had to be hidden because a fill sat
           under the cursor at all times; now that the fill is a momentary
           cross-reference there is nothing for them to fight with. */
        .card > .chead > *, .tile > .thead > * { position:relative; z-index:1; }
        /* Only when the cursor is in the OTHER column. macOS never combines a
           persistent hover fill with separators, and a row you are already
           pointing at needs no fill. This is for the cross-reference: point at a
           tile in the preview and its row lights. */
        .card.linked > .chead::after, .tile.linked > .thead::after { opacity:1; }
        /* A highlighted row is one object, so its separators step aside. The
           transition lives on the highlighted state, so it fades in and snaps
           back. */
        .col > .card.linked::before,
        .col > .card.linked + .card::before,
        .tilegrid > .tile.linked::before,
        .tilegrid > .tile.linked + *::before {
          opacity:0; transition:opacity .14s var(--ease);
        }
        /* Nothing to highlight once you are inside it. */
        .band.detail .card > .chead::after,
        .band.detail .tile > .thead::after { opacity:0; }
        /* A ring, and nothing that leaves the row. .mini-tiles scrolls
           sideways, so its overflow-y can only compute to clip - a lift, a scale
           or a drop shadow all get cut. An inset ring costs no geometry. */
        .mtile, .pbadge {
          transition:box-shadow .16s var(--ease), background-color .16s var(--ease);
        }
        .mtile.linked, .pbadge.linked {
          box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.85);
        }
        .mtile.on.linked { box-shadow:inset 0 0 0 1.5px rgba(0,0,0,0.45); }
        /* Both heading rows share a height, so the first card in each column
           starts level: the view control makes one row taller than a bare
           heading. */
        .bandhead {
          /* 24px, matching a card's own padding, so a control on the heading
             lines up with the switches on the cards below it rather than
             sitting 22px further out. */
          margin:0 0 14px; padding:0 var(--card-pad-h) 0 0; min-height:var(--headrow, 35px);
          display:flex; align-items:center; gap:10px;
        }
        .bandhead h3 { flex:1 1 auto; }
        .bandtog { font-size:12.5px; color:var(--ink-2); font-weight:520; }
        .bandhead h3 {
          margin:0; font-size:21px; font-weight:640; letter-spacing:-0.02em;
          color:var(--ink);
        }
        .bandhead p { margin:3px 0 0; font-size:13px; color:var(--ink-2); }
        /* The preview holds the left column and stays put; the form is one
           column beside it. */
        /* Two panes, one scrollbar. The preview used to drift as the page
           scrolled; now the stage is the viewport and only the form moves. */
        /* Settings lead, preview follows: the room pills, the section headings
           and the fields all start at the same left edge. */
        /* One thing in the stage now: the preview. The form went to the
           inspector on the trailing edge, so the subject sits between the two
           chrome columns rather than being pushed against one of them. */
        .stage {
          display:flex; align-items:stretch;
          flex:1 1 auto; min-height:0;
        }
        /* Laid out but unpainted, so the empty shell never flashes before the
           content arrives - and the fit can still measure it. */
        :host(.booting) .top, :host(.booting) .stage,
        :host(.booting) .rail, :host(.booting) .inspector { opacity:0; }
        /* Top-aligned, NOT centered: centering pushed the control row down while
           the inspector stayed at --top-h and the columns lost their level. */
        .canvas {
          flex:1 1 auto; min-width:0; display:flex; flex-direction:column;
          align-self:flex-start;
          padding:var(--top-h) 0 28px;
        }
        /* Three tracks, not a flex row: the picker is centered over the preview
           itself, which a space-between row cannot do once the heading and the
           controls are different widths. */
        /* Just the two view switches, centered. Its own box with no inherited
           padding: .bandhead's right inset would push the pair off center. */
        .canvashead {
          flex:0 0 auto; display:flex; align-items:center; justify-content:center;
          box-sizing:border-box; padding:0;
        }
        /* Both controls answer "how am I looking at this", so they travel
           together. One height for the pair: align-self:stretch with
           aspect-ratio is circular here - the row's height comes from its
           items - and Chrome resolved it to a 300px circle. */
        .segrow {
          /* One height so the columns stay level, but NOT one control - abutted
             they read as a single four-option switch. Centered, not pinned to
             --preview-w: that is the PAINTED width, so every size switch moved
             the control you were reaching for. */
          --ctl-h:var(--headrow, 35px);
          flex:0 0 auto; display:flex; align-items:center; gap:28px;
          width:auto; margin-inline:auto;
          justify-content:center;
        }
        .seg { min-height:var(--ctl-h); box-sizing:border-box; }
        /* A glyph carries no baseline, so the icon variant sets its own box: 15px
           is the line box a 12.5px label makes, which matches both controls
           without either being given a number. Even padding makes it square, and
           a radius on a square is a circle. */
        .seg.icons { cursor:pointer; }
        /* Square, so the traveling pill is a circle. The width is derived from
           --ctl-h like the height, not from padding: fixed padding turns the
           thumb into an ellipse the moment --ctl-h moves. */
        .seg.icons .segopt {
          padding:0; flex:0 0 auto;
          width:calc(var(--ctl-h) - 4px);
          height:calc(var(--ctl-h) - 4px);
          display:flex; align-items:center; justify-content:center;
        }
        .seg.icons .segopt svg { width:15px; height:15px; display:block; }
        /* The canvas tile: switcher and preview on one surface. Sitting
           straight on the page the preview was a photo on top of the same
           photo, which is why it read as a hole rather than an object. */
        /* Flex the whole way down rather than percentage heights: centering the
           wrap stopped it stretching, so the slot had no definite height to
           measure and the preview shrank to nothing. */
        /* Only a deliberate Desktop/Tablet switch animates. Layout settling,
           fonts loading and the header measuring all change the scale during
           load, and transitioning those is the zoom you see on every refresh. */
        /* No tile any more. The backdrop is defocused enough that the preview
           reads as an object on its own, so a shadow does the separating. */
        /* The same glass as a section group: on the backdrop the preview read as
           a cut-out, on a panel as a screen on a table - and both columns then
           have one shape. The panel is only the preview, not the switcher. */
        /* A canvas is a void, not a card: a full glass surface around a preview
           that carries its own shadow is two competing objects. The padding
           stays - applySize subtracts it from the height budget, so dropping it
           grows the preview and the shadow lands on the column edge. */
        /* No preview on a phone: a 390pt mock scaled down inside a 390pt screen
           is worse than the real dashboard, which is one tap away. The ... menu
           offers Open dashboard instead. Tablet and desktop keep it - there it
           sits beside the form. */
        :host(.phone) .stage { display:none; }
        .plinth {
          position:relative; isolation:isolate;
          flex:0 0 auto; display:flex; flex-direction:column;
          /* 28px in total, the number applySize subtracts from the height
             budget - but none of it above the screen, so the screen's top edge
             is the column's top edge and lines up with the first card. */
          justify-content:flex-start; padding:0 14px 28px;
        }
        .plinth > * { position:relative; z-index:1; }
        .canvas .mapwrap {
          margin:0; width:100%; flex:1 1 auto; min-height:0;
          justify-content:center;
        }
        /* The inspector's body. It no longer sets its own width or its own
           offset from the toolbar: the inspector is the column, and its head
           is what it starts under. */
        .sheet {
          flex:1 1 auto; min-height:0; min-width:0; box-sizing:border-box;
          overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain;
          padding:0; margin:0;
          scrollbar-width:none; -ms-overflow-style:none;
        }
        .sheet::-webkit-scrollbar { width:0; height:0; display:none; }
        .sheet .band { scroll-margin-top:4px; }
        .sheet .band:last-child { margin-bottom:0; }

        /* The inspector. The rail's mirror: same material, same full height,
           the hairline on its LEADING edge instead. Keynote, Pages, Numbers,
           Xcode and Final Cut all put the inspector opposite the navigator
           with the subject between them, which is the arrangement this is. */
        .inspector {
          position:absolute; z-index:7;
          top:var(--top-h); right:var(--insp-gap); width:var(--insp-w);
          max-height:calc(var(--vph, 100dvh) - var(--top-h) - var(--insp-gap));
          box-sizing:border-box;
          display:flex; flex-direction:column;
          border-radius:var(--r-group);
          background-color:var(--card-tint); background-image:var(--pane);
          backdrop-filter:var(--g-blur); -webkit-backdrop-filter:var(--g-blur);
          box-shadow:var(--g-rim), 0 22px 60px rgba(0,0,0,0.40);
          /* Same backup the groups carry: a radius alone does not bound a
             backdrop-filter and the corner reads doubled without it. */
          clip-path:inset(0 round var(--r-group));
          isolation:isolate;
        }
        /* The panel IS the group's surface: given .col's recipe with a .col still
           inside it, the two drew identical tiles 10px apart. The rows sit
           straight on the panel and their own hairlines divide them. */
        /* .tilegrid as well as .col: the tiles band strips .col's surface and
           hands it to .tilegrid, so stripping only .col left the Tiles group
           still painting a full glass tile inside the panel. */
        :host(:not(.narrow)) .inspector .col,
        :host(:not(.narrow)) .inspector .tilegrid {
          background:none; background-image:none;
          box-shadow:none; backdrop-filter:none; -webkit-backdrop-filter:none;
          border-radius:0; clip-path:none; isolation:auto;
        }
        :host(:not(.narrow)) .inspector .col::before,
        :host(:not(.narrow)) .inspector .col::after,
        :host(:not(.narrow)) .inspector .tilegrid::before,
        :host(:not(.narrow)) .inspector .tilegrid::after { content:none; }
        /* No lift on an open card: on one panel surface there is nothing to
           separate it from, and its rows already say it is open. */
        :host(:not(.narrow)) .inspector .card:not(.shut):not(.off),
        :host(:not(.narrow)) .inspector .tile:not(.shut) {
          background-color:transparent;
        }
        /* The grain the group used to lay over its own blur now belongs to the
           panel, or the ramp bands across it. */
        .inspector::before, .inspector::after {
          content:""; position:absolute; inset:0; border-radius:inherit;
          background-image:var(--grain); background-size:180px 180px;
          pointer-events:none; z-index:0;
        }
        .inspector::before { mix-blend-mode:overlay; opacity:var(--pane-grain, .10); }
        .inspector::after { mix-blend-mode:screen; opacity:var(--pane-grain-dark, .04); }
        .inspector > * { position:relative; z-index:1; }
        /* EVERY band, not just :last-child - a display:none sibling still counts
           for :last-child, so the two hidden bands kept a bottom margin and the
           panel grew by that much of nothing. One band is ever on screen. */
        .inspector .sheet > *:last-child { margin-bottom:0; }
        .inspector .band { margin-bottom:0; }
        /* Its head is the third of the three: the app on the left, the
           dashboard in the middle, this room's scope here. All one height. */
        .insphead {
          flex:0 0 auto; box-sizing:border-box;
          display:flex; align-items:center;
          padding:10px 10px 8px;
        }
        /* --headrow is 3px more than the toolbar's controls, which put the
           inspector's head out of step. Set locally so all three agree. */
        .insphead .navrow { margin:0; --headrow:36px; }
        /* Stacked, not side by side, once the window is too narrow to hold
           three columns. The inspector stops being chrome and becomes the last
           section of a scrolling page. */
        :host(.narrow) { --insp-w:0px; }
        :host(.narrow) .shell { display:block; height:auto; }
        :host(.narrow) .main { padding-right:0; }
        :host(.narrow) .inspector {
          position:static; width:auto; max-height:none; display:block;
          border-radius:0; clip-path:none;
          background:none; backdrop-filter:none; -webkit-backdrop-filter:none;
          box-shadow:none; padding:0;
        }
        :host(.narrow) .insphead { padding:0 18px; display:block; }
        /* Without a gap the switcher and the panel read as one control, and the
           first row looked like a fourth segment. */
        :host(.narrow) .insphead .navrow { margin-bottom:14px; }
        :host(.narrow) .sheet { padding:0 18px 18px; }
        /* Tiles keeps its caption out of the list group, so on a phone that
           header stood on nothing while the other two rode their column's glass.
           Its own surface instead. The wide inspector strips this glass, so
           there the caption is bare like the rest. */
        :host(.narrow) .tilewrap > .grouphead {
          position:relative; isolation:isolate;
          border-radius:var(--r-group);
          background-color:var(--card-tint);
          background-image:var(--pane);
          backdrop-filter:var(--g-blur); -webkit-backdrop-filter:var(--g-blur);
          box-shadow:var(--g-rim);
          clip-path:inset(0 round var(--r-group));
          margin-bottom:10px;
        }

        /* Chrome, not content: flush to the leading edge, full height, no
           radius or rim, meeting the content on a single hairline. A rounded
           floating box with a blue selected row is the geometry of an open
           pop-up button, and read as one. Same fill as the toolbar, so the two
           make one L of chrome. */
        .rail {
          flex:0 0 var(--rail-w); width:var(--rail-w); min-width:0;
          box-sizing:border-box; z-index:7;
          display:flex; flex-direction:column;
          background:rgba(22,22,28,0.42);
          backdrop-filter:var(--g-blur); -webkit-backdrop-filter:var(--g-blur);
          box-shadow:inset -1px 0 0 var(--hair);
          padding-bottom:env(safe-area-inset-bottom, 0px);
        }
        /* No rail below PANEL_NARROW: the stage stacks there, and the burger,
           the wordmark and the rooms all move back into the toolbar. */
        :host(.narrow) { --rail-w:0px; }
        :host(.narrow) .rail { display:none; }

        /* The head is the toolbar's other half, so it stands the same height:
           the same padding around the same 36px control. */
        /* Home's sidebar head holds window controls and nothing else. With no
           traffic lights, our one control sits there and the wordmark moved to
           the toolbar. */
        .railhead {
          position:relative; z-index:7;
          flex:0 0 auto; box-sizing:border-box;
          display:flex; align-items:center;
          padding:calc(15px + env(safe-area-inset-top, 0px)) 14px 13px 16px;
        }
        .railhead .burger {
          margin:0; width:36px; height:36px; flex:0 0 36px;
        }
        /* A label over the ONLY list says nothing; with two lists, each gets a
           header. */
        /* .canvas is position:relative and lays the preview out as if this were
           not here, so nothing moves when it arrives. Dismissable, since it must
           not permanently cover the thing you came to look at, and it returns
           next load while anything is unsettled. */
        /* In the flow, not floating: Apple floats what is TRANSIENT and inlines
           what PERSISTS until you act on it. Floating also covered the preview's
           nav row and media badge, which is the surface you would be checking. */
        /* [hidden] is display:none from the UA sheet and ANY author display beats
           it - this card sets display:grid, so hiding it left a blank capsule.
           No backticks in here: this stylesheet is a JS template literal. */
        .reconcile[hidden] { display:none; }
        /* Standing context for the surface being edited, at the top of the
           inspector rather than over the preview. Quiet: it is an explanation,
           not a task. */
        .surfnote {
          display:flex; align-items:center; gap:12px;
          margin:0 0 14px; padding:11px 13px;
          border-radius:12px; background:rgba(255,255,255,0.045);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);
        }
        .surfnote p {
          flex:1 1 auto; margin:0; font-size:12px; line-height:1.4;
          color:var(--ink-2);
        }
        .surfnote .ract { flex:0 0 auto; }
        .reconcile {
          box-sizing:border-box; width:min(760px, 100%);
          /* Above the control row, not between it and the preview: the controls
             describe the preview, so the two are one object and nothing should
             come between them. */
          margin:0 auto 14px; padding:14px 16px 12px 15px;
          display:grid; grid-template-columns:auto 1fr auto; column-gap:14px;
          border-radius:16px;
          background:rgba(255,255,255,0.055);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,0.10);
        }
        /* Big enough to sit beside the whole text block rather than beside the
           first line of it - it spans both rows and is optically centered on the
           heading and the sentence together. */
        .reconcile .rglyph {
          grid-column:1; grid-row:1 / span 2; align-self:center;
          width:31px; height:31px; flex:0 0 31px;
          /* Blue says "here is what this is"; orange says "this needs you".
             Two notices, two jobs, and the color is what tells them apart at a
             glance rather than the wording. */
          background-color:var(--hemma-color-blue, #0088FF);
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        .reconcile h3 {
          grid-column:2; grid-row:1;
          margin:0 0 3px; font-size:14px; font-weight:600; color:var(--ink);
          letter-spacing:-0.01em;
        }
        .reconcile p {
          grid-column:2; grid-row:2;
          margin:0; font-size:12.5px; line-height:1.4; color:var(--ink-2);
        }
        /* Top corner, the way every dismissible thing on the platform puts it.
           Centered against both rows it read as a control for the sentence next
           to it rather than for the card. */
        .reconcile .rclose {
          grid-column:3; grid-row:1; align-self:start; margin-top:-1px;
          width:24px; height:24px; padding:0; border:0; border-radius:50%;
          display:grid; place-items:center; cursor:pointer;
          background:rgba(255,255,255,0.10); color:var(--ink-2);
          transition:background-color .16s var(--ease), color .16s var(--ease);
        }
        .reconcile .rglyph.warn { background-color:var(--hemma-color-orange, #FF9230); }
        .reconcile .rclose:hover { background:rgba(255,255,255,0.20); color:var(--ink); }
        .reconcile .rclose svg { width:11px; height:11px; display:block; }
        /* Aligned with the TEXT, not with the glyph. Spanning from column one
           started the divider and the rows under the glyph while the heading
           began past it, which is what read as uncentered. */
        .reconcile .rrows { grid-column:2 / span 2; grid-row:3; margin-top:6px; }
        /* No min-height: the buttons are the tallest thing, so let them set it. */
        .reconcile .rrow {
          display:flex; align-items:center; gap:10px;
          padding:6px 0;
        }
        /* Between rows, never above the first. A grouped list separates its
           rows from each other; it does not draw a line under its header. With
           one row there is nothing to separate at all. */
        .reconcile .rrow + .rrow { border-top:1px solid rgba(255,255,255,0.09); }
        /* No rule. Apple separates SIBLING ROWS in a list - an expanded
           notification's stacked actions, a grouped table - and does not draw
           one between a card's body and a single button. The conflict notice
           has a list, so its rows keep theirs; this one has an action. */
        /* Beside the text, centered against it, the way Mail banners its one
           action. Under the text it left the card top heavy: two lines of
           content, then a gap, then a button alone on the floor. */
        .reconcile .ractions {
          grid-column:3; grid-row:1 / span 2; align-self:center;
          display:flex; align-items:center; margin-left:4px;
        }
        .reconcile .rkey {
          flex:1 1 auto; min-width:0; font-size:12.5px; color:var(--ink);
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .reconcile .rkey em { color:var(--ink-3); font-style:normal; }
        /* The same capsule .addrowbar .editbtn uses, a step down in height because
           these sit inside a card rather than on a bar. */
        .reconcile button.ract {
          flex:0 0 auto; border:0; border-radius:999px; cursor:pointer;
          height:32px; padding:0 15px; display:grid; place-items:center;
          font-family:inherit; font-size:13px; font-weight:520;
          background:rgba(255,255,255,0.13); color:var(--ink);
          transition:background-color .16s var(--ease);
        }
        .reconcile button.ract:hover { background:rgba(255,255,255,0.22); }
        .reconcile .rdone { font-size:12.5px; color:var(--ink-2); }
        /* Nothing travels on the way in - the preview below is already where it
           belongs, so a slide would move it twice. It resolves. */
        /* Holds its space and nothing else. Laying it out from the first frame
           is what keeps the preview from being shoved down a beat after it has
           already settled. */
        .reconcile.pending { opacity:0; }
        /* It resolves rather than travels, like everything else the panel
           brings in - a few pixels of settle, not a slide. */
        @keyframes hemma-orn-in {
          from { opacity:0; transform:translateY(-6px) scale(.982); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .reconcile.arriving { animation:hemma-orn-in .40s cubic-bezier(.22,.61,.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .reconcile.arriving { animation:none; }
          .reconcile.pending { opacity:1; }
        }
        .railhead2 {
          margin:0; padding:0 20px 7px;
          font-size:11.5px; font-weight:600; letter-spacing:0.04em;
          text-transform:uppercase; color:var(--ink-3);
        }
        /* A source list acts on its section from the section's own header, not
           from a chevron parked on every row. Finder, Notes and Music all put
           the control on the header; none of them repeat one per item. */
        .railgroup {
          flex:0 0 auto; display:flex; align-items:center; gap:6px;
          padding-right:10px;
        }
        /* The heading carries its own bottom padding, so centering the row
           against it still left the button high. Take the padding off the
           alignment by giving the button the same. */
        /* display:flex outranks the hidden attribute's UA display:none, so the
           group stayed on screen with its heading intact. Same trap as the
           dashboard's own hidden tiles. */
        .railgroup[hidden] { display:none; }
        .railgroup .railmore { margin-bottom:7px; }
        .railgroup .railhead2 { flex:1 1 auto; }
        /* Edit, the way a list on an Apple platform offers it: a word on the
           section header that turns the rows into something you can act on,
           rather than a control repeated on every row. */
        .railedit {
          flex:0 0 auto; padding:0 2px; border:0; border-radius:5px;
          background:transparent; color:var(--hemma-color-blue, #0088FF);
          font-family:inherit; font-size:12px; font-weight:590; cursor:pointer;
          margin-bottom:7px; transition:opacity .14s ease;
        }
        .railedit:hover { text-decoration:underline; }
        /* The minus arrives from the trailing edge and the label makes room,
           which is exactly what a tile row does when you arm it - one idiom for
           removing things, not two. */
        /* NOT scoped to .rail: #rooms moves into the top strip below
           PANEL_NARROW, and a rule left behind leaves the minus as the panel's
           default button - a blue pill eating 40px of a room pill. */
        .tab .railminus {
          flex:0 0 auto; width:0; overflow:hidden; opacity:0;
          margin-left:0; border:0; padding:0; border-radius:50%;
          background:#ff453a; color:#fff; cursor:pointer;
          display:grid; place-items:center;
          transition:width .26s var(--ease), opacity .2s var(--ease),
                     margin-left .26s var(--ease);
        }
        :host(.editing-rooms) #rooms .tab .railminus,
        :host(.editing-dashes) #dashes .tab .railminus {
          width:18px; height:18px; opacity:1; margin-left:6px;
        }
        .tab .railminus svg { width:11px; height:11px; display:block; }
        /* Selection is off while editing: a tap is for renaming, not for
           navigating somewhere you did not mean to go. */
        :host(.editing-rooms) #rooms .tab, :host(.editing-dashes) #dashes .tab {
          cursor:text;
        }
        /* Dashboards sit under the rooms, so the group needs air above it and
           the rooms above must not eat the space. */
        /* Far enough below the rooms to read as its own list rather than a
           continuation of that one. The heading's own uppercase tracking sits
           tight to whatever precedes it, so this is doing all the separating. */
        #g-dashes { margin-top:34px; }
        /* A dashboard row is a room row: same pill, same hover, same caret, so
           the sidebar reads as one list of two kinds rather than two designs. */
        #dashes .tab .roomglyph { display:none; }
        #dashes .tab .dashkind {
          flex:0 0 auto; margin-left:6px; padding:1px 6px; border-radius:999px;
          background:var(--chip); color:var(--ink-2);
          font-size:10px; font-weight:600; letter-spacing:0.03em; text-transform:uppercase;
        }
        #dashes .tab.on .dashkind { background:rgba(0,0,0,0.16); color:var(--ink); }
        /* In the toolbar strip below PANEL_NARROW there is no rail. The rooms
           move up there; the dashboards do not - a second sideways strip of
           pills beside the first reads as one list with two halves. */
        :host(.narrow) #g-rooms, :host(.narrow) #g-dashes,
        :host(.narrow) #dashes { display:none; }

        /* Sized to its CONTENT, so the Dashboards group sits directly under it
           rather than at the far end of the rail. It still scrolls, but only once
           the rooms outgrow the space. */
        .rail #rooms {
          flex:0 1 auto; min-height:0;
          display:flex; flex-direction:column;
          padding:0 10px 10px;
        }
        .rail #rooms:empty { display:none; }
        /* The list takes the slack, so the + lands on the rail's floor rather
           than trailing the last room up the column. */
        .rail #rooms .tabs {
          flex:0 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain;
          flex-direction:column; align-items:stretch; align-content:flex-start;
          gap:1px; scrollbar-width:none; -ms-overflow-style:none;
        }
        .rail #rooms .tabs::-webkit-scrollbar { width:0; height:0; display:none; }
        /* The rail's floor group, the way Finder pins a section under the one
           that scrolls. It has to STACK: .tabs is a horizontal row by default,
           which laid these out sideways along the bottom of the window. */
        .rail #g-dashes, .rail #dashes { flex:0 0 auto; }
        /* The rail ends after the two groups instead of stretching them. */
        .rail::after { content:""; flex:1 1 auto; min-height:0; }
        .rail #dashes {
          display:flex; flex-direction:column;
          padding:0 10px 12px;
        }
        .rail #dashes .tabs {
          flex:0 0 auto; flex-direction:column; align-items:stretch;
          align-content:flex-start; gap:1px;
        }
        /* A row on the sidebar's own material, not a capsule and not a chip.
           Nothing paints at rest; hover and selection are the only fills, and
           selection is a neutral lift rather than the accent - Home selects
           with a light fill, and blue on a rounded row is what a menu does. */
        .rail .tab {
          justify-content:flex-start; gap:10px;
          padding:7px 10px; border-radius:7px;
          background:none; box-shadow:none;
          font-size:13.5px; font-weight:450; color:var(--ink);
          transition:background .14s ease;
        }
        .rail .tab:hover { background:rgba(255,255,255,0.07); }
        .rail .tab.on { background:rgba(255,255,255,0.18); box-shadow:none; font-weight:530; }
        .rail .tab.on:hover { background:rgba(255,255,255,0.22); }
        .rail .tab .tablabel {
          flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis;
          white-space:nowrap;
        }
        /* One warm tint for every room, the way Home draws its room list. The
           icon says "a room", not "which room" - the label does that. */
        .rail .tab .roomglyph {
          flex:0 0 19px; width:19px; height:19px;
          /* Teal, not Home's orange: #ff9f0a is not a Hemma color at all. Teal
             is TILE_TINT, already on every tile this panel edits. */
          background-color:var(--hemma-color-teal, #00C3D0);
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        .rail .tab.on .roomglyph { background-color:#fff; }
        /* The same glyph inside the picker. Its own rule, not the rail's: the
           rail's is scoped to .rail and the menu is appended to the body. */
        .combo-opt .menuglyph {
          flex:0 0 17px; width:17px; height:17px; margin-right:8px;
          background-color:var(--hemma-color-teal, #00C3D0);
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        /* The room's own menu, revealed by the pointer that is going to use it.
           A chevron parked on the selected row is what made this read as a
           pop-up button. Right-click opens the same menu, as it does in Home. */
        /* Gone from the rail: invisible until hover yet costing 15px on every
           row, and a chevron per item is not how a sidebar offers actions. */
        .rail .tab .caret { display:none; }
        /* Its own row on the rail's floor, the way Mail parks the one control
           that adds to the list. */
        .rail .tabadd {
          flex:0 0 auto; width:auto; height:auto; margin-top:4px;
          justify-content:flex-start; gap:10px;
          padding:7px 10px; border-radius:7px;
          background:none; box-shadow:none; color:var(--ink-3);
          font-size:13.5px; font-weight:450;
        }
        .rail .tabadd:hover { background:rgba(255,255,255,0.07); color:var(--ink); filter:none; }
        .rail .tabadd svg { width:16px; height:16px; flex:0 0 16px; margin-left:2px; }
        /* The page scrolls, so nothing may be wider than it: the blurred
           photo overhangs by 280px on every side and used to drag a
           horizontal scroll along with it. */
        :host(.narrow) { width:auto; height:auto; overflow-x:clip; overflow-y:visible;
          overscroll-behavior:auto; }
        :host(.narrow) .toprow, :host(.narrow) .body { --pad:18px; }
        /* No centering margin to hang out into down here. */
        :host(.narrow) .burger { margin-left:0; margin-right:0; }
        /* Fixed, not absolute: absolute stretched the photo over the whole
           scroll height of the form, which on a phone is many screens tall,
           so it was scaled to cover a column ten times its own aspect. */
        :host(.narrow) .bg, :host(.narrow) .bgtint, :host(.narrow) .bgnoise { position:fixed; }
        :host(.narrow) .bg { width:calc(100vw + 560px); height:calc(100vh + 560px); }
        /* --top-h carries 26px the desktop columns want behind the bar. Here the
           page scrolls, so that is just a hole: take it back and add one
           --band-gap, so the first section sits like every other. */
        :host(.narrow) .body { height:auto; display:block; overflow:visible;
          padding:calc(var(--top-h) - 26px + var(--band-gap, 30px)) 18px 18px; }
        /* The band gap was holding the preview clear of the room pills. On a
           phone there is no preview any more, so it is holding nothing clear of
           anything - and the switcher sat marooned under the pills. */
        :host(.phone) .body { padding-top:calc(var(--top-h) - 26px + 12px); }
        :host(.narrow) .status { margin:10px 2px 12px; }
        /* No heading on a phone: the preview says it. Hiding it leaves one grid
           item, so the track collapses and the controls center over the card.
           :first-child still names the HIDDEN heading, hence .segrow. */
        /* The 24px lines a heading-row control up with the switches on the
           cards below. With the heading gone the row centers instead, and
           that padding just pulls it 12px off. Other bandheads keep it. */
        /* Under the preview, as its caption. Moved with order, not DOM order:
           the desktop heading row is one grid and the fit code measures it. */
        :host(.narrow) .plinth { order:1; }
        :host(.narrow) .canvashead { order:2; margin:0; }
        :host(.narrow) .canvas { padding:0; }
        :host(.narrow) .stage { flex-direction:column; gap:0; margin-left:0; }
        :host(.narrow) .canvas { width:100%; margin-bottom:22px; }
        /* The panel reaches the body gutter; the screen is inset inside it. */
        :host(.narrow) .plinth { padding:14px; }
        /* No fixed-height stage here, so the slot takes its height from the
           card rather than the other way round. */
        :host(.narrow) .mapslot { flex:0 0 auto; }
        /* The page is the scroller down here, so the column does not clip.
           It carries its own gutter now: .body used to supply one, and the
           inspector sits outside .body. */
        :host(.narrow) .sheet { overflow:visible; flex:1 1 auto; margin:0; }
        /* The bar on one line, rooms on their own under it - one row down to
           360px, with flex-wrap catching anything narrower. The controls do NOT
           join the rooms line: it scrolls sideways and they would slide under. */
        :host(.phone) .top { padding-top:max(26px, calc(15px + env(safe-area-inset-top, 0px))); }
        :host(.phone) .toprow { flex-wrap:wrap; gap:7px; row-gap:10px; }
        /* A phone reaches the sidebar by swiping in from the edge, so the
           button is 41px of header doing nothing. */
        :host(.phone) .burger { display:none; }
        :host(.phone) .ver { display:none; }
        :host(.phone) #save .s-long { display:none; }
        :host(.phone) #save .s-short { display:inline; }
        :host(.phone) #brand .s-long { display:none; }
        :host(.phone) #brand .s-short { display:inline; }
        :host(.phone) .toprow > button:not(.burger) { padding:0 11px; }
        /* A 36px circle with 3px dots is a target you have to aim at. */
        :host(.phone) .toprow > select, :host(.phone) .toprow > button:not(.burger) { height:40px; }
        :host(.phone) .toprow > button.icon { width:40px; padding:0; }
        :host(.phone) .toprow > button#more svg { width:22px; height:22px; }
        /* Ten rooms cannot wrap onto a phone header - it would be taller than
           the form. One line that scrolls sideways instead, ruled off from
           the controls above it so the two rows do not read as one pile. */
        /* Bleeds to the bar's edges so a pill scrolls flush while the row keeps
           its gutter. The border rides the scroller itself, which does not
           scroll with its content. */
        :host(.phone) .toprow #rooms {
          order:9; flex:0 0 100%; min-width:0;
          margin:1px calc(var(--pad) * -1) 0;
          padding:13px var(--pad) 2px;
          border-top:1px solid var(--hair);
          scroll-padding-left:var(--pad);
          -webkit-overflow-scrolling:touch;
        }
        :host(.phone) .toprow #rooms .tabs { margin:0; padding:0; }
        /* A drag owns touch-action, which on a scroller means the row cannot be
           swiped at all. The swipe wins; the drag handler bails out on touch to
           match. */
        :host(.phone) .toprow #rooms .tab, :host(.phone) .thead { touch-action:auto; }
        .cols { display:flex; gap:var(--gap); align-items:flex-start; }
        /* Grouped table, not a stack of cards: the card is the GROUP, divided by
           hairlines. The column carries the glass, its children only content. */
        .col, .tilegrid {
          position:relative;
          display:flex; flex-direction:column; gap:0;
          border-radius:var(--r-group);
          /* On the element itself, not a ::before: a transform on an ANCESTOR
             freezes a descendant's backdrop-filter, so the glass animated flat
             and snapped into focus at the end. */
          background-color:var(--card-tint);
          background-image:var(--pane);
          backdrop-filter:var(--g-blur); -webkit-backdrop-filter:var(--g-blur);
          box-shadow:var(--g-rim);
          /* Seals the grain's blend, the same way .bgwrap does: a mix-blend-mode
             layer composites against its stacking context, and the entrance
             animation hands out and takes back compositing layers as it runs. */
          isolation:isolate;
          /* border-radius alone does not bound a backdrop-filter - the blur
             leaks a hairline past the curve and the corner reads doubled. */
          clip-path:inset(0 round var(--r-group));
        }
        /* backdrop-filter blurs the page's dither away, so --pane's ramp bands on
           the column. Same grain, re-laid over the blur. */
        .col::before, .col::after,
        .tilegrid::before, .tilegrid::after {
          content:""; position:absolute; inset:0; border-radius:inherit;
          background-image:var(--grain); background-size:180px 180px;
          pointer-events:none;
        }
        .col::before, .tilegrid::before {
          mix-blend-mode:overlay; opacity:var(--pane-grain, .10);
        }
        .col::after, .tilegrid::after {
          mix-blend-mode:screen; opacity:var(--pane-grain-dark, .04);
        }
        .col { flex:1 1 0; min-width:0; }
        /* The glass is a LAYER, not the column: backdrop-filter on .col makes it a
           containing block for position:fixed descendants, so overflow:hidden then
           clips every combo menu opened inside a row. */
        .col > *, .tilegrid > * { position:relative; z-index:1; }
        /* Rounds the first and last rows against the group without clipping
           anything: overflow:hidden here would take the menus with it. */
        .col > *:first-child, .tilegrid > *:first-child {
          border-top-left-radius:var(--r-group); border-top-right-radius:var(--r-group);
        }
        .col > *:last-child, .tilegrid > *:last-child {
          border-bottom-left-radius:var(--r-group); border-bottom-right-radius:var(--r-group);
        }
        /* Inset to the label rather than wall to wall, which a border-top cannot
           do - so it is an overlay. It survives _shutCard's overflow:clip because
           it sits at the very top of the box being clipped. */
        .col > .grouphead + .card::before,
        .col > .card + .card::before,
        .tilegrid > * + *::before {
          content:""; position:absolute; top:0;
          left:var(--rule-inset); right:var(--card-pad-h);
          height:1px; background:rgba(255,255,255,0.14); pointer-events:none;
        }
        /* Except the FIRST: both bands open on a .grouphead, so that rule was the
           topmost line in the list - and with hints off the caption is
           display:none, leaving it hanging under the switcher. */
        .band:not(.detail) .col > .grouphead + .card::before,
        .band:not(.detail) .tilegrid > .grouphead + *::before { content:none; }
        /* With hints on, the caption ran straight into the first row and read as
           its text rather than the section's heading. Scoped to hints ON, since
           with them off the caption is display:none. On the CAPTION, not on what
           follows, so it lands the same in both band shapes. */
        :host(:not(.nohints)) .inspector .band:not(.detail) .grouphead {
          position:relative;
        }
        :host(:not(.nohints)) .inspector .band:not(.detail) .grouphead::after {
          content:""; position:absolute; pointer-events:none;
          left:var(--card-pad-h); right:var(--card-pad-h); bottom:0; height:1px;
          background:rgba(255,255,255,0.14);
        }
        /* The tiles band renders into a .col, and it brings its own group
           (.tilegrid). Without this the column painted a SECOND surface around
           it - the tiles appeared nested inside one big outer tile, with the
           picker and + sitting on its top edge. One group per band. */
        .col:has(> .tilewrap) {
          border-radius:0; background:none; box-shadow:none;
          backdrop-filter:none; -webkit-backdrop-filter:none;
        }
        .col:has(> .tilewrap)::before, .col:has(> .tilewrap)::after { content:none; }
        .col:has(> .tilewrap) > *:first-child,
        .col:has(> .tilewrap) > *:last-child { border-radius:0; }
        /* An empty column must not paint an empty slab. */
        .col:empty { display:none; }
        /* No stretching the last row: inside one surface a grouped table hugs
           its content, and a tall final row reads as a mistake rather than as
           the column filling out. */
        .col > .card:last-child { flex:0 0 auto; }
        /* ...but not when it is folded. Absorbing the column's leftover height
           made the last card in each column 412px against its siblings' 78px
           the moment everything was collapsed. */
        .col > .card:last-child.shut { flex:0 0 auto; }
        /* Cards and tiles stack in the same column, so folded they have to land
           on the same height. They do not naturally: .chead is 52px against
           .thead's 44, and the two carry different padding, which put a folded
           card at 78px and a folded tile at 60. One number for both. */
        /* A tile head carries no icon, so its hairline starts at the label -
           which here is the row inset itself. */
        .tile { --rule-inset:var(--card-pad-h); }
        .card.shut, .tile.shut { min-height:var(--shut-h); box-sizing:border-box; }
        /* A card's own padding already centers its heading in that 78px. A tile
           is 18px shorter naturally, so min-height alone left its heading stuck
           at the top with the slack below. Give the head the whole box instead:
           it already centers its own row, and the hit area grows with it. */
        /* The head is the same height in BOTH states, so the icon, name and
           summary never move when a tile opens. Folded it was centered in 78px
           and open it sat at the top of a 44px head - a 9px jump on every tap.
           The card already worked out this way; the tile did not. */
        .tile > .thead {
          margin:0 calc(var(--card-pad-h) * -1); padding:0 var(--card-pad-h);
          min-height:var(--shut-h);
        }
        .tile.shut { padding-bottom:0; }
        /* Same for a card, so the heading is the whole box when folded. That is
           what lets one hover rule mark the fold target in both states. */
        .card.shut { padding-top:0; padding-bottom:0; }
        /* align-content, not just align-items: .sicon spans two rows, so with a
           min-height the two tracks stretch to fill and the content centers in
           the upper one. Grouping the tracks puts the row back in the middle. */
        .card.shut > .chead {
          margin:0 calc(var(--card-pad-h) * -1); padding:0 var(--card-pad-h);
          min-height:var(--shut-h); align-content:center;
        }

        :host(.narrow) .cols { flex-direction:column; align-items:stretch; }

        /* Collapses with the head's own 4px, so the gap below a heading is
           --card-pad-v - the same as the gap above it. */
        .card > .chead + * { margin-top:var(--card-pad-v); }
        .card > .cdesc { font-size:12px; margin:4px 0 0; }
        .card > .cdesc.drift { color:#ffd60a; }

        .card.noheader { padding-top:28px; }
        .mapwrap {
          display:flex; flex-direction:column; align-items:center;
          gap:12px; margin:0 0 30px;
        }
        /* The CARD is capped, not the photo inside it, so there is no second card
           and no dead space. aspect-ratio with no max-height: clamping the height
           makes WebKit shrink the width to keep the ratio. */
        .card.map {
          margin:0; padding:0; overflow:hidden; flex:0 0 auto;
          /* top, not center: the card is laid out at NATURAL size and scaled, so
             a centered origin puts its painted top half the shrinkage below its
             layout box. The trade is that a size switch grows downward into the
             slack rather than opening evenly. */
          position:relative; transform-origin:top center;
          /* The photo is opaque, so the glass fill and its blur would only
             cost paint. The rim stays, to frame the tile like every other. */
          background-color:transparent; background-image:none;
          backdrop-filter:none; -webkit-backdrop-filter:none;
          /* The rim is NOT here: an inset shadow paints under the element's own
             children, and the photo inside is opaque. */
          box-shadow:0 12px 30px -12px rgba(0,0,0,0.42), 0 2px 8px rgba(0,0,0,0.18);
        }
        /* The same specular rim the tiles carry, as an overlay so it sits on
           top of the photo the way it sits on top of a tile's fill. */
        .card.map::after {
          content:""; position:absolute; inset:0; border-radius:inherit;
          pointer-events:none;
          /* THIS is the preview's rim, not the card's own box-shadow. Asymmetric:
             light comes from above, and a bright lower lip reads as a seam. */
          box-shadow:
            inset 0 1px .5px -0.5px rgba(255,255,255,0.20),
            inset 0 -1px .5px -0.5px rgba(255,255,255,0.10),
            inset 0 3px 6px -3px rgba(255,255,255,0.06),
            inset 0 -3px 6px -3px rgba(255,255,255,0.02),
            inset 0 0 0 .5px rgba(255,255,255,0.08);
        }
        :host(.narrow) .card.map::after { box-shadow:inset 0 0 0 .5px rgba(255,255,255,0.12); }
        /* Sized by the flex chain above it, never by the card inside it.
           Measuring a box that the card had just resized made every tap on
           Desktop/Tablet shrink the preview again. */
        /* Centered: the slot is pinned to the TALLER shape, so top-aligned put
           all the slack underneath and a switch read as the card growing down. */
        .mapslot {
          width:100%; flex:0 0 auto;
          display:flex; justify-content:center; align-items:flex-start;
        }
        .card.map {
          transform:scale(var(--map-scale, .5));
          transition:none;
          --pad-x:58px; --pad-t:38px; --pad-b:26px;
          --wx:20px; --nm:40px; --nav:10.5px;
          /* --nav over the theme's chrome font size (18px). */
          --menu-k:0.583;
          /* Badges: the theme's desktop values (u-badge 10px) at this card's
             960-for-1728 draw ratio, so the pill is the same shape here as
             there - 50px min-height is what gives it the bubble it has. */
          --bmh:27.8px; --bgl:16.7px; --bl:8.3px; --bv:7.8px;
          --bpt:2.2px; --bpb:2.2px; --bpr:8.3px; --bpl:5px; --bcg:2.2px; --bgap:5.6px;
          --tw:154px; --th:105px; --tc:20px; --tg:7px; --tn:12.5px; --ts:10.5px; --tt:25px;
          /* Now Playing: nav-top minus its 12px drop, the 400px tile cap, and
             hemma_now_playing_primary's own paddings and type. */
          --np-drop:0px; --np-max:222px; --np-gap:5.6px; --np-hg:5.6px; --np-lb:10px;
          --np-wg:1.7px; --np-wb:1.4px; --np-wu:5.6px;
          --np-pt:7.8px; --np-pr:8.9px; --np-pl:8.9px; --np-cg:5.6px; --np-r:14.4px;
          --np-art:52.2px; --np-ar:8.3px; --np-ti:8.3px; --np-sb:7.2px;
          /* Track and transport at the same K: real 8/4/10px and 20px between
             16/20px glyphs. */
          --np-tg:4.4px; --np-bh:2.2px; --np-rg:5.6px;
          --np-xg:11.1px; --np-gs:8.9px; --np-gp:11.1px;
          /* The 322px cap at K: about two and a half tiles. */
          --np-stack-max:178.9px;
          /* The theme blurs every ha-card by 22px, and this screen is drawn at
             960 for a 1728 window - so the honest radius here is 22 x 0.556. */
          --tbl:12px;
          --hfill:24%;
          /* The chrome row at K = 0.5556 (960 for 1728): a 34px button and an
             18px gap, top = center - half a button, 47K = 26.1. Margins do the
             lift, since .mini-nav cannot take position:relative - it is the
             offset parent for the burger and the settings disc. */
          --chrome-btn:18.9px; --chrome-btn-gap:10px;
          --chrome-top-btn:26.1px;
          --nav-lift:8.5px;
        }
        .card.map.size-tablet {
          /* The theme's own tablet numbers at this card's 700-for-1180 draw
             ratio, K = 0.5932. The 4:3 model put the preview on the theme's
             four-tile tier; the real screen is on the five-tile one. */
          --pad-x:21px; --pad-t:24.1px; --pad-b:20.4px;
          /* The theme's own tablet tokens at K: pill 46 at top 30, inset 4,
             route gap 4, label 16 in a 38-high fill. The screen honors all
             of them to within a pixel. */
          --nav-top:17.8px; --nav-h:27.3px; --nav-inset:2.4px; --nav-gap:2.4px;
          --nav-label:9.5px; --nav-label-h:22.5px; --nav-pad-x:9.5px;
          --menu-k:0.5932;
          /* chrome-side-reserve is measured from the screen edge; the pill's
             containing block already starts at the gutter, so the reserve here
             is 118 - 3vw. Taking the whole 118 clipped the last route. */
          --nav-reserve:49px; --chrome-top:26.7px; --chrome-font:10.7px;
          --wx:19.6px; --nm:43.2px;
          --bmh:23.7px; --bgl:15.4px; --bl:7.7px; --bv:7.1px;
          --bpt:4.2px; --bpb:4.7px; --bpr:8.3px; --bpl:4.2px; --bcg:2.4px; --bgap:5.9px;
          /* col-width-tablet-landscape solves to 208.9px at 1180: five across
             plus the 60px peek, not the -sm variant's four. */
          --tw:123.9px; --th:94.9px; --tc:22.5px; --tg:5.9px; --tt:22.6px;
          --tn:8.9px; --ts:7.7px;
          /* hemma_now_playing_primary's TABLET breakpoint - 78px art, 12px
             pads, 14/12 type. These had been carrying the mobile block's 108px
             art, which is what pushed the panel onto the navbar. */
          --np-drop:-24.9px; --np-max:284.7px; --np-gap:5.9px; --np-hg:5.9px;
          --np-wg:1.2px; --np-wb:1.5px; --np-wu:5.9px;
          --np-pt:7.1px; --np-pr:9.5px; --np-pl:7.1px; --np-cg:4.7px; --np-r:15.4px;
          --np-art:46.3px; --np-ar:8.9px; --np-ti:8.3px; --np-sb:7.1px;
          --np-tg:4.7px; --np-bh:2.4px; --np-rg:5.9px;
          --np-xg:11.9px; --np-gs:9.5px; --np-gp:11.9px;
          --np-stack-max:191.0px;
          /* The tablet block alone pads #np_head by 12px. 12K = 7.1. */
          --np-hp:7.1px;
          --tbl:13px;
          --hfill:23.4%;
          /* Same three at 700-for-1180; the tablet row centers on the pill:
             chrome-row-top 30 + 46/2 - 17 = 36. */
          --chrome-btn:20.2px; --chrome-btn-gap:10.7px;
          --chrome-top-btn:21.4px;
        }

        /* Tablet swaps the nav row for hemma-nav's floating pill. All three pieces
           of tablet chrome are position:fixed on the real dashboard, so here they
           leave the row's flow too and the row keeps an explicit height. */
        .size-tablet .mini-nav { position:static; height:12px; --nav-lift:0px; }
        .size-tablet .mini-tabs {
          position:absolute; top:var(--nav-top); left:50%; transform:translateX(-50%);
          flex:0 1 auto; gap:var(--nav-gap); padding:0 var(--nav-inset);
          height:var(--nav-h); border-radius:9999px; align-items:center;
          max-width:calc(100% - 2 * (var(--pad-x) + var(--nav-reserve))); overflow:hidden;
          background:var(--hemma-glass-background, rgba(255,255,255,0.115));
          backdrop-filter:blur(24px) saturate(120%);
          -webkit-backdrop-filter:blur(24px) saturate(120%);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,0.16);
        }
        /* The selected room is a filled pill inside the bar, not an underline,
           and the labels carry their own padding to make room for it. */
        .size-tablet .mini-tab {
          color:#fff; opacity:.82; font-weight:600;
          font-size:var(--nav-label); padding:0 var(--nav-pad-x);
          height:var(--nav-label-h); border-radius:9999px;
        }
        .size-tablet .mini-tab.on {
          opacity:1; font-weight:600; box-shadow:none;
          background:rgba(255,255,255,0.26);
        }
        /* The clock leads the row on the left, on the rail the hero name uses. */
        .size-tablet .mini-time {
          position:absolute; top:var(--chrome-top); left:var(--pad-x); right:auto;
          margin:0; z-index:1; font-size:var(--chrome-font);
        }

        /* Segmented control, the way macOS draws one. */
        .seg {
          position:relative;
          display:inline-flex; gap:2px; padding:2px; border-radius:999px;
          background:var(--field); box-shadow:inset 0 0 0 1px var(--field-rim);
        }
        /* One pill that travels, rather than a fill switching off one label and
           on at the other. It overshoots slightly and settles, and the width
           eases with it so it stretches into the new label. */
        .segthumb {
          position:absolute; top:2px; left:2px; width:0; height:calc(100% - 4px);
          border-radius:999px; pointer-events:none;
          transform-origin:center center;
          background:var(--chip-hi);
          box-shadow:inset 0 0 0 1px var(--chip-rim), 0 1px 3px rgba(0,0,0,0.20);
        }
        .segopt {
          position:relative; z-index:1;
          background:none; border:0; border-radius:999px; padding:6px 18px;
          color:var(--ink-2); font-size:12.5px; font-weight:560; cursor:pointer;
          transition:color .22s var(--ease);
        }
        .segopt:hover:not(.on):not(:disabled) { color:var(--ink); filter:none; }
        .segopt:active:not(:disabled) { transform:none; }
        .segopt.on { color:var(--ink); }

        /* Its own stacking context, so photo and scrim stay behind the content
           without a negative z-index. Height is explicit, not an aspect ratio:
           WebKit shrinks a ratio box's WIDTH to honor max-height. */
        .miniroom {
          position:relative; isolation:isolate; overflow:hidden;
          border-radius:inherit;
          width:100%; height:100%;
          background:#3a3a42;
        }
        .mini-photo, .mini-grain, .mini-tint, .mini-scrim { position:absolute; inset:0; }
        /* The room card's hero, value for value: blurred, then scaled past the
           edge so the blur has pixels to sample. An <img>, not a
           background-image: filter:blur() over a photo background-image does not
           render in this stack. */
        .mini-photo {
          width:100%; height:100%; object-fit:cover; display:block;
          filter:blur(4px) saturate(1.02) brightness(.985);
          transform:scale(1.08);
          transform-origin:center;
        }
        /* hemma_shared's dither: the demo renders band in the sky. Its own
           element, never .mini-photo - that layer carries the hero blur, and a
           blurred dither is not a dither. Divided back out of --map-scale, since
           a dither only works at one screen pixel. */
        /* The phone card's own units, derived from the 390pt the mobile dashboard
           is laid out against. Without them every calc resolved to nothing. */
        .card.map.size-phone {
          /* This card is laid out at 390pt, so its pixels ARE the phone's points
             and every number below is the theme's own phone tier verbatim. */
          --u:12.2px; --pad-x:16px; --pad-t:15px; --pad-b:12px;
          --ph-gap:8px;          /* smart-row's grid gap */
          --ph-th:66px;          /* --hemma-tile-row-h-mobile */
          --ph-radius:26px;      /* --hemma-tile-radius-phone */
          --ph-hero-blur:4px;    /* --hemma-mobile-hero-blur */
          --ph-overscan:12px;    /* 3 * the blur, as the shell computes it */
          --ph-circle:38px;      /* the height minus 2 * 14px of padding */
          --ph-glyph:26px;       /* --hemma-entity-icon-size-mobile */
          --ph-name:15px;        /* --hemma-entity-name-font-mobile */
          --ph-state:13px;       /* --hemma-entity-state-font-mobile */
          --ph-pad:12px;         /* --hemma-entity-inner-pad-mobile */
          --ph-badge-h:43px;     /* --badge-min-height-mobile */
          --ph-badge-i:24px;     /* --badge-icon-size-mobile */
          --ph-badge-f:13px;     /* --badge-font-size-mobile */
          --ph-title:38px;       /* hero-title-size-mobile clamps here at 390 */
          --ph-head:18px;        /* hemma_mobile_header's name font */
          /* Small phone tile: two and a bit visible across a 390pt screen. */
          --tw:113px; --th:64px; --tc:19px; --tg:8px; --tn:9.5px; --ts:8.2px; --tt:20px;
        }
        /* The phone layout. Its rooms are sections of one scrolling view under a
           single hero, so the mock stacks them the same way. */
        .miniphone {
          position:absolute; inset:0; overflow:hidden;
          border-radius:inherit; background:var(--hemma-mobile-hero-floor, #524f4d);
          /* Safari: overflow:hidden does not clip a BLURRED child. clip-path is
             the backup that holds, and it must name the radius. */
          clip-path:inset(0 round var(--r-xl));
        }
        /* hemma_mobile_bg's hero with the THEME's numbers, not the template's
           fallbacks - they differ. The overscan is the shell's rule: overhang by
           3x the blur radius or the blur samples past the edge and darkens it. */
        .miniphone .mp-photo {
          position:absolute; top:calc(var(--ph-overscan) * -1); height:calc(64% + var(--ph-overscan));
          left:calc(var(--ph-overscan) * -1); right:calc(var(--ph-overscan) * -1);
          width:calc(100% + var(--ph-overscan) * 2);
          object-fit:cover; display:block;
          filter:blur(var(--ph-hero-blur))
                 contrast(0.75)
                 saturate(0.90)
                 brightness(1.00);
        }
        .miniphone.nophoto .mp-photo { display:none; }
        /* The sampled wash the phone fills its lower screen with. Sampling the
           photo per render is what hemma-core does on the device; here the
           gradient stands in for it. */
        .miniphone .mp-wash {
          position:absolute; inset:0;
          background:linear-gradient(to bottom,
            rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.04) 16%,
            color-mix(in srgb, var(--hemma-mobile-hero-floor, #524f4d) 50%, transparent) 44%,
            var(--hemma-mobile-hero-floor, #524f4d) 72%,
            var(--hemma-mobile-hero-floor, #524f4d) 100%);
        }
        /* Nothing shrinks: the body holds more than a phone screen, and a flex
           item shrinks by default - the badge row has no text to hold it open. */
        .miniphone .mp-body > * { flex:0 0 auto; }
        .miniphone .mp-body {
          position:absolute; inset:0; z-index:2; display:flex; flex-direction:column;
          gap:14px; padding:104px var(--pad-x) var(--pad-b);
          /* The phone scrolls, so this does. It holds far more than one screen,
             and clipping it meant everything past Favorites was unreachable. */
          overflow-y:auto; overflow-x:hidden;
          overscroll-behavior:contain;
          scrollbar-width:none; -ms-overflow-style:none;
        }
        .miniphone .mp-body::-webkit-scrollbar { display:none; }
        /* The hero is painted behind a scrolling body, so it has to travel with
           it rather than staying pinned over the tiles as they pass. */
        .miniphone .mp-body > .mp-title { position:relative; z-index:1; }
        /* Title left, weather right, on one line over the photo. */
        .miniphone .mp-title {
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:calc(var(--u) * 1);
        }
        .miniphone .mp-name {
          color:#fff; font-size:var(--ph-title); font-weight:700;
          letter-spacing:-0.03em; line-height:1;
        }
        .miniphone .mp-wx {
          display:flex; align-items:center; gap:8px; flex:0 0 auto;
        }
        .miniphone .mp-weather {
          text-align:right; line-height:1.12; padding-top:calc(var(--u) * .12);
        }
        .miniphone .mp-wglyph {
          width:34px; height:34px; flex:0 0 34px; display:block;
        }
        .miniphone .mp-wtemp {
          display:block; color:#fff; font-size:17px;
          font-weight:640; letter-spacing:-0.01em;
        }
        .miniphone .mp-wcond {
          display:block; color:rgba(255,255,255,0.92);
          font-size:14px; font-weight:520; text-transform:capitalize;
        }

        /* The filter row. It draws the SHARED .pbadge now, so all this scope
           does is state the phone's own badge tokens - badge-min-height-mobile,
           badge-icon-size-mobile, badge-font-size-mobile - and the pill sizes
           itself from them exactly as the wide one does from the desktop set. */
        .miniphone .mp-badges {
          display:flex; gap:8px; flex-wrap:nowrap; align-items:center;
          /* The rail bleeds to BOTH screen edges and carries the gutter as its
             own padding, the way the device's row does. Bleeding only to the
             right clipped the first pill on the way back and left the scroll
             container short of the left edge. */
          margin-left:calc(var(--pad-x) * -1);
          margin-right:calc(var(--pad-x) * -1);
          padding-left:var(--pad-x);
          padding-right:var(--pad-x);
          overflow-x:auto; overflow-y:hidden;
          scrollbar-width:none; -ms-overflow-style:none;
        }
        .miniphone .mp-badges::-webkit-scrollbar { display:none; }
        .miniphone .mp-badges { margin-top:6px; }
        .miniphone .mp-badges .pbadge {
          --bmh:var(--ph-badge-h); --bgl:var(--ph-badge-i);
          --bl:var(--ph-badge-f); --bv:12px;
          --bpt:5px; --bpb:5px; --bpr:14px; --bpl:9px; --bcg:7px;
          flex:0 0 auto;
          /* --badge-blur. An unselected pill is translucent over the hero and
             the photo reads through it blurred; flat fill looked pasted on. */
          backdrop-filter:blur(10px) saturate(1.4);
          -webkit-backdrop-filter:blur(10px) saturate(1.4);
        }
        /* The selected filter, the way the device draws it: solid and light. */
        .miniphone .mp-badges .pbadge.open {
          backdrop-filter:none; -webkit-backdrop-filter:none;
        }

        /* The sensor chips row. Bare readings on the field rather than pills:
           the device draws them as a gauge ring beside a label and a value, with
           no capsule behind them. */
        .miniphone .mp-chips {
          display:flex; gap:16px; flex-wrap:nowrap; align-items:center;
          margin-left:calc(var(--pad-x) * -1);
          margin-right:calc(var(--pad-x) * -1);
          padding-left:var(--pad-x); padding-right:var(--pad-x);
          margin-top:10px;
          overflow-x:auto; overflow-y:hidden;
          scrollbar-width:none; -ms-overflow-style:none;
        }
        .miniphone .mp-chips::-webkit-scrollbar { display:none; }
        .miniphone .mp-chip {
          flex:0 0 auto; display:flex; align-items:center; gap:9px;
        }
        /* --hemma-gauge-size, and the row's own --hemma-badge-icon-scale. */
        .miniphone .mp-ring {
          position:relative; flex:0 0 34px; width:34px; height:34px;
          display:grid; place-items:center;
        }
        .miniphone .mp-ring svg {
          position:absolute; inset:0; width:100%; height:100%; display:block;
        }
        .miniphone .mp-cglyph {
          width:calc(34px * 0.54); height:calc(34px * 0.54);
          background-color:#fff;
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        .miniphone .mp-ctext { display:flex; flex-direction:column; line-height:1.16; }
        .miniphone .mp-clabel {
          color:#fff; font-size:15px; font-weight:640;
          letter-spacing:-0.01em; white-space:nowrap;
        }
        .miniphone .mp-cvalue {
          color:rgba(255,255,255,0.78); font-size:13px; font-weight:500;
          white-space:nowrap;
        }
        /* hemma_now_playing_primary's phone numbers, already resolved: the mock
           is 390pt wide, where --hemma-u-np sits on its 10px floor. */
        /* The device's media_row: full-width tiles that snap one at a time,
           bled to the gutters so a tile scrolls flush to the edge while the row
           keeps its inset. */
        .miniphone .mp-nprow {
          display:flex; gap:var(--ph-gap);
          overflow-x:auto; overflow-y:hidden;
          overscroll-behavior-x:contain;
          scroll-snap-type:x mandatory;
          scrollbar-width:none;
          margin:0 calc(var(--pad-x) * -1);
          padding:0 var(--pad-x);
          scroll-padding-left:var(--pad-x);
        }
        .miniphone .mp-nprow::-webkit-scrollbar { display:none; }
        .miniphone .mp-nprow > .mp-np {
          flex:0 0 100%; min-width:100%; max-width:100%;
          scroll-snap-align:start; scroll-snap-stop:always;
        }
        .miniphone .mp-np {
          display:grid; box-sizing:border-box;
          grid-template-areas:"art meta" "art ctl";
          grid-template-columns:max-content minmax(0, 1fr);
          grid-template-rows:max-content max-content;
          column-gap:14px; row-gap:7px; align-items:center;
          min-height:136px; padding:14px 16px; border-radius:26px;
          background:rgba(0,0,0,0.30);
          backdrop-filter:blur(22px) saturate(1.2);
          -webkit-backdrop-filter:blur(22px) saturate(1.2);
        }
        /* No artwork is a different fill, not a dimmer one. */
        .miniphone .mp-np.noart { background:rgba(10,12,14,0.65); }
        /* Nothing to control: the row collapses rather than leaving a gap. */
        .miniphone .mp-np.noctl { grid-template-rows:max-content 0px; row-gap:0px; }
        .miniphone .mp-npart {
          grid-area:art; align-self:center; justify-self:start;
          width:108px; height:108px; border-radius:15px;
          background:rgba(255,255,255,0.10);
          background-size:cover; background-position:center; background-repeat:no-repeat;
        }
        .miniphone .mp-nptext {
          grid-area:meta; align-self:end; min-width:0;
          display:flex; flex-direction:column; gap:1px;
        }
        .miniphone .mp-np.noctl .mp-nptext { align-self:center; }
        .miniphone .mp-nptitle {
          color:var(--primary-text-color, #fff); font-size:16px; font-weight:600;
          letter-spacing:-0.2px; line-height:1.15;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .miniphone .mp-npsub {
          color:rgba(255,255,255,0.62); font-size:14px; font-weight:400;
          letter-spacing:-0.1px; line-height:1.18;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .miniphone .mp-npbar {
          display:block; height:4px; border-radius:999px; margin-top:9px;
          background:rgba(255,255,255,0.16); overflow:hidden;
        }
        .miniphone .mp-npbar > span {
          display:block; height:100%; border-radius:inherit;
          background:var(--np-accent, var(--hemma-color-teal, #00C3D0));
        }
        .miniphone .mp-nptransport {
          grid-area:ctl; justify-self:center; align-self:center;
          display:flex; align-items:center; gap:20px;
        }
        /* Bare glyphs: the primary passes neither ring nor compact. */
        .miniphone .mp-npbtn { display:block; line-height:0; }
        .miniphone .mp-npbtn svg { display:block; width:auto; overflow:visible; }
        .miniphone .mp-npbtn path { fill:rgba(255,255,255,0.96); }
        /* One box for the whole section, so growing it moves one edge. */
        .miniphone .mp-scenegroup { display:flex; flex-direction:column; gap:14px; }
        /* The scene row: wide pills that scroll sideways, like the device's. */
        .miniphone .mp-scenes {
          display:flex; gap:var(--ph-gap); flex-wrap:nowrap; align-items:stretch;
          margin-left:calc(var(--pad-x) * -1);
          margin-right:calc(var(--pad-x) * -1);
          padding-left:var(--pad-x); padding-right:var(--pad-x);
          overflow-x:auto; overflow-y:hidden;
          scrollbar-width:none; -ms-overflow-style:none;
        }
        .miniphone .mp-scenes::-webkit-scrollbar { display:none; }
        /* hemma_scene_core's SC_C, value for value. Its backdrop is 22px, NOT
           the tile's 12px, and its rim is the glass rim rather than a hairline. */
        .miniphone .mp-scene {
          flex:0 0 auto;
          /* chip_width: min(41vw, 176px). vw here is the browser window, not the
             390pt the mock stands for, so it is resolved against that instead. */
          width:min(calc(0.41 * 390px), 176px);
          height:var(--ph-th);
          display:flex; align-items:center; gap:12px;
          padding:0 var(--ph-pad);
          border-radius:var(--ph-radius);
          background:rgba(0,0,0,0.40);
          backdrop-filter:blur(22px) saturate(1.2);
          -webkit-backdrop-filter:blur(22px) saturate(1.2);
          box-shadow:inset 0 1px 0 -0.5px rgba(255,255,255,0.10),
                     0 2px 8px rgba(0,0,0,0.10);
          color:rgba(255,255,255,0.90);
          font-size:var(--ph-name); font-weight:550;
          letter-spacing:-0.01em; white-space:nowrap;
          box-sizing:border-box;
        }
        .miniphone .mp-scene.on {
          background:rgba(255,255,255,0.94);
          color:rgba(0,0,0,0.88);
        }
        .miniphone .mp-scene .scglyph {
          width:26px; height:26px; flex:0 0 26px;
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        .miniphone .mp-scene ha-icon { --mdc-icon-size:26px; }
        /* The grid layout the row switches to: its own gaps, not the tiles'. */
        .miniphone .mp-scenes.grid {
          display:grid; grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:12px 11px; overflow:visible; margin-top:4px;
        }
        .miniphone .mp-scenes.grid .mp-scene { width:100%; }
        .miniphone .mp-head.tappable { cursor:pointer; }
        .miniphone .mp-head {
          display:flex; align-items:center; gap:4px; height:24px;
          color:#fff; font-size:var(--ph-head); font-weight:700;
          letter-spacing:-0.3px; margin-top:12px;
        }
        .miniphone .mp-chev {
          display:grid; place-items:center; color:rgba(255,255,255,0.55);
          width:calc(var(--u) * 1.1); height:calc(var(--u) * 1.1);
        }
        .miniphone .mp-chev svg { width:100%; height:100%; display:block; }

        /* TWO COLUMNS, not a scrolling row, with the icon BESIDE the text - the
           -mq arrangement hemma_entity switches to under its phone query, and
           what makes a phone tile a wide pill instead of a small square. */
        .miniphone .mp-tiles {
          display:grid; grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:var(--ph-gap); align-items:stretch;
          /* Fixed tracks, exactly as the row declares them: a large tile is two
             small ones tall and dense backfills the hole beside it. Auto rows
             let a 140px large tile stretch the small tile next to it to match,
             which is what made these look taller than the device's. */
          grid-auto-rows:var(--ph-th);
          grid-auto-flow:row dense;
        }
        .miniphone .mp-tiles .mtile {
          width:auto; height:100%;
          display:grid; grid-template-columns:auto minmax(0, 1fr);
          grid-template-areas:"i n" "i s";
          align-content:center; align-items:center;
          column-gap:10px; row-gap:0;
          padding:0 var(--ph-pad);
          /* --hemma-tile-radius-phone. NOT half the height: a full pill reads
             blobbier and taller than the card actually is. */
          border-radius:var(--ph-radius);
        }
        .miniphone .mp-tiles .mtile .mtop {
          grid-area:i; display:grid; place-items:center;
        }
        .miniphone .mp-tiles .mtile .mbot {
          grid-column:2; grid-row:1 / span 2; min-width:0;
          display:flex; flex-direction:column; justify-content:center;
        }
        .miniphone .mp-tiles .mtile.on {
          background:rgba(255,255,255,0.80);
        }
        .miniphone .mp-tiles .mtile .mname { font-size:var(--ph-name); }
        .miniphone .mp-tiles .mtile .mstate { font-size:var(--ph-state); }
        /* Set the UNIT, not the box. --tc sizes the circle, the glyph inside it
           at 0.6, and the thermostat's reading at 0.386 - overriding only the
           circle left that number sized off the desktop's 19px circle, which is
           why the temperature came out about 7px tall. */
        .miniphone .mp-tiles .mtile { --tc:var(--ph-circle); }
        /* The theme states the phone glyph outright rather than deriving it. */
        .miniphone .mp-tiles .mtile .mglyph { width:var(--ph-glyph); height:var(--ph-glyph); }
        /* The toggle and the action rail belong to the wide tile; the phone
           pill has no room for them and does not draw them. */
        .miniphone .mp-tiles .mtile .mtgl, .miniphone .mp-tiles .mtile .mact,
        .miniphone .mp-tiles .mtile .mprog { display:none; }
        /* Large is the STACKED tile, not a wider one. hemma_entity keeps its -lg
           set at "i" / "n" / "s" while the phone media query flips the small -mq
           set to "i n" / "i s" - so on a phone the two sizes differ in ARRANGEMENT
           and height, and both still sit one per column. */
        .miniphone .mp-tiles .mtile.mp-lg {
          grid-template-columns:minmax(0, 1fr);
          grid-template-areas:"i" "n" "s";
          align-content:space-between; align-items:start;
          grid-row:span 2; height:100%;
          padding:var(--ph-pad);
          border-radius:var(--ph-radius);
        }
        .miniphone .mp-tiles .mtile.mp-lg .mtop { grid-area:i; justify-items:start; }
        .miniphone .mp-tiles .mtile.mp-lg .mbot { grid-column:1; grid-row:2 / span 2; }
        /* The popup back button, at filter-overlay's own proportions. */
        .miniphone .mp-back {
          /* Sits above the title with a little air. The mock has no status bar
             to inset against, so this is measured off the title rather than
             off env(safe-area-inset-top) + 4px the way the device does it. */
          position:absolute; left:var(--pad-x); top:48px; z-index:9;
          width:40px; height:40px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          background-color:rgba(255,255,255,0.07);
          background-image:radial-gradient(140% 90% at 50% -20%,
            rgba(255,255,255,0.14), rgba(255,255,255,0.04) 45%, transparent 62%);
          cursor:pointer; transition:transform 0.15s ease;
        }
        .miniphone .mp-back svg { margin-right:2px; display:block; }
        .miniphone .mp-back:active { transform:scale(0.94); }
        /* The rim: bright at the top and bottom, gone at the sides. */
        .miniphone .mp-back::before {
          content:""; position:absolute; inset:0; border-radius:50%; padding:1.4px;
          background:conic-gradient(from 0deg,
            rgba(255,255,255,0.55) 0deg, rgba(255,255,255,0.12) 55deg,
            rgba(255,255,255,0.02) 90deg, rgba(255,255,255,0.12) 130deg,
            rgba(255,255,255,0.30) 175deg 185deg, rgba(255,255,255,0.12) 230deg,
            rgba(255,255,255,0.02) 270deg, rgba(255,255,255,0.12) 305deg,
            rgba(255,255,255,0.55) 360deg);
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite:xor;
          mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite:exclude; pointer-events:none;
        }
        /* And the side wraps: a crisp dark hairline, not a soft band. */
        .miniphone .mp-back::after {
          content:""; position:absolute; inset:-1px; border-radius:50%; padding:1px;
          background:conic-gradient(from 0deg,
            transparent 0deg 50deg, rgba(0,0,0,0.32) 80deg 100deg,
            transparent 130deg 230deg, rgba(0,0,0,0.32) 260deg 280deg,
            transparent 310deg 360deg);
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite:xor;
          mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite:exclude; pointer-events:none;
        }
        /* The popup's 22% black. The blur that goes with it is a filter on the
           content, not a backdrop-filter here - see _playPhoneFilterIn. */
        .miniphone .mp-scrim {
          position:absolute; inset:0; z-index:5; pointer-events:none;
          background:rgba(0,0,0,0.22);
        }
        /* Held for as long as a filter is open, not played once. Its 22% black
           over the hero, and the hero itself taken to the popup's own 40px. */
        .miniphone .mp-veil {
          position:absolute; inset:0; z-index:1; pointer-events:none;
          background:rgba(0,0,0,0);
          transition:background 0.30s ease;
        }
        .miniphone.filtered .mp-veil { background:rgba(0,0,0,0.22); }
        /* The overscan grows with the radius: a blur samples past its own box, so
           it must overhang by ~3x the radius or the edges go dark. The photo is
           object-fit:cover, so widening it only crops more of the same shot. */
        .miniphone.filtered { --ph-overscan:120px; }
        .miniphone.filtered .mp-photo {
          filter:blur(40px) contrast(0.75) saturate(0.90) brightness(1.00);
        }
        .miniphone .mp-photo { transition:filter 0.30s ease; }
        /* The collapsing header. A 44px bar (DASH_BAR_HEIGHT) whose blur is
           masked to a hard stop at 52px, with the hairline just under it - the
           same three layers filter-overlay builds, at the same numbers. */
        .miniphone .mp-bar {
          position:absolute; top:0; left:0; right:0; height:150px;
          z-index:6; pointer-events:none; opacity:0;
          backdrop-filter:blur(22px) saturate(1.2) brightness(0.97);
          -webkit-backdrop-filter:blur(22px) saturate(1.2) brightness(0.97);
          -webkit-mask-image:linear-gradient(to bottom, #000 0px, #000 52px, transparent 52px);
          mask-image:linear-gradient(to bottom, #000 0px, #000 52px, transparent 52px);
          transform:translateZ(0);
        }
        .miniphone .mp-baredge {
          position:absolute; left:0; right:0; top:51px; height:11px;
          z-index:7; pointer-events:none; opacity:0;
          background:linear-gradient(to bottom, rgba(18,20,26,0.025), rgba(18,20,26,0));
          border-top:0.5px solid rgba(255,255,255,0.10);
          box-sizing:border-box;
        }
        .miniphone .mp-bartitle {
          position:absolute; left:var(--pad-x); top:0; height:44px;
          z-index:8; display:flex; align-items:center;
          font-size:20px; font-weight:700; color:#fff; letter-spacing:-0.3px;
          opacity:0; transform:translateY(5px); pointer-events:none;
        }
        .miniphone.nophone::after {
          content:"No phone layout to preview";
          position:absolute; inset:0; display:grid; place-items:center;
          color:rgba(255,255,255,0.55); font-size:13px;
        }
        .mini-grain {
          pointer-events:none;
          background-image:var(--grain);
          /* applySize rounds this to whole pixels; see the note there. The
             calc() is only the frame before the first measurement. */
          background-size:
            var(--grain-px, calc(180px / var(--map-scale, 1)))
            var(--grain-px, calc(180px / var(--map-scale, 1)));
          mix-blend-mode:overlay;
          opacity:var(--hemma-bg-grain, 0.16);
        }
        .mini-tint { background:var(--hero-tint, rgba(55,55,55,0.50)); }
        /* Only enough to keep the name and the tile row legible over the photo. */
        .mini-scrim {
          background:linear-gradient(to bottom,
            rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.20) 74%, rgba(0,0,0,0.40) 100%);
        }
        .miniroom.nophoto .mini-photo { display:none; }
        .miniroom.nophoto .mini-tint { background:linear-gradient(140deg, #6f8bb5, #c99a6f); }
        .mini-body {
          position:relative; height:100%; box-sizing:border-box;
          padding:var(--pad-t) var(--pad-x) var(--pad-b);
          display:flex; flex-direction:column; gap:11px;
        }
        /* Fixed above the room name, so the header sits in one place whatever
           happens below. Only the lower spacer flexes, so extra rows and missing
           tiles both resolve downward. */
        .mini-fill { flex:0 0 var(--hfill); min-height:8px; }
        .mini-fill.lower { flex:1 1 auto; min-height:0; }

        .mini-nav {
          margin-top:calc(0px - var(--nav-lift, 0px));
          margin-bottom:var(--nav-lift, 0px);
          display:flex; align-items:baseline; gap:12px;
          font-size:var(--nav); color:rgba(255,255,255,0.92); padding:0;
        }
        .mini-time { flex:0 0 auto; font-weight:530; }
        .mini-tabs { flex:1 1 auto; display:flex; gap:13px; justify-content:center; overflow:hidden; }
        .mini-tab {
          color:rgba(255,255,255,0.66); white-space:nowrap;
          padding-bottom:4px; display:inline-flex; align-items:center; gap:3px;
        }
        .mini-tab.on { color:#fff; font-weight:590; box-shadow:inset 0 -1.5px 0 #fff; }
        .mini-tab:not(.on) { cursor:pointer; transition:color .16s ease; }
        .mini-tab:not(.on):hover { color:#fff; }
        /* hemma-nav's real menu at this card's draw ratio: 6px padding, a 26px
           outer radius against 20px rows so the corners nest. K is --nav over the
           theme's chrome font; the tablet block carries its own. */
        .mini-scenemenu {
          position:absolute; z-index:8; box-sizing:border-box;
          padding:calc(6px * var(--menu-k)); border-radius:calc(26px * var(--menu-k));
          display:flex; flex-direction:column; align-items:stretch;
          row-gap:calc(2px * var(--menu-k));
          width:max-content; max-width:calc(100% - 16px);
          max-height:calc(100% - 90px); overflow-y:auto; scrollbar-width:none;
          background:var(--hemma-glass-background, rgba(255,255,255,0.10));
          backdrop-filter:var(--hemma-glass-backdrop, blur(24px) saturate(180%));
          -webkit-backdrop-filter:var(--hemma-glass-backdrop, blur(24px) saturate(180%));
          box-shadow:var(--hemma-glass-rim, inset 0 1px .5px -0.5px rgba(255,255,255,0.55)),
                     0 calc(12px * var(--menu-k)) calc(34px * var(--menu-k)) rgba(0,0,0,0.26);
          opacity:0; transform:scale(.96); transform-origin:top center;
          transition:opacity .14s ease, transform .16s cubic-bezier(.2,.9,.3,1);
        }
        .mini-scenemenu::-webkit-scrollbar { width:0; height:0; }
        .mini-scenemenu.in { opacity:1; transform:scale(1); }
        .mini-scenerow {
          display:grid; align-items:center; justify-items:start; width:100%;
          grid-template-columns:calc(20px * var(--menu-k)) 1fr;
          column-gap:calc(15px * var(--menu-k));
          min-height:calc(46px * var(--menu-k));
          padding:0 calc(16px * var(--menu-k)) 0 calc(13px * var(--menu-k));
          border-radius:calc(20px * var(--menu-k));
          font-size:calc(15px * var(--menu-k));
          font-weight:400; color:#fff; opacity:.86;
          box-sizing:border-box; text-align:left;
        }
        .mini-scenerow ha-icon {
          width:calc(20px * var(--menu-k)); height:calc(20px * var(--menu-k));
          /* A custom property, so it has to be CSS - Object.assign cannot set
             one, which is how the real menu's icon ended up at its 24px
             default once before. */
          --mdc-icon-size:calc(18px * var(--menu-k));
          color:currentColor; place-self:center;
          display:flex; align-items:center; justify-content:center;
        }
        .mini-scenerow span {
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;
        }
        .mini-sceneempty {
          min-height:calc(46px * var(--menu-k)); display:flex; align-items:center;
          padding:0 calc(16px * var(--menu-k));
          font-size:calc(15px * var(--menu-k));
          color:#fff; opacity:.6; white-space:nowrap;
        }
        .mini-tab.scenes { cursor:pointer; }
        .mini-tab.scenes::after {
          content:""; width:.5em; height:.5em; margin-left:1px;
          border:solid currentColor; border-width:0 1.2px 1.2px 0;
          transform:rotate(-45deg) translate(-.06em, -.06em);
        }
        /* position:fixed on the dashboard, so absolute here rather than a row in
           the column. Every number is hemma_now_playing's at this card's draw
           ratio. */
        .mz-np {
          position:absolute; top:var(--chrome-top-btn); right:var(--pad-x);
          z-index:3; max-width:var(--np-max);
          display:flex; flex-direction:column; align-items:flex-end; gap:var(--np-gap);
          /* Capped and scrolling, as the panel is. */
          max-height:var(--np-stack-max);
          overflow-y:auto; overflow-x:hidden;
          scrollbar-width:none;
        }
        .mz-np::-webkit-scrollbar { display:none; }
        /* Chrome, not a tile: it stays put while the stack moves. */
        .mini-nphead { position:sticky; top:0; z-index:1; }
        .mini-nphead {
          display:flex; align-items:center; justify-content:flex-end;
          /* Tablet only: the nav is a floating pill there. */
          padding-bottom:var(--np-hp, 0px);
        }
        /* The two chrome buttons the dashboard draws in that corner: identical
           flat discs, the waveform rightmost with the settings ellipsis beside
           it. --chrome-btn is the real 34px at this card's draw ratio. */
        .mini-wave, .mini-settings {
          flex:0 0 auto; box-sizing:border-box;
          width:var(--chrome-btn); height:var(--chrome-btn); border-radius:50%;
          background:rgba(255,255,255,0.22);
          display:inline-flex; align-items:center; justify-content:center;
        }
        /* Inverted only while the panel is up - the same thing the real
           button does, and the head is a toggle here too. */
        .mini-wave { gap:var(--np-wg); }
        .mini-wave.on { background:#fff; }
        .mini-settings {
          position:absolute; top:var(--chrome-top-btn); z-index:2;
          right:calc(var(--pad-x) + var(--chrome-btn) + var(--chrome-btn-gap));
          gap:calc(var(--chrome-btn) * 0.13);
        }
        .mini-settings i {
          width:calc(var(--chrome-btn) * 0.1); height:calc(var(--chrome-btn) * 0.1);
          border-radius:50%; background:#fff;
        }
        .mini-wave i {
          width:var(--np-wb); border-radius:1px; transform-origin:center;
          background:rgba(255,255,255,0.90);
          animation:miniwave 1.53s ease-in-out infinite;
        }
        .mini-wave i:nth-child(1) { height:calc(var(--np-wu) * 0.8); animation-duration:1.19s;  animation-delay:.05s; }
        .mini-wave i:nth-child(2) { height:calc(var(--np-wu) * 1.3); animation-duration:1.615s; animation-delay:.15s; }
        .mini-wave i:nth-child(3) { height:calc(var(--np-wu) * 1.7); animation-duration:1.02s;  animation-delay:0s; }
        .mini-wave i:nth-child(4) { height:calc(var(--np-wu) * 1.2); animation-duration:1.785s; animation-delay:.2s; }
        .mini-wave i:nth-child(5) { height:calc(var(--np-wu) * 0.8); animation-duration:1.36s;  animation-delay:.1s; }
        .mini-wave.on i { background:#1c1c20; }
        @keyframes miniwave { 0%, 100% { transform:scaleY(.42); } 50% { transform:scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .mini-wave i { animation:none; } }
        /* The card's grid: "art meta" over "art ctl", art spanning both. */
        .mini-nptile {
          width:100%; box-sizing:border-box;
          display:grid; grid-template-areas:"art meta" "art ctl";
          grid-template-columns:max-content minmax(0, 1fr);
          grid-template-rows:max-content max-content;
          column-gap:var(--np-cg); row-gap:var(--np-rg); align-items:center;
          padding:var(--np-pt) var(--np-pr) var(--np-pt) var(--np-pl);
          border-radius:var(--np-r);
          background:rgba(0,0,0,0.40);
          backdrop-filter:blur(var(--tbl, 12px)) saturate(1.2);
          -webkit-backdrop-filter:blur(var(--tbl, 12px)) saturate(1.2);
          box-shadow:inset 0 0 0 .5px rgba(255,255,255,0.12);
        }
        /* Nothing to press, so the second track collapses. */
        .mini-nptile.noctl {
          grid-template-rows:max-content 0px; row-gap:0px;
        }
        .mini-npart {
          grid-area:art; align-self:center; justify-self:start;
          width:var(--np-art); height:var(--np-art); border-radius:var(--np-ar);
          background-size:cover; background-position:center; background-repeat:no-repeat;
          box-shadow:inset 0 0 0 .5px rgba(255,255,255,0.16);
        }
        /* Only the placeholder gets the sheen; over artwork it is a haze. */
        .mini-npart:not(.art) {
          background-image:linear-gradient(135deg,
            rgba(255,255,255,0.30), rgba(255,255,255,0.12));
        }
        .mini-nptext {
          grid-area:meta; align-self:end; min-width:0;
          display:flex; flex-direction:column; gap:2px;
        }
        .mini-nptile.noctl .mini-nptext { align-self:center; }
        .mini-npbar {
          display:block; height:var(--np-bh); border-radius:999px;
          margin-top:var(--np-tg);
          background:rgba(255,255,255,0.16); overflow:hidden;
        }
        .mini-npbar > span {
          display:block; height:100%; border-radius:inherit;
          background:var(--np-accent, var(--hemma-color-teal, #00C3D0));
        }
        .mini-npctl {
          grid-area:ctl; justify-self:center; align-self:center;
          display:flex; align-items:center; gap:var(--np-xg);
        }
        .mini-npctl span { display:block; line-height:0; }
        .mini-npctl svg { display:block; width:auto; overflow:visible; }
        .mini-npctl path { fill:rgba(255,255,255,0.96); }
        .mini-nptitle {
          color:#fff; font-size:var(--np-ti); font-weight:600; letter-spacing:-0.11px;
          line-height:1.15; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .mini-npsub {
          color:rgba(255,255,255,0.62); font-size:var(--np-sb); font-weight:400;
          letter-spacing:-0.06px; line-height:1.18;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }

        /* Hover zones stand in for the old legend: the preview is the map. */
        .mz { cursor:pointer; }
        /* The tile row runs to the frame edge and scrolls past it, the way the
           real row does; the body's own padding is canceled and re-applied
           inside so the first tile still lines up with the name above it. */
        .mz-tiles { margin:0 calc(var(--pad-x) * -1); }
        /* Longhands, not the shorthand: this rule outranks .mini-tiles, and the
           shorthand reset the vertical padding holding the clip box open while
           leaving the negative margin behind. */
        .mz-tiles .mini-tiles {
          padding-left:var(--pad-x); padding-right:var(--pad-x);
        }

        .mini-weather {
          display:flex; align-items:center; gap:5px;
          color:#fff; font-size:var(--wx); font-weight:590; letter-spacing:-0.01em;
          text-shadow:0 1px 6px rgba(0,0,0,0.34);
        }
        /* Height only, width auto - these files run from square to wide, and a
           fixed-width box clipped the wide ones. object-fit and the 0.92 are
           what hemma_weather.yaml gives its own <img>. */
        .mini-wglyph {
          height:calc(var(--wx) * 0.85); width:auto; display:block;
          object-fit:contain; opacity:.92;
        }
        .mini-name {
          color:#fff; font-size:var(--nm); font-weight:640; letter-spacing:-0.022em;
          line-height:1.08; margin-top:1px; text-shadow:0 1px 10px rgba(0,0,0,0.36);
        }
        .mini-badges, .mini-subs, .mini-tiles {
          display:flex; flex-wrap:wrap; gap:var(--bgap); align-items:center;
        }
        .mini-tiles {
          gap:var(--tg); flex-wrap:nowrap; align-items:flex-end;
          overflow-x:auto; overflow-y:clip; -webkit-overflow-scrolling:touch;
          overscroll-behavior-x:contain;
          scrollbar-width:none; -ms-overflow-style:none;
          /* A sideways scroller computes overflow-y to clip, so a tile that grows
             on hover is cut by exactly what it grew. Padding opens the clip box,
             the negative margin gives the space back. */
          padding-top:8px; padding-bottom:8px;
          margin-top:-8px; margin-bottom:-8px;
        }
        .mini-tiles::-webkit-scrollbar { display:none; }
        /* overflow:visible cannot win here - a horizontal scroller computes
           overflow-y to clip. Grow the clip box instead: padding opens it, the
           negative margin keeps the row put, and scrollLeft never moves. */
        .mini-tiles.mfree {
          padding-top:44px; padding-bottom:44px;
          margin-top:-44px; margin-bottom:-44px;
        }
        .mini-subs {
          padding:0 0 0 1px; min-height:var(--bmh); align-content:flex-start;
          opacity:0; pointer-events:none;
        }
        .mini-subs.on { opacity:1; pointer-events:auto; }
        .mini-none { color:rgba(255,255,255,0.55); font-size:11.5px; }
        /* A new Keynote slide is placeholders you click to replace, not blank
           text. Ghosts make the canvas pointable from the first second and show
           what a room can hold. Invitations, never breakage: dashed, dimmed, and
           carrying no invented reading. */
        .pbadge.ghost, .mtile.ghost {
          background:rgba(255,255,255,0.05); box-shadow:none;
          border:1px dashed rgba(255,255,255,0.30);
        }
        .pbadge.ghost { padding:calc(var(--bpt) - 1px) calc(var(--bpr) - 1px)
          calc(var(--bpb) - 1px) calc(var(--bpl) - 1px); }
        .pbadge.ghost .pglyph { opacity:.38; }
        .pbadge.ghost .plabel { color:rgba(255,255,255,0.62); font-weight:500; }
        .pbadge.ghost:hover, .mtile.ghost:hover {
          border-color:rgba(255,255,255,0.62); background:rgba(255,255,255,0.10);
        }
        .mtile.ghost {
          align-items:center; justify-content:center; gap:4px; cursor:pointer;
          color:rgba(255,255,255,0.55);
        }
        .mtile.ghost.faint { opacity:.45; }
        .mtile.ghost .gplus { font-size:calc(var(--tn) * 1.4); line-height:1; font-weight:300; }
        .mtile.ghost .gcap { font-size:var(--ts); }

        /* Stand-ins for the real badges: label over value, tinted glyph. */
        .pbadge {
          display:inline-flex; align-items:center; gap:var(--bcg); max-width:100%;
          min-height:var(--bmh);
          padding:var(--bpt) var(--bpr) var(--bpb) var(--bpl);
          border-radius:9999px; box-sizing:border-box;
          background:rgba(28,28,32,0.66); border:0; cursor:pointer;
          box-shadow:inset 0 0 0 .5px rgba(255,255,255,0.14);
          font-family:inherit; text-align:left;
          transition:background .2s var(--ease), box-shadow .2s var(--ease);
        }
        .pbadge:not(.sub):hover:not(:disabled) { background:rgba(28,28,32,0.86); filter:none; }
        .pbadge:active:not(:disabled) { transform:none; }
        .pbadge.open, .pbadge.open:hover:not(:disabled) {
          background:rgba(255,255,255,0.96);
          box-shadow:inset 0 0 0 .5px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.26);
        }
        .pbadge.open .plabel, .pbadge.open .ptext { color:#1d1d1f; }
        /* A pill never dims on the dashboard - an off Lights badge is the same
           surface as an on one, and only its reading changes. Sub badges tint
           their glyph instead, the way hemma_badge_light does. */
        .pbadge.sub.dim .pglyph { background-color:rgba(255,255,255,0.42); }
        .pbadge.clip { min-width:0; }
        .pcol { display:flex; flex-direction:column; min-width:0; }
        .plabel { color:#fff; font-size:var(--bl); font-weight:700; line-height:1.2;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ptext { color:rgba(255,255,255,0.82); font-size:var(--bv); font-weight:500; line-height:1.2;
          font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pglyph {
          width:calc(var(--bgl) * 1.2); height:var(--bgl);
          flex:0 0 calc(var(--bgl) * 1.2); background-color:var(--sc, #fff);
          -webkit-mask:var(--i) center / auto var(--bgl) no-repeat;
          mask:var(--i) center / auto var(--bgl) no-repeat;
        }
        .pbadge.sub { cursor:default; background:rgba(28,28,32,0.72); }
        .ppic {
          width:var(--bgl); height:var(--bgl); flex:0 0 var(--bgl);
          border-radius:50%; object-fit:cover; display:block;
        }
        /* Cover art, not a face: the dashboard's media badge squares it off. */
        .ppic.art { border-radius:24%; }

        /* Tiles: tinted icon circle above a name and its state, light when on. */
        .mtile {
          display:flex; flex-direction:column; justify-content:space-between;
          flex:0 0 auto; width:var(--tw); height:var(--th); box-sizing:border-box;
          padding:calc(var(--th) * 0.10) calc(var(--tw) * 0.075);
          border-radius:calc(var(--th) * 0.16);
          /* hemma-entity-background, copied rather than read: every other
             color in this preview is a literal, so one theme lookup would be
             the only thing that moved under a different theme. */
          background:rgba(0,0,0,0.40);
          backdrop-filter:blur(var(--tbl, 12px)) saturate(1.2);
          -webkit-backdrop-filter:blur(var(--tbl, 12px)) saturate(1.2);
          box-shadow:inset 0 0 0 .5px rgba(255,255,255,0.12);
        }
        .mtile.on { background:rgba(248,248,250,0.94); box-shadow:inset 0 0 0 .5px rgba(0,0,0,0.06); }
        /* Set to show only while it is active, and not active: on the dashboard
           this slot is closed. Faded rather than gone, because the preview is
           also how you select the thing. */
        .mtile.away { opacity:.42; }
        .mtile.away.linked, .mtile.away:hover { opacity:.72; }
        .mtile { cursor:grab; touch-action:pan-y; }
        /* Nothing to drag against inside one tile, so it must not offer to. */
        .band.detail .tile > .thead { cursor:default; }
        /* The icon, the name and the line about it live at the top of the pane
           now, so the card does not say them again. */
        .band.detail .card.sel > .chead,
        .band.detail .tile.sel > .thead { display:none; }
        /* .chead carried the card's top padding; without it the first row sat
           against the edge. */
        .band.detail .card.sel { padding-top:var(--card-pad-v); }
        .band.detail .tile.sel { padding-top:var(--card-pad-v); }
        .band.detail .tile > .thead .rmbtn,
        .band.detail .tile > .thead .grip { display:none; }
        .mtile.mdrag {
          cursor:grabbing; z-index:4; position:relative;
          box-shadow:0 10px 26px rgba(0,0,0,0.42), inset 0 0 0 .5px rgba(255,255,255,0.18);
        }
        .mtop { display:flex; align-items:center; justify-content:space-between; }
        .mcircle {
          width:var(--tc); height:var(--tc); border-radius:50%; display:grid; place-items:center;
          background:var(--sc, #00C3D0);
        }
        /* hemma_entity tints the circle ONLY in its active state block; inactive
           falls back to rgba(0,0,0,0.20). background-color, not the shorthand,
           or it wipes the media artwork set inline. */
        .mtile:not(.on) .mcircle { background-color:rgba(0,0,0,0.20); }
        /* Holding real cover art, so it drops the tint and squares off to
           match the media badge rather than cropping a poster into a circle. */
        .mcircle.art {
          background-color:rgba(255,255,255,0.10);
          background-size:cover; background-position:center; background-repeat:no-repeat;
          border-radius:24%;
        }
        /* hemma_presence's own icon-circle-bg: darker than a light tile, lighter
           than a dark one, so it reads as a recess either way. */
        .mcircle.art.face {
          border-radius:50%;
          background-color:rgba(255,255,255,0.12);
        }
        .mtile.on .mcircle.art.face { background-color:rgba(0,0,0,0.14); }
        /* hemma_entity fits the glyph in a SQUARE 60% of the circle with
           mask-size:contain. Sizing by height alone overflows anything wide. */
        .mglyph {
          width:calc(var(--tc) * 0.6); height:calc(var(--tc) * 0.6);
          background-color:var(--ic, #fff);
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        /* hemma_fan's own 0.9s linear spin. */
        .mglyph.spin { animation:hemma-mini-fan-spin 0.9s linear infinite; }
        @keyframes hemma-mini-fan-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .mglyph.spin { animation:none; } }
        /* hemma_thermostat fills the circle with the reading instead of an
           icon, so the preview does too. */
        .mnum {
          color:rgba(255,255,255,0.9); font-weight:800; line-height:1;
          font-size:calc(var(--tc) * 0.386); letter-spacing:-0.02em;
        }
        /* The switch hemma_entity puts in the tile's top corner: a 46x26 track,
           and when it is on the thumb is a hole punched out of the fill. */
        /* The card's own proportions: a 56px rail inset 22px in a ~210px tile.
           Absolute, with the tile making room by padding rather than reflow. */
        .mrail {
          position:absolute; z-index:2;
          top:calc(var(--th) * 0.09); bottom:calc(var(--th) * 0.09);
          right:calc(var(--tw) * 0.055); width:calc(var(--tw) * 0.24);
          display:flex; flex-direction:column; gap:calc(var(--th) * 0.035);
        }
        .mtile.hasrail { position:relative; }
        .mtile.hasrail .mbot, .mtile.hasrail .mtop {
          padding-right:calc(var(--tw) * 0.30);
        }
        .mact {
          flex:1 1 0; min-height:0; border-radius:calc(var(--th) * 0.10);
          display:grid; place-items:center;
          background:var(--ac); color:#fff;
        }
        /* Off, it is the same neutral the tile's own circle takes; unavailable
           or missing, it dims rather than disappearing - the card says the
           button is configured but has nothing to act on. */
        .mact:not(.hot) { background:rgba(255,255,255,0.16); color:#fff; }
        /* A lit tile is white, and a white chip holding a white glyph is not a
           chip - so both ends darken. */
        .mtile.on .mact:not(.hot) { background:rgba(0,0,0,0.14); color:rgba(0,0,0,0.88); }
        .mact.dim { opacity:.45; }
        .mact ha-icon {
          --mdc-icon-size:calc(var(--th) * 0.13);
          width:calc(var(--th) * 0.13); height:calc(var(--th) * 0.13); display:block;
        }
        .mactglyph {
          width:calc(var(--th) * 0.13); height:calc(var(--th) * 0.13); display:block;
          background-color:currentColor;
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        /* --hemma-progress-size-mq: the icon circle times 0.9, standing where
           the toggle would. */
        .mprog { width:calc(var(--tc) * 0.9); height:calc(var(--tc) * 0.9); flex:0 0 auto; }
        .mprog svg { display:block; width:100%; height:100%; overflow:visible; }
        .mprog .pt { stroke:var(--hemma-progress-track-color, rgba(0,0,0,0.12)); }
        .mprog .pa {
          stroke:var(--hemma-progress-arc-color,
            var(--hemma-progress-color, var(--hemma-color-teal, #00c3d0)));
          transition:stroke-dashoffset 0.8s linear;
        }
        .mprog .pg {
          fill:var(--hemma-progress-arc-color,
            var(--hemma-progress-color, var(--hemma-color-teal, #00c3d0)));
          stroke:var(--hemma-progress-arc-color,
            var(--hemma-progress-color, var(--hemma-color-teal, #00c3d0)));
        }
        .mtgl { width:var(--tt); height:calc(var(--tt) * 26 / 46); flex:0 0 auto; opacity:.85; }
        .mtile.on .mtgl { opacity:.80; }
        .mtgl svg { display:block; width:100%; height:100%; }
        .mbot { display:flex; flex-direction:column; gap:1px; min-width:0; }
        .mname {
          color:#fff; font-size:var(--tn); font-weight:550; letter-spacing:-0.01em;
          line-height:1.15;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        /* button-card renders #state inside its own .ellipsis class, which is
           why hemma_entity declares no nowrap of its own. */
        .mstate {
          color:rgba(255,255,255,0.62); font-size:var(--ts);
          font-weight:400; letter-spacing:-0.006em; line-height:1.15;
          text-transform:capitalize;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .mtile.on .mname { color:#1d1d1f; }
        .mtile.on .mstate { color:rgba(0,0,0,0.55); }

        /* A row inside the group: no surface of its own. The tint stays so an
           open row can lift slightly off the group, and it still transitions. */
        .card {
          width:100%; box-sizing:border-box;
          background-color:transparent;
          border-radius:0; padding:6px var(--card-pad-h) var(--card-pad-v);
          transition:background-color .3s var(--ease);
        }
        .card:not(.shut):not(.off) { background-color:rgba(255,255,255,0.04); }
        /* .plinth is the surface now, so this keeps only its corners. The blur
           was paid for and never seen - the photo over it is opaque - and a
           backdrop-filter under a transform re-samples every frame. */
        .card.map { border-radius:var(--r-xl); }
        /* Same as .thead: margin above a heading is not clickable, so it becomes
           padding ON the heading and the whole strip is the fold target. */
        /* The icon track is the icon, not a 34px slot with it floating inside:
           iOS gives the chip its own width and then 12pt of air before the
           label. Measured there, chip 29 and label at 51 from the group edge;
           here 30 and 58. */
        .card > .chead {
          display:grid;
          grid-template-columns:var(--sicon) 1fr auto auto auto auto; column-gap:12px;
          align-items:center;
          margin:-6px calc(var(--card-pad-h) * -1) 4px;
          padding:var(--card-pad-v) var(--card-pad-h) 0;
        }
        .card > .chead .sicon { grid-column:1; grid-row:1 / span 2; align-self:center; }
        /* The chip spans both header rows, so its height sized the tracks. Past
           26px it stretched them, and the folded head - which centers the group -
           sat half the excess too high, so every fold ended with the row jumping.
           Pin the space it claims to that basis; it still draws full size. */
        .card > .chead .sicon {
          margin-top:calc((var(--head-row, 26px) - var(--sicon)) / 2);
          margin-bottom:calc((var(--head-row, 26px) - var(--sicon)) / 2);
        }
        /* Constrain height only. These icons range from 0.57:1 to 1.43:1, and
           fitting them to a square box makes the wide ones look half-size. */
        /* System Settings' sidebar shape: the CHIP is the consistent square, so
           the glyph inside only has to be CONTAINED. These icons run 0.57:1 to
           1.43:1, and squaring them individually makes the wide ones half-size. */
        .sicon {
          position:relative;
          width:var(--sicon); height:var(--sicon); flex:0 0 var(--sicon);
          border-radius:calc(var(--sicon) * .27);
          background-color:var(--sc, var(--ink));
        }
        .sicon::after {
          content:""; position:absolute; inset:calc(var(--sicon) * .19);
          background-color:#fff;
          -webkit-mask:var(--i) center / contain no-repeat;
          mask:var(--i) center / contain no-repeat;
        }
        /* Multi-color icons are drawn, not masked, or they flatten to one tint. */
        .sicon.raw::after {
          background-color:transparent;
          -webkit-mask:none; mask:none;
          background:var(--i) center / contain no-repeat;
        }
        /* A grouped-table row's label is body text in Settings - the icon and the
           position say "section". 450 is a half-step over the field labels, and a
           real weight on a variable system font. */
        .card > .chead h2 { grid-column:2;
          font-size:16px; font-weight:450; letter-spacing:-0.015em; margin:0; flex:1; color:var(--ink);
        }
        /* No caret. The heading is the control and tapping it is the whole
           interaction, on every pointer. The button stays in the DOM at zero
           width so the fold is still reachable by keyboard and still announces
           its state; tabbing to it brings it back into view. */
        .fold {
          display:flex; align-items:center; justify-content:center;
          width:0; height:26px; flex:0 0 0; padding:0; border:0; border-radius:50%;
          overflow:hidden; opacity:0;
          background:none; cursor:pointer; color:var(--ink-3);
          transition:color .16s ease, background .16s ease;
        }
        .fold:focus-visible {
          width:26px; flex:0 0 26px; opacity:1; color:var(--ink); background:var(--chip);
        }
        .fold svg { width:15px; height:15px; transition:transform .26s var(--ease); }
        .band:not(.detail) .fold svg { width:14px; height:14px; }
        .fold[aria-expanded="false"] svg { transform:rotate(-90deg); }
        /* Column 3 was spare, and it is the one place a caret can sit tight
           against the title however long the title is. */
        /* Last, at the trailing edge, the way a disclosure indicator sits. */
        .card > .chead .fold { grid-column:6; grid-row:1; justify-self:end; }
        /* Pointing the way the press goes, and taking no press of its own: the
           row is the target, the chevron is the sign. */
        /* .fold defaults to width:0 and opacity:0 for keyboard focus only, so
           opacity alone paints a zero-width box - it needs a size. No rotation
           either: the svg rule already turns the chevron. */
        .band:not(.detail) .card > .chead .fold,
        .band:not(.detail) .tile > .thead .fold {
          width:20px; flex:0 0 20px; opacity:.45;
          pointer-events:none; overflow:visible;
          transition:opacity .36s cubic-bezier(.36,0,.16,1);
        }
        .band:not(.detail) .card > .chead { cursor:pointer; }
        .band.detail .card > .chead { cursor:default; }
        .card > .chead .plus, .card > .chead .sw { cursor:pointer; }
        /* A tile folds the same way; its head is a flex row, not a grid. */
        /* Delete is not part of the tile's body - it stands behind the row and
           slides out from under it - so a shut tile must not hide it. This is
           why it never appeared: the row slid aside onto nothing. */
        .tile.shut > :not(.thead):not(.delbtn) { display:none; }
        .tile.shut > .thead { cursor:pointer; }
        /* Only a collapsed card carries a summary. Zero WIDTH, not display:none -
           display cannot be transitioned. The hidden state sits 4px low, so the
           text travels the same direction the card does. */
        .count {
          color:var(--ink-2); font-size:12px; font-weight:450;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          min-width:0; max-width:0; opacity:0; transform:translateY(7px);
          transition:max-width .26s var(--ease) .04s,
                     opacity .14s var(--ease),
                     transform .2s var(--ease);
        }
        /* A tile's summary is a friendly_name, not a "9 set" tally, and 16ch cut
           most of them off. The cap only has to be a number the transition can
           animate to; the flex row limits the real width. */
        :is(.card, .tile):is(.shut, .counting) > :is(.chead, .thead) .count {
          max-width:16ch; opacity:1; transform:translateY(0);
          /* Arriving, the space opens first and the text settles into it. It
             now runs alongside the card closing rather than after it. */
          /* Legible by ~200ms and still traveling at ~400ms, so the rise is
             something you watch. A front-loaded curve spends the rest of its time
             settling, which makes 4px in 240ms read as instant. */
          transition:max-width .24s var(--ease),
                     opacity .18s var(--ease) .02s,
                     transform .38s cubic-bezier(.26,1.08,.36,1) .02s;
        }
        /* AFTER the rule above on purpose: same specificity, so source order
           decides. A tile's summary is a friendly_name, not a "9 set" tally, and
           16ch cut most of them off - the flex row still limits the real width. */
        .tile:is(.shut, .counting) > .thead .count { max-width:32ch; }
        .card > .chead .count { grid-column:3; justify-self:end; }
        /* Three empty tracks sit between the summary and the caret in the list,
           and grid still collects the gap either side of each - so the summary
           floated 36px off the chevron. Span to the caret's own track. */
        .band:not(.detail) .card > .chead .count { grid-column:3 / 6; }
        /* A card that loads already folded is folded, not fading in on arrival. */
        :host(.booting) .count { transition:none; }
        /* Side by side on one row. They used to sit in separate rows either
           side of the section description, which is gone. */
        .card > .chead .plus { grid-column:4; grid-row:1; justify-self:end; }
        .card > .chead .sw { grid-column:5; grid-row:1; justify-self:end; }
        /* Not in the list. Both live inside the section now - the switch as its
           first row, the + at the foot of what it adds to. */
        .band:not(.detail) .card > .chead .plus,
        .band:not(.detail) .card > .chead .sw,
        .band:not(.detail) .tile > .thead .sw { display:none; }
        /* And the caret is only ever a list affordance. */
        .band.detail .card > .chead .fold,
        .band.detail .tile > .thead .fold { display:none; }
        /* Last in the flex row, wherever it was appended. */
        .band:not(.detail) .tile > .thead .fold { order:9; margin-left:2px; }
        /* The row menu is a second control on a row that is already a target;
           it moves in with the thing it acts on. */
        .band:not(.detail) .tile > .thead .rowmenu { display:none; }

        /* A group needs its entities and its switch. Off dims the card so the
           setup underneath still reads, rather than hiding or clearing it. */
        .sw {
          position:relative; width:40px; height:24px; flex:0 0 40px; padding:0; border:0;
          border-radius:999px; cursor:pointer; background:var(--sw-off);
          box-shadow:inset 0 0 0 .5px var(--chip-rim);
          transition:background .24s var(--ease), filter .16s ease;
        }
        .sw::after {
          content:""; position:absolute; top:2px; left:2px; width:20px; height:20px;
          border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.28);
          transition:transform .24s var(--ease);
        }
        .sw[aria-checked="true"] { background:#30d158; }
        .sw[aria-checked="true"]::after { transform:translateX(16px); }
        .sw:hover { filter:brightness(1.08); }
        /* The knob widens toward the pill's CENTER, never past its end: checked,
           it already reaches 38 in a 40px pill, so the translate has to pull back
           by the same amount it grows. */
        .sw:active::after { width:24px; }
        .sw[aria-checked="true"]:active::after { width:24px; transform:translateX(12px); }
        /* Off drops the tint and dims the setup, so the switch reads at a glance
           without anything being hidden or cleared. */
        /* Folded, only .chead is drawn, so an off card is told apart by its
           header alone. The SURFACE recedes, not the text: a dimmed label reads
           as unavailable rather than off. */
        /* Inside a group there is no slab to take away, so off is simply a row
           that is not lifted - exactly how Bluetooth reads in System Settings.
           The switch carries the state and the label stays legible. */
        .card.off { background-color:transparent; }
        .card.off > .chead h2 { opacity:.82; }
        .card > .chead .sicon, .card > .row, .card > .hint,
        .card > .empty-note, .card > .adv, .card > .chead h2 {
          transition:opacity .3s var(--ease), color .3s var(--ease);
        }
        .card.off > .row, .card.off > .hint,
        .card.off > .empty-note, .card.off > .adv { opacity:.42; }
        /* The icon carries the color, so it is the one thing that reads as
           "off" without hurting legibility. */
        .card.off > .chead .sicon { opacity:.45; }
        /* Dimmed and inert, not hidden: hiding shifts the header on every toggle
           and leaves you hunting for where the + went. */
        .card.off > .chead .plus { pointer-events:none; cursor:default; }
        /* An off card cannot be expanded - the fold toggle returns early on one
           - so the heading should stop offering. The switch keeps its pointer:
           it is the one thing here that still does something. */
        .card.off > .chead { cursor:default; }
        .card.off > .chead .sw { cursor:pointer; }
        .card.off > .chead h2 { color:var(--ink-2); }
        /* Off, there is nothing to read - the card is its heading and no more. */
        .card.shut > :not(.chead) { display:none; }

        /* Optional overrides with working defaults, kept out of the setup flow. */
        .adv { margin-top:6px; }
        /* No divider: a rule here made Advanced read as another row of the list
           rather than a drawer belonging to the card. */
        /* Closed it is a row of the list and takes the row's inset; open it is a
           heading for what it revealed, and hugs it the way .subhead does. */
        .advsum {
          display:flex; align-items:center; gap:6px; width:100%; padding:12px 0;
          background:none; border:0; color:var(--ink-2); font-size:12.5px; font-weight:560;
          border-radius:0; justify-content:flex-start;
        }
        .advsum:hover:not(:disabled) { color:var(--ink); filter:none; }
        .advsum:active:not(:disabled) { transform:none; }
        .advsum svg { width:13px; height:13px; flex:0 0 13px; transition:transform .22s var(--ease); }
        .advsum .advplus { margin-left:auto; width:22px; height:22px; flex:0 0 22px; }
        .advsum .advplus svg { width:13px; height:13px; transition:none; }
        .adv.open .advsum .advplus svg { transform:none; }
        .adv.open .advsum svg { transform:rotate(90deg); }
        .adv.open .advsum { padding:12px 0 4px; }
        .advbody { display:none; }
        .adv.open .advbody { display:block; }
        .plus {
          width:26px; height:26px; padding:0; border-radius:50%; flex:0 0 26px;
          display:flex; align-items:center; justify-content:center;
          background:var(--chip); color:var(--ink);
          box-shadow:inset 0 0 0 1px var(--chip-rim);
        }
        .plus:hover:not(:disabled) { background:var(--chip-hi); filter:none; }
        .plus svg { width:15px; height:15px; display:block; }
        .card > .empty-note, .advbody > .empty-note {
          color:var(--ink-3); font-size:12.5px; padding:14px 0 12px;
          border-top:1px solid var(--hair);
        }

        .subhead {
          padding:13px 0 3px; border-top:1px solid var(--hair);
          color:var(--ink-2); font-size:12.5px; font-weight:560;
        }
        .subhead + .row { border-top:0; }
        /* The drawer's own summary already separates it from the fields. */
        .advbody > :first-child { border-top:0; }
        /* A border is not clipped away with its row - it sits under the heading
           until .shut lands, then pops. Fade them with the fold instead. */
        .row, .subhead, .advsum, .empty-note, .addmore {
          transition:border-top-color .18s var(--ease);
        }
        :is(.card, .tile).counting :is(.row, .subhead, .advsum, .empty-note, .addmore) {
          border-top-color:transparent;
        }
        .row {
          display:grid; grid-template-columns:minmax(110px,33%) 1fr 22px; gap:14px; align-items:center;
          padding:12px 0; border-top:1px solid var(--hair);
        }
        .row .drop {
          width:22px; height:22px; padding:0; border-radius:50%; box-shadow:none;
          background:var(--chip); color:var(--ink-2);
          opacity:.45; transition:opacity .14s ease, background .14s ease, color .14s ease;
          display:grid; place-items:center;
        }
        .row .drop svg { width:13px; height:13px; display:block; }
        .row .drop.blank { visibility:hidden; }
        .row:hover .drop { opacity:1; }
        .row .drop:hover { background:#ff453a; color:#fff; opacity:1; filter:none; }
        .row:first-of-type { border-top:0; }
        /* Label OVER field: a 360px panel leaves a two-column row ~180px, and
           entity names need far more. Not for switch rows - a toggle belongs on
           the right of the thing it names. */
        :host(:not(.narrow)) .inspector .row:not(:has(> .sw)) {
          grid-template-columns:minmax(0,1fr) 22px;
          column-gap:10px; row-gap:5px; align-items:center;
        }
        :host(:not(.narrow)) .inspector .row:not(:has(> .sw)) > label {
          grid-column:1; grid-row:1; font-size:12.5px;
        }
        :host(:not(.narrow)) .inspector .row:not(:has(> .sw)) > :nth-child(2) {
          grid-column:1; grid-row:2; min-width:0;
        }
        /* Beside the FIELD, not centered across the label and the field
           together - stacked, that put it in the gap between the two. */
        :host(:not(.narrow)) .inspector .row:not(:has(> .sw)) > :nth-child(3) {
          grid-column:2; grid-row:2; align-self:center;
        }
        /* A switch is its own width and belongs at the far end of the row, the
           way every settings list draws one. */
        .row > .sw { justify-self:end; }
        /* Switch rows keep the three-column grid, whose 33% label track is ~110px
           here and wrapped every name. The switch is its own width, so the name
           takes everything else. */
        :host(:not(.narrow)) .inspector .row:has(> .sw) {
          grid-template-columns:minmax(0,1fr) auto 22px;
        }
        :host(.tight) .row > .sw { margin-left:auto; }
        .row label { color:var(--ink-2); font-size:13.5px; }
        .row label .lsub {
          display:block; margin-top:2px; color:rgba(255,255,255,0.56); font-size:12px;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        /* Reads as the field it replaces - same height, same fill, same
           radius - with the swatch where a value would start. */
        .colorcell { display:block; min-width:0; }
        .colorfield {
          width:100%; height:38px; box-sizing:border-box;
          display:flex; align-items:center; gap:10px;
          padding:0 14px; border-radius:12px; border:0;
          background:var(--field); color:var(--ink);
          font:inherit; font-size:13.5px; text-align:left;
          box-shadow:none; justify-content:flex-start;
        }
        .colorfield:hover:not(:disabled) { background:var(--field-hi, var(--field)); filter:none; }
        .colorfield:active:not(:disabled) { transform:none; }
        .colorfield .clabel {
          min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        /* Unset is not a color, so the chip says so rather than painting one. */
        .colorfield .clabel.ph { color:var(--ink-3); }
        .swatch {
          width:15px; height:15px; flex:0 0 15px; border-radius:50%;
          box-shadow:inset 0 0 0 1px rgba(255,255,255,0.22);
        }
        .swatch.none {
          background:
            linear-gradient(45deg, transparent 44%, rgba(255,255,255,0.34) 44%,
              rgba(255,255,255,0.34) 56%, transparent 56%);
        }
        .combo-opt .swatch { margin-right:2px; }
        /* The browser's own picker is opened by the menu, never shown itself. */
        /* Rendered but not shown: a picker cannot be opened from a box that does
           not exist. pointer-events:none stops it swallowing presses meant for
           the swatch, and does not affect opening it in code. */
        .nativecolor {
          position:absolute; width:24px; height:24px; margin:-30px 0 0 12px;
          padding:0; border:0; opacity:0; pointer-events:none;
        }
        .row input, .row select, .row textarea { width:100%; box-sizing:border-box; }
        /* Typed and not yet valid. Nothing is written while this shows, so the
           ring is the whole message: the field keeps what you typed and the
           config keeps what it had. */
        .row input.bad { box-shadow:inset 0 0 0 1px #ff453a; }
        .row > select, .row > input, .row > .combo > input { height:38px; }
        .row > textarea { height:auto; }
        .addbar > select { height:36px; box-sizing:border-box; padding:0 34px 0 16px; border-radius:999px; min-width:120px; }
        .addbar > .mini { height:34px; box-sizing:border-box; }
        .hint { color:var(--ink-3); font-size:11.5px; padding:2px 0 12px; }
        /* Not a hint: a hint is advice, this is the field not working. So the
           hints switch must not collapse it. */
        .fieldwarn {
          color:var(--hemma-color-orange, #FF9230);
          font-size:11.5px; padding:2px 0 12px;
        }
        .hint + .fieldwarn { padding-top:0; margin-top:-8px; }

        textarea {
          font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:12px;
          min-height:72px; resize:vertical; line-height:1.5;
        }
        select { line-height:normal; }

        /* Native datalist and select popups cannot be styled, so entity and icon
           fields use a real listbox instead. */
        .combo { position:relative; }
        .combo > input { width:100%; box-sizing:border-box; }

        /* Lives in #overlay, outside any card. A card's own backdrop-filter
           becomes the backdrop root for its descendants, which leaves a nested
           backdrop-filter with nothing to sample. */
        #overlay { position:fixed; inset:0; z-index:200; pointer-events:none; }
        .combo-menu {
          position:fixed; pointer-events:auto;
          max-height:300px; overflow-y:auto; overscroll-behavior:contain;
          padding:6px; border-radius:14px;
          background:rgba(28,28,32,0.34);
          backdrop-filter:blur(64px) saturate(210%) brightness(1.06);
          -webkit-backdrop-filter:blur(64px) saturate(210%) brightness(1.06);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.16),
            inset 0 0 0 0.5px rgba(255,255,255,0.14),
            0 2px 6px rgba(0,0,0,0.16),
            0 18px 48px rgba(0,0,0,0.44);
        }
        .combo-opt {
          padding:6px 10px; border-radius:9px; cursor:default; font-size:13.5px;
          display:flex; align-items:center; gap:8px; color:var(--ink);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          line-height:1.4; letter-spacing:-0.005em;
        }
        .combo-opt.active { background:var(--accent); color:#fff; }
        /* Setup: suggestions you can take, and a field for your own. */
        .sugrow { display:flex; flex-wrap:wrap; gap:7px; margin:10px 0 0; }
        .sugchip {
          font-size:12.5px; padding:6px 13px; border-radius:999px;
          background:var(--chip); color:var(--ink); box-shadow:inset 0 0 0 1px var(--chip-rim);
        }
        .sugchip::before { content:"+ "; color:var(--accent); font-weight:600; }
        .sugchip:hover { background:var(--chip-hi); filter:none; }
        .addroom { margin:10px 0 0; }
        .addroom input { width:100%; box-sizing:border-box; height:36px; }
        /* Unavailable, rather than armed and then refused. */
        .combo-opt.off { opacity:.38; cursor:default; pointer-events:none; }
        .combo-opt .lbl { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; }
        .combo-opt .tick { width:12px; flex:0 0 12px; opacity:0; font-size:11px; }
        .combo-opt.sel .tick { opacity:.85; }
        .combo-menu.noticks .combo-opt .tick { display:none; }
        .combo-sep { height:1px; margin:5px 8px; background:rgba(255,255,255,0.11); }
        .combo-empty { padding:6px 9px; color:var(--ink-3); font-size:12.5px; }
        .scrim {
          position:fixed; inset:0; z-index:300; display:grid; place-items:center;
          background:rgba(0,0,0,0.42);
          backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
        }
        /* The same material as a section group, so a dialog reads as part of the
           panel. Deeper shadow than a group: a group sits on the page, this
           floats above it. */
        .dialog {
          width:min(420px, calc(100vw - 48px)); box-sizing:border-box;
          padding:24px 24px 20px; border-radius:var(--r-xl);
          /* OPAQUE by necessity: the scrim above is itself a backdrop root and
             paints flat black, so this element's blur had nothing to sample. The
             page blur belongs to the scrim. */
          background-color:#4b4b53;
          background-image:var(--pane-solid);
          box-shadow:var(--g-rim), 0 24px 60px rgba(0,0,0,0.52);
        }
        .dialog h3 { margin:0 0 6px; font-size:16px; font-weight:600; letter-spacing:-0.01em; }
        .dialog p { margin:0 0 16px; font-size:13px; color:var(--ink-2); line-height:1.5; }
        .dialog input { width:100%; box-sizing:border-box; margin:0 0 18px; height:38px; }
        .dialog .acts { display:flex; gap:10px; justify-content:flex-end; }
        .dialog .acts button { height:34px; padding:0 18px; font-size:13.5px; }
        .dialog .acts button.danger { background:#ff453a; color:#fff; }
        /* The dialog is itself a backdrop root, so a nested blur here would be
           inert. A translucent fill plus a rim reads as glass instead. */
        .dialog .acts button.ghost {
          background:rgba(255,255,255,0.14);
          color:var(--ink);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,0.16);
        }
        .dialog .acts button.ghost:hover { background:rgba(255,255,255,0.22); }

        /* Badge reordering, the tile list's gesture on the badge cards. The
           grip rides in from the right on Edit and the card lifts while it is
           dragged - the same two rules, scoped to this column. */
        .badgecol > .card > .chead { position:relative; }
        /* Declared here, because --rm-w and --rm-gap are set on .tile and
           nowhere else: var(--rm-w) with no fallback resolved to nothing, the
           grip came out 0x0, and Edit looked like a button that did nothing. */
        .badgecol > .card { --rm-w:22px; --rm-gap:var(--card-pad-h); }
        /* The grip takes the CARET'S place, as the tile list does: a row either
           opens or moves, so nothing shifts and the reading stays put. */
        .badgecol.editing > .card > .chead .fold { opacity:0; }
        /* .chead is full-bleed, so right:0 is the CARD's edge - a whole
           --card-pad-h past where the caret sat. */
        .badgecol > .card > .chead .grip {
          position:absolute; right:var(--card-pad-h); top:50%; z-index:2;
          width:var(--rm-w); height:var(--rm-w); padding:0;
          background:none; box-shadow:none; color:var(--ink-2);
          display:grid; place-items:center; cursor:grab;
          --grip-x:calc(var(--rm-w) + var(--rm-gap));
          transform:translate(var(--grip-x), -50%);
          opacity:0; pointer-events:none;
          transition:transform .36s cubic-bezier(.36,0,.16,1),
                     opacity .36s cubic-bezier(.36,0,.16,1),
                     color .2s var(--ease);
        }
        .badgecol.editing > .card > .chead .grip {
          --grip-x:0px; opacity:1; pointer-events:auto;
        }
        .badgecol > .card > .chead .grip:hover { color:var(--ink); }
        .badgecol > .card > .chead .grip:active { cursor:grabbing; }
        /* A dragged row cannot be glass: it moves with a transform, and a
           backdrop-filter samples where the element started, so the blur
           smears. --pane-solid is what that token is for. */
        .badgecol > .card.bodrag {
          z-index:4; position:relative;
          background:var(--pane-solid); color:var(--ink);
          border-radius:var(--r-md);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.15),
            inset 0 0 0 1px var(--chip-rim),
            0 18px 42px rgba(0,0,0,0.42);
        }
        /* Beats .card's own tint, which would wash the solid out. */
        .badgecol > .card.bodrag:not(.shut):not(.off) { background:var(--pane-solid); }
        /* Never inside .grouphead: that is a two-column grid with no room for a
           third child, and hints-off collapses it to height:0. It is a
           .sortstrip instead, so it carries that row's grid and hairline. */
        .badgeedit {
          height:28px; min-width:62px; padding:0 14px; border-radius:999px;
          display:grid; place-items:center;
          font-size:13px; font-weight:500; color:var(--ink);
          background:var(--chip); box-shadow:inset 0 0 0 1px var(--chip-rim);
          transition:background-color .28s var(--ease), box-shadow .28s var(--ease);
        }
        .badgeedit:hover { background:var(--chip-hi); filter:none; }
        .badgeedit[aria-pressed="true"] {
          background:var(--accent); color:#fff; box-shadow:none;
        }
        @media (prefers-reduced-motion: reduce) { .badgeedit { transition:none; } }
        @media (prefers-reduced-motion: reduce) {
          .badgecol > .card > .chead .grip { transition:none; }
        }
        /* One row per scene. NOT .colorfield, which is a full-width field
           control - reusing it crushed the scene name to nothing and left a
           column of identical pickers that named no scene at all. */
        .scenecolors { padding:0 var(--card-pad-h) var(--card-pad-v); }
        .scenecolors > .flabel { margin:2px 0 6px; }
        .scenecolor {
          width:100%; box-sizing:border-box;
          display:flex; align-items:center; gap:11px;
          height:40px; padding:0 12px; border:0; border-radius:12px;
          background:transparent; color:var(--ink);
          font:inherit; font-size:13.5px; text-align:left;
          box-shadow:none;
          transition:background-color .16s var(--ease);
        }
        .scenecolor:hover:not(:disabled) { background:var(--field); filter:none; }
        .scenecolor:active:not(:disabled) { transform:none; }
        .scenecolor + .scenecolor { margin-top:2px; }
        .scenecolor .scicon {
          --mdc-icon-size:20px; width:20px; height:20px; flex:0 0 20px;
        }
        .scenecolor .scname {
          flex:1 1 auto; min-width:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .scenecolor .scval { flex:0 0 auto; color:var(--ink-2); font-size:13px; }
        .scenecolor .scval.dim { color:var(--ink-3); }
        .scenecolor .swatch {
          flex:0 0 auto; width:14px; height:14px; border-radius:50%;
          box-shadow:inset 0 0 0 1px rgba(255,255,255,0.22);
        }
        .scenecolors > .hint { padding:6px 12px 0; }
        .glyph {
          width:17px; height:17px; flex:0 0 17px; background-color:currentColor;
          -webkit-mask:var(--i) center/contain no-repeat; mask:var(--i) center/contain no-repeat;
        }
        .combo.hasicon { position:relative; }
        .combo.hasicon > input { padding-left:36px; }
        .combo.hasicon > .glyph {
          position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none;
          color:var(--ink-2);
        }
        /* The glyph a field falls back to, shown as what it is: not chosen. */
        .glyph.faint { opacity:.45; }
        .combo-head {
          padding:7px 10px 3px; font-size:11px; font-weight:600; letter-spacing:0.05em;
          text-transform:uppercase; color:var(--ink-3);
        }

        .chips { display:flex; flex-wrap:wrap; gap:7px; margin:0 0 8px; }
        .chip {
          display:inline-flex; align-items:center; gap:7px; font-size:12.5px;
          background:var(--chip); border-radius:999px; padding:5px 6px 5px 12px;
          box-shadow:inset 0 0 0 1px var(--chip-rim);
        }
        .chip button {
          width:18px; height:18px; padding:0; border-radius:50%; flex:0 0 18px;
          display:grid; place-items:center; background:rgba(255,255,255,0.16); color:var(--ink);
          font-size:12px; line-height:1; box-shadow:none;
        }
        .chip button:hover { background:rgba(255,69,58,0.85); filter:none; }
        .chipwrap .none { color:var(--ink-3); font-size:12px; margin:7px 0 0; }

        .empty {
          text-align:center; padding:60px 34px; margin-bottom:var(--gap);
          background:linear-gradient(to bottom, rgba(255,255,255,0.13), rgba(255,255,255,0.05));
          backdrop-filter:var(--g-blur); -webkit-backdrop-filter:var(--g-blur);
          box-shadow:var(--g-rim); border-radius:var(--r-xl);
        }
        .empty h2 { margin:0 0 10px; font-size:20px; font-weight:600; letter-spacing:-0.015em; }
        .empty p { margin:0 0 24px; color:var(--ink-2); font-size:13.5px; line-height:1.65; }

        .areas { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; margin:10px 0 18px; text-align:left; }
        .area {
          display:flex; align-items:center; gap:10px; font-size:13.5px; cursor:pointer;
          background:var(--chip); border-radius:var(--r-md); padding:12px 15px;
          box-shadow:inset 0 0 0 1px var(--chip-rim);
          transition:background .16s ease;
        }
        .area:hover { background:var(--chip-hi); }

        /* 36px is the drop-button column plus its gap, so the previews stop
           where every input above them stops. */
        .shots {
          display:grid; grid-template-columns:1fr 1fr; gap:12px;
          padding:10px 36px 16px 0;
        }
        .shots.busy { opacity:.5; pointer-events:none; }
        .shot {
          position:relative; padding:0; border:0; border-radius:var(--r-md);
          background:rgba(0,0,0,0.28); cursor:pointer; overflow:hidden;
          box-shadow:inset 0 0 0 1px var(--hair);
          aspect-ratio:16/9;
        }
        .shot:hover:not(:disabled) { filter:none; }
        .shot:active:not(:disabled) { transform:none; }
        .shot img {
          width:100%; height:100%; object-fit:cover; display:block; border-radius:inherit;
        }
        .shot.empty { box-shadow:inset 0 0 0 1px var(--chip-rim); }
        .shotover {
          position:absolute; inset:0; display:flex; flex-direction:column; gap:7px;
          align-items:center; justify-content:center; border-radius:inherit;
          background:rgba(0,0,0,0.46); color:var(--ink); font-size:12.5px; font-weight:560;
          opacity:0; transition:opacity .2s var(--ease);
        }
        .shot.empty .shotover { opacity:1; background:transparent; color:var(--ink-3); }
        .shot:hover .shotover, .shot.over .shotover { opacity:1; color:var(--ink); }
        .shot.over { box-shadow:inset 0 0 0 2px var(--accent); }
        .shotglyph {
          width:22px; height:22px; background-color:currentColor;
          -webkit-mask:var(--up) center/contain no-repeat; mask:var(--up) center/contain no-repeat;
        }
        .shot .cap {
          position:absolute; left:10px; bottom:8px; color:#fff; font-size:11.5px;
          text-shadow:0 1px 3px rgba(0,0,0,0.6); pointer-events:none;
        }
        .shot.empty .cap { color:var(--ink-3); text-shadow:none; }
        .shothint { color:var(--ink-3); font-size:12px; padding:0 0 14px; }

        /* Glass on glass: nested surfaces sit brighter than the card. */
        .tile {
          /* border-box: _shutCard animates height from offsetHeight, which IS the
             border box, so a content-box element overshoots by its padding on
             every keyframe. There is no global box-sizing reset here. */
          box-sizing:border-box;
          /* No top padding: .thead carries it, so the heading sits at the same
             height whether the tile is open or folded. */
          /* A row in the tile group, on the same terms as a section row: the
             group owns the surface, the row owns only its content. */
          border-radius:0; padding:0 var(--card-pad-h) var(--card-pad-v); margin:0;
          background-color:transparent;
          transition:background-color .3s var(--ease);
        }
        .tile:not(.shut) { background-color:rgba(255,255,255,0.04); }
        .tile.off > .thead .sicon, .tile.off > .thead .grow { opacity:.45; }
        .tile.locked { opacity:.6; }
        .tile > .tbody > .adv { margin-top:2px; }
        /* A row of the list that happens to be a button: same divider, same
           height, accent-colored because it acts rather than reports. */
        /* Same chip as .row .drop, right-aligned into the drops' column: a member
           list's add and remove are one pair. */
        .addmore {
          display:flex; align-items:center; justify-content:center;
          width:22px; height:22px; padding:0; margin:2px 0 14px auto;
          background:var(--chip); border:0; border-radius:50%;
          box-shadow:inset 0 0 0 1px var(--chip-rim);
          color:var(--ink);
          transition:background .14s var(--ease);
        }
        .addmore svg { width:13px; height:13px; display:block; }
        .addmore:hover:not(:disabled) { filter:none; opacity:1; background:var(--chip-hi); }
        .addmore:active:not(:disabled) { transform:none; opacity:1; background:var(--chip-hi); }
        .addmore:disabled { opacity:.45; }
        /* The row grows out of where the + was rather than appearing under it,
           so the - lands by travelling to its place instead of cutting to it.
           No fill mode: when it ends the row keeps its own natural style, which
           is how max-height gets back to none. */
        /* Height, not max-height: animating a cap past the real height grows fast
           while it binds and then crawls, which is a velocity break that reads as
           a bounce. --rowfrom/--rowto are what the row grows out of and settles
           into - the + chip's footprint when it is replacing it, else 0. */
        @keyframes hemma-rowin {
          from { height:var(--rowfrom, 0px); opacity:0; border-top-color:transparent; }
          to   { height:var(--rowh); opacity:1; }
        }
        /* The collapse must outlive the re-render that drops the row. */
        @keyframes hemma-rowout {
          from { height:var(--rowh); opacity:1; }
          to   { height:var(--rowto, 0px); opacity:0; border-top-color:transparent; }
        }
        .row.rowin, .row.rowout { overflow:hidden; box-sizing:border-box; }
        .row.rowin  { animation:hemma-rowin .26s cubic-bezier(.4,0,.2,1); }
        .row.rowout { animation:hemma-rowout .22s cubic-bezier(.4,0,.2,1) forwards; }
        @media (prefers-reduced-motion:reduce) {
          .row.rowin, .row.rowout { animation:none; overflow:visible; }
        }
        /* The tile's own padding sat ABOVE the heading, so the top 16px of the
           tile was dead to both the fold and the drag. Pull the head out over
           that padding and give it straight back, so the box grows into the
           corner without a pixel of content moving. */
        /* pan-y, not none: the browser keeps vertical scrolling until the hold
           fires, and the drag calls it off itself by preventing the move. With
           touch-action none the header swallowed every swipe and the list could
           not be scrolled from a tile at all. */
        .thead {
          display:flex; align-items:center; gap:var(--head-gap, 9px);
          cursor:grab; touch-action:pan-y;
          margin:-16px -20px 0; padding:16px 20px 0;
        }
        .tile.dragging {
          z-index:6; opacity:1;
          background:var(--lift);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.15),
            inset 0 0 0 1px var(--chip-rim),
            0 18px 42px rgba(0,0,0,0.42);
        }
        .tile.dragging .thead { cursor:grabbing; }
        /* Drag states stay dark in both modes: the panel's own surfaces are dark
           whatever HA reports, so a light lift would leave light text on white. */
        .tile.dragging, .tab.dragging { color:var(--ink); }
        .thead .grow { flex:1; font-size:13.5px; font-weight:560; }
        .thead .kind { color:var(--ink-3); font-size:11.5px; font-weight:400; margin-left:6px; }
        .mini {
          padding:6px 13px; font-size:12px; font-weight:530; border-radius:999px;
          background:var(--chip); color:var(--ink);
          box-shadow:inset 0 0 0 1px var(--chip-rim);
        }
        .mini:hover:not(:disabled) { background:var(--chip-hi); filter:none; }
        .mini.danger { color:#ff453a; }
        .mini.icon {
          width:28px; height:28px; padding:0; border-radius:50%;
          display:inline-flex; align-items:center; justify-content:center;
          background:var(--chip); box-shadow:inset 0 0 0 1px var(--chip-rim); color:var(--ink-2);
          transition:background .14s ease, color .14s ease;
        }
        .mini.icon:hover { background:var(--chip-hi); color:var(--ink); filter:none; }
        .mini.icon svg { width:16px; height:16px; display:block; }
        /* No gap under the head. The head is already a --shut-h box with the
           name centered in it, so a margin here put the first divider 6px lower
           open than folded - the same mismatch the card had above its own. */
        .tbody { margin-top:0; }
        .tbody .row { grid-template-columns:minmax(100px,30%) 1fr; padding:10px 0; }
        /* Its own control row above the tile group, so it needs air: at one --gap
           it sat on the group's rounded top edge and read as resting on a tile.
           Squaring those corners would fix it the wrong way round. */
        .addbar {
          display:flex; gap:10px; align-items:center; flex-wrap:wrap;
          margin:0 0 calc(var(--gap) * 1.55);
        }
        /* Inside the inspector's glass, a nested blur samples that composited
           surface and flattens these to gray - and drops out while the entrance
           runs, which is why they changed color as it ended. No nested blur; the
           fill carries it. */
        .addbar .combo input, .addbar .plus {
          background-color:rgba(28,28,32,0.34);
          box-shadow:inset 0 0 0 1px var(--field-rim);
        }
        .addbar .plus:hover:not(:disabled) { background-color:rgba(46,46,52,0.44); }
        #tilespane { margin-top:var(--gap); }
        #tilespane:empty { display:none; }
        .tilewrap { display:block; }
        /* align-items:start, not the grid default: stretched, a collapsed tile
           still measures its tallest neighbor, so _shutCard read the same height
           before and after. */
        /* One column of rows, matching the sections above. It was a responsive
           multi-column grid, which is why tiles read as loose cards rather than
           as part of the same list. .tilegrid holds only tiles - the hint and
           the add bar are its siblings - so it can be the group surface. */
        .addbar select { border-radius:999px; padding:9px 15px; }

        details { margin-top:4px; }
        summary { cursor:pointer; color:var(--ink-2); font-size:12.5px; padding:7px 2px; }
        #log {
          margin-top:10px; max-height:230px; overflow:auto;
          background:rgba(0,0,0,0.40); border-radius:var(--r-md); padding:14px 16px;
          box-shadow:inset 0 0 0 1px var(--hair);
          font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:12px; line-height:1.6;
        }
        .line { color:var(--ink-2); white-space:pre-wrap; }
        .line.ok { color:#30d158; } .line.err { color:#ff453a; } .line.warn { color:#ffd60a; }

        /* No .body padding here: resetting the shorthand threw away the --top-h
           padding the 1100 block sets, and the page slid under the fixed
           header. That block already pads every width this one covers. */
        /* Label on its own line, field and remove button sharing the next -
           a single 1fr column dropped the button onto a third row. */
        :host(.tight) .row { grid-template-columns:1fr auto; gap:7px 0; align-items:center; }
        /* Tile rows carry their own desktop template and outrank the line
           above, which left their fields in a 30% column. */
        :host(.tight) .tbody .row { grid-template-columns:1fr auto; }
        :host(.tight) .row > label { grid-column:1 / -1; }
        :host(.tight) .row > .drop { margin-left:10px; }
        /* Nothing to leave room for once the third track is gone. */
        :host(.tight) .row > .drop.blank { display:none; }
        :host(.tight) .shots { padding-right:0; }
      </style>
      <div class="bgwrap">
        <img class="bg" id="bg" alt="">
        <div class="bgtint"></div>
        <div class="bgnoise"></div>
        <div class="bgnoise2"></div>
      </div>
      <div class="shell">
      <!-- Chrome, not content. The rail is flush to the leading edge and runs
           the full height; the toolbar starts at its trailing edge, the way a
           macOS window splits its titlebar across a source list. _placeRooms
           moves the burger, the wordmark and #rooms back into that toolbar
           below PANEL_NARROW, where there is no rail. -->
      <aside class="rail" aria-label="Rooms">
        <div class="railhead">
          <button class="burger" id="burger" title="Menu" aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M4 7h16M4 12h16M4 17h16"/>
            </svg>
          </button>
        </div>
        <div class="railgroup" id="g-rooms"><h2 class="railhead2">Rooms</h2>
          <button class="railedit" id="roomsedit">Edit</button></div>
        <div id="rooms"></div>
        <div class="railgroup" id="g-dashes"><h2 class="railhead2">Dashboards</h2>
          <button class="railedit" id="dashesedit">Edit</button></div>
        <div id="dashes"></div>
      </aside>
      <div class="main">
      <div class="top">
        <div class="toprow">
        <h1 id="brand"><span class="s-long">Hemma Studio</span><span class="s-short">Hemma</span><span class="ver"></span></h1>
        <div class="spacer"></div>
        <button id="save" class="ghost" disabled><span class="s-long">Save changes</span><span class="s-short">Save</span></button>
        <button id="donebtn" class="ghost" title="Save and open the dashboard">Done</button>
        <button id="more" class="ghost icon" title="More" aria-label="More">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.25"/><circle cx="12" cy="12" r="2.25"/><circle cx="19" cy="12" r="2.25"/></svg>
        </button>
          </div>
      </div>
      <div class="body">
        <div id="status" class="status"></div>
        <div class="stage">
          <div class="canvas">
            <div id="reconcile" class="reconcile" hidden></div>
            <div class="bandhead canvashead">
              <div class="segrow">
                <div class="seg" id="sizeseg">
                  <span class="segthumb"></span>
                  <button type="button" class="segopt" data-size="desktop">Desktop</button>
                  <button type="button" class="segopt" data-size="tablet">Tablet</button>
                  <button type="button" class="segopt" data-size="phone" hidden>Phone</button>
                </div>
                <div class="seg icons" id="modeseg">
                  <span class="segthumb"></span>
                  <button type="button" class="segopt" data-mode="day"
                          aria-label="Preview the day photo" title="Day">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round">
                      <circle cx="12" cy="12" r="4.2"/>
                      <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6l1.6-1.6M18 6l1.6-1.6"/>
                    </svg>
                  </button>
                  <button type="button" class="segopt" data-mode="night"
                          aria-label="Preview the night photo" title="Night">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.7 14.6A8.6 8.6 0 0 1 9.4 3.3a8.6 8.6 0 1 0 11.3 11.3Z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="plinth">
              <div id="mapmount" role="group" aria-label="Dashboard preview"></div>
            </div>
          </div>
        </div>
        <div id="tilespane"></div>
        <!-- Diagnostics. Kept wired up so _log() still has somewhere to write;
             drop the hidden attribute to bring the panel back. -->
        <details hidden>
          <summary>Details</summary>
          <div id="log"></div>
        </details>
      </div>
      </div>
      <!-- The inspector: navigate on the left, look at the thing in the middle,
           adjust it on the right. Chrome like the rail, flush to the trailing
           edge, and its head carries the group switcher - the scope of what is
           under it, exactly as the rail's head names the app and the toolbar
           names the dashboard. -->
      <aside class="inspector">
        <div class="insphead"></div>
        <div id="pane" class="sheet"></div>
      </aside>
      </div>
      <div id="overlay"></div>
`;

    this.classList.add("booting");
    // Never leave it hidden if a load fails.
    setTimeout(() => this._playEntrance(true), 2500);
    this.shadowRoot.querySelector(".ver").textContent = "v" + PANEL_VERSION;
    const rm = this.$("roomsedit");
    if (rm) rm.onclick = () => this._toggleEdit("rooms");
    const dm = this.$("dashesedit");
    if (dm) dm.onclick = () => this._toggleEdit("dashes");
    this.$("burger").onclick = () =>
      this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
    this.$("more").onclick = () => {
      // Sections fold globally; only the tile cards below are this room's.
      const room = this._state && this._state.compact.rooms[this._room];
      this._menuAt(this.$("more"), [
        // Below PANEL_NARROW there is no rail, so this is the only way to change
        // dashboard. Inline rather than behind a submenu: one tap, not two.
        ...(isNarrow(this) ? (this._dashList || []).map((d) => ({
          id: "dash:" + d.url_path,
          label: this._dashLabels(this._dashList || []).get(d.url_path),
          checked: d.url_path === this._dashUrl,
          group: "Dashboard",
        })) : []),
        { id: "create", label: "Create dashboard\u2026", group: "Dashboard" },
        { id: "delete", label: "Delete dashboard", group: "Dashboard" },
        // Only where there is one to add. Pair creation happens on Create, so
        // this is the way in for every dashboard made before that existed -
        // which is all of them.
        ...(this._canAddMobile()
          ? [{ id: "addmobile", label: "Add phone layout", group: "Dashboard" }] : []),
        // On by default: the descriptions are the only place the panel says what
        // a badge or a tile IS.
        // Phone only, where there is no preview. Done also opens the dashboard
        // but SAVES on the way; this is the look without the commit.
        ...(isPhone(this)
          ? [{ id: "open", label: "Open dashboard", group: "View" }] : []),
        { id: "hints", label: this._hints === false ? "Show hints" : "Hide hints",
          checked: this._hints !== false, group: "View" },
      ], (id) => {
        // A second menu on the same anchor: let the first finish closing, or
        // _menuAt sees its own anchor and treats the request as a toggle.
        if (id === "create") return this._createForm();
        if (id.indexOf("dash:") === 0) {
          const p = id.slice(5);
          if (p === this._dashUrl) return;
          this._setDash(p);
          this._remember(p);
          return this._load();
        }
        if (id === "delete") return this._deleteDashboard();
        if (id === "addmobile") return this._addMobileSibling();
        if (id === "open") return this._openDash(true);
        if (id === "hints") return this._setHints(this._hints === false, true);
      });
    };
    if (this._hints === undefined) {
      this._hints = localStorage.getItem("hemma_panel_hints") !== "off";
    }
    this.classList.toggle("nohints", this._hints === false);
    // Wired once: the control outlives every preview rebuild.
    if (!this._miniSize) {
      const saved = localStorage.getItem("hemma_panel_preview_size");
      this._miniSize = (saved === "tablet" || saved === "desktop") ? saved
        : (isNarrow(this) ? "tablet" : "desktop");
    }
    // The preview shows the day photo until you ask for the night one. It
    // follows neither the panel's theme nor HA's - which variant you are
    // setting up is a choice, not a consequence of when you opened the panel.
    if (this._miniDark === undefined) {
      // Follows HA on every load, never remembered. A stored preference was
      // winning over the theme, so opening the panel in daylight still showed
      // the night photo. The switch still works for the rest of the session.
      this._miniDark = !!(this._hass && this._hass.themes && this._hass.themes.darkMode);
    }

    // Measured, not a number that drifts: the header grows when the room pills
    // wrap. And dvh is the LARGE viewport height, ignoring retractable browser
    // UI, so it overreads and the whole page scrolls.
    const setVph = () => {
      const w = panelW(this);
      const h = window.innerHeight;
      // A page the browser has put aside measures as nothing and still fires its
      // ResizeObserver. Nothing re-measures on the way back, so believing it
      // stuck until a reload. Below this it is the absence of a size, not one.
      if (w <= 40 || h <= 40) return;
      this.style.setProperty("--vph", h + "px");
      this.style.setProperty("--vpw", w + "px");
      this.classList.toggle("narrow", w < PANEL_NARROW);
      this.classList.toggle("tight", w < PANEL_TIGHT);
      const phone = w < PANEL_PHONE;
      const wasPhone = this._wasPhone;
      this._wasPhone = phone;
      this.classList.toggle("phone", phone);
      this._placeRooms(w < PANEL_NARROW);
      // Growing past the breakpoint has to BUILD the preview that was never built
      // while it was a phone, or the slot stays empty until the signature
      // changes.
      if (wasPhone === true && !phone) this._rebuildPreview();
    };
    setVph();
    // Both measurements, on every one of these. The header's offset is as
    // viewport-dependent as the width is, and only setVph was listening - so a
    // resize that moved the bar left --top-h behind.
    const remeasureAll = () => {
      setVph();
      if (this._syncTop) this._syncTop();
    };
    window.addEventListener("resize", remeasureAll);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", remeasureAll);
    }
    // Nothing fires a resize when a hidden page comes back, so every measurement
    // taken while it was away is still in force.
    if (!this._onVisible) {
      this._onVisible = () => {
        if (document.visibilityState !== "visible") return;
        // Repeatedly, not once: returning to a full-screen Safari tab settles
        // over several frames, and the fixed bar is restored AFTER the first
        // paint - a single rAF measures a header that has not landed yet.
        const remeasure = () => {
          if (document.visibilityState !== "visible") return;
          // The cache has to go first: syncTop returns early when the total it
          // computes matches _topH, so a wrong value that happens to recur
          // would never be corrected.
          this._topH = null;
          setVph();
          if (this._syncTop) this._syncTop();
          if (this._applyMapSize) this._applyMapSize();
        };
        requestAnimationFrame(remeasure);
        [60, 200, 500].forEach((ms) => setTimeout(remeasure, ms));
      };
      document.addEventListener("visibilitychange", this._onVisible);
      // bfcache restores skip visibilitychange entirely on some browsers.
      window.addEventListener("pageshow", this._onVisible);
    }
    // The slot can change width without the window doing so - HA's sidebar
    // docks, undocks and collapses under the panel's feet, and none of that is
    // a resize event.
    if (this.parentElement && window.ResizeObserver) {
      if (this._slotObs) this._slotObs.disconnect();
      this._slotObs = new ResizeObserver(() => setVph());
      this._slotObs.observe(this.parentElement);
    }

    const bar = this.shadowRoot.querySelector(".top");
    const body = this.shadowRoot.querySelector(".body");
    const syncTop = () => {
      // The bar is fixed to the VIEWPORT and absorbs the safe-area inset itself,
      // but the host may inset .body by the same amount - adding the height on
      // top of an offset already there. Measure the gap instead; subtracting the
      // scroll keeps it stable, and with no host inset it is the height.
      const b = bar.getBoundingClientRect();
      // Same reason as setVph: a hidden page measures its bar as nothing, and
      // caching that in _topH means the correct value is never written.
      if (b.height <= 0) return;
      const docTop = document.documentElement.getBoundingClientRect().top;
      const bodyTop = body.getBoundingClientRect().top - docTop;
      const total = Math.max(0, Math.round(b.bottom - bodyTop)) + 26;
      if (this._topH === total) return;
      this._topH = total;
      this.style.setProperty("--top-h", total + "px");
      // The columns just got shorter or taller, so the preview no longer fits
      // what it was measured against.
      if (this._applyMapSize) this._applyMapSize();
    };
    this._syncTop = syncTop;
    syncTop();
    requestAnimationFrame(syncTop);
    if (window.ResizeObserver) {
      new ResizeObserver(syncTop).observe(bar);
    }

    this._syncSizeOpts();
    this._wireSeg(this.$("sizeseg"), "size", this._miniSize || "desktop", (v) => {
      this._miniSize = this._sizeAllowed(v);
      localStorage.setItem("hemma_panel_preview_size", this._miniSize);
      // REBUILD, not reclass: reclassing works while every size is one markup at
      // a different scale, and the phone is a different tree.
      this._rebuildPreview();
    });
    this._wireSeg(this.$("modeseg"), "mode", this._miniDark ? "night" : "day", (v) => {
      this._miniDark = v === "night";
      // Not _syncPreview: which photo you are looking at is not an edit, and
      // that path marks the form dirty.
      const mount = this.$("mapmount");
      const room = this._state && this._state.compact.rooms[this._room];
      if (!mount || !mount.firstChild || !room) return;

      // Only the photo differs between the two modes, so cross-fade it and the
      // swap reads as the light changing. The outgoing shot stays on top as a
      // ghost, inserted after .mini-photo so the tint and scrim hold still and
      // only the sky moves.
      const heroSel = this._miniSize === "phone" ? ".mp-photo" : ".mini-photo";
      const before = mount.querySelector(heroSel);
      const prevSrc = before && before.src;
      this._swapMap(mount, room);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const photo = mount.querySelector(heroSel);
      if (!photo || !prevSrc || photo.src === prevSrc) return;

      const ghost = document.createElement("img");
      ghost.className = photo.className;
      ghost.alt = "";
      ghost.dataset.ghost = "1";
      ghost.src = prevSrc;
      // The phone hero carries a scroll offset of its own, so a ghost with no
      // transform would jump to the top of the screen to fade out.
      if (photo.style.transform) ghost.style.transform = photo.style.transform;
      photo.parentNode.insertBefore(ghost, photo.nextSibling);

      // Only ever removes the ghost. If anything adopts it, it stops being one
      // and this must not reach into the card and take its photo out.
      const drop = () => {
        if (ghost.dataset.ghost && ghost.parentNode) ghost.remove();
      };
      const seq = (this._modeSwap = (this._modeSwap || 0) + 1);
      const dissolve = () => {
        // A second tap mid-fade owns the transition; this one clears out.
        if (seq !== this._modeSwap) return drop();
        ghost.animate([{ opacity: 1 }, { opacity: 0 }],
          { duration: 900, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" })
          .finished.then(drop, drop);
      };
      // Waiting for the incoming photo matters: fading the ghost out over an
      // undecoded image shows the tint through, which is the flash again.
      if (photo.complete && photo.naturalWidth) dissolve();
      else {
        photo.addEventListener("load", dissolve, { once: true });
        photo.addEventListener("error", drop, { once: true });
      }
    }, { toggle: true });


    this.$("save").onclick = () => this._save();
    this.$("donebtn").onclick = () => this._done();
    await this._refreshDashboards();
  }

  // Whether a dashboard is a Hemma one is only knowable from its config, so the
  // others are pruned in the background once the panel is already usable.
  async _pruneDashboards(list) {
    for (const d of list) {
      if (d.url_path === this._dashUrl) continue;
      let hemma = false;
      try {
        const cfg = await this._hass.callWS({ type: "lovelace/config", url_path: d.url_path });
        hemma = isMobileConfig(cfg)
          || (cfg.views || []).some((v) => ((v.cards || [])[0] || {}).template === "hemma_room");
      } catch (e) {
        hemma = false;
      }
      if (hemma) continue;
      this._dashList = (this._dashList || []).filter((x) => x.url_path !== d.url_path);
      this._log(`hid "${d.url_path}", not a Hemma dashboard`);
      // The sidebar is drawn from this list, so a row nobody removed is a row you
      // can click into an empty dashboard.
      this._paintDashes();
    }
  }

  // withRoom lands on the view you are editing, so the trip out and back keeps
  // its place. Done opens the half that matches the DEVICE, not the half the
  // panel happened to be editing.
  _dashForDevice(url_path) {
    const list = this._dashList || [];
    if (!list.length) return url_path;
    const phone = isPhone(this);
    const mobile = (d) => /[-_]mobile$/i.test(d.url_path || "")
      || /\bmobile\b/i.test(d.title || "");
    const cur = list.find((d) => d.url_path === url_path);
    if (cur && mobile(cur) === phone) return url_path;
    // The sibling of the one being edited first: dashboard-hemma pairs with
    // dashboard-hemma-mobile, so a second Hemma pair cannot pull you across.
    const stem = (u) => String(u || "").replace(/[-_]mobile$/i, "");
    const twin = list.find((d) => d.url_path !== url_path
      && stem(d.url_path) === stem(url_path) && mobile(d) === phone);
    if (twin) return twin.url_path;
    const any = list.find((d) => mobile(d) === phone);
    return any ? any.url_path : url_path;
  }

  _openDash(withRoom) {
    const p = this._dashForDevice(this._dashUrl);
    if (!p) return;
    const room = withRoom && this._state && this._state.compact.rooms[this._room];
    window.location.assign("/" + p + (room && room.path ? "/" + room.path : ""));
  }

  // The current dashboard used to live on the header picker's .value. The
  // picker is gone - it moved into the ... menu - so it is plain state now.
  _setDash(url_path) {
    this._dashUrl = url_path || "";
    this._paintDashes();
  }

  // Titles, not url_paths. Only ONE dashboard is loaded at a time, so the Phone
  // tag is read from the name for the others and from state for that one.
  // A pair is labeled by the axis that separates its halves - the device - and
  // with two pairs that stops distinguishing, so the titles come back.
  _toggleEdit(which) {
    const cls = "editing-" + which;
    const on = !this.classList.contains(cls);
    // One section at a time: two lists both in edit mode is two states to hold
    // in your head for no benefit.
    this.classList.remove("editing-rooms", "editing-dashes");
    const btn = this.$(which + "edit");
    if (btn) btn.textContent = on ? "Done" : "Edit";
    const other = which === "rooms" ? "dashes" : "rooms";
    const ob = this.$(other + "edit");
    if (ob) ob.textContent = "Edit";
    this._renderTabs();
    this._paintDashes();
    // Add the class AFTER the rows exist, or they are built at their final width
    // and the transition has nothing to play from.
    if (on) requestAnimationFrame(() => this.classList.add(cls));
  }

  _editing(which) { return this.classList.contains("editing-" + which); }

  // The minus a row grows in edit mode. Both lists build it the same way, and
  // both confirm before removing anything.
  _minusFor(onTap) {
    const b = document.createElement("button");
    b.className = "railminus";
    b.title = "Remove";
    b.setAttribute("aria-label", "Remove");
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M6 12h12"/></svg>';
    b.onpointerdown = (ev) => ev.stopPropagation();
    b.onclick = (ev) => { ev.stopPropagation(); onTap(); };
    return b;
  }

  // Renaming a home. HA owns the title, so this is a dashboard update rather
  // than a config write - and the sidebar reads titles, so it repaints after.
  async _renameDashboard(d) {
    const name = await this._ask({
      title: "Rename dashboard", value: d.title || d.url_path, confirmLabel: "Rename",
    });
    if (!name || name === d.title) return;
    try {
      await this._hass.callWS({
        type: "lovelace/dashboards/update", dashboard_id: d.id, title: name,
      });
      d.title = name;
      this._paintDashes();
      this._log(`renamed "${d.url_path}" to "${name}"`, "ok");
    } catch (e) {
      this._status("rename failed: " + e.message, "err");
      this._log("rename failed: " + e.message, "err");
    }
  }

  // One row per home, phone half included: the two are renderings of one
  // configuration, and the size control is how you look at each.
  _homes(list) {
    const stem = (u) => String(u || "").replace(/[-_]mobile$/i, "");
    const isPhone = (d) => /[-_]mobile$/i.test(d.url_path || "");
    const out = [];
    (list || []).forEach((d) => {
      if (isPhone(d) && (list || []).some((o) => o !== d && o.url_path === stem(d.url_path))) return;
      out.push({
        wide: d,
        phone: (list || []).find((o) => o !== d && stem(o.url_path) === stem(d.url_path) && isPhone(o)) || null,
      });
    });
    return out;
  }

  _dashLabels(list) {
    const stemOf = (u) => String(u || "").replace(/[-_]mobile$/i, "");
    const isMobile = (d) => /[-_]mobile$/i.test(d.url_path || "");
    const paired = list.filter((d) =>
      list.some((o) => o !== d && stemOf(o.url_path) === stemOf(d.url_path)));
    const stems = new Set(paired.map((d) => stemOf(d.url_path)));
    const out = new Map();
    list.forEach((d) => out.set(d.url_path, d.title || d.url_path));
    if (stems.size === 1 && paired.length === list.length) {
      paired.forEach((d) => out.set(d.url_path, isMobile(d) ? "Mobile" : "Desktop"));
    }
    return out;
  }

  _paintDashes() {
    const box = this.$("dashes");
    if (!box) return;
    const list = this._dashList || [];
    box.innerHTML = "";
    const homes = this._homes(list);
    // One home is the normal case, and a switcher offering a choice of one only
    // suggests you were supposed to have made more. Create still lives in the
    // toolbar menu, which is where it has to be anyway - the rail is off screen
    // below PANEL_NARROW. The section comes back the moment a second home does.
    const many = homes.length > 1;
    const head = this.$("g-dashes");
    if (head) head.hidden = !many;
    box.hidden = !many;
    if (!many) {
      // Clear the class directly rather than through _toggleEdit, which repaints
      // this list and would come straight back here.
      this.classList.remove("editing-dashes");
      const eb = this.$("dashesedit");
      if (eb) eb.textContent = "Edit";
      return;
    }
    const el = document.createElement("div");
    el.className = "tabs";
    homes.forEach((home) => {
      const d = home.wide;
      const cur = d.url_path === this._dashUrl;
      const t = document.createElement("div");
      t.className = "tab" + (cur ? " on" : "");
      t.dataset.k = "dash-" + d.url_path;

      const label = document.createElement("span");
      label.className = "tablabel";
      const shown = d.title || d.url_path;
      label.textContent = shown;
      t.appendChild(label);

      // No Phone tag. It existed to tell two rows apart, and there is one row
      // per home now - what it renders as is the preview's business.
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
      t.appendChild(caret);
      // Anchored to the ROW, not the chevron: the chevron is display:none now,
      // so it has no box and the menu opened at the top-left of the screen.
      t.oncontextmenu = (ev) => { ev.preventDefault(); this._dashMenu(t, d, home); };

      t.appendChild(this._minusFor(() => this._deleteDashboard(d.url_path)));

      t.onclick = () => {
        // While editing, a tap renames. Navigating out of a list you are in the
        // middle of editing is never what you meant.
        if (this._editing("dashes")) return this._renameDashboard(d);
        if (d.url_path === this._dashUrl) return;
        this._setDash(d.url_path);
        this._remember(d.url_path);
        this._load();
      };
      t.title = (d.title || d.url_path) + "  (" + d.url_path + ")";
      el.appendChild(t);
    });
    box.appendChild(el);
  }

  // The section menus are gone. Edit on the header covers removing, a tap in
  // edit mode covers renaming, and Create keeps its place in the toolbar menu -
  // which is also where it has to be, since the sidebar is not on screen at all
  // below PANEL_NARROW.

  // The row's own menu, the way the room rows have one. Delete lives here now
  // as well as in the toolbar menu - a source list is where you expect to act
  // on the thing you are pointing at.
  _dashMenu(anchor, d, home) {
    // No "Edit this dashboard": tapping the row is how you edit it, and a menu
    // item for the thing the row already does is a menu item that teaches
    // nothing.
    this._menuAt(anchor, [
      { id: "rename", label: "Rename\u2026" },
      ...(home && !home.phone ? [{ id: "addmobile", label: "Add phone layout" }] : []),
      { id: "delete", label: "Delete", destructive: true },
    ], (id) => {
      if (id === "rename") return this._renameDashboard(d);
      if (id === "addmobile") {
        if (d.url_path !== this._dashUrl) {
          this._setDash(d.url_path); this._remember(d.url_path);
          return this._load().then(() => this._addMobileSibling());
        }
        return this._addMobileSibling();
      }
      if (id === "delete") return this._deleteDashboard(d.url_path);
    });
  }

  // Opened from the ... menu, anchored to it, so it reads as a second step of
  // the same control rather than a new one.
  _remember(url_path) {
    try { if (url_path) localStorage.setItem(LAST_DASH_KEY, url_path); } catch (e) { /* private mode */ }
  }

  // A dashboard the editor could not read must not be what the next reload
  // opens: that turns one wrong click into a panel you cannot get out of
  // without clearing storage.
  _forget(url_path) {
    try {
      if (localStorage.getItem(LAST_DASH_KEY) === url_path) localStorage.removeItem(LAST_DASH_KEY);
    } catch (e) { /* private mode */ }
  }

  // Takes a path now: the sidebar can delete a dashboard you are not editing,
  // and deleting the open one still has to leave the panel on something.
  async _deleteDashboard(which) {
    const url_path = which || this._dashUrl;
    const entry = (this._dashList || []).find((d) => d.url_path === url_path);
    if (!entry) return this._status("pick a dashboard first", "err");

    const yes = await this._ask({
      title: 'Delete "' + entry.title + '"?',
      message: "The dashboard and everything configured in it is removed. Your entities are untouched. This cannot be undone.",
      confirmLabel: "Delete", destructive: true,
    });
    if (!yes) return;

    try {
      await this._hass.callWS({ type: "lovelace/dashboards/delete", dashboard_id: entry.id });
      this._log(`deleted dashboard "${url_path}"`, "ok");
      this._status(`Deleted "${entry.title}"`, "ok");
      this._dashList = (this._dashList || []).filter((d) => d.url_path !== url_path);
      // Deleting the one being edited leaves nothing loaded, so let the refresh
      // choose again; deleting any other must not move you off your work.
      await this._refreshDashboards(url_path === this._dashUrl ? undefined : this._dashUrl);
    } catch (e) {
      this._status("delete failed: " + e.message, "err");
      this._log("delete failed: " + e.message, "err");
    }
  }

  async _refreshDashboards(select) {
    let list = [];
    try {
      list = (await this._hass.callWS({ type: "lovelace/dashboards/list" }))
        .filter((d) => d.mode === "storage");
      this._dashList = list;
    } catch (e) {
      this._status("could not list dashboards: " + e.message, "err");
      return;
    }
    if (!list.length) {
      this._setDash("");
      this._firstRun();
      return;
    }

    // Prefer an explicit choice, then the last one used, then anything that
    // looks like a Hemma dashboard, rather than whatever HA happens to list first.
    let pick = select;
    if (!pick) {
      let remembered = null;
      try { remembered = localStorage.getItem(LAST_DASH_KEY); } catch (e) { /* private mode */ }
      if (remembered && list.some((d) => d.url_path === remembered)) pick = remembered;
    }
    if (!pick) {
      const looksHemma = list.find((d) => /hemma/i.test(d.url_path) || /hemma/i.test(d.title || ""));
      pick = looksHemma ? looksHemma.url_path : list[0].url_path;
    }
    this._setDash(pick);
    this._remember(pick);

    this._log(`${list.length} storage dashboard(s)`);
    await this._load();
    this._pruneDashboards(list);
  }

  _firstRun() {
    this._saveBlocked = true;
    this._markDirty();
    this.$("rooms").innerHTML = "";
    this.$("tilespane").innerHTML = "";
    this.$("pane").innerHTML = `
      <div class="empty">
        <h2>No dashboard yet</h2>
        <p>Create a Hemma dashboard and pick which rooms it should have.<br>
           You can add entities to each room afterwards.</p>
      </div>`;
  }

  // ── create ────────────────────────────────────────────────────────────────

  async _createForm() {
    this._saveBlocked = true;
    this._markDirty();
    this.$("rooms").innerHTML = "";
    this.$("tilespane").innerHTML = "";
    this._status("");
    let areas = [];
    try {
      areas = await this._hass.callWS({ type: "config/area_registry/list" });
    } catch (e) {
      this._status("could not read areas: " + e.message, "err");
    }

    this.$("pane").innerHTML = `
      <section class="card">
        <h2>Set up Hemma</h2>
        <div class="row"><label>Name</label><input id="c_title" value="Hemma"></div>
        <div class="adv" id="c_adv">
          <button class="advsum" type="button" id="c_advsum">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                 stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <span>Address</span>
          </button>
          <div class="advbody">
            <div class="row"><label>Address</label><input id="c_path" value="hemma-dashboard"></div>
          </div>
        </div>
      </section>
      <section class="card">
        <h2>Rooms</h2>
        <div class="hint">Home is always included. Add a room for each part of
          the house you want a page for.</div>
        <div class="areas" id="c_areas"></div>
        <div class="addbar">
          <button id="c_go">Create Dashboard</button>
          <button id="c_cancel" class="ghost">Cancel</button>
        </div>
      </section>`;

    const box = this.$("c_areas");
    const addArea = (name, checked) => {
      const w = document.createElement("label");
      w.className = "area";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = checked !== false; cb.dataset.name = name;
      w.appendChild(cb);
      w.appendChild(document.createTextNode(name));
      box.appendChild(w);
      return w;
    };
    areas.forEach((a) => addArea(a.name, true));

    // An empty state that only reports a shortage is the one thing an empty
    // state must not be. "No areas found" was true and gave you nothing to do
    // about it, so this one carries the action: take a suggestion, or type your
    // own. The rooms are Hemma's either way - an HA area only saves you typing.
    if (!areas.length) {
      const why = document.createElement("div");
      why.className = "hint";
      why.textContent = "You have no areas in Home Assistant yet. Rooms you add "
        + "here are Hemma's own; assigning entities to areas later makes setup faster.";
      box.appendChild(why);
      const sug = document.createElement("div");
      sug.className = "sugrow";
      ["Living Room", "Kitchen", "Bedroom"].forEach((name) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sugchip";
        b.textContent = name;
        b.onclick = () => { b.remove(); addArea(name, true); box.appendChild(sug); box.appendChild(adder); };
        sug.appendChild(b);
      });
      box.appendChild(sug);
    }

    // Always available, areas or not: a room Hemma has that HA does not.
    const adder = document.createElement("div");
    adder.className = "addroom";
    const nameIn = document.createElement("input");
    nameIn.placeholder = "Add a room\u2026";
    const commit = () => {
      const name = nameIn.value.trim();
      if (!name) return;
      nameIn.value = "";
      addArea(name, true);
      box.appendChild(adder);
      nameIn.focus();
    };
    nameIn.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); commit(); } };
    nameIn.onblur = commit;
    adder.appendChild(nameIn);
    box.appendChild(adder);

    const advWrap = this.$("c_adv");
    const advSum = this.$("c_advsum");
    advSum.onclick = () => {
      const now = !advWrap.classList.contains("open");
      advWrap.classList.toggle("open", now);
      advSum.setAttribute("aria-expanded", now ? "true" : "false");
    };

    // "lowercase, must contain a hyphen" was the second thing the panel ever
    // asked anyone. It is derived from the name now, and only pinned when you
    // type an address yourself - the same rule a tile's Name follows its entity.
    const pathIn = this.$("c_path");
    const titleIn = this.$("c_title");
    let pathPinned = false;
    pathIn.oninput = () => { pathPinned = true; };
    const derive = () => {
      if (pathPinned) return;
      const slug = String(titleIn.value || "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      // HA requires a hyphen, so a single-word name earns the suffix and a name
      // that already reads as two words does not.
      const base = !slug ? "hemma-dashboard" : slug.includes("-") ? slug : slug + "-dashboard";
      const taken = new Set((this._dashList || []).map((d) => d.url_path));
      let out = base, n = 2;
      while (taken.has(out)) out = base + "-" + n++;
      pathIn.value = out;
    };
    titleIn.oninput = derive;
    derive();

    this.$("c_cancel").onclick = () => this._load();
    this.$("c_go").onclick = () => this._create();
  }

  async _create() {
    const title = this.$("c_title").value.trim() || "Hemma";
    const url_path = this.$("c_path").value.trim();
    if (!/^[a-z0-9-]+$/.test(url_path) || !url_path.includes("-")) {
      return this._status("URL path must be lowercase, and must contain a hyphen", "err");
    }

    const picked = [...this.shadowRoot.querySelectorAll("#c_areas input:checked")]
      .map((cb) => cb.dataset.name);

    this.$("c_go").disabled = true;
    this._status("creating...");

    try {
      const bundle = await this._bundleOnce();
      this._log(`templates bundle: ${Object.keys(bundle.templates).length} templates`);

      const rooms = [blankRoom("Home", "home", "home-demo")];
      picked.forEach((name) => rooms.push(blankRoom(name, slug(name), "home-demo")));

      const images = rooms.map((r) => r.variables.image);
      rooms.forEach((r) => { r.variables.preload_rooms = images.slice(); });

      const extras = {};
      extras[FINGERPRINT_KEY] = fingerprintOf(bundle.templates);
      const built = expandConfig({ rooms }, bundle.scaffold, extras, bundle.templates);

      // Applied to the whole config so the copy inside hemma_room is caught too.
      const fixed = retargetRoutes(built, url_path, rooms);   // keep the bundle's own extras
      const config = fixed.config;
      this._log(`rewrote ${fixed.rewritten} navigation route list(s)`);
      if (!fixed.rewritten) this._log("no routes list found - nav links may point elsewhere", "warn");

      await this._hass.callWS({
        type: "lovelace/dashboards/create",
        url_path,
        title,
        icon: "mdi:home",
        show_in_sidebar: true,
        require_admin: false,
      });
      this._log(`created dashboard "${url_path}"`, "ok");

      await this._hass.callWS({ type: "lovelace/config/save", url_path, config });
      this._log(`wrote config  ${JSON.stringify(config).length.toLocaleString()} bytes`, "ok");

      // Hemma is a pair. _dashForDevice already assumes the sibling exists -
      // Done on a phone looks for <path>-mobile - so creating one without the
      // other leaves the finish button with nowhere narrow to land.
      const paired = await this._createMobileSibling(url_path, title, picked, bundle);

      this._status(`Created "${title}" with ${rooms.length} room(s)`
        + (paired ? " and its phone layout" : "") + ". Click Open to view it.", "ok");
      await this._refreshDashboards(url_path);
    } catch (e) {
      this._status("create failed: " + e.message, "err");
      this._log("create failed: " + e.message, "err");
      this.$("c_go").disabled = false;
    }
  }

  // Offerable only on a wide dashboard that has been read, and only when the
  // phone half is genuinely missing - not merely unselected.
  _canAddMobile() {
    const s = this._state;
    if (!s || s.surface === "mobile" || !this._dashUrl) return false;
    const want = mobilePathOf(this._dashUrl);
    return !(this._dashList || []).some((d) => d.url_path === want);
  }

  async _addMobileSibling() {
    const s = this._state;
    if (!s || !this._canAddMobile()) return;
    const mpath = mobilePathOf(this._dashUrl);
    const entry = (this._dashList || []).find((d) => d.url_path === this._dashUrl);
    const title = (entry && entry.title) || "Hemma";
    const rooms = s.compact.rooms || [];

    const yes = await this._ask({
      title: "Add a phone layout?",
      message: `A second dashboard at "${mpath}" laid out for a phone, with `
        + `${rooms.length} section(s) carried over from this one. Done then opens `
        + `whichever of the two suits the device you are on. Nothing here changes.`,
      confirmLabel: "Add",
    });
    if (!yes) return;

    this._status("adding phone layout...");
    try {
      const bundle = await this._bundleOnce(true);
      if (!bundle.mobile) throw new Error("this build's template bundle has no phone scaffold");

      const st = mobileFromRooms(bundle.mobile, bundle.templates, rooms);
      const extras = { ...clone(bundle.mobile.extras || {}) };
      extras[FINGERPRINT_KEY] = fingerprintOf(bundle.templates);
      const cfg = expandAny(st, { extras, templates: bundle.templates });

      await this._hass.callWS({
        type: "lovelace/dashboards/create",
        url_path: mpath,
        title: title + " Mobile",
        icon: "mdi:cellphone",
        show_in_sidebar: false,
        require_admin: false,
      });
      await this._hass.callWS({ type: "lovelace/config/save", url_path: mpath, config: cfg });
      this._log(`created phone layout "${mpath}" with ${st.compact.rooms.length} section(s)`, "ok");
      this._status(`Added "${title} Mobile". Open it from Choose dashboard.`, "ok");
      await this._refreshDashboards(this._dashUrl);
    } catch (e) {
      this._status("could not add the phone layout: " + e.message, "err");
      this._log("add phone layout failed: " + e.message, "err");
    }
  }

  // The phone half of the pair. A failure here is logged and nothing more: the
  // dashboard you asked for exists, and a missing sibling is recoverable while
  // a half-written one is not.
  async _createMobileSibling(url_path, title, picked, bundle) {
    if (!bundle.mobile) {
      this._log("bundle has no mobile scaffold - phone layout skipped", "warn");
      return false;
    }
    const mpath = url_path + "-mobile";
    if ((this._dashList || []).some((d) => d.url_path === mpath)) {
      this._log(`"${mpath}" already exists - left alone`);
      return false;
    }
    try {
      // Favorites, not Home: on the phone the first section is the one whose
      // tiles are not a room, and the header refuses to open a popup for it.
      const names = [MOBILE_FAVORITES].concat(picked);
      const st = blankMobileState(bundle.mobile, names);
      const extras = { ...clone(bundle.mobile.extras || {}) };
      extras[FINGERPRINT_KEY] = fingerprintOf(bundle.templates);
      const cfg = expandAny(st, { extras, templates: bundle.templates });

      await this._hass.callWS({
        type: "lovelace/dashboards/create",
        url_path: mpath,
        title: title + " Mobile",
        icon: "mdi:cellphone",
        show_in_sidebar: false,
        require_admin: false,
      });
      await this._hass.callWS({ type: "lovelace/config/save", url_path: mpath, config: cfg });
      this._log(`created phone layout "${mpath}" with ${names.length} section(s)`, "ok");
      return true;
    } catch (e) {
      this._log("phone layout not created: " + e.message, "warn");
      return false;
    }
  }

  // ── load / save ───────────────────────────────────────────────────────────

  async _load() {
    const url_path = this._dashUrl;
    if (!url_path) return;
    this._clearLog();
    this._status("");
    try {
      const cfg = await this._hass.callWS({ type: "lovelace/config", url_path });

      // A home is edited from its wide half, always. Landing on the phone half
      // - a remembered choice, a stale link - used to leave you on a dashboard
      // that told you to go somewhere else. Go there instead.
      if (isMobileConfig(cfg)) {
        const wide = this._widePathOf(url_path);
        if (wide) {
          this._log(`"${url_path}" is the phone half of "${wide}" - opening that`);
          this._setDash(wide);
          this._remember(wide);
          return this._load();
        }
      }

      this._raw = cfg;
      // Cleared before anything can throw: a stale pair from the last dashboard
      // would mirror this one's edits into somebody else's phone layout.
      this._pair = null;
      this._state = extractAny(cfg);
      this._stateUrl = url_path;
      // The wide dashboard and its phone half are one home. Loading both is
      // what lets one edit reach every place either of them reads it.
      this._pair = await this._loadPair(url_path, cfg);
      if (this._pair) this._state = this._pair.desktop;
      // The route was being stored and never read, so the panel always opened
      // on the first room however you arrived. Consumed once: after that,
      // switching rooms here should not be undone by a stale URL.
      this._room = this._roomFromRoute();
      this._routeUsed = true;
      this._log(`loaded "${url_path}"  ${JSON.stringify(cfg).length.toLocaleString()} bytes`);
      this._state.warnings.forEach((w) => this._log("warn: " + w, "warn"));

      if (!this._state.compact.rooms.length) {
        const skipped = this._state.warnings
          .filter((w) => w.indexOf("- skipped") >= 0)
          .map((w) => (w.match(/^view "([^"]*)"/) || [])[1])
          .filter(Boolean);
        this._state = null;
        this._stateUrl = null;
        this._forget(url_path);
        this._saveBlocked = true;
        this._markDirty();
        this._paintDashes();
        this._renderReconcile();
        // Two different readers: one picked somebody else's dashboard, the other's
        // own has views the extractor could not read. "Not a Hemma dashboard" is
        // a wrong answer to the second, and the panel knows which views failed.
        const esc = (t) => String(t).replace(/[&<>]/g, (c) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
        const damaged = skipped.length > 0;
        this._status(damaged
          ? `No room could be read from this dashboard (${skipped.length} view(s) skipped).`
          : "Not a Hemma dashboard.", "warn");
        this.$("rooms").innerHTML = "";
        this.$("tilespane").innerHTML = "";
        this.$("pane").innerHTML = damaged
          ? `<div class="empty">
               <h2>No rooms could be read</h2>
               <p>This dashboard has views, but none of them look like a Hemma
                  room. ${skipped.length === 1 ? "The one skipped" : "The " + skipped.length + " skipped"}:
                  ${esc(skipped.slice(0, 6).join(", "))}${skipped.length > 6 ? "\u2026" : ""}.<br>
                  ${isMobileConfig(cfg)
                    ? "A section is a header card followed by a smart row."
                    : "A room is a hero card, the nav, and a smart row, in that order."}
                  The log below has the detail.</p>
             </div>`
          : `<div class="empty">
               <h2>Not a Hemma dashboard</h2>
               <p>Pick a Hemma dashboard above, or create a new one.</p>
             </div>`;
        // Reveal the window. Without this the panel stayed in its booting
        // state - toolbar, rail, stage and inspector all at opacity 0 - so an
        // unreadable dashboard looked like a black screen with one line of
        // text, and there was nothing on it to pick a different one with.
        requestAnimationFrame(() => this._playEntrance(true));
        return;
      }

      // Regenerating must reproduce the file exactly before any edit is allowed.
      const rebuilt = expandAny(this._state);
      const safe = stable(rebuilt) === stable(cfg);
      this._log(`round trip check: ${safe ? "identical" : "DIFFERS"}`, safe ? "ok" : "err");

      if (this._pair && this._pair.safe === false) {
        this._saveBlocked = true;
        this._markDirty();
        this._status("The phone layout has content the editor would not preserve. Saving is disabled.", "err");
        this._log("the phone half did not round trip - saving is off for both", "err");
      }
      if (!safe) {
        this._saveBlocked = true;
        this._markDirty();
        this._status("This dashboard has content the editor would not preserve. Saving is disabled.", "err");
        (cfg.views || []).forEach((v, i) => {
          if (stable(v) !== stable((rebuilt.views || [])[i])) this._log(`  view[${i}] "${v.path}" differs`, "err");
        });
      } else {
        this._saveBlocked = false;
        this._markDirty();
        this._status("");
      }

      this._paintDashes();
      this._syncSizeOpts();
      this._reconcileOff = false;
      this._reconcileSeen = false;
      this._renderReconcile();
      this._clean = this._print();
      this._renderTabs();
      this._renderForm();
      requestAnimationFrame(() => this._playEntrance());
    } catch (e) {
      // Without this a thrown load leaves the panel booting - a black screen with
      // no way to pick a different dashboard. Forget the choice too, or every
      // reload lands back in the same throw.
      this._state = null;
      this._stateUrl = null;
      this._forget(url_path);
      this._saveBlocked = true;
      this._markDirty();
      this._status("load failed: " + e.message, "err");
      this._log("load failed: " + e.message, "err");
      try { this._paintDashes(); this._renderReconcile(); } catch (e2) { /* nothing left to paint */ }
      requestAnimationFrame(() => this._playEntrance(true));
    }
  }

  // The phone half, when there is one to pair with. Returns null for a phone
  // dashboard opened on its own, for a wide one with no sibling, and for any
  // sibling that cannot be read - a pair that only half loaded would let a
  // shared edit reach one dashboard and silently miss the other.
  async _loadPair(url_path, cfg) {
    // A phone dashboard opened on its own is not the wide half of anything.
    if (isMobileConfig(cfg)) return null;
    const mpath = mobilePathOf(url_path);
    if (!(this._dashList || []).some((d) => d.url_path === mpath)) return null;
    let mcfg = null;
    try {
      mcfg = await this._hass.callWS({ type: "lovelace/config", url_path: mpath });
    } catch (e) {
      this._log(`phone layout "${mpath}" could not be read: ${e.message}`, "warn");
      return null;
    }
    if (!isMobileConfig(mcfg)) {
      this._log(`"${mpath}" is not a phone layout - editing this one alone`, "warn");
      return null;
    }
    let pair;
    try {
      pair = extractPair(cfg, mcfg, cfg.button_card_templates, this._editableKeys());
    } catch (e) {
      this._log("phone layout could not be paired: " + e.message, "warn");
      return null;
    }
    pair.mobileUrl = mpath;
    pair.mobileRaw = mcfg;

    // Each half still has to rebuild exactly, or a save would rewrite the one
    // the editor could not read.
    const back = expandPair(pair);
    pair.safe = stable(back.mobile) === stable(mcfg);
    this._log(`paired with "${mpath}"  round trip ${pair.safe ? "identical" : "DIFFERS"}`,
      pair.safe ? "ok" : "err");
    if (!pair.safe) return pair;

    pair.link.orphanRooms.forEach((o) =>
      this._log(`room "${o.name}" has no section on the phone layout`, "warn"));
    pair.link.orphanSections.forEach((o) =>
      this._log(`phone section "${o.name}" has no room here`, "warn"));

    const c = pair.conflicts;
    if (c.length) {
      const differs = c.filter((x) => x.kind === "differs");
      const gaps = c.length - differs.length;
      if (differs.length) {
        this._log(`${differs.length} setting(s) disagree between the two layouts`, "warn");
        differs.slice(0, 8).forEach((x) => this._log(
          `  ${x.key}: this one has ${JSON.stringify(x.desktop)}, the phone has ${JSON.stringify(x.mobile)}`, "warn"));
      }
      if (gaps) {
        this._log(`${gaps} setting(s) filled in on only one layout`, "warn");
        c.filter((x) => x.kind !== "differs").slice(0, 8).forEach((x) => this._log(
          `  ${x.key}: only on the ${x.kind === "onlyDesktop" ? "wide" : "phone"} one`
          + ` (${JSON.stringify(x.kind === "onlyDesktop" ? x.desktop : x.mobile)})`, "warn"));
      }
      this._log("setting either of these here now writes both layouts");
    }
    return pair;
  }

  // Is there a phone layout these edits can reach - either the one being
  // edited, or the one paired with it?
  _phoneReachable() {
    if ((this._state || {}).surface === "mobile") return true;
    return !!(this._pair && this._pair.safe !== false);
  }

  // A surface note used to live here, telling you the phone half was read-only.
  // There is no phone half to land on now: _load sends you to the wide one, so
  // there is nothing to explain and nothing to redirect.
  _renderSurfaceNote() {}

  // The pair's disagreements as rows you can settle. Every button writes BOTH
  // halves through pairWrite, so settling a row is the edit you would have made
  // by hand.
  _widePathOf(url_path) {
    const stem = String(url_path || "").replace(/[-_]mobile$/i, "");
    if (stem === url_path) return null;
    return (this._dashList || []).some((d) => d.url_path === stem) ? stem : null;
  }

  // Both notices are one object - glyph, title, sentence, optional dismiss, row
  // of actions. Built separately they drifted.
  _notice(opts) {
    const box = this.$("reconcile");
    box.hidden = false;
    box.innerHTML = "";
    // Keeps its space from the first frame so the preview is not shoved down a
    // beat later, but stays invisible until the panel has finished arriving.
    box.classList.toggle("pending", !this._entered);

    const g = document.createElement("span");
    g.className = "rglyph" + (opts.tone === "attention" ? " warn" : "");
    g.style.setProperty("--i", "url('" + iconUrl(opts.glyph) + "')");
    box.appendChild(g);

    const h = document.createElement("h3");
    h.textContent = opts.title;
    box.appendChild(h);

    const p = document.createElement("p");
    p.textContent = opts.body;
    box.appendChild(p);

    if (opts.onClose) {
      const x = document.createElement("button");
      x.className = "rclose";
      x.title = "Dismiss until next time";
      x.setAttribute("aria-label", "Dismiss");
      x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.onclick = opts.onClose;
      box.appendChild(x);
    }

    const rows = document.createElement("div");
    rows.className = "rrows";
    box.appendChild(rows);
    return rows;
  }

  // Buttons with no list above them, so no rule: see .ractions.
  _noticeActions(rows, buttons) {
    rows.className = "ractions";
    (buttons || []).forEach(([text, fn]) => {
      const b = document.createElement("button");
      b.className = "ract";
      b.textContent = text;
      b.onclick = fn;
      rows.appendChild(b);
    });
    return rows;
  }

  // One action row: a label that takes the slack, then its buttons.
  _noticeRow(rows, label, buttons) {
    const row = document.createElement("div");
    row.className = "rrow";
    const k = document.createElement("span");
    k.className = "rkey";
    if (typeof label === "string") k.textContent = label;
    else if (label) k.appendChild(label);
    row.appendChild(k);
    (buttons || []).forEach(([text, fn]) => {
      const b = document.createElement("button");
      b.className = "ract";
      b.textContent = text;
      b.onclick = fn;
      row.appendChild(b);
    });
    rows.appendChild(row);
    return row;
  }

  _renderReconcile() {
    const box = this.$("reconcile");
    if (!box) return;

    const pair = this._pair;
    const list = pair && pair.safe !== false ? (pair.conflicts || []) : [];
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }

    // Dismissed for this session only. It carries work, so it must not be
    // possible to lose it for good - a reload brings it back while anything is
    // still unsettled, and settling everything removes it properly.
    if (this._reconcileOff) { box.hidden = true; box.innerHTML = ""; return; }

    const differs = list.filter((c) => c.kind === "differs");
    const rows = this._notice({
      glyph: "exclamation", tone: "attention",
      // One title for both kinds: a value on one layout and not the other is a
      // difference too. The rows carry the detail.
      title: `${list.length} setting${list.length === 1 ? "" : "s"} differ`
        + " between Desktop and Mobile",
      body: "Choose which value to keep. It applies to both.",
      onClose: () => { this._reconcileOff = true; this._closeReconcile(); },
    });

    // Four, not twelve: a tall notice pushes the preview off the screen, and
    // the rest are in the log.
    list.slice(0, 4).forEach((c) => {
      const label = document.createElement("span");
      label.appendChild(document.createTextNode((this._fieldLabelFor(c.key) || c.key) + ": "));
      const em = document.createElement("em");
      // Say what EACH layout has. "home-demo, wide layout only" left you to
      // work out whether that named where the value is set or where it applies,
      // and said it in a vocabulary the sidebar does not use.
      const plain = (v) => (typeof v === "string" ? v : JSON.stringify(v));
      // Written out rather than calling isSet: _renderForm declares its own
      // isSet over a FIELD, and a name that means two things in one file is
      // one refactor away from resolving to the wrong one.
      const on = (v) => (v === undefined || v === null || v === "" ? "not set" : plain(v));
      em.textContent = `${on(c.desktop)} on Desktop, ${on(c.mobile)} on Mobile`;
      label.appendChild(em);

      const settle = (value, why) => {
        pairWrite(pair, c.room, c.key, value);
        pair.conflicts = pairConflicts(pair);
        this._log(`${c.key}: kept ${JSON.stringify(value)} (${why}) in both layouts`, "ok");
        this._markDirty();
        this._renderForm();
        // The last one settled takes the whole notice with it, and the preview
        // rises into the space rather than jumping into it.
        if (!pair.conflicts.length) this._closeReconcile();
        else this._renderReconcile();
      };

      const only = c.kind === "onlyDesktop" ? c.desktop : c.mobile;
      // "Keep this" asked you to work out what "this" was. Name them.
      this._noticeRow(rows, label, c.kind === "differs"
        ? [["Keep Desktop", () => settle(c.desktop, "from Desktop")],
           ["Keep Mobile", () => settle(c.mobile, "from Mobile")]]
        : [["Use on both", () => settle(only, "the only value set")],
           ["Clear", () => settle(undefined, "cleared")]]);
    });

    if (list.length > 4) {
      const more = document.createElement("div");
      more.className = "rrow rdone";
      more.textContent = `and ${list.length - 4} more, listed in the log below`;
      rows.appendChild(more);
    }

    // Only once, and only if the panel is already up: on a fresh load the
    // entrance owns the timing and calls _revealNotice when it is done.
    if (this._entered && !this._reconcileSeen) {
      this._reconcileSeen = true;
      this._playNoticeIn();
    }
  }

  _playNoticeIn() {
    const box = this.$("reconcile");
    if (!box || box.hidden) return;
    box.classList.remove("pending");
    box.classList.add("arriving");
    box.addEventListener("animationend",
      () => box.classList.remove("arriving"), { once: true });
  }

  // Last, after everything the panel drew for itself. Chained to the entrance's
  // own animations rather than a matching delay, so it stays correct when the
  // stagger changes.
  _revealNotice(after) {
    const box = this.$("reconcile");
    if (!box || box.hidden) return;
    this._reconcileSeen = true;
    const go = () => this._playNoticeIn();
    if (!after || !after.length) return go();
    Promise.all(after.map((a) => a.finished.catch(() => {}))).then(go, go);
  }

  // Every key the form actually offers a control for, repeats expanded. A
  // conflict the panel cannot edit is not something to put a button next to.
  _editableKeys() {
    if (this._editKeys) return this._editKeys;
    const out = new Set();
    SECTIONS.forEach((sec) => sectionFields(sec).forEach((f) => out.add(f.key)));
    this._editKeys = out;
    return out;
  }

  // Collapse it and let the preview rise into the space, the same way a section
  // folds. box-sizing is pinned to border-box: offsetHeight IS the border box,
  // and animating it on a content-box element overshoots by the padding.
  _closeReconcile() {
    const box = this.$("reconcile");
    if (!box || box.hidden) return;
    const gone = () => {
      box.hidden = true;
      box.innerHTML = "";
      box.style.overflow = "";
      box.style.boxSizing = "";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return gone();
    const from = box.offsetHeight;
    const mb = getComputedStyle(box).marginBottom;
    box.style.boxSizing = "border-box";
    box.style.overflow = "clip";
    const a = box.animate(
      [{ height: from + "px", marginBottom: mb, opacity: 1 },
       { height: "0px", marginBottom: "0px", opacity: 0 }],
      { duration: RT(300), easing: EASE }
    );
    a.finished.then(gone, gone);
  }

  // Collapse it and let the preview rise into the space, the same way a section
  // folds. box-sizing is pinned to border-box: offsetHeight IS the border box,
  // and animating it on a content-box element overshoots by the padding.
  _closeReconcile() {
    const box = this.$("reconcile");
    if (!box || box.hidden) return;
    const gone = () => {
      box.hidden = true;
      box.innerHTML = "";
      box.style.overflow = "";
      box.style.boxSizing = "";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return gone();
    const from = box.offsetHeight;
    const mb = getComputedStyle(box).marginBottom;
    box.style.boxSizing = "border-box";
    box.style.overflow = "clip";
    const a = box.animate(
      [{ height: from + "px", marginBottom: mb, opacity: 1 },
       { height: "0px", marginBottom: "0px", opacity: 0 }],
      { duration: RT(300), easing: EASE }
    );
    a.finished.then(gone, gone);
  }

  // The label the form gives a key, so a row reads like the field it is about
  // rather than like a variable name.
  _fieldLabelFor(key) {
    for (const sec of SECTIONS) {
      const f = sectionFields(sec).find((x) => x.key === key);
      if (f) return f.label;
    }
    return null;
  }

  // Where a shared field goes on the phone half. The wide room is already
  // written by the time this runs.
  _mirrorToPair(key, value, rooms) {
    const pair = this._pair;
    if (!pair || pair.safe === false) return 0;
    const dRooms = (pair.desktop.compact || {}).rooms || [];
    let n = 0;
    (rooms || []).forEach((r) => {
      const idx = dRooms.indexOf(r);
      if (idx < 0) return;
      n += pairWriteMobile(pair, idx, key, value);
    });
    return n;
  }

  async _save() {
    const s = this._state;
    if (!s) return false;
    let ok = false;
    const url_path = this._dashUrl;

    let templates = s.templates;
    let extras = s.extras;
    let scaffold = s.scaffold;
    let adopted = [];
    try {
      const bundle = await this._bundleOnce(true);
      const r = refreshTemplates(s.templates, bundle.templates);
      templates = r.templates;
      adopted = r.adopted;
      extras = { ...s.extras };
      extras[FINGERPRINT_KEY] = r.prints;
      if (r.updated || r.added) {
        this._log(`refreshed ${r.updated} template(s)` + (r.added ? `, added ${r.added}` : ""), "ok");
      }
      // The nav card lives in the scaffold, not in button_card_templates, so
      // refreshTemplates never reached it and a fix sat in the bundle forever.
      const bnav = s.surface !== "mobile" && bundle.scaffold && bundle.scaffold.nav;
      if (bnav && stable(withoutRoutes(bnav)) !== stable(withoutRoutes(s.scaffold.nav))) {
        scaffold = { ...s.scaffold, nav: clone(bnav) };
        this._log("refreshed the navigation card", "ok");
      }
    } catch (e) {
      this._log("could not refresh templates: " + e.message, "warn");
    }

    // Before the build, so the derived slots are real config: they round-trip,
    // they show up in the panel, and you can edit or clear them like anything
    // else you set yourself.
    const mobile = s.surface === "mobile";

    if (!mobile) {
      const derived = deriveEnergyRooms(s.compact.rooms);
      if (derived) this._log(`energy: derived ${derived} room sub-badge(s)`, "ok");
      else if (energySubsAuto(s.compact.rooms)) {
        this._log("energy: no sub-badges - no other room has Cost this month set", "warn");
      }
    }

    const built = expandAny(s, { scaffold, extras, templates });

    // Nav routes are derived from the rooms, so re-deriving them on every save
    // repairs dashboards written before the whole-config retarget existed.
    let cfg = built;
    if (!mobile) {
      const scenes = (this._navNode() || { routes: [] }).routes
        .filter((r) => !r.url)
        .map(upgradeNavExtra);
      const fixed = retargetRoutes(built, url_path, s.compact.rooms, scenes);
      cfg = fixed.config;
      applyScenePick(cfg, s.compact.rooms);
      applyKiosk(cfg, s.compact.rooms);
    }
    // Marks this dashboard as the one the panel manages. hemma_room shows its
    // settings button only where this is set, so the YAML dashboard - which
    // loads the same shared templates straight off disk - never gets one.
    if (!mobile) {
      (s.compact.rooms || []).forEach((r) => { r.variables.hemma_ui_managed = true; });
      (cfg.views || []).forEach((v) => {
        const hero = (v.cards || [])[0];
        if (hero && hero.variables) hero.variables.hemma_ui_managed = true;
      });
    }

    // Fingerprint as SAVED, not as bundled: the retarget above rewrites nav
    // routes, so an earlier print describes a value never on disk and the
    // template then looks hand-edited forever.
    if (adopted.length && cfg[FINGERPRINT_KEY]) {
      const saved = cfg.button_card_templates || {};
      adopted.forEach((k) => {
        if (saved[k] !== undefined) cfg[FINGERPRINT_KEY][k] = hashStr(stable(saved[k]));
      });
    }
    const stale = mobile ? 0
      : (JSON.stringify(built).match(/\/dashboard-hemma\//g) || []).length;
    if (stale) this._log(`repaired ${stale} navigation link(s) pointing elsewhere`, "warn");

    // The phone half, rebuilt from the same state the mirrored edits went into
    // and given the same refreshed templates. Built BEFORE either write: a
    // failure here must not leave one dashboard saved and the other not.
    const pair = this._pair;
    let mcfg = null;
    if (pair && pair.safe !== false) {
      try {
        const st = syncPairTiles(pair);
        if (st.synced) this._log(`phone layout: ${st.synced} tile(s) kept in step`, "ok");
        if (st.added) this._log(`phone layout: ${st.added} tile(s) copied across`, "ok");
        if (st.dropped) this._log(
          `phone layout: ${st.dropped} tile(s) with nothing configured here removed`, "ok");
        const np = syncPresenceOverlay(pair);
        if (np) this._log(`phone People popup: ${np} person card(s)`, "ok");
        // Scenes is a nav route on the wide half and three cards on the phone,
        // so the switch has to build or remove them rather than just being read.
        const scOn = this._scenesOn();
        syncScenesMobile(pair, scOn);
        this._log(`phone Scenes: ${scOn ? "on" : "off"}`, "ok");
        // Cameras have no tile unless something makes one, and without a tile
        // the Security filter has nothing to show for them.
        const nc = syncCamerasMobile(pair, this._hass);
        if (nc) this._log(`phone Cameras tile: ${nc} camera(s)`, "ok");
        st.unmatched.slice(0, 6).forEach((u) => this._log(
          `phone tile "${u.tile}" in ${u.section} has no match here - left as it is`, "warn"));
        const mextras = { ...clone(pair.mobile.extras) };
        mextras[FINGERPRINT_KEY] = extras[FINGERPRINT_KEY];
        mcfg = expandAny(pair.mobile, { extras: mextras, templates });
      } catch (e) {
        this._status("phone layout could not be rebuilt: " + e.message, "err");
        this._log("phone layout not saved: " + e.message, "err");
        return false;
      }
    }

    this._saving = true;
    this._markDirty();
    try {
      await this._hass.callWS({ type: "lovelace/config/save", url_path, config: cfg });
      this._raw = clone(cfg);
      this._log(`saved  ${JSON.stringify(cfg).length.toLocaleString()} bytes`, "ok");
      if (mcfg) {
        await this._hass.callWS({
          type: "lovelace/config/save", url_path: pair.mobileUrl, config: mcfg,
        });
        pair.mobileRaw = clone(mcfg);
        this._log(`saved phone layout  ${JSON.stringify(mcfg).length.toLocaleString()} bytes`, "ok");
      }
      this._clean = this._print();
      this._markDirty();
      this._status("");
      this._saveFlash();
      ok = true;
    } catch (e) {
      this._status("save failed: " + e.message, "err");
      this._log("save failed: " + e.message, "err");
    }
    this._saving = false;
    this._markDirty();
    return ok;
  }

  _isDirty() {
    return !!this._clean && this._print() !== this._clean;
  }

  // The way out of edit mode, and the counterpart to the dashboard's own
  // "Edit dashboard". Commits first so nothing is lost crossing over, and
  // stays put if the write failed - the log already says why.
  async _done() {
    const btn = this.$("donebtn");
    if (btn && btn.disabled) return;
    if (this._isDirty()) {
      if (btn) btn.disabled = true;
      const ok = await this._save();
      if (btn) btn.disabled = false;
      if (!ok) return;
    }
    this._openDash(true);
  }

  // ── forms ─────────────────────────────────────────────────────────────────

  // What "unsaved" means. Templates are only ever refreshed inside _save, so
  // they cannot drift while editing and stay out of a per-keystroke print.
  _print() {
    const s = this._state;
    if (!s) return "";
    const p = this._pair;
    // The phone SCAFFOLD as well as its rooms and chrome: the background card
    // is the view's shell and lives there, so without it setting the hero photo
    // wrote the state, left Save grayed out, and lost the change on reload.
    return stable([s.compact, s.scaffold, s.extras, s.chrome,
      p && p.safe !== false
        ? [p.mobile.compact, p.mobile.chrome, p.mobile.scaffold] : null]);
  }

  // A Save with nothing to do is disabled, not pressable-and-silent. The blue
  // .dirty state and the enabled state are one fact, so one place owns both.
  // Two things outrank dirtiness: a save in flight, and a dashboard judged
  // unsafe to write.
  _markDirty() {
    const b = this.$("save");
    if (!b) return;
    const dirty = !!this._clean && this._print() !== this._clean;
    b.classList.toggle("dirty", dirty);
    b.disabled = !!this._saveBlocked || !!this._saving || !dirty;
  }

  // The rail's head and the toolbar are halves of one titlebar, so the burger
  // and wordmark belong to whichever exists. MOVED, not rebuilt: every pill's
  // drag handler is a closure and the morph animates from where they are.
  _placeRooms(strip) {
    if (strip === undefined) strip = isNarrow(this);
    const root = this.shadowRoot;
    const rooms = this.$("rooms");
    const rail = root.querySelector(".rail");
    const head = root.querySelector(".railhead");
    const bar = root.querySelector(".toprow");
    const burger = root.querySelector(".burger");
    if (!rooms || !rail || !head || !bar || !burger) return;
    const want = strip ? "bar" : "rail";
    if (this._chromeAt === want) return;
    this._chromeAt = want;
    if (strip) {
      const spacer = bar.querySelector(".spacer");
      bar.insertBefore(burger, bar.firstChild);
      bar.insertBefore(rooms, spacer);
    } else {
      head.appendChild(burger);
      // Back above the Dashboards group, not appended past it.
      rail.insertBefore(rooms, root.getElementById("g-dashes"));
    }
    // The toolbar just gained or lost a row, and every column's top offset is
    // measured off it.
    if (this._syncTop) this._syncTop();
  }

  _renderTabs() {
    this._markDirty();
    const rooms = this._state.compact.rooms;
    const before = this._tabRects();
    const prevSel = this._prevSel;
    const el = document.createElement("div");
    el.className = "tabs";

    rooms.forEach((r, i) => {
      const t = document.createElement("div");
      t.className = "tab" + (i === this._room ? " on" : "");
      t.dataset.k = "room-" + r.path;

      // Home draws one warm glyph for every room: it says "a room", not which
      // one. Hidden in the strip, where the pills have no width to spare.
      const ico = document.createElement("span");
      ico.className = "roomglyph";
      ico.style.setProperty("--i", "url('" + iconUrl(roomGlyph(r.name, r)) + "')");
      t.appendChild(ico);

      const label = document.createElement("span");
      label.className = "tablabel";
      label.textContent = r.name || r.path;
      t.appendChild(label);

      // On every room, not just the selected one. In the rail it is invisible
      // until the pointer arrives, so any room can be renamed without being
      // selected first; the strip parks it on the selected pill as before.
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
      caret.onpointerdown = (ev) => ev.stopPropagation();
      caret.onclick = (ev) => { ev.stopPropagation(); this._roomMenu(t, i); };
      t.appendChild(caret);
      t.appendChild(this._minusFor(() => this._roomMenuAction("delete", i)));
      // Anchored to the ROW: the chevron no longer renders, so anchoring to it
      // put the menu in the window's top-left corner.
      t.oncontextmenu = (ev) => { ev.preventDefault(); this._roomMenu(t, i); };

      // Drag to reorder. A press that never moves is treated as a tap.
      t.onpointerdown = (ev) => {
        if (ev.button) return;
        // The row scrolls sideways and the browser takes the pointer to do it, so
        // touch drags on a hold instead. A swipe still scrolls: it moves before
        // the hold fires.
        const touch = ev.pointerType === "touch" && isPhone(this);
        let canDrag = !touch;
        let lifted = false, holdTimer = 0;
        const tabs = [...el.querySelectorAll(".tab")];
        const rects = tabs.map((p2) => p2.getBoundingClientRect());
        // Down the rail, across the strip: read off the pills themselves.
        const ax = tabAxis(rects);
        let start = ev[ax.client];
        let last = ev[ax.client];
        let moved = false, target = i, shown = i;

        // One track only. A wrapped strip - or a rail somehow showing two
        // columns - has nothing single to slide along.
        const lanes = new Set(rects.map((r) => Math.round(r[ax.cross])));
        const gap = rects.length > 1
          ? Math.max(0, rects[1][ax.pos] - (rects[0][ax.pos] + rects[0][ax.size]))
          : 8;

        const shiftTo = (to) => {
          if (to === shown || lanes.size > 1) return;
          shown = to;
          const at = tabSlots(rects, i, to, ax, gap);
          rects.forEach((r2, orig) => {
            if (orig === i) return;
            const el2 = tabs[orig];
            el2.style.transition = "transform " + (RT(180) / 1000) + "s " + EASE;
            el2.style.transform = ax.move + "(" + (at[orig] - r2[ax.pos]) + "px)";
          });
        };

        // touch-action is latched when the finger lands, so the scroll can only
        // be called off by preventing the move itself. Nothing has scrolled yet -
        // the finger was still through the hold - so this is still allowed.
        const eatTouch = (e3) => { if (lifted && e3.cancelable) e3.preventDefault(); };

        if (touch) {
          holdTimer = setTimeout(() => {
            holdTimer = 0;
            lifted = true;
            canDrag = true;
            start = last;   // reorder from where the finger is, not where it landed
            t.classList.add("dragging");
            try { t.setPointerCapture(ev.pointerId); } catch (err) { /* not captured */ }
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* no haptics */ } }
          }, 380);
          window.addEventListener("touchmove", eatTouch, { passive: false });
        }

        const onMove = (e2) => {
          last = e2[ax.client];
          // Any real movement before the hold fires is a swipe, not a lift.
          if (holdTimer && Math.abs(last - start) > 8) {
            clearTimeout(holdTimer); holdTimer = 0;
          }
          if (!canDrag) return;
          const d = last - start;
          if (!moved) {
            if (Math.abs(d) < (lifted ? 0 : 5)) return;
            moved = true;
            t.classList.add("dragging");
            try { t.setPointerCapture(ev.pointerId); } catch (err) { /* not captured */ }
          }
          t.style.transform = ax.move + "(" + d + "px)";
          target = rects.reduce(
            (n, r2, k) => (k !== i && last > r2[ax.pos] + r2[ax.size] / 2 ? n + 1 : n), 0);
          target = Math.max(0, Math.min(rooms.length - 1, target));
          shiftTo(target);
        };

        // The scroller taking over ends the gesture with a cancel, not an up:
        // clean up without treating it as a tap.
        const unbind = () => {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; }
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("touchmove", eatTouch);
          t.classList.remove("dragging");
        };

        const onCancel = () => {
          unbind();
          tabs.forEach((p2) => { p2.style.transition = ""; p2.style.transform = ""; });
        };

        const onUp = () => {
          const wasLifted = lifted;
          unbind();

          if (!moved) {
            // A hold that lifted and went nowhere is a canceled reorder, not a
            // tap - switching rooms on release would be a surprise.
            if (!wasLifted && i !== this._room) {
              this._room = i; this._renderTabs(); this._renderForm();
            }
            return;
          }

          // Measure with the shifts still applied, so the rebuild starts from
          // the gap instead of snapping back first.
          const before = this._tabRects();
          tabs.forEach((p2) => { p2.style.transition = ""; p2.style.transform = ""; });

          if (target === i) { requestAnimationFrame(() => this._playTabs(before)); return; }
          const [x] = rooms.splice(i, 1);
          rooms.splice(target, 0, x);
          this._room = target;
          this._renderTabs();
          this._renderForm();
          requestAnimationFrame(() => this._playTabs(before));
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
      };

      el.appendChild(t);
    });

    const add = document.createElement("button");
    add.className = "tabadd";
    add.title = "Add room";
    add.setAttribute("aria-label", "Add room");
    add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
      + '<span class="addlabel">Add room</span>';
    add.onclick = () => this._addRoom();

    const host = this.$("rooms");
    const old = host.querySelector(".tabs");
    if (old) old.replaceWith(el); else host.prepend(el);
    // A sibling of the list, not the last thing in it: the rail pins it to its
    // foot while the rooms above scroll, and in the strip both sit in one
    // scroller so it travels with the pills.
    const oldAdd = host.querySelector(".tabadd");
    if (oldAdd) oldAdd.replaceWith(add); else host.appendChild(add);

    // Selecting a room grows its tab by the caret's width; grow into it rather
    // than snapping, and slide the rest along.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && before.size) {
      // The pill's width animates for real. Stretching it with scaleX distorted
      // its rounded ends and needed the label counter-scaled, and those two
      // never quite cancel - that is what read as jerky.
      const spring = { duration: RT(340), easing: "cubic-bezier(.34,1.32,.5,1)" };
      el.querySelectorAll(".tab[data-k]").forEach((t) => {
        const b = before.get(t.dataset.k);
        if (!b) return;
        const a = t.getBoundingClientRect();
        const dx = b.left - a.left;
        const dy = b.top - a.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(b.width - a.width) < 1) return;
        t.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)`, width: b.width + "px" },
            { transform: "none", width: a.width + "px" },
          ],
          spring
        );
      });
    }
    this._prevSel = this._room;
    // The bar's height comes from these pills, so the offset is only knowable
    // once they exist. Settle it before the form measures anything.
    if (this._syncTop) this._syncTop();
  }

  _tabRects() {
    const m = new Map();
    this.shadowRoot.querySelectorAll(".tab[data-k]").forEach((c) => m.set(c.dataset.k, c.getBoundingClientRect()));
    return m;
  }

  _playTabs(before) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.shadowRoot.querySelectorAll(".tab[data-k]").forEach((c) => {
      const b = before.get(c.dataset.k);
      if (!b) return;
      const a = c.getBoundingClientRect();
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: RT(300), easing: EASE });
    });
  }

  _moveRoom(from, to) {
    const rooms = this._state.compact.rooms;
    if (to === from || to < 0 || to >= rooms.length) return;
    const before = this._tabRects();
    const [x] = rooms.splice(from, 1);
    rooms.splice(to, 0, x);
    this._room = to;
    this._renderTabs();
    this._renderForm();
    requestAnimationFrame(() => this._playTabs(before));
  }

  async _addRoom() {
    const rooms = this._state.compact.rooms;
    const name = await this._ask({ title: "New room", value: "", placeholder: "Kitchen", confirmLabel: "Add" });
    if (!name) return;
    const path = slug(name);
    if (rooms.some((r) => r.path === path)) {
      return this._status('a room with path "' + path + '" already exists', "err");
    }
    rooms.push(blankRoom(name.trim(), path, "home-demo"));
    this._room = rooms.length - 1;
    this._renderTabs();
    this._renderForm();
  }

  // The rename and delete a room row offers. Shared with the Rooms section
  // menu, so the two cannot come to disagree about what deleting means.
  async _roomMenuAction(id, i) {
    const rooms = this._state.compact.rooms;
      const r = rooms[i];
      if (id === "rename") {
        const name = await this._ask({ title: "Rename room", value: r.name || r.path, confirmLabel: "Rename" });
        if (!name) return;
        r.name = name;
        this._renderTabs();
        this._renderForm();
        return;
      }
      if (id === "delete") {
        // Belt and braces - the menu already dims this, but the guard is what
        // makes zero rooms unreachable rather than merely unoffered.
        if (rooms.length < 2) return;
        const yes = await this._ask({
          title: 'Delete "' + (r.name || r.path) + '"?',
          message: "Its badges and tiles are removed with it. This cannot be undone.",
          confirmLabel: "Delete", destructive: true,
        });
        if (!yes) return;

        const done = () => {
          rooms.splice(i, 1);
          this._room = Math.max(0, i - 1);
          this._renderTabs();
          this._renderForm();
        };

        const tab = this.shadowRoot.querySelector('.tab[data-k="room-' + r.path + '"]');
        if (!tab || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return done();

        // Collapse to nothing, so the rooms after it close the gap - along
        // the rail, or across the strip.
        const down = !!(tab.closest && tab.closest(".rail"));
        tab.style.transformOrigin = down ? "center top" : "left center";
        tab.style.overflow = "hidden";
        const open = down ? { maxHeight: tab.offsetHeight + "px" }
                          : { maxWidth: tab.offsetWidth + "px" };
        const shut = down ? { maxHeight: "0px" } : { maxWidth: "0px" };
        tab.animate(
          [
            Object.assign({ transform: "scale(1)", opacity: 1 }, open),
            Object.assign({ transform: "scale(0.82)", opacity: 0 }, shut),
          ],
          { duration: 260, easing: "cubic-bezier(.4,0,.9,.6)" }
        ).finished.then(done, done);
      }
  }

  // Auto is the ABSENCE of a value, so picking it clears the key and the icon
  // follows the name again. Storing the resolved name freezes it on a rename.
  _roomIconMenu(anchor, i) {
    const r = this._state.compact.rooms[i];
    const chosen = (r.variables || {}).room_icon || "";
    const auto = autoRoomGlyph(r.name);
    this._menuAt(anchor, [
      { id: "", label: "Automatic", glyph: auto, checked: !chosen, group: null },
      ...ROOM_ICON_CHOICES.map((g) => ({
        id: g, label: roomIconLabel(g), glyph: g, checked: chosen === g,
        group: "Icons",
      })),
    ], (id) => {
      if (!id) {
        if (r.variables) delete r.variables.room_icon;
        // An empty variables object is not the same as none. Leaving {} behind
        // writes a key the file never carried and fails the round trip.
        if (r.variables && !Object.keys(r.variables).length) delete r.variables;
      } else {
        if (!r.variables) r.variables = {};
        r.variables.room_icon = id;
      }
      this._renderTabs();
      this._renderForm();
    });
  }

  _roomMenu(anchor, i) {
    const rooms = this._state.compact.rooms;
    this._menuAt(anchor, [
      { id: "rename", label: "Rename\u2026" },
      { id: "icon", label: "Change Icon\u2026" },
      { id: "delete", label: "Delete room", group: null,
        disabled: rooms.length < 2,
        why: "A dashboard needs at least one room." },
    ], async (id) => {
      // The picker replaces this menu rather than nesting inside it, so it
      // opens on the next frame - _menuAt closes whatever is open first, and
      // opening the new one in the same tick would close it again.
      if (id === "icon") return requestAnimationFrame(() => this._roomIconMenu(anchor, i));
      return this._roomMenuAction(id, i);
    });
  }

  // Above PANEL_NARROW the form column scrolls. Below it the column is overflow:visible
  // and the page scrolls instead - and the page is outside this shadow root, so
  // pane.scrollTop there reads 0 and writes nothing.
  _scroller() {
    const pane = this.$("pane");
    const own = getComputedStyle(pane).overflowY;
    if (own === "auto" || own === "scroll") return pane;
    for (let a = pane.parentNode; a; a = a.parentNode || a.host) {
      if (a.nodeType !== 1) continue;
      const ov = getComputedStyle(a).overflowY;
      if ((ov === "auto" || ov === "scroll") && a.scrollHeight > a.clientHeight + 1) return a;
    }
    return document.scrollingElement || document.documentElement;
  }

  // scrollIntoView scrolls EVERY scrollable ancestor, including whatever HA
  // wraps this panel in - which slides the panel up under its own fixed header
  // and leaves a strip of nothing below it. Move our own scroller only.
  _scrollTo(el, center) {
    const sc = this._scroller();
    const root = document.scrollingElement || document.documentElement;
    const view = sc === root ? { top: 0, h: window.innerHeight }
      : { top: sc.getBoundingClientRect().top, h: sc.clientHeight };
    const r = el.getBoundingClientRect();
    const at = sc.scrollTop + (r.top - view.top);
    const top = center ? at - (view.h - r.height) / 2 : at - (this._topH || 0) - 10;
    sc.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  _renderForm() {
    this._disarmRow();
    const room = this._state && this._state.compact.rooms[this._room];
    this._markDirty();
    if (!room) return;

    // The photo list is fetched after the first paint. Without this the preview
    // renders with no room photo until something else redraws it, which is why
    // it only appeared after switching rooms and back.
    if (!this._imgsLoaded && !this._imgsRedraw) {
      this._imgsRedraw = true;
      this._images().then(() => this._renderForm()).catch(() => {});
    }
    const pane = this.$("pane");
    const beforeRects = this._captureCards();
    // Rebuilding the column resets the scroll. Adding a field should never
    // throw you back to the top - but switching room is a new subject, so that
    // one starts at the top on purpose.
    this._switches = [];
    // Opening one closes the rest, which needs the ELEMENTS, not just the keys -
    // sections without a switch are not in _switches, and tiles never were.
    this._foldables = new Map();
    if (!this._folded) {
      this._folded = new Set();
      this._foldBoot = true;
    }
    // Every card starts folded, so the panel opens as a scannable list. Every
    // room is seeded at once, so switching room does not spill the previous
    // room's open cards into it.
    if (this._foldBoot && this._state) {
      this._foldBoot = false;
      (this._state.compact.rooms || []).forEach((r) => {
        this._foldKeys(r).forEach((k) => this._folded.add(k));
      });
    }
    const sc = this._scroller();
    const sameRoom = this._scrollRoom === room.path;
    this._scrollRoom = room.path;
    const keepScroll = sameRoom ? sc.scrollTop : 0;
    // On a phone the page is the scroller, so emptying the column collapses the
    // document, the browser clamps the scroll to the new height, and restoring
    // it afterwards is already too late. Hold the height across the rebuild.
    const floor = sc === pane ? 0 : pane.offsetHeight;
    if (floor) pane.style.minHeight = floor + "px";
    pane.innerHTML = "";
    this._renderSurfaceNote(pane);
    this._setBackdrop();
    const ids = Object.keys(this._hass.states);

    // A field shows when it holds a value, when it is part of the room's
    // identity, or when it was revealed with the section's + button.
    const isSet = (f) => {
      const v = f.key === "__name" ? room.name : room.variables[f.key];
      return v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);
    };
    // A unit shows when any of its fields holds a value, or when it was
    // revealed with +, so an entity and its label always appear together.
    const unitLive = (u) => u.fields.some((f) => f.always || isSet(f))
      || this._revealed.has(room.path + "|" + u.id);
    // A unit made entirely of automatic fields (a Unit picker) or entirely of
    // optional overrides is never something you "add" - it follows the group.
    const autoUnit = (u) => u.fields.every((f) => f.auto);
    const advUnit = (u) => u.fields.every((f) => f.advanced);
    const addable = (u) => !autoUnit(u) && !advUnit(u);
    // Some units only make sense once another one exists. The test is whether
    // that unit is on the card, not whether it has a value yet - you add a lock
    // group before you have picked any locks. Gating the offer rather than the
    // row means anything already set still shows.
    const met = (u, units) => u.fields.every((f) => {
      if (!f.needs) return true;
      const owner = units.find((x) => x.id === f.needs);
      return owner ? unitLive(owner) : isSet({ key: f.needs });
    });
    const sectionLive = (sec) => unitsOf(sec).some((u) => addable(u) && unitLive(u));
    const ordOf = (f) => (f.ord === undefined ? 50 : f.ord);
    // A multi-kind slot names what it holds: the kind chosen when it was added,
    // or failing that the domain of whatever entity is in it.
    const kindLabel = (f) => {
      if (!f.repeatKinds || !f.domains) return null;   // the entity row, not its label
      const pinned = this._slotKind.get(room.path + "|" + unitOf(f));
      let kind = pinned && f.repeatKinds.find((k) => k.id === pinned);
      if (!kind) {
        const dom = String(room.variables[f.key] || "").split(".")[0];
        kind = dom && f.repeatKinds.find((k) => k.domains.includes(dom));
      }
      return kind ? kind.label : null;
    };
    const shownFields = (sec) => {
      const on = sectionLive(sec);
      const live = new Set(unitsOf(sec)
        .filter((u) => unitLive(u) || (on && autoUnit(u)))
        .map((u) => u.id));
      return sectionFields(sec)
        .filter((f) => live.has(unitOf(f)))
        .map((f, i) => [f, i])
        .sort((a, b) => (ordOf(a[0]) - ordOf(b[0])) || (a[1] - b[1]))
        .map(([f]) => f);
    };

    const sheet = pane;
    const mount = this.$("mapmount");
    // Rebuilding the preview is what you see flicker, so only do it when
    // something it draws from has actually changed.
    const sig = JSON.stringify([
      room.path, room.name, room.variables, room.tiles,
      // The phone filter changes what the mock DRAWS, so a change to it has to
      // count as the preview being out of date. Without it the tap rebuilt by
      // hand and _select rebuilt again a moment later, over the top.
      this._phoneFilter || null,
      // Scenes is a nav route, not a room variable - without it here the switch
      // changed the form and the preview kept drawing the old tab.
      this._scenesOn(), this._miniSize, (this._imgs || []).length,
    ]);
    if (mount && !isPhone(this) && this._mapSig !== sig) {
      this._mapSig = sig;
      // Measures on commit, rather than waiting a frame with it hidden.
      this._swapMap(mount, room);
    }

    // The inspector shows ONE group. Three stacked panels, each folding, each
    // holding rows that fold again, was three levels of disclosure; Keynote's
    // inspector has one. The switcher replaces the outermost level, and unlike
    // a fold it never scrolls away.
    if (!this._group || !GROUPS.some((g) => g.id === this._group)) {
      this._group = GROUPS[0].id;
    }
    // Built ONCE and re-attached: the traveling pill needs the control to survive
    // its own pick, and a rebuild leaves the animation on an element that is gone
    // a frame later.
    if (!this._navEl) {
      const seg0 = document.createElement("div");
      seg0.className = "seg groupseg";
      seg0.setAttribute("role", "group");
      seg0.setAttribute("aria-label", "Which part of the room to edit");
      seg0.appendChild(document.createElement("span")).className = "segthumb";
      GROUPS.forEach((g) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "segopt";
        b.dataset.group = g.id;
        b.textContent = g.label;
        seg0.appendChild(b);
      });
      // One nav row, holding the switcher OR the back bar - never both, and
      // never one above the other. Opening a section used to insert a bar above
      // the group and push the whole list down a row.
      const nav0 = document.createElement("div");
      nav0.className = "navrow";
      nav0.appendChild(seg0);
      this._navEl = nav0;
      this._segEl = seg0;
      this._wireSeg(seg0, "group", this._group, (v) => {
        const forward = GROUPS.findIndex((g) => g.id === v)
          > GROUPS.findIndex((g) => g.id === this._group);
        this._group = v;
        // A selection belongs to the group it came from.
        this._sel = null;
        this._navDir = forward ? 1 : -1;
        this._renderForm();
      });
    }
    const nav = this._navEl;
    const seg = this._segEl;
    // The head is outside the pane, so emptying the pane no longer detaches
    // it - it is mounted once and simply stays there.
    const insphead = this.shadowRoot.querySelector(".insphead");
    if (insphead && nav.parentNode !== insphead) insphead.appendChild(nav);
    [...nav.querySelectorAll(".detailbar")].forEach((b) => b.remove());
    if (!seg.parentNode) nav.appendChild(seg);
    // A selection can change the group without going through the switcher.
    [...seg.querySelectorAll(".segopt")].forEach((b) => {
      b.classList.toggle("on", b.dataset.group === this._group);
    });

    const bandFor = {};
    const bandFor_head = {};
    GROUPS.forEach((g) => {
      const band = document.createElement("div");
      band.className = "band";
      band.id = "band-" + g.id;
      // Built either way: the tiles renderer, the fold keys and the preview's
      // jump targets all reach for these by id. Only the chosen one is shown.
      if (g.id !== this._group) band.style.display = "none";

      // The group's header. One place to say what a badge or a tile actually
      // IS, which nothing in the panel said before.
      const H = this._headFor(g, room);
      if (H.blurb || H.label) {
        const gh = document.createElement("div");
        gh.className = "grouphead";
        if (H.icon) {
          const gi = document.createElement("span");
          gi.className = "sicon" + (H.raw ? " raw" : "");
          gi.style.setProperty("--i", "url('" + iconUrl(H.icon) + "')");
          if (H.color) gi.style.setProperty("--sc", H.color);
          gh.appendChild(gi);
        }
        const gt = document.createElement("h3");
        gt.textContent = H.label;
        gh.appendChild(gt);
        // Only when there is one. A section pushed into has none now, and an
        // empty <p> still takes its line height - the icon would sit centered
        // against a row that is not there.
        if (H.blurb) {
          const gp = document.createElement("p");
          gp.textContent = H.blurb;
          gh.appendChild(gp);
        }
        bandFor_head[g.id] = gh;
      }

      const head = document.createElement("div");
      head.className = "bandhead";
      head.style.display = "none";

      // Smart sort belongs to the row card, not to a room variable, so it goes
      // on the Tiles heading rather than into SECTIONS. hemma-smart-row already
      // reads `sort` - this only exposes it. It rides on room._row, which the
      // extractor preserves wholesale, so it round-trips with no schema change.
      if (g.id === "tiles") {
        const on = !(room._row && room._row.sort === false);
        const sw = document.createElement("button");
        sw.className = "sw";
        sw.type = "button";
        sw.setAttribute("role", "switch");
        sw.setAttribute("aria-checked", on ? "true" : "false");
        sw.setAttribute("aria-label", "Sort active tiles to the front");
        sw.title = on
          ? "Active tiles move to the front"
          : "Tiles stay in the order you set";
        const lab = document.createElement("span");
        lab.className = "bandtog";
        lab.textContent = "Smart Sort";
        // In place, never a rebuild: re-rendering swaps the button out from under
        // the press, so the transition has no old value and the :active widen is
        // stranded on the element being replaced.
        sw.onclick = () => {
          room._row = room._row || { type: "custom:hemma-smart-row" };
          const next = room._row.sort === false;
          if (next) delete room._row.sort; else room._row.sort = false;
          sw.setAttribute("aria-checked", next ? "true" : "false");
          sw.title = next
            ? "Active tiles move to the front"
            : "Tiles stay in the order you set";
          // The preview answers immediately, the way the row does when the
          // card is rebuilt with the new setting.
          this._applyMiniSort(true);
          this._markDirty();
        };
        // The heading it used to float on is gone, and a heading was never a
        // place for a control anyway. It rides above the tile list instead.
        // A setting ABOUT the list, so it follows the list rather than pushing
        // it down: its own group at the foot, with a line saying what it does.
        const strip = document.createElement("div");
        strip.className = "sortstrip";
        // No icon: in this list an icon identifies a TILE, so one here files the
        // setting among the things it governs.
        strip.appendChild(lab);
        const note = document.createElement("p");
        note.className = "sortnote";
        note.textContent = "Active tiles move to the front";
        strip.appendChild(note);
        strip.appendChild(sw);
        this._tileOptions = strip;
      }
      band.appendChild(head);

      const body = document.createElement("div");
      body.className = "bandbody";
      band.appendChild(body);

      const cols = document.createElement("div");
      cols.className = "cols";
      const a = document.createElement("div"); a.className = "col";
      cols.appendChild(a);
      // Beside the canvas there is only room for one column, so a section's
      // column preference collapses and SECTIONS order is the reading order.
      const b = a;
      body.appendChild(cols);

      sheet.appendChild(band);
      // Tiles hands its glass to the tilegrid, so _renderTiles places it.
      if (bandFor_head[g.id] && g.id !== "tiles") a.appendChild(bandFor_head[g.id]);
      bandFor[g.id] = { colA: a, colB: b, wA: 0, wB: 0, head: bandFor_head[g.id] };
    });

    // Columns alternate in declaration order and never move. Balancing by
    // content weight meant adding one field could throw a card into the other
    // column mid-edit; reading left-to-right now matches the dashboard order.
    const side = new Map();
    GROUPS.forEach((g) => {
      const slot = bandFor[g.id];
      let n = 0;
      SECTIONS.filter((sec) => sec.group === g.id).forEach((sec) => {
        if (sec.col) { side.set(sec, sec.col === "b" ? slot.colB : slot.colA); return; }
        // ORDERED, so one column like the tiles: alternating across two made
        // reading order and drag order two different things.
        if (g.id === "badges") { side.set(sec, slot.colA); return; }
        const i = n++;
        side.set(sec, g.lead ? (i ? slot.colB : slot.colA) : (i % 2 ? slot.colB : slot.colA));
      });
    });

    SECTIONS.forEach((sec) => {
      const fs = document.createElement("section");
      fs.className = "card";
      fs.dataset.k = sec.label;

      const visible = shownFields(sec);
      const units = unitsOf(sec);
      const hiddenUnits = units.filter((u) => !unitLive(u) && addable(u) && met(u, units)
        && !u.fields.every((f) => f.noAdd));

      const head = document.createElement("div");
      head.className = "chead";
      if (sec.icon) {
        const g = document.createElement("span");
        g.className = "sicon" + (sec.iconRaw ? " raw" : "");
        g.style.setProperty("--i", "url('" + iconUrl(sec.icon) + "')");
        if (sec.iconColor) g.style.setProperty("--sc", sec.iconColor);
        head.appendChild(g);
      }
      const h2 = document.createElement("h2");
      h2.textContent = sec.label;
      head.appendChild(h2);
      if (sec.blurb) {
        const p = document.createElement("p");
        p.className = "blurb";
        p.textContent = sec.blurb;
        head.appendChild(p);
      }

      // A reading preference, not config: session-lived, never written. Keyed on
      // the CARD, not room + card, or changing rooms re-collapses what you just
      // opened.
      const foldKey = sec.label;
      head.appendChild(this._foldButton(foldKey, head, fs, sec.label));
      // Only where the count can change: a fixed-slot section counts fields you
      // cannot add or remove. Those are exactly the ones with no `repeats`.
      const setCount = units.filter(unitLive).length;
      const showCount = setCount && sec.repeats && sec.repeats.length;
      if (showCount || sec.toggle) {
        const c = document.createElement("span");
        c.className = "count";
        // "Nothing set. Use + to add." is already the empty note's wording.
        c.textContent = showCount ? setCount + " set" : "";
        head.appendChild(c);
        // Filled in below, once the switch has told us which way it is set.
        this._countFor = this._countFor || new Map();
        this._countFor.set(sec.label, { el: c, set: showCount ? setCount + " set" : "" });
      }
      // Only the next free slot of a repeat is offered, so ten light slots read
      // as one "Light" entry. Both + buttons go through this.
      const offersFrom = (from) => {
        const out = [];
        const seenRepeat = new Set();
        from.forEach((u) => {
          const f0 = u.fields[0];
          if (f0.repeatOf) {
            if (seenRepeat.has(f0.repeatOf)) return;
            seenRepeat.add(f0.repeatOf);
            if (f0.repeatKinds) {
              f0.repeatKinds.forEach((k) => out.push({
                id: u.id + "@" + k.id, label: k.label, group: u.group,
                ord: ordOf(f0), seq: out.length,
              }));
            } else {
              out.push({
                id: u.id, label: f0.repeatLabel, group: u.group,
                ord: ordOf(f0), seq: out.length,
              });
            }
          } else {
            out.push({
              id: u.id, label: u.label, group: u.group,
              ord: ordOf(u.fields[0]), seq: out.length,
            });
          }
        });
        // Ungrouped first: the menu prints a heading when the group changes, so a
        // grouped entry sorting above an ungrouped one swallows everything below
        // it into that heading.
        return out.sort((x, y) =>
          (!!x.group - !!y.group) || (x.ord - y.ord) || (x.seq - y.seq));
      };
      const offered = offersFrom(hiddenUnits);

      const toggle = sec.toggle ? {
        get: () => room.variables[sec.toggle] !== false,
        // On is the default, so it is stored by absence rather than as true.
        set: () => {
          if (room.variables[sec.toggle] === false) delete room.variables[sec.toggle];
          else room.variables[sec.toggle] = false;
        },
      } : (sec.toggleFn === "scenes" ? {
        get: () => this._scenesOn(),
        set: () => {
          const on = !this._scenesOn();
          // Collapse it out of the preview first: the rebuild that follows is
          // what removes the elements, so an exit animation has to happen while
          // they are still there. Coming back is armed for the next build.
          if (!on) this._collapsePhoneScenes();
          else this._phoneScenesIn = true;
          this._setScenes(on);
        },
      } : (sec.toggleFn === "nowplaying" ? {
        // show_media is the master for the whole media subsystem, so a panel
        // switched on with it off would report on and render nothing.
        get: () => room.variables.show_media !== false && !!room.variables.show_now_playing,
        set: () => {
          if (room.variables.show_now_playing && room.variables.show_media !== false) {
            delete room.variables.show_now_playing;
          } else {
            room.variables.show_now_playing = true;
            if (room.variables.show_media === false) delete room.variables.show_media;
          }
        },
      } : null));

      if (toggle) {
        const on = toggle.get();
        const sw = document.createElement("button");
        sw.className = "sw";
        sw.type = "button";
        sw.setAttribute("role", "switch");
        sw.setAttribute("aria-checked", on ? "true" : "false");
        sw.setAttribute("aria-label", "Show " + sec.label + " on the dashboard");
        sw.title = on ? "Shown on the dashboard" : "Hidden on the dashboard";
        // In place, not a rebuild. Rebuilding gave the card a brand new
        // element, and a fresh element starts at its final computed value -
        // which is why the .off transitions declared below never once ran.
        sw.onclick = () => { toggle.set(); this._syncSwitches(); };
        head.appendChild(sw);
        fs.classList.toggle("off", !on);
        // The switch is not on the row any more, so the summary carries the
        // state: "Off", or what is set. Nothing is lost from the list.
        const cnt = (this._countFor || new Map()).get(sec.label);
        if (cnt) cnt.el.textContent = on ? cnt.set : "Off";
        // Off is DISABLED, not folded: .card.off dims the rows already, and
        // shutting it too left the fold key set so the content never came back.
        if (this._folded.has(foldKey)) fs.classList.add("shut");
        this._switches.push({ fs, sw, get: toggle.get, foldKey });
      }
      // A push list is a list: every card in it is shut, and the one you
      // pushed into is opened by the detail pass. Reading _folded here is what
      // left a section standing open in the list after you backed out of it.
      fs.classList.add("shut");

      const reveal = (raw) => {
        const [unitId, kindId] = String(raw).split("@");
        this._revealed.add(room.path + "|" + unitId);
        if (kindId) {
          this._slotKind.set(room.path + "|" + unitId, kindId);
          const src = sectionFields(sec).find((f) => unitOf(f) === unitId && f.repeatKinds);
          const kind = src && src.repeatKinds.find((k) => k.id === kindId);
          (kind && kind.also || []).forEach((extra) => this._revealed.add(room.path + "|" + extra));
        }
        // A folded card would hide the row that was just added.
        this._folded.delete(foldKey);
        this._renderForm();
      };
      if (offered.length) {
        const add = document.createElement("button");
        add.className = "plus";
        add.title = "Add a field";
        add.setAttribute("aria-label", "Add a field");
        add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
        // Tracked with the switch so it can be disabled in place: pointer-events
        // alone leaves it tabbable and still firing on Enter.
        const rec = this._switches[this._switches.length - 1];
        if (rec && rec.fs === fs) { rec.add = add; add.disabled = !rec.get(); }
        add.onclick = () => {
          // Shown even for one entry: the menu is the disclosure, and adding a
          // field without naming it leaves you working out what appeared.
          this._menuAt(add, offered, reveal);
        };
        head.appendChild(add);
      }
      fs.appendChild(head);

      if (sec.scope === "dashboard") {
        const rooms = this._state.compact.rooms;
        const drifted = sec.fields.filter((f) =>
          new Set(rooms.map((r) => JSON.stringify(r.variables[f.key] ?? null))).size > 1);
        if (drifted.length) {
          const w = document.createElement("div");
          w.className = "cdesc drift";
          w.textContent = "Rooms disagree on " + drifted.map((f) => f.label.toLowerCase()).join(", ")
            + ". Changing it here sets every room.";
          fs.appendChild(w);
        }
      }

      if (!visible.length && units.length) {
        const n = document.createElement("div");
        n.className = "empty-note";
        n.textContent = "Nothing set. Use + to add.";
        fs.appendChild(n);
      }

      // Dashboard-scoped writes go to EVERY room so nothing can drift between
      // views; reads come from the room on screen. A single field can be
      // dashboard-wide even where its section is not.
      const targets = (f) => ((sec.scope === "dashboard" || (f && f.scope === "dashboard"))
        ? this._state.compact.rooms : [room]);
      // Touching any energy sub-badge slot by hand hands the list over to you:
      // the derivation stops regenerating it, so your edit survives every later
      // save. Until then the list follows the rooms.
      const ENERGY_SLOT = /^energy_(entity|label|unit|cost)_[1-6]$/;
      const setVar = (key, value, f) => {
        const rooms = targets(f);
        rooms.forEach((r) => {
          if (ENERGY_SLOT.test(key)) r.variables.energy_subs_auto = false;
          if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) delete r.variables[key];
          else r.variables[key] = value;
        });
        // Single entry. Set a source once and it lands in every place either
        // dashboard reads it, which is the whole point of loading a pair.
        this._mirrorToPair(key, value, rooms);
      };

      const unitSeen = new Set();
      const addDrop = (row, f) => {
        const cell = document.createElement("button");
        cell.className = "drop";
        const u = unitOf(f);
        if (f.always || f.auto || unitSeen.has(u)) { cell.className = "drop blank"; row.appendChild(cell); return; }
        unitSeen.add(u);
        cell.title = "Remove";
        cell.setAttribute("aria-label", "Remove");
        cell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14"/></svg>';
        cell.onclick = (ev) => {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          this._armRow(row, kindLabel(f) || f.label, () => {
            sectionFields(sec).filter((x) => unitOf(x) === u).forEach((x) => setVar(x.key, undefined, x));
            this._revealed.delete(room.path + "|" + u);
            this._renderForm();
          });
        };
        row.appendChild(cell);
      };

      const renderField = (f, fs) => {
        const row = document.createElement("div");
        row.className = "row";
        const lab = document.createElement("label");
        lab.textContent = kindLabel(f) || f.label;
        row.appendChild(lab);

        const cur = f.key === "__name" ? (room.name ?? "") : (room.variables[f.key] ?? "");
        let input;
        // EVERY branch must call this. The entity picker and the select did not,
        // so seven fields carried a hint that had never been on screen.
        const addHint = () => {
          if (!f.hint) return;
          const h = document.createElement("div");
          h.className = "hint"; h.textContent = f.hint;
          fs.appendChild(h);
        };
        const addFault = (val) => {
          const why = fieldFault(f, val, this._hass);
          if (!why) return;
          const w = document.createElement("div");
          w.className = "fieldwarn"; w.textContent = why;
          fs.appendChild(w);
        };

        if (f.type === "image") {
          this._imageField(room, row, fs, pane);
          return;
        }

        if (f.type === "list") {
          row.appendChild(this._chipPicker(cur, f.domains || ["sensor"], (items) => {
            setVar(f.key, items, f);
            this._renderForm();
          }, f.empty, { classes: f.classes, placeholder: f.placeholder }));
          addDrop(row, f);
          fs.appendChild(row);
          addHint();
          return;
        }

        if (f.type === "map") {
          const over = (room.variables[f.over] || []).filter(Boolean);
          const raw = room.variables[f.key];
          const map = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
          // One member: the ROW is the field, since a heading and a member name
          // saying the same word is two lines for one thing. Several: the field
          // heads them and each row names its member.
          const many = over.length !== 1;
          if (many) {
            const head = document.createElement("div");
            head.className = "subhead";
            head.textContent = f.label;
            fs.appendChild(head);
          }
          if (!over.length) {
            const h = document.createElement("div");
            h.className = "hint";
            h.textContent = f.emptyHint || "Add the entities above first.";
            fs.appendChild(h);
            return;
          }
          over.forEach((id, n) => {
            const r = document.createElement("div");
            r.className = "row";
            const l = document.createElement("label");
            const st = this._hass.states[id];
            l.textContent = many
              ? ((st && st.attributes.friendly_name) || id)
              : f.label;
            r.appendChild(l);
            // Every kind writes { member_id: value }, so only the control differs.
            // An empty value DELETES the key: the popup reads
            // `overrides[id] || <default>` and would take "" as an answer.
            const write = (v) => {
              const next = {};
              over.forEach((k) => { if (map[k]) next[k] = map[k]; });
              if (v) next[id] = v; else delete next[id];
              setVar(f.key, Object.keys(next).length ? next : undefined, f);
            };
            const c = f.kind === "icon"
              ? this._combo(map[id] || "", [ICON_DEFAULT].concat(HEMMA_ICONS),
                  f.iconDefault || "default",
                  (v) => write(v === ICON_DEFAULT ? "" : v),
                  { icon: true, iconFallback: f.iconDefault || null })
              : this._combo(map[id] || "", this._entityList(f.domains, f.classes),
                  (f.domains || []).map((d) => d + ".").join(" / "), write);
            r.appendChild(c.wrap);
            if (n === 0) addDrop(r, f);
            else { const pad = document.createElement("span"); r.appendChild(pad); }
            fs.appendChild(r);
          });
          addHint();
          return;
        }

        if (f.type === "bool") {
          row.appendChild(this._boolSwitch(cur, f.boolDefault, (v) => {
            setVar(f.key, v, f);
            this._syncPreview();
          }, f.label));
          addDrop(row, f);
          fs.appendChild(row);
          addHint();
          return;
        }

        if (f.type === "select") {
          const c = this._combo(String(cur), f.options, "",
            (v) => { setVar(f.key, v, f); this._syncPreview(); },
            { fixed: true, labels: { "": "Default", ...(f.optionLabels || {}) } });
          row.appendChild(c.wrap);
          addDrop(row, f);
          fs.appendChild(row);
          addHint();
          addFault(cur);
          return;
        }
        if (f.domains) {
          const pinned = f.repeatKinds && this._slotKind.get(room.path + "|" + unitOf(f));
          const kind = pinned && f.repeatKinds.find((k) => k.id === pinned);
          const doms = (kind && kind.domains) || f.domains;
          const c = this._combo(cur, this._entityList(doms, f.classes),
            // The domain hint reads as "fill this in". A field that is genuinely
            // optional can say so instead.
            f.placeholder || doms.map((d) => d + ".").join(" / "),
            (v) => {
              setVar(f.key, v, f);
              this._syncPreview();
            });
          row.appendChild(c.wrap);
          addDrop(row, f);
          fs.appendChild(row);
          addHint();
          addFault(cur);
          return;
        } else {
          input = document.createElement("input");
          input.value = String(cur);
          // A default belongs in the empty field, grayed, where you look when
          // deciding whether to type - not in a line of prose underneath.
          if (f.placeholder) input.placeholder = f.placeholder;
        }

        input.onchange = () => {
          const v = input.value.trim();
          if (f.key === "__name") {
            room.name = v;
            // Popups read room_name, which has no fallback to the card's name,
            // so keep it in step rather than making people set a heading twice.
            setVar("room_name", v);
            this._renderTabs();
            this._syncPreview();
            return;
          }
          setVar(f.key, v, f);
          this._syncPreview();
        };

        row.appendChild(input);
        addDrop(row, f);
        fs.appendChild(row);
        addHint();
      };

      visible.filter((f) => !f.advanced).forEach((f) => renderField(f, fs));

      const advanced = visible.filter((f) => f.advanced);
      const advOffer = offersFrom(units.filter((u) => !unitLive(u) && advUnit(u)
        && met(u, units) && !u.fields.every((f) => f.noAdd)));
      if (advanced.length || (advOffer.length && sectionLive(sec))) {
        const det = document.createElement("div");
        det.className = "adv";
        const sum = document.createElement("button");
        sum.className = "advsum";
        sum.type = "button";
        sum.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"'
          + ' stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg><span>Advanced</span>';
        const key = room.path + "|adv|" + sec.label;
        if (advOffer.length) {
          const ap = document.createElement("button");
          ap.className = "plus advplus";
          ap.type = "button";
          ap.title = "Add an option";
          ap.setAttribute("aria-label", "Add an option");
          ap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
          ap.onclick = (ev) => {
            ev.stopPropagation();
            const take = (raw) => { this._advOpen.add(key); reveal(raw); };
            // Same as the section + above: name what is being added, always.
            this._menuAt(ap, advOffer, take);
          };
          sum.appendChild(ap);
        }
        const body = document.createElement("div");
        body.className = "advbody";
        advanced.forEach((f) => renderField(f, body));
        if (!advanced.length) {
          const n = document.createElement("div");
          n.className = "empty-note";
          n.textContent = "Nothing set. Use + to add.";
          body.appendChild(n);
        }
        const open = this._advOpen.has(key);
        det.classList.toggle("open", open);
        sum.setAttribute("aria-expanded", open ? "true" : "false");
        sum.onclick = () => {
          const now = !det.classList.contains("open");
          if (now) this._advOpen.add(key); else this._advOpen.delete(key);
          this._openAdv(det, sum, now, true);
        };
        det.appendChild(sum); det.appendChild(body);
        fs.appendChild(det);
      }
      (side.get(sec) || colA).appendChild(fs);
      // Stamped so the reorder pass below can find them and read their id.
      if (sec.group === "badges" && sec.bid) fs.dataset.bid = sec.bid;
    });

    // Badges reorder exactly the way tiles do: the cards themselves, by their
    // grip, in one column. Run after every badge card is built, because the
    // order is a property of the list rather than of any one card.
    this._orderBadgeCards(room, bandFor.badges && bandFor.badges.colA);
    // Inside the Scenes card, under its own fields.
    this._renderSceneColors(room,
      this.$("pane").querySelector('#band-rooms [data-k="Scenes"]'));
    this._renderTiles(room, bandFor.tiles.colA, bandFor.tiles.head);
    this._wireInspector();

    // Applied AFTER every card is built, not by building one: the siblings step
    // out rather than there being a second render path.
    if (this._sel && this._sel.group === this._group) {
      const band = this.$("pane").querySelector("#band-" + this._group);
      const hit = band && band.querySelector('[data-k="' + CSS.escape(this._sel.key) + '"]');
      if (!hit) {
        this._sel = null;                       // it was removed under us
      } else {
        band.classList.add("detail");
        hit.classList.add("sel");
        // A thing you asked to see is not also folded.
        hit.classList.remove("shut");
        const bar = document.createElement("div");
        bar.className = "detailbar";
        const back = document.createElement("button");
        back.className = "mini icon back";
        back.type = "button";
        const home = (GROUPS.find((x) => x.id === this._sel.group) || {}).label
          || "the list";
        back.title = "Back to " + home;
        back.setAttribute("aria-label", "Back to " + home);
        back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
          + '<path d="m14 6-6 6 6 6"/></svg>';
        back.onclick = () => this._popRow();
        // Where BACK goes, not where you are - the pane's header already names
        // the thing you pushed into.
        const h3 = document.createElement("h3");
        h3.textContent = home;
        bar.appendChild(back);
        bar.appendChild(h3);
        // The controls the row no longer carries: they belong to this one
        // thing, so they sit with its name rather than being repeated in a
        // head underneath it.
        const ownHead = hit.querySelector(".chead, .thead");
        if (ownHead) {
          // The controls belong to this one thing, so they sit with its name in
          // the bar rather than being repeated inside the card as well.
          ownHead.querySelectorAll(".plus, .sw, .rowmenu")
            .forEach((c) => bar.appendChild(c));
        }
        // The SAME slot the switcher lives in. Swapped, not stacked.
        seg.remove();
        nav.appendChild(bar);
      }
    }

    sc.scrollTop = keepScroll;
    const navDir = this._navDir;
    // The nav row's contents changed if we crossed between list and detail.
    const navSwapped = this._navWasSel !== !!this._sel;
    this._navWasSel = !!this._sel;
    this._navDir = 0;
    requestAnimationFrame(() => {
      // Again after layout: the rebuilt column may be a different height.
      if (floor) pane.style.minHeight = "";
      sc.scrollTop = keepScroll;
      // One or the other, never both: a level change is a push, and the card
      // FLIP is for cards that MOVED within a level. Running them together is
      // what made every transition read as noise.
      if (navDir) this._playNav(navDir, navSwapped);
      else this._playCards(beforeRects);
    });
  }

  // Shared popover for the section + buttons, same material as the combobox.
  _menuAt(anchor, items, onPick) {
    // Pressing the same control again should shut the menu, not reopen it.
    if (this._openAnchor === anchor) { this._openCombo(); return; }
    if (this._openCombo) this._openCombo();

    const menu = document.createElement("div");
    menu.className = "combo-menu";

    const close = () => {
      document.removeEventListener("mousedown", away, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      if (this._openCombo === close) this._openCombo = null;
      if (this._openAnchor === anchor) this._openAnchor = null;
      closeMenu(menu);
    };
    // Ignore presses on the anchor, so its own click handler can do the toggle
    // rather than this closing first and the click reopening.
    const away = (ev) => {
      const t = ev.composedPath ? ev.composedPath()[0] : ev.target;
      if (menu.contains(t) || anchor.contains(t) || anchor === t) return;
      close();
    };

    if (!items.some((it) => typeof it !== "string" && it.checked)) menu.classList.add("noticks");
    let lastGroup;
    items.forEach((it) => {
      const item = typeof it === "string" ? { id: it, label: it, group: null } : it;

      if (item.group !== lastGroup && item.group) {
        if (lastGroup !== undefined) menu.appendChild(Object.assign(document.createElement("div"), { className: "combo-sep" }));
        const h = document.createElement("div");
        h.className = "combo-head";
        h.textContent = item.group;
        menu.appendChild(h);
      }
      lastGroup = item.group;

      const d = document.createElement("div");
      d.className = "combo-opt";
      const tick = document.createElement("span");
      tick.className = "tick";
      const t = document.createElement("span");
      t.className = "lbl";
      t.textContent = item.label;
      d.appendChild(tick);
      if (item.swatch) {
        const sw = document.createElement("span");
        sw.className = "swatch";
        sw.style.background = item.swatch;
        d.appendChild(sw);
      }
      if (item.glyph) {
        const g = document.createElement("span");
        g.className = "roomglyph menuglyph";
        g.style.setProperty("--i", "url('" + iconUrl(item.glyph) + "')");
        d.appendChild(g);
      }
      d.appendChild(t);
      // .sel is what reveals the tick. Without this `checked` only reserved
      // the column and every item still rendered blank.
      if (item.checked) d.classList.add("sel");
      // Dimmed, not armed and then refused: a control that cannot succeed should
      // say so before you reach for it.
      if (item.disabled) {
        d.classList.add("off");
        d.setAttribute("aria-disabled", "true");
        if (item.why) d.title = item.why;
        menu.appendChild(d);
        return;
      }
      d.onmouseenter = () => {
        menu.querySelectorAll(".combo-opt").forEach((el) => el.classList.remove("active"));
        d.classList.add("active");
      };
      d.onmousedown = (ev) => { ev.preventDefault(); close(); onPick(item.id); };
      menu.appendChild(d);
    });

    this._openCombo = close;
    this._openAnchor = anchor;
    this.$("overlay").appendChild(menu);

    const r = anchor.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const drop = below >= 180 || below >= above;
    // Sized to its content, so a single "Remove tile" is not 240px wide.
    menu.style.width = "auto";
    menu.style.minWidth = "148px";
    menu.style.maxWidth = "320px";
    const width = Math.ceil(menu.getBoundingClientRect().width);
    const left = Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
    menu.style.left = left + "px";
    menu.style.maxHeight = Math.max(120, Math.min(320, drop ? below : above)) + "px";
    if (drop) { menu.style.top = r.bottom + 10 + "px"; menu.style.bottom = "auto"; }
    else { menu.style.bottom = window.innerHeight - r.top + 10 + "px"; menu.style.top = "auto"; }
    playMenuIn(menu, drop, left + width > r.right - 2);

    setTimeout(() => document.addEventListener("mousedown", away, true), 0);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
  }

  // One switch can move another - Now Playing clears an explicit
  // show_media:false - so they ALL re-read rather than the pressed one updating
  // itself.
  _syncSwitches() {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (this._switches || []).forEach((s) => {
      const on = s.get();
      if (s.sw.getAttribute("aria-checked") === (on ? "true" : "false")) return;
      s.sw.setAttribute("aria-checked", on ? "true" : "false");
      s.sw.title = on ? "Shown on the dashboard" : "Hidden on the dashboard";
      s.fs.classList.toggle("off", !on);
      if (s.add) s.add.disabled = !on;
      // The card you are pushed into is open because you opened it; a switch
      // inside its own header must not close it under you.
      if (!s.fs.classList.contains("sel")) {
        this._shutCard(s.fs, this._folded.has(s.foldKey), !still);
      }
    });
    this._syncPreview();
  }

  // Both segmented controls travel the same way, so the pill is written once
  // and told which data attribute names its options and what a pick means.
  _wireSeg(seg, attr, initial, onPick, opts) {
    const thumb = seg.querySelector(".segthumb");
    // Measured from the live buttons, so it holds whatever the label or font. A
    // transition cannot deform mid-flight, so the final state is committed at
    // once and keyframes play over it. Carried across rebuilds, or a recreated
    // control has no previous geometry and never travels.
    const carry = opts && opts.carry;
    const seed = carry && this._segCarry && this._segCarry[carry];
    let curX = seed ? seed.x : 0, curW = seed ? seed.w : 0;
    const moveThumb = (animate) => {
      const on = seg.querySelector(".segopt.on");
      if (!on || !on.offsetWidth) return;
      const toX = on.offsetLeft - 2;
      const toW = on.offsetWidth;
      const fromX = curX, fromW = curW;
      thumb.style.transform = "translateX(" + toX + "px)";
      thumb.style.width = toW + "px";
      curX = toX; curW = toW;
      if (carry) {
        this._segCarry = this._segCarry || {};
        this._segCarry[carry] = { x: toX, w: toW };
      }
      if (!animate || !fromW) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Critically damped: eases in from rest, eases out, never passes its
      // destination. What is left is 6% of stretch at the widest jump with a 2%
      // squash, so the pill reads as physical. The middle keyframe INHERITS the
      // outer easing - a curve of its own breaks the motion and finishes twice.
      const dist = Math.abs(toX - fromX);
      const stretch = 1 + Math.min(0.06, dist / 2200);
      thumb.animate(
        [
          { transform: `translateX(${fromX}px) scaleX(1) scaleY(1)`, width: fromW + "px" },
          {
            transform: `translateX(${(fromX + toX) / 2}px) scaleX(${stretch.toFixed(3)}) scaleY(.98)`,
            width: Math.round((fromW + toW) / 2) + "px",
            offset: 0.5,
          },
          { transform: `translateX(${toX}px) scaleX(1) scaleY(1)`, width: toW + "px" },
        ],
        { duration: SEG_MS, easing: SEG_EASE }
      );
    };
    let val = initial;
    const choices = [...seg.querySelectorAll(".segopt")];
    choices.forEach((b) => b.classList.toggle("on", b.dataset[attr] === initial));
    const pick = (b) => {
      if (!b || val === b.dataset[attr]) return;
      val = b.dataset[attr];
      choices.forEach((x) => x.classList.toggle("on", x === b));
      moveThumb(true);
      onPick(val);
    };
    if (opts && opts.toggle) {
      // Two mutually exclusive options, and a small target: the whole pill
      // flips it rather than asking you to land on the correct half. Tapping
      // the inactive side still selects that side, which is the same result.
      seg.onclick = () => pick(choices.find((b) => !b.classList.contains("on")));
    } else {
      choices.forEach((b) => { b.onclick = () => pick(b); });
    }
    requestAnimationFrame(() => moveThumb(false));
    // Inter loads after first paint and the labels change width with it.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => moveThumb(false)).catch(() => {});
    }
  }

  // Switched off, a card is just its heading. Measured shut but animated open:
  // the rows have to stay in flow to be clipped by the closing card and to fade
  // while it closes over them.
  _shutCard(fs, shut, animate) {
    const seq = (fs._shutSeq = (fs._shutSeq || 0) + 1);
    this._folding = (this._folding || 0) + 1;
    const unfold = () => {
      this._folding = Math.max(0, (this._folding || 1) - 1);
      if (!this._folding && this._applyMapSize) this._applyMapSize();
    };
    // `.shut` cannot be applied until the height animation ends - the rows have
    // to stay in flow to be clipped by the closing card. The summary should not
    // wait that long, so it rides its own class, set the moment the fold starts.
    fs.classList.toggle("counting", shut);
    if (!animate) { fs.classList.toggle("shut", shut); unfold(); return; }

    const from = fs.offsetHeight;
    fs.classList.toggle("shut", shut);
    const to = fs.offsetHeight;
    if (shut) fs.classList.remove("shut");
    if (from === to) { fs.classList.toggle("shut", shut); unfold(); return; }

    fs.style.overflow = "clip";
    const a = fs.animate(
      [{ height: from + "px" }, { height: to + "px" }],
      { duration: RT(260), easing: EASE }
    );
    const done = () => {
      unfold();
      // A newer fold owns the card now, but this one still has to put back the
      // clip it set - bailing before that left overflow:clip stuck on the card.
      fs.style.overflow = "";
      if (seq !== fs._shutSeq) return;
      fs.classList.toggle("shut", shut);
    };
    a.finished.then(done, done);
  }

  // The minus used to wipe a field on one tap. The tile list already asks
  // twice - the row slides aside and Delete comes in from the trailing edge -
  // so every other minus does the same rather than being the one place where a
  // mis-tap is final. One row is armed at a time, panel-wide.
  _armRow(row, label, remove) {
    if (this._armedRow === row) { this._disarmRow(); return; }
    this._disarmRow();
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delbtn";
    del.textContent = "Delete";
    del.setAttribute("aria-label", "Delete " + (label || "setting"));
    del.onpointerdown = (ev) => ev.stopPropagation();
    del.onclick = (ev) => {
      ev.stopPropagation();
      this._armedRow = null;
      this._armedDel = null;
      remove();
    };
    row.appendChild(del);
    row.classList.add("arming");
    this._armedRow = row;
    this._armedDel = del;
    // A frame between the clip landing and the slide starting, or the button
    // has no parked position to travel from and simply appears in place.
    const go = () => { if (this._armedRow === row) row.classList.add("armed"); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(go);
    else go();
    // Anywhere else disarms, the way tapping off an iOS row does.
    if (this.shadowRoot && this.shadowRoot.addEventListener) {
      const away = (ev) => {
        if (row.contains && ev.target && row.contains(ev.target)) return;
        this.shadowRoot.removeEventListener("pointerdown", away, true);
        this._disarmRow();
      };
      row._awayHandler = away;
      this.shadowRoot.addEventListener("pointerdown", away, true);
    }
  }

  _disarmRow() {
    const row = this._armedRow;
    const del = this._armedDel;
    this._armedRow = null;
    this._armedDel = null;
    if (!row) return;
    if (row._awayHandler && this.shadowRoot && this.shadowRoot.removeEventListener) {
      this.shadowRoot.removeEventListener("pointerdown", row._awayHandler, true);
      row._awayHandler = null;
    }
    row.classList.remove("armed");
    // The clip and the button come off only once the slide back has finished,
    // or the row snaps to its resting shape halfway through it.
    const settle = () => {
      row.classList.remove("arming");
      if (del && del.parentNode) del.parentNode.removeChild(del);
    };
    if (typeof setTimeout === "function") setTimeout(settle, 380);
    else settle();
  }

  // A drawer opens under the fold, so opening it has to end with it on screen.
  // The height morph is the same measure-toggle-measure the cards fold with.
  _openAdv(det, sum, open, animate) {
    const seq = (det._advSeq = (det._advSeq || 0) + 1);
    const body = det.querySelector && det.querySelector(".advbody");
    const from = det.offsetHeight;
    det.classList.toggle("open", open);
    if (sum) sum.setAttribute("aria-expanded", open ? "true" : "false");
    const to = det.offsetHeight;
    const still = !animate || !det.animate
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || from === to) { if (open) this._revealAdv(det, still); return; }
    // .adv is content-box. It has no vertical padding today so the two boxes
    // agree, but offsetHeight is the BORDER box - the day anyone gives this a
    // padding it would animate to that much too tall and snap back, which is
    // exactly what the hints caption did. Free to rule out now.
    const hadBox = det.style.boxSizing;
    det.style.boxSizing = "border-box";
    det.style.overflow = "clip";
    // Revealed by the drawer growing over it, not by appearing on top of the
    // rows below - which is what a bare display swap looks like.
    if (open && body && body.animate) {
      body.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: RT(200), delay: RT(60), fill: "backwards", easing: EASE });
    }
    const a = det.animate([{ height: from + "px" }, { height: to + "px" }],
      { duration: RT(260), easing: EASE });
    const done = () => {
      det.style.overflow = "";
      det.style.boxSizing = hadBox;
      if (seq !== det._advSeq) return;
      if (open) this._revealAdv(det, false);
    };
    a.finished.then(done, done);
  }

  // Only as far as the drawer's foot, never past its own summary, so the heading
  // you tapped stays on screen. AFTER the height animation: the scroll range is
  // still growing while the drawer expands.
  _revealAdv(det, still) {
    const pane = this.$("pane");
    if (!pane || !pane.scrollBy || !det.getBoundingClientRect) return;
    const p = pane.getBoundingClientRect();
    const d = det.getBoundingClientRect();
    const over = d.bottom + 12 - p.bottom;
    if (over <= 0) return;
    const room = Math.max(0, d.top - p.top - 8);
    pane.scrollBy({ top: Math.min(over, room), behavior: still ? "auto" : "smooth" });
  }

  // Smart Sort, as the row itself does it. `sort: false` on the room's
  // hemma-smart-row is the off switch; absent is on.
  _smartSortOn() {
    const room = this._state && this._state.compact.rooms[this._room];
    return !(room && room._row && room._row.sort === false);
  }

  // hemma-smart-row's _applyOrder, its numbers included: active first, each group
  // in config order, applied with flex `order` and then a FLIP. `row` is passed
  // because the new .mini-tiles is still detached - a shadowRoot lookup would
  // find the OUTGOING card's row.
  _applyMiniSort(animate, row) {
    row = row || (this.shadowRoot && this.shadowRoot.querySelector(".mini-tiles"));
    if (!row) return;
    const tiles = [...row.querySelectorAll(".mtile")];
    if (!tiles.length) return;

    const on = this._smartSortOn();
    const active = [], rest = [];
    tiles.forEach((el, i) => {
      ((on && el.dataset.active === "1") ? active : rest).push(i);
    });
    const order = [...active, ...rest];
    const place = () => order.forEach((orig, pos) => {
      tiles[orig].style.order = String(pos);
    });

    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place();
      return;
    }

    const first = tiles.map((t) => t.getBoundingClientRect());
    place();
    const last = tiles.map((t) => t.getBoundingClientRect());
    // The row never wraps, so only x can change. Screen pixels have to be
    // divided back down before they go on an element inside the scaled card -
    // the same correction the preview's own drag makes.
    const k = (this._mapVis && this._mapVis.scale) || 1;
    const dx = tiles.map((_, i) => (first[i].left - last[i].left) / k);

    tiles.forEach((t, i) => {
      if (Math.abs(dx[i]) < 0.5) return;
      t.style.transition = "none";
      t.style.transform = "translate(" + dx[i] + "px,0)";
    });
    // Two frames: one for the inverted transform to be committed, one for the
    // transition to have something to run from.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      tiles.forEach((t, i) => {
        if (Math.abs(dx[i]) < 0.5) return;
        t.style.transition = "transform 450ms cubic-bezier(0.4, 0, 0.2, 1)";
        t.style.transform = "";
      });
      setTimeout(() => tiles.forEach((t) => {
        t.style.transition = "";
        t.style.transform = "";
      }), 500);
    }));
    // Desktop rows scroll; the row snaps back to the front when it re-sorts.
    if (row.scrollLeft > 10) row.scrollTo({ left: 0, behavior: "smooth" });
  }

  // One section open at a time: any number of open cards has no predictable
  // shape, and opening a nine-row section pushes the rest a screenful away.
  _closeOthers(keep, head) {
    if (!this._foldables) return;
    const others = [];
    this._foldables.forEach((entry, k) => {
      if (k === keep || this._folded.has(k)) return;
      if (!entry.body.isConnected) return;
      // Already collapsed for a different reason, and not ours to record.
      if (entry.body.classList.contains("off")) return;
      others.push([k, entry]);
    });
    if (!others.length) return;
    // Keep the row you tapped where your finger left it. Collapsing a card
    // ABOVE it pulls everything below up by the difference, so measure the head
    // either side of the change and hand the scroller the delta back.
    const sc = this._scroller();
    const before = head.getBoundingClientRect().top;
    others.forEach(([k, entry]) => {
      this._folded.add(k);
      entry.paint();
      // Instant, not animated. You are looking at the card you just opened, and
      // animating a collapse somewhere else while the page slides underneath it
      this._shutCard(entry.body, true, false);
    });
    const delta = head.getBoundingClientRect().top - before;
    if (delta && sc) sc.scrollTop += delta;
  }

  // One caret for both card kinds. `body` is the element that collapses and
  // `head` the row that toggles it; the section card and the tile card differ
  // only in those two and in which siblings the shut class hides.
  _foldButton(key, head, body, label) {
    const fold = document.createElement("button");
    fold.type = "button";
    fold.className = "fold";
    fold.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="m6 9 6 6 6-6"/></svg>';
    const paint = () => {
      const open = !this._folded.has(key);
      fold.setAttribute("aria-expanded", open ? "true" : "false");
      fold.setAttribute("aria-label", (open ? "Collapse " : "Expand ") + label);
      fold.title = open ? "Collapse" : "Expand";
    };
    paint();
    if (this._foldables) this._foldables.set(key, { body, paint });
    const toggle = (ev) => {
      // Every other control in these heads is a button; the caret is the one
      // button that is also the fold.
      if (ev && ev.target && ev.target.closest && ev.target.closest("button:not(.fold)")) return;
      // A row is a way in, not a disclosure. Pressing it shows that one thing
      // with a way back, the way the preview does when you click an object -
      // both ends of the same gesture. The fold machinery stays because a card
      // still opens and closes; it is just no longer what a press means.
      if (this._pushRow && !head._dragged) {
        const hit = this._pushRow(key, head, label);
        if (hit) { if (ev) ev.stopPropagation(); return; }
      }
      // Inside a section a header press does nothing: a press is a way IN now,
      // so collapsing the one thing being shown leaves the pane empty. _pushRow
      // returns false because there is nowhere further to go.
      if (this._sel) { if (ev) ev.stopPropagation(); return; }
      // A reorder that lands back in its own slot never rebuilds the card, so
      // the pointerup is followed by a real click on a head that still exists.
      // Without this, dragging a tile and dropping it where it started folded
      // it instead.
      if (head._dragged) { head._dragged = false; return; }
      if (ev) ev.stopPropagation();
      const opening = this._folded.has(key);
      if (opening) this._folded.delete(key);
      else this._folded.add(key);
      paint();
      // A card switched off is already shut; folding it changes nothing to
      // animate, and unfolding it must not open a card that is off.
      if (body.classList.contains("off")) return;
      if (opening) this._closeOthers(key, head);
      this._shutCard(body, this._folded.has(key),
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    };
    fold.onclick = toggle;
    head.onclick = toggle;
    return fold;
  }

  // Every foldable card in a room, named the way _foldButton names them.
  _foldKeys(room) {
    const out = SECTIONS
      .filter((sec) => sec.group === "rooms" || sec.group === "badges")
      .map((sec) => sec.label);
    (room.tiles || []).forEach((t) => out.push(room.path + "|tile|" + this._tileKey(t)));
    return out;
  }

  // A chosen entity reads as its name. Menus, and any field while you are
  // typing in it, stay on entity ids - that is what you search by and what
  // actually gets written. Anything that is not a live entity id (an icon name,
  // a room, a fixed option) passes straight through.
  _prettyEntity(v) {
    const e = v && String(v).includes(".") && this._hass && this._hass.states[v];
    return (e && e.attributes && e.attributes.friendly_name) || v;
  }

  // On or off: a tri-state select offered a "Default" nothing on screen resolved.
  // The switch sits at the template's resting position, and returning it there
  // DELETES the key rather than writing the default back.
  _boolSwitch(cur, boolDefault, onChange, label) {
    const def = !!boolDefault;
    const on = cur === undefined || cur === "" || cur === null ? def : !!cur;
    const sw = document.createElement("button");
    sw.className = "sw";
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", on ? "true" : "false");
    if (label) sw.setAttribute("aria-label", label);
    let state = on;
    sw.onclick = () => {
      state = !state;
      sw.setAttribute("aria-checked", state ? "true" : "false");
      onChange(state === def ? undefined : state);
    };
    return sw;
  }

  // A plant and its readings share one device, so picking the plant fills the
  // popup in. Seeds an EMPTY list only; a hand-picked set is never overwritten.
  // The twin swaps the LAST occurrence and keeps the rest of the id byte for
  // byte: a router publishes both `..._wan_download_speed` and a bare
  // `..._wan_download`, and searching for "upload" pairs the wrong two.
  _twinOf(id, from, to) {
    const H = this._hass || {};
    const src = String(id || "");
    const at = src.lastIndexOf(from);
    if (at < 0) return null;
    const twin = src.slice(0, at) + to + src.slice(at + from.length);
    if (!(H.states || {})[twin]) return null;
    const dev = (x) => ((H.entities || {})[x] || {}).device_id;
    const own = dev(src);
    // Only enforced when the source IS registered to a device; a template
    // sensor has none, and refusing there would help nobody.
    if (own && dev(twin) !== own) return null;
    return twin;
  }

  _plantSensorsFor(plantId) {
    const H = this._hass || {};
    const reg = (H.entities || {})[plantId];
    const dev = reg && reg.device_id;
    if (!dev) return [];
    const sibs = Object.keys(H.entities || {})
      .filter((id) => id.startsWith("sensor.") && (H.entities[id] || {}).device_id === dev);
    const out = [];
    PLANT_SLOTS.forEach((slot) => {
      const hits = sibs.filter((id) => plantSlotOf(id) === slot.type);
      if (!hits.length) return;
      // Shortest id wins: "sensor.x_temperature" over "sensor.x_soil_temperature_2".
      hits.sort((a, b) => a.length - b.length || a.localeCompare(b));
      out.push(hits[0]);
    });
    return out;
  }

  // Point at a thing, and the inspector becomes about it. Switching group is
  // part of the move: clicking a tile while the switcher is on Badges has to
  // take you to Tiles, or the selection would render into a hidden band.
  _select(pick) {
    if (!pick) return;
    // A tile picked from the PREVIEW arrives with no label: selKeyOf has only
    // the mk string to go on, and cannot see the room. The bar fell back to
    // this._sel.key, which is the internal key - "tile-22".
    if (pick.group === "tiles" && !pick.label) {
      pick = { group: pick.group, key: pick.key, label: this._tileLabelFor(pick.key) };
    }
    // Switching group is a sideways move, not a push; only going INTO something
    // travels forward.
    this._navDir = this._sel ? 0 : 1;
    this._sel = pick;
    this._group = pick.group;
    this._renderForm();
    // The card it landed on may be below the fold in a long list.
    requestAnimationFrame(() => {
      const hit = this.$("pane").querySelector(".card.sel, .tile.sel");
      if (hit) this._scrollTo(hit, false);
    });
  }

  // Names the level you are in - the group in a list, the thing itself once
  // pushed into. REPLACES the card's inline header rather than duplicating it.
  _headFor(g, room) {
    const grp = { icon: g.icon, color: g.iconColor, label: g.label, blurb: g.blurb };
    const sel = this._sel;
    if (!sel || sel.group !== g.id) return grp;
    if (g.id === "tiles") {
      const tile = ((room && room.tiles) || []).find((t) => this._tileKey(t) === sel.key);
      const type = tile && tileTypeOf(tile);
      // A tile whose template the panel does not know still has a name.
      if (!type) return { ...grp, label: sel.label || grp.label };
      return {
        icon: TILE_ICON[type.id] || grp.icon,
        color: TILE_COLOR[type.id] || TILE_TINT,
        label: (tile.name && tile.name.trim()) || type.label,
        // No fallback to the group. Pushed into a tile, the header names the
        // tile; repeating "The cards along the bottom of the room" over every
        // one of them says nothing about the one you opened.
        blurb: type.blurb,
      };
    }
    const sec = SECTIONS.find((x) => x.group === g.id && x.label === sel.key);
    if (!sec) return { ...grp, label: sel.label || grp.label };
    return {
      icon: sec.icon || grp.icon,
      color: sec.iconColor || grp.color,
      raw: !!sec.iconRaw,
      label: sec.label,
      blurb: sec.blurb,
    };
  }

  // What a tile is called, from its key alone. The same expression the list
  // row and the push both use, so all three ways in agree.
  _tileLabelFor(key) {
    const room = this._state && this._state.compact.rooms[this._room];
    const tile = ((room && room.tiles) || []).find((t) => this._tileKey(t) === key);
    if (!tile) return key;
    const type = tileTypeOf(tile);
    return tile.name || (type && type.label) || "Tile";
  }

  // Light the same object on both sides. Called with null to clear.
  _link(pick, from) {
    const key = pick ? pick.key : null;
    const sig = key ? key + "|" + (from || "") : null;
    if (this._linked === sig) return;
    this._linked = sig;
    this.shadowRoot.querySelectorAll(".linked")
      .forEach((n) => n.classList.remove("linked"));
    if (!key) return;
    // Only the FAR side lights: lighting the one under the cursor is just a
    // hover fill, which macOS does not put in a list with separators.
    if (from !== "row") {
      const esc = CSS.escape(key);
      const card = this.$("pane").querySelector('[data-k="' + esc + '"]');
      if (card) card.classList.add("linked");
    }
    if (from !== "preview") {
      const mk = pick.group === "tiles" ? "t:" + key
        : "b:" + String(key).toLowerCase();
      this.shadowRoot.querySelectorAll('[data-mk="' + CSS.escape(mk) + '"]')
        .forEach((n) => n.classList.add("linked"));
    }
  }

  // Returns false when the head is not something the inspector can show on its
  // own, so the caller falls back to folding.
  // Two things move on a push: the nav row cross-slides and the band's content
  // travels a SHORT distance - iOS moves an incoming pane a fraction of its
  // width, not the whole way.
  _playNav(dir, swapped) {
    if (!dir) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pane = this.$("pane");
    if (!pane) return;
    const band = pane.querySelector(".band:not([style*='display: none'])")
      || pane.querySelector(".band");
    // Everything below the group header. The header names the level you are in,
    // so it stays put while its contents travel - fading it out and back in
    // made the whole column look like it was being replaced.
    const moving = band && band.querySelector(".bandbody");
    const dx = dir > 0 ? 26 : -26;
    if (moving) {
      moving.animate(
        [{ opacity: 0, transform: "translateX(" + dx + "px)" },
         { opacity: 1, transform: "none" }],
        { duration: 360, easing: SEG_EASE, fill: "backwards" });
    } else if (band) {
      band.animate(
        [{ opacity: 0, transform: "translateX(" + dx + "px)" },
         { opacity: 1, transform: "none" }],
        // Raw, not RT: a push is a response to a press, not part of the
        // room-switch morph. Through the dial this was 459ms and read as slow.
        { duration: 360, easing: SEG_EASE, fill: "backwards" });
    }
    // Only when the row's CONTENTS changed. Switching Room to Badges leaves the
    // switcher exactly where it was, so animating it there made the chrome
    // travel with the content it is supposed to stand still behind.
    if (!swapped) return;
    const nav = pane.querySelector(".navrow > *");
    if (nav) {
      nav.animate(
        [{ opacity: 0, transform: "translateX(" + (dx * 0.55) + "px)" },
         { opacity: 1, transform: "none" }],
        { duration: 280, easing: SEG_EASE, fill: "backwards" });
    }
  }

  // Leaving a section is a pop, and it has to be the same code path as the back
  // button or the two would drift.
  _popRow() {
    if (!this._sel) return;
    this._sel = null;
    this._navDir = -1;
    this._renderForm();
  }

  _pushRow(key, head, label) {
    if (this._sel) return false;                 // already showing one thing
    // Editing is not browsing. While the list is in edit mode a row press does
    // nothing: the minus and Delete are the only live targets on it.
    if (this._editTiles && head.closest && head.closest(".tilegrid")) return true;
    const card = head.closest && head.closest("[data-k]");
    if (!card) return false;
    const band = card.closest && card.closest(".band");
    if (!band || !band.id) return false;
    const group = band.id.replace(/^band-/, "");
    if (!GROUPS.some((g) => g.id === group)) return false;
    this._select({ group: group, key: card.dataset.k, label: label || card.dataset.k });
    return true;
  }

  _chipPicker(values, domains, onChange, emptyText, opts) {
    const wrap = document.createElement("div");
    wrap.className = "chipwrap";
    let list = Array.isArray(values) ? values.slice() : (values ? [String(values)] : []);

    const draw = () => {
      wrap.innerHTML = "";

      // No default empty note: an empty field already reads as empty, and
      // "None yet" under every picker was noise. Only a field that has
      // something worth saying passes `empty`.
      let none = null;
      if (!list.length) {
        if (emptyText) {
          none = document.createElement("div");
          none.className = "none";
          none.textContent = emptyText;
        }
      } else {
        const chips = document.createElement("div");
        chips.className = "chips";
        list.forEach((v, i) => {
          const c = document.createElement("span");
          c.className = "chip";
          const t = document.createElement("span");
          t.textContent = this._prettyEntity(v);
          // The id is still what is stored, so keep it reachable.
          c.title = v;
          const x = document.createElement("button");
          x.type = "button";
          x.textContent = "\u00d7";
          x.title = "Remove";
          x.onclick = () => { list.splice(i, 1); onChange(list.slice()); draw(); };
          c.appendChild(t); c.appendChild(x);
          chips.appendChild(c);
        });
        wrap.appendChild(chips);
      }

      // A bare domain offers every sensor in the house, which is no help at
      // all when the field wants one kind of them. The field already knows.
      const options = this._entityList(domains, opts && opts.classes)
        .filter((e) => !list.includes(e));
      const ph = (opts && opts.placeholder)
        || ("add " + domains.map((d) => d + ".").join(" / "));
      const combo = this._combo("", options, ph, (v) => {
        if (!v || list.includes(v)) return;
        list.push(v);
        onChange(list.slice());
        draw();
      });
      wrap.appendChild(combo.wrap);
      // After the field, so every word of explanation sits together beneath it.
      if (none) wrap.appendChild(none);
    };

    draw();
    return wrap;
  }

  // A styled stand-in for prompt() and confirm(), which cannot be themed.
  _ask(opts) {
    return new Promise((resolve) => {
      const scrim = document.createElement("div");
      scrim.className = "scrim";
      const box = document.createElement("div");
      box.className = "dialog";
      scrim.appendChild(box);

      const h = document.createElement("h3");
      h.textContent = opts.title;
      box.appendChild(h);

      if (opts.message) {
        const m = document.createElement("p");
        m.textContent = opts.message;
        box.appendChild(m);
      }

      let input = null;
      if (opts.value !== undefined) {
        input = document.createElement("input");
        input.value = opts.value || "";
        if (opts.placeholder) input.placeholder = opts.placeholder;
        box.appendChild(input);
      }

      const acts = document.createElement("div");
      acts.className = "acts";
      const cancel = document.createElement("button");
      cancel.className = "ghost";
      cancel.textContent = "Cancel";
      const ok = document.createElement("button");
      if (opts.destructive) ok.className = "danger";
      ok.textContent = opts.confirmLabel || "OK";
      acts.appendChild(cancel);
      acts.appendChild(ok);
      box.appendChild(acts);

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKey, true);
        const done = () => { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); resolve(result); };
        if (menuStill()) return done();
        scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-in" })
          .finished.then(done, done);
      };

      const onKey = (ev) => {
        if (ev.key === "Escape") { ev.preventDefault(); finish(null); }
        else if (ev.key === "Enter" && input) { ev.preventDefault(); ok.click(); }
      };

      cancel.onclick = () => finish(null);
      ok.onclick = () => {
        if (!input) return finish(true);
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        finish(v);
      };
      scrim.onmousedown = (ev) => { if (ev.target === scrim) finish(null); };
      document.addEventListener("keydown", onKey, true);

      this.shadowRoot.appendChild(scrim);
      if (!menuStill()) {
        scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: "ease-out" });
        box.animate(
          [{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }],
          { duration: 220, easing: EASE }
        );
      }
      if (input) setTimeout(() => { input.focus(); input.select(); }, 30);
    });
  }

  // ── combobox ──────────────────────────────────────────────────────────────

  _combo(value, list, placeholder, onChange, opts) {
    const iconMode = !!(opts && opts.icon);
    // What the card draws when the field is empty. iconUrl("") resolves to the
    // question-mark `default` artwork, so an unset Open icon used to read as
    // "no icon" when the cover is in fact drawing a curtain.
    const iconFallback = (opts && opts.iconFallback) || null;
    // A fixed list is a chooser, not a text field: no typing, no filtering.
    const fixed = !!(opts && opts.fixed);
    const labels = (opts && opts.labels) || null;
    const show = (v) => (labels && labels[v] !== undefined ? labels[v] : v);
    // Two entities can share a friendly name, and once the field shows only the
    // name they are the same word - picking the wrong one looks like the card
    // being broken. A shared name carries its id; an unambiguous one stays
    // clean.
    const nameSeen = new Map();
    (list || []).forEach((o) => {
      const nm = this._prettyEntity(o);
      if (nm !== o) nameSeen.set(nm, (nameSeen.get(nm) || 0) + 1);
    });
    const pretty = (v) => {
      const nm = this._prettyEntity(v);
      return nameSeen.get(nm) > 1 ? nm + " (" + v + ")" : nm;
    };
    const wrap = document.createElement("div");
    wrap.className = "combo" + (iconMode ? " hasicon" : "");
    const raw = value == null ? "" : String(value);
    const input = document.createElement("input");
    input.value = raw;
    if (placeholder) input.placeholder = placeholder;
    const menu = document.createElement("div");
    menu.className = "combo-menu";
    wrap.appendChild(input);

    let shown = [];
    let active = -1;
    let current = raw;

    const close = () => {
      active = -1;
      if (this._openCombo === close) { this._openCombo = null; this._openAnchor = null; }
      closeMenu(menu);
    };

    const place = () => {
      const r = input.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const drop = below >= 180 || below >= above;
      // Entity ids run far wider than the field they sit under, so the menu
      // grows past the input rather than cutting its own rows off.
      menu.style.width = "auto";
      menu.style.minWidth = r.width + "px";
      menu.style.maxWidth = Math.max(r.width, Math.min(560, window.innerWidth - 20)) + "px";
      const w = Math.ceil(menu.getBoundingClientRect().width);
      menu.style.left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16)) + "px";
      menu.style.maxHeight = Math.max(120, Math.min(300, drop ? below : above)) + "px";
      if (drop) { menu.style.top = r.bottom + 6 + "px"; menu.style.bottom = "auto"; }
      else { menu.style.bottom = window.innerHeight - r.top + 6 + "px"; menu.style.top = "auto"; }
      return drop;
    };

    const commit = (v) => {
      current = v;
      input.value = v === ICON_DEFAULT ? "" : pretty(show(v));
      onChange(v === ICON_DEFAULT ? "" : v);
      if (wrap._paintLead) wrap._paintLead();
      close();
    };

    const paint = () => {
      [...menu.children].forEach((el, i) => {
        if (el.classList.contains("combo-opt")) el.classList.toggle("active", i === active);
      });
      if (active >= 0 && menu.children[active]) {
        menu.children[active].scrollIntoView({ block: "nearest" });
      }
    };

    const open = () => {
      const q = fixed ? "" : input.value.trim().toLowerCase();
      shown = list.filter((o) => !q || String(o).toLowerCase().includes(q));
      menu.innerHTML = "";

      if (!shown.length) {
        const e = document.createElement("div");
        e.className = "combo-empty";
        e.textContent = "No match";
        menu.appendChild(e);
        if (this._openCombo && this._openCombo !== close) this._openCombo();
        this._openCombo = close;
        if (!menu.parentNode) { menu._closing = false; this.$("overlay").appendChild(menu); playMenuIn(menu, place(), false); }
        else place();
        active = -1;
        return;
      }

      shown.slice(0, 300).forEach((o) => {
        const d = document.createElement("div");
        d.className = "combo-opt" + (o === current ? " sel" : "");
        const tick = document.createElement("span");
        tick.className = "tick";
        tick.textContent = "\u2713";
        d.appendChild(tick);
        if (iconMode) {
          const g = document.createElement("span");
          const isDefault = o === ICON_DEFAULT;
          g.className = "glyph" + (isDefault && iconFallback ? " faint" : "");
          g.style.setProperty("--i",
            "url('" + iconUrl(isDefault && iconFallback ? iconFallback : o) + "')");
          d.appendChild(g);
        }
        const label = document.createElement("span");
        label.className = "lbl";
        label.textContent = show(o);
        d.appendChild(label);
        // mousedown, because blur would close the menu before a click lands.
        d.onmousedown = (ev) => { ev.preventDefault(); commit(o); };
        d.onmouseenter = () => { active = [...menu.children].indexOf(d); paint(); };
        menu.appendChild(d);
      });

      active = shown.indexOf(current);
      if (this._openCombo && this._openCombo !== close) this._openCombo();
      this._openCombo = close;
      if (!menu.parentNode) { menu._closing = false; this.$("overlay").appendChild(menu); playMenuIn(menu, place(), false); }
      else place();
      paint();
    };

    let lead = null;
    if (iconMode) {
      lead = document.createElement("span");
      lead.className = "glyph";
      wrap.appendChild(lead);
      const paintLead = () => {
        const unset = !current || current === ICON_DEFAULT;
        const shown = unset && iconFallback ? iconFallback : current;
        lead.style.setProperty("--i", "url('" + iconUrl(shown) + "')");
        // Faint, so a default still reads as unset rather than as a choice.
        lead.classList.toggle("faint", unset && !!iconFallback);
      };
      paintLead();
      wrap._paintLead = paintLead;
    }

    if (fixed) {
      input.readOnly = true;
      input.style.cursor = "pointer";
      input.value = show(current);
      input.onfocus = open;
      input.onclick = open;
      input.onblur = () => setTimeout(close, 120);
    } else {
      input.value = pretty(current);
      // Focus puts the id back before the menu opens, so the filter still runs
      // against ids and the caret is on the text you are about to edit.
      input.onfocus = () => { input.value = current; open(); };
      input.oninput = () => { open(); active = -1; paint(); };
      input.onblur = () => {
        setTimeout(close, 120);
        const typed = input.value.trim();
        // Picking from the menu leaves the NAME in a still-focused field, so a
        // blur that matches either form is not an edit.
        if (typed !== current && typed !== pretty(current)) commit(typed);
        else input.value = pretty(current);
      };
    }

    input.onkeydown = (ev) => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        if (!menu.classList.contains("open")) open();
        if (!shown.length) return;
        active += ev.key === "ArrowDown" ? 1 : -1;
        if (active < 0) active = Math.min(shown.length, 300) - 1;
        if (active >= Math.min(shown.length, 300)) active = 0;
        paint();
      } else if (ev.key === "Enter") {
        if (menu.classList.contains("open") && active >= 0 && shown[active]) {
          ev.preventDefault();
          commit(shown[active]);
        }
      } else if (ev.key === "Escape") {
        close();
      }
    };

    // A fixed menu would drift away from its input, so dismiss on scroll.
    const dismiss = () => { if (menu.parentNode) close(); };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);

    return { wrap, input };
  }

  // Domain alone is far too wide - power, energy and cost all say sensor. The
  // rule EXCLUDES a conflicting device_class rather than requiring a matching
  // one: plenty of template sensors carry none, and hiding an entity someone
  // needs is worse than offering one they do not.
  _entityList(domains, classes) {
    const want = classes && classes.length ? classes : null;
    return Object.keys(this._hass.states)
      .filter((e) => domains.includes(e.split(".")[0]))
      .filter((e) => {
        if (!want) return true;
        const dc = this._hass.states[e]?.attributes?.device_class;
        return !dc || want.includes(dc);
      })
      .sort();
  }

  // ── room images ───────────────────────────────────────────────────────────

  // Pinned to the dashboard's primary room so it does not shift while you work.
  _setBackdrop() {
    const bg = this.$("bg");
    if (!bg) return;
    const rooms = (this._state && this._state.compact.rooms) || [];
    const home = rooms.find((r) => r.path === "home") || rooms[0];
    const found = (this._imgs || []).find((i) => i.name === (home && home.variables.image));
    const dark = !this.classList.contains("is-light");
    const url = found && ((dark && found.night) || found.day);
    if (!url) { bg.classList.remove("on"); return; }
    if (bg.dataset.src === url) { bg.classList.add("on"); return; }
    bg.dataset.src = url;
    bg.classList.remove("on");
    warmPhoto(url);
    // Without this a single failed fetch left the backdrop off for good:
    // nothing re-runs this until the room or the theme changes.
    bg.onerror = () => {
      if (bg.dataset.retried === url) return;
      bg.dataset.retried = url;
      setTimeout(() => { if (bg.dataset.src === url) bg.src = url; }, 400);
    };
    bg.onload = () => {
      const go = () => {
        // First paint gets no fade: this is the backdrop the entrance happens
        // against, so it must be fully there before anything moves.
        if (!this._entered) {
          bg.style.transition = "none";
          bg.classList.add("on");
          requestAnimationFrame(() => requestAnimationFrame(() => {
            bg.style.transition = "";
            this._bgReady = true;
            if (this._waitBg) this._waitBg();
          }));
          return;
        }
        bg.classList.add("on");
        this._bgReady = true;
        if (this._waitBg) this._waitBg();
      };
      (bg.decode ? bg.decode().then(go, go) : Promise.resolve().then(go));
    };
    bg.src = url;
  }


  async _images(force) {
    if (this._imgs && !force) return this._imgs;
    if (this._imgsInFlight && !force) return this._imgsInFlight;
    this._imgsInFlight = this._fetchImages().finally(() => { this._imgsInFlight = null; });
    return this._imgsInFlight;
  }

  async _fetchImages() {
    const res = await this._hass.fetchWithAuth
      ? await this._hass.fetchWithAuth("/api/hemma/images")
      : await fetch("/api/hemma/images");
    if (!res.ok) throw new Error(`images ${res.status}`);
    const data = await res.json();
    this._imgs = data.images || [];
    this._imgsLoaded = true;
    return this._imgs;
  }

  _imageField(room, row, fs, pane) {
    const sel = document.createElement("div");
    row.appendChild(sel);
    fs.appendChild(row);

    const shots = document.createElement("div");
    shots.className = "shots";
    fs.appendChild(shots);

    const hint = document.createElement("div");
    hint.className = "shothint";
    hint.textContent = "Click a slot to choose a photo, or drop one onto it.";
    fs.appendChild(hint);

    const preview = () => {
      const chosen = (this._imgs || []).find((i) => i.name === room.variables.image);
      shots.innerHTML = "";
      [["Day", "day", chosen && chosen.day], ["Night", "night", chosen && chosen.night]]
        .forEach(([label, variant, url]) => {
          const w = document.createElement("button");
          w.type = "button";
          w.className = "shot" + (url ? "" : " empty");
          w.innerHTML = (url ? `<img src="${url}" alt="">` : "")
            + '<span class="shotover"><span class="shotglyph"></span>'
            + (url ? "Replace" : "Add " + label.toLowerCase()) + "</span>"
            + `<span class="cap">${label}</span>`;
          w.onclick = () => this._pickFor(variant);
          w.ondragover = (ev) => { ev.preventDefault(); w.classList.add("over"); };
          w.ondragleave = () => w.classList.remove("over");
          w.ondrop = (ev) => {
            ev.preventDefault();
            w.classList.remove("over");
            const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
            if (f) this._dropFor(f, variant);
          };
          shots.appendChild(w);
        });
      // Same photo as the preview tile, so it arrives the same way: on a room
      // change only, never when you are picking an image inside one room.
      if (this._shotRoom !== room.path
          && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        shots.animate(ROOM_FADE, { duration: ROOM_FADE_MS, easing: EASE });
      }
      this._shotRoom = room.path;
    };

    // Rebuilt rather than repopulated, because the list arrives asynchronously.
    const fill = () => {
      const list = this._imgs || [];
      const names = list.map((i) => i.name);
      const labels = {};
      list.forEach((i) => { labels[i.name] = i.name + (i.night ? "" : "   no night image"); });

      const cur = room.variables.image || "";
      if (cur && !names.includes(cur)) {
        names.unshift(cur);
        // Only call it missing once we know what is actually on disk.
        labels[cur] = cur + (this._imgsLoaded ? "   not on disk" : "");
      }

      sel.innerHTML = "";
      sel.appendChild(this._combo(cur, names, "", (v) => {
        room.variables.image = v;
        preview();
        this._setBackdrop();
      }, { fixed: true, labels }).wrap);
      preview();
    };

    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".jpg,.jpeg,.png,.webp";
    file.hidden = true;
    fs.appendChild(file);

    const send = async (blob, variantValue) => {
      const name = await this._ask({
        title: "Image name",
        message: "Lowercase letters, digits and hyphens. Uploading the same name replaces it.",
        value: room.variables.image || slug(room.name),
        confirmLabel: "Upload",
      });
      if (!name) return;
      const body = new FormData();
      body.append("name", name);
      body.append("variant", variantValue);
      body.append("file", blob);
      shots.classList.add("busy");
      this._status("uploading\u2026");
      try {
        const res = this._hass.fetchWithAuth
          ? await this._hass.fetchWithAuth("/api/hemma/images", { method: "POST", body })
          : await fetch("/api/hemma/images", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || res.status);
        this._imgs = data.images || [];
        room.variables.image = name;
        this._status(`uploaded ${name} (${variantValue})`, "ok");
        this._log(`uploaded ${name} ${variantValue}`, "ok");
        fill();
        this._setBackdrop();
      } catch (e) {
        this._status("upload failed: " + e.message, "err");
        this._log("upload failed: " + e.message, "err");
      }
      shots.classList.remove("busy");
    };

    this._pickFor = (variantValue) => {
      file.value = "";
      file.onchange = () => { if (file.files && file.files[0]) send(file.files[0], variantValue); };
      file.click();
    };
    this._dropFor = send;

    fill();
    this._images()
      .then(() => { fill(); this._setBackdrop(); })
      .catch((e) => {
        this._log("could not list images: " + e.message, "warn");
        this._status("Image list unavailable. Restart Home Assistant to load the Hemma image endpoint.", "warn");
      });
  }

  // Presentational, so nothing re-renders: the class is the switch. The motion
  // is measure-toggle-measure on each BLOCK, not on the bands holding them -
  // animating the band while the prose snapped read as no animation at all.
  _setHints(on, animate) {
    on = !!on;
    this._hints = on;
    localStorage.setItem("hemma_panel_hints", on ? "on" : "off");
    const pane = this.$("pane");
    const still = !animate || !pane || !pane.querySelectorAll
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { this.classList.toggle("nohints", !on); return; }

    // One motion per box: a caption and the paragraph inside it both match, so
    // both animated at once and the two compounded into an overshoot.
    const all = [...pane.querySelectorAll(HINT_BLOCKS)].filter((el) => el.animate);
    const blocks = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));
    const from = blocks.map((el) => el.offsetHeight);
    this.classList.toggle("nohints", !on);
    const to = blocks.map((el) => el.offsetHeight);

    blocks.forEach((el, i) => {
      if (from[i] === to[i]) return;
      // offsetHeight is the BORDER box, so on a content-box element it adds the
      // padding again. Pinned to border-box for the duration, the number
      // measured and the number animated to are the same box.
      const had = el.style.overflow;
      const hadBox = el.style.boxSizing;
      el.style.overflow = "hidden";
      el.style.boxSizing = "border-box";
      const a = el.animate(
        [{ height: from[i] + "px", opacity: on ? 0 : 1 },
         { height: to[i] + "px", opacity: on ? 1 : 0 }],
        { duration: RT(300), easing: EASE }
      );
      const done = () => { el.style.overflow = had; el.style.boxSizing = hadBox; };
      a.finished.then(done, done);
    });
  }

  // Confirming on the button itself reads better than a line of text elsewhere.
  _saveFlash() {
    const b = this.$("save");
    if (!b || b.dataset.flash) return;
    b.dataset.flash = "1";
    const html = b.innerHTML;
    b.style.width = b.offsetWidth + "px";
    b.classList.add("ok");
    // The tick is DRAWN: dashed to its own length with the offset animated to
    // zero, which reveals it from the start of the path - so the path has to run
    // the way a hand writes one, short arm first.
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"'
      + ' stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M4 12l5 5L20 6" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>';
    b.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.06)", offset: 0.4 }, { transform: "scale(1)" }],
      { duration: 420, easing: EASE }
    );
    const tick = b.querySelector("svg path");
    if (tick && tick.animate) {
      tick.animate(
        [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { duration: 340, delay: 60, easing: "cubic-bezier(.62,.03,.36,1)", fill: "forwards" }
      );
    }
    setTimeout(() => {
      b.classList.remove("ok");
      b.innerHTML = html;
      b.style.width = "";
      delete b.dataset.flash;
    }, 1600);
  }

  // What the room's badges will actually read, live: each group yields the pill
  // plus the sub badges its expanded row would.
  // Mirrors SC.list in hemma_scene_core.yaml - the explicit list, else every
  // scene the registry shows minus the excluded, by name then scene_order.
  // isActive is NOT mirrored: it needs configs this panel never fetches, so no
  // row is marked active rather than guessing.
  _sceneList() {
    const states = (this._hass && this._hass.states) || {};
    const reg = (this._hass && this._hass.entities) || {};
    // Scenes is dashboard-scoped: the same values are written to every room,
    // and reads come from the room on screen, exactly as the form does.
    const room = this._state && this._state.compact.rooms[this._room];
    const v = (room && room.variables) || {};
    const excl = new Set(Array.isArray(v.scene_exclude) ? v.scene_exclude : []);
    const explicit = Array.isArray(v.scenes) && v.scenes.length > 0;
    let ids = explicit
      ? v.scenes.filter((id) => states[id])
      : Object.keys(states)
          .filter((id) => id.startsWith("scene.") && !id.startsWith("scene.hemma"))
          .filter((id) => {
            // A registry entry is REQUIRED, exactly as SC.list has it: a scene
            // with no entry is not shown on the dashboard, so it is not shown
            // here either.
            const re = reg[id];
            return !!re && !(re.hidden || re.hidden_by || re.disabled || re.disabled_by);
          });
    ids = ids.filter((id) => !excl.has(id));
    const nameOf = (id) => (states[id] && states[id].attributes
      && states[id].attributes.friendly_name)
      || id.replace("scene.", "").replace(/_/g, " ");
    if (!explicit) ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    if (Array.isArray(v.scene_order)) {
      const so = v.scene_order;
      ids.sort((a, b) => {
        const ai = so.indexOf(a), bi = so.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return 0;
      });
    }
    return ids.map((id) => ({
      id,
      label: nameOf(id),
      icon: (states[id].attributes && states[id].attributes.icon) || "mdi:layers",
    }));
  }

  // The real menu closes on an outside click; the chip's own handler stops
  // propagation, so this never fires for the tap that opened it.
  _armSceneMenuDismiss() {
    if (this._sceneDismiss) return;
    this._sceneDismiss = () => this._closeSceneMenu();
    this.shadowRoot.addEventListener("click", this._sceneDismiss);
    this._sceneKey = (e) => { if (e.key === "Escape") this._closeSceneMenu(); };
    window.addEventListener("keydown", this._sceneKey);
  }

  _closeSceneMenu() {
    const m = this.shadowRoot && this.shadowRoot.querySelector(".mini-scenemenu");
    if (m) m.remove();
  }

  // Anchored inside the preview card, so it scales and clips with it exactly
  // as the real menu sits over the dashboard.
  _openSceneMenu(chip) {
    this._closeSceneMenu();
    const card = chip.closest(".card.map");
    if (!card) return;
    const items = this._sceneList();
    const menu = document.createElement("div");
    menu.className = "mini-scenemenu";
    if (!items.length) {
      const e = document.createElement("div");
      e.className = "mini-sceneempty";
      e.textContent = "No scenes";
      menu.appendChild(e);
    }
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "mini-scenerow";
      const ico = document.createElement("ha-icon");
      ico.setAttribute("icon", it.icon);
      const txt = document.createElement("span");
      txt.textContent = it.label;
      row.appendChild(ico);
      row.appendChild(txt);
      menu.appendChild(row);
    });
    card.appendChild(menu);
    // Center under the chip, then pull back inside the card if it would hang
    // off either edge - the card clips, so an overhanging menu loses rows.
    const cr = card.getBoundingClientRect();
    const br = chip.getBoundingClientRect();
    const scale = cr.width && card.offsetWidth ? cr.width / card.offsetWidth : 1;
    const chipMid = (br.left + br.width / 2 - cr.left) / scale;
    const chipBot = (br.bottom - cr.top) / scale;
    const k = parseFloat(getComputedStyle(card).getPropertyValue("--menu-k")) || 0.583;
    const pad = 8 * k;
    const w = menu.offsetWidth;
    let left = chipMid - w / 2;
    left = Math.max(pad, Math.min(left, card.offsetWidth - w - pad));
    menu.style.left = left + "px";
    menu.style.top = (chipBot + pad) + "px";
    requestAnimationFrame(() => menu.classList.add("in"));
    this._armSceneMenuDismiss();
  }

  // opts.phone differs in exactly ONE way: its Media pill is always_visible, a
  // filter you can always reach rather than a readout. Everything else is
  // identical, which is why this is a flag and not a second model.
  _miniModel(room, opts) {
    const forPhone = !!(opts && opts.phone);
    const V = room.variables || {};
    const st = (id) => (id && this._hass.states[id]) || null;
    const num = (id) => { const e = st(id); const n = e && parseFloat(e.state); return Number.isFinite(n) ? n : null; };
    const CUR = String((this._hass && this._hass.config && this._hass.config.currency) || "USD").toUpperCase();
    const SYM = { USD: "$", CAD: "$", AUD: "$", NZD: "$", MXN: "$",
      EUR: "\u20AC", GBP: "\u00A3", JPY: "\u00A5", CNY: "\u00A5",
      SEK: "kr", NOK: "kr", DKK: "kr", CHF: "Fr", INR: "\u20B9",
      BRL: "R$", PLN: "z\u0142", KRW: "\u20A9" }[CUR] || "$";
    const money = (n) => SYM + (n >= 100 ? Math.round(n) : n.toFixed(2));
    const resolveUnit = (u, e) => {
      u = String(u || "auto").toLowerCase();
      if (u === "energy") return "kwh";
      if (u !== "auto" && u !== "") return u;
      const dc = String((e && e.attributes && e.attributes.device_class) || "").toLowerCase();
      const uom = String((e && e.attributes && e.attributes.unit_of_measurement) || "");
      if (dc === "monetary") return "cost";
      if (dc === "energy" || /^k?Wh$/i.test(uom)) return "kwh";
      return "auto";
    };
    const nameOf = (id) => {
      const e = st(id);
      return (e && e.attributes && e.attributes.friendly_name) || String(id || "").split(".").pop().replace(/_/g, " ");
    };
    // Room light groups are all registered as a bare "Lights", so a group shows
    // its area instead. Mirrors the name expression in hemma_badge_light.yaml.
    const areaOf = (id) => {
      const H = this._hass || {};
      const reg = (H.entities || {})[id];
      if (!reg) return null;
      const aid = reg.area_id || (reg.device_id ? ((H.devices || {})[reg.device_id] || {}).area_id : null);
      return aid ? (((H.areas || {})[aid] || {}).name || null) : null;
    };
    const groupAwareName = (id) => {
      const e = st(id);
      const members = e && e.attributes && e.attributes.entity_id;
      const isGroup = Array.isArray(members) && members.length > 0;
      return (isGroup ? areaOf(id) : null) || nameOf(id);
    };
    const on = (key) => V[key] !== false;
    const list = (prefix, n) => Array.from({ length: n }, (_, k) => V[prefix + (k + 1)]).filter(Boolean);
    const unit = V.temp_unit === "C" ? "°C" : "°";
    const out = [];

    const CLIMATE = "var(--hemma-badge-climate-color, var(--hemma-color-teal, #00C3D0))";
    const LIGHT = "var(--hemma-badge-light-color, var(--hemma-color-yellow, #FFCC00))";
    const GREEN = "var(--hemma-color-green, #30D158)";
    const YELLOW = "var(--hemma-color-yellow, #FFCC00)";
    const TEAL = "var(--hemma-color-teal, #00C3D0)";
    const ENERGY = "var(--hemma-badge-energy-color, var(--hemma-color-green, #30D158))";

    const thermostats = list("climate_entity_", 3);
    const temps = list("temp_sensor_", 5);
    const climateOn = !!(thermostats.length || temps.length || V.humidity_sensor || V.quality_sensor);
    if (on("show_climate") && climateOn) {
      // Always the same three cards, off temp_sensor_1 / humidity_sensor /
      // quality_sensor. The extra temp sensors widen the pill's range and the
      // thermostats spin its fan; neither is a sub badge of its own.
      const t = num(temps[0]) ?? (st(thermostats[0]) || {}).attributes?.current_temperature;
      const h = num(V.humidity_sensor);
      const subs = [];
      // hemma_badge_temp's own thresholds and wording.
      const tempWord = (v) => {
        const c = V.temp_unit === "C";
        const k = c ? [18, 21, 24, 27, 29] : [65, 70, 76, 81, 85];
        return v <= k[0] ? "Very Cold" : v <= k[1] ? "Cool" : v <= k[2] ? "Comfortable"
          : v <= k[3] ? "Warm" : v <= k[4] ? "Hot" : "Very Hot";
      };
      const humWord = (v) => (v <= 29.99 ? "Very Dry" : v >= 61 ? "High" : "Good");
      // These three carry their state in their COLOR and glyph - a warm room is a
      // yellow thermometer, not a teal one. Ladders and icons are
      // hemma_badge_temp / _humidity / _air_quality's own.
      const tempKeys = () => (V.temp_unit === "C" ? [18, 21, 24, 27, 29] : [65, 70, 76, 81, 85]);
      const tempColor = (v) => {
        const k = tempKeys();
        return "var(--hemma-badge-temp-" + (
          v <= k[0] ? "very-cold" : v <= k[1] ? "cool" : v <= k[2] ? "comfortable"
          : v <= k[3] ? "warm" : v <= k[4] ? "hot" : "very-hot") + "-color)";
      };
      // temp-low / -medium / -high, split at cool and warm.
      const tempIcon = (v) => {
        const k = tempKeys();
        return v <= k[1] ? "temp-low" : v <= k[3] ? "temp-medium" : "temp-high";
      };
      const humColor = (v) => (v <= 29.99 ? "var(--hemma-badge-humidity-dry-color)"
        : v >= 61 ? "var(--hemma-badge-humidity-high-color)" : CLIMATE);
      const aqiColor = (w) => {
        const q = String(w || "").toLowerCase();
        if (q === "excellent") return "var(--hemma-badge-air-quality-excellent-color)";
        if (q === "good") return "var(--hemma-badge-air-quality-good-color)";
        if (q === "moderate" || q === "fair") return "var(--hemma-badge-air-quality-moderate-color)";
        if (q === "poor") return "var(--hemma-badge-air-quality-poor-color)";
        if (q === "bad" || q === "very bad" || q === "very poor") {
          return "var(--hemma-badge-air-quality-bad-color)";
        }
        return CLIMATE;
      };
      // The gauge fraction each badge computes for its ring, carried on the sub
      // so the chips row can draw the same arc. Same formulas, so the preview
      // and the device fill to the same place rather than to a guess.
      const clamp = (x) => Math.max(0.05, Math.min(1, x));
      if (temps[0]) {
        const n = num(temps[0]);
        subs.push({
          icon: n != null ? tempIcon(n) : "temp-medium",
          color: n != null ? tempColor(n) : CLIMATE,
          label: "Temperature",
          gauge: n != null ? clamp(unit === "F" ? (n - 45) / 50 : (n - 7) / 28) : null,
          text: n != null ? tempWord(n) + " \u00b7 " + Math.round(n) + unit : "Unknown" });
      }
      if (V.humidity_sensor) {
        subs.push({ icon: "humidity", color: h != null ? humColor(h) : CLIMATE,
          label: "Humidity",
          gauge: h != null ? clamp(h / 100) : null,
          text: h != null ? humWord(h) + " \u00b7 " + Math.round(h) + "%" : "Unknown" });
      }
      if (V.quality_sensor) {
        const raw = String((st(V.quality_sensor) || {}).state || "Unknown");
        const low = raw.toLowerCase();
        const AQI_GAUGE = { excellent: 1, good: 0.8, fair: 0.55, moderate: 0.55,
          poor: 0.3, bad: 0.15, "very bad": 0.15, "very poor": 0.15 };
        subs.push({
          icon: ["poor", "bad", "very bad"].includes(low) ? "aqi-high" : "aqi-medium",
          color: aqiColor(raw), label: "Air Quality",
          gauge: AQI_GAUGE[low] != null ? AQI_GAUGE[low] : 0.5,
          text: raw.charAt(0).toUpperCase() + raw.slice(1) });
      }
      // An en dash, and a single reading still prints as a plain temperature.
      const readings = temps.map(num).filter((n) => n != null).map(Math.round);
      const span = readings.length
        ? (Math.min(...readings) === Math.max(...readings)
            ? Math.min(...readings) + unit
            : Math.min(...readings) + "\u2013" + Math.max(...readings) + unit)
        : null;
      // "Show inline" swaps the one Climate pill for the three cards that would
      // otherwise be its sub badges - hemma_room gates the group on
      // !show_climate_inline and each of the three on it.
      if (V.show_climate_inline) {
        subs.forEach((sb, i) => out.push({ ...sb, id: "climate:" + i, subs: [] }));
      } else {
        out.push({
          // mdi:fan, not the Hemma fan glyph - hemma_badge_climate_group sets
          // an MDI icon and it is the only pill on the row that does. The Hemma
          // one is a different shape and read as a stretched fan here.
          id: "climate", label: "Climate", icon: "mdi-fan", color: CLIMATE, subs,
          text: span || (t != null ? Math.round(t) + unit : null)
            || (h != null ? Math.round(h) + "%" : null) || "\u2014",
        });
      }
    }

    // The group is the pill, never a sub badge of itself. Its members are the
    // sub badges, unless specific lights were listed, which override them.
    const grp = V.light_group_entity;
    const listed = list("light_entity_", 10);
    const members = grp ? ((st(grp) || {}).attributes || {}).entity_id : null;
    const lights = listed.length ? listed
      : (Array.isArray(members) && members.length ? members.filter(Boolean) : (grp ? [grp] : []));
    if (on("show_lights") && (grp || listed.length)) {
      const lit = lights.filter((e) => (st(e) || {}).state === "on").length;
      out.push({
        id: "lights", label: "Lights", icon: "light", color: LIGHT, dim: !lit,
        text: lit ? lit + " On" : "All Off",
        subs: lights.map((e) => {
          const l = st(e) || {};
          const br = l.attributes && l.attributes.brightness;
          return {
            icon: "light", color: LIGHT, dim: l.state !== "on", label: groupAwareName(e),
            text: l.state !== "on" ? "Off"
              : (br != null ? Math.round((br / 255) * 100) + "%" : "On"),
          };
        }),
      });
    }

    const people = list("presence_entity_", 4);
    if (on("show_people") && people.length) {
      const home = people.filter((e) => /^(home|on)$/i.test((st(e) || {}).state || "")).length;
      out.push({
        id: "people", label: "People", icon: "person",
        color: home === people.length ? GREEN : (home === 0 ? "rgba(255,255,255,0.55)" : YELLOW),
        text: home === people.length ? "All Home"
          : (people.length - home) + " Away",
        subs: people.map((e) => {
          const p = st(e) || {};
          const away = !/^(home|on)$/i.test(p.state || "");
          return {
            icon: "person", color: away ? YELLOW : GREEN, dim: away, label: nameOf(e),
            text: away ? "Away" : "Home",
            pic: (p.attributes && p.attributes.entity_picture) || null,
          };
        }),
      });
    }

    const secEntities = list("security_entity_", 8);
    const locks = (Array.isArray(V.security_locks) ? V.security_locks : [])
      .concat([V.security_lock_entity, V.security_lock_entity_2]).filter(Boolean);
    // Cameras are a first-class part of this badge and the model had never
    // read them, so a camera-only room drew nothing here.
    const cams = (Array.isArray(V.security_cameras) ? V.security_cameras : []).filter(Boolean);
    if (on("show_security") && (secEntities.length || locks.length || cams.length)) {
      const all = locks.concat(secEntities);
      const open = all.filter((e) => /^(unlocked|on|open)$/i.test((st(e) || {}).state || "")).length;
      out.push({
        id: "security", label: "Security", icon: open ? "lock-open-fill" : "lock-fill", color: TEAL,
        text: open ? open + " Open" : "No Alerts",
        // The sub row is the two GROUP badges plus one card per separate badge -
        // never one per lock or per camera. Wording is hemma_badge_lock_group's
        // and hemma_badge_camera_group's own.
        subs: [].concat(
          locks.length ? [(() => {
            const unl = locks.filter((e) =>
              String((st(e) || {}).state || "").toLowerCase() !== "locked").length;
            return {
              icon: unl ? "lock-open-fill" : "lock-fill", color: TEAL,
              label: V.security_locks_label || "Doors",
              text: unl ? unl + " Unlocked" : (locks.length === 1 ? "Locked" : "All Locked"),
            };
          })()] : [],
          cams.length ? [(() => {
            const dead = cams.filter((e) =>
              /^(unavailable|unknown|)$/i.test((st(e) || {}).state || "")).length;
            return {
              icon: "doorbell", color: TEAL,
              label: V.security_cameras_label || "Cameras",
              text: dead === cams.length ? (cams.length === 1 ? "Offline" : "All Offline")
                : dead ? dead + " Offline" : "No Alerts",
            };
          })()] : [],
          secEntities.map((e, i) => {
            const isOpen = /^(unlocked|on|open)$/i.test((st(e) || {}).state || "");
            return {
              icon: isOpen ? "lock-open-fill" : "lock-fill", color: TEAL, dim: !isOpen,
              label: V["security_label_" + (i + 1)] || nameOf(e),
              text: isOpen ? "Unlocked" : "Locked",
            };
          })
        ),
      });
    }

    const watts = num(V.energy_power_entity);
    // Any energy source shows the badge, not just a whole-room power meter -
    // a room set up with cost or per-device sensors used to render nothing at
    // all. Same rule as _hemmaEnergyOn on the dashboard side; they must agree
    // or the preview lies about what you will get.
    const energyOn = on("show_energy") && !!(
      V.energy_power_entity || V.energy_usage_today || V.energy_usage_month
      || V.energy_cost_today || V.energy_cost_month
      || list("energy_entity_", 6).length);
    if (energyOn) {
      const items = list("energy_entity_", 6);
      // The group badge prints a TIER WORD from its own thresholds, never a
      // wattage, and nothing at all without a numeric power. Mirrored exactly.
      const headline = watts == null ? ""
        : watts >= Number(V.extreme_threshold ?? 3000) ? "Extreme Usage"
        : watts >= Number(V.heavy_threshold ?? 1000) ? "Heavy Usage"
        : watts >= Number(V.normal_threshold ?? 200) ? "Normal"
        : "Idle";
      out.push({
        id: "energy", label: "Energy", icon: "energy", color: ENERGY,
        text: headline,
        // Mirrors hemma_badge_energy's name block exactly - unit resolution,
        // rounding and the appended cost - or the preview shows watts for a
        // badge the dashboard prints in dollars.
        subs: items.map((e, i) => {
          const ent = st(e);
          const raw = ent ? parseFloat(ent.state) : NaN;
          const unit = resolveUnit(V["energy_unit_" + (i + 1)], ent);
          let text = "";
          if (Number.isFinite(raw)) {
            if (unit === "kwh") text = (raw >= 10 ? Math.round(raw) : raw.toFixed(1)) + " kWh";
            else if (unit === "cost") text = money(raw);
            else text = raw >= 1000 ? (raw / 1000).toFixed(1) + " kW" : Math.round(raw) + " W";
          }
          const cid = V["energy_cost_" + (i + 1)];
          const c = cid ? parseFloat((st(cid) || {}).state) : NaN;
          if (Number.isFinite(c)) text = text ? text + " \u00b7 " + money(c) : money(c);
          return {
            icon: "energy", color: ENERGY, label: V["energy_label_" + (i + 1)] || nameOf(e),
            text: text || "\u2014",
          };
        }),
      });
    }

    const players = list("media_player_", 10).concat(list("plex_stream_", 2)).concat(list("psn_", 2));
    // The panel REPLACES the pill rather than joining it, as the room card gates
    // them. The pill itself is display:none until a source is active; paused
    // still counts while it is fresh, which is what pause_timeout_minutes is
    // for.
    const mediaLive = (e) => {
      if (!e) return false;
      const state = String(e.state || "").toLowerCase();
      if (["unavailable", "unknown", "off", "standby"].includes(state)) return false;
      if (["playing", "buffering", "on"].includes(state)) return true;
      const a = e.attributes || {};
      const hasContent = !!(String(a.media_title || "").trim()
        || String(a.media_artist || a.artist || a.media_album_artist || "").trim());
      if (!hasContent) return false;
      if (state === "paused") {
        const timeout = Number(V.pause_timeout_minutes ?? 10);
        if (timeout <= 0) return true;
        return (Date.now() - new Date(e.last_changed).getTime()) / 60000 <= timeout;
      }
      return state === "idle";
    };
    // The wide row hides this while the Now Playing panel is up. The phone's is
    // a FILTER: it stands whether anything plays, and is how you reach the media
    // tiles at all.
    const mediaShows = forPhone
      ? players.length > 0
      : (!V.show_now_playing && players.some((e) => mediaLive(st(e))));
    if (on("show_media") && mediaShows) {
      const live = players.map(st).find((e) => e && e.state === "playing");
      const artOf = (e) => (e && e.attributes && e.attributes.entity_picture) || null;
      // The GROUP badge counts and carries no artwork: the title and cover
      // belong to the sub badge, or on a phone to the panel below. Naming them
      // here puts what you drill DOWN to on the pill you drill down FROM.
      const playing = players.filter((e) => {
        const x = st(e);
        return x && x.state === "playing";
      }).length;
      out.push({
        id: "media", label: "Media", icon: "media", color: "var(--ink)", dim: !live, clip: true,
        text: playing === 0 ? "None Playing"
          : playing === 1 ? "1 Playing" : playing + " Playing",
        // One card per LIVE player, matching the sub row: hemma_badge_media_player
        // hides itself on the same rule the group pill uses, so an idle speaker
        // is not a dimmed sub badge, it is no sub badge.
        subs: players.filter((e) => mediaLive(st(e))).map((e) => {
          const s = st(e);
          const playing = s && s.state === "playing";
          return {
            icon: "media", color: "var(--ink)", dim: !playing, clip: true, label: nameOf(e),
            text: playing ? (s.attributes.media_title || "Playing") : "Idle",
            pic: playing ? artOf(s) : null, art: true,
          };
        }),
      });
    }
    return out;
  }

  // ── layout animation ──────────────────────────────────────────────────────

  // FLIP: measure before the rebuild, animate each card from where it was.
  // Transform only - the cards carry backdrop-filter. The preview is excluded:
  // animating its transform overrides the CSS scale that sizes it.
  _captureCards() {
    const map = new Map();
    this.shadowRoot.querySelectorAll("[data-k]:not([data-k='__map'])").forEach((c) => {
      const r = c.getBoundingClientRect();
      // A card that is not showing measures 0x0 at 0,0, which as a FLIP origin
      // is the corner of the window. No box means nothing to animate from.
      if (!r.width && !r.height) return;
      map.set(c.dataset.k, r);
    });
    return map;
  }

  _playCards(before) {
    if (!before || !before.size) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (motion) return;

    this.shadowRoot.querySelectorAll("[data-k]:not([data-k='__map'])").forEach((c) => {
      const b = before.get(c.dataset.k);
      const a = c.getBoundingClientRect();
      // Same rule at the other end: a card with no box now cannot be animated.
      if (!a.width && !a.height) return;

      if (!b) {
        c.animate(
          [
            { opacity: 0, transform: "scale(0.94)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: RT(380), easing: EASE }
        );
        return;
      }

      const dx = b.left - a.left;
      const dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      c.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: RT(380), easing: EASE }
      );
    });
  }

  // ── room preview ──────────────────────────────────────────────────────────

  // The room card at a smaller size, from the same values the dashboard reads.
  // The entrance matches filter-overlay.js's reveal: chrome settles, headings
  // zoom, tiles stagger. The photo is already there; this lands on top of it.
  _playEntrance(force) {
    if (this._entered) return;
    // Everything arrives together or it does not read as one arrival. The 2.5s
    // fallback in _build is the ceiling, so a slow or missing photo delays this
    // but can never strand it.
    if (!force && !this._bgReady) { this._waitBg = () => this._playEntrance(true); return; }
    this._waitBg = null;
    this._entered = true;
    this.classList.remove("booting");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No stagger to wait behind, and nothing to animate into.
      this._revealNotice(null);
      return;
    }

    const EASE_IN = "cubic-bezier(0.16, 1, 0.3, 1)";

    // Nothing travels: glass resolves where it is rather than arriving, so
    // opacity ONLY. A transform on an ancestor freezes the blur beneath it, and
    // one on the glass re-blurs its backdrop every frame.
    const riseGlass = (el, delay) => el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 340, delay, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" }
    );

    const rise = (el, delay) => el.animate(
      [
        { opacity: 0, filter: "blur(7px)", transform: "scale(.985)" },
        { opacity: 1, filter: "blur(0px)", transform: "none" },
      ],
      { duration: 340, delay, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" }
    );

    // The bar is one object and it genuinely arrives: a full slide from above
    // rather than the 14px nudge it used to do, which finished long before the
    // columns had and left it simply sitting there for most of the intro.
    const bar = this.shadowRoot.querySelector(".top");
    if (bar) {
      bar.animate(
        [{ transform: "translateY(-100%)" }, { transform: "none" }],
        { duration: 520, easing: EASE_IN, fill: "backwards" }
      );
    }
    // The other half of the same titlebar, arriving off its own edge. Chrome
    // travels; the content inside it resolves in place.
    const rail = this.shadowRoot.querySelector(".rail");
    if (rail) {
      rail.animate(
        [{ transform: "translateX(-100%)" }, { transform: "none" }],
        { duration: 520, easing: EASE_IN, fill: "backwards" }
      );
    }

    // The floating panel settles in place: the rail and bar are chrome hinged to
    // an edge, this is a free object. It is also the largest piece of glass
    // here, and a transform on one re-blurs its backdrop every frame.
    const insp = this.shadowRoot.querySelector(".inspector");
    if (insp) riseGlass(insp, 90);

    const canvas = this.shadowRoot.querySelector(".canvas");
    // The preview's glass is on .card.map, so the map is what animates - moving
    // .canvas around it would freeze the blur exactly as before.
    const map = this.shadowRoot.querySelector(".card.map");
    const tail = [];
    if (map) tail.push(riseGlass(map, 150));
    else if (canvas) tail.push(riseGlass(canvas, 150));

    // 22ms apart is texture on one gesture, not a queue taking turns. The
    // stagger runs over GROUPS: rows share one surface, so lifting them
    // individually deals a group out as separate cards.
    const top = (el) => el.getBoundingClientRect().top;
    const left = (el) => el.getBoundingClientRect().left;
    const order = (a, b) => (top(a) - top(b)) || (left(a) - left(b));

    // Every group is built and only the chosen one is shown, so the hidden
    // ones were taking their turn in the stagger and spending its first frames
    // animating nothing.
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const heads = [...this.shadowRoot.querySelectorAll(".sheet .bandhead, #tilespane .bandhead")]
      .filter(shown);
    heads.sort(order).forEach((h, i) => rise(h, 100 + i * 22));

    // The group's header is glass, so it belongs here, not with the headings:
    // rise() would put a transform and a filter on a backdrop-filter surface.
    const groups = [...this.shadowRoot.querySelectorAll(
      ".sheet .col, #tilespane .tilegrid")]
      .filter((g) => g.children.length)
      .filter(shown);
    groups.sort(order).forEach((g, i) => tail.push(riseGlass(g, 130 + i * 34)));
    this._revealNotice(tail);
  }

  // The nav card holds one routes array, shared by every view.
  _navNode() {
    const find = (n) => {
      if (!n || typeof n !== "object") return null;
      if (Array.isArray(n)) {
        for (const x of n) { const r = find(x); if (r) return r; }
        return null;
      }
      if (Array.isArray(n.routes)) return n;
      for (const k of Object.keys(n)) { const r = find(n[k]); if (r) return r; }
      return null;
    };
    return find(this._state && this._state.scaffold && this._state.scaffold.nav);
  }

  // Room links carry a url; Scenes opens a picker instead, so it has none.
  _scenesOn() {
    const n = this._navNode();
    return !!(n && n.routes.some((r) => !r.url));
  }

  _setScenes(on) {
    const n = this._navNode();
    if (!n) return;
    if (!on) {
      const gone = n.routes.filter((r) => !r.url);
      if (gone.length) this._scenesStash = gone;
      n.routes = n.routes.filter((r) => r.url);
      return;
    }
    if (n.routes.some((r) => !r.url)) return;
    // Restore what was removed this session, else the copy the bundle ships.
    let add = this._scenesStash;
    if (!add && this._bundle) {
      const probe = (x) => {
        if (!x || typeof x !== "object") return null;
        if (Array.isArray(x)) { for (const y of x) { const r = probe(y); if (r) return r; } return null; }
        if (Array.isArray(x.routes)) return x.routes.filter((r) => !r.url);
        for (const k of Object.keys(x)) { const r = probe(x[k]); if (r) return r; }
        return null;
      };
      add = probe(this._bundle.scaffold && this._bundle.scaffold.nav);
    }
    if (add && add.length) n.routes = n.routes.concat(clone(add));
    else this._log("no Scenes entry to restore - save once so the bundle loads", "warn");
  }

  // Every live source, in the card's rank order. Slot order is not that order.
  // Shared: both previews draw the same widget off the same room.
  _npList(V) {
    const states = this._hass.states;
    // The card's own key per slot - mp1..mp10, plex1..2, psn1..2. npArt keys off
    // it, so a new game in the same slot cannot inherit the last one's cover.
    const out = [];
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .map((n) => ["player", V["media_player_" + n], "mp" + n])
      .concat([1, 2].map((n) => ["plex", V["plex_stream_" + n], "plex" + n]))
      .concat([1, 2].map((n) => ["psn", V["psn_" + n], "psn" + n]))
      .filter((x) => x[1])
      .forEach(([k, id, key]) => {
        const found = npSource(k, id, states);
        if (found) { found.key = key; out.push(found); }
      });
    npActivitySources(V, states).forEach((r) => out.push(r));

    // Discord reports every launcher, so a Steam game arrives twice.
    const dc = out.find((r) => r.key === "discord");
    const st = out.find((r) => r.key === "steam");
    if (dc && st && npSameGame(dc.title, st.title)) {
      const policy = String(V.duplicate_game || "").toLowerCase() || "discord";
      if (policy !== "both") {
        const win = policy === "steam" ? st : dc;
        const lose = win === dc ? st : dc;
        if (!win.art) win.art = lose.art;
        if (!win.subtitle) win.subtitle = lose.subtitle;
        out.splice(out.indexOf(lose), 1);
      }
    }

    // hemma_now_playing's own rank, tie-broken by most recently started.
    const rank = (r) => {
      const c = r.controls;
      const hasCtl = !!(c && (c.toggle || c.next || c.prev));
      return (hasCtl ? 4 : 0) + (r.playing ? 2 : 0) + (r.kind !== "activity" ? 1 : 0);
    };
    out.sort((x, y) => (rank(y) - rank(x)) || ((y.started || 0) - (x.started || 0)));

    const pin = String(V.pinned_key || "").trim();
    if (pin) {
      const i = out.findIndex((r) => r.key === pin);
      if (i > 0) out.unshift(out.splice(i, 1)[0]);
    }
    return out;
  }

  _npLive(V) {
    return this._npList(V)[0] || null;
  }

  // One tile per live source. The placeholder stays in the markup as the empty
  // state, so a room with nothing playing still shows where the panel lands.
  _paintNpStack(host, V) {
    if (!host) return;
    const list = this._npList(V);
    const first = host.querySelector(".mini-nptile");
    if (!list.length || !first) return;
    this._paintNpTile(first, V, list[0]);
    list.slice(1, NP_STACK_SLOTS).forEach((src) => {
      const el = first.cloneNode(true);
      el.dataset.mk = "npt:" + src.key;
      // A clone carries the first tile's state, so it starts neutral.
      el.classList.remove("noctl", "noart");
      const art = el.querySelector(".mini-npart");
      art.classList.remove("art");
      art.style.backgroundImage = "";
      const ctl = el.querySelector(".mini-npctl");
      if (ctl) ctl.remove();
      const bar = el.querySelector(".mini-npbar");
      if (bar) bar.remove();
      host.appendChild(el);
      this._paintNpTile(el, V, src);
    });
  }

  _paintNpTile(el, V, src) {
    if (!el) return;
    const s = src || this._npLive(V);
    if (!s) return;
    const c = s.controls;
    const hasCtl = !!(c.toggle || c.next || c.prev);
    el.classList.toggle("noctl", !hasCtl);
    if (NP_ACCENT[s.kind]) el.style.setProperty("--np-accent", NP_ACCENT[s.kind]);

    const art = el.querySelector(".mini-npart");
    const pic = npArt(s);
    if (pic) {
      art.classList.add("art");
      art.style.backgroundImage = "url('" + pic + "')";
    }
    el.querySelector(".mini-nptitle").textContent = s.title;
    el.querySelector(".mini-npsub").textContent = npSubLine(s);

    const pos = Number(s.pos);
    const dur = Number(s.dur);
    if (Number.isFinite(pos) && Number.isFinite(dur) && dur > 0) {
      const bar = document.createElement("span");
      bar.className = "mini-npbar";
      const fill = document.createElement("span");
      fill.style.width = Math.max(0, Math.min(100, (pos / dur) * 100)).toFixed(1) + "%";
      bar.appendChild(fill);
      el.querySelector(".mini-nptext").appendChild(bar);
    }

    if (!hasCtl) return;
    const row = document.createElement("span");
    row.className = "mini-npctl";
    [["prev", c.prev, "var(--np-gs)"], ["toggle", c.toggle, "var(--np-gp)"],
      ["next", c.next, "var(--np-gs)"]].forEach(([slot, shown, h]) => {
      if (!shown) return;
      const b = document.createElement("span");
      b.innerHTML = npGlyphSvg(
        slot === "toggle" ? (s.playing ? "pause" : "play") : slot, h);
      row.appendChild(b);
    });
    el.appendChild(row);
  }

  // What the preview will be showing, without building it - the exit animation
  // has to run on the card that is still up, so the leavers are known first.
  _miniKeys(room) {
    const V = room.variables || {};
    const out = new Set(this._miniModel(room).map((b) => "b:" + b.id));
    (room.tiles || []).forEach((t) => {
      const k = this._tileKey(t);
      out.add("t:" + k);
      // Either/or, exactly as _paintTile draws them: registering both would
      // leave the diff waiting on a toggle the tile never painted.
      const ent = t.entity && ((this._hass && this._hass.states) || {})[t.entity];
      if (tileProgressOn(t, ent)) out.add("pr:" + k);
      else if (tileToggleOn(t, tileTypeOf(t))) out.add("tg:" + k);
    });
    if (this._scenesOn()) out.add("sc");
    if (V.weather_temp_sensor || V.weather_entity) out.add("w");
    if (V.show_media !== false && V.show_now_playing) {
      out.add("np");
      // One key per tile, or the diff reads the clones as arriving every render
      // and replays the entrance.
      // "npt" is the wide stack's first tile, keyed in the markup; every other
      // tile there and EVERY tile on the phone carries npt:<key>.
      if (!this._npMinFor(room)) {
        out.add("npt");
        this._npList(V).slice(0, NP_STACK_SLOTS)
          .forEach((src) => out.add("npt:" + src.key));
      }
    }
    return out;
  }

  // Start minimized collapses to the waveform on load, and tapping the waveform
  // expands it - the same one-shot the dashboard does, held per room here so
  // flipping the option in the form re-collapses the preview.
  _npMinFor(room) {
    const want = !!(room.variables || {}).start_minimized;
    const key = room.path + "|" + want;
    if (this._npMinKey !== key) { this._npMinKey = key; this._npMin = want; }
    return this._npMin;
  }

  // Anything leaving shrinks away first, then the card is swapped and anything
  // new swells in. The swap is deferred through the exit, which is the only way
  // to animate an element the rebuild is about to destroy.
  _swapMap(mount, room) {
    const old = mount.firstElementChild;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const token = (this._mapSwap = (this._mapSwap || 0) + 1);
    // Read before commit: applySize is what moves _mapRoom on.
    const roomChanged = this._mapRoom !== room.path;
    const shapeSwap = !!this._mapShapeSwap;
    this._mapShapeSwap = false;

    const commit = () => {
      if (token !== this._mapSwap) return;
      const prev = new Set([...(old ? old.querySelectorAll("[data-mk]") : [])]
        .map((e) => e.dataset.mk));
      const card = this._roomMap();
      // Carry the live <img> elements across rather than letting fresh ones
      // decode: even straight from cache a new element paints a frame late, and
      // that frame is the room photo vanishing on every keystroke.
      if (old) {
        const pool = new Map();
        old.querySelectorAll("img").forEach((was) => {
          if (!was.src || !was.complete) return;
          // Never a cross-fade ghost: it is a COPY of the outgoing photo, so on a
          // toggle back the pool hands it over still fading to 0 and still due to
          // remove itself.
          if (was.dataset.ghost) return;
          if (was.getAnimations && was.getAnimations().length) return;
          if (!pool.has(was.src)) pool.set(was.src, []);
          pool.get(was.src).push(was);
        });
        // The new node's classes and dataset are the current truth; only the
        // decoded bitmap is worth keeping, so the old element takes them on.
        card.querySelectorAll("img").forEach((now) => {
          const free = pool.get(now.src);
          if (!free || !free.length) return;
          const was = free.shift();
          was.className = now.className;
          was.alt = now.alt;
          now.replaceWith(was);
        });
      }
      // Scroll survives the swap. The phone body scrolls and the wide tile row
      // scrolls, and a live refresh that put either back to the start would
      // take the page out from under whoever was reading it.
      const scrolls = [".mp-body", ".mini-tiles", ".mp-badges"];
      const keep = new Map();
      if (old) scrolls.forEach((sel) => {
        const was = old.querySelector(sel);
        if (was && (was.scrollTop || was.scrollLeft)) {
          keep.set(sel, [was.scrollTop, was.scrollLeft]);
        }
      });
      mount.replaceChildren(card);
      keep.forEach(([top, left], sel) => {
        const now = card.querySelector(sel);
        if (!now) return;
        now.scrollTop = top;
        now.scrollLeft = left;
      });
      if (this._applyMapSize) this._applyMapSize(shapeSwap);
      if (still || !old || roomChanged || shapeSwap) return;
      card.querySelectorAll("[data-mk]").forEach((e) => {
        if (prev.has(e.dataset.mk)) return;
        e.animate(MAP_IN, { duration: RT(300), easing: EASE, fill: "backwards" });
      });
    };

    // _miniKeys describes ONE room. The phone card holds every section, so on
    // that shape every tile read as leaving, animated out over 180ms, and was
    // snapped back by the commit - the collapse-and-flicker on every refresh.
    const next = still || !old || roomChanged || shapeSwap || this._miniSize === "phone"
      ? null : this._miniKeys(room);
    const leaving = next
      ? [...old.querySelectorAll("[data-mk]")].filter((e) => !next.has(e.dataset.mk))
      : [];
    if (!leaving.length) return commit();
    let done = 0;
    const after = () => { if (++done === leaving.length) commit(); };
    leaving.forEach((e) => {
      e.animate(MAP_OUT, { duration: 180, easing: "cubic-bezier(.4,0,.9,.6)", fill: "forwards" })
        .finished.then(after, after);
    });
  }

  // Just the preview. A field edit should show up immediately, but rebuilding
  // the whole form would pull the ground out from under the control being used.
  _syncPreview() {
    this._markDirty();
    const mount = this.$("mapmount");
    if (!mount || !mount.firstChild) return;
    const room = this._state && this._state.compact.rooms[this._room];
    if (!room) return;
    this._swapMap(mount, room);
  }

  // Rebuild the preview from scratch and re-fit it. Clearing _mapSig is what
  // makes it actually rebuild: _renderForm skips _swapMap when the signature is
  // unchanged, and the signature does not know the mock's SHAPE changed.
  _rebuildPreview() {
    const mount = this.$("mapmount");
    const room = this._state && this._state.compact.rooms[this._room];
    if (!mount || !room) return;
    this._mapSig = null;
    // The SHAPE is changing, so the outgoing tree has nothing in common with the
    // incoming one: it must not be held for an exit animation, and it must not be
    // SIZED on the way out - that measures the new shape against the old card and
    // draws it stretched. commit() sizes it once the new card is there.
    this._mapShapeSwap = true;
    this._swapMap(mount, room);
  }

  // Which size buttons are on offer. Called on every load, not once at build:
  // deciding it when the control was created meant a dashboard opened later
  // kept the previous one's options, which is how a phone layout ended up
  // offering Desktop and Tablet.
  _syncSizeOpts() {
    const seg = this.$("sizeseg");
    if (!seg) return;
    const show = (sel, on) => seg.querySelectorAll(sel).forEach((b) => { b.hidden = !on; });
    // Desktop and Tablet are always honest; Phone appears once there is a phone
    // half to draw. No case hides the wide ones any more - a home is always
    // edited from its wide half.
    show('[data-size="desktop"],[data-size="tablet"]', true);
    show('[data-size="phone"]', this._phoneReachable());
    this._miniSize = this._sizeAllowed(this._miniSize);
    seg.querySelectorAll(".segopt").forEach((b) => {
      b.classList.toggle("on", b.dataset.size === this._miniSize);
    });
  }

  // Which shapes this dashboard can honestly be previewed at. A phone layout
  // has no wide shape to show, and a wide dashboard with no phone half has no
  // phone one - offering either would draw a picture of nothing.
  _sizeAllowed(want) {
    const ok = ["desktop", "tablet"];
    if (this._phoneReachable()) ok.push("phone");
    return ok.indexOf(want) === -1 ? "desktop" : want;
  }

  // The phone half's state, whichever way it is reached: editing it directly,
  // or previewing it from the wide dashboard it is paired with.
  _phoneState() {
    if ((this._state || {}).surface === "mobile") return this._state;
    const p = this._pair;
    if (!p || p.safe === false) return null;
    // Sync the phone half FIRST: tile settings live on the wide half and used to
    // reach the phone config only on save, so the phone preview drew a tile you
    // had just turned off. syncPairTiles is idempotent, so this costs one pass.
    syncPairTiles(p);
    // Scenes is three cards on the phone, built from a switch on the wide half.
    // Same reason as the tiles: the preview has to show the switch NOW, not at
    // the next save.
    syncScenesMobile(p, this._scenesOn());
    syncCamerasMobile(p, this._hass);
    return p.mobile;
  }

  // The phone half's own config, not the wide room narrowed: its rooms are
  // SECTIONS of one scrolling view under a single hero. Tiles go through the same
  // _paintTile, because they are the same cards.
  _phoneMap(card) {
    const st = this._phoneState();
    const screen = document.createElement("div");
    screen.className = "miniphone";
    if (!st) {
      screen.classList.add("nophone");
      card.appendChild(screen);
      return;
    }

    const shell = (st.scaffold || {}).shell || {};
    const sv = shell.variables || {};
    const chrome = (st.chrome || {}).items || [];
    const cardOf = (tpl) => (chrome.find((it) => it.card && it.card.template === tpl) || {}).card;

    // The hero. One photo for the whole dashboard - the sections share it -
    // falling back to the wide dashboard's overview room when the phone half
    // has none of its own, which is exactly what the theme does.
    const img = document.createElement("img");
    img.className = "mp-photo";
    img.alt = "";
    const wide = (((this._pair || {}).desktop || {}).compact || {}).rooms || [];
    const home = wide.find((r) => r.path === "home") || wide[0];
    const name = sv.image || (home && (home.variables || {}).image);
    const found = (this._imgs || []).find((i) => i.name === name);
    const url = found && ((this._miniDark && found.night) || found.day);
    if (url) img.src = url; else screen.classList.add("nophoto");
    screen.appendChild(img);
    const wash = document.createElement("div");
    wash.className = "mp-wash";
    screen.appendChild(wash);

    // A filter is a popup laid OVER the dashboard, which stays blurred underneath
    // while it is open - so the hero and the field hold the blur rather than it
    // ramping off when the entrance finishes.
    const veil = document.createElement("div");
    veil.className = "mp-veil";
    screen.appendChild(veil);
    if (this._phoneFilter) screen.classList.add("filtered");

    // The popup's back button. filter-overlay's own: a 40px disc with a convex
    // sheen lit from above, a conic rim, and the dark side wraps that ground it.
    // No backdrop-filter - inside a card the preview draws scaled it renders
    // nothing, and the fill plus the rim is what carries the look anyway.
    if (this._phoneFilter) {
      const back = document.createElement("div");
      back.className = "mp-back";
      back.title = "Back";
      back.innerHTML = '<svg width="14" height="24" viewBox="0 0 14 24" fill="none">'
        + '<path d="M12 2.5 L2.8 12 L12 21.5" stroke="#fff" stroke-width="3"'
        + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
      back.onclick = (ev) => {
        ev.stopPropagation();
        this._phoneFilter = null;
        this._phoneFilterAnim = true;
        this._rebuildPreview();
      };
      screen.appendChild(back);
    }

    const body = document.createElement("div");
    body.className = "mp-body";
    screen.appendChild(body);

    // The scroll-linked header. Three layers, as filter-overlay builds them.
    const bar = document.createElement("div");
    bar.className = "mp-bar";
    const baredge = document.createElement("div");
    baredge.className = "mp-baredge";
    const bartitle = document.createElement("div");
    bartitle.className = "mp-bartitle";
    screen.appendChild(bar);
    screen.appendChild(baredge);
    screen.appendChild(bartitle);

    // Weather, where the phone puts it: over the photo, before anything else.
    const wcard = cardOf("hemma_mobile_weather");
    const wv = (wcard && wcard.variables) || {};
    const went = wv.weather_entity && this._hass.states[wv.weather_entity];
    // The title row: the home's name large on the left, the weather small on
    // the right at the same height. Not a bare temperature in the corner.
    const trow = document.createElement("div");
    trow.className = "mp-title";
    trow.dataset.jump = "Appearance";
    const h1 = document.createElement("span");
    h1.className = "mp-name";
    h1.textContent = (this._pair && ((this._pair.desktop.compact.rooms
      .find((r) => r.path === "home") || {}).name)) || "Home";
    trow.appendChild(h1);

    const wtemp = went && this._hass.states[wv.weather_temp_sensor];
    const deg = wtemp ? Math.round(Number(wtemp.state))
      : (went ? Math.round(Number(went.attributes.temperature)) : null);
    if (deg !== null && !Number.isNaN(deg)) {
      const w = document.createElement("span");
      w.className = "mp-weather";
      const t = document.createElement("span");
      t.className = "mp-wtemp";
      t.textContent = deg + "\u00b0";
      const c = document.createElement("span");
      c.className = "mp-wcond";
      // Written out, not cap(): that helper is a LOCAL const inside mediaWord
      // and tileStateWord, not a module function. Calling it from here threw,
      // which aborted the whole mock and left the wide card on screen - so
      // tapping Phone looked like it did nothing at all.
      const cond = went ? String(went.state).replace(/[-_]/g, " ") : "";
      c.textContent = cond ? cond.charAt(0).toUpperCase() + cond.slice(1) : "";
      w.appendChild(t); w.appendChild(c);
      // The condition glyph, from the same WEATHER_SVG set the wide preview
      // draws - it sits beside the reading on the device, and the phone mock
      // was printing the words with nothing next to them.
      const file = WEATHER_SVG[String((went && went.state) || "").toLowerCase()];
      const wg = document.createElement("img");
      wg.className = "mp-wglyph";
      wg.alt = "";
      wg.src = file ? "/local/hemma/weather/" + file + ".svg" : iconUrl("weather");
      const wwrap = document.createElement("span");
      wwrap.className = "mp-wx";
      wwrap.appendChild(w);
      wwrap.appendChild(wg);
      // Never in a popup. A filter page is titled after the filter and carries
      // nothing else up there - the weather belongs to the home screen.
      if (!this._phoneFilter) trow.appendChild(wwrap);
    }
    body.appendChild(trow);

    // The filter badges. Same pills the wide dashboard draws, in the phone's
    // own row - they are the same badge templates underneath.
    const bcard = cardOf("hemma_mobile_filter_badges");
    const bv = (bcard && bcard.variables) || {};
    const brow = document.createElement("div");
    brow.className = "mp-badges";
    brow.dataset.jump = "badges";
    // Labeled pills, not bare glyphs: these are the filter controls, and a row of
    // unlabeled circles says nothing about what tapping one does.
    // The SAME model the wide preview builds its pills from - one description of a
    // badge, so icon, color, label and reading cannot disagree between the halves.
    // The six switches are SHARED keys owned by the wide half, so they are read
    // from there rather than waited for.
    const wideHome = (((this._pair || {}).desktop || {}).compact || {}).rooms || [];
    const wideV = ((wideHome.find((r) => r.path === "home") || wideHome[0] || {}).variables) || {};
    const bvv = { ...bv };
    ["show_climate", "show_lights", "show_people", "show_media",
     "show_security", "show_energy"].forEach((k) => {
      if (wideV[k] !== undefined) bvv[k] = wideV[k];
    });
    // Ordered by badge_order, which both surfaces read, rather than by the
    // built-in list - otherwise the preview and the phone disagree the moment
    // anything is dragged.
    const wideRoom = (wideHome.find((r) => r.path === "home") || wideHome[0] || {});
    const border = this._badgeOrder(wideRoom);
    // The WIDE room's variables: the phone card carries only the mirrored
    // subset, so building from it drops whole badges. The wide half is the
    // authority for every shared key.
    const model = this._miniModel({ variables: { ...bvv, ...wideV } }, { phone: true })
      .filter((b) => PHONE_FILTERS.indexOf(b.id) !== -1)
      .sort((a, b) => border.indexOf(a.id) - border.indexOf(b.id));

    // Tapping a badge FILTERS. The wide dashboard expands a pill into sub
    // badges; the phone has no sub badge row at all.
    model.forEach((b) => {
      const el = this._paintBadge(b, false);
      el.classList.toggle("open", this._phoneFilter === b.id);
      el.title = "Filter the dashboard to " + (b.label || b.id);
      el.onclick = (ev) => {
        ev.stopPropagation();
        this._phoneFilter = this._phoneFilter === b.id ? null : b.id;
        this._phoneFilterAnim = true;
        // ONE rebuild. _select re-renders, and the signature now carries the
        // filter, so the preview is rebuilt exactly once - with the animation
        // still armed on the card that survives.
        const pick = selKeyOf(el.dataset.mk);
        if (pick) this._select(pick); else this._rebuildPreview();
      };
      brow.appendChild(el);
    });
    if (this._phoneFilter && this._phoneFilter !== "scenes"
      && !model.some((b) => b.id === this._phoneFilter)) {
      this._phoneFilter = null;
    }
    // Filtered, the hero says which filter you are in rather than the home's
    // name - the phone titles the page after the category.
    if (this._phoneFilter) {
      // Scenes is not one of the badges, so it names itself.
      if (this._phoneFilter === "scenes") h1.textContent = "Scenes";
      else {
        const on = model.find((b) => b.id === this._phoneFilter);
        if (on && on.label) h1.textContent = on.label;
      }
    }

    // A ROOM popup has no badge row - filter-overlay's own `noBadge =
    // !!this._config?.room` - and Scenes is a room popup, not a category one.
    // The category filters keep theirs.
    if (brow.children.length && this._phoneFilter !== "scenes") body.appendChild(brow);

    // The chips row sits collapsed under the badges and filter-overlay DOM-moves
    // it into whichever filter opens, so it is invisible on Home.
    // CLIMATE only: the row travels to every filter but the card gates its own
    // contents a second time (`filter === 'climate'`), so the others get an
    // empty row rather than these readings.
    if (this._phoneFilter === "climate") {
      const clim = model.find((b) => b.id === "climate");
      const chips = (clim && clim.subs) || [];
      if (chips.length) {
        const crow = document.createElement("div");
        crow.className = "mp-chips";
        crow.dataset.jump = "badges";
        chips.forEach((sb) => crow.appendChild(this._paintChip(sb)));
        body.appendChild(crow);
      }
    }

    // People carries its OWN cards rather than filtering tiles - no tile has a
    // presence category, so filtering by it produced an empty screen.
    // The Scenes page is a filter page like the rest, with a two-column grid
    // instead of a row.
    if (this._phoneFilter === "scenes") {
      const scenes = this._sceneList();
      const live = this._activeScene(scenes.map((x) => x.id));
      const colors = (wideV.scene_colors || {});
      const grid = document.createElement("div");
      grid.className = "mp-scenes grid";
      grid.dataset.jump = "Scenes";
      scenes.forEach((sc) => {
        grid.appendChild(this._paintSceneChip(sc, sc.id === live, colors));
      });
      body.appendChild(grid);
      card.appendChild(screen);
      if (this._phoneFilterAnim) {
        this._phoneFilterAnim = false;
        requestAnimationFrame(() => this._playPhoneFilterIn(screen));
      }
      return;
    }

    if (this._phoneFilter === "people") {
      const ids = [1, 2, 3, 4].map((n) => wideV["presence_entity_" + n]).filter(Boolean);
      const row = document.createElement("div");
      row.className = "mp-tiles";
      row.dataset.jump = "badges";
      ids.forEach((id, i) => {
        row.appendChild(this._paintTile(this._personTile(id), i,
          { name: "People", tiles: [] }));
      });
      if (!ids.length) {
        const ghost = document.createElement("div");
        ghost.className = "mtile ghost";
        row.appendChild(ghost);
      }
      body.appendChild(row);
      card.appendChild(screen);
      if (this._phoneFilterAnim) {
        this._phoneFilterAnim = false;
        requestAnimationFrame(() => this._playPhoneFilterIn(screen));
      }
      return;
    }

    // Between the badges and Scenes, and where the title and artwork belong -
    // the Media pill above only counts. Drawn only while something plays.
    if (!this._phoneFilter && wideV.show_media !== false && wideV.show_now_playing) {
      const npall = this._npList(wideV);
      if (npall.length) {
        const nphead = document.createElement("div");
        nphead.className = "mp-head";
        nphead.dataset.jump = "Now Playing";
        const nt = document.createElement("span");
        nt.textContent = "Now Playing";
        nphead.appendChild(nt);
        body.appendChild(nphead);

        // The device draws a horizontal, snap-scrolling row of FULL-WIDTH tiles,
        // one per source - not a stack. Its own settings: x mandatory, and
        // snap-stop always so a swipe advances exactly one tile.
        const nprow = document.createElement("div");
        nprow.className = "mp-nprow";
        nprow.dataset.jump = "Now Playing";
        body.appendChild(nprow);

        npall.slice(0, NP_STACK_SLOTS).forEach((nps) => {
        const ctl = nps.controls;
        const hasCtl = ctl.toggle || ctl.next || ctl.prev;

        const np = document.createElement("div");
        np.className = "mp-np" + (hasCtl ? "" : " noctl") + (npArt(nps) ? "" : " noart");
        np.dataset.jump = "Now Playing";
        if (NP_ACCENT[nps.kind]) np.style.setProperty("--np-accent", NP_ACCENT[nps.kind]);
        const art = document.createElement("span");
        art.className = "mp-npart";
        const npic = npArt(nps);
        if (npic) art.style.backgroundImage = "url('" + npic + "')";
        const col = document.createElement("span");
        col.className = "mp-nptext";
        const ti = document.createElement("span");
        ti.className = "mp-nptitle";
        ti.textContent = nps.title;
        const sb = document.createElement("span");
        sb.className = "mp-npsub";
        sb.textContent = npSubLine(nps);
        col.appendChild(ti);
        col.appendChild(sb);

        // The bar only draws where the player reports a position AND a length.
        const pos = Number(nps.pos);
        const dur = Number(nps.dur);
        if (Number.isFinite(pos) && Number.isFinite(dur) && dur > 0) {
          const bar = document.createElement("span");
          bar.className = "mp-npbar";
          const fill = document.createElement("span");
          fill.style.width = Math.max(0, Math.min(100, (pos / dur) * 100)).toFixed(1) + "%";
          bar.appendChild(fill);
          col.appendChild(bar);
        }

        if (hasCtl) {
          const row = document.createElement("span");
          row.className = "mp-nptransport";
          const playing = nps.playing;
          [["prev", ctl.prev, 16], ["toggle", ctl.toggle, 20],
            ["next", ctl.next, 16]].forEach(([slot, shown, h]) => {
            if (!shown) return;
            const b = document.createElement("span");
            b.className = "mp-npbtn";
            b.innerHTML = npGlyphSvg(
              slot === "toggle" ? (playing ? "pause" : "play") : slot, h);
            row.appendChild(b);
          });
          np.appendChild(row);
        }

        np.appendChild(art);
        np.appendChild(col);
        np.dataset.mk = "npt:" + nps.key;
        nprow.appendChild(np);
        });
      }
    }

    // Scenes is CHROME on the phone, not a room, so the section loop never sees
    // it. Above Favorites, where syncScenesMobile puts the cards.
    if (this._scenesOn() && !this._phoneFilter) {
      const scenes = this._sceneList();
      if (scenes.length) {
        const shead = document.createElement("div");
        shead.className = "mp-head tappable";
        shead.dataset.jump = "Scenes";
        shead.title = "Open the Scenes page";
        shead.onclick = (ev) => {
          ev.stopPropagation();
          this._phoneFilter = "scenes";
          this._phoneFilterAnim = true;
          this._rebuildPreview();
        };
        const st2 = document.createElement("span");
        st2.textContent = "Scenes";
        shead.appendChild(st2);
        const chev = document.createElement("span");
        chev.className = "mp-chev";
        chev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
        shead.appendChild(chev);
        const sgroup = document.createElement("div");
        sgroup.className = "mp-scenegroup";
        body.appendChild(sgroup);
        sgroup.appendChild(shead);

        const srow = document.createElement("div");
        srow.className = "mp-scenes";
        srow.dataset.jump = "Scenes";
        const live = this._activeScene(scenes.map((x) => x.id));
        const colors = (wideV.scene_colors || {});
        scenes.forEach((sc) => {
          srow.appendChild(this._paintSceneChip(sc, sc.id === live, colors));
        });
        sgroup.appendChild(srow);

        // ONE box grows, contents already inside it. Two staggered heights in a
        // flex column is what made this jerk.
        if (this._phoneScenesIn
          && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          this._phoneScenesIn = false;
          const h = sgroup.offsetHeight || 0;
          sgroup.style.overflow = "hidden";
          sgroup.animate(
            [{ height: "0px", opacity: 0, marginBottom: "0px" },
             { height: h + "px", opacity: 1, marginBottom: "0px" }],
            { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "backwards" }
          ).finished.then(() => sgroup.style.removeProperty("overflow"),
                          () => sgroup.style.removeProperty("overflow"));
        }
      }
    }

    // Then the sections, in the order the phone scrolls them.
    (st.compact.rooms || []).forEach((sec, n) => {
      // Disabled is disabled; then the filter, if one is on. smart-row's own
      // rule: no category means the tile is not part of any filter and drops
      // out, and "unfiltered" means it drops out of every one.
      const keep = (t) => {
        if (!this._phoneFilter) return true;
        const cat = tileCategory(t);
        if (cat === null || cat === undefined) return false;
        if (cat === "unfiltered") return false;
        return cat === this._phoneFilter;
      };
      const shown = (sec.tiles || [])
        .filter((t) => (t.variables || {}).enabled !== false)
        .filter(keep);
      // A section with nothing in this filter is gone, heading and all. The
      // empty-state ghost is an invitation to add a tile, which is the wrong
      // thing to say about a section that simply has no climate in it.
      if (this._phoneFilter && !shown.length) return;

      const head = document.createElement("div");
      head.className = "mp-head";
      const ht = document.createElement("span");
      ht.textContent = sec.name || "";
      head.appendChild(ht);
      // Every section but Favorites opens a room popup, and says so.
      if ((sec.name || "") !== MOBILE_FAVORITES) {
        const chev = document.createElement("span");
        chev.className = "mp-chev";
        chev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
        head.appendChild(chev);
      }
      body.appendChild(head);

      const row = document.createElement("div");
      row.className = "mp-tiles";
      row.dataset.jump = "tiles";
      if (!shown.length) {
        const ghost = document.createElement("div");
        ghost.className = "mtile ghost";
        row.appendChild(ghost);
      }
      const painted = shown.map((tile, ti) => {
        const el = this._paintTile(tile, ti, sec);
        // Phone tiles come in two heights; the wide ones have one.
        if ((tile.variables || {}).size === "large") el.classList.add("mp-lg");
        // _tileKey keys off the tile OBJECT, and these are the PHONE config's -
        // a different graph from the one the form edits, so the key matched
        // nothing. Point the tap at the wide twin.
        const twin = this._wideTwinOf(tile);
        if (twin) {
          el.dataset.mk = "t:" + this._tileKey(twin.tile);
          el.dataset.mproom = String(twin.roomIndex);
        } else {
          // Phone-only, so there is nothing in the form to open.
          delete el.dataset.mk;
          el.title = "This tile is on the phone layout only";
        }
        return el;
      });
      // Active cards rise, the rest hold their configured order. Read per
      // SECTION: each phone section is its own smart row with its own flag.
      const sorted = !(sec._row && sec._row.sort === false);
      if (sorted) {
        painted.filter((el) => el.classList.contains("on")).forEach((el) => row.appendChild(el));
        painted.filter((el) => !el.classList.contains("on")).forEach((el) => row.appendChild(el));
      } else {
        painted.forEach((el) => row.appendChild(el));
      }
      body.appendChild(row);
    });

    // Scroll-linked like the dashboard's: the big title is gone by 45% and the
    // compact one enters after 55%. Measured against the title's LIVE position,
    // not a fixed scrollTop, so the handover holds whatever is above it.
    bartitle.textContent = h1.textContent;
    const BAR_H = 44;
    const onScroll = () => {
      // The hero travels with the content. It cannot MOVE inside the body: the
      // body clips overflow-x, and the photo overhangs its box by 3x the blur
      // radius so the blur does not sample past its edge. Offset by the scroll
      // instead, which keeps both.
      const sy = body.scrollTop;
      img.style.transform = "translate3d(0," + (-sy).toFixed(1) + "px,0)";
      wash.style.transform = "translate3d(0," + (-sy).toFixed(1) + "px,0)";
      const r = h1.getBoundingClientRect();
      const s0 = screen.getBoundingClientRect();
      const scale = (this._mapVis && this._mapVis.scale) || 1;
      const barBottom = s0.top + BAR_H * scale;
      const safeTop = barBottom - BAR_H * scale;
      const span = barBottom + 24 * scale - safeTop;
      const p = span <= 0 ? 0
        : Math.max(0, Math.min(1, (barBottom + 24 * scale - r.bottom) / span));
      const tp = Math.min(1, p / 0.45);
      h1.style.opacity = String(1 - tp);
      const cp = Math.max(0, Math.min(1, (p - 0.55) / 0.45));
      bar.style.opacity = String(cp);
      baredge.style.opacity = String(cp);
      bartitle.style.opacity = String(cp);
      bartitle.style.transform = "translateY(" + ((1 - cp) * 5).toFixed(2) + "px)";
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(onScroll);

    card.appendChild(screen);

    // filter-overlay's own entrance, numbers included: blur up over 0.30s, the
    // header receding, sections springing in on a 40ms stagger.
    if (this._phoneFilterAnim) {
      this._phoneFilterAnim = false;
      requestAnimationFrame(() => this._playPhoneFilterIn(screen));
    }
  }

  // Both directions. Opening a filter and returning from one are the same
  // move on the device, so they are the same move here.
  _playPhoneFilterIn(screen) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const SPRING_IN = "cubic-bezier(0.32, 0.72, 0, 1)";
    const EASE_OUT = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

    const body = screen.querySelector(".mp-body");
    if (!body) return;

    // A filter on the CONTENT, not a backdrop-filter over it: inside a card that
    // is drawn scaled, backdrop sampling is unreliable and rendered nothing. A
    // filter is immune to the transform and ramps identically.
    body.animate(
      [{ filter: "blur(14px)" }, { filter: "blur(0px)" }],
      { duration: 300, easing: "ease", fill: "backwards" });

    // Its 22% black, over the top and gone by the time the sections land.
    const scrim = document.createElement("div");
    scrim.className = "mp-scrim";
    screen.appendChild(scrim);
    scrim.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: 300, easing: "ease", fill: "forwards" })
      .finished.then(() => scrim.remove(), () => scrim.remove());
    // The way out arrives with the popup rather than blinking in after it.
    const back = screen.querySelector(".mp-back");
    if (back) {
      back.animate(
        [{ opacity: 0, transform: "scale(0.9)" }, { opacity: 1, transform: "none" }],
        { duration: 300, delay: 60, easing: EASE_OUT, fill: "backwards" });
    }

    const title = body.querySelector(".mp-title");
    if (title) {
      title.animate(
        [{ transform: "scale(0.93) translateY(20px)", opacity: 0 },
         { transform: "none", opacity: 1 }],
        { duration: 420, easing: EASE_OUT, fill: "backwards" });
    }
    // Heading and its row travel together, as one section does in the popup.
    // Every section the page can hold, or the one on a Scenes page would arrive
    // with no animation at all while the rest of the entrance played around it.
    const sections = [...body.children].filter((el) =>
      el.classList.contains("mp-head") || el.classList.contains("mp-tiles")
      || el.classList.contains("mp-scenegroup") || el.classList.contains("mp-chips"));
    const h = screen.clientHeight || 844;
    sections.forEach((el, i) => {
      el.animate(
        [{ transform: "translateY(" + h + "px)" }, { transform: "translateY(0)" }],
        { duration: 550, delay: Math.floor(i / 2) * 40, easing: SPRING_IN, fill: "backwards" });
    });
  }

  // One preview tile, shared by both mocks: they are the same cards on both
  // dashboards, and a second painter would drift.
  // One scene chip, at hemma_scene_core's own tint rule - on takes
  // scene_colors[id] or the yellow accent, off is a flat white. Read off
  // SC.chip, not the generic chip()'s active rule.
  _paintSceneChip(sc, on, colors) {
    const chip = document.createElement("div");
    chip.className = "mp-scene" + (on ? " on" : "");
    const accent = "var(--hemma-color-yellow, #FFCC00)";
    const tint = on
      ? ((colors || {})[sc.id] || accent)
      : "rgba(255,255,255,0.90)";
    const ic = document.createElement("ha-icon");
    ic.setAttribute("icon", sc.icon);
    ic.style.color = tint;
    ic.style.transition = "color 0.45s ease";
    const lb = document.createElement("span");
    lb.textContent = sc.label;
    chip.appendChild(ic);
    chip.appendChild(lb);
    return chip;
  }

  // hemma_scene_core's rule: a scene is active when every entity it stores still
  // matches live state, not when it was most recently activated. Configs come
  // from _hemmaSC's localStorage cache; no cache means no scene is shown active,
  // which is honest rather than a guess.
  _activeScene(ids) {
    let cfg = this._sceneCfg;
    if (cfg === undefined) {
      try { cfg = JSON.parse(localStorage.getItem("hemma_scene_cfg_v1") || "null"); }
      catch (e) { cfg = null; }
      this._sceneCfg = cfg;
    }
    if (!cfg) return null;
    let ign = this._sceneIgn;
    if (ign === undefined) {
      try { ign = JSON.parse(localStorage.getItem("hemma_scene_ignore_v1") || "null"); }
      catch (e) { ign = null; }
      this._sceneIgn = ign || {};
    }
    const states = this._hass.states;
    const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b)
      && a.length === b.length && a.every((x, i) => x === b[i]);
    const effectOff = (e) => e == null || e === "off" || e === "None" || e === "none";
    const attrMatch = (t, live) => {
      const la = live.attributes || {};
      if (!effectOff(t.effect)) return String(la.effect) === String(t.effect);
      if (t.effect != null && !effectOff(la.effect)) return false;
      if (t.brightness != null && t.brightness !== la.brightness) return false;
      const mode = t.color_mode;
      if (mode != null && mode !== la.color_mode) return false;
      if (mode === "color_temp") {
        if (t.color_temp_kelvin != null && t.color_temp_kelvin !== la.color_temp_kelvin) return false;
      } else if (mode != null) {
        if (t.rgb_color != null && !eqArr(t.rgb_color, la.rgb_color)) return false;
      }
      return true;
    };
    const entityMatch = (eid, t) => {
      const live = states[eid];
      if (!live) return false;
      if (String(t.state) !== String(live.state)) return false;
      if (String(t.state) !== "on") return true;
      if (!eid.startsWith("light.")) return true;
      return attrMatch(t, live);
    };
    const isActive = (id) => {
      const c = cfg[id];
      if (!c || !c.entities) return false;
      const skip = new Set((this._sceneIgn || {})[id] || []);
      let checked = 0;
      for (const eid of Object.keys(c.entities)) {
        if (skip.has(eid)) continue;
        if (!entityMatch(eid, c.entities[eid])) return false;
        checked++;
      }
      return checked > 0;
    };
    // Most recently activated wins when more than one matches, which is what
    // activeList does with the scene state's timestamp.
    const ts = (id) => {
      const t = Date.parse((states[id] || {}).state);
      return isNaN(t) ? 0 : t;
    };
    return (ids || []).filter(isActive).sort((a, b) => ts(b) - ts(a))[0] || null;
  }

  // Deleting a tile deletes its twin. Done HERE rather than by sweeping at save,
  // because the tile is still whole and its twin key is exact - a sweep cannot
  // tell a deleted twin from a phone-only tile written on purpose.
  _removePairTwin(room, tile) {
    const p = this._pair;
    if (!p || p.safe === false || !tile) return 0;
    const rooms = (p.desktop.compact || {}).rooms || [];
    const idx = rooms.indexOf(room);
    if (idx < 0) return 0;
    const link = (p.link.links || []).find((l) => l.room === idx);
    if (!link || link.section === null || link.section === undefined) return 0;
    const sec = ((p.mobile.compact || {}).rooms || [])[link.section];
    if (!sec) return 0;
    const key = tileTwinKey(tile);
    // Only when the wide half has no OTHER tile with the same key. Two tiles on
    // the same entity and template are one twin between them, and deleting one
    // must not take the survivor's copy with it.
    if ((room.tiles || []).some((t) => t && tileTwinKey(t) === key)) return 0;
    const before = (sec.tiles || []).length;
    sec.tiles = (sec.tiles || []).filter((t) => !(t && tileTwinKey(t) === key));
    return before - sec.tiles.length;
  }

  // CACHED by entity id: _tileKey identifies a tile by object IDENTITY, so
  // fresh objects each render gave every person a new key and replayed the
  // entrance animation. The name and picture are hemma_presence's own - the
  // first word of the friendly name, and the entity's own avatar.
  _personTile(id) {
    if (!this._personTiles) this._personTiles = new Map();
    let t = this._personTiles.get(id);
    if (!t) {
      t = { template: "hemma_presence", entity: id, icon: "person",
        // "home" is not one of hemma_entity's default active states, so both
        // people drew as off. active_states is the mechanism the card already
        // has for exactly this, so use it rather than a special case.
        variables: { person_entity: id, active_states: ["home"] } };
      this._personTiles.set(id, t);
    }
    const e = this._hass.states[id];
    const friendly = (e && e.attributes && e.attributes.friendly_name) || "";
    t.name = String(friendly).trim().split(/\s+/)[0]
      || String(id).split(".").pop().replace(/_/g, " ");
    const pic = (e && e.attributes && e.attributes.entity_picture) || null;
    // Mutated rather than replaced, so the object identity - and the key that
    // rides on it - survives a rename or a new avatar.
    t.variables.entity_picture = pic || undefined;
    return t;
  }

  // A gauge ring around the glyph, ported from the badges' own: 32x32, r13.5,
  // stroke 3, 270 degrees from 225, remainder at 30% white.
  _paintChip(sub) {
    const el = document.createElement("div");
    el.className = "mp-chip";

    const R = 13.5, C = 16, W = 3;
    const pt = (deg) => {
      const a = (deg * Math.PI) / 180;
      return (C + R * Math.sin(a)).toFixed(3) + " " + (C - R * Math.cos(a)).toFixed(3);
    };
    const arcPath = (a0, a1) =>
      "M " + pt(a0) + " A " + R + " " + R + " 0 " + ((a1 - a0) > 180 ? 1 : 0)
        + " 1 " + pt(a1);
    const gf = sub.gauge == null ? 0.5 : sub.gauge;
    const arc = Math.round(gf * 270);

    const ring = document.createElement("span");
    ring.className = "mp-ring";
    ring.style.color = sub.color || "#fff";
    let paths = "";
    if (arc < 269) {
      paths += '<path d="' + arcPath(225 + arc, 495) + '" stroke="#fff"'
        + ' stroke-opacity="0.30" stroke-width="' + W + '" stroke-linecap="round"'
        + ' fill="none"/>';
    }
    paths += '<path d="' + arcPath(225, 225 + arc) + '" stroke="currentColor"'
      + ' stroke-width="' + W + '" stroke-linecap="round" fill="none"/>';
    ring.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true">' + paths + "</svg>";

    // The glyph sits inside the ring, at the badges' own 85% mask scale.
    const g = document.createElement("span");
    g.className = "mp-cglyph";
    g.style.setProperty("--i", "url('" + iconUrl(sub.icon) + "')");
    ring.appendChild(g);

    const col = document.createElement("span");
    col.className = "mp-ctext";
    const l = document.createElement("span");
    l.className = "mp-clabel";
    l.textContent = sub.label || "";
    const v = document.createElement("span");
    v.className = "mp-cvalue";
    v.textContent = sub.text || "";
    col.appendChild(l);
    col.appendChild(v);

    el.appendChild(ring);
    el.appendChild(col);
    return el;
  }

  // One badge pill, for both mocks. It was a closure inside the wide preview,
  // which is why the phone half hand-rolled its own row of white glyphs with no
  // colors, no readings and no sub-badges. Same painter, same badges.
  _paintBadge(b, small) {
    const el = document.createElement(small ? "span" : "button");
    if (!small) el.type = "button";
    el.className = "pbadge" + (small ? " sub" : "") + (b.dim ? " dim" : "") + (b.clip ? " clip" : "");
    if (!small) el.dataset.mk = "b:" + b.id;
    let g;
    if (b.pic) {
      g = document.createElement("img");
      g.className = "ppic" + (b.art ? " art" : "");
      g.src = b.pic;
      g.alt = "";
    } else {
      g = document.createElement("span");
      g.className = "pglyph";
      g.style.setProperty("--i", "url('" + iconUrl(b.icon) + "')");
      g.style.setProperty("--sc", b.color);
    }
    const col = document.createElement("span");
    col.className = "pcol";
    if (b.label) {
      const l = document.createElement("span");
      l.className = "plabel";
      l.textContent = b.label;
      col.appendChild(l);
    }
    // Guarded like .plabel above: the Energy group badge prints no second
    // line at all when there is no numeric power, and an empty span still
    // takes its line height - the badge would sit taller than the real one.
    if (b.text) {
      const t = document.createElement("span");
      t.className = "ptext";
      t.textContent = b.text;
      col.appendChild(t);
    }
    el.appendChild(g); el.appendChild(col);
    return el;
  }

  // hemma_entity's --hemma-icon-inactive-color, in the order it uses:
  // media_player, then the energy tiers, then by icon, then by domain.
  _inactiveIconColor(tile, ent, kind) {
    const tv = tile.variables || {};
    // The icon the tile actually DRAWS. variables.icon alone misses every tile
    // whose icon comes from its template default.
    const icon = tv.icon || tile.icon || TILE_ICON[kind] || "";
    const domain = String((ent && ent.entity_id) || tile.entity || "").split(".")[0];
    if (domain === "media_player") return null;
    if (icon === "energy" || icon === "power") {
      const pid = tv.entity_power || (ent && ent.entity_id);
      const e = pid && this._hass.states[pid];
      const w = e && parseFloat(e.state);
      if (!Number.isFinite(w)) return "var(--hemma-badge-energy-color, #30D158)";
      if (w >= Number(tv.extreme_threshold ?? 3000)) return "var(--hemma-badge-energy-very-high-color, #FF4245)";
      if (w >= Number(tv.heavy_threshold ?? 1000)) return "var(--hemma-badge-energy-high-color, #FF9230)";
      if (w >= Number(tv.normal_threshold ?? 200)) return "var(--hemma-badge-energy-medium-color, #FFD600)";
      return "var(--hemma-badge-energy-low-color, #30D158)";
    }
    // hemma_network has its own rule, like the energy tile: colored once there
    // is ANY traffic, neutral only when there is none.
    if (kind === "network") {
      const num = (id) => {
        if (!id) return null;
        const n = parseFloat((this._hass.states[id] || {}).state);
        return isNaN(n) ? null : n;
      };
      const vals = [
        num(tv.entity_download || (ent && ent.entity_id)),
        num(tv.entity_upload || tv.upload_sensor),
      ].filter((v) => v != null);
      const max = vals.length ? Math.max(...vals) : 0;
      const idle = Number(tv.idle_threshold != null ? tv.idle_threshold : 1);
      return max >= idle
        ? "var(--hemma-popup-primary-color, #00c3d0)"
        : "var(--hemma-icon-inactive-fallback-color, rgba(255,255,255,0.95))";
    }
    const byIcon = {
      plant: "var(--hemma-color-green, #30D158)",
      wifi: "var(--hemma-popup-primary-color, #00c3d0)",
      doorbell: "var(--hemma-color-teal, #00c3d0)",
    };
    const byDomain = {
      light: "var(--hemma-color-yellow, #FFCC00)",
      fan: "var(--hemma-color-teal, #00C3D0)",
      humidifier: "var(--hemma-color-teal, #00C3D0)",
      climate: "var(--hemma-color-teal, #00C3D0)",
      vacuum: "var(--hemma-color-teal, #00C3D0)",
      cover: "var(--hemma-color-teal, #00c3d0)",
      lock: "var(--hemma-color-teal, #00c3d0)",
      plant: "var(--hemma-color-green, #30D158)",
    };
    const KEEP_TINT = ["light", "plant", "battery", "thermostat"];
    return byIcon[icon] || byDomain[domain]
      || (KEEP_TINT.indexOf(kind) !== -1 ? (TILE_COLOR[kind] || TILE_TINT) : null);
  }

  // The wide-half tile a phone tile stands for, matched the way the pair sync
  // matches them: template AND entity, never position. The form edits the wide
  // config, so this is what a tap on the phone preview has to resolve to.
  _wideTwinOf(tile) {
    const key = tileTwinKey(tile);
    const rooms = (this._state && this._state.compact.rooms) || [];
    for (let i = 0; i < rooms.length; i++) {
      const hit = (rooms[i].tiles || []).find((t) => t && tileTwinKey(t) === key);
      if (hit) return { tile: hit, roomIndex: i };
    }
    return null;
  }

  _paintTile(tile, ti, room) {
      const type = tileTypeOf(tile);
      const kind = type && type.id;
      const ent = tile.entity && this._hass.states[tile.entity];
      const active = tileActive(kind, ent, tile.variables || {}, this._hass.states);
      // A tile that takes itself off the dashboard is still one you must be able
      // to point at, so the preview draws it and says which way round it is.
      const away = tileHidesNow(type, kind, ent, tile.variables || {}, this._hass.states);
      const el = document.createElement("div");
      el.className = "mtile" + (active ? " on" : "") + (away ? " away" : "");
      // What Smart Sort sorts on. hemma-smart-row asks the rendered card; here
      // the same answer is already computed above.
      el.dataset.active = active ? "1" : "0";
      el.dataset.mk = "t:" + this._tileKey(tile);
      el.dataset.jump = this._tileKey(tile);
      el.innerHTML = '<span class="mtop"><span class="mcircle"><span class="mglyph"></span></span></span>'
        + '<span class="mbot"><span class="mname"></span><span class="mstate"></span></span>';
      const circle = el.querySelector(".mcircle");
      // The thermostat puts its reading in the circle and colors it by mode -
      // teal cooling, yellow heating, the flat tint otherwise. Mirrors the
      // temp_puck custom field and state_display in hemma_thermostat.yaml.
      const mode = kind === "thermostat" && ent ? String(ent.state).toLowerCase() : "";
      const puck = (() => {
        if (kind !== "thermostat" || !ent) return null;
        const over = (tile.variables || {}).temp_sensor;
        const os = over && this._hass.states[over];
        const raw = (os && !/^(unknown|unavailable)$/i.test(os.state))
          ? os.state : ent.attributes && ent.attributes.current_temperature;
        const n = Math.round(Number(raw));
        return Number.isFinite(n) ? n : null;
      })();
      if (puck !== null) {
        el.querySelector(".mglyph").outerHTML = '<span class="mnum"></span>';
        el.querySelector(".mnum").textContent = String(puck);
        circle.style.setProperty("--sc",
          mode === "cool" ? "var(--hemma-puck-cool-color, var(--hemma-color-teal, #00C3D0))"
          : mode === "heat" ? "var(--hemma-puck-heat-color, var(--hemma-color-yellow, #FFCC00))"
          : (TILE_COLOR[kind] || TILE_TINT));
      } else {
        // THREE exclusive branches, and they must stay that way: written as a
        // separate `if (face)` ahead of the pair, it removes .mglyph and then
        // falls into the else, which reaches for what was just removed.
        const face = (tile.variables || {}).entity_picture;
        const art = kind === "media" ? mediaArtUrl(ent, this._hass.states) : "";
        if (face) {
          el.querySelector(".mglyph").remove();
          circle.classList.add("art", "face");
          circle.style.backgroundImage = "url('" + face + "')";
        } else if (art) {
          // Same reasoning as the badge: the state is real, so the art is too.
          el.querySelector(".mglyph").remove();
          circle.classList.add("art");
          circle.style.backgroundImage = "url('" + art + "')";
        } else {
          const g = el.querySelector(".mglyph");
          // Off, the glyph keeps the color hemma_entity gives it - an inactive
          // lock is teal and an inactive energy tile is tiered.
          if (!active) {
            const ic = this._inactiveIconColor(tile, ent, kind);
            if (ic) g.style.setProperty("--ic", ic);
          }
          const tv = tile.variables || {};
          // hemma_cover and hemma_lock each draw a different glyph either side
          // of their state, so the preview has to pick the same one.
          const isOpen = !!ent && /^(open|opening)$/i.test(ent.state);
          const isUnlocked = !!ent && /^(unlocked|unlocking|open|opening)$/i.test(ent.state);
          const picked = (kind === "cover" || kind === "cover_group")
            ? (isOpen ? (tv.icon_open || "curtain-open") : (tv.icon_closed || "curtain-closed"))
            : (kind === "lock" || kind === "lock_group")
              ? (isUnlocked ? (tv.icon_unlocked || "lock-open-fill") : (tv.icon_locked || "lock-fill"))
              : (tv.icon || tile.icon);
          // The actions tile has no glyph of its own to fall back to - it
          // takes any domain, so the card derives one and this has to reach
          // the same answer or the preview shows a different tile.
          const derived = type && type.glyphFromEntity
            ? type.glyphFromEntity[String(tile.entity || "").split(".")[0]]
            : null;
          g.style.setProperty("--i",
            "url('" + iconUrl(picked || derived || TILE_ICON[kind] || "tile") + "')");
          // hemma_fan spins its glyph while the fan runs.
          g.classList.toggle("spin", kind === "fan" && active);
          // hemma_plant keeps green for a healthy plant and turns the circle
          // warning-yellow when it needs something, the way a lit light does.
          circle.style.setProperty("--sc", kind === "plant" && active
            ? "var(--hemma-color-yellow, #FFCC00)"
            : (TILE_COLOR[kind] || TILE_TINT));
        }
      }
      // The one tile whose whole point is its buttons was the one tile the
      // preview drew without them, so the card and its preview disagreed on
      // the only thing that makes it different from a plain entity tile.
      if (kind === "entity_actions") {
        const tv = tile.variables || {};
        const rail = document.createElement("span");
        rail.className = "mrail";
        [1, 2].forEach((n) => {
          const id = tv["action_" + n + "_entity"];
          if (tv["action_" + n + "_enabled"] === false || !id) return;
          const es = this._hass.states[id];
          const word = String((es && es.state) || "").toLowerCase().replace(/_/g, " ");
          const dead = ACTION_DEAD.indexOf(word) !== -1 || !es;
          const b = document.createElement("span");
          b.className = "mact" + (dead ? " dim" : ACTION_ACTIVE.indexOf(word) !== -1 ? " hot" : "");
          b.style.setProperty("--ac", tv["action_" + n + "_active_color"]
            || ACTION_ACCENT[String(id).split(".")[0]] || ACTION_TEAL);
          // The card's own order: the field, then the entity's own icon, then
          // a question mark. An mdi name goes to ha-icon; a bare name is a
          // Hemma glyph and masks like every other icon in this preview.
          const raw = String(tv["action_" + n + "_icon"]
            || (es && es.attributes && es.attributes.icon) || "mdi:help-circle").trim();
          if (raw.indexOf(":") !== -1) {
            const ico = document.createElement("ha-icon");
            ico.setAttribute("icon", raw);
            b.appendChild(ico);
          } else {
            const g = document.createElement("span");
            g.className = "mactglyph";
            g.style.setProperty("--i", "url('" + iconUrl(raw) + "')");
            b.appendChild(g);
          }
          rail.appendChild(b);
        });
        if (rail.children.length) {
          el.classList.add("hasrail");
          el.appendChild(rail);
        }
      }
      el.querySelector(".mname").textContent = tile.name || (type && type.label) || "Tile";
      el.querySelector(".mstate").textContent =
        tileStateWord(kind, tile, ent, this._hass.states, this._hass);
      const ring = tileProgressOn(tile, ent);
      if (ring) {
        const pr = document.createElement("span");
        pr.className = "mprog";
        pr.dataset.mk = "pr:" + this._tileKey(tile);
        const pct = tileProgressPct(tile, ent, this._hass.states);
        const glyph = tileProgressGlyph(tile, ent);
        const GLYPH = {
          pause: '<rect class="pg" x="14" y="13" width="2.6" height="10" rx="1.3"/>'
            + '<rect class="pg" x="19.4" y="13" width="2.6" height="10" rx="1.3"/>',
          play: '<path class="pg" d="M15.4 12.9 L23.8 18 L15.4 23.1 Z"'
            + ' stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>',
        };
        pr.innerHTML = '<svg viewBox="0 0 36 36">'
          + '<g transform="rotate(-90 18 18)">'
          + '<circle class="pt" cx="18" cy="18" r="14" fill="none" stroke-width="4"'
          + ' stroke-linecap="round"/>'
          + '<circle class="pa" cx="18" cy="18" r="14" fill="none" stroke-width="4"'
          + ' stroke-linecap="round" stroke-dasharray="87.965"'
          + ' stroke-dashoffset="' + (87.965 - pct * 0.87965).toFixed(3) + '"/>'
          + '</g>' + (glyph ? GLYPH[glyph] : "") + '</svg>';
        el.querySelector(".mtop").appendChild(pr);
      }
      // The ring and the toggle share the corner, so the card hides the toggle
      // for as long as the ring is running rather than stacking them.
      if (!ring && tileToggleOn(tile, type)) {
        const sw = document.createElement("span");
        sw.className = "mtgl";
        sw.dataset.mk = "tg:" + this._tileKey(tile);
        const mid = "mtg" + ti;
        sw.innerHTML = active
          ? '<svg viewBox="0 0 46 26"><defs><mask id="' + mid + '">'
            + '<rect x="2" y="1" width="42" height="24" rx="12" fill="#fff"/>'
            + '<circle cx="32" cy="13" r="9" fill="#000"/></mask></defs>'
            + '<rect x="2" y="1" width="42" height="24" rx="12" fill="rgba(0,0,0,0.75)"'
            + ' mask="url(#' + mid + ')"/></svg>'
          : '<svg viewBox="0 0 46 26">'
            + '<rect x="2" y="1" width="42" height="24" rx="12" fill="none"'
            + ' stroke="rgba(255,255,255,0.8)" stroke-width="2"/>'
            + '<circle cx="14" cy="13" r="9" fill="rgba(255,255,255,0.8)"/></svg>';
        el.querySelector(".mtop").appendChild(sw);
      }
      // The card is transform-scaled, so pointer deltas are screen pixels and
      // must be divided back down. With Smart Sort on the order is DERIVED, so
      // the visual index is not the config index and a drag would write the
      // wrong one - the Tiles list stays draggable either way.
      el.title = this._smartSortOn()
        ? "Smart Sort is on - reorder in the Tiles list"
        : "Drag to reorder";
      el.onpointerdown = (ev) => {
        if (ev.button) return;
        if (ev.pointerType === "touch" && isPhone(this)) return;
        if (this._smartSortOn()) return;
        const row = el.parentNode;
        if (!row || room.tiles.length < 2) return;
        const scale = (this._mapVis && this._mapVis.scale) || 1;
        const cards = [...row.children].filter((c) => c.classList.contains("mtile"));
        const me = cards.indexOf(el);
        if (me < 0) return;
        const rects = cards.map((c) => c.getBoundingClientRect());
        const startX = ev.clientX, startY = ev.clientY;
        let moved = false, target = me, shown = me;

        const shiftTo = (t) => {
          if (t === shown) return;
          shown = t;
          const order = cards.map((_, k) => k).filter((k) => k !== me);
          order.splice(t, 0, me);
          order.forEach((orig, slot) => {
            if (orig === me) return;
            const c = cards[orig];
            c.style.transition = "transform .18s " + EASE;
            c.style.transform = "translate(" + ((rects[slot].left - rects[orig].left) / scale) + "px,0)";
          });
        };

        const onMove = (e2) => {
          const dx = e2.clientX - startX, dy = e2.clientY - startY;
          if (!moved) {
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            moved = true;
            this._tileDragged = true;
            // Unconditional now: .mfree only opens the clip box vertically, so
            // there is no scroll position left to lose.
            row.classList.add("mfree");
            el.classList.add("mdrag");
            try { el.setPointerCapture(ev.pointerId); } catch (err) { /* not captured */ }
          }
          // The drop target is chosen on X alone, so vertical travel is purely
          // the lift. Clamped, it stays inside the room .mfree just opened
          // however far the pointer wanders off the row.
          const dyc = Math.max(-14, Math.min(14, dy / scale));
          el.style.transform = "translate(" + (dx / scale) + "px," + dyc + "px)";
          let best = me, bestD = Infinity;
          rects.forEach((r, k) => {
            const d = Math.abs(e2.clientX - (r.left + r.width / 2));
            if (d < bestD) { bestD = d; best = k; }
          });
          target = best;
          shiftTo(target);
        };

        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          el.classList.remove("mdrag");
          row.classList.remove("mfree");
          if (!moved) return;
          // The click that ends the drag must not also count as a jump.
          setTimeout(() => { this._tileDragged = false; }, 0);
          if (target === me) {
            cards.forEach((c) => { c.style.transition = ""; c.style.transform = ""; });
            return;
          }
          const before = this._captureCards();
          const [x] = room.tiles.splice(me, 1);
          room.tiles.splice(target, 0, x);
          this._mapSig = null;
          this._renderForm();
          requestAnimationFrame(() => this._playCards(before));
        };

        // Same guard as the tile list: a mouse drag here swept a selection
        // through whatever sat beside the preview.
        if (ev.pointerType !== "touch") ev.preventDefault();
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      };
      return el;
  }
  _roomMap() {
    // Anchored to a chip this rebuild is about to replace.
    this._closeSceneMenu();
    const wrap = document.createElement("div");
    wrap.className = "mapwrap";

    // Desktop and tablet are the same dashboard at different widths. Phone is
    // the other half of the pair, drawn from its own config - offered whenever
    // there is a phone layout to draw.
    if (!this._miniSize) {
      this._miniSize = localStorage.getItem("hemma_panel_preview_size") || "desktop";
    }
    this._miniSize = this._sizeAllowed(this._miniSize);

    let shown = false;
    const card = document.createElement("section");
    card.className = "card map size-" + this._miniSize;
    card.dataset.k = "__map";
    card.style.visibility = "hidden";


    // Needed by both mocks: the tail cross-fades on a room change.
    const room = this._state.compact.rooms[this._room] || {};

    // The phone gets its own mock, but everything after this block is SHARED -
    // an early return here left the card hidden and _applyMapSize bound to the
    // previous one. A zone names either a band or the exact card it stands for.
    const jump = (id) => {
      const el = this.shadowRoot.getElementById("band-" + id)
        || this.shadowRoot.querySelector('[data-k="' + CSS.escape(id) + '"]');
      if (el) this._scrollTo(el, false);
    };

    if (this._miniSize === "phone") {
      this._phoneMap(card);
    } else {
    const rooms = this._state.compact.rooms;
    const V = room.variables || {};

    // What the dashboard will letter itself in, before it is saved.
    const stack = FONT_STACKS[String(V.font || "").trim().toLowerCase()];
    if (stack) ensureFontCss();
    card.style.fontFamily = stack || "var(--primary-font-family, system-ui)";

    card.innerHTML = `
      <div class="miniroom">
        <img class="mini-photo" alt="">
        <div class="mini-grain"></div>
        <div class="mini-tint"></div>
        <div class="mini-scrim"></div>
        <div class="mini-body">
          <div class="mini-nav">
            <span class="mini-time"></span>
            <span class="mini-tabs"></span>
            <span class="mini-settings"><i></i><i></i><i></i></span>
          </div>
          <div class="mini-fill"></div>
          <div class="mz" data-jump="Appearance">
            <div class="mini-weather"></div>
            <div class="mini-name"></div>
          </div>
          <div class="mz" data-jump="badges"><div class="mini-badges"></div></div>
          <div class="mini-subs"></div>
          <div class="mini-fill lower"></div>
          <div class="mz mz-tiles" data-jump="tiles"><div class="mini-tiles"></div></div>
          <div class="mz mz-np" data-jump="Now Playing" data-mk="np">
            <div class="mini-nphead">
              <span class="mini-wave"><i></i><i></i><i></i><i></i><i></i></span>
            </div>
            <div class="mini-nptile noctl" data-mk="npt">
              <span class="mini-npart"></span>
              <span class="mini-nptext">
                <span class="mini-nptitle">Nothing playing</span>
                <span class="mini-npsub">Media shows here</span>
              </span>
            </div>
          </div>
        </div>
      </div>`;

    const q = (sel) => card.querySelector(sel);

    // Photo, matching the variant the preview's own toggle is set to.
    const found = (this._imgs || []).find((i) => i.name === V.image);
    const dark = !!this._miniDark;
    const url = found && ((dark && found.night) || found.day);
    if (url) q(".mini-photo").src = url;
    else q(".miniroom").classList.add("nophoto");
    // The other half of the toggle, fetched and decoded while you are looking
    // at this one.
    if (found) { warmPhoto(found.day); warmPhoto(found.night); }

    // Navigation, so the room's place in the tab order reads too.
    const d = new Date();
    let hh = d.getHours();
    const use12 = V.use_12h !== false;
    const suffix = use12 ? (hh < 12 ? " AM" : " PM") : "";
    if (use12) hh = hh % 12 || 12;
    const extra = String(V.time_suffix || "").trim();
    q(".mini-time").textContent = hh + ":" + String(d.getMinutes()).padStart(2, "0")
      + suffix + (extra ? " " + extra : "");
    const tabs = q(".mini-tabs");
    rooms.forEach((r, ri) => {
      const t = document.createElement("span");
      t.className = "mini-tab" + (r === room ? " on" : "");
      t.textContent = r.name || r.path;
      t.title = r === room ? "" : "Go to " + (r.name || r.path);
      if (r !== room) {
        t.onclick = (ev) => {
          ev.stopPropagation();
          this._room = ri;
          this._renderTabs();
          this._renderForm();
        };
      }
      tabs.appendChild(t);
    });
    if (this._scenesOn()) {
      const t = document.createElement("span");
      t.className = "mini-tab scenes";
      t.dataset.mk = "sc";
      t.textContent = "Scenes";
      // No data-jump: the chip opens the menu the dashboard opens, rather than
      // scrolling the form to the Scenes card.
      t.title = "The scenes this dashboard will list";
      t.onclick = (ev) => {
        ev.stopPropagation();
        const open = this.shadowRoot.querySelector(".mini-scenemenu");
        if (open) this._closeSceneMenu();
        else this._openSceneMenu(t);
      };
      tabs.appendChild(t);
    }
    // Removed rather than hidden: an element that never leaves the DOM has
    // nothing to animate in from.
    const npOn = V.show_media !== false && !!V.show_now_playing;
    if (!npOn) q(".mz-np").remove();
    else {
      const head = q(".mini-nphead");
      const min = this._npMinFor(room);
      if (min) q(".mini-nptile").remove();
      else this._paintNpStack(q(".mz-np"), V);
      q(".mini-wave").classList.toggle("on", !min);
      head.title = "Show or hide the players, as the waveform does on the dashboard";
      head.onclick = (ev) => {
        ev.stopPropagation();
        this._npMin = !this._npMin;
        this._syncPreview();
      };
    }

    // Weather sits above the name, as it does on the room card.
    const wt = V.weather_temp_sensor || V.weather_entity;
    const we = wt && this._hass.states[wt];
    let deg = null;
    if (we) {
      const n = parseFloat(we.state);
      deg = Number.isFinite(n) ? n : (we.attributes && we.attributes.temperature);
    }
    const wx = q(".mini-weather");
    if (wt) wx.dataset.mk = "w";
    if (deg != null) {
      wx.textContent = Math.round(deg) + "°";
      // The condition comes from the weather entity; weather_temp_sensor is a
      // temperature override and carries no condition of its own.
      const wc = V.weather_entity && this._hass.states[V.weather_entity];
      const cond = wc ? String(wc.state || "").toLowerCase() : "";
      const file = WEATHER_SVG[cond];
      const g = document.createElement("img");
      g.className = "mini-wglyph";
      g.alt = "";
      g.src = file ? "/local/hemma/weather/" + file + ".svg" : iconUrl("weather");
      wx.appendChild(g);
    }
    q(".mini-name").textContent = room.name || room.path || "Room";

    // Badges, and the sub-badge row a tap reveals.
    const model = this._miniModel(room);
    const badges = q(".mini-badges");
    const subs = q(".mini-subs");

    const pill = (b, small) => this._paintBadge(b, small);

    const drawSubs = (animate) => {
      const open = model.find((b) => b.id === this._miniOpen);
      subs.innerHTML = "";
      if (!open || !open.subs.length) { subs.classList.remove("on"); return; }
      subs.classList.add("on");
      open.subs.forEach((sb) => subs.appendChild(pill(sb, true)));
      if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Each pill starts under the pill that opened it and slides out to its
      // place, so the row reads as coming from the badge rather than appearing.
      const src = badges.querySelector(".pbadge.open");
      const from = src ? src.getBoundingClientRect() : null;
      subs.querySelectorAll(".pbadge").forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const dx = from ? (from.left + from.width / 2) - (r.left + r.width / 2) : 0;
        el.animate(
          [
            { opacity: 0, transform: `translate(${(dx * 0.4).toFixed(1)}px, -14px) scale(0.94)` },
            { opacity: 1, transform: "none" },
          ],
          { duration: 300, delay: i * 24, easing: EASE, fill: "backwards" }
        );
      });
    };

    if (!model.length) {
      // Every badge a room CAN have, drawn as a placeholder. Clicking one opens
      // it in the inspector, which is the same gesture as clicking a real pill.
      SECTIONS.filter((sec) => sec.group === "badges" && sec.icon).forEach((sec) => {
        const el = pill({ id: String(sec.label).toLowerCase(), label: sec.label,
          icon: sec.icon, color: sec.iconColor || "var(--ink)", subs: [] }, false);
        el.classList.add("ghost");
        el.title = "Add " + sec.label + " to this room";
        el.onclick = (ev) => {
          ev.stopPropagation();
          this._select({ group: "badges", key: sec.label, label: sec.label });
        };
        badges.appendChild(el);
      });
    }
    // Same order the dashboard draws, from the same key.
    const wideOrder = this._badgeOrder(room);
    model.sort((a, b) => {
      const ia = wideOrder.indexOf(a.id), ib = wideOrder.indexOf(b.id);
      // Anything outside the six keeps its own relative place after them.
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    model.forEach((b) => {
      const el = pill(b, false);
      el.classList.toggle("open", this._miniOpen === b.id);
      el.title = b.subs.length ? "Show what this pill expands to" : "No sub-badges yet";
      el.onclick = (ev) => {
        ev.stopPropagation();
        this._miniOpen = this._miniOpen === b.id ? null : b.id;
        badges.querySelectorAll(".pbadge").forEach((x) => x.classList.remove("open"));
        if (this._miniOpen) el.classList.add("open");
        drawSubs(true);
        // One gesture, both answers: you asked about Climate, so the row shows
        // what it expands to AND the inspector shows what it is made of.
        const pick = selKeyOf(el.dataset.mk);
        if (pick) this._select(pick);
      };
      badges.appendChild(el);
    });
    if (this._miniOpen && !model.some((b) => b.id === this._miniOpen)) this._miniOpen = null;
    drawSubs(false);

    // Tiles, in the order they sit along the bottom of the room.
    const tiles = q(".mini-tiles");
    if (!room.tiles.length) {
      // Not one ghost per type: sixteen of them would be noise. The row shows
      // its own shape instead, and the first slot carries the invitation.
      for (let i = 0; i < 5; i++) {
        const slot = document.createElement("div");
        slot.className = "mtile ghost" + (i ? " faint" : "");
        if (!i) {
          slot.innerHTML = '<span class="gplus">+</span><span class="gcap">Add a tile</span>';
          slot.title = "Add a tile to this room";
        }
        slot.onclick = (ev) => {
          ev.stopPropagation();
          this._group = "tiles";
          this._sel = null;
          this._renderForm();
          requestAnimationFrame(() => {
            const bar = this.$("pane").querySelector(".addbar");
            if (bar) this._scrollTo(bar, true);
          });
        };
        tiles.appendChild(slot);
      }
    }
    room.tiles.filter((t) => (t.variables || {}).enabled !== false).forEach((tile, ti) => {
      tiles.appendChild(this._paintTile(tile, ti, room));
    });
    // Lay the row out in its sorted order before it is ever shown - no
    // animation, because nothing moved: this IS its first position. The row is
    // still detached here, so it has to be handed over rather than looked up.
    this._applyMiniSort(false, tiles);

    }

    // Clicking the document IS the navigation, the way Keynote's inspector
    // follows the object you click. Delegated, because closest() picks the
    // INNERMOST zone where per-element listeners would fire both. Outside the
    // shape branch, or the phone mock is inert.
    card.addEventListener("click", (ev) => {
      if (ev.target.closest(".mini-nphead")) return;
      if (this._tileDragged) return;
      // Badges stop propagation in their own handler; they select there.
      if (ev.target.closest(".pbadge")) return;
      const obj = ev.target.closest("[data-mk]");
      const pick = obj && selKeyOf(obj.dataset.mk);
      if (pick) {
        // A phone section can belong to a different room than the one the form
        // is on. Go there first, or the detail push looks for the tile in the
        // wrong room's band and finds nothing.
        const want = obj.dataset.mproom;
        if (want !== undefined && Number(want) !== this._room) {
          this._room = Number(want);
          this._renderTabs();
        }
        return this._select(pick);
      }
      const z = ev.target.closest("[data-jump]");
      if (z) jump(z.dataset.jump);
    });

    // Hover either side, both light. This reciprocity is what makes a panel
    // read as an inspector rather than a form parked next to a picture.
    card.addEventListener("mouseover", (ev) => {
      const obj = ev.target.closest("[data-mk]");
      this._link(obj && selKeyOf(obj.dataset.mk), "preview");
    });
    card.addEventListener("mouseleave", () => this._link(null));
    const slot = document.createElement("div");
    slot.className = "mapslot";
    slot.appendChild(card);
    wrap.appendChild(slot);


    // Measured off the real screens: 1.55:1, not 16:9, and 1180x820 landscape,
    // not a 4:3 iPad - which put the preview on the wrong tile tier. 390x844 is
    // the logical size the mobile dashboard is laid out against.
    const SPEC = { desktop: [960, Math.round(960 / 1.55)], tablet: [700, 486],
      phone: [390, 844] };
    const applySize = (animate) => {
      if (isPhone(this)) return;
      const [natW, natH] = SPEC[this._miniSize];
      // offsetWidth, not getBoundingClientRect: the rect is the PAINTED box, and
      // the entrance holds this column at scale(.93) through its delay - fitting
      // to that sticks, since a transform never fires the resize observer.
      const availW = slot.offsetWidth - MAP_SHADOW_ROOM;
      // The column's own flex space, not the viewport: no scroll position, no
      // header height, no constant to go stale when the chrome moves. Below
      // PANEL_NARROW the page itself scrolls, so there is no height to be bound by.
      let budget = 0;
      const stage = slot.closest(".stage");
      const col = slot.closest(".canvas");
      if (stage && col && !isNarrow(this)) {
        const cs = getComputedStyle(col);
        const head = col.querySelector(".canvashead");
        const headH = head
          ? head.offsetHeight + parseFloat(getComputedStyle(head).marginBottom || 0)
          : 0;
        // The plinth is a padded panel now, so its own inset comes out of the
        // budget too, or the screen inside it overflows by exactly that much.
        const ph = slot.closest(".plinth");
        const ps = ph ? getComputedStyle(ph) : null;
        const pPad = ps
          ? parseFloat(ps.paddingTop || 0) + parseFloat(ps.paddingBottom || 0) : 0;
        const free = stage.offsetHeight - headH - pPad
          - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
        budget = Math.max(240, free) - MAP_SHADOW_ROOM;
      }
      // Desktop and tablet share a reserved height so the frame holds still. The
      // phone is measured against its own, or it draws wider than the column.
      const ratio = natH / natW;
      const frame = this._miniSize === "phone" ? ratio : MAP_TALLEST;
      const w = fitWidth(availW, budget, Infinity, frame);
      if (w === null) return;
      const f = w / natW;

      const host = slot.closest(".plinth") || slot.parentElement;
      // One batch, no layout read in the middle: the natural size and the
      // factor that shrinks it can never be a frame out of step.
      card.style.width = natW + "px";
      card.style.height = natH + "px";
      if (host) host.style.setProperty("--map-scale", f.toFixed(4));
      // Always the TALLER shape's height, whichever is showing, so a size switch
      // moves neither the frame nor the column below it. fitWidth already
      // reserves that much.
      slot.style.height = Math.round(w * frame) + MAP_SHADOW_ROOM + "px";

      this._mapVis = { w: natW * f, h: natH * f, scale: f };
      // The PAINTED width, published for the control row: splitting those
      // controls to the edges only reads as a toolbar if the edges are the
      // preview's.
      const canvas = slot.closest(".canvas");
      if (canvas) canvas.style.setProperty("--preview-w", Math.round(natW * f) + "px");
      // A 180px noise tile drawn INSIDE the scaled card, so its size is divided
      // by the scale. Rounded to whole pixels: fractional, the tile repeats on
      // fractional boundaries and every seam resamples into a faint grid.
      if (host) host.style.setProperty("--grain-px", Math.round(180 / f) + "px");

      // Two different LAYOUTS, not one at two sizes, so there is nothing to
      // morph - a scale between them stretches by the difference in aspect.
      if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        card.animate(
          [
            { opacity: 0, transform: `scale(${(f * 0.985).toFixed(4)})` },
            { opacity: 1, transform: `scale(${f.toFixed(4)})` },
          ],
          { duration: RT(220), easing: EASE }
        );
      }
      // The very first paint has to wait for the measurement, or the screen
      // shows at the fallback scale for a frame and then jumps.
      if (!shown) {
        shown = true;
        card.style.visibility = "";
        const changed = this._mapRoom !== room.path;
        this._mapRoom = room.path;
        if (changed && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          card.animate(ROOM_FADE, { duration: ROOM_FADE_MS, easing: EASE });
        }
      }
    };
    applySize();
    this._applyMapSize = applySize;

    if (this._sizeObs) this._sizeObs.disconnect();
    let last = "";
    this._sizeObs = new ResizeObserver(() => {
      // #tilespane is a sibling of .stage, which is flex:1 1 auto - so folding a
      // tile changes .stage's height and this fires on every frame of the fold.
      // One fit at the end is enough.
      if (this._folding) return;
      const b = slot.getBoundingClientRect();
      const key = Math.round(b.width) + "x" + Math.round(b.height);
      if (key === last) return;
      last = key;
      applySize();
    });
    this._sizeObs.observe(slot);
    const stageEl = slot.closest(".stage");
    if (stageEl) this._sizeObs.observe(stageEl);
    if (!this._winResize) {
      this._winResize = () => this._applyMapSize && this._applyMapSize();
      window.addEventListener("resize", this._winResize);
    }

    return wrap;
  }

  // ── tiles ─────────────────────────────────────────────────────────────────

  // Scenes leaving the phone preview, the same collapse a card uses when it
  // switches off. Synchronous: the caller rebuilds immediately after, and this
  // runs on the elements about to be replaced.
  _collapsePhoneScenes() {
    const mount = this.$("mapmount");
    if (!mount || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const group = mount.querySelector(".miniphone .mp-scenegroup");
    if (!group) return;
    const h = group.offsetHeight;
    const clone = group.cloneNode(true);
    clone.style.cssText = "overflow:hidden;height:" + h + "px;opacity:1;"
      + "margin:0;pointer-events:none;";
    group.replaceWith(clone);
    clone.animate(
      [{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
      { duration: 220, easing: "cubic-bezier(.4,0,.9,.6)", fill: "forwards" }
    ).finished.then(() => clone.remove(), () => clone.remove());
  }

  // The ROW is the scene - its icon in the color it is about to use, its name,
  // then the color as a trailing value - so you read the answer off the row
  // rather than off the control. Not a `fields:` entry: scene_colors is a MAP
  // keyed by entity id and the field machinery writes flat keys.
  _renderSceneColors(room, card) {
    if (!card || card.querySelector(".scenecolors")) return;
    const scenes = this._sceneList();
    if (!scenes.length) return;

    const wrap = document.createElement("div");
    wrap.className = "scenecolors";
    const head = document.createElement("div");
    head.className = "flabel";
    head.textContent = "Scene colors";
    wrap.appendChild(head);

    const ACCENT = "var(--hemma-color-yellow, #FFCC00)";
    scenes.forEach((sc) => {
      const map = () => (room.variables.scene_colors || {});
      const row = document.createElement("button");
      row.type = "button";
      row.className = "scenecolor";

      const ic = document.createElement("ha-icon");
      ic.className = "scicon";
      ic.setAttribute("icon", sc.icon);
      const nm = document.createElement("span");
      nm.className = "scname";
      nm.textContent = sc.label;
      const val = document.createElement("span");
      val.className = "scval";
      const sw = document.createElement("span");
      sw.className = "swatch";

      const paint = () => {
        const v = map()[sc.id] || "";
        const hex = swatchOf(v || ACCENT);
        // The icon wears the color, so the row shows the result rather than
        // describing it.
        ic.style.color = v || ACCENT;
        sw.style.background = hex || "transparent";
        val.textContent = v ? colorLabel(v) : "Yellow";
        val.classList.toggle("dim", !v);
      };
      paint();

      row.appendChild(ic);
      row.appendChild(nm);
      row.appendChild(val);
      row.appendChild(sw);

      row.onclick = () => {
        const cur = map()[sc.id] || "";
        const items = [{ id: "", label: "Yellow (default)", checked: !cur }];
        HEMMA_ACCENTS.forEach((acc) => items.push({
          id: acc.id, label: acc.label, swatch: acc.hex, group: "Hemma",
          checked: cur === acc.id,
        }));
        this._menuAt(row, items, (id) => {
          const next = { ...map() };
          if (id) next[sc.id] = id; else delete next[sc.id];
          // Absent, not empty: an empty object is a key the file never carried
          // and the round trip would fail on it.
          if (Object.keys(next).length) room.variables.scene_colors = next;
          else delete room.variables.scene_colors;
          this._mirrorToPair("scene_colors", room.variables.scene_colors, [room]);
          this._markDirty();
          paint();
          this._syncPreview();
        });
      };
      wrap.appendChild(row);
    });

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "The color a scene's icon takes while it is the one that "
      + "is on. Scenes that are off draw white.";
    wrap.appendChild(hint);
    card.appendChild(wrap);
  }

  // The same gesture the tiles use. The only difference is that badges are a
  // fixed set of six, so a reorder writes a permutation rather than splicing an
  // array of arbitrary length.
  _orderBadgeCards(room, col) {
    if (!col) return;
    col.classList.add("badgecol");
    col.classList.toggle("editing", !!this._editBadges);

    // Edit lives here, NOT in the group header. That header is collapsed to
    // height:0 opacity:0 when hints are off, so a button inside it went with
    // them - and while they were on it overlapped the description, because the
    // header is a two-column grid with no room for a third thing.
    if (!col.querySelector(".badgebar")) {
      // A ROW of the list, not a button over it, sharing .sortstrip's rules so
      // this and Smart Sort read alike. Its OWN class though: .sortstrip means
      // the tile list's one settings row, and the suite holds it to one.
      const bar = document.createElement("div");
      bar.className = "badgebar";
      const lab = document.createElement("span");
      lab.className = "bandtog";
      lab.textContent = "Order";
      bar.appendChild(lab);
      const eb = document.createElement("button");
      eb.className = "badgeedit";
      eb.type = "button";
      const paint = () => {
        eb.textContent = this._editBadges ? "Done" : "Edit";
        eb.title = this._editBadges ? "Finish editing" : "Reorder badges";
        eb.setAttribute("aria-pressed", this._editBadges ? "true" : "false");
      };
      paint();
      eb.onclick = () => {
        this._editBadges = !this._editBadges;
        paint();
        // In place, not a rebuild: a fresh grip is born at its end position and
        // has nothing to slide from.
        col.classList.toggle("editing", this._editBadges);
      };
      bar.appendChild(eb);
      // Under the caption, above the badges - where Smart Sort sits relative to
      // the tiles. The caption is the column's first child when hints are on
      // and a collapsed one when they are off, so this goes after it either way.
      const gh = col.querySelector(".grouphead");
      col.insertBefore(bar, gh ? gh.nextSibling : col.firstChild);
    }
    const cards = [...col.children].filter((c) => c.dataset && c.dataset.bid);
    if (cards.length < 2) return;
    const order = this._badgeOrder(room);
    // Reappend in order. The header sits above them and is not in this list, so
    // moving these around it is safe.
    order.forEach((id) => {
      const hit = cards.find((c) => c.dataset.bid === id);
      if (hit) col.appendChild(hit);
    });
    if (this._sel) return;  // pushed into one badge; there is no list to sort

    cards.forEach((box) => {
      const head = box.querySelector(".chead");
      if (!head) return;
      const grip = document.createElement("button");
      grip.className = "grip";
      grip.type = "button";
      grip.tabIndex = -1;
      // Pointer-only, like the tiles': announcing a control a keyboard cannot
      // work is a promise the row does not keep.
      grip.setAttribute("aria-hidden", "true");
      grip.title = "Drag to reorder";
      grip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
        + ' stroke-width="1.8" stroke-linecap="round">'
        + '<path d="M5 6.5h14M5 12h14M5 17.5h14"/></svg>';
      grip.onclick = (evc) => evc.stopPropagation();
      head.appendChild(grip);
      grip.onpointerdown = (ev) => this._dragBadgeCard(ev, box, col, room);
    });
  }

  _dragBadgeCard(ev, box, col, room) {
    if (ev.button) return;
    ev.preventDefault();
    ev.stopPropagation();
    const cards = [...col.children].filter((c) => c.dataset && c.dataset.bid);
    const me = cards.indexOf(box);
    if (me < 0) return;
    const rects = cards.map((c) => c.getBoundingClientRect());
    const startY = ev.clientY;
    let moved = false, shown = me;

    const shiftTo = (t) => {
      if (t === shown) return;
      shown = t;
      const seq = cards.map((_, k) => k).filter((k) => k !== me);
      seq.splice(t, 0, me);
      seq.forEach((orig, slot) => {
        if (orig === me) return;
        cards[orig].style.transition = "transform .18s " + EASE;
        cards[orig].style.transform =
          "translate(0," + (rects[slot].top - rects[orig].top) + "px)";
      });
    };

    const onMove = (e2) => {
      const dy = e2.clientY - startY;
      if (!moved) {
        if (Math.abs(dy) < 5) return;
        moved = true;
        box.classList.add("bodrag");
        try { box.setPointerCapture(ev.pointerId); } catch (err) { /* not captured */ }
      }
      box.style.transform = "translate(0," + dy + "px)";
      const cy = rects[me].top + rects[me].height / 2 + dy;
      let t = 0;
      rects.forEach((r, k) => { if (k !== me && cy > r.top + r.height / 2) t++; });
      shiftTo(t);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      cards.forEach((c) => { c.style.transition = ""; c.style.transform = ""; });
      box.classList.remove("bodrag");
      if (!moved || shown === me) return;
      const ids = cards.map((c) => c.dataset.bid);
      const [pick] = ids.splice(me, 1);
      ids.splice(shown, 0, pick);
      // Always the full list. A partial one reads fine, but writing every id
      // means the order cannot drift when a default changes underneath it.
      room.variables.badge_order = ids;
      this._mirrorToPair("badge_order", ids, [room]);
      this._markDirty();
      this._renderForm();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // What badge_order says, in its order, then everything it does not mention.
  // Slotting unmentioned ids back into their built-in POSITION sounds right and
  // is not: ["energy"] means energy FIRST, and filling the others in around it
  // walks it back to the end.
  _badgeOrder(room) {
    const saved = ((room.variables || {}).badge_order) || [];
    const out = [];
    saved.forEach((id) => {
      if (BADGE_ORDER_IDS.indexOf(id) !== -1 && out.indexOf(id) === -1) out.push(id);
    });
    BADGE_ORDER_IDS.forEach((id) => { if (out.indexOf(id) === -1) out.push(id); });
    return out;
  }

  _renderTiles(room, pane, head) {
    pane.innerHTML = "";
    const fs = document.createElement("div");
    fs.className = "tilewrap";
    fs.dataset.k = "__tiles";

    if (!room.tiles.length) {
      const e = document.createElement("div");
      e.className = "hint";
      e.textContent = "No tiles yet. Add one below.";
      fs.appendChild(e);
    }

    const grid = document.createElement("div");
    grid.className = "tilegrid" + (this._editTiles ? " editing" : "");
    room.tiles.forEach((tile, i) => grid.appendChild(this._tileCard(room, tile, i, pane)));

    const bar = document.createElement("div");
    bar.className = "addbar";
    const addable = TILE_TYPES.filter((t) => !t.hidden)
      .slice().sort((x, y) => x.label.localeCompare(y.label));
    // Nothing is pre-selected. The first type alphabetically is not a
    // suggestion, and a field that always reads "Air purifier" looks like a
    // choice already made - so it prompts instead, and + stays out of reach
    // until there is something to add.
    let pickType = "";
    const typeLabels = { "": "" };
    addable.forEach((t) => { typeLabels[t.id] = t.label; });
    const add = document.createElement("button");
    add.className = "plus";
    add.setAttribute("aria-label", "Add a tile");
    add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    const syncAdd = () => {
      const ready = !!TILE_TYPES.find((t) => t.id === pickType);
      add.disabled = !ready;
      add.title = ready ? "Add a tile" : "Choose a tile type first";
    };
    const sel = this._combo(pickType, addable.map((t) => t.id), "Choose type",
      (v) => { pickType = v; syncAdd(); }, { fixed: true, labels: typeLabels }).wrap;
    sel.style.width = "190px";
    syncAdd();
    add.onclick = () => {
      const type = TILE_TYPES.find((t) => t.id === pickType);
      if (!type) return;
      room.tiles.push(newTile(type));
      this._renderForm();
      // Bring it into view so it can be filled in without hunting for it.
      requestAnimationFrame(() => {
        const tiles = this.shadowRoot.querySelectorAll(".tilegrid .tile");
        const el = tiles[tiles.length - 1];
        if (el) this._scrollTo(el, true);
      });
    };
    bar.appendChild(sel);
    bar.appendChild(add);

    const eb = document.createElement("button");
    eb.type = "button";
    eb.className = "editbtn" + (this._editTiles ? " on" : "");
    eb.title = this._editTiles ? "Finish editing" : "Remove or reorder tiles";
    eb.setAttribute("aria-label", this._editTiles ? "Finish editing" : "Edit tiles");
    eb.setAttribute("aria-pressed", this._editTiles ? "true" : "false");
    const ebl = document.createElement("span");
    ebl.className = "lbl";
    ebl.textContent = "Edit";
    const ebt = document.createElement("span");
    ebt.className = "tick";
    ebt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="m5 13 5 5L19 7"/></svg>';
    eb.appendChild(ebl);
    eb.appendChild(ebt);
    eb.onclick = () => {
      this._editTiles = !this._editTiles;
      this._armed = null;
      // In place, never a rebuild: a fresh row is BORN at its end position, so
      // there is nothing for the margin to travel from and the minus pops.
      grid.classList.toggle("editing", this._editTiles);
      grid.querySelectorAll(".tile.armed").forEach((t) => t.classList.remove("armed"));
      eb.classList.toggle("on", this._editTiles);
      eb.title = this._editTiles ? "Finish editing" : "Remove or reorder tiles";
      eb.setAttribute("aria-label", this._editTiles ? "Finish editing" : "Edit tiles");
      eb.setAttribute("aria-pressed", this._editTiles ? "true" : "false");
    };
    bar.appendChild(eb);

    bar.classList.add("addrowbar");
    grid.insertBefore(bar, grid.firstChild);
    // The caption comes out of the grid so Smart Sort can sit between it and
    // the list. Nothing moves visually: neither the column nor the grid paints
    // a surface in the inspector, so the caption was already sitting on the
    // panel's own glass rather than on a group.
    if (head) fs.appendChild(head);

    // A row under the add row, in the same group: both are about the list rather
    // than in it, and as a row it takes the group's rhythm and hairline. Not ON
    // the add row - that pairs a setting with an action.
    if (this._tileOptions) {
      grid.insertBefore(this._tileOptions, bar.nextSibling);
      this._tileOptions = null;
    }
    fs.appendChild(grid);

    pane.appendChild(fs);
  }

  _tileCard(room, tile, i, pane) {
    const type = tileTypeOf(tile);
    // What the card draws when the icon field is empty. For most tiles that
    // is a fixed glyph; this one derives it from the entity, and the picker
    // showed the fixed one - so the field ghosted a plug while the tile drew a
    // speaker, and called the plug "default".
    const glyphNow = () => (type.glyphFromEntity
      ? type.glyphFromEntity[String(tile.entity || "").split(".")[0]] : null);

    const box = document.createElement("div");
    box.className = "tile" + (type ? "" : " locked");
    box.dataset.k = this._tileKey(tile);

    const head = document.createElement("div");
    head.className = "thead";
    // First in the row, ahead of the icon - where iOS puts it. Always built, so
    // it can open and close rather than appearing and disappearing.
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "rmbtn";
    rm.title = "Remove this tile";
    rm.setAttribute("aria-label", "Remove " + (tile.name || "tile"));
    rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="3" stroke-linecap="round"><path d="M6 12h12"/></svg>';
    rm.onpointerdown = (ev) => ev.stopPropagation();
    rm.onclick = (ev) => {
      ev.stopPropagation();
      const key = this._tileKey(tile);
      this._armed = this._armed === key ? null : key;
      // In place: a rebuild would swap the row out from under the slide.
      const gridEl = box.parentNode;
      if (gridEl) {
        gridEl.querySelectorAll(".tile.armed").forEach((t) => t.classList.remove("armed"));
      }
      box.classList.toggle("armed", this._armed === key);
    };
    head.appendChild(rm);
    if (type && TILE_ICON[type.id]) {
      const g = document.createElement("span");
      g.className = "sicon";
      // The tile's OWN icon, not the type's, resolved the way the card does it:
      // what you chose, then what the type derives from the entity, then the
      // type's glyph.
      const tv2 = tile.variables || {};
      const chosen = tv2.icon || tile.icon;
      g.style.setProperty("--i",
        "url('" + iconUrl(chosen || glyphNow() || TILE_ICON[type.id]) + "')");
      // Same tint the dashboard gives it, from the map the preview shares.
      g.style.setProperty("--sc", TILE_COLOR[type.id] || TILE_TINT);
      head.appendChild(g);
    }
    const title = document.createElement("div");
    title.className = "grow";
    const kind = type ? (tile.name && tile.name.trim() ? "" : type.label)
      : tileLabel(tile) + " - not editable here";
    title.innerHTML = `${tile.name || "(unnamed)"}${kind ? ` <span class="kind">${kind}</span>` : ""}`;
    head.appendChild(title);
    const tFoldKey = room.path + "|tile|" + this._tileKey(tile);
    // In the list a tile IS its header, and the box below is shut a few lines
    // down, so the caret has to read collapsed for EVERY row - the fold state is
    // seeded at boot and a tile added later is not in it.
    this._folded.add(tFoldKey);
    head.appendChild(this._foldButton(tFoldKey, head, box,
      tile.name || (type && type.label) || "tile"));
    // Always built, like the minus: CSS opens and closes it.
    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "grip";
    grip.tabIndex = -1;
    // Reordering is pointer-only, so announcing a control a keyboard cannot
    // work would be a promise the row does not keep.
    grip.setAttribute("aria-hidden", "true");
    grip.title = "Drag to reorder";
    grip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="1.8" stroke-linecap="round">'
      + '<path d="M5 6.5h14M5 12h14M5 17.5h14"/></svg>';
    grip.onclick = (ev) => ev.stopPropagation();
    head.appendChild(grip);
    // No trailing summary while it is on: a tile's Name comes FROM its entity, so
    // the pair is the same fact twice. Off is worth saying.
    const tileOn = (tile.variables || {}).enabled !== false;
    if (!tileOn) {
      const c = document.createElement("span");
      c.className = "count";
      c.textContent = "Off";
      head.appendChild(c);
      box.classList.add("off");
    } else if (tileShowWhen(type, tile.variables) === "active") {
      // Off is worth saying in the list, and so is a tile that will not be
      // there most of the time - otherwise it reads as one that has gone
      // missing. It is the row's only summary either way.
      const c = document.createElement("span");
      c.className = "count";
      c.textContent = "Shown when active";
      head.appendChild(c);
    }
    // Same rule as a section row: in the list, a tile is its header.
    box.classList.add("shut");

    const removeTile = () => {
      const done = () => {
        const [gone] = room.tiles.splice(i, 1);
        this._removePairTwin(room, gone);
        this._renderForm();
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
      box.style.transformOrigin = "50% 30%";
      box.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(0.86)" },
        ],
        { duration: 230, easing: "cubic-bezier(.4,0,.9,.6)" }
      ).finished.then(done, done);
    };

    const dots = document.createElement("button");
    dots.className = "mini icon rowmenu";
    dots.title = "More";
    dots.setAttribute("aria-label", "More");
    dots.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
    dots.onpointerdown = (ev) => ev.stopPropagation();
    const grp = type && TILE_GROUP[type.id];
    // No "Add lock" here. It is one row, at the foot of the locks it adds to -
    // the same place the section + sits - so you find it by reading the card
    // rather than by opening a menu named after nothing.
    dots.onclick = () => this._menuAt(dots, [
      { id: "remove", label: "Remove tile" },
    ], (id) => {
      if (id === "remove") return removeTile();
    });
    head.appendChild(dots);
    // Drag the header to reorder. Presses on the buttons are left alone.
    head.onpointerdown = (ev) => {
      // Cleared on every press, so the flag a drag sets below is never stale
      // by the time the click that follows asks about it.
      head._dragged = false;
      // The grip is a button, and it is the only one that starts a drag rather
      // than swallowing it - that is the whole reason iOS draws one.
      const fromGrip = !!(ev.target.closest && ev.target.closest(".grip"));
      if (ev.button || (!fromGrip && ev.target.closest("button"))) return;
      // Inside one tile there is nothing to reorder - the list is not on screen
      // - so the row still took the grab cursor and the pointer capture and
      // then had nowhere to put anything down.
      if (this._sel) return;
      // Same trade as the room pills: on a phone the page has to be able to
      // scroll from anywhere, so touch never starts a reorder.
      if (!fromGrip && ev.pointerType === "touch" && isPhone(this)) return;
      const grid = box.parentNode;
      if (!grid) return;

      const startX = ev.clientX, startY = ev.clientY;
      // Tiles only. The add row is the grid's FIRST child, so every index here
      // was one out from the tile it named: the gap opened above the row under
      // the pointer, and the drop landed a place off.
      const cards = [...grid.children].filter((c) => c.classList.contains("tile"));
      const self = cards.indexOf(box);
      if (self < 0) return;
      const rects = cards.map((c) => c.getBoundingClientRect());
      let moved = false, target = self, shown = self;

      // Where the row lands is how far it has TRAVELED, not which center the
      // pointer is nearest: at a boundary two slots are equidistant, so
      // nearest-center flipped between them and restarted every transition.
      const pitch = rects.length > 1
        ? (rects[rects.length - 1].top - rects[0].top) / (rects.length - 1)
        : rects[0].height;
      // The row has to travel a seventh of a slot PAST the halfway line before
      // the gap moves, and the same again to come back - so a hand that is not
      // quite still cannot make it change its mind.
      const HYST = 0.14;
      const slotFor = (dy) => {
        if (!pitch) return self;
        const want = self + dy / pitch;
        let t = shown;
        if (want > t + 0.5 + HYST || want < t - 0.5 - HYST) t = Math.round(want);
        return Math.max(0, Math.min(cards.length - 1, t));
      };

      // One column, so a reorder drags the same direction the page scrolls.
      // Gated behind a hold on touch, like the room pills.
      const touch = ev.pointerType === "touch";
      // A handle is already a deliberate target, so it lifts at once. Only the
      // row's own body needs the hold, to tell a lift from a scroll.
      let canDrag = !touch || fromGrip, holdTimer = 0;
      const eatTouch = (e3) => { if (canDrag && e3.cancelable) e3.preventDefault(); };
      if (touch && fromGrip) {
        try { head.setPointerCapture(ev.pointerId); } catch (err) { /* not captured */ }
        window.addEventListener("touchmove", eatTouch, { passive: false });
      } else if (touch) {
        holdTimer = setTimeout(() => {
          holdTimer = 0;
          canDrag = true;
          box.classList.add("dragging");
          try { head.setPointerCapture(ev.pointerId); } catch (err) { /* not captured */ }
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* no haptics */ } }
        }, 380);
        window.addEventListener("touchmove", eatTouch, { passive: false });
      }
      const endHold = () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; }
        window.removeEventListener("touchmove", eatTouch, { passive: false });
      };

      // The grid's slots are uniform, so slot k always sits at rects[k]. Shifting
      // the others into the projected order opens a real gap under the pointer.
      const shiftTo = (t) => {
        if (t === shown) return;
        shown = t;
        const order = cards.map((_, k) => k).filter((k) => k !== self);
        order.splice(t, 0, self);
        order.forEach((orig, slot) => {
          if (orig === self) return;
          const el = cards[orig];
          const from = rects[orig], to = rects[slot];
          // The settle a row makes way with: eased out, never overshooting.
          el.style.transition = "transform .22s " + SEG_EASE;
          el.style.transform = "translate(" + (to.left - from.left) + "px," + (to.top - from.top) + "px)";
        });
      };

      const onMove = (e2) => {
        const dx = e2.clientX - startX, dy = e2.clientY - startY;
        // Movement before the hold fires is a scroll, not a lift - let it go.
        if (holdTimer && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) endHold();
        if (!canDrag) return;
        if (!moved) {
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
          moved = true;
          head._dragged = true;
          box.classList.add("dragging");
          try { head.setPointerCapture(ev.pointerId); } catch (err) { /* not captured */ }
        }
        // Locked to the column, the way a table view reorder is. Sideways
        // drift is movement the list cannot act on, so it only reads as the
        // row coming loose.
        box.style.transform = "translateY(" + dy + "px)";
        target = slotFor(dy);
        shiftTo(target);
      };

      const onUp = () => {
        endHold();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        box.classList.remove("dragging");

        if (!moved) return;

        // Capture where everything actually looks right now, transforms included,
        // so the rebuild animates from the gap rather than jumping.
        const before = this._captureCards();
        cards.forEach((c) => { c.style.transition = ""; c.style.transform = ""; });

        if (target === self) { requestAnimationFrame(() => this._playCards(before)); return; }
        const [x] = room.tiles.splice(self, 1);
        room.tiles.splice(target, 0, x);
        this._renderForm();
        requestAnimationFrame(() => this._playCards(before));
      };

      // A press that will drag must not also start a text selection - the sweep
      // carries past the row into the one below. Touch is left alone: preventing
      // the default there kills the scroll the hold exists to allow.
      if (ev.pointerType !== "touch") ev.preventDefault();

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };

    // Slides in from the trailing edge once the minus is pressed. Outside the
    // head, so the head can travel and leave it standing.
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delbtn";
    del.textContent = "Delete";
    del.setAttribute("aria-label", "Delete " + (tile.name || "tile"));
    del.onpointerdown = (ev) => ev.stopPropagation();
    del.onclick = (ev) => { ev.stopPropagation(); this._armed = null; removeTile(); };

    box.appendChild(head);
    box.appendChild(del);
    if (this._armed === this._tileKey(tile) && this._editTiles) box.classList.add("armed");

    if (!type) return box;

    const body = document.createElement("div");
    body.className = "tbody";

    const addRow = (label, input) => {
      const r = document.createElement("div");
      r.className = "row";
      const l = document.createElement("label");
      l.textContent = label;
      r.appendChild(l); r.appendChild(input);
      body.appendChild(r);
      return r;
    };

    const memberList = () => {
      const v = tile.variables || {};
      return Array.isArray(v[grp && grp.list]) ? v[grp.list] : [];
    };
    // Before anything counts the list - isGroup, the member rows, the maps.
    if (grp) {
      const raw = memberList();
      const clean = raw.filter((id) => typeof id === "string" && MEMBER_ID.test(id));
      if (clean.length !== raw.length) {
        if (!tile.entity && clean.length) tile.entity = clean[0];
        // The template is left alone: hemma_popup_lock reads one lock as
        // happily as six, so a repair is no reason to drop back to more-info.
        if (clean.length > 1 || (clean.length && clean[0] !== tile.entity)) {
          tile.variables[grp.list] = clean;
        } else {
          delete tile.variables[grp.list];
          if (!Object.keys(tile.variables).length) delete tile.variables;
        }
      }
    }
    // What the popup will iterate: it falls back to the card's own entity, so
    // a single lock still has a door sensor and a battery, and they are read.
    const onGroupTemplate = !!grp
      && (grp.entityless || Array.isArray(tile.template));
    const effectiveMembers = () => {
      const list = memberList().filter(Boolean);
      return list.length ? list : (tile.entity ? [tile.entity] : []);
    };
    const pendingKey = this._tileKey(tile);
    const pending = !!grp && this._pendingMember.has(pendingKey);
    const isGroup = !!grp && (memberList().length > 1 || pending);

    // The tile's own on/off, first inside it - the switch a list row no longer
    // carries. It rides up into the bar beside the name when you push in.
    const tsw = this._boolSwitch(
      (tile.variables || {}).enabled === false ? false : true, true,
      (v) => {
        if (v === undefined) {
          if (tile.variables) {
            delete tile.variables.enabled;
            if (!Object.keys(tile.variables).length) delete tile.variables;
          }
        } else {
          if (!tile.variables) tile.variables = {};
          tile.variables.enabled = v;
        }
        this._renderForm();
      }, "Show this tile on the dashboard");
    head.appendChild(tsw);

    const nameIn = document.createElement("input");
    nameIn.value = tile.name || "";
    nameIn.onchange = () => {
      tile.name = nameIn.value.trim();
      title.firstChild.textContent = (tile.name || "(unnamed)") + " ";
      this._syncPreview();
    };

    // Entity first, then Name: you pick the thing and it names itself, but only
    // while the name is still one the panel wrote. A multi-entity tile puts Name
    // FIRST and never auto-names - no single sensor is the card's name.
    const autoName = !type.multiEntity && !isGroup;
    const friendlyOf = (id) => {
      const e = id && this._hass && this._hass.states[id];
      return (e && e.attributes && e.attributes.friendly_name) || null;
    };
    const entCombo = this._combo(tile.entity || "", this._entityList(type.domains, type.classes),
      type.entityPlaceholder || type.domains.map((d) => d + ".").join(" / "),
      (v) => {
        const prev = tile.entity;
        const was = glyphNow();
        tile.entity = v;
        const held = (tile.name || "").trim();
        if (autoName && (!held || held === type.label || held === friendlyOf(prev)
            || held === this._prettyEntity(prev))) {
          const next = friendlyOf(v) || "";
          if (next) {
            tile.name = next;
            nameIn.value = next;
            title.firstChild.textContent = next + " ";
          }
        }
        // Slot 1 tracks the tile's entity, but only ever with an entity:
        // clearing the combo used to stamp an empty string into the list.
        if (isGroup && v && memberList().length) {
          const list = memberList().slice();
          list[0] = v;
          tile.variables[grp.list] = list;
        }
        // Sensors that come in a named pair or a set fill themselves in from
        // the one you picked. Both only ever seed an EMPTY field.
        let rebuild = false;
        if (type.twin && v && !(tile.variables || {})[type.twin.key]) {
          const twin = this._twinOf(v, type.twin.from, type.twin.to);
          if (twin) {
            if (!tile.variables) tile.variables = {};
            tile.variables[type.twin.key] = twin;
            rebuild = true;
          }
        }
        if (type.id === "plant" && v) {
          const have = (tile.variables || {}).sensors;
          if (!Array.isArray(have) || !have.filter(Boolean).length) {
            const found = this._plantSensorsFor(v);
            if (found.length) {
              if (!tile.variables) tile.variables = {};
              tile.variables.sensors = found;
              rebuild = true;
            }
          }
        }
        // A tile that derives its glyph from the entity has just changed what
        // its icon field is ghosting, and the field is already on screen.
        if (type.glyphFromEntity && glyphNow() !== was) rebuild = true;
        if (rebuild) this._renderForm();
        else this._syncPreview();
      });
    const entityLabel = isGroup ? grp.noun + " 1" : (type.entityLabel || "Entity");
    // noEntity keeps a type's entity off the form entirely, where
    // entityAdvanced only moves it to the drawer. Not `&& !isGroup`: a second
    // sensor makes the tile a group and would bring the row back.
    const noEntityRow = !!type.noEntity;
    const entityInDrawer = !noEntityRow && !!type.entityAdvanced && !isGroup;
    if (noEntityRow) {
      addRow("Name", nameIn);
    } else if (!entityInDrawer) {
      if (autoName) {
        addRow(entityLabel, entCombo.wrap);
        addRow("Name", nameIn);
      } else {
        addRow("Name", nameIn);
        addRow(entityLabel, entCombo.wrap);
      }
    } else {
      addRow("Name", nameIn);
    }

    if (grp) {
      const v = tile.variables || {};
      const list = Array.isArray(v[grp.list]) ? v[grp.list] : [];
      // Dropping back to one entity is no longer a group, so the popup and the
      // member list both go with it.
      const collapse = () => {
        if (tile.variables) {
          delete tile.variables[grp.list];
          if (!Object.keys(tile.variables).length) delete tile.variables;
        }
        if (grp.single) tile.template = grp.single;
      };
      // hemma_entity dereferences the tile's entity in seven templates, so an
      // entityless group keeps one pointed at its first member and RE-points on
      // every list change - backfilling only when empty left it pointing at a
      // sensor no longer in the list.
      const syncEntity = () => {
        if (!grp.entityless) return;
        const l = (tile.variables && tile.variables[grp.list]) || [];
        const first = l.filter(Boolean)[0];
        if (first) tile.entity = first;
        else delete tile.entity;
      };
      const dropButton = (onclick) => {
        const drop = document.createElement("button");
        drop.className = "drop";
        drop.title = "Remove";
        drop.setAttribute("aria-label", "Remove");
        drop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14"/></svg>';
        drop.onclick = onclick;
        return drop;
      };
      // A member row is a 38px control between 12px paddings over a 1px rule.
      // The + chip is 22px between a 2px and a 14px margin. anincheck.py holds
      // both against the CSS so they cannot drift apart from it.
      const ROW_H = 63;
      const ADD_H = 38;
      const naturalH = (el) => {
        const h = el && el.getBoundingClientRect
          ? el.getBoundingClientRect().height : 0;
        return (h > 1 ? h : ROW_H);   // 0 while the card is still detached
      };
      // Collapse first, then let the caller re-render. Falls straight through
      // where there is no animation to wait on - reduced motion, or the JXA
      // harness, which has no setTimeout and no real events.
      const animateOut = (el, done, floor) => {
        const canAnimate = el && el.classList
          && typeof el.addEventListener === "function"
          && typeof setTimeout === "function"
          && !(typeof window !== "undefined" && window.matchMedia
               && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        if (!canAnimate) return done();
        let fired = false;
        const go = () => { if (fired) return; fired = true; done(); };
        el.style.setProperty("--rowh", naturalH(el) + "px");
        el.style.setProperty("--rowto", (floor || 0) + "px");
        el.addEventListener("animationend", go, { once: true });
        setTimeout(go, 400);   // the render still happens if the event never comes
        el.classList.add("rowout");
      };
      const memberRow = (label, combo, drop, enter) => {
        // The row's own second and third children, like every other row: shared
        // in one wrapper, the field gave up the minus's width and the minus sat
        // short of the + below it.
        const r = addRow(label, combo.wrap);
        if (r) r.appendChild(drop);
        // Bound here so settled and pending rows collapse alike. A pending row
        // stands in for the + chip, so cancelling settles to the CHIP's height:
        // collapsing to 0 shut the section and reopened it.
        if (r && drop && typeof drop.onclick === "function") {
          const removeIt = drop.onclick;
          // The pending row is the one standing in for the + chip. Its minus
          // means "never mind", not "delete": there is nothing there yet to
          // lose, so asking twice would be friction over nothing.
          drop.onclick = enter
            ? () => animateOut(r, removeIt, ADD_H)
            : (ev) => {
              if (ev && ev.stopPropagation) ev.stopPropagation();
              this._armRow(r, label, () => animateOut(r, removeIt, 0));
            };
        }
        // A fresh node every render, so a transition has no start value and this
        // has to be a keyframe. The class comes off once played: it carries
        // overflow:hidden, which would clip the combo's menu.
        if (enter && r) {
          // Measured after layout where there is a frame to wait for; the
          // constant covers the detached first paint and the harness.
          const play = () => {
            r.style.setProperty("--rowh", naturalH(r) + "px");
            r.style.setProperty("--rowfrom", ADD_H + "px");
            r.classList.add("rowin");
            r.addEventListener("animationend", () => {
              r.classList.remove("rowin");
              r.style.removeProperty("--rowh");
              r.style.removeProperty("--rowfrom");
            }, { once: true });
          };
          if (typeof requestAnimationFrame === "function") requestAnimationFrame(play);
          else play();
        }
      };
      list.forEach((member, n) => {
        // Slot 1 is the entity row above - unless there is no entity row.
        if (n === 0 && !grp.entityless) return;
        const drop = () => {
          const gone = (tile.variables[grp.list] || [])[n];
          const next = (tile.variables[grp.list] || []).slice();
          next.splice(n, 1);
          // With an entity carrying slot 1, one left in the list means the list
          // is redundant. Without one, the list IS the members, so it only goes
          // when the last one does.
          const floor = grp.entityless ? 1 : 2;
          if (next.filter(Boolean).length < floor) collapse();
          else tile.variables[grp.list] = next;
          // Per-member maps are keyed by entity id, so a removed member leaves
          // an orphan the popup never reads and the config never sheds.
          if (gone && tile.variables) {
            (grp.perMember || []).forEach((pm) => {
              const m = tile.variables[pm.key];
              if (m && typeof m === "object") {
                delete m[gone];
                if (!Object.keys(m).length) delete tile.variables[pm.key];
              }
            });
          }
          syncEntity();
          this._renderForm();
        };
        const row = this._combo(member || "", this._entityList(grp.domains),
          grp.domains.map((d) => d + ".").join(" / "), (val) => {
            // Emptying the combo takes the lock out, the same as the button
            // beside it. It does not leave a member with no entity.
            if (!val) return drop();
            const next = (tile.variables[grp.list] || []).slice();
            next[n] = val;
            tile.variables[grp.list] = next;
            syncEntity();
            this._renderForm();   // the per-member rows below key off this
          });
        memberRow(grp.noun + " " + (n + 1), row, dropButton(drop));
      });
      if (pending) {
        // The first entity stays on the tile and extras live in the list, so
        // both the list and the group template are written by the pick.
        const row = this._combo("", this._entityList(grp.domains),
          grp.domains.map((d) => d + ".").join(" / "), (val) => {
            if (!val) return;
            const v2 = tile.variables || (tile.variables = {});
            const next = (Array.isArray(v2[grp.list]) ? v2[grp.list] : []).slice();
            if (!grp.entityless && !next.length && tile.entity) next.push(tile.entity);
            next.push(val);
            v2[grp.list] = next;
            if (grp.group) tile.template = clone(grp.group);
            syncEntity();
            this._pendingMember.delete(pendingKey);
            this._renderForm();
          });
        memberRow(grp.noun + " " + (Math.max(list.length, 1) + 1), row,
          dropButton(() => { this._pendingMember.delete(pendingKey); this._renderForm(); }),
          true);
      } else if (grp.entityless || tile.entity || list.length) {
        // An entityless group starts empty, so the chip must be there from the
        // off or there is no way to add one. A glyph in the drop buttons' own
        // column, not a full-width row: add and remove are a pair, and the name
        // survives as the title and aria-label.
        const add = document.createElement("button");
        add.type = "button";
        add.className = "addmore";
        add.title = grp.add;
        add.setAttribute("aria-label", grp.add);
        add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
        add.onclick = () => {
          this._pendingMember.add(pendingKey);
          this._renderForm();
        };
        body.appendChild(add);
      }
    }

    // The drawer's summary IS the heading for whatever comes first inside it, so
    // the first group draws none of its own. Later groups keep theirs, because
    // those separate something from something. Named by the type, else by that
    // first group, else Advanced.
    const tfields = tileFieldsFor(type, this._phoneReachable());
    const advFields = tfields.filter((f) => f.advanced);
    const firstGroup = advFields.length && advFields[0].group ? advFields[0].group : null;
    const advLabel = type.advancedLabel || firstGroup || "Advanced";
    let advBody = null, advDet = null;
    const advRow = (label, input, sub) => {
      if (!advBody) {
        const det = document.createElement("div");
        det.className = "adv";
        const sum = document.createElement("button");
        sum.className = "advsum";
        sum.type = "button";
        sum.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"'
          + ' stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
        const sumLabel = document.createElement("span");
        sumLabel.textContent = advLabel;
        sum.appendChild(sumLabel);
        advBody = document.createElement("div");
        advBody.className = "advbody";
        const key = "tile|" + this._tileKey(tile);
        const open = this._advOpen.has(key);
        det.classList.toggle("open", open);
        sum.setAttribute("aria-expanded", open ? "true" : "false");
        sum.onclick = () => {
          const now = !det.classList.contains("open");
          if (now) this._advOpen.add(key); else this._advOpen.delete(key);
          this._openAdv(det, sum, now, true);
        };
        det.appendChild(sum); det.appendChild(advBody);
        // Held, not appended. A group tile builds its per-member rows before
        // any field, so a drawer appended where it was first asked for left
        // every plain row after it sitting underneath Advanced.
        advDet = det;
      }
      if (advPending) {
        const h = document.createElement("div");
        h.className = "subhead";
        h.textContent = advPending;
        advPending = null;
        advBody.appendChild(h);
      }
      const r = document.createElement("div");
      r.className = "row";
      const l = document.createElement("label");
      // A per-member row names two things, and as one string they wrapped
      // mid-phrase in a 33% label column. A heading is not open to this one:
      // these are the drawer's first rows, and a drawer opens on a field.
      if (sub) {
        const t = document.createElement("span");
        t.textContent = label;
        const u = document.createElement("span");
        u.className = "lsub";
        u.textContent = sub;
        l.appendChild(t); l.appendChild(u);
      } else {
        l.textContent = label;
      }
      r.appendChild(l); r.appendChild(input);
      advBody.appendChild(r);
    };
    // A field can name the group it opens, so the drawer reads as "Popup" and
    // "Popup buttons" rather than one undifferentiated list. The heading is only
    // recorded here - advRow flushes it once the drawer exists to hang it in,
    // which is why the FIRST field of a group is the one that carries it.
    let advGroup = null, advPending = null;
    const advGroupHead = (name) => {
      if (!name || name === advGroup) return;
      advGroup = name;
      advPending = name;
    };

    // Per-member extras, keyed by the member's entity id - that is how
    // hemma_popup_lock_group reads door_sensors and battery_entities.
    if (onGroupTemplate && grp.perMember && grp.perMember.length) {
      const members = effectiveMembers();
      grp.perMember.forEach((pm) => {
        const raw = (tile.variables || {})[pm.key];
        const map = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
        // One member puts its name under every field and says nothing: there
        // is only one thing it could belong to. The second line goes.
        const many = members.length > 1;
        members.forEach((id) => {
          const st = this._hass.states[id];
          const who = (st && st.attributes.friendly_name) || id;
          // Every kind writes the same shape: { member_entity_id: value }.
          // An empty value deletes the key rather than storing "", because the
          // popup reads `overrides[id] || <derived>` and would take "" as an
          // answer and print nothing.
          const write = (val) => {
            const next = {};
            members.forEach((k) => { if (map[k]) next[k] = map[k]; });
            if (val) next[id] = val; else delete next[id];
            const v = tile.variables || (tile.variables = {});
            if (Object.keys(next).length) v[pm.key] = next;
            else delete v[pm.key];
            this._syncPreview();
          };
          let wrap;
          if (pm.kind === "text") {
            const input = document.createElement("input");
            input.value = map[id] || "";
            // The placeholder is what the popup derives on its own, so what a
            // name is overriding is visible before it is overridden.
            input.placeholder = String(who)
              .replace(/\s*Battery(\s+(Level|State|Percentage))?$/i, "").trim() || who;
            input.onchange = () => write(input.value.trim());
            wrap = input;
          } else if (pm.kind === "icon") {
            wrap = this._combo(map[id] || "", [ICON_DEFAULT].concat(HEMMA_ICONS),
              "default", (val) => write(val === ICON_DEFAULT ? "" : val),
              { icon: true, iconFallback: null }).wrap;
          } else {
            wrap = this._combo(map[id] || "", this._entityList(pm.domains),
              (pm.domains || []).map((d) => d + ".").join(" / "), write).wrap;
          }
          advRow(pm.label, wrap, many ? who : null);
        });
      });
    }

    // advFields above still reads the unfiltered list, so a type that both
    // groups its drawer AND hides the first field of that group would name the
    // drawer after something not on screen. Nothing does yet; the fix belongs
    // there rather than here if one ever does.
    tfields.filter((f) => !f.when || f.when(tile.variables || {})).forEach((f) => {
      const cur = (tile.variables || {})[f.key];
      let input;
      // Declared here, not inside the block below: the plain-input path falls
      // out of that block and still calls put(), which threw "Can't find
      // variable: put" and took the whole Tiles section down with it.
      const put = f.advanced ? advRow : addRow;
      if (f.advanced && f.group && f.group !== firstGroup) advGroupHead(f.group);
      const hintUnder = () => {
        if (!f.hint) return;
        const h = document.createElement("div");
        h.className = "hint";
        h.textContent = f.hint;
        (f.advanced && advBody ? advBody : body).appendChild(h);
      };

      // hemma_popup_plant takes ONE flat list and reads each entry's kind off
      // its entity id, so the panel draws the six readings it will actually
      // plot and writes them back in that order. Anything it cannot type is
      // carried on the end rather than dropped.
      if (f.type === "plantsensors") {
        const raw = Array.isArray(cur) ? cur.filter(Boolean) : [];
        const bySlot = {};
        const extra = [];
        raw.forEach((id) => {
          const t = plantSlotOf(id);
          if (t && !bySlot[t]) bySlot[t] = id;
          else extra.push(id);
        });
        const write = () => {
          const next = PLANT_SLOTS.map((sl) => bySlot[sl.type]).filter(Boolean).concat(extra);
          if (next.length) {
            if (!tile.variables) tile.variables = {};
            tile.variables[f.key] = next;
          } else if (tile.variables) {
            delete tile.variables[f.key];
            if (!Object.keys(tile.variables).length) delete tile.variables;
          }
          this._syncPreview();
        };
        PLANT_SLOTS.forEach((sl) => {
          // Suggestions, not a wall: the field still takes anything you type,
          // since an install whose ids do not name their readings still has to
          // be configurable. What it will not do is offer a light sensor for
          // the temperature slot and let the popup plot it as light.
          const opts = this._entityList(["sensor"]).filter((id) => plantSlotOf(id) === sl.type);
          const c = this._combo(bySlot[sl.type] || "", opts, "sensor.", (v) => {
            if (v) bySlot[sl.type] = v; else delete bySlot[sl.type];
            write();
          });
          advRow(sl.label, c.wrap);
        });
        if (advBody) {
          const h = document.createElement("div");
          h.className = "hint";
          h.textContent = extra.length
            ? "Each sensor's reading is taken from its entity id. Also passed through: "
              + extra.join(", ")
            : "Each sensor's reading is taken from its entity id.";
          advBody.appendChild(h);
        }
        return;
      }

      if (f.type === "list") {
        put(f.label, this._chipPicker(cur, f.domains || ["sensor"], (items) => {
          if (items.length) { if (!tile.variables) tile.variables = {}; tile.variables[f.key] = items; }
          else if (tile.variables) delete tile.variables[f.key];
          // hemma_battery scores the list and never shows an entity row, so
          // the first sensor backfills the entity hemma_entity still reads.
          if (type.noEntity && !tile.entity && items.length) {
            tile.entity = items[0];
            return this._renderForm();
          }
          this._syncPreview();
        }, undefined, { classes: f.classes, placeholder: f.placeholder }));
        hintUnder();
        return;
      }

      /* A tile can carry a map too: unimplemented here, a map field fell through
         to the generic input and drew a bare text box. One row per entity in the
         field this maps `over`, named for the entity. */
      if (f.type === "map") {
        const over = ((tile.variables || {})[f.over] || []).filter(Boolean);
        const raw = (tile.variables || {})[f.key];
        const map = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
        if (!over.length) {
          // Through put(), not straight into a container: advBody is built
          // lazily inside advRow and does not exist yet here.
          const h = document.createElement("div");
          h.className = "hint";
          h.textContent = f.emptyHint || "Add the entities above first.";
          put(f.label, h);
          return;
        }
        over.forEach((id) => {
          const st = this._hass.states[id];
          const who = (st && st.attributes.friendly_name) || id;
          // Same shape every kind writes: { entity_id: value }. Empty deletes
          // the key rather than storing "", which the popup would take as an
          // answer and render as nothing.
          const write = (v) => {
            const next = {};
            over.forEach((k) => { if (map[k]) next[k] = map[k]; });
            if (v) next[id] = v; else delete next[id];
            const vars = tile.variables || (tile.variables = {});
            if (Object.keys(next).length) vars[f.key] = next;
            else delete vars[f.key];
            this._syncPreview();
          };
          const c = f.kind === "icon"
            ? this._combo(map[id] || "", [ICON_DEFAULT].concat(HEMMA_ICONS),
                f.iconDefault || "default",
                (v) => write(v === ICON_DEFAULT ? "" : v),
                { icon: true, iconFallback: f.iconDefault || null })
            : this._combo(map[id] || "", this._entityList(f.domains, f.classes),
                (f.domains || []).map((d) => d + ".").join(" / "), write);
          put(f.label, c.wrap, who);
        });
        hintUnder();
        return;
      }

      if (f.type === "bool") {
        put(f.label, this._boolSwitch(cur, f.boolDefault, (v) => {
          if (v === undefined) {
            if (tile.variables) {
              delete tile.variables[f.key];
              if (!Object.keys(tile.variables).length) delete tile.variables;
            }
          } else {
            if (!tile.variables) tile.variables = {};
            tile.variables[f.key] = v;
          }
          this._syncPreview();
        }, f.label));
        hintUnder();
        return;
      }
      // A field others are hidden behind has to rebuild the card, or the rows
      // it just unlocked do not appear until something else re-renders.
      const after = () => { if (f.reveals) this._renderForm(); else this._syncPreview(); };
      if (f.type === "select") {
        put(f.label, this._combo(String(cur === undefined ? "" : cur), f.options, "",
          (v) => {
            if (v === "") { if (tile.variables) delete tile.variables[f.key]; }
            else { if (!tile.variables) tile.variables = {}; tile.variables[f.key] = v; }
            if (tile.variables && !Object.keys(tile.variables).length) delete tile.variables;
            after();
          },
          { fixed: true, labels: { "": "Default", ...(f.optionLabels || {}) } }).wrap);
        hintUnder();
        return;
      }
      // Typed: anything that is not an object is not written, or a half-typed
      // brace reaches the template as a string.
      // An empty box accepting "any CSS color" is a question most people cannot
      // answer, so Hemma's own accents are one tap away.
      if (f.type === "color") {
        const cur2 = cur === undefined ? "" : String(cur);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "colorfield";
        const sw = document.createElement("span");
        sw.className = "swatch";
        const lb = document.createElement("span");
        lb.className = "clabel";
        const paint = (v) => {
          const hex = swatchOf(v);
          sw.style.background = hex || "transparent";
          sw.classList.toggle("none", !hex);
          lb.textContent = colorLabel(v);
          lb.classList.toggle("ph", !v);
        };
        paint(cur2);
        btn.appendChild(sw); btn.appendChild(lb);
        // The browser's own picker, for a color that is not one of the accents.
        const native = document.createElement("input");
        native.type = "color";
        native.className = "nativecolor";
        native.value = /^#[0-9a-f]{6}$/i.test(swatchOf(cur2) || "")
          ? swatchOf(cur2) : "#00c3d0";
        const write = (v) => {
          if (v) { if (!tile.variables) tile.variables = {}; tile.variables[f.key] = v; }
          else if (tile.variables) {
            delete tile.variables[f.key];
            if (!Object.keys(tile.variables).length) delete tile.variables;
          }
          paint(v);
          this._syncPreview();
        };
        native.onchange = () => write(native.value);
        // showPicker is the API for opening a control you are not showing, and
        // it needs the press that opened the menu - so it runs on that press,
        // not a frame later. click() is the fallback for anything older, and
        // it is why the input keeps a real box: a zero-sized one opens nothing.
        const openNative = () => {
          try {
            if (typeof native.showPicker === "function") { native.showPicker(); return; }
          } catch (e) { /* not allowed here; fall through to the click */ }
          native.click();
        };
        btn.onclick = () => {
          const items = [{ id: "", label: "From the entity's domain",
                           checked: !tile.variables || !tile.variables[f.key] }];
          HEMMA_ACCENTS.forEach((a) => items.push({
            id: a.id, label: a.label, swatch: a.hex, group: "Hemma",
            checked: cur2 === a.id,
          }));
          items.push({ id: "__custom", label: "Custom\u2026", group: "Hemma" });
          this._menuAt(btn, items, (id) => {
            if (id === "__custom") { openNative(); return; }
            write(id);
          });
        };
        const cell = document.createElement("span");
        cell.className = "colorcell";
        cell.appendChild(btn); cell.appendChild(native);
        put(f.label, cell);
        hintUnder();
        return;
      }
      if (f.type === "json") {
        const box = document.createElement("input");
        box.value = cur && typeof cur === "object" && Object.keys(cur).length
          ? JSON.stringify(cur) : "";
        if (f.placeholder) box.placeholder = f.placeholder;
        box.onchange = () => {
          const raw = box.value.trim();
          if (!raw) {
            if (tile.variables) delete tile.variables[f.key];
            if (tile.variables && !Object.keys(tile.variables).length) delete tile.variables;
            box.classList.remove("bad");
            this._syncPreview();
            return;
          }
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            box.classList.add("bad");
            return;
          }
          box.classList.remove("bad");
          if (!tile.variables) tile.variables = {};
          tile.variables[f.key] = parsed;
          this._syncPreview();
        };
        put(f.label, box);
        hintUnder();
        return;
      }
      {
        const set = (v) => {
          if (v === "") {
            if (tile.variables) delete tile.variables[f.key];
            if (tile.variables && !Object.keys(tile.variables).length) delete tile.variables;
            after();
            return;
          }
          if (!tile.variables) tile.variables = {};
          tile.variables[f.key] = v;
          after();
        };
        if (f.type === "icon") {
          // A field whose default is an entity's OWN icon has nothing to ghost
          // - that is an mdi name this picker cannot draw - so it says what
          // will happen instead of drawing the wrong glyph.
          const ghost = f.iconNoGhost ? null
            : (f.iconDefault || glyphNow() || TILE_ICON[type.id] || null);
          put(f.label, this._combo(
            cur, [ICON_DEFAULT].concat(HEMMA_ICONS), f.iconText || f.iconDefault || "default",
            (v) => set(v === ICON_DEFAULT ? "" : v),
            { icon: true, iconFallback: ghost }
          ).wrap);
          hintUnder();
          return;
        }
        if (f.domains) {
          put(f.label, this._combo(cur, this._entityList(f.domains, f.classes),
            f.placeholder || f.domains.map((d) => d + ".").join(" / "), set).wrap);
          hintUnder();
          return;
        }
        input = document.createElement("input");
        input.value = cur === undefined ? "" : String(cur);
      }

      input.onchange = () => {
        const raw = input.value.trim();
        if (raw === "") {
          if (tile.variables) delete tile.variables[f.key];
          if (tile.variables && !Object.keys(tile.variables).length) delete tile.variables;
          after();
          return;
        }
        if (!tile.variables) tile.variables = {};
        tile.variables[f.key] = f.type === "bool" ? raw === "true" : raw;
        after();
      };

      put(f.label, input);
      hintUnder();
    });

    if (entityInDrawer) advRow(entityLabel, entCombo.wrap);
    if (advDet) body.appendChild(advDet);

    box.appendChild(body);
    return box;
  }
}

customElements.define("hemma-panel", HemmaPanel);

console.info(`%c HEMMA-PANEL %c v${PANEL_VERSION} `, "background:#222;color:#8ecdf7;font-weight:700", "background:#8ecdf7;color:#222;font-weight:700");
