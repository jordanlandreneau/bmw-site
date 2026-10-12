// Saves an edited section back to GitHub, which makes Vercel republish the site.
//
// One-time setup in Vercel → Settings → Environments → Production → Environment Variables:
//   GITHUB_TOKEN     a GitHub token that can write to this repo (see README)
//   EDITOR_PASSWORD  (optional) extra password needed to SAVE changes.
//                    If not set, anyone who can open the site can edit it.
//   GITHUB_REPO      (optional) defaults to jordanlandreneau/bmw-site
//   GITHUB_BRANCH    (optional) defaults to main

const REPO = process.env.GITHUB_REPO || 'jordanlandreneau/bmw-site';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Saving is not set up yet: add GITHUB_TOKEN in Vercel (see the README, "Turn on editing").' });
  }
  const editorPw = process.env.EDITOR_PASSWORD;
  if (editorPw && req.headers['x-editor-password'] !== editorPw) {
    return res.status(401).json({ error: 'Editor password is wrong or missing.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { file, content, base64, baseSha, force } = body || {};
  const isText = typeof file === 'string' && /^content\/[a-z0-9_\-\/]+\.md$/i.test(file);
  const isImage = typeof file === 'string' && /^content\/images\/[a-z0-9_\-]+\.(jpe?g|png|webp|gif)$/i.test(file);
  if ((!isText && !isImage) || file.includes('..')) {
    return res.status(400).json({ error: 'Invalid file.' });
  }
  if (isText && (typeof content !== 'string' || content.length > 500000)) {
    return res.status(400).json({ error: 'Invalid content.' });
  }
  if (isImage && (typeof base64 !== 'string' || base64.length > 4000000 || !/^[A-Za-z0-9+/=]+$/.test(base64))) {
    return res.status(400).json({ error: 'Image is missing or too large.' });
  }

  const api = `https://api.github.com/repos/${REPO}/contents/${file}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bmw-site-editor',
  };

  // Current version on GitHub (to avoid overwriting someone else's edit)
  const cur = await fetch(`${api}?ref=${encodeURIComponent(BRANCH)}`, { headers });
  if (!cur.ok && cur.status !== 404) {
    return res.status(502).json({ error: `GitHub said ${cur.status} when reading the file. Check GITHUB_TOKEN.` });
  }
  const current = cur.ok ? await cur.json() : null;
  if (current && baseSha && !force && current.sha !== baseSha) {
    return res.status(409).json({ error: 'conflict', currentSha: current.sha });
  }

  const put = await fetch(api, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: isImage ? `Upload ${file.replace(/^content\//, '')} (from the site)` : `Update ${file.replace(/^content\//, '')} (edited on the site)`,
      content: isImage ? base64 : Buffer.from(content, 'utf8').toString('base64'),
      branch: BRANCH,
      ...(current ? { sha: current.sha } : {}),
    }),
  });
  const out = await put.json().catch(() => ({}));
  if (!put.ok) {
    return res.status(502).json({ error: `GitHub refused the save (${put.status}): ${out.message || 'unknown error'}` });
  }
  return res.status(200).json({ ok: true, sha: out.content && out.content.sha });
}
