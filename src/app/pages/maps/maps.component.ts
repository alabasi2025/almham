import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import * as L from 'leaflet';

import { StationService } from '../../services/station.service';
import { FuelService } from '../../services/fuel.service';
import { Station } from '../../models/station.model';
import { SupplierSite } from '../../models/fuel.model';

interface GeoResult {
  display_name: string;
  lat: number;
  lon: number;
  type: string;
  class?: string;
}

interface YemenPlace {
  name: string;
  lat: number;
  lng: number;
  rank: 1 | 2 | 3 | 4; // 1 = capital/major, 4 = smaller
}

/** Curated Arabic labels for major Yemeni cities & governorate capitals.
 *  Guaranteed to display in Arabic on any base layer (including satellite). */
const YEMEN_PLACES: YemenPlace[] = [
  // Tier 1 — major national cities
  { name: 'صنعاء', lat: 15.3694, lng: 44.1910, rank: 1 },
  { name: 'عدن', lat: 12.7855, lng: 45.0187, rank: 1 },
  { name: 'تعز', lat: 13.5789, lng: 44.0209, rank: 1 },
  { name: 'الحديدة', lat: 14.7979, lng: 42.9545, rank: 1 },
  // Tier 2 — governorate capitals / large cities
  { name: 'إب', lat: 13.9667, lng: 44.1833, rank: 2 },
  { name: 'ذمار', lat: 14.5422, lng: 44.4056, rank: 2 },
  { name: 'المكلا', lat: 14.5425, lng: 49.1242, rank: 2 },
  { name: 'حجة', lat: 15.6947, lng: 43.6042, rank: 2 },
  { name: 'سقطرى', lat: 12.4634, lng: 53.8237, rank: 2 },
  { name: 'صعدة', lat: 16.9409, lng: 43.7617, rank: 2 },
  { name: 'مأرب', lat: 15.4667, lng: 45.3250, rank: 2 },
  // Tier 3 — governorate capitals / regional centers
  { name: 'عمران', lat: 15.6588, lng: 43.9441, rank: 3 },
  { name: 'سيئون', lat: 15.9380, lng: 48.7931, rank: 3 },
  { name: 'عتق', lat: 14.5407, lng: 46.8259, rank: 3 },
  { name: 'الغيضة', lat: 16.2167, lng: 52.1833, rank: 3 },
  { name: 'لحج', lat: 13.0567, lng: 44.8809, rank: 3 },
  { name: 'زنجبار', lat: 13.1195, lng: 45.3836, rank: 3 },
  { name: 'البيضاء', lat: 13.9787, lng: 45.5738, rank: 3 },
  { name: 'رداع', lat: 14.4107, lng: 44.8362, rank: 3 },
  { name: 'المحويت', lat: 15.4700, lng: 43.5450, rank: 3 },
  { name: 'الضالع', lat: 13.6950, lng: 44.7314, rank: 3 },
  { name: 'الجوف', lat: 16.7000, lng: 45.5000, rank: 3 },
  // Tier 4 — historic / smaller cities
  { name: 'يريم', lat: 14.2917, lng: 44.3667, rank: 4 },
  { name: 'بيحان', lat: 14.7833, lng: 45.7167, rank: 4 },
  { name: 'شبام', lat: 15.9270, lng: 48.6267, rank: 4 },
  { name: 'تريم', lat: 16.0566, lng: 49.0239, rank: 4 },
  { name: 'زبيد', lat: 14.1950, lng: 43.3150, rank: 4 },
  { name: 'المخا', lat: 13.3222, lng: 43.2450, rank: 4 },
  { name: 'حبان', lat: 14.3500, lng: 47.0833, rank: 4 },
  { name: 'عبس', lat: 16.0070, lng: 43.1960, rank: 4 },
];

type LayerKind = 'stations' | 'suppliers';
type TileStyle = 'streets' | 'dark' | 'satellite';

interface MapPoint {
  id: string;
  kind: LayerKind;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  raw: Station | (SupplierSite & { supplierName?: string });
}

