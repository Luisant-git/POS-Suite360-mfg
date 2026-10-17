import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import {
  Plus, Trash2, Printer, X, ShoppingCart, User, ChevronRight,
  Search, CheckCircle, RefreshCw, MinusCircle, PlusCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product { id: number; name: string; code: string; sellingRate: number; currentStock: number; purchaseRate: number; }
interface Customer { id: number; name: string; phone?: string; }
interface PaymentMode { id: number; name: string; }
interface CartItem { productId: number; name: string; code: string; quantity: number; rate: number; discPercent: number; discAmt: number; total: number; stock: number; }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesEntryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search & filter
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState<number | null>(null);

  // Modals
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [editItemVisible, setEditItemVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editDiscPct, setEditDiscPct] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, cRes, pmRes] = await Promise.all([
        api.get('/products'),
        api.get('/customers'),
        api.get('/payment-modes'),
      ]);
      setProducts(pRes.data.data || pRes.data);
      setCustomers(cRes.data.data || cRes.data);
      const modes: PaymentMode[] = pmRes.data;
      setPaymentModes(modes);
      if (modes.length > 0) {
        const cash = modes.find(m => m.name.toLowerCase() === 'cash');
        setSelectedPaymentModeId(cash?.id ?? modes[0].id);
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
  const calcTotal = (qty: number, rate: number, discPct: number) => {
    const gross = qty * rate;
    const disc = (gross * discPct) / 100;
    return parseFloat((gross - disc).toFixed(2));
  };

  const addToCart = (product: Product) => {
    const rate = Number(product.sellingRate) || 0;
    setCart(prev => {
      const idx = prev.findIndex(c => c.productId === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        const item = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        item.total = calcTotal(item.quantity, item.rate, item.discPercent);
        updated[idx] = item;
        return updated;
      }
      return [...prev, {
        productId: product.id, name: product.name, code: product.code,
        quantity: 1, rate, discPercent: 0, discAmt: 0,
        total: rate, stock: Number(product.currentStock),
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
      updated[idx] = { ...item, quantity: newQty, total: calcTotal(newQty, item.rate, item.discPercent) };
      return updated;
    });
  };

  const deleteFromCart = (productId: number) => setCart(prev => prev.filter(c => c.productId !== productId));

  const openEdit = (item: CartItem) => {
    setEditingItem(item);
    setEditQty(String(item.quantity));
    setEditRate(String(item.rate));
    setEditDiscPct(String(item.discPercent));
    setEditItemVisible(true);
  };

  const saveEdit = () => {
    if (!editingItem) return;
    const qty = parseFloat(editQty) || 1;
    const rate = parseFloat(editRate) || 0;
    const discPct = parseFloat(editDiscPct) || 0;
    const discAmt = parseFloat(((qty * rate * discPct) / 100).toFixed(2));
    const total = calcTotal(qty, rate, discPct);
    setCart(prev => prev.map(c => c.productId === editingItem.productId
      ? { ...c, quantity: qty, rate, discPercent: discPct, discAmt, total }
      : c
    ));
    setEditItemVisible(false);
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const netAmount = parseFloat(cart.reduce((s, i) => s + i.total, 0).toFixed(2));
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (cart.length === 0) { Alert.alert('Empty Cart', 'Add at least one product.'); return; }
    if (!selectedPaymentModeId) { Alert.alert('Missing', 'Select a payment mode.'); return; }
    const isCash = paymentModes.find(p => p.id === selectedPaymentModeId)?.name?.toLowerCase() === 'cash';
    if (!isCash && !selectedCustomerId) { Alert.alert('Missing', 'Select a customer for credit sale.'); return; }

    setSaving(true);
    try {
      await api.post('/sales', {
        date: new Date().toISOString().split('T')[0],
        customerId: selectedCustomerId || 0,
        paymentModeId: selectedPaymentModeId,
        subtotal: netAmount,
        discount: cart.reduce((s, i) => s + i.discAmt, 0),
        tax: 0,
        grandTotal: netAmount,
        items: cart.map(c => ({
          productId: c.productId,
          quantity: c.quantity,
          rate: c.rate,
          discountPercent: c.discPercent,
          discount: c.discAmt,
          tax: 0,
          amount: c.total,
        })),
      });
      Alert.alert('Success ✓', 'Sale saved successfully!', [{ text: 'New Sale', onPress: () => { setCart([]); setSelectedCustomerId(null); setCheckoutVisible(false); } }]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save sale.');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(productSearch.toLowerCase())
  );
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  );
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E3A8A" />
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
          <Text style={styles.cartItemMeta}>{item.code}  ·  Rate: ₹{item.rate}
            {item.discPercent > 0 ? `  ·  Disc: ${item.discPercent}%` : ''}
          </Text>
        </View>
        <View style={styles.cartRowRight}>
          <Text style={styles.cartItemTotal}>₹{item.total.toFixed(2)}</Text>
          <Text style={styles.cartItemEdit}>tap to edit</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.cartRowControls}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => removeOneFromCart(item.productId)}>
          <MinusCircle color="#EF4444" size={22} />
        </TouchableOpacity>
        <Text style={styles.qtyVal}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart({ id: item.productId, name: item.name, code: item.code, sellingRate: item.rate, currentStock: item.stock, purchaseRate: 0 })}>
          <PlusCircle color="#10B981" size={22} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteFromCart(item.productId)}>
          <Trash2 color="#EF4444" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Checkout Panel ────────────────────────────────────────────────────────
  const CheckoutPanel = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Checkout</Text>
        <TouchableOpacity onPress={() => setCheckoutVisible(false)} style={styles.modalClose}>
          <X color="#6B7280" size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

        {/* Cart Items */}
        <Text style={styles.sectionLabel}>Items ({cart.length})</Text>
        {cart.map(item => <CartItemRow key={item.productId} item={item} />)}

        {/* Customer */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Customer</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setCustomerPickerVisible(true)}>
          <View style={styles.pickerBtnLeft}>
            <User color="#4B5563" size={16} />
            <Text style={styles.pickerBtnText} numberOfLines={1}>
              {selectedCustomer ? selectedCustomer.name : 'Walk-in (Cash)'}
            </Text>
          </View>
          <ChevronRight color="#9CA3AF" size={16} />
        </TouchableOpacity>

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

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Items</Text>
            <Text style={styles.totalRowVal}>{totalItems}</Text>
          </View>
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
          {saving ? <ActivityIndicator color="#fff" /> : <><CheckCircle color="#fff" size={20} /><Text style={styles.saveBtnText}>CONFIRM SALE</Text></>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Sales Entry</Text>
            <Text style={styles.headerSub}>Tap a product to add to cart</Text>
          </View>
          {cart.length > 0 && (
            <TouchableOpacity style={styles.headerClearBtn} onPress={() => Alert.alert('Clear Cart?', 'Remove all items?', [{ text: 'Cancel' }, { text: 'Clear', onPress: () => setCart([]), style: 'destructive' }])}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#1E3A8A']} />}
        ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No products found</Text></View>}
        renderItem={({ item }) => {
          const inCart = cart.find(c => c.productId === item.id);
          const outOfStock = Number(item.currentStock) <= 0;
          return (
            <TouchableOpacity
              style={[styles.productCard, outOfStock && styles.productCardOOS]}
              onPress={() => !outOfStock && addToCart(item)}
              activeOpacity={0.75}
            >
              <View style={styles.productCardLeft}>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productCode}>{item.code}</Text>
                <View style={styles.stockRow}>
                  <View style={[styles.stockBadge, outOfStock ? styles.stockBadgeOOS : styles.stockBadgeOK]}>
                    <Text style={styles.stockBadgeText}>Stock: {item.currentStock}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.productCardRight}>
                <Text style={styles.productRate}>₹{Number(item.sellingRate).toFixed(2)}</Text>
                {inCart ? (
                  <View style={styles.inCartBadge}>
                    <ShoppingCart color="#1E3A8A" size={13} />
                    <Text style={styles.inCartText}>{inCart.quantity}</Text>
                  </View>
                ) : (
                  <View style={[styles.addBtn, outOfStock && styles.addBtnOOS]}>
                    <Plus color="#fff" size={14} />
                    <Text style={styles.addBtnText}>{outOfStock ? 'OOS' : 'Add'}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Cart Bar */}
      {cart.length > 0 && (
        <TouchableOpacity style={styles.floatingBar} onPress={() => setCheckoutVisible(true)} activeOpacity={0.92}>
          <View style={styles.floatingLeft}>
            <View style={styles.floatingBadgeWrap}>
              <ShoppingCart color="#1E3A8A" size={20} />
              <View style={styles.floatingBadge}>
                <Text style={styles.floatingBadgeText}>{totalItems}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.floatingAmount}>₹{netAmount.toFixed(2)}</Text>
              <Text style={styles.floatingAmountSub}>{cart.length} item{cart.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={styles.floatingRight}>
            <Text style={styles.floatingCheckoutText}>Checkout</Text>
            <ChevronRight color="#fff" size={20} />
          </View>
        </TouchableOpacity>
      )}

      {/* Checkout Modal */}
      <Modal visible={checkoutVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <CheckoutPanel />
          </View>
        </View>
      </Modal>

      {/* Customer Picker Modal */}
      <Modal visible={customerPickerVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { height: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setCustomerPickerVisible(false)} style={styles.modalClose}>
                <X color="#6B7280" size={22} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Search color="#9CA3AF" size={16} />
              <TextInput style={styles.searchInput} placeholder="Search name or phone..." placeholderTextColor="#9CA3AF" value={customerSearch} onChangeText={setCustomerSearch} autoFocus />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={[styles.customerRow, !selectedCustomerId && styles.customerRowActive]} onPress={() => { setSelectedCustomerId(null); setCustomerPickerVisible(false); }}>
                <Text style={[styles.customerRowText, !selectedCustomerId && styles.customerRowTextActive]}>Walk-in (Cash)</Text>
              </TouchableOpacity>
              {filteredCustomers.map(c => (
                <TouchableOpacity key={c.id} style={[styles.customerRow, selectedCustomerId === c.id && styles.customerRowActive]} onPress={() => { setSelectedCustomerId(c.id); setCustomerPickerVisible(false); }}>
                  <Text style={[styles.customerRowText, selectedCustomerId === c.id && styles.customerRowTextActive]}>{c.name}</Text>
                  {c.phone ? <Text style={styles.customerPhone}>{c.phone}</Text> : null}
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
              <View style={{ padding: 20, gap: 16 }}>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Quantity</Text>
                  <TextInput style={styles.editInput} value={editQty} onChangeText={setEditQty} keyboardType="numeric" selectTextOnFocus />
                </View>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Rate (₹)</Text>
                  <TextInput style={styles.editInput} value={editRate} onChangeText={setEditRate} keyboardType="decimal-pad" selectTextOnFocus />
                </View>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Discount (%)</Text>
                  <TextInput style={styles.editInput} value={editDiscPct} onChangeText={setEditDiscPct} keyboardType="decimal-pad" selectTextOnFocus />
                </View>
                <View style={styles.editPreview}>
                  <Text style={styles.editPreviewLabel}>Total</Text>
                  <Text style={styles.editPreviewVal}>
                    ₹{calcTotal(parseFloat(editQty) || 0, parseFloat(editRate) || 0, parseFloat(editDiscPct) || 0).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                  <CheckCircle color="#fff" size={18} />
                  <Text style={styles.saveBtnText}>Update Item</Text>
                </TouchableOpacity>
              </View>
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

  // Header
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#93C5FD', marginTop: 2 },
  headerClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  headerClearText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },

  // Product card
  productCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  productCardOOS: { opacity: 0.5 },
  productCardLeft: { flex: 1, marginRight: 12 },
  productName: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  productCode: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },
  stockRow: { flexDirection: 'row' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  stockBadgeOK: { backgroundColor: '#DCFCE7' },
  stockBadgeOOS: { backgroundColor: '#FEE2E2' },
  stockBadgeText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  productCardRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  productRate: { fontSize: 16, fontWeight: '800', color: '#10B981' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E3A8A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addBtnOOS: { backgroundColor: '#9CA3AF' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inCartBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  inCartText: { fontSize: 13, fontWeight: '800', color: '#1E3A8A' },

  // Floating cart bar
  floatingBar: { position: 'absolute', bottom: 16, left: 12, right: 12, backgroundColor: '#1E3A8A', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 },
  floatingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  floatingBadgeWrap: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, position: 'relative' },
  floatingBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1E3A8A' },
  floatingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  floatingAmount: { color: '#fff', fontSize: 18, fontWeight: '800' },
  floatingAmountSub: { color: '#93C5FD', fontSize: 11 },
  floatingRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  floatingCheckoutText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', height: '88%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1F2937', flex: 1, marginRight: 8 },
  modalClose: { padding: 4 },

  // Cart rows
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  cartRow: { backgroundColor: '#F8FAFC', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  cartRowMain: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  cartRowLeft: { flex: 1, marginRight: 12 },
  cartItemName: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  cartItemMeta: { fontSize: 11, color: '#64748B' },
  cartRowRight: { alignItems: 'flex-end' },
  cartItemTotal: { fontSize: 15, fontWeight: '800', color: '#059669' },
  cartItemEdit: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  cartRowControls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  qtyBtn: { padding: 2 },
  qtyVal: { fontSize: 16, fontWeight: '800', color: '#1F2937', minWidth: 28, textAlign: 'center' },
  deleteBtn: { marginLeft: 'auto' as any, padding: 4 },

  // Customer picker
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerBtnText: { fontSize: 14, color: '#1F2937', fontWeight: '600' },
  customerRow: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  customerRowActive: { backgroundColor: '#EFF6FF' },
  customerRowText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  customerRowTextActive: { color: '#1E3A8A', fontWeight: '800' },
  customerPhone: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Payment mode
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', minWidth: 80 },
  paymentChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  paymentChipText: { color: '#4B5563', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  paymentChipTextActive: { color: '#fff' },

  // Totals
  totalsBox: { marginTop: 20, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRowNet: { borderTopWidth: 1, borderColor: '#E2E8F0', marginTop: 8, paddingTop: 12 },
  totalRowLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  totalRowVal: { fontSize: 13, color: '#1F2937', fontWeight: '700' },
  netLabel: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  netValue: { fontSize: 24, fontWeight: '900', color: '#10B981' },

  // Save button
  checkoutFooterBar: { borderTopWidth: 1, borderColor: '#E2E8F0', padding: 16, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnDisabled: { backgroundColor: '#6EE7B7' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Edit item modal
  editField: { gap: 6 },
  editLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  editInput: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'right', backgroundColor: '#F9FAFB' },
  editPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  editPreviewLabel: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  editPreviewVal: { fontSize: 22, fontWeight: '900', color: '#059669' },
});
