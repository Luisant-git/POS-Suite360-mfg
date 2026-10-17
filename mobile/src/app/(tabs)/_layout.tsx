import React from 'react';
import { Tabs as ExpoTabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingCart, FileText, LogOut, Truck } from 'lucide-react-native';

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
          <LogOut color="#EF4444" size={18} />
          <Text style={styles.logoutText}>Close</Text>
        </TouchableOpacity>
      ),
      tabBarActiveTintColor: '#1E3A8A',
      tabBarInactiveTintColor: '#6B7280',
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB' },
    }}>
      <ExpoTabs.Screen
        name="sales-entry"
        options={{
          title: 'Sales Entry',
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
        name="sales"
        options={{
          title: 'POS',
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
        }}
      />
      <ExpoTabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
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
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
