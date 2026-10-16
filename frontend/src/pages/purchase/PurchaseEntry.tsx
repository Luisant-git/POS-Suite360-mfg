import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { List, Plus, Trash2, CheckCircle, PlusCircle, X, RotateCcw, FileText, Save, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import SearchableSelect from '../../components/SearchableSelect';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import ShortcutHelpButton from '../../components/ShortcutHelp';
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

const purchaseItemSchema = z.object({
  productId: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  unit: z.string().optional(),
  pRate: z.coerce.number().min(0),
  wRate: z.coerce.number().min(0),
  sRate: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  discPercent: z.coerce.number().min(0).max(100),
  discAmt: z.coerce.number().min(0),
  tax: z.coerce.number().optional(),
  total: z.coerce.number(),
}).superRefine((data, ctx) => {
  if (data.productId > 0) {
    if (data.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantity must be > 0",
        path: ["quantity"]
      });
    }
    if (data.pRate < 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Purchase Rate is required",
        path: ["pRate"]
      });
    }
  }
});

const purchaseSchema = z.object({
  supplierId: z.coerce.number().min(1, 'Supplier is required').or(z.literal(0)),
  invoiceNo: z.string(),
  invoiceDate: z.string().optional(),
  entryNo: z.string(),
  date: z.string(),
  paymentModeId: z.coerce.number().min(1, 'Payment Mode is required').or(z.literal(0)),

  totalAmount: z.coerce.number(),
  totalDiscount: z.coerce.number(),
  totalDiscountPercent: z.coerce.number().optional(),
  transportCharge: z.coerce.number().optional(),
  wages: z.coerce.number().optional(),
  tax: z.coerce.number().optional(),
  roundOff: z.coerce.number(),
  netAmount: z.coerce.number(),

  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

const PurchaseEntry = () => {
  const { settings, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', address: '', state: '' });

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState<any>(null);
  const printAfterSaveRef = useRef(false);

  const focusCell = (row: number, col: number) => {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
      if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
    }, 10);
  };

  const handleCellKey = (e: React.KeyboardEvent, rowIndex: number, col: number, totalCols: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = rowIndex + 1;
      if (nextRow < fields.length) {
        setTimeout(() => {
          const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${nextRow}"] input`);
          if (selectEl) selectEl.focus();
        }, 80);
      } else {
        append({ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 });
        setTimeout(() => {
          const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${nextRow}"] input`);
          if (selectEl) selectEl.focus();
        }, 100);
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextCol = col + 1;
      if (nextCol <= totalCols) {
        focusCell(rowIndex, nextCol);
      } else {
        const nextRow = rowIndex + 1;
        if (nextRow < fields.length) {
          setTimeout(() => {
            const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${nextRow}"] input`);
            if (selectEl) selectEl.focus();
          }, 80);
        } else {
          append({ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 });
          setTimeout(() => {
            const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${nextRow}"] input`);
            if (selectEl) selectEl.focus();
          }, 100);
        }
      }
    } else if (e.key === 'ArrowRight') {
      if ((e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) {
        e.preventDefault();
        const nextCol = col + 1;
        if (nextCol <= totalCols) focusCell(rowIndex, nextCol);
      }
    } else if (e.key === 'ArrowLeft') {
      if ((e.target as HTMLInputElement).selectionStart === 0) {
        e.preventDefault();
        const prevCol = col - 1;
        if (prevCol >= 1) focusCell(rowIndex, prevCol);
        else if (prevCol === 0) {
          const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${rowIndex}"] input`);
          if (selectEl) selectEl.focus();
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) focusCell(rowIndex - 1, col);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex < fields.length - 1) focusCell(rowIndex + 1, col);
    } else if (e.ctrlKey && e.key === 'Delete') {
      e.preventDefault();
      if (fields.length > 1) {
        remove(rowIndex);
        setTimeout(() => {
          const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${Math.max(0, rowIndex - 1)}"] input`);
          if (selectEl) selectEl.focus();
        }, 50);
      }
    }
  };

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema) as any,
    defaultValues: {
      entryNo: 'Generating...',
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      supplierId: 0,
      date: new Date().toISOString().split('T')[0],
      paymentModeId: 0,
      items: [{ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 }],
      totalAmount: 0,
      totalDiscountPercent: '' as any,
      totalDiscount: '' as any,
      transportCharge: '' as any,
      wages: '' as any,
      tax: 0,
      roundOff: '' as any,
      netAmount: 0
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  // Fetch Masters & Next Entry No
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api.get('/suppliers')).data });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/products')).data });
  const { data: nextEntryData } = useQuery({ queryKey: ['nextEntryNo'], queryFn: async () => (await api.get('/purchases/next-entry-no')).data });
  const { data: paymentModes = [] } = useQuery({ queryKey: ['paymentModes'], queryFn: async () => (await api.get('/payment-modes')).data });

  // Update default entry no
  useEffect(() => {
    if (nextEntryData?.entryNo) {
      setValue('entryNo', nextEntryData.entryNo);
    }
  }, [nextEntryData, setValue]);

  // Watch values for calculation
  const items = watch('items');
  const watchTotalDiscount = watch('totalDiscount');
  const watchTransportCharge = watch('transportCharge');
  const watchwages = watch('wages');
  const watchRoundOff = watch('roundOff');

  // Calculations
  useEffect(() => {
    let totalAmount = 0;
    let totalTax = 0;

    items.forEach((item, index) => {
      const q = Number(item.quantity) || 0;
      const pRate = Number(item.pRate) || 0;

      let discAmt = Number(item.discAmt) || 0;

      let subtotal = (q * pRate) - discAmt;

      let itemTax = 0;
      if (settings?.enableTax && item.productId > 0) {
        const product = products.find((p: any) => p.id === Number(item.productId));
        if (product && product.taxPercent) {
          const taxPercent = Number(product.taxPercent) || 0;
          if (settings.taxType === 'inclusive') {
            const totalWithTax = subtotal;
            itemTax = totalWithTax - (totalWithTax / (1 + (taxPercent / 100)));
            subtotal = totalWithTax - itemTax;
          } else {
            itemTax = (subtotal * taxPercent) / 100;
          }
        }
      }

      const total = subtotal + itemTax;

      if (item.tax !== itemTax) {
        setValue(`items.${index}.tax`, Number(itemTax.toFixed(2)), { shouldValidate: false });
      }

      if (item.total !== total) {
        setValue(`items.${index}.total`, Number(total.toFixed(2)), { shouldValidate: false });
      }
      totalAmount += subtotal;
      totalTax += itemTax;
    });

    const d = Number(watchTotalDiscount) || 0;
    const tc = Number(watchTransportCharge) || 0;
    const bc = Number(watchwages) || 0;
    const r = Number(watchRoundOff) || 0;
    const netAmount = totalAmount + totalTax - d + tc + bc + r;

    setValue('totalAmount', Number(totalAmount.toFixed(2)));
    setValue('tax', Number(totalTax.toFixed(2)));
    setValue('netAmount', Number(netAmount.toFixed(2)));

  }, [JSON.stringify(items), watchTotalDiscount, watchTransportCharge, watchwages, watchRoundOff, setValue, settings?.enableTax, products]);

  const handleProductChange = async (index: number, productId: string) => {
    const product = products.find((p: any) => p.id === Number(productId));
    if (product) {
      setValue(`items.${index}.unit`, product.unit?.shortCode || product.unit?.name || 'Nos');

      try {
        const response = await api.get(`/purchases/latest-rate/${productId}`);
        const latest = response.data;
        if (latest) {
          setValue(`items.${index}.pRate`, latest.rate || product.purchaseRate || 0);
          setValue(`items.${index}.wRate`, latest.wRate || product.wholesaleRate || 0);
          setValue(`items.${index}.sRate`, latest.sRate || product.sellingRate || 0);
          setValue(`items.${index}.mrp`, latest.mrp || product.mrp || 0);
        } else {
          setValue(`items.${index}.pRate`, product.purchaseRate || 0);
          setValue(`items.${index}.wRate`, product.wholesaleRate || 0);
          setValue(`items.${index}.sRate`, product.sellingRate || 0);
          setValue(`items.${index}.mrp`, product.mrp || 0);
        }
      } catch (e) {
        setValue(`items.${index}.pRate`, product.purchaseRate || 0);
        setValue(`items.${index}.wRate`, product.wholesaleRate || 0);
        setValue(`items.${index}.sRate`, product.sellingRate || 0);
        setValue(`items.${index}.mrp`, product.mrp || 0);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: PurchaseFormValues) => api.post('/purchases', data),
    onSuccess: () => {
      toast.success('Purchase recorded successfully!');

      setTimeout(() => {
        if (printAfterSaveRef.current) {
          window.print();
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['nextEntryNo'] });
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        reset();
        navigate('/purchase');
      }, 100);
    },
    onError: (error) => {
      console.error(error);
      toast.error('Failed to record purchase. Please check your inputs.');
    }
  });

  const onSubmit = (data: PurchaseFormValues) => {
    if (!data.supplierId) {
      toast.error('Please select a Supplier before saving.');
      return;
    }
    if (!data.paymentModeId) {
      toast.error('Please select a Payment Mode before saving.');
      return;
    }

    const validItems = data.items.filter(item => item.productId > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one product before saving.');
      return;
    }

    const payload = {
      ...data,
      supplierInvoiceNo: data.invoiceNo,
      invoiceNo: data.entryNo,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString() : null,
      subtotal: data.totalAmount,
      discount: data.totalDiscount,
      transportCharge: data.transportCharge,
      wages: data.wages,
      tax: data.tax || 0,
      grandTotal: data.netAmount,
      items: validItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        rate: item.pRate,
        wRate: item.wRate,
        sRate: item.sRate,
        mrp: item.mrp,
        tax: item.tax || 0,
        amount: item.total,
      }))
    };

    setPendingSavePayload(payload);
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = (print: boolean) => {
    printAfterSaveRef.current = print;
    setIsSaveModalOpen(false);
    if (pendingSavePayload) {
      createMutation.mutate(pendingSavePayload as any);
      setPendingSavePayload(null);
    }
  };

  const onError = (errors: any) => {
    let errorMessage = 'Validation failed. Please ensure all items have a Rate and Quantity > 0.';

    if (errors.supplierId) {
      errorMessage = 'Please select a Supplier before saving.';
    } else if (errors.paymentModeId) {
      errorMessage = 'Please select a Payment Mode before saving.';
    } else if (errors.items && Array.isArray(errors.items)) {
      for (const item of errors.items) {
        if (item?.quantity?.message === 'Quantity must be > 0') {
          errorMessage = 'Validation failed: Quantity must be greater than 0.';
          break;
        }
        if (item?.pRate?.message === 'Purchase Rate is required' || item?.pRate) {
          errorMessage = 'Validation failed: Rate is required for all items.';
          break;
        }
      }
    } else if (errors.items) {
      errorMessage = 'Please add at least one product before saving.';
    }

    toast.error(errorMessage);
    console.error(errors);
  };

  const handleClear = () => {
    reset({
      entryNo: nextEntryData?.entryNo || 'Generating...',
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      supplierId: 0,
      date: new Date().toISOString().split('T')[0],
      paymentModeId: 0,
      items: [{ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, total: 0 }],
      totalAmount: 0,
      totalDiscountPercent: '' as any,
      totalDiscount: '' as any,
      transportCharge: '' as any,
      wages: '' as any,
      roundOff: '' as any,
      netAmount: 0
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea unless it's a function key or escape

      if (e.key === 'F10') {
        e.preventDefault();
        handleSubmit(onSubmit as any, onError)();
      } else if (e.key === 'Escape') {
        if (isSupplierModalOpen || isSaveModalOpen || isLeaveModalOpen) {
          setIsSupplierModalOpen(false);
          setIsSaveModalOpen(false);
          setIsLeaveModalOpen(false);
        } else {
          setIsLeaveModalOpen(true);
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        append({ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, total: 0 });
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLElement>('[data-row-product] input');
          if (inputs.length > 0) inputs[inputs.length - 1].focus();
        }, 100);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isSupplierModalOpen, isSaveModalOpen, isLeaveModalOpen, append, navigate, onSubmit, onError, handleClear]);

  const addSupplierMutation = useMutation({
    mutationFn: (data: any) => api.post('/suppliers', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsSupplierModalOpen(false);
      setNewSupplier({ name: '', phone: '', address: '', state: '' });
      if (res.data && res.data.id) {
        setValue('supplierId', res.data.id);
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





  // Keyboard shortcuts (F10 Save, Esc Close, F4 Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSubmit(onSubmit as any, onError)();
      } else if (e.key === 'Escape') {
        if (isSupplierModalOpen || isSaveModalOpen || isLeaveModalOpen) {
          setIsSupplierModalOpen(false);
          setIsSaveModalOpen(false);
          setIsLeaveModalOpen(false);
        } else {
          setIsLeaveModalOpen(true);
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isSupplierModalOpen, isSaveModalOpen, isLeaveModalOpen, onSubmit, onError]);

  const selectedSupplierId = watch('supplierId');
  const selectedSupplier = suppliers.find((s: any) => s.id === Number(selectedSupplierId));

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col font-sans overflow-hidden z-10">

      {/* Top Bar */}
      <div className="bg-[#0B355B] text-white px-2 sm:px-4 py-2 flex flex-wrap gap-2 justify-between items-center shrink-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSubmit(onSubmit as any, onError)}
            className="bg-[#059669] hover:bg-[#047857] text-white px-3 sm:px-4 py-2 sm:py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors"
          >
            <CheckCircle size={16} /> <span className="hidden sm:inline">SAVE PURCHASE (F10)</span><span className="sm:hidden">Save</span>
          </button>
        </div>
        <button
          onClick={() => setIsLeaveModalOpen(true)}
          className="text-white hover:text-white/80 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Back (Esc)</span>
        </button>
      </div>

      <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleSubmit(onSubmit as any, onError)}>

        {/* Header Section */}
        <div className="bg-white p-3 sm:p-4 border-b border-[#E5E7EB] shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:flex lg:flex-row gap-2 sm:gap-4">

            <div className="w-full lg:flex-1 lg:max-w-[200px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Entry No *</label>
              <input
                {...register('entryNo')}
                type="text"
                readOnly
                className="w-full px-2 py-1.5 border border-[#D1D5DB] bg-[#F9FAFB] rounded text-[13px] font-bold outline-none"
              />
            </div>

            <div className="w-full lg:flex-1 lg:max-w-[250px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Supplier Invoice number</label>
              <input
                {...register('invoiceNo')}
                type="text"
                placeholder="Supplier Bill No"
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="w-full col-span-2 lg:col-span-1 lg:flex-[2]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Supplier Name (Searchable Dropdown) *</label>
              <div className="flex flex-col gap-1">
                <div className="flex-1 w-full">
                  <SearchableSelect
                    value={watch('supplierId')}
                    onChange={(val) => setValue('supplierId', Number(val))}
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

            <div className="w-full lg:flex-1 lg:max-w-[200px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Invoice date</label>
              <input
                {...register('invoiceDate')}
                type="date"
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="w-full lg:flex-1 lg:max-w-[200px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Entry Date</label>
              <input
                {...register('date')}
                type="date"
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="w-full lg:flex-1 lg:max-w-[200px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Mode</label>
              <select
                {...register('paymentModeId')}
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] bg-white"
              >
                <option value="0">Select Payment Mode...</option>
                {paymentModes.map((pm: any) => (
                  <option key={pm.id} value={pm.id}>{pm.name}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className="entry-action-bar shrink-0 flex flex-wrap justify-end gap-2 p-2 bg-white border-b border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => {
              append({ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, total: 0 });
              setTimeout(() => {
                const inputs = document.querySelectorAll<HTMLElement>('[data-row-product] input');
                if (inputs.length > 0) inputs[inputs.length - 1].focus();
              }, 100);
            }}
            className="border border-[#0B355B] text-[#0B355B] hover:bg-[#0B355B] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <PlusCircle size={14} /> Add Row (F2)
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <RotateCcw size={14} /> Clear (F4)
          </button>
          <button
            type="button"
            onClick={() => navigate('/purchase')}
            className="border border-[#0B355B] text-[#0B355B] hover:bg-[#0B355B] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <List size={14} /> Purchase List
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports/purchase')}
            className="border border-[#0B355B] text-[#0B355B] hover:bg-[#0B355B] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <FileText size={14} /> Purchase Report
          </button>
          <ShortcutHelpButton />
        </div>

        {/* Items Grid */}
        <div className="entry-table-wrapper flex-1 min-h-0 overflow-auto custom-scrollbar bg-white border-b border-[#E5E7EB]">
          <table className="w-full border-collapse border border-[#E5E7EB] whitespace-nowrap md:min-w-[1200px] responsive-table">
            <thead>
              <tr className="bg-[#0F172A] text-white">
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-10">#</th>
                <th className="px-2 py-2 text-left text-[12px] font-bold border border-[#334155]">Item Code / Name</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Qty</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Unit</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">PRate</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">WRate</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">SRate</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">MRP</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Disc %</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">Disc Amt</th>
                {settings?.enableTax && (
                  <>
                    <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Tax %</th>
                    <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">Tax Amt</th>
                  </>
                )}
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-28">Total</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-16">Act</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <td data-label="#" className="px-2 py-1 text-center text-[13px] border-r border-[#E5E7EB]">{index + 1}</td>
                  <td data-label="Product" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <div data-row-product={index} onKeyDownCapture={(e) => {
                      if (e.ctrlKey && e.key === 'Delete' && fields.length > 1) {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(index);
                        setTimeout(() => {
                          const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${Math.max(0, index - 1)}"] input`);
                          if (selectEl) selectEl.focus();
                        }, 50);
                      }
                    }}>
                      <SearchableSelect
                        value={watch(`items.${index}.productId`)}
                        autoFocus={index === fields.length - 1 && watch(`items.${index}.productId`) === 0}
                        onChange={(val) => {
                          setValue(`items.${index}.productId`, Number(val));
                          handleProductChange(index, String(val));
                          if (Number(val) === 0) {
                            if (index === fields.length - 1) {
                              append({ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, total: 0 });
                              setTimeout(() => {
                                const inputs = document.querySelectorAll<HTMLElement>('[data-row-product] input');
                                if (inputs.length > 0) inputs[inputs.length - 1].focus();
                              }, 100);
                            } else {
                              setTimeout(() => {
                                const selectEl = document.querySelector<HTMLElement>(`[data-row-product="${index + 1}"] input`);
                                if (selectEl) selectEl.focus();
                              }, 100);
                            }
                          } else {
                            setTimeout(() => focusCell(index, 1), 100);
                          }
                        }}
                        options={[
                          { label: 'Type product name / code...', value: 0 },
                          ...products.map((p: any) => ({ label: `${p.code} - ${p.name}`, value: p.id }))
                        ]}
                      />
                    </div>
                  </td>
                  <td data-label="Qty" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.quantity`)}
                      data-row={index} data-col={1}
                      type="number" min="1" placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 1, 7)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-center"
                    />
                  </td>
                  <td data-label="Unit" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input {...register(`items.${index}.unit`)} type="text" readOnly tabIndex={-1} className="w-full px-1 py-1 bg-transparent text-[13px] outline-none text-center" />
                  </td>
                  <td data-label="PRate" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.pRate`)}
                      data-row={index} data-col={2}
                      type="number" step="0.01" placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 2, 7)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right"
                    />
                  </td>
                  <td data-label="WRate" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.wRate`)}
                      data-row={index} data-col={3}
                      type="number" step="0.01" placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 3, 7)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right"
                    />
                  </td>
                  <td data-label="SRate" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.sRate`)}
                      data-row={index} data-col={4}
                      type="number" step="0.01" placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 4, 7)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right"
                    />
                  </td>
                  <td data-label="MRP" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.mrp`)}
                      data-row={index} data-col={5}
                      type="number" step="0.01" placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 5, 7)}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right"
                    />
                  </td>
                  <td data-label="Disc %" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.discPercent`)}
                      data-row={index} data-col={6}
                      type="number" step="0.01" placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 6, 7)}
                      onChange={(e) => {
                        register(`items.${index}.discPercent`).onChange(e);
                        const pct = Number(e.target.value) || 0;
                        const rate = Number(watch(`items.${index}.pRate`)) || 0;
                        const q = Number(watch(`items.${index}.quantity`)) || 0;
                        const amt = (rate * q * pct) / 100;
                        setValue(`items.${index}.discAmt`, Number(amt.toFixed(2)));
                      }}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right"
                    />
                  </td>
                  <td data-label="Disc Amt" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.discAmt`)}
                      data-row={index} data-col={7}
                      type="number" step="0.01" placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 7, 7)}
                      onChange={(e) => {
                        register(`items.${index}.discAmt`).onChange(e);
                        const amt = Number(e.target.value) || 0;
                        const rate = Number(watch(`items.${index}.pRate`)) || 0;
                        const q = Number(watch(`items.${index}.quantity`)) || 0;
                        const totalGross = rate * q;
                        if (totalGross > 0) {
                          const pct = (amt / totalGross) * 100;
                          setValue(`items.${index}.discPercent`, Number(pct.toFixed(2)));
                        } else {
                          setValue(`items.${index}.discPercent`, 0);
                        }
                      }}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 transition-colors text-right"
                    />
                  </td>
                  {settings?.enableTax && (
                    <>
                      <td data-label="Tax %" className="px-2 py-1 border-r border-[#E5E7EB] bg-gray-50">
                        <div className="w-full px-2 py-1 bg-transparent border-none text-[13px] text-center text-gray-500 font-bold outline-none">
                          {products.find((p: any) => p.id === watch(`items.${index}.productId`))?.taxPercent || 0}%
                        </div>
                      </td>
                      <td data-label="Tax Amt" className="px-2 py-1 border-r border-[#E5E7EB]">
                        <input
                          {...register(`items.${index}.tax`)}
                          type="number" step="0.01" readOnly tabIndex={-1}
                          className="w-full px-2 py-1 bg-transparent border-none text-[13px] text-right text-gray-500 outline-none"
                        />
                      </td>
                    </>
                  )}
                  <td data-label="Total" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input {...register(`items.${index}.total`)} type="number" readOnly tabIndex={-1} className="w-full px-2 py-1 bg-transparent text-[13px] outline-none text-right font-bold" />
                  </td>
                  <td data-label="Action" className="px-2 py-1 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => append({ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, total: 0 })}
                        className="bg-[#10B981] text-white p-1.5 rounded hover:bg-[#059669] transition-colors shadow-sm"
                        title="Add Row"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
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
          <div className="entry-footer-totals flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-6">

            <div className="w-full md:flex-1 flex flex-col gap-1">
              <label className="text-[14px] font-extrabold text-[#1F2937] uppercase">Total Quantity:</label>
              <input
                value={watch('items').reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)}
                readOnly
                className="w-full px-3 py-2 border border-[#D1D5DB] bg-[#F9FAFB] rounded text-[20px] outline-none text-right font-black text-[#1F2937]"
              />
            </div>

            <div className="w-full md:flex-1 flex flex-col gap-1">
              <label className="text-[14px] font-extrabold text-[#1F2937] uppercase">Total Amount:</label>
              <input
                {...register('totalAmount')}
                type="number"
                readOnly
                className="w-full px-3 py-2 border border-[#D1D5DB] bg-[#F9FAFB] rounded text-[20px] outline-none text-right font-black text-[#1F2937]"
              />
            </div>

            <div className="w-full md:flex-1 flex flex-col gap-1">
              <label className="text-[14px] font-extrabold text-[#1F2937] uppercase">Total Discount:</label>
              <div className="flex gap-2 w-full">
                <div className="relative w-1/2">
                  <input
                    {...register('totalDiscountPercent')}
                    type="number"
                    step="0.01"
                    onChange={(e) => {
                      register('totalDiscountPercent').onChange(e);
                      const percent = Number(e.target.value) || 0;
                      const amount = (watch('totalAmount') * percent) / 100;
                      setValue('totalDiscount', Number(amount.toFixed(2)));
                    }}
                    className="w-full pl-2 pr-6 py-2 border border-[#D1D5DB] rounded text-[16px] outline-none focus:border-[#3B82F6] text-right font-black text-[#1F2937]"
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-800 font-black text-[14px] pointer-events-none">%</span>
                </div>
                <div className="relative w-1/2">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-800 font-black text-[14px] pointer-events-none">{settings?.currencySymbol || 'RM'}</span>
                  <input
                    {...register('totalDiscount')}
                    type="number"
                    step="0.01"
                    onChange={(e) => {
                      register('totalDiscount').onChange(e);
                      const amt = Number(e.target.value) || 0;
                      const totalAmt = watch('totalAmount');
                      if (totalAmt > 0) {
                        setValue('totalDiscountPercent', Number(((amt / totalAmt) * 100).toFixed(2)));
                      } else {
                        setValue('totalDiscountPercent', 0);
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2 border border-[#D1D5DB] rounded text-[16px] outline-none focus:border-[#3B82F6] text-right font-black text-[#EF4444]"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="w-full md:flex-[2] flex flex-col sm:flex-row gap-4 sm:gap-6 justify-end items-end">
              <div className="w-full sm:w-32 flex flex-col gap-1">
                <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Transport Chg.</label>
                <input
                  {...register('transportCharge')}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-[#D1D5DB] bg-white focus:bg-[#F0FDF4] rounded text-[16px] outline-none text-right font-black focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] text-black"
                  placeholder="0.00"
                />
              </div>

              <div className="w-full sm:w-32 flex flex-col gap-1">
                <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Wages</label>
                <input
                  {...register('wages')}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-[#D1D5DB] bg-white focus:bg-[#F0FDF4] rounded text-[16px] outline-none text-right font-black focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] text-black"
                  placeholder="0.00"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0 mt-auto shrink-0">
          <div className="flex flex-nowrap justify-between sm:justify-center gap-1 sm:gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => append({ productId: 0, quantity: '' as any, unit: 'Nos', pRate: '' as any, wRate: '' as any, sRate: '' as any, mrp: '' as any, discPercent: '' as any, discAmt: '' as any, total: 0 })}
              className="bg-[#2563EB] text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer hover:bg-[#1D4ED8] whitespace-nowrap"
            >
              <span className="opacity-70 border-r border-[#60A5FA] pr-1 mr-1">F2</span> Add Row
            </button>

            <button
              type="button"
              disabled={createMutation.isPending}
              className="bg-[#059669] text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer hover:bg-[#047857] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              onClick={handleSubmit(onSubmit as any, onError)}
            >
              <span className="opacity-70 border-r border-[#34D399] pr-1 mr-1">F10</span>
              {createMutation.isPending ? 'Saving...' : 'Save Purchase'}
            </button>
            <button
              type="button"
              className="bg-[#0891B2] text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer hover:bg-[#0E7490] whitespace-nowrap"
              onClick={() => setIsLeaveModalOpen(true)}
            >
              <span className="opacity-70 border-r border-[#67E8F9] pr-1 mr-1">Esc</span> Dashboard
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto justify-between md:justify-end border-t border-gray-200 md:border-none pt-3 md:pt-0">
            <span className="text-[16px] sm:text-[20px] font-extrabold text-[#1F2937] uppercase tracking-wider">NET PURCHASE AMOUNT:</span>
            <span className="entry-net-amount text-[28px] sm:text-[36px] font-black text-[#059669]">
              {formatCurrency(watch('netAmount') || 0)}
            </span>
          </div>
        </div>

      </form>

      {/* Quick Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-[#059669] text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-[15px]">
                <Plus size={18} /> Quick Add New Supplier
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
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[13px] text-[#4B5563] mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[13px] text-[#4B5563] mb-1">State {settings?.enableTax && <span className="text-red-500">*</span>}</label>
                <Select
                  value={newSupplier.state ? { value: newSupplier.state, label: newSupplier.state } : null}
                  onChange={(val: any) => setNewSupplier({ ...newSupplier, state: val?.value || '' })}
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
                <label className="block text-[13px] text-[#4B5563] mb-1">Address</label>
                <textarea
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
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
                <CheckCircle size={16} /> Save Supplier & Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all scale-100">
            <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-[16px]">
                <Save size={20} /> Confirm Save Transaction
              </div>
              <button type="button" onClick={() => setIsSaveModalOpen(false)} className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 text-center">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 shadow-sm border border-blue-100">
                <p className="font-bold text-[15px]">Net Amount: {formatCurrency(pendingSavePayload?.grandTotal || 0)}</p>
                <p className="text-[13px] mt-1 text-blue-600">Supplier Invoice No: {pendingSavePayload?.supplierInvoiceNo}</p>
              </div>
              <p className="text-[#334155] font-medium mb-2">How would you like to proceed?</p>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => handleConfirmSave(false)}
                className="w-full bg-[#10B981] hover:bg-[#059669] text-white py-2.5 rounded-lg font-bold text-[14px] transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Save size={16} /> Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      <LeaveConfirmModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={() => navigate('/purchase')}
      />

    </div>
  );
};

export default PurchaseEntry;
