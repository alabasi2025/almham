import { pgTable, uuid, varchar, integer, timestamp, pgEnum, boolean, numeric, jsonb, text, index } from 'drizzle-orm/pg-core';

export const stationStatusEnum = pgEnum('station_status', ['active', 'inactive', 'maintenance']);
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'inactive']);
export const taskTypeEnum = pgEnum('task_type', ['maintenance', 'inspection', 'repair', 'installation']);
export const taskPriorityEnum = pgEnum('task_priority', ['high', 'medium', 'low']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in-progress', 'completed', 'cancelled']);
export const tankRoleEnum = pgEnum('tank_role', ['receiving', 'main', 'pre_pump', 'generator']);
export const tankMaterialEnum = pgEnum('tank_material', ['plastic', 'steel', 'rocket', 'other']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'accountant', 'station_manager', 'technician', 'cashier']);
export const cashboxTypeEnum = pgEnum('cashbox_type', ['station', 'exchange', 'wallet', 'bank']);
export const walletProviderEnum = pgEnum('wallet_provider', ['jawali', 'kuraimi', 'mfloos', 'jeeb', 'other']);
export const currencyEnum = pgEnum('currency', ['YER', 'SAR', 'USD']);
export const movementDirectionEnum = pgEnum('movement_direction', ['in', 'out']);
export const movementRefTypeEnum = pgEnum('movement_ref_type', [
  'opening', 'collection', 'transfer_in', 'transfer_out', 'expense', 'adjustment',
]);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'wallet', 'hexcell', 'other']);
export const closureStatusEnum = pgEnum('closure_status', ['draft', 'closed', 'approved']);
export const billingSystemTypeEnum = pgEnum('billing_system_type', ['ecas', 'hexcell', 'manual', 'other']);
export const billingAccountTypeEnum = pgEnum('billing_account_type', ['collection', 'sales', 'settlement']);
export const workSessionStatusEnum = pgEnum('work_session_status', ['open', 'closed', 'abandoned']);
export const attendanceEventTypeEnum = pgEnum('attendance_event_type', ['check_in', 'check_out']);
export const attendanceSourceEnum = pgEnum('attendance_source', ['mobile', 'zkteco', 'manager']);
export const attendanceEventStatusEnum = pgEnum('attendance_event_status', ['accepted', 'rejected']);
export const feederStatusEnum = pgEnum('feeder_status', ['active', 'off', 'maintenance', 'overloaded']);
export const panelTypeEnum = pgEnum('panel_type', ['sync', 'main_distribution', 'meter_box']);

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

// ============ AUTHENTICATION & AUDIT ============

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  usernameIdx: index('users_username_idx').on(t.username),
  employeeIdx: index('users_employee_idx').on(t.employeeId),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenId: varchar('token_id', { length: 64 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 64 }),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  tokenIdIdx: index('sessions_token_id_idx').on(t.tokenId),
  userIdx: index('sessions_user_idx').on(t.userId),
}));

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 128 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  actionIdx: index('audit_action_idx').on(t.action),
  userIdx: index('audit_user_idx').on(t.userId),
  createdAtIdx: index('audit_created_at_idx').on(t.createdAt),
}));

// ============ EMPLOYEE ATTENDANCE & MOBILE TRACKING ============

export const stationAttendanceSettings = pgTable('station_attendance_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().unique().references(() => stations.id, { onDelete: 'cascade' }),
  radiusMeters: integer('radius_meters').notNull().default(100),
  trackingIntervalSeconds: integer('tracking_interval_seconds').notNull().default(300),
  requireGps: boolean('require_gps').notNull().default(true),
  requireBiometric: boolean('require_biometric').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  stationIdx: index('attendance_settings_station_idx').on(t.stationId),
}));

export const workSessions = pgTable('work_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientSessionId: varchar('client_session_id', { length: 128 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  status: workSessionStatusEnum('status').notNull().default('open'),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at'),
  checkInLatitude: numeric('check_in_latitude', { precision: 10, scale: 7 }),
  checkInLongitude: numeric('check_in_longitude', { precision: 10, scale: 7 }),
  checkInAccuracyMeters: integer('check_in_accuracy_meters'),
  checkInDistanceMeters: integer('check_in_distance_meters'),
  checkOutLatitude: numeric('check_out_latitude', { precision: 10, scale: 7 }),
  checkOutLongitude: numeric('check_out_longitude', { precision: 10, scale: 7 }),
  checkOutAccuracyMeters: integer('check_out_accuracy_meters'),
  checkOutDistanceMeters: integer('check_out_distance_meters'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  clientSessionIdx: index('work_sessions_client_session_idx').on(t.clientSessionId),
  employeeStatusIdx: index('work_sessions_employee_status_idx').on(t.employeeId, t.status),
  stationStatusIdx: index('work_sessions_station_status_idx').on(t.stationId, t.status),
  startedAtIdx: index('work_sessions_started_at_idx').on(t.startedAt),
}));

