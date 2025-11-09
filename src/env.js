import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env explicitly from project root
dotenv.config({ path: path.join(rootDir, '.env') });

export {}; // ESM side-effect module

