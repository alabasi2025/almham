export type TankRole = 'receiving' | 'main' | 'pre_pump' | 'generator';
export type TankMaterial = 'plastic' | 'steel' | 'rocket' | 'other';

export interface FuelSupplier {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SupplierSite {
  id: string;
  supplierId: string;
  name: string;
  location: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  createdAt: string;
}

export interface Tanker {
  id: string;
  plate: string;
  driverName: string | null;
  compartments: number[];
  notes: string | null;
  createdAt: string;
}

export interface Tank {
  id: string;
  stationId: string;
  name: string;
  role: TankRole;
  material: TankMaterial;
  capacityL: number;
  notes: string | null;
  createdAt: string;
}

export interface Pump {
  id: string;
  stationId: string;
  name: string;
  inletsCount: number;
  outletsCount: number;
  metersCount: number;
  notes: string | null;
  createdAt: string;
}

export interface PumpChannel {
  id: string;
  pumpId: string;
  channelIndex: number;
  sourceTankId: string | null;
  destinationTankId: string | null;
  meterLabel: string | null;
  createdAt: string;
}

export interface Generator {
  id: string;
  stationId: string;
  name: string;
  model: string | null;
  capacityKw: number;
  isBackup: boolean;
  rocketTankId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FuelReceipt {
  id: string;
  stationId: string;
  supplierId: string | null;
  supplierSiteId: string | null;
  tankerId: string | null;
  receiverEmployeeId: string | null;
  receivingTankId: string | null;
  supplierRepName: string | null;
  meterBefore: string | null;
  meterAfter: string | null;
  compartmentsFilled: number[] | null;
  totalLiters: number;
  voucherNumber: string | null;
  voucherOriginalHolder: string | null;
  invoicePhotoUrl: string | null;
  meterBeforePhotoUrl: string | null;
  meterAfterPhotoUrl: string | null;
  notes: string | null;
  receivedAt: string;
  createdAt: string;
}

export interface FuelTransfer {
  id: string;
  stationId: string;
  sourceTankId: string;
  destinationTankId: string;
  pumpChannelId: string | null;
  meterReadingBefore: string | null;
  meterReadingAfter: string | null;
  liters: number;
  operatorEmployeeId: string | null;
  notes: string | null;
  transferredAt: string;
  createdAt: string;
}

export interface GeneratorConsumption {
  id: string;
  generatorId: string;
  liters: number;
  hoursRun: string | null;
  operatorEmployeeId: string | null;
  readingDate: string;
  notes: string | null;
  createdAt: string;
}

export interface TankLevel {
  tankId: string;
  name: string;
  role: TankRole;
  capacityL: number;
  currentLiters: number;
  receiptsIn: number;
  transfersIn: number;
  transfersOut: number;
  consumed: number;
}
