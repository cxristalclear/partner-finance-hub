export type Category = 'net_worth' | 'debt' | 'investment' | 'exclude';

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'net_worth', label: 'Net Worth' },
  { value: 'debt', label: 'The Universe Is Handling This' },
  { value: 'investment', label: 'Investment' },
  { value: 'exclude', label: 'Exclude' },
];

const DEBT_TYPES = new Set(['credit', 'loan', 'mortgage']);
const DEBT_SUBTYPES = new Set([
  'credit card', 'student', 'auto', 'mortgage', 'personal', 'home equity',
]);

export function defaultPlaidCategory(type: string, subtype?: string): Category {
  const t = type.toLowerCase();
  const s = (subtype || '').toLowerCase();
  if (DEBT_TYPES.has(t) || DEBT_SUBTYPES.has(s)) return 'debt';
  if (t === 'investment' || ['401k', 'ira', 'brokerage'].includes(s)) return 'investment';
  return 'net_worth';
}

export function defaultManualCategory(accountType: string): Category {
  if (['Credit Card', 'Loan', 'Mortgage'].includes(accountType)) return 'debt';
  if (['Investment', 'Retirement'].includes(accountType)) return 'investment';
  return 'net_worth';
}
