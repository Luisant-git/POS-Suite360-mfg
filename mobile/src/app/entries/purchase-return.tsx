import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  ArrowLeftRight, Plus, Trash2, CheckCircle, RefreshCw, X, Calendar,
  Truck, ChevronDown, Check, Search, MinusCircle, PlusCircle,
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

export default function PurchaseReturnScreen() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ReturnRow[]>([]);

  // Modals
  const [isSupplierModalVisible, setIsSupplierModalVisible] = useState(false);
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [supRes, prodRes, retRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products'),
        api.get('/purchase-returns'),
      ]);
      setSuppliers(supRes.data || []);
      setProducts(prodRes.data.data || prodRes.data || []);
      setReturnsList(retRes.data || []);
    } catch (err) {
      console.error('Failed to load purchase return data', err);
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
    const rate = Number(prod.purchaseRate) || Number(prod.sellingRate) || 0;
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
          reason: 'Supplier return',
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
    if (!selectedSupplierId) {
      Alert.alert('Validation Error', 'Please select a supplier.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one item to return.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/purchase-returns', {
        date,
        supplierId: Number(selectedSupplierId),
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

      Alert.alert('Success', 'Purchase Return recorded successfully!');
      setItems([]);
      setRemarks('');
      fetchData();
    } catch (err: any) {
      console.error('Failed to save purchase return', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to record return.');
    } finally {
      setSaving(false);
    }
  };

  const selectedSupplierObj = suppliers.find((s) => s.id === selectedSupplierId);
  const filteredSuppliers = suppliers.filter(
    (s) => !supplierSearch || s.name?.toLowerCase().includes(supplierSearch.toLowerCase()) || s.phone?.includes(supplierSearch)
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
          <LinearGradient colors={['#EA580C', '#FB923C']} style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>Purchase Return</Text>
                <Text style={styles.headerSubtitle}>Return damaged goods or stock to suppliers</Text>
              </View>
              <View style={styles.headerIconWrap}>
                <ArrowLeftRight size={22} color="#ffffff" />
              </View>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>RETURN TO SUPPLIER</Text>

            {/* Supplier Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Supplier *</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setIsSupplierModalVisible(true)}
              >
                <View style={styles.dropdownValue}>
                  <Truck size={16} color="#EA580C" />
                  <Text style={styles.dropdownText}>
                    {selectedSupplierObj ? selectedSupplierObj.name : 'Choose Supplier...'}
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
                <Plus size={20} color="#EA580C" />
                <Text style={styles.emptyAddBoxText}>Tap to add products to return</Text>
              </TouchableOpacity>
            ) : (
              items.map((item) => (
                <View key={item.productId} style={styles.returnRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.returnRowName}>{item.name}</Text>
                    <View style={styles.returnRowPriceInputs}>
                      <Text style={styles.inputLabelSmall}>Debit Rate (₹):</Text>
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
                        <PlusCircle size={18} color="#EA580C" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* Remarks */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>Remarks / Debit Note Reason</Text>
              <View style={styles.textInputWrap}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Expired batch, packaging damaged..."
                  placeholderTextColor="#94A3B8"
                  value={remarks}
                  onChangeText={setRemarks}
                />
              </View>
            </View>

            {/* Total Return Banner */}
            <View style={styles.totalBox}>
              <Text style={styles.totalBoxLabel}>TOTAL DEBIT AMOUNT:</Text>
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
                  <Text style={styles.submitBtnText}>SAVE PURCHASE RETURN</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent Returns List */}
          <View style={styles.historySection}>
            <Text style={styles.historyHeading}>Recent Purchase Returns ({returnsList.length})</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#EA580C" style={{ marginVertical: 20 }} />
            ) : returnsList.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No purchase returns recorded.</Text>
              </View>
            ) : (
              returnsList.slice(0, 15).map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.historySupplier}>{item.supplier?.name || 'Supplier'}</Text>
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

      {/* Supplier Picker Modal */}
      <Modal visible={isSupplierModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Supplier</Text>
              <TouchableOpacity onPress={() => setIsSupplierModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchWrap}>
              <Search size={15} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search suppliers..."
                placeholderTextColor="#94A3B8"
                value={supplierSearch}
                onChangeText={setSupplierSearch}
              />
            </View>
            <ScrollView style={styles.modalList}>
              {filteredSuppliers.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.modalItem, selectedSupplierId === s.id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedSupplierId(s.id);
                    setIsSupplierModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedSupplierId === s.id && styles.modalItemTextActive]}>
                    {s.name}
                  </Text>
                  {selectedSupplierId === s.id && <Check size={18} color="#EA580C" />}
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
              <Text style={styles.modalTitle}>Select Product</Text>
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
                    <Text style={styles.modalItemSub}>Purchase Rate: ₹{p.purchaseRate || p.sellingRate || 0}</Text>
                  </View>
                  <Plus size={18} color="#EA580C" />
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
  headerSubtitle: { fontSize: 12, color: '#FFEDD5', marginTop: 2 },
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
  formSectionTitle: { fontSize: 11, fontWeight: '900', color: '#EA580C', letterSpacing: 0.8, marginBottom: 14 },

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
    backgroundColor: '#EA580C',
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
    borderColor: '#FDBA74',
    borderRadius: 12,
    paddingVertical: 20,
    backgroundColor: '#FFF7ED',
  },
  emptyAddBoxText: { color: '#C2410C', fontSize: 13, fontWeight: '700' },

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
  returnRowTotal: { fontSize: 14, fontWeight: '900', color: '#EA580C' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyText: { fontSize: 13, fontWeight: '800', color: '#0F172A', minWidth: 18, textAlign: 'center' },

  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginVertical: 14,
  },
  totalBoxLabel: { fontSize: 12, fontWeight: '900', color: '#9A3412' },
  totalBoxValue: { fontSize: 18, fontWeight: '900', color: '#EA580C' },

  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#EA580C',
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
  historySupplier: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  historyDate: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  historyAmount: { fontSize: 15, fontWeight: '900', color: '#EA580C' },

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
  modalItemActive: { backgroundColor: '#FFF7ED' },
  modalItemText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalItemTextActive: { color: '#EA580C' },
  modalItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
});
