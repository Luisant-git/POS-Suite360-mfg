import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, CheckCircle, Truck, Grid, Maximize, Minimize, Search, Eye } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import api from '../../services/api';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { useSettings } from '../../contexts/SettingsContext';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import SupplierViewModal from '../../components/SupplierViewModal';
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

const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier Name is required'),
  contactPerson: z.string().optional(),
  phone: z.string().min(1, 'Mobile No is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  state: z.string().min(1, 'State is required'),
  gstNumber: z.string().optional(),
  openingBalance: z.coerce.number().default(0),
  openingBalanceType: z.string().default('Cr'),
  accountNo: z.string().optional(),
  ifscCode: z.string().optional(),
  bankBranch: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

const Suppliers = () => {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [itemToView, setItemToView] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);
  const { formatCurrency } = useSettings();

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema) as any,
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      state: '',
      gstNumber: '',
      openingBalance: '' as any,
      openingBalanceType: 'Cr',
      accountNo: '',
      ifscCode: '',
      bankBranch: '',
    }
  });

  const { data: suppliers = [], isLoading } = useQuery({ 
    queryKey: ['suppliers'], 
    queryFn: async () => (await api.get('/suppliers')).data 
  });

  const filteredSuppliers = suppliers.filter((s: any) => {
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase()) && !s.phone?.includes(searchTerm)) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      if (editingId) {
        return api.patch(`/suppliers/${editingId}`, data);
      }
      return api.post('/suppliers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(editingId ? 'Supplier updated successfully!' : 'Supplier added successfully!');
      reset();
      setEditingId(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to save supplier.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier deleted successfully');
      setItemToDelete(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('Failed to delete supplier. It may be in use.');
      setItemToDelete(null);
    }
  });

  const onSubmit = (data: SupplierFormValues) => {
    mutation.mutate(data);
  };

  const onFormError = (errors: any) => {
    console.error(errors);
    toast.error('Please fill all mandatory fields correctly.');
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

  const handleEdit = (supplier: any) => {
    setIsFullTable(false);
    setEditingId(supplier.id);
    setValue('name', supplier.name);
    setValue('contactPerson', supplier.contactPerson || '');
    setValue('phone', supplier.phone || '');
    setValue('email', supplier.email || '');
    setValue('address', supplier.address || '');
    setValue('state', supplier.state || '');
    setValue('gstNumber', supplier.gstNumber || '');
    setValue('openingBalance', Number(supplier.openingBalance));
    setValue('openingBalanceType', supplier.openingBalanceType || 'Cr');
    setValue('accountNo', supplier.accountNo || '');
    setValue('ifscCode', supplier.ifscCode || '');
    setValue('bankBranch', supplier.bankBranch || '');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (e.key === 'Escape' && !isInput) {
        if (typeof itemToDelete !== 'undefined' && itemToDelete) {
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
  }, [typeof itemToDelete !== 'undefined' ? itemToDelete : null, isLeaveModalOpen, navigate]);

  return (
    <div className="bg-transparent h-[calc(100vh-6rem)] grid grid-cols-1 xl:grid-cols-3 gap-4">
      
      {/* Left Column: Form */}
      {!isFullTable && (
      <div className="xl:col-span-1 bg-white border border-[#E6E9ED] shadow-sm rounded-sm flex flex-col h-full overflow-hidden">
        <div className="bg-[#EBF5FF] border-b border-[#3B82F6] px-4 py-2 flex items-center gap-2 rounded-t-sm shrink-0">
          <Truck size={16} className="text-[#1E3A8A]" />
          <h2 className="font-bold text-[14px] text-[#1E3A8A]">SUPPLIER MASTER FORM</h2>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit as any, onFormError)} className="p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">
          
          <div>
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Supplier Name *</label>
            <input 
              {...register('name')}
              type="text" 
              placeholder="Enter Supplier / Company Name"
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
              <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Mobile No *</label>
              <input 
                {...register('phone')}
                type="text" 
                placeholder="10-digit mobile"
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

          <div>
            <label className="block text-[12px] text-[#1F2937] mb-1">Complete Address</label>
            <textarea 
              {...register('address')}
              rows={3}
              className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] resize-none"
            ></textarea>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <label className="block text-[12px] text-[#1F2937] mb-1">Type</label>
              <select 
                {...register('openingBalanceType')}
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-white"
              >
                <option value="Cr">Cr (Payable)</option>
                <option value="Dr">Dr (Receivable)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-[#1F2937] mb-1">Account No</label>
              <input 
                {...register('accountNo')}
                type="text" 
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#1F2937] mb-1">IFSC Code</label>
              <input 
                {...register('ifscCode')}
                type="text" 
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] text-[#1F2937] mb-1">Bank Branch</label>
            <input 
              {...register('bankBranch')}
              type="text" 
              className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
            />
          </div>

          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 mt-2 transition-colors"
          >
            <CheckCircle size={16} />
            {editingId ? 'UPDATE SUPPLIER' : 'SAVE SUPPLIER (F10)'}
          </button>
          
          {editingId && (
            <button 
              type="button" 
              onClick={() => { reset(); setEditingId(null); }}
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
        <div className="bg-[#f9f9f9] border-b border-[#E6E9ED] px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#1F2937]">
            <Grid size={16} className="text-[#3B82F6]" />
            <h2 className="font-bold text-[14px]">SUPPLIER LIST</h2>
          </div>
          <div className="bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
            {filteredSuppliers.length} Suppliers
          </div>
        </div>

        <div className="p-3 border-b border-[#E6E9ED] bg-white flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <Search size={14} className="text-gray-400" />
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search supplier by name or phone number..."
              className="w-full sm:w-80 pl-7 pr-3 py-1.5 border border-[#ccc] rounded text-[13px] outline-none focus:border-[#3B82F6]"
            />
          </div>
          <button type="button" 
            onClick={() => setIsFullTable(!isFullTable)}
            className="w-full sm:w-auto justify-center text-[#3B82F6] hover:bg-[#EFF6FF] px-3 py-1.5 rounded text-[12px] font-bold flex items-center gap-2 transition-colors border border-[#3B82F6]"
          >
            {isFullTable ? <Minimize size={14} /> : <Maximize size={14} />}
            {isFullTable ? 'Show Form' : 'View Full Table'}
          </button>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap min-w-[800px]">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2.5 border-r border-[#444] text-center w-8">#</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Supplier Name</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Mobile</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Complete Address</th>
                <th className="px-3 py-2.5 border-r border-[#444] text-right">Opening Bal</th>
                <th className="px-3 py-2.5 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center p-4">Loading...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-4">No suppliers found.</td></tr>
              ) : (
                filteredSuppliers.map((supplier: any, index: number) => (
                  <tr key={supplier.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'} hover:bg-blue-50`}>
                    <td data-label="#" className="px-3 py-3 border-r border-[#E5E7EB] text-center font-bold text-black font-bold">{index + 1}</td>
                    <td data-label="Supplier Name" className="px-3 py-3 border-r border-[#E5E7EB] font-bold text-[#3B82F6]">{supplier.name}</td>
                    <td data-label="Mobile" className="px-3 py-3 border-r border-[#E5E7EB] font-bold text-black font-bold">{supplier.phone || '-'}</td>
                    <td data-label="Complete Address" className="px-3 py-3 border-r border-[#E5E7EB] text-black font-bold truncate max-w-[200px]">{supplier.address || '-'}</td>
                    <td data-label="Opening Bal" className="px-3 py-3 border-r border-[#E5E7EB] text-right font-bold text-black font-bold">
                      {formatCurrency(supplier.openingBalance)} ({supplier.openingBalanceType})
                    </td>
                    <td data-label="Actions" className="px-3 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" 
                          onClick={() => setItemToView(supplier)}
                          className="text-[#10B981] border border-[#10B981] rounded p-1 hover:bg-[#10B981] hover:text-white transition-colors"
                        >
                          <Eye size={12} />
                        </button>
                        <button type="button" 
                          onClick={() => handleEdit(supplier)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                        >
                          <Edit size={12} />
                        </button>
                        <button type="button" 
                          onClick={() => {
                            setItemToDelete(supplier);
                          }}
                          className="text-[#EF4444] border border-[#EF4444] rounded p-1 hover:bg-[#EF4444] hover:text-white transition-colors"
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

      <SupplierViewModal
        isOpen={!!itemToView}
        onClose={() => setItemToView(null)}
        supplier={itemToView}
      />
</div>
  );
};
export default Suppliers;
