import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, Printer, Filter, PieChart as PieChartIcon, Loader2 } from 'lucide-react';
import { format, startOfMonth, startOfYear } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import ReportTabs from '../../components/ReportTabs';
import { exportToExcel } from '../../utils/exportExcel';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';

const ProfitLossReport = () => {
  const { formatCurrency, settings } = useSettings();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activePreset, setActivePreset] = useState<string>('month');

  const { data: pnl, isLoading, refetch } = useQuery({
    queryKey: ['profitLoss', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/profit-loss', {
        params: { fromDate, toDate }
      });
      return res.data;
    }
  });

  const handleDatePreset = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    setToDate(format(today, 'yyyy-MM-dd'));

    if (preset === 'today') {
      setFromDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'month') {
      setFromDate(format(startOfMonth(today), 'yyyy-MM-dd'));
    } else if (preset === 'year') {
      setFromDate(format(startOfYear(today), 'yyyy-MM-dd'));
    } else if (preset === 'all') {
      setFromDate('2000-01-01');
    }
    setTimeout(() => refetch(), 50);
  };

  const handleCustomDateChange = (isStart: boolean, val: string) => {
    setActivePreset('custom');
    if (isStart) setFromDate(val);
    else setToDate(val);
  };

  if (!pnl && !isLoading) return <div className="p-4">Failed to load data.</div>;

  const safePnl = pnl || {
    grossSales: 0,
    totalSalesReturns: 0,
    netOperatingRevenue: 0,
    grossPurchases: 0,
    totalPurchaseReturns: 0,
    netCogs: 0,
    grossProfit: 0,
    itemizedExpenses: [],
    totalExpenses: 0,
    netProfit: 0,
  };

  const chartData = pnl ? [
    { name: 'Gross Sales', value: safePnl.grossSales, color: '#2563EB' },
    { name: 'Sales Returns', value: safePnl.totalSalesReturns, color: '#93C5FD' },
    { name: 'Purchases', value: safePnl.grossPurchases, color: '#D97706' },
    { name: 'Purchase Returns', value: safePnl.totalPurchaseReturns, color: '#FCD34D' },
    { name: 'Operating Expenses', value: safePnl.totalExpenses, color: '#EF4444' },
  ] : [];

  const barData = pnl ? [
    { name: 'Revenue', amount: safePnl.netOperatingRevenue, fill: '#2563EB' },
    { name: 'COGS', amount: safePnl.netCogs, fill: '#D97706' },
    { name: 'Expenses', amount: safePnl.totalExpenses, fill: '#EF4444' },
    { name: 'Net Profit', amount: safePnl.netProfit, fill: safePnl.netProfit >= 0 ? '#10B981' : '#EF4444' },
  ] : [];

  const isLoss = safePnl.netProfit < 0;
  const grossProfitMargin = safePnl.netOperatingRevenue > 0 ? (safePnl.grossProfit / safePnl.netOperatingRevenue) * 100 : 0;
  const netProfitMargin = safePnl.netOperatingRevenue > 0 ? (safePnl.netProfit / safePnl.netOperatingRevenue) * 100 : 0;

  const presetBtnClass = (preset: string) =>
    `px-2 py-0.5 text-[11px] rounded transition-colors shadow-sm font-bold ${activePreset === preset ? 'bg-[#1F2937] text-white shadow-md' : 'text-gray-700 hover:bg-white bg-transparent'}`;

  return (
    <div className="bg-[#F8FAFC] absolute inset-0 p-3 md:p-4 flex flex-col overflow-y-auto lg:overflow-hidden print:relative print:h-auto print:bg-white print:p-0 print:block">
      <div className="print:hidden shrink-0">
        <ReportTabs />
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2 md:p-3 rounded shadow-sm border border-gray-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-2 shrink-0 print:hidden">
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3 xl:gap-4 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1 w-full sm:w-auto mb-1 sm:mb-0">
              <PieChartIcon size={14} /> P&L Statement Period:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleCustomDateChange(true, e.target.value)}
                className="border border-gray-300 rounded px-2 py-0.5 text-[12px] font-bold w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleCustomDateChange(false, e.target.value)}
                className="border border-gray-300 rounded px-2 py-0.5 text-[12px] font-bold w-full"
              />
            </div>
            <button
              onClick={() => refetch()}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 py-1 rounded flex items-center justify-center gap-1 font-bold text-[12px] transition-colors shadow-sm w-full sm:w-auto mt-2 sm:mt-0"
            >
              <Filter size={14} /> Calculate
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap bg-gray-100 p-1 rounded border border-gray-200 gap-1 items-center w-full lg:w-auto">
            <button onClick={() => handleDatePreset('today')} className={presetBtnClass('today')}>Today</button>
            <button onClick={() => handleDatePreset('month')} className={presetBtnClass('month')}>This Month</button>
            <button onClick={() => handleDatePreset('year')} className={presetBtnClass('year')}>This Year</button>
            <button onClick={() => handleDatePreset('all')} className={presetBtnClass('all')}>All Time</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end mt-2 lg:mt-0">
          <button
            onClick={() => {
              const exportData = [
                { 'Particulars': 'I. OPERATING REVENUE', 'Amount': '' },
                { 'Particulars': 'Gross Sales', 'Amount': safePnl.grossSales },
                { 'Particulars': 'Sales Returns', 'Amount': -safePnl.totalSalesReturns },
                { 'Particulars': 'NET OPERATING REVENUE', 'Amount': safePnl.netOperatingRevenue },
                { 'Particulars': '', 'Amount': '' },
                { 'Particulars': 'II. COST OF GOODS SOLD', 'Amount': '' },
                { 'Particulars': 'Add: Gross Purchases', 'Amount': safePnl.grossPurchases },
                { 'Particulars': 'Less: Purchase Returns', 'Amount': -safePnl.totalPurchaseReturns },
                { 'Particulars': 'NET COST OF GOODS SOLD', 'Amount': safePnl.netCogs },
                { 'Particulars': 'GROSS PROFIT', 'Amount': safePnl.grossProfit },
                { 'Particulars': '', 'Amount': '' },
                { 'Particulars': 'III. OPERATING EXPENSES', 'Amount': '' },
                { 'Particulars': 'TOTAL OPERATING EXPENSES', 'Amount': safePnl.totalExpenses },
                { 'Particulars': '', 'Amount': '' },
                { 'Particulars': 'NET PROFIT FOR PERIOD', 'Amount': safePnl.netProfit }
              ];
              exportToExcel(exportData, `PNL_Statement_${fromDate || 'all'}_to_${toDate || 'all'}`, {
                shopName: settings?.shopName || 'MY SHOP',
                title: `Profit & Loss Statement (${fromDate || 'All Time'} to ${toDate || 'All Time'})`,
              });
            }}
            className="bg-[#10B981] hover:bg-[#059669] text-white px-2.5 py-1.5 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors shadow-sm"
          >
            <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
          </button>
          <button
            onClick={() => {
              const cols: PdfColumn[] = [
                { header: 'Particulars', dataKey: 'label' },
                { header: 'Amount', dataKey: 'value' },
              ];
              const rows = [
                { label: 'I. OPERATING REVENUE', value: '' },
                { label: 'Gross Sales', value: formatCurrency(safePnl.grossSales) },
                { label: 'Sales Returns', value: `-${formatCurrency(safePnl.totalSalesReturns)}` },
                { label: 'NET OPERATING REVENUE', value: formatCurrency(safePnl.netOperatingRevenue) },
                { label: '', value: '' },
                { label: 'II. COST OF GOODS SOLD', value: '' },
                { label: 'Add: Gross Purchases', value: formatCurrency(safePnl.grossPurchases) },
                { label: 'Less: Purchase Returns', value: `-${formatCurrency(safePnl.totalPurchaseReturns)}` },
                { label: 'NET COST OF GOODS SOLD', value: formatCurrency(safePnl.netCogs) },
                { label: 'GROSS PROFIT', value: formatCurrency(safePnl.grossProfit) },
                { label: '', value: '' },
                { label: 'III. OPERATING EXPENSES', value: '' },
                { label: 'TOTAL OPERATING EXPENSES', value: formatCurrency(safePnl.totalExpenses) },
                { label: '', value: '' },
                { label: 'NET PROFIT FOR PERIOD', value: formatCurrency(safePnl.netProfit) },
              ];
              exportTableToPdf(cols, rows, `PNL_${fromDate || 'all'}_to_${toDate || 'all'}`, `Profit & Loss Statement: ${fromDate || 'All Time'} to ${toDate || 'All Time'}`, settings?.shopName);
            }}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-2.5 py-1.5 rounded flex items-center justify-center gap-1.5 font-bold text-[12px] whitespace-nowrap transition-colors shadow-sm"
          >
            <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
          </button>
          <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 rounded flex items-center gap-1.5 font-bold text-[12px] transition-colors shadow-sm" onClick={() => window.print()}>
            <Printer size={14} /> <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 print:block">
        {/* Left Side: Ledger */}
        <div className="lg:col-span-8 bg-white rounded shadow-sm border border-gray-200 flex flex-col min-h-0 print:border-none print:shadow-none print:h-auto">
          {/* Header */}
          <div className="bg-[#1F2937] text-white px-4 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 shrink-0">
            <div>
              <h2 className="text-[15px] font-bold text-[#FBBF24] tracking-wide m-0 leading-tight">POS SUITE 360</h2>
              <p className="text-[10px] uppercase tracking-wider opacity-80 m-0 leading-tight">Statement of Profit and Loss (P&L Ledger)</p>
            </div>
            <div className="bg-[#F59E0B] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
              {fromDate} to {toDate}
            </div>
          </div>

          <div className="flex-1 flex flex-col px-4 py-1.5 font-sans text-[12px] overflow-y-auto">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
                <span className="font-bold">Loading P&L data...</span>
              </div>
            ) : (
              <>
                {/* 1. Operating Revenue */}
                <div className="flex justify-between font-bold text-[#1E3A8A] border-b border-gray-200 pb-1 mb-1 shrink-0">
                  <div className="flex items-center gap-2"><span>I. OPERATING REVENUE</span></div>
                  <div>AMOUNT</div>
                </div>

                <div className="flex justify-between py-1 text-gray-700 shrink-0">
                  <span>Gross Sales Revenue (Cash & Credit Sales)</span>
                  <div className="flex gap-4">
                    <span className="text-gray-400 text-[10px] w-20 text-right">Total Sales</span>
                    <span className="font-bold w-20 text-right">{formatCurrency(safePnl.grossSales)}</span>
                  </div>
                </div>

                <div className="flex justify-between py-1 text-[#EF4444] border-b border-gray-100 mb-1 shrink-0">
                  <span>Less: Sales Returns</span>
                  <div className="flex gap-4">
                    <span className="opacity-70 text-[10px] w-20 text-right">Returns</span>
                    <span className="font-bold w-20 text-right">- {formatCurrency(safePnl.totalSalesReturns)}</span>
                  </div>
                </div>

                <div className="flex justify-between py-1 text-[#2563EB] font-bold text-[13px] bg-blue-50/50 px-2 rounded mb-2 shrink-0">
                  <span>NET OPERATING REVENUE</span>
                  <span>{formatCurrency(safePnl.netOperatingRevenue)}</span>
                </div>

                {/* 2. COGS */}
                <div className="flex justify-between font-bold text-[#D97706] border-b border-gray-200 pb-1 mb-1 shrink-0">
                  <div className="flex items-center gap-2"><span>II. COST OF GOODS SOLD (COGS)</span></div>
                  <div>AMOUNT</div>
                </div>

                <div className="flex justify-between py-1 text-gray-700 shrink-0">
                  <span>Gross Purchases</span>
                  <div className="flex gap-4">
                    <span className="text-gray-400 text-[10px] w-20 text-right">Total Purchases</span>
                    <span className="font-bold w-20 text-right">{formatCurrency(safePnl.grossPurchases)}</span>
                  </div>
                </div>

                <div className="flex justify-between py-1 text-[#059669] border-b border-gray-100 mb-1 shrink-0">
                  <span>Less: Purchase Returns</span>
                  <div className="flex gap-4">
                    <span className="opacity-70 text-[10px] w-20 text-right">Returns</span>
                    <span className="font-bold w-20 text-right">- {formatCurrency(safePnl.totalPurchaseReturns)}</span>
                  </div>
                </div>

                <div className="flex justify-between py-1 font-bold text-[13px] px-2 mb-2 text-gray-800 bg-gray-50 rounded shrink-0">
                  <span>NET COST OF GOODS SOLD (COGS)</span>
                  <span>{formatCurrency(safePnl.netCogs)}</span>
                </div>

                <div className="flex justify-between py-1.5 text-black font-bold text-[14px] border-y-2 border-gray-200 mb-2 items-center px-2 shrink-0">
                  <span>GROSS PROFIT (NET REVENUE - COGS)</span>
                  <div className="flex flex-col items-end leading-tight">
                    <span>{formatCurrency(safePnl.grossProfit)}</span>
                    <span className="text-[10px] text-gray-400 font-normal">({grossProfitMargin.toFixed(1)}%)</span>
                  </div>
                </div>

                {/* 3. Operating Expenses */}
                <div className="flex justify-between font-bold text-[#4B5563] border-b border-gray-200 pb-1 mb-1 shrink-0">
                  <div className="flex items-center gap-2"><span>III. OPERATING EXPENSES (ITEMIZED)</span></div>
                  <div>AMOUNT</div>
                </div>

                {safePnl.itemizedExpenses.length === 0 ? (
                  <div className="py-1 text-gray-400 italic text-[11px] border-b border-gray-100 mb-1 shrink-0">
                    No operating expenses recorded for this period
                    <span className="float-right font-normal text-gray-400">{formatCurrency(0)}</span>
                  </div>
                ) : (
                  <div className="mb-1 border-b border-gray-100 pb-1 overflow-y-auto min-h-0">
                    {safePnl.itemizedExpenses.map((exp: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-0.5 text-gray-700 hover:bg-gray-50 px-2 rounded">
                        <span>{exp.name}</span>
                        <span className="font-bold text-gray-600">{formatCurrency(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between py-1 font-bold text-[13px] px-2 mt-auto text-gray-800 shrink-0">
                  <span>TOTAL OPERATING EXPENSES</span>
                  <span className="text-[#EF4444]">{formatCurrency(safePnl.totalExpenses)}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer - Net Profit */}
          <div className={`${isLoss ? 'bg-[#EF4444]' : 'bg-[#10B981]'} text-white px-4 py-3 sm:py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 shrink-0`}>
            <div>
              <h3 className="text-[15px] sm:text-[18px] font-bold tracking-wider m-0 leading-tight">NET {isLoss ? 'LOSS' : 'PROFIT'} FOR PERIOD</h3>
              <p className="text-[10px] opacity-90 m-0 leading-tight mt-0.5">Gross Profit less Operating Expenses</p>
            </div>
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[22px] font-bold">{formatCurrency(safePnl.netProfit)}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5">Margin: {netProfitMargin.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Right Side: Charts & Analytics */}
        <div className="lg:col-span-4 flex flex-col gap-3 min-h-0 print:hidden">

          <div className="bg-white p-3 rounded shadow-sm border border-gray-200 flex-1 flex flex-col min-h-0">
            <h3 className="text-[12px] font-bold text-[#1E3A8A] uppercase mb-2 flex items-center gap-1 shrink-0">
              <PieChartIcon size={14} /> Revenue vs Cost Breakdown
            </h3>
            <div className="flex-1 w-full relative min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {['today', 'month', 'custom'].includes(activePreset) ? (
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => `RS ${val}`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} formatter={(val) => formatCurrency(val as number)} contentStyle={{ fontSize: '11px', borderRadius: '4px' }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={chartData.filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Legend verticalAlign="bottom" height={24} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
              {safePnl.netOperatingRevenue === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-400 text-[11px] font-bold italic">
                  No data to display
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-3 rounded shadow-sm border border-gray-200 shrink-0">
            <h3 className="text-[12px] font-bold text-[#D97706] uppercase mb-2 flex items-center gap-1">
              Key Financial Ratios
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
                <p className="text-[10px] font-bold text-gray-500 mb-0.5">Gross Margin</p>
                <p className={`text-[18px] font-bold leading-none ${grossProfitMargin < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {grossProfitMargin.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
                <p className="text-[10px] font-bold text-gray-500 mb-0.5">Net Margin</p>
                <p className={`text-[18px] font-bold leading-none ${netProfitMargin < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {netProfitMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfitLossReport;
