import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, Platform, ScrollView, useWindowDimensions, SafeAreaView, TextInput } from 'react-native';
import { Plus, Trash2, Printer, X, Save, ShoppingCart, User, ChevronRight, Search } from 'lucide-react-native';
import api from '../../services/api';

export default function SalesScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, customersRes, paymentRes] = await Promise.all([
        api.get('/products'),
        api.get('/customers'),
        api.get('/payment-modes')
      ]);
      setProducts(productsRes.data.data || productsRes.data);
      setCustomers(customersRes.data.data || customersRes.data);
      setPaymentModes(paymentRes.data);
      if (paymentRes.data && paymentRes.data.length > 0) {
        setSelectedPaymentMode(paymentRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load POS data.');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: any) => {
    const rate = Number(product.sellingRate) || 0;
    const existing = cart.find(c => c.productId === product.id);
    if (existing) {
      setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1, amount: (c.quantity + 1) * c.rate } : c));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, quantity: 1, rate: rate, amount: rate }]);
    }
  };

  const removeFromCart = (productId: number) => {
    const existing = cart.find(c => c.productId === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(c => c.productId === productId ? { ...c, quantity: c.quantity - 1, amount: (c.quantity - 1) * c.rate } : c));
    } else {
      setCart(cart.filter(c => c.productId !== productId));
    }
  };

  const deleteFromCart = (productId: number) => {
    setCart(cart.filter(c => c.productId !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.amount, 0);
  };
  
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    if (!selectedPaymentMode) {
      Alert.alert('Error', 'Please select a payment mode');
      return;
    }
    
    const isCash = paymentModes.find(p => p.id === selectedPaymentMode)?.name?.toLowerCase() === 'cash';
    if (!selectedCustomer && !isCash) {
       Alert.alert('Warning', 'A customer is usually required for non-cash payments.');
    }

    const total = calculateTotal();
    const payload = {
      date: new Date().toISOString(),
      customerId: selectedCustomer ? Number(selectedCustomer) : 0,
      paymentModeId: selectedPaymentMode,
      subtotal: total,
      discount: 0,
      tax: 0,
      grandTotal: total,
      items: cart.map(c => ({
        productId: c.productId,
        quantity: c.quantity,
        rate: c.rate,
        discount: 0,
        tax: 0,
        amount: c.amount,
      }))
    };

    try {
      await api.post('/sales', payload);
      Alert.alert('Success', 'Sale recorded successfully!');
      setCart([]);
      setSelectedCustomer(null);
      setCheckoutModalVisible(false);
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Error', 'Failed to process sale.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1E3A8A" /></View>;
  }

  // Extracted Cart UI so we can use it on the right side for tablets, or in the modal for mobile
  const CartUI = () => (
    <View style={{ flex: 1, backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      {!isLargeScreen && (
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Checkout Order</Text>
          <TouchableOpacity onPress={() => setCheckoutModalVisible(false)}>
            <X color="#6B7280" size={24} />
          </TouchableOpacity>
        </View>
      )}

      {isLargeScreen && (
        <View style={styles.cartHeader}>
          <ShoppingCart color="#1F2937" size={20} style={{marginRight: 8}} />
          <Text style={styles.sectionTitle}>Current Order</Text>
        </View>
      )}
      
      <View style={styles.tableHeader}>
        <Text style={[styles.th, {flex: 2}]}>Item</Text>
        <Text style={[styles.th, {flex: 1, textAlign: 'center'}]}>Qty</Text>
        <Text style={[styles.th, {flex: 1, textAlign: 'right'}]}>Total</Text>
        <Text style={[styles.th, {flex: 0.5, textAlign: 'center'}]}></Text>
      </View>

      <FlatList
        data={cart}
        style={{flex: 1}}
        keyExtractor={(item) => item.productId.toString()}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cartItemDetails}>@ ₹{item.rate}</Text>
            </View>
            
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <TouchableOpacity onPress={() => removeFromCart(item.productId)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity onPress={() => addToCart({ id: item.productId, sellingRate: item.rate })} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.cartItemAmount, {flex: 1, textAlign: 'right'}]}>₹{item.amount}</Text>
            
            <View style={{ flex: 0.5, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => deleteFromCart(item.productId)}>
                <Trash2 color="#EF4444" size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartText}>No items added yet</Text>
          </View>
        )}
      />

      <View style={styles.checkoutFooter}>
        <Text style={styles.label}>Select Customer</Text>
        
        <TouchableOpacity 
          style={styles.customerDropdownBtn}
          onPress={() => setShowCustomerSelect(!showCustomerSelect)}
        >
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <User color="#4B5563" size={16} style={{marginRight: 8}}/>
            <Text style={styles.customerDropdownText}>
              {selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : 'Walk-in (Cash)'}
            </Text>
          </View>
          <ChevronRight color="#4B5563" size={16} style={{ transform: [{ rotate: showCustomerSelect ? '90deg' : '0deg' }] }} />
        </TouchableOpacity>

        {showCustomerSelect && (
          <View style={styles.customerSelectContainer}>
            <View style={styles.customerSearchBox}>
              <Search color="#9CA3AF" size={14} style={{marginRight: 6}} />
              <TextInput
                style={styles.customerSearchInput}
                placeholder="Search customers..."
                value={customerSearch}
                onChangeText={setCustomerSearch}
              />
            </View>
            <ScrollView style={{maxHeight: 150}} nestedScrollEnabled={true}>
              <TouchableOpacity 
                style={[styles.customerListRow, !selectedCustomer && styles.customerListRowSelected]}
                onPress={() => { setSelectedCustomer(null); setShowCustomerSelect(false); }}
              >
                <Text style={[styles.customerListRowText, !selectedCustomer && styles.customerListRowTextSelected]}>Walk-in (Cash)</Text>
              </TouchableOpacity>
              {filteredCustomers.map(customer => (
                <TouchableOpacity 
                  key={customer.id} 
                  style={[styles.customerListRow, selectedCustomer === customer.id && styles.customerListRowSelected]}
                  onPress={() => { setSelectedCustomer(customer.id); setShowCustomerSelect(false); }}
                >
                  <Text style={[styles.customerListRowText, selectedCustomer === customer.id && styles.customerListRowTextSelected]}>
                    {customer.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={[styles.label, {marginTop: 12}]}>Select Payment Mode</Text>
        <View style={styles.paymentModesGrid}>
          {paymentModes.map(mode => (
            <TouchableOpacity 
              key={mode.id} 
              style={[styles.paymentModeBtn, selectedPaymentMode === mode.id && styles.paymentModeSelected]}
              onPress={() => setSelectedPaymentMode(mode.id)}
            >
              <Text style={[styles.paymentModeText, selectedPaymentMode === mode.id && styles.paymentModeTextSelected]}>
                {mode.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Amount Due:</Text>
          <Text style={styles.totalValue}>₹{calculateTotal().toFixed(2)}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.checkoutBtn, cart.length === 0 && styles.checkoutBtnDisabled]} 
          onPress={handleCheckout} 
          disabled={cart.length === 0}
        >
          <Printer color="#fff" size={18} />
          <Text style={styles.checkoutBtnText}>CONFIRM & PRINT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.mainLayout, { flexDirection: isLargeScreen ? 'row' : 'column' }]}>
        
        {/* Products Section */}
        <View style={styles.itemsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Products</Text>
          </View>
          
          <View style={styles.searchContainer}>
            <Search color="#9CA3AF" size={16} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
                <X color="#9CA3AF" size={16} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={!isLargeScreen && cart.length > 0 ? { paddingBottom: 80 } : { paddingBottom: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.productListRow} onPress={() => addToCart(item)}>
                <View style={styles.productRowInfo}>
                  <Text style={styles.productRowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productRowStock}>Stock: {item.currentStock}</Text>
                </View>
                <View style={styles.productRowAction}>
                  <Text style={styles.productRowPrice}>₹{item.sellingRate}</Text>
                  <View style={styles.addBtnSmall}>
                    <Plus color="#ffffff" size={14} />
                    <Text style={styles.addBtnSmallText}>Add</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Large Screen Cart */}
        {isLargeScreen && (
          <View style={styles.cartSection}>
            <CartUI />
          </View>
        )}
      </View>

      {/* Floating Bottom Cart Bar for Mobile */}
      {!isLargeScreen && cart.length > 0 && !checkoutModalVisible && (
        <TouchableOpacity 
          style={styles.floatingCartBar} 
          onPress={() => setCheckoutModalVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.floatingCartLeft}>
            <View style={styles.cartIconBadge}>
              <ShoppingCart color="#1E3A8A" size={20} />
              <View style={styles.badgeCircle}>
                <Text style={styles.badgeText}>{totalItems}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.floatingCartTotal}>₹{calculateTotal().toFixed(2)}</Text>
              <Text style={styles.floatingCartSubText}>Amount Due</Text>
            </View>
          </View>
          <View style={styles.floatingCartRight}>
            <Text style={styles.floatingCartCheckoutText}>View Cart</Text>
            <ChevronRight color="#fff" size={20} />
          </View>
        </TouchableOpacity>
      )}

      {/* Mobile Checkout Modal */}
      {!isLargeScreen && (
        <Modal visible={checkoutModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.mobileModalContent}>
              <CartUI />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mainLayout: { flex: 1 },
  itemsSection: { flex: 2, padding: 12, backgroundColor: '#F3F4F6' },
  cartSection: { flex: 1, backgroundColor: '#ffffff', borderLeftWidth: 1, borderColor: '#E5E7EB', display: 'flex', flexDirection: 'column' },
  
  sectionHeader: { paddingBottom: 12, borderBottomWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  
  itemCard: { 
    flex: 1, backgroundColor: '#ffffff', padding: 12, margin: 6, borderRadius: 8, 
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  itemIconWrapper: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 20, marginBottom: 8 },
  itemName: { fontSize: 13, fontWeight: '700', textAlign: 'center', color: '#1F2937', marginBottom: 4 },
  itemPrice: { fontSize: 14, color: '#10B981', fontWeight: 'bold', marginBottom: 2 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40, fontSize: 14, color: '#1F2937' },
  clearSearch: { padding: 4 },

  productListRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  productRowInfo: { flex: 1, marginRight: 12 },
  productRowName: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  productRowStock: { fontSize: 11, color: '#6B7280' },
  productRowAction: { alignItems: 'flex-end', justifyContent: 'center' },
  productRowPrice: { fontSize: 14, color: '#10B981', fontWeight: 'bold', marginBottom: 4 },
  addBtnSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, gap: 4 },
  addBtnSmallText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  
  cartHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0F172A' },
  th: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  cartItemName: { fontWeight: 'bold', color: '#1F2937', fontSize: 15 },
  cartItemDetails: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  cartItemAmount: { fontWeight: 'bold', color: '#1F2937', fontSize: 15 },
  
  qtyBtn: { backgroundColor: '#F3F4F6', width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' },
  qtyBtnText: { color: '#1F2937', fontWeight: 'bold', fontSize: 18 },
  qtyText: { marginHorizontal: 12, fontWeight: 'bold', fontSize: 16 },
  
  emptyCart: { padding: 40, alignItems: 'center' },
  emptyCartText: { color: '#9CA3AF', fontStyle: 'italic' },
  
  checkoutFooter: { borderTopWidth: 1, borderColor: '#E5E7EB', padding: 16, backgroundColor: '#F9FAFB' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#10B981' },
  
  checkoutBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  checkoutBtnDisabled: { backgroundColor: '#6EE7B7' },
  checkoutBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  mobileModalContent: { backgroundColor: '#ffffff', height: '85%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  
  label: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 8, alignSelf: 'flex-start' },
  
  customerDropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  customerDropdownText: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  customerSelectContainer: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, marginTop: 4, marginBottom: 8, overflow: 'hidden' },
  customerSearchBox: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F3F4F6', paddingHorizontal: 10, backgroundColor: '#F9FAFB' },
  customerSearchInput: { flex: 1, height: 36, fontSize: 13, color: '#1F2937' },
  customerListRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  customerListRowSelected: { backgroundColor: '#EFF6FF' },
  customerListRowText: { fontSize: 13, color: '#4B5563' },
  customerListRowTextSelected: { color: '#1E3A8A', fontWeight: 'bold' },

  paymentModesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  paymentModeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', minWidth: '31%', flex: 1 },
  paymentModeSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },
  paymentModeText: { color: '#4B5563', fontWeight: '600', textAlign: 'center', fontSize: 12 },
  paymentModeTextSelected: { color: '#ffffff', fontWeight: 'bold' },

  floatingCartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cartIconBadge: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 12, position: 'relative' },
  badgeCircle: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1E3A8A' },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  floatingCartTotal: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  floatingCartSubText: { color: '#93C5FD', fontSize: 12 },
  floatingCartRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  floatingCartCheckoutText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
});
