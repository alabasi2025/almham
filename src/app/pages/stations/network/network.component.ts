import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { StationService } from '../../../services/station.service';
import { NetworkService } from '../../../services/network.service';
import { FuelService } from '../../../services/fuel.service';
import { CablePhaseConfig, EarthMode, Feeder, Panel, PanelType, CableType, FeederSegment, SegmentType, MonitoringMeter, MonitoringMeterKind, MonitoringTargetType, FeederPanelBreaker, FeederPanelBreakerSide, FeederPanelLayout, BusbarType, FeederPanelBusbar, BusbarPosition, BusbarRole } from '../../../models/network.model';
import { Generator } from '../../../models/fuel.model';
import { shortenStationName } from '../../../utils/station-name';

type MainTab = 'syncPanels' | 'feederPanels' | 'feeders' | 'segments' | 'meterPanels' | 'points' | 'monitoringMeters' | 'cableTypes';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss'],
})
export class NetworkComponent implements OnInit {
  stationService = inject(StationService);
  network = inject(NetworkService);
  fuel = inject(FuelService);

  activeTab = signal<MainTab>('syncPanels');
  stationFilter = signal<string>('all');
  feederFilter = signal<string>('all');
  search = signal('');

  // Segments state
  selectedFeederId = signal<string | null>(null);
  showSegmentForm = signal(false);
  editingSegmentId = signal<string | null>(null);
  segmentForm = this.emptySegmentForm();
  savingSegment = signal(false);
  segmentError = signal<string | null>(null);

  // Cable Types state
  readonly cableMaterials = ['ألمنيوم', 'نحاس'];
  readonly commonCableSizes = [10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
  readonly cablePhaseConfigOptions: { value: CablePhaseConfig; label: string }[] = [
    { value: 'single_phase_earth', label: 'فازة + أرضي' },
    { value: 'two_phase_earth', label: 'فازتين + أرضي' },
    { value: 'three_phase_earth', label: 'ثلاث فازات + أرضي' },
    { value: 'earth_only', label: 'أرضي فقط' },
    { value: 'other', label: 'تكوين آخر' },
  ];
  readonly earthModeOptions: { value: EarthMode; label: string }[] = [
    { value: 'insulated', label: 'ملبس' },
    { value: 'bare', label: 'مكشوف' },
    { value: 'none', label: 'بدون أرضي' },
  ];
  showCableTypeForm = signal(false);
  editingCableTypeId = signal<string | null>(null);
  cableTypeForm = this.emptyCableTypeForm();
  savingCableType = signal(false);
  cableTypeError = signal<string | null>(null);

  showFeederForm = signal(false);
  editingFeederId = signal<string | null>(null);
  feederForm = this.emptyFeederForm();
  savingFeeder = signal(false);
  feederError = signal<string | null>(null);

  showPanelForm = signal(false);
  editingPanelId = signal<string | null>(null);
  panelForm = this.emptyPanelForm();
  savingPanel = signal(false);
  panelError = signal<string | null>(null);

  readonly feederPanelLayoutOptions: { value: FeederPanelLayout; label: string }[] = [
    { value: 'right', label: 'بزبارات يمين' },
    { value: 'left', label: 'بزبارات شمال' },
    { value: 'both', label: 'بزبارات من الجهتين' },
  ];
  readonly breakerLayoutOptions: { value: FeederPanelLayout; label: string }[] = [
    { value: 'right', label: 'قواطع يمين' },
    { value: 'left', label: 'قواطع شمال' },
    { value: 'both', label: 'قواطع من الجهتين' },
  ];
  readonly breakerSideOptions: { value: FeederPanelBreakerSide; label: string }[] = [
    { value: 'right', label: 'يمين' },
    { value: 'left', label: 'شمال' },
  ];
  readonly busbarPositionOptions: { value: BusbarPosition; label: string }[] = [
    { value: 'right', label: 'يمين' },
    { value: 'left', label: 'شمال' },
    { value: 'middle', label: 'وسط' },
  ];
  readonly busbarRoleOptions: { value: BusbarRole; label: string }[] = [
    { value: 'phase_a', label: 'فاز R / A' },
    { value: 'phase_b', label: 'فاز S / B' },
    { value: 'phase_c', label: 'فاز T / C' },
    { value: 'neutral', label: 'نيوترال' },
    { value: 'earth', label: 'أرضي' },
    { value: 'spare', label: 'احتياطي' },
    { value: 'other', label: 'آخر' },
  ];
  selectedFeederPanelId = signal<string | null>(null);
  showFeederPanelComponents = signal(false);
  showBreakerForm = signal(false);
  editingBreakerId = signal<string | null>(null);
  breakerForm = this.emptyBreakerForm();
  savingBreaker = signal(false);
  breakerError = signal<string | null>(null);
  showBusbarTypeForm = signal(false);
  editingBusbarTypeId = signal<string | null>(null);
  busbarTypeForm = this.emptyBusbarTypeForm();
  savingBusbarType = signal(false);
  busbarTypeError = signal<string | null>(null);
  showBusbarForm = signal(false);
  editingBusbarId = signal<string | null>(null);
  busbarForm = this.emptyBusbarForm();
  savingBusbar = signal(false);
  busbarError = signal<string | null>(null);

  readonly monitoringTargetTypeOptions: { value: MonitoringTargetType; label: string }[] = [
    { value: 'generator', label: 'مولد' },
    { value: 'sync_panel', label: 'طبلة دمج' },
    { value: 'feeder_panel', label: 'طبلة فيدرات' },
    { value: 'feeder', label: 'فيدر' },
    { value: 'main_segment', label: 'موصل رئيسي' },
    { value: 'branch_segment', label: 'تفريعة' },
    { value: 'panel', label: 'طبلة' },
  ];
  readonly monitoringKindOptions: { value: MonitoringMeterKind; label: string }[] = [
    { value: 'production', label: 'إنتاج' },
    { value: 'distribution', label: 'توزيع' },
    { value: 'consumption', label: 'استهلاك' },
    { value: 'load', label: 'حمل' },
    { value: 'voltage', label: 'فولتية' },
    { value: 'loss_check', label: 'مقارنة فاقد' },
  ];
  readonly monitoringStatusOptions = [
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'متوقف' },
    { value: 'maintenance', label: 'صيانة' },
    { value: 'alarm', label: 'إنذار' },
  ] as const;
  showMonitoringMeterForm = signal(false);
  editingMonitoringMeterId = signal<string | null>(null);
  monitoringMeterForm = this.emptyMonitoringMeterForm();
  savingMonitoringMeter = signal(false);
  monitoringMeterError = signal<string | null>(null);

