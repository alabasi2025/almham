import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface BillingStation {
  id: string;
  code: string;
  name: string;
  ecasDb: string;
  sortOrder: number;
  customersCount: number;
}

export interface BillingPeriod {
  id: string;
  year: number;
  month: number;
  part: string;
  name: string;
  isClosed: boolean;
}

export interface BillingCustomerRow {
  id: string;
  subscriberCode: string;
  name: string;
  address: string | null;
  countNo: string | null;
  currentBalance: string;
  stationId: string;
  squareName: string | null;
}

export interface BillingPage<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private http = inject(HttpClient);
  private api = '/api/billing';

  loadStations() {
    return firstValueFrom(this.http.get<BillingStation[]>(`${this.api}/stations`));
  }

  loadPeriods(stationId?: string, year?: number) {
    let params = new HttpParams();
    if (stationId) params = params.set('stationId', stationId);
    if (year) params = params.set('year', String(year));
    return firstValueFrom(this.http.get<BillingPeriod[]>(`${this.api}/periods`, { params }));
  }

  loadCustomers(opts: { stationId?: string; q?: string; limit?: number; offset?: number } = {}) {
    let params = new HttpParams()
      .set('limit', String(opts.limit ?? 50))
      .set('offset', String(opts.offset ?? 0));
    if (opts.stationId) params = params.set('stationId', opts.stationId);
    if (opts.q) params = params.set('q', opts.q);
    return firstValueFrom(this.http.get<BillingPage<BillingCustomerRow>>(`${this.api}/customers`, { params }));
  }
}
