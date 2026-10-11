import { Storage } from './storage.js';
import { uid, slugify, isValidSlug, isValidEmail, validateImageFile, resizeImage, escapeHtml, debounce, normalizeExternalUrl } from './utils.js';
import { THEMES } from './publicPageBuilder.js';
import { showToast } from './toast.js';

const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'WhatsApp', 'X (Twitter)', 'YouTube', 'LinkedIn'];
const ICON_CHOICES = ['fa-link', 'fa-store', 'fa-bag-shopping', 'fa-utensils', 'fa-location-dot', 'fa-star', 'fa-calendar', 'fa-phone'];

function emptyProfile() {
  return {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    themeId: 'default',
    businessName: '',
    username: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    category: '',
    mapsUrl: '',
    website: '',
    upiId: '',
    paymentNote: '',
    logoImageId: '',
    coverImageId: '',
    galleryImageIds: [],
    socials: [],
    customLinks: [],
    items: [],
    hours: '',
    highlights: '',
    publishStatus: 'draft', // draft | publishing | published | failed
    publishedUsername: '',
    publicUrl: '',
  };
}

export class BusinessForm {
  constructor(rootEl, { onSaved, onGenerate }) {
    this.root = rootEl;
    this.onSaved = onSaved;
    this.onGenerate = onGenerate;
    this.profile = emptyProfile();
    this.pendingImages = {}; // imageId -> blob, flushed on save
  }

  async load(profileId) {
    if (profileId) {
      const p = await Storage.getProfile(profileId);
      this.profile = p || emptyProfile();
    } else {
      this.profile = emptyProfile();
    }
    this.render();
  }

  field(name, value) {
    this.profile[name] = value;
  }

  async handleImageInput(inputEl, previewWrapId, onSet) {
    const file = inputEl.files[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      showToast(err);
      inputEl.value = '';
      return;
    }
    const blob = await resizeImage(file);
    const imageId = uid();
    this.pendingImages[imageId] = blob;
    onSet(imageId);
    const url = URL.createObjectURL(blob);
    const wrap = this.root.querySelector(`#${previewWrapId}`);
    if (wrap) {
      wrap.innerHTML = `<div class="image-upload-preview"><img src="${url}" alt="Preview"><button type="button" class="image-remove-btn" data-remove-preview>Remove</button></div>`;
      wrap.querySelector('[data-remove-preview]').addEventListener('click', () => {
        onSet('');
        wrap.innerHTML = '';
      });
    }
  }

  renderImageField(label, idPrefix, currentImageId, onSet) {
    return `
    <label>${escapeHtml(label)}
      <div class="image-upload">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" id="${idPrefix}-input" data-image-field="${idPrefix}">
        <p><i class="fa-solid fa-image" aria-hidden="true"></i> Tap to upload</p>
      </div>
      <div id="${idPrefix}-preview"></div>
    </label>`;
  }

