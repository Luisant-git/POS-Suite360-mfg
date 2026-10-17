import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  ArrowLeftRight, Plus, Trash2, CheckCircle, RefreshCw, X, Calendar,
  User, ChevronDown, Check, Search, ShoppingCart, MinusCircle, PlusCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

interface ReturnRow {
  productId: number;
  name: string;
  quantity: number;
  returnPrice: number;
  reason: string;
  amount: number;
}

export default function SalesReturnScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ReturnRow[]>([]);

  // Modals
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [custRes, prodRes, retRes] = await Promise.all([
        api.get('/customers'),
        api.get('/products'),
        api.get('/sales-returns'),
      ]);
      setCustomers(custRes.data || []);
      setProducts(prodRes.data.data || prodRes.data || []);
      setReturnsList(retRes.data || []);
    } catch (err) {
      console.error('Failed to load sales return data', err);
      Alert.alert('Error', 'Failed to load return data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addProductToReturn = (prod: any) => {
    const existing = items.find((i) => i.productId === prod.id);
    const rate = Number(prod.sellingRate) || 0;
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === prod.id
            ? { ...i, quantity: i.quantity + 1, amount: (i.quantity + 1) * i.returnPrice }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          productId: prod.id,
          name: prod.name,
          quantity: 1,
          returnPrice: rate,
          reason: 'Customer return',
          amount: rate,
        },
      ]);
    }
    setIsProductModalVisible(false);
  };

  const updateItemQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setItems(items.filter((i) => i.productId !== productId));
      return;
    }
    setItems(
      items.map((i) =>
        i.productId === productId ? { ...i, quantity: qty, amount: qty * i.returnPrice } : i
      )
    );
  };

  const updateItemPrice = (productId: number, priceStr: string) => {
    const price = Number(priceStr) || 0;
    setItems(
      items.map((i) =>
        i.productId === productId ? { ...i, returnPrice: price, amount: i.quantity * price } : i
      )
    );
  };

  const totalReturnAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      Alert.alert('Validation Error', 'Please select a customer.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one item to return.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/sales-returns', {
        date,
        customerId: Number(selectedCustomerId),
        totalAmount: totalReturnAmount,
        remarks: remarks.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          returnPrice: i.returnPrice,
          amount: i.amount,
          reason: i.reason,
        })),
      });

      Alert.alert('Success', 'Sales Return recorded successfully!');
      setItems([]);
      setRemarks('');
      fetchData();
    } catch (err: any) {
      console.error('Failed to save sales return', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to record return.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);
  const filteredCustomers = customers.filter(
    (c) => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
  );
  const filteredProducts = products.filter(
    (p) => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        >
          {/* Header Card */}
          <LinearGradient colors={['#D97706', '#F59E0B']} style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>Sales Return</Text>
                <Text style={styles.headerSubtitle}>Customer item returns & credit adjustments</Text>
              </View>
              <View style={styles.headerIconWrap}>
                <ArrowLeftRight size={22} color="#ffffff" />
              </View>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>RETURN DETAILS</Text>

            {/* Customer Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Customer *</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setIsCustomerModalVisible(true)}
              >
                <View style={styles.dropdownValue}>
                  <User size={16} color="#D97706" />
                  <Text style={styles.dropdownText}>
                    {selectedCustomerObj ? selectedCustomerObj.name : 'Choose Customer...'}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Return Date</Text>
              <View style={styles.textInputWrap}>
                <Calendar size={15} color="#64748B" />
                <TextInput style={styles.textInput} value={date} onChangeText={setDate} />
              </View>
            </View>

            {/* Items Section */}
            <View style={styles.itemsHeaderRow}>
              <Text style={styles.inputLabel}>Returned Items ({items.length})</Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => setIsProductModalVisible(true)}
              >
                <Plus size={14} color="#ffffff" />
                <Text style={styles.addItemBtnText}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyAddBox}
                onPress={() => setIsProductModalVisible(true)}
              >
                <Plus size={20} color="#D97706" />
                <Text style={styles.emptyAddBoxText}>Tap to add products being returned</Text>
              </TouchableOpacity>
            ) : (
              items.map((item) => (
                <View key={item.productId} style={styles.returnRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.returnRowName}>{item.name}</Text>
                    <View style={styles.returnRowPriceInputs}>
                      <Text style={styles.inputLabelSmall}>Return Rate (₹):</Text>
                      <TextInput
                        style={styles.smallRateInput}
                        keyboardType="numeric"
                        value={item.returnPrice.toString()}
                        onChangeText={(t) => updateItemPrice(item.productId, t)}
                      />
                    </View>
                  </View>

                  <View style={styles.returnRowRight}>
                    <Text style={styles.returnRowTotal}>₹{item.amount.toFixed(2)}</Text>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity onPress={() => updateItemQty(item.productId, item.quantity - 1)}>
                        <MinusCircle size={18} color="#EF4444" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateItemQty(item.productId, item.quantity + 1)}>
                        <PlusCircle size={18} color="#D97706" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* Remarks */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>Remarks / Return Reason</Text>
              <View style={styles.textInputWrap}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Size mismatch, defective piece..."
                  placeholderTextColor="#94A3B8"
                  value={remarks}
                  onChangeText={setRemarks}
                />
              </View>
            </View>

            {/* Total Return Banner */}
            <View style={styles.totalBox}>
              <Text style={styles.totalBoxLabel}>TOTAL CREDIT / REFUND:</Text>
              <Text style={styles.totalBoxValue}>₹{totalReturnAmount.toFixed(2)}</Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <CheckCircle size={18} color="#ffffff" />
                  <Text style={styles.submitBtnText}>PROCESS RETURN</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent Returns List */}
          <View style={styles.historySection}>
            <Text style={styles.historyHeading}>Recent Sales Returns ({returnsList.length})</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#D97706" style={{ marginVertical: 20 }} />
            ) : returnsList.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No sales returns recorded.</Text>
              </View>
            ) : (
              returnsList.slice(0, 15).map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.historyCustomer}>{item.customer?.name || 'Customer'}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(item.date || item.returnDate).toLocaleDateString()}
                      {item.returnNo ? ` · ${item.returnNo}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.historyAmount}>₹{Number(item.totalAmount || item.amount || 0).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
              {filteredCustomers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.modalItem, selectedCustomerId === c.id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedCustomerId(c.id);
                    setIsCustomerModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedCustomerId === c.id && styles.modalItemTextActive]}>
                    {c.name}
                  </Text>
                  {selectedCustomerId === c.id && <Check size={18} color="#D97706" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Picker Modal */}
      <Modal visible={isProductModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product to Return</Text>
              <TouchableOpacity onPress={() => setIsProductModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchWrap}>
              <Search size={15} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search product..."
                placeholderTextColor="#94A3B8"
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>
            <ScrollView style={styles.modalList}>
              {filteredProducts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.modalItem}
                  onPress={() => addProductToReturn(p)}
                >
                  <View>
                    <Text style={styles.modalItemText}>{p.name}</Text>
                    <Text style={styles.modalItemSub}>Rate: ₹{p.sellingRate || 0}</Text>
                  </View>
                  <Plus size={18} color="#D97706" />
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
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },

  headerCard: { borderRadius: 18, padding: 16, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff' },
  headerSubtitle: { fontSize: 12, color: '#FEF3C7', marginTop: 2 },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  formSectionTitle: { fontSize: 11, fontWeight: '900', color: '#D97706', letterSpacing: 0.8, marginBottom: 14 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 44,
  },
  dropdownValue: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dropdownText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },

  textInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 44,
  },
  textInput: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500' },

  itemsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addItemBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },

  emptyAddBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FCD34D',
    borderRadius: 12,
    paddingVertical: 20,
    backgroundColor: '#FFFBEB',
  },
  emptyAddBoxText: { color: '#B45309', fontSize: 13, fontWeight: '700' },

  returnRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  returnRowName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  returnRowPriceInputs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  inputLabelSmall: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  smallRateInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 60,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  returnRowRight: { alignItems: 'flex-end', gap: 4 },
  returnRowTotal: { fontSize: 14, fontWeight: '900', color: '#D97706' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyText: { fontSize: 13, fontWeight: '800', color: '#0F172A', minWidth: 18, textAlign: 'center' },

  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginVertical: 14,
  },
  totalBoxLabel: { fontSize: 12, fontWeight: '900', color: '#92400E' },
  totalBoxValue: { fontSize: 18, fontWeight: '900', color: '#D97706' },

  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D97706',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },

  historySection: { marginTop: 4 },
  historyHeading: { fontSize: 13, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 10 },
  emptyWrap: { padding: 20, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12 },
  emptyText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  historyCustomer: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  historyDate: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  historyAmount: { fontSize: 15, fontWeight: '900', color: '#D97706' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalCloseBtn: { padding: 4 },
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
  modalItemActive: { backgroundColor: '#FFFBEB' },
  modalItemText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalItemTextActive: { color: '#D97706' },
  modalItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
});
