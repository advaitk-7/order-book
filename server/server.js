const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/order_book";

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const JWT_SECRET = process.env.JWT_SECRET || "liberty_uniform_secret_key_12345";
let ADMIN_USERNAME = process.env.ADMIN_USERNAME || "sarju";
let currentAdminPassword = process.env.ADMIN_PASSWORD || "1";

const Session = mongoose.model("Session", new mongoose.Schema({
  token: { type: String, required: true, index: true },
  username: { type: String, required: true },
  userAgent: { type: String, default: 'Unknown Device' },
  ipAddress: { type: String, default: 'Unknown IP' },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}));

function parseUserAgent(ua) {
  if (!ua) return 'Unknown Device';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  if (/like Mac OS X/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Macintosh/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (/Chrome/.test(ua) && !/Chromium/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Edg/.test(ua)) browser = 'Edge';
  else if (/Trident/.test(ua)) browser = 'Internet Explorer';

  return `${browser} on ${os}`;
}

const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, async (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }
      try {
        const session = await Session.findOne({ token });
        if (!session) {
          return res.status(401).json({ message: "Session expired or logged out" });
        }
        session.lastActive = new Date();
        session.save().catch(() => {});

        req.user = user;
        req.token = token;
        next();
      } catch (error) {
        res.status(500).json({ message: "Auth server database error" });
      }
    });
  } else {
    res.status(401).json({ message: "Authorization token required" });
  }
};

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['Male', 'Female'], required: true },
    school: { type: String, required: true, trim: true },
    deliveryDate: { type: String, required: true },
    amount: { type: Number, required: true },
      paymentStatus: { type: String, enum: ["Paid", "Unpaid"], default: "Unpaid" },
      status: { type: String, enum: ["Pending", "Ready", "Delivered"], default: "Pending" },
      deliveredAt: { type: Date },
    contactStatus: { type: String, enum: ["Not contacted", "Contacted", "Unable to contact"], default: "Not contacted" },
    items: [
      {
        itemType: { type: String, enum: ["shirt", "pant", "pina"], required: true },
        quantity: { type: Number, required: true },
        measurements: {
          length: String,
          chest: String,
          shoulder: String,
          sleeve: String,
          neck: String,
          waist: String,
          seat: String,
          thighs: String,
          bottom: String,
          torsoLength: String,
        },
      },
    ],
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true }
});
const Admin = mongoose.model("Admin", adminSchema);

const auditLogSchema = new mongoose.Schema({
  orderId: mongoose.Schema.Types.ObjectId,
  orderNumber: String,
  action: { type: String, required: true },
  details: String,
  performedBy: { type: String, default: "Admin" }
}, { timestamps: true });
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);

// TTL index: automatically remove orders 25 days after they were marked Delivered
orderSchema.index({ deliveredAt: 1 }, { expireAfterSeconds: 2160000 });

if (process.env.NODE_ENV !== "production") {
  app.get("/", (req, res) => {
    res.send("School uniform order book server is running...");
  });
}

// Auth Routes
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, currentAdminPassword)) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" });

    const rawUa = req.headers['user-agent'] || 'Unknown User-Agent';
    const userAgent = parseUserAgent(rawUa);

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
    const ipAddress = rawIp.split(',')[0].trim();

    try {
      await Session.create({
        token,
        username,
        userAgent,
        ipAddress
      });
      await logAudit(null, "System", "Login Success", `User logged in from ${userAgent} (IP: ${ipAddress})`);
    } catch (err) {
      console.error("Failed to store session:", err);
    }

    return res.json({ token });
  }
  return res.status(401).json({ message: "Invalid username or password" });
});

let currentOTP = null;
let otpExpiry = 0;

app.post("/api/auth/forgot-password", async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram environment variables are missing");
    return res.status(500).json({ message: "Server configuration error: Telegram bot keys are missing." });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  currentOTP = code;
  otpExpiry = Date.now() + 5 * 60 * 1000;

  try {
    const text = `🔑 *Liberty Uniform*\n\nYour Admin Username is: *${ADMIN_USERNAME}*\nYour password recovery code is: *${code}*\n\nThis OTP is valid for 5 minutes.`;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown"
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error("Telegram sendMessage failed:", data);
      return res.status(502).json({ message: "Failed to deliver OTP message via Telegram." });
    }

    res.json({ message: "OTP sent successfully to your Telegram bot!" });
  } catch (error) {
    console.error("Error dispatching Telegram message:", error);
    res.status(500).json({ message: "Internal server error while sending OTP." });
  }
});

