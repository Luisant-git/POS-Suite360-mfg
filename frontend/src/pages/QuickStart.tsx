import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../utils/permissions';
import {
  ShoppingCart,
  TrendingDown,
  Package,
  Receipt,
  RotateCcw,
  Database,
  Tag,
  List,
  Truck,
  Users,
  Scale,
  CreditCard,
  ListOrdered,
  BarChart2,
  FileText,
  ArrowLeft,
  Tags
} from 'lucide-react';

const menuData = [
  {
    title: 'Master HUB',
    icon: Database,
    colorClass: 'hover:border-purple-500 [&>div]:text-purple-600 [&>div]:bg-purple-50',
    items: [
      { name: 'Products', path: '/master/products', icon: Package, authKey: 'master_products', colorClass: 'hover:border-blue-500 [&>div]:text-blue-600 [&>div]:bg-blue-50' },
      { name: 'Brands', path: '/master/brands', icon: Tag, authKey: 'master_brands', colorClass: 'hover:border-pink-500 [&>div]:text-pink-600 [&>div]:bg-pink-50' },
      { name: 'Categories', path: '/master/categories', icon: List, authKey: 'master_categories', colorClass: 'hover:border-indigo-500 [&>div]:text-indigo-600 [&>div]:bg-indigo-50' },
      { name: 'Suppliers', path: '/master/suppliers', icon: Truck, authKey: 'master_suppliers', colorClass: 'hover:border-emerald-500 [&>div]:text-emerald-600 [&>div]:bg-emerald-50' },
      { name: 'Customers', path: '/master/customers', icon: Users, authKey: 'master_customers', colorClass: 'hover:border-amber-500 [&>div]:text-amber-600 [&>div]:bg-amber-50' },
      { name: 'Units', path: '/master/units', icon: Scale, authKey: 'master_units', colorClass: 'hover:border-cyan-500 [&>div]:text-cyan-600 [&>div]:bg-cyan-50' },
      { name: 'Payment Modes', path: '/master/payment-modes', icon: CreditCard, authKey: 'master_payment_modes', colorClass: 'hover:border-violet-500 [&>div]:text-violet-600 [&>div]:bg-violet-50' },
      { name: 'Expense Categories', path: '/master/expense-categories', icon: Tags, authKey: 'master_expense_categories', colorClass: 'hover:border-rose-500 [&>div]:text-rose-600 [&>div]:bg-rose-50' },
    ]
  },
  {
    title: 'Purchase HUB',
    icon: ShoppingCart,
    colorClass: 'hover:border-emerald-500 [&>div]:text-emerald-600 [&>div]:bg-emerald-50',
    items: [
      { name: 'Purchase Entry', path: '/purchase/new', icon: ShoppingCart, authKey: 'purchase_entry' },
      { name: 'Purchase List', path: '/purchase', icon: ListOrdered, authKey: ['purchase_list', 'purchase_entry'] },
      { name: 'Purchase Return', path: '/purchase/return', icon: RotateCcw, authKey: 'purchase_return' },
      { name: 'Supplier Payments', path: '/purchase/payments', icon: CreditCard, authKey: 'purchase_payments' },
    ]
  },
  {
    title: 'Sales HUB',
    icon: Receipt,
    colorClass: 'hover:border-blue-500 [&>div]:text-blue-600 [&>div]:bg-blue-50',
    items: [
      { name: 'Sales Entry (POS)', path: '/sales/pos', icon: Receipt, authKey: 'sales_pos' },
      { name: 'Sales List', path: '/sales', icon: ListOrdered, authKey: 'sales_pos' },
      { name: 'Sales Return', path: '/sales/return', icon: RotateCcw, authKey: 'sales_return' },
      { name: 'Customer Receipts', path: '/sales/receipts', icon: CreditCard, authKey: 'sales_receipts' },
    ]
  },
  {
    title: 'Expenses',
    icon: TrendingDown,
    colorClass: 'hover:border-red-500 [&>div]:text-red-600 [&>div]:bg-red-50',
    items: [
      { name: 'Expense Entry', path: '/expenses/new', icon: TrendingDown, authKey: 'expenses_entry' },
    ]
  },
  {
    title: 'Reports HUB',
    icon: BarChart2,
    colorClass: 'hover:border-teal-500 [&>div]:text-teal-600 [&>div]:bg-teal-50',
    items: [
      { name: 'Purchase Report', path: '/reports/purchase', icon: FileText, authKey: 'reports_purchase' },
      { name: 'Purchase Return Report', path: '/reports/purchase-return', icon: FileText, authKey: 'reports_purchase_return' },
      { name: 'Sales Report', path: '/reports/sales', icon: FileText, authKey: 'reports_sales' },
      { name: 'Sales Return Report', path: '/reports/sales-return', icon: FileText, authKey: 'reports_sales_return' },
      { name: 'Stock As On Date', path: '/reports/stock', icon: FileText, authKey: 'reports_stock' },
      { name: 'Profit / Ledger', path: '/reports/profit-ledger', icon: FileText, authKey: 'reports_profit_ledger' },
    ]
  }
];

