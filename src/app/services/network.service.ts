import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Feeder, Panel } from '../models/network.model';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private http = inject(HttpClient);
  private api = '/api/network';

  feeders = signal<Feeder[]>([]);
  panels = signal<Panel[]>([]);

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

  async deletePanel(id: string) {
    await firstValueFrom(this.http.delete(`${this.api}/panels/${id}`));
    await this.loadPanels();
  }
}
