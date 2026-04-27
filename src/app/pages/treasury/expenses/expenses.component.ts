import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { TreasuryService, ExpenseInput } from '../../../services/treasury.service';
import { StationService } from '../../../services/station.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss'],
})
export class ExpensesComponent implements OnInit {
  treasury = inject(TreasuryService);
  stationService = inject(StationService);
  auth = inject(AuthService);

  showForm = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  categoryFilter = signal<string>('all');
  stationFilter = signal<string>('all');
  searchQuery = signal('');

  form: ExpenseInput = this.emptyForm();

  async ngOnInit() {
    await Promise.all([
      this.treasury.loadCashboxes(),
      this.treasury.loadCategories(),
      this.treasury.loadExpenses(),
      this.stationService.stations().length === 0 ? this.stationService.loadAll() : Promise.resolve(),
    ]);
  }

  private emptyForm(): ExpenseInput {
    return {
      stationId: null,
      categoryId: null,
      cashboxId: '',
      amount: 0,
      currency: 'YER',
      description: '',
      receiptPhotoUrl: null,
    };
  }

  filtered = computed(() => {
    const rows = this.treasury.expenses();
    const cat = this.categoryFilter();
    const st = this.stationFilter();
    const q = this.searchQuery().trim().toLowerCase();

    return rows.filter((r) => {
      if (cat !== 'all' && r.categoryId !== cat) return false;
      if (st !== 'all' && r.stationId !== st) return false;
      if (q) {
        return (
          r.description.toLowerCase().includes(q) ||
          (r.cashboxName ?? '').toLowerCase().includes(q) ||
          (r.categoryName ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  });

  totals = computed(() => {
    const rows = this.filtered();
    return {
      count: rows.length,
      total: rows.reduce((s, r) => s + Number(r.amount), 0),
    };
  });

  countByCategory(catId: string): number {
    return this.treasury.expenses().filter((e) => e.categoryId === catId).length;
  }

  openForm() {
    this.form = this.emptyForm();
    this.errorMsg.set(null);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.errorMsg.set(null);
  }

  async save() {
    this.errorMsg.set(null);
    if (!this.form.cashboxId) {
      this.errorMsg.set('اختر الصندوق الذي دُفع منه');
      return;
    }
    const amount = Number(this.form.amount);
    if (!amount || amount <= 0) {
      this.errorMsg.set('أدخل مبلغاً صحيحاً');
      return;
    }
    if (!this.form.description || this.form.description.trim().length < 3) {
      this.errorMsg.set('اكتب وصفاً للمصروف');
      return;
    }

    this.saving.set(true);
    try {
      await this.treasury.addExpense({ ...this.form, amount });
      this.closeForm();
    } catch (err: unknown) {
      this.errorMsg.set(this.extractError(err) || 'تعذّر الحفظ');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: string) {
    if (!confirm('هل تريد حذف هذا المصروف؟ سيُعاد المبلغ للصندوق.')) return;
    try {
      await this.treasury.deleteExpense(id);
    } catch (err: unknown) {
      alert(this.extractError(err) || 'تعذّر الحذف');
    }
  }

  formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('ar-YE', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  private extractError(err: unknown): string | null {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const body = (err as { error?: { error?: string } }).error;
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    }
    return null;
  }
}
