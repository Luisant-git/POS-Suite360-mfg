import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const entryHeaderOptions = (title: string) => ({
    headerShown: true,
    title,
    headerStyle: { backgroundColor: '#0F172A' },
    headerTintColor: '#ffffff',
    headerTitleStyle: { fontWeight: '800' as const, fontSize: 16 },
    headerBackTitle: 'Entries',
  });

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entries/estimation" options={entryHeaderOptions('Estimation Entry')} />
        <Stack.Screen name="entries/customer-receipts" options={entryHeaderOptions('Customer Receipts')} />
        <Stack.Screen name="entries/supplier-payments" options={entryHeaderOptions('Supplier Payments')} />
        <Stack.Screen name="entries/expense-entry" options={entryHeaderOptions('Daily Expenses')} />
        <Stack.Screen name="entries/service-sales" options={entryHeaderOptions('Service Sales Entry')} />
        <Stack.Screen name="entries/sales-return" options={entryHeaderOptions('Sales Return')} />
        <Stack.Screen name="entries/purchase-return" options={entryHeaderOptions('Purchase Return')} />
        <Stack.Screen name="entries/raw-material-purchase" options={entryHeaderOptions('RM Purchase Entry')} />
        <Stack.Screen name="entries/production" options={entryHeaderOptions('Production Entry')} />
      </Stack>
    </ThemeProvider>
  );
}
