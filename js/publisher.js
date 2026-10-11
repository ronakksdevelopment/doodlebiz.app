import { GitHubClient, GitHubError } from './github/api.js';
import { buildPublicPageHtml } from './publicPageBuilder.js';
import { blobToBase64, slugify, isValidSlug } from './utils.js';
import { Storage } from './storage.js';

export async function getGithubConfig() {
  const cfg = await Storage.getSetting('githubConfig');
  return cfg || null;
}

export async function checkUsernameAvailable(client, username, excludeProfileId, allProfiles) {
  const localConflict = allProfiles.some(
    (p) => p.id !== excludeProfileId && p.username === username && p.publishStatus === 'published'
  );
  if (localConflict) return false;
  const existing = await client.getFile(`business/${username}/index.html`);
  return !existing;
}

export function suggestAlternativeUsername(base) {
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Publishes a profile to GitHub Pages.
 * onProgress(stage: string) called with human readable status strings.
 */
export async function publishProfile(profile, onProgress) {
  const cfg = await getGithubConfig();
  if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) {
    throw new GitHubError('GitHub is not connected. Add your repository details in Settings first.', 0);
  }

  const client = new GitHubClient(cfg);
  onProgress('Checking username availability');

  let username = slugify(profile.username || profile.businessName || 'business');
  if (!isValidSlug(username)) {
    throw new GitHubError('Please choose a valid page username (letters, numbers, hyphens only).', 0);
  }

  const allProfiles = await Storage.getAllProfiles();
  const isUpdate = profile.publishStatus === 'published' && profile.publishedUsername === username;

  if (!isUpdate) {
    const available = await checkUsernameAvailable(client, username, profile.id, allProfiles);
    if (!available) {
      throw new GitHubError(
        `The username "${username}" is already taken. Try "${suggestAlternativeUsername(username)}" instead.`,
        409
      );
    }
  }

  onProgress('Uploading images');
  const assetUrls = { logo: '', cover: '', items: [], gallery: [] };
  const basePath = `business/${username}`;

  async function uploadImageRef(imageId, filename) {
    if (!imageId) return '';
    const blob = await Storage.getImage(imageId);
    if (!blob) return '';
    const b64 = await blobToBase64(blob);
    const path = `${basePath}/assets/${filename}`;
    await client.putFile(path, b64, `DoodleBiz: update asset ${filename}`, true);
    return `assets/${filename}`;
  }

  if (profile.logoImageId) {
    assetUrls.logo = await uploadImageRef(profile.logoImageId, 'logo.jpg');
  }
  if (profile.coverImageId) {
    assetUrls.cover = await uploadImageRef(profile.coverImageId, 'cover.jpg');
  }
  if (profile.items && profile.items.length) {
    for (let i = 0; i < profile.items.length; i++) {
      const it = profile.items[i];
      if (it.imageId) {
        assetUrls.items[i] = await uploadImageRef(it.imageId, `item-${i}.jpg`);
      } else {
        assetUrls.items[i] = '';
      }
    }
  }
  if (profile.galleryImageIds && profile.galleryImageIds.length) {
    for (let i = 0; i < profile.galleryImageIds.length; i++) {
      const url = await uploadImageRef(profile.galleryImageIds[i], `gallery-${i}.jpg`);
      if (url) assetUrls.gallery.push(url);
    }
  }

  onProgress('Building page');
  const html = buildPublicPageHtml(profile, assetUrls);

  onProgress('Publishing to GitHub');
  await client.putFile(
    `${basePath}/index.html`,
    html,
    `DoodleBiz: ${isUpdate ? 'update' : 'publish'} ${username}`
  );

  onProgress('Resolving page URL');
  const pagesBase = await client.getPagesUrl(cfg.baseUrl);
  const publicUrl = `${pagesBase}/${basePath}/`;

  return { publicUrl, username };
}

export async function deleteFromGithub(profile, onProgress) {
  const cfg = await getGithubConfig();
  if (!cfg || !cfg.token) {
    throw new GitHubError('GitHub is not connected.', 0);
  }
  const client = new GitHubClient(cfg);
  const username = profile.publishedUsername || profile.username;
  const basePath = `business/${username}`;
  onProgress && onProgress('Removing page files');

  const names = ['logo.jpg', 'cover.jpg'];
  (profile.items || []).forEach((_, i) => names.push(`item-${i}.jpg`));
  (profile.galleryImageIds || []).forEach((_, i) => names.push(`gallery-${i}.jpg`));

  for (const n of names) {
    try {
      await client.deleteFile(`${basePath}/assets/${n}`, `DoodleBiz: remove asset ${n}`);
    } catch {
      // asset may not exist; continue
    }
  }
  await client.deleteFile(`${basePath}/index.html`, `DoodleBiz: delete page ${username}`);
}
