import { formatMalaysiaDate } from '../../utils/date';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Truck, FileText, RefreshCw, DollarSign, AlertCircle, CheckCircle2, Printer, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import { exportToExcel } from '../../utils/exportExcel';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import PaginationControls from '../../components/PaginationControls';
import SearchableSelect from '../../components/SearchableSelect';
import TableLoader from '../../components/TableLoader';
import { generateBillByBillPdf } from '../../utils/pdfGenerator';
import PdfViewerModal from '../../components/PdfViewerModal';

const SupplierPaymentsReport = () => {
  const { formatCurrency, settings } = useSettings();
  const [reportMode, setReportMode] = useState<'consolidation' | 'history'>('consolidation');
  const showClearedOnly = false;

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [entriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfTitle, setPdfTitle] = useState('Bill-by-Bill Breakdown');
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch Consolidation Data
  const { data: consolidationData = [], isLoading: consolidationLoading } = useQuery({
    queryKey: ['supplierPaymentsConsolidation', startDate, endDate],
    queryFn: async () => {
      let url = '/supplier-payments/consolidation-report';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;
      return (await api.get(url)).data;
    }
  });

  // Fetch Payments History Data
  const { data: paymentsHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['supplierPaymentsHistory'],
    queryFn: async () => (await api.get('/supplier-payments')).data
  });

  // Build search options
  const searchOptions = React.useMemo(() => {
    const optionsMap = new Map();
    
    consolidationData.forEach((item: any) => {
      if (item.supplierName) {
        const phoneStr = item.phone ? ` - ${item.phone}` : '';
        optionsMap.set(`supp_${item.supplierName}`, { 
          value: item.supplierName, 
          label: `${item.supplierName}${phoneStr}` 
        });
      }
    });

    return [{ value: '', label: 'All / Clear Search' }, ...Array.from(optionsMap.values())];
  }, [consolidationData, paymentsHistory]);

  // Pre-filter for search
  const searchFilteredConsolidation = consolidationData.filter((item: any) => {
    if (searchTerm) {
      const nameMatch = item.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
      const phoneMatch = item.phone ? String(item.phone).includes(searchTerm) : false;
      if (!nameMatch && !phoneMatch) return false;
    }
    return true;
  });

  // Filter Consolidation List for table display
  const filteredConsolidation = searchFilteredConsolidation.filter((item: any) => {
    const hasPending = Math.abs(Number(item.netPending || 0)) >= 0.005;
    
    if (showClearedOnly && hasPending) return false;
    if (!showClearedOnly && !hasPending) return false;

    if (startDate || endDate) {
      const hasActivity = Number(item.totalPurchases || 0) > 0 || Number(item.totalPayments || 0) > 0 || Number(item.totalReturns || 0) > 0;
      return hasActivity;
    }

    return true;
  });

  // Filter Payments History List
  const filteredHistory = paymentsHistory.filter((item: any) => {
    if (searchTerm && !item.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !item.paymentNo?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (startDate || endDate) {
      const d = new Date(item.date);
      const tzDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
      const dateStr = `${tzDate.getFullYear()}-${String(tzDate.getMonth() + 1).padStart(2, '0')}-${String(tzDate.getDate()).padStart(2, '0')}`;
      if (startDate && dateStr < startDate) return false;
      if (endDate && dateStr > endDate) return false;
    }
    return true;
  });

  // Summary Totals
  const totalPurchases = searchFilteredConsolidation.reduce((sum: number, i: any) => sum + Number(i.totalPurchases || 0), 0);
  const totalPaid = reportMode === 'consolidation'
    ? searchFilteredConsolidation.reduce((sum: number, i: any) => sum + Number(i.totalPayments || 0), 0)
    : filteredHistory.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  const totalPendingPayables = searchFilteredConsolidation.reduce((sum: number, i: any) => sum + Number(i.netPending > 0 ? i.netPending : 0), 0);

  const activeList = reportMode === 'consolidation' ? filteredConsolidation : filteredHistory;
  const totalPages = Math.ceil(activeList.length / entriesPerPage);
  const paginatedList = activeList.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const isReset = !searchTerm && !startDate && !endDate;

  const handlePdfExport = () => {
    if (reportMode === 'consolidation') {
      const cols: PdfColumn[] = [
        { header: 'S.No', dataKey: '_sno' },
        { header: 'Supplier Name', dataKey: 'supplierName' },
        { header: 'Phone', dataKey: 'phone' },
        { header: 'Opening Balance', dataKey: '_opening' },
        { header: 'Total Purchases', dataKey: 'totalPurchases' },
        { header: 'Total Paid', dataKey: 'totalPayments' },
        { header: 'Total Returns', dataKey: 'totalReturns' },
        { header: 'Net Pending Payable', dataKey: 'netPending' },
      ];
      const rows = filteredConsolidation.map((s: any, idx: number) => ({
        _sno: idx + 1,
        supplierName: s.supplierName,
        phone: s.phone || '-',
        _opening: `${formatCurrency(s.openingBalance)} (${s.openingBalanceType || 'CR'})`,
        totalPurchases: formatCurrency(s.totalPurchases),
        totalPayments: formatCurrency(s.totalPayments),
        totalReturns: formatCurrency(s.totalReturns),
        netPending: formatCurrency(s.netPending),
      }));
      rows.push({
        _sno: '',
        supplierName: '',
        phone: '',
        _opening: '',
        totalPurchases: formatCurrency(totalPurchases),
        totalPayments: formatCurrency(totalPaid),
        totalReturns: 'TOTAL:',
        netPending: formatCurrency(totalPendingPayables),
      });
      const title = `Supplier Payables Consolidation Report${startDate || endDate ? ` (${startDate || 'Start'} to ${endDate || 'End'})` : ''}`;
      exportTableToPdf(cols, rows, 'Supplier_Payables_Consolidation_Report', title, settings?.shopName, filteredConsolidation.length);
    } else {
      const cols: PdfColumn[] = [
        { header: 'PAYMENT NO', dataKey: 'paymentNo' },
        { header: 'DATE', dataKey: '_date' },
        { header: 'SUPPLIER NAME', dataKey: '_supplier' },
        { header: 'AMT. PAID', dataKey: 'amount' },
        { header: 'OPEN BAL', dataKey: 'openCr' },
        { header: 'PAYMENT FOR', dataKey: 'invoiceNo' },
        { header: 'ON', dataKey: 'invoiceDate' },
        { header: 'DAYS', dataKey: 'days' },
        { header: 'ORIG. AMT', dataKey: 'origAmt' },
        { header: 'AMT. ALLOC.', dataKey: 'amtPaid' },
        { header: "OUT'DING", dataKey: 'outstanding' },
      ];
      const rows: any[] = [];
      filteredHistory.forEach((p: any) => {
        const openCr = p.amount - (p.allocations?.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0) || 0);
        if (!p.allocations || p.allocations.length === 0) {
          rows.push({
            paymentNo: p.paymentNo,
            _date: formatMalaysiaDate(p.date),
            _supplier: p.supplier?.name || '-',
            amount: formatCurrency(p.amount),
            openCr: formatCurrency(openCr > 0 ? openCr : 0),
            invoiceNo: '-',
            invoiceDate: '-',
            days: '-',
            origAmt: '-',
            amtPaid: '-',
            outstanding: '-',
          });
        } else {
          p.allocations.forEach((a: any, idx: number) => {
            const isFirst = idx === 0;
            rows.push({
              paymentNo: isFirst ? p.paymentNo : '',
              _date: isFirst ? formatMalaysiaDate(p.date) : '',
              _supplier: isFirst ? (p.supplier?.name || '-') : '',
              amount: isFirst ? formatCurrency(p.amount) : '',
              openCr: isFirst ? formatCurrency(openCr > 0 ? openCr : 0) : '',
              invoiceNo: a.purchase?.entryNo || '-',
              invoiceDate: a.purchase?.date ? formatMalaysiaDate(a.purchase.date) : '-',
              days: a.purchase?.date ? Math.floor((new Date(p.date).getTime() - new Date(a.purchase.date).getTime()) / (1000 * 3600 * 24)).toString() : '-',
              origAmt: formatCurrency(a.purchase?.netTotal || 0),
              amtPaid: formatCurrency(a.amount),
              outstanding: formatCurrency((a.purchase?.netTotal || 0) - a.amount),
            });
          });
        }
      });
      const historyTotal = filteredHistory.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      rows.push({
        paymentNo: '',
        _date: '',
        _supplier: '',
        amount: '',
        openCr: '',
        invoiceNo: '',
        invoiceDate: '',
        days: '',
        origAmt: 'TOTAL AMOUNT:',
        amtPaid: formatCurrency(historyTotal),
        outstanding: '',
      });
      const title = `Supplier Payments History Report${startDate || endDate ? ` (${startDate || 'Start'} to ${endDate || 'End'})` : ''}`;
      exportTableToPdf(cols, rows, 'Supplier_Payments_History_Report', title, settings?.shopName, filteredHistory.length);
    }
  };

  const handleExcelExport = () => {
    if (reportMode === 'consolidation') {
      const exportData = filteredConsolidation.map((s: any, idx: number) => ({
        'S.No': idx + 1,
        'Supplier Name': s.supplierName,
        'Phone': s.phone || '-',
        'Opening Balance': `${s.openingBalance} (${s.openingBalanceType || 'CR'})`,
        'Total Purchases': s.totalPurchases,
        'Total Paid': s.totalPayments,
        'Total Returns': s.totalReturns,
        'Net Pending Payable': s.netPending,
      }));
      exportData.push({
        'S.No': '',
        'Supplier Name': '',
        'Phone': '',
        'Opening Balance': '',
        'Total Purchases': formatCurrency(totalPurchases) as any,
        'Total Paid': formatCurrency(totalPaid) as any,
        'Total Returns': 'TOTAL:',
        'Net Pending Payable': formatCurrency(totalPendingPayables) as any,
      });
      exportToExcel(exportData, 'Supplier_Payables_Consolidation', {
        shopName: settings?.shopName || 'MY SHOP',
        title: 'Supplier Payables Consolidation Report',
        totalCount: filteredConsolidation.length
      });
    } else {
      const exportData: any[] = [];
      filteredHistory.forEach((p: any) => {
        const openCr = p.amount - (p.allocations?.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0) || 0);
        if (!p.allocations || p.allocations.length === 0) {
          exportData.push({
            'PAYMENT NO': p.paymentNo,
            'DATE': formatMalaysiaDate(p.date),
            'SUPPLIER NAME': p.supplier?.name || '-',
            'AMT. PAID': formatCurrency(p.amount),
            'OPEN BAL': formatCurrency(openCr > 0 ? openCr : 0),
            'PAYMENT FOR': '-',
            'ON': '-',
            'DAYS': '-',
            'ORIG. AMT': '-',
            'AMT. ALLOC.': '-',
            "OUT'DING": '-',
          });
        } else {
          p.allocations.forEach((a: any, idx: number) => {
            const isFirst = idx === 0;
            exportData.push({
              'PAYMENT NO': isFirst ? p.paymentNo : '',
              'DATE': isFirst ? formatMalaysiaDate(p.date) : '',
              'SUPPLIER NAME': isFirst ? (p.supplier?.name || '-') : '',
              'AMT. PAID': isFirst ? formatCurrency(p.amount) : '',
              'OPEN BAL': isFirst ? formatCurrency(openCr > 0 ? openCr : 0) : '',
              'PAYMENT FOR': a.purchase?.entryNo || '-',
              'ON': a.purchase?.date ? formatMalaysiaDate(a.purchase.date) : '-',
              'DAYS': a.purchase?.date ? Math.floor((new Date(p.date).getTime() - new Date(a.purchase.date).getTime()) / (1000 * 3600 * 24)).toString() : '-',
              'ORIG. AMT': formatCurrency(a.purchase?.netTotal || 0),
              'AMT. ALLOC.': formatCurrency(a.amount),
              "OUT'DING": formatCurrency((a.purchase?.netTotal || 0) - a.amount),
            });
          });
        }
      });
      const historyTotal = filteredHistory.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      exportData.push({
        'PAYMENT NO': '',
        'DATE': '',
        'SUPPLIER NAME': '',
        'AMT. PAID': '',
        'OPEN BAL': '',
        'PAYMENT FOR': '',
        'ON': '',
        'DAYS': '',
        'ORIG. AMT': 'TOTAL AMOUNT:',
        'AMT. ALLOC.': formatCurrency(historyTotal),
        "OUT'DING": '',
      });
      exportToExcel(exportData, 'Supplier_Payments_History', {
        shopName: settings?.shopName || 'MY SHOP',
        title: 'Supplier Payments History Report',
        totalCount: filteredHistory.length
      });
    }
  };

  const handlePrintBreakdown = async (supplierId: number, supplierName: string) => {
    if (!supplierId) return;
    try {
      setPrintingId(supplierId);
      const res = await api.get(`/supplier-payments/unpaid-bills/${supplierId}`);
      const unpaidBills = res.data;
      const totals = unpaidBills.reduce((acc: any, bill: any) => {
        acc.total += Number(bill.total || 0);
        acc.returned += Number(bill.returned || 0);
        acc.paid += Number(bill.paid || bill.received || 0);
        acc.pending += Number(bill.pending || 0);
        return acc;
      }, { total: 0, returned: 0, paid: 0, pending: 0 });
      const companyName = settings?.shopName || 'NJ FRESH AND FROZEN SDN BHD';
      const url = generateBillByBillPdf(companyName, supplierName, 'Supplier', unpaidBills, totals) as unknown as string;
      setPdfUrl(url);
      setPdfTitle(`${supplierName} - Bill by Bill`);
      setPdfModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <>
    <div className={`${isExpanded ? 'fixed inset-0 z-[9999]' : 'absolute inset-0 z-10'} bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden p-2 sm:p-4`}>
      
      {!isExpanded && <ReportTabs />}

      {/* Top Header Card with Summary Stats */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-2 p-2 sm:p-3 sm:mb-3 shrink-0">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${isExpanded ? '' : 'mb-3 border-b border-[#E2E8F0] pb-3'}`}>
          
          <div className="flex items-center gap-2">
            <div className="bg-[#10B981] text-white p-2 rounded-lg shadow-sm shrink-0">
              <Truck size={18} />
            </div>
            <div>
              <h1 className="font-bold text-[13px] sm:text-[15px] text-[#0F172A] uppercase tracking-wide">
                SUPPLIER PAYMENTS & PAYABLES REPORT
              </h1>
              <p className="text-xs text-black font-bold hidden sm:block">Complete overview of supplier pending payables, total payments, and ledger balances</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="bg-gray-100 p-1 rounded-md flex items-center gap-1 border border-gray-200 flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => { setReportMode('consolidation'); setCurrentPage(1); }}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-bold rounded transition-colors ${
                  reportMode === 'consolidation' ? 'bg-[#0F172A] text-white shadow-sm' : 'text-black hover:text-black'
                }`}
              >
                Pending Payables
              </button>
              <button
                type="button"
                onClick={() => { setReportMode('history'); setCurrentPage(1); }}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-bold rounded transition-colors ${
                  reportMode === 'history' ? 'bg-[#0F172A] text-white shadow-sm' : 'text-black hover:text-black'
                }`}
              >
                Pay History
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={handleExcelExport} className="bg-[#10B981] hover:bg-[#059669] text-white px-3 py-1.5 rounded text-[12px] font-bold flex items-center gap-1.5 transition-colors shrink-0">
                <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button type="button" onClick={handlePdfExport} className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-3 py-1.5 rounded text-[12px] font-bold flex items-center gap-1.5 transition-colors shrink-0">
                <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-bold rounded transition-colors shadow-sm shrink-0 ${
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
        </div>

        {/* Stat Summary Cards */}
        <div className={`flex overflow-x-auto md:grid md:grid-cols-3 gap-2 sm:gap-3 snap-x scrollbar-hide ${isExpanded ? 'hidden' : 'mb-3 pb-1'}`}>
          <div className="min-w-[220px] md:min-w-0 snap-start bg-[#EFF6FF] border border-[#BFDBFE] p-2.5 rounded-md flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-[#1E40AF] uppercase">Total Purchases</p>
              <p className="text-base font-bold text-[#1E3A8A]">{formatCurrency(totalPurchases)}</p>
            </div>
            <DollarSign className="text-[#3B82F6]" size={20} />
          </div>
          <div className="min-w-[220px] md:min-w-0 snap-start bg-[#ECFDF5] border border-[#A7F3D0] p-2.5 rounded-md flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-[#065F46] uppercase">Total Payments Paid</p>
              <p className="text-base font-bold text-[#047857]">{formatCurrency(totalPaid)}</p>
            </div>
            <CheckCircle2 className="text-[#10B981]" size={20} />
          </div>
          <div className="min-w-[220px] md:min-w-0 snap-start bg-[#FEF2F2] border border-[#FECACA] p-2.5 rounded-md flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-[#991B1B] uppercase">Overall Outstanding Payables</p>
              <p className="text-base font-bold text-[#DC2626]">{formatCurrency(totalPendingPayables)}</p>
            </div>
            <AlertCircle className="text-[#EF4444]" size={20} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-2 sm:p-3 border-b border-[#E6E9ED] shrink-0">
        <div className="flex flex-col gap-2">
          {/* Row 1: Search + Reset */}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <SearchableSelect
                options={searchOptions}
                value={searchTerm}
                onChange={(val) => setSearchTerm(val || '')}
                placeholder="Search supplier..."
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
              className={`shrink-0 px-3 py-[9px] rounded flex items-center gap-1 transition-colors border text-[12px] font-bold h-[38px] ${!isReset ? "bg-white text-red-600 border-red-200 hover:bg-red-50" : "bg-white text-black border-[#E5E7EB] hover:bg-gray-50"}`}
            >
              <RefreshCw size={13} /> <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
          {/* Row 2: Dates */}
          <div className="grid grid-cols-2 sm:flex sm:gap-2 gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-[150px] px-2 py-1.5 border border-[#E5E7EB] rounded text-[12px] font-bold text-black outline-none focus:border-[#3B82F6] h-[38px]" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-[150px] px-2 py-1.5 border border-[#E5E7EB] rounded text-[12px] font-bold text-black outline-none focus:border-[#3B82F6] h-[38px]" />
            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              {(() => {
                const d = new Date();
                const pad = (n: number) => n.toString().padStart(2, '0');
                const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const firstDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
                const lastDayDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                const lastDay = `${lastDayDate.getFullYear()}-${pad(lastDayDate.getMonth() + 1)}-${pad(lastDayDate.getDate())}`;
                
                const isToday = startDate === todayStr && endDate === todayStr;
                const isMonth = startDate === firstDay && endDate === lastDay;

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(todayStr);
                        setEndDate(todayStr);
                      }}
                      className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-bold rounded h-[38px] transition-colors border ${isToday ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-black'}`}
                    >
                      {isToday && <CheckCircle2 size={14} className="text-blue-600" />} Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(firstDay);
                        setEndDate(lastDay);
                      }}
                      className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-bold rounded h-[38px] transition-colors border ${isMonth ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-black'}`}
                    >
                      {isMonth && <CheckCircle2 size={14} className="text-blue-600" />} This Month
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col min-h-0 min-w-0 flex-1">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-2 flex justify-between items-center shrink-0 gap-2">
          <div className="flex items-center gap-1.5 text-black font-bold min-w-0">
            <FileText size={14} className="shrink-0" />
            <h2 className="font-bold text-[11px] sm:text-[13px] tracking-wide text-black uppercase truncate">
              {reportMode === 'consolidation' ? 'OVERALL SUPPLIER PAYABLES CONSOLIDATION' : 'SUPPLIER PAYMENTS HISTORY'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap shrink-0">{activeList.length} Records Found</span>
          </div>
        </div>

        <div id="supplier-payments-report-export" className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
          <div className="flex-1 overflow-auto overflow-x-auto">
            {reportMode === 'consolidation' ? (
              <table className="w-full text-left text-[12px] whitespace-nowrap">
                <thead>
                  <tr className="bg-[#0F172A] text-white font-bold">
                    <th className="px-3 py-2.5 border-r border-[#1E293B] text-center w-12">S.No</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B]">Supplier Name</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B]">Phone</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B] text-right">Opening Bal</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B] text-right">Total Purchases</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B] text-right">Total Paid</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B] text-right">Returns</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B] text-right font-bold">Net Pending Payable</th>
                    <th className="px-3 py-2.5 text-center font-bold print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidationLoading ? (
                    <TableLoader columns={8} />
                  ) : filteredConsolidation.length === 0 ? (
                    <tr><td colSpan={9} className="text-center p-6 text-black font-bold">No supplier records found.</td></tr>
                  ) : (
                    paginatedList.map((s: any, index: number) => (
                      <tr key={s.supplierId} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                        <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-center text-black font-bold">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                        <td className="px-3 py-2.5 border-r border-[#E2E8F0] font-bold text-[#0F172A]">{s.supplierName}</td>
                        <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black font-bold">{s.phone || '-'}</td>
                        <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right text-black font-bold">{formatCurrency(s.openingBalance)} ({s.openingBalanceType || 'CR'})</td>
                        <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right font-bold text-[#1E3A8A]">{formatCurrency(s.totalPurchases)}</td>
                        <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right font-bold text-[#047857]">{formatCurrency(s.totalPayments)}</td>
                        <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right text-black font-bold">{formatCurrency(s.totalReturns)}</td>
                        <td className={`px-3 py-2.5 border-r border-[#E2E8F0] text-right font-bold ${s.netPending > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                          {formatCurrency(s.netPending)}
                        </td>
                        <td className="px-3 py-2.5 text-center print:hidden">
                          <button type="button" onClick={() => handlePrintBreakdown(s.supplierId, s.supplierName)} disabled={printingId === s.supplierId} className="text-[#3B82F6] hover:bg-blue-50 p-1.5 rounded disabled:opacity-50 transition-colors" title="Print Bill-by-Bill Breakdown">
                            {printingId === s.supplierId ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-[12px] whitespace-nowrap">
                <thead>
                  <tr className="bg-[#0F172A] text-white font-bold">
                    <th className="px-3 py-2.5 border-r border-[#1E293B]">PAYMENT NO</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B]">DATE</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B]">SUPPLIER NAME</th>
                    <th className="px-3 py-2.5 text-right border-r border-[#1E293B]">AMT. PAID</th>
                    <th className="px-3 py-2.5 text-right border-r border-[#1E293B]">OPEN BAL</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B]">PAYMENT FOR</th>
                    <th className="px-3 py-2.5 border-r border-[#1E293B]">ON</th>
                    <th className="px-3 py-2.5 text-center border-r border-[#1E293B]">DAYS</th>
                    <th className="px-3 py-2.5 text-right border-r border-[#1E293B]">ORIG. AMT</th>
                    <th className="px-3 py-2.5 text-right border-r border-[#1E293B]">AMT. ALLOC.</th>
                    <th className="px-3 py-2.5 text-right border-r border-[#1E293B]">OUT'DING</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <TableLoader columns={11} />
                  ) : filteredHistory.length === 0 ? (
                    <tr><td colSpan={11} className="text-center p-6 text-black font-bold">No payment vouchers found.</td></tr>
                  ) : (
                    paginatedList.map((p: any, idx: number) => {
                      const rowSpan = Math.max(p.allocations?.length || 1, 1);
                      const openCr = p.amount - (p.allocations?.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0) || 0);

                      return (
                        <React.Fragment key={p.id}>
                          <tr className={`border-b ${p.allocations && p.allocations.length > 1 ? 'border-dashed border-[#CBD5E1]' : 'border-[#E2E8F0]'} ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}`}>
                            <td rowSpan={rowSpan} className="px-3 py-2.5 border-r border-[#E2E8F0] font-bold text-[#3B82F6] align-top">{p.paymentNo}</td>
                            <td rowSpan={rowSpan} className="px-3 py-2.5 border-r border-[#E2E8F0] text-black font-bold align-top">{formatMalaysiaDate(p.date)}</td>
                            <td rowSpan={rowSpan} className="px-3 py-2.5 border-r border-[#E2E8F0] font-bold text-black align-top">{p.supplier?.name || '-'}</td>
                            <td rowSpan={rowSpan} className="px-3 py-2.5 text-right font-bold text-[#10B981] border-r border-[#E2E8F0] align-top">{formatCurrency(p.amount)}</td>
                            <td rowSpan={rowSpan} className="px-3 py-2.5 text-right font-bold text-black border-r border-[#E2E8F0] align-top">{formatCurrency(openCr > 0 ? openCr : 0)}</td>
                            
                            {p.allocations && p.allocations.length > 0 ? (
                              <>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black font-bold">{p.allocations[0].purchase?.entryNo || '-'}</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black font-bold">{p.allocations[0].purchase?.date ? formatMalaysiaDate(p.allocations[0].purchase.date) : '-'}</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-center text-black font-bold">
                                  {p.allocations[0].purchase?.date ? Math.floor((new Date(p.date).getTime() - new Date(p.allocations[0].purchase.date).getTime()) / (1000 * 3600 * 24)) : '-'}
                                </td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right text-black font-bold">{formatCurrency(p.allocations[0].purchase?.netTotal || 0)}</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right font-bold text-[#10B981]">{formatCurrency(p.allocations[0].amount)}</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right text-black font-bold">
                                  {formatCurrency((p.allocations[0].purchase?.netTotal || 0) - p.allocations[0].amount)}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black text-center font-bold">-</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black text-center font-bold">-</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black text-center font-bold">-</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black text-center font-bold">-</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black text-center font-bold">-</td>
                                <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black text-center font-bold">-</td>
                              </>
                            )}
                          </tr>

                          {p.allocations && p.allocations.slice(1).map((a: any, i: number) => (
                            <tr key={i} className={`border-b ${i === p.allocations.length - 2 ? 'border-[#E2E8F0]' : 'border-dashed border-[#CBD5E1]'} ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}`}>
                              <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black font-bold">{a.purchase?.entryNo || '-'}</td>
                              <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-black font-bold">{a.purchase?.date ? formatMalaysiaDate(a.purchase.date) : '-'}</td>
                              <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-center text-black font-bold">
                                {a.purchase?.date ? Math.floor((new Date(p.date).getTime() - new Date(a.purchase.date).getTime()) / (1000 * 3600 * 24)) : '-'}
                              </td>
                              <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right text-black font-bold">{formatCurrency(a.purchase?.netTotal || 0)}</td>
                              <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right font-bold text-[#10B981]">{formatCurrency(a.amount)}</td>
                              <td className="px-3 py-2.5 border-r border-[#E2E8F0] text-right text-black font-bold">
                                {formatCurrency((a.purchase?.netTotal || 0) - a.amount)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {!consolidationLoading && !historyLoading && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalEntries={activeList.length}
          entriesPerPage={entriesPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
    <PdfViewerModal 
      isOpen={pdfModalOpen} 
      onClose={() => setPdfModalOpen(false)} 
      pdfUrl={pdfUrl} 
      title={pdfTitle} 
    />
    </>
  );
};

export default SupplierPaymentsReport;