app.post("/api/auth/verify-otp", (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ message: "Verification code is required." });
  }

  if (Date.now() > otpExpiry) {
    currentOTP = null;
    return res.status(400).json({ message: "The verification code has expired. Please request a new one." });
  }

  if (code === currentOTP) {
    const resetToken = jwt.sign({ resetAllowed: true }, JWT_SECRET, { expiresIn: "5m" });
    currentOTP = null;
    return res.json({ resetToken });
  }

  return res.status(400).json({ message: "Invalid verification code. Please check your phone." });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ message: "Missing token or password." });
  }

  try {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.resetAllowed) {
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      currentAdminPassword = hashedPassword;
      Admin.updateOne({}, { password: hashedPassword }).catch(err => console.error("DB update error:", err));
      return res.json({ message: "Password updated successfully" });
    }
    return res.status(403).json({ message: "Reset permission denied." });
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired reset token." });
  }
});

app.get("/api/auth/me", authenticateJWT, (req, res) => {
  res.json({ username: ADMIN_USERNAME });
});

app.post("/api/auth/verify-current-password", authenticateJWT, (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }

  if (bcrypt.compareSync(password, currentAdminPassword)) {
    const accountEditToken = jwt.sign({ accountEditAllowed: true }, JWT_SECRET, { expiresIn: "5m" });
    return res.json({ accountEditToken });
  }

  return res.status(400).json({ message: "Incorrect password." });
});

app.post("/api/auth/update-credentials", authenticateJWT, (req, res) => {
  const { accountEditToken, newUsername, newPassword } = req.body;
  if (!accountEditToken || !newUsername || !newPassword) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    const decoded = jwt.verify(accountEditToken, JWT_SECRET);
    if (decoded.accountEditAllowed) {
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      ADMIN_USERNAME = newUsername;
      currentAdminPassword = hashedPassword;
      Admin.updateOne({}, { username: newUsername, password: hashedPassword }).catch(err => console.error("DB update error:", err));
      return res.json({ message: "Credentials updated successfully" });
    }
    return res.status(403).json({ message: "Permission denied." });
  } catch (err) {
    return res.status(403).json({ message: "Verification session expired. Please re-verify password." });
  }
});

app.get("/api/auth/sessions", authenticateJWT, async (req, res) => {
  try {
    const sessions = await Session.find({ username: req.user.username })
      .sort({ lastActive: -1 });

    const formatted = sessions.map(s => ({
      id: s._id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastActive: s.lastActive,
      isCurrent: s.token === req.token
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch active sessions", error: error.message });
  }
});

app.delete("/api/auth/sessions/:id", authenticateJWT, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.username !== req.user.username) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Session.findByIdAndDelete(req.params.id);
    await logAudit(null, "System", "Device Logged Out", `Session ${session.userAgent} (IP: ${session.ipAddress}) revoked by user`);
    res.json({ message: "Device session logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to revoke session", error: error.message });
  }
});

app.post("/api/auth/sessions/logout-others", authenticateJWT, async (req, res) => {
  try {
    const result = await Session.deleteMany({
      username: req.user.username,
      token: { $ne: req.token }
    });

    await logAudit(null, "System", "Device Bulk Logout", `Logged out ${result.deletedCount} other device sessions`);
    res.json({ message: `Successfully logged out ${result.deletedCount} other devices` });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear other sessions", error: error.message });
  }
});

// Input validation helper
const validateOrderPayload = (payload) => {
  if (payload.contactNumber !== undefined) {
    const contact = String(payload.contactNumber).trim();
    if (!/^\d{10}$/.test(contact)) {
      return "Contact number must be exactly 10 digits.";
    }
  }
  if (payload.amount !== undefined) {
    const amount = Number(payload.amount);
    if (isNaN(amount) || amount < 0) {
      return "Amount cannot be negative.";
    }
  }
  if (payload.deliveryDate !== undefined) {
    const dateStr = String(payload.deliveryDate).trim();
    if (!dateStr || isNaN(Date.parse(dateStr))) {
      return "Delivery date must be a valid date.";
    }
  }
  return null;
};

