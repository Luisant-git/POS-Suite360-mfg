import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  DollarSign, 
  TrendingUp, 
  Layers, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Loader2,
  Filter,
  RefreshCw,
  Maximize2,
  Minimize2,
  RotateCcw
} from 'lucide-react';
import { getMalaysiaDateStr, formatMalaysiaDate } from '../../utils/date';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { useSettings } from '../../contexts/SettingsContext';
import SearchableSelect from '../../components/SearchableSelect';

type ViewMode = 'product' | 'supplier';

const ProductWiseSalesReport = () => {
  const { formatCurrency, settings } = useSettings();
  const navigate = useNavigate();

  // Mode: Product Wise vs Supplier Wise
  const [viewMode, setViewMode] = useState<ViewMode>('product');

  // Dates
  const today = getMalaysiaDateStr();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  // Filters
  const [selectedProductId, setSelectedProductId] = useState<string | number>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | number>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Quick Date Presets & Full View
  const [activePreset, setActivePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | ''>('today');
  const [isExpanded, setIsExpanded] = useState(false);

  const datePresets = useMemo(() => {
    const todayStr = getMalaysiaDateStr();
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yesterdayStr = toYMD(y);

    const w = new Date(now);
    w.setDate(now.getDate() - 7);
    const weekStartStr = toYMD(w);

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthFirstStr = toYMD(firstDay);

    return {
      today: { from: todayStr, to: todayStr },
      yesterday: { from: yesterdayStr, to: yesterdayStr },
      week: { from: weekStartStr, to: todayStr },
      month: { from: monthFirstStr, to: todayStr },
      all: { from: '', to: '' },
    };
  }, []);

  const isPresetActive = (key: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    if (activePreset === key) return true;
    const target = datePresets[key];
    return fromDate === target.from && toDate === target.to;
  };

  const applyDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    setActivePreset(preset);
    const target = datePresets[preset];
    setFromDate(target.from);
    setToDate(target.to);
  };

  // Reset Filters to Today defaults
  const isReset = 
    fromDate === today &&
    toDate === today &&
    !selectedProductId &&
    !selectedSupplierId &&
    !searchQuery;

  const handleResetFilters = () => {
    applyDatePreset('today');
    setSelectedProductId('');
    setSelectedSupplierId('');
    setSearchQuery('');
    setExpandedGroups({});
  };

  // Master Data
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data
  });

  // Fetch Product Wise Sales Data
  const { data: productReportData = [], isLoading: isProductLoading, refetch: refetchProduct } = useQuery({
    queryKey: ['product-wise-sales', fromDate, toDate, selectedProductId, selectedSupplierId],
    queryFn: async () => {
      const { data } = await api.get('/reports/product-wise-sales', {
        params: {
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          productId: selectedProductId || undefined,
          supplierId: selectedSupplierId || undefined,
        }
      });
      return data;
    },
    enabled: viewMode === 'product'
  });

  // Fetch Supplier Wise Sales Data
  const { data: supplierReportData = [], isLoading: isSupplierLoading, refetch: refetchSupplier } = useQuery({
    queryKey: ['supplier-wise-sales', fromDate, toDate, selectedSupplierId],
    queryFn: async () => {
      const { data } = await api.get('/reports/supplier-wise-sales', {
        params: {
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          supplierId: selectedSupplierId || undefined,
        }
      });
      return data;
    },
    enabled: viewMode === 'supplier'
  });

  const isLoading = viewMode === 'product' ? isProductLoading : isSupplierLoading;

  // Filter Product Groups by text search
  const filteredProductGroups = useMemo(() => {
    if (!productReportData || !Array.isArray(productReportData)) return [];
    if (!searchQuery.trim()) return productReportData;
    const q = searchQuery.toLowerCase();
    return productReportData.filter((group: any) => {
      const matchHeader = 
        group.productName?.toLowerCase().includes(q) ||
        group.productCode?.toLowerCase().includes(q) ||
        group.supplierName?.toLowerCase().includes(q) ||
        group.categoryName?.toLowerCase().includes(q);
      const matchItems = group.items?.some((item: any) =>
        item.invoiceNo?.toLowerCase().includes(q) ||
        item.customerName?.toLowerCase().includes(q)
      );
      return matchHeader || matchItems;
    });
  }, [productReportData, searchQuery]);

  // Filter Supplier Groups by text search
  const filteredSupplierGroups = useMemo(() => {
    if (!supplierReportData || !Array.isArray(supplierReportData)) return [];
    if (!searchQuery.trim()) return supplierReportData;
    const q = searchQuery.toLowerCase();
    return supplierReportData.filter((group: any) => {
      const matchSupplier = 
        group.supplierName?.toLowerCase().includes(q) ||
        group.supplierCode?.toLowerCase().includes(q) ||
        group.phone?.toLowerCase().includes(q) ||
        group.contactPerson?.toLowerCase().includes(q);
      const matchProducts = group.products?.some((p: any) => 
        p.productName?.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q)
      );
      return matchSupplier || matchProducts;
    });
  }, [supplierReportData, searchQuery]);

  // Summary Metrics
  const productMetrics = useMemo(() => {
    return filteredProductGroups.reduce((acc: any, g: any) => {
      acc.totalQty += Number(g.totalQty || 0);
      acc.totalRevenue += Number(g.totalValue || 0);
      acc.totalCost += Number(g.totalCost || 0);
      acc.totalProfit += Number(g.totalProfit || 0);
      acc.productCount += 1;
      return acc;
    }, { totalQty: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, productCount: 0 });
  }, [filteredProductGroups]);

  const supplierMetrics = useMemo(() => {
    return filteredSupplierGroups.reduce((acc: any, g: any) => {
      acc.totalQty += Number(g.totalQty || 0);
      acc.totalRevenue += Number(g.totalSalesValue || 0);
      acc.totalCost += Number(g.totalCostValue || 0);
      acc.totalMargin += Number(g.totalMargin || 0);
      acc.totalOutstanding += Number(g.outstandingBalance || 0);
      acc.supplierCount += 1;
      return acc;
    }, { totalQty: 0, totalRevenue: 0, totalCost: 0, totalMargin: 0, totalOutstanding: 0, supplierCount: 0 });
  }, [filteredSupplierGroups]);

  // Toggle single group expand
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key] // defaults to open if not set
    }));
  };

  const isGroupExpanded = (key: string) => {
    return expandedGroups[key] !== false; // open by default
  };

  const toggleAllGroups = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    if (viewMode === 'product') {
      filteredProductGroups.forEach((g: any, idx: number) => {
        updated[`prod-${idx}`] = expand;
      });
    } else {
      filteredSupplierGroups.forEach((g: any, idx: number) => {
        updated[`sup-${idx}`] = expand;
      });
    }
    setExpandedGroups(updated);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (viewMode === 'product') {
      const exportData: any[] = [];
      filteredProductGroups.forEach((group: any) => {
        group.items?.forEach((item: any) => {
          exportData.push({
            'Product': group.productName,
            'Supplier': group.supplierName,
            'Invoice No': item.invoiceNo,
            'Date': formatMalaysiaDate(item.date),
            'Customer': item.customerName,
            'Rate': item.rate,
            'Qty': item.qty,
            'Sales Value': item.value,
            'Cost Value': item.cost,
            'Gross Profit': item.profit,
          });
        });
        exportData.push({
          'Product': `SUBTOTAL: ${group.productName}`,
          'Supplier': '',
          'Invoice No': '',
          'Date': '',
          'Customer': '',
          'Rate': '',
          'Qty': group.totalQty,
          'Sales Value': group.totalValue,
          'Cost Value': group.totalCost,
          'Gross Profit': group.totalProfit,
        });
      });

      exportToExcel(
        exportData, 
        `Product_Wise_Sales_${fromDate || 'all'}_to_${toDate || 'all'}`, 
        'Product Sales'
      );
    } else {
      const exportData: any[] = [];
      filteredSupplierGroups.forEach((group: any) => {
        group.products?.forEach((p: any) => {
          exportData.push({
            'Supplier Name': group.supplierName,
            'Supplier Phone': group.phone,
            'Outstanding Payable': group.outstandingBalance,
            'Product Code': p.productCode,
            'Product Name': p.productName,
            'Qty Sold': p.qty,
            'Purchase Rate': p.purchaseRate,
            'Selling Rate': p.sellingRate,
            'Sales Revenue': p.salesValue,
            'COGS Cost': p.costValue,
            'Gross Margin': p.margin,
          });
        });
        exportData.push({
          'Supplier Name': `SUBTOTAL: ${group.supplierName}`,
          'Supplier Phone': '',
          'Outstanding Payable': group.outstandingBalance,
          'Product Code': '',
          'Product Name': 'Total',
          'Qty Sold': group.totalQty,
          'Purchase Rate': '',
          'Selling Rate': '',
          'Sales Revenue': group.totalSalesValue,
          'COGS Cost': group.totalCostValue,
          'Gross Margin': group.totalMargin,
        });
      });

      exportToExcel(
        exportData, 
        `Supplier_Wise_Sales_and_Payables_${fromDate || 'all'}_to_${toDate || 'all'}`, 
        'Supplier Sales'
      );
    }
  };

  // Export to PDF
  const handleExportPdf = () => {
    if (viewMode === 'product') {
      const cols: PdfColumn[] = [
        { header: 'Product Name', dataKey: 'productName' },
        { header: 'Supplier', dataKey: 'supplier' },
        { header: 'Invoice No', dataKey: 'invoiceNo' },
        { header: 'Date', dataKey: 'date' },
        { header: 'Qty', dataKey: 'qty' },
        { header: 'Sales Value', dataKey: 'value' },
      ];

      const pdfData: any[] = [];
      filteredProductGroups.forEach((group: any) => {
        group.items?.forEach((item: any) => {
          pdfData.push({
            productName: group.productName,
            supplier: group.supplierName,
            invoiceNo: item.invoiceNo,
            date: formatMalaysiaDate(item.date),
            qty: item.qty,
            value: formatCurrency(item.value)
          });
        });
        pdfData.push({
          productName: `SUBTOTAL: ${group.productName}`,
          supplier: '',
          invoiceNo: '',
          date: '',
          qty: group.totalQty.toString(),
          value: formatCurrency(group.totalValue)
        });
      });

      exportTableToPdf(
        cols, 
        pdfData, 
        `Product_Wise_Sales_${fromDate || 'all'}_to_${toDate || 'all'}`, 
        'Product Wise Sales Report', 
        settings?.shopName, 
        pdfData.length
      );
    } else {
      const cols: PdfColumn[] = [
        { header: 'Supplier Name', dataKey: 'supplierName' },
        { header: 'Outstanding', dataKey: 'outstanding' },
        { header: 'Product', dataKey: 'product' },
        { header: 'Qty Sold', dataKey: 'qty' },
        { header: 'Sales Value', dataKey: 'salesValue' },
        { header: 'Margin', dataKey: 'margin' },
      ];

      const pdfData: any[] = [];
      filteredSupplierGroups.forEach((group: any) => {
        group.products?.forEach((p: any) => {
          pdfData.push({
            supplierName: group.supplierName,
            outstanding: formatCurrency(group.outstandingBalance),
            product: p.productName,
            qty: p.qty.toString(),
            salesValue: formatCurrency(p.salesValue),
            margin: formatCurrency(p.margin),
          });
        });
        pdfData.push({
          supplierName: `TOTAL: ${group.supplierName}`,
          outstanding: formatCurrency(group.outstandingBalance),
          product: 'All Products',
          qty: group.totalQty.toString(),
          salesValue: formatCurrency(group.totalSalesValue),
          margin: formatCurrency(group.totalMargin),
        });
      });

      exportTableToPdf(
        cols, 
        pdfData, 
        `Supplier_Wise_Sales_${fromDate || 'all'}_to_${toDate || 'all'}`, 
        'Supplier Wise Sales & Outstanding Report', 
        settings?.shopName, 
        pdfData.length
      );
    }
  };

  return (
    <div className={`${isExpanded ? 'fixed inset-0 z-[9999]' : 'absolute inset-0 z-10'} bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden p-2 sm:p-4`}>
      {!isExpanded && <ReportTabs />}

      {/* Top Header Card with Summary Stats */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-2 sm:mb-3 p-2 sm:p-3 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 sm:mb-2.5 border-b border-[#E2E8F0] pb-2 sm:pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#1E293B] text-white p-2 rounded-lg shadow-sm shrink-0">
              {viewMode === 'product' ? <Package size={18} /> : <Truck size={18} />}
            </div>
            <div>
              <h1 className="font-bold text-[13px] sm:text-[15px] text-[#0F172A] uppercase tracking-wide">
                {viewMode === 'product' ? 'PRODUCT WISE SALES REPORT' : 'SUPPLIER WISE SALES & OUTSTANDING REPORT'}
              </h1>
              <p className="text-xs text-black font-bold hidden sm:block">
                {viewMode === 'product' 
                  ? 'Item-by-item sales breakdown with invoice-level tracking and margins' 
                  : 'Supplier sales revenue, gross margin contribution, and real-time outstanding payables'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* View Mode Switcher */}
            <div className="bg-gray-100 p-1 rounded-md flex items-center gap-1 border border-gray-200 flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setViewMode('product')}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded text-[11px] sm:text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === 'product'
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-black hover:text-[#0F172A]'
                }`}
              >
                <Package size={13} /> Product Wise
              </button>
              <button
                type="button"
                onClick={() => setViewMode('supplier')}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded text-[11px] sm:text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === 'supplier'
                    ? 'bg-[#E11D48] text-white shadow-sm'
                    : 'text-black hover:text-[#E11D48]'
                }`}
              >
                <Truck size={13} /> Supplier Wise
              </button>
            </div>

            {/* Export Actions */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isLoading || (viewMode === 'product' ? filteredProductGroups.length === 0 : filteredSupplierGroups.length === 0)}
              className="bg-[#10B981] hover:bg-[#059669] text-white px-3 py-1.5 rounded text-[12px] font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 shrink-0"
              title="Export formatted Excel"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isLoading || (viewMode === 'product' ? filteredProductGroups.length === 0 : filteredSupplierGroups.length === 0)}
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-3 py-1.5 rounded text-[12px] font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 shrink-0"
              title="Print PDF Document"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-bold rounded transition-colors shadow-sm ${
                isExpanded 
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                  : 'bg-[#1E293B] text-white hover:bg-[#0F172A]'
              }`}
            >
              {isExpanded ? (
                <><Minimize2 size={13} /> <span className="hidden sm:inline">Exit Full View</span></>
              ) : (
                <><Maximize2 size={13} /> <span className="hidden sm:inline">Full View</span></>
              )}
            </button>
          </div>
        </div>

        {/* Stat Summary Cards */}
        {viewMode === 'product' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wide">Total Sales Revenue</span>
              <p className="text-base sm:text-lg font-bold text-[#1E3A8A] leading-tight">{formatCurrency(productMetrics.totalRevenue)}</p>
              <span className="text-[10px] font-bold text-[#2563EB] block">{productMetrics.productCount} distinct products</span>
            </div>
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#15803D] uppercase tracking-wide">Total Units Sold</span>
              <p className="text-base sm:text-lg font-bold text-[#14532D] leading-tight">{productMetrics.totalQty.toLocaleString()}</p>
              <span className="text-[10px] font-bold text-[#16A34A] block">Sum of quantities</span>
            </div>
            <div className="bg-[#FAF5FF] border border-[#E9D5FF] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#7E22CE] uppercase tracking-wide">Total Product COGS</span>
              <p className="text-base sm:text-lg font-bold text-[#581C87] leading-tight">{formatCurrency(productMetrics.totalCost)}</p>
              <span className="text-[10px] font-bold text-[#9333EA] block">Purchase cost estimate</span>
            </div>
            <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wide">Estimated Gross Profit</span>
              <p className="text-base sm:text-lg font-bold text-[#065F46] leading-tight">{formatCurrency(productMetrics.totalProfit)}</p>
              <span className="text-[10px] font-bold text-[#059669] block">
                {productMetrics.totalRevenue > 0 ? `${((productMetrics.totalProfit / productMetrics.totalRevenue) * 100).toFixed(1)}% margin` : '0% margin'}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wide">Supplier Sales Revenue</span>
              <p className="text-base sm:text-lg font-bold text-[#1E3A8A] leading-tight">{formatCurrency(supplierMetrics.totalRevenue)}</p>
              <span className="text-[10px] font-bold text-[#2563EB] block">{supplierMetrics.supplierCount} active suppliers</span>
            </div>
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#15803D] uppercase tracking-wide">Units Sold</span>
              <p className="text-base sm:text-lg font-bold text-[#14532D] leading-tight">{supplierMetrics.totalQty.toLocaleString()}</p>
              <span className="text-[10px] font-bold text-[#16A34A] block">Supplied items sold</span>
            </div>
            <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wide">Gross Margin</span>
              <p className="text-base sm:text-lg font-bold text-[#065F46] leading-tight">{formatCurrency(supplierMetrics.totalMargin)}</p>
              <span className="text-[10px] font-bold text-[#059669] block">
                {supplierMetrics.totalRevenue > 0 ? `${((supplierMetrics.totalMargin / supplierMetrics.totalRevenue) * 100).toFixed(1)}% profit` : '0% margin'}
              </span>
            </div>
            <div className="bg-[#FFF1F2] border border-[#FECDD3] p-2.5 rounded-md shadow-sm">
              <span className="text-[10px] font-bold text-[#E11D48] uppercase tracking-wide flex items-center gap-1">
                <AlertCircle size={11} /> Total Outstanding Payables
              </span>
              <p className="text-base sm:text-lg font-bold text-[#BE123C] leading-tight">{formatCurrency(supplierMetrics.totalOutstanding)}</p>
              <span className="text-[10px] font-bold text-[#E11D48] block">Currently owed to suppliers</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Table Container Card */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md flex-1 overflow-hidden flex flex-col min-h-0">

        {/* Filters Bar */}
        <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#CBD5E1] flex flex-col gap-1.5">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-black mr-1 flex items-center gap-1"><Calendar size={12} /> Dates:</span>
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all shadow-sm border ${
                isPresetActive('today')
                  ? 'bg-[#2563EB] text-white border-[#1D4ED8]'
                  : 'bg-white hover:bg-blue-50 hover:text-blue-600 border-[#CBD5E1] text-black'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('yesterday')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all shadow-sm border ${
                isPresetActive('yesterday')
                  ? 'bg-[#2563EB] text-white border-[#1D4ED8]'
                  : 'bg-white hover:bg-blue-50 hover:text-blue-600 border-[#CBD5E1] text-black'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('week')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all shadow-sm border ${
                isPresetActive('week')
                  ? 'bg-[#2563EB] text-white border-[#1D4ED8]'
                  : 'bg-white hover:bg-blue-50 hover:text-blue-600 border-[#CBD5E1] text-black'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('month')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all shadow-sm border ${
                isPresetActive('month')
                  ? 'bg-[#2563EB] text-white border-[#1D4ED8]'
                  : 'bg-white hover:bg-blue-50 hover:text-blue-600 border-[#CBD5E1] text-black'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all shadow-sm border ${
                isPresetActive('all')
                  ? 'bg-[#2563EB] text-white border-[#1D4ED8]'
                  : 'bg-white hover:bg-blue-50 hover:text-blue-600 border-[#CBD5E1] text-black'
              }`}
            >
              All Time
            </button>
            
            <div className="ml-auto flex items-center gap-1.5">
              <button 
                type="button" 
                onClick={handleResetFilters} 
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all shadow-sm border flex items-center gap-1 ${
                  !isReset 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200' 
                    : 'bg-white hover:bg-gray-100 text-black border-[#CBD5E1]'
                }`}
                title="Reset all filters to defaults"
              >
                <RotateCcw size={11} /> Reset
              </button>
              <button 
                type="button" 
                onClick={() => toggleAllGroups(true)} 
                className="px-2 py-0.5 bg-white hover:bg-gray-100 border border-[#CBD5E1] rounded text-[10.5px] font-bold text-black shadow-sm flex items-center gap-1"
              >
                <ChevronDown size={12} /> Expand All
              </button>
              <button 
                type="button" 
                onClick={() => toggleAllGroups(false)} 
                className="px-2 py-0.5 bg-white hover:bg-gray-100 border border-[#CBD5E1] rounded text-[10.5px] font-bold text-black shadow-sm flex items-center gap-1"
              >
                <ChevronUp size={12} /> Collapse All
              </button>
            </div>
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 items-end">
            <div>
              <label className="block text-[11px] font-bold text-black mb-0.5">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActivePreset('');
                }}
                className="w-full px-2.5 py-1 border border-[#CBD5E1] rounded-md text-[12px] font-bold text-black outline-none focus:border-[#3B82F6] bg-white shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-black mb-0.5">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActivePreset('');
                }}
                className="w-full px-2.5 py-1 border border-[#CBD5E1] rounded-md text-[12px] font-bold text-black outline-none focus:border-[#3B82F6] bg-white shadow-sm"
              />
            </div>

            {viewMode === 'product' && (
              <div>
                <label className="block text-[11px] font-bold text-black mb-0.5">Product Filter</label>
                <SearchableSelect
                  options={[
                    { value: '', label: '-- All Products --' },
                    ...products.map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` }))
                  ]}
                  value={selectedProductId}
                  onChange={(val) => setSelectedProductId(val)}
                  placeholder="-- All Products --"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-black mb-0.5">Supplier Filter</label>
              <SearchableSelect
                options={[
                  { value: '', label: '-- All Suppliers --' },
                  ...suppliers.map((s: any) => ({ value: s.id, label: `${s.name} ${s.phone ? `(${s.phone})` : ''}` }))
                ]}
                value={selectedSupplierId}
                onChange={(val) => setSelectedSupplierId(val)}
                placeholder="-- All Suppliers --"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-black mb-0.5">Quick Search</label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search item, code, doc #..."
                    className="w-full pl-7 pr-2.5 py-1 border border-[#CBD5E1] rounded-md text-[12px] font-bold text-black outline-none focus:border-[#3B82F6] bg-white shadow-sm"
                  />
                  <Search size={13} className="absolute left-2 top-2 text-gray-500" />
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={`px-2.5 py-1 rounded-md text-[11.5px] font-bold flex items-center gap-1 transition-all shadow-sm border shrink-0 h-[28px] ${
                    !isReset
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'
                      : 'bg-white hover:bg-gray-100 text-black border-[#CBD5E1]'
                  }`}
                  title="Reset all filters"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-white">
          {isLoading ? (
            <div className="p-12 text-center text-black font-bold flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
              <span className="text-xs">Loading sales analytics and ledger data...</span>
            </div>
          ) : viewMode === 'product' ? (
            /* ========================================================================= */
            /* PRODUCT WISE TABLE (NASA PATTERN UPGRADED)                                */
            /* ========================================================================= */
            filteredProductGroups.length === 0 ? (
              <div className="p-12 text-center text-black font-bold flex flex-col items-center justify-center gap-2">
                <Package size={32} className="text-gray-400" />
                <span className="text-xs">No product sales records found for the selected dates and filters.</span>
              </div>
            ) : (
              <table className="w-full text-left text-[12px] whitespace-nowrap border-collapse">
                <thead>
                  <tr className="bg-[#1E293B] text-white font-bold sticky top-0 z-20">
                    <th className="px-2 py-2 border-r border-[#334155] w-8 text-center">#</th>
                    <th className="px-3 py-2 border-r border-[#334155]">DOC # / INVOICE NO</th>
                    <th className="px-3 py-2 border-r border-[#334155]">DATE</th>
                    <th className="px-3 py-2 border-r border-[#334155]">CUSTOMER NAME</th>
                    <th className="px-3 py-2 border-r border-[#334155]">SUPPLIER</th>
                    <th className="px-3 py-2 text-right border-r border-[#334155]">SALES QTY</th>
                    <th className="px-3 py-2 text-right border-r border-[#334155]">UNIT RATE</th>
                    <th className="px-3 py-2 text-right border-r border-[#334155]">SALES VALUE</th>
                    <th className="px-3 py-2 text-right">PROFIT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductGroups.map((group: any, idx: number) => {
                    const groupKey = `prod-${idx}`;
                    const isOpen = isGroupExpanded(groupKey);

                    return (
                      <React.Fragment key={idx}>
                        {/* Group Header Row */}
                        <tr 
                          onClick={() => toggleGroup(groupKey)}
                          className="bg-[#F1F5F9] border-y border-[#CBD5E1] cursor-pointer hover:bg-[#E2E8F0] transition-colors select-none"
                        >
                          <td className="px-2 py-1.5 text-center text-black font-bold">
                            {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} className="rotate-180" />}
                          </td>
                          <td colSpan={4} className="px-3 py-1.5 font-bold text-black uppercase tracking-wide text-[11.5px]">
                            <span className="text-[#2563EB] mr-2">{group.productCode ? `[${group.productCode}]` : ''}</span>
                            <span>{group.rawProductName || group.productName}</span>
                            <span className="ml-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-black border border-[#CBD5E1]">
                              {group.categoryName || 'General'}
                            </span>
                            {group.supplierName && group.supplierName !== 'Unassigned Supplier' && (
                              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                                Supplier: {group.supplierName}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-black border-r border-[#CBD5E1]">
                            {group.totalQty.toLocaleString()} {group.unitName || ''}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-400 font-bold border-r border-[#CBD5E1]">-</td>
                          <td className="px-3 py-1.5 text-right font-bold text-[#059669] border-r border-[#CBD5E1]">
                            {formatCurrency(group.totalValue)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-[#2563EB]">
                            {formatCurrency(group.totalProfit)}
                          </td>
                        </tr>

                        {/* Child Rows (Invoices) */}
                        {isOpen && group.items?.map((item: any, i: number) => (
                          <tr 
                            key={i}
                            className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${
                              i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'
                            }`}
                          >
                            <td className="px-2 py-1 text-center text-gray-400 font-bold">{i + 1}</td>
                            <td 
                              onClick={() => {
                                if (item.invoiceNo && item.invoiceNo !== '-') {
                                  navigate(`/reports/sales?invoiceNo=${item.invoiceNo}`);
                                }
                              }}
                              className="px-3 py-1 border-r border-[#E2E8F0] font-bold text-[#2563EB] cursor-pointer hover:underline flex items-center gap-1.5"
                            >
                              <Eye size={11} className="opacity-70" />
                              {item.invoiceNo}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-black font-bold">
                              {formatMalaysiaDate(item.date)}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-black font-bold">
                              {item.customerName}
                              {item.paymentMode && (
                                <span className="ml-2 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-black">
                                  {item.paymentMode}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-black font-bold">
                              {group.supplierName}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-right text-black font-bold">
                              {item.qty}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-right text-black font-bold">
                              {formatCurrency(item.rate)}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-right font-bold text-[#059669]">
                              {formatCurrency(item.value)}
                            </td>
                            <td className="px-3 py-1 text-right font-bold text-[#2563EB]">
                              {formatCurrency(item.profit)}
                            </td>
                          </tr>
                        ))}

                        {/* Subtotal Row */}
                        <tr className="bg-[#F8FAFC] border-b-2 border-[#CBD5E1]">
                          <td colSpan={5} className="px-3 py-1 text-right font-bold text-black uppercase text-[10.5px] border-r border-[#E2E8F0]">
                            Subtotal ({group.rawProductName || group.productName})
                          </td>
                          <td className="px-3 py-1 text-right font-bold text-black border-r border-[#E2E8F0]">
                            {group.totalQty}
                          </td>
                          <td className="px-3 py-1 text-right text-gray-400 font-bold border-r border-[#E2E8F0]">-</td>
                          <td className="px-3 py-1 text-right font-bold text-[#059669] border-r border-[#E2E8F0]">
                            {formatCurrency(group.totalValue)}
                          </td>
                          <td className="px-3 py-1 text-right font-bold text-[#2563EB]">
                            {formatCurrency(group.totalProfit)}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {/* Grand Totals Footer */}
                <tfoot className="bg-[#0F172A] !text-white font-bold sticky bottom-0 z-20 table-footer-white">
                  <tr className="border-t-2 border-[#334155] !text-white">
                    <td colSpan={5} style={{ color: '#ffffff' }} className="px-3 py-2 text-right uppercase tracking-wider text-[12px] font-bold !text-white border-r border-[#334155]">
                      GRAND TOTAL:
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white border-r border-[#334155]">
                      {productMetrics.totalQty.toLocaleString()}
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right font-bold !text-white border-r border-[#334155]">-</td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white border-r border-[#334155]">
                      {formatCurrency(productMetrics.totalRevenue)}
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white">
                      {formatCurrency(productMetrics.totalProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )
          ) : (
            /* ========================================================================= */
            /* SUPPLIER WISE SALES & OUTSTANDING TABLE                                   */
            /* ========================================================================= */
            filteredSupplierGroups.length === 0 ? (
              <div className="p-12 text-center text-black font-bold flex flex-col items-center justify-center gap-2">
                <Truck size={32} className="text-gray-400" />
                <span className="text-xs">No supplier sales records or payables found for the selected dates and filters.</span>
              </div>
            ) : (
              <table className="w-full text-left text-[12px] whitespace-nowrap border-collapse">
                <thead>
                  <tr className="bg-[#1E293B] text-white font-bold sticky top-0 z-20">
                    <th className="px-2 py-2 border-r border-[#334155] w-8 text-center">#</th>
                    <th className="px-3 py-2 border-r border-[#334155]">SUPPLIER & SUPPLIED PRODUCTS</th>
                    <th className="px-3 py-2 border-r border-[#334155]">CONTACT / PHONE</th>
                    <th className="px-3 py-2 text-right border-r border-[#334155]">CURRENT OUTSTANDING PAYABLE</th>
                    <th className="px-3 py-2 text-right border-r border-[#334155]">UNITS SOLD</th>
                    <th className="px-3 py-2 text-right border-r border-[#334155]">COGS (PURCHASE COST)</th>
                    <th className="px-3 py-2 text-right border-r border-[#334155]">SALES REVENUE</th>
                    <th className="px-3 py-2 text-right">GROSS MARGIN</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSupplierGroups.map((group: any, idx: number) => {
                    const groupKey = `sup-${idx}`;
                    const isOpen = isGroupExpanded(groupKey);

                    return (
                      <React.Fragment key={idx}>
                        {/* Supplier Group Header */}
                        <tr 
                          onClick={() => toggleGroup(groupKey)}
                          className="bg-[#FFF1F2] border-y border-[#FECDD3] cursor-pointer hover:bg-[#FFE4E6] transition-colors select-none"
                        >
                          <td className="px-2 py-1.5 text-center text-black font-bold">
                            {isOpen ? <ChevronDown size={13} className="text-[#E11D48]" /> : <ChevronUp size={13} className="rotate-180 text-[#E11D48]" />}
                          </td>
                          <td className="px-3 py-1.5 font-bold text-black uppercase tracking-wide text-[12px]">
                            <span className="text-[#E11D48] mr-2">[{group.supplierCode}]</span>
                            <span>{group.supplierName}</span>
                            <span className="ml-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#E11D48] border border-[#FECDD3]">
                              {group.products?.length || 0} Products Sold
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-black font-bold border-r border-[#FECDD3]">
                            {group.phone || '-'} {group.contactPerson ? `(${group.contactPerson})` : ''}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-[#E11D48] border-r border-[#FECDD3]">
                            <span className="px-2 py-0.5 rounded bg-white border border-[#FECDD3] shadow-sm">
                              {formatCurrency(group.outstandingBalance)}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-black border-r border-[#FECDD3]">
                            {group.totalQty.toLocaleString()}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-black border-r border-[#FECDD3]">
                            {formatCurrency(group.totalCostValue)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-[#059669] border-r border-[#FECDD3]">
                            {formatCurrency(group.totalSalesValue)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-[#2563EB]">
                            {formatCurrency(group.totalMargin)}
                          </td>
                        </tr>

                        {/* Child Products Supplied */}
                        {isOpen && group.products?.map((prod: any, pIdx: number) => (
                          <tr 
                            key={pIdx}
                            className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${
                              pIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'
                            }`}
                          >
                            <td className="px-2 py-1 text-center text-gray-400 font-bold">{pIdx + 1}</td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] font-bold text-black pl-6">
                              <span className="text-[#2563EB] mr-2">[{prod.productCode}]</span>
                              <span>{prod.productName}</span>
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-gray-400 font-bold text-[10.5px]">
                              Cost: {formatCurrency(prod.purchaseRate)} | Selling: {formatCurrency(prod.sellingRate)}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-right text-gray-400 font-bold">-</td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-right font-bold text-black">
                              {prod.qty.toLocaleString()} {prod.unitName}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-right font-bold text-black">
                              {formatCurrency(prod.costValue)}
                            </td>
                            <td className="px-3 py-1 border-r border-[#E2E8F0] text-right font-bold text-[#059669]">
                              {formatCurrency(prod.salesValue)}
                            </td>
                            <td className="px-3 py-1 text-right font-bold text-[#2563EB]">
                              {formatCurrency(prod.margin)}
                            </td>
                          </tr>
                        ))}

                        {/* Subtotal Footer for Supplier */}
                        <tr className="bg-[#FFF8F8] border-b-2 border-[#CBD5E1]">
                          <td colSpan={4} className="px-3 py-1 text-right font-bold text-[#E11D48] uppercase text-[10.5px] border-r border-[#E2E8F0]">
                            Subtotal ({group.supplierName}) - Outstanding: {formatCurrency(group.outstandingBalance)}
                          </td>
                          <td className="px-3 py-1 text-right font-bold text-black border-r border-[#E2E8F0]">
                            {group.totalQty}
                          </td>
                          <td className="px-3 py-1 text-right font-bold text-black border-r border-[#E2E8F0]">
                            {formatCurrency(group.totalCostValue)}
                          </td>
                          <td className="px-3 py-1 text-right font-bold text-[#059669] border-r border-[#E2E8F0]">
                            {formatCurrency(group.totalSalesValue)}
                          </td>
                          <td className="px-3 py-1 text-right font-bold text-[#2563EB]">
                            {formatCurrency(group.totalMargin)}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {/* Grand Totals Footer */}
                <tfoot className="bg-[#0F172A] !text-white font-bold sticky bottom-0 z-20 table-footer-white">
                  <tr className="border-t-2 border-[#334155] !text-white">
                    <td colSpan={3} style={{ color: '#ffffff' }} className="px-3 py-2 text-right uppercase tracking-wider text-[12px] font-bold !text-white border-r border-[#334155]">
                      TOTAL SUPPLIER METRICS:
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white border-r border-[#334155]">
                      {formatCurrency(supplierMetrics.totalOutstanding)}
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white border-r border-[#334155]">
                      {supplierMetrics.totalQty.toLocaleString()}
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white border-r border-[#334155]">
                      {formatCurrency(supplierMetrics.totalCost)}
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white border-r border-[#334155]">
                      {formatCurrency(supplierMetrics.totalRevenue)}
                    </td>
                    <td style={{ color: '#ffffff' }} className="px-3 py-2 text-right text-[13px] font-bold !text-white">
                      {formatCurrency(supplierMetrics.totalMargin)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )
          )}
        </div>

      </div>
    </div>
  );
};

export default ProductWiseSalesReport;
