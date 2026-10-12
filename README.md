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
site.config.js           ← Tabs, section order, banner images, title
index.html, app.js,      ← The engine. You don't need to touch these.
styles.css, vendor/
middleware.js            ← Optional password protection (see below)
```

## How to edit

**Change wording, hours, a phone number, etc.**
Open the section's file in `content/` and change the text. Save. That's it.

The files use simple formatting ("Markdown"):

| You type | You get |
|---|---|
| `**bold**` | **bold** |
| `- item` | a bullet point |
| `1. item` | a numbered step |
| `### Title` | a sub-heading inside a section |
| `[Link text](https://…)` | a link |
| `<span class="red">text</span>` | red warning text (also `blue`, `yellow`) |
| `> text` | a highlighted callout box |

Tables look like this — keep the `|` lines lined up row by row:

```
| Name | Email | Direct Phone |
|---|---|---|
| SMITH, JOHN | john.smith@bmwnyc.com | 212-555-0100 |
```

**Add a person to the directory:** open `content/main/directory.md`, find the department,
and copy an existing row. Each `## Heading` in that file is one click-to-open department.

**Change a login:** edit `content/main/logins.md` (or the Teleservice / MDL login files).
Each `### Name` becomes one login card.

**Add a new section:** create a new `.md` file in `content/`, then add one line for it in
`site.config.js` under the right tab. **Add a whole new tab:** copy a tab block in
`site.config.js`. **Reorder the menu:** move the lines in `site.config.js`.

Things the site does automatically — no extra work needed:
- Every email address and phone number becomes **click-to-copy**.
- Schedule tables with day columns (Mon, Tue… or "Mon - Fri") **highlight today** (New York time).
- The **search box** (or press `/`) searches every tab at once.
- The live New York clock at the top.

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
5. Optional: in `site.config.js`, set `githubRepo` to your repo's address. Every section
   then gets an **Edit** button that opens that section's file on GitHub.

## Editing after it's live

Edit any file on GitHub (open it → pencil icon → change → **Commit changes**).
Vercel republishes automatically in about 30 seconds.
