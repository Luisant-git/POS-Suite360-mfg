import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Save, X, Printer, RefreshCw, List, UserPlus, AlertTriangle, FileText, Search, ShoppingCart, User, CheckCircle, MinusCircle, PlusCircle, ChevronRight } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import ShortcutHelpButton from '../../components/ShortcutHelp';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import Select from 'react-select';
// @ts-ignore
import html2pdf from 'html2pdf.js';

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

const numberToWords = (num: number): string => {
  if (!num || num === 0) return "ZERO";
  const a = ["", "ONE ", "TWO ", "THREE ", "FOUR ", "FIVE ", "SIX ", "SEVEN ", "EIGHT ", "NINE ", "TEN ", "ELEVEN ", "TWELVE ", "THIRTEEN ", "FOURTEEN ", "FIFTEEN ", "SIXTEEN ", "SEVENTEEN ", "EIGHTEEN ", "NINETEEN "];
  const b = ["", "", "TWENTY ", "THIRTY ", "FORTY ", "FIFTY ", "SIXTY ", "SEVENTY ", "EIGHTY ", "NINETY "];

  const convertWhole = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + "HUNDRED " + (n % 100 !== 0 ? convertWhole(n % 100) : "");
    if (n < 1000000) return convertWhole(Math.floor(n / 1000)) + "THOUSAND " + (n % 1000 !== 0 ? convertWhole(n % 1000) : "");
    return n.toString(); // Fallback for very large numbers
  };

  const wholePart = Math.floor(Number(num));
  const cents = Math.round((Number(num) - wholePart) * 100);

  let res = convertWhole(wholePart) || "";
  if (cents > 0) {
    res += `AND CENTS ${convertWhole(cents) || ""}`;
  }
  return res ? res.trim() : "";
};

const estimationItemSchema = z.object({
  productId: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  stock: z.coerce.number(),
  rate: z.coerce.number().min(0),
  unit: z.string().optional().nullable(),
  discPercent: z.coerce.number().min(0).max(100),
  discAmt: z.coerce.number().min(0),
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
    if (data.rate < 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rate is required",
        path: ["rate"]
      });
    }
    if (data.quantity > data.stock) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Qty > Stock",
        path: ["quantity"]
      });
    }
  }
});

const estimationSchema = z.object({
  customerId: z.coerce.number().min(1, 'Customer is required').or(z.literal(0)),
  estimationNo: z.string(),
  date: z.string(),
  rateType: z.string(),
  paymentModeId: z.coerce.number().min(1, 'Payment Mode is required').or(z.literal(0)),

  grossAmount: z.coerce.number(),
  totalDiscount: z.coerce.number(),
  totalDiscountPercent: z.coerce.number().optional(),
  roundOff: z.coerce.number(),
  netAmount: z.coerce.number(),

  items: z.array(estimationItemSchema).min(1, 'At least one item is required'),
});

type EstimationFormValues = z.infer<typeof estimationSchema>;

