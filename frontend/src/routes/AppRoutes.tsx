import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import Login from '../pages/auth/Login';
import Dashboard from '../pages/dashboard/Dashboard';
import QuickStart from '../pages/QuickStart';
import ProtectedRoute from '../components/ProtectedRoute';
import UpiRedirect from '../pages/UpiRedirect';

// Master
import Products from '../pages/master/Products';
import Brands from '../pages/master/Brands';
import Categories from '../pages/master/Categories';
import Suppliers from '../pages/master/Suppliers';
import Customers from '../pages/master/Customers';
import Units from '../pages/master/Units';
import PaymentModes from '../pages/master/PaymentModes';
import PaymentTypes from '../pages/master/PaymentTypes';
import ExpenseCategories from '../pages/master/ExpenseCategories';
import Users from '../pages/master/Users';
import Taxes from '../pages/master/Taxes';
import MenuPermissions from '../pages/master/MenuPermissions';

// Purchase
import PurchaseList from '../pages/purchase/PurchaseList';
import PurchaseEntry from '../pages/purchase/PurchaseEntry';
import PurchaseView from '../pages/purchase/PurchaseView';
import SupplierPayments from '../pages/purchase/SupplierPayments';
import PurchaseReturn from '../pages/purchase/PurchaseReturn';

// Sales
import SalesList from '../pages/sales/SalesList';
import POS from '../pages/sales/POS';
import Estimation from '../pages/sales/Estimation';
import EstimationList from '../pages/sales/EstimationList';
import SalesHistory from '../pages/sales/SalesHistory';
import SalesView from '../pages/sales/SalesView';
import CustomerReceipts from '../pages/sales/CustomerReceipts';
import SalesReturn from '../pages/sales/SalesReturn';

// Raw Materials & Production
import RawMaterialMaster from '../pages/raw-materials/RawMaterialMaster';
import RawMaterialPurchaseEntry from '../pages/raw-materials/RawMaterialPurchaseEntry';
import RawMaterialPurchaseList from '../pages/raw-materials/RawMaterialPurchaseList';
import Production from '../pages/production/Production';
import ManufacturingProducts from '../pages/production/ManufacturingProducts';

// Inventory
import Stock from '../pages/inventory/Stock';
import StockLedger from '../pages/inventory/StockLedger';
import StockAdjustment from '../pages/inventory/StockAdjustment';

// Expenses
import ExpenseList from '../pages/expenses/ExpenseList';
import ExpenseEntry from '../pages/expenses/ExpenseEntry';

// Reports
import SalesReport from '../pages/reports/SalesReport';
import SalesReturnReport from '../pages/reports/SalesReturnReport';
import PurchaseReport from '../pages/reports/PurchaseReport';
import PurchaseReturnReport from '../pages/reports/PurchaseReturnReport';
import EstimationReport from '../pages/reports/EstimationReport';
import StockReport from '../pages/reports/StockReport';
import StockLedgerReport from '../pages/reports/StockLedgerReport';
import ExpenseReport from '../pages/reports/ExpenseReport';
import ProfitLossReport from '../pages/reports/ProfitLossReport';
import RawMaterialPurchaseReport from '../pages/reports/RawMaterialPurchaseReport';
import ProductionReport from '../pages/reports/ProductionReport';
import BatchPnlReport from '../pages/reports/BatchPnlReport';
import ServiceSalesReport from '../pages/reports/ServiceSalesReport';
import CustomerReceiptsReport from '../pages/reports/CustomerReceiptsReport';
import SupplierPaymentsReport from '../pages/reports/SupplierPaymentsReport';
import ProductWiseSalesReport from '../pages/reports/ProductWiseSalesReport';

// Services
import ServiceItems from '../pages/services/ServiceItems';
import ServiceSalesEntry from '../pages/services/ServiceSalesEntry';
import ServiceSalesList from '../pages/services/ServiceSalesList';

