/**
 * المصدر الموحد لاختصار أسماء المحطات.
 *
 * يستخدمه:
 *   - ShortStationPipe (في القوالب: {{ name | shortStation }})
 *   - TreasuryService.shortStation()
 *   - components/pages المختلفة عند الحاجة في كود TS
 *
 * مثال:
 *   shortenStationName('محطة الدهمية لتوليد وتوزيع الكهرباء') → 'الدهمية'
 */
export function shortenStationName(
  name: string | null | undefined,
  fallback: string = '—',
): string {
  if (!name) return fallback;
  return name
    .replace(/^محطة\s+/, '')
    .replace(/\s+لتوليد\s+و?توزيع\s+الكهرباء\s*$/, '')
    .replace(/\s+لتوليد\s+الكهرباء\s*$/, '')
    .replace(/\s+لتوزيع\s+الكهرباء\s*$/, '');
}