export const attendanceEvents = pgTable('attendance_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientEventId: varchar('client_event_id', { length: 128 }).notNull().unique(),
  sessionId: uuid('session_id').references(() => workSessions.id, { onDelete: 'set null' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  type: attendanceEventTypeEnum('type').notNull(),
  source: attendanceSourceEnum('source').notNull().default('mobile'),
  status: attendanceEventStatusEnum('status').notNull().default('accepted'),
  recordedAt: timestamp('recorded_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  accuracyMeters: integer('accuracy_meters'),
  distanceMeters: integer('distance_meters'),
  rejectionReason: text('rejection_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  clientEventIdx: index('attendance_events_client_event_idx').on(t.clientEventId),
  employeeRecordedIdx: index('attendance_events_employee_recorded_idx').on(t.employeeId, t.recordedAt),
  stationRecordedIdx: index('attendance_events_station_recorded_idx').on(t.stationId, t.recordedAt),
}));

export const locationPoints = pgTable('location_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientPointId: varchar('client_point_id', { length: 128 }).notNull().unique(),
  sessionId: uuid('session_id').references(() => workSessions.id, { onDelete: 'cascade' }),
  clientSessionId: varchar('client_session_id', { length: 128 }).notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  recordedAt: timestamp('recorded_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  accuracyMeters: integer('accuracy_meters'),
  speedMetersPerSecond: numeric('speed_meters_per_second', { precision: 10, scale: 3 }),
  headingDegrees: numeric('heading_degrees', { precision: 10, scale: 3 }),
  batteryLevel: numeric('battery_level', { precision: 5, scale: 4 }),
  isOffline: boolean('is_offline').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  clientPointIdx: index('location_points_client_point_idx').on(t.clientPointId),
  sessionRecordedIdx: index('location_points_session_recorded_idx').on(t.sessionId, t.recordedAt),
  employeeRecordedIdx: index('location_points_employee_recorded_idx').on(t.employeeId, t.recordedAt),
}));

// ============ TREASURY & COLLECTIONS ============

export const cashboxes = pgTable('cashboxes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: cashboxTypeEnum('type').notNull(),
  stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
  walletProvider: walletProviderEnum('wallet_provider'),
  accountNumber: varchar('account_number', { length: 64 }),
  accountHolder: varchar('account_holder', { length: 255 }),
  currency: currencyEnum('currency').notNull().default('YER'),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  typeIdx: index('cashboxes_type_idx').on(t.type),
  stationIdx: index('cashboxes_station_idx').on(t.stationId),
}));

export const cashMovements = pgTable('cash_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  cashboxId: uuid('cashbox_id').notNull().references(() => cashboxes.id, { onDelete: 'cascade' }),
  direction: movementDirectionEnum('direction').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull().default('YER'),
  refType: movementRefTypeEnum('ref_type').notNull(),
  refId: uuid('ref_id'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  cashboxIdx: index('movements_cashbox_idx').on(t.cashboxId),
  refIdx: index('movements_ref_idx').on(t.refType, t.refId),
  occurredAtIdx: index('movements_occurred_at_idx').on(t.occurredAt),
}));

export const billingSystems = pgTable('billing_systems', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  code: varchar('code', { length: 64 }),
  type: billingSystemTypeEnum('type').notNull().default('other'),
  stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
  icon: varchar('icon', { length: 64 }),
  color: varchar('color', { length: 16 }),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  stationIdx: index('billing_systems_station_idx').on(t.stationId),
}));

export const billingSystemAccounts = pgTable('billing_system_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  billingSystemId: uuid('billing_system_id').notNull().references(() => billingSystems.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  code: varchar('code', { length: 64 }),
  type: billingAccountTypeEnum('type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  systemIdx: index('billing_accounts_system_idx').on(t.billingSystemId),
  typeIdx: index('billing_accounts_type_idx').on(t.type),
}));

export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  cashboxId: uuid('cashbox_id').notNull().references(() => cashboxes.id),
  billingSystemId: uuid('billing_system_id').references(() => billingSystems.id, { onDelete: 'set null' }),
  billingAccountId: uuid('billing_account_id').references(() => billingSystemAccounts.id, { onDelete: 'set null' }),
  collectorUserId: uuid('collector_user_id').references(() => users.id, { onDelete: 'set null' }),
  collectorEmployeeId: uuid('collector_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  subscriberName: varchar('subscriber_name', { length: 255 }),
  meterNumber: varchar('meter_number', { length: 64 }),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull().default('YER'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  walletRef: varchar('wallet_ref', { length: 128 }),
  receiptCode: varchar('receipt_code', { length: 128 }),
  notes: text('notes'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  stationIdx: index('collections_station_idx').on(t.stationId),
  collectorIdx: index('collections_collector_idx').on(t.collectorUserId),
  collectorEmployeeIdx: index('collections_collector_employee_idx').on(t.collectorEmployeeId),
  billingSystemIdx: index('collections_billing_system_idx').on(t.billingSystemId),
  billingAccountIdx: index('collections_billing_account_idx').on(t.billingAccountId),
  occurredAtIdx: index('collections_occurred_at_idx').on(t.occurredAt),
}));

