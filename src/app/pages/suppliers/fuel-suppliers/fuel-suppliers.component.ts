import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { FuelService } from '../../../services/fuel.service';
import { FuelSupplier, SupplierSite } from '../../../models/fuel.model';

interface SupplierForm {
  id?: string;
  name: string;
  phone: string;
  notes: string;
}

interface SiteForm {
  id?: string;
  supplierId: string;
  name: string;
  location: string;
}

@Component({
  selector: 'app-fuel-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './fuel-suppliers.component.html',
  styleUrls: ['./fuel-suppliers.component.scss'],
})
export class FuelSuppliersComponent implements OnInit {
  fuel = inject(FuelService);

  // ---------- state ----------
  search = signal('');

  showSupplierForm = signal(false);
  editingSupplierId = signal<string | null>(null);
  supplierForm: SupplierForm = this.emptySupplierForm();

  activeSiteSupplierId = signal<string | null>(null);
  editingSiteId = signal<string | null>(null);
  siteForm: SiteForm = this.emptySiteForm();

  expanded = signal<Set<string>>(new Set());

  async ngOnInit() {
    await Promise.all([
      this.fuel.loadSuppliers(),
      this.fuel.loadSupplierSites(),
    ]);
  }

  // ---------- computed ----------
  filteredSuppliers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.fuel.suppliers();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q),
    );
  });

  totalSites = computed(() => this.fuel.supplierSites().length);

  avgSitesPerSupplier = computed(() => {
    const suppliers = this.fuel.suppliers().length;
    if (!suppliers) return 0;
    return (this.totalSites() / suppliers).toFixed(1);
  });

  withPhoneCount = computed(() =>
    this.fuel.suppliers().filter((s) => !!s.phone).length,
  );

  allExpanded = computed(() => {
    const list = this.filteredSuppliers();
    if (list.length === 0) return false;
    return list.every((s) => this.expanded().has(s.id));
  });

  // ---------- helpers ----------
  sitesFor(supplierId: string): SupplierSite[] {
    return this.fuel.supplierSites().filter((s) => s.supplierId === supplierId);
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  toggleExpanded(id: string) {
    const s = new Set(this.expanded());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.expanded.set(s);
  }

  toggleAll() {
    if (this.allExpanded()) {
      this.expanded.set(new Set());
    } else {
      this.expanded.set(new Set(this.filteredSuppliers().map((s) => s.id)));
    }
  }

  initial(name: string): string {
    if (!name) return '؟';
    const trimmed = name.trim();
    return trimmed.charAt(0);
  }

  avatarColor(name: string): string {
    const palette = [
      'linear-gradient(135deg, #0f766e, #06b6d4)',
      'linear-gradient(135deg, #0891b2, #0e7490)',
      'linear-gradient(135deg, #059669, #10b981)',
      'linear-gradient(135deg, #7c3aed, #8b5cf6)',
      'linear-gradient(135deg, #db2777, #ec4899)',
      'linear-gradient(135deg, #d97706, #f59e0b)',
      'linear-gradient(135deg, #2563eb, #3b82f6)',
      'linear-gradient(135deg, #dc2626, #ef4444)',
    ];
    let hash = 0;
    for (const ch of name) hash = (hash << 5) - hash + ch.charCodeAt(0);
    return palette[Math.abs(hash) % palette.length];
  }

  async refresh() {
    await Promise.all([
      this.fuel.loadSuppliers(),
      this.fuel.loadSupplierSites(),
    ]);
  }

  // ---------- supplier forms ----------
  emptySupplierForm(): SupplierForm {
    return { name: '', phone: '', notes: '' };
  }

  openNewSupplier() {
    this.supplierForm = this.emptySupplierForm();
    this.editingSupplierId.set(null);
    this.showSupplierForm.set(true);
  }

  editSupplier(s: FuelSupplier) {
    this.supplierForm = {
      id: s.id,
      name: s.name,
      phone: s.phone ?? '',
      notes: s.notes ?? '',
    };
    this.editingSupplierId.set(s.id);
    this.showSupplierForm.set(true);
  }

  cancelSupplier() {
    this.showSupplierForm.set(false);
    this.editingSupplierId.set(null);
  }

  async saveSupplier() {
    if (!this.supplierForm.name.trim()) return;
    const payload: Partial<FuelSupplier> = {
      name: this.supplierForm.name.trim(),
      phone: this.supplierForm.phone.trim() || null,
      notes: this.supplierForm.notes.trim() || null,
    };
    const id = this.editingSupplierId();
    if (id) await this.fuel.updateSupplier(id, payload);
    else await this.fuel.addSupplier(payload);
    this.showSupplierForm.set(false);
    this.editingSupplierId.set(null);
  }

  async deleteSupplier(s: FuelSupplier) {
    const count = this.sitesFor(s.id).length;
    const msg = count
      ? `سيتم حذف المورد "${s.name}" و ${count} موقع مرتبط. هل أنت متأكد؟`
      : `حذف المورد "${s.name}"؟`;
    if (!confirm(msg)) return;
    await this.fuel.deleteSupplier(s.id);
  }

  // ---------- site forms ----------
  emptySiteForm(supplierId = ''): SiteForm {
    return { supplierId, name: '', location: '' };
  }

  openNewSite(supplierId: string) {
    this.siteForm = this.emptySiteForm(supplierId);
    this.editingSiteId.set(null);
    this.activeSiteSupplierId.set(supplierId);
    const s = new Set(this.expanded());
    s.add(supplierId);
    this.expanded.set(s);
  }

  cancelSite() {
    this.activeSiteSupplierId.set(null);
    this.editingSiteId.set(null);
  }

  async saveSite() {
    if (!this.siteForm.supplierId || !this.siteForm.name.trim()) return;
    const payload: Partial<SupplierSite> = {
      supplierId: this.siteForm.supplierId,
      name: this.siteForm.name.trim(),
      location: this.siteForm.location.trim() || null,
    };
    await this.fuel.addSupplierSite(payload);
    this.activeSiteSupplierId.set(null);
    this.editingSiteId.set(null);
  }

  async deleteSite(site: SupplierSite) {
    if (!confirm(`حذف الموقع "${site.name}"؟`)) return;
    await this.fuel.deleteSupplierSite(site.id);
  }
}
