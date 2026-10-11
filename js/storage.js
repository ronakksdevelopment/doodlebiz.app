// IndexedDB wrapper for profiles, images, and settings.
const DB_NAME = 'doodlebiz-db';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const result = fn(store);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

export const Storage = {
  async getAllProfiles() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('profiles', 'readonly').objectStore('profiles').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async getProfile(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('profiles', 'readonly').objectStore('profiles').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async saveProfile(profile) {
    return tx('profiles', 'readwrite', (store) => store.put(profile));
  },
  async deleteProfile(id) {
    return tx('profiles', 'readwrite', (store) => store.delete(id));
  },

  async saveImage(id, blob) {
    return tx('images', 'readwrite', (store) => store.put({ id, blob }));
  },
  async getImage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('images', 'readonly').objectStore('images').get(id);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteImage(id) {
    return tx('images', 'readwrite', (store) => store.delete(id));
  },

  async getSetting(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('settings', 'readonly').objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  },
  async setSetting(key, value) {
    return tx('settings', 'readwrite', (store) => store.put({ key, value }));
  },
  async deleteSetting(key) {
    return tx('settings', 'readwrite', (store) => store.delete(key));
  },

  async clearAll() {
    const db = await openDB();
    return Promise.all(
      ['profiles', 'images', 'settings'].map(
        (name) =>
          new Promise((resolve, reject) => {
            const req = db.transaction(name, 'readwrite').objectStore(name).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
      )
    );
  },
};