  async hydrateExistingImage(idPrefix, imageId) {
    if (!imageId) return;
    const blob = await Storage.getImage(imageId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const wrap = this.root.querySelector(`#${idPrefix}-preview`);
    if (wrap) wrap.innerHTML = `<div class="image-upload-preview"><img src="${url}" alt="Preview"><button type="button" class="image-remove-btn" data-remove="${idPrefix}">Remove</button></div>`;
  }

  render() {
    const p = this.profile;
    const themeSwatches = Object.entries(THEMES)
      .map(
        ([id, t]) => `
      <button type="button" class="theme-swatch ${p.themeId === id ? 'selected' : ''}" data-theme="${id}">
        <span class="theme-dots">
          <span class="theme-dot" style="background:${t.bg}"></span>
          <span class="theme-dot" style="background:${t.fg}"></span>
          <span class="theme-dot" style="background:${t.accent}"></span>
        </span>
        <span>${id.charAt(0).toUpperCase() + id.slice(1)}</span>
      </button>`
      )
      .join('');

    const socialsHtml = (p.socials || [])
      .map(
        (s, i) => `
      <div class="repeat-item" data-social-item="${i}">
        <button type="button" class="repeat-item-remove" data-remove-social="${i}" aria-label="Remove social link"><i class="fa-solid fa-xmark"></i></button>
        <div class="row-2">
          <label>Platform
            <select data-social-field="platform" data-i="${i}">
              ${SOCIAL_PLATFORMS.map((pl) => `<option value="${pl}" ${s.platform === pl ? 'selected' : ''}>${pl}</option>`).join('')}
            </select>
          </label>
          <label>Username/Handle
            <input type="text" value="${escapeHtml(s.handle || '')}" data-social-field="handle" data-i="${i}">
          </label>
        </div>
        <label>Profile URL or number
          <input type="text" value="${escapeHtml(s.url || '')}" data-social-field="url" data-i="${i}" placeholder="https://...">
        </label>
      </div>`
      )
      .join('');

    const customLinksHtml = (p.customLinks || [])
      .map(
        (l, i) => `
      <div class="repeat-item" data-link-item="${i}">
        <button type="button" class="repeat-item-remove" data-remove-link="${i}" aria-label="Remove link"><i class="fa-solid fa-xmark"></i></button>
        <div class="row-2">
          <label>Label
            <input type="text" value="${escapeHtml(l.label || '')}" data-link-field="label" data-i="${i}">
          </label>
          <label>Icon
            <select data-link-field="icon" data-i="${i}">
              ${ICON_CHOICES.map((ic) => `<option value="${ic}" ${l.icon === ic ? 'selected' : ''}>${ic.replace('fa-', '')}</option>`).join('')}
            </select>
          </label>
        </div>
        <label>URL
          <input type="text" value="${escapeHtml(l.url || '')}" data-link-field="url" data-i="${i}" placeholder="https://...">
        </label>
      </div>`
      )
      .join('');

    const itemsHtml = (p.items || [])
      .map(
        (it, i) => `
      <div class="repeat-item" data-menu-item="${i}">
        <button type="button" class="repeat-item-remove" data-remove-item="${i}" aria-label="Remove item"><i class="fa-solid fa-xmark"></i></button>
        <div class="row-2">
          <label>Name
            <input type="text" value="${escapeHtml(it.name || '')}" data-item-field="name" data-i="${i}">
          </label>
          <label>Price
            <input type="text" value="${escapeHtml(it.price || '')}" data-item-field="price" data-i="${i}" placeholder="e.g. 199">
          </label>
        </div>
        <label>Description
          <textarea data-item-field="description" data-i="${i}">${escapeHtml(it.description || '')}</textarea>
        </label>
        <label>Order link (optional)
          <input type="text" value="${escapeHtml(it.link || '')}" data-item-field="link" data-i="${i}" placeholder="https://...">
        </label>
        <label>Item photo
          <div class="image-upload">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-item-image="${i}">
            <p><i class="fa-solid fa-image" aria-hidden="true"></i> Tap to upload</p>
          </div>
          <div id="item-${i}-preview"></div>
        </label>
      </div>`
      )
      .join('');

    this.root.innerHTML = `
    <form id="biz-form" class="stacked-form" novalidate>

      <div class="form-section">
        <h2><i class="fa-solid fa-palette"></i> Color Theme</h2>
        <div class="theme-grid" id="theme-grid">${themeSwatches}</div>
      </div>

      <div class="form-section">
        <h2><i class="fa-solid fa-store"></i> Business Details</h2>
        <label>Business name
          <input type="text" id="f-name" value="${escapeHtml(p.businessName)}" maxlength="80">
        </label>
        <label>Public page username
          <input type="text" id="f-username" value="${escapeHtml(p.username)}" placeholder="e.g. janes-cafe" maxlength="48">
          <span class="char-hint" id="f-username-hint">Letters, numbers, and hyphens only. This forms your page URL.</span>
        </label>
        <label>Short description
          <textarea id="f-desc" maxlength="200">${escapeHtml(p.description)}</textarea>
        </label>
        <div class="row-2">
          <label>Phone number
            <input type="tel" id="f-phone" value="${escapeHtml(p.phone)}">
          </label>
          <label>Email address
            <input type="email" id="f-email" value="${escapeHtml(p.email)}">
          </label>
        </div>
        <label>Full address
          <textarea id="f-address">${escapeHtml(p.address)}</textarea>
        </label>
        <div class="row-2">
          <label>Business category
            <input type="text" id="f-category" value="${escapeHtml(p.category)}" placeholder="e.g. Cafe, Salon, Tuition">
          </label>
          <label>Website URL
            <input type="text" id="f-website" value="${escapeHtml(p.website)}" placeholder="https://...">
          </label>
        </div>
        <label>Google Maps link
          <input type="text" id="f-maps" value="${escapeHtml(p.mapsUrl)}" placeholder="https://maps.google.com/...">
        </label>
        <div class="row-2">
          <label>UPI ID
            <input type="text" id="f-upi" value="${escapeHtml(p.upiId)}" placeholder="name@bank">
          </label>
          <label>Payment instructions
            <input type="text" id="f-paynote" value="${escapeHtml(p.paymentNote)}">
          </label>
        </div>
      </div>

      <div class="form-section">
        <h2><i class="fa-solid fa-image"></i> Images</h2>
        ${this.renderImageField('Business logo / profile photo', 'logo', p.logoImageId)}
        ${this.renderImageField('Business cover image', 'cover', p.coverImageId)}
      </div>

      <div class="form-section">
        <h2><i class="fa-solid fa-share-nodes"></i> Social Media</h2>
        <div id="socials-list">${socialsHtml}</div>
        <button type="button" class="add-item-btn" id="add-social-btn"><i class="fa-solid fa-plus"></i> Add social link</button>
      </div>

      <div class="form-section">
        <h2><i class="fa-solid fa-link"></i> Custom Links</h2>
        <div id="links-list-form">${customLinksHtml}</div>
        <button type="button" class="add-item-btn" id="add-link-btn"><i class="fa-solid fa-plus"></i> Add custom link</button>
      </div>

      <div class="form-section">
        <h2><i class="fa-solid fa-bag-shopping"></i> Menu / Products / Services</h2>
        <div id="items-list">${itemsHtml}</div>
        <button type="button" class="add-item-btn" id="add-item-btn"><i class="fa-solid fa-plus"></i> Add item</button>
      </div>

      <div class="form-section">
        <h2><i class="fa-solid fa-clock"></i> Hours &amp; Highlights</h2>
        <label>Opening hours
          <textarea id="f-hours" placeholder="Mon-Sat: 10am - 8pm">${escapeHtml(p.hours)}</textarea>
        </label>
        <label>Highlights / special offers
          <textarea id="f-highlights">${escapeHtml(p.highlights)}</textarea>
        </label>
      </div>

      <p class="settings-help"><i class="fa-solid fa-circle-info"></i> Publishing makes the details above visible on a public web page. Review before you generate your QR code.</p>

      <div class="form-sticky-actions">
        <button type="button" class="btn btn-outline" id="save-draft-btn">Save Draft</button>
        <button type="submit" class="btn btn-primary" id="generate-qr-btn">Generate QR</button>
        <button type="button" class="btn btn-text" id="cancel-form-btn">Cancel</button>
      </div>
    </form>`;

    this.bindEvents();
    this.hydrateExistingImage('logo', p.logoImageId);
    this.hydrateExistingImage('cover', p.coverImageId);
    (p.items || []).forEach((it, i) => {
      if (it.imageId) this.hydrateItemImage(i, it.imageId);
    });
  }

  async hydrateItemImage(index, imageId) {
    const blob = await Storage.getImage(imageId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const wrap = this.root.querySelector(`#item-${index}-preview`);
    if (wrap) wrap.innerHTML = `<div class="image-upload-preview"><img src="${url}" alt="Item preview"></div>`;
  }

  collectFromDom() {
    const q = (id) => this.root.querySelector(id);
    this.profile.businessName = q('#f-name').value.trim();
    this.profile.username = slugify(q('#f-username').value);
    this.profile.description = q('#f-desc').value.trim();
    this.profile.phone = q('#f-phone').value.trim();
    this.profile.email = q('#f-email').value.trim();
    this.profile.address = q('#f-address').value.trim();
    this.profile.category = q('#f-category').value.trim();
    this.profile.website = normalizeExternalUrl(q('#f-website').value.trim());
    this.profile.mapsUrl = normalizeExternalUrl(q('#f-maps').value.trim());
    this.profile.upiId = q('#f-upi').value.trim();
    this.profile.paymentNote = q('#f-paynote').value.trim();
    this.profile.hours = q('#f-hours').value.trim();
    this.profile.highlights = q('#f-highlights').value.trim();

    this.profile.socials = Array.from(this.root.querySelectorAll('[data-social-item]')).map((el) => {
      const i = el.dataset.socialItem;
      return {
        platform: el.querySelector('[data-social-field="platform"]').value,
        handle: el.querySelector('[data-social-field="handle"]').value.trim(),
        url: normalizeExternalUrl(el.querySelector('[data-social-field="url"]').value.trim()) || el.querySelector('[data-social-field="url"]').value.trim(),
      };
    });

    this.profile.customLinks = Array.from(this.root.querySelectorAll('[data-link-item]')).map((el) => ({
      label: el.querySelector('[data-link-field="label"]').value.trim(),
      icon: el.querySelector('[data-link-field="icon"]').value,
      url: normalizeExternalUrl(el.querySelector('[data-link-field="url"]').value.trim()),
    }));

    this.profile.items = Array.from(this.root.querySelectorAll('[data-menu-item]')).map((el, i) => {
      const existing = (this.profile.items || [])[i] || {};
      return {
        name: el.querySelector('[data-item-field="name"]').value.trim(),
        price: el.querySelector('[data-item-field="price"]').value.trim(),
        description: el.querySelector('[data-item-field="description"]').value.trim(),
        link: normalizeExternalUrl(el.querySelector('[data-item-field="link"]').value.trim()),
        imageId: existing.imageId || '',
      };
    });
  }

  validate() {
    const errors = [];
    if (this.profile.username && !isValidSlug(this.profile.username)) {
      errors.push('Username can only contain lowercase letters, numbers, and hyphens.');
    }
    if (this.profile.email && !isValidEmail(this.profile.email)) {
      errors.push('Please enter a valid email address.');
    }
    return errors;
  }

  async flushPendingImages() {
    for (const [imageId, blob] of Object.entries(this.pendingImages)) {
      await Storage.saveImage(imageId, blob);
    }
    this.pendingImages = {};
  }

  bindEvents() {
    const root = this.root;
    const form = root.querySelector('#biz-form');

    root.querySelector('#theme-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      this.profile.themeId = btn.dataset.theme;
      root.querySelectorAll('.theme-swatch').forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
    });

    root.querySelector('[data-image-field="logo"]').addEventListener('change', (e) =>
      this.handleImageInput(e.target, 'logo-preview', (id) => (this.profile.logoImageId = id))
    );
    root.querySelector('[data-image-field="cover"]').addEventListener('change', (e) =>
      this.handleImageInput(e.target, 'cover-preview', (id) => (this.profile.coverImageId = id))
    );

    root.querySelector('#add-social-btn').addEventListener('click', () => {
      this.collectFromDom();
      this.profile.socials.push({ platform: 'Instagram', handle: '', url: '' });
      this.render();
    });
    root.querySelector('#add-link-btn').addEventListener('click', () => {
      this.collectFromDom();
      this.profile.customLinks.push({ label: '', icon: 'fa-link', url: '' });
      this.render();
    });
    root.querySelector('#add-item-btn').addEventListener('click', () => {
      this.collectFromDom();
      this.profile.items.push({ name: '', price: '', description: '', link: '', imageId: '' });
      this.render();
    });

    root.querySelectorAll('[data-remove-social]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.collectFromDom();
        this.profile.socials.splice(Number(btn.dataset.removeSocial), 1);
        this.render();
      })
    );
    root.querySelectorAll('[data-remove-link]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.collectFromDom();
        this.profile.customLinks.splice(Number(btn.dataset.removeLink), 1);
        this.render();
      })
    );
    root.querySelectorAll('[data-remove-item]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.collectFromDom();
        this.profile.items.splice(Number(btn.dataset.removeItem), 1);
        this.render();
      })
    );

    root.querySelectorAll('[data-item-image]').forEach((input) => {
      input.addEventListener('change', (e) => {
        const i = Number(input.dataset.itemImage);
        this.handleImageInput(e.target, `item-${i}-preview`, (id) => {
          this.collectFromDom();
          this.profile.items[i].imageId = id;
        });
      });
    });

    root.querySelector('#save-draft-btn').addEventListener('click', async () => {
      this.collectFromDom();
      await this.save('draft');
      showToast('Draft saved');
      this.onSaved && this.onSaved(this.profile);
    });

    root.querySelector('#cancel-form-btn').addEventListener('click', () => {
      this.onSaved && this.onSaved(null);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.collectFromDom();
      const errors = this.validate();
      if (errors.length) {
        showToast(errors[0]);
        return;
      }
      if (!this.profile.username) {
        this.profile.username = slugify(this.profile.businessName) || `page-${this.profile.id.slice(0, 6)}`;
      }
      await this.save('draft');
      this.onGenerate && this.onGenerate(this.profile);
    });
  }

  async save(status) {
    await this.flushPendingImages();
    this.profile.updatedAt = Date.now();
    if (status) this.profile.publishStatus = this.profile.publishStatus === 'published' ? this.profile.publishStatus : status;
    await Storage.saveProfile(this.profile);
    return this.profile;
  }
}
