import React from 'react';
import { Tabs as ExpoTabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingCart, FileText, LogOut, Truck, Layers } from 'lucide-react-native';

export default function TabLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('user');
    router.replace('/login');
  };

  return (
    <ExpoTabs screenOptions={{
      headerStyle: { backgroundColor: '#0F172A' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <LogOut color="#EF4444" size={16} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      ),
      tabBarActiveTintColor: '#1E3A8A',
      tabBarInactiveTintColor: '#6B7280',
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB', height: 60, paddingBottom: 8, paddingTop: 6 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
    }}>
      <ExpoTabs.Screen
        name="entries"
        options={{
          title: 'All Entries',
          tabBarIcon: ({ color, size }) => <Layers color={color} size={size} />,
        }}
      />
      <ExpoTabs.Screen
        name="sales-entry"
        options={{
          title: 'Sales POS',
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
        }}
      />
      <ExpoTabs.Screen
        name="purchase-entry"
        options={{
          title: 'Purchase',
          tabBarIcon: ({ color, size }) => <Truck color={color} size={size} />,
        }}
      />
      <ExpoTabs.Screen
        name="reports"
        options={{
          title: 'All Reports',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <ExpoTabs.Screen
        name="sales"
        options={{
          href: null,
        }}
      />
    </ExpoTabs>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
