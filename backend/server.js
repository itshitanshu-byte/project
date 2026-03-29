const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const JWT_SECRET = 'studentprint_secret_key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studentprint';

app.use(cors());
app.use(express.json());

// Log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
mongoose.connect(MONGO_URI).then(() => console.log('MongoDB connected')).catch(err => console.error(err));

// Schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  fileName: String,
  pages: Number,
  printType: { type: String, default: 'bw' },
  bwPages: { type: Number, default: 0 },
  colourPages: { type: Number, default: 0 },
  copies: Number,
  packageType: String,
  softBinding: Boolean,
  spiralBinding: Boolean,
  deliveryDate: String,
  deliveryTime: String,
  paymentMethod: String,
  upiId: String,
  totalPrice: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  plan: String, // Monthly, Quarterly, Half-Yearly, Yearly
  pagesAllowed: Number,
  pagesUsed: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: Date,
  createdAt: { type: Date, default: Date.now }
});
const Subscription = mongoose.model('Subscription', subscriptionSchema);

// File upload config
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin credentials (change these)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_PLAIN = 'admin@123';

// Admin auth middleware
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error();
    next();
  } catch {
    res.status(401).json({ message: 'Invalid admin token' });
  }
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

app.post('/api/orders', auth, upload.single('file'), async (req, res) => {
  const { copies, pages, printType, bwPages, colourPages, packageType, softBinding, spiralBinding, deliveryDate, deliveryTime, paymentMethod, upiId, totalPrice } = req.body;
  const order = await Order.create({
    userId: req.user.id,
    fileName: req.file?.filename || null,
    pages: parseInt(pages) || 0,
    printType: printType || 'bw',
    bwPages: parseInt(bwPages) || 0,
    colourPages: parseInt(colourPages) || 0,
    copies, packageType,
    softBinding: softBinding === 'true',
    spiralBinding: spiralBinding === 'true',
    deliveryDate, deliveryTime, paymentMethod, upiId,
    totalPrice: parseFloat(totalPrice) || 0
  });
  if (['Monthly','Quarterly','Half-Yearly','Yearly'].includes(packageType)) {
    await Subscription.findOneAndUpdate(
      { userId: req.user.id, plan: packageType, endDate: { $gt: new Date() } },
      { $inc: { pagesUsed: parseInt(pages) * parseInt(copies) || 0 } }
    );
  }
  res.json({ message: 'Order placed successfully!', order });
});

app.get('/api/orders', auth, async (req, res) => {
  const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(orders);
});

// Admin: get all orders with user info
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).lean();
  const userIds = [...new Set(orders.map(o => o.userId?.toString()))];
  const users = await User.find({ _id: { $in: userIds } }, 'name email').lean();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
  const result = orders.map(o => ({ ...o, user: userMap[o.userId?.toString()] || null }));
  res.json(result);
});

// Admin login route
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD_PLAIN) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  res.status(401).json({ message: 'Invalid username or password' });
});

// Subscribe to a plan
app.post('/api/subscribe', auth, async (req, res) => {
  const { plan } = req.body;
  const PLANS = {
    'Monthly':     { pages: 500,  months: 1 },
    'Quarterly':   { pages: 1500, months: 3 },
    'Half-Yearly': { pages: 3000, months: 6 },
    'Yearly':      { pages: 6000, months: 12 }
  };
  if (!PLANS[plan]) return res.status(400).json({ message: 'Invalid plan' });
  const existing = await Subscription.findOne({ userId: req.user.id, endDate: { $gt: new Date() } });
  if (existing) return res.status(400).json({ message: 'You already have an active subscription' });
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + PLANS[plan].months);
  const sub = await Subscription.create({
    userId: req.user.id,
    plan,
    pagesAllowed: PLANS[plan].pages,
    endDate
  });
  res.json({ message: 'Subscribed successfully!', subscription: sub });
});

// Get current user's active subscription
app.get('/api/my-subscription', auth, async (req, res) => {
  const sub = await Subscription.findOne({ userId: req.user.id, endDate: { $gt: new Date() } }).sort({ createdAt: -1 });
  res.json(sub || null);
});

// Cancel active subscription
app.delete('/api/my-subscription', auth, async (req, res) => {
  const sub = await Subscription.findOneAndDelete({ userId: req.user.id, endDate: { $gt: new Date() } });
  if (!sub) return res.status(404).json({ message: 'No active subscription found' });
  res.json({ message: 'Subscription cancelled successfully' });
});

// Admin: get all subscriptions with user info
app.get('/api/admin/subscriptions', adminAuth, async (req, res) => {
  const subs = await Subscription.find().sort({ createdAt: -1 }).lean();
  const userIds = [...new Set(subs.map(s => s.userId?.toString()))];
  const users = await User.find({ _id: { $in: userIds } }, 'name email').lean();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
  res.json(subs.map(s => ({ ...s, user: userMap[s.userId?.toString()] || null })));
});

// Admin: cancel a subscription by id
app.delete('/api/admin/subscriptions/:id', adminAuth, async (req, res) => {
  const sub = await Subscription.findByIdAndDelete(req.params.id);
  if (!sub) return res.status(404).json({ message: 'Subscription not found' });
  res.json({ message: 'Subscription cancelled successfully' });
});

// Admin: update order status
app.patch('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  res.json(order);
});

// Admin: delete an order
app.delete('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json({ message: 'Order deleted successfully' });
});

// Admin: get all users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  const subs = await Subscription.find({ endDate: { $gt: new Date() } }).lean();
  const activeSubMap = Object.fromEntries(subs.map(s => [s.userId.toString(), s]));
  const orders = await Order.find().lean();
  const orderCountMap = {};
  orders.forEach(o => { const k = o.userId?.toString(); orderCountMap[k] = (orderCountMap[k] || 0) + 1; });
  res.json(users.map(u => ({
    ...u,
    activeSub: activeSubMap[u._id.toString()] || null,
    orderCount: orderCountMap[u._id.toString()] || 0
  })));
});

// Admin: delete a user
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  await Order.deleteMany({ userId: req.params.id });
  await Subscription.deleteMany({ userId: req.params.id });
  res.json({ message: 'User deleted successfully' });
});

app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
