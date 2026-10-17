import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Users as UsersIcon, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [formData, setFormData] = useState({
    id: null,
    username: '',
    password: '',
    name: '',
    roleId: '' as string | number
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/roles')
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user: any = null) => {
    if (user) {
      setFormData({
        id: user.id,
        username: user.username,
        password: '',
        name: user.name,
        roleId: user.roleId
      });
    } else {
      setFormData({
        id: null,
        username: '',
        password: '',
        name: '',
        roleId: roles.length > 0 ? roles[0].id : ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.put(`/users/${formData.id}`, formData);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', formData);
        toast.success('User created successfully');
      }
      closeModal();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save user');
    }
  };

  const openDeleteModal = (id: number) => {
    setUserToDelete(id);
    setDeleteConfirmationText('');
  };

  const confirmDelete = async () => {
    if (!userToDelete || deleteConfirmationText !== 'DELETE') return;
    try {
      await api.delete(`/users/${userToDelete}`);
      toast.success('User deleted successfully');
      setUserToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UsersIcon className="text-blue-600" /> Users & Roles
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage system users and access</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            to="/master/permissions"
            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Shield size={18} />
            <span className="hidden sm:inline">Menu Permissions</span>
            <span className="sm:hidden">Permissions</span>
          </Link>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New User</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                <th className="px-6 py-4 font-semibold w-[300px]">User</th>
                <th className="px-6 py-4 font-semibold w-[250px]">Username</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No users found</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-medium">{user.username}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 whitespace-nowrap">
                        <Shield size={16} />
                        {user.role?.name || 'No Role'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                      <Link
                        to="/master/permissions"
                        state={{ roleId: user.roleId }}
                        className="p-2 inline-flex text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit Role Permissions"
                      >
                        <Shield size={18} />
                      </Link>
                      <button
                        onClick={() => openModal(user)}
                        className="p-2 inline-flex text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(user.id)}
                        className="p-2 inline-flex text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <UsersIcon className="text-blue-600" size={24} />
                {formData.id ? 'Edit User' : 'New User'}
              </h2>
            </div>

            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Password {formData.id && <span className="text-gray-400 font-normal text-xs">(Leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    required={!formData.id}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                  <select
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors appearance-none"
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })}
                  >
                    <option value="">Select a role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm shadow-blue-200"
                >
                  {formData.id ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-red-50/50">
              <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                <Trash2 size={24} />
                Delete User
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 text-sm mb-4 font-medium">
                Are you sure you want to delete this user? This action cannot be undone and they will immediately lose access to the system.
              </p>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Type <span className="text-red-600 font-mono bg-red-50 px-1 rounded border border-red-100">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-mono uppercase"
              />
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteConfirmationText !== 'DELETE'}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-200"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
