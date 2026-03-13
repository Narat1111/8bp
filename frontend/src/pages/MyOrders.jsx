import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Package, LogOut } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:8000/api' });

function MyOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (!stored) {
            navigate('/');
            return;
        }
        const parsed = JSON.parse(stored);
        setUser(parsed);

        api.get('/user/orders', {
            headers: { Authorization: `Bearer ${parsed.jwt_token}` }
        })
            .then(res => setOrders(res.data))
            .catch(() => setError('Failed to load orders. Please try again.'))
            .finally(() => setLoading(false));
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Navbar */}
            <nav className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-white/10 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-blue-500 w-7 h-7" />
                    <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        SocialKeys
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to Store
                    </Link>
                    {user && (
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            <LogOut className="w-4 h-4" /> Sign out
                        </button>
                    )}
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 py-10">
                <h1 className="text-2xl font-bold mb-2">My Orders</h1>
                {user && <p className="text-slate-400 text-sm mb-8">{user.email}</p>}

                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full"
                        />
                    </div>
                )}

                {error && (
                    <div className="text-center py-16 text-red-400">{error}</div>
                )}

                {!loading && !error && orders.length === 0 && (
                    <div className="text-center py-24 text-slate-500">
                        <Package className="w-14 h-14 mx-auto mb-4 opacity-40" />
                        <p className="text-lg font-medium">No orders yet</p>
                        <p className="text-sm mt-1">Your purchases will appear here after checkout.</p>
                        <Link to="/" className="inline-block mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors">
                            Browse Products
                        </Link>
                    </div>
                )}

                {!loading && orders.length > 0 && (
                    <div className="space-y-4">
                        {orders.map(order => (
                            <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900/60 border border-white/8 rounded-2xl p-5"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-semibold text-white">{order.product_name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-white">${Number(order.amount).toFixed(2)}</p>
                                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                                            order.status === 'paid'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>

                                {(order.delivered_account_url || order.delivered_account_password) && (
                                    <div className="mt-3 bg-black/40 rounded-xl p-4 space-y-2.5 border border-white/5">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Account Credentials</p>
                                        {order.delivered_account_url && (
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">URL / Username</p>
                                                <code className="block bg-slate-950 px-3 py-2 rounded-lg text-blue-400 font-mono text-sm break-all">
                                                    {order.delivered_account_url}
                                                </code>
                                            </div>
                                        )}
                                        {order.delivered_account_password && (
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Password</p>
                                                <code className="block bg-slate-950 px-3 py-2 rounded-lg text-green-400 font-mono text-sm break-all">
                                                    {order.delivered_account_password}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default MyOrders;