@Component({
  selector: 'app-maps',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './maps.component.html',
  styleUrls: ['./maps.component.scss'],
})
export class MapsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  stationService = inject(StationService);
  fuel = inject(FuelService);
  private snack = inject(MatSnackBar);
  private http = inject(HttpClient);

  // Yemen-focused map configuration
  // Bounding box of Yemen (with slight padding)
  private readonly yemenBounds: L.LatLngBoundsExpression = [
    [11.8, 41.5],  // Southwest (Gulf of Aden / Red Sea)
    [19.2, 54.8],  // Northeast (Saudi / Oman borders)
  ];
  private readonly defaultCenter: [number, number] = [15.5527, 48.5164]; // Center of Yemen
  private readonly defaultZoom = 6;
  private readonly minZoom = 6;
  private readonly maxZoom = 18;

  private map?: L.Map;
  private stationLayer?: L.LayerGroup;
  private supplierLayer?: L.LayerGroup;
  private tileLayer?: L.TileLayer;
  private placeLabelsLayer?: L.LayerGroup;
  private tempMarker?: L.Marker;

  // UI state signals
  showStations = signal(true);
  showSuppliers = signal(true);
  // Default: streets (OSM) — shows Yemeni cities in Arabic natively
  tileStyle = signal<TileStyle>('streets');
  search = signal('');
  selectedPointId = signal<string | null>(null);

  // Edit mode
  editingMode = signal<{ kind: LayerKind; id: string; name: string } | null>(null);

  // Geocoder (place search)
  geoQuery = signal('');
  geoResults = signal<GeoResult[]>([]);
  geoLoading = signal(false);
  geoFocused = signal(false);
  private geoDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit() {
    this.stationService.loadAll();
    await Promise.all([
      this.fuel.loadSuppliers(),
      this.fuel.loadSupplierSites(),
    ]);
  }

  ngAfterViewInit() {
    this.initMap();
    this.redrawMarkers();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  // ---------- derived ----------
  allPoints = computed<MapPoint[]>(() => {
    const pts: MapPoint[] = [];
    const stations = this.stationService.stations();
    const sites = this.fuel.supplierSites();
    const suppliers = this.fuel.suppliers();

    if (this.showStations()) {
      for (const s of stations) {
        const lat = this.toNum(s.latitude);
        const lng = this.toNum(s.longitude);
        if (lat == null || lng == null) continue;
        pts.push({
          id: `station:${s.id}`,
          kind: 'stations',
          title: s.name,
          subtitle: s.location || '—',
          lat,
          lng,
          raw: s,
        });
      }
    }

    if (this.showSuppliers()) {
      for (const site of sites) {
        const lat = this.toNum(site.latitude);
        const lng = this.toNum(site.longitude);
        if (lat == null || lng == null) continue;
        const sup = suppliers.find((x) => x.id === site.supplierId);
        pts.push({
          id: `site:${site.id}`,
          kind: 'suppliers',
          title: site.name,
          subtitle: sup ? `${sup.name} — ${site.location ?? ''}` : site.location ?? '—',
          lat,
          lng,
          raw: { ...site, supplierName: sup?.name },
        });
      }
    }
    return pts;
  });

  filteredPoints = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.allPoints();
    return this.allPoints().filter(
      (p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    );
  });

  unmappedStations = computed(() =>
    this.stationService.stations().filter(
      (s) => this.toNum(s.latitude) == null || this.toNum(s.longitude) == null
    )
  );

  unmappedSites = computed(() => {
    const suppliers = this.fuel.suppliers();
    return this.fuel.supplierSites()
      .filter((s) => this.toNum(s.latitude) == null || this.toNum(s.longitude) == null)
      .map((s) => ({
        ...s,
        supplierName: suppliers.find((x) => x.id === s.supplierId)?.name ?? '',
      }));
  });

  // ---------- map init ----------
  private initMap() {
    this.map = L.map(this.mapEl.nativeElement, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      maxBounds: this.yemenBounds,
      maxBoundsViscosity: 1.0, // Hard boundary — prevents dragging outside Yemen
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
    });

    // Fit initial view strictly to Yemen
    this.map.fitBounds(this.yemenBounds, { padding: [20, 20] });

    L.control.zoom({ position: 'topleft' }).addTo(this.map);
    L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(this.map);

    this.applyTileStyle();

    this.stationLayer = L.layerGroup().addTo(this.map);
    this.supplierLayer = L.layerGroup().addTo(this.map);

    // Arabic place labels (always on, curated dataset)
    this.buildPlaceLabels();

    // Click handler for edit mode
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const mode = this.editingMode();
      if (!mode) return;
      this.saveCoordinatesFor(mode, e.latlng.lat, e.latlng.lng);
    });

    // Rebuild labels when zoom changes (to show/hide by rank)
    this.map.on('zoomend', () => this.buildPlaceLabels());
  }

  private buildPlaceLabels() {
    if (!this.map) return;
    if (!this.placeLabelsLayer) {
      this.placeLabelsLayer = L.layerGroup().addTo(this.map);
    } else {
      this.placeLabelsLayer.clearLayers();
    }

    const zoom = this.map.getZoom();
    // Show more labels as user zooms in
    const maxRank =
      zoom >= 12 ? 4 :
      zoom >= 10 ? 4 :
      zoom >= 8  ? 3 :
      zoom >= 7  ? 2 :
                   1;

    for (const p of YEMEN_PLACES) {
      if (p.rank > maxRank) continue;
      const icon = L.divIcon({
        html: `<div class="ar-place-label rank-${p.rank}">${p.name}</div>`,
        className: 'ar-place-label-wrap',
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
      L.marker([p.lat, p.lng], {
        icon,
        interactive: false,
        keyboard: false,
      }).addTo(this.placeLabelsLayer!);
    }
  }

  private applyTileStyle() {
    if (!this.map) return;
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
      this.tileLayer = undefined;
    }

    const style = this.tileStyle();

    // OSM France tiles render local-language names (Arabic in Yemen) more densely.
    // Dark mode applies CSS filter to preserve Arabic labels with a dark aesthetic.
    const configs: Record<TileStyle, { url: string; attribution: string; className: string }> = {
      streets: {
        url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap France | &copy; OpenStreetMap contributors',
        className: 'tiles-streets',
      },
      dark: {
        url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap France | &copy; OpenStreetMap contributors',
        className: 'tiles-dark',
      },
      satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri — World Imagery',
        className: 'tiles-satellite',
      },
    };

    const cfg = configs[style];
    this.tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: this.maxZoom,
      minZoom: this.minZoom,
      className: cfg.className,
    });

    // Error/load logging for debugging
    this.tileLayer.on('tileerror', (e: L.TileErrorEvent) => {
      console.warn('[Map] Tile load error:', (e as any).src || e);
    });

    this.tileLayer.addTo(this.map);
    // Labels are in markerPane (above tilePane) so they stay on top automatically.
  }

  // ---------- markers ----------
  private redrawMarkers() {
    if (!this.map || !this.stationLayer || !this.supplierLayer) return;
    this.stationLayer.clearLayers();
    this.supplierLayer.clearLayers();

    for (const p of this.allPoints()) {
      const marker = L.marker([p.lat, p.lng], {
        icon: this.buildIcon(p.kind, p.title),
      });
      marker.bindPopup(this.buildPopup(p), { closeButton: true, className: 'modern-popup' });
      marker.on('click', () => this.selectedPointId.set(p.id));
      if (p.kind === 'stations') this.stationLayer.addLayer(marker);
      else this.supplierLayer.addLayer(marker);
    }

    this.toggleLayerVisibility();
  }

  private buildIcon(kind: LayerKind, label: string): L.DivIcon {
    const color = kind === 'stations' ? '#8b5cf6' : '#f59e0b';
    const glow = kind === 'stations' ? 'rgba(139, 92, 246, 0.55)' : 'rgba(245, 158, 11, 0.55)';
    const iconSvg =
      kind === 'stations'
        ? '<path d="M12 2L2 7v10c0 5.55 3.84 10 8 9 4.16 1 8-3.45 8-9V7l-10-5z" fill="white"/><path d="M8 11l2 2 4-4" stroke="#0a0e27" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
        : '<circle cx="12" cy="12" r="4" fill="white"/><path d="M12 2C7 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-3-8-8-8z" fill="white" opacity="0.3"/>';

    const html = `
      <div class="pin-wrap" style="--pin-color:${color}; --pin-glow:${glow}">
        <div class="pin-pulse"></div>
        <div class="pin-body">
          <svg viewBox="0 0 24 24">${iconSvg}</svg>
        </div>
        <div class="pin-label">${this.escapeHtml(label)}</div>
      </div>`;

    return L.divIcon({
      html,
      className: 'custom-pin',
      iconSize: [44, 52],
      iconAnchor: [22, 48],
      popupAnchor: [0, -48],
    });
  }

  private buildPopup(p: MapPoint): string {
    const isStation = p.kind === 'stations';
    const badgeColor = isStation ? '#8b5cf6' : '#f59e0b';
    const badgeText = isStation ? 'محطة' : 'مورد';
    const icon = isStation ? 'shield' : 'local_shipping';

    return `
      <div class="popup-card" dir="rtl">
        <div class="popup-head" style="--c:${badgeColor}">
          <span class="popup-badge">${badgeText}</span>
        </div>
        <h3>${this.escapeHtml(p.title)}</h3>
        <p>${this.escapeHtml(p.subtitle)}</p>
        <div class="popup-coords">
          <span>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span>
        </div>
      </div>`;
  }

  private toggleLayerVisibility() {
    if (!this.map || !this.stationLayer || !this.supplierLayer) return;
    if (this.showStations()) this.map.addLayer(this.stationLayer);
    else this.map.removeLayer(this.stationLayer);
    if (this.showSuppliers()) this.map.addLayer(this.supplierLayer);
    else this.map.removeLayer(this.supplierLayer);
  }

  // ---------- UI actions ----------
  focusPoint(p: MapPoint) {
    this.selectedPointId.set(p.id);
    this.map?.flyTo([p.lat, p.lng], 14, { duration: 1.1 });
  }

  setTileStyle(style: TileStyle) {
    this.tileStyle.set(style);
    this.applyTileStyle();
  }

  toggleLayer(kind: LayerKind) {
    if (kind === 'stations') this.showStations.set(!this.showStations());
    else this.showSuppliers.set(!this.showSuppliers());
    this.redrawMarkers();
  }

  fitToAll() {
    const pts = this.allPoints();
    if (pts.length === 0) {
      this.map?.flyToBounds(this.yemenBounds, { padding: [40, 40], duration: 1 });
      return;
    }
    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
    this.map?.flyToBounds(bounds, { padding: [60, 60], duration: 1 });
  }

  fitToYemen() {
    this.map?.flyToBounds(this.yemenBounds, { padding: [40, 40], duration: 1 });
  }

  // ---------- editing ----------
  startEditStation(s: Station) {
    this.editingMode.set({ kind: 'stations', id: s.id, name: s.name });
    this.snack.open(
      `اضغط على الخريطة لتعيين موقع "${s.name}"`,
      'إلغاء',
      { duration: 8000 }
    )
    .onAction()
    .subscribe(() => this.cancelEdit());
  }

  startEditSite(site: SupplierSite & { supplierName?: string }) {
    this.editingMode.set({ kind: 'suppliers', id: site.id, name: site.name });
    this.snack.open(
      `اضغط على الخريطة لتعيين موقع "${site.name}"`,
      'إلغاء',
      { duration: 8000 }
    )
    .onAction()
    .subscribe(() => this.cancelEdit());
  }

  cancelEdit() {
    this.editingMode.set(null);
    if (this.tempMarker) {
      this.map?.removeLayer(this.tempMarker);
      this.tempMarker = undefined;
    }
  }

  private async saveCoordinatesFor(
    mode: { kind: LayerKind; id: string; name: string },
    lat: number,
    lng: number
  ) {
    try {
      if (mode.kind === 'stations') {
        this.stationService.update(mode.id, {
          latitude: lat,
          longitude: lng,
        } as Partial<Station>);
      } else {
        await this.fuel.updateSupplierSite(mode.id, {
          latitude: lat,
          longitude: lng,
        } as Partial<SupplierSite>);
      }
      this.snack.open(
        `✓ تم حفظ موقع "${mode.name}" (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        'حسناً',
        { duration: 3000 }
      );
      this.editingMode.set(null);
      // Redraw after a short delay to allow API roundtrip
      setTimeout(() => this.redrawMarkers(), 400);
    } catch (e) {
      console.error(e);
      this.snack.open('تعذر حفظ الإحداثيات', 'حسناً', { duration: 3000 });
    }
  }

  // ---------- geocoder (place search) ----------
  onGeoQueryChange(q: string) {
    this.geoQuery.set(q);
    if (this.geoDebounceTimer) clearTimeout(this.geoDebounceTimer);

    const trimmed = q.trim();
    if (trimmed.length < 2) {
      this.geoResults.set([]);
      this.geoLoading.set(false);
      return;
    }

    this.geoLoading.set(true);
    this.geoDebounceTimer = setTimeout(() => this.fetchGeoResults(trimmed), 350);
  }

  private async fetchGeoResults(q: string) {
    try {
      // Nominatim public endpoint — free, no API key, restricted to Yemen
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}` +
        `&countrycodes=ye` +
        `&format=json` +
        `&accept-language=ar` +
        `&limit=8` +
        `&viewbox=41.5,19.2,54.8,11.8` +
        `&bounded=1`;

      const res = await firstValueFrom(this.http.get<GeoResult[]>(url));
      this.geoResults.set(
        (res || []).map((r: GeoResult) => ({
          display_name: r.display_name,
          lat: +r.lat,
          lon: +r.lon,
          type: r.type,
          class: r.class,
        }))
      );
    } catch (e) {
      console.error('[Map] Geocoding failed:', e);
      this.geoResults.set([]);
    } finally {
      this.geoLoading.set(false);
    }
  }

  selectGeoResult(r: GeoResult) {
    this.map?.flyTo([r.lat, r.lon], 13, { duration: 1.2 });
    this.geoResults.set([]);
    this.geoQuery.set(this.shortPlaceName(r.display_name));
    this.geoFocused.set(false);

    // Drop a temporary marker that self-removes after a while
    if (this.tempMarker) this.map?.removeLayer(this.tempMarker);
    const icon = L.divIcon({
      html: `
        <div class="geo-pin">
          <div class="geo-pin-ring"></div>
          <div class="geo-pin-dot"></div>
        </div>`,
      className: 'geo-pin-wrap',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    this.tempMarker = L.marker([r.lat, r.lon], { icon })
      .addTo(this.map!)
      .bindPopup(`<div class="popup-card" dir="rtl"><h3>${this.escapeHtml(r.display_name)}</h3></div>`, {
        className: 'modern-popup',
      })
      .openPopup();
  }

  clearGeoSearch() {
    this.geoQuery.set('');
    this.geoResults.set([]);
    if (this.tempMarker) {
      this.map?.removeLayer(this.tempMarker);
      this.tempMarker = undefined;
    }
  }

  blurGeoSearch() {
    // Delay to allow click on a result to register first
    setTimeout(() => this.geoFocused.set(false), 200);
  }

  private shortPlaceName(display: string): string {
    const parts = display.split(',').map((s) => s.trim());
    return parts[0] || display;
  }

  // ---------- helpers ----------
  private toNum(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  stationName(s: Station): string {
    return s.name.replace('محطة ', '').replace(' لتوليد وتوزيع الكهرباء', '');
  }

  pointIcon(p: MapPoint): string {
    return p.kind === 'stations' ? 'shield' : 'local_shipping';
  }
}
