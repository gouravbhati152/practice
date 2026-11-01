# Q&A Hub

A personal Q&A manager with sessions (Python, PySpark, SQL, ...), a rich answer editor
(headings, bold, inline code, code blocks, tables), search, edit/delete, and HTML export.
Your data is stored in `data.json` in this same GitHub repo, so it is available from any
browser or device.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | All styling |
| `app.js` | App logic, GitHub sync, seed Q&As |
| `data.json` | Created automatically on first load; holds your sessions and Q&As |

## One-time setup

1. Create a **public** GitHub repo (for example `practice`) and upload these files.
2. Turn on **GitHub Pages**: repo **Settings → Pages → Deploy from branch → main → / (root) → Save**.
3. In `app.js`, make sure `GH_REPO` matches your repo (`username/repo-name`).
4. Create a token: GitHub **Settings → Developer settings → Personal access tokens → Tokens (classic)
   → Generate new token**, tick only the **repo** scope, then copy it.
5. Open your site at `https://<username>.github.io/<repo-name>/`, click **Update Token** in the
   sidebar and paste the token.

The app creates `data.json` by itself the first time it connects.

## Using it on another browser or device

Open the same site URL and click **Update Token** once. The token is stored only in that
browser's localStorage, never in the code.

## Important

- Never paste your token into `app.js`, a commit, an issue, or a chat. The repo is public.
- If a token is ever exposed, delete it in GitHub settings and create a new one.
- Every save is a commit to `data.json`, so you can recover old versions from the file's History.
