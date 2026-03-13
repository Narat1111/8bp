import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await axios.post(`${API_BASE}/api/admin/login`, {
                username,
                password
            });

            // Save token
            localStorage.setItem('adminToken', res.data.token);
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to connect to server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans relative overflow-hidden">
            {/* Dynamic Background Elements */}
            <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md glass-card rounded-3xl p-8 relative z-10 border border-white/10"
            >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
                    <Lock className="w-8 h-8 text-white" />
                </div>

                <h2 className="text-3xl font-extrabold text-center text-white mb-2">Admin Portal</h2>
                <p className="text-center text-slate-400 mb-8">Sign in to manage your marketplace.</p>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-500 transition-all"
                                placeholder="Username"
                            />
                            <User className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <div className="relative">
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-500 transition-all"
                                placeholder="Password"
                            />
                            <Lock className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
                        </div>
                    </div>

                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20"
                        >
                            {error}
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 transition-transform hover:-translate-y-1 flex justify-center items-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Authenticating...' : 'Secure Login'}
                        {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button onClick={() => navigate('/')} className="text-slate-500 text-sm hover:text-white transition-colors">
                        &larr; Back to Marketplace
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

export default AdminLogin;
