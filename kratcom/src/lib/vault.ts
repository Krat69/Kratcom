import type { CustomTerm } from '@/types';

// Bóveda local del dispositivo. Guarda los mapeos token -> dato real cifrados
// con AES-GCM; la clave se genera como CryptoKey NO extraíble y vive solo en
// IndexedDB de este dispositivo. Ni la clave ni los mapeos se transmiten
// nunca: aunque se exfiltrara el almacenamiento, los mapeos son ilegibles
// sin la clave, y la clave no puede exportarse.

const DB_NAME = 'kratcom-vault';
const DB_VERSION = 1;
const KEY_STORE = 'keys';
const MAP_STORE = 'mappings';
const MASTER_KEY_ID = 'master';
const CUSTOM_TERMS_ID = '__custom_terms__';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(MAP_STORE)) db.createObjectStore(MAP_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getMasterKey(): Promise<CryptoKey> {
  const db = await openDb();
  const existing = await idbGet<CryptoKey>(db, KEY_STORE, MASTER_KEY_ID);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await idbPut(db, KEY_STORE, MASTER_KEY_ID, key);
  return key;
}

interface EncryptedRecord {
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
}

async function encryptJson(value: unknown): Promise<EncryptedRecord> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv: iv.buffer, ciphertext };
}

async function decryptJson<T>(record: EncryptedRecord): Promise<T> {
  const key = await getMasterKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
    key,
    record.ciphertext
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function saveMapping(taskId: string, mapping: Record<string, string>): Promise<void> {
  const db = await openDb();
  await idbPut(db, MAP_STORE, taskId, await encryptJson(mapping));
}

export async function loadMapping(taskId: string): Promise<Record<string, string> | null> {
  const db = await openDb();
  const record = await idbGet<EncryptedRecord>(db, MAP_STORE, taskId);
  if (!record) return null;
  try {
    return await decryptJson<Record<string, string>>(record);
  } catch {
    return null;
  }
}

export async function deleteMapping(taskId: string): Promise<void> {
  const db = await openDb();
  await idbDelete(db, MAP_STORE, taskId);
}

// Los términos protegidos (nombres de clientes, etc.) también son datos
// personales: se guardan cifrados en la bóveda, nunca en claro.
export async function saveCustomTerms(terms: CustomTerm[]): Promise<void> {
  const db = await openDb();
  await idbPut(db, MAP_STORE, CUSTOM_TERMS_ID, await encryptJson(terms));
}

export async function loadCustomTerms(): Promise<CustomTerm[]> {
  const db = await openDb();
  const record = await idbGet<EncryptedRecord>(db, MAP_STORE, CUSTOM_TERMS_ID);
  if (!record) return [];
  try {
    return await decryptJson<CustomTerm[]>(record);
  } catch {
    return [];
  }
}
