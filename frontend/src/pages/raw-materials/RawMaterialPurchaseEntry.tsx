import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle, ArrowLeft, PlusCircle, RotateCcw, List, FileText, Plus, Trash2, Package, X, Save, UserPlus, Search, ShoppingCart, User, ChevronRight, Edit3, Truck } from 'lucide-react';
import api from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import ShortcutHelpButton from '../../components/ShortcutHelp';
import { useSettings } from '../../contexts/SettingsContext';
import Select from 'react-select';

const indianStates = [
  "01 - Jammu & Kashmir", "02 - Himachal Pradesh", "03 - Punjab", "04 - Chandigarh",
  "05 - Uttarakhand", "06 - Haryana", "07 - Delhi", "08 - Rajasthan", "09 - Uttar Pradesh",
  "10 - Bihar", "11 - Sikkim", "12 - Arunachal Pradesh", "13 - Nagaland", "14 - Manipur",
  "15 - Mizoram", "16 - Tripura", "17 - Meghalaya", "18 - Assam", "19 - West Bengal",
  "20 - Jharkhand", "21 - Odisha", "22 - Chhattisgarh", "23 - Madhya Pradesh", "24 - Gujarat",
  "25 - Daman & Diu", "26 - Dadra & Nagar Haveli", "27 - Maharashtra", "29 - Karnataka",
  "30 - Goa", "31 - Lakshadweep", "32 - Kerala", "33 - Tamil Nadu", "34 - Puducherry",
  "35 - Andaman & Nicobar Islands", "36 - Telangana", "37 - Andhra Pradesh", "38 - Ladakh"
];

