import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, Edit } from 'lucide-react';
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
          {/* Mobile Card View (md:hidden) */}
          <div className="md:hidden divide-y divide-[#E2E8F0]">
            {isLoading ? (
              <div className="p-6 text-center text-gray-500 font-bold">Loading RM purchases...</div>
            ) : filteredPurchases.length === 0 ? (
              <div className="text-center p-6 text-gray-500">No purchase invoices found matching your criteria.</div>
            ) : (
              paginatedPurchases.map((purchase: any) => {
                const purchaseItems = Array.isArray(purchase.items) ? purchase.items : [];
                return (
                  <div key={purchase.id} className="p-3.5 bg-white hover:bg-[#F8FAFC]">
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div>
                        <span className="font-black text-[#1E3A8A] text-[13px]">{purchase.invoiceNo}</span>
                        <span className="text-[11px] text-gray-500 block">
                          {purchase.date ? new Date(purchase.date).toISOString().split('T')[0] : '-'}
                        </span>
                      </div>
                      <span className="font-black text-[15px] text-[#059669]">
                        {formatCurrency(purchase.grandTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[12px] text-gray-700 mb-2">
                      <span className="font-bold text-slate-800">{purchase.supplier?.name || 'Unknown Supplier'}</span>
                      <span className="inline-block px-2 py-0.5 bg-[#EBF5FF] text-[#2563EB] rounded text-[10px] font-black uppercase tracking-wider">
                        {purchase.paymentMode?.name || 'Cash'}
                      </span>
                    </div>

                    {purchaseItems.length > 0 && (
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 mb-2.5 space-y-1">
                        <div className="text-[11px] font-semibold text-slate-700">
                          {purchaseItems.slice(0, 2).map((item: any, idx: number) => (
                            <div key={item.id || idx} className="truncate">
                              • <span className="font-bold">{item.rawMaterial?.name || '-'}</span>
                              {(getItemMaterialCode(item) !== '-' || getItemBatchCode(item) !== '-') && (
                                <span className="text-slate-500 text-[10px] ml-1">
                                  ({getItemMaterialCode(item)} / {getItemBatchCode(item)})
                                </span>
                              )}
                            </div>
                          ))}
                          {purchaseItems.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setViewId(purchase.id)}
                              className="text-[10px] text-blue-600 font-bold hover:underline block mt-1"
                            >
                              +{purchaseItems.length - 2} more materials (view details)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => navigate(`/raw-materials/purchase?editId=${purchase.id}`)}
                        className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded transition-colors"
                      >
                        <Edit size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewId(purchase.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#3B82F6] bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors"
                      >
                        <Eye size={13} /> View Invoice
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <table className="hidden md:table w-full text-left text-[13px] whitespace-nowrap">
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
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium align-top">{purchase.date ? new Date(purchase.date).toISOString().split('T')[0] : '-'}</td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#3B82F6] font-bold align-top">{purchase.invoiceNo}</td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium align-top">{purchase.supplier?.name || 'Unknown Supplier'}</td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-medium align-top">
                        {purchaseItems.length > 0 ? (
                          <div className="flex flex-col gap-0.5 max-w-[200px]">
                            {purchaseItems.slice(0, 2).map((item: any, idx: number) => (
                              <span key={item.id || idx} className="truncate block" title={item.rawMaterial?.name || '-'}>
                                {item.rawMaterial?.name || '-'}
                              </span>
                            ))}
                            {purchaseItems.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setViewId(purchase.id)}
                                className="text-[10px] text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded w-fit mt-0.5 transition-colors cursor-pointer text-left"
                                title="Click to view all items"
                              >
                                +{purchaseItems.length - 2} more items
                              </button>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-normal align-top">
                        {purchaseItems.length > 0 ? (
                          <div className="flex flex-col gap-0.5 max-w-[150px]">
                            {purchaseItems.slice(0, 2).map((item: any, idx: number) => (
                              <span key={item.id || idx} className="truncate block font-mono text-[12px]" title={getItemMaterialCode(item)}>
                                {getItemMaterialCode(item)}
                              </span>
                            ))}
                            {purchaseItems.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                +{purchaseItems.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#333] font-normal align-top">
                        {purchaseItems.length > 0 ? (
                          <div className="flex flex-col gap-0.5 max-w-[180px]">
                            {purchaseItems.slice(0, 2).map((item: any, idx: number) => (
                              <span key={item.id || idx} className="truncate block font-mono text-[12px]" title={getItemBatchCode(item)}>
                                {getItemBatchCode(item)}
                              </span>
                            ))}
                            {purchaseItems.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                +{purchaseItems.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] align-top">
                        <span className="inline-block px-2 py-1 bg-[#EBF5FF] text-[#2563EB] rounded text-[10px] font-black uppercase tracking-wider">
                          {purchase.paymentMode?.name || 'Cash'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-[#059669] font-bold text-right align-top">{formatCurrency(purchase.grandTotal)}</td>
                      <td className="px-3 py-2.5 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => setViewId(purchase.id)}
                            className="p-1.5 bg-[#EBF5FF] text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white rounded transition-colors"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => navigate(`/raw-materials/purchase?editId=${purchase.id}`)}
                            className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded transition-colors border border-amber-200"
                            title="Edit Invoice"
                          >
                            <Edit size={15} />
                          </button>
                        </div>
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
