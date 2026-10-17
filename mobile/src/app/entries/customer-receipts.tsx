import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  ArrowDownLeft, Plus, CheckCircle, RefreshCw, X, Calendar,
  CreditCard, User, ChevronDown, Check, FileText, Search,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

export default function CustomerReceiptsScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Modals & Search
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [custRes, pModesRes, recRes] = await Promise.all([
        api.get('/customers'),
        api.get('/payment-modes'),
        api.get('/customer-receipts'),
      ]);
      setCustomers(custRes.data || []);
      setPaymentModes(pModesRes.data || []);
      setReceipts(recRes.data || []);
      if (pModesRes.data && pModesRes.data.length > 0 && !selectedPaymentModeId) {
        const cash = pModesRes.data.find((m: any) => m.name.toLowerCase() === 'cash');
        setSelectedPaymentModeId(cash ? cash.id : pModesRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load receipts data', err);
      Alert.alert('Error', 'Failed to load customer receipts data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      Alert.alert('Validation Error', 'Please select a customer.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }
    if (!selectedPaymentModeId) {
      Alert.alert('Validation Error', 'Please select a payment mode.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/customer-receipts', {
        date,
        customerId: Number(selectedCustomerId),
        amount: Number(amount),
        paymentTypeId: Number(selectedPaymentModeId),
        reference: reference.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      Alert.alert('Success', 'Customer payment receipt saved!');
      setAmount('');
      setReference('');
      setRemarks('');
      fetchData();
    } catch (err: any) {
      console.error('Failed to save receipt', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to record customer receipt.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);
  const filteredCustomers = customers.filter(c => 
    !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
  );
  const totalReceiptsAmount = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

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
          <LinearGradient colors={['#047857', '#059669']} style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>Customer Receipts</Text>
                <Text style={styles.headerSubtitle}>Payment in, clear outstanding balances</Text>
              </View>
              <View style={styles.headerIconWrap}>
                <ArrowDownLeft size={22} color="#ffffff" />
              </View>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeLabel}>Total Receipts Collected:</Text>
              <Text style={styles.totalBadgeValue}>₹{totalReceiptsAmount.toFixed(2)}</Text>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>NEW RECEIPT VOUCHER</Text>

            {/* Customer Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Customer *</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setIsCustomerModalVisible(true)}
              >
                <View style={styles.dropdownValue}>
                  <User size={16} color="#047857" />
                  <Text style={styles.dropdownText}>
                    {selectedCustomerObj ? `${selectedCustomerObj.name} (${selectedCustomerObj.phone || 'No phone'})` : 'Choose Customer...'}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount Received (₹) *</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>

            {/* Payment Mode Pills */}
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
                      <CreditCard size={13} color={isSelected ? '#ffffff' : '#64748B'} />
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                        {pm.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Date & Reference */}
            <View style={styles.rowTwo}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Receipt Date</Text>
                <View style={styles.textInputWrap}>
                  <Calendar size={15} color="#64748B" />
                  <TextInput
                    style={styles.textInput}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Ref / Cheque #</Text>
                <View style={styles.textInputWrap}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional ref"
                    placeholderTextColor="#94A3B8"
                    value={reference}
                    onChangeText={setReference}
                  />
                </View>
              </View>
            </View>

            {/* Remarks */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Remarks</Text>
              <View style={[styles.textInputWrap, { height: 60, alignItems: 'flex-start', paddingTop: 6 }]}>
                <TextInput
                  style={[styles.textInput, { height: 48, textAlignVertical: 'top' }]}
                  placeholder="Optional notes..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={remarks}
                  onChangeText={setRemarks}
                />
              </View>
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
                  <Text style={styles.submitBtnText}>SAVE RECEIPT</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent Receipts List */}
          <View style={styles.historySection}>
            <Text style={styles.historyHeading}>Recent Receipts ({receipts.length})</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#047857" style={{ marginVertical: 20 }} />
            ) : receipts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No receipt records found.</Text>
              </View>
            ) : (
              receipts.slice(0, 15).map((item) => (
                <View key={item.id} style={styles.receiptItem}>
                  <View style={styles.receiptItemLeft}>
                    <Text style={styles.customerName}>{item.customer?.name || 'Walk-in Customer'}</Text>
                    <Text style={styles.receiptDate}>
                      {new Date(item.date).toLocaleDateString()} · {item.paymentMode?.name || item.paymentType?.name || 'Cash'}
                      {item.receiptNo ? ` · ${item.receiptNo}` : ''}
                    </Text>
                    {item.remarks ? (
                      <Text style={styles.receiptRemarks} numberOfLines={1}>{item.remarks}</Text>
                    ) : null}
                  </View>
                  <View style={styles.receiptItemRight}>
                    <Text style={styles.receiptAmount}>+ ₹{Number(item.amount).toFixed(2)}</Text>
                  </View>
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

            {/* Modal Search */}
            <View style={styles.modalSearchWrap}>
              <Search size={15} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search customer name or phone..."
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
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },

  headerCard: { borderRadius: 18, padding: 16, marginBottom: 16 },
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
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  totalBadgeLabel: { color: '#D1FAE5', fontSize: 12, fontWeight: '700' },
  totalBadgeValue: { color: '#ffffff', fontSize: 16, fontWeight: '900' },

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
  formSectionTitle: { fontSize: 11, fontWeight: '900', color: '#047857', letterSpacing: 0.8, marginBottom: 14 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#059669',
    paddingHorizontal: 14,
    height: 52,
  },
  currencyPrefix: { fontSize: 22, fontWeight: '900', color: '#059669', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '900', color: '#1E293B' },

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

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pillActive: { backgroundColor: '#059669', borderColor: '#059669' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  pillTextActive: { color: '#ffffff' },

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

  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#059669',
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

  receiptItem: {
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
  receiptItemLeft: { flex: 1, paddingRight: 8 },
  customerName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  receiptDate: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  receiptRemarks: { fontSize: 12, color: '#334155', marginTop: 2 },
  receiptItemRight: { alignItems: 'flex-end' },
  receiptAmount: { fontSize: 16, fontWeight: '900', color: '#059669' },

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
  modalItemActive: { backgroundColor: '#ECFDF5' },
  modalItemText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalItemTextActive: { color: '#047857' },
  modalItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
});