const Estimation = () => {
  const { settings, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const queryClient = useQueryClient();

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', state: '' });
  const activeTab = 'Amount Details';

  const [showLossWarning, setShowLossWarning] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState<any>(null);
  const printAfterSaveRef = useRef(false);

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
      if (nextRow < fields.length) {
        focusCell(nextRow, 0);
      } else {
        append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
        setTimeout(() => focusCell(nextRow, 0), 80);
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextCol = col + 1;
      if (nextCol < totalCols) focusCell(rowIndex, nextCol);
      else {
        const nextRow = rowIndex + 1;
        if (nextRow < fields.length) focusCell(nextRow, 0);
        else {
          append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
          setTimeout(() => focusCell(nextRow, 0), 80);
        }
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
      if (fields.length > 1) {
        remove(rowIndex);
        setTimeout(() => focusCell(Math.min(rowIndex, fields.length - 2), col), 50);
      }
    }
  };

  const { register, control, handleSubmit, watch, setValue, getValues, reset } = useForm<EstimationFormValues>({
    resolver: zodResolver(estimationSchema) as any,
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      estimationNo: 'Generating...',
      customerId: 0,
      rateType: 'Retail Rate',
      paymentModeId: 0,
      items: [{ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 }],
      grossAmount: 0,
      totalDiscountPercent: '' as any,
      totalDiscount: '' as any,
      roundOff: '' as any,
      netAmount: 0
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  // Fetch Masters & Next Estimation
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: async () => (await api.get('/customers')).data });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/products')).data });
  const { data: paymentModes = [] } = useQuery({ queryKey: ['paymentModes'], queryFn: async () => (await api.get('/payment-modes')).data });
  const { data: nextEstimationData } = useQuery({ queryKey: ['nextEstimationNo'], queryFn: async () => (await api.get('/estimations/next-estimation-no')).data });

  const { data: editEstimationData } = useQuery({
    queryKey: ['estimation', editId],
    queryFn: async () => (await api.get(`/estimations/${editId}`)).data,
    enabled: !!editId,
  });

  // Pre-fill from edit
  useEffect(() => {
    if (editEstimationData && editEstimationData.items) {
      setValue('customerId', editEstimationData.customerId);
      setValue('estimationNo', editEstimationData.estimationNo);
      setValue('date', editEstimationData.date ? new Date(editEstimationData.date).toISOString().split('T')[0] : '');
      setValue('grossAmount', Number(editEstimationData.subtotal));
      setValue('totalDiscount', Number(editEstimationData.discount));
      setValue('netAmount', Number(editEstimationData.grandTotal));

      const posItems = editEstimationData.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        stock: item.product?.currentStock || 0,
        rate: Number(item.rate),
        unit: item.product?.unit?.shortCode || 'Nos',
        discPercent: 0,
        discAmt: Number(item.discount),
        tax: 0,
        total: Number(item.amount)
      }));
      setValue('items', posItems);
    }
  }, [editEstimationData, setValue]);

  // Update default estimation no
  useEffect(() => {
    if (nextEstimationData?.estimationNo && !editId) {
      setValue('estimationNo', nextEstimationData.estimationNo);
    }
  }, [nextEstimationData, setValue, editId]);


  // Auto-focus first row product on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-row-product="0"]');
      el?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const items = watch('items');
  const watchTotalDiscount = watch('totalDiscount');
  const watchRoundOff = watch('roundOff');
  const selectedCustomerId = watch('customerId');

  const selectedCustomer = customers.find((c: any) => c.id === Number(selectedCustomerId));
  const watchPaymentModeId = watch('paymentModeId');
  const isCashMode = paymentModes.find((p: any) => p.id === Number(watchPaymentModeId))?.name?.toLowerCase() === 'cash';

  // Calculations
  useEffect(() => {
    let grossAmount = 0;
    let totalTax = 0;

    items.forEach((item, index) => {
      const q = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;

      let discAmt = Number(item.discAmt) || 0;

      let subtotal = (q * rate) - discAmt;

      let itemTax = 0;

      const total = subtotal + itemTax;

      if (item.total !== total) {
        setValue(`items.${index}.total`, Number(total.toFixed(2)), { shouldValidate: false });
      }
      grossAmount += subtotal;
      totalTax += itemTax;
    });

    const d = Number(watchTotalDiscount) || 0;
    const r = Number(watchRoundOff) || 0;
    const netAmount = grossAmount + totalTax - d + r;

    setValue('grossAmount', Number(grossAmount.toFixed(2)));

    setValue('netAmount', Number(netAmount.toFixed(2)));

  }, [JSON.stringify(items), watchTotalDiscount, watchRoundOff, setValue, settings?.enableTax, products]);

  // Product change handler
  const handleProductChange = async (index: number, productId: string) => {
    const product = products.find((p: any) => p.id === Number(productId));
    if (product) {
      setValue(`items.${index}.stock`, product.currentStock || 0);
      setValue(`items.${index}.unit`, product.unit?.shortCode || product.unit?.name || 'Nos');

      const rateType = getValues('rateType');
      let rate = Number(product.sellingRate) || 0;
      if (rateType === 'Wholesale Rate') rate = Number(product.wholesaleRate) || 0;
      else if (rateType === 'MRP') rate = Number(product.mrp) || 0;

      // Override with custom customer rate if enabled
      if (settings?.enableCustomerWiseRate && selectedCustomer?.productRates) {
        const customRate = selectedCustomer.productRates.find((pr: any) => pr.productId === product.id);
        if (customRate && customRate.rate > 0) {
          rate = Number(customRate.rate);
        }
      }

      setValue(`items.${index}.rate`, rate > 0 ? rate : ('' as any));
    }
  };

  // Recalculate rates if rateType or selectedCustomer changes
  const watchRateType = watch('rateType');
  useEffect(() => {
    const currentItems = getValues('items');
    currentItems.forEach((item, index) => {
      const product = products.find((p: any) => p.id === Number(item.productId));
      if (product) {
        let rate = Number(product.sellingRate) || 0;
        if (watchRateType === 'Wholesale Rate') rate = Number(product.wholesaleRate) || 0;
        else if (watchRateType === 'MRP') rate = Number(product.mrp) || 0;

        if (settings?.enableCustomerWiseRate && selectedCustomer?.productRates) {
          const customRate = selectedCustomer.productRates.find((pr: any) => pr.productId === product.id);
          if (customRate && customRate.rate > 0) {
            rate = Number(customRate.rate);
          }
        }
        if (Number(item.rate) !== rate) {
          setValue(`items.${index}.rate`, rate > 0 ? rate : ('' as any));
        }
      }
    });
    // Triggers calculation effect indirectly since items changed
  }, [watchRateType, selectedCustomerId, settings?.enableCustomerWiseRate, selectedCustomer]);

  const createMutation = useMutation({
    mutationFn: (data: any) => editId ? api.put(`/estimations/${editId}`, data) : api.post('/estimations', data),
    onSuccess: () => {
      toast.success(editId ? 'Estimation updated successfully!' : 'Estimation recorded successfully!');

      // Conditionally print the bill
      setTimeout(async () => {
        if (printAfterSaveRef.current) {
          window.print();
        }
        reset();

        // Manually fetch and inject the new invoice number for the next estimation
        const res = await api.get('/estimations/next-estimation-no');
        if (res.data?.estimationNo) {
          setValue('estimationNo', res.data.estimationNo);
        }

        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['nextEstimationNo'] });
      }, 100);
    },
    onError: (error) => {
      console.error(error);
      toast.error('Failed to record sale. Please check your inputs.');
    }
  });

  const onSubmit = (data: any) => {
    const selectedPaymentMode = paymentModes.find((p: any) => p.id === Number(data.paymentModeId));
    const isCash = selectedPaymentMode?.name?.toLowerCase() === 'cash';
    if (!data.customerId && !isCash) {
      toast.error('Please select a Customer before saving.');
      return;
    }
    if (!data.paymentModeId) {
      toast.error('Please select a Payment Mode before saving.');
      return;
    }

    const validItems = data.items.filter((item: any) => item.productId > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one product before saving.');
      return;
    }

    const payload = {
      ...data,
      customerId: Number(data.customerId),
      paymentModeId: Number(data.paymentModeId),
      subtotal: Number(data.grossAmount),
      discount: Number(data.totalDiscount),
      grandTotal: Number(data.netAmount),
      items: validItems.map((item: any) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        discount: Number(item.discAmt || 0),
        amount: Number(item.total),
      }))
    };

    const hasLowRate = validItems.some((item: any) => {
      const p = products.find((prod: any) => prod.id === Number(item.productId));
      return p && Number(item.rate) > 0 && Number(item.rate) <= Number(p.purchaseRate);
    });

    if (hasLowRate) {
      setPendingPayload(payload);
      setShowLossWarning(true);
      return;
    }

    setPendingSavePayload(payload);
    setIsSaveModalOpen(true);
  };

  const confirmLossWarning = () => {
    setShowLossWarning(false);
    if (pendingPayload) {
      setPendingSavePayload(pendingPayload);
      setIsSaveModalOpen(true);
      setPendingPayload(null);
    }
  };

  const handleConfirmSave = (print: boolean) => {
    printAfterSaveRef.current = print;
    setIsSaveModalOpen(false);
    if (pendingSavePayload) {
      createMutation.mutate(pendingSavePayload);
      setPendingSavePayload(null);
    }
  };

  const onError = (errors: any) => {
    let errorMessage = 'Validation failed. Please ensure all items have a Rate and Quantity > 0.';

    if (errors.customerId) {
      errorMessage = 'Please select a Customer before saving.';
    } else if (errors.paymentModeId) {
      errorMessage = 'Please select a Payment Mode before saving.';
    } else if (errors.items && Array.isArray(errors.items)) {
      for (const item of errors.items) {
        if (item?.quantity?.message === 'Qty > Stock') {
          errorMessage = 'Validation failed: Quantity exceeds available stock.';
          break;
        }
        if (item?.quantity?.message === 'Quantity must be > 0') {
          errorMessage = 'Validation failed: Quantity must be greater than 0.';
          break;
        }
        if (item?.rate?.message === 'Rate is required') {
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

  const addCustomerMutation = useMutation({
    mutationFn: (data: any) => api.post('/customers', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCustomerModalOpen(false);
      setNewCustomer({ name: '', phone: '', address: '', state: '' });
      if (res.data && res.data.id) {
        setValue('customerId', res.data.id);
      }
    },
    onError: () => {
      toast.error('Failed to add customer.');
    }
  });

  const handleQuickAddCustomer = () => {
    if (!newCustomer.name) return;
    if (settings?.enableTax && !newCustomer.state) {
      toast.error('State is mandatory when Tax is enabled.');
      return;
    }
    addCustomerMutation.mutate(newCustomer);
  };


  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea unless it's a function key or escape

      if (e.key === 'F10') {
        e.preventDefault();
        handleSubmit(onSubmit as any, onError)();
      } else if (e.key === 'Escape') {
        if (isCustomerModalOpen || showLossWarning || isSaveModalOpen || isLeaveModalOpen) {
          setIsCustomerModalOpen(false);
          setShowLossWarning(false);
          setIsSaveModalOpen(false);
          setIsLeaveModalOpen(false);
        } else {
          setIsLeaveModalOpen(true);
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        reset();
      } else if (e.key === 'F2') {
        e.preventDefault();
        append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isCustomerModalOpen, showLossWarning, isSaveModalOpen, isLeaveModalOpen, reset, append, navigate, onSubmit, onError]);

  // ─── Mobile View State & Handlers (Matches mobile/src/app/(tabs)/sales-entry.tsx) ───
  const [mobileSearch, setMobileSearch] = useState('');
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState(false);
  const [isMobileCustomerPickerOpen, setIsMobileCustomerPickerOpen] = useState(false);
  const [mobileCustomerSearch, setMobileCustomerSearch] = useState('');
  const [isMobileEditItemOpen, setIsMobileEditItemOpen] = useState(false);
  const [mobileEditingIndex, setMobileEditingIndex] = useState<number | null>(null);
  const [mobileEditQty, setMobileEditQty] = useState('');
  const [mobileEditRate, setMobileEditRate] = useState('');
  const [mobileEditDiscPct, setMobileEditDiscPct] = useState('');

  // Default payment mode if none selected
  useEffect(() => {
    if (!watch('paymentModeId') && paymentModes.length > 0) {
      const cash = paymentModes.find((m: any) => m.name.toLowerCase() === 'cash');
      setValue('paymentModeId', cash ? cash.id : paymentModes[0].id);
    }
  }, [paymentModes, setValue, watch]);

  const handleMobileAddToCart = (product: any) => {
    const currentItems = getValues('items') || [];
    const existingIdx = currentItems.findIndex((it: any) => Number(it.productId) === Number(product.id));

    if (existingIdx >= 0) {
      const curQty = Number(currentItems[existingIdx].quantity) || 0;
      const newQty = curQty + 1;
      if (newQty > (product.currentStock || 0)) {
        toast.error(`Cannot exceed stock (${product.currentStock})`);
        return;
      }
      setValue(`items.${existingIdx}.quantity`, newQty, { shouldValidate: true });
      const rate = Number(currentItems[existingIdx].rate) || 0;
      const discAmt = Number(currentItems[existingIdx].discAmt) || 0;
      setValue(`items.${existingIdx}.total`, Number(((newQty * rate) - discAmt).toFixed(2)), { shouldValidate: true });
    } else {
      const rateType = getValues('rateType');
      let rate = Number(product.sellingRate) || 0;
      if (rateType === 'Wholesale Rate') rate = Number(product.wholesaleRate) || 0;
      else if (rateType === 'MRP') rate = Number(product.mrp) || 0;

      const newItem = {
        productId: Number(product.id),
        quantity: 1,
        stock: Number(product.currentStock || 0),
        rate: rate > 0 ? rate : 0,
        unit: product.unit?.shortCode || product.unit?.name || 'Nos',
        discPercent: 0,
        discAmt: 0,
        total: rate > 0 ? rate : 0,
      };

      if (currentItems.length === 1 && !currentItems[0].productId) {
        setValue('items.0', newItem, { shouldValidate: true });
      } else {
        append(newItem);
      }
    }
  };

  const handleMobileRemoveOne = (originalIndex: number) => {
    const currentItems = getValues('items') || [];
    const it = currentItems[originalIndex];
    if (!it) return;
    const curQty = Number(it.quantity) || 0;
    if (curQty <= 1) {
      if (currentItems.length === 1) {
        setValue('items.0', { productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 }, { shouldValidate: true });
      } else {
        remove(originalIndex);
      }
    } else {
      const newQty = curQty - 1;
      setValue(`items.${originalIndex}.quantity`, newQty, { shouldValidate: true });
      const rate = Number(it.rate) || 0;
      const discAmt = Number(it.discAmt) || 0;
      setValue(`items.${originalIndex}.total`, Number(((newQty * rate) - discAmt).toFixed(2)), { shouldValidate: true });
    }
  };

  const handleMobileDeleteItem = (originalIndex: number) => {
    const currentItems = getValues('items') || [];
    if (currentItems.length === 1) {
      setValue('items.0', { productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 }, { shouldValidate: true });
    } else {
      remove(originalIndex);
    }
  };

  const handleMobileOpenEdit = (originalIndex: number) => {
    const currentItems = getValues('items') || [];
    const it = currentItems[originalIndex];
    if (!it) return;
    setMobileEditingIndex(originalIndex);
    setMobileEditQty(String(it.quantity || 1));
    setMobileEditRate(String(it.rate || 0));
    setMobileEditDiscPct(String(it.discPercent || 0));
    setIsMobileEditItemOpen(true);
  };

  const handleMobileSaveEdit = () => {
    if (mobileEditingIndex === null) return;
    const qty = parseFloat(mobileEditQty) || 1;
    const rate = parseFloat(mobileEditRate) || 0;
    const discPct = parseFloat(mobileEditDiscPct) || 0;
    const gross = qty * rate;
    const discAmt = parseFloat(((gross * discPct) / 100).toFixed(2));
    const total = parseFloat((gross - discAmt).toFixed(2));

    setValue(`items.${mobileEditingIndex}.quantity`, qty, { shouldValidate: true });
    setValue(`items.${mobileEditingIndex}.rate`, rate, { shouldValidate: true });
    setValue(`items.${mobileEditingIndex}.discPercent`, discPct, { shouldValidate: true });
    setValue(`items.${mobileEditingIndex}.discAmt`, discAmt, { shouldValidate: true });
    setValue(`items.${mobileEditingIndex}.total`, total, { shouldValidate: true });
    setIsMobileEditItemOpen(false);
    setMobileEditingIndex(null);
  };

  const filteredMobileProducts = products.filter((p: any) =>
    (p.name || '').toLowerCase().includes(mobileSearch.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(mobileSearch.toLowerCase())
  );

  const filteredMobileCustomers = customers.filter((c: any) =>
    (c.name || '').toLowerCase().includes(mobileCustomerSearch.toLowerCase()) ||
    (c.phone || '').includes(mobileCustomerSearch)
  );

  const validMobileCartItems = (watch('items') || []).map((it, idx) => ({ ...it, originalIndex: idx })).filter(
    (it: any) => it.productId && Number(it.productId) > 0
  );

  const mobileCartTotalQty = validMobileCartItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col font-sans overflow-hidden z-10 print:static print:block print:overflow-visible print:h-auto print:bg-white">

      {/* ─── DESKTOP VIEW (MD and above) ─── */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-hidden">

        {/* Top Bar */}
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white px-2 sm:px-4 py-2 flex flex-wrap gap-2 justify-between items-center shrink-0 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSubmit(onSubmit as any, onError)}
              className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors"
            >
              <Printer size={16} /> SAVE & PRINT (F10)
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsLeaveModalOpen(true)}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-4 py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors"
          >
            <X size={16} /> Close (Esc)
          </button>
        </div>

        <form className="flex flex-col flex-1 min-h-0 overflow-hidden print:hidden" onSubmit={handleSubmit(onSubmit as any, onError)}>

          {/* Header Section */}
        <div className="bg-white p-3 sm:p-4 border-b border-[#E5E7EB] shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-row gap-3 sm:gap-4">

            <div className="w-full lg:flex-1 lg:max-w-[200px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Entry No</label>
              <input
                {...register('estimationNo')}
                type="text"
                readOnly
                className="w-full px-2 py-1.5 border border-[#D1D5DB] bg-[#F9FAFB] rounded text-[13px] font-bold outline-none"
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

            <div className="w-full lg:flex-[2]">
              <label className="flex justify-between text-[11px] font-bold text-[#1F2937] mb-1">
                <span>Customer Name (Searchable Dropdown) {!isCashMode && <span className="text-red-500">*</span>}</span>
                {isCashMode && <span className="text-[#6B7280] font-bold">(Optional)</span>}
              </label>
              <div className="flex flex-col gap-1">
                <div className="flex-1 w-full">
                  <SearchableSelect
                    value={watch('customerId')}
                    onChange={(val) => setValue('customerId', Number(val))}
                    options={[
                      { label: 'Click or type customer name...', value: 0 },
                      ...customers.filter((c: any) => c.name !== 'Cash Customer').map((c: any) => ({ label: `${c.name} - ${c.phone || ''}`, value: c.id }))
                    ]}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="bg-[#059669] hover:bg-[#047857] text-white px-2 py-1 rounded transition-colors flex items-center gap-1 text-[11px] font-bold">
                    <UserPlus size={12} /> Add Customer
                  </button>
                  <span className="text-[11px] text-[#6B7280] text-right flex-1 ml-2 flex flex-col items-end">
                    {isCashMode && !Number(selectedCustomerId) ? (
                      <span className="text-[#16A34A] font-bold">Saves to Cash Account</span>
                    ) : (
                      <span>{selectedCustomer ? `${selectedCustomer.address || 'Counter Sale'}` : 'Counter Sale'}</span>
                    )}
                    {selectedCustomer?.state && <span className="font-bold text-[#1F2937]">{selectedCustomer.state}</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full lg:flex-1 lg:max-w-[150px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Rate Type</label>
              <select
                {...register('rateType')}
                onChange={(e) => {
                  register('rateType').onChange(e);
                  const newRateType = e.target.value;
                  const currentItems = watch('items');
                  currentItems.forEach((item, index) => {
                    if (item.productId > 0) {
                      const p = products.find((prod: any) => prod.id === Number(item.productId));
                      if (p) {
                        let rate = Number(p.sellingRate) || 0;
                        if (newRateType === 'Wholesale Rate') rate = Number(p.wholesaleRate) || 0;
                        else if (newRateType === 'MRP') rate = Number(p.mrp) || 0;

                        const q = Number(item.quantity) || 0;
                        const total = rate * q;

                        setValue(`items.${index}.rate`, rate > 0 ? rate : ('' as any));
                        if (total > 0) {
                          setValue(`items.${index}.total`, total);
                        }
                      }
                    }
                  });
                }}
                className="w-full px-2 py-1.5 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] bg-white"
              >
                <option value="Retail Rate">Retail Rate</option>
                <option value="Wholesale Rate">Wholesale Rate</option>
                <option value="MRP">MRP</option>
              </select>
            </div>

            <div className="w-full lg:flex-1 lg:max-w-[220px]">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-[#1F2937]">Payment Mode</label>
                <div className="flex gap-1">
                  {paymentModes.filter((pm: any) => ['cash', 'credit'].includes(pm.name?.toLowerCase())).map((pm: any) => {
                    const isCredit = pm.name?.toLowerCase() === 'credit';
                    const isSelected = Number(watch('paymentModeId')) === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setValue('paymentModeId', pm.id);
                          if (pm.name?.toLowerCase() === 'cash') setValue('customerId', 0);
                        }}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${isCredit
                          ? isSelected ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                          : isSelected ? 'bg-[#22C55E] text-white shadow-sm' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                      >
                        {pm.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <select
                {...register('paymentModeId')}
                onChange={(e) => {
                  register('paymentModeId').onChange(e);
                  const selected = paymentModes.find((p: any) => p.id === Number(e.target.value));
                  if (selected?.name?.toLowerCase() === 'cash') {
                    setValue('customerId', 0);
                  }
                }}
                className={`w-full px-2 py-1.5 border rounded text-[13px] outline-none font-bold transition-colors ${(() => {
                  const pm = paymentModes.find((p: any) => p.id === Number(watch('paymentModeId')));
                  if (pm?.name?.toLowerCase() === 'credit') return 'border-rose-400 bg-rose-50 text-rose-700';
                  if (pm?.name?.toLowerCase() === 'cash') return 'border-emerald-400 bg-emerald-50 text-emerald-700';
                  return 'border-[#D1D5DB] bg-white';
                })()
                  }`}
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
        <div className="shrink-0 flex flex-wrap justify-end gap-2 p-2 bg-white border-b border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 })}
            className="border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <Plus size={14} /> Add Row (F2)
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="border border-[#713F12] text-[#713F12] hover:bg-[#713F12] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <RefreshCw size={14} /> Clear (F4)
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <List size={14} /> Sales List
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports/sales')}
            className="border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <FileText size={14} /> Sales Report
          </button>
          <ShortcutHelpButton />
        </div>

        {/* Items Grid */}
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-white border-b border-[#E5E7EB]">
          <table className="w-full border-collapse md:min-w-[900px] whitespace-nowrap responsive-table">
            <thead>
              <tr className="bg-[#0F172A] text-white">
                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-10">#</th>
                <th className="px-2 py-2 text-left text-[12px] font-medium border border-[#334155]">Product Code / Name (Searchable Dropdown)</th>
                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-20">Stock</th>
                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-20">Unit</th>

                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-24">Qty</th>
                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-28">Rate</th>
                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-20">Disc %</th>
                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-24">Disc Amt</th>

                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-32">Total</th>
                <th className="px-2 py-2 text-center text-[12px] font-medium border border-[#334155] w-16">Act</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <td data-label="#" className="px-2 py-1 text-center text-[13px] border-r border-[#E5E7EB]">{index + 1}</td>
                  <td data-label="Product" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <SearchableSelect
                      value={watch(`items.${index}.productId`)}
                      tabIndex={0}
                      dataAttr={{ 'data-row-product': String(index) }}
                      autoFocus={index === 0 && fields.length === 1 && watch(`items.${index}.productId`) === 0}
                      onTabNext={() => focusCell(index, 1)}
                      onChange={(val) => {
                        setValue(`items.${index}.productId`, Number(val));
                        handleProductChange(index, String(val));
                      }}
                      options={[
                        { label: 'Type product name / code...', value: 0 },
                        ...products.map((p: any) => ({ label: `${p.code} - ${p.name}`, value: p.id }))
                      ]}
                    />
                  </td>
                  <td data-label="Stock" className="px-2 py-1 border-r border-[#E5E7EB] text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${watch(`items.${index}.stock`) > 0 ? 'bg-[#059669]' : 'bg-[#EF4444]'}`}>
                      {watch(`items.${index}.stock`)}
                    </span>
                  </td>
                  <td data-label="Unit" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input {...register(`items.${index}.unit`)} type="text" readOnly tabIndex={-1} className="w-full px-1 py-1 bg-transparent text-[13px] outline-none text-center" />
                  </td>

                  <td data-label="Qty" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.quantity`)}
                      data-row={index} data-col={1}
                      type="number" min="1" placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 1, 5)}
                      className={`w-full px-2 py-1 border rounded text-[13px] outline-none text-center transition-colors ${watch(`items.${index}.quantity`) > watch(`items.${index}.stock`) ? 'border-red-500 focus:border-red-500 bg-red-100 text-red-700 font-bold' : 'border-[#D1D5DB] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50'}`}
                    />
                  </td>
                  <td data-label="Rate" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.rate`)}
                      data-row={index} data-col={2}
                      type="number" step="0.01" placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 2, 5)}
                      className={`w-full px-2 py-1 border rounded text-[13px] outline-none text-right font-bold transition-colors ${(() => {
                        const pId = watch(`items.${index}.productId`);
                        const prod = products.find((p: any) => p.id === Number(pId));
                        const currentRate = Number(watch(`items.${index}.rate`)) || 0;
                        if (prod && currentRate > 0 && currentRate <= Number(prod.purchaseRate)) {
                          return 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-100 text-red-700';
                        }
                        return 'border-[#CBD5E1] bg-white focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 text-[#1E293B]';
                      })()}`}
                      onBlur={(e) => {
                        const enteredRate = Number(e.target.value);
                        const pId = watch(`items.${index}.productId`);
                        const product = products.find((p: any) => p.id === Number(pId));
                        if (product && enteredRate > 0 && enteredRate <= Number(product.purchaseRate)) {
                          toast.error(`Loss Warning: Selling below purchase rate (${formatCurrency(product.purchaseRate)})!`, { duration: 4000 });
                        }
                        register(`items.${index}.rate`).onBlur(e);
                      }}
                    />
                  </td>
                  <td data-label="Disc %" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.discPercent`)}
                      data-row={index} data-col={3}
                      type="number" step="0.01" placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 3, 5)}
                      onChange={(e) => {
                        register(`items.${index}.discPercent`).onChange(e);
                        const pct = Number(e.target.value) || 0;
                        const rate = Number(watch(`items.${index}.rate`)) || 0;
                        const q = Number(watch(`items.${index}.quantity`)) || 0;
                        const amt = (rate * q * pct) / 100;
                        setValue(`items.${index}.discAmt`, Number(amt.toFixed(2)));
                      }}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 text-right"
                    />
                  </td>
                  <td data-label="Disc Amt" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input
                      {...register(`items.${index}.discAmt`)}
                      data-row={index} data-col={4}
                      type="number" step="0.01" placeholder="0.00"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleCellKey(e, index, 4, 5)}
                      onChange={(e) => {
                        register(`items.${index}.discAmt`).onChange(e);
                        const amt = Number(e.target.value) || 0;
                        const rate = Number(watch(`items.${index}.rate`)) || 0;
                        const q = Number(watch(`items.${index}.quantity`)) || 0;
                        const totalGross = rate * q;
                        if (totalGross > 0) {
                          const pct = (amt / totalGross) * 100;
                          setValue(`items.${index}.discPercent`, Number(pct.toFixed(2)));
                        } else {
                          setValue(`items.${index}.discPercent`, 0);
                        }
                      }}
                      className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 text-right"
                    />
                  </td>

                  <td data-label="Total" className="px-2 py-1 border-r border-[#E5E7EB]">
                    <input {...register(`items.${index}.total`)} type="number" readOnly tabIndex={-1} className="w-full px-2 py-1 bg-transparent text-[13px] outline-none text-right font-bold" />
                  </td>
                  <td data-label="Action" className="px-2 py-1 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 })}
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

        {/* Tabs & Footer Calculation Area */}
        <div className="bg-[#F9FAFB] shrink-0">

          <div className="p-3 sm:p-4 bg-white border-b border-[#E5E7EB]">
            {activeTab === 'Amount Details' && (
              <div className="flex flex-col md:flex-row items-stretch md:items-center md:justify-start gap-4 md:gap-6">

                <div className="w-full md:w-56 flex flex-col gap-1">
                  <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Total Quantity:</label>
                  <input
                    value={watch('items').reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)}
                    readOnly
                    className="w-full px-3 py-2 border-2 border-[#D1D5DB] bg-[#F3F4F6] rounded text-[18px] outline-none text-right font-bold text-gray-800"
                  />
                </div>

                <div className="w-full md:w-56 flex flex-col gap-1">
                  <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Total Discount:</label>
                  <div className="flex gap-2 w-full">
                    <div className="relative w-1/2">
                      <input
                        {...register('totalDiscountPercent')}
                        type="number"
                        step="0.01"
                        onChange={(e) => {
                          register('totalDiscountPercent').onChange(e);
                          const percent = Number(e.target.value) || 0;
                          const amount = (watch('grossAmount') * percent) / 100;
                          setValue('totalDiscount', Number(amount.toFixed(2)));
                        }}
                        className="w-full pl-2 pr-6 py-2 border-2 border-[#D1D5DB] rounded text-[16px] outline-none focus:border-[#3B82F6] text-right font-bold text-gray-800"
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[14px] pointer-events-none">%</span>
                    </div>

                    <div className="relative w-1/2">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-[15px] pointer-events-none">{settings?.currencySymbol || 'RM'}</span>
                      <input
                        {...register('totalDiscount')}
                        type="number"
                        step="0.01"
                        onChange={(e) => {
                          register('totalDiscount').onChange(e);
                          const amt = Number(e.target.value) || 0;
                          const grossAmt = watch('grossAmount');
                          if (grossAmt > 0) {
                            setValue('totalDiscountPercent', Number(((amt / grossAmt) * 100).toFixed(2)));
                          } else {
                            setValue('totalDiscountPercent', 0);
                          }
                        }}
                        className="w-full pl-8 pr-3 py-2 border-2 border-[#D1D5DB] rounded text-[16px] outline-none focus:border-[#3B82F6] text-right font-bold text-gray-800"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-56 flex flex-col gap-1">
                  <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Gross Amount:</label>
                  <input
                    {...register('grossAmount')}
                    type="number"
                    readOnly
                    className="w-full px-3 py-2 border-2 border-[#D1D5DB] bg-[#F3F4F6] rounded text-[18px] outline-none text-right font-bold text-gray-800"
                  />
                </div>



                <div className="w-full md:w-72 flex flex-col gap-1 ml-auto">
                  <label className="text-[14px] font-black text-[#1E3A8A] uppercase">NET AMOUNT:</label>
                  <input
                    {...register('netAmount')}
                    type="number"
                    readOnly
                    className="w-full px-3 py-2 border-2 border-[#059669] bg-[#ECFDF5] text-[#059669] rounded text-[22px] outline-none text-right font-black shadow-inner"
                  />
                </div>

              </div>
            )}
            {activeTab !== 'Amount Details' && (
              <div className="text-[13px] text-gray-500 italic py-4">
                More fields will go here in future updates.
              </div>
            )}
          </div>

          {/* Bottom Black Bar */}
          <div className="bg-[#020617] text-white px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0">
            <div className="flex flex-nowrap justify-between sm:justify-center gap-1 sm:gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 })}
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
                {createMutation.isPending ? 'Saving...' : 'Save & Print'}
              </button>
              <button
                type="button"
                className="bg-[#0891B2] text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer hover:bg-[#0E7490] whitespace-nowrap"
                onClick={() => setIsLeaveModalOpen(true)}
              >
                <span className="opacity-70 border-r border-[#67E8F9] pr-1 mr-1">Esc</span> Dashboard
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-none border-gray-700 pt-3 md:pt-0">
              <span className="text-[16px] sm:text-[20px] font-black text-white uppercase tracking-wider">TOTAL NET AMOUNT:</span>
              <span className="text-[28px] sm:text-[36px] font-black text-[#38BDF8] drop-shadow-md">
                {formatCurrency(watch('netAmount') || 0)}
              </span>
            </div>
          </div>

        </div>

      </form>
      </div>

      {/* ─── MOBILE VIEW (< MD) ─── */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden relative bg-[#F3F4F6]">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-[#1E1B4B] to-[#312E81] text-white px-4 py-3 shrink-0 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-extrabold text-white leading-tight">
                {editId ? 'Edit Estimation' : 'Estimation Entry'}
              </h1>
              <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                {editId ? (editEstimationData?.estimationNo || `#${editId}`) : 'Tap a product to add to estimation'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {validMobileCartItems.length > 0 && !editId && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all items from estimation?')) reset();
                  }}
                  className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-200 px-2.5 py-1.5 rounded-lg text-xs font-bold active:bg-red-500/30 transition-colors"
                >
                  <RefreshCw size={13} />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 gap-2">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              placeholder="Search product name or code..."
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none font-medium"
            />
            {mobileSearch.length > 0 && (
              <button type="button" onClick={() => setMobileSearch('')} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Product Catalog Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-24">
          {filteredMobileProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <p className="text-sm font-semibold">No products found</p>
            </div>
          ) : (
            filteredMobileProducts.map((item: any) => {
              const inCart = validMobileCartItems.find((c: any) => Number(c.productId) === Number(item.id));
              const outOfStock = Number(item.currentStock) <= 0;
              const rate = Number(item.sellingRate) || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => !outOfStock && handleMobileAddToCart(item)}
                  className={`bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between transition-all select-none ${
                    outOfStock ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99] cursor-pointer hover:border-indigo-300'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-slate-400 font-semibold tracking-wide mt-0.5">{item.code}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {outOfStock ? (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Out of Stock
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Stock: {item.currentStock}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-base font-extrabold text-emerald-600">
                      {formatCurrency(rate)}
                    </span>
                    {inCart ? (
                      <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-[#312E81] px-2.5 py-1 rounded-lg font-black text-xs">
                        <ShoppingCart size={13} />
                        <span>{inCart.quantity}</span>
                      </div>
                    ) : (
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white shadow-sm ${
                        outOfStock ? 'bg-slate-400' : 'bg-[#312E81]'
                      }`}>
                        <Plus size={13} />
                        <span>{outOfStock ? 'OOS' : 'Add'}</span>
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
            className="fixed bottom-4 left-3 right-3 z-30 bg-[#312E81] text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative bg-indigo-50 text-[#312E81] p-2 rounded-xl">
                <ShoppingCart size={20} />
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#312E81]">
                  {mobileCartTotalQty}
                </span>
              </div>
              <div>
                <p className="text-lg font-black leading-tight text-white">
                  {formatCurrency(watch('netAmount') || 0)}
                </p>
                <p className="text-xs text-indigo-200 font-medium">
                  {validMobileCartItems.length} item{validMobileCartItems.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl font-bold text-sm text-white">
              <span>Checkout</span>
              <ChevronRight size={18} />
            </div>
          </div>
        )}

        {/* Mobile Checkout Drawer / Modal */}
        {isMobileCheckoutOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Checkout Estimation</h3>
                  <p className="text-[11px] text-slate-500">Estimation: {watch('estimationNo') || 'Generating...'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileCheckoutOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Cart Items List */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Items ({validMobileCartItems.length})
                  </p>
                  <div className="space-y-2">
                    {validMobileCartItems.map((item: any) => {
                      const prod = products.find((p: any) => p.id === Number(item.productId));
                      const itemName = prod?.name || `Product #${item.productId}`;
                      const itemCode = prod?.code || '';
                      const discPercent = Number(item.discPercent) || 0;

                      return (
                        <div key={item.originalIndex} className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                          <div
                            onClick={() => handleMobileOpenEdit(item.originalIndex)}
                            className="flex justify-between items-start cursor-pointer"
                          >
                            <div className="flex-1 pr-2">
                              <p className="text-sm font-bold text-slate-800 line-clamp-1">{itemName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {itemCode && `${itemCode} · `}Rate: {formatCurrency(item.rate)}
                                {discPercent > 0 && ` · Disc: ${discPercent}%`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-emerald-600">
                                {formatCurrency(item.total)}
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium">tap to edit</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-1 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => handleMobileRemoveOne(item.originalIndex)}
                              className="text-red-500 hover:text-red-600 active:scale-90 transition-transform"
                            >
                              <MinusCircle size={22} />
                            </button>
                            <span className="text-base font-extrabold text-slate-800 min-w-[28px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMobileAddToCart(prod || { id: item.productId, sellingRate: item.rate })}
                              className="text-emerald-500 hover:text-emerald-600 active:scale-90 transition-transform"
                            >
                              <PlusCircle size={22} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMobileDeleteItem(item.originalIndex)}
                              className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Customer Selector */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Customer</p>
                  <button
                    type="button"
                    onClick={() => setIsMobileCustomerPickerOpen(true)}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <User size={18} className="text-slate-500 shrink-0" />
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {selectedCustomer ? selectedCustomer.name : 'Walk-in (Cash)'}
                        </p>
                        {selectedCustomer?.phone && (
                          <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-400 shrink-0" />
                  </button>
                </div>

                {/* Rate Type */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Rate Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['Retail Rate', 'Wholesale Rate', 'MRP'].map((rt) => (
                      <button
                        key={rt}
                        type="button"
                        onClick={() => setValue('rateType', rt)}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                          watch('rateType') === rt
                            ? 'bg-[#312E81] border-[#312E81] text-white shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {rt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Payment Mode</p>
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
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pm.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500 font-semibold">
                    <span>Total Items:</span>
                    <span className="text-slate-800 font-bold">{mobileCartTotalQty}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-semibold">
                    <span>Gross Amount:</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(watch('grossAmount') || 0)}</span>
                  </div>
                  {Number(watch('totalDiscount')) > 0 && (
                    <div className="flex justify-between text-xs text-red-500 font-semibold">
                      <span>Total Discount:</span>
                      <span>- {formatCurrency(watch('totalDiscount') || 0)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center">
                    <span className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Net Amount:</span>
                    <span className="text-2xl font-black text-emerald-600">
                      {formatCurrency(watch('netAmount') || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirm / Save Button */}
              <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={() => {
                    setIsMobileCheckoutOpen(false);
                    handleSubmit(onSubmit as any, onError)();
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white py-3.5 rounded-xl font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <CheckCircle size={20} />
                  <span>{createMutation.isPending ? 'SAVING...' : 'SAVE & PRINT'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customer Picker Modal */}
        {isMobileCustomerPickerOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl max-h-[75vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-base font-extrabold text-slate-800">Select Customer</h3>
                <button
                  type="button"
                  onClick={() => setIsMobileCustomerPickerOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 gap-2">
                  <Search size={16} className="text-slate-400" />
                  <input
                    type="text"
                    value={mobileCustomerSearch}
                    onChange={(e) => setMobileCustomerSearch(e.target.value)}
                    placeholder="Search name or phone..."
                    className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder-slate-400 font-medium"
                    autoFocus
                  />
                  {mobileCustomerSearch.length > 0 && (
                    <button type="button" onClick={() => setMobileCustomerSearch('')} className="text-slate-400">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCustomerPickerOpen(false);
                    setIsCustomerModalOpen(true);
                  }}
                  className="bg-emerald-600 text-white px-3 h-10 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm"
                >
                  <Plus size={14} />
                  <span>New</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                <div
                  onClick={() => {
                    setValue('customerId', 0);
                    setIsMobileCustomerPickerOpen(false);
                  }}
                  className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                    !watch('customerId') ? 'bg-indigo-50/70' : ''
                  }`}
                >
                  <p className={`text-sm font-bold ${!watch('customerId') ? 'text-[#312E81]' : 'text-slate-800'}`}>
                    Walk-in (Cash)
                  </p>
                  <p className="text-xs text-slate-400">Default cash customer</p>
                </div>

                {filteredMobileCustomers.filter((c: any) => c.name !== 'Cash Customer').map((c: any) => {
                  const isSelected = Number(watch('customerId')) === Number(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setValue('customerId', c.id);
                        setIsMobileCustomerPickerOpen(false);
                      }}
                      className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-indigo-50/70' : ''
                      }`}
                    >
                      <p className={`text-sm font-bold ${isSelected ? 'text-[#312E81]' : 'text-slate-800'}`}>
                        {c.name}
                      </p>
                      {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {isMobileEditItemOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-extrabold text-slate-800">Edit Item</h3>
                <button
                  type="button"
                  onClick={() => setIsMobileEditItemOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={mobileEditQty}
                    onChange={(e) => setMobileEditQty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-indigo-500 text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Rate ({settings?.currencySymbol || '₹'})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mobileEditRate}
                    onChange={(e) => setMobileEditRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-indigo-500 text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Discount (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={mobileEditDiscPct}
                    onChange={(e) => setMobileEditDiscPct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-indigo-500 text-right"
                  />
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-800">Calculated Total</span>
                  <span className="text-lg font-black text-emerald-600">
                    {formatCurrency(
                      ((parseFloat(mobileEditQty) || 0) * (parseFloat(mobileEditRate) || 0)) *
                      (1 - (parseFloat(mobileEditDiscPct) || 0) / 100)
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleMobileSaveEdit}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
                >
                  Update Item
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Quick Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-[#059669] text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-[15px]">
                <UserPlus size={18} /> Quick Add New Customer
              </div>
              <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-[13px] font-bold text-[#1F2937] mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[13px] text-[#4B5563] mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-[13px] text-[#4B5563] mb-1">State {settings?.enableTax && <span className="text-red-500">*</span>}</label>
                <Select
                  value={newCustomer.state ? { value: newCustomer.state, label: newCustomer.state } : null}
                  onChange={(val: any) => setNewCustomer({ ...newCustomer, state: val?.value || '' })}
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
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded text-[13px] outline-none focus:border-[#3B82F6] min-h-[80px]"
                />
              </div>
            </div>
            <div className="p-4 bg-white pt-2 border-none pb-5">
              <button
                type="button"
                onClick={handleQuickAddCustomer}
                disabled={!newCustomer.name || addCustomerMutation.isPending}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white py-2.5 rounded font-bold text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save size={16} /> Save Customer & Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt */}
      <div id="printable-receipt" className={`hidden bg-white text-black font-sans ${settings?.printFormat === 'Thermal' ? 'print:block w-[80mm] text-[11px] p-2' : settings?.printFormat === 'A5' ? 'print:flex flex-col text-[11px] w-full max-w-[560px] mx-auto p-5 print:h-[205mm] box-border' : 'print:flex flex-col text-[12px] w-full max-w-[800px] mx-auto p-8 print:h-[257mm] box-border'}`}>
        {settings?.printFormat === 'Thermal' ? (
          /* ── THERMAL LAYOUT ── */
          <div style={{ fontFamily: "'Inter', sans-serif", width: '80mm' }}>
            <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } }`}</style>
            <div className="text-center mb-2">
              {settings?.logoImage && <img src={settings.logoImage} alt="Logo" className="h-12 mx-auto mb-1 object-contain" />}
              <div className="font-bold text-[13px] uppercase">{settings?.shopName || 'POS Suite 360'}</div>
              {settings?.shopAddress && <div className="text-[10px]">{settings.shopAddress}</div>}
              {settings?.phone && <div className="text-[10px]">Tel: {settings.phone}</div>}
              {settings?.gstin && <div className="text-[10px]">GSTIN: {settings.gstin}</div>}
              <div className="font-bold text-[12px] mt-1">ESTIMATION</div>
              <div className="text-[10px]">Est No: #{watch('estimationNo')}</div>
              <div className="text-[10px]">Date: {watch('date')}</div>
            </div>
            <div className="border-t border-dashed border-black my-1" />
            {selectedCustomer && selectedCustomer.name !== 'Cash Customer' && (
              <div className="text-[10px] mb-1">
                <div className="font-bold">{selectedCustomer.name}</div>
                {selectedCustomer.phone && <div>Ph: {selectedCustomer.phone}</div>}
              </div>
            )}
            <div className="border-t border-dashed border-black my-1" />
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-0.5">Item</th>
                  <th className="text-center py-0.5">Qty</th>
                  <th className="text-right py-0.5">Rate</th>
                  <th className="text-right py-0.5">Amt</th>
                </tr>
              </thead>
              <tbody>
                {watch('items').filter((i: any) => Number(i.productId) > 0).map((item: any, idx: number) => {
                  const product = products.find((p: any) => p.id === Number(item.productId));
                  return (
                    <tr key={idx}>
                      <td className="py-0.5 pr-1">{product?.name || ''}</td>
                      <td className="text-center py-0.5">{item.quantity}</td>
                      <td className="text-right py-0.5">{Number(item.rate || 0).toFixed(2)}</td>
                      <td className="text-right py-0.5">{Number(item.total || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-dashed border-black my-1" />
            <div className="text-[10px] flex justify-between"><span>Subtotal:</span><span>{Number(watch('grossAmount') || 0).toFixed(2)}</span></div>
            {Number(watch('totalDiscount')) > 0 && (
              <div className="text-[10px] flex justify-between"><span>Discount:</span><span>-{Number(watch('totalDiscount') || 0).toFixed(2)}</span></div>
            )}
            <div className="border-t border-black my-1" />
            <div className="text-[12px] font-bold flex justify-between"><span>TOTAL:</span><span>{settings?.currencySymbol || 'RM'} {Number(watch('netAmount') || 0).toFixed(2)}</span></div>
            <div className="text-[9px] text-center mt-1">{numberToWords(watch('netAmount'))} ONLY</div>
            <div className="border-t border-dashed border-black my-1" />
            {settings?.estimationNotes && (
              <div className="text-[9px] mt-1" dangerouslySetInnerHTML={{ __html: settings.estimationNotes }} />
            )}
            <div className="text-[10px] text-center mt-2">Thank you!</div>
          </div>
        ) : (
          <div
            className="flex flex-col flex-1 bg-white text-slate-800 overflow-hidden h-full"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col gap-3">
                {settings?.logoImage && (
                  <img src={settings.logoImage} alt="Logo" className="max-h-20 max-w-[200px] w-auto h-auto object-contain object-left" />
                )}
                <div>
                  <h1 className={`${settings?.logoImage ? 'text-xl' : 'text-2xl'} font-bold text-[#04325E] uppercase tracking-tight`}>{settings?.shopName || 'POS Suite 360'}</h1>
                  {settings?.invoiceTitle && <p className="text-[#1A63A8] font-bold text-sm mt-1">{settings.invoiceTitle}</p>}
                  <div className="mt-2 text-slate-800 text-xs leading-relaxed">
                    {settings?.shopAddress && <p>{settings.shopAddress}</p>}
                    <p className="font-bold text-slate-700">
                      {[settings?.city, settings?.state, settings?.country].filter(Boolean).join(', ')}
                    </p>
                    {settings?.phone && <p>Tel: {settings.phone}</p>}
                    {settings?.gstin && <p>GSTIN: {settings.gstin}</p>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-4xl font-black text-[#1A63A8] tracking-wider mb-2">ESTIMATION</h2>
                <p className="font-bold text-slate-700 text-sm">Est No: #{watch('estimationNo')}</p>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-3">Billed To / Customer Details</h3>
                <p className="font-bold text-slate-800 text-sm mb-1">{selectedCustomer?.name !== 'Cash Customer' ? (selectedCustomer?.name || 'Counter Sale') : 'Counter Sale'}</p>
                <div className="text-slate-800 text-xs space-y-1">
                  {selectedCustomer?.name !== 'Cash Customer' && selectedCustomer?.address && <p>{selectedCustomer.address}</p>}
                  {selectedCustomer?.name !== 'Cash Customer' && selectedCustomer?.state && <p>{selectedCustomer.state}</p>}
                  {selectedCustomer?.name !== 'Cash Customer' && selectedCustomer?.phone && <p>Phone: {selectedCustomer.phone}</p>}
                  {selectedCustomer?.gstNumber && <p>GSTIN: {selectedCustomer.gstNumber}</p>}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-3">Estimation Details</h3>
                <div className="grid grid-cols-[120px_1fr] gap-y-2 text-xs">
                  <span className="font-bold text-slate-600">Date:</span>
                  <span className="text-slate-800">{watch('date')}</span>
                  <span className="font-bold text-slate-600">Payment Mode:</span>
                  <span className="text-slate-800">{paymentModes.find((p: any) => p.id === Number(watch('paymentModeId')))?.name || 'Cash'}</span>
                  {Number(selectedCustomer?.openingBalance) > 0 && (
                    <>
                      <span className="font-bold text-slate-600">Pending Amount:</span>
                      <span className="text-slate-800">{settings?.currencySymbol || 'RM'} {Number(selectedCustomer?.openingBalance).toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 mb-6 flex-1 flex flex-col overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#2D6AA1] text-white text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-bold w-[5%]">#</th>
                    <th className="py-3 px-4 font-bold w-[45%]">Item Description</th>
                    <th className="py-3 px-4 font-bold w-[15%] text-center">Quantity</th>
                    <th className="py-3 px-4 font-bold w-[15%] text-right whitespace-nowrap">Unit Rate ({settings?.currencySymbol || 'RM'})</th>
                    <th className="py-3 px-4 font-bold w-[20%] text-right whitespace-nowrap">Amount ({settings?.currencySymbol || 'RM'})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {watch('items').filter((i: any) => Number(i.productId) > 0).map((item: any, idx: number) => {
                    const product = products.find((p: any) => p.id === Number(item.productId));
                    return (
                      <tr key={idx} className="bg-white">
                        <td className="py-3 px-4 text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800">{product?.name || ''}</span>
                          {product?.code && <span className="text-slate-500 ml-2">({product.code})</span>}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 font-medium">{item.quantity} {item.unit || 'Nos'}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{Number(item.rate || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">{Number(item.total || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Area */}
            <div className="mt-auto grid grid-cols-[1fr_350px] gap-8">
              <div className="flex flex-col gap-4 h-full">
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex-1 flex flex-col">
                  <h3 className="text-[10px] font-bold text-[#1A63A8] uppercase tracking-widest mb-2">Terms & Conditions</h3>
                  <div
                    className="text-[11px] text-slate-600 prose prose-sm max-w-none html-content flex-1"
                    dangerouslySetInnerHTML={{ __html: (settings?.estimationNotes !== undefined && settings?.estimationNotes !== null) ? settings.estimationNotes : '1. Goods once sold cannot be taken back or exchanged.<br/>2. Subject to Salem jurisdiction.' }}
                  />
                </div>

                {(editId && editEstimationData ? editEstimationData.stockMaintained : settings?.estimationStockMaintain) && settings?.upiId && Number(watch('netAmount')) > 0 && (
                  <a
                    href={`${window.location.origin}/?pa=${settings.upiId.trim()}&pn=${encodeURIComponent(settings?.shopName || 'Shop')}&tr=${encodeURIComponent(watch('estimationNo'))}&am=${Number(watch('netAmount')).toFixed(2)}&cu=INR`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex items-center gap-4 hover:bg-slate-100 transition-colors cursor-pointer"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="bg-white p-1.5 rounded border border-slate-200 shadow-sm shrink-0">
                      <QRCodeSVG
                        value={`upi://pay?pa=${settings.upiId.trim()}&pn=${encodeURIComponent(settings?.shopName || 'Shop')}&tr=${encodeURIComponent(watch('estimationNo'))}&am=${Number(watch('netAmount')).toFixed(2)}&cu=INR`}
                        size={64}
                        level="M"
                      />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest mb-1">Scan or Click to Pay</h3>
                      <p className="text-[10px] text-slate-600 font-medium">UPI ID: {settings.upiId}</p>
                      <p className="text-[9px] text-slate-500 mt-1">Scan or tap to open UPI app</p>
                    </div>
                  </a>
                )}
              </div>

              <div className="flex flex-col justify-end">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pt-4 pb-2 flex flex-col mb-6">
                  <div className="space-y-3 text-[13px] px-4 mb-4">
                    <div className="flex justify-between text-[#334155]">
                      <span>Subtotal:</span>
                      <span className="font-semibold tracking-wide">{Number(watch('grossAmount') || 0).toFixed(2)}</span>
                    </div>

                    {Number(watch('totalDiscount')) > 0 && (
                      <div className="flex justify-between text-[#334155]">
                        <span>Discount:</span>
                        <span className="font-semibold tracking-wide">{Number(watch('totalDiscount') || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#F0F5FA] border-y-2 border-[#1A63A8] px-4 py-3 flex justify-between items-center text-[#04325E] mt-1 mb-1">
                    <span className="font-bold text-[14px]">Total Due:</span>
                    <span className="text-[15px] font-black tracking-tight">{settings?.currencySymbol || 'RM'} {Number(watch('netAmount') || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-right px-4 pb-2 text-[9px] text-[#1A63A8] font-bold uppercase tracking-wider">
                    {numberToWords(watch('netAmount'))} ONLY
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-[11px] font-medium text-slate-600 border-t border-slate-200 pt-3">
              <p>Thank you for partnering with {settings?.shopName || 'POS Suite 360'}! | Page 1 of 1</p>
            </div>
          </div>
        )}
      </div>

      {/* Loss Warning Modal */}
      {showLossWarning && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-red-500 p-4 text-white flex items-center gap-3">
              <AlertTriangle size={24} />
              <h2 className="text-lg font-bold">Loss Warning!</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 font-bold mb-2 text-[15px]">One or more items are being sold at or below their purchase rate.</p>
              <p className="text-gray-500 text-sm font-medium">Are you absolutely sure you want to proceed with this sale and take a loss?</p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => { setShowLossWarning(false); setPendingPayload(null); }}
                className="px-4 py-2 border border-gray-300 bg-white rounded font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={confirmLossWarning}
                className="px-4 py-2 bg-red-600 rounded font-bold text-white hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                Yes, Proceed Anyway
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
                <p className="text-[13px] mt-1 text-blue-600">Invoice No: {pendingSavePayload?.estimationNo}</p>
              </div>
              <p className="text-[#334155] font-medium mb-2">How would you like to proceed?</p>
            </div>

            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleConfirmSave(false)}
                className="flex-1 bg-white border-2 border-[#E2E8F0] hover:border-[#94A3B8] hover:bg-[#F8FAFC] text-[#334155] py-2.5 rounded-lg font-bold text-[14px] transition-all flex items-center justify-center gap-2"
              >
                <Save size={16} /> Save Only
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSave(true)}
                className="flex-1 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white py-2.5 rounded-lg font-bold text-[14px] transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Save & Print
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

export default Estimation;
