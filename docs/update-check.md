# How the "Check for updates" Button Works

[中文](update-check.zh.md) | **English**

This page explains, in plain language, what the **Check for updates** button on the plugin's settings card does. No technical background needed.

## The one-sentence version

> **If you don't click, it stays silent.** The plugin goes online to ask "what is the latest version of this plugin?" *only* at the moment you press that button — and never on its own.

## What it looks like

Open **Settings → Plugins → SearXNG search**. Below the input fields there is a row:

```
Installed version: v0.1.0   [Check for updates]
```

- **Installed version**: the version of the plugin currently on your machine.
- **Check for updates**: the button. Clicking it is the only thing that starts a check.

## What actually happens when you click?

Think of it as a quick phone call that hangs up right after:

1. **Ask**: the plugin asks its public release page on GitHub a single question — "what is the newest released version number?"
   - That question carries **only the plugin's name**. Nothing about you goes along: no search terms, no machine details, no settings.
2. **Answer**: the release page replies with a version number, say `v0.2.0`.
3. **Compare**: the plugin compares that number with the one installed on your machine (say `0.1.0`).
4. **Tell**: it shows you the outcome (three possibilities, below).

That's the whole call. **It never re-checks on a timer, and it does not check when you merely open the settings page.**

## The three outcomes, explained

| You see | Meaning | What to do |
|---|---|---|
| **New version available: v0.2.0 …** | A newer release exists than the one you have | Follow the hint to update (next section), or simply ignore it — everything keeps working |
| **You are on the latest version.** | Yours is already the newest | Nothing |
| **Could not reach the GitHub releases page…** | The "phone call" didn't get through (offline, blocked network, or the other side was busy) | Nothing breaks; try the button again later |

## A newer version is out — how do I update?

The card shows a **Release notes** link (so you can read what changed) plus the update instruction. Two routes, pick either:

- **Command line** (copy one line):
  ```sh
  dsh plugin --profile <your-profile> update dsh-web-search-searxng
  ```
- **Point and click**: on the *Plugins* page, uninstall the plugin, then add it again.

Either way, **restart the app once** afterwards to run the new version.

## Why doesn't it update by itself?

On purpose, for your own safety:

- **Your machine, your call**: updating means replacing a running program. The plugin never swaps itself out behind your back — every change starts with you.
- **Easier to troubleshoot**: if a new version misbehaves, "I clicked update just now" tells you exactly where to look.

## Questions you might have

**If I never click the button, does it ever go online?**
No. Opening the card, scrolling around, leaving it open — none of that makes any network request. There is even an automated test standing guard over this ("zero requests after rendering").

**Does clicking the button leak anything about me?**
No. The request only asks for the latest version number and carries no data about you. The plugin needs no account and no key, either.

**Does this check have anything to do with my SearXNG searches?**
Nothing at all. Searches go to *your own* SearXNG instance; the update check goes to the plugin's public release page on GitHub. One can fail without the other noticing — searches keep working even if the check fails.

**What if I never update?**
Nothing bad. Your installed version keeps working; you simply miss the improvements and fixes of newer releases.
