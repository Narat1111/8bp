import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, CheckCircle, ShieldCheck, X, TrendingUp, Search, Lock, LogOut } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const api = axios.create({
    baseURL: 'http://localhost:8000/api'
});

function Home() {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [email, setEmail] = useState('');
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchaseResult, setPurchaseResult] = useState(null);
    const [error, setError] = useState(null);
    const [qrCodeData, setQrCodeData] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; }
    });

    const handleUserLogout = () => {
        setUser(null);
        localStorage.removeItem('user');
        setEmail('');
    };

    useEffect(() => {
        // Fetch products
        api.get('/products')
            .then(res => setProducts(res.data))
            .catch(err => console.error("Error fetching products", err));
    }, []);

    // Use actual database products conditionally filtering by search query
    const displayProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePurchase = async (e) => {
        e.preventDefault();
        setError(null);
        setIsPurchasing(true);
        setPaymentStatus('Generating QR...');
        const deliveryEmail = user ? user.email : email;
        try {
            // 1. Create the pending order first
            setPaymentStatus('Creating order...');
            const authHeader = user?.jwt_token ? { Authorization: `Bearer ${user.jwt_token}` } : {};
            const orderRes = await api.post('/orders', { 
                product_id: selectedProduct.id, 
                price: selectedProduct.price,
                customer_email: deliveryEmail
            }, { headers: authHeader });
            const order_id = orderRes.data.id;

            // 2. Generate Payment QR attached to this specific order ID
            setPaymentStatus('Generating QR...');
            const res = await api.post('/payment/generate', { productId: selectedProduct.id, email: deliveryEmail, order_id });
            setQrCodeData({
                qrUrl: res.data.qrUrl,
                md5: res.data.md5
            });
            setPaymentStatus('Checking payment status...');
        } catch (err) {
            setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to generate QR Code. Try again.');
        } finally {
            setIsPurchasing(false);
        }
    };

    useEffect(() => {
        if (!qrCodeData) return;
        
        // Polling the actual backend endpoint
        let interval;
        const checkPayment = async () => {
            try {
                const res = await api.get(`/payment/check?md5=${qrCodeData.md5}`);
                if (res.data.status === 'PAID') {
                    clearInterval(interval);
                    setPaymentStatus('PAID');

                    if (res.data.delivered) {
                        setPurchaseResult({
                            type: 'account',
                            message: 'Payment Successful! Your account is ready.',
                            account_url: res.data.account_url,
                            account_password: res.data.account_password
                        });
                    } else if (res.data.licenseKey) {
                        setPurchaseResult({
                            type: 'license',
                            message: 'Payment Successful! Your license key is below.',
                            licenseKey: res.data.licenseKey
                        });
                    } else if (res.data.error) {
                        setError(res.data.error);
                    }
                }
            } catch (err) {
                console.error("Payment check error:", err);
            }
        };

        interval = setInterval(checkPayment, 3000);

        return () => clearInterval(interval);
    }, [qrCodeData]);

    const closeModal = () => {
        setSelectedProduct(null);
        setPurchaseResult(null);
        setQrCodeData(null);
        setPaymentStatus(null);
        setError(null);
        setEmail('');
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            const name = document.getElementById('contactName').value;
            const email = document.getElementById('contactEmail').value;
            const message = document.getElementById('contactMessage').value;
            await api.post('/contact', { name, email, message });
            alert('Your message was securely sent. We will get back to you shortly.');
            e.target.reset();
        } catch (err) {
            alert('Failed to send message: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 overflow-x-hidden font-sans">
            {/* Dynamic Background Elements */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]"></div>
            </div>

            {/* Navbar */}
            <nav className="relative z-10 glass sticky top-0 px-6 py-4 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-blue-500 w-8 h-8" />
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        SocialKeys
                    </span>
                </div>
                <div className="hidden md:flex gap-6 text-sm font-medium text-slate-300">
                    <a href="#home" className="hover:text-white transition-colors">Home</a>
                    <a href="#product" className="hover:text-white transition-colors">Product</a>
                    <a href="#contact" className="hover:text-white transition-colors">Contact</a>
                </div>
                <div className="flex items-center gap-4">
                    {user ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-white font-medium hidden md:block">{user.name}</span>
                            <Link
                                to="/my-orders"
                                className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                My Orders
                            </Link>
                            <button
                                onClick={handleUserLogout}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                <LogOut className="w-4 h-4" /> Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link to="/login" className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-sm font-medium transition-colors">
                                Login
                            </Link>
                            <Link to="/signup" className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-purple-500/20">
                                Sign Up
                            </Link>
                        </div>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-20 lg:py-24">
                <div id="home" className="text-center max-w-3xl mx-auto mb-16 scroll-mt-24">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6"
                    >
                        Unlock Premium <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                            Social Media Assets
                        </span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto"
                    >
                        Instantly purchase verified, aged, and premium social media accounts. Instant delivery, 100% secure transfer, with a 30-day guarantee.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-center gap-4"
                    >
                        <div className="relative w-full max-w-md">
                            <input
                                type="text"
                                placeholder="Search accounts (e.g., TikTok with 10k)..."
                                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Search className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                        </div>
                    </motion.div>
                </div>

                {/* Product Grid */}
                <div id="product" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 scroll-mt-24 mb-24">
                    {displayProducts.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 * index }}
                            className={`glass-card rounded-2xl overflow-hidden transition-colors duration-300 group flex flex-col ${
                                product.stock > 0
                                    ? 'hover:border-purple-500/50 cursor-pointer'
                                    : 'opacity-60 cursor-not-allowed'
                            }`}
                            onClick={() => product.stock > 0 && setSelectedProduct(product)}
                        >
                            <div className="h-48 overflow-hidden relative">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10"></div>
                                {/* Fallback gradients if no image */}
                                {product.image_url ? (
                                    <img
                                        src={product.image_url.startsWith('/uploads/') ? `http://localhost:8000${product.image_url}` : product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600"></div>
                                )}
                                <div className="absolute top-4 right-4 z-20 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-white/10 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3 text-green-400" /> High Demand
                                </div>
                            </div>
                            <div className="p-6 flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold mb-2 text-white group-hover:text-purple-400 transition-colors">{product.name}</h3>
                                    <p className="text-sm text-slate-400 mb-6">{product.description}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-black text-white">${Number(product.price).toFixed(2)}</span>
                                    {product.stock > 0 ? (
                                        <button
                                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium shadow-lg shadow-purple-500/20 transform transition group-hover:-translate-y-1"
                                        >
                                            Buy Now
                                        </button>
                                    ) : (
                                        <button
                                            disabled
                                            className="px-5 py-2.5 bg-slate-700 text-slate-500 rounded-lg font-medium cursor-not-allowed"
                                        >
                                            Out of Stock
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </main>

            {/* Contact Section */}
            <section id="contact" className="relative z-10 max-w-3xl mx-auto px-6 py-12 scroll-mt-24">
                <div className="glass-card rounded-2xl p-8 text-center">
                    <h2 className="text-3xl font-bold mb-4 text-white">Get in Touch</h2>
                    <p className="text-slate-400 mb-8">Need help or have a custom request? Send us a message.</p>
                    <form className="flex flex-col gap-4" onSubmit={handleContactSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" id="contactName" required placeholder="Your Name" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-500" />
                            <input type="email" id="contactEmail" required placeholder="Your Email" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-500" />
                        </div>
                        <textarea id="contactMessage" required placeholder="Your Message" rows="4" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-500"></textarea>
                        <button type="submit" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-1">
                            Send Message
                        </button>
                    </form>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/10 mt-20 py-8 px-6 text-center text-slate-500 text-sm">
                <p>&copy; 2026 SocialKeys Inc. All rights reserved.</p>
                <p className="mt-2 text-xs opacity-60">This platform provides account management tools for educational purposes.</p>
            </footer>

            {/* Checkout Modal */}
            <AnimatePresence>
                {selectedProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
                            onClick={closeModal}
                        ></motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <button
                                onClick={closeModal}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {purchaseResult ? (
                                <div className="p-8 text-center flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">Order Confirmed!</h3>
                                    <p className="text-slate-400 mb-6">{purchaseResult.message}</p>

                                    {purchaseResult.type === 'account' ? (
                                        <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-green-500/20 mb-6 text-left space-y-3">
                                            {purchaseResult.account_url ? (
                                                <>
                                                    <div>
                                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Account URL</p>
                                                        <code className="block bg-black p-2.5 rounded-lg text-blue-400 font-mono text-sm break-all">{purchaseResult.account_url}</code>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Password</p>
                                                        <code className="block bg-black p-2.5 rounded-lg text-green-400 font-mono text-sm break-all">{purchaseResult.account_password}</code>
                                                    </div>
                                                    <p className="text-xs text-slate-400 pt-1">These credentials have also been sent to your email. Save them now!</p>
                                                    {user && (
                                                        <Link to="/my-orders" className="block text-center text-xs text-purple-400 hover:text-purple-300 underline pt-1" onClick={closeModal}>View in My Orders</Link>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                                                        <Lock className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <p className="text-white font-semibold mb-1 text-center">Account details sent securely</p>
                                                    <p className="text-sm text-slate-400 text-center">Check your inbox. The credentials have been delivered to your email address.</p>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-white/5 mb-6 text-left">
                                            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Your License Key</p>
                                            <code className="block bg-black p-3 rounded-lg text-green-400 font-mono text-lg text-center break-all shadow-inner">
                                                {purchaseResult.licenseKey}
                                            </code>
                                        </div>
                                    )}

                                    <button
                                        onClick={closeModal}
                                        className="w-full py-3 bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-xl transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : qrCodeData || isPurchasing ? (
                                <div className="p-8 text-center flex flex-col items-center">
                                    <h3 className="text-xl font-bold text-red-400 mb-6 uppercase tracking-wider">Scan QR to Pay</h3>

                                    {qrCodeData ? (
                                        <div className="mb-6 bg-white p-3 rounded-2xl shadow-xl inline-block mx-auto border border-white/20">
                                            <img src={qrCodeData.qrUrl} alt="QR Code" width="220" className="rounded block object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-64 h-64 flex items-center justify-center border-2 border-dashed border-slate-600 rounded-2xl mb-6 bg-slate-800/50">
                                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full" />
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 text-slate-300 font-medium">
                                        {paymentStatus !== 'PAID' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full flex-shrink-0" />}
                                        <p>{paymentStatus || 'Generating QR...'}</p>
                                    </div>

                                    <button onClick={closeModal} className="mt-8 px-8 py-2.5 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors font-medium">
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="h-32 relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-purple-600/30"></div>
                                        <img
                                            src={(selectedProduct.image_url && selectedProduct.image_url.startsWith('http')) ? selectedProduct.image_url : ''}
                                            className="w-full h-full object-cover mix-blend-overlay"
                                            alt=""
                                        />
                                        <div className="absolute bottom-4 left-6">
                                            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-1 rounded text-xs font-bold uppercase backdrop-blur-sm">
                                                Instant Delivery
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <h3 className="text-xl font-bold mb-1">{selectedProduct.name}</h3>
                                        <p className="text-2xl font-black text-purple-400 mb-6">${Number(selectedProduct.price).toFixed(2)}</p>

                                        <form onSubmit={handlePurchase}>
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-slate-400 mb-2">Delivery Email</label>
                                                {user ? (
                                                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-purple-500/40 rounded-xl">
                                                        <span className="text-white text-sm truncate">{user.email}</span>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="email"
                                                        required
                                                        value={email}
                                                        onChange={e => setEmail(e.target.value)}
                                                        className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                                                        placeholder="you@example.com"
                                                    />
                                                )}
                                                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3" /> Details will be sent securely to this email.
                                                </p>
                                            </div>

                                            {error && (
                                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                                    {error}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={isPurchasing}
                                                className="w-full py-4 mt-2 bg-gradient-to-r from-pink-600 to-red-500 hover:from-pink-500 hover:to-red-400 text-white font-bold rounded-xl shadow-lg shadow-pink-500/20 transition-all focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                            >
                                                Generate QR Code
                                            </button>
                                        </form>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Home;
