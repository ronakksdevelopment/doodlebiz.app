import { Storage } from './storage.js';
import { GitHubClient, GitHubError } from './github/api.js';
import { showToast, confirmDialog } from './toast.js';

export class SettingsView {
  constructor(root) {
    this.root = root;
    this.tokenVisible = false;
    this.init();
  }

  async init() {
    const cfg = (await Storage.getSetting('githubConfig')) || {};
    this.root.querySelector('#gh-token').value = cfg.token || '';
    this.root.querySelector('#gh-owner').value = cfg.owner || '';
    this.root.querySelector('#gh-repo').value = cfg.repo || '';
    this.root.querySelector('#gh-branch').value = cfg.branch || 'main';
    this.root.querySelector('#gh-baseurl').value = cfg.baseUrl || '';
    this.bindEvents();
  }

  setStatus(msg, ok) {
    const el = this.root.querySelector('#gh-status');
    el.textContent = msg;
    el.className = 'field-status ' + (ok === true ? 'ok' : ok === false ? 'err' : '');
  }

  bindEvents() {
    const root = this.root;

    root.querySelector('#gh-token-toggle').addEventListener('click', () => {
      this.tokenVisible = !this.tokenVisible;
      const input = root.querySelector('#gh-token');
      input.type = this.tokenVisible ? 'text' : 'password';
      root.querySelector('#gh-token-toggle i').className = this.tokenVisible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });

    root.querySelector('#github-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cfg = this.readForm();
      await Storage.setSetting('githubConfig', cfg);
      this.setStatus('Connection details saved to this browser.', true);
      showToast('GitHub settings saved');
    });

    root.querySelector('#gh-test-btn').addEventListener('click', async () => {
      const cfg = this.readForm();
      if (!cfg.token || !cfg.owner || !cfg.repo) {
        this.setStatus('Fill in token, owner, and repository first.', false);
        return;
      }
      this.setStatus('Testing connection...', null);
      try {
        const client = new GitHubClient(cfg);
        const result = await client.testConnection();
        this.setStatus(`Connected as ${result.login}. Repository is reachable.`, true);
      } catch (err) {
        if (err instanceof GitHubError) {
          this.setStatus(err.message, false);
        } else {
          this.setStatus('Network error. Check your internet connection and try again.', false);
        }
      }
    });

    root.querySelector('#gh-delete-btn').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Remove GitHub token',
        message: 'This removes your saved token and repository connection from this browser. You can reconnect anytime.',
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!ok) return;
      await Storage.deleteSetting('githubConfig');
      root.querySelector('#github-form').reset();
      root.querySelector('#gh-branch').value = 'main';
      this.setStatus('Token removed.', true);
    });

    root.querySelector('#export-btn').addEventListener('click', async () => {
      const profiles = await Storage.getAllProfiles();
      const data = { version: 1, exportedAt: new Date().toISOString(), profiles };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `doodlebiz-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded (token excluded)');
    });

    root.querySelector('#import-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.profiles || !Array.isArray(data.profiles)) throw new Error('Invalid backup file');
        for (const p of data.profiles) {
          await Storage.saveProfile(p);
        }
        showToast(`Imported ${data.profiles.length} profile(s)`);
        window.dispatchEvent(new CustomEvent('doodlebiz:profiles-changed'));
      } catch {
        showToast('Could not read that backup file');
      }
      e.target.value = '';
    });

    root.querySelector('#clear-all-btn').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Clear all local data',
        message: 'This permanently deletes every saved draft, published-page record, image, and your GitHub connection from this browser. Already-published GitHub pages are not affected.',
        confirmLabel: 'Clear Everything',
        danger: true,
      });
      if (!ok) return;
      await Storage.clearAll();
      showToast('Local data cleared');
      window.dispatchEvent(new CustomEvent('doodlebiz:profiles-changed'));
    });
  }

  readForm() {
    const root = this.root;
    return {
      token: root.querySelector('#gh-token').value.trim(),
      owner: root.querySelector('#gh-owner').value.trim(),
      repo: root.querySelector('#gh-repo').value.trim(),
      branch: root.querySelector('#gh-branch').value.trim() || 'main',
      baseUrl: root.querySelector('#gh-baseurl').value.trim(),
    };
  }
}
