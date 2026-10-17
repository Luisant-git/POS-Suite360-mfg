import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, CheckCircle, Package, Grid, Maximize, Minimize, Eye, X, Upload, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import { useNavigate } from 'react-router-dom';

const productSchema = z.object({
  code: z.string().min(1, 'Product Code is required'),
  name: z.string().min(1, 'Product Name is required'),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().min(1, 'Unit is required'),
  supplierId: z.string().optional(),
  currentStock: z.coerce.number().min(0).default(0), // Opening Stock
  purchaseRate: z.coerce.number().min(0).default(0),
  wholesaleRate: z.coerce.number().min(0).default(0),
  sellingRate: z.coerce.number().min(0).default(0), // Sale Rate (Retail)
  taxPercent: z.coerce.number().min(0).default(0),  // GST %
  hsnCode: z.string().optional(),
  minStock: z.coerce.number().min(0).default(0),    // Min Qty (Alert)
  reorderLevel: z.coerce.number().min(0).default(0),
});

type ProductFormValues = z.infer<typeof productSchema>;

const Products = () => {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);

  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: any[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Product Name', 'Unit', 'Category', 'Brand', 'Opening Stock', 'Purchase Rate', 'Wholesale Rate', 'Sale Rate', 'Tax %', 'HSN Code'],
      ['Sample Product 1', 'Nos', 'Electronics', 'Samsung', 10, 100, 120, 150, 18, '8517'],
      ['Sample Product 2', 'Kg', 'Food', '', 0, 50, 60, 80, 5, ''],
    ]);
    ws['!cols'] = Array(10).fill({ wch: 18 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'products_import_template.xlsx');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      if (!rows.length) { toast.error('No data found in file'); return; }

      const allowedColumns = ['Product Name', 'Unit', 'Category', 'Brand', 'Opening Stock', 'Purchase Rate', 'Wholesale Rate', 'Sale Rate', 'Tax %', 'HSN Code'];
      const filteredRows = rows.map(row => {
        const filteredRow: any = {};
        allowedColumns.forEach(col => {
          if (row[col] !== undefined) {
            filteredRow[col] = row[col];
          }
        });
        return filteredRow;
      });

      if (filteredRows.length > 0 && Object.keys(filteredRows[0]).length === 0) {
        toast.error('No valid columns found in the uploaded file');
        return;
      }

      setImportPreview(filteredRows);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);
    try {
      const res = await api.post('/products/import', { products: importPreview, isManufacturingProduct: false }, {
        onUploadProgress: (e) => {
          if (e.total) setImportProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      setImportProgress(100);
      setImportResult({ created: res.data.created, updated: res.data.updated, skipped: res.data.skipped, errors: res.data.errors || [] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['nextProductCode'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importResult?.errors?.length) return;
    const ws = XLSX.utils.json_to_sheet(importResult.errors);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, 'import_error_report.xlsx');
  };

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      code: '',
      name: '',
      categoryId: '',
      brandId: '',
      unitId: '',
      supplierId: '',
      currentStock: '' as any,
      purchaseRate: '' as any,
      wholesaleRate: '' as any,
      sellingRate: '' as any,
      taxPercent: '' as any,
      hsnCode: '',
      minStock: '' as any,
      reorderLevel: '' as any,
    }
  });

  // Fetch Master Data
  const { settings, formatCurrency } = useSettings();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get('/categories')).data });
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get('/brands')).data });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: async () => (await api.get('/units')).data });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api.get('/suppliers')).data });
  const { data: taxes = [] } = useQuery({ queryKey: ['taxes'], queryFn: async () => (await api.get('/taxes')).data, enabled: !!settings?.enableTax });

  // Fetch Products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data
  });

  const { data: nextCodeData } = useQuery({
    queryKey: ['nextProductCode'],
    queryFn: async () => (await api.get('/products/next-code')).data
  });

  useEffect(() => {
    if (nextCodeData?.code && !editingId) {
      setValue('code', nextCodeData.code);
    }
  }, [nextCodeData, editingId, setValue]);

  const handleAutoCode = async () => {
    try {
      const res = await api.get('/products/next-code');
      if (res.data && res.data.code) {
        setValue('code', res.data.code);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter((p: any) => {
    if (filterCategory && p.categoryId.toString() !== filterCategory) return false;
    if (filterBrand && p.brandId?.toString() !== filterBrand) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const payload = {
        ...data,
        categoryId: data.categoryId ? parseInt(data.categoryId) : undefined,
        brandId: data.brandId ? parseInt(data.brandId) : undefined,
        unitId: parseInt(data.unitId || '0'),
        supplierId: data.supplierId ? parseInt(data.supplierId) : undefined,
      };

      if (editingId) {
        return api.patch(`/products/${editingId}`, payload);
      }
      return api.post('/products', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['nextProductCode'] });
      toast.success(editingId ? 'Product updated successfully!' : 'Product added successfully!');
      reset();
      setEditingId(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to save product. Please check your inputs.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
      setItemToDelete(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('Failed to delete product. It may be in use.');
      setItemToDelete(null);
    }
  });

  const onSubmit = (data: ProductFormValues) => {
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

  const handleEdit = (product: any) => {
    setIsFullTable(false);
    setEditingId(product.id);
    setValue('code', product.code);
    setValue('name', product.name);
    setValue('categoryId', product.categoryId ? product.categoryId.toString() : '');
    setValue('brandId', product.brandId ? product.brandId.toString() : '');
    setValue('unitId', product.unitId ? product.unitId.toString() : '');
    setValue('supplierId', product.supplierId ? product.supplierId.toString() : '');
    setValue('currentStock', Number(product.currentStock));
    setValue('purchaseRate', Number(product.purchaseRate));
    setValue('wholesaleRate', Number(product.wholesaleRate));
    setValue('sellingRate', Number(product.sellingRate));
    setValue('taxPercent', Number(product.taxPercent || 0));
    setValue('hsnCode', product.hsnCode || '');
    setValue('minStock', Number(product.minStock));
    setValue('reorderLevel', Number(product.reorderLevel));
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
    <div className="bg-[#F7F7F7] min-h-[calc(100vh-100px)] grid grid-cols-1 xl:grid-cols-3 gap-4">

      {/* Left Column: Form */}
      {!isFullTable && (
        <div className="xl:col-span-1 bg-white border border-[#E6E9ED] shadow-sm rounded-sm flex flex-col">
          <div className="bg-[#3B82F6] text-white px-4 py-3 flex items-center justify-between rounded-t-sm">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-white" />
              <h2 className="font-bold text-[14px]">PRODUCT MASTER</h2>
            </div>
            <button type="button" onClick={handleAutoCode} className="bg-[#1E3A8A] text-white text-[11px] px-3 py-1 font-bold rounded">
              Auto Code
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit as any, onFormError)} className="p-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Product Code *</label>
                <input
                  {...register('code')}
                  type="text"
                  readOnly
                  placeholder="Code"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-gray-100"
                />
                {errors.code && <span className="text-red-500 text-xs mt-1 block">{errors.code.message}</span>}
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
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Product Name *</label>
              <input
                {...register('name')}
                type="text"
                placeholder="Full item description"
                className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
              />
              {errors.name && <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Category</label>
                <select
                  {...register('categoryId')}
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-white"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Brand</label>
                <select
                  {...register('brandId')}
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-white"
                >
                  <option value="">-- Select Brand --</option>
                  {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Default Supplier</label>
                <select
                  {...register('supplierId')}
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-white"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {settings?.enableTax && (
                <div>
                  <label className="block text-[12px] font-bold text-[#1F2937] mb-1">GST % (Tax)</label>
                  <select
                    {...register('taxPercent')}
                    className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] bg-white"
                  >
                    <option value="0">None (0%)</option>
                    {taxes.map((t: any) => <option key={t.id} value={Number(t.rate)}>{t.name} ({Number(t.rate)}%)</option>)}
                  </select>
                </div>
              )}
            </div>

            {settings?.enableTax && (
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">HSN Code <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input
                  {...register('hsnCode')}
                  type="text"
                  placeholder="e.g. 6403"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px]"
                />
              </div>
            )}

            <h3 className="font-bold text-[13px] text-gray-500 mt-2 uppercase">Pricing Matrix</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div>
                <label className="block text-[12px] font-bold text-[#16A34A] mb-1">Wholesale Rate</label>
                <input
                  {...register('wholesaleRate')}
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#3B82F6] mb-1">Sale Rate (Retail)</label>
                <input
                  {...register('sellingRate')}
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
                />
              </div>
            </div>

            <h3 className="font-bold text-[13px] text-red-500 mt-2 uppercase">Stock Alerts & Thresholds</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">Min Qty (Alert)</label>
                <input
                  {...register('minStock')}
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#1F2937] mb-1">Reorder Level</label>
                <input
                  {...register('reorderLevel')}
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner focus:border-[#3B82F6] outline-none text-[13px] text-right"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 transition-colors"
            >
              <CheckCircle size={16} />
              {editingId ? 'UPDATE PRODUCT' : 'SAVE PRODUCT (F10)'}
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
      <div className={`${isFullTable ? 'xl:col-span-3' : 'xl:col-span-2'} bg-white border border-[#E6E9ED] shadow-sm rounded-sm overflow-hidden flex flex-col`}>
        <div className="bg-[#E5E7EB] border-b border-[#E6E9ED] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2 text-[#1F2937]">
              <Grid size={16} className="text-[#3B82F6]" />
              <h2 className="font-bold text-[14px]">MASTER PRODUCT LIST</h2>
            </div>
            <div className="md:hidden bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredProducts.length}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button type="button"
              onClick={() => setIsFullTable(!isFullTable)}
              className="whitespace-nowrap text-[#3B82F6] hover:bg-[#EFF6FF] px-2 py-1 rounded text-[12px] font-bold flex items-center gap-1 transition-colors border border-[#3B82F6]"
            >
              {isFullTable ? <Minimize size={13} /> : <Maximize size={13} />}
              <span className="hidden sm:inline">{isFullTable ? 'Show Form' : 'Full Table'}</span>
              <span className="sm:hidden">{isFullTable ? 'Form' : 'Table'}</span>
            </button>
            <div className="hidden md:block bg-gray-500 text-white text-[11px] font-bold px-2 py-1 rounded-xl">
              {filteredProducts.length} Products
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-[#E6E9ED] grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#F9F9F9] items-end">
          <div>
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Category:</label>
            <select
              value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#ccc] rounded outline-none text-[12px] bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Brand:</label>
            <select
              value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#ccc] rounded outline-none text-[12px] bg-white"
            >
              <option value="">All Brands</option>
              {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Search:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by name / code..."
                className="w-full px-3 py-1.5 border border-[#ccc] rounded outline-none text-[12px]"
              />
            </div>
            <button type="button"
              onClick={() => { setFilterCategory(''); setFilterBrand(''); setSearchTerm(''); }}
              className="px-3 py-1.5 border border-[#ccc] rounded bg-white text-gray-700 text-[12px] font-bold hover:bg-gray-100"
            >
              Reset
            </button>
            <button type="button" onClick={handleDownloadTemplate} className="px-3 py-1.5 border border-[#16A34A] rounded bg-white text-[#16A34A] text-[12px] font-bold hover:bg-green-50 flex items-center gap-1">
              <Download size={13} /> Template
            </button>
            <button type="button" onClick={() => importFileRef.current?.click()} className="px-3 py-1.5 border border-[#7C3AED] rounded bg-white text-[#7C3AED] text-[12px] font-bold hover:bg-purple-50 flex items-center gap-1">
              <Upload size={13} /> Import
            </button>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          <table className="w-full text-left text-[12px] whitespace-nowrap min-w-[800px]">
            <thead>
              <tr className="bg-[#2A2A2A] text-white font-bold">
                <th className="px-3 py-2 border-r border-[#444] text-center w-8">#</th>
                <th className="px-3 py-2 border-r border-[#444]">Code</th>
                <th className="px-3 py-2 border-r border-[#444] whitespace-normal min-w-[200px] max-w-[300px]">Product Description</th>
                <th className="px-3 py-2 border-r border-[#444]">Category</th>
                <th className="px-3 py-2 border-r border-[#444]">Brand</th>
                <th className="px-3 py-2 border-r border-[#444] text-center">Stock</th>
                {settings?.enableTax && <th className="px-3 py-2 border-r border-[#444] text-center">Tax %</th>}
                <th className="px-3 py-2 border-r border-[#444] text-right">Pur Rate</th>
                <th className="px-3 py-2 border-r border-[#444] text-right">Wholesale</th>
                <th className="px-3 py-2 border-r border-[#444] text-right">Sale Rate</th>
                <th className="px-3 py-2 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={12} className="text-center p-4">Loading...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={12} className="text-center p-4">No products found.</td></tr>
              ) : (
                filteredProducts.map((product: any, index: number) => (
                  <tr key={product.id} className={`border-b border-[#E5E7EB] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'} hover:bg-blue-50`}>
                    <td data-label="#" className="px-3 py-2.5 border-r border-[#E5E7EB] text-center font-bold text-black font-bold">{index + 1}</td>
                    <td data-label="Code" className="px-3 py-2.5 border-r border-[#E5E7EB] font-bold text-[#3B82F6]">{product.code}</td>
                    <td data-label="Product Description" className="px-3 py-2.5 border-r border-[#E5E7EB] font-bold text-black font-bold">
                      <div className="whitespace-normal min-w-[150px] max-w-[250px] break-words">
                        {product.name}
                      </div>
                    </td>
                    <td data-label="Category" className="px-3 py-2.5 border-r border-[#E5E7EB]">
                      <span className="text-[10px] font-bold text-[#16A34A] uppercase bg-[#DCFCE7] px-2 py-0.5 rounded">{product.category?.name || '-'}</span>
                    </td>
                    <td data-label="Brand" className="px-3 py-2.5 border-r border-[#E5E7EB]">
                      <span className="text-[10px] font-bold text-[#D97706] uppercase bg-[#FEF3C7] px-2 py-0.5 rounded">{product.brand?.name || '-'}</span>
                    </td>
                    <td data-label="Stock" className="px-3 py-2.5 border-r border-[#E5E7EB] text-center font-bold text-black font-bold">
                      {product.currentStock} {product.unit?.name}
                    </td>
                    {settings?.enableTax && (
                      <td data-label="Tax %" className="px-3 py-2.5 border-r border-[#E5E7EB] text-center font-bold text-black font-bold">
                        {product.taxPercent ? `${Number(product.taxPercent)}%` : '0%'}
                      </td>
                    )}
                    <td data-label="Pur Rate" className="px-3 py-2.5 border-r border-[#E5E7EB] text-right text-black font-bold">{formatCurrency(product.purchaseRate)}</td>
                    <td data-label="Wholesale" className="px-3 py-2.5 border-r border-[#E5E7EB] text-right font-bold text-[#16A34A]">{formatCurrency(product.wholesaleRate)}</td>
                    <td data-label="Sale Rate" className="px-3 py-2.5 border-r border-[#E5E7EB] text-right font-bold text-[#3B82F6]">{formatCurrency(product.sellingRate)}</td>
                    <td data-label="Actions" className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button"
                          onClick={() => setViewProduct(product)}
                          className="text-[#7C3AED] border border-[#7C3AED] rounded p-1 hover:bg-[#7C3AED] hover:text-white transition-colors"
                        >
                          <Eye size={12} />
                        </button>
                        <button type="button"
                          onClick={() => handleEdit(product)}
                          className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                        >
                          <Edit size={12} />
                        </button>
                        <button type="button"
                          onClick={() => setItemToDelete(product)}
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

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="bg-[#7C3AED] text-white px-4 py-3 rounded-t-lg flex justify-between items-center shrink-0">
              <span className="font-bold text-[14px] flex items-center gap-2"><Upload size={16} /> Import Preview — {importPreview.length} rows</span>
              {!isImporting && <button onClick={() => { setImportPreview(null); setImportResult(null); setImportProgress(0); }} className="hover:text-red-300"><X size={18} /></button>}
            </div>

            {isImporting ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                <p className="font-bold text-[#7C3AED] text-[15px]">Uploading & Importing... {importProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div className="bg-[#7C3AED] h-4 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                </div>
                <p className="text-[12px] text-gray-500">Please wait, do not close this window.</p>
              </div>
            ) : importResult ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                <p className="font-bold text-[15px] text-[#16A34A]">✅ Import Complete!</p>
                <div className="grid grid-cols-3 gap-4 w-full max-w-md">
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                    <p className="text-[22px] font-bold text-green-700">{importResult.created}</p>
                    <p className="text-[11px] text-green-600 font-bold">CREATED</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                    <p className="text-[22px] font-bold text-blue-700">{importResult.updated}</p>
                    <p className="text-[11px] text-blue-600 font-bold">UPDATED</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-center">
                    <p className="text-[22px] font-bold text-gray-600">{importResult.skipped}</p>
                    <p className="text-[11px] text-gray-500 font-bold">SKIPPED</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="w-full max-w-md bg-red-50 border border-red-200 rounded p-3 text-center">
                    <p className="text-[14px] font-bold text-red-600">{importResult.errors.length} Errors found</p>
                    <button onClick={handleDownloadErrorReport} className="mt-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[12px] flex items-center gap-1 mx-auto">
                      <Download size={13} /> Download Error Report
                    </button>
                  </div>
                )}
                <button onClick={() => { setImportPreview(null); setImportResult(null); setImportProgress(0); }} className="px-6 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded text-[12px]">Close</button>
              </div>
            ) : (
              <>
                <div className="overflow-auto flex-1 p-3">
                  <table className="w-full text-[11px] whitespace-nowrap border border-gray-200">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>{Object.keys(importPreview[0]).map(k => <th key={k} className="px-2 py-1.5 border border-gray-200 text-left font-bold">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {Object.values(row).map((v: any, j) => <td key={j} className="px-2 py-1 border border-gray-100">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t flex justify-end gap-2 shrink-0">
                  <p className="text-[11px] text-gray-500 flex-1 self-center">Existing products (matched by name) will be updated. New ones will be created.</p>
                  <button onClick={() => { setImportPreview(null); setImportResult(null); }} className="px-4 py-2 bg-gray-500 text-white font-bold rounded text-[12px]">Cancel</button>
                  <button onClick={handleConfirmImport} className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded text-[12px] flex items-center gap-2">
                    <Upload size={13} /> Confirm Import ({importPreview.length} rows)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* View Product Modal */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
            <div className="bg-[#3B82F6] text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-[14px]">
                <Package size={16} /> {viewProduct.name}
              </div>
              <button onClick={() => setViewProduct(null)} className="hover:text-red-300 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 text-[13px]">
              {[
                ['Code', viewProduct.code],
                ['Unit', viewProduct.unit?.name || '-'],
                ['Category', viewProduct.category?.name || '-'],
                ['Brand', viewProduct.brand?.name || '-'],
                ['Supplier', viewProduct.supplier?.name || '-'],
                ['Current Stock', `${viewProduct.currentStock} ${viewProduct.unit?.shortCode || ''}`],
                ['Purchase Rate', viewProduct.purchaseRate],
                ['Wholesale Rate', viewProduct.wholesaleRate],
                ['Sale Rate', viewProduct.sellingRate],
                ['Min Stock', viewProduct.minStock],
                ['Reorder Level', viewProduct.reorderLevel],
                ...(viewProduct.taxPercent ? [['GST %', `${viewProduct.taxPercent}%`]] : []),
                ...(viewProduct.hsnCode ? [['HSN Code', viewProduct.hsnCode]] : []),
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-50 rounded p-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                  <p className="font-bold text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4 flex justify-end">
              <button onClick={() => setViewProduct(null)} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded text-[12px]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
