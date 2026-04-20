export interface Station {
  id: string;
  name: string;
  location: string;
  capacity: number;
  status: 'active' | 'inactive' | 'maintenance';
  type: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  createdAt: string;
}
