import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShoppingCart, Truck, FileText, ArrowLeftRight, CreditCard,
  Briefcase, Scissors, Package, Factory, ChevronRight, Search,
  Sparkles, Layers, ArrowDownLeft, ArrowUpRight, Plus,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface EntryModule {
  id: string;
  title: string;
  subtitle: string;
  category: 'sales' | 'purchase' | 'finance' | 'services' | 'manufacturing';
  categoryLabel: string;
  icon: any;
  color: [string, string];
  route: string;
  badge?: string;
}

const ENTRY_MODULES: EntryModule[] = [
  // Sales & Billing
  {
    id: 'sales-pos',
    title: 'Sales Entry (POS)',
    subtitle: 'Fast counter billing, barcodes & instant receipts',
    category: 'sales',
    categoryLabel: 'Sales',
    icon: ShoppingCart,
    color: ['#059669', '#10B981'],
    route: '/(tabs)/sales-entry',
    badge: 'Popular',
  },
  {
    id: 'estimation',
    title: 'Estimation Entry',
    subtitle: 'Create customer quotes and proforma invoices',
    category: 'sales',
    categoryLabel: 'Sales',
    icon: FileText,
    color: ['#2563EB', '#3B82F6'],
    route: '/entries/estimation',
  },
  {
    id: 'sales-return',
    title: 'Sales Return',
    subtitle: 'Process customer returns & credit adjustments',
    category: 'sales',
    categoryLabel: 'Sales',
    icon: ArrowLeftRight,
    color: ['#D97706', '#F59E0B'],
    route: '/entries/sales-return',
  },
  {
    id: 'customer-receipts',
    title: 'Customer Receipts',
    subtitle: 'Payment in, settle outstanding customer dues',
    category: 'finance',
    categoryLabel: 'Finance',
    icon: ArrowDownLeft,
    color: ['#047857', '#059669'],
    route: '/entries/customer-receipts',
    badge: 'Money In',
  },

  // Purchase & Payables
  {
    id: 'purchase-entry',
    title: 'Purchase Entry',
    subtitle: 'Record supplier invoices & goods inwards',
    category: 'purchase',
    categoryLabel: 'Purchase',
    icon: Truck,
    color: ['#4F46E5', '#6366F1'],
    route: '/(tabs)/purchase-entry',
  },
  {
    id: 'purchase-return',
    title: 'Purchase Return',
    subtitle: 'Return damaged or excess goods to suppliers',
    category: 'purchase',
    categoryLabel: 'Purchase',
    icon: ArrowLeftRight,
    color: ['#EA580C', '#FB923C'],
    route: '/entries/purchase-return',
  },
  {
    id: 'supplier-payments',
    title: 'Supplier Payments',
    subtitle: 'Payment out, settle pending supplier bills',
    category: 'finance',
    categoryLabel: 'Finance',
    icon: ArrowUpRight,
    color: ['#BE123C', '#E11D48'],
    route: '/entries/supplier-payments',
    badge: 'Money Out',
  },

  // Daily Expenses & Services
  {
    id: 'expense-entry',
    title: 'Daily Expenses',
    subtitle: 'Record rent, utilities, tea & daily shop expenses',
    category: 'finance',
    categoryLabel: 'Finance',
    icon: Briefcase,
    color: ['#7C3AED', '#8B5CF6'],
    route: '/entries/expense-entry',
  },
  {
    id: 'service-sales',
    title: 'Service Sales Entry',
    subtitle: 'Bill labor, repairs, salon, tailoring & custom work',
    category: 'services',
    categoryLabel: 'Services',
    icon: Scissors,
    color: ['#0B4A3F', '#047857'],
    route: '/entries/service-sales',
  },

  // Manufacturing & Raw Materials
  {
    id: 'raw-material-purchase',
    title: 'Raw Material Purchase',
    subtitle: 'Stock rolls, raw fabric, sheets & production intake',
    category: 'manufacturing',
    categoryLabel: 'Mfg',
    icon: Package,
    color: ['#0284C7', '#38BDF8'],
    route: '/entries/raw-material-purchase',
  },
  {
    id: 'production-entry',
    title: 'Production Entry',
    subtitle: 'Track batch intake, output goods & manufacturing',
    category: 'manufacturing',
    categoryLabel: 'Mfg',
    icon: Factory,
    color: ['#1E3A8A', '#2563EB'],
    route: '/entries/production',
    badge: 'Batches',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Entries' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'finance', label: 'Finance' },
  { id: 'services', label: 'Services' },
  { id: 'manufacturing', label: 'Mfg' },
];

export default function EntriesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredModules = ENTRY_MODULES.filter((mod) => {
    const matchesCat = selectedCategory === 'all' || mod.category === selectedCategory;
    const matchesSearch = !search ||
      mod.title.toLowerCase().includes(search.toLowerCase()) ||
      mod.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      mod.categoryLabel.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header Banner */}
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={styles.headerBanner}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.brandBadge}>
              <Sparkles size={12} color="#60A5FA" />
              <Text style={styles.brandBadgeText}>OPERATIONS HUB</Text>
            </View>
            <Text style={styles.headerTitle}>All Entries</Text>
            <Text style={styles.headerSubtitle}>
              Select any entry module to create transactions
            </Text>
          </View>
          <View style={styles.headerCountBadge}>
            <Layers size={14} color="#93C5FD" />
            <Text style={styles.headerCountText}>{ENTRY_MODULES.length} Modules</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search entries (e.g. POS, Expense, Receipt)..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </LinearGradient>

      {/* Category Pills */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Entry Cards List */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>
          Available Entries ({filteredModules.length})
        </Text>

        <View style={styles.cardsGrid}>
          {filteredModules.map((item) => {
            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(item.route as any)}
              >
                <LinearGradient
                  colors={item.color}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconBox}
                >
                  <IconComponent size={22} color="#ffffff" />
                </LinearGradient>

                <View style={styles.cardContent}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.categoryLabel}>{item.categoryLabel}</Text>
                    <View style={styles.openLink}>
                      <Text style={styles.openLinkText}>Open</Text>
                      <ChevronRight size={14} color="#2563EB" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Reports Link Banner */}
        <TouchableOpacity
          style={styles.reportsBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/reports' as any)}
        >
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            style={styles.reportsBannerGradient}
          >
            <View style={styles.reportsBannerContent}>
              <View style={styles.reportsIconWrap}>
                <FileText size={20} color="#60A5FA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportsBannerTitle}>Looking for Reports?</Text>
                <Text style={styles.reportsBannerSubtitle}>
                  View full Sales, Purchase, Stock & Financial reports
                </Text>
              </View>
              <View style={styles.reportsBannerBtn}>
                <Text style={styles.reportsBannerBtnText}>View</Text>
                <ChevronRight size={16} color="#ffffff" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 32 },

  headerBanner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  brandBadgeText: { color: '#93C5FD', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff' },
  headerSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  headerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  headerCountText: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 13, fontWeight: '500' },

  categoryBar: { backgroundColor: '#F8FAFC', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  categoryText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  categoryTextActive: { color: '#ffffff' },

  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  cardsGrid: { gap: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#1E40AF' },
  cardSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 16 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  categoryLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  openLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openLinkText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },

  reportsBanner: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  reportsBannerGradient: { padding: 14 },
  reportsBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reportsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportsBannerTitle: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  reportsBannerSubtitle: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  reportsBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  reportsBannerBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
});
