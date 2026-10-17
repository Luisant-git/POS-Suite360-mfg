import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, RefreshControl,
} from 'react-native';
import {
  FileText, Search, Calendar, ChevronDown, Check, X,
  ArrowDownLeft, ArrowUpRight, ShoppingCart, Truck, Scissors,
  Package, Factory, Briefcase, ArrowLeftRight, Eye, Layers,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

type ReportType =
  | 'sales'
  | 'purchases'
  | 'estimations'
  | 'sales-returns'
  | 'purchase-returns'
  | 'customer-receipts'
  | 'supplier-payments'
  | 'expenses'
  | 'service-sales'
  | 'production'
  | 'raw-material-purchases'
  | 'stock';

interface ReportConfig {
  id: ReportType;
  title: string;
  subtitle: string;
  endpoint: string;
  icon: any;
  colors: [string, string];
  amountField: string;
  partyField: string;
  numberField: string;
}

const REPORT_CONFIGS: ReportConfig[] = [
  {
    id: 'sales',
    title: 'Sales Report',
    subtitle: 'Counter sales, POS invoices & customer bills',
    endpoint: '/sales',
    icon: ShoppingCart,
    colors: ['#0F172A', '#1E3A8A'],
    amountField: 'grandTotal',
    partyField: 'customer.name',
    numberField: 'invoiceNo',
  },
  {
    id: 'purchases',
    title: 'Purchase Report',
    subtitle: 'Inward goods, supplier bills & purchases',
    endpoint: '/purchases',
    icon: Truck,
    colors: ['#312E81', '#4F46E5'],
    amountField: 'grandTotal',
    partyField: 'supplier.name',
    numberField: 'supplierInvoiceNo',
  },
  {
    id: 'estimations',
    title: 'Estimation Report',
    subtitle: 'Quotes, proforma estimates & customer proposals',
    endpoint: '/estimations',
    icon: FileText,
    colors: ['#1E3A8A', '#2563EB'],
    amountField: 'grandTotal',
    partyField: 'customer.name',
    numberField: 'estimationNo',
  },
  {
    id: 'sales-returns',
    title: 'Sales Return Report',
    subtitle: 'Customer returns & credit notes',
    endpoint: '/sales-returns',
    icon: ArrowLeftRight,
    colors: ['#78350F', '#D97706'],
    amountField: 'totalAmount',
    partyField: 'customer.name',
    numberField: 'returnNo',
  },
  {
    id: 'purchase-returns',
    title: 'Purchase Return Report',
    subtitle: 'Debit notes & goods returned to suppliers',
    endpoint: '/purchase-returns',
    icon: ArrowLeftRight,
    colors: ['#7C2D12', '#EA580C'],
    amountField: 'totalAmount',
    partyField: 'supplier.name',
    numberField: 'returnNo',
  },
  {
    id: 'customer-receipts',
    title: 'Customer Receipts Report',
    subtitle: 'Payments in, customer collections & accounts settled',
    endpoint: '/customer-receipts',
    icon: ArrowDownLeft,
    colors: ['#064E3B', '#059669'],
    amountField: 'amount',
    partyField: 'customer.name',
    numberField: 'receiptNo',
  },
  {
    id: 'supplier-payments',
    title: 'Supplier Payments Report',
    subtitle: 'Payments out, supplier dues disbursed',
    endpoint: '/supplier-payments',
    icon: ArrowUpRight,
    colors: ['#881337', '#BE123C'],
    amountField: 'amount',
    partyField: 'supplier.name',
    numberField: 'paymentNo',
  },
  {
    id: 'expenses',
    title: 'Expense Report',
    subtitle: 'Daily shop expenses & running costs',
    endpoint: '/expenses',
    icon: Briefcase,
    colors: ['#581C87', '#7C3AED'],
    amountField: 'amount',
    partyField: 'category.name',
    numberField: 'notes',
  },
  {
    id: 'service-sales',
    title: 'Service Sales Report',
    subtitle: 'Labor charges, repair receipts & service income',
    endpoint: '/service-sales',
    icon: Scissors,
    colors: ['#0B4A3F', '#047857'],
    amountField: 'grandTotal',
    partyField: 'customer.name',
    numberField: 'invoiceNo',
  },
  {
    id: 'production',
    title: 'Production Report',
    subtitle: 'Manufacturing batches, raw material intake & outputs',
    endpoint: '/production',
    icon: Factory,
    colors: ['#1E3A8A', '#0284C7'],
    amountField: 'outcomeQuantity',
    partyField: 'finishedProduct.name',
    numberField: 'workName',
  },
  {
    id: 'raw-material-purchases',
    title: 'RM Purchase Report',
    subtitle: 'Raw material fabric, rolls & sheet purchases',
    endpoint: '/raw-material-purchases',
    icon: Package,
    colors: ['#075985', '#0284C7'],
    amountField: 'totalAmount',
    partyField: 'supplier.name',
    numberField: 'invoiceNo',
  },
  {
    id: 'stock',
    title: 'Stock / Inventory Report',
    subtitle: 'Current stock levels, reorder alerts & valuations',
    endpoint: '/products',
    icon: Layers,
    colors: ['#1E293B', '#334155'],
    amountField: 'sellingRate',
    partyField: 'category.name',
    numberField: 'code',
  },
];

type DateFilterOption = 'all' | 'today' | 'yesterday' | 'week' | 'month';

export default function ReportsScreen() {
  const [selectedReportId, setSelectedReportId] = useState<ReportType>('sales');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');

  // Modals
  const [isReportPickerVisible, setIsReportPickerVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);

  const activeConfig = REPORT_CONFIGS.find((r) => r.id === selectedReportId) || REPORT_CONFIGS[0];

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(activeConfig.endpoint);
      const list = res.data?.data || res.data || [];
      setData(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load report data', err);
      Alert.alert('Error', `Could not load ${activeConfig.title}. Please check network.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeConfig]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Date Filtering Helper
  const filteredData = useMemo(() => {
    let result = [...data];

    // Date filter (skip for stock)
    if (activeConfig.id !== 'stock' && dateFilter !== 'all') {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      result = result.filter((item) => {
        const itemDateStr = item.date || item.createdAt || item.returnDate;
        if (!itemDateStr) return true;
        const itemDate = new Date(itemDateStr);
        const itemDateOnly = itemDate.toISOString().split('T')[0];

        if (dateFilter === 'today') {
          return itemDateOnly === todayStr;
        } else if (dateFilter === 'yesterday') {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          return itemDateOnly === y.toISOString().split('T')[0];
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return itemDate >= sevenDaysAgo;
        } else if (dateFilter === 'month') {
          return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) => {
        const num = String(item[activeConfig.numberField] || item.invoiceNo || item.code || '').toLowerCase();
        const partyName = String(
          item.customer?.name || item.supplier?.name || item.category?.name || item.name || item.workName || ''
        ).toLowerCase();
        return num.includes(q) || partyName.includes(q);
      });
    }

    return result;
  }, [data, dateFilter, search, activeConfig]);

  // Aggregate stats
  const totalAmount = useMemo(() => {
    if (activeConfig.id === 'stock') {
      return filteredData.reduce((sum, item) => sum + (Number(item.currentStock) || 0) * (Number(item.sellingRate) || 0), 0);
    }
    if (activeConfig.id === 'production') {
      return filteredData.reduce((sum, item) => sum + (Number(item.outcomeQuantity) || 0), 0);
    }
    return filteredData.reduce((sum, item) => sum + (Number(item[activeConfig.amountField]) || 0), 0);
  }, [filteredData, activeConfig]);

  const getPartyName = (item: any) => {
    if (item.customer?.name) return item.customer.name;
    if (item.supplier?.name) return item.supplier.name;
    if (item.category?.name) return item.category.name;
    if (item.rawMaterial?.name) return `Intake: ${item.rawMaterial.name}`;
    if (item.name) return item.name;
    return 'General';
  };

  const getReferenceNo = (item: any) => {
    return (
      item[activeConfig.numberField] ||
      item.invoiceNo ||
      item.receiptNo ||
      item.paymentNo ||
      item.workName ||
      item.code ||
      `#${item.id}`
    );
  };

  const getItemAmount = (item: any) => {
    if (activeConfig.id === 'production') {
      return `${item.outcomeQuantity || 0} units`;
    }
    if (activeConfig.id === 'stock') {
      return `Stock: ${item.currentStock || 0}`;
    }
    const val = Number(item[activeConfig.amountField]) || 0;
    return `₹${val.toFixed(2)}`;
  };

  const IconComponent = activeConfig.icon;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Gradient Banner */}
      <LinearGradient colors={activeConfig.colors} style={styles.headerBanner}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.reportSelectorBtn}
            activeOpacity={0.8}
            onPress={() => setIsReportPickerVisible(true)}
          >
            <View style={styles.reportSelectorLeft}>
              <View style={styles.reportIconCircle}>
                <IconComponent size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.reportSelectorTitle}>{activeConfig.title}</Text>
                <Text style={styles.reportSelectorSub}>Tap to change report</Text>
              </View>
            </View>
            <ChevronDown size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color="rgba(255, 255, 255, 0.7)" />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeConfig.title}...`}
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={15} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Date Filter Pills */}
        {activeConfig.id !== 'stock' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterScroll}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
            ].map((df) => {
              const isSelected = dateFilter === df.id;
              return (
                <TouchableOpacity
                  key={df.id}
                  style={[styles.datePill, isSelected && styles.datePillActive]}
                  onPress={() => setDateFilter(df.id as DateFilterOption)}
                >
                  <Text style={[styles.datePillText, isSelected && styles.datePillTextActive]}>
                    {df.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      {/* KPI Stats Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>
            {activeConfig.id === 'production' ? 'TOTAL OUTCOME' : activeConfig.id === 'stock' ? 'TOTAL VALUATION' : 'TOTAL AMOUNT'}
          </Text>
          <Text style={styles.kpiValue}>
            {activeConfig.id === 'production' ? `${totalAmount} units` : `₹${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
          </Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TRANSACTIONS</Text>
          <Text style={styles.kpiValue}>{filteredData.length}</Text>
        </View>
      </View>

      {/* Report Records List */}
      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReportData(); }} />}
            renderItem={({ item }) => {
              const refNo = getReferenceNo(item);
              const party = getPartyName(item);
              const dateStr = item.date || item.createdAt || item.returnDate;
              return (
                <TouchableOpacity
                  style={styles.recordCard}
                  activeOpacity={0.7}
                  onPress={() => setDetailItem(item)}
                >
                  <View style={styles.recordLeft}>
                    <View style={styles.refRow}>
                      <Text style={styles.refBadge}>{refNo}</Text>
                      {dateStr ? (
                        <Text style={styles.dateText}>
                          {new Date(dateStr).toLocaleDateString()}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.partyName} numberOfLines={1}>
                      {party}
                    </Text>
                    {item.paymentMode?.name ? (
                      <Text style={styles.metaSub}>Mode: {item.paymentMode.name}</Text>
                    ) : null}
                  </View>

                  <View style={styles.recordRight}>
                    <Text style={styles.amountText}>{getItemAmount(item)}</Text>
                    <View style={styles.viewRow}>
                      <Text style={styles.viewText}>Details</Text>
                      <Eye size={12} color="#2563EB" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <FileText size={40} color="#CBD5E1" />
                <Text style={styles.emptyText}>No records found matching filters.</Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Report Switcher Modal */}
      <Modal visible={isReportPickerVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Report</Text>
              <TouchableOpacity onPress={() => setIsReportPickerVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {REPORT_CONFIGS.map((cfg) => {
                const isSelected = selectedReportId === cfg.id;
                const Icon = cfg.icon;
                return (
                  <TouchableOpacity
                    key={cfg.id}
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => {
                      setSelectedReportId(cfg.id);
                      setSearch('');
                      setDateFilter('all');
                      setIsReportPickerVisible(false);
                    }}
                  >
                    <View style={styles.modalItemLeft}>
                      <View style={[styles.modalIconWrap, { backgroundColor: cfg.colors[0] }]}>
                        <Icon size={16} color="#ffffff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalItemTitle, isSelected && styles.modalItemTitleActive]}>
                          {cfg.title}
                        </Text>
                        <Text style={styles.modalItemSub} numberOfLines={1}>
                          {cfg.subtitle}
                        </Text>
                      </View>
                    </View>
                    {isSelected && <Check size={18} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Detail Modal */}
      <Modal visible={!!detailItem} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.detailCardModal}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Record Details</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {detailItem && (
              <ScrollView style={{ padding: 16 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Reference / Voucher:</Text>
                  <Text style={styles.detailValBold}>{getReferenceNo(detailItem)}</Text>
                </View>

                {detailItem.date && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Date:</Text>
                    <Text style={styles.detailVal}>{new Date(detailItem.date).toLocaleDateString()}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Party / Category:</Text>
                  <Text style={styles.detailValBold}>{getPartyName(detailItem)}</Text>
                </View>

                {detailItem.paymentMode?.name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Payment Mode:</Text>
                    <Text style={styles.detailVal}>{detailItem.paymentMode.name}</Text>
                  </View>
                )}

                <View style={[styles.detailRow, { borderBottomWidth: 0, marginTop: 8 }]}>
                  <Text style={styles.detailKeyTotal}>Total Amount:</Text>
                  <Text style={styles.detailValTotal}>{getItemAmount(detailItem)}</Text>
                </View>

                {/* Items breakdown if present */}
                {detailItem.items && detailItem.items.length > 0 && (
                  <View style={styles.itemsBreakdownWrap}>
                    <Text style={styles.itemsBreakdownTitle}>
                      ITEMS ({detailItem.items.length})
                    </Text>
                    {detailItem.items.map((it: any, i: number) => (
                      <View key={i} style={styles.breakdownItemRow}>
                        <Text style={styles.breakdownItemName}>
                          {it.product?.name || it.serviceName || it.name || `Item #${i + 1}`}
                        </Text>
                        <Text style={styles.breakdownItemSub}>
                          Qty: {it.quantity} · Rate: ₹{it.rate || it.price || 0} = ₹{it.amount || it.total || 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {detailItem.notes && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.detailKey}>Notes:</Text>
                    <Text style={styles.detailNotes}>{detailItem.notes}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  headerBanner: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  headerTop: { marginBottom: 10 },
  reportSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  reportSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportSelectorTitle: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
  reportSelectorSub: { fontSize: 11, color: 'rgba(255, 255, 255, 0.7)' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 13, fontWeight: '500' },

  dateFilterScroll: { marginTop: 10 },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 6,
  },
  datePillActive: { backgroundColor: '#ffffff' },
  datePillText: { fontSize: 11, fontWeight: '700', color: 'rgba(255, 255, 255, 0.8)' },
  datePillTextActive: { color: '#0F172A', fontWeight: '800' },

  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: -8,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  kpiCard: { flex: 1, alignItems: 'center' },
  kpiLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  kpiValue: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  kpiDivider: { width: 1, backgroundColor: '#E2E8F0', height: '80%', alignSelf: 'center' },

  listContainer: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },

  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  recordLeft: { flex: 1, paddingRight: 8 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  refBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  dateText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  partyName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  metaSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  recordRight: { alignItems: 'flex-end', gap: 4 },
  amountText: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewText: { fontSize: 11, color: '#2563EB', fontWeight: '700' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 10, color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalCloseBtn: { padding: 4 },
  modalList: { padding: 12 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalItemActive: { backgroundColor: '#EFF6FF' },
  modalItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalIconWrap: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  modalItemTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  modalItemTitleActive: { color: '#1E3A8A' },
  modalItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },

  detailCardModal: {
    backgroundColor: '#ffffff',
    margin: 20,
    borderRadius: 18,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  detailTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailKey: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  detailVal: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  detailValBold: { fontSize: 13, color: '#1E3A8A', fontWeight: '800' },
  detailKeyTotal: { fontSize: 14, color: '#0F172A', fontWeight: '900' },
  detailValTotal: { fontSize: 18, color: '#059669', fontWeight: '900' },
  itemsBreakdownWrap: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemsBreakdownTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6 },
  breakdownItemRow: { paddingVertical: 4, borderBottomWidth: 1, borderColor: '#EDF2F7' },
  breakdownItemName: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  breakdownItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  detailNotes: { fontSize: 12, color: '#334155', marginTop: 4, fontStyle: 'italic' },
});
