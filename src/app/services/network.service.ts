import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Feeder, Panel, CableType, FeederSegment, MonitoringMeter, FeederPanelBreaker, BusbarType, FeederPanelBusbar } from '../models/network.model';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private http = inject(HttpClient);
  private api = '/api/network';

  feeders = signal<Feeder[]>([]);
  panels = signal<Panel[]>([]);
  cableTypes = signal<CableType[]>([]);
  segments = signal<FeederSegment[]>([]);
  allSegments = signal<FeederSegment[]>([]);
  monitoringMeters = signal<MonitoringMeter[]>([]);
  feederPanelBreakers = signal<FeederPanelBreaker[]>([]);
  busbarTypes = signal<BusbarType[]>([]);
  feederPanelBusbars = signal<FeederPanelBusbar[]>([]);

  async loadFeeders(stationId?: string) {
    const qs = stationId ? `?stationId=${stationId}` : '';
    const rows = await firstValueFrom(this.http.get<Feeder[]>(`${this.api}/feeders${qs}`));
    this.feeders.set(rows);
  }

  async loadPanels(params: { stationId?: string; feederId?: string; type?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.feederId) qs.set('feederId', params.feederId);
    if (params.type) qs.set('type', params.type);
    const url = qs.toString() ? `${this.api}/panels?${qs}` : `${this.api}/panels`;
    const rows = await firstValueFrom(this.http.get<Panel[]>(url));
    this.panels.set(rows);
  }

  async addFeeder(data: Partial<Feeder>) {
    await firstValueFrom(this.http.post(`${this.api}/feeders`, data));
    await this.loadFeeders();
  }

  async updateFeeder(id: string, data: Partial<Feeder>) {
    await firstValueFrom(this.http.put(`${this.api}/feeders/${id}`, data));
    await this.loadFeeders();
  }

  async updateFeederRoute(id: string, routeCoordinates: [number, number][] | null) {
    await firstValueFrom(this.http.put(`${this.api}/feeders/${id}`, { routeCoordinates }));
    await this.loadFeeders();
  }

  async deleteFeeder(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/feeders/${id}`));
    await this.loadFeeders();
  }

  async addPanel(data: Partial<Panel>) {
    await firstValueFrom(this.http.post(`${this.api}/panels`, data));
    await this.loadPanels();
  }

  async updatePanel(id: string, data: Partial<Panel>) {
    await firstValueFrom(this.http.put(`${this.api}/panels/${id}`, data));
    await this.loadPanels();
  }

  async updatePanelLocation(id: string, latitude: number, longitude: number) {
    await firstValueFrom(this.http.put(`${this.api}/panels/${id}`, { latitude, longitude }));
    await this.loadPanels();
  }

  async deletePanel(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/panels/${id}`));
    await this.loadPanels();
  }

  // ============ Feeder Panel Breakers ============

  async loadFeederPanelBreakers(panelId: string) {
    const rows = await firstValueFrom(this.http.get<FeederPanelBreaker[]>(`${this.api}/panels/${panelId}/breakers`));
    this.feederPanelBreakers.set(rows);
  }

  async addFeederPanelBreaker(panelId: string, data: Partial<FeederPanelBreaker>) {
    const created = await firstValueFrom(this.http.post<FeederPanelBreaker>(`${this.api}/panels/${panelId}/breakers`, data));
    await this.loadFeederPanelBreakers(panelId);
    await this.loadPanels();
    return created;
  }

  async updateFeederPanelBreaker(id: string, panelId: string, data: Partial<FeederPanelBreaker>) {
    const updated = await firstValueFrom(this.http.put<FeederPanelBreaker>(`${this.api}/breakers/${id}`, data));
    await this.loadFeederPanelBreakers(panelId);
    await this.loadPanels();
    return updated;
  }

  async deleteFeederPanelBreaker(id: string, panelId: string) {
    await firstValueFrom(this.http.delete(`${this.api}/breakers/${id}`));
    await this.loadFeederPanelBreakers(panelId);
    await this.loadPanels();
  }

  // ============ Feeder Panel Busbars ============

  async loadBusbarTypes() {
    const rows = await firstValueFrom(this.http.get<BusbarType[]>(`${this.api}/busbar-types`));
    this.busbarTypes.set(rows);
  }

  async addBusbarType(data: Partial<BusbarType>) {
    const created = await firstValueFrom(this.http.post<BusbarType>(`${this.api}/busbar-types`, data));
    await this.loadBusbarTypes();
    return created;
  }

  async updateBusbarType(id: string, data: Partial<BusbarType>) {
    const updated = await firstValueFrom(this.http.put<BusbarType>(`${this.api}/busbar-types/${id}`, data));
    await this.loadBusbarTypes();
    return updated;
  }

  async deleteBusbarType(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/busbar-types/${id}`));
    await this.loadBusbarTypes();
  }

  async loadFeederPanelBusbars(panelId: string) {
    const rows = await firstValueFrom(this.http.get<FeederPanelBusbar[]>(`${this.api}/panels/${panelId}/busbars`));
    this.feederPanelBusbars.set(rows);
  }

  async addFeederPanelBusbar(panelId: string, data: Partial<FeederPanelBusbar>) {
    const created = await firstValueFrom(this.http.post<FeederPanelBusbar>(`${this.api}/panels/${panelId}/busbars`, data));
    await this.loadFeederPanelBusbars(panelId);
    await this.loadPanels();
    return created;
  }

  async updateFeederPanelBusbar(id: string, panelId: string, data: Partial<FeederPanelBusbar>) {
    const updated = await firstValueFrom(this.http.put<FeederPanelBusbar>(`${this.api}/panel-busbars/${id}`, data));
    await this.loadFeederPanelBusbars(panelId);
    await this.loadPanels();
    return updated;
  }

  async deleteFeederPanelBusbar(id: string, panelId: string) {
    await firstValueFrom(this.http.delete(`${this.api}/panel-busbars/${id}`));
    await this.loadFeederPanelBusbars(panelId);
    await this.loadPanels();
  }

  // ============ Cable Types ============

  async loadCableTypes() {
    const rows = await firstValueFrom(this.http.get<CableType[]>('/api/cable-types'));
    this.cableTypes.set(rows);
  }

  async addCableType(data: Partial<CableType>) {
    const created = await firstValueFrom(this.http.post<CableType>('/api/cable-types', data));
    await this.loadCableTypes();
    return created;
  }

  async updateCableType(id: string, data: Partial<CableType>) {
    await firstValueFrom(this.http.put(`/api/cable-types/${id}`, data));
    await this.loadCableTypes();
  }

  async deleteCableType(id: string) {
    await firstValueFrom(this.http.delete(`/api/cable-types/${id}`));
    await this.loadCableTypes();
  }

  // ============ Feeder Segments ============

  async loadSegments(feederId: string) {
    const rows = await firstValueFrom(
      this.http.get<FeederSegment[]>(`${this.api}/feeders/${feederId}/segments`)
    );
    this.segments.set(rows);
  }

  async loadAllSegments(params: { stationId?: string; feederId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.feederId) qs.set('feederId', params.feederId);
    const url = qs.toString() ? `${this.api}/segments?${qs}` : `${this.api}/segments`;
    const rows = await firstValueFrom(this.http.get<FeederSegment[]>(url));
    this.allSegments.set(rows);
  }

  async fetchSegments(feederId: string): Promise<FeederSegment[]> {
    return firstValueFrom(
      this.http.get<FeederSegment[]>(`${this.api}/feeders/${feederId}/segments`)
    );
  }

  async addSegment(feederId: string, data: Partial<FeederSegment>) {
    const created = await firstValueFrom(
      this.http.post<FeederSegment>(`${this.api}/feeders/${feederId}/segments`, data)
    );
    await this.loadSegments(feederId);
    await this.loadAllSegments();
    return created;
  }

  async updateSegment(id: string, data: Partial<FeederSegment>) {
    const updated = await firstValueFrom(
      this.http.put<FeederSegment>(`${this.api}/segments/${id}`, data)
    );
    // Re-load segments for the updated segment's feeder
    if (updated.feederId) {
      await this.loadSegments(updated.feederId);
    }
    await this.loadAllSegments();
    return updated;
  }

  async deleteSegment(id: string, feederId: string) {
    await firstValueFrom(this.http.delete(`${this.api}/segments/${id}`));
    await this.loadSegments(feederId);
    await this.loadAllSegments();
  }

  // ============ Monitoring Meters ============

  async loadMonitoringMeters(params: { stationId?: string; targetType?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.stationId) qs.set('stationId', params.stationId);
    if (params.targetType) qs.set('targetType', params.targetType);
    const url = qs.toString() ? `${this.api}/monitoring-meters?${qs}` : `${this.api}/monitoring-meters`;
    const rows = await firstValueFrom(this.http.get<MonitoringMeter[]>(url));
    this.monitoringMeters.set(rows);
  }

  async addMonitoringMeter(data: Partial<MonitoringMeter>) {
    const created = await firstValueFrom(this.http.post<MonitoringMeter>(`${this.api}/monitoring-meters`, data));
    await this.loadMonitoringMeters();
    return created;
  }

  async updateMonitoringMeter(id: string, data: Partial<MonitoringMeter>) {
    const updated = await firstValueFrom(this.http.put<MonitoringMeter>(`${this.api}/monitoring-meters/${id}`, data));
    await this.loadMonitoringMeters();
    return updated;
  }

  async deleteMonitoringMeter(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/monitoring-meters/${id}`));
    await this.loadMonitoringMeters();
  }
}
