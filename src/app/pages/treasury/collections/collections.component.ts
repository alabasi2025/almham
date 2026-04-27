import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import {
  TreasuryService,
  CashboxBalance,
  PaymentMethod,
  BillingSystem,
} from '../../../services/treasury.service';
import {
  BillingAccount,
  BillingCollector,
  BillingService,
} from '../../../services/billing.service';
import { StationService } from '../../../services/station.service';
import { AuthService } from '../../../services/auth.service';

interface CollectorInput {
  collector: BillingCollector;
  amount: number | null;
  notes: string;
}

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './collections.component.html',
  styleUrls: ['./collections.component.scss'],
})
export class CollectionsComponent implements OnInit {
  treasury = inject(TreasuryService);
  billing = inject(BillingService);
  stationService = inject(StationService);
  auth = inject(AuthService);

  showForm = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  stationFilter = signal<string>('all');
  paymentFilter = signal<'all' | PaymentMethod>('all');
  searchQuery = signal('');

  formDate = signal<string>(this.todayISO());
  formStationId = signal<string>('');
  formBillingSystemId = signal<string>('');
  formBillingAccountId = signal<string>('');
  formCashboxId = signal<string>('');
  formNotes = signal<string>('');
  collectorRows = signal<CollectorInput[]>([]);

  allowedStations = computed(() => {
    const user = this.auth.user();
    if (!user?.stationId || this.auth.canManageUsers()) return this.stationService.stations();
    return this.stationService.stations().filter((station) => station.id === user.stationId);
  });

  activeCollectorRows = computed(() => this.collectorRows().filter((row) => Number(row.amount || 0) > 0));

  formTotal = computed(() => {
    return this.activeCollectorRows().reduce((sum, row) => sum + Number(row.amount || 0), 0);
  });

  async ngOnInit() {
    await Promise.all([
      this.treasury.loadCashboxes(),
      this.treasury.loadCollections(),
      this.treasury.loadBillingSystems(),
      this.billing.loadSystems(),
      this.billing.loadAccounts(),
      this.billing.loadBatches(),
      this.stationService.stations().length === 0 ? Promise.resolve(this.stationService.loadAll()) : Promise.resolve(),
    ]);

    const initialStationId = this.defaultStationId();
    if (initialStationId) {
      await this.onStationChange(initialStationId);
    }
  }

  availableBillingSystems(): BillingSystem[] {
    const stationId = this.formStationId();
    return this.billing.systems().filter(
      (system) => system.isActive && (!system.stationId || system.stationId === stationId),
    );
  }

  availableCollectionAccounts(): BillingAccount[] {
    const systemId = this.formBillingSystemId();
    return this.billing.accounts().filter(
      (account) =>
        account.isActive &&
        account.type === 'collection' &&
        (!systemId || account.billingSystemId === systemId),
    );
  }

  stationCashboxes(): CashboxBalance[] {
    const stationId = this.formStationId();
    return this.treasury.cashboxes().filter(
      (box) => box.isActive && box.type === 'station' && box.stationId === stationId,
    );
  }

  private todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private defaultStationId(): string {
    const currentUser = this.auth.user();
    return (
      currentUser?.stationId ||
      this.allowedStations()[0]?.id ||
      this.treasury.cashboxes().find((box) => box.type === 'station' && box.stationId)?.stationId ||
      ''
    );
  }

  private chooseDefaults() {
    const systems = this.availableBillingSystems();
    const currentSystemValid = systems.some((system) => system.id === this.formBillingSystemId());
    if (!currentSystemValid) {
      const primaryStationSystem = systems.find(
        (system) => system.stationId === this.formStationId() && system.name.includes('نظام الفوترة الأساسي'),
      );
      const stationSystem = systems.find((system) => system.stationId === this.formStationId());
      this.formBillingSystemId.set(primaryStationSystem?.id || stationSystem?.id || systems[0]?.id || '');
    }

    const accounts = this.availableCollectionAccounts();
    const currentAccountValid = accounts.some((account) => account.id === this.formBillingAccountId());
    if (!currentAccountValid) {
      this.formBillingAccountId.set(accounts[0]?.id || '');
    }

    const boxes = this.stationCashboxes();
    const currentCashboxValid = boxes.some((box) => box.id === this.formCashboxId());
    if (!currentCashboxValid) {
      this.formCashboxId.set(boxes[0]?.id || '');
    }
  }

  private rebuildCollectorRows() {
    this.collectorRows.set(
      this.billing.collectors().map((collector) => ({
        collector,
        amount: null,
        notes: '',
      })),
    );
  }

