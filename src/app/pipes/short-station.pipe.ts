import { Pipe, PipeTransform } from '@angular/core';
import { shortenStationName } from '../utils/station-name';

/**
 * Pipe موحدة لاختصار اسم المحطة.
 * تستخدم نفس الدالة الموجودة في `utils/station-name.ts`.
 *
 * الاستخدام:
 *   {{ station.name | shortStation }}
 *   {{ null | shortStation : '' }}
 */
@Pipe({
  name: 'shortStation',
  standalone: true,
})
export class ShortStationPipe implements PipeTransform {
  transform(value: string | null | undefined, fallback: string = '—'): string {
    return shortenStationName(value, fallback);
  }
}
