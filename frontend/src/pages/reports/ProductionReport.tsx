import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Download, Calendar, RotateCcw, Plus, Box, Eye, PieChart as PieChartIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import { useSettings } from '../../contexts/SettingsContext';
import PaginationControls from '../../components/PaginationControls';
import ProductionModal from '../production/ProductionModal';
import Select from 'react-select';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import TableLoader from '../../components/TableLoader';
const ProductionReport = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [workName, setWorkName] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [viewId, setViewId] = useState<number | null>(null);
  const [filterRmId, setFilterRmId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');

  // Fetch Report Data
  const { data: productions = [], isLoading, refetch } = useQuery({
    queryKey: ['productionReport', fromDate, toDate, workName],
    queryFn: async () => {
      const { data } = await api.get(`/production`, {
        params: {
          fromDate,
          toDate,
          workName: workName || undefined,
        }
      });
      return data.map((p: any) => ({
        id: p.id,
        date: new Date(p.date).toISOString().split('T')[0],
        workName: p.workName || '-',
        rawMaterial: p.rawMaterial?.name || '-',
        rawMaterialId: p.rawMaterialId,
        intakeQuantity: p.intakeQuantity || 0,
        finishedProduct: p.finishedProduct?.name || '-',
        finishedProductId: p.finishedProductId,
        outcomeQuantity: p.outcomeQuantity || 0,
      }));
    },
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['rawMaterials'],
    queryFn: async () => (await api.get('/raw-materials')).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data,
  });

  const { data: uniqueWorkNames = [] } = useQuery({
    queryKey: ['uniqueWorkNames'],
    queryFn: async () => {
      const { data } = await api.get('/production');
      return Array.from(new Set(data.map((p: any) => p.workName).filter(Boolean)));
    },
  });

  const filteredProductions = productions.filter((p: any) => {
    if (fromDate && p.date < fromDate) return false;
    if (toDate && p.date > toDate) return false;
    if (workName && p.workName !== workName) return false;
    if (filterRmId && p.rawMaterialId?.toString() !== filterRmId) return false;
    if (filterProductId && p.finishedProductId?.toString() !== filterProductId) return false;

    if (!quickSearch) return true;
    const term = quickSearch.toLowerCase();
    return (
      p.workName.toLowerCase().includes(term) ||
      p.rawMaterial.toLowerCase().includes(term) ||
      p.finishedProduct.toLowerCase().includes(term)
    );
  });

  const entriesPerPage = 25;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(filteredProductions.length / entriesPerPage);
  const paginatedProductions = filteredProductions.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  let totalProduced = 0;
  let totalWastage = 0;

  const processedBatches = new Set();

  filteredProductions.forEach((p: any) => {
    if (processedBatches.has(p.workName)) return;

    const batchRows = productions.filter((bp: any) => bp.workName === p.workName && bp.finishedProductId === p.finishedProductId);

    const totalBatchRawSqM = batchRows.reduce((sum: number, bp: any) => {
      const rm = rawMaterials.find((r: any) => r.id === bp.rawMaterialId);
      const sqMPerRoll = Number(rm?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
      return sum + (bp.intakeQuantity * sqMPerRoll);
    }, 0);

    const prod = products.find((prod: any) => prod.id === p.finishedProductId);
    const productSqM = Number(prod?.sqM || 0);

    const batchOutcome = batchRows.find((bp: any) => bp.outcomeQuantity > 0)?.outcomeQuantity || p.outcomeQuantity;

    const totalTheoreticalYield = productSqM > 0 ? (totalBatchRawSqM / productSqM) : 0;

    if (batchOutcome && batchOutcome > 0) {
      totalProduced += batchOutcome;
      totalWastage += Math.max(0, totalTheoreticalYield - batchOutcome);
      processedBatches.add(p.workName);
    }
  });

  const pieData = [
    { name: 'Produced', value: parseFloat(totalProduced.toFixed(2)) },
    { name: 'Wastage', value: parseFloat(totalWastage.toFixed(2)) }
  ];

  const COLORS = ['#10B981', '#EF4444'];

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '34px',
      height: '34px',
      borderColor: state.isFocused ? '#3B82F6' : '#CBD5E1',
      boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none',
      '&:hover': { borderColor: state.isFocused ? '#3B82F6' : '#94A3B8' },
      fontSize: '13px',
      color: '#000000'
    }),
    valueContainer: (base: any) => ({ ...base, padding: '0 8px' }),
    input: (base: any) => ({ ...base, margin: 0, padding: 0, color: '#000000' }),
    dropdownIndicator: (base: any) => ({ ...base, padding: 4 }),
    clearIndicator: (base: any) => ({ ...base, padding: 4 }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      color: state.isSelected ? '#ffffff' : '#000000',
      backgroundColor: state.isSelected ? '#3B82F6' : state.isFocused ? '#EFF6FF' : '#ffffff'
    }),
    singleValue: (base: any) => ({ ...base, fontSize: '13px', color: '#000000' }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
  };

  return (
    <div className="absolute inset-0 bg-[#F8FAFC] flex flex-col font-sans overflow-y-auto lg:overflow-hidden z-10 p-2 sm:p-4">

      <ReportTabs />

      {/* Filter Section */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-4 p-4 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-end mb-4">

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
            <label className="flex items-center gap-1 text-[12px] text-[#3B82F6] mb-1 font-bold"><Box size={12} /> Batch / Work Name</label>
            <Select
              value={workName ? { value: workName, label: workName } : null}
              onChange={(selected: any) => setWorkName(selected ? selected.value : '')}
              options={uniqueWorkNames.map((name: any) => ({ value: name, label: name }))}
              isClearable
              placeholder="All Batches"
              styles={selectStyles}
              menuPortalTarget={document.body}
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#3B82F6] mb-1 font-bold"><Box size={12} /> Raw Material</label>
            <Select
              value={filterRmId ? { value: filterRmId, label: rawMaterials.find((rm: any) => rm.id.toString() === filterRmId)?.name || 'Unknown' } : null}
              onChange={(selected: any) => setFilterRmId(selected ? selected.value : '')}
              options={rawMaterials.map((rm: any) => ({ value: rm.id.toString(), label: rm.name }))}
              isClearable
              placeholder="All Raw Materials"
              styles={selectStyles}
              menuPortalTarget={document.body}
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#3B82F6] mb-1 font-bold"><Box size={12} /> Finished Product</label>
            <Select
              value={filterProductId ? { value: filterProductId, label: products.find((p: any) => p.id.toString() === filterProductId)?.name || 'Unknown' } : null}
              onChange={(selected: any) => setFilterProductId(selected ? selected.value : '')}
              options={products.map((p: any) => ({ value: p.id.toString(), label: p.name }))}
              isClearable
              placeholder="All Products"
              styles={selectStyles}
              menuPortalTarget={document.body}
            />
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-2 border-t border-dashed border-[#E2E8F0] gap-3 md:gap-0">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button type="button" onClick={() => refetch()} className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors">
              <Search size={14} /> Apply Filter
            </button>
            <button type="button" onClick={() => {
              setFromDate(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
              setToDate(new Date().toISOString().split('T')[0]);
              setWorkName('');
              setFilterRmId('');
              setFilterProductId('');
              setQuickSearch('');
            }} className="text-[#64748B] hover:text-[#334155] flex items-center gap-1 text-[13px] font-bold transition-colors">
              <RotateCcw size={14} /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Report Layout Wrapper */}
      <div className="flex flex-col xl:flex-row gap-4 flex-1 overflow-hidden min-h-0">

        {/* Report Table Section */}
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1 xl:w-3/4">
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0 shrink-0">
            <div className="flex items-center gap-2 text-[#64748B]">
              <FileText size={16} />
              <h2 className="font-bold text-[13px] tracking-wide">PRODUCTION REPORT</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Quick search table..."
                  className="pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] w-64 focus:border-[#3B82F6]"
                />
              </div>
              <button type="button"
                onClick={() => {
                  const totalIntake = filteredProductions.reduce((sum: number, p: any) => sum + (Number(p.intakeQuantity) || 0), 0);
                  const totalProducedSum = filteredProductions.reduce((sum: number, p: any) => sum + (Number(p.outcomeQuantity) || 0), 0);
                  const exportData = filteredProductions.map((p: any) => ({
                    'Date': p.date,
                    'Batch / Work Name': p.workName,
                    'Raw Material Used': p.rawMaterial,
                    'Intake Qty': p.intakeQuantity,
                    'Finished Product Output': p.finishedProduct,
                    'Produced Qty': p.outcomeQuantity,
                  }));
                  exportData.push({
                    'Date': '',
                    'Batch / Work Name': '',
                    'Raw Material Used': 'TOTAL:',
                    'Intake Qty': totalIntake,
                    'Finished Product Output': 'TOTAL:',
                    'Produced Qty': totalProducedSum,
                  });
                  exportToExcel(exportData, `Production_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, {
                    shopName: settings?.shopName || 'MY SHOP',
                    title: 'Production Report',
                    totalCount: filteredProductions.length
                  });
                }}
                className="bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button type="button"
                onClick={() => {
                  const totalIntake = filteredProductions.reduce((sum: number, p: any) => sum + (Number(p.intakeQuantity) || 0), 0);
                  const totalProducedSum = filteredProductions.reduce((sum: number, p: any) => sum + (Number(p.outcomeQuantity) || 0), 0);
                  const cols: PdfColumn[] = [
                    { header: 'Date', dataKey: 'date' },
                    { header: 'Batch / Work Name', dataKey: 'workName' },
                    { header: 'Raw Material', dataKey: 'rawMaterial' },
                    { header: 'Intake Qty', dataKey: 'intakeQuantity' },
                    { header: 'Finished Product', dataKey: 'finishedProduct' },
                    { header: 'Produced Qty', dataKey: 'outcomeQuantity' },
                  ];
                  const pdfData = [...filteredProductions, {
                    date: '',
                    workName: '',
                    rawMaterial: 'TOTAL:',
                    intakeQuantity: totalIntake.toString(),
                    finishedProduct: 'TOTAL:',
                    outcomeQuantity: totalProducedSum.toString()
                  }];
                  exportTableToPdf(cols, pdfData, `Production_Report_${fromDate || 'all'}_to_${toDate || 'all'}`, 'Production Report', settings?.shopName, filteredProductions.length);
                }}
                className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
              </button>
              <button type="button"
                onClick={() => navigate('/production/new')}
                className="bg-[#1E3A8A] hover:bg-[#172554] text-white px-3 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              >
                <Plus size={14} /> <span className="hidden sm:inline">New Production Entry</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto overflow-x-auto">
            <table className="w-full text-left text-[12px] whitespace-nowrap">
              <thead>
                <tr className="bg-[#0F172A] text-white font-bold">
                  <th className="px-4 py-3 border-r border-[#1E293B] text-center">S.No</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Date</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Batch / Work Name</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Raw Material Used</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Intake Qty</th>
                  <th className="px-4 py-3 border-r border-[#1E293B]">Finished Product Output</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Produced Qty</th>
                  <th className="px-4 py-3 border-r border-[#1E293B] text-right">Wastage Qty (%)</th>
                  <th className="px-4 py-3 border-[#1E293B] text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableLoader columns={9} />
                ) : filteredProductions.length === 0 ? (
                  <tr><td colSpan={9} className="text-center p-6 text-gray-500">No production records found.</td></tr>
                ) : (
                  paginatedProductions.map((p: any, index: number) => {
                    // Find all rows in this batch
                    const batchRows = productions.filter((bp: any) => bp.workName === p.workName && bp.finishedProductId === p.finishedProductId);

                    // Calculate total raw SqM for the entire batch
                    const totalBatchRawSqM = batchRows.reduce((sum: number, bp: any) => {
                      const rm = rawMaterials.find((r: any) => r.id === bp.rawMaterialId);
                      const sqMPerRoll = Number(rm?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
                      return sum + (bp.intakeQuantity * sqMPerRoll);
                    }, 0);

                    const prod = products.find((prod: any) => prod.id === p.finishedProductId);
                    const productSqM = Number(prod?.sqM || 0);

                    // Find the total outcome quantity for this batch
                    const batchOutcome = batchRows.find((bp: any) => bp.outcomeQuantity > 0)?.outcomeQuantity || p.outcomeQuantity;

                    const totalTheoreticalYield = productSqM > 0 ? (totalBatchRawSqM / productSqM) : 0;

                    let displayWastage = '-';
                    let wastagePercentage = '-';
                    if (batchOutcome && batchOutcome > 0) {
                      const wastage = totalTheoreticalYield > 0 ? (totalTheoreticalYield - batchOutcome) : 0;
                      const maxWastage = Math.max(0, wastage);
                      displayWastage = maxWastage.toFixed(2);
                      if (totalTheoreticalYield > 0) {
                        wastagePercentage = ((maxWastage / totalTheoreticalYield) * 100).toFixed(2) + '%';
                      }
                    }

                    return (
                      <tr key={p.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'} hover:bg-[#EFF6FF]`}>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-center text-[#64748B]">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-[#475569]">{p.date}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] font-bold text-[#1E293B]">{p.workName}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] font-medium text-[#B91C1C]">{p.rawMaterial}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-[#B91C1C]">{p.intakeQuantity}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] font-medium text-[#15803D]">{p.finishedProduct}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-[#15803D]">{batchOutcome > 0 ? batchOutcome : '-'}</td>
                        <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-orange-600">
                          {displayWastage} {displayWastage !== '-' && wastagePercentage !== '-' ? `(${wastagePercentage})` : ''}
                        </td>
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
              totalEntries={filteredProductions.length}
              entriesPerPage={entriesPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </div>

        {/* Chart Section */}
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md flex flex-col xl:w-1/4 shrink-0 overflow-hidden">
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 shrink-0">
            <h2 className="font-bold text-[13px] text-[#64748B] tracking-wide flex items-center gap-2">
              <PieChartIcon size={16} /> WASTAGE OVERVIEW
            </h2>
          </div>
          <div className="flex-1 p-4 flex flex-col items-center justify-center min-h-[300px]">
            {totalProduced === 0 && totalWastage === 0 ? (
              <div className="text-gray-400 text-[12px] font-bold text-center bg-gray-50 w-full py-10 rounded border border-gray-100">No completed productions<br />to chart.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => Number(value).toLocaleString()} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 text-center w-full bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">Total Efficiency</div>
                  <div className="text-[20px] font-black text-emerald-600">
                    {(((totalProduced) / (totalProduced + totalWastage)) * 100).toFixed(1)}%
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </div> {/* End Report Layout Wrapper */}

      {viewId && (
        <ProductionModal productionId={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  );
};

export default ProductionReport;
