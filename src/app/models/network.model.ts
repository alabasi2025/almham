export type FeederStatus = 'active' | 'off' | 'maintenance' | 'overloaded';
export type PanelType = 'sync' | 'main_distribution' | 'meter_box';
export type SegmentType = 'main' | 'branch';
export type CablePhaseConfig = 'single_phase_earth' | 'two_phase_earth' | 'three_phase_earth' | 'earth_only' | 'other';
export type EarthMode = 'insulated' | 'bare' | 'none';
export type FeederPanelLayout = 'right' | 'left' | 'both';
export type FeederPanelBreakerSide = 'right' | 'left';
export type FeederPanelBreakerStatus = 'active' | 'inactive' | 'maintenance';
export type BusbarPosition = 'right' | 'left' | 'middle';
export type BusbarRole = 'phase_a' | 'phase_b' | 'phase_c' | 'neutral' | 'earth' | 'spare' | 'other';
export type MonitoringTargetType = 'generator' | 'sync_panel' | 'feeder_panel' | 'feeder' | 'main_segment' | 'branch_segment' | 'panel';
export type MonitoringMeterKind = 'production' | 'distribution' | 'consumption' | 'load' | 'voltage' | 'loss_check';
export type MonitoringMeterStatus = 'active' | 'inactive' | 'maintenance' | 'alarm';

export interface Feeder {
  id: string;
  stationId: string;
  stationName: string | null;
  name: string;
  code: string | null;
  responsibleEmployeeId: string | null;
  responsibleEmployeeName: string | null;
  cableType: string | null;
  maxLoadAmps: number | null;
  lengthMeters: number | null;
  status: FeederStatus;
  notes: string | null;
  routeCoordinates: [number, number][] | null;
  createdAt: string;
  panelsCount: number;
}

export interface Panel {
  id: string;
  stationId: string;
  stationName: string | null;
  feederId: string | null;
  feederName: string | null;
  name: string;
  code: string | null;
  type: PanelType;
  controllerType: string | null;
  capacityAmps: number | null;
  busbarLayout: FeederPanelLayout;
  breakerLayout: FeederPanelLayout;
  busbarMaterial: string | null;
  busbarRatingAmps: number | null;
  poleNumber: string | null;
  maxSlots: number | null;
  latitude: string | null;
  longitude: string | null;
  status: 'active' | 'inactive' | 'maintenance';
  notes: string | null;
  createdAt: string;
  breakersCount?: number;
  busbarsCount?: number;
}

export interface CableType {
  id: string;
  name: string;
  sizeMm: number | null;
  material: string | null;
  phaseConfig: CablePhaseConfig;
  earthMode: EarthMode;
  maxAmps: number | null;
  color: string;
  description: string | null;
  isActive: boolean;
}

export interface FeederSegment {
  id: string;
  feederId: string;
  stationId?: string;
  feederName?: string | null;
  parentSegmentId: string | null;
  cableTypeId: string | null;
  cableTypeName: string | null;
  cableTypeColor: string | null;
  cableTypePhaseConfig: CablePhaseConfig | null;
  cableTypeEarthMode: EarthMode | null;
  segmentType: SegmentType;
  phaseConfig: CablePhaseConfig;
  earthMode: EarthMode;
  orderIndex: number;
  label: string | null;
  lengthMeters: number | null;
  routePoints: [number, number][] | null;
  notes: string | null;
  createdAt: string;
}

export interface MonitoringMeter {
  id: string;
  stationId: string;
  stationName: string | null;
  name: string;
  code: string | null;
  targetType: MonitoringTargetType;
  targetId: string | null;
  kind: MonitoringMeterKind;
  lastVoltage: string | null;
  lastCurrent: string | null;
  lastKwh: string | null;
  lastPowerKw: string | null;
  loadPercent: number | null;
  status: MonitoringMeterStatus;
  lastReadAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FeederPanelBreaker {
  id: string;
  panelId: string;
  feederId: string | null;
  feederName: string | null;
  breakerNumber: string;
  side: FeederPanelBreakerSide;
  ratingAmps: number | null;
  breakerType: string | null;
  status: FeederPanelBreakerStatus;
  notes: string | null;
  createdAt: string;
}

export interface BusbarType {
  id: string;
  name: string;
  material: string | null;
  widthMm: string | number | null;
  thicknessMm: string | number | null;
  ratingAmps: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface FeederPanelBusbar {
  id: string;
  panelId: string;
  busbarTypeId: string | null;
  busbarTypeName: string | null;
  busbarMaterial: string | null;
  widthMm: string | number | null;
  thicknessMm: string | number | null;
  ratingAmps: number | null;
  label: string;
  role: BusbarRole;
  position: BusbarPosition;
  orderIndex: number;
  notes: string | null;
  createdAt: string;
}
