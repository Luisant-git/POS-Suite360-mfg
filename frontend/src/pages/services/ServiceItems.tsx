import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, CheckCircle, Scissors, Grid, Maximize, Minimize, Search, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../../contexts/SettingsContext';

const serviceItemSchema = z.object({
  name: z.string().min(1, 'Service Name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  rate: z.coerce.number().min(0, 'Rate is required'),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional().default(true),
});

type ServiceItemValues = z.infer<typeof serviceItemSchema>;

const ServiceItems = () => {
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ServiceItemValues>({
    resolver: zodResolver(serviceItemSchema) as any,
    defaultValues: {
      name: '',
      code: '',
      description: '',
      rate: '' as any,
      taxPercent: '' as any,
      isActive: true,
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['service-items'],
    queryFn: async () => (await api.get('/service-items')).data,
  });

  const { data: taxes = [] } = useQuery({
    queryKey: ['taxes'],
    queryFn: async () => (await api.get('/taxes')).data,
  });

  const { data: nextCodeData } = useQuery({
    queryKey: ['nextServiceCode'],
    queryFn: async () => (await api.get('/service-items/next-code')).data,
  });

  useEffect(() => {
    if (nextCodeData?.code && !editingId) {
      setValue('code', nextCodeData.code);
    }
  }, [nextCodeData, editingId, setValue]);

  const filteredItems = items.filter((i: any) => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return i.name.toLowerCase().includes(t) || (i.code || '').toLowerCase().includes(t);
    }
    return true;
  });

  const mutation = useMutation({
    mutationFn: async (data: ServiceItemValues) => {
      if (editingId) return api.patch(`/service-items/${editingId}`, data);
      return api.post('/service-items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-items'] });
      queryClient.invalidateQueries({ queryKey: ['nextServiceCode'] });
      toast.success(editingId ? 'Service updated successfully!' : 'Service added successfully!');
      reset({ name: '', code: nextCodeData?.code || '', description: '', rate: '' as any, taxPercent: '' as any, isActive: true });
      setEditingId(null);
      setIsMobileDrawerOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save service.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/service-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-items'] });
      toast.success('Service deleted successfully');
      setItemToDelete(null);
    },
    onError: () => {
      toast.error('Failed to delete. Service may be used in bills.');
      setItemToDelete(null);
    },
  });

  const onSubmit = (data: ServiceItemValues) => {
    mutation.mutate(data);
  };

  const onFormError = () => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (e.key === 'Escape' && !isInput) {
        if (isMobileDrawerOpen) {
          setIsMobileDrawerOpen(false);
          setEditingId(null);
          reset({ name: '', code: nextCodeData?.code || '', description: '', rate: '' as any, taxPercent: '' as any, isActive: true });
        } else if (itemToDelete) {
          setItemToDelete(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemToDelete, isMobileDrawerOpen, nextCodeData, reset]);

  const handleAddNew = () => {
    setIsFullTable(false);
    setEditingId(null);
    reset({ name: '', code: nextCodeData?.code || '', description: '', rate: '' as any, taxPercent: '' as any, isActive: true });
    setIsMobileDrawerOpen(true);
  };

  const handleEdit = (item: any) => {
    setIsFullTable(false);
    setEditingId(item.id);
    setValue('name', item.name);
    setValue('code', item.code || '');
    setValue('description', item.description || '');
    setValue('rate', Number(item.rate));
    setValue('taxPercent', Number(item.taxPercent || 0));
    setValue('isActive', item.isActive);
    setIsMobileDrawerOpen(true);
  };

  return (
    <div className="bg-transparent h-[calc(100vh-6rem)] grid grid-cols-1 xl:grid-cols-3 gap-4">

      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div 
          className="xl:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => { setIsMobileDrawerOpen(false); setEditingId(null); reset({ name: '', code: nextCodeData?.code || '', description: '', rate: '' as any, taxPercent: '' as any, isActive: true }); }}
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
          {/* Form Header */}
          <div className="bg-[#ECFDF5] border-b border-[#059669] px-4 py-2 flex items-center justify-between rounded-t-sm shrink-0">
            <div className="flex items-center gap-2">
              <Scissors size={16} className="text-[#065F46]" />
              <h2 className="font-bold text-[14px] text-[#065F46] uppercase">{editingId ? 'EDIT SERVICE' : 'SERVICE MASTER FORM'}</h2>
            </div>
            <button
              type="button"
              onClick={() => { setIsMobileDrawerOpen(false); setEditingId(null); reset({ name: '', code: nextCodeData?.code || '', description: '', rate: '' as any, taxPercent: '' as any, isActive: true }); }}
              className="xl:hidden p-1 rounded hover:bg-emerald-100 text-[#065F46]"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit as any, onFormError)} className="p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">Code <span className="text-gray-400">(auto if blank)</span></label>
                <input
                  {...register('code')}
                  type="text"
                  placeholder="e.g. SVC-001"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#059669] outline-none text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Service Name *</label>
                <input
                  {...register('name')}
                  type="text"
                  placeholder="e.g. Haircut, Facial, Manicure"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#059669] outline-none text-[13px]"
                />
                {errors.name && <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Rate *</label>
                <input
                  {...register('rate')}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#059669] outline-none text-[13px] text-right"
                />
                {errors.rate && <span className="text-red-500 text-xs mt-1 block">{errors.rate.message}</span>}
              </div>
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">GST / Tax %</label>
                <select
                  {...register('taxPercent')}
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#059669] outline-none text-[13px]"
                >
                  <option value="0">0% (Nil)</option>
                  {taxes.map((t: any) => (
                    <option key={t.id} value={t.rate}>{t.name} ({t.rate}%)</option>
                  ))}
                </select>
              </div>
            </div>



            <div>
              <label className="block text-[12px] text-[#1F2937] mb-1">Description <span className="text-gray-400">(Optional)</span></label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Brief description of this service..."
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#059669] outline-none text-[13px] resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('isActive')}
                id="isActiveCheck"
                className="w-4 h-4 accent-emerald-600"
              />
              <label htmlFor="isActiveCheck" className="text-[13px] font-bold text-[#1F2937] cursor-pointer">
                Active Service
              </label>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 mt-2 transition-colors disabled:opacity-60"
            >
              <CheckCircle size={16} />
              {editingId ? 'UPDATE SERVICE' : 'SAVE SERVICE (F10)'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => { reset({ name: '', code: nextCodeData?.code || '', description: '', rate: '' as any, taxPercent: '' as any, isActive: true }); setEditingId(null); setIsMobileDrawerOpen(false); }}
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
        {/* List Header */}
        <div className="bg-[#ECFDF5] border-b border-[#059669] px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#065F46]">
            <Grid size={16} className="text-[#065F46]" />
            <h2 className="font-bold text-[14px]">SERVICE ITEMS LIST</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddNew}
              className="xl:hidden whitespace-nowrap bg-[#059669] hover:bg-[#047857] text-white px-2.5 py-1 rounded text-[12px] font-bold flex items-center gap-1 shadow-sm transition-colors"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
            <div className="bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredItems.length} Services
            </div>
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
              placeholder="Search by name or code..."
              className="w-full sm:w-80 pl-7 pr-3 py-1.5 border border-[#ccc] rounded text-[13px] outline-none focus:border-[#059669]"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsFullTable(!isFullTable)}
            className="hidden xl:flex w-full sm:w-auto justify-center text-[#059669] hover:bg-[#ECFDF5] px-3 py-1.5 rounded text-[12px] font-bold items-center gap-2 transition-colors border border-[#059669]"
          >
            {isFullTable ? <Minimize size={14} /> : <Maximize size={14} />}
            <span>{isFullTable ? 'Show Form' : 'View Full Table'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2.5 border-r border-[#444] text-center w-8">#</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Code</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Service Name</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Description</th>
                <th className="px-3 py-2.5 border-r border-[#444] text-right">Rate</th>
                {settings?.enableTax && <th className="px-3 py-2.5 border-r border-[#444] text-center">Tax%</th>}
                <th className="px-3 py-2.5 border-r border-[#444] text-center">Status</th>
                <th className="px-3 py-2.5 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center p-4 text-gray-500">Loading...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={8} className="text-center p-4 text-gray-500">No services found. Add one using the form.</td></tr>
              ) : (
                filteredItems.map((item: any, index: number) => (
                  <tr key={item.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'} hover:bg-emerald-50`}>
                    <td className="px-3 py-3 border-r border-[#E5E7EB] text-center font-bold text-gray-700">{index + 1}</td>
                    <td className="px-3 py-3 border-r border-[#E5E7EB] font-mono font-bold text-[#059669] text-[12px]">{item.code}</td>
                    <td className="px-3 py-3 border-r border-[#E5E7EB] font-bold text-[#059669]">{item.name}</td>
                    <td className="px-3 py-3 border-r border-[#E5E7EB] text-gray-600 truncate max-w-[200px]">{item.description || '—'}</td>
                    <td className="px-3 py-3 border-r border-[#E5E7EB] text-right font-bold text-gray-800">{Number(item.rate).toFixed(2)}</td>
                    {settings?.enableTax && (
                      <td className="px-3 py-3 border-r border-[#E5E7EB] text-center text-gray-600">{Number(item.taxPercent || 0).toFixed(1)}%</td>
                    )}
                    <td className="px-3 py-3 border-r border-[#E5E7EB] text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${item.isActive ? 'bg-[#059669] text-white' : 'bg-[#9CA3AF] text-white'}`}>
                        {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="text-[#EF4444] border border-[#EF4444] rounded p-1 hover:bg-[#EF4444] hover:text-white transition-colors"
                          title="Delete"
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
        onConfirm={() => { if (itemToDelete) deleteMutation.mutate(itemToDelete.id); }}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};

export default ServiceItems;