// Audit Log logging helper
const logAudit = async (orderId, orderNumber, action, details, performedBy = "Admin") => {
  try {
    await AuditLog.create({
      orderId,
      orderNumber,
      action,
      details,
      performedBy
    });
  } catch (err) {
    console.error("Failed to save audit log:", err.message);
  }
};

// Database backups configuration
const BACKUP_DIR = path.join(__dirname, "backups");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const performBackup = async () => {
  try {
    const orders = await Order.find({});
    const admins = await Admin.find({});
    const auditLogs = await AuditLog.find({});

    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      orders,
      admins,
      auditLogs
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const compressed = zlib.gzipSync(jsonStr);

    const now = new Date();
    // Shift UTC time to India Standard Time (UTC +5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = monthNames[istTime.getUTCMonth()];
    const year = istTime.getUTCFullYear();
    
    let rawHours = istTime.getUTCHours();
    const ampm = rawHours >= 12 ? 'PM' : 'AM';
    let hours12 = rawHours % 12;
    hours12 = hours12 ? hours12 : 12;
    const hours = String(hours12).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');

    const filename = `liberty_backup_${day}-${month}-${year}_at_${hours}-${minutes}-${seconds}-${ampm}.json.gz`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, compressed);
    console.log(`Auto database backup created successfully: ${filename}`);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      const caption = `💾 *Liberty Uniform - Auto Backup*\n\nDatabase backup successfully created:\n\`${filename}\`\n\n- Orders: ${orders.length}\n- Logs: ${auditLogs.length}`;
      
      const formData = new FormData();
      formData.append("chat_id", chatId);
      
      const fileBlob = new Blob([compressed], { type: "application/x-gzip" });
      formData.append("document", fileBlob, filename);
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");

      const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
      fetch(url, {
        method: "POST",
        body: formData
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(errData => {
            console.error("Telegram document upload failed response:", errData);
          });
        }
      })
      .catch(err => console.error("Failed to send Telegram backup document:", err.message));
    }

    return { filename, size: compressed.length };
  } catch (error) {
    console.error("Backup creation failed:", error.message);
    throw error;
  }
};

const restoreBackup = async (compressedBuffer) => {
  try {
    const decompressed = zlib.gunzipSync(compressedBuffer);
    const backupData = JSON.parse(decompressed.toString());

    if (!backupData.orders || !backupData.admins) {
      throw new Error("Invalid backup file format: Missing orders or admins collection.");
    }

    await Order.deleteMany({});
    await Admin.deleteMany({});
    await AuditLog.deleteMany({});

    if (backupData.orders.length > 0) {
      await Order.insertMany(backupData.orders);
    }
    if (backupData.admins.length > 0) {
      await Admin.insertMany(backupData.admins);
    }
    if (backupData.auditLogs && backupData.auditLogs.length > 0) {
      await AuditLog.insertMany(backupData.auditLogs);
    }

    console.log("Database backup restored successfully.");
    return {
      ordersCount: backupData.orders.length,
      adminsCount: backupData.admins.length,
      auditLogsCount: (backupData.auditLogs || []).length
    };
  } catch (error) {
    console.error("Restore failed:", error.message);
    throw error;
  }
};

// Schedule automatic daily backup (every 24 hours)
setInterval(async () => {
  try {
    await performBackup();
  } catch (err) {
    console.error("Scheduled backup failed", err);
  }
}, 24 * 60 * 60 * 1000);

// Protect all order endpoints
app.use("/api/orders", authenticateJWT);

