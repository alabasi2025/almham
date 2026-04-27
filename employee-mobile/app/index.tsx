import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { ApiError, checkIn, checkOut } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import {
  getActiveClientSessionId,
  getCurrentPosition,
  queueCurrentPoint,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '@/location/tracking';
import { createClientId, enqueueRequest } from '@/storage/offline-store';

const colors = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#d8e3ee',
  bg: '#eef5f7',
  card: '#ffffff',
  primary: '#0f766e',
  primaryDark: '#0b5f59',
  blue: '#2563eb',
  cyan: '#0891b2',
  amber: '#d97706',
  danger: '#dc2626',
  successBg: '#dcfce7',
  dangerBg: '#fee2e2',
  warningBg: '#fef3c7',
  navy: '#12213a',
  navySoft: '#1d3353',
};

export default function Index() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text selectable style={{ marginTop: 14, color: colors.muted, writingDirection: 'rtl' }}>
          جاري تجهيز تطبيق الموظف...
        </Text>
      </View>
    );
  }

  if (!auth.user) return <LoginScreen />;
  return <AttendanceScreen />;
}

function LoginScreen() {
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const isWide = width >= 820;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await auth.signIn(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: isWide ? 32 : 18,
        backgroundColor: colors.bg,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 1040,
          alignSelf: 'center',
          flexDirection: isWide ? 'row-reverse' : 'column',
          gap: isWide ? 0 : 14,
          borderRadius: 24,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: '#dbe8f2',
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
        }}
      >
        <View
          style={{
            flex: 1,
            minHeight: isWide ? 520 : 260,
            backgroundColor: colors.navy,
            padding: isWide ? 32 : 24,
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              left: 0,
              height: 8,
              flexDirection: 'row-reverse',
            }}
          >
            <View style={{ flex: 4, backgroundColor: colors.primary }} />
            <View style={{ flex: 3, backgroundColor: colors.cyan }} />
            <View style={{ flex: 2, backgroundColor: colors.blue }} />
            <View style={{ flex: 1, backgroundColor: colors.amber }} />
          </View>

          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 12,
              height: '42%',
              backgroundColor: colors.amber,
            }}
          />

          <View style={{ gap: 22 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <BrandMark />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#e0f2fe', fontSize: 17, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
                  أنظمة العباسي المتخصصة
                </Text>
                <Text style={{ color: '#93c5fd', fontSize: 12, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' }}>
                  بوابة الموظفين
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: '#ffffff', fontSize: isWide ? 38 : 30, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
                الحضور والانصراف
              </Text>
              <Text style={{ color: '#b7c9dc', fontSize: 16, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' }}>
                نسخة ميدانية لمحطات الكهرباء
              </Text>
              <View style={{ width: 136, height: 5, borderRadius: 999, backgroundColor: colors.cyan, alignSelf: 'flex-end' }} />
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ height: 6, borderRadius: 999, overflow: 'hidden', flexDirection: 'row-reverse' }}>
              <View style={{ flex: 3, backgroundColor: colors.primary }} />
              <View style={{ flex: 2, backgroundColor: colors.cyan }} />
              <View style={{ flex: 1, backgroundColor: colors.amber }} />
            </View>

            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
              <LoginMetric label="موقع" value="GPS" color={colors.cyan} />
              <LoginMetric label="وردية" value="12h" color={colors.primary} />
              <LoginMetric label="أوفلاين" value="مزامنة" color={colors.amber} />
            </View>
          </View>
        </View>

        <View
          style={{
            flex: 1.05,
            padding: isWide ? 34 : 20,
            gap: 18,
            justifyContent: 'center',
            backgroundColor: '#fbfdff',
          }}
        >
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
                دخول الموظف
              </Text>
              <Text style={{ color: colors.ink, fontSize: 30, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
                أهلاً بك
              </Text>
            </View>
            <AuthBadge />
          </View>

          <View style={{ gap: 12 }}>
            <Field label="اسم المستخدم" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          {error ? (
            <Notice text={error} tone="danger" />
          ) : null}

          <PrimaryButton title={busy ? 'جاري الدخول...' : 'دخول'} disabled={busy || !username || !password} onPress={submit} />

          <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: colors.primary }} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', writingDirection: 'rtl' }}>
              اتصال آمن بسيرفر النظام
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function AttendanceScreen() {
  const auth = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [localSessionId, setLocalSessionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    getActiveClientSessionId().then(setLocalSessionId).catch(() => null);
  }, []);

  const activeClientSessionId = auth.openSession?.clientSessionId ?? localSessionId;
  const isWorking = Boolean(activeClientSessionId);
  const interval = auth.settings?.trackingIntervalSeconds ?? 300;

  async function buildPayload(clientSessionId: string, eventPrefix: string) {
    const position = await getCurrentPosition();
    return {
      clientSessionId,
      clientEventId: createClientId(eventPrefix),
      stationId: auth.station?.id,
      recordedAt: new Date().toISOString(),
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? null,
    };
  }

  async function handleCheckIn() {
    const clientSessionId = activeClientSessionId ?? createClientId('session');
    let payload: Awaited<ReturnType<typeof buildPayload>> | null = null;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      payload = await buildPayload(clientSessionId, 'checkin');
      const response = await checkIn(payload);
      await startBackgroundTracking(response.session.clientSessionId, response.settings?.trackingIntervalSeconds ?? interval);
      setLocalSessionId(response.session.clientSessionId);
      await queueCurrentPoint(response.session.clientSessionId, false);
      await auth.sync();
      await auth.refresh();
      setMessage('تم تسجيل الحضور وبدأ حفظ مسار العمل.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NETWORK_ERROR' && payload) {
        await enqueueRequest('/api/attendance/check-in', payload);
        await startBackgroundTracking(clientSessionId, interval);
        setLocalSessionId(clientSessionId);
        await queueCurrentPoint(clientSessionId, true);
        await auth.sync();
        setMessage('لا يوجد اتصال. تم حفظ الحضور محلياً وسيُرسل تلقائياً عند رجوع الشبكة.');
      } else {
        setError(err instanceof Error ? err.message : 'تعذر تسجيل الحضور');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    if (!activeClientSessionId) return;
    let payload: Awaited<ReturnType<typeof buildPayload>> | null = null;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      payload = await buildPayload(activeClientSessionId, 'checkout');
      await checkOut(payload);
      await queueCurrentPoint(activeClientSessionId, false);
      await stopBackgroundTracking();
      setLocalSessionId(null);
      await auth.sync();
      await auth.refresh();
      setMessage('تم تسجيل الانصراف وإيقاف التتبع.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NETWORK_ERROR' && payload) {
        await queueCurrentPoint(activeClientSessionId, true);
        await enqueueRequest('/api/attendance/check-out', payload);
        await stopBackgroundTracking();
        setLocalSessionId(null);
        await auth.sync();
        setMessage('لا يوجد اتصال. تم حفظ الانصراف محلياً وسيُرسل تلقائياً عند رجوع الشبكة.');
      } else {
        setError(err instanceof Error ? err.message : 'تعذر تسجيل الانصراف');
      }
    } finally {
      setBusy(false);
    }
  }

  async function manualSync() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await auth.sync();
      await auth.refresh();
      setMessage('تمت محاولة المزامنة.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذرت المزامنة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 18, gap: 14, backgroundColor: colors.bg }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'right', writingDirection: 'rtl' }}>
          أهلاً
        </Text>
        <Text selectable style={{ color: colors.ink, fontSize: 28, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
          {auth.employee?.name}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: isWorking ? '#ecfdf5' : colors.card,
          borderRadius: 20,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: isWorking ? '#99f6e4' : colors.line,
          padding: 18,
          gap: 16,
          boxShadow: '0 12px 30px rgba(16, 32, 51, 0.08)',
        }}
      >
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: colors.muted, textAlign: 'right', writingDirection: 'rtl' }}>حالة الوردية</Text>
            <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
              {isWorking ? 'داخل العمل' : 'خارج العمل'}
            </Text>
          </View>
          <StatusPill active={isWorking} />
        </View>

        <InfoRow label="المحطة" value={auth.station?.name ?? 'غير محددة'} />
        <InfoRow label="نطاق الحضور" value={`${auth.settings?.radiusMeters ?? 100} متر`} />
        <InfoRow label="حفظ المسار" value={`كل ${Math.round(interval / 60)} دقائق تقريباً`} />
        <InfoRow label="طلبات محفوظة أوفلاين" value={`${auth.queuedCount}`} />

        {message ? <Notice text={message} tone="success" /> : null}
        {error ? <Notice text={error} tone="danger" /> : null}

        {isWorking ? (
          <DangerButton title={busy ? 'جاري الانصراف...' : 'تسجيل الانصراف'} disabled={busy} onPress={handleCheckOut} />
        ) : (
          <PrimaryButton title={busy ? 'جاري الحضور...' : 'تسجيل الحضور'} disabled={busy || !auth.station} onPress={handleCheckIn} />
        )}

        <SecondaryButton title="مزامنة الآن" disabled={busy} onPress={manualSync} />
      </View>

      <View
        style={{
          backgroundColor: colors.warningBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 14,
          borderWidth: 1,
          borderColor: '#fde68a',
        }}
      >
        <Text selectable style={{ color: '#92400e', lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' }}>
          يعمل التتبع فقط بين الحضور والانصراف. إذا انقطع الإنترنت، تبقى النقاط محفوظة داخل الجوال ثم تُرسل عند رجوع الاتصال.
        </Text>
      </View>

      <SecondaryButton title="تسجيل خروج" disabled={busy} onPress={auth.signOut} />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: focused ? colors.primary : colors.muted, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        textAlign="right"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor="#94a3b8"
        style={{
          minHeight: 56,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.primary : colors.line,
          backgroundColor: focused ? '#ffffff' : '#f8fafc',
          paddingHorizontal: 14,
          color: colors.ink,
          fontSize: 17,
          writingDirection: 'rtl',
          boxShadow: focused ? '0 8px 22px rgba(15, 118, 110, 0.12)' : 'none',
        }}
      />
    </View>
  );
}

function BrandMark() {
  return (
    <View
      style={{
        width: 58,
        height: 58,
        borderRadius: 18,
        borderCurve: 'continuous',
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          borderCurve: 'continuous',
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 20 }}>ع</Text>
      </View>
    </View>
  );
}

function LoginMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View
      style={{
        minWidth: 96,
        borderRadius: 16,
        borderCurve: 'continuous',
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        gap: 5,
      }}
    >
      <View style={{ width: 22, height: 4, borderRadius: 999, backgroundColor: color, alignSelf: 'flex-end' }} />
      <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{value}</Text>
      <Text style={{ color: '#b7c9dc', fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>{label}</Text>
    </View>
  );
}

function AuthBadge() {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#e0f2fe',
        borderWidth: 1,
        borderColor: '#bae6fd',
      }}
    >
      <Text style={{ color: colors.cyan, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' }}>
        موبايل
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: colors.muted, writingDirection: 'rtl' }}>{label}</Text>
      <Text selectable style={{ color: colors.ink, fontWeight: '800', flex: 1, textAlign: 'left' }}>
        {value}
      </Text>
    </View>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: active ? colors.successBg : '#eef2f7',
      }}
    >
      <Text style={{ color: active ? colors.primaryDark : colors.muted, fontWeight: '900', writingDirection: 'rtl' }}>
        {active ? 'نشط' : 'متوقف'}
      </Text>
    </View>
  );
}

