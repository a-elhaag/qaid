export type ClientStatus = 'strange' | 'missing' | 'silent' | 'review' | 'ready';

export function clientStatus(i: { openFlags: number; missing: number; silent: boolean; needsReview: number }): ClientStatus {
  if (i.openFlags > 0) return 'strange';
  if (i.missing > 0) return 'missing';
  if (i.silent) return 'silent';
  if (i.needsReview > 0) return 'review';
  return 'ready';
}

export function missingExpected(expectedVendors: string[], monthVendors: string[]): string[] {
  const seen = new Set(monthVendors.map((v) => v.trim().toLowerCase()));
  return expectedVendors.filter((v) => !seen.has(v.trim().toLowerCase()));
}

// ponytail: no day-of-month guard, so every client looks silent on the 1st if they have not uploaded yet.
export function isSilent(uploadsThisMonth: number, priorMonthUploads: number[]): boolean {
  if (uploadsThisMonth > 0 || !priorMonthUploads.length) return false;
  return priorMonthUploads.reduce((a, b) => a + b, 0) / priorMonthUploads.length >= 1;
}
