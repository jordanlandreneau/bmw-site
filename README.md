# BMW & MINI of Manhattan — Service & Scheduling Guide

The Worldwide BDC guide for the BMW & MINI of Manhattan account, moved off Google Sites.
All the content from the old site is here: the **Main** tab (logins, hours, important notes,
checklist, drop off, pick up, emergencies, loaners, valet, warranty, lease, services,
phone directory, BMW codes), the **Teleservice** tab and the **MDL Automation** tab.

## What's where

```
content/                 ← ALL THE WORDS. One file per section.
  main/                    Main tab (hours.md, valet.md, directory.md, …)
  teleservice/             Teleservice tab
  mdl-automation/          MDL Automation tab
site.config.js           ← Site title, footer, time zone
content/sections.json    ← Tabs and section order (managed from the site)
content/banners.md       ← Banner images (managed from the site)
index.html, app.js,      ← The engine. You don't need to touch these.
styles.css, vendor/
middleware.js            ← Optional password protection (see below)
```

## How to edit (no coding needed)

**On the site itself:** every section has an **✎ Edit** button.
1. Click **Edit**. The section turns light yellow; click any text and type, just like a Google Doc.
2. Use the toolbar for **Bold**, **Red / Blue / Highlight** text, bullet lists, headings and links.
   In tables (like the directory), click a row and use **+ Row below** to add a person, or **− Delete row**.
3. Click **Save**. Everyone sees the change in about a minute.

**Add a section:** in the side menu, click **+ Add section** at the bottom, give it a name,
choose where it goes and how it looks, then type its content and click **Save**.
**Delete a section:** click its **Edit**, then **Delete section**.

**Banner images:** click **✎ Edit images** on the rotating banner (Main tab) to upload, remove,
reorder, or paste in image links.

**Maps:** a line like `Map: 555 W 57th St, New York, NY 10019` shows an English Google Map.
Edit the address text to move the map.

(Every save is recorded in GitHub, so any change can be looked up or undone there.)

### Turn on editing (one-time setup, about 3 minutes)

Saving needs permission to update the GitHub repo:
1. On GitHub: profile picture → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**. Name it `bmw-site editor`, pick an expiration,
   under *Repository access* choose **Only select repositories → bmw-site**, under
   *Permissions → Repository permissions* set **Contents → Read and write**. Generate and copy it.
2. In Vercel: **Settings → Environments → Production → Environment Variables**, add
   `GITHUB_TOKEN` = the token you copied.
3. Optional: add `EDITOR_PASSWORD` too if only some people should be able to save changes.
   Everyone else can still view the site; editors type that password once the first time they save.
4. Redeploy (or just wait for the next change to deploy).

### Editing the files directly (advanced)

Each section is a file in `content/` written in Markdown (`**bold**`, `- bullet`, `| table |`).
Tabs and the order of sections are in `content/sections.json`.

## Putting it on Vercel (first time)

1. Create a free GitHub repository (e.g. `bmw-site`) and upload everything in this folder
   (on github.com: *Add file → Upload files*, drag the whole folder contents in).
2. Go to **vercel.com → Add New → Project**, pick the GitHub repo, leave the settings
   as they are, and click **Deploy**. You'll get a link like `bmw-site.vercel.app`.
3. **Set a team password** (recommended — the site contains logins and passwords):
   Vercel → your project → **Settings → Environment Variables** → add
   `SITE_PASSWORD` with the password you want → Save → **Deployments → Redeploy**.
   People will be asked for it once per browser (any username works; only the password
   is checked). To make the site fully open instead, don't add `SITE_PASSWORD`.
4. Optional: use a subdomain like `bmw.worldwidebdc.com` under
   **Settings → Domains**.
5. Turn on editing from the site — see "Turn on editing" above.

