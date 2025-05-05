import admin from 'firebase-admin';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const isProd = process.env.NODE_ENV === 'production';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const keyPath = isProd 
  ? '/root/keys/politik404-41c47-firebase-adminsdk-fbsvc-2c5ed453f9.json'
  : join(__dirname, '../keys/firebase-admin.json');

let serviceAccount;

try {
  const rawData = fs.readFileSync(keyPath, 'utf8');
  serviceAccount = JSON.parse(rawData);
} catch (err) {
  console.error('[FIREBASE] Erro ao carregar chave do Firebase Admin:', err.message);
  process.exit(1); // derruba o servidor com erro explícito
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export default admin;