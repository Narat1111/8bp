import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, ShoppingBag, Settings, LogOut, Package, Plus, Search, Tag, DollarSign, Activity, Image as ImageIcon, Key, Database, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:8000/api' });

// Redirect to login on 401/403
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login';
        }
        return Promise.reject(error);
    }
);

function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [stats, setStats] = useState({ totalRevenue: 0, activeProducts: 0, totalOrders: 0 });
    const [loading, setLoading] = useState(true);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', price: '', image_url: '' });
    const [imageFile, setImageFile] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [stock, setStock] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [accountForm, setAccountForm] = useState({ product_id: '', account_url: '', account_password: '' });
    const [toast, setToast] = useState({ message: '', type: '' });
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, name: '' });


    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: '', type: '' }), 3500);
    };

    const fetchDashboardData = async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        try {
            const [productsRes, ordersRes, statsRes, customersRes, contactsRes, accountsRes, stockRes] = await Promise.all([
                api.get('/admin/products', config).catch(() => ({ data: [] })),
                api.get('/admin/orders', config).catch(() => ({ data: [] })),
                api.get('/admin/stats', config).catch(() => ({ data: { totalRevenue: 0, activeProducts: products.length, totalOrders: 0 } })),
                api.get('/admin/customers', config).catch(() => ({ data: [] })),
                api.get('/admin/contacts', config).catch(() => ({ data: [] })),
                api.get('/admin/accounts', config).catch(() => ({ data: [] })),
                api.get('/admin/stock', config).catch(() => ({ data: [] }))
            ]);
            setProducts(productsRes.data);
            setOrders(ordersRes.data);
            setStats(statsRes.data);
            setCustomers(customersRes.data);
            setContacts(contactsRes.data);
            setAccounts(accountsRes.data);
            setStock(stockRes.data);
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            // Fallback empty states
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin/login');
            return;
        }
        fetchDashboardData();
    }, [navigate]);

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('adminToken');
        try {
            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('description', formData.description);
            submitData.append('price', formData.price);
            submitData.append('image_url', formData.image_url || '');
            if (imageFile) {
                submitData.append('image', imageFile);
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };
            if (editingProduct) {
                await api.put(`/admin/products/${editingProduct.id}`, submitData, config);
            } else {
                await api.post('/admin/products', submitData, config);
            }
            setShowProductModal(false);
            setEditingProduct(null);
            setImageFile(null);
            fetchDashboardData();
        } catch (err) {
            alert('Failed to save product. Ensure all fields are valid.');
        }
    };

    const handleSaveAccount = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('adminToken');
        try {
            await api.post('/admin/accounts', {
                product_id: parseInt(accountForm.product_id),
                account_url: accountForm.account_url,
                account_password: accountForm.account_password
            }, { headers: { Authorization: `Bearer ${token}` } });
            setShowAccountModal(false);
            setAccountForm({ product_id: '', account_url: '', account_password: '' });
            fetchDashboardData();
        } catch (err) {
            alert('Failed to save account. Check all fields.');
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!window.confirm('Delete this account?')) return;
        const token = localStorage.getItem('adminToken');
        try {
            await api.delete(`/admin/accounts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            showToast('Account deleted successfully');
            fetchDashboardData();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to delete account.', 'error');
        }
    };

    const handleDeactivateProduct = async (id) => {
        if (!window.confirm('Deactivate this product? It will be hidden from the storefront but all order history is preserved.')) return;
        const token = localStorage.getItem('adminToken');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        try {
            await api.patch(`/admin/products/${id}/deactivate`, {}, config);
            showToast('Product deactivated — hidden from storefront.');
            fetchDashboardData();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to deactivate product.', 'error');
        }
    };

    const handleReactivateProduct = async (id) => {
        const token = localStorage.getItem('adminToken');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        try {
            await api.patch(`/admin/products/${id}/reactivate`, {}, config);
            showToast('Product reactivated — visible on storefront.');
            fetchDashboardData();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to reactivate product.', 'error');
        }
    };

    const handleDeleteProduct = (id, name) => {
        setDeleteConfirm({ show: true, id, name });
    };

    const confirmDeleteProduct = async (id) => {
        setDeleteConfirm({ show: false, id: null, name: '' });
        const token = localStorage.getItem('adminToken');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        try {
            await api.delete(`/admin/products/${id}`, config);
            setProducts(prev => prev.filter(p => p.id !== id));
            showToast('Product deleted successfully.');
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to delete product.', 'error');
        }
    };

    const openProductModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({ name: product.name, description: product.description, price: product.price, image_url: product.image_url });
        } else {
            setEditingProduct(null);
            setFormData({ name: '', description: '', price: '', image_url: '' });
        }
        setImageFile(null);
        setShowProductModal(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
    };

    const renderDashboard = () => (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white mb-8">Overview Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue', value: `$${Number(stats.totalRevenue || 0).toFixed(2)}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
                    { label: 'Active Products', value: products.length, icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Total Orders', value: stats.totalOrders || 0, icon: ShoppingBag, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    { label: 'Conversion Rate', value: '8.4%', icon: Activity, color: 'text-pink-400', bg: 'bg-pink-500/10' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="glass-card rounded-2xl p-6 border border-white/5 relative overflow-hidden group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-sm font-medium text-slate-400 mb-1">{stat.label}</p>
                                <h3 className="text-3xl font-black text-white group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r from-blue-400 to-purple-400 transition-all">{stat.value}</h3>
                            </div>
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-800">
                            <div className={`h-full ${stat.bg.replace('/10', '')} w-${Math.floor(Math.random() * 40 + 40)}% rounded-r-full`}></div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Recent Orders Table */}
            <div className="glass-card rounded-2xl border border-white/5 mt-8 overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-purple-400" /> Recent Sales
                    </h3>
                    <button className="text-sm text-blue-400 hover:text-blue-300">View All</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs uppercase bg-white/5 text-slate-400 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4">Order ID</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.slice(0, 10).map((order, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-mono text-purple-400">#ORD-{order.id.toString().padStart(4, '0')}</td>
                                    <td className="px-6 py-4">{order.customer}</td>
                                    <td className="px-6 py-4 font-medium">{order.product}</td>
                                    <td className="px-6 py-4 font-bold text-white">${Number(order.price).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                            {order.status === 'paid' ? 'Paid & Delivered' : 'Pending Payment'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No recent sales found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderProducts = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white">Manage Products</h2>
                <button 
                    onClick={() => openProductModal()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" /> Add Product
                </button>
            </div>

            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-white/5 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-3 text-slate-500 w-5 h-5" />
                        <input type="text" placeholder="Search products..." className="w-full pl-12 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs uppercase bg-white/5 text-slate-400 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4">Image</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Stock</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p, i) => (
                                <tr key={i} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${p.status === 'inactive' ? 'opacity-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden">
                                            {p.image_url ?
                                                <img src={p.image_url.startsWith('/uploads/') ? `http://localhost:8000${p.image_url}` : p.image_url} className="w-full h-full object-cover" alt="" onError={(e) => e.target.style.display = 'none'} />
                                                : <ImageIcon className="w-5 h-5 text-slate-500" />
                                            }
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-white text-base">{p.name || 'Unknown Product'}</td>
                                    <td className="px-6 py-4 text-purple-400 font-bold">${Number(p.price).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold">{p.stock ?? 0} in stock</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {p.status === 'inactive'
                                            ? <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold">Inactive</span>
                                            : <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold">Active</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => openProductModal(p)} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors text-xs">Edit</button>
                                        {p.status === 'inactive'
                                            ? <button onClick={() => handleReactivateProduct(p.id)} className="px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors text-xs">Reactivate</button>
                                            : <button onClick={() => handleDeactivateProduct(p.id)} className="px-3 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors text-xs">Deactivate</button>
                                        }
                                        <button
                                            onClick={() => handleDeleteProduct(p.id, p.name)}
                                            className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded transition-colors text-xs flex items-center gap-1"
                                        >
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {products.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">No products found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderAccounts = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white">Account Stock</h2>
                <button
                    onClick={() => setShowAccountModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" /> Add Account
                </button>
            </div>

            {/* Stock overview per product */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {stock.map((s, i) => (
                    <div key={i} className="glass-card rounded-xl p-4 border border-white/5 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">{s.product_name}</p>
                            <p className="text-2xl font-black text-white">{s.available_stock}</p>
                            <p className="text-xs text-slate-500">available</p>
                        </div>
                        <Database className={`w-8 h-8 ${s.available_stock > 0 ? 'text-green-400' : 'text-red-400'}`} />
                    </div>
                ))}
            </div>

            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs uppercase bg-white/5 text-slate-400 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Account URL</th>
                                <th className="px-6 py-4">Password</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Sold To</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.map((a, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-bold text-white">{a.product_name}</td>
                                    <td className="px-6 py-4 text-blue-400 font-mono text-xs truncate max-w-[160px]">{a.account_url}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-300">{a.account_password}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${a.status === 'available' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">{a.sold_to_email || '—'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleDeleteAccount(a.id)} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors text-xs">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {accounts.length === 0 && (
                                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">No accounts in stock. Add some to start selling.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white mb-8">Customers Database</h2>
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="text-xs uppercase bg-white/5 text-slate-400 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Total Orders</th>
                            <th className="px-6 py-4">Total Spent</th>
                            <th className="px-6 py-4">Last Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((c, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                <td className="px-6 py-4 text-white font-bold">{c.email}</td>
                                <td className="px-6 py-4 text-blue-400 font-bold">{c.total_orders}</td>
                                <td className="px-6 py-4 text-green-400 font-bold">${Number(c.total_spent).toFixed(2)}</td>
                                <td className="px-6 py-4">{new Date(c.last_order).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {customers.length === 0 && <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No customers yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderContacts = () => (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white mb-8">Contact Messages</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {contacts.map((c, i) => (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 rounded-2xl border border-white/10 relative">
                        <h4 className="font-bold text-white mb-1">{c.name}</h4>
                        <a href={`mailto:${c.email}`} className="text-blue-400 text-sm block mb-4">{c.email}</a>
                        <p className="text-slate-300 text-sm whitespace-pre-wrap bg-slate-900/50 p-4 rounded-xl border border-white/5">{c.message}</p>
                        <button 
                            onClick={async () => {
                                await api.delete(`/admin/contacts/${c.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
                                fetchDashboardData();
                            }} 
                            className="absolute top-4 right-4 text-red-500 hover:text-red-400 text-xs"
                        >Delete</button>
                    </motion.div>
                ))}
                {contacts.length === 0 && <p className="text-slate-500">No new messages.</p>}
            </div>
        </div>
    );

    return (
        <>
        <div className="min-h-screen bg-slate-900 flex font-sans text-slate-300">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-slate-900/50 backdrop-blur-xl flex flex-col z-20 sticky top-0 h-screen">
                <div className="p-6 border-b border-white/10 flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Tag className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        AdminPanel
                    </span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-white/10 shadow-inner' : 'hover:bg-white/5 hover:text-white'}`}
                    >
                        <LayoutDashboard className="w-5 h-5" /> Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'products' ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-white/10 shadow-inner' : 'hover:bg-white/5 hover:text-white'}`}
                    >
                        <Package className="w-5 h-5" /> Products
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'users' ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-white/10 shadow-inner' : 'hover:bg-white/5 hover:text-white'}`}
                    >
                        <Users className="w-5 h-5" /> Customers
                    </button>
                    <button
                        onClick={() => setActiveTab('contacts')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'contacts' ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-white/10 shadow-inner' : 'hover:bg-white/5 hover:text-white'}`}
                    >
                        <Settings className="w-5 h-5" /> Messages
                    </button>
                    <button
                        onClick={() => setActiveTab('accounts')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'accounts' ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-white/10 shadow-inner' : 'hover:bg-white/5 hover:text-white'}`}
                    >
                        <Key className="w-5 h-5" /> Accounts
                    </button>
                </nav>

                <div className="p-4 border-t border-white/10 mt-auto">
                    <div className="glass-card rounded-xl p-4 mb-4 text-sm bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-purple-500/20">
                        <p className="text-white font-bold flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div> System Status</p>
                        <p className="text-xs text-slate-400">All services are running normally.</p>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-medium"
                    >
                        <LogOut className="w-5 h-5" /> Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                {/* Visual backdrops */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none -z-10"></div>
                <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -z-10"></div>

                {/* Header Profile */}
                <header className="flex justify-end items-center mb-10 pb-4 border-b border-white/5">
                    <div className="flex flex-col text-right mr-4">
                        <span className="text-white font-bold text-sm">Admin User</span>
                        <span className="text-xs text-green-400">Online</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 border-2 border-slate-800 shadow-lg cursor-pointer"></div>
                </header>

                {/* Dynamic Views */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'products' && renderProducts()}
                    {activeTab === 'users' && renderUsers()}
                    {activeTab === 'contacts' && renderContacts()}
                    {activeTab === 'accounts' && renderAccounts()}
                </motion.div>
                
                {/* Product Form Modal */}
                {showProductModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-800 border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative"
                        >
                            <h3 className="text-2xl font-bold text-white mb-6">
                                {editingProduct ? 'Edit Product' : 'Add New Product'}
                            </h3>
                            <form onSubmit={handleSaveProduct} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Product Name</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Description</label>
                                    <textarea required rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"></textarea>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Price ($)</label>
                                        <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Upload File / Image</label>
                                        <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500" />
                                        {formData.image_url && !imageFile && (
                                            <p className="text-xs text-slate-500 mt-2 truncate w-32 border border-white/5 bg-white/5 inline-block p-1 rounded">Prev: {formData.image_url.split('/').pop()}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-8">
                                    <button type="button" onClick={() => setShowProductModal(false)} className="px-5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors">Cancel</button>
                                    <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold transition-all shadow-lg">Save Product</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Add Account Modal */}
                {showAccountModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-800 border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative"
                        >
                            <h3 className="text-2xl font-bold text-white mb-6">Add Account to Stock</h3>
                            <form onSubmit={handleSaveAccount} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Product</label>
                                    <select required value={accountForm.product_id} onChange={e => setAccountForm({ ...accountForm, product_id: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500">
                                        <option value="">Select product...</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Account URL</label>
                                    <input type="text" required placeholder="https://..." value={accountForm.account_url} onChange={e => setAccountForm({ ...accountForm, account_url: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Password</label>
                                    <input type="text" required placeholder="Account password" value={accountForm.account_password} onChange={e => setAccountForm({ ...accountForm, account_password: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500" />
                                </div>
                                <div className="flex justify-end gap-3 mt-8">
                                    <button type="button" onClick={() => setShowAccountModal(false)} className="px-5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors">Cancel</button>
                                    <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold transition-all shadow-lg">Add Account</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </main>
        </div>

        {/* Toast Notification */}
        {toast.message && (
            <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border text-sm font-semibold backdrop-blur-xl transition-all ${
                toast.type === 'success'
                    ? 'bg-green-500/20 border-green-500/40 text-green-300'
                    : 'bg-red-500/20 border-red-500/40 text-red-300'
            }`}>
                {toast.type === 'success'
                    ? (<CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />)
                    : (<XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />)
                }
                <span>{toast.message}</span>
            </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm.show && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-800 border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl"
                >
                    <div className="flex items-center gap-4 mb-5">
                        <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                            <Trash2 className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Delete Product</h3>
                            <p className="text-sm text-slate-400 mt-0.5">This action cannot be undone.</p>
                        </div>
                    </div>
                    <p className="text-slate-300 mb-7 leading-relaxed">
                        Are you sure you want to delete{' '}
                        <span className="font-bold text-white">"{deleteConfirm.name}"</span>?
                        <br />
                        <span className="text-sm text-slate-400">All associated account stock will also be permanently removed.</span>
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setDeleteConfirm({ show: false, id: null, name: '' })}
                            className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => confirmDeleteProduct(deleteConfirm.id)}
                            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Product
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
    </>
    );
}

export default AdminDashboard;