app.post("/api/orders", async (req, res) => {
  const payload = req.body;

  if (!payload.orderNumber || !payload.customerName || !payload.contactNumber || !payload.gender || !payload.school || !payload.deliveryDate) {
    return res.status(400).json({ message: "Please fill in the required order fields." });
  }

  const validationError = validateOrderPayload(payload);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const existingOrder = await Order.findOne({ orderNumber: payload.orderNumber.trim() });
    if (existingOrder) {
      return res.status(409).json({ message: "This order number already exists." });
    }

    const newOrder = new Order({
      ...payload,
      orderNumber: payload.orderNumber.trim(),
      amount: Number(payload.amount || 0),
      paymentStatus: payload.paymentStatus || 'Unpaid',
      deliveredAt: payload.status === 'Delivered' ? new Date() : undefined,
      contactStatus: payload.contactStatus || 'Not contacted',
      items: (payload.items || []).map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
      })),
    });

    await newOrder.save();
    await logAudit(newOrder._id, newOrder.orderNumber, "Create", `Order created for customer '${newOrder.customerName}'`);
    res.status(201).json({ message: "Order saved successfully", order: newOrder });
  } catch (error) {
    console.error("Error saving order:", error.message);
    res.status(500).json({ message: "Failed to save order", error: error.message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const query = search
      ? {
          $or: [
            { orderNumber: { $regex: search, $options: "i" } },
            { customerName: { $regex: search, $options: "i" } },
            { school: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
});

app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const oldOrder = await Order.findById(req.params.id);
    if (!oldOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updates = { status };
    if (status === 'Delivered') {
      updates.deliveredAt = new Date();
    } else {
      // clear deliveredAt if status changed away from Delivered
      updates.deliveredAt = null;
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (status !== oldOrder.status) {
      await logAudit(order._id, order.orderNumber, "Status Change", `Status changed from '${oldOrder.status}' to '${status}'`);
    }

    res.json(order);
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({ message: "Failed to update status", error: error.message });
  }
});

app.patch("/api/orders/:id/contact-status", async (req, res) => {
  try {
    const { contactStatus } = req.body;
    const oldOrder = await Order.findById(req.params.id);
    if (!oldOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = await Order.findByIdAndUpdate(req.params.id, { contactStatus }, { new: true });
    if (contactStatus !== oldOrder.contactStatus) {
      await logAudit(order._id, order.orderNumber, "Contact Change", `Contact status changed from '${oldOrder.contactStatus}' to '${contactStatus}'`);
    }

    res.json(order);
  } catch (error) {
    console.error("Error updating contact status:", error.message);
    res.status(500).json({ message: "Failed to update contact status", error: error.message });
  }
});

app.patch("/api/orders/:id", async (req, res) => {
  try {
    const payload = req.body;
    const oldOrder = await Order.findById(req.params.id);
    if (!oldOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const validationError = validateOrderPayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updates = {};
    const changeLogs = [];

    if (payload.orderNumber !== undefined) {
      const trimmedOrderNumber = payload.orderNumber.trim();
      if (trimmedOrderNumber !== oldOrder.orderNumber) {
        const duplicateOrder = await Order.findOne({ orderNumber: trimmedOrderNumber, _id: { $ne: req.params.id } });
        if (duplicateOrder) {
          return res.status(409).json({ message: "Order number already exists. Please choose a unique order number." });
        }
        updates.orderNumber = trimmedOrderNumber;
        changeLogs.push(`Order Number changed from '${oldOrder.orderNumber}' to '${trimmedOrderNumber}'`);
      }
    }
    if (payload.customerName !== undefined && payload.customerName !== oldOrder.customerName) {
      updates.customerName = payload.customerName;
      changeLogs.push(`Customer Name changed from '${oldOrder.customerName}' to '${payload.customerName}'`);
    }
    if (payload.contactNumber !== undefined && payload.contactNumber !== oldOrder.contactNumber) {
      updates.contactNumber = payload.contactNumber;
      changeLogs.push(`Contact Number changed from '${oldOrder.contactNumber}' to '${payload.contactNumber}'`);
    }
    if (payload.gender !== undefined && payload.gender !== oldOrder.gender) {
      updates.gender = payload.gender;
      changeLogs.push(`Gender changed from '${oldOrder.gender}' to '${payload.gender}'`);
    }
    if (payload.school !== undefined && payload.school !== oldOrder.school) {
      updates.school = payload.school;
      changeLogs.push(`School changed from '${oldOrder.school}' to '${payload.school}'`);
    }
    if (payload.deliveryDate !== undefined && payload.deliveryDate !== oldOrder.deliveryDate) {
      updates.deliveryDate = payload.deliveryDate;
      changeLogs.push(`Delivery Date changed from '${oldOrder.deliveryDate}' to '${payload.deliveryDate}'`);
    }
    if (payload.amount !== undefined && Number(payload.amount || 0) !== oldOrder.amount) {
      updates.amount = Number(payload.amount || 0);
      changeLogs.push(`Amount changed from '₹${oldOrder.amount}' to '₹${payload.amount}'`);
    }
    if (payload.paymentStatus !== undefined && payload.paymentStatus !== oldOrder.paymentStatus) {
      updates.paymentStatus = payload.paymentStatus;
      changeLogs.push(`Payment Status changed from '${oldOrder.paymentStatus}' to '${payload.paymentStatus}'`);
    }
    if (payload.status !== undefined && payload.status !== oldOrder.status) {
      updates.status = payload.status;
      if (payload.status === 'Delivered') {
        updates.deliveredAt = new Date();
      } else {
        updates.deliveredAt = null;
      }
      changeLogs.push(`Status changed from '${oldOrder.status}' to '${payload.status}'`);
    }
    if (payload.contactStatus !== undefined && payload.contactStatus !== oldOrder.contactStatus) {
      updates.contactStatus = payload.contactStatus;
      changeLogs.push(`Contact Status changed from '${oldOrder.contactStatus}' to '${payload.contactStatus}'`);
    }
    if (payload.items !== undefined) {
      const oldItemsStr = JSON.stringify(oldOrder.items.map(i => ({ type: i.itemType, qty: i.quantity })));
      const newItemsStr = JSON.stringify((payload.items || []).map(i => ({ type: i.itemType, qty: Number(i.quantity || 0) })));
      if (oldItemsStr !== newItemsStr) {
        updates.items = (payload.items || []).map((item) => ({
          ...item,
          quantity: Number(item.quantity || 0),
        }));
        changeLogs.push(`Order items updated`);
      }
    }
    if (payload.notes !== undefined && payload.notes !== oldOrder.notes) {
      updates.notes = payload.notes;
      changeLogs.push(`Notes updated`);
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (changeLogs.length > 0) {
      await logAudit(order._id, order.orderNumber, "Update", changeLogs.join(", "));
    }

    res.json({ message: "Order updated successfully", order });
  } catch (error) {
    console.error("Error updating order:", error.message);
    res.status(500).json({ message: "Failed to update order", error: error.message });
  }
});

// Bulk delete endpoint - accepts { ids: [id1, id2, ...] }
app.post('/api/orders/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of ids to delete.' });
    }

    const ordersToDelete = await Order.find({ _id: { $in: ids } });
    const result = await Order.deleteMany({ _id: { $in: ids } });
    for (const order of ordersToDelete) {
      await logAudit(order._id, order.orderNumber, "Delete", `Order deleted for customer '${order.customerName}' (Bulk)`);
    }

    res.json({ message: 'Bulk delete completed', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error bulk deleting orders:', error.message);
    res.status(500).json({ message: 'Failed to bulk delete orders', error: error.message });
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    await logAudit(order._id, order.orderNumber, "Delete", `Order deleted for customer '${order.customerName}'`);
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error.message);
    res.status(500).json({ message: "Failed to delete order", error: error.message });
  }
});

// Audit Logs Endpoint
app.get("/api/audit-logs", authenticateJWT, async (req, res) => {
  try {
    const { search, type, date } = req.query;
    const query = {};

    if (type && type !== "All") {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { message: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } }
      ];
    }

    if (date) {
      const startOfDayIST = new Date(`${date}T00:00:00`);
      const startOffset = startOfDayIST.getTime() - (5.5 * 60 * 60 * 1000);
      const endOffset = startOffset + (24 * 60 * 60 * 1000) - 1;

      query.createdAt = {
        $gte: new Date(startOffset),
        $lte: new Date(endOffset)
      };
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch audit logs", error: error.message });
  }
});

// Backup Endpoints
app.get("/api/backups", authenticateJWT, async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(".json.gz"))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: "Failed to list backups", error: error.message });
  }
});

