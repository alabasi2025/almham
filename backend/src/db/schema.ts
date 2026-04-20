import { pgTable, uuid, varchar, integer, timestamp, pgEnum, boolean, numeric, jsonb, text } from 'drizzle-orm/pg-core';

export const stationStatusEnum = pgEnum('station_status', ['active', 'inactive', 'maintenance']);
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'inactive']);
export const taskTypeEnum = pgEnum('task_type', ['maintenance', 'inspection', 'repair', 'installation']);
export const taskPriorityEnum = pgEnum('task_priority', ['high', 'medium', 'low']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in-progress', 'completed', 'cancelled']);
export const tankRoleEnum = pgEnum('tank_role', ['receiving', 'main', 'pre_pump', 'generator']);
export const tankMaterialEnum = pgEnum('tank_material', ['plastic', 'steel', 'rocket', 'other']);

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 500 }).notNull(),
  capacity: integer('capacity').notNull().default(0),
  type: varchar('type', { length: 100 }).notNull(),
  status: stationStatusEnum('status').notNull().default('active'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  stationId: uuid('station_id').references(() => stations.id),
  status: employeeStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  description: varchar('description', { length: 2000 }),
  type: taskTypeEnum('type').notNull(),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  status: taskStatusEnum('status').notNull().default('pending'),
  stationId: uuid('station_id').references(() => stations.id),
  employeeId: uuid('employee_id').references(() => employees.id),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ DIESEL / FUEL MANAGEMENT ============

export const fuelSuppliers = pgTable('fuel_suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const supplierSites = pgTable('supplier_sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => fuelSuppliers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 500 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tankers = pgTable('tankers', {
  id: uuid('id').primaryKey().defaultRandom(),
  plate: varchar('plate', { length: 64 }).notNull(),
  driverName: varchar('driver_name', { length: 255 }),
  compartments: jsonb('compartments').notNull().$type<number[]>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tanks = pgTable('tanks', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  role: tankRoleEnum('role').notNull(),
  material: tankMaterialEnum('material').notNull().default('other'),
  capacityL: integer('capacity_l').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pumps = pgTable('pumps', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  inletsCount: integer('inlets_count').notNull().default(1),
  outletsCount: integer('outlets_count').notNull().default(1),
  metersCount: integer('meters_count').notNull().default(1),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pumpChannels = pgTable('pump_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  pumpId: uuid('pump_id').notNull().references(() => pumps.id, { onDelete: 'cascade' }),
  channelIndex: integer('channel_index').notNull(),
  sourceTankId: uuid('source_tank_id').references(() => tanks.id),
  destinationTankId: uuid('destination_tank_id').references(() => tanks.id),
  meterLabel: varchar('meter_label', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const generators = pgTable('generators', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  model: varchar('model', { length: 255 }),
  capacityKw: integer('capacity_kw').notNull().default(0),
  isBackup: boolean('is_backup').notNull().default(false),
  rocketTankId: uuid('rocket_tank_id').references(() => tanks.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fuelReceipts = pgTable('fuel_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  supplierId: uuid('supplier_id').references(() => fuelSuppliers.id),
  supplierSiteId: uuid('supplier_site_id').references(() => supplierSites.id),
  tankerId: uuid('tanker_id').references(() => tankers.id),
  receiverEmployeeId: uuid('receiver_employee_id').references(() => employees.id),
  receivingTankId: uuid('receiving_tank_id').references(() => tanks.id),
  supplierRepName: varchar('supplier_rep_name', { length: 255 }),
  meterBefore: numeric('meter_before', { precision: 14, scale: 2 }),
  meterAfter: numeric('meter_after', { precision: 14, scale: 2 }),
  compartmentsFilled: jsonb('compartments_filled').$type<number[]>(),
  totalLiters: integer('total_liters').notNull(),
  voucherNumber: varchar('voucher_number', { length: 100 }),
  voucherOriginalHolder: varchar('voucher_original_holder', { length: 255 }),
  invoicePhotoUrl: text('invoice_photo_url'),
  meterBeforePhotoUrl: text('meter_before_photo_url'),
  meterAfterPhotoUrl: text('meter_after_photo_url'),
  notes: text('notes'),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fuelTransfers = pgTable('fuel_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  sourceTankId: uuid('source_tank_id').notNull().references(() => tanks.id),
  destinationTankId: uuid('destination_tank_id').notNull().references(() => tanks.id),
  pumpChannelId: uuid('pump_channel_id').references(() => pumpChannels.id),
  meterReadingBefore: numeric('meter_reading_before', { precision: 14, scale: 2 }),
  meterReadingAfter: numeric('meter_reading_after', { precision: 14, scale: 2 }),
  liters: integer('liters').notNull(),
  operatorEmployeeId: uuid('operator_employee_id').references(() => employees.id),
  notes: text('notes'),
  transferredAt: timestamp('transferred_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const generatorConsumption = pgTable('generator_consumption', {
  id: uuid('id').primaryKey().defaultRandom(),
  generatorId: uuid('generator_id').notNull().references(() => generators.id, { onDelete: 'cascade' }),
  liters: integer('liters').notNull(),
  hoursRun: numeric('hours_run', { precision: 10, scale: 2 }),
  operatorEmployeeId: uuid('operator_employee_id').references(() => employees.id),
  readingDate: timestamp('reading_date').defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
