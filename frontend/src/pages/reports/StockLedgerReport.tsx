import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, BookOpen, Search, Calendar, Filter, X, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import { useSettings } from '../../contexts/SettingsContext';
import PaginationControls from '../../components/PaginationControls';
import SearchableSelect from '../../components/SearchableSelect';
import TableLoader from '../../components/TableLoader';

const StockLedgerReport = () => {
  const { formatCurrency, settings } = useSettings();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data,
  });

  const { data: ledgerEntries = [], isLoading, refetch } = useQuery({
    queryKey: ['stockLedger', productId, fromDate, toDate],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await api.get('/reports/stock-ledger', {
        params: {
          productId: productId || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }
      });
      return data;
    },
    enabled: !!productId,
  });

  const totalPages = Math.ceil(ledgerEntries.length / entriesPerPage);
  const paginatedEntries = ledgerEntries.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const todayStr = new Date().toISOString().split('T')[0];
  const startOfMonthStr = new Date(new Date().setDate(1)).toISOString().split('T')[0];
  const isToday = fromDate === todayStr && toDate === todayStr;
  const isMonth = fromDate === startOfMonthStr && toDate === todayStr;
  const isReset = !productId && !fromDate && !toDate;

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
      <div className={`bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-2 p-3 sm:mb-3 shrink-0 ${isFilterOpen ? 'fixed inset-y-0 right-0 w-[280px] z-[9999] m-0 rounded-none rounded-l-xl overflow-y-auto shadow-2xl' : 'hidden md:block'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0] mb-3 md:hidden">
          <h3 className="font-bold text-[15px] text-[#1E3A8A]">Advanced Filters</h3>
          <button onClick={() => setIsFilterOpen(false)} className="p-1.5 bg-red-50 text-red-600 rounded-full"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end mb-3">
          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1"><Calendar size={12} /> From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1"><Calendar size={12} /> To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold focus:border-[#3B82F6]" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1">Select Product</label>
            <SearchableSelect
              options={[{ value: '', label: '-- Select a Product --' }, ...products.map((p: any) => ({ value: p.id, label: `${p.code} - ${p.name}` }))]}
              value={productId}
              onChange={(val) => setProductId(val || '')}
              placeholder="-- Select a Product --"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1">Show</label>
            <select
              value={entriesPerPage}
              onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
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
            <button type="button" onClick={() => { setProductId(''); setFromDate(''); setToDate(''); }} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${!isReset ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-white text-black border-gray-200 hover:bg-gray-50'}`}>
              <RefreshCw size={14} /> Reset
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
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[#3B82F6]" />
            <h2 className="font-bold text-[13px] tracking-wide text-[#1E3A8A]">STOCK LEDGER REPORT</h2>
            {productId && (
              <span className="text-[11px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                {products.find((p: any) => String(p.id) === String(productId))?.name || ''}
              </span>
            )}
          </div>
          {ledgerEntries.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button type="button"
                onClick={() => {
                  const exportData = ledgerEntries.map((e: any, i: number) => ({
                    'S.No': i + 1,
                    'Date': e.date ? new Date(e.date).toISOString().split('T')[0] : '-',
                    'Type': e.type || '-',
                    'Reference': e.reference || '-',
                    'In Qty': e.inQty || 0,
                    'Out Qty': e.outQty || 0,
                    'Balance Qty': e.balance || 0,
                  }));
                  exportToExcel(exportData, 'Stock_Ledger_Report', { shopName: settings?.shopName || 'MY SHOP', title: 'Stock Ledger Report', totalCount: ledgerEntries.length });
                }}
                className="shrink-0 bg-[#10B981] hover:bg-[#059669] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button type="button"
                onClick={() => {
                  const cols: PdfColumn[] = [
                    { header: 'S.No', dataKey: '_sno' },
                    { header: 'Date', dataKey: '_date' },
                    { header: 'Type', dataKey: 'type' },
                    { header: 'Reference', dataKey: 'reference' },
                    { header: 'In Qty', dataKey: 'inQty' },
                    { header: 'Out Qty', dataKey: 'outQty' },
                    { header: 'Balance', dataKey: 'balance' },
                  ];
                  const rows = ledgerEntries.map((e: any, i: number) => ({
                    _sno: i + 1,
                    _date: e.date ? new Date(e.date).toISOString().split('T')[0] : '-',
                    type: e.type || '-',
                    reference: e.reference || '-',
                    inQty: e.inQty || 0,
                    outQty: e.outQty || 0,
                    balance: e.balance || 0,
                  }));
                  exportTableToPdf(cols, rows, 'Stock_Ledger_Report', 'Stock Ledger Report', settings?.shopName, ledgerEntries.length);
                }}
                className="shrink-0 bg-[#EF4444] hover:bg-[#DC2626] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto overflow-x-auto">
            {!productId ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                <BookOpen size={48} className="text-[#CBD5E1] mb-3" />
                <p className="font-bold text-[14px] text-[#64748B]">Select a Product to View Ledger</p>
                <p className="text-[12px] text-[#94A3B8] mt-1">Choose a product from the filter above to see its stock movement history.</p>
              </div>
            ) : (
              <table className="w-full text-left text-[12px] whitespace-nowrap">
                <thead>
                  <tr className="bg-[#0F172A] text-white font-bold">
                    <th className="px-4 py-3 border-r border-[#1E293B] w-12 text-center">S.No</th>
                    <th className="px-4 py-3 border-r border-[#1E293B]">Date</th>
                    <th className="px-4 py-3 border-r border-[#1E293B]">Type</th>
                    <th className="px-4 py-3 border-r border-[#1E293B]">Reference</th>
                    <th className="px-4 py-3 border-r border-[#1E293B] text-right">In Qty</th>
                    <th className="px-4 py-3 border-r border-[#1E293B] text-right">Out Qty</th>
                    <th className="px-4 py-3 text-right">Balance Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableLoader columns={7} />
                  ) : ledgerEntries.length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-6 text-gray-500">No ledger entries found for the selected criteria.</td></tr>
                  ) : (
                    paginatedEntries.map((e: any, index: number) => (
                      <tr key={index} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-black font-bold">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{e.date ? new Date(e.date).toISOString().split('T')[0] : '-'}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0]">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${e.type === 'Purchase' ? 'bg-[#22C55E] text-white' :
                              e.type === 'Sale' ? 'bg-[#3B82F6] text-white' :
                                e.type === 'Return' ? 'bg-[#EF4444] text-white' :
                                  'bg-[#64748B] text-white'
                            }`}>{e.type || '-'}</span>
                        </td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-[#3B82F6]">{e.reference || '-'}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-[#22C55E]">{e.inQty || '-'}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-[#EF4444]">{e.outQty || '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#0F172A]">{e.balance}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {!isLoading && ledgerEntries.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalEntries={ledgerEntries.length}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

    </div>
  );
};

export default StockLedgerReport;
