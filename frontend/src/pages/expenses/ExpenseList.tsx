import { getMalaysiaDateStr, formatMalaysiaDate } from '../../utils/date';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Plus, Filter, DollarSign, RefreshCw } from 'lucide-react';
import { exportTableToPdf, type PdfColumn } from '../../utils/exportPdf';
import { exportToExcel } from '../../utils/exportExcel';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import TableLoader from '../../components/TableLoader';

const ExpenseList = () => {
  const { formatCurrency, settings } = useSettings();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return getMalaysiaDateStr(d);
  });
  const [endDate, setEndDate] = useState(() => getMalaysiaDateStr());
  const [categoryId, setCategoryId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Expense Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['expenseCategories'],
    queryFn: async () => (await api.get('/expense-categories')).data
  });

  // Fetch Expenses List
  const { data: expenses = [], isLoading, refetch } = useQuery({
    queryKey: ['expensesList', startDate, endDate, categoryId, searchQuery],
    queryFn: async () => {
      const { data } = await api.get('/expenses', {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          categoryId: categoryId || undefined,
          search: searchQuery || undefined,
        }
      });
      return data;
    }
  });

  const totalExpenseAmount = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

  const handlePdfExport = () => {
    const cols: PdfColumn[] = [
      { header: 'S.No', dataKey: '_sno' },
      { header: 'Date', dataKey: '_date' },
      { header: 'Category', dataKey: '_category' },
      { header: 'Payment Mode', dataKey: '_mode' },
      { header: 'Notes', dataKey: '_notes' },
      { header: `Amount (${settings?.currency || 'RM'})`, dataKey: '_amount' },
    ];
    const rows = expenses.map((e: any, i: number) => ({
      _sno: i + 1,
      _date: formatMalaysiaDate(e.date),
      _category: e.category?.name || '-',
      _mode: e.paymentMode?.name || '-',
      _notes: e.notes || '-',
      _amount: Number(e.amount),
    }));
    exportTableToPdf(cols, rows, 'Expense_History', 'Expense History Report', settings?.shopName, rows.length);
  };

  const handleExcelExport = () => {
    const exportData = expenses.map((e: any, index: number) => ({
      'S.No': index + 1,
      'Date': formatMalaysiaDate(e.date),
      'Category': e.category?.name || '-',
      'Payment Mode': e.paymentMode?.name || '-',
      'Notes': e.notes || '-',
      [`Amount (${settings?.currency || 'RM'})`]: Number(e.amount),
    }));
    exportToExcel(exportData, 'Expense_History');
  };

  return (
    <div className="bg-[#F7F7F7] min-h-[calc(100vh-100px)] flex flex-col gap-4 p-3 sm:p-4 font-sans">
      
      {/* Top Header Card */}
      <div className="bg-white border border-[#CBD5E1] shadow-sm rounded-lg p-3 sm:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#EF4444] text-white p-2.5 rounded-lg shadow-sm">
            <DollarSign size={20} />
          </div>
          <div>
            <h1 className="font-bold text-[16px] text-[#1E3A8A] uppercase">EXPENSE HISTORY & ENTRY LIST</h1>
            <p className="text-xs text-black font-bold">View, filter, and export all recorded business expenses</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link 
            to="/expenses/new" 
            className="bg-[#16A34A] hover:bg-[#15803D] text-white text-[12px] font-bold px-3.5 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus size={16} /> <span>NEW EXPENSE ENTRY</span>
          </Link>
          <button 
            type="button" 
            onClick={handleExcelExport}
            className="bg-[#10B981] hover:bg-[#059669] text-white text-[12px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download size={14} /> <span className="hidden sm:inline">Export Excel</span>
          </button>
          <button 
            type="button" 
            onClick={handlePdfExport}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white text-[12px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Search Section */}
      <div className="bg-white border border-[#CBD5E1] shadow-sm rounded-lg p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-end">
          <div>
            <label className="block text-[11px] font-bold text-black mb-1">From Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-[12px] font-bold text-black outline-none focus:border-[#3B82F6] bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-black mb-1">To Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-[12px] font-bold text-black outline-none focus:border-[#3B82F6] bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-black mb-1">Category Filter</label>
            <SearchableSelect
              options={[{ value: '', label: 'All Categories' }, ...categories.map((c: any) => ({ value: c.id, label: c.name }))]}
              value={categoryId}
              onChange={(val) => setCategoryId(val || '')}
              placeholder="All Categories"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => refetch()}
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[12px] font-bold px-4 py-1.5 rounded flex items-center gap-1 transition-colors w-full justify-center shadow-sm"
            >
              <Filter size={14} /> Apply Filter
            </button>
            <button 
              type="button" 
              onClick={() => { setStartDate(''); setEndDate(''); setCategoryId(''); setSearchQuery(''); }}
              className="bg-gray-200 hover:bg-gray-300 text-black text-[12px] font-bold px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <RefreshCw size={12} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Expense List Table Container */}
      <div className="bg-white border border-[#CBD5E1] shadow-sm rounded-lg overflow-hidden flex flex-col flex-1">
        
        <div id="expense-list-export" className="p-3 sm:p-4 flex flex-col flex-1">
          
          <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-auto">
            <table className="w-full text-left text-[12px] whitespace-nowrap min-w-[700px] border-collapse">
              <thead>
                <tr className="bg-[#0f172a] text-white font-bold">
                  <th className="px-3 py-2.5 border-r border-[#334155] text-center w-12">#</th>
                  <th className="px-3 py-2.5 border-r border-[#334155]">Date</th>
                  <th className="px-3 py-2.5 border-r border-[#334155]">Category</th>
                  <th className="px-3 py-2.5 border-r border-[#334155]">Payment Mode</th>
                  <th className="px-3 py-2.5 border-r border-[#334155]">Notes / Description</th>
                  <th className="px-3 py-2.5 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableLoader columns={6} />
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-6 text-black font-bold">No expense transactions found.</td></tr>
                ) : (
                  expenses.map((e: any, index: number) => (
                    <tr key={e.id} className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-[#F9FAFB]' : 'bg-white'} hover:bg-blue-50 transition-colors`}>
                      <td className="px-3 py-2 border-r border-[#E2E8F0] text-center font-bold text-black">{index + 1}</td>
                      <td className="px-3 py-2 border-r border-[#E2E8F0] font-bold text-black">{formatMalaysiaDate(e.date)}</td>
                      <td className="px-3 py-2 border-r border-[#E2E8F0] font-bold text-[#16A34A]">{e.category?.name || '-'}</td>
                      <td className="px-3 py-2 border-r border-[#E2E8F0] text-black font-bold">{e.paymentMode?.name || '-'}</td>
                      <td className="px-3 py-2 border-r border-[#E2E8F0] text-black font-bold text-xs">{e.notes || '-'}</td>
                      <td className="px-3 py-2 text-right font-bold text-[#EF4444]">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Total Footer */}
          <div className="mt-3 pt-3 border-t-2 border-[#1E3A8A] flex justify-between items-center bg-[#F0F7FF] px-4 py-2.5 rounded">
            <span className="font-bold text-[13px] text-[#1E3A8A] uppercase">Total Expenses ({expenses.length} Records)</span>
            <span className="font-bold text-[15px] text-[#EF4444]">{formatCurrency(totalExpenseAmount)}</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExpenseList;
