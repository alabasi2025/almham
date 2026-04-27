import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import {
  TreasuryService,
  CashboxType,
  BillingSystem,
  BillingSystemInput,
  BillingSystemType,
  DailyClosurePreview,
} from '../../services/treasury.service';
import {
  BillingAccount,
  BillingAccountInput,
  BillingAccountType,
  BillingService,
} from '../../services/billing.service';
import { StationService } from '../../services/station.service';
import { AuthService } from '../../services/auth.service';

type TypeFilter = 'all' | CashboxType;
type MainTab = 'cashboxes' | 'closures' | 'billing';

@Component({
  selector: 'app-treasury',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './treasury.component.html',
  styleUrls: ['./treasury.component.scss'],
})
export class TreasuryComponent implements OnInit {
  treasury = inject(TreasuryService);
  billing = inject(BillingService);
  stationService = inject(StationService);
  auth = inject(AuthService);
  private router = inject(Router);

  activeTab = signal<MainTab>('cashboxes');
  typeFilter = signal<TypeFilter>('all');
  today = signal(new Date().toISOString().slice(0, 10));

  // Billing systems form state
  showBillingForm = signal(false);
  editingBilling = signal<BillingSystem | null>(null);
  savingBilling = signal(false);
  billingError = signal<string | null>(null);
  billingForm: BillingSystemInput = this.emptyBillingForm();

  showBillingAccountForm = signal(false);
  editingBillingAccount = signal<BillingAccount | null>(null);
  savingBillingAccount = signal(false);
  billingAccountError = signal<string | null>(null);
  billingAccountForm: BillingAccountInput = this.emptyBillingAccountForm();

  showClosureForm = signal(false);
  savingClosure = signal(false);
  loadingClosurePreview = signal(false);
  closureError = signal<string | null>(null);
  closureSuccess = signal<string | null>(null);
  closurePreview = signal<DailyClosurePreview | null>(null);
  closureForm = {
    stationId: '',
    closureDate: this.todayISO(),
    actualTotal: 0,
    notes: '',
  };

  async ngOnInit() {
    await Promise.all([
      this.treasury.loadCashboxes(),
      this.treasury.loadSummary(),
      this.treasury.loadCollections(),
      this.treasury.loadExpenses(),
      this.treasury.loadBillingSystems(),
      this.billing.loadAccounts(),
      this.treasury.loadDailyClosures(),
      this.stationService.stations().length === 0 ? this.stationService.loadAll() : Promise.resolve(),
    ]);

    if (this.router.url.startsWith('/treasury/billing')) {
      this.activeTab.set('billing');
    }

    const currentUser = this.auth.user();
    if (currentUser?.stationId) {
      this.closureForm.stationId = currentUser.stationId;
    } else if (!this.closureForm.stationId && this.stationService.stations().length > 0) {
      this.closureForm.stationId = this.stationService.stations()[0].id;
    }
  }

  private todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private emptyBillingForm(): BillingSystemInput {
    return {
      name: '',
      code: null,
      type: 'ecas',
      stationId: null,
      icon: 'storage',
      color: '#0ea5e9',
      isActive: true,
      notes: null,
    };
  }

  filtered = computed(() => {
    const t = this.typeFilter();
    const all = this.treasury.cashboxes();
    return t === 'all' ? all : all.filter((c) => c.type === t);
  });

  allowedStations = computed(() => {
    const user = this.auth.user();
    if (!user?.stationId || this.auth.canManageUsers()) return this.stationService.stations();
    return this.stationService.stations().filter((station) => station.id === user.stationId);
  });

  stationsBalance = computed(() => this.treasury.balanceByType()['station'] ?? 0);
  exchangesBalance = computed(() => this.treasury.balanceByType()['exchange'] ?? 0);
  walletsBalance = computed(() => this.treasury.balanceByType()['wallet'] ?? 0);

  countByType(type: CashboxType): number {
    return this.treasury.cashboxes().filter((c) => c.type === type).length;
  }

  cashboxIcon(c: { type: CashboxType; walletProvider: string | null }): string {
    if (c.type === 'station') return 'account_balance_wallet';
    if (c.type === 'exchange') return 'store';
    if (c.type === 'wallet') {
      if (c.walletProvider === 'jawali') return 'smartphone';
      return 'account_balance_wallet';
    }
    if (c.type === 'bank') return 'account_balance';
    return 'account_balance_wallet';
  }

  cashboxGradient(c: { type: CashboxType; walletProvider: string | null }): string {
    if (c.type === 'station') return 'linear-gradient(135deg, #059669, #047857)';
    if (c.type === 'exchange') return 'linear-gradient(135deg, #d97706, #b45309)';
    if (c.type === 'wallet') {
      const map: Record<string, string> = {
        jawali: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
        kuraimi: 'linear-gradient(135deg, #0891b2, #0e7490)',
        mfloos: 'linear-gradient(135deg, #db2777, #9f1239)',
        jeeb: 'linear-gradient(135deg, #2563eb, #1e40af)',
      };
      return map[c.walletProvider ?? 'other'] ?? 'linear-gradient(135deg, #64748b, #475569)';
    }
    return 'linear-gradient(135deg, #64748b, #475569)';
  }

