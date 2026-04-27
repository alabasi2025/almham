import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { shortenStationName } from '../utils/station-name';

export type CashboxType = 'station' | 'exchange' | 'wallet' | 'bank';
export type WalletProvider = 'jawali' | 'kuraimi' | 'mfloos' | 'jeeb' | 'other';
export type Currency = 'YER' | 'SAR' | 'USD';
export type PaymentMethod = 'cash' | 'wallet' | 'hexcell' | 'other';
export type BillingSystemType = 'ecas' | 'hexcell' | 'manual' | 'other';
export type BillingAccountType = 'collection' | 'sales' | 'settlement';

export interface BillingSystem {
  id: string;
  name: string;
  code: string | null;
  type: BillingSystemType;
  stationId: string | null;
  stationName: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface BillingSystemInput {
  name: string;
  code?: string | null;
  type: BillingSystemType;
  stationId?: string | null;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface Cashbox {
  id: string;
  name: string;
  type: CashboxType;
  stationId: string | null;
  stationName: string | null;
  walletProvider: WalletProvider | null;
  accountNumber: string | null;
  accountHolder: string | null;
  currency: Currency;
  openingBalance: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface CashboxBalance extends Omit<Cashbox, 'createdAt'> {
  totalIn: string | number;
  totalOut: string | number;
  currentBalance: string | number;
}

export interface Collection {
  id: string;
  stationId: string;
  stationName: string | null;
  cashboxId: string;
  cashboxName: string | null;
  billingSystemId: string | null;
  billingSystemName: string | null;
  billingSystemColor: string | null;
  billingSystemIcon: string | null;
  billingAccountId: string | null;
  billingAccountName: string | null;
  billingAccountType: BillingAccountType | null;
  collectorUserId: string | null;
  collectorEmployeeId: string | null;
  collectorUsername: string | null;
  collectorName: string | null;
  subscriberName: string | null;
  meterNumber: string | null;
  amount: string;
  currency: Currency;
  paymentMethod: PaymentMethod;
  walletRef: string | null;
  receiptCode: string | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface CollectionInput {
  stationId: string;
  cashboxId: string;
  billingSystemId?: string | null;
  billingAccountId?: string | null;
  collectorEmployeeId?: string | null;
  subscriberName?: string | null;
  meterNumber?: string | null;
  amount: number | string;
  currency?: Currency;
  paymentMethod: PaymentMethod;
  walletRef?: string | null;
  receiptCode?: string | null;
  notes?: string | null;
  occurredAt?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  isActive: boolean;
}

export interface Expense {
  id: string;
  stationId: string | null;
  stationName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  cashboxId: string;
  cashboxName: string | null;
  userId: string | null;
  amount: string;
  currency: Currency;
  description: string;
  receiptPhotoUrl: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface ExpenseInput {
  stationId?: string | null;
  categoryId?: string | null;
  cashboxId: string;
  amount: number | string;
  currency?: Currency;
  description: string;
  receiptPhotoUrl?: string | null;
  occurredAt?: string;
}

export interface CashTransferInput {
  fromCashboxId: string;
  toCashboxId: string;
  amount: number | string;
  currency?: Currency;
  receiptPhotoUrl?: string | null;
  notes?: string | null;
  occurredAt?: string;
}

export interface DailySummary {
  date: string;
  totalCollections: number;
  collectionsCount: number;
  totalExpenses: number;
  expensesCount: number;
  net: number;
  perStation: Array<{
    stationId: string;
    stationName: string;
    collectionsTotal: number;
    collectionsCount: number;
  }>;
}

export type DailyClosureStatus = 'draft' | 'closed' | 'approved';

export interface DailyClosure {
  id: string;
  stationId: string;
  stationName: string | null;
  managerUserId: string | null;
  managerUsername: string | null;
  closureDate: string;
  totalCash: string;
  totalWallet: string;
  totalHexcell: string;
  expectedTotal: string;
  actualTotal: string;
  variance: string;
  status: DailyClosureStatus;
  notes: string | null;
  createdAt: string;
}

export interface DailyClosurePreview {
  stationId: string;
  date: string;
  totalCash: number;
  totalWallet: number;
  totalHexcell: number;
  totalOther: number;
  expectedTotal: number;
  collectionsCount: number;
  existingClosure: {
    id: string;
    status: DailyClosureStatus;
    actualTotal: string;
    variance: string;
  } | null;
}

export interface DailyClosureInput {
  stationId: string;
  closureDate: string;
  actualTotal: number | string;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TreasuryService {
  private http = inject(HttpClient);
  private api = '/api/treasury';

  cashboxes = signal<CashboxBalance[]>([]);
  collections = signal<Collection[]>([]);
  expenses = signal<Expense[]>([]);
  categories = signal<ExpenseCategory[]>([]);
  billingSystemsList = signal<BillingSystem[]>([]);
  summary = signal<DailySummary | null>(null);
  dailyClosures = signal<DailyClosure[]>([]);

  // ---- computed helpers ----
  totalBalance = computed(() => {
    return this.cashboxes().reduce((sum, c) => sum + Number(c.currentBalance ?? 0), 0);
  });

  balanceByType = computed(() => {
    const byType: Record<CashboxType, number> = { station: 0, exchange: 0, wallet: 0, bank: 0 };
    for (const c of this.cashboxes()) {
      byType[c.type] = (byType[c.type] ?? 0) + Number(c.currentBalance ?? 0);
    }
    return byType;
  });

  // ---------- Cashboxes ----------
  async loadCashboxes() {
    const rows = await firstValueFrom(this.http.get<CashboxBalance[]>(`${this.api}/cashboxes/balances`));
    this.cashboxes.set(rows);
  }

  async updateCashbox(id: string, data: Partial<Cashbox>) {
    await firstValueFrom(this.http.put(`${this.api}/cashboxes/${id}`, data));
    await this.loadCashboxes();
  }

  // ---------- Collections ----------
  async loadCollections(params: { stationId?: string; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const url = qs.toString() ? `${this.api}/collections?${qs}` : `${this.api}/collections`;
    const rows = await firstValueFrom(this.http.get<Collection[]>(url));
    this.collections.set(rows);
  }

  async addCollection(data: CollectionInput) {
    await firstValueFrom(this.http.post(`${this.api}/collections`, data));
    await Promise.all([this.loadCashboxes(), this.loadCollections(), this.loadSummary()]);
  }

  async deleteCollection(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/collections/${id}`));
    await Promise.all([this.loadCashboxes(), this.loadCollections(), this.loadSummary()]);
  }

  // ---------- Expenses ----------
  async loadExpenses(params: { stationId?: string; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const url = qs.toString() ? `${this.api}/expenses?${qs}` : `${this.api}/expenses`;
    const rows = await firstValueFrom(this.http.get<Expense[]>(url));
    this.expenses.set(rows);
  }

  async addExpense(data: ExpenseInput) {
    await firstValueFrom(this.http.post(`${this.api}/expenses`, data));
    await Promise.all([this.loadCashboxes(), this.loadExpenses(), this.loadSummary()]);
  }

  async deleteExpense(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/expenses/${id}`));
    await Promise.all([this.loadCashboxes(), this.loadExpenses(), this.loadSummary()]);
  }

  // ---------- Transfers ----------
  async addTransfer(data: CashTransferInput) {
    await firstValueFrom(this.http.post(`${this.api}/transfers`, data));
    await this.loadCashboxes();
  }

  // ---------- Daily Closures ----------
  async loadDailyClosures(params: { stationId?: string; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const url = qs.toString() ? `${this.api}/closures?${qs}` : `${this.api}/closures`;
    const rows = await firstValueFrom(this.http.get<DailyClosure[]>(url));
    this.dailyClosures.set(rows);
  }

  async previewDailyClosure(stationId: string, date: string) {
    const qs = new URLSearchParams({ stationId, date });
    return firstValueFrom(this.http.get<DailyClosurePreview>(`${this.api}/closures/preview?${qs}`));
  }

  async createDailyClosure(data: DailyClosureInput) {
    await firstValueFrom(this.http.post(`${this.api}/closures`, data));
    await Promise.all([this.loadDailyClosures(), this.loadSummary()]);
  }

  async approveDailyClosure(id: string) {
    await firstValueFrom(this.http.put(`${this.api}/closures/${id}/approve`, {}));
    await this.loadDailyClosures();
  }

  // ---------- Categories ----------
  async loadCategories() {
    const rows = await firstValueFrom(this.http.get<ExpenseCategory[]>(`${this.api}/expense-categories`));
    this.categories.set(rows);
  }

  // ---------- Billing Systems ----------
  async loadBillingSystems() {
    const rows = await firstValueFrom(this.http.get<BillingSystem[]>(`${this.api}/billing-systems`));
    this.billingSystemsList.set(rows);
  }

  async addBillingSystem(data: BillingSystemInput) {
    await firstValueFrom(this.http.post(`${this.api}/billing-systems`, data));
    await this.loadBillingSystems();
  }

  async updateBillingSystem(id: string, data: Partial<BillingSystemInput>) {
    await firstValueFrom(this.http.put(`${this.api}/billing-systems/${id}`, data));
    await this.loadBillingSystems();
  }

  async deleteBillingSystem(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/billing-systems/${id}`));
    await this.loadBillingSystems();
  }

  billingSystemTypeLabel(t: BillingSystemType): string {
    const map: Record<BillingSystemType, string> = {
      ecas: 'ECAS',
      hexcell: 'Hexcell',
      manual: 'يدوي',
      other: 'أخرى',
    };
    return map[t] ?? t;
  }

  // ---------- Summary ----------
  async loadSummary(date?: string) {
    const url = date ? `${this.api}/summary?date=${date}` : `${this.api}/summary`;
    const s = await firstValueFrom(this.http.get<DailySummary>(url));
    this.summary.set(s);
  }

  // ---- labels ----
  typeLabel(type: CashboxType): string {
    const map: Record<CashboxType, string> = {
      station: 'صندوق محطة',
      exchange: 'صرّاف',
      wallet: 'محفظة رقمية',
      bank: 'بنك',
    };
    return map[type] ?? type;
  }

  walletLabel(provider: WalletProvider | null): string {
    if (!provider) return '';
    const map: Record<WalletProvider, string> = {
      jawali: 'جوالي',
      kuraimi: 'الكريمي',
      mfloos: 'M-Floos',
      jeeb: 'جيب',
      other: 'أخرى',
    };
    return map[provider] ?? provider;
  }

  paymentMethodLabel(m: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = {
      cash: 'نقدي',
      wallet: 'محفظة رقمية',
      hexcell: 'Hexcell',
      other: 'أخرى',
    };
    return map[m] ?? m;
  }

  closureStatusLabel(status: DailyClosureStatus): string {
    const map: Record<DailyClosureStatus, string> = {
      draft: 'مسودة',
      closed: 'مغلق',
      approved: 'معتمد',
    };
    return map[status] ?? status;
  }

  formatMoney(amount: number | string | null | undefined, currency: Currency = 'YER'): string {
    const n = Number(amount ?? 0);
    const formatted = new Intl.NumberFormat('ar-YE', { maximumFractionDigits: 0 }).format(n);
    const suffix = currency === 'YER' ? 'ريال' : currency;
    return `${formatted} ${suffix}`;
  }

  shortStation(name: string | null | undefined): string {
    return shortenStationName(name);
  }
}
