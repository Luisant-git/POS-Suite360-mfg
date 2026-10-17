import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Download, RotateCcw, Box, Package } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import Select from 'react-select';
import TableLoader from '../../components/TableLoader';

const BatchPnlReport = () => {
  const { formatCurrency, settings } = useSettings();
  const [workName, setWorkName] = useState('');
  const [productId, setProductId] = useState('');

  // Fetch Master Data for filters
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data
  });

  const { data: productions = [] } = useQuery({
    queryKey: ['productions'],
    queryFn: async () => (await api.get('/production')).data
  });

  // Extract unique workNames
  const uniqueBatches = Array.from(new Set(productions.map((p: any) => p.workName))).filter(Boolean);
  const batchOptions = uniqueBatches.map(name => ({ label: String(name), value: String(name) }));

  // Filter products based on selected batch
  const batchProductions = productions.filter((p: any) => p.workName === workName);
  const batchProductIds = Array.from(new Set(batchProductions.map((p: any) => p.finishedProductId)));
  const availableProducts = workName
    ? products.filter((p: any) => batchProductIds.includes(p.id))
    : products.filter((p: any) => p.isManufacturingProduct);

  useEffect(() => {
    if (workName && availableProducts.length === 1) {
      setProductId(String(availableProducts[0].id));
    }
  }, [workName, availableProducts.length]);

  // Fetch Report Data
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['batchPnlReport', workName, productId],
    queryFn: async () => {
      if (!workName && !productId) return null;
      const { data } = await api.get(`/reports/batch-pnl`, {
        params: {
          workName: workName || undefined,
          productId: productId || undefined,
        }
      });
      return data;
    },
    enabled: !!workName || !!productId,
  });

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10 p-2 sm:p-4">

      <ReportTabs />

      {/* Filter Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-4 p-4 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#3B82F6] mb-1 font-bold"><Box size={12} /> Batch / Work Name</label>
            <div className="relative">
              <Select
                options={batchOptions}
                value={batchOptions.find(o => o.value === workName) || null}
                onChange={(option: any) => setWorkName(option ? option.value : '')}
                placeholder="Select Batch..."
                isClearable
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: '34px',
                    fontSize: '13px',
                    borderColor: '#CBD5E1',
                    boxShadow: 'none',
                    '&:hover': {
                      borderColor: '#3B82F6'
                    }
                  }),
                  option: (base, state) => ({
                    ...base,
                    fontSize: '13px',
                    backgroundColor: state.isSelected ? '#EFF6FF' : state.isFocused ? '#F8FAFC' : 'white',
                    color: state.isSelected ? '#3B82F6' : '#334155',
                    fontWeight: state.isSelected ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 9999
                  })
                }}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold"><Package size={12} /> Product (Optional Filter)</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#3B82F6]"
              >
                <option value="">All Finished Products</option>
                {availableProducts.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => refetch()} disabled={!workName && !productId} className="bg-[#0F172A] hover:bg-[#1E293B] disabled:bg-gray-400 text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors">
              <Search size={14} /> Calculate P&L
            </button>
            <button type="button" onClick={() => {
              setWorkName('');
              setProductId('');
            }} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm border bg-white text-[#1F2937] border-gray-200 hover:bg-gray-50">
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards Section */}
      {reportData && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-4 shrink-0">
          {/* Row 1/Col 1 */}
          <div className="bg-white p-4 rounded-md border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
            <p className="text-[#64748B] text-[12px] font-bold mb-1 uppercase">Total Cost</p>
            <p className="text-[20px] font-bold text-red-600">{formatCurrency(reportData.totalCost)}</p>
          </div>
          {/* Row 1/Col 2 */}
          <div className="bg-white p-4 rounded-md border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
            <p className="text-[#64748B] text-[12px] font-bold mb-1 uppercase">Potential Revenue</p>
            <p className="text-[20px] font-bold text-green-600">{formatCurrency(reportData.totalRevenue)}</p>
          </div>
          {/* Row 1/Col 3 */}
          <div className={`bg-white p-4 rounded-md border border-[#E2E8F0] shadow-sm flex flex-col justify-center ${reportData.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-[12px] font-bold mb-1 uppercase ${reportData.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Profit / Loss</p>
            <p className={`text-[20px] font-bold ${reportData.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(Math.abs(reportData.profit))} {reportData.profit < 0 ? '(Loss)' : ''}</p>
          </div>

          {/* Row 1/Col 4 */}
          <div className="bg-white p-4 rounded-md border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
            <p className="text-[#64748B] text-[12px] font-bold mb-1 uppercase">Cost Per Unit</p>
            <p className="text-[20px] font-bold text-[#475569]">{formatCurrency(reportData.costPerUnit)}</p>
          </div>

          {/* Row 1/Col 5 */}
          <div className="bg-white p-4 rounded-md border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
            <p className="text-[#64748B] text-[12px] font-bold mb-1 uppercase">Produced Qty</p>
            <p className="text-[20px] font-bold text-[#1A63A8]">{reportData.totalProducedQty}</p>
          </div>

          {/* Row 1/Col 6 */}
          <div className="bg-white p-4 rounded-md border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
            <p className="text-[#64748B] text-[12px] font-bold mb-1 uppercase">Wastage Qty</p>
            <p className="text-[20px] font-bold text-orange-600">
              {Number(reportData.wastageQty).toFixed(2)} <span className="text-[12px] font-normal">({Number(reportData.wastagePercentage).toFixed(2)}%)</span>
            </p>
          </div>

          {/* Row 1/Col 7 */}
          <div className="bg-orange-50 p-4 rounded-md border border-orange-100 shadow-sm flex flex-col justify-center">
            <p className="text-orange-700 text-[12px] font-bold mb-1 uppercase">Wastage Cost</p>
            <p className="text-[20px] font-bold text-orange-600">{formatCurrency(reportData.wastageCost)}</p>
          </div>
        </div>
      )}

      {/* Report Table Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0 shrink-0">
          <div className="flex items-center gap-2 text-[#64748B]">
            <FileText size={16} />
            <h2 className="font-bold text-[13px] tracking-wide">RAW MATERIALS CONSUMED</h2>
          </div>
          {reportData && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button"
                onClick={() => window.print()}
                className="bg-white border border-[#CBD5E1] text-[#334155] hover:bg-gray-50 px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <FileText size={14} /> <span className="hidden sm:inline">Print Report</span>
              </button>
              <button type="button"
                onClick={() => {
                  const exportData = reportData.materialsUsed.map((m: any) => ({
                    'Material Name': m.name,
                    'Quantity Consumed': m.quantity,
                    'Total Cost': m.cost,
                  }));
                  exportData.push({
                    'Material Name': 'TOTAL COST',
                    'Quantity Consumed': '',
                    'Total Cost': reportData.totalCost
                  });
                  exportData.push({
                    'Material Name': 'POTENTIAL REVENUE',
                    'Quantity Consumed': '',
                    'Total Cost': reportData.totalRevenue
                  });
                  exportData.push({
                    'Material Name': 'NET PROFIT',
                    'Quantity Consumed': '',
                    'Total Cost': reportData.profit
                  });
                  exportToExcel(exportData, `Batch_PnL_${workName || 'Report'}`, {
                    shopName: settings?.shopName || 'MY SHOP',
                    title: `Batch P&L Report - ${workName}`,
                    totalCount: reportData.materialsUsed.length
                  });
                }}
                className="bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button type="button"
                onClick={() => {
                  const cols: PdfColumn[] = [
                    { header: 'Raw Material Name', dataKey: 'name' },
                    { header: 'Quantity Consumed', dataKey: 'quantity' },
                    { header: 'Total Cost', dataKey: 'cost' },
                  ];
                  const pdfData = [...reportData.materialsUsed.map((m: any) => ({
                    ...m,
                    cost: formatCurrency(m.cost)
                  })), {
                    name: 'TOTAL COST',
                    quantity: '',
                    cost: formatCurrency(reportData.totalCost)
                  }, {
                    name: 'POTENTIAL REVENUE',
                    quantity: '',
                    cost: formatCurrency(reportData.totalRevenue)
                  }, {
                    name: 'NET PROFIT',
                    quantity: '',
                    cost: formatCurrency(reportData.profit)
                  }];
                  exportTableToPdf(cols, pdfData, `Batch_PnL_${workName || 'Report'}`, `Batch P&L Report - ${workName}`, settings?.shopName, reportData.materialsUsed.length);
                }}
                className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[12px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#0F172A] text-white font-bold">
                <th className="px-4 py-3 border-r border-[#1E293B]">Raw Material Name</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-right">Quantity Consumed</th>
                <th className="px-4 py-3 border-r border-[#1E293B] text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableLoader columns={3} />
              ) : !reportData ? (
                <tr><td colSpan={3} className="text-center p-6 text-gray-500">Select a batch or product and click Calculate P&L</td></tr>
              ) : reportData.materialsUsed.length === 0 ? (
                <tr><td colSpan={3} className="text-center p-6 text-gray-500">No raw materials consumed for this batch.</td></tr>
              ) : (
                reportData.materialsUsed.map((m: any, index: number) => (
                  <tr key={index} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] font-medium text-[#334155]">{m.name}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-[#475569]">{m.quantity}</td>
                    <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-[#475569] font-bold">{formatCurrency(m.cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {reportData && reportData.materialsUsed.length > 0 && (
              <tfoot>
                <tr className="bg-[#F1F5F9] font-bold">
                  <td colSpan={2} className="px-4 py-3 border-r border-[#E2E8F0] text-right text-[#334155]">Total Cost</td>
                  <td className="px-4 py-3 border-r border-[#E2E8F0] text-right text-red-600">{formatCurrency(reportData.totalCost)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default BatchPnlReport;
