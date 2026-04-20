import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { StationService } from '../../services/station.service';
import { EmployeeService } from '../../services/employee.service';
import { FuelService } from '../../services/fuel.service';
import { Tank, TankRole, TankMaterial, Pump, PumpChannel, Generator, FuelReceipt, FuelTransfer, GeneratorConsumption } from '../../models/fuel.model';

interface TankForm {
  id?: string;
  name: string;
  role: TankRole;
  material: TankMaterial;
  capacityL: number;
  notes: string;
}

interface PumpForm {
  id?: string;
  name: string;
  inletsCount: number;
  outletsCount: number;
  metersCount: number;
  notes: string;
}

interface ChannelForm {
  id?: string;
  pumpId: string;
  channelIndex: number;
  sourceTankId: string | null;
  destinationTankId: string | null;
  meterLabel: string;
}

interface GeneratorForm {
  id?: string;
  name: string;
  model: string;
  capacityKw: number;
  isBackup: boolean;
  rocketTankId: string | null;
  notes: string;
}

interface ReceiptForm {
  supplierId: string | null;
  supplierSiteId: string | null;
  tankerId: string | null;
  receiverEmployeeId: string | null;
  receivingTankId: string | null;
  supplierRepName: string;
  meterBefore: number | null;
  meterAfter: number | null;
  compartmentsFilled: number[];
  totalLiters: number;
  voucherNumber: string;
  voucherOriginalHolder: string;
  notes: string;
}

interface TransferForm {
  sourceTankId: string | null;
  destinationTankId: string | null;
  pumpChannelId: string | null;
  meterReadingBefore: number | null;
  meterReadingAfter: number | null;
  liters: number;
  operatorEmployeeId: string | null;
  notes: string;
}

interface ConsumptionForm {
  generatorId: string | null;
  liters: number;
  hoursRun: number | null;
  operatorEmployeeId: string | null;
  notes: string;
}

@Component({
  selector: 'app-fuel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
  ],
  templateUrl: './fuel.component.html',
  styleUrls: ['./fuel.component.scss'],
})
export class FuelComponent implements OnInit {
  stationService = inject(StationService);
  employeeService = inject(EmployeeService);
  fuel = inject(FuelService);

  selectedStationId = signal<string | null>(null);
  activeTab = signal<'overview' | 'tanks' | 'pumps' | 'tankers' | 'receipts' | 'transfers' | 'consumption'>('overview');

  tabs = [
    { id: 'overview' as const,    label: 'نظرة عامة',     icon: 'dashboard' },
    { id: 'tanks' as const,       label: 'الخزانات',         icon: 'storage' },
    { id: 'pumps' as const,       label: 'الطرمبات',        icon: 'settings_input_component' },
    { id: 'tankers' as const,     label: 'الوايتات',        icon: 'local_shipping' },
    { id: 'receipts' as const,    label: 'سندات الاستلام',  icon: 'receipt_long' },
    { id: 'transfers' as const,   label: 'التحويلات',       icon: 'swap_horiz' },
    { id: 'consumption' as const, label: 'الاستهلاك',        icon: 'whatshot' },
  ];

  tabBadge(id: string): number {
    switch (id) {
      case 'tanks': return this.stationTanks().length;
      case 'pumps': return this.stationPumps().length;
      case 'tankers': return this.fuel.tankers().length;
      case 'receipts': return this.stationReceipts().length;
      case 'transfers': return this.stationTransfers().length;
      case 'consumption': return this.stationConsumption().length;
      default: return 0;
    }
  }

  // Forms
  tankForm: TankForm = this.emptyTankForm();
  editingTankId = signal<string | null>(null);
  showTankForm = signal(false);

  pumpForm: PumpForm = this.emptyPumpForm();
  editingPumpId = signal<string | null>(null);
  showPumpForm = signal(false);

  channelForm: ChannelForm = this.emptyChannelForm();
  showChannelForm = signal(false);

  generatorForm: GeneratorForm = this.emptyGeneratorForm();
  editingGeneratorId = signal<string | null>(null);
  showGeneratorForm = signal(false);

  receiptForm: ReceiptForm = this.emptyReceiptForm();
  showReceiptForm = signal(false);

  transferForm: TransferForm = this.emptyTransferForm();
  showTransferForm = signal(false);

  consumptionForm: ConsumptionForm = this.emptyConsumptionForm();
  showConsumptionForm = signal(false);

