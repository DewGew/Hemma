<img width="1729" height="1383" alt="hemma" src="https://github.com/user-attachments/assets/11d69ef8-ae98-4ba0-a402-1a8c831d46cc" />

## Hemma

A modern, mobile-friendly dashboard for Home Assistant, built and configured from a UI.

Hemma installs as an integration and adds **Hemma** to your sidebar. You pick your rooms and entities there, press Save, and Hemma writes the dashboard. There is no dashboard YAML to write and no card configuration to paste.

Creating a dashboard gives you two layouts from one setup: desktop and tablet, and a phone layout inspired by Apple Home. Phones are routed to the phone one automatically.

Inspired by the [Homio](https://github.com/iamtherufus/Homio) dashboard by @iamtherufus, rebuilt and extended.

---

(Updated screenshots coming soon...)

### Desktop
<img width="1400" height="840" alt="home-day" src="https://github.com/user-attachments/assets/5f80dffb-455d-4773-bfc6-c0f43cf93f18" />

### Light and dark
<img width="1400" height="843" alt="bedroom-day" src="https://github.com/user-attachments/assets/e111998e-03e6-416d-9e43-d09049767046" />

<img width="1400" height="842" alt="bedroom-night" src="https://github.com/user-attachments/assets/01d75265-ecca-4378-aaad-e4788010fa6e" />

### Mobile
<img width="850" height="600" alt="mobile" src="https://github.com/user-attachments/assets/96b0a526-62aa-450b-b0a4-dd1cbf6ba4af" />

### Popups

Every badge and tile opens a popup built for what it shows: lights, locks, covers, climate and air quality, energy, network, plants, batteries, cameras, scenes, system updates, Plex and recently added. They are Hemma's own, not a generic dialog, so they open and dismiss the same way wherever you are.

<img width="615" height="361" alt="lights" src="https://github.com/user-attachments/assets/eda0853b-8e49-459a-a4d2-010ef335ec4d" />

### Building it

Hemma's editor sits in your sidebar. Pick a room, point it at your entities, and a live preview shows the desktop and tablet layouts as you work. Nothing is written to a dashboard until you press Save.

Everything is optional. A room with nothing but a light group is a valid room, and you can come back and add badges, tiles, scenes and Now Playing whenever you like.

---

## Requirements

- Home Assistant **2026.9.0** or newer, with Lovelace in **storage** mode (the default)
- [HACS](https://hacs.xyz)
- **Themes enabled.** Hemma ships a theme, and Home Assistant only loads themes when `configuration.yaml` says so. If you have never installed a theme, add this and restart:

  ```yaml
  frontend:
    themes: !include_dir_merge_named themes
  ```

- A time sensor, if you want the clock on your room cards. Settings > Devices & Services > **Add Integration > Date & time**, and enable the "Time" sensor. Without one the clock is simply not shown.
- **Packages enabled.** Hemma's badges, filter pills and overlays are driven by helper entities that ship in `packages/hemma_helpers.yaml`. Home Assistant only loads that folder when `configuration.yaml` says so:

  ```yaml
  homeassistant:
    packages: !include_dir_named packages
  ```

Hemma checks for the cards below on first open and links you straight to each one, so you do not need to collect them up front. The requirements above are yours to set up.

| From HACS | Why | |
| --- | --- | --- |
| [uix](https://github.com/Lint-Free-Technology/uix) | card styling, used throughout. Do not install card-mod alongside it. | **required** |
| [button-card](https://github.com/custom-cards/button-card) | every Hemma tile is one | **required** |
| [apexcharts-card](https://github.com/RomRider/apexcharts-card) | the energy and climate charts | optional |

Hemma will not let you build a dashboard without the two marked require (apexcharts-card only affects the charts named beside it).

---

## Installation

### 1. Install Hemma from HACS

HACS > **Integrations** > menu > **Custom repositories**, add `https://github.com/willsanderson/Hemma` as an **Integration**, then find Hemma in the list and **Download**.

While you are there, install **uix**, **button-card** and **apexcharts-card**.

### 2. Copy the assets

Hemma's icons, fonts, room images and theme live in your config folder. From this repo, copy:

- `www/hemma/` into `/config/www/hemma/`
- `themes/hemma/` into `/config/themes/hemma/`
- `packages/hemma_helpers.yaml` into `/config/packages/`

Without the last one, tapping a badge group throws a service-call error and the phone's filter pills do nothing. Hemma keeps the room list in it up to date for you once your dashboard is saved, and you never edit that file by hand.

### 3. Restart Home Assistant

### 4. Add the integration

Settings > Devices & Services > **Add Integration** > **Hemma**.

Hemma registers its own dashboard resources at this point. You do not need to add anything under Settings > Dashboards > Resources.

### 5. Select the theme

Click your user name at the bottom of the sidebar and set **Theme** to **Hemma**.

If Hemma is not in the list, the `frontend: themes:` line above is missing from
`configuration.yaml`.

### 6. Build your dashboard

Open **Hemma** in the sidebar and choose **Create dashboard**. Add a room, point it at your entities, and press Save. Repeat for each room.

Everything is optional. A room with nothing but a light group is a valid room, and you can come back and add badges, scenes and Now Playing whenever you like.

---

## Upgrading from Hemma 2.0

Your existing YAML dashboard keeps working. Nothing is removed or rewritten.

To move it into Hemma:

1. Install the integration as above.
2. Open Hemma and choose **Import from YAML**.
3. Pick your existing dashboard. Hemma reads your rooms, entities and badges, and shows you what it found before it writes anything.

The import creates a **new** dashboard and leaves the original untouched, so you can compare the two and switch over when you are happy.

Five things changed in 2.1 that are worth knowing:

- **browser_mod is no longer required.** Every popup is now Hemma's own. You can remove it if nothing else uses it.
- **navbar-card is no longer required**, replaced by Hemma's own `hemma-nav`.
- **Dashboard resources moved.** Hemma now serves its scripts itself and registers them for you. Entries still pointing at `/local/hemma/scripts/` are repointed automatically on first setup. If you see a warning in the log about a resource Hemma no longer ships, remove that one entry by hand.
- **Weather appears only where you configured it.** The weather entity used to be remembered per browser rather than per dashboard, so a second dashboard could draw the first one's forecast. If a dashboard has been showing weather you never set up there, it stops after upgrading.
- **Motion dots are set per room now.** The pulsing dot beside a room in the navigation is configured in Appearance rather than through a helper. Pick the room's motion sensor once and it covers both the navigation and the phone. An imported dashboard starts without one, so set it on each room you want it on.

---

## Features

- **Built from a UI.** Rooms, entities, badges, tiles, scenes, weather, the clock and Now Playing are all set up in Hemma itself, with a live preview of the desktop, tablet and phone layouts as you go.
- **Rooms** with a photo hero, live clock, weather, and per-room entity tiles
- **Badges** for climate, lights, presence, media, security and energy, each opening a full popup
- **Now Playing** showing every active source at once, with artwork, progress and controls. Understands media players, Plex and Tautulli, Discord, Steam and PlayStation.
- **Scenes**, as a row, a page, and per-room sections
- **Popups** for lights, locks, covers, climate and air quality, energy, network, plants, batteries, cameras, scenes, system updates, Plex and recently added
- **Mobile dashboard** with filter pills, room popups, a collapsing header, and a wallpaper that samples your room photos for its gradient
- **Motion** shows a pulsing dot beside a room in the navigation, and a motion icon on the phone
- **Light and dark** throughout, with day and night room images

---

## Writing your own YAML

Hemma builds ordinary Lovelace dashboards, so anything it writes you can also write or extend by hand. Custom templates, hand-built views and per-card overrides all keep working.

See **[docs/ADVANCED.md](docs/ADVANCED.md)** for the folder layout, template variables, and the full card reference.

---

### :trophy: Credits

- Original Homio concept and base implementation: [iamtherufus/Homio](https://github.com/iamtherufus/Homio)
- Hemma customization and ongoing tweaks: [@willsanderson](https://github.com/willsanderson)

#### Enjoying Hemma? Buy me a coffee :v::smiley:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V7V31RK6FB)
