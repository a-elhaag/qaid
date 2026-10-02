import { readFileSync } from 'node:fs';
import { extractReceipt } from '../src/server/extractReceipt';

const path = process.argv[2];
if (!path) throw new Error('usage: npm run smoke:ai -- path/to/receipt.jpg');
const b64 = readFileSync(path).toString('base64');
extractReceipt(b64, 'image/jpeg').then((r) => console.log(JSON.stringify(r, null, 2)));