  supplierName = signal('');
  supplierPhone = signal('');
  showSupplierForm = signal(false);
  supplierSiteName = signal('');
  selectedSupplierForSite = signal<string | null>(null);

  tankerPlate = signal('');
  tankerDriver = signal('');
  tankerCompartments = signal('');
  showTankerForm = signal(false);

  // Computed filtered lists for the selected station
  stationTanks = computed(() => {
    const id = this.selectedStationId();
    return id ? this.fuel.tanks().filter((t) => t.stationId === id) : [];
  });

  stationPumps = computed(() => {
    const id = this.selectedStationId();
    return id ? this.fuel.pumps().filter((p) => p.stationId === id) : [];
  });

  stationGenerators = computed(() => {
    const id = this.selectedStationId();
    return id ? this.fuel.generators().filter((g) => g.stationId === id) : [];
  });

  stationEmployees = computed(() => {
    const id = this.selectedStationId();
    return this.employeeService.employees().filter((e) => !id || e.stationId === id || e.stationId === null);
  });

  ngOnInit(): void {
    this.loadAll();
  }

  async loadAll() {
    await Promise.all([
      this.fuel.loadSuppliers(),
      this.fuel.loadSupplierSites(),
      this.fuel.loadTankers(),
      this.fuel.loadTanks(),
      this.fuel.loadPumps(),
      this.fuel.loadPumpChannels(),
      this.fuel.loadGenerators(),
      this.fuel.loadReceipts(),
      this.fuel.loadTransfers(),
      this.fuel.loadConsumption(),
    ]);

    if (!this.selectedStationId() && this.stationService.stations().length > 0) {
      this.selectStation(this.stationService.stations()[0].id);
    }
  }

  async selectStation(stationId: string) {
    this.selectedStationId.set(stationId);
    await this.fuel.loadLevels(stationId);
  }

  // ---------------- Tank ----------------
  emptyTankForm(): TankForm {
    return { name: '', role: 'receiving', material: 'other', capacityL: 0, notes: '' };
  }
  openTankForm(): void {
    this.tankForm = this.emptyTankForm();
    this.editingTankId.set(null);
    this.showTankForm.set(true);
  }
  editTank(t: Tank): void {
    this.tankForm = {
      id: t.id,
      name: t.name,
      role: t.role,
      material: t.material,
      capacityL: t.capacityL,
      notes: t.notes ?? '',
    };
    this.editingTankId.set(t.id);
    this.showTankForm.set(true);
  }
  async saveTank() {
    const stationId = this.selectedStationId();
    if (!stationId || !this.tankForm.name) return;
    const payload: Partial<Tank> = {
      stationId,
      name: this.tankForm.name,
      role: this.tankForm.role,
      material: this.tankForm.material,
      capacityL: Number(this.tankForm.capacityL),
      notes: this.tankForm.notes || null,
    };
    const id = this.editingTankId();
    if (id) await this.fuel.updateTank(id, payload);
    else await this.fuel.addTank(payload);
    this.showTankForm.set(false);
    await this.fuel.loadLevels(stationId);
  }
  async deleteTank(id: string) {
    if (!confirm('هل تريد حذف هذا الخزان؟')) return;
    await this.fuel.deleteTank(id);
    const s = this.selectedStationId();
    if (s) await this.fuel.loadLevels(s);
  }

  // ---------------- Pump ----------------
  emptyPumpForm(): PumpForm {
    return { name: '', inletsCount: 1, outletsCount: 1, metersCount: 1, notes: '' };
  }
  openPumpForm(): void {
    this.pumpForm = this.emptyPumpForm();
    this.editingPumpId.set(null);
    this.showPumpForm.set(true);
  }
  editPump(p: Pump): void {
    this.pumpForm = {
      id: p.id,
      name: p.name,
      inletsCount: p.inletsCount,
      outletsCount: p.outletsCount,
      metersCount: p.metersCount,
      notes: p.notes ?? '',
    };
    this.editingPumpId.set(p.id);
    this.showPumpForm.set(true);
  }
  async savePump() {
    const stationId = this.selectedStationId();
    if (!stationId || !this.pumpForm.name) return;
    const payload: Partial<Pump> = {
      stationId,
      name: this.pumpForm.name,
      inletsCount: Number(this.pumpForm.inletsCount),
      outletsCount: Number(this.pumpForm.outletsCount),
      metersCount: Number(this.pumpForm.metersCount),
      notes: this.pumpForm.notes || null,
    };
    const id = this.editingPumpId();
    if (id) await this.fuel.updatePump(id, payload);
    else await this.fuel.addPump(payload);
    this.showPumpForm.set(false);
  }
  async deletePump(id: string) {
    if (!confirm('هل تريد حذف هذه الطرمبة؟')) return;
    await this.fuel.deletePump(id);
  }

