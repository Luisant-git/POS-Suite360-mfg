import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  Briefcase, Plus, Trash2, CheckCircle, RefreshCw, X, Calendar,
  CreditCard, Tag, DollarSign, ChevronDown, Check,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

export default function ExpenseEntryScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [catsRes, pModesRes, expRes] = await Promise.all([
        api.get('/expense-categories'),
        api.get('/payment-modes'),
        api.get('/expenses'),
      ]);
      setCategories(catsRes.data || []);
      setPaymentModes(pModesRes.data || []);
      setExpenses(expRes.data || []);
      if (pModesRes.data && pModesRes.data.length > 0 && !selectedPaymentModeId) {
        const cash = pModesRes.data.find((m: any) => m.name.toLowerCase() === 'cash');
        setSelectedPaymentModeId(cash ? cash.id : pModesRes.data[0].id);
      }
      if (catsRes.data && catsRes.data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(catsRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load expense data', err);
      Alert.alert('Error', 'Failed to load expense categories or payment modes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Validation Error', 'Please select an expense category.');
      return;
    }
    if (!selectedPaymentModeId) {
      Alert.alert('Validation Error', 'Please select a payment mode.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/expenses', {
        date,
        amount: Number(amount),
        categoryId: Number(selectedCategoryId),
        paymentModeId: Number(selectedPaymentModeId),
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', 'Expense recorded successfully!');
      setAmount('');
      setNotes('');
      fetchData();
    } catch (err: any) {
      console.error('Failed to save expense', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/expenses/${id}`);
            setExpenses(prev => prev.filter(e => e.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete expense record.');
          }
        },
      },
    ]);
  };

  const selectedCategoryObj = categories.find(c => c.id === selectedCategoryId);
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

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
          <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>Daily Expenses</Text>
                <Text style={styles.headerSubtitle}>Record shop, utilities & daily running costs</Text>
              </View>
              <View style={styles.headerIconWrap}>
                <Briefcase size={22} color="#ffffff" />
              </View>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeLabel}>Total Recorded:</Text>
              <Text style={styles.totalBadgeValue}>₹{totalExpensesAmount.toFixed(2)}</Text>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>NEW EXPENSE ENTRY</Text>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (₹) *</Text>
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

            {/* Category Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setIsCategoryModalVisible(true)}
              >
                <View style={styles.dropdownValue}>
                  <Tag size={16} color="#7C3AED" />
                  <Text style={styles.dropdownText}>
                    {selectedCategoryObj ? selectedCategoryObj.name : 'Select Category...'}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>
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

            {/* Date Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expense Date</Text>
              <View style={styles.textInputWrap}>
                <Calendar size={16} color="#64748B" />
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Notes / Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes / Description</Text>
              <View style={[styles.textInputWrap, { height: 72, alignItems: 'flex-start', paddingTop: 8 }]}>
                <TextInput
                  style={[styles.textInput, { height: 56, textAlignVertical: 'top' }]}
                  placeholder="Optional details, voucher #, reason..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
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
                  <Text style={styles.submitBtnText}>SAVE EXPENSE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent Expenses List */}
          <View style={styles.historySection}>
            <Text style={styles.historyHeading}>Recent Expenses ({expenses.length})</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#7C3AED" style={{ marginVertical: 20 }} />
            ) : expenses.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No expense records found.</Text>
              </View>
            ) : (
              expenses.slice(0, 15).map((item) => (
                <View key={item.id} style={styles.expenseItem}>
                  <View style={styles.expenseItemLeft}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {item.category?.name || 'General Expense'}
                      </Text>
                    </View>
                    <Text style={styles.expenseDate}>
                      {new Date(item.date).toLocaleDateString()} · {item.paymentMode?.name || 'Cash'}
                    </Text>
                    {item.notes ? (
                      <Text style={styles.expenseNotes} numberOfLines={1}>{item.notes}</Text>
                    ) : null}
                  </View>
                  <View style={styles.expenseItemRight}>
                    <Text style={styles.expenseAmount}>₹{Number(item.amount).toFixed(2)}</Text>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.id)}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Picker Modal */}
      <Modal visible={isCategoryModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Expense Category</Text>
              <TouchableOpacity onPress={() => setIsCategoryModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.modalItem, selectedCategoryId === c.id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedCategoryId(c.id);
                    setIsCategoryModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedCategoryId === c.id && styles.modalItemTextActive]}>
                    {c.name}
                  </Text>
                  {selectedCategoryId === c.id && <Check size={18} color="#7C3AED" />}
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

  headerCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff' },
  headerSubtitle: { fontSize: 12, color: '#DDD6FE', marginTop: 2 },
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
  totalBadgeLabel: { color: '#EDE9FE', fontSize: 12, fontWeight: '700' },
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
  formSectionTitle: { fontSize: 11, fontWeight: '900', color: '#7C3AED', letterSpacing: 0.8, marginBottom: 14 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7C3AED',
    paddingHorizontal: 14,
    height: 52,
  },
  currencyPrefix: { fontSize: 22, fontWeight: '900', color: '#7C3AED', marginRight: 6 },
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
  dropdownValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },

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
  pillActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  pillTextActive: { color: '#ffffff' },

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
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#7C3AED',
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

  expenseItem: {
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
  expenseItemLeft: { flex: 1, paddingRight: 8 },
  categoryBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  categoryBadgeText: { color: '#6D28D9', fontSize: 11, fontWeight: '800' },
  expenseDate: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  expenseNotes: { fontSize: 12, color: '#334155', marginTop: 2 },
  expenseItemRight: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  deleteBtn: { padding: 4 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalCloseBtn: { padding: 4 },
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
  modalItemActive: { backgroundColor: '#F3E8FF' },
  modalItemText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalItemTextActive: { color: '#7C3AED' },
});