  refresh() {
    this.treasury.loadCashboxes();
    this.treasury.loadSummary();
    this.treasury.loadBillingSystems();
    this.treasury.loadDailyClosures();
  }

  // ============ Daily Closures Tab ============
  closureVariance = computed(() => {
    const preview = this.closurePreview();
    if (!preview) return 0;
    return Number(this.closureForm.actualTotal || 0) - preview.expectedTotal;
  });

  openClosureForm() {
    this.closureError.set(null);
    this.closureSuccess.set(null);
    this.closureForm = {
      stationId: this.auth.user()?.stationId || this.allowedStations()[0]?.id || '',
      closureDate: this.todayISO(),
      actualTotal: 0,
      notes: '',
    };
    this.showClosureForm.set(true);
    this.loadClosurePreview();
  }

  closeClosureForm() {
    this.showClosureForm.set(false);
    this.closureError.set(null);
    this.closureSuccess.set(null);
  }

  async onClosureFilterChange() {
    await this.loadClosurePreview();
  }

  async loadClosurePreview() {
    this.closurePreview.set(null);
    if (!this.closureForm.stationId || !this.closureForm.closureDate) return;
    this.loadingClosurePreview.set(true);
    this.closureError.set(null);
    try {
      const preview = await this.treasury.previewDailyClosure(
        this.closureForm.stationId,
        this.closureForm.closureDate,
      );
      this.closurePreview.set(preview);
      this.closureForm.actualTotal = preview.expectedTotal;
    } catch (err: unknown) {
      this.closureError.set(this.extractError(err) || 'تعذّرت معاينة الإقفال');
    } finally {
      this.loadingClosurePreview.set(false);
    }
  }

  async saveClosure() {
    this.closureError.set(null);
    this.closureSuccess.set(null);
    if (!this.closureForm.stationId) {
      this.closureError.set('اختر المحطة');
      return;
    }
    const actualTotal = Number(this.closureForm.actualTotal);
    if (!Number.isFinite(actualTotal) || actualTotal < 0) {
      this.closureError.set('أدخل المبلغ الفعلي بشكل صحيح');
      return;
    }

    this.savingClosure.set(true);
    try {
      await this.treasury.createDailyClosure({
        stationId: this.closureForm.stationId,
        closureDate: this.closureForm.closureDate,
        actualTotal,
        notes: this.closureForm.notes || null,
      });
      this.closureSuccess.set('تم إقفال اليوم بنجاح');
      await this.loadClosurePreview();
      setTimeout(() => this.closeClosureForm(), 900);
    } catch (err: unknown) {
      this.closureError.set(this.extractError(err) || 'تعذّر حفظ الإقفال');
    } finally {
      this.savingClosure.set(false);
    }
  }

