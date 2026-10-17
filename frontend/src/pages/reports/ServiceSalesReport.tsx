import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Printer, Download, Scissors, Calendar, FileText, RotateCcw, Plus } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import ServiceReceiptPrintModal from '../../components/ServiceReceiptPrintModal';
import PaginationControls from '../../components/PaginationControls';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import TableLoader from '../../components/TableLoader';

const ServiceSalesReport = () => {
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [printSale, setPrintSale] = useState<any>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const startOfMonthStr = new Date(new Date().setDate(1)).toISOString().split('T')[0];
  const isToday = fromDate === todayStr && toDate === todayStr;
  const isMonth = fromDate === startOfMonthStr && toDate === todayStr;
  const isReset = !fromDate && !toDate && !customerId && !invoiceNo && !paymentMode && !quickSearch;

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data,
  });
  const { data: paymentModes = [] } = useQuery({
    queryKey: ['paymentModes'],
    queryFn: async () => (await api.get('/payment-modes')).data,
  });

  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['service-sales-report', fromDate, toDate, invoiceNo, customerId, paymentMode],
    queryFn: async () => {
      const params: any = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (invoiceNo) params.invoiceNo = invoiceNo;
      if (customerId) params.customerId = customerId;
      if (paymentMode) params.paymentModeId = paymentMode;
      return (await api.get('/service-sales', { params })).data;
    },
  });

  const filteredSales = quickSearch
    ? sales.filter((s: any) =>
      s.invoiceNo?.toLowerCase().includes(quickSearch.toLowerCase()) ||
      s.customer?.name?.toLowerCase().includes(quickSearch.toLowerCase()) ||
      s.items?.some((i: any) => i.serviceName?.toLowerCase().includes(quickSearch.toLowerCase()))
    )
    : sales;

  const totalPages = Math.ceil(filteredSales.length / entriesPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const totalRevenue = filteredSales.reduce((s: number, r: any) => s + Number(r.grandTotal || 0), 0);
  const totalDiscount = filteredSales.reduce((s: number, r: any) => s + Number(r.discount || 0), 0);
  const totalTax = filteredSales.reduce((s: number, r: any) => s + Number(r.tax || 0), 0);

  const handlePrint = async (sale: any) => {
    const full = await api.get(`/service-sales/${sale.id}`);
    setPrintSale(full.data);
    setIsPrintOpen(true);
  };

  const handleExport = () => {
    const rows: any[] = filteredSales.map((s: any) => ({
      'Invoice No': s.invoiceNo,
      'Date': new Date(s.date).toLocaleDateString('en-IN'),
      'Customer': s.customer?.name || 'Cash Customer',
      'Services': s.items?.map((i: any) => i.serviceName).join(', '),
      'Payment Mode': s.paymentMode?.name || '-',
      'Subtotal': Number(s.subtotal || 0).toFixed(2),
      'Discount': Number(s.discount || 0).toFixed(2),
      'Tax': Number(s.tax || 0).toFixed(2),
      'Grand Total': Number(s.grandTotal || 0).toFixed(2),
    }));
    rows.push({
      'Invoice No': '',
      'Date': '',
      'Customer': '',
      'Services': '',
      'Payment Mode': 'TOTAL:',
      'Subtotal': '',
      'Discount': formatCurrency(totalDiscount),
      'Tax': formatCurrency(totalTax),
      'Grand Total': formatCurrency(totalRevenue),
    });
    exportToExcel(rows, `Service_Sales_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, {
      shopName: settings?.shopName || 'MY SHOP',
      title: 'Service Sales Report',
      totalCount: filteredSales.length
    });
  };

  const handleExportPdf = () => {
    const cols: PdfColumn[] = [
      { header: 'Invoice No', dataKey: 'invoiceNo' },
      { header: 'Date', dataKey: 'date' },
      { header: 'Customer', dataKey: 'customer' },
      { header: 'Payment Mode', dataKey: 'mode' },
      { header: 'Subtotal', dataKey: 'subtotal' },
      { header: 'Discount', dataKey: 'discount' },
      { header: 'Tax', dataKey: 'tax' },
      { header: 'Grand Total', dataKey: 'grandTotal' },
    ];
    const rows = filteredSales.map((s: any) => ({
      invoiceNo: s.invoiceNo,
      date: new Date(s.date).toLocaleDateString('en-IN'),
      customer: s.customer?.name || 'Cash Customer',
      mode: s.paymentMode?.name || '-',
      subtotal: formatCurrency(s.subtotal || 0),
      discount: formatCurrency(s.discount || 0),
      tax: formatCurrency(s.tax || 0),
      grandTotal: formatCurrency(s.grandTotal || 0),
    }));
    rows.push({
      invoiceNo: '',
      date: '',
      customer: '',
      mode: 'TOTAL:',
      subtotal: '',
      discount: formatCurrency(totalDiscount),
      tax: formatCurrency(totalTax),
      grandTotal: formatCurrency(totalRevenue),
    });
    exportTableToPdf(cols, rows, `Service_Sales_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, 'Service Sales Report', settings?.shopName, filteredSales.length);
  };

  const handlePrintSummaryReport = () => {
    const printWindow = window.open('', '_blank', 'width=340,height=600');
    if (!printWindow) return;
    const shopName = settings?.shopName || 'My Shop';
    const shopAddress = settings?.shopAddress || '';
    const now = new Date();

    const rows = filteredSales.map((s: any, idx: number) =>
      `<tr>
        <td style="padding:1px 3px;font-size:10px">${idx + 1}</td>
        <td style="padding:1px 3px;font-size:10px">${s.invoiceNo}</td>
        <td style="padding:1px 3px;font-size:10px">${new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
        <td style="padding:1px 3px;font-size:10px">${s.customer?.name || 'Cash'}</td>
        <td style="padding:1px 3px;font-size:10px;text-align:right"><b>${Number(s.grandTotal || 0).toFixed(2)}</b></td>
      </tr>`
    ).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Service Sales Report</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 80mm; padding: 4px 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; font-weight: bold; text-align: left; border-bottom: 1px solid #000; padding: 2px 3px; }
  .center { text-align: center; }
  .separator { border-top: 1px dashed #000; margin: 4px 0; }
  .bold { font-weight: bold; }
</style></head><body>
<div class="center bold" style="font-size:13px;letter-spacing:1px">${shopName}</div>
${shopAddress ? `<div class="center" style="font-size:10px">${shopAddress}</div>` : ''}
<div class="separator"></div>
<div class="center bold">SERVICE SALES REPORT</div>
<div style="font-size:10px">Period: ${fromDate || 'All'} to ${toDate || 'All'}</div>
<div style="font-size:10px">Printed: ${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
<div class="separator"></div>
<table>
  <thead><tr><th>#</th><th>Invoice</th><th>Date</th><th>Customer</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="separator"></div>
<div style="display:flex;justify-content:space-between;font-size:11px"><span>Bills:</span><span class="bold">${filteredSales.length}</span></div>
${totalDiscount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Discount:</span><span>-${totalDiscount.toFixed(2)}</span></div>` : ''}
${totalTax > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Tax:</span><span>+${totalTax.toFixed(2)}</span></div>` : ''}
<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;border-top:1px solid #000;margin-top:3px;padding-top:3px">
  <span>TOTAL REVENUE:</span><span>${formatCurrency(totalRevenue)}</span>
</div>
<div class="separator"></div>
<div class="center" style="font-size:9px;color:#666">POS Suite 360</div>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10 p-2 sm:p-4">
      <div className="print:hidden flex flex-col flex-1 overflow-hidden">

        {/* Filter Section */}
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-2 p-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-3">

            <div>
              <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><Calendar size={12} /> From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><Calendar size={12} /> To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[12px] text-[#059669] mb-1 font-bold"><Scissors size={12} /> Invoice No</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="SRV-00001..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#059669]"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold">Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#059669]"
              >
                <option value="">All Customers</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-2 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] text-[#334155] bg-white focus:border-[#059669]"
              >
                <option value="">All Modes</option>
                {paymentModes.map((pm: any) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-[11px] text-[#64748B] mb-1 font-bold">Show</label>
              <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="w-full px-2 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] text-[#334155] bg-white focus:border-[#059669]"
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
              <button type="button" onClick={() => refetch()}
                className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors"
              >
                <Search size={14} /> Apply Filter
              </button>
              <button type="button" onClick={() => { setFromDate(''); setToDate(''); setCustomerId(''); setInvoiceNo(''); setPaymentMode(''); setQuickSearch(''); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${!isReset ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-white text-[#1F2937] border-gray-200 hover:bg-gray-50'}`}
              >
                <RotateCcw size={14} /> Reset Filters
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button type="button" onClick={() => { setFromDate(todayStr); setToDate(todayStr); }}
                className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${isToday ? 'bg-[#059669] text-white border-[#047857]' : 'bg-[#ECFDF5] text-[#059669] border-[#6EE7B7] hover:bg-[#D1FAE5]'}`}
              >Today</button>
              <button type="button" onClick={() => { setFromDate(startOfMonthStr); setToDate(todayStr); }}
                className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${isMonth ? 'bg-[#059669] text-white border-[#047857]' : 'bg-[#ECFDF5] text-[#059669] border-[#6EE7B7] hover:bg-[#D1FAE5]'}`}
              >This Month</button>
            </div>
          </div>
        </div>

        {/* Report Table Section */}
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0">
            <div className="flex items-center gap-2 text-[#059669]">
              <FileText size={16} />
              <h2 className="font-bold text-[13px] tracking-wide text-[#047857]">SERVICE SALES REPORT DISPLAY</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input type="text" value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Quick search table..."
                  className="pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] w-52 focus:border-[#059669]"
                />
              </div>
              <button type="button" onClick={handleExport} disabled={filteredSales.length === 0}
                className="bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors disabled:opacity-50"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button type="button" onClick={handleExportPdf} disabled={filteredSales.length === 0}
                className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors disabled:opacity-50"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
              </button>
              <button type="button" onClick={handlePrintSummaryReport} disabled={filteredSales.length === 0}
                className="bg-[#047857] hover:bg-[#065F46] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors disabled:opacity-50"
              >
                <Printer size={14} /> Print Thermal
              </button>
              <button type="button" onClick={() => navigate('/services/sales')}
                className="bg-[#1E3A8A] hover:bg-[#172554] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Plus size={14} /> New Bill
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto overflow-x-auto">
            <table className="w-full text-left text-[12px] whitespace-nowrap">
              <thead>
                <tr className="bg-[#0F172A] text-white font-bold">
                  <th className="px-4 py-3 border-r border-[#1E293B] text-center">S.No</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Invoice No</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-center">Date</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Customer</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Services</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-center">Payment</th>
                  {totalDiscount > 0 && <th className="px-4 py-3 border-r border-[#1E293B] text-right">Discount</th>}
                  {totalTax > 0 && <th className="px-4 py-3 border-r border-[#1E293B] text-right">Tax</th>}
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Total</th>
                  <th className="px-4 py-3 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="p-0"><TableLoader /></td></tr>
                ) : filteredSales.length === 0 ? (
                  <tr><td colSpan={10} className="text-center p-6 text-gray-500">No service billing records found.</td></tr>
                ) : paginatedSales.map((s: any, index: number) => (
                  <tr key={s.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#ECFDF5]`}>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-[#64748B]">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-[#059669] font-mono">{s.invoiceNo}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-[#475569]">
                      {new Date(s.date).toISOString().split('T')[0]}
                    </td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-medium text-[#334155]">
                      {s.customer?.name || 'Cash Customer'}
                    </td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-[#64748B]" style={{ maxWidth: 200 }}>
                      {(s.items || []).map((i: any) => i.serviceName).slice(0, 2).join(', ')}
                      {s.items?.length > 2 && ` +${s.items.length - 2}`}
                    </td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center">
                      <span className="bg-[#64748B] text-white px-2 py-0.5 rounded text-[10px] font-bold">
                        {s.paymentMode?.name?.toUpperCase()}
                      </span>
                    </td>
                    {totalDiscount > 0 && (
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-red-600 font-medium">
                        {Number(s.discount) > 0 ? `-${formatCurrency(s.discount)}` : '—'}
                      </td>
                    )}
                    {totalTax > 0 && (
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-blue-600 font-medium">
                        {Number(s.tax) > 0 ? formatCurrency(s.tax) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-[#059669]">
                      {formatCurrency(s.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => handlePrint(s)}
                        className="text-[#059669] border border-[#059669] rounded p-1 hover:bg-[#059669] hover:text-white transition-colors"
                        title="Print Thermal Receipt"
                      >
                        <Printer size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
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

      {/* Bottom Black Bar */}
      <div className="bg-[#020617] text-white px-4 md:px-6 py-3 flex flex-col-reverse md:flex-row justify-between items-center md:items-end gap-3 md:gap-0 shrink-0 print:hidden w-full">
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/services/sales')}
            className="bg-[#059669] text-white text-[11px] font-bold px-3 py-1.5 rounded-sm flex items-center gap-1 hover:bg-[#047857] transition-colors"
          >
            <span className="opacity-70 border-r border-[#6EE7B7] pr-1 mr-1">F2</span> New Bill
          </button>
          <button type="button" onClick={() => navigate('/dashboard')}
            className="bg-[#0891B2] text-white text-[11px] font-bold px-3 py-1.5 rounded-sm flex items-center gap-1 hover:bg-[#0E7490] transition-colors"
          >
            <span className="opacity-70 border-r border-[#67E8F9] pr-1 mr-1">Esc</span> Dashboard
          </button>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
          <span className="text-[13px] md:text-[16px] font-bold text-white uppercase tracking-wide">TOTAL REVENUE:</span>
          <span className="text-[20px] md:text-[28px] font-bold text-[#6EE7B7]">{formatCurrency(totalRevenue)}</span>
        </div>
      </div>

      {/* Print Modal */}
      {isPrintOpen && printSale && (
        <ServiceReceiptPrintModal
          isOpen={isPrintOpen}
          onClose={() => { setIsPrintOpen(false); setPrintSale(null); }}
          sale={printSale}
          autoPrint={false}
        />
      )}
    </div>
  );
};

export default ServiceSalesReport;
