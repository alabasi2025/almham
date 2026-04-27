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
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import * as L from 'leaflet';

import { StationService } from '../../../services/station.service';
import { NetworkService } from '../../../services/network.service';
import { Station } from '../../../models/station.model';
import { Feeder, Panel, CableType, FeederSegment } from '../../../models/network.model';

type TileStyle = 'streets' | 'dark' | 'satellite';

// Station color palette
const STATION_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './network-map.component.html',
  styleUrls: ['./network-map.component.scss'],
})
export class NetworkMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  stationService = inject(StationService);
  networkService = inject(NetworkService);
  private snack = inject(MatSnackBar);

  // Yemen map config
  private readonly yemenBounds: L.LatLngBoundsExpression = [
    [11.8, 41.5],
    [19.2, 54.8],
  ];
  private readonly defaultCenter: [number, number] = [15.5527, 48.5164];
  private readonly defaultZoom = 6;
  private readonly minZoom = 6;
  private readonly maxZoom = 18;

  private map?: L.Map;
  private tileLayer?: L.TileLayer;
  private stationLayer?: L.LayerGroup;
  private feederLayer?: L.LayerGroup;
  private panelLayer?: L.LayerGroup;

  // Segment layer
  private segmentLayer?: L.LayerGroup;

  // All segments indexed by feeder
  private allSegments = new Map<string, FeederSegment[]>();

  // Draw mode state
  private drawPolyline?: L.Polyline;
  private drawVertexMarkers: L.Marker[] = [];

  // Color map for stations
  private stationColorMap = new Map<string, string>();

  // UI signals
  tileStyle = signal<TileStyle>('dark');
  showStations = signal(true);
  showFeeders = signal(true);
  showPanels = signal(true);
  selectedStationId = signal<string>('');

  // Edit mode: placing a panel on the map
  editMode = signal<{ panelId: string; name: string } | null>(null);

  // Draw mode: drawing a feeder cable route (legacy)
  drawMode = signal<{ feederId: string; feederName: string } | null>(null);
  drawPoints = signal<[number, number][]>([]);

  // Draw segment mode: drawing a segment route
  drawSegmentMode = signal<{
    feederId: string;
    feederName: string;
    segmentId?: string;
    segmentType: 'main' | 'branch';
    cableTypeId: string | null;
    parentSegmentId: string | null;
    label: string;
  } | null>(null);
  drawSegmentPoints = signal<[number, number][]>([]);

  // Show segments on map
  showSegments = signal(true);

  // Cable type selection for draw mode
  selectedDrawCableTypeId = signal<string | null>(null);

  // Derived
  stations = computed(() => this.stationService.stations());

  filteredFeeders = computed(() => {
    const sid = this.selectedStationId();
    const feeders = this.networkService.feeders();
    return sid ? feeders.filter(f => f.stationId === sid) : feeders;
  });

  filteredPanels = computed(() => {
    const sid = this.selectedStationId();
    const panels = this.networkService.panels();
    return sid ? panels.filter(p => p.stationId === sid) : panels;
  });

  unmappedPanels = computed(() => {
    return this.filteredPanels().filter(p =>
      p.latitude == null || p.longitude == null ||
      p.latitude === '' || p.longitude === ''
    );
  });

  mappedPercent = computed(() => {
    const all = this.networkService.panels();
    if (all.length === 0) return 0;
    const mapped = all.filter(p =>
      p.latitude != null && p.latitude !== '' &&
      p.longitude != null && p.longitude !== ''
    ).length;
    return Math.round((mapped / all.length) * 100);
  });

  async ngOnInit() {
    this.stationService.loadAll();
    await Promise.all([
      this.networkService.loadFeeders(),
      this.networkService.loadPanels(),
      this.networkService.loadCableTypes(),
    ]);
    this.buildStationColorMap();
    await this.loadAllSegments();
    this.redrawAll();
  }

  private async loadAllSegments() {
    this.allSegments.clear();
    const feeders = this.networkService.feeders();
    for (const f of feeders) {
      try {
        const rows = await this.networkService.fetchSegments(f.id);
        if (rows && rows.length > 0) {
          this.allSegments.set(f.id, rows);
        }
      } catch {
        // Silently ignore per-feeder segment fetch errors
      }
    }
  }

  ngAfterViewInit() {
    this.initMap();
    this.redrawAll();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  // ---------- Station color mapping ----------
  private buildStationColorMap() {
    const stations = this.stationService.stations();
    stations.forEach((s, i) => {
      this.stationColorMap.set(s.id, STATION_COLORS[i % STATION_COLORS.length]);
    });
  }

  getStationColor(stationId: string): string {
    return this.stationColorMap.get(stationId) || '#8b5cf6';
  }

  // ---------- Map init ----------
  private initMap() {
    this.map = L.map(this.mapEl.nativeElement, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      maxBounds: this.yemenBounds,
      maxBoundsViscosity: 1.0,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
    });

    this.map.fitBounds(this.yemenBounds, { padding: [20, 20] });

    L.control.zoom({ position: 'topleft' }).addTo(this.map);
    L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(this.map);

    this.applyTileStyle();

    this.stationLayer = L.layerGroup().addTo(this.map);
    this.feederLayer = L.layerGroup().addTo(this.map);
    this.segmentLayer = L.layerGroup().addTo(this.map);
    this.panelLayer = L.layerGroup().addTo(this.map);

    // Click handler for edit/draw mode
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const edit = this.editMode();
      const draw = this.drawMode();
      const drawSeg = this.drawSegmentMode();

      if (edit) {
        this.savePanelLocation(edit, e.latlng.lat, e.latlng.lng);
        return;
      }

      if (draw) {
        this.addDrawPoint(e.latlng.lat, e.latlng.lng);
        return;
      }

      if (drawSeg) {
        this.addDrawSegmentPoint(e.latlng.lat, e.latlng.lng);
        return;
      }
    });
  }

  private applyTileStyle() {
    if (!this.map) return;
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
      this.tileLayer = undefined;
    }

    const style = this.tileStyle();
    const configs: Record<TileStyle, { url: string; attribution: string; className: string }> = {
      streets: {
        url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap France',
        className: 'tiles-streets',
      },
      dark: {
        url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap France',
        className: 'tiles-dark',
      },
      satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        className: 'tiles-satellite',
      },
    };

    const cfg = configs[style];
    this.tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: this.maxZoom,
      minZoom: this.minZoom,
      className: cfg.className,
    }).addTo(this.map);
  }

  setTileStyle(style: TileStyle) {
    this.tileStyle.set(style);
    this.applyTileStyle();
  }

  // ---------- Redraw all map elements ----------
  redrawAll() {
    if (!this.map) return;
    this.buildStationColorMap();
    this.redrawStations();
    this.redrawFeeders();
    this.redrawSegments();
    this.redrawPanels();
    this.toggleLayerVisibility();
  }

  private redrawStations() {
    if (!this.stationLayer) return;
    this.stationLayer.clearLayers();

    for (const s of this.stations()) {
      const lat = this.toNum(s.latitude);
      const lng = this.toNum(s.longitude);
      if (lat == null || lng == null) continue;

      const sid = this.selectedStationId();
      if (sid && s.id !== sid) continue;

      const color = this.getStationColor(s.id);
      const glow = this.hexToRgba(color, 0.55);

      const icon = L.divIcon({
        html: `
          <div class="station-pin" style="--pin-color:${color}; --pin-glow:${glow}">
            <div class="station-pin-pulse"></div>
            <div class="station-pin-body">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="station-label">${this.escapeHtml(s.name)}</div>
          </div>`,
        className: 'custom-pin',
        iconSize: [40, 48],
        iconAnchor: [20, 44],
        popupAnchor: [0, -44],
      });

      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(this.buildStationPopup(s, color), { closeButton: true, className: 'modern-popup' });
      this.stationLayer.addLayer(marker);
    }
  }

  private redrawFeeders() {
    if (!this.feederLayer) return;
    this.feederLayer.clearLayers();

    for (const f of this.filteredFeeders()) {
      if (!f.routeCoordinates || f.routeCoordinates.length < 2) continue;

      const color = this.getStationColor(f.stationId);
      const polyline = L.polyline(
        f.routeCoordinates.map(c => [c[0], c[1]] as L.LatLngTuple),
        {
          color,
          weight: 4,
          opacity: 0.8,
          dashArray: undefined,
          lineJoin: 'round',
          lineCap: 'round',
        }
      );

      polyline.bindPopup(this.buildFeederPopup(f, color), { closeButton: true, className: 'modern-popup' });
      this.feederLayer.addLayer(polyline);
    }
  }

  private redrawSegments() {
    if (!this.segmentLayer) return;
    this.segmentLayer.clearLayers();

    const sid = this.selectedStationId();

    for (const [feederId, segments] of this.allSegments.entries()) {
      // Filter by station if selected
      const feeder = this.networkService.feeders().find(f => f.id === feederId);
      if (!feeder) continue;
      if (sid && feeder.stationId !== sid) continue;

      for (const seg of segments) {
        if (!seg.routePoints || seg.routePoints.length < 2) continue;

        const color = seg.cableTypeColor || this.getStationColor(feeder.stationId);
        const isBranch = seg.segmentType === 'branch';

        const polyline = L.polyline(
          seg.routePoints.map(c => [c[0], c[1]] as L.LatLngTuple),
          {
            color,
            weight: isBranch ? 2.5 : 4,
            opacity: 0.85,
            dashArray: isBranch ? '6,4' : undefined,
            lineJoin: 'round',
            lineCap: 'round',
          }
        );

        polyline.bindPopup(this.buildSegmentPopup(seg, feeder, color), {
          closeButton: true,
          className: 'modern-popup',
        });

        this.segmentLayer.addLayer(polyline);
      }
    }
  }

  private buildSegmentPopup(seg: FeederSegment, feeder: Feeder, color: string): string {
    const typeLabel = seg.segmentType === 'main' ? '\u0631\u0626\u064A\u0633\u064A' : '\u062A\u0641\u0631\u064A\u0639\u0629';
    return `
      <div class="popup-card">
        <div class="popup-head">
          <span class="popup-badge" style="background:${color}">\u0645\u0642\u0637\u0639</span>
        </div>
        <h3>${this.escapeHtml(seg.label || '\u0628\u062F\u0648\u0646 \u062A\u0633\u0645\u064A\u0629')}</h3>
        <p>${this.escapeHtml(feeder.name)} \u2022 ${this.escapeHtml(feeder.stationName || '\u2014')}</p>
        <div class="popup-meta">
          <span class="meta-tag">${typeLabel}</span>
          ${seg.cableTypeName ? `<span class="meta-tag">${this.escapeHtml(seg.cableTypeName)}</span>` : ''}
          ${seg.lengthMeters ? `<span class="meta-tag">${seg.lengthMeters} \u0645</span>` : ''}
          <span class="meta-tag">${seg.routePoints?.length || 0} \u0646\u0642\u0637\u0629</span>
        </div>
      </div>`;
  }

  private redrawPanels() {
    if (!this.panelLayer) return;
    this.panelLayer.clearLayers();

    for (const p of this.filteredPanels()) {
      const lat = this.toNum(p.latitude);
      const lng = this.toNum(p.longitude);
      if (lat == null || lng == null) continue;

      const color = p.feederId ? this.getFeederColor(p.feederId) : this.getStationColor(p.stationId);
      const glow = this.hexToRgba(color, 0.3);

      const icon = L.divIcon({
        html: `<div class="panel-dot" style="--panel-color:${color}; --panel-glow:${glow}"></div>`,
        className: 'panel-circle',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10],
      });

      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(this.buildPanelPopup(p, color), { closeButton: true, className: 'modern-popup' });
      this.panelLayer.addLayer(marker);
    }
  }

  private toggleLayerVisibility() {
    if (!this.map) return;
    if (this.stationLayer) {
      if (this.showStations()) this.map.addLayer(this.stationLayer);
      else this.map.removeLayer(this.stationLayer);
    }
    if (this.feederLayer) {
      if (this.showFeeders()) this.map.addLayer(this.feederLayer);
      else this.map.removeLayer(this.feederLayer);
    }
    if (this.segmentLayer) {
      if (this.showSegments()) this.map.addLayer(this.segmentLayer);
      else this.map.removeLayer(this.segmentLayer);
    }
    if (this.panelLayer) {
      if (this.showPanels()) this.map.addLayer(this.panelLayer);
      else this.map.removeLayer(this.panelLayer);
    }
  }

  // ---------- Popups ----------
  private buildStationPopup(s: Station, color: string): string {
    const feedersCount = this.networkService.feeders().filter(f => f.stationId === s.id).length;
    const panelsCount = this.networkService.panels().filter(p => p.stationId === s.id).length;
    return `
      <div class="popup-card">
        <div class="popup-head">
          <span class="popup-badge" style="background:${color}">\u0645\u062D\u0637\u0629</span>
        </div>
        <h3>${this.escapeHtml(s.name)}</h3>
        <p>${this.escapeHtml(s.location || '\u2014')}</p>
        <div class="popup-meta">
          <span class="meta-tag">${feedersCount} \u0641\u064A\u062F\u0631</span>
          <span class="meta-tag">${panelsCount} \u0637\u0628\u0644\u0629</span>
          <span class="meta-tag">${s.status === 'active' ? '\u0646\u0634\u0637' : s.status}</span>
        </div>
      </div>`;
  }

  private buildFeederPopup(f: Feeder, color: string): string {
    const statusLabels: Record<string, string> = {
      'active': '\u0646\u0634\u0637',
      'off': '\u0645\u0637\u0641\u0623',
      'maintenance': '\u0635\u064A\u0627\u0646\u0629',
      'overloaded': '\u062D\u0645\u0644 \u0632\u0627\u0626\u062F',
    };
    return `
      <div class="popup-card">
        <div class="popup-head">
          <span class="popup-badge" style="background:${color}">\u0641\u064A\u062F\u0631</span>
        </div>
        <h3>${this.escapeHtml(f.name)}</h3>
        <p>${this.escapeHtml(f.stationName || '\u2014')}</p>
        <div class="popup-meta">
          <span class="meta-tag">${f.panelsCount} \u0637\u0628\u0644\u0629</span>
          <span class="meta-tag">${statusLabels[f.status] || f.status}</span>
          ${f.cableType ? `<span class="meta-tag">${this.escapeHtml(f.cableType)}</span>` : ''}
        </div>
      </div>`;
  }

  private buildPanelPopup(p: Panel, color: string): string {
    const typeLabels: Record<string, string> = {
      'sync': '\u0633\u0646\u0643',
      'main_distribution': '\u062A\u0648\u0632\u064A\u0639 \u0631\u0626\u064A\u0633\u064A',
      'meter_box': '\u0637\u0628\u0644\u0629 \u0639\u062F\u0627\u062F\u0627\u062A',
    };
    return `
      <div class="popup-card">
        <div class="popup-head">
          <span class="popup-badge" style="background:${color}">\u0637\u0628\u0644\u0629</span>
        </div>
        <h3>${this.escapeHtml(p.name)}</h3>
        <p>${this.escapeHtml(p.feederName || '\u2014')} \u2022 ${this.escapeHtml(p.stationName || '\u2014')}</p>
        <div class="popup-meta">
          <span class="meta-tag">${typeLabels[p.type] || p.type}</span>
          <span class="meta-tag">${p.status === 'active' ? '\u0646\u0634\u0637' : p.status}</span>
          ${p.poleNumber ? `<span class="meta-tag">\u0639\u0645\u0648\u062F ${this.escapeHtml(p.poleNumber)}</span>` : ''}
        </div>
      </div>`;
  }

  // ---------- Focus / navigation ----------
  focusFeeder(f: Feeder) {
    if (f.routeCoordinates && f.routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(f.routeCoordinates.map(c => [c[0], c[1]] as L.LatLngTuple));
      this.map?.flyToBounds(bounds, { padding: [80, 80], duration: 1 });
    }
  }

  fitToAll() {
    const allCoords: L.LatLngTuple[] = [];

    for (const s of this.stations()) {
      const lat = this.toNum(s.latitude);
      const lng = this.toNum(s.longitude);
      if (lat != null && lng != null) allCoords.push([lat, lng]);
    }

    for (const p of this.networkService.panels()) {
      const lat = this.toNum(p.latitude);
      const lng = this.toNum(p.longitude);
      if (lat != null && lng != null) allCoords.push([lat, lng]);
    }

    for (const f of this.networkService.feeders()) {
      if (f.routeCoordinates) {
        for (const c of f.routeCoordinates) {
          allCoords.push([c[0], c[1]]);
        }
      }
    }

    // Include segment coordinates
    for (const segments of this.allSegments.values()) {
      for (const seg of segments) {
        if (seg.routePoints) {
          for (const c of seg.routePoints) {
            allCoords.push([c[0], c[1]]);
          }
        }
      }
    }

    if (allCoords.length === 0) {
      this.map?.flyToBounds(this.yemenBounds, { padding: [40, 40], duration: 1 });
      return;
    }

    const bounds = L.latLngBounds(allCoords);
    this.map?.flyToBounds(bounds, { padding: [60, 60], duration: 1 });
  }

  // ---------- Edit Panel Location ----------
  startEditPanelLocation(p: Panel) {
    this.cancelDraw();
    this.cancelDrawSegment();
    this.editMode.set({ panelId: p.id, name: p.name });
    this.snack.open(
      `اضغط على الخريطة لتعيين موقع "${p.name}"`,
      'إلغاء',
      { duration: 8000 }
    ).onAction().subscribe(() => this.cancelEdit());
  }

  cancelEdit() {
    this.editMode.set(null);
  }

  private async savePanelLocation(mode: { panelId: string; name: string }, lat: number, lng: number) {
    try {
      await this.networkService.updatePanelLocation(mode.panelId, lat, lng);
      this.snack.open(
        `✓ تم حفظ موقع "${mode.name}" (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        'حسناً',
        { duration: 3000 }
      );
      this.editMode.set(null);
      setTimeout(() => this.redrawAll(), 400);
    } catch (e) {
      console.error(e);
      this.snack.open('تعذر حفظ الإحداثيات', 'حسناً', { duration: 3000 });
    }
  }

  // ---------- Draw Feeder Route ----------
  startDrawRoute(f: Feeder) {
    this.cancelEdit();
    this.cancelDraw();
    this.cancelDrawSegment();

    // If feeder has existing route, pre-load it
    const existing = f.routeCoordinates && f.routeCoordinates.length > 0 ? [...f.routeCoordinates] : [];
    this.drawPoints.set(existing);
    this.drawMode.set({ feederId: f.id, feederName: f.name });
    this.updateDrawVisuals();

    if (existing.length > 0) {
      const bounds = L.latLngBounds(existing.map(c => [c[0], c[1]] as L.LatLngTuple));
      this.map?.flyToBounds(bounds, { padding: [80, 80], duration: 1 });
    }

    this.snack.open(
      `وضع رسم المسار: اضغط على الخريطة لإضافة نقاط`,
      'حسناً',
      { duration: 4000 }
    );
  }

  private addDrawPoint(lat: number, lng: number) {
    const points = [...this.drawPoints(), [lat, lng] as [number, number]];
    this.drawPoints.set(points);
    this.updateDrawVisuals();
  }

  undoLastPoint() {
    const points = this.drawPoints().slice(0, -1);
    this.drawPoints.set(points);
    this.updateDrawVisuals();
  }

  clearDrawPoints() {
    this.drawPoints.set([]);
    this.updateDrawVisuals();
  }

  cancelDraw() {
    this.drawMode.set(null);
    this.drawPoints.set([]);
    this.clearDrawVisuals();
  }

  async saveRoute() {
    const mode = this.drawMode();
    if (!mode) return;
    const points = this.drawPoints();
    if (points.length < 2) return;

    try {
      await this.networkService.updateFeederRoute(mode.feederId, points);
      this.snack.open(
        `✓ تم حفظ مسار "${mode.feederName}" (${points.length} نقطة)`,
        'حسناً',
        { duration: 3000 }
      );
      this.drawMode.set(null);
      this.drawPoints.set([]);
      this.clearDrawVisuals();
      setTimeout(() => this.redrawAll(), 400);
    } catch (e) {
      console.error(e);
      this.snack.open('تعذر حفظ المسار', 'حسناً', { duration: 3000 });
    }
  }

  private updateDrawVisuals() {
    this.clearDrawVisuals();
    if (!this.map) return;

    const points = this.drawPoints();
    if (points.length === 0) return;

    // Draw polyline
    this.drawPolyline = L.polyline(
      points.map(c => [c[0], c[1]] as L.LatLngTuple),
      {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.9,
        dashArray: '8,6',
        lineJoin: 'round',
        lineCap: 'round',
      }
    ).addTo(this.map);

    // Draw vertex markers
    for (const p of points) {
      const icon = L.divIcon({
        html: `<div class="vertex-dot"></div>`,
        className: 'draw-vertex',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([p[0], p[1]], { icon, interactive: false });
      marker.addTo(this.map);
      this.drawVertexMarkers.push(marker);
    }
  }

  private clearDrawVisuals() {
    if (this.drawPolyline) {
      this.map?.removeLayer(this.drawPolyline);
      this.drawPolyline = undefined;
    }
    for (const m of this.drawVertexMarkers) {
      this.map?.removeLayer(m);
    }
    this.drawVertexMarkers = [];
  }

  // ---------- Draw Segment Route ----------
  startDrawSegment(f: Feeder, segmentType: 'main' | 'branch' = 'main', existingSegment?: FeederSegment) {
    this.cancelEdit();
    this.cancelDraw();
    this.cancelDrawSegment();

    const existing = existingSegment?.routePoints && existingSegment.routePoints.length > 0
      ? [...existingSegment.routePoints] : [];
    this.drawSegmentPoints.set(existing);
    this.drawSegmentMode.set({
      feederId: f.id,
      feederName: f.name,
      segmentId: existingSegment?.id,
      segmentType,
      cableTypeId: this.selectedDrawCableTypeId(),
      parentSegmentId: null,
      label: existingSegment?.label || '',
    });
    this.updateDrawSegmentVisuals();

    if (existing.length > 0) {
      const bounds = L.latLngBounds(existing.map(c => [c[0], c[1]] as L.LatLngTuple));
      this.map?.flyToBounds(bounds, { padding: [80, 80], duration: 1 });
    }

    this.snack.open(
      `وضع رسم المقطع: اضغط على الخريطة لإضافة نقاط`,
      'حسناً',
      { duration: 4000 }
    );
  }

  private addDrawSegmentPoint(lat: number, lng: number) {
    const points = [...this.drawSegmentPoints(), [lat, lng] as [number, number]];
    this.drawSegmentPoints.set(points);
    this.updateDrawSegmentVisuals();
  }

  undoLastSegmentPoint() {
    const points = this.drawSegmentPoints().slice(0, -1);
    this.drawSegmentPoints.set(points);
    this.updateDrawSegmentVisuals();
  }

  clearDrawSegmentPoints() {
    this.drawSegmentPoints.set([]);
    this.updateDrawSegmentVisuals();
  }

  cancelDrawSegment() {
    this.drawSegmentMode.set(null);
    this.drawSegmentPoints.set([]);
    this.clearDrawVisuals();
  }

  async saveSegmentRoute() {
    const mode = this.drawSegmentMode();
    if (!mode) return;
    const points = this.drawSegmentPoints();
    if (points.length < 2) return;

    try {
      if (mode.segmentId) {
        // Update existing segment
        await this.networkService.updateSegment(mode.segmentId, { routePoints: points });
      } else {
        // Create new segment
        await this.networkService.addSegment(mode.feederId, {
          segmentType: mode.segmentType,
          cableTypeId: mode.cableTypeId,
          parentSegmentId: mode.parentSegmentId,
          label: mode.label || null,
          routePoints: points,
        });
      }

      this.snack.open(
        `✓ تم حفظ مسار المقطع (${points.length} نقطة)`,
        'حسناً',
        { duration: 3000 }
      );
      this.drawSegmentMode.set(null);
      this.drawSegmentPoints.set([]);
      this.clearDrawVisuals();

      // Reload segments for this feeder
      const rows = await this.networkService.fetchSegments(mode.feederId);
      this.allSegments.set(mode.feederId, rows);
      setTimeout(() => this.redrawAll(), 400);
    } catch (e) {
      console.error(e);
      this.snack.open('تعذر حفظ المسار', 'حسناً', { duration: 3000 });
    }
  }

  private updateDrawSegmentVisuals() {
    this.clearDrawVisuals();
    if (!this.map) return;

    const points = this.drawSegmentPoints();
    if (points.length === 0) return;

    const mode = this.drawSegmentMode();
    const cableType = mode?.cableTypeId
      ? this.networkService.cableTypes().find(ct => ct.id === mode.cableTypeId)
      : null;
    const color = cableType?.color || '#f59e0b';
    const isBranch = mode?.segmentType === 'branch';

    this.drawPolyline = L.polyline(
      points.map(c => [c[0], c[1]] as L.LatLngTuple),
      {
        color,
        weight: isBranch ? 2.5 : 4,
        opacity: 0.9,
        dashArray: '8,6',
        lineJoin: 'round',
        lineCap: 'round',
      }
    ).addTo(this.map);

    for (const p of points) {
      const icon = L.divIcon({
        html: `<div class="vertex-dot" style="border-color:${color}"></div>`,
        className: 'draw-vertex',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([p[0], p[1]], { icon, interactive: false });
      marker.addTo(this.map);
      this.drawVertexMarkers.push(marker);
    }
  }

  // ---------- Helpers ----------
  private getFeederColor(feederId: string): string {
    const feeder = this.networkService.feeders().find(f => f.id === feederId);
    if (!feeder) return '#10b981';
    return this.getStationColor(feeder.stationId);
  }

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

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
