# Changelog

## 2.1.0

Hemma is now installed and configured from a UI. You add it as an integration,
open **Hemma Studio** in the sidebar, pick your rooms and entities, and press
Save. There is no dashboard YAML to write and no card configuration to paste.

Everything below still works if you prefer writing it by hand. Studio and YAML
produce the same dashboard, and you can move between them in either direction.
See [docs/ADVANCED.md](docs/ADVANCED.md).

### Hemma Studio

- Build the whole dashboard from the sidebar: rooms, entities, badges, tiles,
  scenes, weather, the clock and Now Playing.
- **Import from YAML** reads an existing Hemma dashboard and rebuilds it in
  Studio. It writes a new dashboard and leaves the original untouched, so you
  can compare the two before switching.
- Studio checks what Hemma needs on first open and links you straight to each
  missing piece in HACS.
- Room photos upload from Studio itself; no file copying to change a room's
  background.

### Installing

- Hemma installs as a HACS integration.
- **Dashboard resources register themselves.** Where 2.0 asked you to paste
  eight entries under Settings > Dashboards > Resources, setup now writes them.
  An entry still loading from `/local/hemma/scripts/` is repointed in place
  rather than duplicated, so upgrading does not load anything twice.
- Scripts are served with caching off at a stable URL, so a fix can no longer
  be hidden behind a 30 day browser cache and there is no `?v=` to remember.

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
  anchored desktop row and a sliding indicator.
- Reworked theme.

### Layout

- Tile height, icon circle and toggle all derive from one bounded scale, so
  tiles stay proportional instead of jumping at a width threshold.
- Four tiles fit below 1180px in landscape.
- The toggle keeps its full tap target on phones, and the gap above 1400px is
  closed.
- The tile row sits against the screen edge instead of being lifted off it by
  the header height.
- The Scenes page grid is inset to match the rest of the page, and scene chips
  no longer stretch to one chip per row on landscape phones.

### Upgrading from 2.0

Your existing YAML dashboard keeps working. Nothing is removed or rewritten.

To move it into Studio, open Hemma Studio and choose **Import from YAML**.

Three things changed that are worth knowing:

- **browser_mod is no longer required.** Every popup is Hemma's own. Remove it
  if nothing else uses it.
- **navbar-card is no longer required**, replaced by `hemma-nav`.
- **Dashboard resources moved** and are registered for you. If the log warns
  about a resource pointing at a script Hemma no longer ships, remove that one
  entry by hand. Hemma never deletes a resource itself, because that list holds
  every card you have installed.