  // ---------------- Channel ----------------
  emptyChannelForm(): ChannelForm {
    return { pumpId: '', channelIndex: 1, sourceTankId: null, destinationTankId: null, meterLabel: '' };
  }
  openChannelForm(pumpId: string): void {
    this.channelForm = { ...this.emptyChannelForm(), pumpId };
    this.showChannelForm.set(true);
  }
  async saveChannel() {
    if (!this.channelForm.pumpId) return;
    const payload: Partial<PumpChannel> = {
      pumpId: this.channelForm.pumpId,
      channelIndex: Number(this.channelForm.channelIndex),
      sourceTankId: this.channelForm.sourceTankId,
      destinationTankId: this.channelForm.destinationTankId,
      meterLabel: this.channelForm.meterLabel || null,
    };
    await this.fuel.addPumpChannel(payload);
    this.showChannelForm.set(false);
  }
  async deleteChannel(id: string) {
    if (!confirm('هل تريد حذف هذه القناة؟')) return;
    await this.fuel.deletePumpChannel(id);
  }
  pumpChannelsFor(pumpId: string): PumpChannel[] {
    return this.fuel.pumpChannels().filter((c) => c.pumpId === pumpId);
  }

  // ---------------- Generator ----------------
  emptyGeneratorForm(): GeneratorForm {
    return { name: '', model: '', capacityKw: 0, isBackup: false, rocketTankId: null, notes: '' };
  }
  openGeneratorForm(): void {
    this.generatorForm = this.emptyGeneratorForm();
    this.editingGeneratorId.set(null);
    this.showGeneratorForm.set(true);
  }
  editGenerator(g: Generator): void {
    this.generatorForm = {
      id: g.id,
      name: g.name,
      model: g.model ?? '',
      capacityKw: g.capacityKw,
      isBackup: g.isBackup,
      rocketTankId: g.rocketTankId,
      notes: g.notes ?? '',
    };
    this.editingGeneratorId.set(g.id);
    this.showGeneratorForm.set(true);
  }
  async saveGenerator() {
    const stationId = this.selectedStationId();
    if (!stationId || !this.generatorForm.name) return;
    const payload: Partial<Generator> = {
      stationId,
      name: this.generatorForm.name,
      model: this.generatorForm.model || null,
      capacityKw: Number(this.generatorForm.capacityKw),
      isBackup: this.generatorForm.isBackup,
      rocketTankId: this.generatorForm.rocketTankId,
      notes: this.generatorForm.notes || null,
    };
    const id = this.editingGeneratorId();
    if (id) await this.fuel.updateGenerator(id, payload);
    else await this.fuel.addGenerator(payload);
    this.showGeneratorForm.set(false);
  }
  async deleteGenerator(id: string) {
    if (!confirm('هل تريد حذف هذا المولد؟')) return;
    await this.fuel.deleteGenerator(id);
  }

