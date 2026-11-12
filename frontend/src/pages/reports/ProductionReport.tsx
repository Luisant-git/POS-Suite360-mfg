import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Download, Calendar, RotateCcw, Plus, Box, Eye, PieChart as PieChartIcon, Filter, X } from 'lucide-react';
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
import {
  formatRawMaterialLabel,
  getEffectiveIntakes,
  getEffectiveOutcomeEntries,
  getEffectiveOutcomes,
  isProductionCompleted,
  parseBatchWorkName,
} from '../../utils/productionBatch';
const ProductionReport = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [workName, setWorkName] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [viewId, setViewId] = useState<number | null>(null);
  const [filterRmId, setFilterRmId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');

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
      return data.map((p: any) => {
        const { batchCode, workName: displayWorkName } = parseBatchWorkName(p.workName);
        const intakes = getEffectiveIntakes(p);
        const outcomes = getEffectiveOutcomes(p);
        const outcomeEntries = getEffectiveOutcomeEntries(p);
        const completed = isProductionCompleted(p);
        const rawMaterialLabel = intakes
          .map((i: any) =>
            `${formatRawMaterialLabel(i.rawMaterial, i.materialBatchCode, i.materialCode)}${intakes.length > 1 ? ` (${i.intakeQuantity})` : ''}`
          )
          .join(', ') || '-';
        const finishedProductLabel = outcomes
          .map((o: any) =>
            `${o.finishedProduct?.name || '-'}${outcomes.length > 1 ? ` (${o.outcomeQuantity})` : ''}`
          )
          .filter(Boolean)
          .join(', ') || '-';
        const totalIn = intakes.reduce((s: number, i: any) => s + Number(i.intakeQuantity || 0), 0);
        const totalOut = outcomes.reduce((s: number, o: any) => s + Number(o.outcomeQuantity || 0), 0);
        return {
          id: p.id,
          date: new Date(p.date).toISOString().split('T')[0],
          completedDate: p.completedAt ? new Date(p.completedAt).toISOString().split('T')[0] : '-',
          batchCode,
          displayWorkName,
          workName: p.workName || '-',
          status: p.status,
          statusLabel: completed ? 'Completed' : 'Pending',
          completed,
          intakes,
          outcomes,
          outcomeEntries,
          hasStructuredRows: (Array.isArray(p.intakes) && p.intakes.length > 0) || (Array.isArray(p.outcomes) && p.outcomes.length > 0),
          rawMaterial: rawMaterialLabel,
          rawMaterialId: p.rawMaterialId,
          rawMaterialIds: intakes.map((i: any) => String(i.rawMaterialId)),
          intakeQuantity: totalIn,
          finishedProduct: finishedProductLabel,
          finishedProductId: p.finishedProductId,
          finishedProductIds: outcomes.map((o: any) => String(o.finishedProductId)),
          outcomeQuantity: totalOut,
        };
      });
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

  const computeRowWastage = (p: any) => {
    if (p.hasStructuredRows) {
      const totalBatchRawSqM = (p.intakes || []).reduce((sum: number, bp: any) => {
        if (Number(bp.sqM || 0) > 0) return sum + Number(bp.sqM);
        const rm = rawMaterials.find((r: any) => r.id === bp.rawMaterialId) || bp.rawMaterial;
        const sqMPerRoll = Number(rm?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
        return sum + Number(bp.intakeQuantity || 0) * sqMPerRoll;
      }, 0);

      const outcomes = p.outcomes || [];
      const totalOutcomeSqM = outcomes.reduce((sum: number, o: any) => {
        const prod = products.find((pr: any) => pr.id === o.finishedProductId) || o.finishedProduct;
        return sum + Number(o.outcomeQuantity || 0) * Number(prod?.sqM || 0);
      }, 0);

      const batchOutcome = p.outcomeQuantity || 0;
      const singleProd =
        outcomes.length === 1
          ? products.find((pr: any) => pr.id === outcomes[0].finishedProductId) || outcomes[0].finishedProduct
          : null;
      const singleProdSqM = Number(singleProd?.sqM || 0);

      if (!p.completed && batchOutcome <= 0) {
        return { batchOutcome, displayWastage: '-', wastagePercentage: '-', wastageNum: 0 };
      }

      if (singleProd && singleProdSqM > 0) {
        const theoreticalYield = totalBatchRawSqM / singleProdSqM;
        const maxWastage = Math.max(0, theoreticalYield - batchOutcome);
        const pct = theoreticalYield > 0 ? ((maxWastage / theoreticalYield) * 100).toFixed(2) + '%' : '-';
        return { batchOutcome, displayWastage: maxWastage.toFixed(2), wastagePercentage: pct, wastageNum: maxWastage };
      }

      const wastageSqM = totalBatchRawSqM > 0 ? Math.max(0, totalBatchRawSqM - totalOutcomeSqM) : 0;
      const pct = totalBatchRawSqM > 0 ? ((wastageSqM / totalBatchRawSqM) * 100).toFixed(2) + '%' : '-';
      return {
        batchOutcome,
        displayWastage: totalBatchRawSqM > 0 ? `${wastageSqM.toFixed(2)} m²` : '-',
        wastagePercentage: pct,
        wastageNum: wastageSqM,
        totalBatchRawSqM,
        totalOutcomeSqM,
        wastageSqM,
      };
    }

    // Legacy single-row grouping fallback
    const batchRows = productions.filter((bp: any) => !bp.hasStructuredRows && bp.workName === p.workName && bp.finishedProductId === p.finishedProductId);
    const totalBatchRawSqM = batchRows.reduce((sum: number, bp: any) => {
      const rm = rawMaterials.find((r: any) => r.id === bp.rawMaterialId);
      const sqMPerRoll = Number(rm?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
      return sum + (bp.intakeQuantity * sqMPerRoll);
    }, 0);
    const prod = products.find((prod: any) => prod.id === p.finishedProductId);
    const productSqM = Number(prod?.sqM || 0);
    const batchOutcome = batchRows.find((bp: any) => bp.outcomeQuantity > 0)?.outcomeQuantity || p.outcomeQuantity;
    const totalTheoreticalYield = productSqM > 0 ? (totalBatchRawSqM / productSqM) : 0;
    let displayWastage = '-';
    let wastagePercentage = '-';
    let wastageNum = 0;
    if (batchOutcome && batchOutcome > 0) {
      const wastage = totalTheoreticalYield > 0 ? (totalTheoreticalYield - batchOutcome) : 0;
      wastageNum = Math.max(0, wastage);
      displayWastage = wastageNum.toFixed(2);
      if (totalTheoreticalYield > 0) {
        wastagePercentage = ((wastageNum / totalTheoreticalYield) * 100).toFixed(2) + '%';
      }
    }
    const totalOutcomeSqM = (Number(batchOutcome) || 0) * productSqM;
    const wastageSqM = totalBatchRawSqM > 0 ? Math.max(0, totalBatchRawSqM - totalOutcomeSqM) : 0;
    return {
      batchOutcome,
      displayWastage,
      wastagePercentage,
      wastageNum,
      totalBatchRawSqM,
      totalOutcomeSqM,
      wastageSqM,
    };
  };

  const filteredProductions = productions.filter((p: any) => {
    if (fromDate && p.date < fromDate) return false;
    if (toDate && p.date > toDate) return false;
    if (workName && p.workName !== workName) return false;
    if (filterRmId && !(p.rawMaterialIds || []).includes(filterRmId)) return false;
    if (filterProductId && !(p.finishedProductIds || []).includes(filterProductId)) return false;
    if (filterStatus === 'pending' && p.completed) return false;
    if (filterStatus === 'completed' && !p.completed) return false;

    if (!quickSearch) return true;
    const term = quickSearch.toLowerCase();
    return (
      p.batchCode.toLowerCase().includes(term) ||
      p.displayWorkName.toLowerCase().includes(term) ||
      p.workName.toLowerCase().includes(term) ||
      p.rawMaterial.toLowerCase().includes(term) ||
      p.finishedProduct.toLowerCase().includes(term) ||
      p.statusLabel.toLowerCase().includes(term)
    );
  });

  const reportRows = filteredProductions.flatMap((p: any, prodIdx: number) => {
    const entries = Array.isArray(p.outcomeEntries) && p.outcomeEntries.length > 0
      ? p.outcomeEntries
      : [{ key: `fallback-${p.id}`, finishedProduct: { name: p.finishedProduct }, outcomeQuantity: p.outcomeQuantity, date: p.date }];
    const { displayWastage, wastagePercentage } = computeRowWastage(p);
    const wastageDisplay = displayWastage !== '-' && wastagePercentage !== '-' ? `${displayWastage} (${wastagePercentage})` : '-';

    return entries.map((entry: any, entryIdx: number) => {
      const isPrimaryRow = entryIdx === 0;
      const entryDate = new Date(entry.date || p.date).toISOString().split('T')[0];
      return {
        rowKey: `${p.id}-${entry.key || entryIdx}`,
        id: p.id,
        sNo: isPrimaryRow ? String(prodIdx + 1) : `${prodIdx + 1}.${entryIdx + 1}`,
        isPrimaryRow,
        date: entryDate,
        completedDate: p.completedDate,
        batchCode: p.batchCode,
        displayWorkName: p.displayWorkName,
        statusLabel: p.statusLabel,
        completed: p.completed,
        rawMaterial: p.rawMaterial,
        intakeQuantityDisplay: isPrimaryRow ? String(p.intakeQuantity) : '-',
        intakeQuantityNum: isPrimaryRow ? Number(p.intakeQuantity || 0) : 0,
        productName: entry.finishedProduct?.name || '-',
        outcomeQuantity: Number(entry.outcomeQuantity || 0),
        displayWastage: isPrimaryRow ? displayWastage : '-',
        wastagePercentage: isPrimaryRow ? wastagePercentage : '-',
        wastageDisplay: isPrimaryRow ? wastageDisplay : '-',
      };
    });
  });

  const entriesPerPage = 25;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(reportRows.length / entriesPerPage);
  const paginatedRows = reportRows.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  let totalProduced = 0;
  let totalWastage = 0;

  const processedBatches = new Set();

  filteredProductions.forEach((p: any) => {
    const key = p.hasStructuredRows ? `id-${p.id}` : p.workName;
    if (processedBatches.has(key)) return;
    const { batchOutcome, totalOutcomeSqM = 0, wastageSqM = 0 } = computeRowWastage(p);
    if (batchOutcome > 0) {
      if (totalOutcomeSqM > 0) {
        totalProduced += totalOutcomeSqM;
        totalWastage += wastageSqM;
      } else {
        totalProduced += batchOutcome;
      }
      processedBatches.add(key);
    }
  });

  const pieData = [
    { name: 'Produced (m²)', value: parseFloat(totalProduced.toFixed(2)) },
    { name: 'Wastage (m²)', value: parseFloat(totalWastage.toFixed(2)) }
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

      {/* Mobile Quick Bar */}
      <div className="md:hidden flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex gap-2 flex-1">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-1/2 px-2 py-1.5 border border-[#CBD5E1] rounded text-[12px] font-bold text-black"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-1/2 px-2 py-1.5 border border-[#CBD5E1] rounded text-[12px] font-bold text-black"
          />
        </div>
        <button
          onClick={() => setIsFilterOpen(true)}
          className="flex items-center gap-1 shrink-0 bg-[#1E3A8A] text-white px-3 py-1.5 rounded text-[12px] font-bold"
        >
          <Filter size={16} />
        </button>
      </div>

      {isFilterOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
          onClick={() => setIsFilterOpen(false)}
        />
      )}

      {/* Filter Section - Desktop Inline & Mobile Drawer */}
      <div
        className={`bg-white border border-[#E2E8F0] shadow-sm rounded-md mb-3 p-4 shrink-0 ${
          isFilterOpen
            ? 'fixed inset-y-0 right-0 w-[300px] sm:w-[340px] z-[9999] m-0 rounded-none rounded-l-xl overflow-y-auto shadow-2xl'
            : 'hidden md:block'
        }`}
      >
        <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0] mb-3 md:hidden">
          <h3 className="font-bold text-[15px] text-[#1E3A8A]">Production Filters</h3>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="p-1.5 bg-red-50 text-red-600 rounded-full"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 items-end mb-4">

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
            <label className="flex items-center gap-1 text-[12px] text-[#3B82F6] mb-1 font-bold"><Box size={12} /> Material (Name-Code-Batch)</label>
            <Select
              value={
                filterRmId
                  ? {
                      value: filterRmId,
                      label: formatRawMaterialLabel(rawMaterials.find((rm: any) => rm.id.toString() === filterRmId)) || 'Unknown',
                    }
                  : null
              }
              onChange={(selected: any) => setFilterRmId(selected ? selected.value : '')}
              options={rawMaterials.map((rm: any) => ({ value: rm.id.toString(), label: formatRawMaterialLabel(rm) }))}
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

          <div>
            <label className="flex items-center gap-1 text-[12px] text-[#64748B] mb-1 font-bold">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'completed')}
              className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[13px] text-[#334155] bg-white focus:border-[#3B82F6]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-2 border-t border-dashed border-[#E2E8F0] gap-3 md:gap-0">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                refetch();
                setIsFilterOpen(false);
              }}
              className="flex-1 md:flex-initial justify-center bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-1.5 rounded-md flex items-center gap-2 text-[13px] font-bold transition-colors"
            >
              <Search size={14} /> Apply Filter
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
                setToDate(new Date().toISOString().split('T')[0]);
                setWorkName('');
                setFilterRmId('');
                setFilterProductId('');
                setFilterStatus('all');
                setQuickSearch('');
                setIsFilterOpen(false);
              }}
              className="text-[#64748B] hover:text-[#334155] flex items-center gap-1 text-[13px] font-bold transition-colors"
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Report Layout Wrapper */}
      <div className="flex flex-col xl:flex-row gap-4 flex-1 overflow-y-auto xl:overflow-hidden min-h-0">

        {/* Report Table Section */}
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-md overflow-hidden flex flex-col flex-1 min-w-0 xl:w-3/4">
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 sm:px-4 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 text-[#64748B] shrink-0">
              <FileText size={16} />
              <h2 className="font-bold text-[13px] tracking-wide">PRODUCTION REPORT</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
              <div className="relative flex-1 min-w-[180px] lg:max-w-xs">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Quick search batch, work, material..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded outline-none text-[12px] focus:border-[#3B82F6]"
                />
              </div>
              <button type="button"
                onClick={() => {
                  const totalIntake = reportRows.reduce((sum: number, r: any) => sum + (Number(r.intakeQuantityNum) || 0), 0);
                  const totalProducedSum = reportRows.reduce((sum: number, r: any) => sum + (Number(r.outcomeQuantity) || 0), 0);
                  const exportData = reportRows.map((r: any) => ({
                    'S.No': r.sNo,
                    'Date': r.date,
                    'Batch Code': r.batchCode,
                    'Work Name': r.displayWorkName,
                    'Status': r.statusLabel,
                    'Material (Name-Code-Batch)': r.rawMaterial,
                    'Intake Qty': r.intakeQuantityDisplay,
                    'Product (Outcome)': r.productName,
                    'Produced Qty': r.outcomeQuantity,
                    'Wastage': r.wastageDisplay,
                  }));
                  exportData.push({
                    'S.No': '',
                    'Date': '',
                    'Batch Code': '',
                    'Work Name': '',
                    'Status': '',
                    'Material (Name-Code-Batch)': 'TOTAL:',
                    'Intake Qty': String(totalIntake),
                    'Product (Outcome)': 'TOTAL:',
                    'Produced Qty': totalProducedSum,
                    'Wastage': '',
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
                  const totalIntake = reportRows.reduce((sum: number, r: any) => sum + (Number(r.intakeQuantityNum) || 0), 0);
                  const totalProducedSum = reportRows.reduce((sum: number, r: any) => sum + (Number(r.outcomeQuantity) || 0), 0);
                  const cols: PdfColumn[] = [
                    { header: 'S.No', dataKey: 'sNo' },
                    { header: 'Date', dataKey: 'date' },
                    { header: 'Batch Code', dataKey: 'batchCode' },
                    { header: 'Work Name', dataKey: 'displayWorkName' },
                    { header: 'Status', dataKey: 'statusLabel' },
                    { header: 'Material (Name-Code-Batch)', dataKey: 'rawMaterial' },
                    { header: 'Intake Qty', dataKey: 'intakeQuantityDisplay' },
                    { header: 'Product (Outcome)', dataKey: 'productName' },
                    { header: 'Produced Qty', dataKey: 'outcomeQuantity' },
                    { header: 'Wastage', dataKey: 'wastageDisplay' },
                  ];
                  const pdfData = [...reportRows, {
                    sNo: '',
                    date: '',
                    batchCode: '',
                    displayWorkName: '',
                    statusLabel: '',
                    rawMaterial: 'TOTAL:',
                    intakeQuantityDisplay: totalIntake.toString(),
                    productName: 'TOTAL:',
                    outcomeQuantity: totalProducedSum.toString(),
                    wastageDisplay: '',
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
                <Plus size={14} /> <span className="hidden sm:inline">New Entry</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <div className="p-6 text-center text-gray-500 font-bold">Loading production records...</div>
              ) : reportRows.length === 0 ? (
                <div className="text-center p-6 text-gray-500">No production records found.</div>
              ) : (
                paginatedRows.map((r: any) => (
                    <div key={r.rowKey} className={`p-3.5 hover:bg-[#F8FAFC] ${r.isPrimaryRow ? 'bg-white' : 'bg-blue-50/20'}`}>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-gray-500">#{r.sNo}</span>
                            <span className="font-bold text-black text-[11px]">{r.batchCode}</span>
                            {r.batchCode !== '-' && <span className="text-gray-400">·</span>}
                            <span className="font-black text-[#1E3A8A] text-[13px]">{r.displayWorkName}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                              {r.statusLabel}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 block mt-0.5">
                            {r.date}{r.completedDate !== '-' ? ` • Completed: ${r.completedDate}` : ''}
                          </span>
                        </div>
                        {r.isPrimaryRow && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 shrink-0">
                            Wastage: {r.wastageDisplay}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-[12px] mb-2 border border-slate-100">
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold block uppercase">Raw Material</span>
                          <span className="font-bold text-[#B91C1C] block text-[13px]">{r.rawMaterial}</span>
                          <span className="text-[11px] font-medium text-gray-600">Intake: {r.intakeQuantityDisplay}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold block uppercase">Finished Output</span>
                          <span className="font-bold text-[#15803D] block text-[13px]">{r.productName}</span>
                          <span className="text-[11px] font-medium text-gray-600">Produced: {r.outcomeQuantity}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setViewId(r.id)}
                          className="flex items-center gap-1 text-[11px] font-bold text-[#3B82F6] bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded"
                        >
                          <Eye size={13} /> View Details
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Desktop Table View */}
            <table className="hidden md:table w-full min-w-max text-left text-[12px] whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#0F172A] text-white font-bold">
                  <th className="px-3.5 py-3 border-r border-[#1E293B] text-center">S.No</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B]">Date</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B]">Batch Code</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B]">Work Name</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B] text-center">Status</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B]">Material (Name-Code-Batch)</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B] text-right">Intake Qty</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B]">Product (Outcome)</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B] text-right">Produced Qty</th>
                  <th className="px-3.5 py-3 border-r border-[#1E293B] text-right">Wastage Qty (%)</th>
                  <th className="px-3.5 py-3 border-[#1E293B] text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableLoader columns={11} />
                ) : reportRows.length === 0 ? (
                  <tr><td colSpan={11} className="text-center p-6 text-gray-500">No production records found.</td></tr>
                ) : (
                  paginatedRows.map((r: any, index: number) => (
                    <tr
                      key={r.rowKey}
                      className={`border-b border-[#E2E8F0] ${
                        r.isPrimaryRow ? (index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]') : 'bg-blue-50/20'
                      } hover:bg-[#EFF6FF]`}
                    >
                      <td className="px-3.5 py-3 border-r border-[#E2E8F0] text-center text-[#64748B] font-bold">{r.sNo}</td>
                      <td className="px-3.5 py-3 border-r border-[#E2E8F0] text-[#475569]">{r.date}</td>
                      <td className="px-3.5 py-3 border-r border-[#E2E8F0] text-[11px] font-bold text-black">{r.batchCode}</td>
                      <td className="px-3.5 py-3 border-r border-[#E2E8F0] font-bold text-[#1E293B]">{r.displayWorkName}</td>
                      <td className="px-3.5 py-3 border-r border-[#E2E8F0] text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${r.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                          {r.statusLabel}
                        </span>
                      </td>
                      <td className={`px-4 py-3 border-r border-[#E2E8F0] font-medium ${r.isPrimaryRow ? 'text-[#B91C1C]' : 'text-gray-500'}`}>{r.rawMaterial}</td>
                      <td className={`px-4 py-3 border-r border-[#E2E8F0] text-right font-bold ${r.isPrimaryRow ? 'text-[#B91C1C]' : 'text-gray-400'}`}>{r.intakeQuantityDisplay}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] font-medium text-[#15803D]">{r.productName}</td>
                      <td className={`px-4 py-3 border-r border-[#E2E8F0] text-right font-bold ${r.outcomeQuantity < 0 ? 'text-amber-600' : 'text-[#15803D]'}`}>{r.outcomeQuantity}</td>
                      <td className="px-4 py-3 border-r border-[#E2E8F0] text-right font-bold text-orange-600">
                        {r.wastageDisplay}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setViewId(r.id)}
                          className="p-1.5 bg-[#EBF5FF] text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white rounded transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
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
              totalEntries={reportRows.length}
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
                <div className="w-full h-[230px] sm:h-[260px] xl:flex-1 min-h-[220px]">
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
                </div>
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
