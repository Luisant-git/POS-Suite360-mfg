import { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

interface Settings {
  shopName: string;
  shopAddress: string;
  phone: string;
  email: string;
  currencySymbol: string;
  currencyPosition: string;
  invoicePrefix: string;
  invoiceTitle?: string;
  invoiceHeader?: string;
  invoiceNotes?: string;
  estimationNotes?: string;
  gstin?: string;
  signatureImage?: string;
  logoImage?: string;
  enableTax: boolean;
  taxType: string;
  enableCustomerWiseRate: boolean;
  enableCustomerRates?: boolean;
  city?: string;
  state?: string;
  country?: string;
  upiId?: string;
  estimationUpiId?: string;
  printFormat?: string;
  estimationStockMaintain?: boolean;
  enableService?: boolean;
  serviceInvoicePrefix?: string;
  servicePrintFormat?: string;
  enableUnifiedPOS?: boolean;
  enableInvoiceEdit?: boolean;
  invoiceEditDays?: number;
}

interface SettingsContextType {
  settings: Settings | null;
  isLoading: boolean;
  formatCurrency: (amount: number | string) => string;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  isLoading: true,
  formatCurrency: (amount: number | string) => `₹ ${Number(amount).toFixed(2)}`,
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  useLocation(); // Trigger re-render on route change (e.g., after login)
  const token = localStorage.getItem('token');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!token, // Now dynamically re-evaluates when route changes
  });

  const formatCurrency = useCallback((amount: number | string) => {
    const num = Number(amount) || 0;
    const formatted = num.toFixed(2);
    const symbol = settings?.currencySymbol || '₹';
    const position = settings?.currencyPosition || 'before';
    
    if (position === 'after') {
      return `${formatted} ${symbol}`;
    }
    return `${symbol} ${formatted}`;
  }, [settings?.currencySymbol, settings?.currencyPosition]);

  const value = useMemo(() => ({
    settings: settings || null,
    isLoading,
    formatCurrency
  }), [settings, isLoading, formatCurrency]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
