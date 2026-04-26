export type FeederStatus = 'active' | 'off' | 'maintenance' | 'overloaded';
export type PanelType = 'sync' | 'main_distribution' | 'meter_box';

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
  poleNumber: string | null;
  maxSlots: number | null;
  latitude: string | null;
  longitude: string | null;
  status: 'active' | 'inactive' | 'maintenance';
  notes: string | null;
  createdAt: string;
}