  async approveClosure(id: string) {
    try {
      await this.treasury.approveDailyClosure(id);
    } catch (err: unknown) {
      alert(this.extractError(err) || 'تعذّر اعتماد الإقفال');
    }
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

  isNegativeAmount(amount: number | string | null | undefined): boolean {
    return Number(amount ?? 0) < 0;
  }

  // ============ Billing Systems Tab ============
  readonly billingTypeKeys: BillingSystemType[] = ['ecas', 'hexcell', 'manual', 'other'];
  readonly billingAccountTypeKeys: BillingAccountType[] = ['collection', 'sales', 'settlement'];

  billingByType = computed(() => {
    const all = this.treasury.billingSystemsList();
    const grouped: Record<BillingSystemType, BillingSystem[]> = {
      ecas: [],
      hexcell: [],
      manual: [],
      other: [],
    };
    for (const bs of all) {
      grouped[bs.type].push(bs);
    }
    return grouped;
  });

  billingAccountCount = computed(() => this.billing.accounts().length);

  billingAccountsFor(systemId: string): BillingAccount[] {
    return this.billing.accounts().filter((account) => account.billingSystemId === systemId);
  }

  billingGroupColor(type: BillingSystemType): string {
    return {
      ecas: '#0ea5e9',
      hexcell: '#2563eb',
      manual: '#64748b',
      other: '#94a3b8',
    }[type];
  }

  billingIcon(bs: BillingSystem): string {
    if (bs.icon) return bs.icon;
    return {
      ecas: 'storage',
      hexcell: 'qr_code_2',
      manual: 'edit_note',
      other: 'extension',
    }[bs.type];
  }

  billingColor(bs: BillingSystem): string {
    if (bs.color) return bs.color;
    return {
      ecas: '#0ea5e9',
      hexcell: '#2563eb',
      manual: '#64748b',
      other: '#94a3b8',
    }[bs.type];
  }

  accountTypeLabel(type: BillingAccountType | null | undefined): string {
    return this.billing.accountTypeLabel(type);
  }

  accountTypeIcon(type: BillingAccountType | null | undefined): string {
    const map: Record<BillingAccountType, string> = {
      collection: 'payments',
      sales: 'point_of_sale',
      settlement: 'sync_alt',
    };
    return type ? map[type] ?? 'account_tree' : 'account_tree';
  }

  private emptyBillingAccountForm(systemId = ''): BillingAccountInput {
    return {
      billingSystemId: systemId,
      name: 'حساب التحصيل',
      code: null,
      type: 'collection',
      isActive: true,
      notes: null,
    };
  }

  openBillingForm(bs?: BillingSystem) {
    this.billingError.set(null);
    if (bs) {
      this.editingBilling.set(bs);
      this.billingForm = {
        name: bs.name,
        code: bs.code,
        type: bs.type,
        stationId: bs.stationId,
        icon: bs.icon,
        color: bs.color,
        isActive: bs.isActive,
        notes: bs.notes,
      };
    } else {
      this.editingBilling.set(null);
      this.billingForm = this.emptyBillingForm();
    }
    this.showBillingForm.set(true);
  }

  closeBillingForm() {
    this.showBillingForm.set(false);
    this.editingBilling.set(null);
    this.billingError.set(null);
  }

  openBillingAccountForm(system?: BillingSystem, account?: BillingAccount) {
    this.billingAccountError.set(null);
    if (account) {
      this.editingBillingAccount.set(account);
      this.billingAccountForm = {
        billingSystemId: account.billingSystemId,
        name: account.name,
        code: account.code,
        type: account.type,
        isActive: account.isActive,
        notes: account.notes,
      };
    } else {
      this.editingBillingAccount.set(null);
      this.billingAccountForm = this.emptyBillingAccountForm(system?.id ?? '');
    }
    this.showBillingAccountForm.set(true);
  }

  closeBillingAccountForm() {
    this.showBillingAccountForm.set(false);
    this.editingBillingAccount.set(null);
    this.billingAccountError.set(null);
  }

  onBillingAccountTypeChange() {
    if (!this.billingAccountForm.name || this.billingAccountForm.name.startsWith('حساب ')) {
      this.billingAccountForm.name = this.accountTypeLabel(this.billingAccountForm.type);
    }
  }

  async saveBillingAccount() {
    this.billingAccountError.set(null);
    if (!this.billingAccountForm.billingSystemId) {
      this.billingAccountError.set('اختر نظام الفوترة');
      return;
    }
    if (!this.billingAccountForm.name || this.billingAccountForm.name.trim().length < 2) {
      this.billingAccountError.set('أدخل اسم الحساب');
      return;
    }

    this.savingBillingAccount.set(true);
    try {
      const editing = this.editingBillingAccount();
      if (editing) {
        await this.billing.updateAccount(editing.id, this.billingAccountForm);
      } else {
        await this.billing.createAccount(this.billingAccountForm);
      }
      this.closeBillingAccountForm();
    } catch (err: unknown) {
      this.billingAccountError.set(this.extractError(err) || 'تعذّر حفظ حساب الفوترة');
    } finally {
      this.savingBillingAccount.set(false);
    }
  }

  async toggleBillingAccountActive(account: BillingAccount) {
    try {
      await this.billing.updateAccount(account.id, { isActive: !account.isActive });
    } catch (err: unknown) {
      alert(this.extractError(err) || 'تعذّر تحديث الحساب');
    }
  }

  onBillingTypeChange() {
    // Auto-fill icon/color based on type
    const defaults: Record<BillingSystemType, { icon: string; color: string }> = {
      ecas: { icon: 'storage', color: '#0ea5e9' },
      hexcell: { icon: 'qr_code_2', color: '#2563eb' },
      manual: { icon: 'edit_note', color: '#64748b' },
      other: { icon: 'extension', color: '#94a3b8' },
    };
    const d = defaults[this.billingForm.type];
    this.billingForm.icon = d.icon;
    this.billingForm.color = d.color;
  }

  async saveBillingSystem() {
    this.billingError.set(null);
    if (!this.billingForm.name || this.billingForm.name.trim().length < 2) {
      this.billingError.set('أدخل اسم النظام');
      return;
    }

    this.savingBilling.set(true);
    try {
      const editing = this.editingBilling();
      if (editing) {
        await this.treasury.updateBillingSystem(editing.id, this.billingForm);
      } else {
        await this.treasury.addBillingSystem(this.billingForm);
      }
      this.closeBillingForm();
    } catch (err: unknown) {
      this.billingError.set(this.extractError(err) || 'تعذّر الحفظ');
    } finally {
      this.savingBilling.set(false);
    }
  }

  async toggleBillingActive(bs: BillingSystem) {
    try {
      await this.treasury.updateBillingSystem(bs.id, { isActive: !bs.isActive });
    } catch (err: unknown) {
      alert(this.extractError(err) || 'تعذّر التحديث');
    }
  }

  async removeBillingSystem(bs: BillingSystem) {
    if (!confirm(`هل تريد حذف "${bs.name}"؟`)) return;
    try {
      await this.treasury.deleteBillingSystem(bs.id);
    } catch (err: unknown) {
      alert(this.extractError(err) || 'تعذّر الحذف');
    }
  }

  private extractError(err: unknown): string | null {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const body = (err as { error?: { error?: string } }).error;
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    }
    return null;
  }
}
