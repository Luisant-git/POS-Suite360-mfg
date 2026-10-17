import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Plus, Trash2, RefreshCw, List, Scissors, FileText, Search, X, 
  ShoppingCart, ChevronRight, User, MinusCircle, PlusCircle, 
  CheckCircle, ArrowLeft, Calendar, CreditCard 
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import ServiceReceiptPrintModal from '../../components/ServiceReceiptPrintModal';
import ShortcutHelpButton from '../../components/ShortcutHelp';
import Select from 'react-select';

const serviceItemRowSchema = z.object({
  serviceItemId: z.coerce.number().optional(),
  serviceName: z.string().min(1, 'Required'),
  quantity: z.coerce.number().min(0.01),
  rate: z.coerce.number().min(0),
  discPercent: z.coerce.number().min(0).max(100),
  tax: z.coerce.number().min(0).optional(),
  total: z.coerce.number(),
});

const serviceSaleSchema = z.object({
  customerId: z.coerce.number().optional(),
  date: z.string(),
  paymentModeId: z.coerce.number().min(1, 'Payment mode required'),
  notes: z.string().optional(),
  grossAmount: z.coerce.number(),
  totalDiscount: z.coerce.number(),
  totalTax: z.coerce.number(),
  grandTotal: z.coerce.number(),
  items: z.array(serviceItemRowSchema),
});

type ServiceSaleValues = z.infer<typeof serviceSaleSchema>;

