import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import PaginationControls from '../../components/PaginationControls';
import RawMaterialPurchaseModal from './RawMaterialPurchaseModal';

const RawMaterialPurchaseList = () => {
  const { formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewId, setViewId] = useState<number | null>(null);

  // Fetch RM Purchases
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['rawMaterialPurchases'],
    queryFn: async () => {
      const { data } = await api.get('/raw-material-purchases');
      return data;
    },
  });

  // Pagination & Filtering Logic
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const getItemMaterialCode = (item: any) =>
    String(item?.materialCode || item?.rawMaterial?.code || '').trim() || '-';

  const getItemBatchCode = (item: any) =>
    String(item?.batchCode || item?.rawMaterial?.batchCode || '').trim() || '-';

  const filteredPurchases = purchases.filter((purchase: any) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const invoiceMatch = purchase.invoiceNo?.toLowerCase().includes(term);
      const supplierMatch = purchase.supplier?.name?.toLowerCase().includes(term);
      const itemMatch = (purchase.items || []).some((item: any) =>
        item.rawMaterial?.name?.toLowerCase().includes(term) ||
        getItemMaterialCode(item).toLowerCase().includes(term) ||
        getItemBatchCode(item).toLowerCase().includes(term)
      );
      return invoiceMatch || supplierMatch || itemMatch;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredPurchases.length / entriesPerPage);
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col font-sans overflow-hidden z-10">
      {/* Top Header */}
      <div className="bg-[#475569] text-white px-2 sm:px-4 py-2 flex flex-wrap gap-2 justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-[12px] sm:text-[13px] font-bold">
          <span className="opacity-70 hover:opacity-100 cursor-pointer transition-opacity" onClick={() => navigate('/dashboard')}>Home</span> 
          <span className="opacity-50">/</span>
          <span className="opacity-70">Manufacturing</span>
          <span className="opacity-50">/</span>
          <span className="text-[#93C5FD]">RM Purchase Invoices</span>
        </div>
        <button 
          type="button" 
          onClick={() => navigate('/raw-materials/purchase')}
          className="bg-[#10B981] hover:bg-[#059669] text-white px-3 sm:px-4 py-1.5 rounded flex items-center gap-2 font-bold text-[12px] sm:text-[13px] transition-colors"
        >
          <Plus size={16} /> <span className="hidden sm:inline">New RM Purchase</span>
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        
        {/* Controls / Filters */}
        <div className="bg-white p-3 border-b border-[#E5E7EB] shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-[12px] font-bold text-gray-700">
            <span>Show</span>
          <select 
            className="border border-[#ccc] rounded px-2 py-1 outline-none text-[#1F2937] bg-white"
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
            <span>entries</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-[12px] font-bold text-[#1F2937] hidden sm:block">Search:</label>
            <input 
              type="text" 
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-64 px-3 py-1.5 border border-[#ccc] rounded outline-none text-[12px] focus:border-[#3B82F6]"
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto overflow-x-auto bg-white">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#1E293B] text-white font-bold">
                <th className="px-3 py-2.5 border-r border-[#334155] relative">Date</th>
                <th className="px-3 py-2.5 border-r border-[#334155] relative">Invoice No</th>
                <th className="px-3 py-2.5 border-r border-[#334155] relative">Supplier</th>
                <th className="px-3 py-2.5 border-r border-[#334155] relative">Material Name</th>
                <th className="px-3 py-2.5 border-r border-[#334155] relative">Material Code</th>
                <th className="px-3 py-2.5 border-r border-[#334155] relative">Material Batch Code</th>
                <th className="px-3 py-2.5 border-r border-[#334155] relative">Payment Mode</th>
                <th className="px-3 py-2.5 border-r border-[#334155] relative text-right">Total Amount (₹)</th>
                <th className="px-3 py-2.5 border-[#334155] relative text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-[#73879C]">Loading...</td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-[#73879C]">No purchase invoices found matching your criteria.</td>
                </tr>
              ) : (
                paginatedPurchases.map((purchase: any, index: number) => {
                  const purchaseItems = Array.isArray(purchase.items) ? purchase.items : [];
                  return (
                    <tr key={purchase.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-[#F9F9F9]' : 'bg-white'} hover:bg-slate-50`}>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium">{purchase.date ? new Date(purchase.date).toISOString().split('T')[0] : '-'}</td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#3B82F6] font-bold">{purchase.invoiceNo}</td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium">{purchase.supplier?.name || 'Unknown Supplier'}</td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium">
                        {purchaseItems.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {purchaseItems.map((item: any, idx: number) => (
                              <span key={item.id || idx}>{item.rawMaterial?.name || '-'}</span>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-normal">
                        {purchaseItems.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {purchaseItems.map((item: any, idx: number) => (
                              <span key={item.id || idx}>{getItemMaterialCode(item)}</span>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-normal">
                        {purchaseItems.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {purchaseItems.map((item: any, idx: number) => (
                              <span key={item.id || idx}>{getItemBatchCode(item)}</span>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB]">
                        <span className="inline-block px-2 py-1 bg-[#EBF5FF] text-[#2563EB] rounded text-[10px] font-black uppercase tracking-wider">
                          {purchase.paymentMode?.name || 'Cash'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#059669] font-bold text-right">{formatCurrency(purchase.grandTotal)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button 
                          onClick={() => setViewId(purchase.id)}
                          className="p-1.5 bg-[#EBF5FF] text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white rounded transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
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

export default RawMaterialPurchaseList;
