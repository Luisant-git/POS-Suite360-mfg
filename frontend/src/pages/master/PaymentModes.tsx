import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, CheckCircle, CreditCard, Grid, Search, Maximize, Minimize } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import api from '../../services/api';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import { useNavigate } from 'react-router-dom';

const paymentModeSchema = z.object({
  name: z.string().min(1, 'Payment Mode Name is required'),
  description: z.string().optional(),
});

type PaymentModeFormValues = z.infer<typeof paymentModeSchema>;

const PaymentModes = () => {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<PaymentModeFormValues>({
    resolver: zodResolver(paymentModeSchema),
    defaultValues: { name: '', description: '' }
  });

  const { data: paymentModes = [], isLoading } = useQuery({
    queryKey: ['paymentModes'],
    queryFn: async () => (await api.get('/payment-modes')).data
  });

  const filteredModes = paymentModes.filter((p: any) => {
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: async (data: PaymentModeFormValues) => {
      if (editingId) {
        return api.patch(`/payment-modes/${editingId}`, data);
      }
      return api.post('/payment-modes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentModes'] });
      reset();
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/payment-modes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentmodes'] });
      setItemToDelete(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to delete Payment Mode';
      toast.error(message);
    }
  });

  const onSubmit = (data: PaymentModeFormValues) => {
    mutation.mutate(data);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, onSubmit]);

  const handleEdit = (mode: any) => {
    setIsFullTable(false);
    setEditingId(mode.id);
    setValue('name', mode.name);
    setValue('description', mode.description || '');
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
    <div className="bg-[#F7F7F7] min-h-[calc(100vh-100px)] grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* Left Column: Form */}
      {!isFullTable && (
        <div className="lg:col-span-1 bg-white border border-[#E6E9ED] shadow-sm rounded-sm">
          <div className="bg-[#EBF5FF] border-b border-[#3B82F6] px-4 py-3 flex items-center gap-2 rounded-t-sm">
            <CreditCard size={16} className="text-[#1E3A8A]" />
            <h2 className="font-bold text-[14px] text-[#1E3A8A]">PAYMENT MODE FORM</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
            <div>
              <label className="block text-[13px] font-bold text-[#1F2937] mb-1">Payment Mode Name *</label>
              <input
                {...register('name')}
                type="text"
                placeholder="e.g. Cash, Card, UPI, Credit, Bank Transfer"
                className="w-full px-3 py-2 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
              />
              {errors.name && <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>}
            </div>

            <div>
              <label className="block text-[13px] text-[#1F2937] mb-1">Description / Notes</label>
              <input
                {...register('description')}
                type="text"
                placeholder="e.g. Direct cash, POS terminal, QR Code scan"
                className="w-full px-3 py-2 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 mt-4 transition-colors"
            >
              <CheckCircle size={16} />
              {editingId ? 'UPDATE PAYMENT MODE' : 'SAVE PAYMENT MODE (F10)'}
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
      <div className={`${isFullTable ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white border border-[#E6E9ED] shadow-sm rounded-sm overflow-hidden flex flex-col`}>
        <div className="bg-[#EBF5FF] border-b border-[#3B82F6] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2 text-[#1E3A8A]">
              <Grid size={16} className="text-[#1E3A8A]" />
              <h2 className="font-bold text-[14px]">PAYMENT MODES LIST</h2>
            </div>
            <div className="md:hidden bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredModes.length} Modes
            </div>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="hidden md:block bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredModes.length} Modes
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
                  placeholder="Search modes..."
                  className="pl-7 pr-3 py-1 border border-[#ccc] rounded text-[12px] w-full md:w-48 outline-none focus:border-[#3B82F6]"
                />
              </div>
              <button type="button"
                onClick={() => setIsFullTable(!isFullTable)}
                className="whitespace-nowrap text-[#3B82F6] hover:bg-white px-2 py-1 rounded text-[12px] font-bold flex items-center justify-center gap-1 transition-colors border border-[#3B82F6]"
              >
                {isFullTable ? <Minimize size={14} /> : <Maximize size={14} />}
                <span className="hidden sm:inline">{isFullTable ? 'Show Form' : 'View Full Table'}</span>
                <span className="sm:hidden">{isFullTable ? 'Form' : 'Full Table'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap min-w-[800px]">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2.5 border-r border-[#444] text-center w-12">ID</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Payment Mode Name</th>
                <th className="px-3 py-2.5 border-r border-[#444]">Description</th>
                <th className="px-3 py-2.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center p-4">Loading...</td></tr>
              ) : filteredModes.length === 0 ? (
                <tr><td colSpan={4} className="text-center p-4">No payment modes found.</td></tr>
              ) : (
                filteredModes.map((mode: any, index: number) => (
                  <tr key={mode.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-[#F9F9F9]' : 'bg-white'} hover:bg-blue-50`}>
                    <td data-label="ID" className="px-3 py-2.5 border-r border-[#E5E7EB] text-center font-bold">{mode.id}</td>
                    <td data-label="Payment Mode Name" className="px-3 py-2.5 border-r border-[#E5E7EB] font-bold text-[#16A34A] flex items-center gap-1">
                      <CreditCard size={14} /> {mode.name}
                    </td>
                    <td data-label="Description" className="px-3 py-2.5 border-r border-[#E5E7EB] text-gray-600">{mode.description || '-'}</td>
                    <td data-label="Actions" className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button"
                          onClick={() => handleEdit(mode)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <button type="button"
                          onClick={() => {
                            setItemToDelete(mode);
                          }}
                          className="text-[#EF4444] border border-[#EF4444] rounded p-1 hover:bg-[#EF4444] hover:text-white transition-colors"
                        >
                          <Trash2 size={14} />
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
    </div>
  );
};
export default PaymentModes;
