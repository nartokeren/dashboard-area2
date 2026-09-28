// ============================================
// REGIONAL MAPPING
// ============================================
import { stoMapping } from './stoMapping';

export const regionalMapping: { [key: string]: string } = Object.fromEntries(
  Object.values(stoMapping).map(({ branch, regional }) => [branch, regional])
);

// ============================================
// TARGET PER BRANCH (2.3K Fulfillment)
// ============================================
export const targetMapping: { [key: string]: number } = {
  'SERANG': 181,
  'TANGERANG': 179,
  'BEKASI': 197,
  'BOGOR': 201,
  'KARAWANG': 185,
  'NORTHERN JAKARTA': 239,
  'SOUTHERN JAKARTA': 365,
  'BANDUNG': 401,
  'CIREBON': 89,
  'SOREANG': 161,
  'TASIKMALAYA': 116,
};

// ============================================
// REGIONAL ORDER (untuk sorting)
// ============================================
export const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];

// ============================================
// JAM RANGE (untuk tabel per-jam)
// ============================================
export const jamRange = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];