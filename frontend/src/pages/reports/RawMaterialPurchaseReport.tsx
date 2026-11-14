import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Download, Calendar, FileDigit, Truck, RotateCcw, Plus, Eye, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import PaginationControls from '../../components/PaginationControls';
import RawMaterialPurchaseModal from '../raw-materials/RawMaterialPurchaseModal';
import TableLoader from '../../components/TableLoader';
import { formatRawMaterialLabel } from '../../utils/productionBatch';

const RawMaterialPurchaseReport = () => {
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [viewId, setViewId] = useState<number | null>(null);

  // Fetch Master Data for filters
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data
  });

  // Fetch Report Data
  const { data: purchases = [], isLoading, refetch } = useQuery({
    queryKey: ['rawMaterialPurchaseReport', fromDate, toDate, supplierId, invoiceNo],
    queryFn: async () => {
      const { data } = await api.get(`/raw-material-purchases`, {
        params: {
          fromDate,
          toDate,
          supplierId: supplierId || undefined,
          invoiceNo: invoiceNo || undefined,
        }
      });
      return data.map((p: any) => {
        const items = Array.isArray(p.items) ? p.items : [];
        const normalizedItems = items.map((item: any) => ({
          id: item.id,
          materialName: item.rawMaterial?.name || '-',
          materialCode: String(item.materialCode || item.rawMaterial?.code || '').trim() || '-',
          batchCode: String(item.batchCode || item.rawMaterial?.batchCode || '').trim() || '-',
          label: formatRawMaterialLabel(item.rawMaterial, item.batchCode, item.materialCode),
        }));
        const materialsSummary = normalizedItems
          .map((item: any) => item.label)
          .filter(Boolean)
          .join(', ') || '-';
        const materialNames = normalizedItems.map((item: any) => item.materialName).join(', ') || '-';
        const materialCodes = normalizedItems.map((item: any) => item.materialCode).join(', ') || '-';
        const materialBatchCodes = normalizedItems.map((item: any) => item.batchCode).join(', ') || '-';
        const taxRates = Array.from(
          new Set(
            items.map((item: any) => `${Number(item.taxPercent ?? item.rawMaterial?.taxPercent ?? 0)}%`)
          )
        ).join(', ') || '0%';

        return {
          id: p.id,
          entryNo: `RM-PUR-${p.id.toString().padStart(5, '0')}`,
          invoiceNo: p.invoiceNo || '-',
          date: new Date(p.date).toISOString().split('T')[0],
          supplierName: p.supplier?.name || '-',
          paymentMode: p.paymentMode,
          paymentModeName: p.paymentMode?.name || 'Cash',
          normalizedItems,
          materialNames,
          materialCodes,
          materialBatchCodes,
          materialsSummary,
          taxRates,
          rawInvoiceValue: Number(p.subtotal) || 0,
          rawTaxAmount: Number(p.tax) || 0,
          rawNetAmount: Number(p.grandTotal) || 0,
          invoiceValue: formatCurrency(p.subtotal),
          taxAmount: formatCurrency(p.tax || 0),
          transportCharge: p.transportCharge ? formatCurrency(p.transportCharge) : '-',
          wages: p.wages ? formatCurrency(p.wages) : '-',
          netAmount: formatCurrency(p.grandTotal),
        };
      });
    },
  });

  const filteredPurchases = purchases.filter((p: any) => {
    if (!quickSearch) return true;
    const term = quickSearch.toLowerCase();
    return (
      p.entryNo.toLowerCase().includes(term) ||
      p.invoiceNo.toLowerCase().includes(term) ||
      p.supplierName.toLowerCase().includes(term) ||
      p.materialsSummary.toLowerCase().includes(term) ||
      p.netAmount.toLowerCase().includes(term)
    );
  });

  const totalInvoiceValue = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.rawInvoiceValue) || 0), 0);
  const totalTaxAmount = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.rawTaxAmount) || 0), 0);
  const totalNetAmount = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.rawNetAmount) || 0), 0);

  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(filteredPurchases.length / entriesPerPage);
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10 p-2 sm:p-4">

      <ReportTabs />

      {/* Mobile Quick Bar */}
      <div className="md:hidden flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex gap-2 flex-1">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-1/2 px-2 py-1.5 border border-[#CBD5E1] rounded text-[12px] font-bold text-black"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-1/2 px-2 py-1.5 border border-[#CBD5E1] rounded text-[12px] font-bold text-black"
          />
        </div>
        <button
          onClick={() => setIsFilterOpen(true)}
          className="flex items-center gap-1 shrink-0 bg-[#1E3A8A] text-white px-3 py-1.5 rounded text-[12px] font-bold"
        >
          <Filter size={16} />
        </button>
      </div>

      {isFilterOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
          onClick={() => setIsFilterOpen(false)}
        />
      )}

      {/* Filter Section - Desktop Inline & Mobile Drawer */}
      <div
        className={`bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-3 p-4 shrink-0 ${
          isFilterOpen
            ? 'fixed inset-y-0 right-0 w-[290px] sm:w-[320px] z-[9999] m-0 rounded-none rounded-l-xl overflow-y-auto shadow-2xl'
            : 'hidden md:block'
        }`}
      >
        <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0] mb-3 md:hidden">
          <h3 className="font-bold text-[15px] text-[#1E3A8A]">RM Purchase Filters</h3>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="p-1.5 bg-red-50 text-red-600 rounded-full"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-4">

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
                placeholder="Search invoice..."
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#3B82F6]"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><Truck size={12} /> Supplier Name</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#3B82F6]"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold">Show</label>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#3B82F6]"
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
            <button
              type="button"
              onClick={() => {
                refetch();
                setIsFilterOpen(false);
              }}
              className="flex-1 md:flex-initial justify-center bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors"
            >
              <Search size={14} /> Apply Filter
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
                setToDate(new Date().toISOString().split('T')[0]);
                setSupplierId('');
                setInvoiceNo('');
                setQuickSearch('');
                setIsFilterOpen(false);
              }}
              className="text-[#64748B] hover:text-[#334155] flex items-center gap-1 text-[13px] font-bold transition-colors"
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 sm:px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0 shrink-0">
          <div className="flex items-center gap-2 text-[#64748B]">
            <FileText size={16} />
            <h2 className="font-bold text-[13px] tracking-wide">RAW MATERIAL PURCHASE REPORT</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="relative flex-1 md:flex-initial">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Quick search..."
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] md:w-64 focus:border-[#3B82F6]"
              />
            </div>
            <button type="button"
              onClick={() => {
                const exportData = filteredPurchases.map((p: any) => ({
                  'Entry No': p.entryNo,
                  'Supplier Invoice No': p.invoiceNo,
                  'Date': p.date,
                  'Supplier Name': p.supplierName,
                  'Material (Name-Code-Batch)': p.materialsSummary,
                  'Payment Mode': p.paymentModeName,
                  'Invoice Value': p.invoiceValue,
                  'Tax %': p.taxRates,
                  'Tax Amt': p.taxAmount,
                  'Transport': p.transportCharge,
                  'Wages': p.wages,
                  'Net Amount': p.netAmount,
                }));
                exportData.push({
                  'Entry No': '',
                  'Supplier Invoice No': '',
                  'Date': '',
                  'Supplier Name': 'TOTAL:',
                  'Material (Name-Code-Batch)': '',
                  'Payment Mode': '',
                  'Invoice Value': formatCurrency(totalInvoiceValue),
                  'Tax %': '',
                  'Tax Amt': formatCurrency(totalTaxAmount),
                  'Transport': '',
                  'Wages': '',
                  'Net Amount': formatCurrency(totalNetAmount),
                });
                exportToExcel(exportData, `RMPurchase_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, {
                  shopName: settings?.shopName || 'MY SHOP',
                  title: 'Raw Material Purchase Report',
                  totalCount: filteredPurchases.length
                });
              }}
              className="bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button type="button"
              onClick={() => {
                const cols: PdfColumn[] = [
                  { header: 'Entry No', dataKey: 'entryNo' },
                  { header: 'Supp. Inv. No', dataKey: 'invoiceNo' },
                  { header: 'Date', dataKey: 'date' },
                  { header: 'Supplier Name', dataKey: 'supplierName' },
                  { header: 'Material (Name-Code-Batch)', dataKey: 'materialsSummary' },
                  { header: 'Invoice Value', dataKey: 'invoiceValue' },
                  { header: 'Tax %', dataKey: 'taxRates' },
                  { header: 'Tax Amt', dataKey: 'taxAmount' },
                  { header: 'Transport', dataKey: 'transportCharge' },
                  { header: 'Wages', dataKey: 'wages' },
                  { header: 'Net Amount', dataKey: 'netAmount' },
                ];
                const pdfData = [...filteredPurchases, {
                  entryNo: '',
                  invoiceNo: '',
                  date: '',
                  supplierName: 'TOTAL:',
                  materialsSummary: '',
                  invoiceValue: formatCurrency(totalInvoiceValue),
                  taxRates: '',
                  taxAmount: formatCurrency(totalTaxAmount),
                  transportCharge: '',
                  wages: '',
                  netAmount: formatCurrency(totalNetAmount)
                }];
                exportTableToPdf(cols, pdfData, `RMPurchase_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, 'Raw Material Purchase Report', settings?.shopName, filteredPurchases.length);
              }}
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button type="button"
              onClick={() => navigate('/raw-materials/purchase')}
              className="bg-[#1E3A8A] hover:bg-[#172554] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Plus size={14} /> <span className="hidden sm:inline">New RM Purchase</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-[#E2E8F0]">
            {isLoading ? (
              <div className="p-6 text-center text-gray-500 font-bold">Loading RM purchases...</div>
            ) : filteredPurchases.length === 0 ? (
              <div className="text-center p-6 text-gray-500">No purchase records found.</div>
            ) : (
              paginatedPurchases.map((p: any) => (
                <div key={p.id} className="p-3.5 bg-white hover:bg-[#F8FAFC]">
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <div>
                      <span className="font-black text-[#1E3A8A] text-[13px]">{p.entryNo}</span>
                      <span className="text-[11px] text-gray-500 block">Inv: {p.invoiceNo} • {p.date}</span>
                    </div>
                    <span className="font-black text-[15px] text-[#2563EB]">{p.netAmount}</span>
                  </div>

                  <div className="flex justify-between items-center text-[12px] text-gray-700 mb-1.5">
                    <span className="font-bold">{p.supplierName}</span>
                    <span className="inline-block px-2 py-0.5 bg-[#EBF5FF] text-[#2563EB] rounded text-[10px] font-black uppercase">
                      {p.paymentModeName}
                    </span>
                  </div>
                  {(p.normalizedItems || []).length > 0 ? (
                    <div className="space-y-1 mb-2">
                      {p.normalizedItems.map((item: any, idx: number) => (
                        <div key={item.id || idx} className="text-[11px] bg-slate-50 border border-slate-100 rounded px-2 py-1 font-semibold text-slate-800">
                          {item.label}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] font-semibold text-slate-700 mb-2 break-words">
                      {p.materialsSummary}
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-2 rounded text-[11px] text-gray-600 mb-2">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Inv Value</span>
                      <span className="font-bold text-gray-800">{p.invoiceValue}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Tax %</span>
                      <span className="font-bold text-gray-800">{p.taxRates}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Tax Amt</span>
                      <span className="font-bold text-gray-800">{p.taxAmount}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Transport</span>
                      <span className="font-bold text-gray-800">{p.transportCharge}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Wages</span>
                      <span className="font-bold text-gray-800">{p.wages}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setViewId(p.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#3B82F6] bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded"
                    >
                      <Eye size={13} /> View Invoice
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <table className="hidden md:table w-full text-left text-[12px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#0F172A] text-white font-bold">
                <th className="px-4 py-3 border-r border-[#1E293B] text-center">S.No</th>
                <th className="px-4 py-3 border-r border-[#1E293B]">Entry No</th>
                <th className="px-4 py-3 border-r border-[#1E293B]">Invoice No</th>
                <th className="px-4 py-3 border-r border-[#1E293B]">Date</th>
                <th className="px-4 py-3 border-r border-[#1E293B]">Supplier Name</th>
                <th className="px-4 py-3 border-r border-[#1E293B]">Material (Name-Code-Batch)</th>
                <th className="px-4 py-3 border-r border-[#1E293B]">Payment Mode</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-right">Invoice Value</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-center">Tax %</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-right">Tax Amt</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-right">Transport</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-right">Wages</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-right">Net Amount</th>
                <th className="px-4 py-3 border-[#1E293B] text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableLoader columns={14} />
              ) : filteredPurchases.length === 0 ? (
                <tr><td colSpan={14} className="text-center p-6 text-gray-500">No purchase records found.</td></tr>
              ) : (
                paginatedPurchases.map((p: any, index: number) => (
                  <tr key={p.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-[#64748B]">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-black">{p.entryNo}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-black">{p.invoiceNo}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-black">{p.date}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-medium text-black">{p.supplierName}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-medium text-[#1E3A8A]">
                      {(p.normalizedItems || []).length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {p.normalizedItems.map((item: any, idx: number) => (
                            <span key={item.id || idx} className="leading-snug">
                              {item.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        p.materialsSummary || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0]">
                      <span className="inline-block px-2 py-1 bg-[#EBF5FF] text-[#2563EB] rounded text-[10px] font-black uppercase tracking-wider">
                        {p.paymentModeName}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black">{p.invoiceValue}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-center font-semibold text-gray-700">{p.taxRates}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black font-semibold">{p.taxAmount}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black">{p.transportCharge}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black">{p.wages}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-black">{p.netAmount}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setViewId(p.id)}
                        className="p-1.5 bg-[#EBF5FF] text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white rounded transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
        <RawMaterialPurchaseModal purchaseId={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  );
};

export default RawMaterialPurchaseReport;