const QuickStart = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { hasPerm: checkPerm, hasAnyPerm } = usePermissions();

  const hasPerm = (perm?: string | string[]) => {
    if (!perm) return true;
    return Array.isArray(perm) ? hasAnyPerm(perm) : checkPerm(perm);
  };

  const filteredMenuData = menuData.map(cat => ({
    ...cat,
    items: cat.items.filter(item => hasPerm(item.authKey))
  })).filter(cat => cat.items.length > 0);

  const currentCategoryData = filteredMenuData.find(cat => cat.title === activeCategory);

  return (
    <div className="bg-[#F3F5F8] min-h-[calc(100vh-100px)] p-6">
      <div className="bg-white border border-gray-200 shadow-sm flex flex-col min-h-[400px] rounded-xl overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4 bg-white shrink-0 flex items-center gap-4">
          {activeCategory && (
            <button 
              onClick={() => setActiveCategory(null)}
              className="text-gray-500 hover:text-gray-800 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              title="Back to Categories"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="text-[20px] font-black text-gray-800">
            {activeCategory ? `Quick Links - ${activeCategory}` : 'Quick Links - App Launcher'}
          </h2>
        </div>
        
        <div className="p-8 flex-1 bg-[#F9FAFB]">
          {!activeCategory ? (
            // Show Main Categories
            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 content-start">
              {filteredMenuData.length === 0 ? (
                <div className="col-span-full text-center text-gray-500 py-12">
                  No quick links available based on your permissions.
                </div>
              ) : (
                filteredMenuData.map((category) => (
                  <button 
                    key={category.title}
                    onClick={() => setActiveCategory(category.title)} 
                    className={`group bg-white border border-gray-200 shadow-sm p-6 rounded-xl flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all transform hover:-translate-y-1 ${category.colorClass}`}
                  >
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gray-50 group-hover:bg-white group-hover:scale-110 transition-all shadow-sm text-gray-500">
                      <category.icon className="w-10 h-10" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-[18px] font-black text-gray-800">{category.title}</h3>
                      <p className="text-[12px] text-gray-500 font-medium mt-1 uppercase tracking-wider">{category.items.length} items</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            // Show Sub Items for Selected Category
            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 content-start animate-in fade-in zoom-in-95 duration-200">
              {currentCategoryData?.items.map((item: any) => {
                const colorClass = item.colorClass || currentCategoryData.colorClass;
                return (
                  <button 
                    key={item.name}
                    onClick={() => navigate(item.path)} 
                    className={`group bg-white border border-gray-200 shadow-sm p-6 rounded-xl flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all transform hover:-translate-y-1 ${colorClass}`}
                  >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gray-50 group-hover:bg-white group-hover:scale-110 transition-all shadow-sm text-gray-500">
                      <item.icon className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-[16px] font-black text-gray-800">{item.name}</h3>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickStart;