const ServiceSalesEntry = () => {
  const navigate = useNavigate();
  const { settings, formatCurrency } = useSettings();
  const queryClient = useQueryClient();
  const [savedSale, setSavedSale] = useState<any>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [customerPaid, setCustomerPaid] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState(false);

  const { data: serviceItems = [] } = useQuery({
    queryKey: ['service-items'],
    queryFn: async () => (await api.get('/service-items?isActive=true')).data,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data,
  });
  const { data: paymentModes = [] } = useQuery({
    queryKey: ['paymentModes'],
    queryFn: async () => (await api.get('/payment-modes')).data,
  });
  const { data: nextInvoiceNo } = useQuery({
    queryKey: ['service-sales-next-invoice'],
    queryFn: async () => (await api.get('/service-sales/next-invoice-no')).data,
    staleTime: 0,
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const enableTax = settings?.enableTax;

  const defaultItem = { serviceItemId: undefined, serviceName: '', quantity: 1, rate: 0 as any, discPercent: 0 as any, tax: 0, total: 0 };

  const { register, control, handleSubmit, watch, setValue, getValues, reset } = useForm<ServiceSaleValues>({
    resolver: zodResolver(serviceSaleSchema) as any,
    defaultValues: {
      date: todayStr, paymentModeId: 0, notes: '',
      grossAmount: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0,
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  // Recalculate totals
  useEffect(() => {
    const gross = watchedItems.reduce((s, i) => s + (Number(i.rate) * Number(i.quantity)), 0);
    const disc = watchedItems.reduce((s, i) => s + (Number(i.rate) * Number(i.quantity) * Number(i.discPercent) / 100), 0);
    const taxTotal = enableTax ? watchedItems.reduce((s, i) => s + (Number(i.tax) || 0), 0) : 0;
    const grand = gross - disc + taxTotal;
    setValue('grossAmount', parseFloat(gross.toFixed(2)));
    setValue('totalDiscount', parseFloat(disc.toFixed(2)));
    setValue('totalTax', parseFloat(taxTotal.toFixed(2)));
    setValue('grandTotal', parseFloat(grand.toFixed(2)));
  }, [JSON.stringify(watchedItems), enableTax]);

  const handleServiceSelect = (index: number, svcItem: any) => {
    setValue(`items.${index}.serviceItemId`, svcItem.id);
    setValue(`items.${index}.serviceName`, svcItem.name);
    setValue(`items.${index}.rate`, Number(svcItem.rate));
    setValue(`items.${index}.discPercent`, 0);
    setValue(`items.${index}.tax`, 0);
    const qty = getValues(`items.${index}.quantity`) || 1;
    setValue(`items.${index}.total`, Number(svcItem.rate) * Number(qty));
  };

  const recalcRow = (index: number) => {
    const qty = Number(getValues(`items.${index}.quantity`)) || 0;
    const rate = Number(getValues(`items.${index}.rate`)) || 0;
    const disc = Number(getValues(`items.${index}.discPercent`)) || 0;
    const net = qty * rate * (1 - disc / 100);
    let taxAmt = 0;
    if (enableTax) {
      const svcId = getValues(`items.${index}.serviceItemId`);
      const svc = serviceItems.find((s: any) => s.id === svcId);
      if (svc?.taxPercent) taxAmt = net * Number(svc.taxPercent) / 100;
    }
    setValue(`items.${index}.tax`, parseFloat(taxAmt.toFixed(2)));
    setValue(`items.${index}.total`, parseFloat((net + (enableTax ? taxAmt : 0)).toFixed(2)));
  };

  // Mobile Helpers
  const handleMobileAddToCart = (svc: any) => {
    const currentItems = getValues('items') || [];
    const existingIdx = currentItems.findIndex(i => Number(i.serviceItemId) === Number(svc.id));

    if (existingIdx >= 0) {
      const curQty = Number(currentItems[existingIdx].quantity) || 0;
      setValue(`items.${existingIdx}.quantity`, curQty + 1);
      recalcRow(existingIdx);
    } else {
      const isFirstEmpty = currentItems.length === 1 && !currentItems[0].serviceItemId && !currentItems[0].serviceName;
      if (isFirstEmpty) {
        handleServiceSelect(0, svc);
        setValue('items.0.quantity', 1);
        recalcRow(0);
      } else {
        const net = Number(svc.rate) || 0;
        let taxAmt = 0;
        if (enableTax && svc.taxPercent) {
          taxAmt = parseFloat((net * Number(svc.taxPercent) / 100).toFixed(2));
        }
        append({
          serviceItemId: svc.id,
          serviceName: svc.name,
          quantity: 1,
          rate: Number(svc.rate) || 0,
          discPercent: 0,
          tax: taxAmt,
          total: parseFloat((net + taxAmt).toFixed(2)),
        });
      }
    }
    toast.success(`Added ${svc.name}`, { duration: 1200, id: `add-${svc.id}` });
  };

  const handleMobileMinusQty = (index: number) => {
    const curQty = Number(getValues(`items.${index}.quantity`)) || 1;
    if (curQty > 1) {
      setValue(`items.${index}.quantity`, curQty - 1);
      recalcRow(index);
    } else {
      handleMobileDeleteItem(index);
    }
  };

  const handleMobilePlusQty = (index: number) => {
    const curQty = Number(getValues(`items.${index}.quantity`)) || 0;
    setValue(`items.${index}.quantity`, curQty + 1);
    recalcRow(index);
  };

  const handleMobileDeleteItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    } else {
      setValue('items.0.serviceItemId', undefined);
      setValue('items.0.serviceName', '');
      setValue('items.0.quantity', 1);
      setValue('items.0.rate', 0);
      setValue('items.0.discPercent', 0);
      setValue('items.0.tax', 0);
      setValue('items.0.total', 0);
    }
  };

  const handleMobileClear = () => {
    if (window.confirm('Clear all items from bill?')) {
      reset({
        date: todayStr,
        paymentModeId: 0,
        notes: '',
        grossAmount: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        items: [defaultItem],
      });
      setCustomerPaid('');
    }
  };

  const validMobileCartItems = watchedItems
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter(item => item.serviceName && Number(item.rate) > 0);

  const mobileCartTotalQty = validMobileCartItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  const filteredServiceItems = serviceItems.filter((s: any) => {
    if (!mobileSearch) return true;
    return s.name?.toLowerCase().includes(mobileSearch.toLowerCase());
  });

  const focusCell = (row: number, col: number) => {
    if (col === 0) {
      const el = document.getElementById(`service-select-${row}`);
      if (el) { el.focus(); }
    } else {
      const el = document.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
      if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
    }
  };

  const handleCellKey = (e: React.KeyboardEvent, rowIndex: number, col: number, totalCols: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = rowIndex + 1;
      if (nextRow < fields.length) {
        focusCell(nextRow, 0);
      } else {
        append({ ...defaultItem });
        setTimeout(() => focusCell(nextRow, 0), 80);
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextCol = col + 1;
      if (nextCol < totalCols) {
        focusCell(rowIndex, nextCol);
      } else {
        const nextRow = rowIndex + 1;
        if (nextRow < fields.length) {
          focusCell(nextRow, 0);
        } else {
          append({ ...defaultItem });
          setTimeout(() => focusCell(nextRow, 0), 80);
        }
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const prevCol = col - 1;
      if (prevCol >= 0) focusCell(rowIndex, prevCol);
      else if (rowIndex > 0) focusCell(rowIndex - 1, totalCols - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(rowIndex + 1, col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) focusCell(rowIndex - 1, col);
    } else if (e.key === 'Delete' && e.ctrlKey) {
      e.preventDefault();
      if (fields.length > 1) {
        remove(rowIndex);
        setTimeout(() => focusCell(Math.min(rowIndex, fields.length - 2), col), 50);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/service-sales', data),
    onSuccess: async (res) => {
      toast.success(`Bill ${res.data.invoiceNo} saved!`);
      queryClient.invalidateQueries({ queryKey: ['service-sales-next-invoice'] });
      const full = await api.get(`/service-sales/${res.data.id}`);
      setSavedSale(full.data);
      setIsPrintOpen(true);
      setIsMobileCheckoutOpen(false);
      reset({ date: todayStr, paymentModeId: 0, notes: '', grossAmount: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0, items: [defaultItem] });
      setCustomerPaid('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save bill'),
  });

  const onSubmit = (data: ServiceSaleValues) => {
    const validItems = data.items.filter(i => i.serviceName && i.rate > 0);
    if (!validItems.length) { toast.error('Add at least one service'); return; }
    createMutation.mutate({
      date: data.date,
      customerId: data.customerId || undefined,
      paymentModeId: data.paymentModeId,
      subtotal: data.grossAmount,
      tax: data.totalTax,
      discount: data.totalDiscount,
      grandTotal: data.grandTotal,
      notes: data.notes,
      items: validItems.map(i => ({
        serviceItemId: i.serviceItemId || undefined,
        serviceName: i.serviceName,
        quantity: i.quantity,
        rate: i.rate,
        discount: Number(i.rate) * Number(i.quantity) * Number(i.discPercent) / 100,
        tax: i.tax || 0,
        amount: i.total,
      })),
    });
  };

  const onFormError = (errors: any) => {
    console.error('Form Validation Errors:', errors);
    let errorMessage = 'Validation failed. Please ensure all items have a Rate and Quantity > 0.';

    if (errors.customerId) {
      errorMessage = 'Please select a Customer before saving.';
    } else if (errors.paymentModeId) {
      errorMessage = 'Please select a Payment Mode before saving.';
    } else if (errors.items && Array.isArray(errors.items)) {
      for (const item of errors.items) {
        if (item?.serviceName) {
           errorMessage = 'Validation failed: Service Name is required for all rows.';
           break;
        }
        if (item?.quantity) {
           errorMessage = 'Validation failed: Quantity must be greater than 0.';
           break;
        }
        if (item?.rate) {
           errorMessage = 'Validation failed: Rate is required for all items.';
           break;
        }
      }
    } else if (errors.items) {
      errorMessage = 'Please add at least one service before saving.';
    }
    
    toast.error(errorMessage);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSubmit(onSubmit as any, onFormError)();
      } else if (e.key === 'F2') {
        e.preventDefault();
        append({ ...defaultItem });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, onSubmit, onFormError, append, navigate, defaultItem]);

  const serviceOptions = serviceItems.map((s: any) => ({
    value: s.id, label: `${s.name} — ${formatCurrency(s.rate)}`, data: s,
  }));

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col font-sans overflow-hidden z-10">

      {/* ─── DESKTOP VIEW (>= MD) ─── */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-hidden">

        {/* Top Header */}
        <div className="bg-[#0B4A3F] text-white px-2 sm:px-4 py-2 flex flex-wrap gap-2 justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-bold">
            <span className="opacity-70 hover:opacity-100 cursor-pointer transition-opacity" onClick={() => navigate('/dashboard')}>Home</span>
            <span className="opacity-50">/</span>
            <span className="opacity-70">Services</span>
            <span className="opacity-50">/</span>
            <span className="text-[#6EE7B7]">Service Sales Entry</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold">
            <Scissors size={12} className="text-[#6EE7B7]" />
            <span className="text-[#A7F3D0]">Invoice:</span>
            <span className="text-white font-mono">{nextInvoiceNo || '...'}</span>
            <span className="mx-2 text-white/30">|</span>
            <span className="text-[#6EE7B7] text-[10px]">No stock tracking</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit as any, onFormError)} className="flex flex-col flex-1 overflow-hidden">

          {/* Info Row */}
          <div className="bg-white border-b border-[#E5E7EB] p-3 shrink-0 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Entry Date</label>
              <input
                {...register('date')}
                type="date"
                className="px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#059669] w-36"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Customer <span className="text-gray-400 font-normal">(optional)</span></label>
              <select
                onChange={(e) => setValue('customerId', Number(e.target.value) || undefined)}
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#059669] bg-white"
              >
                <option value="">Walk-in / Cash Customer</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Payment Mode *</label>
              <select
                {...register('paymentModeId')}
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#059669] bg-white"
              >
                <option value="0">Select Payment...</option>
                {paymentModes.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Notes</label>
              <input
                {...register('notes')}
                placeholder="Optional notes..."
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#059669]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="shrink-0 flex flex-wrap justify-end gap-2 p-2 bg-white border-b border-[#E5E7EB]">
            <button type="button"
              onClick={() => append({ ...defaultItem })}
              className="border border-[#047857] text-[#047857] hover:bg-[#047857] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <Plus size={14} /> Add Row
            </button>
            <button type="button"
              onClick={() => reset({ date: todayStr, paymentModeId: 0, notes: '', grossAmount: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0, items: [defaultItem] })}
              className="border border-[#713F12] text-[#713F12] hover:bg-[#713F12] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <RefreshCw size={14} /> Clear
            </button>
            <button type="button"
              onClick={() => navigate('/services/sales-list')}
              className="border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <List size={14} /> Bills List
            </button>
            <button type="button"
              onClick={() => navigate('/reports/service-sales')}
              className="border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
            >
              <FileText size={14} /> Report
            </button>
            <ShortcutHelpButton />
          </div>

          {/* Items Table */}
          <div className="flex-1 min-h-0 overflow-auto bg-white border-b border-[#E5E7EB]">
            <table className="w-full border-collapse whitespace-nowrap" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-[#0F172A] text-white">
                  <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-10">#</th>
                  <th className="px-2 py-2 text-left text-[12px] font-medium border border-[#334155]">Service Name</th>
                  <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-20">Qty</th>
                  <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-28">Rate</th>
                  <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-20">Disc%</th>
                  {enableTax && <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-24">Tax Amt</th>}
                  <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-28">Total</th>
                  <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-12">Del</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-[#E5E7EB] hover:bg-emerald-50/30">
                    <td className="px-2 py-1 text-center text-[13px] border-r border-[#E5E7EB] text-[#73879C]">{index + 1}</td>
                    <td className="px-2 py-1 border-r border-[#E5E7EB]" style={{ minWidth: 220 }}>
                      <Select
                        inputId={`service-select-${index}`}
                        autoFocus={index === 0}
                        openMenuOnFocus={true}
                        options={serviceOptions}
                        onChange={(opt: any) => { 
                          if (opt) {
                            handleServiceSelect(index, opt.data);
                            setTimeout(() => focusCell(index, 1), 50);
                          } 
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && !e.shiftKey) {
                             e.preventDefault();
                             focusCell(index, 1);
                          }
                        }}
                        placeholder="Select service..."
                        isClearable
                        styles={{
                          control: (b) => ({ ...b, minHeight: '30px', fontSize: '12px', borderColor: '#D1D5DB', boxShadow: 'none' }),
                          menu: (b) => ({ ...b, fontSize: '12px', zIndex: 999 }),
                          valueContainer: (b) => ({ ...b, padding: '0 6px' }),
                          indicatorsContainer: (b) => ({ ...b, height: '30px' }),
                          singleValue: (b) => ({ ...b, color: '#000', fontWeight: 'bold' }),
                          option: (b, state) => ({ ...b, color: state.isSelected ? '#fff' : '#000', fontWeight: 'bold' }),
                          placeholder: (b) => ({ ...b, color: '#4B5563', fontWeight: 'bold' }),
                        }}
                      />
                      <input type="hidden" {...register(`items.${index}.serviceName`)} />
                      <input type="hidden" {...register(`items.${index}.serviceItemId`)} />
                    </td>
                    <td className="px-1 py-1 border-r border-[#E5E7EB]">
                      <input {...register(`items.${index}.quantity`)} type="number" min={0.01} step="0.01"
                        data-row={index} data-col={1}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleCellKey(e, index, 1, 4)}
                        onBlur={() => recalcRow(index)}
                        className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[12px] text-center outline-none focus:border-[#059669] focus:bg-green-50"
                      />
                    </td>
                    <td className="px-1 py-1 border-r border-[#E5E7EB]">
                      <input {...register(`items.${index}.rate`)} type="number" min={0} step="0.01"
                        data-row={index} data-col={2}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleCellKey(e, index, 2, 4)}
                        onBlur={() => recalcRow(index)}
                        className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[12px] text-right outline-none focus:border-[#059669] focus:bg-green-50"
                      />
                    </td>
                    <td className="px-1 py-1 border-r border-[#E5E7EB]">
                      <input {...register(`items.${index}.discPercent`)} type="number" min={0} max={100} step="0.01"
                        data-row={index} data-col={3}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleCellKey(e, index, 3, 4)}
                        onBlur={() => recalcRow(index)}
                        className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[12px] text-center outline-none focus:border-[#059669] focus:bg-green-50"
                      />
                    </td>
                    {enableTax && (
                      <td className="px-1 py-1 border-r border-[#E5E7EB]">
                        <input {...register(`items.${index}.tax`)} readOnly
                          className="w-full px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[12px] text-right text-gray-500"
                        />
                      </td>
                    )}
                    <td className="px-1 py-1 border-r border-[#E5E7EB]">
                      <input {...register(`items.${index}.total`)} readOnly
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[12px] text-right font-bold text-[#1F2937]"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button type="button" onClick={() => fields.length > 1 && remove(index)}
                        disabled={fields.length <= 1}
                        className="text-[#EF4444] hover:text-red-700 disabled:opacity-20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabs & Footer Calculation Area */}
          <div className="bg-[#F9FAFB] shrink-0">
            
            <div className="p-3 sm:p-4 bg-white border-b border-[#E5E7EB]">
              <div className="flex flex-col md:flex-row items-stretch md:items-center md:justify-start gap-4 md:gap-6">
                
                <div className="w-full md:w-56 flex flex-col gap-1">
                  <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Gross Amount:</label>
                  <input
                    {...register('grossAmount')}
                    type="number"
                    readOnly
                    className="w-full px-3 py-2 border-2 border-[#D1D5DB] bg-[#F3F4F6] rounded text-[18px] outline-none text-right font-bold text-gray-800"
                  />
                </div>

                <div className="w-full md:w-56 flex flex-col gap-1">
                  <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Total Discount:</label>
                  <div className="flex gap-2 w-full">
                    <div className="relative w-full">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-[15px] pointer-events-none">{settings?.currencySymbol || '₹'}</span>
                      <input
                        {...register('totalDiscount')}
                        readOnly
                        type="number"
                        className="w-full pl-8 pr-3 py-2 border-2 border-[#D1D5DB] bg-[#F3F4F6] rounded text-[16px] outline-none text-right font-bold text-gray-800"
                      />
                    </div>
                  </div>
                </div>

                {enableTax && (
                  <div className="w-full md:w-56 flex flex-col gap-1">
                    <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Total Tax:</label>
                    <input
                      {...register('totalTax')}
                      type="number"
                      readOnly
                      className="w-full px-3 py-2 border-2 border-[#D1D5DB] bg-[#F3F4F6] rounded text-[18px] outline-none text-right font-bold text-gray-800"
                    />
                  </div>
                )}

                <div className="w-full md:w-72 flex flex-col gap-1 ml-auto">
                  <label className="text-[14px] font-black text-[#047857] uppercase">GRAND TOTAL:</label>
                  <input
                    {...register('grandTotal')}
                    type="number"
                    readOnly
                    className="w-full px-3 py-2 border-2 border-[#059669] bg-[#ECFDF5] text-[#059669] rounded text-[22px] outline-none text-right font-black shadow-inner"
                  />
                </div>

              </div>
            </div>

            {/* Bottom Black Bar */}
            <div className="bg-[#020617] text-white px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0">
              <div className="flex flex-nowrap justify-between sm:justify-center gap-1 sm:gap-2 w-full md:w-auto">
                <button 
                  type="button"
                  onClick={() => append({ ...defaultItem })}
                  className="bg-[#2563EB] text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  <span className="opacity-70 border-r border-[#60A5FA] pr-1 mr-1">F2</span> Add Row
                </button>
                <button 
                  type="button"
                  disabled={createMutation.isPending}
                  className="bg-[#059669] text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer hover:bg-[#047857] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap" 
                  onClick={handleSubmit(onSubmit as any, onFormError)}
                >
                  <span className="opacity-70 border-r border-[#34D399] pr-1 mr-1">F10</span> 
                  {createMutation.isPending ? 'Saving...' : 'Save & Print'}
                </button>
                <button 
                  type="button"
                  className="bg-[#0891B2] text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer hover:bg-[#0E7490] whitespace-nowrap" 
                  onClick={() => navigate('/dashboard')}
                >
                  <span className="opacity-70 border-r border-[#67E8F9] pr-1 mr-1">Esc</span> Dashboard
                </button>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-none border-gray-700 pt-3 md:pt-0">
                {/* Net Amount */}
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Grand Total</span>
                  <span className="text-[28px] sm:text-[36px] font-black text-[#6EE7B7] drop-shadow-md leading-none">
                    {formatCurrency(watch('grandTotal') || 0)}
                  </span>
                </div>

                {/* Customer Paid */}
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Customer Paid</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[13px] pointer-events-none">{settings?.currencySymbol || '₹'}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customerPaid}
                      onChange={(e) => setCustomerPaid(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0.00"
                      className="w-36 pl-7 pr-2 py-1.5 bg-[#1e293b] border-2 border-[#059669] rounded text-[18px] font-black text-right text-white outline-none focus:border-[#6EE7B7]"
                    />
                  </div>
                </div>

                {/* Change / Short */}
                {Number(customerPaid) > 0 && (
                  <div className={`flex flex-col items-end px-3 py-1.5 rounded-lg border ${
                    Number(customerPaid) >= (watch('grandTotal') || 0)
                      ? 'bg-green-900/40 border-green-500'
                      : 'bg-red-900/40 border-red-500'
                  }`}>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${
                      Number(customerPaid) >= (watch('grandTotal') || 0) ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {Number(customerPaid) >= (watch('grandTotal') || 0) ? 'Change / Return' : 'Short by'}
                    </span>
                    <span className={`text-[24px] font-black leading-none ${
                      Number(customerPaid) >= (watch('grandTotal') || 0) ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(Math.abs(Number(customerPaid) - (watch('grandTotal') || 0)))}
                    </span>
                  </div>
                )}

              </div>
            </div>

          </div>
        </form>
      </div>

      {/* ─── MOBILE VIEW (< MD) ─── */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden relative bg-[#F3F4F6]">

        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-[#0B4A3F] to-[#047857] text-white px-3.5 py-3 shrink-0 shadow-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Home"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-base font-extrabold text-white leading-tight">Service Sales</h1>
                <p className="text-[11px] text-[#A7F3D0] font-medium flex items-center gap-1">
                  <span>Inv:</span>
                  <span className="font-mono font-bold text-white">{nextInvoiceNo || '...'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {validMobileCartItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleMobileClear}
                  className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 text-red-200 px-2 py-1 rounded-lg text-[11px] font-bold active:bg-red-500/30 transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/services/sales-list')}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                title="Bills List"
              >
                <List size={14} />
                <span>Bills</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="px-3 py-2 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 h-10 gap-2">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              placeholder="Search service name..."
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none font-medium"
            />
            {mobileSearch.length > 0 && (
              <button type="button" onClick={() => setMobileSearch('')} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Services Catalog Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-24">
          <div className="flex justify-between items-center px-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Available Services ({filteredServiceItems.length})
            </p>
            <span className="text-[11px] text-[#047857] font-semibold">Tap to add</span>
          </div>

          {filteredServiceItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
              <Scissors size={32} className="text-gray-300 mb-2" />
              <p className="text-sm font-semibold">No services found</p>
              <p className="text-xs text-gray-400 mt-1">Try another search term</p>
            </div>
          ) : (
            filteredServiceItems.map((svc: any) => {
              const inCart = validMobileCartItems.find((c: any) => Number(c.serviceItemId) === Number(svc.id));
              const rate = Number(svc.rate) || 0;

              return (
                <div
                  key={svc.id}
                  onClick={() => handleMobileAddToCart(svc)}
                  className={`bg-white rounded-xl p-3.5 border shadow-xs flex items-center justify-between transition-all select-none active:scale-[0.99] cursor-pointer ${
                    inCart ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">{svc.name}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="bg-emerald-50 text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        Service
                      </span>
                      {enableTax && svc.taxPercent > 0 && (
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                          Tax {svc.taxPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-base font-extrabold text-[#047857]">
                      {formatCurrency(rate)}
                    </span>
                    {inCart ? (
                      <div className="flex items-center gap-1 bg-emerald-100 text-[#047857] px-2.5 py-1 rounded-lg font-black text-xs">
                        <ShoppingCart size={13} />
                        <span>{inCart.quantity} in bill</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white shadow-xs bg-[#047857] hover:bg-[#065F46]">
                        <Plus size={13} />
                        <span>Add</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Floating Cart Bar */}
        {validMobileCartItems.length > 0 && (
          <div
            onClick={() => setIsMobileCheckoutOpen(true)}
            className="fixed bottom-4 left-3 right-3 z-30 bg-[#0B4A3F] text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform border border-emerald-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="relative bg-white/15 text-white p-2 rounded-xl">
                <ShoppingCart size={20} />
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0B4A3F]">
                  {mobileCartTotalQty}
                </span>
              </div>
              <div>
                <p className="text-lg font-black leading-tight text-white">
                  {formatCurrency(watch('grandTotal') || 0)}
                </p>
                <p className="text-xs text-[#A7F3D0] font-medium">
                  {validMobileCartItems.length} service{validMobileCartItems.length !== 1 ? 's' : ''} in bill
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 px-3.5 py-2 rounded-xl font-bold text-sm text-white shadow-sm">
              <span>Checkout</span>
              <ChevronRight size={18} />
            </div>
          </div>
        )}

        {/* Mobile Checkout Drawer / Bottom Sheet */}
        {isMobileCheckoutOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
              
              {/* Drawer Top Header */}
              <div className="flex justify-between items-center px-4 py-3.5 border-b border-gray-100 bg-[#F0FDF4] shrink-0">
                <div>
                  <h3 className="text-base font-extrabold text-[#064E3B] flex items-center gap-1.5">
                    <Scissors size={18} className="text-[#047857]" />
                    <span>Bill Checkout</span>
                  </h3>
                  <p className="text-[11px] text-gray-500">Invoice: <span className="font-mono font-bold text-gray-800">{nextInvoiceNo || 'Generating...'}</span></p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileCheckoutOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Items in Bill */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Services ({validMobileCartItems.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsMobileCheckoutOpen(false)}
                      className="text-xs text-[#047857] font-bold hover:underline"
                    >
                      + Add More
                    </button>
                  </div>

                  <div className="space-y-2">
                    {validMobileCartItems.map((item) => {
                      const discPercent = Number(item.discPercent) || 0;
                      return (
                        <div key={item.originalIndex} className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 pr-2">
                              <p className="text-sm font-bold text-gray-900 leading-snug">{item.serviceName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">
                                  Rate: {formatCurrency(item.rate)}
                                </span>
                                {discPercent > 0 && (
                                  <span className="text-[11px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.2 rounded border border-red-100">
                                    {discPercent}% off
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-[#047857]">
                                {formatCurrency(item.total)}
                              </p>
                            </div>
                          </div>

                          {/* Editable Row Values (Disc %, Qty) */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200/80 gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-gray-500 font-bold">Disc %:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={item.discPercent}
                                onChange={(e) => {
                                  setValue(`items.${item.originalIndex}.discPercent`, Number(e.target.value) || 0);
                                  recalcRow(item.originalIndex);
                                }}
                                className="w-14 px-1.5 py-1 border border-gray-300 bg-white rounded text-xs text-center font-bold outline-none focus:border-[#047857]"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleMobileMinusQty(item.originalIndex)}
                                className="text-red-500 hover:text-red-600 active:scale-90 transition-transform p-1"
                              >
                                <MinusCircle size={22} />
                              </button>
                              <span className="text-base font-extrabold text-gray-800 min-w-[28px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleMobilePlusQty(item.originalIndex)}
                                className="text-emerald-600 hover:text-emerald-700 active:scale-90 transition-transform p-1"
                              >
                                <PlusCircle size={22} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMobileDeleteItem(item.originalIndex)}
                                className="ml-1 text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Remove item"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Customer Selector */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                    <User size={13} /> Customer <span className="font-normal text-gray-400">(optional)</span>
                  </p>
                  <select
                    value={watch('customerId') || ''}
                    onChange={(e) => setValue('customerId', Number(e.target.value) || undefined)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#059669] bg-gray-50 font-medium text-gray-800"
                  >
                    <option value="">Walk-in / Cash Customer</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Mode Pills */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                    <CreditCard size={13} /> Payment Mode *
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {paymentModes.map((pm: any) => {
                      const isSelected = Number(watch('paymentModeId')) === Number(pm.id);
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setValue('paymentModeId', pm.id)}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all min-w-[70px] ${
                            isSelected
                              ? 'bg-[#047857] border-[#047857] text-white shadow-sm'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pm.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                      <Calendar size={13} /> Entry Date
                    </label>
                    <input
                      {...register('date')}
                      type="date"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#047857] bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                      Notes
                    </label>
                    <input
                      {...register('notes')}
                      placeholder="Optional notes..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#047857] bg-gray-50"
                    />
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="bg-[#F0FDF4] rounded-2xl p-4 border border-emerald-200 space-y-2">
                  <div className="flex justify-between text-xs text-gray-600 font-semibold">
                    <span>Gross Amount:</span>
                    <span className="text-gray-900 font-bold">{formatCurrency(watch('grossAmount') || 0)}</span>
                  </div>
                  {Number(watch('totalDiscount')) > 0 && (
                    <div className="flex justify-between text-xs text-red-600 font-semibold">
                      <span>Total Discount:</span>
                      <span>- {formatCurrency(watch('totalDiscount') || 0)}</span>
                    </div>
                  )}
                  {enableTax && Number(watch('totalTax')) > 0 && (
                    <div className="flex justify-between text-xs text-gray-600 font-semibold">
                      <span>Total Tax:</span>
                      <span className="text-gray-900 font-bold">{formatCurrency(watch('totalTax') || 0)}</span>
                    </div>
                  )}
                  <div className="border-t border-emerald-200 pt-2.5 flex justify-between items-center">
                    <span className="text-sm font-extrabold text-[#064E3B] uppercase tracking-wide">GRAND TOTAL:</span>
                    <span className="text-2xl font-black text-[#047857]">
                      {formatCurrency(watch('grandTotal') || 0)}
                    </span>
                  </div>
                </div>

                {/* Customer Paid & Change */}
                <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700 uppercase">Customer Paid:</span>
                    <div className="relative w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs pointer-events-none">{settings?.currencySymbol || '₹'}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customerPaid}
                        onChange={(e) => setCustomerPaid(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-right font-black text-sm text-gray-900 outline-none focus:border-[#047857] bg-white"
                      />
                    </div>
                  </div>

                  {Number(customerPaid) > 0 && (
                    <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-xs font-bold ${
                      Number(customerPaid) >= (watch('grandTotal') || 0)
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                      <span>{Number(customerPaid) >= (watch('grandTotal') || 0) ? 'Change / Return:' : 'Short by:'}</span>
                      <span className="text-sm font-black">
                        {formatCurrency(Math.abs(Number(customerPaid) - (watch('grandTotal') || 0)))}
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Submit Action */}
              <div className="p-3.5 bg-white border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={handleSubmit(onSubmit as any, onFormError)}
                  className="w-full bg-[#047857] hover:bg-[#065F46] active:scale-[0.99] text-white font-extrabold py-3.5 rounded-2xl flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/20 text-base transition-all disabled:opacity-50"
                >
                  <CheckCircle size={18} />
                  <span>{createMutation.isPending ? 'Saving Bill...' : 'Save & Print Bill'}</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Print Modal */}
      {isPrintOpen && savedSale && (
        <ServiceReceiptPrintModal
          isOpen={isPrintOpen}
          onClose={() => { setIsPrintOpen(false); setSavedSale(null); }}
          sale={savedSale}
          autoPrint={true}
        />
      )}
    </div>
  );
};

export default ServiceSalesEntry;
