import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  Scissors, Plus, Trash2, CheckCircle, RefreshCw, X, Calendar,
  CreditCard, User, ChevronDown, Check, Search, ShoppingCart,
  MinusCircle, PlusCircle, ChevronRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

interface ServiceItem {
  id: number;
  name: string;
  rate: number;
  taxPercent?: number;
}

interface CartRow {
  serviceItemId: number;
  serviceName: string;
  quantity: number;
  rate: number;
  discPercent: number;
  tax: number;
  total: number;
}

export default function ServiceSalesEntryScreen() {
  const [serviceCatalog, setServiceCatalog] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [cart, setCart] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Checkout Drawer
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [svcRes, custRes, pmRes] = await Promise.all([
        api.get('/service-items?isActive=true'),
        api.get('/customers'),
        api.get('/payment-modes'),
      ]);
      setServiceCatalog(svcRes.data || []);
      setCustomers(custRes.data || []);
      setPaymentModes(pmRes.data || []);
      if (pmRes.data && pmRes.data.length > 0 && !selectedPaymentModeId) {
        const cash = pmRes.data.find((m: any) => m.name.toLowerCase() === 'cash');
        setSelectedPaymentModeId(cash ? cash.id : pmRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load service sales data', err);
      Alert.alert('Error', 'Failed to load service items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addToCart = (svc: ServiceItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.serviceItemId === svc.id);
      if (idx >= 0) {
        const updated = [...prev];
        const newQty = updated[idx].quantity + 1;
        const total = newQty * updated[idx].rate * (1 - updated[idx].discPercent / 100);
        updated[idx] = { ...updated[idx], quantity: newQty, total: parseFloat(total.toFixed(2)) };
        return updated;
      }
      const rate = Number(svc.rate) || 0;
      return [
        ...prev,
        {
          serviceItemId: svc.id,
          serviceName: svc.name,
          quantity: 1,
          rate,
          discPercent: 0,
          tax: 0,
          total: rate,
        },
      ];
    });
  };

  const removeOneFromCart = (serviceItemId: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.serviceItemId === serviceItemId);
      if (idx < 0) return prev;
      if (prev[idx].quantity > 1) {
        const updated = [...prev];
        const newQty = updated[idx].quantity - 1;
        const total = newQty * updated[idx].rate * (1 - updated[idx].discPercent / 100);
        updated[idx] = { ...updated[idx], quantity: newQty, total: parseFloat(total.toFixed(2)) };
        return updated;
      }
      return prev.filter((i) => i.serviceItemId !== serviceItemId);
    });
  };

  const deleteFromCart = (serviceItemId: number) => {
    setCart((prev) => prev.filter((i) => i.serviceItemId !== serviceItemId));
  };

  const totalGross = cart.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + (item.quantity * item.rate * item.discPercent) / 100, 0);
  const grandTotal = totalGross - totalDiscount;
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one service.');
      return;
    }
    if (!selectedPaymentModeId) {
      Alert.alert('Validation Error', 'Please select a payment mode.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.post('/service-sales', {
        date,
        customerId: selectedCustomerId || undefined,
        paymentModeId: Number(selectedPaymentModeId),
        subtotal: totalGross,
        tax: 0,
        discount: totalDiscount,
        grandTotal,
        notes: notes.trim() || undefined,
        items: cart.map((i) => ({
          serviceItemId: i.serviceItemId,
          serviceName: i.serviceName,
          quantity: i.quantity,
          rate: i.rate,
          discount: (i.rate * i.quantity * i.discPercent) / 100,
          tax: 0,
          amount: i.total,
        })),
      });

      Alert.alert('Success', `Service Bill ${res.data.invoiceNo || 'Created'} Saved!`);
      setCart([]);
      setNotes('');
      setIsCheckoutOpen(false);
    } catch (err: any) {
      console.error('Failed to save service bill', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to save service bill.');
    } finally {
      setSaving(false);
    }
  };

  const filteredServices = serviceCatalog.filter((s) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );
  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);
  const filteredCustomers = customers.filter(
    (c) => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Banner */}
      <LinearGradient colors={['#0B4A3F', '#047857']} style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Service Sales Entry</Text>
            <Text style={styles.headerSubtitle}>Labor, custom work, salon & repairs billing</Text>
          </View>
          <View style={styles.headerIconWrap}>
            <Scissors size={22} color="#ffffff" />
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color="#A7F3D0" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search service name..."
            placeholderTextColor="#A7F3D0"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={15} color="#A7F3D0" />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {/* Services Catalog List */}
      <View style={styles.container}>
        <Text style={styles.sectionHeading}>
          Available Services ({filteredServices.length})
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#047857" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredServices}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            renderItem={({ item }) => {
              const inCart = cart.find((c) => c.serviceItemId === item.id);
              return (
                <TouchableOpacity
                  style={[styles.serviceCard, inCart && styles.serviceCardActive]}
                  activeOpacity={0.7}
                  onPress={() => addToCart(item)}
                >
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.serviceBadge}>
                        <Text style={styles.serviceBadgeText}>Service</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.serviceAction}>
                    <Text style={styles.serviceRate}>₹{Number(item.rate).toFixed(2)}</Text>
                    {inCart ? (
                      <View style={styles.qtyControls}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => removeOneFromCart(item.id)}
                        >
                          <MinusCircle size={18} color="#EF4444" />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{inCart.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => addToCart(item)}
                        >
                          <PlusCircle size={18} color="#059669" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.addBtn}>
                        <Plus size={14} color="#ffffff" />
                        <Text style={styles.addBtnText}>Add</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <TouchableOpacity
          style={styles.floatingCart}
          activeOpacity={0.9}
          onPress={() => setIsCheckoutOpen(true)}
        >
          <View style={styles.floatingCartLeft}>
            <View style={styles.cartIconBadge}>
              <ShoppingCart size={18} color="#047857" />
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{totalItemCount}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.cartTotalText}>₹{grandTotal.toFixed(2)}</Text>
              <Text style={styles.cartItemsCountText}>{cart.length} services selected</Text>
            </View>
          </View>
          <View style={styles.floatingCheckoutBtn}>
            <Text style={styles.floatingCheckoutText}>Checkout</Text>
            <ChevronRight size={16} color="#ffffff" />
          </View>
        </TouchableOpacity>
      )}

      {/* Checkout Bottom Sheet Modal */}
      <Modal visible={isCheckoutOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.checkoutSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Service Bill Checkout</Text>
              <TouchableOpacity onPress={() => setIsCheckoutOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.checkoutBody} showsVerticalScrollIndicator={false}>
              {/* Selected Items */}
              <Text style={styles.sheetSectionTitle}>SERVICES IN BILL ({cart.length})</Text>
              {cart.map((item) => (
                <View key={item.serviceItemId} style={styles.cartItemRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.cartItemName}>{item.serviceName}</Text>
                    <Text style={styles.cartItemSub}>
                      Rate: ₹{item.rate.toFixed(2)} × {item.quantity}
                    </Text>
                  </View>
                  <View style={styles.cartItemRight}>
                    <Text style={styles.cartItemTotal}>₹{item.total.toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => deleteFromCart(item.serviceItemId)}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Customer Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Customer (Optional)</Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setIsCustomerModalVisible(true)}
                >
                  <View style={styles.dropdownValue}>
                    <User size={15} color="#047857" />
                    <Text style={styles.dropdownText}>
                      {selectedCustomerObj ? selectedCustomerObj.name : 'Walk-in / Cash Customer'}
                    </Text>
                  </View>
                  <ChevronDown size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Payment Mode */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment Mode *</Text>
                <View style={styles.pillsRow}>
                  {paymentModes.map((pm) => {
                    const isSelected = selectedPaymentModeId === pm.id;
                    return (
                      <TouchableOpacity
                        key={pm.id}
                        style={[styles.pill, isSelected && styles.pillActive]}
                        onPress={() => setSelectedPaymentModeId(pm.id)}
                      >
                        <CreditCard size={12} color={isSelected ? '#ffffff' : '#64748B'} />
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {pm.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Date & Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <View style={styles.textInputWrap}>
                  <Calendar size={15} color="#64748B" />
                  <TextInput style={styles.textInput} value={date} onChangeText={setDate} />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <View style={styles.textInputWrap}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional job notes..."
                    placeholderTextColor="#94A3B8"
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>
              </View>

              {/* Summary Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Gross Amount:</Text>
                  <Text style={styles.summaryValue}>₹{totalGross.toFixed(2)}</Text>
                </View>
                {totalDiscount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: '#EF4444' }]}>Discount:</Text>
                    <Text style={[styles.summaryValue, { color: '#EF4444' }]}>- ₹{totalDiscount.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                  <Text style={styles.grandTotalLabel}>GRAND TOTAL:</Text>
                  <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.saveBillBtn, saving && styles.saveBillBtnDisabled]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <CheckCircle size={18} color="#ffffff" />
                    <Text style={styles.saveBillBtnText}>SAVE & PRINT BILL</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Customer Picker Modal */}
      <Modal visible={isCustomerModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setIsCustomerModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchWrap}>
              <Search size={15} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search customers..."
                placeholderTextColor="#94A3B8"
                value={customerSearch}
                onChangeText={setCustomerSearch}
              />
            </View>

            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[styles.modalItem, !selectedCustomerId && styles.modalItemActive]}
                onPress={() => {
                  setSelectedCustomerId(null);
                  setIsCustomerModalVisible(false);
                }}
              >
                <Text style={styles.modalItemText}>Walk-in / Cash Customer</Text>
                {!selectedCustomerId && <Check size={18} color="#047857" />}
              </TouchableOpacity>
              {filteredCustomers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.modalItem, selectedCustomerId === c.id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedCustomerId(c.id);
                    setIsCustomerModalVisible(false);
                  }}
                >
                  <View>
                    <Text style={[styles.modalItemText, selectedCustomerId === c.id && styles.modalItemTextActive]}>
                      {c.name}
                    </Text>
                    {c.phone && <Text style={styles.modalItemSub}>{c.phone}</Text>}
                  </View>
                  {selectedCustomerId === c.id && <Check size={18} color="#047857" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B4A3F' },
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 14 },
  listContent: { paddingBottom: 90 },

  headerCard: { padding: 16, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff' },
  headerSubtitle: { fontSize: 12, color: '#A7F3D0', marginTop: 2 },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginTop: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 13, fontWeight: '500' },

  sectionHeading: { fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 10 },

  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  serviceCardActive: { borderColor: '#059669', backgroundColor: '#F0FDF4' },
  serviceInfo: { flex: 1, paddingRight: 8 },
  serviceName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  badgeRow: { flexDirection: 'row', marginTop: 4 },
  serviceBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  serviceBadgeText: { fontSize: 10, fontWeight: '700', color: '#047857' },

  serviceAction: { alignItems: 'flex-end', gap: 6 },
  serviceRate: { fontSize: 16, fontWeight: '900', color: '#047857' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { padding: 2 },
  qtyValue: { fontSize: 14, fontWeight: '900', color: '#0F172A', minWidth: 20, textAlign: 'center' },

  floatingCart: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#0B4A3F',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeCountText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  cartTotalText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  cartItemsCountText: { color: '#A7F3D0', fontSize: 11 },
  floatingCheckoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  floatingCheckoutText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  checkoutSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalCloseBtn: { padding: 4 },
  checkoutBody: { padding: 16, paddingBottom: 30 },
  sheetSectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 10 },

  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cartItemName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  cartItemSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  cartItemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartItemTotal: { fontSize: 14, fontWeight: '800', color: '#047857' },

  inputGroup: { marginTop: 12 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 42,
  },
  dropdownValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pillActive: { backgroundColor: '#047857', borderColor: '#047857' },
  pillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  pillTextActive: { color: '#ffffff' },

  textInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    height: 42,
  },
  textInput: { flex: 1, fontSize: 13, color: '#0F172A' },

  summaryCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 16,
    gap: 6,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  summaryTotalRow: { borderTopWidth: 1, borderColor: '#A7F3D0', paddingTop: 6, marginTop: 4 },
  grandTotalLabel: { fontSize: 14, fontWeight: '900', color: '#0B4A3F' },
  grandTotalValue: { fontSize: 18, fontWeight: '900', color: '#047857' },

  saveBillBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  saveBillBtnDisabled: { opacity: 0.6 },
  saveBillBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  modalSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  modalSearchInput: { flex: 1, fontSize: 13, color: '#1E293B' },
  modalList: { padding: 12 },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalItemActive: { backgroundColor: '#ECFDF5' },
  modalItemText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalItemTextActive: { color: '#047857' },
  modalItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
});