// Settings
import Settings from '../pages/Settings';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>
      
      {/* Payment Redirect (Public) */}
      <Route path="/pay" element={<UpiRedirect />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/quick-start" element={<QuickStart />} />
        
        {/* Master Routes */}
        <Route element={<ProtectedRoute requiredPerms="master_products" />}><Route path="/master/products" element={<Products />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_brands" />}><Route path="/master/brands" element={<Brands />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_categories" />}><Route path="/master/categories" element={<Categories />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_suppliers" />}><Route path="/master/suppliers" element={<Suppliers />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_customers" />}><Route path="/master/customers" element={<Customers />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_units" />}><Route path="/master/units" element={<Units />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_payment_modes" />}><Route path="/master/payment-modes" element={<PaymentModes />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_payment_types" />}><Route path="/master/payment-types" element={<PaymentTypes />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_expense_categories" />}><Route path="/master/expense-categories" element={<ExpenseCategories />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="master_users" />}>
          <Route path="/master/users" element={<Users />} />
          <Route path="/master/permissions" element={<MenuPermissions />} />
        </Route>
        <Route path="/master/taxes" element={<Taxes />} /> {/* Tax GST doesn't seem to have a specific perm in MainLayout, just settings.enableTax */}

        {/* Purchase Routes */}
        <Route element={<ProtectedRoute requiredPerms={['purchase_entry', 'purchase_list', 'purchase_return', 'purchase_payments']} />}><Route path="/purchase" element={<PurchaseList />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="purchase_entry" />}><Route path="/purchase/new" element={<PurchaseEntry />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="purchase_payments" />}><Route path="/purchase/payments" element={<SupplierPayments />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="purchase_return" />}><Route path="/purchase/return" element={<PurchaseReturn />} /></Route>
        <Route element={<ProtectedRoute requiredPerms={['purchase_entry', 'purchase_return', 'purchase_payments']} />}><Route path="/purchase/:id" element={<PurchaseView />} /></Route>

        {/* Sales Routes */}
        <Route element={<ProtectedRoute requiredPerms={['sales_pos', 'sales_return', 'sales_receipts']} />}><Route path="/sales" element={<SalesList />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="sales_pos" />}><Route path="/sales/pos" element={<POS />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="sales_estimation" />}><Route path="/sales/estimation" element={<Estimation />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="sales_estimation" />}><Route path="/sales/estimation-list" element={<EstimationList />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="sales_receipts" />}><Route path="/sales/receipts" element={<CustomerReceipts />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="sales_return" />}><Route path="/sales/return" element={<SalesReturn />} /></Route>
        <Route element={<ProtectedRoute requiredPerms={['sales_pos', 'sales_return', 'sales_receipts']} />}><Route path="/sales/history" element={<SalesHistory />} /></Route>
        <Route element={<ProtectedRoute requiredPerms={['sales_pos', 'sales_return', 'sales_receipts']} />}><Route path="/sales/:id" element={<SalesView />} /></Route>

        {/* Inventory Routes (accessible to master_products or mfg_product_master typically, or all) */}
        <Route element={<ProtectedRoute requiredPerms="reports_financial" />}><Route path="/inventory/stock" element={<Stock />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_financial" />}><Route path="/inventory/ledger" element={<StockLedger />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_financial" />}><Route path="/inventory/adjustment" element={<StockAdjustment />} /></Route>

        {/* Expense Routes */}
        <Route element={<ProtectedRoute requiredPerms="expenses_entry" />}><Route path="/expenses" element={<ExpenseList />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="expenses_entry" />}><Route path="/expenses/new" element={<ExpenseEntry />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="expenses_entry" />}><Route path="/expenses/history" element={<ExpenseList />} /></Route>

        {/* Report Routes */}
        <Route element={<ProtectedRoute requiredPerms="reports_sales" />}><Route path="/reports/sales" element={<SalesReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_sales_return" />}><Route path="/reports/sales-return" element={<SalesReturnReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_estimations" />}><Route path="/reports/estimations" element={<EstimationReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_purchase" />}><Route path="/reports/purchase" element={<PurchaseReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_purchase_return" />}><Route path="/reports/purchase-return" element={<PurchaseReturnReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_stock" />}><Route path="/reports/stock" element={<StockReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_profit_ledger" />}><Route path="/reports/profit-ledger" element={<ProfitLossReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_profit_ledger" />}><Route path="/reports/expenses" element={<ExpenseReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_stock" />}><Route path="/reports/stock-ledger" element={<StockLedgerReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_rm_purchase" />}><Route path="/reports/raw-material-purchase" element={<RawMaterialPurchaseReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_production" />}><Route path="/reports/production" element={<ProductionReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_batch_pnl" />}><Route path="/reports/batch-pnl" element={<BatchPnlReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms={['reports_sales', 'reports_product_wise_sales']} />}><Route path="/reports/product-wise-sales" element={<ProductWiseSalesReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_customer_receipts" />}><Route path="/reports/customer-receipts" element={<CustomerReceiptsReport />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="reports_supplier_payments" />}><Route path="/reports/supplier-payments" element={<SupplierPaymentsReport />} /></Route>
        <Route path="/reports/service-sales" element={<ServiceSalesReport />} />

        {/* Service Module Routes */}
        <Route path="/services/items" element={<ServiceItems />} />
        <Route path="/services/sales" element={<ServiceSalesEntry />} />
        <Route path="/services/sales-list" element={<ServiceSalesList />} />

        {/* Manufacturing & Raw Materials */}
        <Route element={<ProtectedRoute requiredPerms="mfg_rm_master" />}><Route path="/raw-materials/master" element={<RawMaterialMaster />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="mfg_rm_purchase" />}><Route path="/raw-materials/purchase" element={<RawMaterialPurchaseEntry />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="mfg_rm_purchase" />}><Route path="/raw-materials/purchase-list" element={<RawMaterialPurchaseList />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="mfg_production" />}><Route path="/production" element={<Production />} /></Route>
        <Route element={<ProtectedRoute requiredPerms="mfg_product_master" />}><Route path="/production/products" element={<ManufacturingProducts />} /></Route>

        {/* Settings */}
        <Route element={<ProtectedRoute requiredPerms="master_store_settings" />}><Route path="/settings" element={<Settings />} /></Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
