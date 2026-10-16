import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Box, Activity } from 'lucide-react';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import { useSettings } from '../../contexts/SettingsContext';
import PaginationControls from '../../components/PaginationControls';

const StockReport = () => {
  const { formatCurrency, settings } = useSettings();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get('/categories')).data });
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get('/brands')).data });

  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [quickSearch, setQuickSearch] = useState('');

  // Fetch Stock Data
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['stockReport', categoryId, brandId, quickSearch],
    queryFn: async () => {
      const { data } = await api.get('/products', {
        params: {
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
          search: quickSearch || undefined,
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

  const totalStockValue = products.reduce((sum: number, p: any) => sum + (Number(p.rawStockValue) || 0), 0);

  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(products.length / entriesPerPage);
  const paginatedProducts = products.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-hidden z-10 p-4">
      
      <ReportTabs />

      {/* Filter Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-4 p-4 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#3B82F6]"
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold">Brand</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#3B82F6]"
            >
              <option value="">All Brands</option>
              {brands.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold">Search Product</label>
            <input 
              type="text" 
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] focus:border-[#3B82F6]"
            />
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
            <button type="button" onClick={() => refetch()} className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors">
              Apply Filter
            </button>
            <button type="button" onClick={() => {
              setCategoryId('');
              setBrandId('');
              setQuickSearch('');
            }} className="text-[#64748B] hover:text-[#334155] flex items-center gap-1 text-[13px] font-bold transition-colors">
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0 shrink-0">
          <div className="flex items-center gap-2 text-[#475569]">
            <Box size={16} />
            <h2 className="font-bold text-[13px] tracking-wide text-[#334155]">STOCK AS ON DATE REPORT</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button type="button" 
              onClick={() => {
                const exportData = products.map((p: any) => ({
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
                  totalCount: products.length
                });
              }}
              className="bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
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
                const pdfData = [...products, {
                  code: '',
                  name: '',
                  brandName: '',
                  categoryName: '',
                  currentQty: '',
                  purRate: 'TOTAL VALUE:',
                  stockValue: formatCurrency(totalStockValue)
                }];
                exportTableToPdf(cols, pdfData, 'Stock_Report', 'Stock Report', settings?.shopName, products.length);
              }}
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button type="button" className="bg-[#64748B] hover:bg-[#475569] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors">
              <Activity size={14} /> <span className="hidden sm:inline">Live Valuation</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[12px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#0F172A] text-white font-bold">
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
                <tr><td colSpan={7} className="text-center p-6 text-gray-500">Loading report data...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-6 text-gray-500">No stock records found.</td></tr>
              ) : (
                paginatedProducts.map((p: any, index: number) => (
                  <tr key={p.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-[#334155]">{p.code}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-[#1E293B]">{p.name}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-[#475569]">{p.brandName}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-[#475569]">{p.categoryName}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-[#334155]">{p.currentQty}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-[#475569]">{p.purRate}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#3B82F6]">{p.stockValue}</td>
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
            totalEntries={products.length}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
      
    </div>
  );
};

export default StockReport;
