import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, Printer, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import InvoicePrintModal from '../../components/InvoicePrintModal';
import { useSettings } from '../../contexts/SettingsContext';
import ViewSalesModal from './ViewSalesModal';
import PaginationControls from '../../components/PaginationControls';



const SalesList = () => {
  const { settings, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [viewSaleId, setViewSaleId] = useState<number | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>('All');

  // Fetch Sales from API
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data } = await api.get('/sales');
      return data;
    },
  });

  // Pagination & Filtering Logic
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Collect unique payment mode names for filter buttons
  const paymentModeNames: string[] = Array.from(
    new Set(sales.map((s: any) => s.paymentMode?.name).filter(Boolean))
  ) as string[];

  const filteredSales = sales.filter((sale: any) => {
    const modeMatch = paymentFilter === 'All' || sale.paymentMode?.name === paymentFilter;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const invoiceMatch = sale.invoiceNo?.toLowerCase().includes(term);
      const customerMatch = sale.customer?.name?.toLowerCase().includes(term);
      return modeMatch && (invoiceMatch || customerMatch);
    }
    return modeMatch;
  });

  const totalPages = Math.ceil(filteredSales.length / entriesPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col font-sans overflow-hidden z-10">
      {/* Top Header (Hidden on print) */}
      <div className="bg-[#0B355B] text-white px-2 sm:px-4 py-2 flex flex-wrap gap-2 justify-between items-center shrink-0 print:hidden">
        <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-bold">
          <span className="opacity-70 hover:opacity-100 cursor-pointer transition-opacity" onClick={() => navigate('/dashboard')}>Home</span> 
          <span className="opacity-50">/</span>
          <span className="opacity-70">Transactions</span>
          <span className="opacity-50">/</span>
          <span className="text-[#60A5FA]">Sales Invoices</span>
        </div>
        <button 
          type="button" 
          onClick={() => navigate('/sales/pos')}
          className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-3 sm:px-4 py-1.5 rounded flex items-center gap-2 font-bold text-[12px] sm:text-[13px] transition-colors"
        >
          <Plus size={16} /> <span className="hidden sm:inline">New POS Sale</span>
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        
        {/* Controls / Filters (Hidden on print) */}
        <div className="bg-white p-3 border-b border-[#E5E7EB] shrink-0 flex flex-col gap-3 print:hidden">
          {/* Payment Mode Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {['All', ...paymentModeNames].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setPaymentFilter(mode); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-[12px] font-bold border transition-colors ${
                  paymentFilter === mode
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {mode}
                <span className="ml-1.5 opacity-70">
                  ({mode === 'All' ? sales.length : sales.filter((s: any) => s.paymentMode?.name === mode).length})
                </span>
              </button>
            ))}
          </div>

          {/* Search & Entries */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 text-[12px] font-bold text-gray-700">
              <span>Show</span>
              <select
                className="border border-[#ccc] rounded px-2 py-1 outline-none text-[#1F2937] bg-white"
                value={entriesPerPage}
                onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-[12px] font-bold text-[#1F2937] hidden sm:block">Search:</label>
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-64 px-3 py-1.5 border border-[#ccc] rounded outline-none text-[12px] focus:border-[#3B82F6]"
              />
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto overflow-x-auto bg-white print:overflow-visible">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2.5 border-r border-[#444] relative">Date</th>
                <th className="px-3 py-2.5 border-r border-[#444] relative">Invoice No</th>
                <th className="px-3 py-2.5 border-r border-[#444] relative">Customer</th>
                <th className="px-3 py-2.5 border-r border-[#444] relative text-right">Total Amount (₹)</th>
                <th className="px-3 py-2.5 border-r border-[#444] relative text-center">Payment Mode</th>
                <th className="px-3 py-2.5 text-center w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-[#73879C]">Loading...</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-[#73879C]">No sales invoices found matching your criteria.</td>
                </tr>
              ) : (
                paginatedSales.map((sale: any, index: number) => (
                  <tr key={sale.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-[#F9F9F9]' : 'bg-white'} hover:bg-blue-50`}>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium">{sale.date ? new Date(sale.date).toISOString().split('T')[0] : '-'}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#3B82F6] font-bold cursor-pointer hover:underline">{sale.invoiceNo}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium">{sale.customer?.name || 'Counter Sale'}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-bold text-right">{formatCurrency(sale.grandTotal)}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${
                        sale.paymentMode?.name?.toLowerCase() === 'credit'
                          ? 'bg-rose-500 text-white'
                          : sale.paymentMode?.name?.toLowerCase() === 'cash'
                          ? 'bg-[#22C55E] text-white'
                          : 'bg-[#3B82F6] text-white'
                      }`}>
                        {sale.paymentMode?.name?.toUpperCase() || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" 
                          onClick={() => {
                            setSelectedSale(sale);
                            setIsPrintModalOpen(true);
                          }}
                          className="text-[#F59E0B] border border-[#F59E0B] rounded p-1 hover:bg-[#F59E0B] hover:text-white transition-colors"
                          title="Print Invoice"
                        >
                          <Printer size={14} />
                        </button>
                        <button type="button" 
                          onClick={() => setViewSaleId(sale.id)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                          title="View Invoice Details"
                        >
                          <Eye size={14} />
                        </button>
                        {settings?.enableInvoiceEdit && new Date(sale.date).getTime() >= Date.now() - ((settings?.invoiceEditDays || 30) * 24 * 60 * 60 * 1000) && (
                          <button type="button" 
                            onClick={() => navigate(`/sales/pos?editId=${sale.id}`)}
                            className="text-[#64748B] border border-[#64748B] rounded p-1 hover:bg-[#64748B] hover:text-white transition-colors"
                            title="Edit Invoice"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
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
            totalEntries={filteredSales.length}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Visual Modal for Printing */}
      <InvoicePrintModal 
        isOpen={isPrintModalOpen} 
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedSale(null);
        }} 
        sale={selectedSale} 
      />

      {/* View Details Modal */}
      {viewSaleId && (
        <ViewSalesModal 
          saleId={viewSaleId}
          onClose={() => setViewSaleId(null)}
        />
      )}
    </div>
  );
};

export default SalesList;