function Notice({ text, tone }: { text: string; tone: 'success' | 'danger' }) {
  return (
    <View
      style={{
        borderRadius: 14,
        borderCurve: 'continuous',
        padding: 12,
        backgroundColor: tone === 'success' ? colors.successBg : colors.dangerBg,
      }}
    >
      <Text selectable style={{ color: tone === 'success' ? colors.primaryDark : colors.danger, textAlign: 'right', writingDirection: 'rtl', lineHeight: 22 }}>
        {text}
      </Text>
    </View>
  );
}

function PrimaryButton({ title, disabled, onPress }: { title: string; disabled?: boolean; onPress: () => void }) {
  return <AppButton title={title} disabled={disabled} onPress={onPress} color={colors.primary} />;
}

function DangerButton({ title, disabled, onPress }: { title: string; disabled?: boolean; onPress: () => void }) {
  return <AppButton title={title} disabled={disabled} onPress={onPress} color={colors.danger} />;
}

function SecondaryButton({ title, disabled, onPress }: { title: string; disabled?: boolean; onPress: () => void | Promise<void> }) {
  return <AppButton title={title} disabled={disabled} onPress={onPress} color="#e2e8f0" textColor={colors.ink} />;
}

function AppButton({
  title,
  disabled,
  onPress,
  color,
  textColor = '#ffffff',
}: {
  title: string;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
  color: string;
  textColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 54,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? '#cbd5e1' : color,
      }}
    >
      <Text style={{ color: disabled ? '#64748b' : textColor, fontSize: 17, fontWeight: '900', writingDirection: 'rtl' }}>
        {title}
      </Text>
    </Pressable>
  );
}
