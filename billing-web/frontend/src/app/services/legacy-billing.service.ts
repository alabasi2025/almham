import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface EcasSystemSummary {
  code: string;
  dbName: string;
  stationCode: string | null;
  companyName: string;
  stationName: string;
  address: string;
  phone: string;
  customersCount: number;
  paymentsCount: number;
  cashiersCount: number;
  available: boolean;
  error?: string;
}

export interface EcasSystemInfo {
  code: string;
  dbName: string;
  companyName: string;
  stationName: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  counts: {
    customers: number;
    payments: number;
    cashiers: number;
    areas: number;
    branches: number;
    squares: number;
    transformers: number;
  };
  totalBalance: number;
}

export interface EcasCustomer {
  id: string;
  refId: string | null;
  name: string;
  address: string | null;
  neighbor: string | null;
  meterNumber: string | null;
  phone: string | null;
  contractNo: string | null;
  beginServiceDate: string | null;
  lastReading: string | null;
  lastSales: string | null;
  lastBalance: string | null;
  squareId: string | null;
  branchId: string | null;
  linkPointId: string | null;
  areaId: string | null;
  insertDate: string | null;
  updateDate: string | null;
}

export interface EcasPayment {
  id: string;
  customerId: string;
  cashierId: string | null;
  amount: string;
  payDate: string | null;
  notes: string | null;
}

export interface EcasCashier {
  id: string;
  name: string;
  accountId: string | null;
  phone: string | null;
  active: boolean;
  branchId: string | null;
}

export interface PagedResponse<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private http = inject(HttpClient);
  private api = '/api/billing';

  systems = signal<EcasSystemSummary[]>([]);
  currentInfo = signal<EcasSystemInfo | null>(null);
  customersPage = signal<PagedResponse<EcasCustomer>>({ total: 0, offset: 0, limit: 50, items: [] });
  cashiers = signal<EcasCashier[]>([]);

  async loadSystems() {
    const rows = await firstValueFrom(this.http.get<EcasSystemSummary[]>(`${this.api}/systems`));
    this.systems.set(rows);
  }

  async loadInfo(code: string) {
    const info = await firstValueFrom(this.http.get<EcasSystemInfo>(`${this.api}/${code}/info`));
    this.currentInfo.set(info);
    return info;
  }

  async loadCustomers(
    code: string,
    opts: { q?: string; squareId?: string; branchId?: string; limit?: number; offset?: number } = {},
  ) {
    let params = new HttpParams();
    if (opts.q) params = params.set('q', opts.q);
    if (opts.squareId) params = params.set('squareId', opts.squareId);
    if (opts.branchId) params = params.set('branchId', opts.branchId);
    params = params.set('limit', String(opts.limit ?? 50));
    params = params.set('offset', String(opts.offset ?? 0));

    const res = await firstValueFrom(
      this.http.get<PagedResponse<EcasCustomer>>(`${this.api}/${code}/customers`, { params }),
    );
    this.customersPage.set(res);
    return res;
  }

  async loadCashiers(code: string) {
    const rows = await firstValueFrom(this.http.get<EcasCashier[]>(`${this.api}/${code}/cashiers`));
    this.cashiers.set(rows);
    return rows;
  }

  async loadCustomerDetail(code: string, customerId: string) {
    return firstValueFrom(
      this.http.get<{ customer: EcasCustomer; payments: EcasPayment[] }>(
        `${this.api}/${code}/customers/${customerId}`,
      ),
    );
  }

  formatMoney(amount: number | string | null | undefined): string {
    const n = Number(amount ?? 0);
    const formatted = new Intl.NumberFormat('ar-YE', { maximumFractionDigits: 0 }).format(n);
    return `${formatted} ريال`;
  }

  formatNumber(n: number | string | null | undefined): string {
    return new Intl.NumberFormat('ar-YE').format(Number(n ?? 0));
  }
}
