import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { StationService } from '../../../services/station.service';
import { NetworkService } from '../../../services/network.service';
import { Feeder, Panel, PanelType } from '../../../models/network.model';
import { shortenStationName } from '../../../utils/station-name';

type MainTab = 'feeders' | 'panels';

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

  activeTab = signal<MainTab>('feeders');
  stationFilter = signal<string>('all');
  feederFilter = signal<string>('all');
  search = signal('');

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

  async ngOnInit() {
    await Promise.all([
      this.network.loadFeeders(),
      this.network.loadPanels(),
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

  shortStation(name: string | null): string {
    return shortenStationName(name, '');
  }

  feederStatusLabel(s: string): string {
    return { active: 'شغّال', off: 'متوقف', maintenance: 'صيانة', overloaded: 'حمل زائد' }[s] ?? s;
  }

  panelTypeLabel(t: PanelType): string {
    return { sync: 'طبلة دمج', main_distribution: 'توزيع رئيسية', meter_box: 'طبلة عدّادات' }[t] ?? t;
  }

  statusLabel(s: string): string {
    return { active: 'نشط', inactive: 'متوقف', maintenance: 'صيانة' }[s] ?? s;
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
    return { stationId: '', feederId: '' as string | null, name: '', code: '', type: 'meter_box' as PanelType, poleNumber: '', notes: '' };
  }

  openPanelForm(panel?: Panel) {
    this.panelError.set(null);
    if (panel) {
      this.editingPanelId.set(panel.id);
      this.panelForm = { stationId: panel.stationId, feederId: panel.feederId, name: panel.name, code: panel.code || '', type: panel.type, poleNumber: panel.poleNumber || '', notes: panel.notes || '' };
    } else {
      this.editingPanelId.set(null);
      this.panelForm = this.emptyPanelForm();
      const sid = this.stationFilter();
      if (sid !== 'all') this.panelForm.stationId = sid;
    }
    this.showPanelForm.set(true);
  }

  async savePanel() {
    this.panelError.set(null);
    if (!this.panelForm.stationId) { this.panelError.set('اختر المحطة'); return; }
    if (!this.panelForm.name.trim()) { this.panelError.set('أدخل اسم الطبلة'); return; }

    this.savingPanel.set(true);
    try {
      const id = this.editingPanelId();
      if (id) {
        await this.network.updatePanel(id, this.panelForm);
      } else {
        await this.network.addPanel(this.panelForm);
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

  private extractError(err: unknown): string | null {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const body = (err as { error?: { error?: string } }).error;
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error;
    }
    return null;
  }
}
