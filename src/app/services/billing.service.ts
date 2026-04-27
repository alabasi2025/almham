import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BillingSystem } from './treasury.service';

export type BillingAccountType = 'collection' | 'sales' | 'settlement';

export interface BillingAccount {
  id: string;
  billingSystemId: string;
  billingSystemName: string | null;
  stationId: string | null;
  stationName: string | null;
  name: string;
  code: string | null;
  type: BillingAccountType;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface BillingAccountInput {
  billingSystemId: string;
  name: string;
  code?: string | null;
  type: BillingAccountType;
  isActive?: boolean;
  notes?: string | null;
}

export interface BillingCollector {
  id: string;
  name: string;
  role: string;
  stationId: string | null;
  status: 'active' | 'inactive';
}

export interface BillingCollectionEntry {
  id: string;
  batchId: string;
  collectorEmployeeId: string | null;
  collectorName: string | null;
  collectionId: string | null;
  amount: string;
  notes: string | null;
  createdAt: string;
}

export interface BillingCollectionBatch {
  id: string;
  stationId: string;
  stationName: string | null;
  billingSystemId: string;
  billingSystemName: string | null;
  billingSystemColor: string | null;
  billingSystemIcon: string | null;
  billingAccountId: string;
  billingAccountName: string | null;
  billingAccountType: BillingAccountType | null;
  cashboxId: string;
  cashboxName: string | null;
  enteredByUserId: string | null;
  enteredByUsername: string | null;
  collectionDate: string;
  totalAmount: string;
  notes: string | null;
  createdAt: string;
  entries: BillingCollectionEntry[];
}

export interface BillingCollectorBatchInput {
  stationId: string;
  billingSystemId: string;
  billingAccountId: string;
  cashboxId: string;
  collectionDate: string;
  notes?: string | null;
  entries: Array<{
    collectorEmployeeId: string;
    amount: number | string;
    notes?: string | null;
  }>;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private http = inject(HttpClient);
  private api = '/api/billing';

  systems = signal<BillingSystem[]>([]);
  accounts = signal<BillingAccount[]>([]);
  collectors = signal<BillingCollector[]>([]);
  batches = signal<BillingCollectionBatch[]>([]);

  async loadSystems() {
    const rows = await firstValueFrom(this.http.get<BillingSystem[]>(`${this.api}/systems`));
    this.systems.set(rows);
  }

  async loadAccounts(params: { billingSystemId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.billingSystemId) qs.set('billingSystemId', params.billingSystemId);
    const url = qs.toString() ? `${this.api}/accounts?${qs}` : `${this.api}/accounts`;
    const rows = await firstValueFrom(this.http.get<BillingAccount[]>(url));
    this.accounts.set(rows);
  }

  async createAccount(data: BillingAccountInput) {
    await firstValueFrom(this.http.post(`${this.api}/accounts`, data));
    await this.loadAccounts();
  }

  async updateAccount(id: string, data: Partial<BillingAccountInput>) {
    await firstValueFrom(this.http.put(`${this.api}/accounts/${id}`, data));
    await this.loadAccounts();
  }

  async loadCollectors(stationId: string) {
    const qs = new URLSearchParams({ stationId });
    const rows = await firstValueFrom(this.http.get<BillingCollector[]>(`${this.api}/collectors?${qs}`));
    this.collectors.set(rows);
  }

  async loadBatches(params: { stationId?: string; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const url = qs.toString() ? `${this.api}/collector-batches?${qs}` : `${this.api}/collector-batches`;
    const rows = await firstValueFrom(this.http.get<BillingCollectionBatch[]>(url));
    this.batches.set(rows);
  }

  async createCollectorBatch(data: BillingCollectorBatchInput) {
    await firstValueFrom(this.http.post(`${this.api}/collector-batches`, data));
    await this.loadBatches();
  }

  formatMoney(amount: number | string | null | undefined): string {
    const n = Number(amount ?? 0);
    const formatted = new Intl.NumberFormat('ar-YE', { maximumFractionDigits: 0 }).format(n);
    return `${formatted} ريال`;
  }

  formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('ar-YE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  accountTypeLabel(type: BillingAccountType | null | undefined): string {
    const map: Record<BillingAccountType, string> = {
      collection: 'حساب التحصيل',
      sales: 'حساب المبيعات',
      settlement: 'حساب التسويات',
    };
    return type ? map[type] ?? type : '—';
  }
}
