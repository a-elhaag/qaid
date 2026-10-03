import { expect, it } from 'vitest';
import { resolveClient } from './askTools';

const clients = [
  { id: '1', name: 'منى للمستلزمات المنزلية', name_en: 'Mona Home Goods' },
  { id: '2', name: 'كافيه النيل', name_en: 'Nile Cafe' },
  { id: '3', name: 'متجر النيل للملابس', name_en: 'Nile Clothing' },
];
it('matches Arabic or English substring', () => {
  expect(resolveClient('mona', clients)?.id).toBe('1');
  expect(resolveClient('منى', clients)?.id).toBe('1');
});
it('ambiguous or unknown returns null', () => {
  expect(resolveClient('nile', clients)).toBeNull();
  expect(resolveClient('zzz', clients)).toBeNull();
});
