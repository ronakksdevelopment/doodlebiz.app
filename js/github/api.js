// Minimal GitHub Contents API client. Token never leaves this origin's requests to api.github.com.
const API_BASE = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export class GitHubClient {
  constructor({ token, owner, repo, branch }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch || 'main';
  }

  async request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) throw new GitHubError('GitHub token is invalid or expired.', 401);
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      if (body.message && /rate limit/i.test(body.message)) {
        throw new GitHubError('GitHub API rate limit reached. Please wait and try again.', 403);
      }
      throw new GitHubError('Token lacks permission for this repository. Check its Contents permission.', 403);
    }
    if (res.status === 404) throw new GitHubError('Repository or branch not found. Check owner, repo, and branch.', 404);
    if (res.status === 422) {
      const body = await res.json().catch(() => ({}));
      throw new GitHubError(body.message || 'GitHub rejected the request (422).', 422);
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new GitHubError(body.message || `GitHub request failed (${res.status}).`, res.status);
    }
    return res;
  }

  async testConnection() {
    const res = await this.request('/user');
    const user = await res.json();
    try {
      await this.request(`/repos/${this.owner}/${this.repo}`);
    } catch (e) {
      if (e.status === 404) {
        throw new GitHubError(`Token is valid, but repository "${this.owner}/${this.repo}" was not found or is inaccessible.`, 404);
      }
      throw e;
    }
    return { login: user.login };
  }

  async getFile(path) {
    try {
      const res = await this.request(
        `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(this.branch)}`
      );
      return res.json();
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async putFile(path, contentStr, message, isBase64 = false) {
    const existing = await this.getFile(path);
    const body = {
      message,
      content: isBase64 ? contentStr : utf8ToBase64(contentStr),
      branch: this.branch,
    };
    if (existing && existing.sha) body.sha = existing.sha;
    const res = await this.request(
      `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
      { method: 'PUT', body: JSON.stringify(body) }
    );
    return res.json();
  }

  async deleteFile(path, message) {
    const existing = await this.getFile(path);
    if (!existing) return null;
    const res = await this.request(
      `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ message, sha: existing.sha, branch: this.branch }),
      }
    );
    return res.json();
  }

  async listDir(path) {
    try {
      const res = await this.request(
        `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(this.branch)}`
      );
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (e.status === 404) return [];
      throw e;
    }
  }

  async getPagesUrl(explicitBase) {
    if (explicitBase) return explicitBase.replace(/\/$/, '');
    try {
      const res = await this.request(`/repos/${this.owner}/${this.repo}/pages`);
      const data = await res.json();
      if (data.html_url) return data.html_url.replace(/\/$/, '');
    } catch {
      // Pages API may not be enabled/accessible; fall back below.
    }
    return `https://${this.owner}.github.io/${this.repo}`;
  }
}
