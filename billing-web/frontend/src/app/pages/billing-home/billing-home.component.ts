import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BillingApiService, type BillingStation } from '../../services/billing-api.service';

@Component({
  selector: 'billing-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './billing-home.component.html',
  styleUrl: './billing-home.component.scss',
})
export class BillingHomeComponent {
  private billing = inject(BillingApiService);

  stations = signal<BillingStation[]>([]);
  selectedStationId = signal<string>('');
  loading = signal(false);
  error = signal<string | null>(null);

  selectedStation = computed(() => {
    const id = this.selectedStationId();
    return this.stations().find((station) => station.id === id) ?? null;
  });

  totalCustomers = computed(() =>
    this.stations().reduce((sum, station) => sum + Number(station.customersCount ?? 0), 0),
  );

  constructor() {
    void this.loadStations();
  }

  async loadStations() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.billing.loadStations();
      this.stations.set(rows);
      if (!this.selectedStationId() && rows[0]) {
        this.selectedStationId.set(rows[0].id);
      }
    } catch (err) {
      this.error.set(this.extractError(err));
    } finally {
      this.loading.set(false);
    }
  }

  setStation(stationId: string) {
    this.selectedStationId.set(stationId);
  }

  private extractError(err: unknown): string {
    const maybe = err as { error?: { error?: string }; message?: string };
    return maybe.error?.error ?? maybe.message ?? 'تعذر الاتصال بخدمة الفوترة';
  }
}
