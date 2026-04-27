import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';
import { AuthProvider } from '@/auth/auth-context';

I18nManager.allowRTL(true);

export default function Layout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#f5f7fb' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'أنظمة العباسي المتخصصة' }} />
      </Stack>
    </AuthProvider>
  );
}