  // ---------------- Receipts ----------------
  emptyReceiptForm(): ReceiptForm {
    return {
      supplierId: null,
      supplierSiteId: null,
      tankerId: null,
      receiverEmployeeId: null,
      receivingTankId: null,
      supplierRepName: '',
      meterBefore: null,
      meterAfter: null,
      compartmentsFilled: [],
      totalLiters: 0,
      voucherNumber: '',
      voucherOriginalHolder: '',
      notes: '',
    };
  }
  openReceiptForm(): void {
    this.receiptForm = this.emptyReceiptForm();
    // Default receiving tank: first tank with role=receiving
    const rec = this.stationTanks().find((t) => t.role === 'receiving');
    if (rec) this.receiptForm.receivingTankId = rec.id;
    this.showReceiptForm.set(true);
  }
  onTankerSelected() {
    const t = this.fuel.tankers().find((x) => x.id === this.receiptForm.tankerId);
    if (t) {
      this.receiptForm.compartmentsFilled = [...t.compartments];
      this.recalcReceiptTotal();
    }
  }
  recalcReceiptTotal() {
    this.receiptForm.totalLiters = this.receiptForm.compartmentsFilled.reduce(
      (sum, v) => sum + Number(v || 0),
      0
    );
  }
  updateCompartment(idx: number, value: string) {
    const arr = [...this.receiptForm.compartmentsFilled];
    arr[idx] = Number(value || 0);
    this.receiptForm.compartmentsFilled = arr;
    this.recalcReceiptTotal();
  }
  async saveReceipt() {
    const stationId = this.selectedStationId();
    if (!stationId || !this.receiptForm.totalLiters) return;
    const payload: Partial<FuelReceipt> = {
      stationId,
      supplierId: this.receiptForm.supplierId,
      supplierSiteId: this.receiptForm.supplierSiteId,
      tankerId: this.receiptForm.tankerId,
      receiverEmployeeId: this.receiptForm.receiverEmployeeId,
      receivingTankId: this.receiptForm.receivingTankId,
      supplierRepName: this.receiptForm.supplierRepName || null,
      meterBefore: this.receiptForm.meterBefore != null ? String(this.receiptForm.meterBefore) : null,
      meterAfter: this.receiptForm.meterAfter != null ? String(this.receiptForm.meterAfter) : null,
      compartmentsFilled: this.receiptForm.compartmentsFilled,
      totalLiters: Number(this.receiptForm.totalLiters),
      voucherNumber: this.receiptForm.voucherNumber || null,
      voucherOriginalHolder: this.receiptForm.voucherOriginalHolder || null,
      notes: this.receiptForm.notes || null,
    };
    await this.fuel.addReceipt(payload);
    this.showReceiptForm.set(false);
    await this.fuel.loadLevels(stationId);
  }
  async deleteReceipt(id: string) {
    if (!confirm('هل تريد حذف هذا السند؟')) return;
    await this.fuel.deleteReceipt(id);
    const s = this.selectedStationId();
    if (s) await this.fuel.loadLevels(s);
  }
  stationReceipts() {
    const id = this.selectedStationId();
    return id ? this.fuel.receipts().filter((r) => r.stationId === id) : [];
  }

  // ---------------- Transfers ----------------
  emptyTransferForm(): TransferForm {
    return {
      sourceTankId: null,
      destinationTankId: null,
      pumpChannelId: null,
      meterReadingBefore: null,
      meterReadingAfter: null,
      liters: 0,
      operatorEmployeeId: null,
      notes: '',
    };
  }
  openTransferForm(): void {
    this.transferForm = this.emptyTransferForm();
    this.showTransferForm.set(true);
  }
  onChannelSelected() {
    const ch = this.fuel.pumpChannels().find((x) => x.id === this.transferForm.pumpChannelId);
    if (ch) {
      this.transferForm.sourceTankId = ch.sourceTankId;
      this.transferForm.destinationTankId = ch.destinationTankId;
    }
  }
  onMeterChange() {
    const b = Number(this.transferForm.meterReadingBefore ?? 0);
    const a = Number(this.transferForm.meterReadingAfter ?? 0);
    const diff = a - b;
    if (diff > 0) this.transferForm.liters = diff;
  }
  async saveTransfer() {
    const stationId = this.selectedStationId();
    if (!stationId || !this.transferForm.sourceTankId || !this.transferForm.destinationTankId || !this.transferForm.liters) return;
    const payload: Partial<FuelTransfer> = {
      stationId,
      sourceTankId: this.transferForm.sourceTankId,
      destinationTankId: this.transferForm.destinationTankId,
      pumpChannelId: this.transferForm.pumpChannelId,
      meterReadingBefore: this.transferForm.meterReadingBefore != null ? String(this.transferForm.meterReadingBefore) : null,
      meterReadingAfter: this.transferForm.meterReadingAfter != null ? String(this.transferForm.meterReadingAfter) : null,
      liters: Number(this.transferForm.liters),
      operatorEmployeeId: this.transferForm.operatorEmployeeId,
      notes: this.transferForm.notes || null,
    };
    await this.fuel.addTransfer(payload);
    this.showTransferForm.set(false);
    await this.fuel.loadLevels(stationId);
  }
  async deleteTransfer(id: string) {
    if (!confirm('هل تريد حذف هذا التحويل؟')) return;
    await this.fuel.deleteTransfer(id);
    const s = this.selectedStationId();
    if (s) await this.fuel.loadLevels(s);
  }
  stationTransfers() {
    const id = this.selectedStationId();
    return id ? this.fuel.transfers().filter((t) => t.stationId === id) : [];
  }
  channelsForStation(): PumpChannel[] {
    const pumpIds = this.stationPumps().map((p) => p.id);
    return this.fuel.pumpChannels().filter((c) => pumpIds.includes(c.pumpId));
  }

