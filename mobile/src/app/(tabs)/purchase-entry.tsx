import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  Plus, Trash2, X, User, ChevronRight, Search,
  CheckCircle, RefreshCw, MinusCircle, PlusCircle, Truck,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product { id: number; name: string; code: string; purchaseRate: number; currentStock: number; sellingRate: number; }
interface Supplier { id: number; name: string; phone?: string; }
interface PaymentMode { id: number; name: string; }
interface CartItem {
  productId: number; name: string; code: string;
  quantity: number; pRate: number; sRate: number; mrp: number;
  discPercent: number; discAmt: number; total: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PurchaseEntryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search
  const [productSearch, setProductSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  // Selection
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState<number | null>(null);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [transportCharge, setTransportCharge] = useState('');
  const [wages, setWages] = useState('');

  // Modals
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [supplierPickerVisible, setSupplierPickerVisible] = useState(false);
  const [editItemVisible, setEditItemVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPRate, setEditPRate] = useState('');
  const [editSRate, setEditSRate] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editDiscPct, setEditDiscPct] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, sRes, pmRes] = await Promise.all([
        api.get('/products'),
        api.get('/suppliers'),
        api.get('/payment-modes'),
      ]);
      setProducts(pRes.data.data || pRes.data);
      setSuppliers(sRes.data.data || sRes.data);
      const modes: PaymentMode[] = pmRes.data;
      setPaymentModes(modes);
      if (modes.length > 0) {
        const credit = modes.find(m => m.name.toLowerCase() === 'credit');
        setSelectedPaymentModeId(credit?.id ?? modes[0].id);
      }
    } catch {
      Alert.alert('Error', 'Failed to load data. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const calcTotal = (qty: number, pRate: number, discPct: number) => {
    const gross = qty * pRate;
    const disc = (gross * discPct) / 100;
    return parseFloat((gross - disc).toFixed(2));
  };

  const addToCart = (product: Product) => {
    const pRate = Number(product.purchaseRate) || 0;
    const sRate = Number(product.sellingRate) || 0;
    setCart(prev => {
      const idx = prev.findIndex(c => c.productId === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        const item = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        item.total = calcTotal(item.quantity, item.pRate, item.discPercent);
        updated[idx] = item;
        return updated;
      }
      return [...prev, {
        productId: product.id, name: product.name, code: product.code,
        quantity: 1, pRate, sRate, mrp: sRate,
        discPercent: 0, discAmt: 0, total: pRate,
      }];
    });
  };

  const removeOneFromCart = (productId: number) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.productId === productId);
      if (idx < 0) return prev;
      const item = prev[idx];
      if (item.quantity <= 1) return prev.filter(c => c.productId !== productId);
      const updated = [...prev];
      const newQty = item.quantity - 1;
      updated[idx] = { ...item, quantity: newQty, total: calcTotal(newQty, item.pRate, item.discPercent) };
      return updated;
    });
  };

  const deleteFromCart = (productId: number) => setCart(prev => prev.filter(c => c.productId !== productId));

  const openEdit = (item: CartItem) => {
    setEditingItem(item);
    setEditQty(String(item.quantity));
    setEditPRate(String(item.pRate));
    setEditSRate(String(item.sRate));
    setEditMrp(String(item.mrp));
    setEditDiscPct(String(item.discPercent));
    setEditItemVisible(true);
  };

  const saveEdit = () => {
    if (!editingItem) return;
    const qty = parseFloat(editQty) || 1;
    const pRate = parseFloat(editPRate) || 0;
    const sRate = parseFloat(editSRate) || 0;
    const mrp = parseFloat(editMrp) || 0;
    const discPct = parseFloat(editDiscPct) || 0;
    const discAmt = parseFloat(((qty * pRate * discPct) / 100).toFixed(2));
    const total = calcTotal(qty, pRate, discPct);
    setCart(prev => prev.map(c => c.productId === editingItem.productId
      ? { ...c, quantity: qty, pRate, sRate, mrp, discPercent: discPct, discAmt, total }
      : c
    ));
    setEditItemVisible(false);
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subTotal = cart.reduce((s, i) => s + i.total, 0);
  const transport = parseFloat(transportCharge) || 0;
  const wagesAmt = parseFloat(wages) || 0;
  const netAmount = parseFloat((subTotal + transport + wagesAmt).toFixed(2));
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (cart.length === 0) { Alert.alert('Empty', 'Add at least one product.'); return; }
    if (!selectedSupplierId) { Alert.alert('Missing', 'Select a supplier.'); return; }
    if (!selectedPaymentModeId) { Alert.alert('Missing', 'Select a payment mode.'); return; }

    setSaving(true);
    try {
      await api.post('/purchases', {
        date: new Date().toISOString().split('T')[0],
        supplierId: selectedSupplierId,
        paymentModeId: selectedPaymentModeId,
        supplierInvoiceNo: supplierInvoiceNo || undefined,
        transportCharge: transport,
        wages: wagesAmt,
        subtotal: subTotal,
        discount: cart.reduce((s, i) => s + i.discAmt, 0),
        grandTotal: netAmount,
        items: cart.map(c => ({
          productId: c.productId,
          quantity: c.quantity,
          purchaseRate: c.pRate,
          sellingRate: c.sRate,
          mrp: c.mrp,
          discountPercent: c.discPercent,
          discount: c.discAmt,
          amount: c.total,
        })),
      });
      Alert.alert('Success ✓', 'Purchase saved successfully!', [{
        text: 'New Purchase', onPress: () => {
          setCart([]); setSelectedSupplierId(null);
          setSupplierInvoiceNo(''); setTransportCharge(''); setWages('');
          setCheckoutVisible(false);
        }
      }]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered ───────────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(productSearch.toLowerCase())
  );
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.phone || '').includes(supplierSearch)
  );
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0B355B" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  // ─── Cart Item Row ─────────────────────────────────────────────────────────
  const CartItemRow = ({ item }: { item: CartItem }) => (
    <View style={styles.cartRow}>
      <TouchableOpacity style={styles.cartRowMain} onPress={() => openEdit(item)} activeOpacity={0.7}>
        <View style={styles.cartRowLeft}>
          <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cartItemMeta}>
            {item.code}  ·  P.Rate: ₹{item.pRate}  ·  S.Rate: ₹{item.sRate}
            {item.discPercent > 0 ? `  ·  Disc: ${item.discPercent}%` : ''}
          </Text>
        </View>
        <View style={styles.cartRowRight}>
          <Text style={styles.cartItemTotal}>₹{item.total.toFixed(2)}</Text>
          <Text style={styles.cartItemEdit}>tap to edit</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.cartRowControls}>
        <TouchableOpacity onPress={() => removeOneFromCart(item.productId)}>
          <MinusCircle color="#EF4444" size={22} />
        </TouchableOpacity>
        <Text style={styles.qtyVal}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => addToCart({ id: item.productId, name: item.name, code: item.code, purchaseRate: item.pRate, sellingRate: item.sRate, currentStock: 0 })}>
          <PlusCircle color="#059669" size={22} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteFromCart(item.productId)}>
          <Trash2 color="#EF4444" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Confirm Panel ─────────────────────────────────────────────────────────
  const ConfirmPanel = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Confirm Purchase</Text>
        <TouchableOpacity onPress={() => setCheckoutVisible(false)} style={styles.modalClose}>
          <X color="#6B7280" size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

        {/* Cart Items */}
        <Text style={styles.sectionLabel}>Items ({cart.length})</Text>
        {cart.map(item => <CartItemRow key={item.productId} item={item} />)}

        {/* Supplier */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Supplier *</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setSupplierPickerVisible(true)}>
          <View style={styles.pickerBtnLeft}>
            <Truck color="#4B5563" size={16} />
            <Text style={[styles.pickerBtnText, !selectedSupplier && { color: '#EF4444' }]} numberOfLines={1}>
              {selectedSupplier ? selectedSupplier.name : 'Select Supplier (Required)'}
            </Text>
          </View>
          <ChevronRight color="#9CA3AF" size={16} />
        </TouchableOpacity>

        {/* Supplier Invoice No */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Supplier Invoice No</Text>
        <TextInput
          style={styles.textField}
          placeholder="e.g. INV-2024-001 (optional)"
          placeholderTextColor="#9CA3AF"
          value={supplierInvoiceNo}
          onChangeText={setSupplierInvoiceNo}
        />

        {/* Payment Mode */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Payment Mode</Text>
        <View style={styles.paymentGrid}>
          {paymentModes.map(pm => (
            <TouchableOpacity
              key={pm.id}
              style={[styles.paymentChip, selectedPaymentModeId === pm.id && styles.paymentChipActive]}
              onPress={() => setSelectedPaymentModeId(pm.id)}
            >
              <Text style={[styles.paymentChipText, selectedPaymentModeId === pm.id && styles.paymentChipTextActive]}>
                {pm.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Extra charges */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Additional Charges</Text>
        <View style={styles.chargesRow}>
          <View style={styles.chargeField}>
            <Text style={styles.chargeLabel}>Transport</Text>
            <TextInput style={styles.chargeInput} placeholder="0.00" placeholderTextColor="#9CA3AF" value={transportCharge} onChangeText={setTransportCharge} keyboardType="decimal-pad" />
          </View>
          <View style={styles.chargeField}>
            <Text style={styles.chargeLabel}>Wages</Text>
            <TextInput style={styles.chargeInput} placeholder="0.00" placeholderTextColor="#9CA3AF" value={wages} onChangeText={setWages} keyboardType="decimal-pad" />
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Total Qty</Text>
            <Text style={styles.totalRowVal}>{totalQty}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Sub Total</Text>
            <Text style={styles.totalRowVal}>₹{subTotal.toFixed(2)}</Text>
          </View>
          {transport > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Transport</Text>
              <Text style={styles.totalRowVal}>₹{transport.toFixed(2)}</Text>
            </View>
          )}
          {wagesAmt > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Wages</Text>
              <Text style={styles.totalRowVal}>₹{wagesAmt.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowNet]}>
            <Text style={styles.netLabel}>NET AMOUNT</Text>
            <Text style={styles.netValue}>₹{netAmount.toFixed(2)}</Text>
          </View>
        </View>

      </ScrollView>

      {/* Save Button */}
      <View style={styles.checkoutFooterBar}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <><CheckCircle color="#fff" size={20} /><Text style={styles.saveBtnText}>SAVE PURCHASE</Text></>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <LinearGradient colors={['#0B355B', '#1E5F8A']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Purchase Entry</Text>
            <Text style={styles.headerSub}>Tap a product to add to order</Text>
          </View>
          {cart.length > 0 && (
            <TouchableOpacity style={styles.headerClearBtn} onPress={() => Alert.alert('Clear?', 'Remove all items?', [{ text: 'Cancel' }, { text: 'Clear', onPress: () => setCart([]), style: 'destructive' }])}>
              <RefreshCw color="#FCA5A5" size={16} />
              <Text style={styles.headerClearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchBar}>
        <Search color="#9CA3AF" size={16} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search product name or code..."
          placeholderTextColor="#9CA3AF"
          value={productSearch}
          onChangeText={setProductSearch}
          clearButtonMode="while-editing"
        />
        {productSearch.length > 0 && (
          <TouchableOpacity onPress={() => setProductSearch('')}>
            <X color="#9CA3AF" size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={item => String(item.id)}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: cart.length > 0 ? 100 : 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#0B355B']} />}
        ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No products found</Text></View>}
        renderItem={({ item }) => {
          const inCart = cart.find(c => c.productId === item.id);
          return (
            <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)} activeOpacity={0.75}>
              <View style={styles.productCardLeft}>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productCode}>{item.code}</Text>
                <View style={styles.ratesRow}>
                  <View style={styles.ratePill}>
                    <Text style={styles.ratePillLabel}>P</Text>
                    <Text style={styles.ratePillVal}>₹{Number(item.purchaseRate).toFixed(2)}</Text>
                  </View>
                  <View style={[styles.ratePill, styles.ratePillS]}>
                    <Text style={[styles.ratePillLabel, styles.ratePillLabelS]}>S</Text>
                    <Text style={[styles.ratePillVal, styles.ratePillValS]}>₹{Number(item.sellingRate).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.productCardRight}>
                <View style={styles.stockBadge}>
                  <Text style={styles.stockBadgeText}>Stk: {item.currentStock}</Text>
                </View>
                {inCart ? (
                  <View style={styles.inCartBadge}>
                    <Truck color="#0B355B" size={13} />
                    <Text style={styles.inCartText}>{inCart.quantity}</Text>
                  </View>
                ) : (
                  <View style={styles.addBtn}>
                    <Plus color="#fff" size={14} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Bar */}
      {cart.length > 0 && (
        <TouchableOpacity style={styles.floatingBar} onPress={() => setCheckoutVisible(true)} activeOpacity={0.92}>
          <View style={styles.floatingLeft}>
            <View style={styles.floatingBadgeWrap}>
              <Truck color="#0B355B" size={20} />
              <View style={styles.floatingBadge}>
                <Text style={styles.floatingBadgeText}>{cart.length}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.floatingAmount}>₹{netAmount.toFixed(2)}</Text>
              <Text style={styles.floatingAmountSub}>{totalQty} units · {cart.length} item{cart.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={styles.floatingRight}>
            <Text style={styles.floatingCheckoutText}>Review</Text>
            <ChevronRight color="#fff" size={20} />
          </View>
        </TouchableOpacity>
      )}

      {/* Confirm Modal */}
      <Modal visible={checkoutVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ConfirmPanel />
          </View>
        </View>
      </Modal>

      {/* Supplier Picker */}
      <Modal visible={supplierPickerVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { height: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Supplier</Text>
              <TouchableOpacity onPress={() => setSupplierPickerVisible(false)} style={styles.modalClose}>
                <X color="#6B7280" size={22} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Search color="#9CA3AF" size={16} />
              <TextInput style={styles.searchInput} placeholder="Search supplier..." placeholderTextColor="#9CA3AF" value={supplierSearch} onChangeText={setSupplierSearch} autoFocus />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredSuppliers.length === 0 && (
                <View style={styles.center}><Text style={styles.emptyText}>No suppliers found</Text></View>
              )}
              {filteredSuppliers.map(s => (
                <TouchableOpacity key={s.id} style={[styles.customerRow, selectedSupplierId === s.id && styles.customerRowActive]} onPress={() => { setSelectedSupplierId(s.id); setSupplierPickerVisible(false); }}>
                  <Text style={[styles.customerRowText, selectedSupplierId === s.id && styles.customerRowTextActive]}>{s.name}</Text>
                  {s.phone ? <Text style={styles.customerPhone}>{s.phone}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={editItemVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { height: 'auto', paddingBottom: 32 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>{editingItem?.name}</Text>
                <TouchableOpacity onPress={() => setEditItemVisible(false)} style={styles.modalClose}><X color="#6B7280" size={22} /></TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
                <View style={styles.editGrid}>
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>Quantity</Text>
                    <TextInput style={styles.editInput} value={editQty} onChangeText={setEditQty} keyboardType="numeric" selectTextOnFocus />
                  </View>
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>Purchase Rate</Text>
                    <TextInput style={styles.editInput} value={editPRate} onChangeText={setEditPRate} keyboardType="decimal-pad" selectTextOnFocus />
                  </View>
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>Selling Rate</Text>
                    <TextInput style={styles.editInput} value={editSRate} onChangeText={setEditSRate} keyboardType="decimal-pad" selectTextOnFocus />
                  </View>
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>MRP</Text>
                    <TextInput style={styles.editInput} value={editMrp} onChangeText={setEditMrp} keyboardType="decimal-pad" selectTextOnFocus />
                  </View>
                  <View style={[styles.editField, { flex: undefined, width: '100%' }]}>
                    <Text style={styles.editLabel}>Discount (%)</Text>
                    <TextInput style={styles.editInput} value={editDiscPct} onChangeText={setEditDiscPct} keyboardType="decimal-pad" selectTextOnFocus />
                  </View>
                </View>
                <View style={styles.editPreview}>
                  <Text style={styles.editPreviewLabel}>Total</Text>
                  <Text style={styles.editPreviewVal}>
                    ₹{calcTotal(parseFloat(editQty) || 0, parseFloat(editPRate) || 0, parseFloat(editDiscPct) || 0).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                  <CheckCircle color="#fff" size={18} />
                  <Text style={styles.saveBtnText}>Update Item</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  emptyText: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#93C5FD', marginTop: 2 },
  headerClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  headerClearText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },

  productCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  productCardLeft: { flex: 1, marginRight: 12 },
  productName: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  productCode: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },
  ratesRow: { flexDirection: 'row', gap: 6 },
  ratePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, gap: 3 },
  ratePillLabel: { fontSize: 10, fontWeight: '800', color: '#D97706' },
  ratePillVal: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  ratePillS: { backgroundColor: '#F0FDF4' },
  ratePillLabelS: { color: '#059669' },
  ratePillValS: { color: '#065F46' },
  productCardRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  stockBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  stockBadgeText: { fontSize: 11, fontWeight: '700', color: '#1E3A8A' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0B355B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inCartBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  inCartText: { fontSize: 13, fontWeight: '800', color: '#0B355B' },

  floatingBar: { position: 'absolute', bottom: 16, left: 12, right: 12, backgroundColor: '#0B355B', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#0B355B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 },
  floatingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  floatingBadgeWrap: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, position: 'relative' },
  floatingBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0B355B' },
  floatingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  floatingAmount: { color: '#fff', fontSize: 18, fontWeight: '800' },
  floatingAmountSub: { color: '#93C5FD', fontSize: 11 },
  floatingRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  floatingCheckoutText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', height: '88%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1F2937', flex: 1, marginRight: 8 },
  modalClose: { padding: 4 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  cartRow: { backgroundColor: '#F8FAFC', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  cartRowMain: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  cartRowLeft: { flex: 1, marginRight: 12 },
  cartItemName: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  cartItemMeta: { fontSize: 11, color: '#64748B' },
  cartRowRight: { alignItems: 'flex-end' },
  cartItemTotal: { fontSize: 15, fontWeight: '800', color: '#0B355B' },
  cartItemEdit: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  cartRowControls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  qtyVal: { fontSize: 16, fontWeight: '800', color: '#1F2937', minWidth: 28, textAlign: 'center' },
  deleteBtn: { marginLeft: 'auto' as any, padding: 4 },

  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerBtnText: { fontSize: 14, color: '#1F2937', fontWeight: '600' },

  textField: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1F2937' },

  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', minWidth: 80 },
  paymentChipActive: { backgroundColor: '#0B355B', borderColor: '#0B355B' },
  paymentChipText: { color: '#4B5563', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  paymentChipTextActive: { color: '#fff' },

  chargesRow: { flexDirection: 'row', gap: 12 },
  chargeField: { flex: 1, gap: 6 },
  chargeLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  chargeInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937', textAlign: 'right', fontWeight: '700' },

  totalsBox: { marginTop: 20, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRowNet: { borderTopWidth: 1, borderColor: '#E2E8F0', marginTop: 8, paddingTop: 12 },
  totalRowLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  totalRowVal: { fontSize: 13, color: '#1F2937', fontWeight: '700' },
  netLabel: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  netValue: { fontSize: 24, fontWeight: '900', color: '#0B355B' },

  checkoutFooterBar: { borderTopWidth: 1, borderColor: '#E2E8F0', padding: 16, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#0B355B', borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnDisabled: { backgroundColor: '#7FB3D3' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  customerRow: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  customerRowActive: { backgroundColor: '#EFF6FF' },
  customerRowText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  customerRowTextActive: { color: '#0B355B', fontWeight: '800' },
  customerPhone: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  editField: { flex: 1, minWidth: '45%', gap: 6 },
  editLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  editInput: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontWeight: '700', color: '#1F2937', textAlign: 'right', backgroundColor: '#F9FAFB' },
  editPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  editPreviewLabel: { fontSize: 14, fontWeight: '700', color: '#1E3A8A' },
  editPreviewVal: { fontSize: 22, fontWeight: '900', color: '#0B355B' },
});