  async ngOnInit() {
    await Promise.all([
      this.network.loadFeeders(),
      this.network.loadPanels(),
      this.network.loadCableTypes(),
      this.network.loadBusbarTypes(),
      this.network.loadAllSegments(),
      this.network.loadMonitoringMeters(),
      this.fuel.loadGenerators(),
    ]);
  }

  filteredFeeders = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sid = this.stationFilter();
    return this.network.feeders().filter((f) => {
      if (sid !== 'all' && f.stationId !== sid) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || (f.code || '').includes(q);
    });
  });

  filteredPanels = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sid = this.stationFilter();
    const fid = this.feederFilter();
    return this.network.panels().filter((p) => {
      if (sid !== 'all' && p.stationId !== sid) return false;
      if (fid !== 'all' && p.feederId !== fid) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.code || '').includes(q);
    });
  });

  filteredSyncPanels = computed(() => this.filteredPanels().filter((p) => p.type === 'sync'));
  filteredFeederPanels = computed(() => this.filteredPanels().filter((p) => p.type === 'main_distribution'));
  filteredMeterPanels = computed(() => this.filteredPanels().filter((p) => p.type === 'meter_box'));

  activePanelRows = computed(() => {
    switch (this.activeTab()) {
      case 'syncPanels': return this.filteredSyncPanels();
      case 'feederPanels': return this.filteredFeederPanels();
      case 'meterPanels': return this.filteredMeterPanels();
      default: return this.filteredPanels();
    }
  });

  selectedFeederPanel = computed(() => {
    const id = this.selectedFeederPanelId();
    if (!id) return null;
    return this.network.panels().find((p) => p.id === id) || null;
  });

  rightBreakers = computed(() => {
    return this.network.feederPanelBreakers()
      .filter((breaker) => breaker.side === 'right')
      .sort((a, b) => a.breakerNumber.localeCompare(b.breakerNumber, 'ar'));
  });

  leftBreakers = computed(() => {
    return this.network.feederPanelBreakers()
      .filter((breaker) => breaker.side === 'left')
      .sort((a, b) => a.breakerNumber.localeCompare(b.breakerNumber, 'ar'));
  });

  feederPanelBusbars = computed(() => {
    return this.network.feederPanelBusbars()
      .sort((a, b) => a.position.localeCompare(b.position) || a.orderIndex - b.orderIndex || a.label.localeCompare(b.label, 'ar'));
  });

  feederPanelBusbarStats = computed(() => {
    const busbars = this.network.feederPanelBusbars();
    return {
      total: busbars.length,
      right: busbars.filter((b) => b.position === 'right').length,
      left: busbars.filter((b) => b.position === 'left').length,
      middle: busbars.filter((b) => b.position === 'middle').length,
      types: new Set(busbars.map((b) => b.busbarTypeId).filter(Boolean)).size,
    };
  });

  mappedPoints = computed(() => {
    return this.filteredPanels().filter((p) => Boolean(p.latitude && p.longitude));
  });

  filteredCableTypes = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.network.cableTypes().filter((ct) => {
      if (!q) return true;
      return ct.name.toLowerCase().includes(q)
        || (ct.material || '').toLowerCase().includes(q)
        || (ct.description || '').toLowerCase().includes(q)
        || String(ct.sizeMm || '').includes(q)
        || String(ct.maxAmps || '').includes(q);
    });
  });

  filteredMonitoringMeters = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sid = this.stationFilter();
    return this.network.monitoringMeters().filter((meter) => {
      if (sid !== 'all' && meter.stationId !== sid) return false;
      if (!q) return true;
      return meter.name.toLowerCase().includes(q)
        || (meter.code || '').toLowerCase().includes(q)
        || this.monitoringTargetLabel(meter).toLowerCase().includes(q)
        || this.monitoringTargetTypeLabel(meter.targetType).toLowerCase().includes(q);
    });
  });

  monitoringMeterStats = computed(() => {
    const meters = this.filteredMonitoringMeters();
    return {
      total: meters.length,
      active: meters.filter((m) => m.status === 'active').length,
      alarm: meters.filter((m) => m.status === 'alarm').length,
      withKwh: meters.filter((m) => m.lastKwh !== null).length,
    };
  });

  monitoringTargetOptions = computed(() => {
    const stationId = this.monitoringMeterForm.stationId;
    const targetType = this.monitoringMeterForm.targetType;
    const stationMatches = (sid: string | null | undefined) => !stationId || sid === stationId;

    if (targetType === 'generator') {
      return this.fuel.generators()
        .filter((g) => stationMatches(g.stationId))
        .map((g) => ({ id: g.id, label: g.name }));
    }
    if (targetType === 'sync_panel') {
      return this.network.panels()
        .filter((p) => p.type === 'sync' && stationMatches(p.stationId))
        .map((p) => ({ id: p.id, label: p.name }));
    }
    if (targetType === 'feeder_panel') {
      return this.network.panels()
        .filter((p) => p.type === 'main_distribution' && stationMatches(p.stationId))
        .map((p) => ({ id: p.id, label: p.name }));
    }
    if (targetType === 'feeder') {
      return this.network.feeders()
        .filter((f) => stationMatches(f.stationId))
        .map((f) => ({ id: f.id, label: f.name }));
    }
    if (targetType === 'main_segment') {
      return this.network.allSegments()
        .filter((s) => s.segmentType === 'main' && stationMatches(this.segmentStationId(s)))
        .map((s) => ({ id: s.id, label: `${s.label || `موصل رئيسي #${s.orderIndex}`}${s.feederName ? ' - ' + s.feederName : ''}` }));
    }
    if (targetType === 'branch_segment') {
      return this.network.allSegments()
        .filter((s) => s.segmentType === 'branch' && stationMatches(this.segmentStationId(s)))
        .map((s) => ({ id: s.id, label: `${s.label || `تفريعة #${s.orderIndex}`}${s.feederName ? ' - ' + s.feederName : ''}` }));
    }
    return this.network.panels()
      .filter((p) => p.type === 'meter_box' && stationMatches(p.stationId))
      .map((p) => ({ id: p.id, label: p.name }));
  });

  feedersForStation = computed(() => {
    const sid = this.stationFilter();
    if (sid === 'all') return this.network.feeders();
    return this.network.feeders().filter((f) => f.stationId === sid);
  });

  feederStats = computed(() => {
    const feeders = this.filteredFeeders();
    return {
      total: feeders.length,
      active: feeders.filter((f) => f.status === 'active').length,
      totalPanels: feeders.reduce((s, f) => s + (f.panelsCount || 0), 0),
    };
  });

  panelStats = computed(() => {
    const panels = this.filteredPanels();
    return {
      total: panels.length,
      active: panels.filter((p) => p.status === 'active').length,
      meterBox: panels.filter((p) => p.type === 'meter_box').length,
    };
  });

  cableTypeStats = computed(() => {
    const cableTypes = this.filteredCableTypes();
    return {
      total: cableTypes.length,
      active: cableTypes.filter((ct) => ct.isActive).length,
      withCapacity: cableTypes.filter((ct) => ct.maxAmps !== null).length,
    };
  });

  searchPlaceholder(): string {
    if (this.activeTab() === 'cableTypes') return 'بحث باسم الكيبل أو المقاس...';
    if (this.activeTab() === 'points') return 'بحث في نقاط الشبكة...';
    if (this.activeTab() === 'monitoringMeters') return 'بحث في عدادات الرصد...';
    return 'بحث بالاسم أو الكود...';
  }

  selectedFeeder = computed(() => {
    const id = this.selectedFeederId();
    if (!id) return null;
    return this.network.feeders().find((f) => f.id === id) || null;
  });

  selectedFeederPanels = computed(() => {
    const id = this.selectedFeederId();
    if (!id) return [];
    return this.network.panels().filter((p) => p.feederId === id);
  });

  mainFeederSegments = computed(() => {
    return this.network.segments()
      .filter((s) => s.segmentType === 'main')
      .sort((a, b) => a.orderIndex - b.orderIndex);
  });

  branchFeederSegments = computed(() => {
    return this.network.segments()
      .filter((s) => s.segmentType === 'branch')
      .sort((a, b) => a.orderIndex - b.orderIndex);
  });

  shortStation(name: string | null): string {
    return shortenStationName(name, '');
  }

  feederStatusLabel(s: string): string {
    return { active: 'شغّال', off: 'متوقف', maintenance: 'صيانة', overloaded: 'حمل زائد' }[s] ?? s;
  }

  panelTypeLabel(t: PanelType): string {
    return { sync: 'طبلة دمج', main_distribution: 'طبلة فيدرات', meter_box: 'طبلة' }[t] ?? t;
  }

  activePanelType(): PanelType | null {
    const tab = this.activeTab();
    if (tab === 'syncPanels') return 'sync';
    if (tab === 'feederPanels') return 'main_distribution';
    if (tab === 'meterPanels') return 'meter_box';
    return null;
  }

  activePanelAddLabel(): string {
    const type = this.activePanelType();
    if (type === 'sync') return 'طبلة دمج جديدة';
    if (type === 'main_distribution') return 'طبلة فيدرات جديدة';
    if (type === 'meter_box') return 'طبلة جديدة';
    return 'طبلة جديدة';
  }

  activePanelTitle(): string {
    const type = this.activePanelType();
    if (type === 'sync') return 'طبلة الدمج';
    if (type === 'main_distribution') return 'طبلة فيدرات';
    if (type === 'meter_box') return 'الطبلات';
    return 'الطبلات';
  }

  activePanelIcon(): string {
    const type = this.activePanelType();
    if (type === 'sync') return 'merge_type';
    if (type === 'main_distribution') return 'account_tree';
    return 'grid_view';
  }

  isPanelTab(): boolean {
    return this.activePanelType() !== null;
  }

  openActivePanelForm() {
    const type = this.activePanelType();
    if (!type) return;
    this.openPanelForm(undefined, type);
  }

  panelFormTitle(): string {
    if (this.editingPanelId()) return 'تعديل طبلة';
    return this.activePanelAddLabel();
  }

  statusLabel(s: string): string {
    return { active: 'نشط', inactive: 'متوقف', maintenance: 'صيانة' }[s] ?? s;
  }

  feederPanelLayoutLabel(value: FeederPanelLayout | null | undefined): string {
    return this.feederPanelLayoutOptions.find((option) => option.value === value)?.label || 'غير محدد';
  }

  breakerLayoutLabel(value: FeederPanelLayout | null | undefined): string {
    return this.breakerLayoutOptions.find((option) => option.value === value)?.label || 'غير محدد';
  }

  breakerSideLabel(value: FeederPanelBreakerSide): string {
    return this.breakerSideOptions.find((option) => option.value === value)?.label || value;
  }

  breakerStatusLabel(status: string): string {
    return { active: 'نشط', inactive: 'متوقف', maintenance: 'صيانة' }[status] ?? status;
  }

  busbarPositionLabel(value: BusbarPosition): string {
    return this.busbarPositionOptions.find((option) => option.value === value)?.label || value;
  }

  busbarRoleLabel(value: BusbarRole): string {
    return this.busbarRoleOptions.find((option) => option.value === value)?.label || value;
  }

  busbarTypeSizeLabel(type: BusbarType | FeederPanelBusbar): string {
    const width = type.widthMm !== null && type.widthMm !== undefined && type.widthMm !== '' ? Number(type.widthMm) : null;
    const thickness = type.thicknessMm !== null && type.thicknessMm !== undefined && type.thicknessMm !== '' ? Number(type.thicknessMm) : null;
    if (width && thickness) return `${width} × ${thickness} مم`;
    if (width) return `عرض ${width} مم`;
    if (thickness) return `سماكة ${thickness} مم`;
    return 'بدون مقاس';
  }

  monitoringTargetTypeLabel(type: MonitoringTargetType): string {
    return this.monitoringTargetTypeOptions.find((option) => option.value === type)?.label || type;
  }

  monitoringKindLabel(kind: MonitoringMeterKind): string {
    return this.monitoringKindOptions.find((option) => option.value === kind)?.label || kind;
  }

  monitoringStatusLabel(status: string): string {
    return { active: 'نشط', inactive: 'متوقف', maintenance: 'صيانة', alarm: 'إنذار' }[status] ?? status;
  }

  monitoringTargetLabel(meter: MonitoringMeter): string {
    if (!meter.targetId) return 'بدون ربط';
    const label = this.monitoringTargetName(meter.targetType, meter.targetId);
    return label || 'عنصر غير محمّل';
  }

  monitoringTargetName(type: MonitoringTargetType, id: string): string | null {
    if (type === 'generator') return this.fuel.generators().find((g: Generator) => g.id === id)?.name || null;
    if (type === 'feeder') return this.network.feeders().find((f) => f.id === id)?.name || null;
    if (type === 'sync_panel' || type === 'feeder_panel' || type === 'panel') {
      return this.network.panels().find((p) => p.id === id)?.name || null;
    }
    const segment = [...this.network.segments(), ...this.network.allSegments()].find((s) => s.id === id);
    if (!segment) return null;
    return segment.label || `${this.segmentTypeLabel(segment.segmentType)} #${segment.orderIndex}`;
  }

  segmentStationId(segment: FeederSegment): string | null {
    if (segment.stationId) return segment.stationId;
    return this.network.feeders().find((f) => f.id === segment.feederId)?.stationId || null;
  }

  formatReading(value: string | number | null, unit: string): string {
    if (value === null || value === undefined || value === '') return '-';
    const n = Number(value);
    if (Number.isNaN(n)) return '-';
    return `${n.toLocaleString('ar-YE', { maximumFractionDigits: 2 })} ${unit}`;
  }

  cableSizeOptions(): number[] {
    const current = this.cableTypeForm.sizeMm;
    const sizes = [...this.commonCableSizes];
    if (current !== null && !sizes.includes(Number(current))) sizes.push(Number(current));
    return sizes.sort((a, b) => a - b);
  }

  suggestedCableTypeName(): string {
    const material = this.cableTypeForm.material.trim();
    const size = this.cableTypeForm.sizeMm;
    const base = [
      'كيبل',
      material,
      size ? `${size} مم²` : '',
    ].filter(Boolean).join(' ');
    const details = [this.phaseConfigLabel(this.cableTypeForm.phaseConfig), this.earthModeLabel(this.cableTypeForm.earthMode)].filter(Boolean).join(' - ');
    return [base, details].filter(Boolean).join(' - ');
  }

  applyCableTypeNameSuggestion() {
    const suggestion = this.suggestedCableTypeName();
    if (suggestion) this.cableTypeForm.name = suggestion;
  }

  // === Feeder CRUD ===
  private emptyFeederForm() {
    return { stationId: '', name: '', code: '', cableType: '', maxLoadAmps: null as number | null, notes: '' };
  }

  openFeederForm(feeder?: Feeder) {
    this.feederError.set(null);
    if (feeder) {
      this.editingFeederId.set(feeder.id);
      this.feederForm = { stationId: feeder.stationId, name: feeder.name, code: feeder.code || '', cableType: feeder.cableType || '', maxLoadAmps: feeder.maxLoadAmps, notes: feeder.notes || '' };
    } else {
      this.editingFeederId.set(null);
      this.feederForm = this.emptyFeederForm();
      const sid = this.stationFilter();
      if (sid !== 'all') this.feederForm.stationId = sid;
    }
    this.showFeederForm.set(true);
  }

  async saveFeeder() {
    this.feederError.set(null);
    if (!this.feederForm.stationId) { this.feederError.set('اختر المحطة'); return; }
    if (!this.feederForm.name.trim()) { this.feederError.set('أدخل اسم الفيدر'); return; }

    this.savingFeeder.set(true);
    try {
      const id = this.editingFeederId();
      if (id) {
        await this.network.updateFeeder(id, this.feederForm);
      } else {
        await this.network.addFeeder(this.feederForm);
      }
      await this.network.loadPanels();
      this.showFeederForm.set(false);
    } catch (err: unknown) {
      this.feederError.set(this.extractError(err) || 'تعذّر الحفظ');
    } finally {
      this.savingFeeder.set(false);
    }
  }

  async removeFeeder(id: string, name: string) {
    if (!confirm(`حذف الفيدر "${name}"؟ سيتم فصل الطبلات المرتبطة.`)) return;
    try { await this.network.deleteFeeder(id); } catch { alert('تعذّر الحذف'); }
  }

  // === Panel CRUD ===
  private emptyPanelForm() {
    return {
      stationId: '',
      feederId: '' as string | null,
      name: '',
      code: '',
      type: 'meter_box' as PanelType,
      busbarLayout: 'right' as FeederPanelLayout,
      breakerLayout: 'both' as FeederPanelLayout,
      busbarMaterial: 'نحاس',
      busbarRatingAmps: null as number | null,
      poleNumber: '',
      notes: '',
    };
  }

  openPanelForm(panel?: Panel, defaultType?: PanelType) {
    this.panelError.set(null);
    if (panel) {
      this.editingPanelId.set(panel.id);
      this.panelForm = {
        stationId: panel.stationId,
        feederId: panel.feederId,
        name: panel.name,
        code: panel.code || '',
        type: panel.type,
        busbarLayout: panel.busbarLayout || 'right',
        breakerLayout: panel.breakerLayout || 'both',
        busbarMaterial: panel.busbarMaterial || 'نحاس',
        busbarRatingAmps: panel.busbarRatingAmps,
        poleNumber: panel.poleNumber || '',
        notes: panel.notes || '',
      };
    } else {
      this.editingPanelId.set(null);
      this.panelForm = this.emptyPanelForm();
      const sid = this.stationFilter();
      if (sid !== 'all') this.panelForm.stationId = sid;
      if (defaultType) this.panelForm.type = defaultType;
    }
    this.showPanelForm.set(true);
  }

  panelFeederOptions(): Feeder[] {
    const stationId = this.panelForm.stationId;
    if (!stationId) return [];
    return this.network.feeders().filter((f) => f.stationId === stationId);
  }

  onPanelStationChange(stationId: string) {
    this.panelForm.stationId = stationId;
    const feederId = this.panelForm.feederId;
    if (feederId && !this.network.feeders().some((f) => f.id === feederId && f.stationId === stationId)) {
      this.panelForm.feederId = null;
    }
  }

  async savePanel() {
    this.panelError.set(null);
    if (!this.panelForm.stationId) { this.panelError.set('اختر المحطة'); return; }
    if (!this.panelForm.name.trim()) { this.panelError.set('أدخل اسم الطبلة'); return; }

    this.savingPanel.set(true);
    try {
      const payload = {
        ...this.panelForm,
        feederId: this.panelForm.type === 'meter_box' ? this.panelForm.feederId || null : null,
      };
      const id = this.editingPanelId();
      if (id) {
        await this.network.updatePanel(id, payload);
      } else {
        await this.network.addPanel(payload);
      }
      await this.network.loadFeeders();
      this.showPanelForm.set(false);
    } catch (err: unknown) {
      this.panelError.set(this.extractError(err) || 'تعذّر الحفظ');
    } finally {
      this.savingPanel.set(false);
    }
  }

  async removePanel(id: string, name: string) {
    if (!confirm(`حذف الطبلة "${name}"؟`)) return;
    try { await this.network.deletePanel(id); } catch { alert('تعذّر الحذف'); }
  }

  async enterFeederPanel(panel: Panel) {
    this.selectedFeederPanelId.set(panel.id);
    this.showFeederPanelComponents.set(false);
    this.showBreakerForm.set(false);
    this.breakerError.set(null);
    await Promise.all([
      this.network.loadFeederPanelBreakers(panel.id),
      this.network.loadFeederPanelBusbars(panel.id),
      this.network.loadBusbarTypes(),
    ]);
  }

  closeFeederPanel() {
    this.selectedFeederPanelId.set(null);
    this.showFeederPanelComponents.set(false);
    this.showBreakerForm.set(false);
    this.editingBreakerId.set(null);
    this.showBusbarForm.set(false);
    this.editingBusbarId.set(null);
    this.network.feederPanelBreakers.set([]);
    this.network.feederPanelBusbars.set([]);
  }

  private emptyBreakerForm() {
    return {
      feederId: '' as string | null,
      breakerNumber: '',
      side: 'right' as FeederPanelBreakerSide,
      ratingAmps: null as number | null,
      breakerType: '',
      status: 'active' as 'active' | 'inactive' | 'maintenance',
      notes: '',
    };
  }

  feederPanelFeederOptions(): Feeder[] {
    const panel = this.selectedFeederPanel();
    if (!panel) return [];
    return this.network.feeders().filter((f) => f.stationId === panel.stationId);
  }

  openBreakerForm(breaker?: FeederPanelBreaker, side: FeederPanelBreakerSide = 'right') {
    this.breakerError.set(null);
    if (breaker) {
      this.editingBreakerId.set(breaker.id);
      this.breakerForm = {
        feederId: breaker.feederId || '',
        breakerNumber: breaker.breakerNumber,
        side: breaker.side,
        ratingAmps: breaker.ratingAmps,
        breakerType: breaker.breakerType || '',
        status: breaker.status,
        notes: breaker.notes || '',
      };
    } else {
      this.editingBreakerId.set(null);
      this.breakerForm = this.emptyBreakerForm();
      this.breakerForm.side = side;
    }
    this.showBreakerForm.set(true);
  }

  async saveBreaker() {
    this.breakerError.set(null);
    const panel = this.selectedFeederPanel();
    if (!panel) return;
    if (!this.breakerForm.breakerNumber.trim()) { this.breakerError.set('أدخل رقم أو اسم القاطع'); return; }

    this.savingBreaker.set(true);
    try {
      const data: any = {
        feederId: this.breakerForm.feederId || null,
        breakerNumber: this.breakerForm.breakerNumber,
        side: this.breakerForm.side,
        ratingAmps: this.breakerForm.ratingAmps,
        breakerType: this.breakerForm.breakerType || null,
        status: this.breakerForm.status,
        notes: this.breakerForm.notes || null,
      };
      const id = this.editingBreakerId();
      if (id) {
        await this.network.updateFeederPanelBreaker(id, panel.id, data);
      } else {
        await this.network.addFeederPanelBreaker(panel.id, data);
      }
      this.showBreakerForm.set(false);
    } catch (err: unknown) {
      this.breakerError.set(this.extractError(err) || 'تعذّر حفظ القاطع');
    } finally {
      this.savingBreaker.set(false);
    }
  }

  async removeBreaker(breaker: FeederPanelBreaker) {
    const panel = this.selectedFeederPanel();
    if (!panel) return;
    if (!confirm(`حذف القاطع "${breaker.breakerNumber}"؟`)) return;
    try {
      await this.network.deleteFeederPanelBreaker(breaker.id, panel.id);
    } catch {
      alert('تعذّر الحذف');
    }
  }

  // === Feeder Panel Busbars ===
  private emptyBusbarTypeForm() {
    return {
      name: '',
      material: 'نحاس',
      widthMm: null as number | null,
      thicknessMm: null as number | null,
      ratingAmps: null as number | null,
      notes: '',
    };
  }

  suggestedBusbarTypeName(): string {
    const material = this.busbarTypeForm.material?.trim() || 'نحاس';
    const width = this.busbarTypeForm.widthMm;
    const thickness = this.busbarTypeForm.thicknessMm;
    const size = width && thickness ? `${width}×${thickness} مم` : '';
    return ['بزبار', material, size].filter(Boolean).join(' ');
  }

  applyBusbarTypeNameSuggestion() {
    const suggestion = this.suggestedBusbarTypeName();
    if (suggestion) this.busbarTypeForm.name = suggestion;
  }

  openBusbarTypeForm(type?: BusbarType) {
    this.busbarTypeError.set(null);
    if (type) {
      this.editingBusbarTypeId.set(type.id);
      this.busbarTypeForm = {
        name: type.name,
        material: type.material || 'نحاس',
        widthMm: type.widthMm !== null ? Number(type.widthMm) : null,
        thicknessMm: type.thicknessMm !== null ? Number(type.thicknessMm) : null,
        ratingAmps: type.ratingAmps,
        notes: type.notes || '',
      };
    } else {
      this.editingBusbarTypeId.set(null);
      this.busbarTypeForm = this.emptyBusbarTypeForm();
    }
    this.showBusbarTypeForm.set(true);
  }

  async saveBusbarType() {
    this.busbarTypeError.set(null);
    if (!this.busbarTypeForm.name.trim()) { this.busbarTypeError.set('أدخل اسم نوع البزبار'); return; }
    this.savingBusbarType.set(true);
    try {
      const payload = {
        name: this.busbarTypeForm.name,
        material: this.busbarTypeForm.material || null,
        widthMm: this.busbarTypeForm.widthMm,
        thicknessMm: this.busbarTypeForm.thicknessMm,
        ratingAmps: this.busbarTypeForm.ratingAmps,
        notes: this.busbarTypeForm.notes || null,
      };
      const id = this.editingBusbarTypeId();
      if (id) {
        await this.network.updateBusbarType(id, payload);
      } else {
        await this.network.addBusbarType(payload);
      }
      this.showBusbarTypeForm.set(false);
    } catch (err: unknown) {
      this.busbarTypeError.set(this.extractError(err) || 'تعذّر حفظ نوع البزبار');
    } finally {
      this.savingBusbarType.set(false);
    }
  }

  async removeBusbarType(type: BusbarType) {
    if (!confirm(`تعطيل نوع البزبار "${type.name}"؟`)) return;
    try {
      await this.network.deleteBusbarType(type.id);
    } catch {
      alert('تعذّر تعطيل نوع البزبار');
    }
  }

  private emptyBusbarForm() {
    return {
      busbarTypeId: '' as string | null,
      label: '',
      role: 'phase_a' as BusbarRole,
      position: 'right' as BusbarPosition,
      orderIndex: 0,
      notes: '',
    };
  }

  openBusbarForm(busbar?: FeederPanelBusbar, position: BusbarPosition = 'right') {
    this.busbarError.set(null);
    if (busbar) {
      this.editingBusbarId.set(busbar.id);
      this.busbarForm = {
        busbarTypeId: busbar.busbarTypeId || '',
        label: busbar.label,
        role: busbar.role,
        position: busbar.position,
        orderIndex: busbar.orderIndex,
        notes: busbar.notes || '',
      };
    } else {
      this.editingBusbarId.set(null);
      this.busbarForm = this.emptyBusbarForm();
      this.busbarForm.position = position;
      this.busbarForm.orderIndex = this.network.feederPanelBusbars().length + 1;
    }
    this.showBusbarForm.set(true);
  }

  async saveBusbar() {
    this.busbarError.set(null);
    const panel = this.selectedFeederPanel();
    if (!panel) return;
    if (!this.busbarForm.label.trim()) { this.busbarError.set('أدخل اسم أو رقم البزبار'); return; }

    this.savingBusbar.set(true);
    try {
      const data = {
        busbarTypeId: this.busbarForm.busbarTypeId || null,
        label: this.busbarForm.label,
        role: this.busbarForm.role,
        position: this.busbarForm.position,
        orderIndex: this.busbarForm.orderIndex,
        notes: this.busbarForm.notes || null,
      };
      const id = this.editingBusbarId();
      if (id) {
        await this.network.updateFeederPanelBusbar(id, panel.id, data);
      } else {
        await this.network.addFeederPanelBusbar(panel.id, data);
      }
      this.showBusbarForm.set(false);
    } catch (err: unknown) {
      this.busbarError.set(this.extractError(err) || 'تعذّر حفظ البزبار');
    } finally {
      this.savingBusbar.set(false);
    }
  }

  async removeBusbar(busbar: FeederPanelBusbar) {
    const panel = this.selectedFeederPanel();
    if (!panel) return;
    if (!confirm(`حذف البزبار "${busbar.label}" من الطبلة؟`)) return;
    try {
      await this.network.deleteFeederPanelBusbar(busbar.id, panel.id);
    } catch {
      alert('تعذّر حذف البزبار');
    }
  }

  // === Monitoring Meters ===
  private emptyMonitoringMeterForm() {
    return {
      stationId: '',
      name: '',
      code: '',
      targetType: 'feeder' as MonitoringTargetType,
      targetId: '' as string | null,
      kind: 'load' as MonitoringMeterKind,
      lastVoltage: null as number | null,
      lastCurrent: null as number | null,
      lastKwh: null as number | null,
      lastPowerKw: null as number | null,
      loadPercent: null as number | null,
      status: 'active' as 'active' | 'inactive' | 'maintenance' | 'alarm',
      notes: '',
    };
  }

  openMonitoringMeterForm(meter?: MonitoringMeter) {
    this.monitoringMeterError.set(null);
    if (meter) {
      this.editingMonitoringMeterId.set(meter.id);
      this.monitoringMeterForm = {
        stationId: meter.stationId,
        name: meter.name,
        code: meter.code || '',
        targetType: meter.targetType,
        targetId: meter.targetId || '',
        kind: meter.kind,
        lastVoltage: meter.lastVoltage !== null ? Number(meter.lastVoltage) : null,
        lastCurrent: meter.lastCurrent !== null ? Number(meter.lastCurrent) : null,
        lastKwh: meter.lastKwh !== null ? Number(meter.lastKwh) : null,
        lastPowerKw: meter.lastPowerKw !== null ? Number(meter.lastPowerKw) : null,
        loadPercent: meter.loadPercent,
        status: meter.status,
        notes: meter.notes || '',
      };
    } else {
      this.editingMonitoringMeterId.set(null);
      this.monitoringMeterForm = this.emptyMonitoringMeterForm();
      const sid = this.stationFilter();
      if (sid !== 'all') this.monitoringMeterForm.stationId = sid;
    }
    this.showMonitoringMeterForm.set(true);
  }

  onMonitoringStationChange(stationId: string) {
    this.monitoringMeterForm.stationId = stationId;
    this.monitoringMeterForm.targetId = '';
  }

  onMonitoringTargetTypeChange(type: MonitoringTargetType) {
    this.monitoringMeterForm.targetType = type;
    this.monitoringMeterForm.targetId = '';
  }

  async saveMonitoringMeter() {
    this.monitoringMeterError.set(null);
    if (!this.monitoringMeterForm.stationId) { this.monitoringMeterError.set('اختر المحطة'); return; }
    if (!this.monitoringMeterForm.name.trim()) { this.monitoringMeterError.set('أدخل اسم عداد الرصد'); return; }

    this.savingMonitoringMeter.set(true);
    try {
      const data: any = {
        stationId: this.monitoringMeterForm.stationId,
        name: this.monitoringMeterForm.name,
        code: this.monitoringMeterForm.code || null,
        targetType: this.monitoringMeterForm.targetType,
        targetId: this.monitoringMeterForm.targetId || null,
        kind: this.monitoringMeterForm.kind,
        lastVoltage: this.monitoringMeterForm.lastVoltage,
        lastCurrent: this.monitoringMeterForm.lastCurrent,
        lastKwh: this.monitoringMeterForm.lastKwh,
        lastPowerKw: this.monitoringMeterForm.lastPowerKw,
        loadPercent: this.monitoringMeterForm.loadPercent,
        status: this.monitoringMeterForm.status,
        notes: this.monitoringMeterForm.notes || null,
      };

      const id = this.editingMonitoringMeterId();
      if (id) {
        await this.network.updateMonitoringMeter(id, data);
      } else {
        await this.network.addMonitoringMeter(data);
      }
      this.showMonitoringMeterForm.set(false);
    } catch (err: unknown) {
      this.monitoringMeterError.set(this.extractError(err) || 'تعذّر حفظ عداد الرصد');
    } finally {
      this.savingMonitoringMeter.set(false);
    }
  }

  async removeMonitoringMeter(meter: MonitoringMeter) {
    if (!confirm(`حذف عداد الرصد "${meter.name}"؟`)) return;
    try {
      await this.network.deleteMonitoringMeter(meter.id);
    } catch {
      alert('تعذّر الحذف');
    }
  }

  // === Segments ===
  selectedFeederSegments = computed(() => {
    const segments = this.network.segments();
    // Build tree: main segments first, then branches indented
    const mains = segments.filter(s => s.segmentType === 'main').sort((a, b) => a.orderIndex - b.orderIndex);
    const branches = segments.filter(s => s.segmentType === 'branch').sort((a, b) => a.orderIndex - b.orderIndex);
    const tree: (FeederSegment & { indent: boolean })[] = [];
    for (const m of mains) {
      tree.push({ ...m, indent: false });
      for (const b of branches) {
        if (b.parentSegmentId === m.id) {
          tree.push({ ...b, indent: true });
        }
      }
    }
    // Branches without parent (orphan)
    for (const b of branches) {
      if (!b.parentSegmentId || !mains.find(m => m.id === b.parentSegmentId)) {
        tree.push({ ...b, indent: true });
      }
    }
    return tree;
  });

  mainSegments = computed(() => {
    return this.mainFeederSegments();
  });

  parentSegmentOptions = computed(() => {
    const editingId = this.editingSegmentId();
    const segments = this.network.segments();
    const excluded = new Set<string>();
    const collectChildren = (parentId: string) => {
      for (const child of segments.filter((s) => s.parentSegmentId === parentId)) {
        if (excluded.has(child.id)) continue;
        excluded.add(child.id);
        collectChildren(child.id);
      }
    };

    if (editingId) {
      excluded.add(editingId);
      collectChildren(editingId);
    }

    return segments
      .filter((s) => !excluded.has(s.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  });

  segmentTypeLabel(t: SegmentType): string {
    return { main: 'موصل رئيسي', branch: 'تفريعة' }[t] ?? t;
  }

  phaseConfigLabel(value: CablePhaseConfig | null | undefined): string {
    return this.cablePhaseConfigOptions.find((option) => option.value === value)?.label || 'غير محدد';
  }

  earthModeLabel(value: EarthMode | null | undefined): string {
    return this.earthModeOptions.find((option) => option.value === value)?.label || 'غير محدد';
  }

  segmentCablePhaseLabel(segment: FeederSegment): string {
    return this.phaseConfigLabel(segment.cableTypePhaseConfig || segment.phaseConfig);
  }

  segmentCableEarthLabel(segment: FeederSegment): string {
    return this.earthModeLabel(segment.cableTypeEarthMode || segment.earthMode);
  }

  segmentFormTitle(): string {
    const type = this.segmentTypeLabel(this.segmentForm.segmentType);
    return this.editingSegmentId() ? `تعديل ${type}` : `${type} جديد`;
  }

  segmentPlaceholder(): string {
    return this.segmentForm.segmentType === 'branch' ? 'مثلاً: تفريعة حارة السوق' : 'مثلاً: الموصل من المحطة إلى الحي';
  }

  segmentParentLabel(segment: FeederSegment): string {
    if (!segment.parentSegmentId) return 'بدون موصل أب';
    const parent = this.network.segments().find((s) => s.id === segment.parentSegmentId);
    if (!parent) return 'موصل أب غير موجود';
    return parent.label || `${this.segmentTypeLabel(parent.segmentType)} #${parent.orderIndex}`;
  }

  segmentOptionLabel(segment: FeederSegment): string {
    return `${this.segmentTypeLabel(segment.segmentType)} - ${segment.label || '#' + segment.orderIndex}`;
  }

  segmentRoutePointsCount(segment: FeederSegment): number {
    return segment.routePoints?.length || 0;
  }

  async enterFeeder(feeder: Feeder) {
    this.activeTab.set('segments');
    await this.selectFeeder(feeder.id);
  }

  async selectFeeder(feederId: string) {
    this.showSegmentForm.set(false);
    this.segmentError.set(null);
    this.selectedFeederId.set(feederId);
    await this.network.loadSegments(feederId);
  }

  closeSegments() {
    this.selectedFeederId.set(null);
    this.showSegmentForm.set(false);
    this.editingSegmentId.set(null);
    this.network.segments.set([]);
  }

  backToFeeders() {
    this.closeSegments();
    this.activeTab.set('feeders');
  }

  private emptySegmentForm() {
    return {
      cableTypeId: '' as string | null,
      segmentType: 'main' as SegmentType,
      parentSegmentId: '' as string | null,
      label: '',
      lengthMeters: null as number | null,
      notes: '',
    };
  }

  openSegmentForm(segment?: FeederSegment, type: SegmentType = 'main') {
    this.segmentError.set(null);
    if (segment) {
      this.editingSegmentId.set(segment.id);
      this.segmentForm = {
        cableTypeId: segment.cableTypeId || '',
        segmentType: segment.segmentType,
        parentSegmentId: segment.parentSegmentId || '',
        label: segment.label || '',
        lengthMeters: segment.lengthMeters,
        notes: segment.notes || '',
      };
    } else {
      this.editingSegmentId.set(null);
      this.segmentForm = this.emptySegmentForm();
      this.segmentForm.segmentType = type;
    }
    this.showSegmentForm.set(true);
  }

  async saveSegment() {
    this.segmentError.set(null);
    const feederId = this.selectedFeederId();
    if (!feederId) return;

    this.savingSegment.set(true);
    try {
      const data: any = {
        cableTypeId: this.segmentForm.cableTypeId || null,
        segmentType: this.segmentForm.segmentType,
        parentSegmentId: this.segmentForm.segmentType === 'branch' && this.segmentForm.parentSegmentId
          ? this.segmentForm.parentSegmentId : null,
        label: this.segmentForm.label || null,
        lengthMeters: this.segmentForm.lengthMeters,
        notes: this.segmentForm.notes || null,
      };

      const id = this.editingSegmentId();
      if (id) {
        await this.network.updateSegment(id, data);
      } else {
        await this.network.addSegment(feederId, data);
      }
      // Reload
      await this.network.loadSegments(feederId);
      this.showSegmentForm.set(false);
    } catch (err: unknown) {
      this.segmentError.set(this.extractError(err) || 'تعذّر الحفظ');
    } finally {
      this.savingSegment.set(false);
    }
  }

  async removeSegment(segment: FeederSegment) {
    if (!confirm(`حذف ${this.segmentTypeLabel(segment.segmentType)} "${segment.label || 'بدون تسمية'}"؟`)) return;
    const feederId = this.selectedFeederId();
    if (!feederId) return;
    try {
      await this.network.deleteSegment(segment.id, feederId);
    } catch { alert('تعذّر الحذف'); }
  }

  // === Cable Types ===
  private emptyCableTypeForm() {
    return {
      name: '',
      sizeMm: null as number | null,
      material: '',
      phaseConfig: 'single_phase_earth' as CablePhaseConfig,
      earthMode: 'insulated' as EarthMode,
      maxAmps: null as number | null,
      color: '#6b7280',
      description: '',
    };
  }

  openCableTypeForm(ct?: CableType) {
    this.cableTypeError.set(null);
    if (ct) {
      this.editingCableTypeId.set(ct.id);
      this.cableTypeForm = {
        name: ct.name,
        sizeMm: ct.sizeMm,
        material: ct.material || '',
        phaseConfig: ct.phaseConfig || 'single_phase_earth',
        earthMode: ct.earthMode || 'insulated',
        maxAmps: ct.maxAmps,
        color: ct.color || '#6b7280',
        description: ct.description || '',
      };
    } else {
      this.editingCableTypeId.set(null);
      this.cableTypeForm = this.emptyCableTypeForm();
    }
    this.showCableTypeForm.set(true);
  }

  async saveCableType() {
    this.cableTypeError.set(null);
    if (!this.cableTypeForm.name.trim()) {
      this.cableTypeError.set('أدخل اسم نوع الكيبل');
      return;
    }

    this.savingCableType.set(true);
    try {
      const data: any = {
        name: this.cableTypeForm.name,
        sizeMm: this.cableTypeForm.sizeMm,
        material: this.cableTypeForm.material || null,
        phaseConfig: this.cableTypeForm.phaseConfig,
        earthMode: this.cableTypeForm.earthMode,
        maxAmps: this.cableTypeForm.maxAmps,
        color: this.cableTypeForm.color,
        description: this.cableTypeForm.description || null,
      };

      const id = this.editingCableTypeId();
      if (id) {
        await this.network.updateCableType(id, data);
      } else {
        await this.network.addCableType(data);
      }
      this.showCableTypeForm.set(false);
    } catch (err: unknown) {
      this.cableTypeError.set(this.extractError(err) || 'تعذّر الحفظ');
    } finally {
      this.savingCableType.set(false);
    }
  }

  async removeCableType(ct: CableType) {
    if (!confirm(`حذف نوع الكابل "${ct.name}"؟`)) return;
    try { await this.network.deleteCableType(ct.id); } catch { alert('تعذّر الحذف'); }
  }

  private extractError(err: unknown): string | null {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const body = (err as { error?: { error?: string } }).error;
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error;
    }
    return null;
  }
}