  // ---------------- Consumption ----------------
  emptyConsumptionForm(): ConsumptionForm {
    return { generatorId: null, liters: 0, hoursRun: null, operatorEmployeeId: null, notes: '' };
  }
  openConsumptionForm() {
    this.consumptionForm = this.emptyConsumptionForm();
    this.showConsumptionForm.set(true);
  }
  async saveConsumption() {
    const stationId = this.selectedStationId();
    if (!stationId || !this.consumptionForm.generatorId || !this.consumptionForm.liters) return;
    const payload: Partial<GeneratorConsumption> = {
      generatorId: this.consumptionForm.generatorId,
      liters: Number(this.consumptionForm.liters),
      hoursRun: this.consumptionForm.hoursRun != null ? String(this.consumptionForm.hoursRun) : null,
      operatorEmployeeId: this.consumptionForm.operatorEmployeeId,
      notes: this.consumptionForm.notes || null,
    };
    await this.fuel.addConsumption(payload);
    this.showConsumptionForm.set(false);
    await this.fuel.loadLevels(stationId);
  }
  async deleteConsumption(id: string) {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    await this.fuel.deleteConsumption(id);
    const s = this.selectedStationId();
    if (s) await this.fuel.loadLevels(s);
  }
  stationConsumption() {
    const genIds = this.stationGenerators().map((g) => g.id);
    return this.fuel.consumption().filter((c) => genIds.includes(c.generatorId));
  }

  // ---------------- Suppliers (quick) ----------------
  openSupplierForm() { this.showSupplierForm.set(true); this.supplierName.set(''); this.supplierPhone.set(''); }
  async saveSupplier() {
    if (!this.supplierName()) return;
    await this.fuel.addSupplier({ name: this.supplierName(), phone: this.supplierPhone() || null });
    this.showSupplierForm.set(false);
  }
  async deleteSupplier(id: string) {
    if (!confirm('حذف هذا المورد؟')) return;
    await this.fuel.deleteSupplier(id);
  }

  openSupplierSiteForm(supplierId: string) {
    this.selectedSupplierForSite.set(supplierId);
    this.supplierSiteName.set('');
  }
  async saveSupplierSite() {
    const supplierId = this.selectedSupplierForSite();
    if (!supplierId || !this.supplierSiteName()) return;
    await this.fuel.addSupplierSite({ supplierId, name: this.supplierSiteName() });
    this.selectedSupplierForSite.set(null);
  }
  sitesFor(supplierId: string) {
    return this.fuel.supplierSites().filter((s) => s.supplierId === supplierId);
  }
  async deleteSite(id: string) {
    if (!confirm('حذف الموقع؟')) return;
    await this.fuel.deleteSupplierSite(id);
  }

