import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, RefreshCw, List, Scissors, FileText } from 'lucide-react';
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
      reset({ date: todayStr, paymentModeId: 0, notes: '', grossAmount: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0, items: [defaultItem] });
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

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">

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
