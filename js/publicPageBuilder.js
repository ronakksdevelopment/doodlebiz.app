import { escapeHtml, isSafeUrl } from './utils.js';

const THEMES = {
  default: { bg: '#FFFFFF', fg: '#111111', accent: '#E01E26' },
  midnight: { bg: '#111111', fg: '#FFFFFF', accent: '#E01E26' },
  cream: { bg: '#FFF8EC', fg: '#2B2B2B', accent: '#D94E33' },
  mint: { bg: '#F2FBF5', fg: '#14342A', accent: '#1E9E6C' },
  sky: { bg: '#F0F7FF', fg: '#102A43', accent: '#1E6FE0' },
};
export { THEMES };

function sectionWrap(title, inner) {
  if (!inner) return '';
  return `<section class="pb-section"><h2>${escapeHtml(title)}</h2>${inner}</section>`;
}

function actionBtn(href, icon, label) {
  if (!href) return '';
  return `<a class="pb-action" href="${href}" target="_blank" rel="noopener noreferrer"><span>${icon}</span>${escapeHtml(label)}</a>`;
}

function buildUpiLink(upiId, name, amount) {
  if (!upiId) return '';
  const params = new URLSearchParams();
  params.set('pa', upiId);
  if (name) params.set('pn', name);
  if (amount) params.set('am', amount);
  params.set('cu', 'INR');
  return `upi://pay?${params.toString()}`;
}

