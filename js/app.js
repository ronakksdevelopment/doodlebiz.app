import { Storage } from './storage.js';
import { BusinessForm } from './form.js';
import { LinksView } from './linksView.js';
import { SettingsView } from './settingsView.js';
import { publishProfile } from './publisher.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';
import { GitHubError } from './github/api.js';

const views = {
  links: document.getElementById('view-links'),
  settings: document.getElementById('view-settings'),
  form: document.getElementById('view-form'),
  generate: document.getElementById('view-generate'),
  result: document.getElementById('view-result'),
};

function showView(name) {
  Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
  document.querySelectorAll('.bottom-nav-btn,.side-nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  window.scrollTo({ top: 0 });
}

// --- Loading screen ---
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').hidden = false;
  }, 900);
});

// --- Offline indicator ---
const offlinePill = document.getElementById('offline-indicator');
function updateOnlineStatus() {
  offlinePill.hidden = navigator.onLine;
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// --- Nav ---
function goToView(name) {
  if (name === 'links') linksView.refresh();
  showView(name);
}
document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => goToView(btn.dataset.view));
});

// --- Links view ---
const linksView = new LinksView({
  listEl: document.getElementById('links-list'),
  emptyEl: document.getElementById('links-empty'),
  searchInputEl: document.getElementById('search-input'),
  handlers: {
    onEdit: (id) => openForm(id),
    onDuplicate: async (id) => {
      const p = await Storage.getProfile(id);
      if (!p) return;
      const copy = { ...p, id: cryptoRandomId(), username: '', publishStatus: 'draft', publicUrl: '', publishedUsername: '', qrDataUrl: '', createdAt: Date.now(), updatedAt: Date.now() };
      await Storage.saveProfile(copy);
      showToast('Created a copy as a new draft');
      linksView.refresh();
    },
    onDownloadQr: (p) => downloadQrForProfile(p),
  },
});

function cryptoRandomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function downloadQrForProfile(p) {
  if (!p.qrDataUrl) {
    showToast('No QR code available yet');
    return;
  }
  const a = document.createElement('a');
  a.href = p.qrDataUrl;
  a.download = `${p.username || 'doodlebiz'}-qr.png`;
  a.click();
}

// --- Settings view ---
new SettingsView(document.getElementById('view-settings'));
window.addEventListener('doodlebiz:profiles-changed', () => linksView.refresh());

// --- Form view ---
const formRoot = document.getElementById('form-root');
let businessForm = null;

function openForm(profileId) {
  businessForm = new BusinessForm(formRoot, {
    onSaved: (saved) => {
      goToView('links');
    },
    onGenerate: (profile) => startGenerate(profile),
  });
  businessForm.load(profileId || null);
  showView('form');
}

document.getElementById('mobile-add-btn').addEventListener('click', () => openForm(null));
document.getElementById('desktop-add-btn').addEventListener('click', () => openForm(null));
document.getElementById('form-close-btn').addEventListener('click', () => goToView('links'));

// --- Generate / countdown / publish flow ---
const genCountdownEl = document.getElementById('gen-countdown');
const genStatusEl = document.getElementById('gen-status');
const genErrorEl = document.getElementById('gen-error');
const genErrorMsgEl = document.getElementById('gen-error-msg');

let currentGenerateProfile = null;

async function startGenerate(profile) {
  currentGenerateProfile = profile;
  genErrorEl.hidden = true;
  genCountdownEl.textContent = '60';
  genStatusEl.textContent = 'Preparing files';
  showView('generate');

  let seconds = 60;
  let finished = false;
  const timer = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      genCountdownEl.textContent = '0';
      if (!finished) genStatusEl.textContent = 'Still publishing...';
      clearInterval(timer);
    } else {
      genCountdownEl.textContent = String(seconds);
    }
  }, 1000);

  profile.publishStatus = 'publishing';
  await Storage.saveProfile(profile);
  linksView.refresh();

  try {
    const result = await publishProfile(profile, (stage) => {
      genStatusEl.textContent = stage;
    });
    finished = true;
    clearInterval(timer);

    profile.publishStatus = 'published';
    profile.publishedUsername = result.username;
    profile.publicUrl = result.publicUrl;
    profile.updatedAt = Date.now();

    const qrDataUrl = await generateQrDataUrl(result.publicUrl);
    profile.qrDataUrl = qrDataUrl;

    await Storage.saveProfile(profile);
    linksView.refresh();
    showResult(profile);
  } catch (err) {
    finished = true;
    clearInterval(timer);
    profile.publishStatus = 'failed';
    await Storage.saveProfile(profile);
    linksView.refresh();

    const message =
      err instanceof GitHubError
        ? err.message
        : !navigator.onLine
        ? 'You appear to be offline. Publishing requires an internet connection.'
        : 'Something went wrong while publishing. Your form data is safe.';
    genErrorMsgEl.textContent = message;
    genErrorEl.hidden = false;
    genStatusEl.textContent = 'Publishing stopped';
  }
}

document.getElementById('gen-retry-btn').addEventListener('click', () => {
  if (currentGenerateProfile) startGenerate(currentGenerateProfile);
});
document.getElementById('gen-edit-btn').addEventListener('click', () => {
  if (currentGenerateProfile) openForm(currentGenerateProfile.id);
});

function generateQrDataUrl(text) {
  return new Promise((resolve) => {
    const holder = document.createElement('div');
    // eslint-disable-next-line no-undef
    new QRCode(holder, {
      text,
      width: 600,
      height: 600,
      colorDark: '#000000',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M,
    });
    setTimeout(() => {
      const canvas = holder.querySelector('canvas');
      const img = holder.querySelector('img');
      if (canvas) {
        resolve(canvas.toDataURL('image/png'));
      } else if (img) {
        resolve(img.src);
      } else {
        resolve('');
      }
    }, 80);
  });
}

// --- Result view ---
function showResult(profile) {
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = profile.qrDataUrl;

  document.getElementById('result-url').textContent = profile.publicUrl;
  showView('result');

  document.getElementById('copy-link-btn').onclick = async () => {
    await navigator.clipboard.writeText(profile.publicUrl);
    showToast('Link copied');
  };
  document.getElementById('download-qr-btn').onclick = () => downloadQrForProfile(profile);
  document.getElementById('open-page-btn').onclick = () => window.open(profile.publicUrl, '_blank', 'noopener');
  document.getElementById('result-edit-btn').onclick = () => openForm(profile.id);
  document.getElementById('result-done-btn').onclick = () => goToView('links');
}

// --- Initial route ---
linksView.refresh();
showView('links');

// --- Service worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
