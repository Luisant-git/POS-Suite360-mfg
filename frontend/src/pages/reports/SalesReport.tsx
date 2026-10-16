import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Search, Calendar, FileDigit, Users, CreditCard, RotateCcw, Plus, Printer, Eye, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import InvoicePrintModal from '../../components/InvoicePrintModal';
import ViewSalesModal from '../sales/ViewSalesModal';
import PaginationControls from '../../components/PaginationControls';



const SalesReport = () => {
  const navigate = useNavigate();
  const { settings, formatCurrency } = useSettings();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedViewSaleId, setSelectedViewSaleId] = useState<number | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch Master Data for filters
  const { data: customers = [] } = useQuery({ 
    queryKey: ['customers'], 
    queryFn: async () => (await api.get('/customers')).data 
  });

  const { data: paymentModes = [] } = useQuery({ 
    queryKey: ['paymentModes'], 
    queryFn: async () => (await api.get('/payment-modes')).data 
  });

  // Fetch Report Data
  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['salesReport', fromDate, toDate, customerId, invoiceNo, paymentMode],
    queryFn: async () => {
      const { data } = await api.get(`/sales`, { 
        params: { 
          fromDate, 
          toDate, 
          customerId: customerId || undefined,
          invoiceNo: invoiceNo || undefined,
          paymentModeId: paymentMode || undefined,
        } 
      });
      return data.map((s: any) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        date: new Date(s.date).toISOString().split('T')[0],
        customerName: s.customer?.name || 'Walk-in',
        paymentMode: s.paymentMode?.name || 'Cash',
        netPayable: formatCurrency(s.grandTotal || 0),
        rawTotalAmount: s.grandTotal || 0,
        items: s.items || [],
      }));
    },
  });

  const filteredSales = quickSearch
    ? sales.filter((s: any) =>
        s.invoiceNo.toLowerCase().includes(quickSearch.toLowerCase()) ||
        s.customerName.toLowerCase().includes(quickSearch.toLowerCase()) ||
        s.paymentMode.toLowerCase().includes(quickSearch.toLowerCase())
      )
    : sales;

  const totalSalesAmount = filteredSales.reduce((sum: number, sale: any) => sum + (Number(sale.rawTotalAmount) || 0), 0);

  const totalPages = Math.ceil(filteredSales.length / entriesPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const todayStr = new Date().toISOString().split('T')[0];
  const startOfMonthStr = new Date(new Date().setDate(1)).toISOString().split('T')[0];
  
  const isToday = fromDate === todayStr && toDate === todayStr;
  const isMonth = fromDate === startOfMonthStr && toDate === todayStr;
  const isReset = !fromDate && !toDate && !customerId && !invoiceNo && !paymentMode && !quickSearch;

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-hidden z-10">
      <div className="print:hidden flex flex-col flex-1 overflow-hidden p-2">
        <ReportTabs />

        {/* Filter Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-2 p-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-3">
          
          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><Calendar size={12} /> From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#3B82F6]"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><Calendar size={12} /> To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#3B82F6]"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#3B82F6] mb-1 font-bold"><FileDigit size={12} /> Invoice No</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input 
                type="text" 
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Type or select invoice..."
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#3B82F6]"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><Users size={12} /> Customer Name</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#3B82F6]"
              >
                <option value="">Type or select customer...</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><CreditCard size={12} /> Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] text-[#334155] bg-white focus:border-[#3B82F6]"
            >
              <option value="">All Payment Modes</option>
              {paymentModes.map((pm: any) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] text-[#64748B] mb-1 font-bold">Show</label>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-2 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] text-[#334155] bg-white focus:border-[#3B82F6]"
            >
              <option value={10}>10 Entries</option>
              <option value={25}>25 Entries</option>
              <option value={50}>50 Entries</option>
              <option value={100}>100 Entries</option>
            </select>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-2 border-t border-dashed border-[#E2E8F0] gap-3 md:gap-0">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button type="button" onClick={() => refetch()} className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors">
              <Search size={14} /> Apply Filter
            </button>
            <button type="button" onClick={() => {
              setFromDate('');
              setToDate('');
              setCustomerId('');
              setInvoiceNo('');
              setPaymentMode('');
              setQuickSearch('');
            }} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${!isReset ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-white text-[#1F2937] border-gray-200 hover:bg-gray-50'}`}>
              <RotateCcw size={14} /> Reset Filters
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button type="button" onClick={() => {
              setFromDate(todayStr);
              setToDate(todayStr);
            }} className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${isToday ? 'bg-[#3B82F6] text-white border-[#2563EB]' : 'bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE] hover:bg-[#DBEAFE]'}`}>Today</button>
            <button type="button" onClick={() => {
              setFromDate(startOfMonthStr);
              setToDate(todayStr);
            }} className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${isMonth ? 'bg-[#3B82F6] text-white border-[#2563EB]' : 'bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE] hover:bg-[#DBEAFE]'}`}>This Month</button>
          </div>
        </div>
      </div>

      {/* Report Table Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0">
          <div className="flex items-center gap-2 text-[#3B82F6]">
            <FileText size={16} />
            <h2 className="font-bold text-[13px] tracking-wide text-[#1E3A8A]">SALES REPORT DISPLAY</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input 
                type="text" 
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Quick search table..."
                className="pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] w-64 focus:border-[#3B82F6]"
              />
            </div>
            <button type="button" 
              onClick={() => {
                const exportData = filteredSales.map((s: any) => ({
                  'Invoice No': s.invoiceNo,
                  'Date': s.date,
                  'Customer Name': s.customerName,
                  'Payment Mode': s.paymentMode,
                  'Total Birds': s.totalBirds,
                  'Total Amount': s.netPayable
                }));
                exportData.push({
                  'Invoice No': '',
                  'Date': '',
                  'Customer Name': '',
                  'Payment Mode': 'TOTAL:',
                  'Total Birds': '',
                  'Total Amount': formatCurrency(totalSalesAmount)
                });
                exportToExcel(exportData, `Sales_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, {
                  shopName: settings?.shopName || 'MY SHOP',
                  title: 'Sales Report',
                  totalCount: filteredSales.length
                });
              }}
              className="shrink-0 bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button type="button"
              onClick={() => {
                const cols: PdfColumn[] = [
                  { header: 'Invoice No', dataKey: 'invoiceNo' },
                  { header: 'Date', dataKey: 'date' },
                  { header: 'Customer Name', dataKey: 'customerName' },
                  { header: 'Payment Mode', dataKey: 'paymentMode' },
                  { header: 'Total Birds', dataKey: 'totalBirds' },
                  { header: 'Total Amount', dataKey: 'netPayable' },
                ];
                const pdfData = [...filteredSales, {
                  invoiceNo: '',
                  date: '',
                  customerName: '',
                  paymentMode: 'TOTAL:',
                  totalBirds: '',
                  netPayable: formatCurrency(totalSalesAmount)
                }];
                exportTableToPdf(cols, pdfData, `Sales_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, 'Sales Report', settings?.shopName, filteredSales.length);
              }}
              className="shrink-0 bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button type="button" 
              onClick={() => navigate('/sales/pos')}
              className="bg-[#1E3A8A] hover:bg-[#172554] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Plus size={14} /> <span className="hidden sm:inline">New POS Bill</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[12px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#0F172A] text-white font-bold">
                <th className="px-4 py-3 border-r border-[#1E293B]">Invoice No</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-center">Date</th>
                <th className="px-4 py-3 border-r border-[#1E293B]">Customer Name</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-center">Payment Mode</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-center">Total Amount</th>
                <th className="px-4 py-3 text-center w-40">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center p-6 text-gray-500">Loading report data...</td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-6 text-gray-500">No sales records found.</td></tr>
              ) : (
                paginatedSales.map((s: any, index: number) => (
                  <React.Fragment key={s.id}>
                    <tr className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-[#3B82F6] cursor-pointer hover:underline">{s.invoiceNo}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-black font-bold">{s.date}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-black font-bold">{s.customerName}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        s.paymentMode?.toLowerCase() === 'credit'
                          ? 'bg-rose-500 text-white'
                          : s.paymentMode?.toLowerCase() === 'cash'
                          ? 'bg-[#22C55E] text-white'
                          : 'bg-[#3B82F6] text-white'
                      }`}>
                        {s.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center font-bold text-[#3B82F6]">{s.netPayable}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button type="button" 
                          onClick={() => {
                            setSelectedViewSaleId(s.id);
                            setIsViewModalOpen(true);
                          }}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                          title="View Invoice"
                        >
                          <Eye size={14} />
                        </button>
                        {settings?.enableInvoiceEdit && new Date(s.date).getTime() >= Date.now() - ((settings?.invoiceEditDays || 30) * 24 * 60 * 60 * 1000) && (
                        <button type="button" 
                          onClick={() => navigate(`/sales/pos?editId=${s.id}`)}
                          className="text-[#64748B] border border-[#64748B] rounded p-1 hover:bg-[#64748B] hover:text-white transition-colors"
                          title="Edit Invoice"
                        >
                          <Pencil size={14} />
                        </button>
                        )}
                        <button type="button" 
                          onClick={() => {
                            setSelectedSale({ id: s.id });
                            setIsPrintModalOpen(true);
                          }}
                          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-2 py-1 rounded-full flex items-center gap-1 font-bold text-[11px] transition-colors"
                        >
                          <Printer size={12} /> Print
                        </button>
                        <button type="button" 
                          onClick={() => {
                            setSelectedSale({ id: s.id });
                            setIsPrintModalOpen(true);
                          }}
                          className="bg-[#25D366] hover:bg-[#1EBE55] text-white px-2 py-1 rounded-full flex items-center gap-1 font-bold text-[11px] transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  </React.Fragment>
              ))
            )}
            </tbody>

          </table>
        </div>
        {!isLoading && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalEntries={filteredSales.length}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      </div>
      {/* Bottom Black Bar - always visible, outside scroll area */}
      <div className="bg-[#020617] text-white px-4 md:px-6 py-3 flex flex-col-reverse md:flex-row justify-between items-center md:items-end gap-3 md:gap-0 shrink-0 print:hidden w-full">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/sales/pos')}
            className="bg-[#2563EB] text-white text-[11px] font-bold px-3 py-1.5 rounded-sm flex items-center gap-1 hover:bg-[#1D4ED8] transition-colors"
          >
            <span className="opacity-70 border-r border-[#60A5FA] pr-1 mr-1">F2</span> POS
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="bg-[#0891B2] text-white text-[11px] font-bold px-3 py-1.5 rounded-sm flex items-center gap-1 hover:bg-[#0E7490] transition-colors"
          >
            <span className="opacity-70 border-r border-[#67E8F9] pr-1 mr-1">Esc</span> Dashboard
          </button>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
          <span className="text-[13px] md:text-[16px] font-bold text-white uppercase tracking-wide">TOTAL AMOUNT:</span>
          <span className="text-[20px] md:text-[28px] font-bold text-[#38BDF8]">{formatCurrency(totalSalesAmount)}</span>
        </div>
      </div>

      <InvoicePrintModal 
        isOpen={isPrintModalOpen} 
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedSale(null);
        }} 
        sale={selectedSale} 
      />

      {isViewModalOpen && selectedViewSaleId && (
        <ViewSalesModal 
          saleId={selectedViewSaleId} 
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedViewSaleId(null);
          }} 
        />
      )}
    </div>
  );
};

export default SalesReport;
