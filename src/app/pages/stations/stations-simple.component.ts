import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-stations-simple',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="page-container">
      <h1>⚡ محطات توليد وتوزيع الكهرباء</h1>
      
      <div class="header-actions">
        <p class="station-count">عدد المحطات: <strong>{{ stations.length }}</strong></p>
        <button mat-raised-button color="primary" (click)="loadStations()">
          <mat-icon>refresh</mat-icon>
          تحديث البيانات
        </button>
      </div>

      <div *ngIf="loading" class="loading">
        <mat-icon>hourglass_empty</mat-icon>
        <p>جاري تحميل المحطات...</p>
      </div>

      <div *ngIf="!loading && stations.length === 0" class="empty-state">
        <mat-icon>electrical_services</mat-icon>
        <h2>لا توجد محطات</h2>
        <p>لم يتم العثور على بيانات المحطات</p>
        <button mat-raised-button color="primary" (click)="loadStations()">
          <mat-icon>refresh</mat-icon>
          إعادة المحاولة
        </button>
      </div>

      <div class="stations-grid">
        <div *ngFor="let station of stations" class="station-card">
          <div class="card-header">
            <mat-icon>electric_bolt</mat-icon>
            <h2>{{ station.name }}</h2>
          </div>
          <div class="card-body">
            <div class="info-row">
              <mat-icon>location_on</mat-icon>
              <span>{{ station.location }}</span>
            </div>
            <div class="info-row">
              <mat-icon>category</mat-icon>
              <span>{{ station.type }}</span>
            </div>
            <div class="info-row">
              <mat-icon>power</mat-icon>
              <span>{{ station.capacity }} ميجاواط</span>
            </div>
            <div class="info-row">
              <mat-icon>info</mat-icon>
              <span class="status" [class.active]="station.status === 'active'">
                {{ getStatusLabel(station.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 24px;
      color: #1a1a2e;
      font-weight: 800;
    }

    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .station-count {
      font-size: 1.2rem;
      color: #555;
      
      strong {
        color: #667eea;
        font-size: 1.5rem;
      }
    }

    .loading, .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      
      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #667eea;
        margin-bottom: 16px;
      }

      h2 {
        color: #333;
        margin: 16px 0;
      }

      p {
        color: #666;
        font-size: 1.1rem;
      }
    }

    .stations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }

    .station-card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e8ecf4;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
      }
    }

    .card-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;

      mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      h2 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
        line-height: 1.3;
      }
    }

    .card-body {
      padding: 24px;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 1rem;

      &:last-child {
        border-bottom: none;
      }

      mat-icon {
        color: #667eea;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      span {
        color: #333;
        font-weight: 500;
      }

      .status {
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.9rem;
        background: #ff6b6b;
        color: white;

        &.active {
          background: #10b981;
        }
      }
    }

    @media (max-width: 768px) {
      .stations-grid {
        grid-template-columns: 1fr;
      }

      .header-actions {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
    }
  `]
})
export class StationsSimpleComponent implements OnInit {
  stations: any[] = [];
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadStations();
  }

  loadStations() {
    this.loading = true;
    console.log('🔄 جاري تحميل المحطات من API...');
    
    this.http.get<any[]>('/api/stations').subscribe({
      next: (data) => {
        console.log('✅ تم استلام المحطات:', data);
        this.stations = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ خطأ في تحميل المحطات:', err);
        this.loading = false;
      }
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'نشطة',
      maintenance: 'صيانة',
      inactive: 'متوقفة'
    };
    return labels[status] || status;
  }
}
