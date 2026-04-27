import { useMemo, useState, type ReactNode } from 'react';
import { loadDatabases, loadLegacyScreens, loadPasswordHint, loadWorkspace, loginToLegacyEcas } from './lib/ecasApi';
import type {
  BillRecord,
  ConnectionProfile,
  CustomerRecord,
  LegacyDatabaseInfo,
  LegacyLoginResult,
  LegacyScreenDefinition,
  LegacyScreenEvent,
  LegacyUser,
  LegacyWorkspace,
  PaymentRecord,
} from './lib/types';

type LegacyDataPanel = 'customers' | 'bills' | 'payments' | 'users' | 'screen';

type MenuGroup = {
  key: string;
  label: string;
  screens: LegacyScreenDefinition[];
};

type Column<T> = {
  title: string;
  value: (row: T) => ReactNode;
  align?: 'start' | 'end' | 'center';
};

const initialConnection: ConnectionProfile = {
  server: '.\\ECASDEV',
  userName: 'sa',
  password: '',
  trustServerCertificate: true,
  encrypt: true,
};

const LEGACY_MENU_TITLES: Record<string, string> = {
  '#': 'عمليات مباشرة',
  AccOpeningBalMenu: 'الأرصدة الافتتاحية',
  AccountMenu: 'الدليل المحاسبي',
  AddBillAndReadMenu: 'القراءات والتسديد',
  AddCstMonthProblemsMenu: 'حالات المشتركين',
  AddTaswiatMenu: 'إضافة التسويات',
  ArBrnSglMenu: 'المشروع والفروع',
  BillReadAndCunsumeReportMenu: 'تقارير الفوترة',
  CashierAndManualDbnsMenu: 'التحصيل اليدوي',
  CheckListAndTrialBalanceReport: 'الموازين المالية',
  CompactDBMenu: 'تنظيم القاعدة',
  CstMonthProblemsReportMenu: 'تقارير المشتركين',
  CurrencyDataMenu: 'العملة',
  CustomerMenu: 'بيانات المشتركين',
  DateMenu: 'الفترات الزمنية',
  ExtIntBackUpMenu: 'نسخ احتياطي خارجي',
  FnclAnalysisReport: 'تحليل مالي',
  FnclBallancesReport: 'الأرصدة المالية',
  FnclBasicDataReport: 'تقارير مالية أساسية',
  FnclClosingYearMenu: 'الإقفال السنوي',
  FnclCommitMenu: 'ترحيل القيود',
  FnclConstMenu: 'القيود اليومية',
  FnclDbnDataReport: 'تقارير السندات',
  FnclSumReport: 'تقارير إجمالية',
  FnclTswConstMenu: 'تسويات مالية',
  IntBackUpMenu: 'نسخ احتياطي داخلي',
  InvReportMenu: 'تقارير المخزن',
  InvStrgBasicDataMenu: 'تهيئة المخزن',
  InvStrgDbnMenu: 'سندات المخزن',
  InvStrgOpeningBalMenu: 'افتتاحي المخزن',
  MonthBillProcesses: 'عمليات الإقفال',
  NumbersAndSymbolsMenu: 'الرموز والترميزات',
  OtherSystemReprt: 'تقارير أخرى',
  PrivilegMenu: 'الصلاحيات',
  ReceiptDbnMenu: 'سندات القبض',
  SliceAndRsomMenu: 'التعرفة والرسوم',
  SmryReportMenu: 'الخلاصات',
  SpendingDbnMenu: 'سندات الصرف',
  StateMenu: 'حالات البلاغات',
  StationsFeedersMenue: 'المحطات والفيادر',
  SyncMenu: 'المزامنة',
  SystemInitial: 'خيارات النظام',
  TswReportMenu: 'تقارير التسويات',
  UpdateTaswiatMenu: 'تعديل التسويات',
  UserEventReportMenu: 'أحداث المستخدمين',
  UserMenu: 'المستخدمون',
};

