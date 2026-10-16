import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, 
  CornerDownLeft, 
  FileText, 
  Box, 
  PieChart, 
  Users, 
  Truck,
  Package,
  DollarSign
} from 'lucide-react';

const ReportTabs = () => {
  const location = useLocation();

  const tabs = [
    { name: 'Purchase Report', path: '/reports/purchase', icon: <ShoppingBag size={14} /> },
    { name: 'Purchase Return', path: '/reports/purchase-return', icon: <CornerDownLeft size={14} /> },
    { name: 'Sales Report', path: '/reports/sales', icon: <FileText size={14} /> },
    { name: 'Sales Return', path: '/reports/sales-return', icon: <CornerDownLeft size={14} /> },
    { name: 'Product & Supplier Wise Sales', path: '/reports/product-wise-sales', icon: <Package size={14} /> },
    { name: 'Customer Receipts & Dues', path: '/reports/customer-receipts', icon: <Users size={14} /> },
    { name: 'Supplier Payments & Payables', path: '/reports/supplier-payments', icon: <Truck size={14} /> },
    { name: 'Stock as on Date', path: '/reports/stock', icon: <Box size={14} /> },
    { name: 'Profit & Ledger', path: '/reports/profit-ledger', icon: <PieChart size={14} /> },
    { name: 'Expenses Report', path: '/reports/expenses', icon: <DollarSign size={14} /> },
    { name: 'Estimation Report', path: '/reports/estimations', icon: <FileText size={14} /> },
    { name: 'RM Purchase Report', path: '/reports/raw-material-purchase', icon: <Truck size={14} /> },
    { name: 'Production Report', path: '/reports/production', icon: <Box size={14} /> },
    { name: 'Batch P&L Report', path: '/reports/batch-pnl', icon: <PieChart size={14} /> },
  ];

  return (
    <div className="mb-2 sm:mb-3 overflow-x-auto pb-1 custom-scrollbar shrink-0">
      <div className="inline-flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-[#E2E8F0] shadow-sm">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'text-black font-bold hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ReportTabs;