export const billingCollectionBatches = pgTable('billing_collection_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  billingSystemId: uuid('billing_system_id').notNull().references(() => billingSystems.id),
  billingAccountId: uuid('billing_account_id').notNull().references(() => billingSystemAccounts.id),
  cashboxId: uuid('cashbox_id').notNull().references(() => cashboxes.id),
  enteredByUserId: uuid('entered_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  collectionDate: timestamp('collection_date').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  stationDateIdx: index('billing_batches_station_date_idx').on(t.stationId, t.collectionDate),
  billingSystemIdx: index('billing_batches_system_idx').on(t.billingSystemId),
  billingAccountIdx: index('billing_batches_account_idx').on(t.billingAccountId),
  enteredByIdx: index('billing_batches_entered_by_idx').on(t.enteredByUserId),
}));

export const billingCollectionEntries = pgTable('billing_collection_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => billingCollectionBatches.id, { onDelete: 'cascade' }),
  collectorEmployeeId: uuid('collector_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  batchIdx: index('billing_entries_batch_idx').on(t.batchId),
  collectorIdx: index('billing_entries_collector_idx').on(t.collectorEmployeeId),
  collectionIdx: index('billing_entries_collection_idx').on(t.collectionId),
}));

export const cashTransfers = pgTable('cash_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromCashboxId: uuid('from_cashbox_id').notNull().references(() => cashboxes.id),
  toCashboxId: uuid('to_cashbox_id').notNull().references(() => cashboxes.id),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull().default('YER'),
  transferredByUserId: uuid('transferred_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  receiptPhotoUrl: text('receipt_photo_url'),
  notes: text('notes'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  fromIdx: index('transfers_from_idx').on(t.fromCashboxId),
  toIdx: index('transfers_to_idx').on(t.toCashboxId),
  occurredAtIdx: index('transfers_occurred_at_idx').on(t.occurredAt),
}));

export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  icon: varchar('icon', { length: 64 }),
  color: varchar('color', { length: 16 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => expenseCategories.id, { onDelete: 'set null' }),
  cashboxId: uuid('cashbox_id').notNull().references(() => cashboxes.id),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull().default('YER'),
  description: text('description').notNull(),
  receiptPhotoUrl: text('receipt_photo_url'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  stationIdx: index('expenses_station_idx').on(t.stationId),
  categoryIdx: index('expenses_category_idx').on(t.categoryId),
  cashboxIdx: index('expenses_cashbox_idx').on(t.cashboxId),
  occurredAtIdx: index('expenses_occurred_at_idx').on(t.occurredAt),
}));

export const dailyClosures = pgTable('daily_closures', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  managerUserId: uuid('manager_user_id').references(() => users.id, { onDelete: 'set null' }),
  closureDate: timestamp('closure_date').notNull(),
  totalCash: numeric('total_cash', { precision: 18, scale: 2 }).notNull().default('0'),
  totalWallet: numeric('total_wallet', { precision: 18, scale: 2 }).notNull().default('0'),
  totalHexcell: numeric('total_hexcell', { precision: 18, scale: 2 }).notNull().default('0'),
  expectedTotal: numeric('expected_total', { precision: 18, scale: 2 }).notNull().default('0'),
  actualTotal: numeric('actual_total', { precision: 18, scale: 2 }).notNull().default('0'),
  variance: numeric('variance', { precision: 18, scale: 2 }).notNull().default('0'),
  status: closureStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  stationDateIdx: index('closures_station_date_idx').on(t.stationId, t.closureDate),
}));

// ============ ELECTRICAL NETWORK ============

export const feeders = pgTable('feeders', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 64 }),
  responsibleEmployeeId: uuid('responsible_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  cableType: varchar('cable_type', { length: 128 }),
  maxLoadAmps: integer('max_load_amps'),
  lengthMeters: integer('length_meters'),
  status: feederStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  stationIdx: index('feeders_station_idx').on(t.stationId),
}));

export const panels = pgTable('panels', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  feederId: uuid('feeder_id').references(() => feeders.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 64 }),
  type: panelTypeEnum('type').notNull().default('meter_box'),
  controllerType: varchar('controller_type', { length: 128 }),
  capacityAmps: integer('capacity_amps'),
  poleNumber: varchar('pole_number', { length: 64 }),
  maxSlots: integer('max_slots'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  status: stationStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  stationIdx: index('panels_station_idx').on(t.stationId),
  feederIdx: index('panels_feeder_idx').on(t.feederId),
  typeIdx: index('panels_type_idx').on(t.type),
}));