export function buildPublicPageHtml(profile, assetUrls) {
  const theme = THEMES[profile.themeId] || THEMES.default;
  const name = profile.businessName || profile.username;
  const safeTitle = escapeHtml(name || 'Business Page');

  const logoHtml = assetUrls.logo
    ? `<img class="pb-logo" src="${assetUrls.logo}" alt="${safeTitle} logo">`
    : '';
  const coverHtml = assetUrls.cover
    ? `<div class="pb-cover" style="background-image:url('${assetUrls.cover}')"></div>`
    : '';

  const contactLinks = [
    actionBtn(profile.phone ? `tel:${profile.phone.replace(/\s+/g, '')}` : '', '&#128222;', 'Call'),
    actionBtn(profile.whatsapp ? `https://wa.me/${profile.whatsapp.replace(/\D/g, '')}` : '', '&#128172;', 'WhatsApp'),
    actionBtn(profile.email ? `mailto:${profile.email}` : '', '&#9993;', 'Email'),
    actionBtn(isSafeUrl(profile.website) ? profile.website : '', '&#127760;', 'Website'),
    actionBtn(isSafeUrl(profile.mapsUrl) ? profile.mapsUrl : '', '&#128205;', 'Directions'),
  ]
    .filter(Boolean)
    .join('');

  const socials = (profile.socials || [])
    .filter((s) => s.url || s.handle)
    .map((s) => {
      const url = isSafeUrl(s.url) ? s.url : '';
      if (!url) return '';
      return `<a class="pb-social" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.platform)}${s.handle ? ' &middot; @' + escapeHtml(s.handle) : ''}</a>`;
    })
    .filter(Boolean)
    .join('');

  const customLinks = (profile.customLinks || [])
    .filter((l) => l.url && l.label)
    .map((l) => {
      const url = isSafeUrl(l.url) ? l.url : '';
      if (!url) return '';
      return `<a class="pb-custom-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`;
    })
    .filter(Boolean)
    .join('');

  const items = (profile.items || [])
    .filter((it) => it.name)
    .map((it, idx) => {
      const img = assetUrls.items && assetUrls.items[idx] ? `<img src="${assetUrls.items[idx]}" alt="${escapeHtml(it.name)}">` : '';
      const price = it.price ? `<span class="pb-item-price">${escapeHtml(it.price)}</span>` : '';
      const link = isSafeUrl(it.link) ? `<a href="${it.link}" target="_blank" rel="noopener noreferrer" class="pb-item-link">Order</a>` : '';
      return `<div class="pb-item">${img}<div class="pb-item-body"><div class="pb-item-top"><strong>${escapeHtml(it.name)}</strong>${price}</div>${it.description ? `<p>${escapeHtml(it.description)}</p>` : ''}${link}</div></div>`;
    })
    .join('');

  const gallery = (assetUrls.gallery || [])
    .map((src) => `<img class="pb-gallery-img" src="${src}" alt="${safeTitle} photo">`)
    .join('');

  const upiLink = buildUpiLink(profile.upiId, name, '');
  const paymentBlock = profile.upiId
    ? `<div class="pb-payment"><p>Pay via UPI: <strong>${escapeHtml(profile.upiId)}</strong></p>${profile.paymentNote ? `<p class="pb-payment-note">${escapeHtml(profile.paymentNote)}</p>` : ''}<a class="pb-action pb-upi-btn" href="${upiLink}">&#128179; Pay with UPI</a><p class="pb-payment-disclaimer">This link opens your UPI app. DoodleBiz does not process or confirm payments.</p></div>`
    : '';

  const hoursBlock = profile.hours
    ? `<p class="pb-hours">${escapeHtml(profile.hours).replace(/\n/g, '<br>')}</p>`
    : '';

  const highlightsBlock = profile.highlights
    ? `<p>${escapeHtml(profile.highlights).replace(/\n/g, '<br>')}</p>`
    : '';

  const addressBlock = profile.address ? `<p class="pb-address">${escapeHtml(profile.address)}</p>` : '';
  const categoryBlock = profile.category ? `<span class="pb-badge">${escapeHtml(profile.category)}</span>` : '';
  const descBlock = profile.description ? `<p class="pb-desc">${escapeHtml(profile.description)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}${profile.description ? ' - ' + escapeHtml(profile.description.slice(0, 60)) : ''}</title>
<meta name="description" content="${escapeHtml((profile.description || name || '').slice(0, 150))}">
<meta name="robots" content="index,follow">
<style>
:root{--bg:${theme.bg};--fg:${theme.fg};--accent:${theme.accent}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5}
.pb-wrap{max-width:560px;margin:0 auto;padding-bottom:40px}
.pb-cover{height:160px;background-size:cover;background-position:center;border-bottom:4px solid var(--fg)}
.pb-header{padding:20px;text-align:center;position:relative}
.pb-logo{width:88px;height:88px;border-radius:50%;object-fit:cover;border:4px solid var(--fg);margin:-60px auto 10px;background:var(--bg)}
.pb-header h1{margin:4px 0 2px;font-size:1.5rem}
.pb-badge{display:inline-block;background:var(--accent);color:#fff;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px;margin-top:4px}
.pb-desc{margin:10px 16px 0;color:inherit;opacity:.85;font-size:.95rem}
.pb-actions-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:18px 16px}
.pb-action{display:inline-flex;align-items:center;gap:6px;border:2px solid var(--fg);border-radius:999px;padding:8px 16px;text-decoration:none;color:var(--fg);font-weight:600;font-size:.88rem}
.pb-section{padding:14px 18px;border-top:2px solid rgba(128,128,128,.25)}
.pb-section h2{font-size:1.05rem;margin:0 0 10px}
.pb-address{opacity:.85}
.pb-social{display:block;margin-bottom:6px;color:var(--accent);text-decoration:none;font-weight:600}
.pb-custom-link{display:block;border:2px solid var(--fg);border-radius:10px;padding:10px 14px;margin-bottom:8px;text-decoration:none;color:var(--fg);font-weight:600}
.pb-item{display:flex;gap:12px;border:2px solid rgba(128,128,128,.3);border-radius:12px;padding:10px;margin-bottom:10px}
.pb-item img{width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0}
.pb-item-top{display:flex;justify-content:space-between;gap:8px}
.pb-item-price{font-weight:700;color:var(--accent)}
.pb-item-link{color:var(--accent);font-weight:700;text-decoration:none;font-size:.85rem}
.pb-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.pb-gallery-img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
.pb-payment{background:rgba(224,30,38,.08);border:2px solid var(--accent);border-radius:12px;padding:14px;margin:16px}
.pb-upi-btn{background:var(--accent);color:#fff;border-color:var(--accent);margin-top:8px}
.pb-payment-disclaimer{font-size:.74rem;opacity:.7;margin-top:8px}
.pb-footer{text-align:center;padding:20px;font-size:.76rem;opacity:.6}
</style>
</head>
<body>
<div class="pb-wrap">
${coverHtml}
<div class="pb-header">
${logoHtml}
<h1>${safeTitle}</h1>
${categoryBlock}
${descBlock}
${addressBlock}
</div>
<div class="pb-actions-row">${contactLinks}</div>
${sectionWrap('Links', socials + customLinks)}
${sectionWrap('Menu &amp; Products', items ? `<div class="pb-items">${items}</div>` : '')}
${sectionWrap('Gallery', gallery ? `<div class="pb-gallery">${gallery}</div>` : '')}
${sectionWrap('Hours', hoursBlock)}
${sectionWrap('Highlights &amp; Offers', highlightsBlock)}
${paymentBlock}
<p class="pb-footer">Made with DoodleBiz</p>
</div>
</body>
</html>`;
}
