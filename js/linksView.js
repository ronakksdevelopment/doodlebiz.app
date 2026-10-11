import { Storage } from './storage.js';
import { escapeHtml } from './utils.js';
import { confirmDialog, choiceDialog, showToast } from './toast.js';
import { deleteFromGithub } from './publisher.js';

const STATUS_LABEL = {
  draft: 'Saved locally',
  publishing: 'Publishing...',
  published: 'Published',
  failed: 'Update failed',
};
const STATUS_CLASS = {
  draft: 'status-draft',
  publishing: 'status-publishing',
  published: 'status-published',
  failed: 'status-failed',
};

export class LinksView {
  constructor({ listEl, emptyEl, searchInputEl, handlers }) {
    this.listEl = listEl;
    this.emptyEl = emptyEl;
    this.searchInputEl = searchInputEl;
    this.handlers = handlers; // {onEdit, onCreateCopy}
    this.profiles = [];
    this.searchInputEl.addEventListener('input', () => this.renderFiltered());
  }

  async refresh() {
    this.profiles = (await Storage.getAllProfiles()).sort((a, b) => b.updatedAt - a.updatedAt);
    this.renderFiltered();
  }

  renderFiltered() {
    const q = this.searchInputEl.value.trim().toLowerCase();
    const filtered = q
      ? this.profiles.filter(
          (p) => (p.businessName || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q)
        )
      : this.profiles;
    this.render(filtered);
  }

  render(profiles) {
    if (!profiles.length) {
      this.listEl.innerHTML = '';
      this.emptyEl.hidden = false;
      return;
    }
    this.emptyEl.hidden = true;
    this.listEl.innerHTML = profiles.map((p) => this.cardHtml(p)).join('');

    profiles.forEach((p) => {
      const card = this.listEl.querySelector(`[data-card="${p.id}"]`);
      if (!card) return;
      card.querySelector('[data-act="open"]')?.addEventListener('click', () => {
        if (p.publicUrl) window.open(p.publicUrl, '_blank', 'noopener');
      });
      card.querySelector('[data-act="copy"]')?.addEventListener('click', async () => {
        if (!p.publicUrl) return;
        await navigator.clipboard.writeText(p.publicUrl);
        showToast('Link copied');
      });
      card.querySelector('[data-act="qr"]')?.addEventListener('click', () => {
        this.handlers.onDownloadQr(p);
      });
      card.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
        this.handlers.onEdit(p.id);
      });
      card.querySelector('[data-act="copyprofile"]')?.addEventListener('click', () => {
        this.handlers.onDuplicate(p.id);
      });
      card.querySelector('[data-act="delete"]')?.addEventListener('click', () => this.handleDelete(p));
    });
  }

  cardHtml(p) {
    const status = p.publishStatus || 'draft';
    const name = p.businessName || p.username || 'Untitled business';
    return `
    <div class="link-card" data-card="${p.id}">
      <div class="link-card-qr">${p.qrDataUrl ? `<img src="${p.qrDataUrl}" alt="QR code">` : '<i class="fa-solid fa-qrcode" style="color:#B9B9B9;font-size:1.3rem"></i>'}</div>
      <div class="link-card-body">
        <div class="link-card-name">${escapeHtml(name)}</div>
        <div class="link-card-username">${p.username ? '@' + escapeHtml(p.username) : 'No username set'}</div>
        <span class="status-badge ${STATUS_CLASS[status] || 'status-draft'}">${STATUS_LABEL[status] || 'Saved locally'}</span>
        <div class="link-card-actions">
          ${p.publicUrl ? `<button type="button" data-act="open"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</button>` : ''}
          ${p.publicUrl ? `<button type="button" data-act="copy"><i class="fa-solid fa-copy"></i> Copy URL</button>` : ''}
          ${p.qrDataUrl ? `<button type="button" data-act="qr"><i class="fa-solid fa-download"></i> QR</button>` : ''}
          <button type="button" data-act="edit"><i class="fa-solid fa-pen"></i> Edit</button>
          <button type="button" data-act="copyprofile"><i class="fa-solid fa-copy"></i> Duplicate</button>
          <button type="button" class="danger" data-act="delete"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>
    </div>`;
  }

  async handleDelete(p) {
    if (p.publishStatus === 'published' && p.publicUrl) {
      const choice = await choiceDialog({
        title: 'Delete business page',
        message: 'Remove this only from the app on this device, or also delete the published page from GitHub? Deleting from GitHub can take effect after deployment, and search engines may still show cached copies.',
        choices: [
          { label: 'Remove from app only', value: 'local' },
          { label: 'Delete from GitHub too', value: 'remote', danger: true },
        ],
      });
      if (!choice) return;
      if (choice === 'remote') {
        try {
          showToast('Deleting from GitHub...');
          await deleteFromGithub(p);
          showToast('Deleted from GitHub');
        } catch (e) {
          showToast(e.message || 'Could not delete from GitHub');
          return;
        }
      } else {
        showToast('Removed from this app only. The online page is unchanged.');
      }
    } else {
      const ok = await confirmDialog({
        title: 'Delete draft',
        message: `Delete "${p.businessName || p.username || 'this draft'}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
    }
    await Storage.deleteProfile(p.id);
    showToast('Deleted');
    this.refresh();
  }
}