export default function App() {
  const [connection, setConnection] = useState(initialConnection);
  const [databases, setDatabases] = useState<LegacyDatabaseInfo[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState('Ecas2673');
  const [loginName, setLoginName] = useState('Administrator');
  const [loginPassword, setLoginPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [session, setSession] = useState<LegacyLoginResult | null>(null);
  const [workspace, setWorkspace] = useState<LegacyWorkspace | null>(null);
  const [screens, setScreens] = useState<LegacyScreenDefinition[]>([]);
  const [selectedMenuKey, setSelectedMenuKey] = useState('#');
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [screenSearch, setScreenSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('أدخل بيانات SQL ثم بيانات مستخدم ECAS القديم.');

  const menuGroups = useMemo(() => buildMenuGroups(screens), [screens]);

  const selectedMenuGroup = useMemo(() => {
    return menuGroups.find((group) => group.key === selectedMenuKey) ?? menuGroups[0] ?? null;
  }, [menuGroups, selectedMenuKey]);

  const selectedScreen = useMemo(() => {
    return screens.find((screen) => screen.formId === selectedScreenId) ?? null;
  }, [screens, selectedScreenId]);

  const filteredScreens = useMemo(() => {
    if (!selectedMenuGroup) {
      return [];
    }

    const search = screenSearch.trim();
    if (!search) {
      return selectedMenuGroup.screens;
    }

    return selectedMenuGroup.screens.filter((screen) => {
      return screen.formName.includes(search) || screen.formId.toString().includes(search);
    });
  }, [selectedMenuGroup, screenSearch]);

  const activePanel = selectedScreen ? resolvePanelByScreen(selectedScreen) : 'screen';

  async function handleLoadDatabases() {
    await runBusy('جارٍ جلب قواعد ECAS من SQL Server...', async () => {
      const result = await loadDatabases(connection);
      setDatabases(result);

      const current = selectedDatabase.trim();
      const hasCurrent = current.length > 0 && result.some((item) => item.name === current);
      const preferred = result.find((item) => item.name.toLowerCase() === 'ecas2673') ?? result.at(-1);

      if (!hasCurrent && preferred) {
        setSelectedDatabase(preferred.name);
      }

      if (result.length === 0) {
        setStatus('لم تظهر قواعد ECAS تلقائياً. أدخل اسم القاعدة يدوياً مثل Ecas2673 ثم سجل الدخول.');
        return;
      }

      setStatus(`تم العثور على ${result.length.toLocaleString('ar-YE')} قاعدة ECAS.`);
    });
  }

  async function handleLogin() {
    const databaseName = selectedDatabase.trim() || 'Ecas2673';
    setSelectedDatabase(databaseName);

    await runBusy('جارٍ تسجيل الدخول وتحميل القوائم القديمة...', async () => {
      const login = await loginToLegacyEcas(connection, databaseName, loginName, loginPassword);

      const [workspaceResult, screensResult] = await Promise.all([
        loadWorkspace(connection, databaseName, 300),
        loadLegacyScreens(connection, databaseName, login.userId, login.roleId),
      ]);

      setSession(login);
      setWorkspace(workspaceResult);
      setScreens(screensResult);
      setLoginPassword('');
      setPasswordHint('');

      const firstScreen = screensResult.find((item) => item.hasAnyAccess) ?? screensResult[0] ?? null;
      if (firstScreen) {
        const menuKey = normalizeMenuKey(firstScreen.menuKey);
        setSelectedMenuKey(menuKey);
        setSelectedScreenId(firstScreen.formId);
      }

      setStatus(`تم الدخول: ${login.userName} على ${login.databaseName} (${screensResult.length.toLocaleString('ar-YE')} شاشة).`);
    });
  }

  async function handleLoadPasswordHint() {
    const databaseName = selectedDatabase.trim() || 'Ecas2673';
    const userName = loginName.trim();
    setSelectedDatabase(databaseName);

    if (!userName) {
      setPasswordHint('');
      setStatus('أدخل اسم المستخدم أولاً لعرض التلميح.');
      return;
    }

    await runBusy('جارٍ جلب تلميح كلمة المرور...', async () => {
      const result = await loadPasswordHint(connection, databaseName, userName);
      const hint = result.hint.trim();

      if (!hint) {
        setPasswordHint('لا يوجد تلميح كلمة مرور محفوظ لهذا المستخدم.');
        setStatus('لا يوجد تلميح كلمة مرور مسجل لهذا المستخدم.');
        return;
      }

      setPasswordHint(hint);
      setStatus('تم جلب تلميح كلمة المرور.');
    });
  }

  async function handleRefresh() {
    if (!session || !selectedDatabase) {
      return;
    }

    await runBusy('جارٍ تحديث بيانات الشاشة...', async () => {
      const [workspaceResult, screensResult] = await Promise.all([
        loadWorkspace(connection, selectedDatabase, 300),
        loadLegacyScreens(connection, selectedDatabase, session.userId, session.roleId),
      ]);

      setWorkspace(workspaceResult);
      setScreens(screensResult);

      const stillExists = screensResult.some((item) => item.formId === selectedScreenId);
      if (!stillExists) {
        const firstScreen = screensResult.find((item) => item.hasAnyAccess) ?? screensResult[0] ?? null;
        setSelectedScreenId(firstScreen?.formId ?? null);
        setSelectedMenuKey(firstScreen ? normalizeMenuKey(firstScreen.menuKey) : '#');
      }

      setStatus(`تم تحديث البيانات من ${selectedDatabase}.`);
    });
  }

  function handleSelectMenu(group: MenuGroup) {
    setSelectedMenuKey(group.key);
    setScreenSearch('');

    const preferred = group.screens.find((item) => item.hasAnyAccess) ?? group.screens[0] ?? null;
    if (preferred) {
      setSelectedScreenId(preferred.formId);
    }
  }

  function handleSelectScreen(screen: LegacyScreenDefinition) {
    setSelectedMenuKey(normalizeMenuKey(screen.menuKey));
    setSelectedScreenId(screen.formId);
  }

  function handleLogout() {
    setSession(null);
    setWorkspace(null);
    setScreens([]);
    setPasswordHint('');
    setSelectedMenuKey('#');
    setSelectedScreenId(null);
    setScreenSearch('');
    setStatus('تم الخروج. أدخل بيانات مستخدم ECAS للدخول مرة أخرى.');
  }

  async function runBusy(message: string, action: () => Promise<void>) {
    setBusy(true);
    setStatus(message);
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <LoginScreen
        connection={connection}
        selectedDatabase={selectedDatabase}
        loginName={loginName}
        loginPassword={loginPassword}
        passwordHint={passwordHint}
        busy={busy}
        status={status}
        onConnectionChange={(next) => {
          setConnection(next);
          setPasswordHint('');
        }}
        onLoginNameChange={(userName) => {
          setLoginName(userName);
          setPasswordHint('');
        }}
        onLoginPasswordChange={setLoginPassword}
        onLoadDatabases={handleLoadDatabases}
        onLoadPasswordHint={handleLoadPasswordHint}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main className="shell">
      <section className="hero compactHero">
        <div>
          <p className="eyebrow">ECAS Legacy Billing</p>
          <h1>واجهة القوائم القديمة</h1>
          <p className="heroText">القوائم والصلاحيات هنا من `FormData` و`FormEvent` و`UserPrivileg` مباشرة من قاعدة ECAS.</p>
        </div>
        <div className="sessionCard">
          <span>المستخدم الحالي</span>
          <strong>{session.userName}</strong>
          <small>{session.roleName || `دور رقم ${session.roleId}`}</small>
          <button type="button" onClick={handleLogout}>خروج</button>
        </div>
      </section>

      <section className="databaseBar signedBar">
        <p className="statusLine">{status}</p>
        <button className="secondaryButton" type="button" onClick={() => void handleRefresh()} disabled={busy}>
          تحديث من القاعدة
        </button>
      </section>

      <Summary workspace={workspace} />

      <section className="legacyMenuBar" aria-label="قوائم النظام القديمة">
        {menuGroups.map((group) => (
          <button
            key={group.key}
            type="button"
            className={group.key === selectedMenuKey ? 'legacyMenuButton active' : 'legacyMenuButton'}
            onClick={() => handleSelectMenu(group)}
          >
            <span>{group.label}</span>
            <small>{group.screens.length.toLocaleString('ar-YE')}</small>
          </button>
        ))}
      </section>

      <section className="workspaceGrid legacyWorkspaceGrid">
        <aside className="menuPanel screenPanel">
          <div className="panelTitle">
            <span>{selectedMenuGroup?.label ?? 'قائمة'}</span>
            <strong>{selectedMenuGroup?.screens.length ?? 0}</strong>
          </div>

          <label className="field screenSearchField">
            <span>بحث عن شاشة</span>
            <input
              value={screenSearch}
              onChange={(event) => setScreenSearch(event.target.value)}
              placeholder="اسم الشاشة أو رقمها"
            />
          </label>

          <div className="screenList">
            {filteredScreens.length === 0 ? (
              <p className="emptyState">لا توجد نتائج مطابقة.</p>
            ) : (
              filteredScreens.map((screen) => (
                <button
                  key={screen.formId}
                  type="button"
                  className={screen.formId === selectedScreenId ? 'screenItem active' : 'screenItem'}
                  onClick={() => handleSelectScreen(screen)}
                >
                  <div className="screenItemHead">
                    <strong>{screen.formName}</strong>
                    <span>{screen.formId}</span>
                  </div>
                  <div className="screenItemBadges">
                    <span className={screen.hasAnyAccess ? 'okBadge' : 'blockedBadge'}>
                      {screen.hasAnyAccess ? 'مسموح' : 'محجوب'}
                    </span>
                    <span className="metaBadge">{panelLabel(resolvePanelByScreen(screen))}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="dataPanel legacyPanel">
          {selectedScreen ? (
            <>
              <header className="legacyScreenHeader">
                <div>
                  <p className="eyebrow">الشاشة المحددة</p>
                  <h3>{selectedScreen.formName}</h3>
                  <p className="screenMeta">
                    رقم الشاشة: {selectedScreen.formId} | القائمة: {menuLabel(selectedScreen.menuKey)}
                  </p>
                </div>
                <div className="screenStatusBox">
                  <span className={selectedScreen.hasAnyAccess ? 'okBadge' : 'blockedBadge'}>
                    {selectedScreen.hasAnyAccess ? 'لديك صلاحية' : 'بدون صلاحية كافية'}
                  </span>
                  <small>{panelLabel(activePanel)}</small>
                </div>
              </header>

              <section className="eventsStrip">
                {selectedScreen.events.length === 0 ? (
                  <span className="metaBadge">لا توجد أحداث مخصصة</span>
                ) : (
                  selectedScreen.events.map((eventItem) => (
                    <span key={eventItem.eventId} className={eventItem.isAllowed ? 'okBadge' : 'blockedBadge'}>
                      {eventItem.eventName}
                    </span>
                  ))
                )}
              </section>

              {activePanel === 'customers' && <CustomersTable rows={workspace?.customers ?? []} />}
              {activePanel === 'bills' && <BillsTable rows={workspace?.bills ?? []} />}
              {activePanel === 'payments' && <PaymentsTable rows={workspace?.payments ?? []} />}
              {activePanel === 'users' && <UsersTable rows={workspace?.users ?? []} />}
              {activePanel === 'screen' && <ScreenPlaceholder screen={selectedScreen} />}
            </>
          ) : (
            <p className="emptyState tableEmpty">لا توجد شاشة محددة.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function LoginScreen({
  connection,
  selectedDatabase,
  loginName,
  loginPassword,
  passwordHint,
  busy,
  status,
  onConnectionChange,
  onLoginNameChange,
  onLoginPasswordChange,
  onLoadDatabases,
  onLoadPasswordHint,
  onLogin,
}: {
  connection: ConnectionProfile;
  selectedDatabase: string;
  loginName: string;
  loginPassword: string;
  passwordHint: string;
  busy: boolean;
  status: string;
  onConnectionChange: (connection: ConnectionProfile) => void;
  onLoginNameChange: (userName: string) => void;
  onLoginPasswordChange: (password: string) => void;
  onLoadDatabases: () => Promise<void>;
  onLoadPasswordHint: () => Promise<void>;
  onLogin: () => Promise<void>;
}) {
  return (
    <main className="loginShell">
      <section className="loginArt">
        <p className="eyebrow">نظام الفوترة ECAS</p>
        <h1>تسجيل الدخول</h1>
        <p>الدخول يتم من جدول `UserData` في قاعدة ECAS القديمة، ثم يتم تحميل القوائم والصلاحيات تلقائياً.</p>
      </section>

      <section className="loginCard">
        <div className="loginHeader">
          <span>ECAS</span>
          <strong>دخول المستخدم</strong>
        </div>

        <div className="legacyLoginBox">
          <p className="loginMeta">
            قاعدة المحطة الحالية: <strong>{selectedDatabase || 'Ecas2673'}</strong>
          </p>
          <Field label="اسم المستخدم">
            <input value={loginName} onChange={(event) => onLoginNameChange(event.target.value)} autoFocus />
          </Field>
          <Field label="كلمة المرور">
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => onLoginPasswordChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void onLogin();
                }
              }}
            />
          </Field>
          <div className="loginActions">
            <button className="primaryButton loginButton" type="button" onClick={() => void onLogin()} disabled={busy}>
              دخول
            </button>
            <button className="secondaryButton" type="button" onClick={() => void onLoadPasswordHint()} disabled={busy}>
              تلميح كلمة المرور
            </button>
          </div>
          {passwordHint ? <p className="passwordHintBox">{passwordHint}</p> : null}
        </div>

        <details className="sqlSettings">
          <summary>إعداد اتصال SQL Server</summary>
          <div className="sqlGrid">
            <p className="loginMeta">
              القاعدة المعتمدة حالياً: <strong>{selectedDatabase || 'Ecas2673'}</strong>
            </p>
            <Field label="السيرفر">
              <input value={connection.server} onChange={(event) => onConnectionChange({ ...connection, server: event.target.value })} />
            </Field>
            <Field label="مستخدم SQL">
              <input value={connection.userName} onChange={(event) => onConnectionChange({ ...connection, userName: event.target.value })} />
            </Field>
            <Field label="كلمة مرور SQL">
              <input
                type="password"
                value={connection.password}
                onChange={(event) => onConnectionChange({ ...connection, password: event.target.value })}
                placeholder="لا تُحفظ داخل الكود"
              />
            </Field>
            <label className="checkField">
              <input
                type="checkbox"
                checked={connection.encrypt}
                onChange={(event) => onConnectionChange({ ...connection, encrypt: event.target.checked })}
              />
              تشفير الاتصال
            </label>
            <label className="checkField">
              <input
                type="checkbox"
                checked={connection.trustServerCertificate}
                onChange={(event) => onConnectionChange({ ...connection, trustServerCertificate: event.target.checked })}
              />
              الوثوق بالشهادة
            </label>
            <div className="sqlTools">
              <button className="secondaryButton" type="button" onClick={() => void onLoadDatabases()} disabled={busy}>
                جلب المحطات
              </button>
            </div>
          </div>
        </details>

        <p className="statusLine loginStatus">{status}</p>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Summary({ workspace }: { workspace: LegacyWorkspace | null }) {
  const summary = workspace?.summary;

  return (
    <section className="summaryGrid">
      <Metric label="المشتركون" value={summary?.customerCount ?? 0} />
      <Metric label="النشطون" value={summary?.activeCustomerCount ?? 0} />
      <Metric label="الفواتير" value={summary?.billCount ?? 0} />
      <Metric label="التسديدات" value={summary?.paymentCount ?? 0} />
      <Metric label="الرصيد" value={`${formatNumber(summary?.totalCurrentBalance ?? 0)} ريال`} />
      <Metric label="آخر تسديد" value={formatDate(summary?.lastPaymentDate)} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{typeof value === 'number' ? formatNumber(value) : value}</strong>
    </article>
  );
}

function CustomersTable({ rows }: { rows: CustomerRecord[] }) {
  return (
    <DataTable
      rows={rows}
      empty="لا توجد بيانات مشتركين معروضة."
      columns={[
        { title: 'رقم', value: (row) => row.customerId, align: 'end' },
        { title: 'الاسم', value: (row) => row.customerName },
        { title: 'الحي', value: (row) => row.neighborhood },
        { title: 'العنوان', value: (row) => row.address },
        { title: 'العداد', value: (row) => row.meterNumber },
        { title: 'آخر قراءة', value: (row) => formatNumber(row.lastRead), align: 'end' },
        { title: 'الرصيد', value: (row) => formatMoney(row.lastBalance), align: 'end' },
        { title: 'الحالة', value: (row) => row.recordState, align: 'center' },
      ]}
    />
  );
}

function BillsTable({ rows }: { rows: BillRecord[] }) {
  return (
    <DataTable
      rows={rows}
      empty="لا توجد فواتير/قراءات في السجلات المعروضة لهذه القاعدة."
      columns={[
        { title: 'رقم الفاتورة', value: (row) => row.billId, align: 'end' },
        { title: 'المشترك', value: (row) => row.customerId, align: 'end' },
        { title: 'التاريخ', value: (row) => formatDate(row.operationDate) },
        { title: 'السابقة', value: (row) => formatNumber(row.lastRead), align: 'end' },
        { title: 'الحالية', value: (row) => formatNumber(row.currentRead), align: 'end' },
        { title: 'الاستهلاك', value: (row) => formatNumber(row.monthConsume), align: 'end' },
        { title: 'القيمة', value: (row) => formatMoney(row.consumeValue), align: 'end' },
        { title: 'المستخدم', value: (row) => row.userName },
      ]}
    />
  );
}

function PaymentsTable({ rows }: { rows: PaymentRecord[] }) {
  return (
    <DataTable
      rows={rows}
      empty="لا توجد تسديدات معروضة."
      columns={[
        { title: 'رقم السند', value: (row) => row.paymentGroupId, align: 'end' },
        { title: 'المشترك', value: (row) => row.customerId, align: 'end' },
        { title: 'الاسم', value: (row) => row.customerName },
        { title: 'المبلغ', value: (row) => formatMoney(row.amount), align: 'end' },
        { title: 'التاريخ', value: (row) => formatDate(row.paymentDate) },
        { title: 'المستخدم', value: (row) => row.userName },
        { title: 'المرجع', value: (row) => row.referenceId },
      ]}
    />
  );
}

function UsersTable({ rows }: { rows: LegacyUser[] }) {
  return (
    <DataTable
      rows={rows}
      empty="لا يوجد مستخدمون معروضون."
      columns={[
        { title: 'رقم', value: (row) => row.userId, align: 'end' },
        { title: 'اسم المستخدم', value: (row) => row.userName },
        { title: 'الدور', value: (row) => row.roleName },
        { title: 'رقم الدور', value: (row) => row.roleId, align: 'end' },
        { title: 'نطاق العمل', value: (row) => row.workKindId, align: 'end' },
      ]}
    />
  );
}

function ScreenPlaceholder({ screen }: { screen: LegacyScreenDefinition }) {
  return (
    <section className="screenPlaceholder">
      <h4>الشاشة الأصلية غير منفذة بعد</h4>
      <p>
        هذه الشاشة موجودة في النظام القديم باسم "{screen.formName}" ورقمها {screen.formId}. تم تحليلها وإضافة موقعها ضمن
        القوائم والصلاحيات، ويمكننا تنفيذها وظيفياً خطوة بخطوة.
      </p>
      <p>المهام المنفذة الآن تغطي الشاشات التشغيلية الأساسية: المشتركين، الفواتير/القراءات، التسديدات، المستخدمين.</p>
    </section>
  );
}

function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: Column<T>[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="emptyState tableEmpty">{empty}</p>;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.title} className={column.align ? `align-${column.align}` : undefined}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.title} className={column.align ? `align-${column.align}` : undefined}>
                  {column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildMenuGroups(screens: LegacyScreenDefinition[]): MenuGroup[] {
  const groups = new Map<string, MenuGroup>();

  for (const screen of screens) {
    const key = normalizeMenuKey(screen.menuKey);
    const label = menuLabel(key);

    if (!groups.has(key)) {
      groups.set(key, { key, label, screens: [] });
    }

    groups.get(key)!.screens.push(screen);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      screens: [...group.screens].sort((a, b) => {
        if (a.menuIndex !== b.menuIndex) {
          return a.menuIndex - b.menuIndex;
        }
        return a.formId - b.formId;
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}

function normalizeMenuKey(key: string): string {
  const value = key.trim();
  return value && value !== '#' ? value : '#';
}

function menuLabel(key: string): string {
  return LEGACY_MENU_TITLES[key] ?? key;
}

function panelLabel(panel: LegacyDataPanel): string {
  if (panel === 'customers') return 'عرض بيانات المشتركين';
  if (panel === 'bills') return 'عرض بيانات الفوترة والقراءات';
  if (panel === 'payments') return 'عرض بيانات التسديدات';
  if (panel === 'users') return 'عرض المستخدمين والصلاحيات';
  return 'معاينة شاشة قديمة';
}

function resolvePanelByScreen(screen: LegacyScreenDefinition): LegacyDataPanel {
  const scope = `${screen.formName} ${screen.menuKey}`;

  if (containsAny(scope, ['مستخدم', 'صلاح', 'تفويض'])) {
    return 'users';
  }

  if (containsAny(scope, ['تسديد', 'تحصيل', 'قبض', 'دفاتر', 'صندوق'])) {
    return 'payments';
  }

  if (containsAny(scope, ['فوترة', 'فاتورة', 'قراءة', 'استهلاك', 'الإحتساب', 'مبيعات'])) {
    return 'bills';
  }

  if (containsAny(scope, ['مشترك', 'عداد', 'سجل', 'مربع', 'بلاغات'])) {
    return 'customers';
  }

  return 'screen';
}

function containsAny(value: string, keys: string[]): boolean {
  return keys.some((key) => value.includes(key));
}

function formatNumber(value: number) {
  return value.toLocaleString('ar-YE');
}

function formatMoney(value: number) {
  return `${formatNumber(Math.round(value))} ريال`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar-YE', { dateStyle: 'medium' }).format(new Date(value));
}
