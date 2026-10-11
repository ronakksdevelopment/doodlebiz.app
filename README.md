# DoodleBiz — One Scan. Your Whole Business.

A static Progressive Web App that lets you create QR-linked digital business pages and publish them to GitHub Pages, directly from your browser. No backend, no server, no paid services.

## Quick start (GitHub Pages)

1. Create a new GitHub repository (public).
2. Upload every file in this project to the repository root (keep the folder structure).
3. In the repo, go to **Settings → Pages**, set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. Visit `https://<your-username>.github.io/<repo-name>/` — the app loads there.
5. Install it: open the site on your phone/desktop and use "Add to Home Screen" / the browser install prompt.

## Connect GitHub so Generate QR actually publishes

1. On GitHub, go to **Settings → Developer settings → Fine-grained personal access tokens → Generate new token**.
2. Restrict it to **this one repository** and grant only the **Contents: Read and write** permission.
3. Copy the token.
4. In DoodleBiz, open **Settings → GitHub Publishing**, paste the token, and fill in:
   - Repository owner: your GitHub username or org
   - Repository name: the repo you deployed this app to (or a separate one for pages)
   - Branch: usually `main`
   - Public base URL: optional, leave blank to auto-detect `https://owner.github.io/repo`
5. Click **Test Connection**, then **Save Connection**.

Without a connection, Generate QR will show a clear error instead of pretending to publish.

## How publishing works

Clicking **Generate QR** writes a real page to `business/<username>/index.html` in your repository using the GitHub Contents API, uploads any images to `business/<username>/assets/`, then builds a QR code pointing at the live GitHub Pages URL. A short countdown is shown while the actual commit happens; it ends as soon as publishing finishes (or shows "Still publishing..." if GitHub is slow).

Editing and clicking **Update** overwrites the same path, so your URL and QR code stay valid. Deleting lets you choose local-only removal or also removing the files from GitHub.

## Data & privacy

- All drafts, profiles, images, and your GitHub token are stored only in this browser (IndexedDB/localStorage). Nothing syncs between devices automatically.
- Browser-local token storage is **not** equivalent to secure server-side secrets. Use a fine-grained, repo-scoped token, and revoke it when you're done.
- Export/Import in Settings lets you back up your profiles (the token is excluded from exports by default).
- Clear All Local Data removes everything from this browser; it does not delete already-published GitHub pages.

## Troubleshooting

| Problem | Fix |
|---|---|
| "GitHub token is invalid or expired" | Generate a new fine-grained token and reconnect. |
| "Token lacks permission" | Make sure the token has Contents: Read and write on the target repo. |
| "Repository or branch not found" | Double check owner/repo spelling and that the branch exists. |
| Page not loading after publish | GitHub Pages can take a minute or two to deploy after the first publish. |
| Images not showing on the public page | Confirm the repo's Pages source is the same branch you published to. |

## Project structure

```
index.html
manifest.webmanifest
sw.js
css/            styles
js/             app logic (storage, form, GitHub client, QR, public page builder)
icons/          app icons generated from your logo
business/       published business pages land here (created automatically)
```

## Demo mode

If GitHub is not connected, Generate QR will not fake a success. It explains that publishing requires a connected repository, so you're never shown a live link that doesn't exist.

Built with vanilla HTML, CSS, and JavaScript (ES modules), Font Awesome icons, and a lightweight client-side QR code library. Version 1.0.
