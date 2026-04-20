import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { StationService } from '../../../services/station.service';
import { FuelService } from '../../../services/fuel.service';
import { Generator } from '../../../models/fuel.model';

interface GenForm {
  id?: string;
  stationId: string;
  name: string;
  model: string;
  capacityKw: number;
  isBackup: boolean;
  rocketTankId: string | null;
  notes: string;
}

@Component({
  selector: 'app-generators',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './generators.component.html',
  styleUrls: ['./generators.component.scss'],
})
export class GeneratorsComponent implements OnInit {
  stationService = inject(StationService);
  fuel = inject(FuelService);

  // ---------- state ----------
  stationFilter = signal<string | 'all'>('all');
  search = signal('');
  showForm = signal(false);
  editingId = signal<string | null>(null);
  form: GenForm = this.emptyForm();

  async ngOnInit() {
    await Promise.all([
      this.fuel.loadGenerators(),
      this.fuel.loadTanks(),
    ]);
  }

  // ---------- computed ----------
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sid = this.stationFilter();
    return this.fuel.generators().filter((g) => {
      if (sid !== 'all' && g.stationId !== sid) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        (g.model || '').toLowerCase().includes(q)
      );
    });
  });

  totalCapacity = computed(() =>
    this.filtered().reduce((s, g) => s + (g.capacityKw || 0), 0),
  );

  capacityMW = computed(() => (this.totalCapacity() / 1000).toFixed(1));

  primaryCount = computed(() => this.filtered().filter((g) => !g.isBackup).length);
  backupCount = computed(() => this.filtered().filter((g) => g.isBackup).length);

  linkedCount = computed(() =>
    this.filtered().filter((g) => !!g.rocketTankId).length,
  );

  stationsWithGensCount = computed(() => {
    const ids = new Set(this.fuel.generators().map((g) => g.stationId));
    return ids.size;
  });

  // ---------- helpers ----------
  stationName(id: string): string {
    const s = this.stationService.stations().find((x) => x.id === id);
    if (!s) return '—';
    return s.name
      .replace(/^محطة\s+/, '')
      .replace(/\s+لتوليد\s+و?توزيع\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوليد\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوزيع\s+الكهرباء\s*$/, '');
  }

  tankName(id: string | null | undefined): string {
    if (!id) return 'غير مرتبط';
    return this.fuel.tanks().find((t) => t.id === id)?.name ?? 'غير مرتبط';
  }

  tanksForStation(stationId: string) {
    return this.fuel.tanks().filter(
      (t) => t.stationId === stationId && (t.role === 'generator' || t.role === 'pre_pump'),
    );
  }

  genCountForStation(stationId: string): number {
    return this.fuel.generators().filter((g) => g.stationId === stationId).length;
  }

  /** Scale capacity to largest generator for relative bar */
  capacityPct(kw: number): number {
    const max = Math.max(...this.fuel.generators().map((g) => g.capacityKw || 0), 1);
    return Math.min(100, Math.round((kw / max) * 100));
  }

  async refresh() {
    await Promise.all([this.fuel.loadGenerators(), this.fuel.loadTanks()]);
  }

  clearFilters() {
    this.search.set('');
    this.stationFilter.set('all');
  }

  // ---------- form / CRUD ----------
  emptyForm(): GenForm {
    return {
      stationId: this.stationService.stations()[0]?.id ?? '',
      name: '',
      model: '',
      capacityKw: 0,
      isBackup: false,
      rocketTankId: null,
      notes: '',
    };
  }

  openNew() {
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.showForm.set(true);
  }

  edit(g: Generator) {
    this.form = {
      id: g.id,
      stationId: g.stationId,
      name: g.name,
      model: g.model ?? '',
      capacityKw: g.capacityKw,
      isBackup: g.isBackup,
      rocketTankId: g.rocketTankId,
      notes: g.notes ?? '',
    };
    this.editingId.set(g.id);
    this.showForm.set(true);
  }

  cancel() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  async save() {
    if (!this.form.stationId || !this.form.name.trim()) return;
    const payload: Partial<Generator> = {
      stationId: this.form.stationId,
      name: this.form.name.trim(),
      model: this.form.model.trim() || null,
      capacityKw: Number(this.form.capacityKw),
      isBackup: this.form.isBackup,
      rocketTankId: this.form.rocketTankId || null,
      notes: this.form.notes.trim() || null,
    };
    const id = this.editingId();
    if (id) await this.fuel.updateGenerator(id, payload);
    else await this.fuel.addGenerator(payload);
    this.showForm.set(false);
    this.editingId.set(null);
  }

  async delete(g: Generator) {
    if (!confirm(`حذف المولد "${g.name}"؟`)) return;
    await this.fuel.deleteGenerator(g.id);
  }
}
