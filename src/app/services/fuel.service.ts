import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  FuelSupplier,
  SupplierSite,
  Tanker,
  Tank,
  Pump,
  PumpChannel,
  Generator,
  FuelReceipt,
  FuelTransfer,
  GeneratorConsumption,
  TankLevel,
} from '../models/fuel.model';

@Injectable({ providedIn: 'root' })
export class FuelService {
  private http = inject(HttpClient);
  private api = '/api/fuel';

  suppliers = signal<FuelSupplier[]>([]);
  supplierSites = signal<SupplierSite[]>([]);
  tankers = signal<Tanker[]>([]);
  tanks = signal<Tank[]>([]);
  pumps = signal<Pump[]>([]);
  pumpChannels = signal<PumpChannel[]>([]);
  generators = signal<Generator[]>([]);
  receipts = signal<FuelReceipt[]>([]);
  transfers = signal<FuelTransfer[]>([]);
  consumption = signal<GeneratorConsumption[]>([]);
  levels = signal<TankLevel[]>([]);

  // ---------- Suppliers ----------
  async loadSuppliers() {
    this.suppliers.set(await firstValueFrom(this.http.get<FuelSupplier[]>(`${this.api}/suppliers`)));
  }
  async addSupplier(data: Partial<FuelSupplier>) {
    const created = await firstValueFrom(this.http.post<FuelSupplier>(`${this.api}/suppliers`, data));
    this.suppliers.update((l) => [...l, created]);
    return created;
  }
  async updateSupplier(id: string, data: Partial<FuelSupplier>) {
    const updated = await firstValueFrom(this.http.put<FuelSupplier>(`${this.api}/suppliers/${id}`, data));
    this.suppliers.update((l) => l.map((s) => (s.id === id ? updated : s)));
  }
  async deleteSupplier(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/suppliers/${id}`));
    this.suppliers.update((l) => l.filter((s) => s.id !== id));
  }

  // ---------- Supplier Sites ----------
  async loadSupplierSites(supplierId?: string) {
    const url = supplierId ? `${this.api}/supplier-sites?supplierId=${supplierId}` : `${this.api}/supplier-sites`;
    this.supplierSites.set(await firstValueFrom(this.http.get<SupplierSite[]>(url)));
  }
  async addSupplierSite(data: Partial<SupplierSite>) {
    const created = await firstValueFrom(this.http.post<SupplierSite>(`${this.api}/supplier-sites`, data));
    this.supplierSites.update((l) => [...l, created]);
    return created;
  }
  async updateSupplierSite(id: string, data: Partial<SupplierSite>) {
    const updated = await firstValueFrom(this.http.put<SupplierSite>(`${this.api}/supplier-sites/${id}`, data));
    this.supplierSites.update((l) => l.map((s) => (s.id === id ? updated : s)));
    return updated;
  }
  async deleteSupplierSite(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/supplier-sites/${id}`));
    this.supplierSites.update((l) => l.filter((s) => s.id !== id));
  }

  // ---------- Tankers ----------
  async loadTankers() {
    this.tankers.set(await firstValueFrom(this.http.get<Tanker[]>(`${this.api}/tankers`)));
  }
  async addTanker(data: Partial<Tanker>) {
    const created = await firstValueFrom(this.http.post<Tanker>(`${this.api}/tankers`, data));
    this.tankers.update((l) => [...l, created]);
    return created;
  }
  async deleteTanker(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/tankers/${id}`));
    this.tankers.update((l) => l.filter((t) => t.id !== id));
  }

  // ---------- Tanks ----------
  async loadTanks(stationId?: string) {
    const url = stationId ? `${this.api}/tanks?stationId=${stationId}` : `${this.api}/tanks`;
    this.tanks.set(await firstValueFrom(this.http.get<Tank[]>(url)));
  }
  async addTank(data: Partial<Tank>) {
    const created = await firstValueFrom(this.http.post<Tank>(`${this.api}/tanks`, data));
    this.tanks.update((l) => [...l, created]);
    return created;
  }
  async updateTank(id: string, data: Partial<Tank>) {
    const updated = await firstValueFrom(this.http.put<Tank>(`${this.api}/tanks/${id}`, data));
    this.tanks.update((l) => l.map((t) => (t.id === id ? updated : t)));
  }
  async deleteTank(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/tanks/${id}`));
    this.tanks.update((l) => l.filter((t) => t.id !== id));
  }

  // ---------- Pumps ----------
  async loadPumps(stationId?: string) {
    const url = stationId ? `${this.api}/pumps?stationId=${stationId}` : `${this.api}/pumps`;
    this.pumps.set(await firstValueFrom(this.http.get<Pump[]>(url)));
  }
  async addPump(data: Partial<Pump>) {
    const created = await firstValueFrom(this.http.post<Pump>(`${this.api}/pumps`, data));
    this.pumps.update((l) => [...l, created]);
    return created;
  }
  async updatePump(id: string, data: Partial<Pump>) {
    const updated = await firstValueFrom(this.http.put<Pump>(`${this.api}/pumps/${id}`, data));
    this.pumps.update((l) => l.map((p) => (p.id === id ? updated : p)));
  }
  async deletePump(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/pumps/${id}`));
    this.pumps.update((l) => l.filter((p) => p.id !== id));
  }

  // ---------- Pump Channels ----------
  async loadPumpChannels(pumpId?: string) {
    const url = pumpId ? `${this.api}/pump-channels?pumpId=${pumpId}` : `${this.api}/pump-channels`;
    this.pumpChannels.set(await firstValueFrom(this.http.get<PumpChannel[]>(url)));
  }
  async addPumpChannel(data: Partial<PumpChannel>) {
    const created = await firstValueFrom(this.http.post<PumpChannel>(`${this.api}/pump-channels`, data));
    this.pumpChannels.update((l) => [...l, created]);
    return created;
  }
  async deletePumpChannel(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/pump-channels/${id}`));
    this.pumpChannels.update((l) => l.filter((c) => c.id !== id));
  }

  // ---------- Generators ----------
  async loadGenerators(stationId?: string) {
    const url = stationId ? `${this.api}/generators?stationId=${stationId}` : `${this.api}/generators`;
    this.generators.set(await firstValueFrom(this.http.get<Generator[]>(url)));
  }
  async addGenerator(data: Partial<Generator>) {
    const created = await firstValueFrom(this.http.post<Generator>(`${this.api}/generators`, data));
    this.generators.update((l) => [...l, created]);
    return created;
  }
  async updateGenerator(id: string, data: Partial<Generator>) {
    const updated = await firstValueFrom(this.http.put<Generator>(`${this.api}/generators/${id}`, data));
    this.generators.update((l) => l.map((g) => (g.id === id ? updated : g)));
  }
  async deleteGenerator(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/generators/${id}`));
    this.generators.update((l) => l.filter((g) => g.id !== id));
  }

  // ---------- Fuel Receipts ----------
  async loadReceipts(stationId?: string) {
    const url = stationId ? `${this.api}/receipts?stationId=${stationId}` : `${this.api}/receipts`;
    this.receipts.set(await firstValueFrom(this.http.get<FuelReceipt[]>(url)));
  }
  async addReceipt(data: Partial<FuelReceipt>) {
    const created = await firstValueFrom(this.http.post<FuelReceipt>(`${this.api}/receipts`, data));
    this.receipts.update((l) => [...l, created]);
    return created;
  }
  async deleteReceipt(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/receipts/${id}`));
    this.receipts.update((l) => l.filter((r) => r.id !== id));
  }

  // ---------- Transfers ----------
  async loadTransfers(stationId?: string) {
    const url = stationId ? `${this.api}/transfers?stationId=${stationId}` : `${this.api}/transfers`;
    this.transfers.set(await firstValueFrom(this.http.get<FuelTransfer[]>(url)));
  }
  async addTransfer(data: Partial<FuelTransfer>) {
    const created = await firstValueFrom(this.http.post<FuelTransfer>(`${this.api}/transfers`, data));
    this.transfers.update((l) => [...l, created]);
    return created;
  }
  async deleteTransfer(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/transfers/${id}`));
    this.transfers.update((l) => l.filter((t) => t.id !== id));
  }

  // ---------- Consumption ----------
  async loadConsumption(params: { stationId?: string; generatorId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.generatorId) qs.set('generatorId', params.generatorId);
    const url = qs.toString() ? `${this.api}/consumption?${qs.toString()}` : `${this.api}/consumption`;
    this.consumption.set(await firstValueFrom(this.http.get<GeneratorConsumption[]>(url)));
  }
  async addConsumption(data: Partial<GeneratorConsumption>) {
    const created = await firstValueFrom(this.http.post<GeneratorConsumption>(`${this.api}/consumption`, data));
    this.consumption.update((l) => [...l, created]);
    return created;
  }
  async deleteConsumption(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/consumption/${id}`));
    this.consumption.update((l) => l.filter((c) => c.id !== id));
  }

  // ---------- Levels ----------
  async loadLevels(stationId: string) {
    const data = await firstValueFrom(this.http.get<TankLevel[]>(`${this.api}/levels?stationId=${stationId}`));
    this.levels.set(data);
    return data;
  }
}
