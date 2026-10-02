import type { Category } from './config';

export type DocType = 'purchase' | 'sale' | 'payment_screenshot' | 'other';

export interface Extracted {
  vendor: string | null;
  date: string | null; // YYYY-MM-DD
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  docType: DocType;
}

export interface Entry {
  id: string;
  clientId: string;
  documentId: string | null;
  vendor: string;
  date: string; // YYYY-MM-DD
  subtotal: number;
  vat: number;
  total: number;
  category: Category;
  confirmed: boolean;
  imageHash?: string | null;
}

export type FlagKind = 'duplicate' | 'price_jump' | 'vat_spike';
export interface Flag {
  kind: FlagKind;
  entryId: string;
  detail: string;
}
