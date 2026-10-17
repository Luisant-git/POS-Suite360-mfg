import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, Printer, Pencil, Search, User, LayoutGrid, List, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import InvoicePrintModal from '../../components/InvoicePrintModal';
import { useSettings } from '../../contexts/SettingsContext';
import ViewSalesModal from './ViewSalesModal';
import PaginationControls from '../../components/PaginationControls';
import TableLoader from '../../components/TableLoader';

const SalesList = () => {
  const { settings, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [viewSaleId, setViewSaleId] = useState<number | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');

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
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10">
      {/* Top Header (Hidden on print) */}
      <div className="bg-[#0B355B] text-white px-3 sm:px-4 py-2.5 flex justify-between items-center shrink-0 shadow-sm print:hidden">
        <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-bold">
          <span className="opacity-70 hover:opacity-100 cursor-pointer transition-opacity" onClick={() => navigate('/dashboard')}>Home</span> 
          <span className="opacity-50">/</span>
          <span className="opacity-70 hidden sm:inline">Transactions</span>
          <span className="opacity-50 hidden sm:inline">/</span>
          <span className="text-[#60A5FA]">Sales Invoices</span>
        </div>
        <button 
          type="button" 
          onClick={() => navigate('/sales/pos')}
          className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-3 sm:px-4 py-1.5 rounded flex items-center gap-1.5 font-bold text-[12px] sm:text-[13px] transition-colors shadow-sm"
        >
          <Plus size={15} /> <span>New POS Sale</span>
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        
        {/* Controls / Filters (Hidden on print) */}
        <div className="bg-white p-2.5 sm:p-3 border-b border-[#E2E8F0] shrink-0 flex flex-col gap-2.5 shadow-sm print:hidden">
          {/* Payment Mode Filter Buttons - Horizontal scrollable */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar shrink-0">
            {['All', ...paymentModeNames].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setPaymentFilter(mode); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                  paymentFilter === mode
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {mode} ({mode === 'All' ? sales.length : sales.filter((s: any) => s.paymentMode?.name === mode).length})
              </button>
            ))}
          </div>

          {/* Search + Entries + View Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by invoice no, customer name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded-md outline-none text-[12px] text-black font-bold placeholder:font-normal focus:border-[#3B82F6] h-[34px]"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Show Entries */}
              <div className="hidden sm:flex items-center gap-1.5 text-[12px] font-bold text-black">
                <span>Show</span>
                <select
                  className="border border-[#CBD5E1] rounded px-2 py-1 outline-none text-black font-bold bg-white h-[34px]"
                  value={entriesPerPage}
                  onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Mobile View Toggle: Cards vs Table */}
              <div className="flex md:hidden bg-gray-100 p-0.5 rounded border border-gray-200 h-[34px] items-center">
                <button
                  type="button"
                  onClick={() => setMobileView('cards')}
                  className={`p-1.5 rounded transition-all ${mobileView === 'cards' ? 'bg-white text-[#1E3A8A] shadow-sm' : 'text-gray-500 hover:text-black'}`}
                  title="Card View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView('table')}
                  className={`p-1.5 rounded transition-all ${mobileView === 'table' ? 'bg-white text-[#1E3A8A] shadow-sm' : 'text-gray-500 hover:text-black'}`}
                  title="Table View"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#F8FAFC]">
          {isLoading ? (
            <div className="p-8">
              <TableLoader columns={6} />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold flex flex-col items-center justify-center gap-2">
              <FileText size={32} className="text-gray-300" />
              <span>No sales invoices found matching your criteria.</span>
            </div>
          ) : (
            <>
              {/* Mobile Cards View (Visible when mobileView === 'cards') */}
              <div className={`p-2.5 sm:p-3 flex flex-col gap-2.5 ${mobileView === 'cards' ? 'md:hidden' : 'hidden'}`}>
                {paginatedSales.map((sale: any) => (
                  <div
                    key={sale.id}
                    className="bg-white rounded-lg border border-[#E2E8F0] p-3 shadow-sm hover:border-[#3B82F6] transition-all flex flex-col gap-2"
                  >
                    {/* Card Header: Invoice No & Date */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[13px] text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {sale.invoiceNo}
                      </span>
                      <span className="text-[11px] font-bold text-[#64748B]">
                        {sale.date ? new Date(sale.date).toISOString().split('T')[0] : '-'}
                      </span>
                    </div>

                    {/* Card Body: Customer & Mode */}
                    <div className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-1.5 font-bold text-black truncate max-w-[210px]">
                        <User size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate">{sale.customer?.name || 'Counter Sale'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                        sale.paymentMode?.name?.toLowerCase() === 'credit'
                          ? 'bg-rose-500 text-white'
                          : sale.paymentMode?.name?.toLowerCase() === 'cash'
                          ? 'bg-[#22C55E] text-white'
                          : 'bg-[#3B82F6] text-white'
                      }`}>
                        {sale.paymentMode?.name?.toUpperCase() || '-'}
                      </span>
                    </div>

                    {/* Card Footer: Grand Total & Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Amount</span>
                        <span className="text-[15px] font-bold text-[#0F172A]">
                          {formatCurrency(sale.grandTotal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button" 
                          onClick={() => {
                            setSelectedSale(sale);
                            setIsPrintModalOpen(true);
                          }}
                          className="text-[#F59E0B] border border-[#F59E0B] bg-amber-50 hover:bg-[#F59E0B] hover:text-white rounded p-1.5 transition-colors"
                          title="Print Invoice"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          type="button" 
                          onClick={() => setViewSaleId(sale.id)}
                          className="text-[#3B82F6] border border-[#3B82F6] bg-blue-50 hover:bg-[#3B82F6] hover:text-white rounded p-1.5 transition-colors"
                          title="View Invoice Details"
                        >
                          <Eye size={13} />
                        </button>
                        {settings?.enableInvoiceEdit && new Date(sale.date).getTime() >= Date.now() - ((settings?.invoiceEditDays || 30) * 24 * 60 * 60 * 1000) && (
                          <button
                            type="button" 
                            onClick={() => navigate(`/sales/pos?editId=${sale.id}`)}
                            className="text-[#64748B] border border-[#64748B] bg-gray-50 hover:bg-[#64748B] hover:text-white rounded p-1.5 transition-colors"
                            title="Edit Invoice"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (Also visible on mobile when mobileView === 'table') */}
              <div className={`overflow-x-auto bg-white print:overflow-visible ${mobileView === 'table' ? 'block' : 'hidden md:block'}`}>
                <table className="w-full text-left text-[13px] whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#0F172A] text-white font-bold">
                      <th className="px-4 py-3 border-r border-[#1E293B]">Date</th>
                      <th className="px-4 py-3 border-r border-[#1E293B]">Invoice No</th>
                      <th className="px-4 py-3 border-r border-[#1E293B]">Customer</th>
                      <th className="px-4 py-3 border-r border-[#1E293B] text-right">Total Amount</th>
                      <th className="px-4 py-3 border-r border-[#1E293B] text-center">Payment Mode</th>
                      <th className="px-4 py-3 text-center w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSales.map((sale: any, index: number) => (
                      <tr key={sale.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">
                          {sale.date ? new Date(sale.date).toISOString().split('T')[0] : '-'}
                        </td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-[#3B82F6] font-bold font-mono cursor-pointer hover:underline" onClick={() => setViewSaleId(sale.id)}>
                          {sale.invoiceNo}
                        </td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{sale.customer?.name || 'Counter Sale'}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold text-right">{formatCurrency(sale.grandTotal)}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-center">
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
                        <td className="px-4 py-3 text-center">
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
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {!isLoading && (
          <div className="bg-white border-t border-[#E2E8F0] shrink-0">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalEntries={filteredSales.length}
              entriesPerPage={entriesPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
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
