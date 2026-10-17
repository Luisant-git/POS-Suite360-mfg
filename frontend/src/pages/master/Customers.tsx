import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, CheckCircle, Users, Grid, Maximize, Minimize, Search, Eye, DollarSign, Plus, X } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import api from '../../services/api';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { useSettings } from '../../contexts/SettingsContext';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import CustomerViewModal from '../../components/CustomerViewModal';
import CustomerRatesModal from '../../components/CustomerRatesModal';
import { useNavigate } from 'react-router-dom';

const indianStates = [
  "01 - Jammu & Kashmir", "02 - Himachal Pradesh", "03 - Punjab", "04 - Chandigarh",
  "05 - Uttarakhand", "06 - Haryana", "07 - Delhi", "08 - Rajasthan", "09 - Uttar Pradesh",
  "10 - Bihar", "11 - Sikkim", "12 - Arunachal Pradesh", "13 - Nagaland", "14 - Manipur",
  "15 - Mizoram", "16 - Tripura", "17 - Meghalaya", "18 - Assam", "19 - West Bengal",
  "20 - Jharkhand", "21 - Odisha", "22 - Chhattisgarh", "23 - Madhya Pradesh", "24 - Gujarat",
  "25 - Daman & Diu", "26 - Dadra & Nagar Haveli", "27 - Maharashtra", "29 - Karnataka",
  "30 - Goa", "31 - Lakshadweep", "32 - Kerala", "33 - Tamil Nadu", "34 - Puducherry",
  "35 - Andaman & Nicobar Islands", "36 - Telangana", "37 - Andhra Pradesh", "38 - Ladakh"
];

