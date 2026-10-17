import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Box, Activity, Filter, X } from 'lucide-react';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import { useSettings } from '../../contexts/SettingsContext';
import PaginationControls from '../../components/PaginationControls';
import SearchableSelect from '../../components/SearchableSelect';
import TableLoader from '../../components/TableLoader';

const StockReport = () => {
  const { formatCurrency, settings } = useSettings();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get('/categories')).data });
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get('/brands')).data });

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [quickSearch, setQuickSearch] = useState('');

  // Fetch Stock Data
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['stockReport', categoryId, brandId],
    queryFn: async () => {
      const { data } = await api.get('/products', {
        params: {
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
        }
      });
      return data.map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        brandName: p.brand?.name || '-',
        categoryName: p.category?.name || '-',
        currentQty: `${p.currentStock} ${p.unit?.shortCode || p.unit?.name || ''}`.trim(),
        purRate: formatCurrency(p.purchaseRate),
        rawStockValue: Number(p.currentStock) * Number(p.purchaseRate),
        stockValue: formatCurrency(Number(p.currentStock) * Number(p.purchaseRate)),
      }));
    },
  });

  // Client-side quick search filter
  const filteredProducts = quickSearch
    ? products.filter((p: any) =>
      p.name.toLowerCase().includes(quickSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(quickSearch.toLowerCase())
    )
    : products;

  const totalStockValue = filteredProducts.reduce((sum: number, p: any) => sum + (Number(p.rawStockValue) || 0), 0);

  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(filteredProducts.length / entriesPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const isReset = !categoryId && !brandId && !quickSearch;

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10 p-2 sm:p-4">

      <ReportTabs />

      {/* Mobile Quick Search + Filter Button */}
      <div className="md:hidden flex items-center gap-2 mb-2 shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] text-black font-bold focus:border-[#3B82F6]"
          />
        </div>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-1 shrink-0 bg-[#1E3A8A] text-white px-3 py-1.5 rounded text-[12px] font-bold shadow-sm">
          <Filter size={16} />
        </button>
      </div>

      {/* Filter Overlay (Mobile Only) */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/50 z-[9998] md:hidden" onClick={() => setIsFilterOpen(false)} />
      )}

      {/* Filter Section */}
      <div className={`bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-2 p-3 sm:mb-3 shrink-0 ${isFilterOpen ? 'fixed inset-y-0 right-0 w-[280px] z-[9999] m-0 rounded-none rounded-l-xl overflow-y-auto shadow-2xl' : 'hidden md:block'}`}>
        <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0] mb-3 md:hidden">
          <h3 className="font-bold text-[15px] text-[#1E3A8A]">Advanced Filters</h3>
          <button onClick={() => setIsFilterOpen(false)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end mb-3">
          <div>
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1">Category</label>
            <SearchableSelect
              options={[{ value: '', label: 'All Categories' }, ...categories.map((c: any) => ({ value: c.id, label: c.name }))]}
              value={categoryId}
              onChange={(val) => setCategoryId(val || '')}
              placeholder="All Categories"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1">Brand</label>
            <SearchableSelect
              options={[{ value: '', label: 'All Brands' }, ...brands.map((b: any) => ({ value: b.id, label: b.name }))]}
              value={brandId}
              onChange={(val) => setBrandId(val || '')}
              placeholder="All Brands"
            />
          </div>
          <div className="hidden md:block">
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1">Search Product</label>
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold focus:border-[#3B82F6]"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[12px] text-black font-bold mb-1">Show</label>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-black font-bold bg-white focus:border-[#3B82F6]"
            >
              <option value={10}>10 Entries</option>
              <option value={25}>25 Entries</option>
              <option value={50}>50 Entries</option>
              <option value={100}>100 Entries</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 border-t border-dashed border-[#E2E8F0] gap-2 sm:gap-0">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button type="button" onClick={() => { refetch(); setIsFilterOpen(false); }} className="flex-1 sm:flex-none bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center justify-center gap-2 text-[13px] font-bold transition-colors">
              Apply Filter
            </button>
            <button type="button" onClick={() => {
              setCategoryId('');
              setBrandId('');
              setQuickSearch('');
            }} className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border ${!isReset ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-white text-black border-[#CBD5E1] hover:bg-gray-100'}`}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1 min-h-[500px] lg:min-h-0">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 text-black font-bold">
            <Box size={16} />
            <h2 className="font-bold text-[13px] tracking-wide text-black">STOCK AS ON DATE REPORT</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button type="button"
              onClick={() => {
                const exportData = filteredProducts.map((p: any) => ({
                  'Item Code': p.code,
                  'Product Name': p.name,
                  'Brand': p.brandName,
                  'Category': p.categoryName,
                  'Current Qty': p.currentQty,
                  'Pur Rate': p.purRate,
                  'Stock Value': p.stockValue,
                }));
                exportData.push({
                  'Item Code': '',
                  'Product Name': '',
                  'Brand': '',
                  'Category': '',
                  'Current Qty': '',
                  'Pur Rate': 'TOTAL VALUE:',
                  'Stock Value': formatCurrency(totalStockValue) as any,
                });
                exportToExcel(exportData, 'Stock_Report', {
                  shopName: settings?.shopName || 'MY SHOP',
                  title: 'Stock Report',
                  totalCount: filteredProducts.length
                });
              }}
              className="flex-1 sm:flex-none bg-[#10B981] hover:bg-[#059669] text-white px-3 py-1.5 rounded flex items-center justify-center gap-1.5 text-[12px] font-bold whitespace-nowrap transition-colors"
            >
              <Download size={14} /> <span>Export Excel</span>
            </button>
            <button type="button"
              onClick={() => {
                const cols: PdfColumn[] = [
                  { header: 'Item Code', dataKey: 'code' },
                  { header: 'Product Name', dataKey: 'name' },
                  { header: 'Brand', dataKey: 'brandName' },
                  { header: 'Category', dataKey: 'categoryName' },
                  { header: 'Current Qty', dataKey: 'currentQty' },
                  { header: 'Pur Rate', dataKey: 'purRate' },
                  { header: 'Stock Value', dataKey: 'stockValue' },
                ];
                const pdfData = [...filteredProducts, {
                  code: '',
                  name: '',
                  brandName: '',
                  categoryName: '',
                  currentQty: '',
                  purRate: 'TOTAL VALUE:',
                  stockValue: formatCurrency(totalStockValue)
                }];
                exportTableToPdf(cols, pdfData, 'Stock_Report', 'Stock Report', settings?.shopName, filteredProducts.length);
              }}
              className="flex-1 sm:flex-none bg-[#EF4444] hover:bg-[#DC2626] text-white px-3 py-1.5 rounded flex items-center justify-center gap-1.5 text-[12px] font-bold whitespace-nowrap transition-colors"
            >
              <Download size={14} /> <span>Export PDF</span>
            </button>
            <button type="button" className="hidden sm:flex flex-1 sm:flex-none bg-[#64748B] hover:bg-[#475569] text-white px-3 py-1.5 rounded items-center justify-center gap-1.5 text-[12px] font-bold whitespace-nowrap transition-colors">
              <Activity size={14} /> <span className="hidden lg:inline">Live Inventory Valuation</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto overflow-x-auto">

            {/* Desktop Table */}
            <table className="hidden sm:table w-full text-left text-[12px] whitespace-nowrap">
              <thead>
                <tr className="bg-[#0F172A] text-white font-bold">
                  <th className="px-4 py-3 border-r border-[#1E293B] w-12 text-center">S.No</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Item Code</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Product Name</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Brand</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Category</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Current Qty</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Pur Rate</th>
                  <th className="px-4 py-3 text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableLoader columns={8} />
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={8} className="text-center p-6 text-black font-bold">No stock records found.</td></tr>
                ) : (
                  paginatedProducts.map((p: any, index: number) => (
                    <tr key={p.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-black font-bold">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{p.code}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-black">{p.name}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{p.brandName}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-black font-bold">{p.categoryName}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-black">{p.currentQty}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-black font-bold">{p.purRate}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#3B82F6]">{p.stockValue}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="sm:hidden">
              {isLoading ? (
                <div className="p-4 text-center text-black font-bold">Loading...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No stock records found.</div>
              ) : (
                paginatedProducts.map((p: any, index: number) => (
                  <div key={p.id} className={`border-b border-[#E2E8F0] p-3 ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="text-[11px] text-gray-400">#{(currentPage - 1) * entriesPerPage + index + 1} · {p.code}</span>
                        <p className="font-bold text-[13px] text-black">{p.name}</p>
                      </div>
                      <span className="font-bold text-[14px] text-[#3B82F6]">{p.stockValue}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <div className="bg-[#F1F5F9] rounded px-2 py-1 text-center">
                        <p className="text-[9px] text-gray-400 uppercase">Category</p>
                        <p className="text-[11px] font-bold text-black truncate">{p.categoryName}</p>
                      </div>
                      <div className="bg-[#F1F5F9] rounded px-2 py-1 text-center">
                        <p className="text-[9px] text-gray-400 uppercase">Qty</p>
                        <p className="text-[11px] font-bold text-black">{p.currentQty}</p>
                      </div>
                      <div className="bg-[#F1F5F9] rounded px-2 py-1 text-center">
                        <p className="text-[9px] text-gray-400 uppercase">Pur Rate</p>
                        <p className="text-[11px] font-bold text-black">{p.purRate}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
        {!isLoading && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalEntries={filteredProducts.length}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

    </div>
  );
};

export default StockReport;