  // ---------------- Tankers ----------------
  openTankerForm() { this.showTankerForm.set(true); this.tankerPlate.set(''); this.tankerDriver.set(''); this.tankerCompartments.set(''); }
  async saveTanker() {
    if (!this.tankerPlate()) return;
    const comps = this.tankerCompartments()
      .split(/[,+\s]+/)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);
    await this.fuel.addTanker({ plate: this.tankerPlate(), driverName: this.tankerDriver() || null, compartments: comps });
    this.showTankerForm.set(false);
  }
  async deleteTanker(id: string) {
    if (!confirm('حذف الوايت؟')) return;
    await this.fuel.deleteTanker(id);
  }

  // ---------------- Helpers ----------------
  roleLabel(r: TankRole): string {
    switch (r) {
      case 'receiving': return 'خزان استلام';
      case 'main': return 'خزان رئيسي';
      case 'pre_pump': return 'خزان قبل الطرمبة';
      case 'generator': return 'خزان مولد';
    }
  }
  materialLabel(m: TankMaterial): string {
    switch (m) {
      case 'plastic': return 'بلاستيك';
      case 'steel': return 'حديد';
      case 'rocket': return 'صاروخ';
      case 'other': return 'أخرى';
    }
  }
  tankName(id: string | null): string {
    if (!id) return '—';
    return this.fuel.tanks().find((t) => t.id === id)?.name ?? '—';
  }
  generatorName(id: string | null): string {
    if (!id) return '—';
    return this.fuel.generators().find((g) => g.id === id)?.name ?? '—';
  }
  employeeName(id: string | null): string {
    if (!id) return '—';
    return this.employeeService.employees().find((e) => e.id === id)?.name ?? '—';
  }
  supplierName_(id: string | null): string {
    if (!id) return '—';
    return this.fuel.suppliers().find((s) => s.id === id)?.name ?? '—';
  }
  siteName(id: string | null): string {
    if (!id) return '—';
    return this.fuel.supplierSites().find((s) => s.id === id)?.name ?? '—';
  }
  tankerLabel(id: string | null): string {
    if (!id) return '—';
    const t = this.fuel.tankers().find((x) => x.id === id);
    return t ? `${t.plate}` : '—';
  }
  fillPercent(current: number, capacity: number): number {
    if (!capacity) return 0;
    return Math.max(0, Math.min(100, Math.round((current / capacity) * 100)));
  }
  sumCompartments(values: number[]): number {
    return (values || []).reduce((sum, v) => sum + Number(v || 0), 0);
  }
  fillStatus(pct: number): 'critical' | 'low' | 'good' | 'full' {
    if (pct < 15) return 'critical';
    if (pct < 40) return 'low';
    if (pct < 85) return 'good';
    return 'full';
  }

  // KPIs for selected station
  totalCapacity = computed(() =>
    this.fuel.levels().reduce((sum, lv) => sum + (lv.capacityL || 0), 0)
  );
  totalStock = computed(() =>
    this.fuel.levels().reduce((sum, lv) => sum + (lv.currentLiters || 0), 0)
  );
  totalReceivedToday = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.stationReceipts()
      .filter((r) => new Date(r.receivedAt) >= today)
      .reduce((sum, r) => sum + (r.totalLiters || 0), 0);
  });
  totalConsumedToday = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.stationConsumption()
      .filter((c) => new Date(c.readingDate) >= today)
      .reduce((sum, c) => sum + (c.liters || 0), 0);
  });
  overallPercent = computed(() => {
    const cap = this.totalCapacity();
    if (!cap) return 0;
    return Math.round((this.totalStock() / cap) * 100);
  });

  // Sorted lists descending by date
  receiptsSorted() {
    return [...this.stationReceipts()].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }
  transfersSorted() {
    return [...this.stationTransfers()].sort(
      (a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime()
    );
  }
  consumptionSorted() {
    return [...this.stationConsumption()].sort(
      (a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime()
    );
  }

  selectedStation = computed(() => {
    const id = this.selectedStationId();
    if (!id) return null;
    return this.stationService.stations().find((s) => s.id === id) ?? null;
  });

  stationShortName = computed(() => {
    const s = this.selectedStation();
    if (!s) return '';
    return this.shortStationName(s.name);
  });

  shortStationName(name: string): string {
    if (!name) return '';
    return name
      .replace('محطة ', '')
      .replace(' لتوليد وتوزيع الكهرباء', '')
      .trim();
  }

  stationManager = computed(() => {
    const id = this.selectedStationId();
    if (!id) return null;
    return this.employeeService.employees().find(
      (e) => e.stationId === id && e.role?.includes('مدير')
    ) ?? null;
  });

  stationFuelTech = computed(() => {
    const id = this.selectedStationId();
    if (!id) return null;
    return this.employeeService.employees().find(
      (e) => e.stationId === id && (e.role?.includes('مولد') || e.role?.includes('فني'))
    ) ?? null;
  });

  // Flow diagram: build stages from tanks order by role
  flowStages = computed(() => {
    const tanksByRole = (role: string) => this.stationTanks().filter((t) => t.role === role);
    const stages: { role: string; label: string; tanks: Tank[] }[] = [
      { role: 'receiving', label: 'الاستلام', tanks: tanksByRole('receiving') },
      { role: 'main', label: 'رئيسي', tanks: tanksByRole('main') },
      { role: 'pre_pump', label: 'قبل الطرمبة', tanks: tanksByRole('pre_pump') },
      { role: 'generator', label: 'خزانات المولدات', tanks: tanksByRole('generator') },
    ];
    return stages.filter((s) => s.tanks.length > 0);
  });

  levelFor(tankId: string) {
    return this.fuel.levels().find((l) => l.tankId === tankId);
  }
}
