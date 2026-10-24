import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Save, X, Printer, RefreshCw, List, UserPlus, AlertTriangle, FileText, Clock, DollarSign, Search, ShoppingCart, User, CheckCircle, MinusCircle, PlusCircle, ChevronRight } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import toast from 'react-hot-toast';
import api from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import InvoicePrintModal from '../../components/InvoicePrintModal';
import ShortcutHelpButton from '../../components/ShortcutHelp';
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

const saleItemSchema = z.object({
  productId: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  stock: z.coerce.number(),
  rate: z.coerce.number().min(0),
  unit: z.string().optional().nullable(),
  discPercent: z.coerce.number().min(0).max(100),
  discAmt: z.coerce.number().min(0),
  tax: z.coerce.number().optional(),
  total: z.coerce.number(),
  isEstimationItem: z.boolean().optional(),
  isService: z.boolean().optional(),
  serviceItemId: z.coerce.number().optional(),
  itemName: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.productId > 0 || (data.serviceItemId && data.serviceItemId > 0)) {
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

const saleSchema = z.object({
  customerId: z.coerce.number().min(0).optional(),
  invoiceNo: z.string(),
  date: z.string(),
  rateType: z.string(),
  paymentModeId: z.coerce.number().min(1, 'Payment Mode is required').or(z.literal(0)),

  grossAmount: z.coerce.number(),
  totalDiscount: z.coerce.number(),
  totalDiscountPercent: z.coerce.number().optional(),
  roundOff: z.coerce.number(),
  tax: z.coerce.number().optional(),
  netAmount: z.coerce.number(),

  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

type SaleFormValues = z.infer<typeof saleSchema>;

const DRAFTS_KEY = 'pos_drafts';
const getDrafts = (): any[] => {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]'); } catch (e) { return []; }
};
const persistDrafts = (drafts: any[]) => {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch (e) { console.error(e); }
};

const freshFormValues = (invoiceNo: string = 'Generating...') => ({
  date: new Date().toISOString().split('T')[0],
  invoiceNo,
  customerId: 0,
  rateType: 'Retail Rate',
  paymentModeId: 0,
  items: [{ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 }],
  grossAmount: 0,
  totalDiscountPercent: '' as any,
  totalDiscount: '' as any,
  roundOff: '' as any,
  netAmount: 0
});

const POS = () => {
  const { settings, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const estimationId = searchParams.get('estimationId');
  const editId = searchParams.get('editId');
  const queryClient = useQueryClient();

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', state: '' });
  const activeTab = 'Amount Details';

  const [showLossWarning, setShowLossWarning] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [customerPaid, setCustomerPaid] = useState<string>('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [pendingSavePayload, setPendingSavePayload] = useState<any>(null);
  const printAfterSaveRef = useRef(false);

  const [drafts, setDrafts] = useState<any[]>(getDrafts);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const activeDraftIdRef = useRef<string | null>(null);
  const editPrefilledRef = useRef<string | null>(null);
  const editPrefilledWithProductsRef = useRef(false);

  // ── Keyboard navigation helper (Nasa logic) ─────────────────────────────
  // Each interactive cell in the table has data-row and data-col attributes.
  // Columns: 1=qty, 2=rate, 3=discPercent, 4=discAmt
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
        append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
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
          append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
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

  const { register, control, handleSubmit, watch, setValue, getValues, reset } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema) as any,
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      invoiceNo: 'Generating...',
      customerId: 0,
      rateType: 'Retail Rate',
      paymentModeId: 0,
      items: [{ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 }],
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

  // Fetch Masters & Next Invoice
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: async () => (await api.get('/customers')).data });
  const { data: productsData = [] } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/products')).data });
  const { data: serviceItemsData = [] } = useQuery({ queryKey: ['service-items'], queryFn: async () => (await api.get('/service-items?isActive=true')).data });
  const { data: paymentModes = [] } = useQuery({ queryKey: ['paymentModes'], queryFn: async () => (await api.get('/payment-modes')).data });
  const { data: nextInvoiceData } = useQuery({ queryKey: ['nextInvoiceNo'], queryFn: async () => (await api.get('/sales/next-invoice-no')).data });

  const products = [
    ...productsData.map((p: any) => ({ ...p, isService: false })),
    ...(settings?.enableUnifiedPOS ? serviceItemsData.map((s: any) => ({
      ...s,
      id: s.id + 1000000,
      originalServiceId: s.id,
      isService: true,
      currentStock: 999999, // Bypass stock validation
      unit: { shortCode: 'Svc' },
      sellingRate: s.rate,
      purchaseRate: 0,
      code: s.code || `SVC-${s.id}`
    })) : [])
  ];

  const { data: estimationData } = useQuery({
    queryKey: ['estimation', estimationId],
    queryFn: async () => (await api.get(`/estimations/${estimationId}`)).data,
    enabled: !!estimationId,
  });

  const { data: editSaleData } = useQuery({
    queryKey: ['sale', editId],
    queryFn: async () => (await api.get(`/sales/${editId}`)).data,
    enabled: !!editId,
  });

  // Update default invoice no
  useEffect(() => {
    if (nextInvoiceData?.invoiceNo && !editId) {
      setValue('invoiceNo', nextInvoiceData.invoiceNo);
    }
  }, [nextInvoiceData, setValue, editId]);

  // Pre-fill from estimation
  useEffect(() => {
    if (estimationData && estimationData.items) {
      setValue('customerId', estimationData.customerId);
      setValue('grossAmount', Number(estimationData.subtotal));
      setValue('totalDiscount', Number(estimationData.discount));
      setValue('netAmount', Number(estimationData.grandTotal));

      const posItems = estimationData.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        stock: item.product?.currentStock || 0,
        rate: Number(item.rate),
        unit: item.product?.unit?.shortCode || 'Nos',
        discPercent: 0,
        discAmt: Number(item.discount),
        tax: Number(item.tax) || 0,
        total: Number(item.amount),
        isEstimationItem: true
      }));
      setValue('items', posItems);
    }
  }, [estimationData, setValue]);

  // Pre-fill from an existing sale (edit mode)
  useEffect(() => {
    if (editSaleData && editId) {
      if (editPrefilledRef.current === editId && editPrefilledWithProductsRef.current) return; // never overwrite user edits
      editPrefilledRef.current = editId;
      editPrefilledWithProductsRef.current = products.length > 0;
      setValue('invoiceNo', editSaleData.invoiceNo);
      setValue('date', new Date(editSaleData.date).toISOString().split('T')[0]);
      setValue('customerId', Number(editSaleData.customerId) || 0);
      setValue('paymentModeId', Number(editSaleData.paymentModeId) || 0);
      setValue('rateType', 'Retail Rate');
      setValue('grossAmount', Number(editSaleData.subtotal));
      setValue('tax', Number(editSaleData.tax || 0));
      setValue('totalDiscount', Number(editSaleData.discount || 0));
      setValue('netAmount', Number(editSaleData.grandTotal));

      const posItems = (editSaleData.items || []).map((item: any) => {
        const isService = !!item.isService;
        let productId = Number(item.productId || 0);
        let serviceItemId: number | undefined;
        if (isService) {
          serviceItemId = Number(item.serviceItemId || 0);
          productId = (serviceItemId || 0) + 1000000;
        }
        const product = products.find((p: any) => p.id === Number(productId));
        const qty = Number(item.quantity);
        return {
          productId,
          quantity: qty,
          stock: Math.max(product?.currentStock ?? qty, qty),
          rate: Number(item.rate),
          unit: item.product?.unit?.shortCode || 'Nos',
          discPercent: 0,
          discAmt: Number(item.discount || 0),
          tax: Number(item.tax || 0),
          total: Number(item.amount),
          isService,
          serviceItemId,
          itemName: item.itemName,
          isEstimationItem: false,
        };
      });
      setValue('items', posItems);
    }
  }, [editSaleData, editId, setValue, products]);


  // Auto-focus first row product search on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstProduct = document.querySelector<HTMLElement>('[data-row-product="0"]');
      firstProduct?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);
  const items = watch('items');
  const watchTotalDiscount = watch('totalDiscount');
  const watchRoundOff = watch('roundOff');
  const selectedCustomerId = watch('customerId');

  // Customer fixed product rates query
  const { data: customerRates = [] } = useQuery({
    queryKey: ['customer-rates', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const res = await api.get(`/customers/${selectedCustomerId}/rates`);
      return res.data;
    },
    enabled: !!selectedCustomerId && (!!settings?.enableCustomerWiseRate || !!(settings as any)?.enableCustomerRates),
  });

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
      grossAmount += subtotal;
      totalTax += itemTax;
    });

    const d = Number(watchTotalDiscount) || 0;
    const r = Number(watchRoundOff) || 0;
    const netAmount = grossAmount + totalTax - d + r;

    setValue('grossAmount', Number(grossAmount.toFixed(2)));
    setValue('tax', Number(totalTax.toFixed(2)));
    setValue('netAmount', Number(netAmount.toFixed(2)));

  }, [JSON.stringify(items), watchTotalDiscount, watchRoundOff, setValue, settings?.enableTax, products]);

  // Product change handler
  const handleProductChange = async (index: number, id: string) => {
    const item = products.find((p: any) => p.id === Number(id));
    if (item) {
      if (item.isService) {
        setValue(`items.${index}.isService`, true);
        setValue(`items.${index}.serviceItemId`, item.originalServiceId);
        setValue(`items.${index}.itemName`, item.name);
      } else {
        setValue(`items.${index}.isService`, false);
        setValue(`items.${index}.serviceItemId`, undefined);
        setValue(`items.${index}.itemName`, undefined);
      }

      setValue(`items.${index}.stock`, item.currentStock || 0);
      setValue(`items.${index}.unit`, item.unit?.shortCode || item.unit?.name || 'Nos');

      const rateType = getValues('rateType');
      let rate = Number(item.sellingRate) || 0;
      if (rateType === 'Wholesale Rate') rate = Number(item.wholesaleRate) || 0;
      else if (rateType === 'MRP') rate = Number(item.mrp) || 0;

      // Override with custom customer rate if enabled
      if ((settings?.enableCustomerWiseRate || (settings as any)?.enableCustomerRates) && !item.isService) {
        let customRate = customerRates?.find((r: any) => r.productId === item.id);
        if (!customRate && selectedCustomer?.productRates) {
          customRate = selectedCustomer.productRates.find((pr: any) => pr.productId === item.id);
        }
        if (customRate && Number(customRate.rate) > 0) {
          rate = Number(customRate.rate);
        }
      }

      setValue(`items.${index}.rate`, rate > 0 ? rate : ('' as any));
    }
  };

  // Recalculate rates if rateType, selectedCustomer, or customerRates changes
  const watchRateType = watch('rateType');
  useEffect(() => {
    if (editId) return; // In edit mode, preserve the originally billed rates (the Rate Type select recomputes on change)
    const currentItems = getValues('items');
    currentItems.forEach((item, index) => {
      if (item.isEstimationItem) return; // Preserve original estimation rates

      const product = products.find((p: any) => p.id === Number(item.productId));
      if (product) {
        let rate = Number(product.sellingRate) || 0;
        if (watchRateType === 'Wholesale Rate') rate = Number(product.wholesaleRate) || 0;
        else if (watchRateType === 'MRP') rate = Number(product.mrp) || 0;

        if (settings?.enableCustomerWiseRate || (settings as any)?.enableCustomerRates) {
          let customRate = customerRates?.find((r: any) => r.productId === product.id);
          if (!customRate && selectedCustomer?.productRates) {
            customRate = selectedCustomer.productRates.find((pr: any) => pr.productId === product.id);
          }
          if (customRate && Number(customRate.rate) > 0) {
            rate = Number(customRate.rate);
          }
        }
        if (Number(item.rate) !== rate) {
          setValue(`items.${index}.rate`, rate > 0 ? rate : ('' as any));
        }
      }
    });
    // Triggers calculation effect indirectly since items changed
  }, [watchRateType, selectedCustomerId, settings?.enableCustomerWiseRate, selectedCustomer, customerRates]);

  // Mutation to quickly save custom fixed rate for customer from POS
  const saveCustomerRateMutation = useMutation({
    mutationFn: async ({ productId, rate }: { productId: number; rate: number }) => {
      if (!selectedCustomerId) return;
      await api.post(`/customers/${selectedCustomerId}/rates`, {
        rates: [{ productId, rate }]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerRates', selectedCustomerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-rates', selectedCustomerId] });
      toast.success('Customer fixed rate saved!');
    },
    onError: () => {
      toast.error('Failed to save customer rate.');
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: SaleFormValues) => editId
      ? api.put(`/sales/${editId}`, data)
      : api.post('/sales', data),
    onSuccess: async (res) => {
      toast.success(editId ? 'Sale updated successfully!' : 'Sale recorded successfully!');

      if (estimationId && !editId) {
        try {
          await api.patch(`/estimations/${estimationId}/status`, { status: 'Converted' });
        } catch (e) {
          console.error("Failed to update estimation status", e);
        }
      }

      // Conditionally print the bill
      setTimeout(async () => {
        if (printAfterSaveRef.current) {
          try {
            const saleRes = await api.get(`/sales/${res.data.id}`);
            setPrintData(saleRes.data);
            setShowPrintModal(true);
          } catch (err) {
            console.error("Failed to fetch sale for printing", err);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });

        if (editId) {
          if (!printAfterSaveRef.current) {
            navigate('/sales');
          }
          return;
        }

        reset(freshFormValues());

        // Remove the loaded draft after successful save
        if (activeDraftIdRef.current) {
          removeDraftById(activeDraftIdRef.current);
          activeDraftIdRef.current = null;
        }

        // Manually fetch and inject the new invoice number for the next sale
        const nextInvoiceRes = await api.get('/sales/next-invoice-no');
        if (nextInvoiceRes.data?.invoiceNo) {
          setValue('invoiceNo', nextInvoiceRes.data.invoiceNo);
        }

        queryClient.invalidateQueries({ queryKey: ['nextInvoiceNo'] });
      }, 100);
    },
    onError: (error: any) => {
      console.error(error);
      const msg = error?.response?.data?.message;
      toast.error(typeof msg === 'string' && msg ? msg : 'Failed to record sale. Please check your inputs.');
      if (editId) {
        queryClient.invalidateQueries({ queryKey: ['sales'] });
      }
    }
  });

  const onSubmit = (data: SaleFormValues) => {
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

    const validItems = data.items.filter(item => (item.productId && item.productId > 0) || item.serviceItemId);
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
      tax: Number(data.tax || 0),
      grandTotal: Number(data.netAmount),
      items: validItems.map(item => ({
        productId: !item.isService && item.productId > 0 ? Number(item.productId) : undefined,
        serviceItemId: item.isService && item.serviceItemId ? Number(item.serviceItemId) : undefined,
        isService: item.isService || false,
        itemName: item.itemName,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        discount: Number(item.discAmt || 0),
        tax: Number(item.tax || 0),
        amount: Number(item.total),
      }))
    };

    const hasLowRate = validItems.some(item => {
      if (item.isService) return false;
      const p = products.find((prod: any) => prod.id === Number(item.productId));
      return p && Number(item.rate) > 0 && Number(item.rate) <= Number(p.purchaseRate);
    });

    if (hasLowRate) {
      setPendingPayload(payload);
      setShowLossWarning(true);
      return;
    }

    setPendingSavePayload(payload);
    setCustomerPaid('');
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

    // On mobile, jump straight into the rate editor when a rate is missing
    if (Array.isArray(errors.items)) {
      const rateErrorIdx = errors.items.findIndex((item: any) => item?.rate);
      if (rateErrorIdx >= 0) {
        handleMobileOpenEdit(rateErrorIdx);
      }
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

  const handleSaveDraft = () => {
    const values = getValues();
    const validItems = (values.items || []).filter((i: any) => Number(i.productId) > 0 || i.serviceItemId);
    if (validItems.length === 0) {
      toast.error('Add at least one product before saving a draft.');
      return;
    }
    const customer = customers.find((c: any) => c.id === Number(values.customerId));
    const customerName = customer?.name || (Number(values.customerId) ? `Customer #${values.customerId}` : 'Counter / Cash Sale');
    const draft = {
      id: activeDraftIdRef.current || String(Date.now()),
      savedAt: new Date().toISOString(),
      customerId: values.customerId,
      customerName,
      customerPhone: customer?.phone || '',
      customerAddress: customer?.address || '',
      customerState: customer?.state || '',
      itemCount: validItems.length,
      qtyCount: validItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0),
      netAmount: Number(values.netAmount) || 0,
      data: {
        ...values,
        items: validItems.map((i: any) => ({ ...i })),
        invoiceNo: ''
      }
    };
    const next = [...drafts.filter((d: any) => d.id !== draft.id), draft];
    setDrafts(next);
    persistDrafts(next);
    activeDraftIdRef.current = null;
    // Clear the entry form so the next customer starts fresh
    reset(freshFormValues());
    setCustomerPaid('');
    api.get('/sales/next-invoice-no').then((res) => {
      if (res.data?.invoiceNo) setValue('invoiceNo', res.data.invoiceNo);
    }).catch(() => { });
    toast.success(`Sale saved as draft for ${customerName}. Entry cleared for the next customer.`);
  };

  const removeDraftById = (id: string | null) => {
    if (!id) return;
    setDrafts(prev => {
      const next = prev.filter((d: any) => d.id !== id);
      persistDrafts(next);
      return next;
    });
  };

  const handleLoadDraft = (draft: any) => {
    const data = draft.data || {};
    const currentInvoice = getValues('invoiceNo');
    const loadedItems = (data.items || []).map((item: any) => {
      const product = products.find((p: any) => p.id === Number(item.productId));
      return {
        ...item,
        stock: product?.currentStock ?? item.stock ?? 0,
        unit: product?.unit?.shortCode || product?.unit?.name || item.unit || 'Nos',
      };
    });
    reset({
      ...data,
      invoiceNo: currentInvoice,
      items: loadedItems.length ? loadedItems : [{ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 }],
    }, { keepDefaultValues: true });
    setValue('customerId', Number(data.customerId) || 0);
    setValue('paymentModeId', Number(data.paymentModeId) || 0);
    setValue('rateType', data.rateType || 'Retail Rate');
    setCustomerPaid('');
    activeDraftIdRef.current = draft.id;
    setIsDraftsModalOpen(false);
    setSelectedDraft(null);
    toast.success(`Draft loaded for ${draft.customerName}.`);
  };

  const handleDeleteDraft = (id: string) => {
    if (activeDraftIdRef.current === id) activeDraftIdRef.current = null;
    removeDraftById(id);
    toast.success('Draft deleted.');
  };

  const handleClear = () => {
    if (editId) return;
    // Keep the already-generated entry number, otherwise the form would stay on "Generating..."
    const currentInvoice = getValues('invoiceNo');
    const invoiceToKeep = currentInvoice && currentInvoice !== 'Generating...'
      ? currentInvoice
      : (nextInvoiceData?.invoiceNo || 'Generating...');
    reset(freshFormValues(invoiceToKeep));
    setCustomerPaid('');
    if (activeDraftIdRef.current) {
      removeDraftById(activeDraftIdRef.current);
      activeDraftIdRef.current = null;
    }
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
        handleClear();
      } else if (e.key === 'F2') {
        e.preventDefault();
        append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLElement>('[data-row-product] input');
          if (inputs.length > 0) inputs[inputs.length - 1].focus();
        }, 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isCustomerModalOpen, showLossWarning, isSaveModalOpen, isLeaveModalOpen, handleClear, append, navigate, onSubmit, onError]);

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
    const isSvc = !!product.isService;
    const existingIdx = currentItems.findIndex((it: any) =>
      isSvc ? (it.isService && it.serviceItemId === product.originalServiceId) : (Number(it.productId) === Number(product.id))
    );

    if (existingIdx >= 0) {
      const curQty = Number(currentItems[existingIdx].quantity) || 0;
      const newQty = curQty + 1;
      if (!isSvc && newQty > (product.currentStock || 0)) {
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

      if ((settings?.enableCustomerWiseRate || (settings as any)?.enableCustomerRates) && !isSvc) {
        let customRate = customerRates?.find((r: any) => r.productId === product.id);
        if (!customRate && selectedCustomer?.productRates) {
          customRate = selectedCustomer.productRates.find((pr: any) => pr.productId === product.id);
        }
        if (customRate && Number(customRate.rate) > 0) {
          rate = Number(customRate.rate);
        }
      }

      const newItem = {
        productId: isSvc ? 0 : Number(product.id),
        quantity: 1,
        stock: isSvc ? 999999 : Number(product.currentStock || 0),
        rate: rate > 0 ? rate : 0,
        unit: product.unit?.shortCode || product.unit?.name || 'Nos',
        discPercent: 0,
        discAmt: 0,
        tax: 0,
        total: rate > 0 ? rate : 0,
        isService: isSvc,
        serviceItemId: isSvc ? product.originalServiceId : undefined,
        itemName: isSvc ? product.name : undefined,
      };

      if (currentItems.length === 1 && !currentItems[0].productId && !currentItems[0].serviceItemId) {
        setValue('items.0', newItem, { shouldValidate: true });
      } else {
        append(newItem);
      }

      // If the product has no rate, immediately let the user type one instead of failing on save
      if (rate <= 0) {
        const newIndex = currentItems.length === 1 && !currentItems[0].productId && !currentItems[0].serviceItemId
          ? 0
          : currentItems.length;
        setMobileEditingIndex(newIndex);
        setMobileEditQty('1');
        setMobileEditRate('');
        setMobileEditDiscPct('0');
        setIsMobileEditItemOpen(true);
        toast.error('Rate is missing. Please enter the rate for this item.');
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
        setValue('items.0', { productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 }, { shouldValidate: true });
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
      setValue('items.0', { productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, tax: 0, total: 0 }, { shouldValidate: true });
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

  // Mobile save: if any cart item has no rate, open the edit sheet for it instead of failing validation
  const handleMobileSave = () => {
    const currentItems = getValues('items') || [];
    const missingRateIdx = currentItems.findIndex((it: any) =>
      ((it.productId && Number(it.productId) > 0) || it.serviceItemId) && !(Number(it.rate) >= 0.01)
    );
    if (missingRateIdx >= 0) {
      setIsMobileCheckoutOpen(false);
      handleMobileOpenEdit(missingRateIdx);
      toast.error('Rate is missing. Please enter the rate for this item.');
      return;
    }
    handleSubmit(onSubmit as any, onError)();
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
    (it: any) => (it.productId && Number(it.productId) > 0) || it.serviceItemId
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
              className="bg-[#10B981] hover:bg-[#059669] text-white px-3 sm:px-4 py-2 sm:py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors"
            >
              <Printer size={16} /> <span className="hidden sm:inline">{editId ? 'UPDATE & PRINT' : 'SAVE & PRINT'} (F10)</span><span className="sm:hidden">{editId ? 'Update' : 'Save'}</span>
            </button>
            {!editId && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="bg-[#D97706] hover:bg-[#B45309] text-white px-3 sm:px-4 py-2 sm:py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors"
                >
                  <Save size={16} /> <span className="hidden sm:inline">Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDraftsModalOpen(true)}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-3 sm:px-4 py-2 sm:py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors relative"
                >
                  <Clock size={16} /> <span className="hidden sm:inline">Drafts</span>
                  {drafts.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-white text-[#7C3AED] text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow">{drafts.length}</span>
                  )}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsLeaveModalOpen(true)}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-3 sm:px-4 py-2 sm:py-1.5 rounded flex items-center gap-2 font-bold text-[13px] transition-colors"
          >
            <X size={16} /> <span className="hidden sm:inline">Close (Esc)</span>
          </button>
        </div>

        {editId && (
          <div className="bg-amber-100 border-b border-amber-300 text-amber-800 px-4 py-1.5 text-[12px] font-bold flex items-center gap-2 shrink-0 print:hidden">
            <FileText size={14} /> Editing Invoice {editSaleData?.invoiceNo || `#${editId}`} — changes will reverse and re-apply the stock automatically.
          </div>
        )}

        <form className="flex flex-col flex-1 min-h-0 overflow-hidden print:hidden" onSubmit={handleSubmit(onSubmit as any, onError)}>

          {/* Header Section */}
          <div className="bg-white p-3 sm:p-4 border-b border-[#E5E7EB] shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:flex lg:flex-row gap-3 sm:gap-4">

              <div className="w-full lg:flex-1 lg:max-w-[200px]">
              <label className="block text-[11px] font-bold text-[#1F2937] mb-1">Entry No</label>
              <input
                {...register('invoiceNo')}
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

            <div className="w-full col-span-2 lg:col-span-1 lg:flex-[2]">
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

        {/* Action Buttons - fixed, never scrolls */}
        <div className="entry-action-bar shrink-0 flex flex-wrap justify-end gap-2 p-2 bg-white border-b border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => {
              append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
              setTimeout(() => {
                const inputs = document.querySelectorAll<HTMLElement>('[data-row-product] input');
                if (inputs.length > 0) inputs[inputs.length - 1].focus();
              }, 100);
            }}
            className="border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <Plus size={14} /> Add Row (F2)
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="border border-[#713F12] text-[#713F12] hover:bg-[#713F12] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <RefreshCw size={14} /> Clear (F4)
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="border border-[#D97706] text-[#D97706] hover:bg-[#D97706] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
          >
            <Save size={14} /> Save Draft
          </button>
          <button
            type="button"
            onClick={() => setIsDraftsModalOpen(true)}
            className="border border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold relative"
          >
            <Clock size={14} /> Drafts
            {drafts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#7C3AED] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow">{drafts.length}</span>
            )}
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

        {/* Items Grid - only this scrolls */}
        <div className="entry-table-wrapper flex-1 min-h-0 overflow-auto custom-scrollbar bg-white border-b border-[#E5E7EB]">
          <table className="w-full border-collapse whitespace-nowrap md:whitespace-normal responsive-table">
            <thead>
              <tr className="bg-[#0F172A] text-white">
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-10">#</th>
                <th className="px-2 py-2 text-left text-[12px] font-bold border border-[#334155]">Product Code / Name</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Stock</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Unit</th>

                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">Qty</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-28">Rate</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Disc %</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">Disc Amt</th>
                {settings?.enableTax && (
                  <>
                    <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-20">Tax %</th>
                    <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-24">Tax Amt</th>
                  </>
                )}
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-32">Total</th>
                <th className="px-2 py-2 text-center text-[12px] font-bold border border-[#334155] w-16">Act</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const totalCols = 4; // qty=1, rate=2, discPercent=3, discAmt=4
                return (
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
                                append({ productId: 0, quantity: '' as any, stock: 0, rate: '' as any, unit: 'Nos', discPercent: '' as any, discAmt: '' as any, total: 0 });
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
                            ...products.map((p: any) => ({
                              label: p.isService ? `[Service] ${p.code} - ${p.name}` : `${p.code} - ${p.name}`,
                              value: p.id
                            }))
                          ]}
                        />
                      </div>
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
                        onKeyDown={(e) => handleCellKey(e, index, 1, totalCols)}
                        className={`w-full px-2 py-1 border rounded text-[13px] outline-none text-center transition-colors ${watch(`items.${index}.quantity`) > watch(`items.${index}.stock`) ? 'border-red-500 focus:border-red-500 bg-red-100 text-red-700 font-bold' : 'border-[#D1D5DB] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50'}`}
                      />
                    </td>
                    <td data-label="Rate" className="px-2 py-1 border-r border-[#E5E7EB]">
                      <div className="flex items-center gap-1">
                        <input
                          {...register(`items.${index}.rate`)}
                          data-row={index} data-col={2}
                          type="number" step="0.01" placeholder="0.00"
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => handleCellKey(e, index, 2, totalCols)}
                          className={`w-full px-2 py-1 border rounded text-[13px] outline-none text-right font-bold transition-colors ${(() => {
                            const pId = watch(`items.${index}.productId`);
                            const prod = products.find((p: any) => p.id === Number(pId));
                            const currentRate = Number(watch(`items.${index}.rate`)) || 0;
                            if (prod && currentRate > 0 && currentRate <= Number(prod.purchaseRate)) {
                              return 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-100 text-red-700';
                            }
                            return 'border-[#CBD5E1] bg-white focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] focus:bg-blue-50 text-black font-bold';
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
                        {(settings?.enableCustomerWiseRate || (settings as any)?.enableCustomerRates) && !!selectedCustomerId && Number(watch(`items.${index}.productId`)) > 0 && Number(watch(`items.${index}.rate`)) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const pId = Number(watch(`items.${index}.productId`));
                              const rVal = Number(watch(`items.${index}.rate`));
                              saveCustomerRateMutation.mutate({ productId: pId, rate: rVal });
                            }}
                            className="p-1 bg-green-50 text-green-600 border border-green-300 rounded hover:bg-green-600 hover:text-white transition-colors shrink-0"
                            title="Save this rate as customer fixed rate"
                          >
                            <DollarSign size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td data-label="Disc %" className="px-2 py-1 border-r border-[#E5E7EB]">
                      <input
                        {...register(`items.${index}.discPercent`)}
                        data-row={index} data-col={3}
                        type="number" step="0.01" placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => handleCellKey(e, index, 3, totalCols)}
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
                        onKeyDown={(e) => handleCellKey(e, index, 4, totalCols)}
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
                          title="Remove Row (Ctrl+Delete)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tabs & Footer Calculation Area */}
        <div className="bg-[#F9FAFB] shrink-0">

          <div className="p-3 sm:p-4 bg-white border-b border-[#E5E7EB]">
            {activeTab === 'Amount Details' && (
              <div className="entry-footer-totals flex flex-col md:flex-row items-stretch md:items-center md:justify-start gap-4 md:gap-6">

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

                <div className="w-full md:w-56 flex flex-col gap-1">
                  <label className="text-[13px] font-extrabold text-[#1F2937] uppercase">Total Tax:</label>
                  <input
                    {...register('tax')}
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

            <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-none border-gray-700 pt-3 md:pt-0">
              {/* Net Amount */}
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Net Amount</span>
                <span className="entry-net-amount text-[28px] sm:text-[36px] font-black text-[#38BDF8] drop-shadow-md leading-none">
                  {formatCurrency(watch('netAmount') || 0)}
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
                    className="w-36 pl-7 pr-2 py-1.5 bg-[#1e293b] border-2 border-[#3B82F6] rounded text-[18px] font-black text-right text-white outline-none focus:border-[#60A5FA]"
                  />
                </div>
              </div>

              {/* Change / Short */}
              {Number(customerPaid) > 0 && (
                <div className={`flex flex-col items-end px-3 py-1.5 rounded-lg border ${Number(customerPaid) >= (watch('netAmount') || 0)
                  ? 'bg-green-900/40 border-green-500'
                  : 'bg-red-900/40 border-red-500'
                  }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${Number(customerPaid) >= (watch('netAmount') || 0) ? 'text-green-400' : 'text-red-400'
                    }`}>
                    {Number(customerPaid) >= (watch('netAmount') || 0) ? 'Change / Return' : 'Short by'}
                  </span>
                  <span className={`text-[24px] font-black leading-none ${Number(customerPaid) >= (watch('netAmount') || 0) ? 'text-green-400' : 'text-red-400'
                    }`}>
                    {formatCurrency(Math.abs(Number(customerPaid) - (watch('netAmount') || 0)))}
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
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white px-4 py-3 shrink-0 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-extrabold text-white leading-tight">
                {editId ? 'Edit Invoice' : 'Sales Entry'}
              </h1>
              <p className="text-xs text-blue-200 mt-0.5 font-medium">
                {editId ? (editSaleData?.invoiceNo || `#${editId}`) : 'Tap a product to add to cart'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={handleMobileSave}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold shadow-sm transition-all"
              >
                <CheckCircle size={14} />
                <span>{createMutation.isPending ? 'SAVING...' : 'SAVE'}</span>
              </button>
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

        {/* Scrollable mobile content */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-24">

        {/* Mobile Entry Details (Entry No / Entry Date / Customer) */}
        <div className="px-3 py-2.5 bg-white border-b border-slate-200 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Entry No</label>
              <input
                type="text"
                readOnly
                value={watch('invoiceNo') || ''}
                placeholder="Generating..."
                className="w-full h-9 px-2.5 border border-slate-200 bg-slate-50 rounded-lg text-xs font-bold text-slate-700 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Entry Date</label>
              <input
                type="date"
                value={watch('date') || ''}
                onChange={(e) => setValue('date', e.target.value, { shouldDirty: true, shouldValidate: true })}
                className="w-full h-9 px-2.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-[#1E3A8A] bg-white"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Customer Name {!isCashMode && <span className="text-red-500">*</span>}
            </label>
            <button
              type="button"
              onClick={() => setIsMobileCustomerPickerOpen(true)}
              className="w-full h-9 flex items-center justify-between px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-left active:bg-slate-100 transition-colors"
            >
              <span className={`truncate text-xs font-bold ${selectedCustomer ? 'text-slate-800' : 'text-slate-400'}`}>
                {selectedCustomer
                  ? `${selectedCustomer.name}${selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ''}`
                  : 'Walk-in (Cash)'}
              </span>
              <ChevronRight size={16} className="text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Mobile Payment Mode */}
          <div className="mt-2">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Payment Mode {!isCashMode && <span className="text-red-500">*</span>}
            </label>
            <select
              value={watch('paymentModeId') || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setValue('paymentModeId', id, { shouldDirty: true, shouldValidate: true });
                const mode = paymentModes.find((pm: any) => Number(pm.id) === id);
                if (mode?.name?.toLowerCase() === 'cash') setValue('customerId', 0);
              }}
              className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-[#1E3A8A] bg-white"
            >
              <option value="">Select mode...</option>
              {paymentModes.map((pm: any) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          {/* Mobile Amount Summary + Clear Entry */}
          <div className="mt-2 flex items-stretch gap-2">
            <div className="flex-1 min-w-0 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Total Amount</p>
                <p className="text-base font-black text-emerald-600 leading-tight truncate">
                  {formatCurrency(watch('netAmount') || 0)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Gross / Disc</p>
                <p className="text-[11px] font-bold text-slate-700 leading-tight">
                  {formatCurrency(watch('grossAmount') || 0)}
                  {Number(watch('totalDiscount')) > 0 && (
                    <span className="text-red-500"> - {formatCurrency(watch('totalDiscount') || 0)}</span>
                  )}
                </p>
              </div>
            </div>
            {!editId && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear this entry? All items and details will be reset.')) handleClear();
                }}
                className="shrink-0 px-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 active:bg-red-100 transition-colors"
              >
                <RefreshCw size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="px-3 py-2 bg-white border-b border-slate-200">
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
        <div className="p-3 space-y-2.5">
          {filteredMobileProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <p className="text-sm font-semibold">No products found</p>
            </div>
          ) : (
            filteredMobileProducts.map((item: any) => {
              const inCart = validMobileCartItems.find((c: any) =>
                item.isService ? c.serviceItemId === item.originalServiceId : Number(c.productId) === Number(item.id)
              );
              const outOfStock = !item.isService && Number(item.currentStock) <= 0;
              const rate = Number(item.sellingRate) || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => !outOfStock && handleMobileAddToCart(item)}
                  className={`bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between transition-all select-none ${
                    outOfStock ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99] cursor-pointer hover:border-blue-300'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-slate-400 font-semibold tracking-wide mt-0.5">{item.code}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {item.isService ? (
                        <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Service
                        </span>
                      ) : outOfStock ? (
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
                      <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-[#1E3A8A] px-2.5 py-1 rounded-lg font-black text-xs">
                        <ShoppingCart size={13} />
                        <span>{inCart.quantity}</span>
                      </div>
                    ) : (
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white shadow-sm ${
                        outOfStock ? 'bg-slate-400' : 'bg-[#1E3A8A]'
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
        </div>

        {/* Fixed Bottom Action Bar: Total + Cart + Save */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-3 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.12)] flex items-center gap-2">
          <button
            type="button"
            onClick={() => validMobileCartItems.length > 0 && setIsMobileCheckoutOpen(true)}
            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
          >
            <div className="relative bg-blue-50 text-[#1E3A8A] p-2 rounded-xl shrink-0">
              <ShoppingCart size={18} />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {mobileCartTotalQty}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-black leading-tight text-slate-800 truncate">
                {formatCurrency(watch('netAmount') || 0)}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold truncate">
                {validMobileCartItems.length} item{validMobileCartItems.length !== 1 ? 's' : ''}
                {validMobileCartItems.length > 0 ? ' · tap for cart' : ''}
              </p>
            </div>
          </button>
          {validMobileCartItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMobileCheckoutOpen(true)}
              className="h-10 px-3 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold flex items-center gap-0.5 shrink-0 active:scale-[0.98] transition-transform"
            >
              <span>Cart</span>
              <ChevronRight size={16} />
            </button>
          )}
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={handleMobileSave}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white text-sm font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 shrink-0 transition-all"
          >
            <CheckCircle size={17} />
            <span>{createMutation.isPending ? 'SAVING...' : editId ? 'UPDATE' : 'SAVE'}</span>
          </button>
        </div>

        {/* Mobile Checkout Drawer / Modal */}
        {isMobileCheckoutOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Checkout</h3>
                  <p className="text-[11px] text-slate-500">Invoice: {watch('invoiceNo') || 'Generating...'}</p>
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
                      const itemName = item.isService ? (item.itemName || 'Service Item') : (prod?.name || `Product #${item.productId}`);
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
                              <span className="text-[10px] text-blue-600 font-bold">tap to edit rate</span>
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
                            ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white shadow-sm'
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
                  {settings?.enableTax && Number(watch('tax')) > 0 && (
                    <div className="flex justify-between text-xs text-slate-500 font-semibold">
                      <span>Total Tax:</span>
                      <span className="text-slate-800 font-bold">{formatCurrency(watch('tax') || 0)}</span>
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
                    handleMobileSave();
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white py-3.5 rounded-xl font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <CheckCircle size={20} />
                  <span>{createMutation.isPending ? 'SAVING...' : 'CONFIRM SALE'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customer Picker Modal */}
        {isMobileCustomerPickerOpen && createPortal(
          <div className="fixed inset-0 z-[999] bg-black/60 flex flex-col justify-start pt-3 sm:pt-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl mx-3 max-h-[75vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-top duration-200">
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
                    !watch('customerId') ? 'bg-blue-50/70' : ''
                  }`}
                >
                  <p className={`text-sm font-bold ${!watch('customerId') ? 'text-[#1E3A8A]' : 'text-slate-800'}`}>
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
                        isSelected ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <p className={`text-sm font-bold ${isSelected ? 'text-[#1E3A8A]' : 'text-slate-800'}`}>
                        {c.name}
                      </p>
                      {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        , document.body)}

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
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-blue-500 text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Rate ({settings?.currencySymbol || '₹'})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter rate"
                    autoFocus
                    value={mobileEditRate}
                    onChange={(e) => setMobileEditRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-blue-500 text-right placeholder:text-slate-300 placeholder:font-normal placeholder:text-sm"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-blue-500 text-right"
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

      {/* Printable Receipt - removed */}
      <div id="printable-receipt" className="hidden">
        <div className="text-center mb-4 print:pt-4">
          <div className="text-xl font-bold uppercase">NASA FRESH MART <span className="text-base font-normal">(001634825-A)</span></div>
          <p className="mt-1">NO 8G, JLN 3/2 PANDAN JAYA, 55100 KUALA LUMPUR.</p>
          <p>Tel : 019-300 1451</p>
        </div>

        <div className="border-t border-b border-black py-2 mb-4 text-center font-bold text-lg uppercase tracking-wider">
          INVOICE
        </div>

        <div className="flex justify-between mb-6">
          {/* Left Column */}
          <div className="w-1/2 pr-4">
            <div className="flex">
              <span className="w-16">Bill To:</span>
              <div>
                <p className="font-bold">{selectedCustomer?.id ? `CUST-${selectedCustomer.id}` : ''}</p>
                <p className="font-bold">{selectedCustomer?.name || ''}</p>
                <p>{selectedCustomer?.address || ''}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-4">
              <span>TEL: {selectedCustomer?.phone || ''}</span>
              <span>FAX: </span>
            </div>
            <p>Attn:</p>
          </div>

          {/* Right Column */}
          <div className="w-1/2 pl-12">
            <div className="grid grid-cols-[100px_10px_1fr] gap-y-1">
              <span className="font-bold">NO.</span><span>:</span><span>{watch('invoiceNo')}</span>
              <span>DATE</span><span>:</span><span>{watch('date')}</span>
              {/* <span>YOUR P/O NO.</span><span>:</span><span></span> */}
              <span>SALESMAN</span><span>:</span><span></span>
              {/* <span>TERMS</span><span>:</span><span>C.O.D.</span> */}
              <span>PAY TYPE</span><span>:</span><span>{paymentModes.find((p: any) => p.id === Number(watch('paymentModeId')))?.name || ''}</span>
              <span>PENDING AMT</span><span>:</span><span>{Number(selectedCustomer?.openingBalance || 0).toFixed(2)}</span>
              <span>PAGE</span><span>:</span><span>1 of 1</span>
            </div>
          </div>
        </div>

        <table className="w-full text-left border-y border-black mb-4 whitespace-nowrap">
          <thead>
            <tr className="border-b border-black text-xs uppercase">
              <th className="py-2 w-[15%]">Code</th>
              <th className="py-2 w-[40%]">Description</th>
              <th className="py-2 w-[10%] text-right">Qty</th>
              <th className="py-2 w-[10%] text-center">UOM</th>
              <th className="py-2 w-[10%] text-right">U.Price</th>
              <th className="py-2 w-[15%] text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {watch('items').filter((i: any) => i.productId > 0).map((item: any, idx: number) => {
              const product = products.find((p: any) => p.id === item.productId);
              return (
                <tr key={idx}>
                  <td className="py-1">{product?.code || ''}</td>
                  <td className="py-1">{product?.name || ''}</td>
                  <td className="py-1 text-right">{item.quantity}</td>
                  <td className="py-1 text-center">{item.unit || ''}</td>
                  <td className="py-1 text-right">{Number(item.rate || 0).toFixed(2)}</td>
                  <td className="py-1 text-right">{(item.total || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex-1"></div>

        <div>
          <p className="uppercase mb-4">RINGGIT MALAYSIA {numberToWords(watch('netAmount'))} ONLY</p>

          <div className="flex justify-between items-start border-t border-black pt-2">
            <div
              className="w-2/3 text-[10px] text-black pr-4 html-content"
              dangerouslySetInnerHTML={{ __html: settings?.invoiceNotes || '' }}
            />
            <div className="w-1/3 flex flex-col font-bold text-sm gap-1">
              <div className="flex justify-between">
                <span>SUBTOTAL :</span>
                <span className="min-w-[100px] text-right">{Number(watch('grossAmount') || 0).toFixed(2)}</span>
              </div>
              {Number(watch('totalDiscount')) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>DISCOUNT :</span>
                  <span className="min-w-[100px] text-right">-{Number(watch('totalDiscount')).toFixed(2)}</span>
                </div>
              )}
              {settings?.enableTax && Number(watch('tax')) > 0 && (
                (() => {
                  const storeState = (settings.state || '').trim().toLowerCase();
                  const custState = (selectedCustomer?.state || '').trim().toLowerCase();

                  if (storeState && custState && storeState === custState) {
                    const splitTax = Number(watch('tax')) / 2;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>CGST :</span>
                          <span className="min-w-[100px] text-right">{splitTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST :</span>
                          <span className="min-w-[100px] text-right">{splitTax.toFixed(2)}</span>
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <div className="flex justify-between">
                        <span>IGST :</span>
                        <span className="min-w-[100px] text-right">{Number(watch('tax')).toFixed(2)}</span>
                      </div>
                    );
                  }
                })()
              )}
              <div className="flex justify-between border-t border-black pt-1 mt-1">
                <span>TOTAL : RM</span>
                <span className="border-b-2 border-black border-double min-w-[100px] text-right">{Number(watch('netAmount') || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-8">
            <div className="text-center w-64 border-t border-black pt-1 relative">
              {settings?.signatureImage && (
                <img
                  src={settings.signatureImage}
                  alt="Authorised Signature"
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 h-16 object-contain"
                />
              )}
              Authorised Signature
            </div>
          </div>
        </div>
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
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-4 shadow-sm border border-blue-100">
                <p className="font-bold text-[15px]">Net Amount: {formatCurrency(pendingSavePayload?.grandTotal || 0)}</p>
                <p className="text-[13px] mt-1 text-blue-600">Invoice No: {pendingSavePayload?.invoiceNo}</p>
              </div>
              {Number(customerPaid) > 0 && (
                <div className={`mb-4 flex justify-between items-center px-4 py-2 rounded-lg font-black text-[15px] ${Number(customerPaid) >= (pendingSavePayload?.grandTotal || 0)
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                  <span>{Number(customerPaid) >= (pendingSavePayload?.grandTotal || 0) ? '💵 Change / Return:' : '⚠️ Short by:'}</span>
                  <span>{formatCurrency(Math.abs(Number(customerPaid) - (pendingSavePayload?.grandTotal || 0)))}</span>
                </div>
              )}
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

      {/* Drafts Modal */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-[#7C3AED] text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-[15px]">
                <Clock size={18} /> Saved Drafts
              </div>
              <button type="button" onClick={() => setIsDraftsModalOpen(false)} className="hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {drafts.length === 0 ? (
                <p className="text-[13px] text-gray-500 italic py-6 text-center">No saved drafts. Click "Save Draft" while filling a sale to save it temporarily.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {drafts.sort((a: any, b: any) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).map((draft: any) => (
                    <div key={draft.id} onClick={() => setSelectedDraft(draft)} className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50 hover:border-[#7C3AED]/40 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[14px] text-[#1F2937] truncate">{draft.customerName}{(draft.customerPhone || customers.find((c: any) => c.id === Number(draft.customerId))?.phone) ? <span className="text-[12px] font-medium text-gray-400 ml-2">- {(draft.customerPhone || customers.find((c: any) => c.id === Number(draft.customerId))?.phone)}</span> : null}{draft.customerId ? <span className="text-[11px] font-bold text-[#7C3AED] ml-2">ID: {draft.customerId}</span> : null}</div>
                        <div className="text-[12px] text-gray-500 mt-0.5 flex flex-wrap gap-2">
                          <span>Items: {draft.itemCount} ({draft.qtyCount} qty)</span>
                          <span>Net: {formatCurrency(draft.netAmount)}</span>
                          <span>Saved: {new Date(draft.savedAt).toLocaleTimeString()} {new Date(draft.savedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedDraft(draft); }}
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded text-[12px] font-bold flex items-center gap-1 transition-colors border border-blue-100"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id); }}
                          className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded text-[12px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Draft Preview Modal */}
      {selectedDraft && (
        <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4" onClick={() => setSelectedDraft(null)}>
          <div className="bg-white rounded shadow-lg w-full max-w-xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#7C3AED] text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-[15px]">
                <FileText size={18} /> Draft Details
              </div>
              <button type="button" onClick={() => setSelectedDraft(null)} className="hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh]">
              <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-[#F9FAFB]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Customer</span>
                  <span className="text-[11px] text-gray-400">Saved {new Date(selectedDraft.savedAt).toLocaleString()}</span>
                </div>
                <div className="font-black text-[18px] text-[#1F2937]">{selectedDraft.customerName || customers.find((c: any) => c.id === Number(selectedDraft.customerId))?.name || 'Counter / Cash Sale'}</div>
                {(() => {
                  const live = customers.find((c: any) => c.id === Number(selectedDraft.customerId));
                  const phone = selectedDraft.customerPhone || live?.phone || '';
                  const address = selectedDraft.customerAddress || live?.address || '';
                  const state = selectedDraft.customerState || live?.state || '';
                  if (phone || address || state) {
                    return (
                      <div className="text-[13px] text-gray-600 mt-1 flex flex-col gap-0.5">
                        {phone && <span>Mobile: <span className="font-bold text-[#1F2937]">{phone}</span></span>}
                        {address && <span>{address}</span>}
                        {state && <span className="font-bold text-[#1F2937]">{state}</span>}
                      </div>
                    );
                  }
                  return <div className="text-[12px] text-gray-500 italic mt-1">No customer contact details saved.</div>;
                })()}
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-[12px] font-bold text-gray-500">Items</span>
                  <span className="text-[12px] font-bold text-gray-500">Qty &times; Rate &minus; Disc = Total</span>
                </div>
                {((selectedDraft.data?.items || []).length === 0 ? [{ productId: 0, quantity: 0, rate: 0, discAmt: 0, total: 0 }] : selectedDraft.data.items).map((item: any, idx: number) => {
                  const product = products.find((p: any) => p.id === Number(item.productId));
                  const name = item.isService ? (item.itemName || 'Service') : (product?.name || item.itemName || `#${item.productId || 0}`);
                  return (
                    <div key={idx} className="flex justify-between items-center px-3 py-1.5 border-b border-gray-100 text-[13px]">
                      <span className="text-[#1F2937] font-medium truncate mr-3">{name}</span>
                      <span className="text-gray-600 shrink-0 tabular-nums">{Number(item.quantity) || 0} &times; {formatCurrency(Number(item.rate) || 0)} {Number(item.discAmt) > 0 && <span className="text-red-500"> (-{formatCurrency(Number(item.discAmt))})</span>} = <span className="font-bold">{formatCurrency(Number(item.total) || 0)}</span></span>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center px-3 py-2 bg-[#ECFDF5] rounded border border-green-200 mt-2">
                  <span className="text-[13px] font-black text-[#065F46] uppercase">Net Amount</span>
                  <span className="text-[16px] font-black text-[#059669]">{formatCurrency(selectedDraft.netAmount)}</span>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => { setSelectedDraft(null); }}
                className="flex-1 bg-white border-2 border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] py-2.5 rounded font-bold text-[13px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDraft(selectedDraft.id)}
                className="flex-1 bg-red-50 border-2 border-red-200 hover:bg-red-500 hover:text-white text-red-500 py-2.5 rounded font-bold text-[13px] transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={15} /> Delete Draft
              </button>
              <button
                type="button"
                onClick={() => handleLoadDraft(selectedDraft)}
                className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-2.5 rounded font-bold text-[13px] transition-colors flex items-center justify-center gap-2 shadow"
              >
                <Clock size={15} /> Load & Continue Entry
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

      {showPrintModal && printData && (
        <InvoicePrintModal
          isOpen={showPrintModal}
          sale={printData}
          isEstimation={false}
          autoPrint={true}
          onClose={() => {
            setShowPrintModal(false);
            setPrintData(null);
          }}
        />
      )}

    </div>
  );
};

export default POS;
