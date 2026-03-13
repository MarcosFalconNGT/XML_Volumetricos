import { HIDROCARBON_KEYS, HIDROCARBON_KEYWORDS } from '../../shared/constants';

export function normalizeProduct(description: string, claveProdServ: string): string | null {
  const text = (description || '').toUpperCase().trim();
  const key = (claveProdServ || '').trim();

  if (text.includes('MAGNA') || key === '15101514') return 'MAGNA';
  if (text.includes('PREMIUM') || key === '15101515') return 'PREMIUM';
  if (text.includes('DIESEL') || key === '15101505') return 'DIESEL';

  const byKeyword = HIDROCARBON_KEYWORDS.find((keyword) => text.includes(keyword));
  if (byKeyword) return byKeyword;

  return HIDROCARBON_KEYS.includes(key) ? text || key : null;
}
