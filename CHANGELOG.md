# Changelog

## 2.1.1

Documentation only. Nothing in the integration itself changed.

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
