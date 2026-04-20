export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  stationId: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}
