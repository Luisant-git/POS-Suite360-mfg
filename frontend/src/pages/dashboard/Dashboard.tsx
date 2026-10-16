import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  ShoppingCart,
  TrendingDown,
  Package,
  RotateCcw,
  CreditCard,
  Wallet,
  Landmark,
  Users,
  Search,
  Clock
} from 'lucide-react';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';

const StatCard = ({ title, value, icon: Icon, colorClass, desc, layout = 'topbar' }: any) => {
  const strValue = String(value);
  let valueSizeClass = "text-2xl sm:text-3xl"; // Normal size

  if (layout === 'sidebar') {
    // Shrink slightly for sidebar layout because cards are narrower
    if (strValue.length > 14) {
      valueSizeClass = "text-base sm:text-lg tracking-tighter";
    } else if (strValue.length > 11) {
      valueSizeClass = "text-lg sm:text-xl tracking-tight";
    } else if (strValue.length > 9) {
      valueSizeClass = "text-xl sm:text-2xl tracking-tight";
    }
  } else {
    // Topbar layout has plenty of space, only shrink if gigantic
    if (strValue.length > 15) {
      valueSizeClass = "text-base sm:text-lg lg:text-xl tracking-tighter";
    } else if (strValue.length > 12) {
      valueSizeClass = "text-lg sm:text-xl lg:text-2xl tracking-tight";
    }
  }

  return (
    <div className="bg-white border border-[#E6E9ED] shadow-sm p-4 sm:p-5 relative flex items-center justify-between hover:shadow-md transition-shadow gap-3">
      <div className="min-w-0 flex-1">
        <h3 className={`${valueSizeClass} font-semibold text-gray-500 whitespace-nowrap`}>{value}</h3>
        <p className="text-[12px] sm:text-[13px] text-[#1F2937] font-semibold mt-1 uppercase tracking-wide leading-tight">{title}</p>
        {desc && <p className="text-[11px] sm:text-[12px] text-gray-400 font-medium mt-1 truncate">{desc}</p>}
      </div>
      <div className={`p-3 sm:p-4 ${colorClass} text-white flex-shrink-0 flex items-center justify-center shadow-inner rounded-xl`}>
        <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { desktopLayout } = useOutletContext<any>() || { desktopLayout: 'topbar' };
  const { formatCurrency } = useSettings();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStartDate, setFilterStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDateTime = `${currentDateTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        // Ensure api is imported correctly.
        const response = await api.get(`/dashboard/summary?startDate=${filterStartDate}&endDate=${filterEndDate}`);
        setData(response.data);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [filterStartDate, filterEndDate]);

  if (loading || !data) {
    return (
      <div className="bg-[#F3F5F8] min-h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-[#2563EB] border-blue-200 rounded-full animate-spin shadow-md"></div>
          <p className="text-[15px] font-semibold text-gray-600 tracking-wide">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = filterStartDate === todayStr && filterEndDate === todayStr;
  const prefix = isToday ? "Today's" : "Filtered";
  const descPrefix = isToday ? "Today's" : "Period";

  return (
    <div className="bg-[#F3F5F8] min-h-full pb-8">
      {/*
      Quick Launchpad for POS
      <div className="mb-8">
        <h2 className="text-[20px] font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Zap className="text-amber-500" /> Quick Launchpad
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <QuickAction 
            title="Sales Entry" 
            desc="Open POS Terminal" 
            icon={MonitorPlay} 
            to="/sales/pos" 
            colorClass="hover:border-blue-500 [&>div:first-child]:text-blue-600 [&>div:first-child]:bg-blue-50"
          />
          <QuickAction 
            title="Customer Receipts" 
            desc="Collect Payments" 
            icon={Wallet} 
            to="/sales/receipts" 
            colorClass="hover:border-emerald-500 [&>div:first-child]:text-emerald-600 [&>div:first-child]:bg-emerald-50"
          />
          <QuickAction 
            title="Purchase Entry" 
            desc="Record Inwards" 
            icon={Truck} 
            to="/purchase/new" 
            colorClass="hover:border-purple-500 [&>div:first-child]:text-purple-600 [&>div:first-child]:bg-purple-50"
          />
          <QuickAction 
            title="Supplier Payments" 
            desc="Pay Vendors" 
            icon={CreditCard} 
            to="/purchase/payments" 
            colorClass="hover:border-rose-500 [&>div:first-child]:text-rose-600 [&>div:first-child]:bg-rose-50"
          />
          <QuickAction 
            title="Products" 
            desc="Manage Inventory" 
            icon={Package} 
            to="/master/products" 
            colorClass="hover:border-amber-500 [&>div:first-child]:text-amber-600 [&>div:first-child]:bg-amber-50"
          />
          <QuickAction 
            title="Sales Report" 
            desc="View Analytics" 
            icon={BarChart3} 
            to="/reports/sales" 
            colorClass="hover:border-indigo-500 [&>div:first-child]:text-indigo-600 [&>div:first-child]:bg-indigo-50"
          />
        </div>
      </div>
      */}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 sm:gap-4">
        <div>
          <h1 className="text-[18px] sm:text-[20px] font-bold text-gray-800">Financial Overview</h1>
          <p className="text-[11px] sm:text-[12px] text-gray-500 font-medium">Daily business performance & ledger dues</p>
          <p className="text-[12px] sm:text-[13px] font-bold text-blue-600 mt-1 flex items-center gap-1.5">
            <Clock size={13} className="text-blue-600" /> {formattedDateTime}
          </p>
        </div>

        {/* Date Filter Bar - Same Row on Mobile with Icon-Only Reset like NASA */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-2 sm:px-2.5 py-1.5 sm:py-2 border border-gray-200 rounded-xl shadow-sm w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-gray-50/80 border border-gray-100 px-2 py-1.5 rounded-lg flex-1 sm:flex-none overflow-hidden">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider hidden sm:inline">From</span>
            <input 
              type="date" 
              value={filterStartDate} 
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="text-[12px] sm:text-[13px] font-bold text-black bg-transparent outline-none cursor-pointer w-full sm:w-auto"
            />
          </div>
          <span className="text-gray-300 font-bold">-</span>
          <div className="flex items-center gap-1.5 bg-gray-50/80 border border-gray-100 px-2 py-1.5 rounded-lg flex-1 sm:flex-none overflow-hidden">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider hidden sm:inline">To</span>
            <input 
              type="date" 
              value={filterEndDate} 
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="text-[12px] sm:text-[13px] font-bold text-black bg-transparent outline-none cursor-pointer w-full sm:w-auto"
            />
          </div>
          <button 
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              setFilterStartDate(today);
              setFilterEndDate(today);
            }}
            className={`flex items-center justify-center p-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-all duration-300 shrink-0 ${
              (filterStartDate !== todayStr || filterEndDate !== todayStr)
                ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Reset to Today"
          >
            <RotateCcw size={16} strokeWidth={2.5} className={`transition-transform duration-300 ${(filterStartDate !== todayStr || filterEndDate !== todayStr) ? '-rotate-180' : ''}`} />
            <span className="hidden sm:inline ml-1.5 text-[13px] font-bold">Reset</span>
          </button>
        </div>
      </div>
      
      {/* Top Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard layout={desktopLayout}
          title={`${prefix} Cash Sales`}
          value={formatCurrency(data.cashSalesToday)}
          desc={`${descPrefix} cash sales`}
          icon={Wallet}
          colorClass="bg-gradient-to-br from-emerald-400 to-emerald-600"
        />
        <StatCard layout={desktopLayout}
          title={`${prefix} Credit Sales`}
          value={formatCurrency(data.creditSalesToday)}
          desc={`${descPrefix} credit sales`}
          icon={CreditCard}
          colorClass="bg-gradient-to-br from-teal-400 to-teal-600"
        />
        <StatCard layout={desktopLayout}
          title={`${prefix} Cash Purchases`}
          value={formatCurrency(data.cashPurchasesToday)}
          desc={`${descPrefix} cash purchases`}
          icon={ShoppingCart}
          colorClass="bg-gradient-to-br from-blue-400 to-blue-600"
        />
        <StatCard layout={desktopLayout}
          title={`${prefix} Credit Purchases`}
          value={formatCurrency(data.creditPurchasesToday)}
          desc={`${descPrefix} credit purchases`}
          icon={CreditCard}
          colorClass="bg-gradient-to-br from-indigo-400 to-indigo-600"
        />
        <StatCard layout={desktopLayout}
          title={`Pending Payables`}
          value={formatCurrency(data.pendingPayables)}
          desc={`Amount owed to suppliers`}
          icon={Landmark}
          colorClass="bg-gradient-to-br from-rose-400 to-rose-600"
        />
        <StatCard layout={desktopLayout}
          title={`Pending Receivables`}
          value={formatCurrency(data.pendingReceivables)}
          desc={`Amount owed by customers`}
          icon={Users}
          colorClass="bg-gradient-to-br from-amber-400 to-amber-600"
        />
        <StatCard layout={desktopLayout}
          title={`${prefix} Expenses`}
          value={formatCurrency(data.expensesToday)}
          desc="Operational costs"
          icon={TrendingDown}
          colorClass="bg-gradient-to-br from-purple-400 to-purple-600"
        />
        <StatCard layout={desktopLayout}
          title="Products"
          value={data.productsCount.toLocaleString()}
          desc="Total items"
          icon={Package}
          colorClass="bg-gradient-to-br from-fuchsia-400 to-fuchsia-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Products */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden lg:col-span-1">
          <div className="border-b border-gray-100 px-5 py-4 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-[16px] font-semibold text-gray-800 flex items-center gap-2">
              <Package size={18} className="text-rose-500" /> Low Stock Alerts
            </h2>
          </div>
          <div className="p-0 h-[350px] overflow-y-auto custom-scrollbar bg-white">
            {data.lowStockProducts && data.lowStockProducts.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {data.lowStockProducts.map((product: any, idx: number) => (
                  <li key={idx} className="p-4 flex items-center justify-between hover:bg-rose-50/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                        <Package size={24} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-[14px]">{product.name}</p>
                        <p className="text-[12px] text-gray-500 font-medium mt-0.5">Min Stock: {product.minStock}</p>
                      </div>
                    </div>
                    <div className="font-semibold text-rose-500 bg-rose-100 px-3 py-1.5 rounded-lg text-[13px]">
                      {product.currentStock} left
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <Package size={32} className="text-gray-300" />
                </div>
                <p className="font-semibold text-[14px]">All stock levels are optimal</p>
              </div>
            )}
          </div>
        </div>

        {/* Supplier Payments Due */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden lg:col-span-1 flex flex-col">
          <div className="border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap justify-between items-center bg-gray-50/50 gap-2">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
              <Landmark size={18} className="text-rose-500 shrink-0" /> Supplier Payments Due
            </h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link 
                to="/reports/supplier-payments" 
                className="flex-1 sm:flex-none text-center px-3 py-1 bg-white border border-gray-200 text-gray-700 font-bold rounded-md hover:bg-gray-50 transition-colors text-[12px] shadow-sm"
              >
                View All
              </Link>
              <Link 
                to="/purchase/payments" 
                className="flex-1 sm:flex-none text-center px-3 py-1 bg-rose-50 text-rose-600 font-bold rounded-md hover:bg-rose-100 transition-colors text-[12px] border border-rose-100"
              >
                Settle
              </Link>
            </div>
          </div>
          {/* Supplier Search Bar */}
          <div className="px-3.5 py-2 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                placeholder="Search supplier or bill..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-[12px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-300 bg-gray-50 font-bold text-black"
              />
            </div>
          </div>
          <div className="flex-1 p-0 h-[350px] overflow-y-auto custom-scrollbar bg-white">
            <table className="w-full text-left text-[12px] whitespace-nowrap">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-bold text-[#334155]">Supplier / Bill</th>
                  <th className="px-4 py-2.5 font-bold text-[#059669] text-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.unpaidSupplierBills?.filter((bill: any) =>
                  !supplierSearch ||
                  bill.entityName?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                  bill.entryNo?.toLowerCase().includes(supplierSearch.toLowerCase())
                ).length > 0 ? (
                  data.unpaidSupplierBills.filter((bill: any) =>
                    !supplierSearch ||
                    bill.entityName?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                    bill.entryNo?.toLowerCase().includes(supplierSearch.toLowerCase())
                  ).map((bill: any, idx: number) => (
                    <tr key={idx} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-[#1E293B]">{bill.entityName}</div>
                        <div className="text-[#64748B] text-[11px] font-semibold mt-0.5">
                          {bill.entryNo} • {new Date(bill.date).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="font-bold text-[#059669]">{formatCurrency(bill.pending)}</div>
                        <div className="text-[#64748B] text-[11px] font-semibold mt-0.5">
                          Total: {formatCurrency(bill.total)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-gray-500 font-bold">
                      {supplierSearch ? 'No matching supplier bills found' : 'No pending supplier bills'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Payments Expected */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden lg:col-span-1 flex flex-col">
          <div className="border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap justify-between items-center bg-gray-50/50 gap-2">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
              <Users size={18} className="text-amber-500 shrink-0" /> Customer Payments Due
            </h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link 
                to="/reports/customer-receipts" 
                className="flex-1 sm:flex-none text-center px-3 py-1 bg-white border border-gray-200 text-gray-700 font-bold rounded-md hover:bg-gray-50 transition-colors text-[12px] shadow-sm"
              >
                View All
              </Link>
              <Link 
                to="/sales/receipts" 
                className="flex-1 sm:flex-none text-center px-3 py-1 bg-amber-50 text-amber-600 font-bold rounded-md hover:bg-amber-100 transition-colors text-[12px] border border-amber-100"
              >
                Collect
              </Link>
            </div>
          </div>
          {/* Customer Search Bar */}
          <div className="px-3.5 py-2 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                placeholder="Search customer or bill..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-[12px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-300 bg-gray-50 font-bold text-black"
              />
            </div>
          </div>
          <div className="flex-1 p-0 h-[350px] overflow-y-auto custom-scrollbar bg-white">
            <table className="w-full text-left text-[12px] whitespace-nowrap">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-bold text-[#334155]">Customer / Bill</th>
                  <th className="px-4 py-2.5 font-bold text-[#059669] text-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.unpaidCustomerBills?.filter((bill: any) =>
                  !customerSearch ||
                  bill.entityName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  bill.entryNo?.toLowerCase().includes(customerSearch.toLowerCase())
                ).length > 0 ? (
                  data.unpaidCustomerBills.filter((bill: any) =>
                    !customerSearch ||
                    bill.entityName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    bill.entryNo?.toLowerCase().includes(customerSearch.toLowerCase())
                  ).map((bill: any, idx: number) => (
                    <tr key={idx} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-[#1E293B]">{bill.entityName}</div>
                        <div className="text-[#64748B] text-[11px] font-semibold mt-0.5">
                          {bill.entryNo} • {new Date(bill.date).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="font-bold text-[#059669]">{formatCurrency(bill.pending)}</div>
                        <div className="text-[#64748B] text-[11px] font-semibold mt-0.5">
                          Total: {formatCurrency(bill.total)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-gray-500 font-bold">
                      {customerSearch ? 'No matching customer bills found' : 'No pending customer bills'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
