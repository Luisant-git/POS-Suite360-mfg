import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Download, Calendar, FileDigit, Truck, CreditCard, RotateCcw, Plus, Eye, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import ViewPurchaseModal from '../purchase/ViewPurchaseModal';
import PaginationControls from '../../components/PaginationControls';
import SearchableSelect from '../../components/SearchableSelect';
import TableLoader from '../../components/TableLoader';

const PurchaseReport = () => {
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [viewId, setViewId] = useState<number | null>(null);

  // Fetch Master Data for filters
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data
  });

  const { data: paymentModes = [] } = useQuery({
    queryKey: ['paymentModes'],
    queryFn: async () => (await api.get('/payment-modes')).data
  });

  // Fetch Report Data
  const { data: purchases = [], isLoading, refetch } = useQuery({
    queryKey: ['purchaseReport', fromDate, toDate, supplierId, invoiceNo, paymentMode],
    queryFn: async () => {
      const { data } = await api.get(`/purchases`, {
        params: {
          fromDate,
          toDate,
          supplierId: supplierId || undefined,
          invoiceNo: invoiceNo || undefined,
          paymentModeId: paymentMode || undefined,
        }
      });
      return data.map((p: any) => ({
        id: p.id,
        entryNo: `PUR-${p.id.toString().padStart(6, '0')}`,
        invoiceNo: p.supplierInvoiceNo || '-',
        date: new Date(p.date).toISOString().split('T')[0],
        supplierName: p.supplier?.name || '-',
        mode: p.paymentMode?.name || '-',
        rawTotalAmount: Number(p.subtotal) || 0,
        rawNetAmount: Number(p.grandTotal) || 0,
        totalAmount: formatCurrency(p.subtotal),
        taxAmount: formatCurrency(p.tax),
        transportCharge: formatCurrency(p.transportCharge || 0),
        wages: formatCurrency(p.wages || 0),
        netAmount: formatCurrency(p.grandTotal),
      }));
    },
  });

  const filteredPurchases = purchases.filter((p: any) => {
    if (!quickSearch) return true;
    const term = quickSearch.toLowerCase();
    return (
      p.entryNo.toLowerCase().includes(term) ||
      p.invoiceNo.toLowerCase().includes(term) ||
      p.supplierName.toLowerCase().includes(term) ||
      p.mode.toLowerCase().includes(term) ||
      p.totalAmount.toLowerCase().includes(term) ||
      p.netAmount.toLowerCase().includes(term)
    );
  });

  const totalPurchasesAmount = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.rawNetAmount) || 0), 0);
  const totalSubtotal = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.rawTotalAmount) || 0), 0);

  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(filteredPurchases.length / entriesPerPage);
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const todayStr = new Date().toISOString().split('T')[0];
  const startOfMonthStr = new Date(new Date().setDate(1)).toISOString().split('T')[0];

  const isToday = fromDate === todayStr && toDate === todayStr;
  const isMonth = fromDate === startOfMonthStr && toDate === todayStr;
  const isReset = !fromDate && !toDate && !supplierId && !invoiceNo && !paymentMode && !quickSearch;

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10 p-2 sm:p-4">

      <ReportTabs />

      {/* Mobile Quick Bar */}
      <div className="md:hidden flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex gap-2 flex-1">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-1/2 px-2 py-1.5 border border-[#CBD5E1] rounded text-[12px] font-bold text-black" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-1/2 px-2 py-1.5 border border-[#CBD5E1] rounded text-[12px] font-bold text-black" />
        </div>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-1 shrink-0 bg-[#1E3A8A] text-white px-3 py-1.5 rounded text-[12px] font-bold">
          <Filter size={16} />
        </button>
      </div>

      {isFilterOpen && <div className="fixed inset-0 bg-black/50 z-[9998] md:hidden" onClick={() => setIsFilterOpen(false)} />}

      {/* Filter Section */}
      <div className={`bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-2 p-2 sm:p-3 sm:mb-3 shrink-0 ${isFilterOpen ? 'fixed inset-y-0 right-0 w-[280px] z-[9999] m-0 rounded-none rounded-l-xl overflow-y-auto shadow-2xl' : 'hidden md:block'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0] mb-3 md:hidden">
          <h3 className="font-bold text-[15px] text-[#1E3A8A]">Advanced Filters</h3>
          <button onClick={() => setIsFilterOpen(false)} className="p-1.5 bg-red-50 text-red-600 rounded-full"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end mb-3">

          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1"><Calendar size={12} /> From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold focus:border-[#3B82F6]"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1"><Calendar size={12} /> To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold focus:border-[#3B82F6]"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#3B82F6] mb-1 font-bold"><FileDigit size={12} /> Entry / Supp. Inv. No</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-black font-bold" />
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Search Entry or Supp Inv No..."
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold focus:border-[#3B82F6]"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1"><Truck size={12} /> Supplier Name</label>
            <SearchableSelect
              options={[{ value: '', label: 'All Suppliers' }, ...suppliers.map((s: any) => ({ value: s.id, label: `${s.name} - ${s.phone || ''}` }))]}
              value={supplierId}
              onChange={(val) => setSupplierId(val || '')}
              placeholder="All Suppliers"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1"><CreditCard size={12} /> Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold bg-white focus:border-[#3B82F6]"
            >
              <option value="">All Payment Modes</option>
              {paymentModes.map((pm: any) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1">Show</label>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold bg-white focus:border-[#3B82F6]"
            >
              <option value={10}>10 Entries</option>
              <option value={25}>25 Entries</option>
              <option value={50}>50 Entries</option>
              <option value={100}>100 Entries</option>
            </select>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-2 border-t border-dashed border-[#E2E8F0] gap-3 md:gap-0">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button type="button" onClick={() => { refetch(); setIsFilterOpen(false); }} className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors">
              <Search size={14} /> Apply Filter
            </button>
            <button type="button" onClick={() => {
              setFromDate('');
              setToDate('');
              setSupplierId('');
              setInvoiceNo('');
              setPaymentMode('');
              setQuickSearch('');
            }} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${!isReset ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-white text-black border-gray-200 hover:bg-gray-50'}`}>
              <RotateCcw size={14} /> Reset Filters
            </button>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button type="button" onClick={() => { setFromDate(todayStr); setToDate(todayStr); }} className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${isToday ? 'bg-[#3B82F6] text-white border-[#2563EB]' : 'bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE] hover:bg-[#DBEAFE]'}`}>Today</button>
            <button type="button" onClick={() => { setFromDate(startOfMonthStr); setToDate(todayStr); }} className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${isMonth ? 'bg-[#3B82F6] text-white border-[#2563EB]' : 'bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE] hover:bg-[#DBEAFE]'}`}>This Month</button>
          </div>
        </div>
      </div>

      {/* Report Table Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1 min-h-[500px] lg:min-h-0">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0 shrink-0">
          <div className="flex items-center gap-2 text-[#64748B]">
            <FileText size={16} />
            <h2 className="font-bold text-[13px] tracking-wide">PURCHASE REPORT DISPLAY</h2>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-[120px]">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Quick search table..."
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] md:w-48 focus:border-[#3B82F6]"
              />
            </div>
            <button type="button"
              onClick={() => {
                const exportData = filteredPurchases.map((p: any) => ({
                  'Entry No': p.entryNo,
                  'Supplier Invoice No': p.invoiceNo,
                  'Date': p.date,
                  'Supplier Name': p.supplierName,
                  'Payment Mode': p.mode,
                  'Total Amount': p.totalAmount,
                  'Tax Amount': p.taxAmount,
                  'Transport': p.transportCharge,
                  'Wages': p.wages,
                  'Net Amount': p.netAmount
                }));
                exportData.push({
                  'Entry No': '',
                  'Supplier Invoice No': '',
                  'Date': '',
                  'Supplier Name': '',
                  'Payment Mode': 'TOTAL:',
                  'Total Amount': formatCurrency(totalSubtotal),
                  'Tax Amount': '',
                  'Transport': '',
                  'Wages': '',
                  'Net Amount': formatCurrency(totalPurchasesAmount)
                });
                exportToExcel(exportData, `Purchase_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, {
                  shopName: settings?.shopName || 'MY SHOP',
                  title: 'Purchase Report',
                  totalCount: filteredPurchases.length
                });
              }}
              className="shrink-0 bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden lg:inline">Export Excel</span>
            </button>
            <button type="button"
              onClick={() => {
                const cols: PdfColumn[] = [
                  { header: 'Entry No', dataKey: 'entryNo' },
                  { header: 'Supp. Inv. No', dataKey: 'invoiceNo' },
                  { header: 'Date', dataKey: 'date' },
                  { header: 'Supplier Name', dataKey: 'supplierName' },
                  { header: 'Payment Mode', dataKey: 'mode' },
                  { header: 'Total Amount', dataKey: 'totalAmount' },
                  { header: 'Tax Amount', dataKey: 'taxAmount' },
                  { header: 'Net Amount', dataKey: 'netAmount' },
                ];
                const pdfData = [...filteredPurchases, {
                  entryNo: '',
                  invoiceNo: '',
                  date: '',
                  supplierName: '',
                  mode: 'TOTAL:',
                  totalAmount: formatCurrency(totalSubtotal),
                  taxAmount: '',
                  netAmount: formatCurrency(totalPurchasesAmount)
                }];
                exportTableToPdf(cols, pdfData, `Purchase_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, 'Purchase Report', settings?.shopName, filteredPurchases.length);
              }}
              className="shrink-0 bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden lg:inline">Export PDF</span>
            </button>
            <button type="button"
              onClick={() => navigate('/purchase/new')}
              className="bg-[#1E3A8A] hover:bg-[#172554] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Plus size={14} /> <span className="hidden sm:inline">New Purchase Entry</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto overflow-x-auto">
            <table className="w-full text-left text-[12px] whitespace-nowrap">
              <thead>
                <tr className="bg-[#0F172A] text-white font-bold">
                  <th className="px-4 py-3 border-r border-[#1E293B] w-12 text-center">S.No</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Entry No</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Supp. Inv. No.</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Date</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Supplier Name</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Mode</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Total Amount</th>
                  {settings?.enableTax && <th className="px-4 py-3 border-r border-[#1E293B] text-right">Tax Amount</th>}
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Transport</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Wages</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Net Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableLoader columns={settings?.enableTax ? 12 : 11} />
                ) : filteredPurchases.length === 0 ? (
                  <tr><td colSpan={settings?.enableTax ? 12 : 11} className="text-center p-6 text-gray-500">No purchase records found.</td></tr>
                ) : (
                  paginatedPurchases.map((p: any, index: number) => (
                    <tr key={p.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-black font-bold">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{p.entryNo}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-black">{p.invoiceNo}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{p.date}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-black">{p.supplierName}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.mode?.toLowerCase() === 'credit' ? 'bg-rose-500 text-white' :
                            p.mode?.toLowerCase() === 'cash' ? 'bg-[#22C55E] text-white' :
                              p.mode === 'Card' ? 'bg-[#0EA5E9] text-white' :
                                'bg-[#14B8A6] text-white'
                          }`}>
                          {p.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black font-bold">{p.totalAmount}</td>
                      {settings?.enableTax && <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black font-bold">{p.taxAmount}</td>}
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black font-bold">{p.transportCharge}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black font-bold">{p.wages}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-[#10B981]">{p.netAmount}</td>
                      <td className="px-4 py-3 text-center">
                        <button type="button"
                          onClick={() => setViewId(p.id)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                          title="View Invoice"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {!isLoading && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalEntries={filteredPurchases.length}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {viewId && (
        <ViewPurchaseModal purchaseId={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  );
};

export default PurchaseReport;
