import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';

interface Props {
  purchaseId: number;
  onClose: () => void;
}

export default function ViewPurchaseModal({ purchaseId, onClose }: Props) {
  const { settings, formatCurrency } = useSettings();
  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', purchaseId],
    queryFn: async () => (await api.get(`/purchases/${purchaseId}`)).data
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white p-6 rounded-md shadow-lg font-bold text-[#1E3A8A]">Loading invoice details...</div>
      </div>
    );
  }

  if (!purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-md shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#3B82F6] text-white px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-[15px]">Purchase Invoice Details - {purchase.invoiceNo}</h2>
          <button onClick={onClose} className="hover:bg-blue-600 p-1 rounded transition-colors"><X size={18} /></button>
        </div>
        
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-[12px] text-gray-500 uppercase tracking-wider font-bold mb-1">Supplier Info</p>
              <p className="font-bold text-[#1E3A8A] text-[15px]">{purchase.supplier?.name}</p>
              {purchase.supplier?.phone && <p className="text-[13px] text-gray-600">{purchase.supplier.phone}</p>}
              {purchase.supplier?.email && <p className="text-[13px] text-gray-600">{purchase.supplier.email}</p>}
              {purchase.supplier?.address && <p className="text-[13px] text-gray-600 mt-1 whitespace-pre-wrap">{purchase.supplier.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-[12px] text-gray-500 uppercase tracking-wider font-bold mb-1">Invoice Info</p>
              <p className="font-bold text-[#333] text-[14px]">Date: <span className="font-normal">{new Date(purchase.date).toLocaleDateString()}</span></p>
              {purchase.supplierInvoiceNo && (
                <p className="font-bold text-[#333] text-[14px] mt-1">Supp. Inv. No: <span className="font-normal">{purchase.supplierInvoiceNo}</span></p>
              )}
              <p className={`font-bold text-[14px] inline-block px-2.5 py-0.5 rounded ${
                purchase.paymentMode?.name?.toLowerCase() === 'credit'
                  ? 'bg-rose-500 text-white'
                  : 'bg-[#22C55E] text-white'
              }`}>{purchase.paymentMode?.name?.toUpperCase() || 'PAID'}</p>
            </div>
          </div>
          
          <table className="w-full text-left text-[13px] border border-gray-200 mb-6 rounded overflow-hidden whitespace-nowrap">
            <thead className="bg-[#F3F4F6] text-[#374151]">
              <tr>
                <th className="px-3 py-2.5 border border-gray-300">#</th>
                <th className="px-3 py-2.5 border border-gray-300">Product</th>
                <th className="px-3 py-2.5 border border-gray-300 text-right">Qty</th>
                <th className="px-3 py-2.5 border border-gray-300 text-right">Rate</th>
                <th className="px-3 py-2.5 border border-gray-300 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map((item: any, i: number) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border border-gray-300">{i + 1}</td>
                  <td className="px-3 py-2 border border-gray-300 font-medium text-[#111827]">
                    {item.product?.name}
                    <span className="block text-[11px] text-gray-500 font-normal">Code: {item.product?.code}</span>
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-right font-bold text-[#3B82F6]">{item.quantity}</td>
                  <td className="px-3 py-2 border border-gray-300 text-right">{formatCurrency(item.rate)}</td>
                  <td className="px-3 py-2 border border-gray-300 text-right font-bold">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="flex justify-end">
            <div className="w-72 bg-[#F9FAFB] p-4 rounded border border-gray-200">
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-gray-600 font-medium">Subtotal</span>
                <span className="font-bold text-[#111827]">{formatCurrency(purchase.subtotal)}</span>
              </div>
              {settings?.enableTax && (
                (() => {
                  if (Number(purchase.tax) === 0) {
                    return (
                      <div className="flex justify-between py-1 text-[13px]">
                        <span className="text-gray-600 font-medium">Tax</span>
                        <span className="font-bold text-[#111827]">{formatCurrency(0)}</span>
                      </div>
                    );
                  }

                  const storeState = (settings.state || '').trim().toLowerCase();
                  const supplierState = (purchase.supplier?.state || '').trim().toLowerCase();
                  
                  if (storeState && supplierState && storeState === supplierState) {
                    const splitTax = Number(purchase.tax) / 2;
                    return (
                      <>
                        <div className="flex justify-between py-1 text-[13px]">
                          <span className="text-gray-600 font-medium">CGST</span>
                          <span className="font-bold text-[#111827]">{formatCurrency(splitTax)}</span>
                        </div>
                        <div className="flex justify-between py-1 text-[13px]">
                          <span className="text-gray-600 font-medium">SGST</span>
                          <span className="font-bold text-[#111827]">{formatCurrency(splitTax)}</span>
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <div className="flex justify-between py-1 text-[13px]">
                        <span className="text-gray-600 font-medium">IGST</span>
                        <span className="font-bold text-[#111827]">{formatCurrency(purchase.tax)}</span>
                      </div>
                    );
                  }
                })()
              )}
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-gray-600 font-medium">Discount</span>
                <span className="font-bold text-red-500">-{formatCurrency(purchase.discount)}</span>
              </div>
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-gray-600 font-medium">Transport Chg.</span>
                <span className="font-bold text-[#F59E0B]">{formatCurrency(purchase.transportCharge || 0)}</span>
              </div>
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-gray-600 font-medium">Wages</span>
                <span className="font-bold text-[#F59E0B]">{formatCurrency(purchase.wages || 0)}</span>
              </div>
              <div className="flex justify-between py-3 mt-2 border-t border-gray-300 text-[16px] font-bold">
                <span className="text-[#1E3A8A]">Grand Total</span>
                <span className="text-[#1E3A8A]">{formatCurrency(purchase.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-100 border-t border-gray-200 px-5 py-3 flex justify-end">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded text-[13px] font-bold transition-colors">
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
