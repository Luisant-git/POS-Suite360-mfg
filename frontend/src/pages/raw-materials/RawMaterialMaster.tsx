import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, CheckCircle, Box, Grid, Maximize, Minimize, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';

const rawMaterialSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  unitId: z.string().min(1, 'Unit is required'),
  hsnCode: z.string().optional(),
  currentStock: z.coerce.number().min(0).default(0),
  purchaseRate: z.coerce.number().min(0).default(0),
});

type RawMaterialFormValues = z.infer<typeof rawMaterialSchema>;

const RawMaterialMaster = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  const { register, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<RawMaterialFormValues>({
    resolver: zodResolver(rawMaterialSchema) as any,
    defaultValues: {
      code: '',
      name: '',
      unitId: '',
      hsnCode: '',
      currentStock: '' as any,
      purchaseRate: '' as any,
    }
  });

  const { formatCurrency } = useSettings();
  const navigate = useNavigate();
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: async () => (await api.get('/units')).data });

  const { data: rawMaterials = [], isLoading } = useQuery({ 
    queryKey: ['rawMaterials'], 
    queryFn: async () => (await api.get('/raw-materials')).data 
  });

  const generateNextCode = () => {
    const rmCodes = rawMaterials
      .filter((m: any) => m.code?.startsWith('RM-'))
      .map((m: any) => parseInt(m.code.replace('RM-', '')))
      .filter((n: number) => !isNaN(n));
    const maxCode = rmCodes.length > 0 ? Math.max(...rmCodes) : 0;
    return `RM-${String(maxCode + 1).padStart(3, '0')}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (e.key === 'Escape' && !isInput) {
        if (isMobileDrawerOpen) {
          setIsMobileDrawerOpen(false);
          setEditingId(null);
          reset();
          setValue('code', generateNextCode());
        } else if (itemToDelete) {
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
  }, [itemToDelete, isLeaveModalOpen, isMobileDrawerOpen, navigate, rawMaterials]);

  const filteredMaterials = rawMaterials.filter((m: any) => {
    if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase()) && !m.code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: async (data: RawMaterialFormValues) => {
      const payload = {
        ...data,
        unitId: parseInt(data.unitId || '0'),
      };
      
      if (editingId) {
        return api.patch(`/raw-materials/${editingId}`, payload);
      }
      return api.post('/raw-materials', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rawMaterials'] });
      toast.success(editingId ? 'Raw Material updated successfully!' : 'Raw Material added successfully!');
      reset();
      setEditingId(null);
      setIsMobileDrawerOpen(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to save raw material.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/raw-materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rawMaterials'] });
      toast.success('Raw Material deleted successfully');
      setItemToDelete(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('Failed to delete raw material. It may be in use.');
      setItemToDelete(null);
    }
  });

  useEffect(() => {
    if (rawMaterials && !editingId && !getValues('code')) {
      setValue('code', generateNextCode());
    }
  }, [rawMaterials, editingId, setValue, getValues]);

  const onSubmit = (data: RawMaterialFormValues) => {
    mutation.mutate(data);
  };

  const handleAddNew = () => {
    setIsFullTable(false);
    setEditingId(null);
    reset({
      code: generateNextCode(),
      name: '',
      unitId: '',
      hsnCode: '',
      currentStock: '' as any,
      purchaseRate: '' as any,
    });
    setIsMobileDrawerOpen(true);
  };

  const handleEdit = (material: any) => {
    setIsFullTable(false);
    setEditingId(material.id);
    setValue('code', material.code);
    setValue('name', material.name);
    setValue('unitId', material.unitId ? material.unitId.toString() : '');
    setValue('hsnCode', material.hsnCode || '');
    setValue('currentStock', Number(material.currentStock));
    setValue('purchaseRate', Number(material.purchaseRate));
    setIsMobileDrawerOpen(true);
  };

  return (
    <div className="bg-[#F7F7F7] h-[calc(100vh-6rem)] grid grid-cols-1 xl:grid-cols-3 gap-4 p-4">
      
      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div 
          className="xl:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => { setIsMobileDrawerOpen(false); setEditingId(null); reset(); setValue('code', generateNextCode()); }}
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
        <div className="bg-[#3B82F6] text-white px-4 py-3 flex items-center justify-between rounded-t-sm shrink-0">
          <div className="flex items-center gap-2">
            <Box size={18} />
            <h2 className="font-bold text-[14px] uppercase">{editingId ? 'EDIT RAW MATERIAL' : 'RAW MATERIAL MASTER'}</h2>
          </div>
          <button
            type="button"
            onClick={() => { setIsMobileDrawerOpen(false); setEditingId(null); reset(); setValue('code', generateNextCode()); }}
            className="xl:hidden p-1 rounded hover:bg-white/20 text-white"
          >
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1">
          <div>
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Material Code *</label>
            <input 
              {...register('code')}
              type="text" 
              placeholder="Code"
              className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
            />
            {errors.code && <span className="text-red-500 text-xs mt-1 block">{errors.code.message}</span>}
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Material Name *</label>
            <input 
              {...register('name')}
              type="text" 
              placeholder="Material name"
              className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
            />
            {errors.name && <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>}
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">HSN Code <span className="text-gray-400 font-normal">(Optional)</span></label>
            <input
              {...register('hsnCode')}
              type="text"
              placeholder="e.g. 6403"
              className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Unit *</label>
            <select 
              {...register('unitId')}
              className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-white"
            >
              <option value="">-- Select --</option>
              {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {errors.unitId && <span className="text-red-500 text-xs mt-1 block">{errors.unitId.message}</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <label className="block text-[12px] text-[#1F2937] mb-1">Opening Stock</label>
              <input 
                {...register('currentStock')}
                type="number" 
                placeholder="0"
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#1F2937] mb-1">Pur Rate</label>
              <input 
                {...register('purchaseRate')}
                type="number" 
                placeholder="0"
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 transition-colors mt-4"
          >
            <CheckCircle size={16} />
            {editingId ? 'UPDATE MATERIAL' : 'SAVE MATERIAL'}
          </button>
          
          {editingId && (
            <button 
              type="button" 
              onClick={() => { reset(); setEditingId(null); setValue('code', generateNextCode()); setIsMobileDrawerOpen(false); }}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 rounded flex justify-center items-center gap-2 transition-colors"
            >
              CANCEL EDIT
            </button>
          )}
        </form>
      </div>
      )}

      <div className={`${isFullTable ? 'xl:col-span-3' : 'xl:col-span-2'} bg-white border border-[#E6E9ED] shadow-sm rounded-sm overflow-hidden flex flex-col`}>
        <div className="bg-[#E5E7EB] border-b border-[#E6E9ED] px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#1F2937]">
            <Grid size={16} className="text-[#3B82F6]" />
            <h2 className="font-bold text-[14px]">RAW MATERIAL LIST</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddNew}
              className="xl:hidden whitespace-nowrap bg-[#16A34A] hover:bg-[#15803D] text-white px-2.5 py-1 rounded text-[12px] font-bold flex items-center gap-1 shadow-sm transition-colors"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
            <div className="bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredMaterials.length} Materials
            </div>
          </div>
        </div>
        
        <div className="p-3 border-b border-[#E6E9ED] grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#F9F9F9] items-end">
          <div className="flex-1">
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Search:</label>
            <div className="relative">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by name / code..."
                className="w-full px-3 py-1.5 border border-[#ccc] rounded outline-none text-[12px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" 
              onClick={() => setIsFullTable(!isFullTable)}
              className="hidden xl:flex justify-center text-[#3B82F6] hover:bg-[#EFF6FF] px-3 py-1.5 rounded text-[12px] font-bold items-center gap-2 transition-colors border border-[#3B82F6]"
            >
              {isFullTable ? <Minimize size={14} /> : <Maximize size={14} />}
              <span>{isFullTable ? 'Show Form' : 'View Full Table'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[12px] whitespace-nowrap min-w-[600px]">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2 border-r border-[#444] text-center w-8">#</th>
                <th className="px-3 py-2 border-r border-[#444]">Code</th>
                <th className="px-3 py-2 border-r border-[#444]">Material Name</th>
                <th className="px-3 py-2 border-r border-[#444]">HSN Code</th>
                <th className="px-3 py-2 border-r border-[#444] text-center">Unit</th>
                <th className="px-3 py-2 border-r border-[#444] text-center">Stock</th>
                <th className="px-3 py-2 border-r border-[#444] text-right">Pur Rate</th>
                <th className="px-3 py-2 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center p-4">Loading...</td></tr>
              ) : filteredMaterials.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-4">No materials found.</td></tr>
              ) : (
                filteredMaterials.map((material: any, index: number) => (
                  <tr key={material.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'} hover:bg-blue-50`}>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-center font-bold text-gray-700">{index + 1}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] font-bold text-[#3B82F6]">{material.code}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] font-bold text-[#1F2937]">{material.name}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-gray-500">{material.hsnCode || '-'}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-center">{material.unit?.name || '-'}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-center font-bold text-green-700">{material.currentStock}</td>
                    <td className="px-3 py-2.5 border-r border-[#E5E7EB] text-right font-medium">{formatCurrency(material.purchaseRate)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" 
                          onClick={() => handleEdit(material)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                        >
                          <Edit size={12} />
                        </button>
                        <button type="button" 
                          onClick={() => setItemToDelete(material)}
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
      
      <DeleteConfirmationModal 
        isOpen={!!itemToDelete}
        itemName={itemToDelete?.name}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(itemToDelete.id)}
        onCancel={() => setItemToDelete(null)}
      />

      <LeaveConfirmModal 
        isOpen={isLeaveModalOpen} 
        onClose={() => setIsLeaveModalOpen(false)} 
        onConfirm={() => navigate('/dashboard')} 
      />
    </div>
  );
};

export default RawMaterialMaster;