app.post("/api/backups/create", authenticateJWT, async (req, res) => {
  try {
    const backupInfo = await performBackup();
    await logAudit(null, "System", "Backup", `Manual database backup created: ${backupInfo.filename}`);
    res.json({ message: "Backup created successfully!", backup: backupInfo });
  } catch (error) {
    res.status(500).json({ message: "Failed to create manual backup", error: error.message });
  }
});

app.get("/api/backups/download/:filename", authenticateJWT, (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filepath = path.join(BACKUP_DIR, safeFilename);
  if (fs.existsSync(filepath)) {
    res.download(filepath, safeFilename);
  } else {
    res.status(404).json({ message: "Backup file not found." });
  }
});

app.post("/api/backups/restore", authenticateJWT, async (req, res) => {
  try {
    const { fileData } = req.body;
    if (!fileData) {
      return res.status(400).json({ message: "No file data provided." });
    }
    const buffer = Buffer.from(fileData, 'base64');
    const result = await restoreBackup(buffer);

    // Reload admin variables from DB after restore
    const adminRecord = await Admin.findOne();
    if (adminRecord) {
      ADMIN_USERNAME = adminRecord.username;
      currentAdminPassword = adminRecord.password;
    }

    await logAudit(null, "System", "Restore", `Database backup restored successfully`);
    res.json({ message: "Database restored successfully!", details: result });
  } catch (error) {
    res.status(500).json({ message: "Failed to restore database", error: error.message });
  }
});

