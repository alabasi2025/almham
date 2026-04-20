export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'maintenance' | 'inspection' | 'repair' | 'installation';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  stationId: string;
  employeeId: string;
  dueDate: string;
  createdAt: string;
}
