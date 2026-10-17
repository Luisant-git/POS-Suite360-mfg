import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  Package, Plus, Trash2, CheckCircle, RefreshCw, X, Calendar,
  Truck, ChevronDown, Check, Search, CreditCard,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

interface RMCartItem {
  rawMaterialId: number;
  name: string;
  widthMm: string;
  lengthM: string;
  sqM: number;
  quantity: number;
  price: number;
  amount: number;
}

export default function RawMaterialPurchaseScreen() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<RMCartItem[]>([]);

  // Item Add Form State
  const [isAddMaterialModalVisible, setIsAddMaterialModalVisible] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [itemWidth, setItemWidth] = useState('');
  const [itemLength, setItemLength] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');

  // Modals & Search
  const [isSupplierModalVisible, setIsSupplierModalVisible] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [supRes, matRes, pmRes, purRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/raw-materials'),
        api.get('/payment-modes'),
        api.get('/raw-material-purchases'),
      ]);
      setSuppliers(supRes.data || []);
      setMaterials(matRes.data || []);
      setPaymentModes(pmRes.data || []);
      setPurchases(purRes.data || []);
      if (pmRes.data && pmRes.data.length > 0 && !selectedPaymentModeId) {
        const cash = pmRes.data.find((m: any) => m.name.toLowerCase() === 'cash');
        setSelectedPaymentModeId(cash ? cash.id : pmRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load raw material purchase data', err);
      Alert.alert('Error', 'Failed to load raw materials and suppliers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddMaterialItem = () => {
    if (!selectedMaterialId) {
      Alert.alert('Validation', 'Please select a raw material.');
      return;
    }
    const q = Number(itemQty) || 1;
    const p = Number(itemPrice) || 0;
    const w = Number(itemWidth) || 0;
    const l = Number(itemLength) || 0;
    const calculatedSqM = (w > 0 && l > 0) ? (w / 1000) * l * q : 0;
    const matObj = materials.find((m) => m.id === selectedMaterialId);

    setItems([
      ...items,
      {
        rawMaterialId: Number(selectedMaterialId),
        name: matObj ? matObj.name : 'Raw Material',
        widthMm: itemWidth,
        lengthM: itemLength,
        sqM: parseFloat(calculatedSqM.toFixed(3)),
        quantity: q,
        price: p,
        amount: q * p,
      },
    ]);

    // Reset
    setItemWidth('');
    setItemLength('');
    setItemQty('1');
    setItemPrice('');
    setIsAddMaterialModalVisible(false);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  const handleSubmit = async () => {
    if (!selectedSupplierId) {
      Alert.alert('Validation Error', 'Please select a supplier.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one raw material item.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/raw-material-purchases', {
        date,
        supplierId: Number(selectedSupplierId),
        invoiceNo: invoiceNo.trim() || undefined,
        paymentModeId: selectedPaymentModeId || undefined,
        totalAmount,
        items: items.map((i) => ({
          rawMaterialId: i.rawMaterialId,
          widthMm: i.widthMm,
          lengthM: i.lengthM,
          sqM: i.sqM,
          quantity: i.quantity,
          price: i.price,
          amount: i.amount,
        })),
      });

      Alert.alert('Success', 'Raw Material Purchase saved successfully!');
      setItems([]);
      setInvoiceNo('');
      fetchData();
    } catch (err: any) {
      console.error('Failed to save raw material purchase', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to record purchase.');
    } finally {
      setSaving(false);
    }
  };

  const selectedSupplierObj = suppliers.find((s) => s.id === selectedSupplierId);
  const filteredSuppliers = suppliers.filter(
    (s) => !supplierSearch || s.name?.toLowerCase().includes(supplierSearch.toLowerCase()) || s.phone?.includes(supplierSearch)
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
          <LinearGradient colors={['#0284C7', '#0369A1']} style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>RM Purchase Entry</Text>
                <Text style={styles.headerSubtitle}>Stock raw material rolls, sheets & fabric</Text>
              </View>
              <View style={styles.headerIconWrap}>
                <Package size={22} color="#ffffff" />
              </View>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>PURCHASE DETAILS</Text>

            {/* Supplier Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Supplier *</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setIsSupplierModalVisible(true)}
              >
                <View style={styles.dropdownValue}>
                  <Truck size={16} color="#0284C7" />
                  <Text style={styles.dropdownText}>
                    {selectedSupplierObj ? selectedSupplierObj.name : 'Choose Supplier...'}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Invoice No & Date */}
            <View style={styles.rowTwo}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Invoice No</Text>
                <View style={styles.textInputWrap}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. INV-2026"
                    placeholderTextColor="#94A3B8"
                    value={invoiceNo}
                    onChangeText={setInvoiceNo}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Date</Text>
                <View style={styles.textInputWrap}>
                  <Calendar size={15} color="#64748B" />
                  <TextInput style={styles.textInput} value={date} onChangeText={setDate} />
                </View>
              </View>
            </View>

            {/* Payment Mode */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Mode</Text>
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

            {/* Materials Added */}
            <View style={styles.itemsHeaderRow}>
              <Text style={styles.inputLabel}>Materials ({items.length})</Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => setIsAddMaterialModalVisible(true)}
              >
                <Plus size={14} color="#ffffff" />
                <Text style={styles.addItemBtnText}>Add Material</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyAddBox}
                onPress={() => setIsAddMaterialModalVisible(true)}
              >
                <Plus size={20} color="#0284C7" />
                <Text style={styles.emptyAddBoxText}>Tap to add raw materials to purchase</Text>
              </TouchableOpacity>
            ) : (
              items.map((item, idx) => (
                <View key={idx} style={styles.itemRowCard}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.itemRowName}>{item.name}</Text>
                    <Text style={styles.itemRowSub}>
                      Qty: {item.quantity} rolls · ₹{item.price.toFixed(2)}/roll
                      {item.sqM > 0 ? ` · ${item.sqM} Sq.M` : ''}
                    </Text>
                  </View>
                  <View style={styles.itemRowRight}>
                    <Text style={styles.itemRowTotal}>₹{item.amount.toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => removeItem(idx)}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Total Banner */}
            <View style={styles.totalBox}>
              <Text style={styles.totalBoxLabel}>TOTAL PURCHASE AMOUNT:</Text>
              <Text style={styles.totalBoxValue}>₹{totalAmount.toFixed(2)}</Text>
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
                  <Text style={styles.submitBtnText}>SAVE RAW MATERIAL PURCHASE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent Purchases */}
          <View style={styles.historySection}>
            <Text style={styles.historyHeading}>Recent RM Purchases ({purchases.length})</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#0284C7" style={{ marginVertical: 20 }} />
            ) : purchases.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No raw material purchases recorded.</Text>
              </View>
            ) : (
              purchases.slice(0, 15).map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.historySupplier}>{item.supplier?.name || 'Supplier'}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(item.date).toLocaleDateString()}
                      {item.invoiceNo ? ` · Inv: ${item.invoiceNo}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.historyAmount}>₹{Number(item.totalAmount || 0).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Material Modal */}
      <Modal visible={isAddMaterialModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Raw Material</Text>
              <TouchableOpacity onPress={() => setIsAddMaterialModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {/* Material Select */}
              <Text style={styles.inputLabel}>Select Material</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {materials.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.pill, selectedMaterialId === m.id && styles.pillActive]}
                      onPress={() => setSelectedMaterialId(m.id)}
                    >
                      <Text style={[styles.pillText, selectedMaterialId === m.id && styles.pillTextActive]}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.rowTwo}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Quantity (Rolls) *</Text>
                  <View style={styles.textInputWrap}>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={itemQty}
                      onChangeText={setItemQty}
                    />
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Price / Roll (₹) *</Text>
                  <View style={styles.textInputWrap}>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="0.00"
                      value={itemPrice}
                      onChangeText={setItemPrice}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.rowTwo}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Width (mm)</Text>
                  <View style={styles.textInputWrap}>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="e.g. 1000"
                      value={itemWidth}
                      onChangeText={setItemWidth}
                    />
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Length (m)</Text>
                  <View style={styles.textInputWrap}>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      placeholder="e.g. 50"
                      value={itemLength}
                      onChangeText={setItemLength}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddMaterialItem}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.submitBtnText}>ADD TO PURCHASE</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                  <View>
                    <Text style={[styles.modalItemText, selectedSupplierId === s.id && styles.modalItemTextActive]}>
                      {s.name}
                    </Text>
                    {s.phone && <Text style={styles.modalItemSub}>{s.phone}</Text>}
                  </View>
                  {selectedSupplierId === s.id && <Check size={18} color="#0284C7" />}
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
  headerSubtitle: { fontSize: 12, color: '#E0F2FE', marginTop: 2 },
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
  formSectionTitle: { fontSize: 11, fontWeight: '900', color: '#0284C7', letterSpacing: 0.8, marginBottom: 14 },

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

  rowTwo: { flexDirection: 'row', gap: 10 },
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
  pillActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  pillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  pillTextActive: { color: '#ffffff' },

  itemsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
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
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 20,
    backgroundColor: '#F0F9FF',
  },
  emptyAddBoxText: { color: '#0369A1', fontSize: 13, fontWeight: '700' },

  itemRowCard: {
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
  itemRowName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  itemRowSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  itemRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemRowTotal: { fontSize: 14, fontWeight: '900', color: '#0284C7' },

  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginVertical: 14,
  },
  totalBoxLabel: { fontSize: 12, fontWeight: '900', color: '#0369A1' },
  totalBoxValue: { fontSize: 18, fontWeight: '900', color: '#0284C7' },

  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#0284C7',
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
  historyAmount: { fontSize: 15, fontWeight: '900', color: '#0284C7' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
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
  modalItemActive: { backgroundColor: '#F0F9FF' },
  modalItemText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalItemTextActive: { color: '#0284C7' },
  modalItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
});