// Pricing Settings Endpoints
app.get("/api/settings/pricing", authenticateJWT, async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ key: "pricing_rates" });
    if (!settings) {
      settings = await SystemSettings.create({
        key: "pricing_rates",
        value: { pant: 150, pina: 75, shirtHs: 90, shirtFs: 110 }
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pricing settings", error: error.message });
  }
});

app.post("/api/settings/pricing", authenticateJWT, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || typeof value !== 'object') {
      return res.status(400).json({ message: "Invalid value payload." });
    }

    const rates = {
      pant: Number(value.pant || 0),
      pina: Number(value.pina || 0),
      shirtHs: Number(value.shirtHs || 0),
      shirtFs: Number(value.shirtFs || 0)
    };

    let settings = await SystemSettings.findOneAndUpdate(
      { key: "pricing_rates" },
      { value: rates },
      { new: true, upsert: true }
    );

    await logAudit(null, "System", "Settings Update", `Pricing rates updated: Pant ₹${rates.pant}, Pina ₹${rates.pina}, Shirt HS ₹${rates.shirtHs}, Shirt FS ₹${rates.shirtFs}`);
    res.json({ message: "Pricing rates updated successfully", settings });
  } catch (error) {
    res.status(500).json({ message: "Failed to update pricing settings", error: error.message });
  }
});

// Serve static assets from the client build in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../client/dist");
  app.use(express.static(distPath));

  app.get(/(.*)/, (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Initialize/Seed admin credentials from/to MongoDB
    let adminRecord = await Admin.findOne();
    if (!adminRecord) {
      const hashedPassword = bcrypt.hashSync(currentAdminPassword, 10);
      adminRecord = await Admin.create({
        username: ADMIN_USERNAME,
        password: hashedPassword
      });
      currentAdminPassword = hashedPassword;
      console.log("Seeded default admin credentials into MongoDB");
    } else {
      let dbPassword = adminRecord.password;
      if (!dbPassword.startsWith("$2a$") && !dbPassword.startsWith("$2b$") && !dbPassword.startsWith("$2y$")) {
        console.log("Upgrading plain text password in MongoDB to bcrypt hash...");
        dbPassword = bcrypt.hashSync(dbPassword, 10);
        adminRecord.password = dbPassword;
        await adminRecord.save();
      }
      ADMIN_USERNAME = adminRecord.username;
      currentAdminPassword = dbPassword;
      console.log("Loaded admin credentials from MongoDB");
    }

    // Seed default pricing rates if not present
    let settingsRecord = await SystemSettings.findOne({ key: "pricing_rates" });
    if (!settingsRecord) {
      await SystemSettings.create({
        key: "pricing_rates",
        value: { pant: 150, pina: 75, shirtHs: 90, shirtFs: 110 }
      });
      console.log("Seeded default pricing rates into MongoDB");
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} without a database connection`);
    });
  }
}

startServer();

// Trigger server reload to inject updated .env variables (v3)