  filtered = computed(() => {
    const rows = this.treasury.collections();
    const st = this.stationFilter();
    const pm = this.paymentFilter();
    const q = this.searchQuery().trim().toLowerCase();

    return rows.filter((r) => {
      if (st !== 'all' && r.stationId !== st) return false;
      if (pm !== 'all' && r.paymentMethod !== pm) return false;
      if (q) {
        return (
          (r.subscriberName ?? '').toLowerCase().includes(q) ||
          (r.meterNumber ?? '').toLowerCase().includes(q) ||
          (r.cashboxName ?? '').toLowerCase().includes(q) ||
          (r.collectorName ?? '').toLowerCase().includes(q) ||
          (r.billingSystemName ?? '').toLowerCase().includes(q) ||
          (r.billingAccountName ?? '').toLowerCase().includes(q) ||
          (r.receiptCode ?? '').toLowerCase().includes(q) ||
          (r.notes ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  });

  totalsForFiltered = computed(() => {
    const rows = this.filtered();
    return {
      count: rows.length,
      total: rows.reduce((s, r) => s + Number(r.amount), 0),
    };
  });

  async openForm() {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.formDate.set(this.todayISO());
    this.formNotes.set('');
    if (!this.formStationId()) {
      const initialStationId = this.defaultStationId();
      if (initialStationId) await this.onStationChange(initialStationId);
    } else {
      this.chooseDefaults();
      this.resetCollectorAmounts();
    }
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.errorMsg.set(null);
  }

  async onStationChange(stationId: string) {
    this.formStationId.set(stationId);
    this.errorMsg.set(null);
    this.successMsg.set(null);
    if (stationId) {
      await this.billing.loadCollectors(stationId);
      this.rebuildCollectorRows();
    } else {
      this.collectorRows.set([]);
    }
    this.chooseDefaults();
  }

  onBillingSystemChange(systemId: string) {
    this.formBillingSystemId.set(systemId);
    this.formBillingAccountId.set('');
    this.chooseDefaults();
  }

  setAmount(idx: number, value: string | number | null) {
    const arr = [...this.collectorRows()];
    const n = value == null || value === '' ? null : Number(value);
    if (arr[idx]) {
      arr[idx] = { ...arr[idx], amount: Number.isFinite(n as number) ? (n as number) : null };
      this.collectorRows.set(arr);
    }
  }

  setNotes(idx: number, value: string) {
    const arr = [...this.collectorRows()];
    if (arr[idx]) {
      arr[idx] = { ...arr[idx], notes: value };
      this.collectorRows.set(arr);
    }
  }

  resetCollectorAmounts() {
    this.collectorRows.set(this.collectorRows().map((row) => ({ ...row, amount: null, notes: '' })));
  }

  async save() {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (!this.formStationId()) {
      this.errorMsg.set('اختر المحطة أولاً');
      return;
    }
    if (!this.formBillingSystemId()) {
      this.errorMsg.set('اختر نظام الفوترة');
      return;
    }
    if (!this.formBillingAccountId()) {
      this.errorMsg.set('اختر حساب التحصيل');
      return;
    }
    if (!this.formCashboxId()) {
      this.errorMsg.set('اختر صندوق الاستلام');
      return;
    }
    if (this.activeCollectorRows().length === 0) {
      this.errorMsg.set('أدخل مبلغاً لمتحصل واحد على الأقل');
      return;
    }

    this.saving.set(true);
    try {
      await this.billing.createCollectorBatch({
        stationId: this.formStationId(),
        billingSystemId: this.formBillingSystemId(),
        billingAccountId: this.formBillingAccountId(),
        cashboxId: this.formCashboxId(),
        collectionDate: this.formDate(),
        notes: this.formNotes() || null,
        entries: this.activeCollectorRows().map((row) => ({
          collectorEmployeeId: row.collector.id,
          amount: row.amount!,
          notes: row.notes || null,
        })),
      });
      await Promise.all([
        this.treasury.loadCashboxes(),
        this.treasury.loadCollections(),
        this.treasury.loadSummary(),
        this.billing.loadBatches(),
      ]);
      this.successMsg.set(
        `تم حفظ تحصيلات ${this.activeCollectorRows().length} متحصل بإجمالي ${this.treasury.formatMoney(this.formTotal())}`,
      );
      this.formNotes.set('');
      this.resetCollectorAmounts();
      setTimeout(() => {
        this.successMsg.set(null);
        this.closeForm();
      }, 1200);
    } catch (err: unknown) {
      this.errorMsg.set(this.extractError(err) || 'تعذّر حفظ تحصيلات المتحصلين');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: string) {
    if (!confirm('حذف هذا السند؟ سيتم تعديل رصيد الصندوق.')) return;
    try {
      await this.treasury.deleteCollection(id);
    } catch (err: unknown) {
      alert(this.extractError(err) || 'تعذّر الحذف');
    }
  }

  formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('ar-YE', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  isNonZero(amount: number | null | undefined): boolean {
    return Number(amount ?? 0) > 0;
  }

  collectorInitial(name: string): string {
    return name.trim().slice(0, 1) || 'م';
  }

  paymentIcon(m: PaymentMethod): string {
    return {
      cash: 'payments',
      wallet: 'smartphone',
      hexcell: 'qr_code_2',
      other: 'more_horiz',
    }[m];
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
