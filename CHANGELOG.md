# Changelog

## 2.1.1

**Open Hemma Studio and press Save once after updating.** Several fixes below
live in Hemma's card templates, and those reach your dashboard when Studio
saves, not when HACS updates the integration. Until you save, the update is
installed but the templates in your dashboard are still the old ones. This
applies to the Firefox toggle fix in particular.

- **The Save button no longer reads "Save changesSave".** Hemma Studio carries
  both a wide and a narrow label for that button and only ever hid the wide one
  on a phone, so every other width drew the two of them back to back.

- **Toggles are the right size in Firefox.** A tile's toggle sized itself from
  a ratio of two lengths. Chrome and Safari work that out; Firefox does not, and
  because a custom property that fails takes every property built on it down
  with it, the toggle lost its width entirely and grew to fill the tile. The
  size is a fraction of the tile height now, which every browser accepts, and
  the toggle is the same size as before everywhere else. Reported in
  [#72](https://github.com/willsanderson/Hemma/issues/72).

- **Hemma Studio on a phone is the same editor as on a desktop.** The phone had
  no equivalent of the sidebar, so Badges and Tiles were unreachable and the
  sections came in band order with no grouping. It now shows the same grouped
  list, under the room's name and Dashboard, with Badges and Tiles as rows. The
  large title also stopped being hidden behind the toolbar, which had left the
  header collapsed for good.

- **Hemma's scripts ship with the integration.** They used to be served from
  `www/hemma/scripts/`, the folder you copy in by hand, which HACS never
  updates. Updating to 2.1 therefore paired the new Studio with 2.0's
  JavaScript, and every element added in 2.1 was undefined: room navigation
  broke with "Custom element doesn't exist: hemma-nav", and the popups with it.
  The scripts now live inside `custom_components/hemma/`, so HACS updates them
  with everything else and there is nothing to copy. Anything left in
  `/config/www/hemma/scripts/` is no longer read and can be deleted. Reported in
  [#69](https://github.com/willsanderson/Hemma/issues/69).

- **A template you have edited is kept.** Every save used to copy all of
  Hemma's templates over whatever was in the dashboard, so a hand edit, a
  translation, or a template of your own with a `hemma_` name was reverted or
  deleted by an unrelated save. Hemma now records a hash of what it last wrote
  for each template and compares before touching it: its own it may update,
  yours it leaves alone and names in the log. The same check gates deletion, so
  the name no longer decides anything. The panel also re-reads the dashboard at
  save time, so `kiosk_mode` and anything else changed elsewhere is no longer
  overwritten by a stale copy. Reported in
  [#66](https://github.com/willsanderson/Hemma/issues/66).

- **A tile placed only on the phone stays there.** Syncing a linked desktop and
  phone dashboard dropped any phone tile with no desktop twin, and the log line
  for it said "left as it is". Hemma now marks the tiles it copies out of a room
  and only those follow their twin out.

- **Cards of your own, in the tile picker.** The type dropdown ends in Custom
  card, which takes the same YAML or JSON you would paste into Home Assistant's
  raw editor and places it either in the tile row or below the tiles. A card in
  the row is hosted by a Hemma tile, so it gets the same surface, radius, blur
  and size as everything beside it, and it can be named, sized, hidden per
  surface, edited, copied to another room or moved below the tiles afterwards.
  A card below the tiles can be edited, moved back up or removed, and the view
  still fits one screen: the room photo shortens by the height of whatever sits
  under the tiles instead of the dashboard scrolling. The same box also takes a
  `button_card_templates` entry, which becomes a reusable tile type offered in
  every room, with a settings field per key its `variables:` block declares.
  Templates of your own that a tile already uses appear there on upgrade.
  Reported in [#67](https://github.com/willsanderson/Hemma/issues/67).

- **Rooms you add or delete reach the phone layout.** Hemma matched each
  desktop room to a phone section by name and worked out which had no partner,
  but that only ever reached the log, so deleting a room left its section on the
  phone with nothing to remove it, and a new room never got one. Saving now
  keeps them in step both ways. A section holding a tile you placed by hand is
  never removed, only ones whose tiles all came from the room. Reported in
  [#72](https://github.com/willsanderson/Hemma/issues/72).

- **The notification center takes sources of your own.** Adding a letterbox, a
  weather warning or a bin collection meant editing `hemma-core.js`, which an
  update then overwrote, so the same patch had to be reapplied every time. There
  is now a hook: put objects on `window.HEMMA_NOTIFY_EXTENSIONS` with any of
  `watch` (extra entities to read from the logbook), `describe` (turn a logbook
  entry into a row, or return `undefined` to let Hemma's own rules handle it)
  and `standing` (add to or replace the live rows). Each gets a small `api` with
  `on`, `nameOf`, `tidyName` and `dc` so a source of yours reads like a built-in
  one. An extension that throws is logged and skipped rather than taking the
  notification center down with it. Proposed in
  [#71](https://github.com/willsanderson/Hemma/issues/71).

- **A wall tablet can return to Home on its own.** Left on a room, a tablet
  stays there, so whoever walks past next sees the bathroom rather than the
  house. Hemma Studio > General > Dashboard has "Return to Home when idle" with
  a wait of 1, 2, 5 or 10 minutes, off by default. Tablets only, on the same
  test the tablet navigation uses, so a desktop browser and a phone are never
  affected. Any touch, key or scroll resets it, an open popup pauses it so it
  never pulls you away from a camera, and a tablet waking from sleep is checked
  straight away rather than at the next tick. Requested in
  [#73](https://github.com/willsanderson/Hemma/issues/73).

- **Hemma's own text can be translated.** Dashboard strings were written into
  the templates in English with no way to change them short of editing the
  templates, which an update then overwrote. There is now a translation layer:
  English stays at the call site as the fallback, and any other language is
  read from `custom_components/hemma/translations/dashboard/`. The first
  strings through it are the phone's filter pills, the people badge, the
  thermostat and the mobile weather card. Only English ships so far, so nothing
  looks different yet; adding a language is a JSON file and a rebuild, and
  Home Assistant's own vocabulary already follows your HA language. More of
  Hemma's text moves across in later releases. Raised in
  [#68](https://github.com/willsanderson/Hemma/issues/68).

- **Performance mode.** Backdrop blur is what makes Hemma crawl on a cheap
  tablet: every blurred layer is a full screen GPU readback per frame, and they
  stack. Studio > General > Performance makes the dashboard's own surfaces
  opaque instead, set to Off, On, or Automatic, which switches on below 4GB of
  memory or 4 cores. Tiles, cards, the sidebar, badges, pills, the header,
  scene chips and the room photo all lose their blur, and the entrance
  animations go with them. Popups keep theirs: they paint only while open, so
  they are not what makes a tablet feel slow. The device that needs it is
  usually one tablet rather than the house, so opening the dashboard there once
  with `?hemma_perf=on` pins it for that device and beats the dashboard
  setting. Suggested in
  [#65](https://github.com/willsanderson/Hemma/issues/65).

- **A low battery has to stay low before it says so.** Some devices report a
  bogus reading for a moment (`100 -> 3 -> 100`), which raised a "Battery low"
  notice for a device that was fine. A battery now counts as low only once it
  has read low for 30 minutes without a break. Set the wait under Notifications
  > Advanced > "Low battery hold (minutes)"; 0 restores the old immediate
  notice. A battery that has been low since before the page loaded
  still shows straight away, and a drop from 19% to 18% no longer restarts the
  wait. Reported in [#70](https://github.com/willsanderson/Hemma/issues/70).

- **The README leads with the install steps.** Installation sat behind every
  screenshot, which in the HACS panel meant scrolling past all of them to
  reach it. The screenshots now follow it, under their own heading.
- **The wide screenshots scale to the panel.** They carried fixed pixel
  widths up to 1729. GitHub quietly caps those at the page width, but the
  HACS renderer honors them, so the hero overflowed and was cropped.
- **`configuration.yaml` no longer contradicts the install steps.** Its header
  still said to add Lovelace resources by hand under Settings > Dashboards >
  Resources. Hemma has registered those itself since 2.1.0. The `lovelace:`
  block is now marked as belonging to the hand-written YAML setup in
  [docs/ADVANCED.md](docs/ADVANCED.md), which is the only place it applies.

## 2.1.0

Hemma is now installed and configured from a UI. You add it as an integration,
open **Hemma** in the sidebar, pick your rooms and entities, and press
Save. There is no dashboard YAML to write and no card configuration to paste.

Everything below still works if you prefer writing it by hand. Hemma and YAML
produce the same dashboard, and you can move between them in either direction.
See [docs/ADVANCED.md](docs/ADVANCED.md).

### Building your dashboard

- Build the whole dashboard from the sidebar: rooms, entities, badges, tiles,
  scenes, weather, the clock and Now Playing.
- **Import from YAML** reads an existing dashboard and rebuilds it. Hemma
  writes a new dashboard and leaves the original untouched, so you can compare
  the two before switching.
- **Cards Hemma does not manage are listed, and removable.** A dashboard
  imported from YAML can carry cards Hemma knows nothing about. They are kept
  exactly as they are, below the tiles, and now appear under **Other cards** in
  that room's settings, so one you do not want can be removed.

### Installing

- Hemma installs as a HACS integration.
- **Dashboard resources register themselves.** Where 2.0 asked you to paste
  eight entries under Settings > Dashboards > Resources, setup now writes them.
  An entry still loading from `/local/hemma/scripts/` is repointed in place
  rather than duplicated, so upgrading does not load anything twice.
- Scripts are served with caching off at a stable URL, so a fix can no longer
  be hidden behind a 30 day browser cache and there is no `?v=` to remember.
- New icon, in the sidebar and in HACS.
- **The phone's filter pills follow your rooms.** Their options used to be a
  hand-written list in `packages/hemma_helpers.yaml`, so a fresh install
  inherited whichever rooms happened to ship in it. Hemma writes that list
  itself now, every time you save.

### Popups

Every popup is Hemma's own element now rather than a browser_mod dialog, which
drops a dependency and puts the whole surface under Hemma's control.

- Thirteen popups: lights, locks, covers, climate and air quality, energy,
  network, plants, batteries, cameras, scenes, system updates, Plex and
  recently added.
- One surface behind all of them, with its own scrim, header and close button,
  so every popup opens, scrolls and dismisses the same way.
- A grab handle and swipe to dismiss on a phone.
- If Hemma's scripts have not loaded yet, a tap opens Home Assistant's
  more-info dialog rather than doing nothing.

### Now Playing

Rebuilt around a single collector, which fixes a family of bugs where a media
tile could duplicate, vanish, or show the wrong artwork.

- One ranked list feeding one uniform stack, on every device.
- Per card state, so two dashboards open in one session no longer trample each
  other. This is what caused the duplicate tile clipped below the real one
  after a restart.
- **Steam and Discord are one entity each.** Point Hemma at the account sensor
  and the game, artwork and detail line all follow. 2.0 wanted three separate
  Steam sensors.
- **Tautulli works unwrapped.** A session sensor from the Tautulli Active
  Streams integration can be used directly; the title, viewer and poster all
  follow from it. No template sensor needed.
- **Exclude specific Plex viewers**, so your own streams can be hidden from the
  dashboard.
- PlayStation artwork now resolves from the image entity alongside the session
  sensor.

### Navigation and theme

- **`hemma-nav` replaces navbar-card.** Navigation is Hemma's own now, with an
  anchored desktop row.
- The Edit, Notifications and Scenes dropdowns match Hemma's own corners.
- Reworked theme.

### Layout

Tiles, their icon circles and their toggles now come from one bounded scale, so
a dashboard holds its proportions from a phone up to a desktop instead of
jumping at a width threshold. The tile row sits against the screen edge rather
than being lifted off it by the header.

### Upgrading from 2.0

Your existing YAML dashboard keeps working. Nothing is removed or rewritten.

To move it into Hemma, open it from the sidebar and choose **Import from YAML**.

Five things changed that are worth knowing:

- **browser_mod is no longer required.** Every popup is Hemma's own. Remove it
  if nothing else uses it.
- **navbar-card is no longer required**, replaced by `hemma-nav`.
- **Dashboard resources moved** and are registered for you. If the log warns
  about a resource pointing at a script Hemma no longer ships, remove that one
  entry by hand. Hemma never deletes a resource itself, because that list holds
  every card you have installed.
- **Weather appears only where you configured it.** The weather entity was
  remembered per browser rather than per dashboard, so a second dashboard could
  draw the first one's forecast and temperature. If a dashboard has been
  showing weather you never set up there, it stops after upgrading.
- **Motion dots are set per room now.** The pulsing dot beside a room in the
  navigation is configured in Appearance rather than through a helper. Pick the
  room's motion sensor once and it covers both the navigation and the phone. An
  imported dashboard starts without one, so set it on each room you want it on.
