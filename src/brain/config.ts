export const CATEGORIES = ['rent', 'supplies', 'sales', 'salaries', 'utilities', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

// ALL RATES TO VERIFY before the demo. Never invent a number: mark it "to verify".
export const RATES = {
  vat: 0.14, // to verify
  socialInsurance: { employer: 0.1875, employee: 0.11, minWage: 2700, maxWage: 16700 }, // to verify
  minimumWage: 7000, // to verify
  vatRegistrationThreshold: 250000, // to verify
} as const;

export const THRESHOLDS = {
  priceJump: 0.08, // flag when a vendor's total rises 8% or more vs its prior average
  vatSpike: 1.5, // flag when this month's VAT is 1.5x the prior-month average
  arithmeticTolerance: 0.01,
} as const;