const customerSchema = z.object({
  name: z.string().min(1, 'Customer Name is required'),
  contactPerson: z.string().optional(),
  phone: z.string().min(1, 'Mobile Number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(), // Billing Address
  state: z.string().min(1, 'State is required'),
  gstNumber: z.string().optional(),
  shippingAddress: z.string().optional(),
  openingBalance: z.coerce.number().default(0),
  openingBalanceType: z.string().default('Dr'),
  creditLimit: z.coerce.number().default(0),
  creditDays: z.coerce.number().default(30),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const Customers = () => {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [itemToView, setItemToView] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);
  const [selectedCustomerForRates, setSelectedCustomerForRates] = useState<any>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const { formatCurrency, settings } = useSettings();

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema) as any,
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      state: '',
      gstNumber: '',
      shippingAddress: '',
      openingBalance: '' as any,
      openingBalanceType: 'Dr',
      creditLimit: '' as any,
      creditDays: '' as any,
    }
  });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data
  });

  const filteredCustomers = customers.filter((c: any) => {
    if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase()) && !c.phone?.includes(searchTerm)) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      if (editingId) {
        return api.patch(`/customers/${editingId}`, data);
      }
      return api.post('/customers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(editingId ? 'Customer updated successfully!' : 'Customer added successfully!');
      reset();
      setEditingId(null);
      setIsMobileDrawerOpen(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to save customer.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted successfully');
      setItemToDelete(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('Failed to delete customer. It may be in use.');
      setItemToDelete(null);
    }
  });

  const onSubmit = (data: CustomerFormValues) => {
    mutation.mutate(data);
  };

  const handleAddNew = () => {
    setIsFullTable(false);
    setEditingId(null);
    reset({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      state: '',
      gstNumber: '',
      shippingAddress: '',
      openingBalance: 0,
      openingBalanceType: 'Dr',
      creditLimit: 0,
      creditDays: 30,
    });
    setIsMobileDrawerOpen(true);
  };

  const onFormError = (errors: any) => {
    console.error(errors);
    toast.error('Please fill all required fields correctly.');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSubmit(onSubmit as any, onFormError)();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, onSubmit]);

  const handleEdit = (customer: any) => {
    setIsFullTable(false);
    setEditingId(customer.id);
    setValue('name', customer.name);
    setValue('contactPerson', customer.contactPerson || '');
    setValue('phone', customer.phone || '');
    setValue('email', customer.email || '');
    setValue('address', customer.address || '');
    setValue('state', customer.state || '');
    setValue('gstNumber', customer.gstNumber || '');
    setValue('shippingAddress', customer.shippingAddress || '');
    setValue('openingBalance', Number(customer.openingBalance));
    setValue('openingBalanceType', customer.openingBalanceType || 'Dr');
    setValue('creditLimit', Number(customer.creditLimit));
    setValue('creditDays', Number(customer.creditDays));
    setIsMobileDrawerOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (e.key === 'Escape' && !isInput) {
        if (isMobileDrawerOpen) {
          setIsMobileDrawerOpen(false);
        } else if (typeof itemToDelete !== 'undefined' && itemToDelete) {
          setItemToDelete(null);
        } else if (isLeaveModalOpen) {
          setIsLeaveModalOpen(false);
        } else {
          setIsLeaveModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [typeof itemToDelete !== 'undefined' ? itemToDelete : null, isLeaveModalOpen, isMobileDrawerOpen, navigate]);

  return (
    <div className="bg-transparent h-[calc(100vh-6rem)] grid grid-cols-1 xl:grid-cols-3 gap-4">

      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div 
          className="xl:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => { setIsMobileDrawerOpen(false); setEditingId(null); reset(); }}
        />
      )}

      {/* Left Column: Form (Desktop: Inline Column, Mobile: Slide-over Right Drawer) */}
      {!isFullTable && (
        <div className={`
          bg-white border border-[#E6E9ED] shadow-sm rounded-sm flex flex-col h-full overflow-hidden
          xl:col-span-1 xl:static xl:z-auto xl:h-full xl:max-w-none xl:shadow-sm xl:rounded-sm xl:flex xl:flex-col
          ${isMobileDrawerOpen 
            ? 'fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200' 
            : 'hidden xl:flex'
          }
        `}>
          <div className="bg-[#EBF5FF] border-b border-[#3B82F6] px-4 py-2 flex items-center justify-between rounded-t-sm shrink-0">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#1E3A8A]" />
              <h2 className="font-bold text-[14px] text-[#1E3A8A] uppercase">{editingId ? 'EDIT CUSTOMER' : 'CUSTOMER MASTER FORM'}</h2>
            </div>
            <button
              type="button"
              onClick={() => { setIsMobileDrawerOpen(false); setEditingId(null); reset(); }}
              className="xl:hidden p-1 rounded hover:bg-blue-100 text-[#1E3A8A]"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit as any, onFormError)} className="p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">

            <div>
              <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Customer Name *</label>
              <input
                {...register('name')}
                type="text"
                placeholder="Enter customer name"
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
              />
              {errors.name && <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">Contact Person</label>
                <input
                  {...register('contactPerson')}
                  type="text"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Mobile Number *</label>
                <input
                  {...register('phone')}
                  type="text"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
                />
                {errors.phone && <span className="text-red-500 text-xs mt-1 block">{errors.phone.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">Email Address</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">GST Number</label>
                <input
                  {...register('gstNumber')}
                  type="text"
                  placeholder="e.g. 33AABCG1234K1Z8"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">Billing Address</label>
                <textarea
                  {...register('address')}
                  rows={3}
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] resize-none"
                ></textarea>
              </div>
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">Shipping Address</label>
                <textarea
                  {...register('shippingAddress')}
                  rows={3}
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] resize-none"
                ></textarea>
              </div>
            </div>

            <div className="z-50 relative">
              <label className="block text-[12px] font-bold text-[#2563EB] mb-1">State (Searchable) *</label>
              <Controller
                name="state"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={[
                      { value: '', label: 'Type state name / code...' },
                      ...indianStates.map((s) => ({ value: s, label: s }))
                    ]}
                    value={field.value ? { value: field.value, label: field.value } : null}
                    onChange={(val: any) => field.onChange(val?.value || '')}
                    className="text-[13px] font-medium"
                    placeholder="Select..."
                    styles={{
                      control: (base: any) => ({
                        ...base,
                        minHeight: '38px',
                        borderColor: '#CBD5E1',
                        borderRadius: '0.25rem',
                      }),
                      singleValue: (base: any) => ({
                        ...base,
                        color: '#000000',
                        fontWeight: 'bold',
                      }),
                      input: (base: any) => ({
                        ...base,
                        color: '#000000',
                      }),
                      option: (base: any, state: any) => ({
                        ...base,
                        color: state.isSelected ? '#ffffff' : '#000000',
                        backgroundColor: state.isSelected ? '#3B82F6' : base.backgroundColor,
                      })
                    }}
                  />
                )}
              />
              {errors.state && <span className="text-red-500 text-xs mt-1 block">{errors.state.message}</span>}
            </div>

            <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-3 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[12px] text-[#1F2937] mb-1">Opening Bal</label>
                  <input
                    {...register('openingBalance')}
                    type="number"
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[#1F2937] mb-1">Balance Type</label>
                  <select
                    {...register('openingBalanceType')}
                    className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-white"
                  >
                    <option value="Dr">Debit (Receivable)</option>
                    <option value="Cr">Credit (Payable)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[#1F2937] mb-1">Credit Limit</label>
                  <input
                    {...register('creditLimit')}
                    type="number"
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[#1F2937] mb-1">Credit Days</label>
                  <input
                    {...register('creditDays')}
                    type="number"
                    placeholder="30"
                    className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 mt-2 transition-colors"
            >
              <CheckCircle size={16} />
              {editingId ? 'UPDATE CUSTOMER' : 'SAVE CUSTOMER (F10)'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => { reset(); setEditingId(null); setIsMobileDrawerOpen(false); }}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 rounded flex justify-center items-center gap-2 transition-colors"
              >
                CANCEL EDIT
              </button>
            )}
          </form>
        </div>
      )}

      {/* Right Column: List */}
      <div className={`${isFullTable ? 'xl:col-span-3' : 'xl:col-span-2'} bg-white border border-[#E6E9ED] shadow-sm rounded-sm overflow-hidden flex flex-col h-full`}>
        <div className="bg-[#EBF5FF] border-b border-[#3B82F6] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2 text-[#1E3A8A]">
              <Grid size={16} className="text-[#1E3A8A]" />
              <h2 className="font-bold text-[14px]">CUSTOMER LIST</h2>
            </div>
            <div className="md:hidden bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredCustomers.length} Customers
            </div>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="hidden md:block bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredCustomers.length} Customers
            </div>
            <div className="flex flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search customer by name or phone..."
                  className="pl-7 pr-3 py-1 border border-[#ccc] rounded text-[12px] w-full md:w-64 outline-none focus:border-[#3B82F6]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddNew}
                className="xl:hidden whitespace-nowrap bg-[#16A34A] hover:bg-[#15803D] text-white px-2.5 py-1 rounded text-[12px] font-bold flex items-center gap-1 shadow-sm transition-colors"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
              <button type="button"
                onClick={() => setIsFullTable(!isFullTable)}
                className="hidden xl:flex whitespace-nowrap text-[#3B82F6] hover:bg-white px-2 py-1 rounded text-[12px] font-bold items-center justify-center gap-1 transition-colors border border-[#3B82F6]"
              >
                {isFullTable ? <Minimize size={14} /> : <Maximize size={14} />}
                <span>{isFullTable ? 'Show Form' : 'View Full Table'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap min-w-[800px]">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2.5 border-r border-[#444] text-center w-8">#</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Customer Name</th>
                <th className="px-3 py-2.5 border-r border-[#444] text-center">Mobile</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Billing Address</th>
                <th className="px-3 py-2.5 border-r border-[#444] text-right">Opening Bal</th>
                <th className="px-3 py-2.5 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center p-4">Loading...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-4">No customers found.</td></tr>
              ) : (
                filteredCustomers.map((customer: any, index: number) => (
                  <tr key={customer.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'} hover:bg-blue-50`}>
                    <td data-label="#" className="px-3 py-3 border-r border-[#E5E7EB] text-center font-bold text-black font-bold">{index + 1}</td>
                    <td data-label="Customer Name" className="px-3 py-3 border-r border-[#E5E7EB] font-bold text-[#3B82F6]">{customer.name}</td>
                    <td data-label="Mobile" className="px-3 py-3 border-r border-[#E5E7EB] text-center font-bold text-black font-bold">{customer.phone || '-'}</td>
                    <td data-label="Billing Address" className="px-3 py-3 border-r border-[#E5E7EB] text-black font-bold truncate max-w-[200px]">{customer.address || '-'}</td>
                    <td data-label="Opening Bal" className="px-3 py-3 border-r border-[#E5E7EB] text-right font-bold text-black font-bold">
                      {formatCurrency(customer.openingBalance)} ({customer.openingBalanceType})
                    </td>
                    <td data-label="Actions" className="px-3 py-3 text-center">
                      <div className="flex justify-center items-center gap-1.5">
                        {(settings?.enableCustomerWiseRate || (settings as any)?.enableCustomerRates) && (
                          <button type="button"
                            onClick={() => setSelectedCustomerForRates(customer)}
                            className="text-[#059669] border border-[#059669] rounded px-1.5 py-1 hover:bg-[#059669] hover:text-white transition-colors text-[11px] font-bold flex items-center gap-1"
                            title="Fix Product Rates"
                          >
                            <DollarSign size={12} /> Rates
                          </button>
                        )}
                        <button type="button"
                          onClick={() => setItemToView(customer)}
                          className="text-[#10B981] border border-[#10B981] rounded p-1 hover:bg-[#10B981] hover:text-white transition-colors"
                          title="View Customer"
                        >
                          <Eye size={12} />
                        </button>
                        <button type="button"
                          onClick={() => handleEdit(customer)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                          title="Edit Customer"
                        >
                          <Edit size={12} />
                        </button>
                        <button type="button"
                          onClick={() => {
                            setItemToDelete(customer);
                          }}
                          className="text-[#EF4444] border border-[#EF4444] rounded p-1 hover:bg-[#EF4444] hover:text-white transition-colors"
                          title="Delete Customer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!itemToDelete}
        itemName={itemToDelete?.name}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (itemToDelete) {
            deleteMutation.mutate(itemToDelete.id);
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />

      <LeaveConfirmModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={() => navigate('/dashboard')}
      />

      <CustomerViewModal
        isOpen={!!itemToView}
        onClose={() => setItemToView(null)}
        customer={itemToView}
      />

      {/* Customer Fixed Rates Modal */}
      {selectedCustomerForRates && (
        <CustomerRatesModal
          customer={selectedCustomerForRates}
          onClose={() => setSelectedCustomerForRates(null)}
        />
      )}
    </div>
  );
};
export default Customers;