const RawMaterialPurchaseEntry = () => {
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();
  const queryClient = useQueryClient();
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState(0);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paymentModeId, setPaymentModeId] = useState(0);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', address: '', state: '' });

  const [transportCharge, setTransportCharge] = useState<number | ''>('');
  const [wages, setwages] = useState<number | ''>('');
  
  const [items, setItems] = useState<any[]>([{ rawMaterialId: 0, widthMm: '', lengthM: '', sqM: 0, quantity: '', price: '', amount: 0 }]);

  // Mobile-specific state
  const [mobileSearch, setMobileSearch] = useState('');
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState(false);
  const [isMobileSupplierPickerOpen, setIsMobileSupplierPickerOpen] = useState(false);
  const [isMobileEditItemOpen, setIsMobileEditItemOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    widthMm: '',
    lengthM: '',
    sqM: 0,
    quantity: '1',
    price: ''
  });

  const { data: suppliers = [] } = useQuery({ 
    queryKey: ['suppliers'], 
    queryFn: async () => (await api.get('/suppliers')).data 
  });
  
  const { data: rawMaterials = [] } = useQuery({ 
    queryKey: ['rawMaterials'], 
    queryFn: async () => (await api.get('/raw-materials')).data 
  });

  const { data: paymentModes = [] } = useQuery({ 
    queryKey: ['paymentModes'], 
    queryFn: async () => (await api.get('/payment-modes')).data 
  });

  const generateNextCode = () => {
    const rmCodes = rawMaterials
      .filter((m: any) => m.code?.startsWith('RM-'))
      .map((m: any) => parseInt(m.code.replace('RM-', '')))
      .filter((n: number) => !isNaN(n));
    const maxCode = rmCodes.length > 0 ? Math.max(...rmCodes) : 0;
    return `RM-${String(maxCode + 1).padStart(3, '0')}`;
  };

  const handleCreateNewMaterial = async (index: number, name: string) => {
    try {
      const toastId = toast.loading(`Creating ${name}...`);
      const { data } = await api.post('/raw-materials', {
        code: generateNextCode(),
        name,
        unitId: 1, // Using 1 as a fallback default unit ID
        currentStock: 0,
        purchaseRate: 0
      });
      queryClient.invalidateQueries({ queryKey: ['rawMaterials'] });
      updateItem(index, 'rawMaterialId', data.id);
      toast.success(`${name} created successfully!`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to create raw material');
    }
  };

  const focusCell = (row: number, col: number) => {
    if (col === 0) {
      const el = document.querySelector<HTMLElement>(`[data-row-product="${row}"]`);
      if (el) el.focus();
    } else {
      const el = document.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
      if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
    }
  };

  const handleCellKey = (e: React.KeyboardEvent, rowIndex: number, col: number, totalCols: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = rowIndex + 1;
      if (nextRow < items.length) {
        focusCell(nextRow, 0);
      } else {
        addItem();
        setTimeout(() => focusCell(nextRow, 0), 80);
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextCol = col + 1;
      if (nextCol < totalCols) focusCell(rowIndex, nextCol);
      else {
        const nextRow = rowIndex + 1;
        if (nextRow < items.length) focusCell(nextRow, 0);
        else { addItem(); setTimeout(() => focusCell(nextRow, 0), 80); }
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const prevCol = col - 1;
      if (prevCol >= 0) focusCell(rowIndex, prevCol);
      else if (rowIndex > 0) focusCell(rowIndex - 1, totalCols - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); focusCell(rowIndex + 1, col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); if (rowIndex > 0) focusCell(rowIndex - 1, col);
    } else if (e.key === 'Delete' && e.ctrlKey) {
      e.preventDefault();
      if (items.length > 1) {
        removeItem(rowIndex);
        setTimeout(() => focusCell(Math.min(rowIndex, items.length - 2), col), 50);
      }
    }
  };

  const addItem = () => {
    setItems([...items, { rawMaterialId: 0, widthMm: '', lengthM: '', sqM: 0, quantity: '', price: '', amount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setInvoiceNo('');
    setDate(new Date().toISOString().split('T')[0]);
    setSupplierId(0);
    setTransportCharge('');
    setwages('');
    setItems([{ rawMaterialId: 0, widthMm: '', lengthM: '', sqM: 0, quantity: '', price: '', amount: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === 'widthMm' || field === 'lengthM') {
      const width = parseFloat(newItems[index].widthMm || '0');
      const length = parseFloat(newItems[index].lengthM || '0');
      newItems[index].sqM = (width / 1000) * length;
    }

    if (field === 'widthMm' || field === 'lengthM' || field === 'quantity' || field === 'price') {
      const sqM = newItems[index].sqM || 0;
      const qty = parseFloat(newItems[index].quantity || '0');
      const price = parseFloat(newItems[index].price || '0');
      newItems[index].amount = sqM * qty * price;
    }

    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const tax = 0;
  const transportAmt = Number(transportCharge) || 0;
  const wagesAmt = Number(wages) || 0;
  const grandTotal = subtotal + tax + transportAmt + wagesAmt;

  const mutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter(i => i.rawMaterialId > 0);
      const payload = {
        invoiceNo,
        date,
        supplierId: supplierId,
        subtotal,
        tax,
        transportCharge: transportAmt,
        wages: wagesAmt,
        grandTotal,
        paymentModeId: paymentModeId,
        items: validItems.map(item => ({
          rawMaterialId: parseInt(item.rawMaterialId),
          widthMm: parseFloat(item.widthMm || '0'),
          lengthM: parseFloat(item.lengthM || '0'),
          sqM: parseFloat(item.sqM || '0'),
          quantity: parseInt(item.quantity || '0'),
          price: parseFloat(item.price || '0'),
          amount: parseFloat(item.amount || '0')
        }))
      };
      return api.post('/raw-material-purchases', payload);
    },
    onSuccess: () => {
      toast.success('Purchase saved successfully');
      navigate('/raw-materials/purchase-list');
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('Failed to save purchase');
    }
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!invoiceNo || !supplierId || !paymentModeId) {
      toast.error('Please fill required fields (Invoice No, Supplier & Payment Mode)');
      return;
    }
    const validItems = items.filter(i => i.rawMaterialId > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one material.');
      return;
    }
    const invalidItems = validItems.some(i => i.amount <= 0);
    if (invalidItems) {
      toast.error('Please ensure all items have valid amounts.');
      return;
    }
    mutation.mutate();
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'F2') {
        e.preventDefault();
        addItem();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Escape') {
        if (isLeaveModalOpen) {
          setIsLeaveModalOpen(false);
        } else {
          setIsLeaveModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, handleClear, isLeaveModalOpen, navigate]);

  const addSupplierMutation = useMutation({
    mutationFn: (data: any) => api.post('/suppliers', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsSupplierModalOpen(false);
      setNewSupplier({ name: '', phone: '', address: '', state: '' });
      if (res.data && res.data.id) {
        setSupplierId(res.data.id);
      }
    },
    onError: () => {
      toast.error('Failed to add supplier.');
    }
  });

  const handleQuickAddSupplier = () => {
    if (!newSupplier.name) return;
    if (settings?.enableTax && !newSupplier.state) {
      toast.error('State is mandatory when Tax is enabled.');
      return;
    }
    addSupplierMutation.mutate(newSupplier);
  };
  
  // Auto-focus first row product on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-row-product="0"]');
      el?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const selectedSupplier = suppliers.find((s: any) => s.id === Number(supplierId));

  const validItems = items.filter(i => Number(i.rawMaterialId) > 0);

  const handleMobileOpenEdit = (material: any) => {
    setEditingMaterial(material);
    const existingIndex = items.findIndex(i => Number(i.rawMaterialId) === Number(material.id));
    if (existingIndex >= 0) {
      const item = items[existingIndex];
      setEditForm({
        widthMm: item.widthMm ? String(item.widthMm) : '',
        lengthM: item.lengthM ? String(item.lengthM) : '',
        sqM: item.sqM || 0,
        quantity: item.quantity ? String(item.quantity) : '1',
        price: item.price ? String(item.price) : (material.purchaseRate ? String(material.purchaseRate) : '')
      });
    } else {
      setEditForm({
        widthMm: '',
        lengthM: '',
        sqM: 0,
        quantity: '1',
        price: material.purchaseRate ? String(material.purchaseRate) : ''
      });
    }
    setIsMobileEditItemOpen(true);
  };

  const handleMobileSaveEdit = () => {
    if (!editingMaterial) return;
    const width = parseFloat(editForm.widthMm || '0');
    const length = parseFloat(editForm.lengthM || '0');
    const sqM = (width / 1000) * length;
    const qty = parseFloat(editForm.quantity || '0');
    const price = parseFloat(editForm.price || '0');
    const amount = sqM * qty * price;

    const existingIndex = items.findIndex(i => Number(i.rawMaterialId) === Number(editingMaterial.id));
    const newItem = {
      rawMaterialId: editingMaterial.id,
      widthMm: editForm.widthMm,
      lengthM: editForm.lengthM,
      sqM: parseFloat(sqM.toFixed(4)),
      quantity: editForm.quantity,
      price: editForm.price,
      amount: parseFloat(amount.toFixed(2))
    };

    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex] = newItem;
      setItems(newItems);
    } else {
      if (items.length === 1 && items[0].rawMaterialId === 0) {
        setItems([newItem]);
      } else {
        setItems([...items, newItem]);
      }
    }
    setIsMobileEditItemOpen(false);
    toast.success(`${editingMaterial.name} updated!`);
  };

  const handleMobileRemoveItem = (materialId: number) => {
    const updated = items.filter(i => Number(i.rawMaterialId) !== Number(materialId));
    if (updated.length === 0) {
      setItems([{ rawMaterialId: 0, widthMm: '', lengthM: '', sqM: 0, quantity: '', price: '', amount: 0 }]);
    } else {
      setItems(updated);
    }
  };

  const filteredMaterials = rawMaterials.filter((m: any) => {
    if (!mobileSearch) return true;
    const q = mobileSearch.toLowerCase();
    return m.name?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q);
  });

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col font-sans overflow-hidden z-10">
      
      {/* Top Bar - Differentiated color for Manufacturing - Desktop only */}
      <div className="hidden md:flex bg-[#475569] text-white px-2 sm:px-4 py-2 flex-wrap gap-2 justify-between items-center shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-bold text-[14px] uppercase tracking-wider flex items-center gap-2">
            <span className="bg-[#334155] p-1 rounded"><Package size={16} /></span>
            Raw Material Purchase
          </h1>
          <button 
            type="button"
            onClick={() => handleSubmit()}
            className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors shadow-sm"
          >
            <CheckCircle size={16} /> SAVE PURCHASE (F10)
          </button>
        </div>
        <button 
          onClick={() => setIsLeaveModalOpen(true)}
          className="text-white hover:text-white/80 transition-colors flex items-center gap-1.5 font-medium text-[13px]"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      <form className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleSubmit}>
        
        {/* Header Section */}
        <div className="bg-white p-4 sm:p-5 border-b border-[#E5E7EB] shrink-0 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
            
            <div className="w-full lg:max-w-[300px]">
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5 uppercase tracking-wide">Supplier Invoice No *</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="Enter Bill No"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded bg-[#F9FAFB] focus:bg-white text-[13px] outline-none focus:border-[#475569] focus:ring-1 focus:ring-[#475569] transition-all"
              />
            </div>

            <div className="w-full lg:flex-[2]">
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5 uppercase tracking-wide">Select Supplier *</label>
              <div className="flex flex-col gap-1">
                <div className="w-full">
                  <SearchableSelect
                    value={supplierId}
                    onChange={(val) => setSupplierId(Number(val))}
                    options={[
                      { label: 'Click or type supplier name / phone...', value: 0 },
                      ...suppliers.map((s: any) => ({ label: `${s.name} - ${s.phone || ''}`, value: s.id }))
                    ]}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="bg-[#059669] hover:bg-[#047857] text-white px-2 py-1 rounded transition-colors flex items-center gap-1 text-[11px] font-bold">
                    <Plus size={12} /> Add Supplier
                  </button>
                  <span className="text-[11px] text-[#6B7280] text-right flex-1 ml-2 flex flex-col items-end">
                    <span>{selectedSupplier ? `${selectedSupplier.address || 'Standard Vendor'}` : 'Standard Vendor'}</span>
                    {selectedSupplier?.state && <span className="font-bold text-[#1F2937]">{selectedSupplier.state}</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full lg:max-w-[200px]">
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5 uppercase tracking-wide">Purchase Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded bg-[#F9FAFB] focus:bg-white text-[13px] outline-none focus:border-[#475569] focus:ring-1 focus:ring-[#475569] transition-all"
              />
            </div>

            <div className="w-full lg:max-w-[200px]">
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5 uppercase tracking-wide">Payment Mode *</label>
              <select
                value={paymentModeId}
                onChange={e => setPaymentModeId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded bg-[#F9FAFB] focus:bg-white text-[13px] outline-none focus:border-[#475569] focus:ring-1 focus:ring-[#475569] transition-all"
              >
                <option value={0}>Select Mode</option>
                {paymentModes.map((mode: any) => (
                  <option key={mode.id} value={mode.id}>{mode.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 flex flex-wrap justify-between gap-2 p-2 bg-white border-b border-[#E5E7EB]">
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => navigate('/raw-materials/purchase-list')}
              className="border border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <List size={14} /> List
            </button>
            <button 
              type="button"
              onClick={() => navigate('/reports/raw-material-purchase')}
              className="border border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <FileText size={14} /> Report
            </button>
          </div>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={addItem}
              className="border border-[#0B355B] text-[#0B355B] hover:bg-[#0B355B] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <PlusCircle size={14} /> Add Row
            </button>
            <button 
              type="button"
              onClick={handleClear}
              className="border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <RotateCcw size={14} /> Clear (F4)
            </button>
            <ShortcutHelpButton />
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-white border-b border-[#E5E7EB]">
          <table className="w-full border-collapse border border-[#E5E7EB] md:min-w-[1200px] whitespace-nowrap responsive-table shadow-sm">
            <thead>
              <tr className="bg-[#1E293B] text-white">
                <th className="px-2 py-2.5 text-center text-[12px] font-medium border border-[#334155] w-10">#</th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium border border-[#334155]">Raw Material (Searchable)</th>
                <th className="px-2 py-2.5 text-center text-[12px] font-medium border border-[#334155] w-24">Width (MM)</th>
                <th className="px-2 py-2.5 text-center text-[12px] font-medium border border-[#334155] w-24">Length (M)</th>
                <th className="px-2 py-2.5 text-center text-[12px] font-bold border border-[#334155] w-28 bg-[#334155] text-green-300 tracking-wide">SQ.M</th>
                <th className="px-2 py-2.5 text-center text-[12px] font-medium border border-[#334155] w-20">Qty (Rolls)</th>
                <th className="px-2 py-2.5 text-center text-[12px] font-medium border border-[#334155] w-28">Price / Sq.M</th>
                <th className="px-3 py-2.5 text-right text-[12px] font-bold border border-[#334155] w-32 tracking-wide">AMOUNT</th>
                <th className="px-2 py-2.5 text-center text-[12px] font-medium border border-[#334155] w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <td className="px-2 py-1 text-center text-[13px] border-r border-[#E5E7EB]">{index + 1}</td>
                  <td className="px-2 py-1 border-r border-[#E5E7EB]">
                    <SearchableSelect
                      creatable={true}
                      value={item.rawMaterialId}
                      autoFocus={index === 0 && items.length === 1 && item.rawMaterialId === 0}
                      dataAttr={{ 'data-row-product': String(index) }}
                      onChange={(val) => {
                        updateItem(index, 'rawMaterialId', Number(val));
                        setTimeout(() => focusCell(index, 1), 50);
                      }}
                      onCreate={(name) => handleCreateNewMaterial(index, name)}
                      options={[
                        { label: 'Type material name / code...', value: 0 },
                        ...rawMaterials.map((p: any) => ({ label: `${p.code} - ${p.name}`, value: p.id }))
                      ]}
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input 
                      type="number" value={item.widthMm} onChange={e => updateItem(index, 'widthMm', e.target.value)}
                      placeholder="0" onFocus={e => e.target.select()}
                      data-row={index} data-col={1} onKeyDown={e => handleCellKey(e, index, 1, 5)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right" 
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input 
                      type="number" value={item.lengthM} onChange={e => updateItem(index, 'lengthM', e.target.value)}
                      placeholder="0" onFocus={e => e.target.select()}
                      data-row={index} data-col={2} onKeyDown={e => handleCellKey(e, index, 2, 5)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right" 
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-[#E5E7EB] bg-blue-50 text-center font-bold text-blue-700">
                    {item.sqM.toFixed(3)}
                  </td>
                  <td className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input 
                      type="number" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)}
                      placeholder="0" onFocus={e => e.target.select()}
                      data-row={index} data-col={3} onKeyDown={e => handleCellKey(e, index, 3, 5)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right" 
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input 
                      type="number" step="0.01" value={item.price} onChange={e => updateItem(index, 'price', e.target.value)}
                      placeholder="0.00" onFocus={e => e.target.select()}
                      data-row={index} data-col={4} onKeyDown={e => handleCellKey(e, index, 4, 5)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right" 
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input type="number" readOnly tabIndex={-1} value={item.amount.toFixed(2)} className="w-full px-2 py-1 bg-transparent text-[13px] outline-none text-right font-bold" />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <div className="flex justify-center gap-2">
                      <button 
                        type="button" onClick={addItem} 
                        className="bg-[#10B981] text-white p-1.5 rounded hover:bg-[#059669] transition-colors shadow-sm"
                        title="Add Row"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                      <button 
                        type="button" onClick={() => removeItem(index)} 
                        disabled={items.length === 1} 
                        className="bg-red-50 text-red-500 p-1.5 rounded hover:bg-red-500 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-red-50 disabled:hover:text-red-500"
                        title="Remove Row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Calculation Area */}
        <div className="bg-white border-t border-[#E5E7EB] p-3 sm:p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-6">
            
            <div className="w-full md:flex-1 flex flex-col gap-1">
              <label className="text-[14px] font-extrabold text-[#1F2937] uppercase">Total Quantity:</label>
              <input
                value={items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)}
                readOnly
                className="w-full px-3 py-2 border border-[#D1D5DB] bg-[#F9FAFB] rounded text-[20px] outline-none text-right font-black text-[#1F2937]"
              />
            </div>

            <div className="w-full md:flex-1 flex flex-col gap-1">
              <label className="text-[14px] font-extrabold text-[#1F2937] uppercase">Total SQ.M:</label>
              <input
                value={items.reduce((acc, item) => acc + ((Number(item.sqM) || 0) * (Number(item.quantity) || 0)), 0).toFixed(3)}
                readOnly
                className="w-full px-3 py-2 border border-[#D1D5DB] bg-[#F9FAFB] rounded text-[20px] outline-none text-right font-black text-[#1F2937]"
              />
            </div>
            
            <div className="w-full md:flex-[2] flex flex-col sm:flex-row gap-4 sm:gap-6 justify-end items-end">
              <div className="w-full sm:w-32 flex flex-col gap-1">
                <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Transport Chg.</label>
                <input
                  type="number"
                  value={transportCharge}
                  onChange={(e) => setTransportCharge(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-[#D1D5DB] bg-white focus:bg-[#F0FDF4] rounded text-[16px] outline-none text-right font-black text-black focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]"
                />
              </div>
              <div className="w-full sm:w-32 flex flex-col gap-1">
                <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Wages</label>
                <input
                  type="number"
                  value={wages}
                  onChange={(e) => setwages(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-[#D1D5DB] bg-white focus:bg-[#F0FDF4] rounded text-[16px] outline-none text-right font-black text-black focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#F8FAFC] border-t border-[#CBD5E1] px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0 mt-auto shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex flex-nowrap justify-between sm:justify-center gap-2 w-full md:w-auto">
            <button 
              type="button" onClick={addItem}
              className="bg-[#334155] text-white text-[11px] font-bold px-3 py-2 rounded flex items-center gap-1.5 cursor-pointer hover:bg-[#1E293B] shadow-sm transition-colors"
            >
              <span className="opacity-60 border-r border-[#64748B] pr-1.5">F2</span> Add Material
            </button>

            <button 
              type="button" disabled={mutation.isPending} onClick={() => handleSubmit()}
              className="bg-[#10B981] text-white text-[11px] font-bold px-3 py-2 rounded flex items-center gap-1.5 cursor-pointer hover:bg-[#059669] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            >
              <span className="opacity-60 border-r border-[#6EE7B7] pr-1.5">F10</span> 
              {mutation.isPending ? 'Saving...' : 'Save Record'}
            </button>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t border-gray-200 md:border-none pt-3 md:pt-0">
            <span className="text-[16px] sm:text-[18px] font-bold text-[#475569] uppercase">Total Purchase Amount:</span>
            <span className="text-[24px] sm:text-[32px] font-black text-[#10B981]">
              {formatCurrency(grandTotal || 0)}
            </span>
          </div>
        </div>

      </form>

      {/* ========================================================= */}
      {/* MOBILE-ONLY VIEW (md:hidden)                             */}
      {/* ========================================================= */}

      {/* Mobile Top Header Bar */}
      <div className="md:hidden bg-[#475569] text-white px-3 py-2.5 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={() => setIsLeaveModalOpen(true)}
            className="p-1 rounded hover:bg-white/10 active:scale-95 transition-all text-white/90"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-[13px] tracking-wide flex items-center gap-1.5">
              <Package size={15} className="text-emerald-400" />
              Raw Material Purchase
            </h1>
            <p className="text-[10px] text-slate-300">
              {validItems.length} material{validItems.length !== 1 ? 's' : ''} in purchase
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            type="button" 
            onClick={() => navigate('/raw-materials/purchase-list')}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1"
            title="Purchase List"
          >
            <List size={14} />
            <span>List</span>
          </button>
          {validItems.length > 0 && (
            <button 
              type="button"
              onClick={() => setIsMobileCheckoutOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm"
            >
              <ShoppingCart size={13} />
              <span>{formatCurrency(grandTotal)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Main Body */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50">
        {/* Mobile Sticky Bar: Search + Quick Supplier & Invoice Info */}
        <div className="bg-white px-3 py-2.5 border-b border-slate-200 shrink-0 flex flex-col gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={mobileSearch}
              onChange={e => setMobileSearch(e.target.value)}
              placeholder="Search material name, code..."
              className="w-full pl-9 pr-8 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-slate-500 transition-all font-medium"
            />
            {mobileSearch && (
              <button 
                type="button"
                onClick={() => setMobileSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] gap-2">
            <button 
              type="button"
              onClick={() => setIsMobileSupplierPickerOpen(true)}
              className="flex items-center gap-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md max-w-[55%] truncate border border-slate-200 font-medium"
            >
              <User size={12} className="text-emerald-600 shrink-0" />
              <span className="truncate">{selectedSupplier ? selectedSupplier.name : 'Select Supplier *'}</span>
            </button>

            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span>Inv:</span>
              <input 
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="Bill #"
                className="w-24 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-center text-[11px] font-bold text-slate-800 outline-none focus:bg-white focus:border-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Mobile Raw Materials Catalog List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">No raw materials found</p>
            </div>
          ) : (
            filteredMaterials.map((mat: any) => {
              const inCartItem = items.find(i => Number(i.rawMaterialId) === Number(mat.id));
              const hasInCart = !!inCartItem && Number(inCartItem.rawMaterialId) > 0;

              return (
                <div 
                  key={mat.id}
                  className={`bg-white rounded-xl p-3 border transition-all shadow-sm ${
                    hasInCart ? 'border-emerald-400 ring-1 ring-emerald-400/40 bg-emerald-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-800 truncate">{mat.name}</span>
                        {mat.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                            {mat.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>Stock: <strong className={mat.currentStock > 0 ? 'text-slate-800 font-semibold' : 'text-rose-600 font-semibold'}>{mat.currentStock || 0}</strong></span>
                        {mat.purchaseRate > 0 && (
                          <span>• Rate: <strong className="text-slate-700">{formatCurrency(mat.purchaseRate)}</strong></span>
                        )}
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => handleMobileOpenEdit(mat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-all ${
                        hasInCart 
                          ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-95' 
                          : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                      }`}
                    >
                      {hasInCart ? (
                        <>
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* If item in cart, show specs pill */}
                  {hasInCart && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 bg-white/70 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                      <div className="truncate pr-2">
                        <span className="font-bold text-emerald-700">{inCartItem.quantity || 1} roll(s)</span>
                        <span className="text-slate-400 mx-1">•</span>
                        <span>{inCartItem.widthMm || 0}mm × {inCartItem.lengthM || 0}m</span>
                        <span className="text-slate-400 mx-1">•</span>
                        <span className="font-mono text-[10px] text-slate-500">{inCartItem.sqM || 0} m²</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900">{formatCurrency(inCartItem.amount || 0)}</span>
                        <button 
                          type="button" 
                          onClick={() => handleMobileRemoveItem(mat.id)}
                          className="text-rose-500 hover:text-rose-700 p-0.5"
                          title="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Mobile Floating Action Cart Bar */}
        {validItems.length > 0 && (
          <div className="bg-white border-t border-slate-200 p-3 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Purchase</p>
              <p className="text-base font-black text-emerald-600 leading-none">{formatCurrency(grandTotal)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{validItems.length} material{validItems.length !== 1 ? 's' : ''}</p>
            </div>

            <button 
              type="button"
              onClick={() => setIsMobileCheckoutOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <span>Review & Confirm</span>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MOBILE EDIT MATERIAL MODAL / DRAWER                      */}
      {/* ========================================================= */}
      {isMobileEditItemOpen && editingMaterial && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Package size={17} className="text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm leading-tight truncate">{editingMaterial.name}</h3>
                  <p className="text-[10px] text-slate-300">
                    {editingMaterial.code} • In Stock: {editingMaterial.currentStock || 0}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsMobileEditItemOpen(false)}
                className="text-slate-300 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Width (mm) *</label>
                  <input 
                    type="number"
                    value={editForm.widthMm}
                    onChange={e => {
                      const w = e.target.value;
                      const l = editForm.lengthM;
                      const sqM = (parseFloat(w || '0') / 1000) * parseFloat(l || '0');
                      setEditForm({ ...editForm, widthMm: w, sqM: parseFloat(sqM.toFixed(4)) });
                    }}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Length (m) *</label>
                  <input 
                    type="number"
                    value={editForm.lengthM}
                    onChange={e => {
                      const l = e.target.value;
                      const w = editForm.widthMm;
                      const sqM = (parseFloat(w || '0') / 1000) * parseFloat(l || '0');
                      setEditForm({ ...editForm, lengthM: l, sqM: parseFloat(sqM.toFixed(4)) });
                    }}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Calculated Sq.M display */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Calculated Area (Sq.M):</span>
                <span className="font-black text-slate-800 text-sm">
                  {((parseFloat(editForm.widthMm || '0') / 1000) * parseFloat(editForm.lengthM || '0')).toFixed(4)} m²
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantity (Rolls) *</label>
                  <input 
                    type="number"
                    value={editForm.quantity}
                    onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Rate / Sq.M (₹) *</label>
                  <input 
                    type="number"
                    value={editForm.price}
                    onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Total preview for this item */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-emerald-800">Item Total Amount</p>
                  <p className="text-xs text-emerald-600">Sq.M × Qty × Rate</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-emerald-700">
                    {formatCurrency(
                      ((parseFloat(editForm.widthMm || '0') / 1000) * parseFloat(editForm.lengthM || '0')) *
                      parseFloat(editForm.quantity || '0') *
                      parseFloat(editForm.price || '0')
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              {items.some(i => Number(i.rawMaterialId) === Number(editingMaterial.id)) && (
                <button 
                  type="button"
                  onClick={() => {
                    handleMobileRemoveItem(editingMaterial.id);
                    setIsMobileEditItemOpen(false);
                  }}
                  className="px-3 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all"
                >
                  Remove
                </button>
              )}
              <button 
                type="button"
                onClick={handleMobileSaveEdit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <CheckCircle size={15} />
                <span>Save to Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE CHECKOUT / CONFIRM PURCHASE DRAWER                */}
      {/* ========================================================= */}
      {isMobileCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-[#475569] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={17} className="text-emerald-400" />
                <h3 className="font-bold text-sm">Review & Confirm Purchase</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsMobileCheckoutOpen(false)}
                className="text-slate-300 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {/* Purchase Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={13} className="text-slate-500" />
                  Bill Details
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Invoice No *</label>
                    <input 
                      type="text"
                      value={invoiceNo}
                      onChange={e => setInvoiceNo(e.target.value)}
                      placeholder="Inv / Bill #"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Date *</label>
                    <input 
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-500"
                    />
                  </div>
                </div>

                {/* Supplier selection card */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600">Supplier *</label>
                    <button 
                      type="button"
                      onClick={() => setIsSupplierModalOpen(true)}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
                    >
                      <UserPlus size={12} />
                      <span>New</span>
                    </button>
                  </div>
                  <div 
                    onClick={() => setIsMobileSupplierPickerOpen(true)}
                    className="p-2.5 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">
                        {selectedSupplier ? selectedSupplier.name : 'Choose a supplier...'}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Payment Mode *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {paymentModes.map((pm: any) => (
                      <button 
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentModeId(pm.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentModeId === pm.id 
                            ? 'bg-slate-900 text-white shadow-sm' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pm.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Items in Cart */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Materials ({validItems.length})
                  </h4>
                  <button 
                    type="button"
                    onClick={() => setIsMobileCheckoutOpen(false)}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    + Add More
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {validItems.map((item, idx) => {
                    const mat = rawMaterials.find((m: any) => m.id === Number(item.rawMaterialId));
                    return (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{mat?.name || 'Raw Material'}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {item.quantity} rolls • {item.widthMm}mm × {item.lengthM}m ({item.sqM} m²) @ {formatCurrency(item.price)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-slate-900">{formatCurrency(item.amount || 0)}</p>
                          <div className="flex items-center justify-end gap-1.5 mt-1">
                            <button 
                              type="button" 
                              onClick={() => {
                                setIsMobileCheckoutOpen(false);
                                if (mat) handleMobileOpenEdit(mat);
                              }}
                              className="text-slate-500 hover:text-slate-700 p-0.5"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleMobileRemoveItem(item.rawMaterialId)}
                              className="text-rose-500 hover:text-rose-700 p-0.5"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra Charges */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck size={13} className="text-slate-500" />
                  Additional Charges
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Transport (₹)</label>
                    <input 
                      type="number"
                      value={transportCharge}
                      onChange={e => setTransportCharge(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-500 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Wages (₹)</label>
                    <input 
                      type="number"
                      value={wages}
                      onChange={e => setwages(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-500 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Order Cost Summary */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Materials Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {transportAmt > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Transport Charges</span>
                    <span>+{formatCurrency(transportAmt)}</span>
                  </div>
                )}
                {wagesAmt > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Wages</span>
                    <span>+{formatCurrency(wagesAmt)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-emerald-200 flex justify-between items-center text-sm font-black text-emerald-800">
                  <span>Grand Total</span>
                  <span className="text-base text-emerald-700">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
              <button 
                type="button"
                disabled={mutation.isPending}
                onClick={() => handleSubmit()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
              >
                <CheckCircle size={18} />
                <span>{mutation.isPending ? 'Saving Purchase...' : `SAVE PURCHASE • ${formatCurrency(grandTotal)}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE SUPPLIER PICKER MODAL                             */}
      {/* ========================================================= */}
      {isMobileSupplierPickerOpen && (
        <div className="fixed inset-0 bg-black/60 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <User size={16} className="text-emerald-400" />
                <span>Select Supplier</span>
              </div>
              <button 
                type="button" 
                onClick={() => setIsMobileSupplierPickerOpen(false)}
                className="text-slate-300 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 shrink-0 flex items-center gap-2">
              <input 
                type="text"
                placeholder="Search supplier..."
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-slate-400"
                id="supplierSearchInput"
                onChange={(e) => {
                  const val = e.target.value.toLowerCase();
                  const list = document.querySelectorAll('.supplier-item');
                  list.forEach((item: any) => {
                    const text = item.getAttribute('data-name')?.toLowerCase() || '';
                    item.style.display = text.includes(val) ? 'flex' : 'none';
                  });
                }}
              />
              <button 
                type="button"
                onClick={() => {
                  setIsMobileSupplierPickerOpen(false);
                  setIsSupplierModalOpen(true);
                }}
                className="px-2.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 hover:bg-emerald-700"
              >
                <Plus size={13} />
                <span>New</span>
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-1.5 flex-1 min-h-0">
              {suppliers.map((s: any) => (
                <div 
                  key={s.id}
                  data-name={`${s.name} ${s.phone || ''}`}
                  onClick={() => {
                    setSupplierId(s.id);
                    setIsMobileSupplierPickerOpen(false);
                  }}
                  className={`supplier-item p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    supplierId === s.id 
                      ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-slate-800">{s.name}</p>
                    <p className="text-[10px] text-slate-500">{s.phone || 'No phone'} • {s.state || 'General'}</p>
                  </div>
                  {supplierId === s.id && (
                    <CheckCircle size={16} className="text-emerald-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-[#059669] text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-[15px]">
                <UserPlus size={18} /> Quick Add New Supplier
              </div>
              <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-[13px] font-bold text-[#1F2937] mb-1">Supplier Name *</label>
                <input 
                  type="text" 
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]" 
                />
              </div>
              <div>
                <label className="block text-[13px] text-[#4B5563] mb-1">Mobile Number</label>
                <input 
                  type="text" 
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]" 
                />
              </div>
              <div>
                <label className="block text-[13px] text-[#4B5563] mb-1">State {settings?.enableTax && <span className="text-red-500">*</span>}</label>
                <Select 
                  value={newSupplier.state ? { value: newSupplier.state, label: newSupplier.state } : null}
                  onChange={(val: any) => setNewSupplier({...newSupplier, state: val?.value || ''})}
                  options={[
                    { value: '', label: '-- Select State --' },
                    ...indianStates.map(s => ({ value: s, label: s }))
                  ]}
                  className="text-[13px] font-medium"
                  placeholder="-- Select State --"
                  styles={{
                    control: (base: any) => ({
                      ...base,
                      minHeight: '38px',
                      borderColor: '#D1D5DB',
                      borderRadius: '0.25rem',
                    }),
                    menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
                  }}
                  menuPortalTarget={document.body}
                />
              </div>
              <div>
                <label className="block text-[13px] text-[#4B5563] mb-1">Billing Address</label>
                <textarea 
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] min-h-[80px]" 
                />
              </div>
            </div>
            <div className="p-4 bg-white pt-2 border-none pb-5">
              <button 
                type="button"
                onClick={handleQuickAddSupplier}
                disabled={!newSupplier.name || addSupplierMutation.isPending}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white py-2.5 rounded font-bold text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save size={16} /> Save Supplier & Select
              </button>
            </div>
          </div>
        </div>
      )}
      
      <LeaveConfirmModal 
        isOpen={isLeaveModalOpen} 
        onClose={() => setIsLeaveModalOpen(false)} 
        onConfirm={() => navigate('/dashboard')} 
      />
    </div>
  );
};

export default RawMaterialPurchaseEntry;
