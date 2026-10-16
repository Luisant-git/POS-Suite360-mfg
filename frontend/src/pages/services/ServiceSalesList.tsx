import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ServiceReceiptPrintModal from '../../components/ServiceReceiptPrintModal';
import PaginationControls from '../../components/PaginationControls';

const ServiceSalesList = () => {
  const navigate = useNavigate();
  const { formatCurrency } = useSettings();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [printSale, setPrintSale] = useState<any>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['service-sales'],
    queryFn: async () => (await api.get('/service-sales')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/service-sales/${id}`),
    onSuccess: () => {
      toast.success('Bill deleted');
      queryClient.invalidateQueries({ queryKey: ['service-sales'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const handlePrint = async (sale: any) => {
    const full = await api.get(`/service-sales/${sale.id}`);
    setPrintSale(full.data);
    setIsPrintOpen(true);
  };

  // Unique payment modes for filter
  const paymentModeNames: string[] = Array.from(
    new Set(sales.map((s: any) => s.paymentMode?.name).filter(Boolean))
  ) as string[];

  const filtered = sales.filter((s: any) => {
    const modeMatch = paymentFilter === 'All' || s.paymentMode?.name === paymentFilter;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return modeMatch && (
        s.invoiceNo?.toLowerCase().includes(t) ||
        s.customer?.name?.toLowerCase().includes(t)
      );
    }
    return modeMatch;
  });

  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const paginated = filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col font-sans overflow-hidden z-10">

      {/* Top Header */}
      <div className="bg-[#0B4A3F] text-white px-2 sm:px-4 py-2 flex flex-wrap gap-2 justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-bold">
          <span className="opacity-70 hover:opacity-100 cursor-pointer transition-opacity" onClick={() => navigate('/dashboard')}>Home</span>
          <span className="opacity-50">/</span>
          <span className="opacity-70">Services</span>
          <span className="opacity-50">/</span>
          <span className="text-[#6EE7B7]">Service Bills</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/services/sales')}
          className="bg-[#059669] hover:bg-[#047857] text-white px-3 sm:px-4 py-1.5 rounded flex items-center gap-2 font-bold text-[12px] sm:text-[13px] transition-colors"
        >
          <Plus size={16} /> <span className="hidden sm:inline">New Service Bill</span>
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Controls / Filters */}
        <div className="bg-white p-3 border-b border-[#E5E7EB] shrink-0 flex flex-col gap-3">
          {/* Payment Mode Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {['All', ...paymentModeNames].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setPaymentFilter(mode); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-[12px] font-bold border transition-colors ${
                  paymentFilter === mode
                    ? 'bg-[#047857] text-white border-[#047857] shadow-sm'
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
                placeholder="Invoice no. or customer..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-64 px-3 py-1.5 border border-[#ccc] rounded outline-none text-[12px] focus:border-[#059669]"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto overflow-x-auto bg-white">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2.5 border-r border-[#444]">Date</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Invoice No</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Customer</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Services</th>
                <th className="px-3 py-2.5 border-r border-[#444] text-right">Amount</th>
                <th className="px-3 py-2.5 border-r border-[#444] text-center">Payment</th>
                <th className="px-3 py-2.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-[#73879C]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[#73879C]">
                  No service bills found. <span className="text-[#059669] font-bold cursor-pointer" onClick={() => navigate('/services/sales')}>Create one?</span>
                </td></tr>
              ) : paginated.map((sale: any, index: number) => (
                <tr key={sale.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-[#F9F9F9]' : 'bg-white'} hover:bg-emerald-50`}>
                  <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium">
                    {sale.date ? new Date(sale.date).toISOString().split('T')[0] : '—'}
                  </td>
                  <td className="px-3 py-2.5 border-r border-[#E5E7EB] font-mono font-bold text-[#059669]">
                    {sale.invoiceNo}
                  </td>
                  <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium">
                    {sale.customer?.name || 'Cash Customer'}
                  </td>
                  <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#73879C] text-[12px]">
                    {(sale.items || []).map((i: any) => i.serviceName).slice(0, 2).join(', ')}
                    {sale.items?.length > 2 && ` +${sale.items.length - 2} more`}
                  </td>
                  <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-right font-bold text-[#333]">
                    {formatCurrency(sale.grandTotal)}
                  </td>
                  <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-center">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${
                      sale.paymentMode?.name?.toLowerCase() === 'credit'
                        ? 'bg-rose-500 text-white'
                        : sale.paymentMode?.name?.toLowerCase() === 'cash'
                        ? 'bg-[#22C55E] text-white'
                        : 'bg-[#3B82F6] text-white'
                    }`}>
                      {sale.paymentMode?.name?.toUpperCase() || 'CASH'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrint(sale)}
                        className="text-[#059669] border border-[#059669] rounded p-1 hover:bg-[#059669] hover:text-white transition-colors"
                        title="Print Receipt"
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm(`Delete bill ${sale.invoiceNo}?`)) deleteMutation.mutate(sale.id); }}
                        className="text-[#EF4444] border border-[#EF4444] rounded p-1 hover:bg-[#EF4444] hover:text-white transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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
            totalEntries={filtered.length}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
          />
        )}
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

export default ServiceSalesList;
