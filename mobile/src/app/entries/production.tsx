import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  Factory, Plus, Trash2, CheckCircle, RefreshCw, X, Calendar,
  Package, ChevronDown, Check, Search, Box,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

export default function ProductionEntryScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [productions, setProductions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [workName, setWorkName] = useState('');
  const [batchCode, setBatchCode] = useState('BCH-0001');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [finishedProductId, setFinishedProductId] = useState<number | null>(null);
  const [outcomeQty, setOutcomeQty] = useState('');

  // Materials intake
  const [intakeList, setIntakeList] = useState<{ rawMaterialId: number; name: string; quantity: string }[]>([]);
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [isMaterialModalVisible, setIsMaterialModalVisible] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, rmRes, prodListRes] = await Promise.all([
        api.get('/products'),
        api.get('/raw-materials'),
        api.get('/production'),
      ]);
      setProducts(prodRes.data.data || prodRes.data || []);
      setRawMaterials(rmRes.data || []);
      const pList = prodListRes.data || [];
      setProductions(pList);

      // Auto generate batch code
      let maxNum = 0;
      pList.forEach((p: any) => {
        if (p.workName) {
          const match = String(p.workName).match(/BCH-(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });
      setBatchCode(`BCH-${String(maxNum + 1).padStart(4, '0')}`);
    } catch (err) {
      console.error('Failed to load production data', err);
      Alert.alert('Error', 'Failed to load production master data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addMaterialIntake = (material: any) => {
    setIntakeList([...intakeList, { rawMaterialId: material.id, name: material.name, quantity: '1' }]);
    setIsMaterialModalVisible(false);
  };

  const removeIntakeItem = (index: number) => {
    setIntakeList(intakeList.filter((_, i) => i !== index));
  };

  const updateIntakeQty = (index: number, qty: string) => {
    const updated = [...intakeList];
    updated[index].quantity = qty;
    setIntakeList(updated);
  };

  const handleSubmit = async () => {
    if (!workName.trim()) {
      Alert.alert('Validation', 'Please enter a work name for this production batch.');
      return;
    }
    if (!finishedProductId) {
      Alert.alert('Validation', 'Please select a finished outcome product.');
      return;
    }
    if (intakeList.length === 0) {
      Alert.alert('Validation', 'Please add at least one intake raw material.');
      return;
    }

    try {
      setSaving(true);
      const finalWorkName = `${batchCode} - ${workName.trim()}`;
      
      const promises = intakeList.map((item, idx) => {
        const isLast = idx === intakeList.length - 1;
        return api.post('/production', {
          date,
          workName: finalWorkName,
          rawMaterialId: Number(item.rawMaterialId),
          intakeQuantity: Number(item.quantity) || 1,
          finishedProductId: Number(finishedProductId),
          outcomeQuantity: isLast ? Number(outcomeQty) || 0 : 0,
        });
      });

      await Promise.all(promises);

      Alert.alert('Success', 'Production entry batch saved successfully!');
      setWorkName('');
      setOutcomeQty('');
      setIntakeList([]);
      fetchData();
    } catch (err: any) {
      console.error('Failed to save production', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to save production batch.');
    } finally {
      setSaving(false);
    }
  };

  const selectedProductObj = products.find((p) => p.id === finishedProductId);
  const filteredMaterials = rawMaterials.filter(
    (m) => !materialSearch || m.name?.toLowerCase().includes(materialSearch.toLowerCase())
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
          <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>Production Entry</Text>
                <Text style={styles.headerSubtitle}>Track intake raw materials & finished product batches</Text>
              </View>
              <View style={styles.headerIconWrap}>
                <Factory size={22} color="#ffffff" />
              </View>
            </View>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>BATCH PRODUCTION DETAILS</Text>

            {/* Batch Code & Work Name */}
            <View style={styles.rowTwo}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Batch Code</Text>
                <View style={[styles.textInputWrap, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={{ fontWeight: '800', color: '#1E3A8A' }}>{batchCode}</Text>
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.inputLabel}>Work Name *</Text>
                <View style={styles.textInputWrap}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Batch Red A"
                    placeholderTextColor="#94A3B8"
                    value={workName}
                    onChangeText={setWorkName}
                  />
                </View>
              </View>
            </View>

            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Production Date</Text>
              <View style={styles.textInputWrap}>
                <Calendar size={15} color="#64748B" />
                <TextInput style={styles.textInput} value={date} onChangeText={setDate} />
              </View>
            </View>

            {/* Finished Product Section */}
            <View style={styles.finishedBox}>
              <Text style={styles.finishedBoxTitle}>FINISHED PRODUCT (OUTCOME)</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setIsProductModalVisible(true)}
              >
                <View style={styles.dropdownValue}>
                  <Package size={16} color="#059669" />
                  <Text style={styles.dropdownText}>
                    {selectedProductObj ? selectedProductObj.name : 'Select Finished Product...'}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>

              <View style={[styles.inputGroup, { marginTop: 10, marginBottom: 0 }]}>
                <Text style={styles.inputLabel}>Total Outcome Quantity</Text>
                <View style={styles.textInputWrap}>
                  <TextInput
                    style={[styles.textInput, { fontSize: 16, fontWeight: '800' }]}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={outcomeQty}
                    onChangeText={setOutcomeQty}
                  />
                </View>
              </View>
            </View>

            {/* Raw Materials Intake */}
            <View style={[styles.itemsHeaderRow, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>Raw Materials Intake ({intakeList.length})</Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => setIsMaterialModalVisible(true)}
              >
                <Plus size={14} color="#ffffff" />
                <Text style={styles.addItemBtnText}>Add Material</Text>
              </TouchableOpacity>
            </View>

            {intakeList.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyAddBox}
                onPress={() => setIsMaterialModalVisible(true)}
              >
                <Plus size={20} color="#2563EB" />
                <Text style={styles.emptyAddBoxText}>Tap to add raw materials used in this batch</Text>
              </TouchableOpacity>
            ) : (
              intakeList.map((item, idx) => (
                <View key={idx} style={styles.intakeRowCard}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.intakeRowName}>{item.name}</Text>
                    <View style={styles.intakeQtyInputWrap}>
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>Intake Qty:</Text>
                      <TextInput
                        style={styles.smallQtyInput}
                        keyboardType="numeric"
                        value={item.quantity}
                        onChangeText={(t) => updateIntakeQty(idx, t)}
                      />
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeIntakeItem(idx)}>
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}

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
                  <Text style={styles.submitBtnText}>SAVE PRODUCTION BATCH</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent Production List */}
          <View style={styles.historySection}>
            <Text style={styles.historyHeading}>Recent Production Batches ({productions.length})</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#1E3A8A" style={{ marginVertical: 20 }} />
            ) : productions.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No production batches recorded.</Text>
              </View>
            ) : (
              productions.slice(0, 15).map((item) => {
                const isCompleted = Number(item.outcomeQuantity) > 0;
                return (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.historyBatch}>{item.workName}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(item.date).toLocaleDateString()} · Intake: {item.rawMaterial?.name} ({item.intakeQuantity})
                      </Text>
                      <Text style={styles.historyOutcome}>
                        Outcome: {item.finishedProduct?.name} ({item.outcomeQuantity || '0'})
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, isCompleted ? styles.statusBadgeCompleted : styles.statusBadgePending]}>
                      <Text style={[styles.statusBadgeText, isCompleted ? styles.statusTextCompleted : styles.statusTextPending]}>
                        {isCompleted ? 'Done' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Finished Product Picker Modal */}
      <Modal visible={isProductModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Outcome Product</Text>
              <TouchableOpacity onPress={() => setIsProductModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {products.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.modalItem, finishedProductId === p.id && styles.modalItemActive]}
                  onPress={() => {
                    setFinishedProductId(p.id);
                    setIsProductModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, finishedProductId === p.id && styles.modalItemTextActive]}>
                    {p.name}
                  </Text>
                  {finishedProductId === p.id && <Check size={18} color="#059669" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Raw Material Picker Modal */}
      <Modal visible={isMaterialModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Raw Material Intake</Text>
              <TouchableOpacity onPress={() => setIsMaterialModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchWrap}>
              <Search size={15} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search raw material..."
                placeholderTextColor="#94A3B8"
                value={materialSearch}
                onChangeText={setMaterialSearch}
              />
            </View>
            <ScrollView style={styles.modalList}>
              {filteredMaterials.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.modalItem}
                  onPress={() => addMaterialIntake(m)}
                >
                  <View>
                    <Text style={styles.modalItemText}>{m.name}</Text>
                    <Text style={styles.modalItemSub}>Current Stock: {m.currentStock || 0}</Text>
                  </View>
                  <Plus size={18} color="#2563EB" />
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
  headerSubtitle: { fontSize: 12, color: '#BFDBFE', marginTop: 2 },
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
  formSectionTitle: { fontSize: 11, fontWeight: '900', color: '#1E3A8A', letterSpacing: 0.8, marginBottom: 14 },

  rowTwo: { flexDirection: 'row', gap: 10 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    height: 44,
  },
  dropdownValue: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dropdownText: { fontSize: 13, fontWeight: '700', color: '#064E3B' },

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

  finishedBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 14,
  },
  finishedBoxTitle: { fontSize: 11, fontWeight: '900', color: '#047857', letterSpacing: 0.5, marginBottom: 8 },

  itemsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
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
    borderColor: '#93C5FD',
    borderRadius: 12,
    paddingVertical: 20,
    backgroundColor: '#EFF6FF',
  },
  emptyAddBoxText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },

  intakeRowCard: {
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
  intakeRowName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  intakeQtyInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  smallQtyInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    width: 60,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E3A8A',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#1E3A8A',
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
  historyBatch: { fontSize: 14, fontWeight: '800', color: '#1E3A8A' },
  historyDate: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  historyOutcome: { fontSize: 11, color: '#047857', fontWeight: '700', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeCompleted: { backgroundColor: '#ECFDF5' },
  statusBadgePending: { backgroundColor: '#FEF3C7' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  statusTextCompleted: { color: '#047857' },
  statusTextPending: { color: '#B45309' },

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
  modalItemTextActive: { color: '#059669' },
  modalItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
});
