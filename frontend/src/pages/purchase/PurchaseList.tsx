import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, Search, Truck, LayoutGrid, List, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import ViewPurchaseModal from './ViewPurchaseModal';
import PaginationControls from '../../components/PaginationControls';
import TableLoader from '../../components/TableLoader';

const PurchaseList = () => {
  const { formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [viewId, setViewId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');

  // Fetch Purchases
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data } = await api.get('/purchases');
      return data;
    },
  });

  // Fetch Payment Modes
  const { data: paymentModes = [] } = useQuery({
    queryKey: ['paymentModes'],
    queryFn: async () => (await api.get('/payment-modes')).data,
  });

  // Pagination & Filtering Logic
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPurchases = purchases.filter((purchase: any) => {
    if (paymentModeFilter && Number(purchase.paymentModeId) !== Number(paymentModeFilter)) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const invoiceMatch = purchase.invoiceNo?.toLowerCase().includes(term);
      const supplierMatch = purchase.supplier?.name?.toLowerCase().includes(term);
      const suppInvMatch = purchase.supplierInvoiceNo?.toLowerCase().includes(term);
      return invoiceMatch || supplierMatch || suppInvMatch;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredPurchases.length / entriesPerPage);
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10">
      {/* Top Header */}
      <div className="bg-[#0B355B] text-white px-3 sm:px-4 py-2.5 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-bold">
          <span className="opacity-70 hover:opacity-100 cursor-pointer transition-opacity" onClick={() => navigate('/dashboard')}>Home</span> 
          <span className="opacity-50">/</span>
          <span className="opacity-70 hidden sm:inline">Transactions</span>
          <span className="opacity-50 hidden sm:inline">/</span>
          <span className="text-[#60A5FA]">Purchase Invoices</span>
        </div>
        <button 
          type="button" 
          onClick={() => navigate('/purchase/new')}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 sm:px-4 py-1.5 rounded flex items-center gap-1.5 font-bold text-[12px] sm:text-[13px] transition-colors shadow-sm"
        >
          <Plus size={15} /> <span>New Purchase</span>
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        
        {/* Controls / Filters */}
        <div className="bg-white p-2.5 sm:p-3 border-b border-[#E2E8F0] shrink-0 flex flex-col gap-2.5 shadow-sm">
          {/* Horizontal scrollable payment mode chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => { setPaymentModeFilter(''); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                paymentModeFilter === ''
                  ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              All Modes ({purchases.length})
            </button>
            {paymentModes.map((pm: any) => {
              const count = purchases.filter((p: any) => Number(p.paymentModeId) === Number(pm.id)).length;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => { setPaymentModeFilter(String(pm.id)); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                    String(paymentModeFilter) === String(pm.id)
                      ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {pm.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Search + Entries + View Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by entry no, supplier invoice, supplier..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
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
                  onChange={(e) => {
                    setEntriesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
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
              <TableLoader columns={7} />
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold flex flex-col items-center justify-center gap-2">
              <FileText size={32} className="text-gray-300" />
              <span>No purchase invoices found matching your criteria.</span>
            </div>
          ) : (
            <>
              {/* Mobile Cards View (Visible when mobileView === 'cards') */}
              <div className={`p-2.5 sm:p-3 flex flex-col gap-2.5 ${mobileView === 'cards' ? 'md:hidden' : 'hidden'}`}>
                {paginatedPurchases.map((purchase: any) => (
                  <div
                    key={purchase.id}
                    className="bg-white rounded-lg border border-[#E2E8F0] p-3 shadow-sm hover:border-[#3B82F6] transition-all flex flex-col gap-2"
                  >
                    {/* Card Header: Entry No / Supp Inv & Date */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[13px] text-[#0F172A] bg-gray-100 px-2 py-0.5 rounded">
                          {purchase.invoiceNo}
                        </span>
                        {purchase.supplierInvoiceNo && (
                          <span
                            onClick={() => setViewId(purchase.id)}
                            className="text-[12px] font-bold text-[#3B82F6] hover:underline cursor-pointer"
                          >
                            #{purchase.supplierInvoiceNo}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-[#64748B]">
                        {purchase.date ? new Date(purchase.date).toLocaleDateString() : '-'}
                      </span>
                    </div>

                    {/* Card Body: Supplier & Mode */}
                    <div className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-1.5 font-bold text-black truncate max-w-[210px]">
                        <Truck size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate">{purchase.supplier?.name || 'Unknown Supplier'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                        purchase.paymentMode?.name?.toLowerCase() === 'credit'
                          ? 'bg-rose-500 text-white'
                          : 'bg-[#22C55E] text-white'
                      }`}>
                        {purchase.paymentMode?.name?.toUpperCase() || 'PAID'}
                      </span>
                    </div>

                    {/* Card Footer: Total Amount & Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Amount</span>
                        <span className="text-[15px] font-bold text-[#0F172A]">
                          {formatCurrency(purchase.grandTotal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewId(purchase.id)}
                          className="flex items-center gap-1 bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] border border-[#BFDBFE] px-3 py-1.5 rounded text-[11px] font-bold transition-colors shadow-sm"
                        >
                          <Eye size={13} /> View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (Also visible on mobile when mobileView === 'table') */}
              <div className={`overflow-x-auto bg-white ${mobileView === 'table' ? 'block' : 'hidden md:block'}`}>
                <table className="w-full text-left text-[13px] whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#0F172A] text-white font-bold">
                      <th className="px-4 py-3 border-r border-[#1E293B]">Date</th>
                      <th className="px-4 py-3 border-r border-[#1E293B]">Entry No</th>
                      <th className="px-4 py-3 border-r border-[#1E293B]">Supp. Inv. No.</th>
                      <th className="px-4 py-3 border-r border-[#1E293B]">Supplier</th>
                      <th className="px-4 py-3 border-r border-[#1E293B] text-right">Total Amount</th>
                      <th className="px-4 py-3 border-r border-[#1E293B] text-center">Payment Mode</th>
                      <th className="px-4 py-3 text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPurchases.map((purchase: any, index: number) => (
                      <tr key={purchase.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">
                          {purchase.date ? new Date(purchase.date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold font-mono">{purchase.invoiceNo}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-[#3B82F6] font-bold cursor-pointer hover:underline" onClick={() => setViewId(purchase.id)}>
                          {purchase.supplierInvoiceNo || '-'}
                        </td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{purchase.supplier?.name || 'Unknown Supplier'}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold text-right">{formatCurrency(purchase.grandTotal)}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${
                            purchase.paymentMode?.name?.toLowerCase() === 'credit'
                              ? 'bg-rose-500 text-white'
                              : 'bg-[#22C55E] text-white'
                          }`}>
                            {purchase.paymentMode?.name?.toUpperCase() || 'PAID'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button type="button" 
                              onClick={() => setViewId(purchase.id)}
                              className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                              title="View Invoice"
                            >
                              <Eye size={14} />
                            </button>
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
              totalEntries={filteredPurchases.length}
              entriesPerPage={entriesPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {viewId && (
        <ViewPurchaseModal purchaseId={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  );
};

export default PurchaseList;
