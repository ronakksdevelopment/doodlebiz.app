export function showToast(message, duration = 2600) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('dialog-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h3 id="dlg-title"></h3>
        <p id="dlg-msg"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-text" data-act="cancel"></button>
          <button type="button" class="btn ${danger ? 'btn-danger-text' : 'btn-primary'}" data-act="confirm" style="${danger ? 'border-color:#111;background:#E01E26;color:#fff' : ''}"></button>
        </div>
      </div>`;
    backdrop.querySelector('#dlg-title').textContent = title;
    backdrop.querySelector('#dlg-msg').textContent = message;
    backdrop.querySelector('[data-act="cancel"]').textContent = cancelLabel;
    backdrop.querySelector('[data-act="confirm"]').textContent = confirmLabel;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        resolve(false);
      }
    });
    backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => {
      backdrop.remove();
      resolve(false);
    });
    backdrop.querySelector('[data-act="confirm"]').addEventListener('click', () => {
      backdrop.remove();
      resolve(true);
    });
    root.appendChild(backdrop);
    backdrop.querySelector('[data-act="confirm"]').focus();
  });
}

export function choiceDialog({ title, message, choices }) {
  // choices: [{label, value, danger}]
  return new Promise((resolve) => {
    const root = document.getElementById('dialog-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const btnHtml = choices
      .map(
        (c, i) =>
          `<button type="button" class="btn ${c.danger ? '' : 'btn-outline'}" data-i="${i}" style="${c.danger ? 'border-color:#111;background:#E01E26;color:#fff' : ''}">${c.label}</button>`
      )
      .join('');
    backdrop.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions" style="flex-direction:column">${btnHtml}
          <button type="button" class="btn btn-text" data-i="-1">Cancel</button>
        </div>
      </div>`;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        resolve(null);
      }
    });
    backdrop.querySelectorAll('[data-i]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        backdrop.remove();
        resolve(i === -1 ? null : choices[i].value);
      });
    });
    root.appendChild(backdrop);
  });
}
