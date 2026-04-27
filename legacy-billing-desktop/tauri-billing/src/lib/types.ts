export type ConnectionProfile = {
  server: string;
  userName: string;
  password: string;
  trustServerCertificate: boolean;
  encrypt: boolean;
};

export type LegacyDatabaseInfo = {
  name: string;
};

export type DashboardSummary = {
  customerCount: number;
  activeCustomerCount: number;
  billCount: number;
  paymentCount: number;
  userCount: number;
  totalCurrentBalance: number;
  lastBillingDate: string | null;
  lastPaymentDate: string | null;
};

export type LegacyMenuEntry = {
  formId: number;
  formName: string;
  menuKey: string;
  rankId: number;
};

export type LegacyUser = {
  userId: number;
  userName: string;
  roleId: number;
  roleName: string;
  workKindId: number;
};

export type LegacyLoginResult = {
  userId: number;
  userName: string;
  roleId: number;
  roleName: string;
  workKindId: number;
  databaseName: string;
};

export type LegacyScreenEvent = {
  eventId: number;
  eventName: string;
  isAllowed: boolean;
};

export type LegacyScreenDefinition = {
  formId: number;
  formName: string;
  menuKey: string;
  rankId: number;
  menuIndex: number;
  hasAnyAccess: boolean;
  events: LegacyScreenEvent[];
};

export type LegacyPasswordHintResponse = {
  hint: string;
};

export type CustomerRecord = {
  customerId: number;
  customerName: string;
  neighborhood: string;
  address: string;
  meterNumber: string;
  meterSerial: string;
  lastRead: number;
  lastBalance: number;
  recordState: number;
};

export type BillRecord = {
  billId: number;
  periodId: number;
  customerId: number;
  operationDate: string | null;
  lastRead: number;
  currentRead: number;
  monthConsume: number;
  consumeValue: number;
  currentBalance: number;
  userName: string;
};

export type PaymentRecord = {
  paymentGroupId: number;
  periodId: number;
  customerId: number;
  customerName: string;
  amount: number;
  paymentDate: string | null;
  userName: string;
  paymentType: number;
  referenceId: string;
};

export type LegacyWorkspace = {
  summary: DashboardSummary;
  menuEntries: LegacyMenuEntry[];
  users: LegacyUser[];
  customers: CustomerRecord[];
  bills: BillRecord[];
  payments: PaymentRecord[];
};
