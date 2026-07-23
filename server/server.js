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

const DEFAULT_PRICING_RATES = {
  hs_shirt_20_30: 100,
  hs_shirt_32_44: 120,
  hs_order_shirt_20_30: 130,
  hs_order_shirt_32_44: 150,
  fs_shirt_20_30: 120,
  fs_shirt_32_44: 140,
  fs_order_shirt_20_30: 150,
  fs_order_shirt_32_44: 180,
  ni_top_reg: 100,
  ni_top_order: 130,
  ni_top_cbse: 160,
  ni_top_cb_sc_order: 190,
  chefcoat: 160,
  coaty_at: 120,
  coaty_at_order: 150,
  coaty_kv_dk: 100,
  coaty_kv_dk_order: 130,
  kurta_regular: 100,
  kurta_order: 130,
  kitchen_apron: 60,
  cooking_cap: 40,
  mody_apron: 130,
  pinafore: 100,
  pinafore_order: 130,
  skirt_div_regular: 90,
  skirt_div_order: 120,
  at_skirt: 120,
  at_skirt_order: 150,
  nirmala_sns_frock: 150,
  nirmala_sns_frock_order: 180,
  trousers_elastic_20_30: 100,
  trousers_elastic_20_30_order: 130,
  trousers_elastic_32_40: 125,
  trousers_elastic_32_40_order: 155,
  trousers_belt: 150,
  trousers_belt_order: 180,
  cargo_trousers: 120,
  cargo_trousers_order: 150
};

// Levenshtein Distance Helper
function getLevenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Check if a single target word matches a query token fuzzily
function isFuzzyWordMatch(queryToken, targetWord) {
  const q = queryToken.toLowerCase();
  const t = targetWord.toLowerCase();
  
  if (t.includes(q) || q.includes(t)) {
    return true;
  }
  
  const maxDistance = q.length <= 4 ? 1 : 2;
  const dist = getLevenshteinDistance(q, t);
  if (dist <= maxDistance) {
    return true;
  }
  
  return false;
}

// High-Precision Gold Standard Matcher for Search Bar
function checkFuzzyMatch(searchQuery, order) {
  if (!searchQuery || searchQuery.trim() === "") return true;

  const rawQuery = searchQuery.trim().toLowerCase();
  const cleanQuery = rawQuery.replace(/^#/, "").trim();
  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) return true;

  const orderNum = String(order.orderNumber || '').trim().toLowerCase();
  const custName = String(order.customerName || '').trim().toLowerCase();
  const phone = String(order.contactNumber || '').replace(/\D/g, '');

  for (const token of queryTokens) {
    const tokenDigits = token.replace(/\D/g, '');
    let tokenMatch = false;

    if (orderNum === token || orderNum === cleanQuery || orderNum.includes(token)) {
      tokenMatch = true;
    } else if (custName.includes(token)) {
      tokenMatch = true;
    } else if (tokenDigits.length >= 3 && phone.includes(tokenDigits)) {
      tokenMatch = true;
    }

    if (!tokenMatch) return false;
  }

  return true;
}

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

  let deviceName = '';
  let browser = '';

  // Detect Specific Smartphone / Tablet Brand & Model
  if (/OnePlus|CPH\d{4}|PJD\d{3}|PJG\d{3}/i.test(ua)) {
    const modelMatch = ua.match(/(OnePlus[\w\s\+]+|CPH\d{4}|PJD\d{3})/i);
    deviceName = modelMatch ? modelMatch[1].replace(/_/g, ' ') : 'OnePlus Smartphone';
  } else if (/SM-[F|G|N|A|M|S]\d{3}/i.test(ua) || /Samsung/i.test(ua)) {
    const samMatch = ua.match(/(SM-[A-Z0-9]+)/i);
    deviceName = samMatch ? `Samsung Galaxy (${samMatch[1]})` : 'Samsung Galaxy';
  } else if (/Pixel/i.test(ua)) {
    const pixMatch = ua.match(/(Pixel\s?\d+[\w\s]*)/i);
    deviceName = pixMatch ? `Google ${pixMatch[1]}` : 'Google Pixel';
  } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
    deviceName = 'Xiaomi / Redmi';
  } else if (/Vivo/i.test(ua)) {
    deviceName = 'Vivo Smartphone';
  } else if (/OPPO|CPH/i.test(ua)) {
    deviceName = 'OPPO Smartphone';
  } else if (/iPhone/i.test(ua)) {
    deviceName = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    deviceName = 'Apple iPad';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceName = 'MacBook / Mac';
  } else if (/Windows/i.test(ua)) {
    deviceName = 'Windows PC';
  } else if (/Android/i.test(ua)) {
    deviceName = 'Android Device';
  } else {
    deviceName = 'Web Device';
  }

  // Detect Browser
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else browser = 'Browser';

  return `${deviceName} (${browser})`;
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
    orderNumber: { type: String, required: true, trim: true },
    cycle: { type: Number, default: 1 },
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
        productionCategory: { type: String, default: "" },
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

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });

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

const waitlistSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    schools: [{ type: String, trim: true }],
    items: [
      {
        name: { type: String, required: true, trim: true },
        status: { type: String, enum: ["Pending", "Notified"], default: "Pending" }
      }
    ],
    notes: { type: String, default: "" },
    notifiedAt: { type: Date }
  },
  { timestamps: true }
);
waitlistSchema.index({ notifiedAt: 1 }, { expireAfterSeconds: 604800 });

const Waitlist = mongoose.model("Waitlist", waitlistSchema);

const waitlistSchoolSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true }
});
const WaitlistSchool = mongoose.model("WaitlistSchool", waitlistSchoolSchema);

// 75-day TTL index removed in favor of 100-block rolling cycle cleanup

if (process.env.NODE_ENV !== "production") {
  app.get("/", (req, res) => {
    res.send("School uniform order book server is running...");
  });
}

// Auth Routes
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password).trim();

  // Query database for admin matching EXACT username (case-sensitive)
  let adminRecord = await Admin.findOne({ username: cleanUsername });

  let isValid = false;
  let matchedUsername = ADMIN_USERNAME;

  if (adminRecord) {
    matchedUsername = adminRecord.username;
    if (adminRecord.password.startsWith("$2a$") || adminRecord.password.startsWith("$2b$") || adminRecord.password.startsWith("$2y$")) {
      isValid = bcrypt.compareSync(cleanPassword, adminRecord.password);
    } else {
      isValid = (cleanPassword === adminRecord.password);
      if (isValid) {
        adminRecord.password = bcrypt.hashSync(cleanPassword, 10);
        await adminRecord.save();
      }
    }
  } else if (cleanUsername === ADMIN_USERNAME) {
    isValid = bcrypt.compareSync(cleanPassword, currentAdminPassword) || (cleanPassword === currentAdminPassword);
  }

  if (isValid) {
    const token = jwt.sign({ username: matchedUsername }, JWT_SECRET, { expiresIn: "24h" });

    const rawUa = req.headers['user-agent'] || 'Unknown User-Agent';
    const userAgent = parseUserAgent(rawUa);
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
    const ipAddress = rawIp.split(',')[0].trim();

    try {
      await Session.create({
        token,
        username: matchedUsername,
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

app.post("/api/auth/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ message: "Missing token or password." });
  }

  try {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.resetAllowed) {
      const cleanPassword = String(newPassword).trim();
      const hashedPassword = bcrypt.hashSync(cleanPassword, 10);
      currentAdminPassword = hashedPassword;
      await Admin.findOneAndUpdate({}, { password: hashedPassword }, { upsert: true });
      await logAudit(null, "System", "Password Reset", "Admin password reset successfully via Telegram OTP");
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

  const cleanPassword = String(password).trim();
  if (bcrypt.compareSync(cleanPassword, currentAdminPassword)) {
    const accountEditToken = jwt.sign({ accountEditAllowed: true }, JWT_SECRET, { expiresIn: "5m" });
    return res.json({ accountEditToken });
  }

  return res.status(400).json({ message: "Incorrect password." });
});

app.post("/api/auth/update-credentials", authenticateJWT, async (req, res) => {
  const { accountEditToken, newUsername, newPassword } = req.body;
  if (!accountEditToken || !newUsername || !newPassword) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    const decoded = jwt.verify(accountEditToken, JWT_SECRET);
    if (decoded.accountEditAllowed) {
      const cleanUsername = String(newUsername).trim();
      const cleanPassword = String(newPassword).trim();
      const hashedPassword = bcrypt.hashSync(cleanPassword, 10);
      ADMIN_USERNAME = cleanUsername;
      currentAdminPassword = hashedPassword;
      await Admin.findOneAndUpdate({}, { username: cleanUsername, password: hashedPassword }, { upsert: true });
      await logAudit(null, "System", "Credentials Update", `Admin username updated to '${cleanUsername}'`);
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
    const waitlist = await Waitlist.find({});
    const waitlistSchools = await WaitlistSchool.find({});

    const backupData = {
      version: "1.2",
      timestamp: new Date().toISOString(),
      orders,
      admins,
      auditLogs,
      waitlist,
      waitlistSchools
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const compressed = zlib.gzipSync(jsonStr);

    const now = new Date();
    // Explicit IST offset calculation (UTC + 5h 30m) - 100% reliable across all Node environments
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utcMs + (330 * 60000));

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(ist.getDate()).padStart(2, '0');
    const month = months[ist.getMonth()];
    const year = ist.getFullYear();

    let hours = ist.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(ist.getMinutes()).padStart(2, '0');
    const secondsStr = String(ist.getSeconds()).padStart(2, '0');

    const filename = `liberty_backup_${day}-${month}-${year}_${hoursStr}-${minutesStr}-${secondsStr}-${ampm}.json.gz`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, compressed);
    console.log(`Auto database database backup created successfully: ${filename}`);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      const caption = `💾 *Liberty Uniform - Auto Backup*\n\nDatabase backup successfully created:\n\`${filename}\`\n\n- Orders: ${orders.length}\n- Logs: ${auditLogs.length}\n- Waitlist: ${waitlist.length}\n- Waitlist Schools: ${waitlistSchools.length}`;
      
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
    await Waitlist.deleteMany({});
    await WaitlistSchool.deleteMany({});

    if (backupData.orders.length > 0) {
      await Order.insertMany(backupData.orders);
    }
    if (backupData.admins.length > 0) {
      await Admin.insertMany(backupData.admins);
    }
    if (backupData.auditLogs && backupData.auditLogs.length > 0) {
      await AuditLog.insertMany(backupData.auditLogs);
    }
    if (backupData.waitlist && backupData.waitlist.length > 0) {
      await Waitlist.insertMany(backupData.waitlist);
    }
    if (backupData.waitlistSchools && backupData.waitlistSchools.length > 0) {
      await WaitlistSchool.insertMany(backupData.waitlistSchools);
    }

    console.log("Database backup restored successfully.");
    return {
      ordersCount: backupData.orders.length,
      adminsCount: backupData.admins.length,
      auditLogsCount: (backupData.auditLogs || []).length,
      waitlistCount: (backupData.waitlist || []).length,
      waitlistSchoolsCount: (backupData.waitlistSchools || []).length
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

// Cleanup preview endpoint: checks if creating orderNumber X hits a 100-block boundary and counts delivered orders eligible for purge
app.get("/api/orders/cleanup-preview", async (req, res) => {
  try {
    const newOrderNum = parseInt(req.query.orderNumber, 10);
    if (isNaN(newOrderNum)) {
      return res.json({ shouldTrigger: false });
    }

    let targetStart = 0;
    let targetEnd = 0;

    if (newOrderNum === 1000 || (newOrderNum > 0 && newOrderNum % 1000 === 0)) {
      targetStart = 1;
      targetEnd = 100;
    } else if (newOrderNum > 0 && newOrderNum % 100 === 0) {
      targetStart = newOrderNum + 1;
      targetEnd = newOrderNum + 100;
    }

    if (targetStart === 0) {
      return res.json({ shouldTrigger: false });
    }

    const targetNumbers = [];
    for (let i = targetStart; i <= targetEnd; i++) {
      targetNumbers.push(String(i));
    }

    const deliveredCount = await Order.countDocuments({
      orderNumber: { $in: targetNumbers },
      status: "Delivered"
    });

    res.json({
      shouldTrigger: true,
      orderNumber: newOrderNum,
      startNum: targetStart,
      endNum: targetEnd,
      deliveredCount
    });
  } catch (error) {
    console.error("Cleanup preview error:", error.message);
    res.status(500).json({ message: "Failed to check cleanup preview", error: error.message });
  }
});

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
    const cleanNumStr = payload.orderNumber.trim();

    const existingOrder = await Order.findOne({ orderNumber: cleanNumStr });
    if (existingOrder) {
      return res.status(409).json({ message: `Order #${cleanNumStr} already exists.` });
    }

    const newOrder = new Order({
      ...payload,
      orderNumber: cleanNumStr,
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
    res.status(201).json({
      message: "Order saved successfully",
      order: newOrder
    });
  } catch (error) {
    console.error("Error saving order:", error.message);
    let userMsg = `Failed to save order: ${error.message}`;
    if (error.code === 11000) {
      userMsg = `Order #${payload.orderNumber || ''} already exists.`;
    }
    res.status(500).json({ message: userMsg, error: error.message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();

    let filtered = orders;
    if (search) {
      filtered = orders.filter(order => checkFuzzyMatch(search, order));
    }

    res.json(filtered);
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
        const duplicateOrder = await Order.findOne({ orderNumber: trimmedOrderNumber, cycle: oldOrder.cycle || 1, _id: { $ne: req.params.id } });
        if (duplicateOrder) {
          return res.status(409).json({ message: `Order #${trimmedOrderNumber} already exists in Cycle ${oldOrder.cycle || 1}.` });
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
      updates.items = (payload.items || []).map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
      }));
      changeLogs.push(`Order items and measurements updated`);
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

app.patch('/api/orders/:id/item-category', authenticateJWT, async (req, res) => {
  try {
    const { itemIndex, category } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const idx = Number(itemIndex);
    if (order.items && order.items[idx]) {
      order.items[idx].productionCategory = String(category || '');
      await order.save();
      return res.json({ message: 'Category updated successfully', order });
    } else {
      return res.status(400).json({ message: 'Invalid item index' });
    }
  } catch (error) {
    console.error('Error updating item category:', error.message);
    return res.status(500).json({ message: 'Failed to update item category', error: error.message });
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

// Waitlist Endpoints
app.get("/api/waitlist", authenticateJWT, async (req, res) => {
  try {
    const { search, status, school } = req.query;
    const query = {};

    if (status && status !== "All") {
      if (status === "Pending") {
        query["items.status"] = "Pending";
      } else if (status === "Notified") {
        query["items.status"] = { $ne: "Pending" };
      }
    }

    if (school && school !== "All") {
      query.schools = school;
    }

    const requests = await Waitlist.find(query).sort({ createdAt: -1 });

    const normalized = requests.map(r => {
      const obj = r.toObject();
      if (!obj.schools) {
        obj.schools = obj.school ? [obj.school] : [];
      }
      if (obj.items && obj.items.length > 0) {
        obj.items = obj.items.map(item => {
          if (typeof item === 'string') {
            return { name: item, status: 'Pending' };
          }
          if (item && !item.status) {
            item.status = 'Pending';
          }
          return item;
        });
      } else if (obj.itemDetails) {
        obj.items = [{ name: obj.itemDetails, status: obj.status || 'Pending' }];
      } else {
        obj.items = [];
      }
      return obj;
    });

    let filtered = normalized;
    if (search) {
      filtered = normalized.filter(req => {
        const fields = [
          req.customerName,
          req.contactNumber,
          ...(req.schools || []),
          ...(req.items || []).map(i => i.name)
        ];
        return checkFuzzyMatch(search, fields);
      });
    }

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch waitlist", error: error.message });
  }
});

app.post("/api/waitlist", authenticateJWT, async (req, res) => {
  try {
    const { customerName, contactNumber, schools, items, notes } = req.body;
    if (!customerName || !contactNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Customer Name, Contact Number, and at least one Waitlist Item are required." });
    }

    const cleanPhone = contactNumber.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ message: "Contact number must be exactly 10 digits." });
    }

    const cleanedItems = items
      .map(item => {
        if (typeof item === 'string') {
          return { name: item.trim(), status: 'Pending' };
        }
        if (item && typeof item === 'object' && item.name) {
          return { name: item.name.trim(), status: item.status || 'Pending' };
        }
        return null;
      })
      .filter(item => item && item.name);

    if (cleanedItems.length === 0) {
      return res.status(400).json({ message: "Waitlist Items cannot be empty." });
    }

    const allNotified = cleanedItems.length > 0 && cleanedItems.every(i => i.status === 'Notified');
    const notifiedAt = allNotified ? new Date() : undefined;

    const newRequest = await Waitlist.create({
      customerName,
      contactNumber: cleanPhone,
      schools: Array.isArray(schools) ? schools : [],
      items: cleanedItems,
      notes,
      notifiedAt
    });

    await logAudit(newRequest._id, "System", "Waitlist Add", `Added waitlist request for customer '${customerName}' - ${cleanedItems.map(i => i.name).join(", ")}`);
    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ message: "Failed to create waitlist entry", error: error.message });
  }
});

app.patch("/api/waitlist/:id", authenticateJWT, async (req, res) => {
  try {
    const { customerName, contactNumber, schools, items, notes } = req.body;
    const request = await Waitlist.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Waitlist entry not found" });
    }

    if (customerName !== undefined) request.customerName = customerName;
    
    if (contactNumber !== undefined) {
      const cleanPhone = contactNumber.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ message: "Contact number must be exactly 10 digits." });
      }
      request.contactNumber = cleanPhone;
    }
    
    if (schools !== undefined && Array.isArray(schools)) {
      request.schools = schools;
    }
    
    if (notes !== undefined) request.notes = notes;
    
    if (items !== undefined && Array.isArray(items)) {
      const cleanedItems = items
        .map(item => {
          if (typeof item === 'string') {
            return { name: item.trim(), status: 'Pending' };
          }
          if (item && typeof item === 'object' && item.name) {
            return { name: item.name.trim(), status: item.status || 'Pending' };
          }
          return null;
        })
        .filter(item => item && item.name);

      if (cleanedItems.length > 0) {
        request.items = cleanedItems;
      }
    }

    const allNotified = request.items && request.items.length > 0 && request.items.every(i => i.status === 'Notified');
    if (allNotified) {
      if (!request.notifiedAt) {
        request.notifiedAt = new Date();
      }
    } else {
      request.notifiedAt = null;
    }

    await request.save();

    await logAudit(request._id, "System", "Waitlist Update", `Updated waitlist entry for customer '${request.customerName}'`);

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to update waitlist entry", error: error.message });
  }
});

app.delete("/api/waitlist/:id", authenticateJWT, async (req, res) => {
  try {
    const request = await Waitlist.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Waitlist entry not found" });
    }

    await logAudit(request._id, "System", "Waitlist Delete", `Removed waitlist entry for customer '${request.customerName}'`);
    res.json({ message: "Waitlist entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete waitlist entry", error: error.message });
  }
});

app.post("/api/waitlist/bulk-delete", authenticateJWT, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No waitlist items selected for deletion." });
    }
    const result = await Waitlist.deleteMany({ _id: { $in: ids } });
    await logAudit("System", "System", "Waitlist Bulk Delete", `Bulk deleted ${result.deletedCount} waitlist request(s)`);
    res.json({ message: `Successfully deleted ${result.deletedCount} waitlist request(s).` });
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk delete waitlist items", error: error.message });
  }
});

// Waitlist Schools Directory Endpoints
app.get("/api/waitlist/schools", authenticateJWT, async (req, res) => {
  try {
    const schools = await WaitlistSchool.find({}).sort({ name: 1 });
    res.json(schools);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch waitlist schools", error: error.message });
  }
});

app.post("/api/waitlist/schools", authenticateJWT, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "School name is required" });
    }

    const trimmedName = name.trim();
    const existing = await WaitlistSchool.findOne({ name: trimmedName });
    if (existing) {
      return res.status(400).json({ message: "School name already exists" });
    }

    const newSchool = await WaitlistSchool.create({ name: trimmedName });
    res.status(201).json(newSchool);
  } catch (error) {
    res.status(500).json({ message: "Failed to create school entry", error: error.message });
  }
});

app.patch("/api/waitlist/schools/:id", authenticateJWT, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "School name is required" });
    }

    const trimmedName = name.trim();
    const school = await WaitlistSchool.findById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const oldName = school.name;
    school.name = trimmedName;
    await school.save();

    await Waitlist.updateMany(
      { schools: oldName },
      { $set: { "schools.$": trimmedName } }
    );

    res.json(school);
  } catch (error) {
    res.status(500).json({ message: "Failed to rename school", error: error.message });
  }
});

app.delete("/api/waitlist/schools/:id", authenticateJWT, async (req, res) => {
  try {
    const school = await WaitlistSchool.findByIdAndDelete(req.params.id);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    await Waitlist.updateMany(
      { schools: school.name },
      { $pull: { schools: school.name } }
    );

    res.json({ message: "School deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete school entry", error: error.message });
  }
});

// Audit Logs Endpoint
app.get("/api/audit-logs", authenticateJWT, async (req, res) => {
  try {
    const { search, type, date } = req.query;
    const query = {};

    if (type && type !== "All") {
      if (type === "System") {
        query.orderNumber = "System";
      } else if (type === "Order") {
        query.orderNumber = { $ne: "System" };
      } else if (type === "Backup") {
        query.action = { $in: ["Backup", "Restore"] };
      } else if (type === "Waitlist") {
        query.action = { $regex: /WAITLIST/i };
      } else if (type === "StatusChange") {
        query.action = { $in: ["STATUS CHANGE", "CONTACT CHANGE", "Status Change", "Contact Change"] };
      } else if (type === "Delete") {
        query.action = { $regex: /DELETE/i };
      }
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

    const logs = await AuditLog.find(query).sort({ createdAt: -1 });

    let filtered = logs;
    if (search) {
      filtered = logs.filter(log => {
        const fields = [
          log.message,
          log.username,
          log.action,
          log.details,
          log.orderNumber
        ];
        return checkFuzzyMatch(search, fields);
      });
    }

    res.json(filtered.slice(0, 100));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch audit logs", error: error.message });
  }
});

const parseBackupTimestamp = (filename, fileStats) => {
  try {
    const match = filename.match(/liberty_backup_(\d{2})-([A-Za-z]{3})-(\d{4})_(\d{2})-(\d{2})-(\d{2})-(AM|PM)\.json\.gz/);
    if (match) {
      const [_, day, monthStr, year, hrsStr, minsStr, secsStr, ampm] = match;
      const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      const month = months[monthStr] !== undefined ? months[monthStr] : 0;

      let hours = parseInt(hrsStr, 10);
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      const localMs = Date.UTC(parseInt(year, 10), month, parseInt(day, 10), hours, parseInt(minsStr, 10), parseInt(secsStr, 10));
      const utcMs = localMs - (330 * 60000);
      return new Date(utcMs);
    }
  } catch (e) {
    console.error('Failed to parse backup filename timestamp:', e);
  }
  return fileStats.birthtime || fileStats.mtime || new Date();
};

// Backup Endpoints
app.get("/api/backups", authenticateJWT, async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(".json.gz"))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        const createdAt = parseBackupTimestamp(f, stats);
        return {
          filename: f,
          size: stats.size,
          createdAt: createdAt
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

app.post("/api/orders/seed-999", async (req, res) => {
  try {
    // Clear existing orders
    await Order.deleteMany({});

    const schools = ["St. Xavier High School", "Delhi Public School", "Green Valley International", "City Convent", "St. Mary Academy"];
    const customerFirstNames = ["Rahul", "Priya", "Amit", "Neha", "Vikram", "Ananya", "Rohan", "Sneha", "Karan", "Pooja", "Arjun", "Kavya", "Suresh", "Ritu", "Deepak"];
    const customerLastNames = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Mehta", "Joshi", "Kumar", "Rao", "Nair", "Das", "Shah"];

    const mockOrders = [];
    const baseDate = new Date(2026, 6, 23); // 23 July 2026

    for (let i = 1; i <= 999; i++) {
      const fn = customerFirstNames[Math.floor(Math.random() * customerFirstNames.length)];
      const ln = customerLastNames[Math.floor(Math.random() * customerLastNames.length)];
      const customerName = `${fn} ${ln}`;
      const gender = Math.random() > 0.5 ? "Male" : "Female";
      const school = schools[Math.floor(Math.random() * schools.length)];
      const amount = (Math.floor(Math.random() * 15) + 5) * 100;

      // Status distribution:
      // Range 1..99: ~90% Delivered (to test cleanup of delivered orders when #1000 is created)
      // Range 100..999: mix of Pending, Ready, Delivered
      let status = "Delivered";
      if (i <= 99) {
        status = i % 10 === 0 ? "Pending" : "Delivered";
      } else {
        const rand = Math.random();
        if (rand < 0.4) status = "Pending";
        else if (rand < 0.7) status = "Ready";
        else status = "Delivered";
      }

      const deliveryOffset = Math.floor(Math.random() * 30) - 15;
      const dDate = new Date(baseDate);
      dDate.setDate(dDate.getDate() + deliveryOffset);
      const deliveryDate = dDate.toISOString().split("T")[0];

      const itemType = gender === "Female" && Math.random() > 0.5 ? "pina" : (Math.random() > 0.5 ? "shirt" : "pant");
      const quantity = Math.floor(Math.random() * 3) + 1;

      mockOrders.push({
        orderNumber: String(i),
        customerName,
        contactNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        gender,
        school,
        deliveryDate,
        amount,
        paymentStatus: status === "Delivered" ? "Paid" : (Math.random() > 0.5 ? "Paid" : "Unpaid"),
        status,
        deliveredAt: status === "Delivered" ? new Date() : undefined,
        contactStatus: status === "Delivered" ? "Contacted" : "Not contacted",
        items: [
          {
            itemType,
            quantity,
            productionCategory: itemType === "shirt" ? "fs_shirt_32_44" : (itemType === "pant" ? "trousers_elastic_20_30" : "pinafore"),
            measurements: itemType === "shirt"
              ? { length: "28", chest: "36", shoulder: "16", sleeve: "14", neck: "15" }
              : (itemType === "pant" ? { length: "38", waist: "32", seat: "36", thighs: "22", bottom: "16" } : { length: "34", waist: "30", torsoLength: "20" })
          }
        ],
        notes: i <= 99 ? `Test seed order #${i} (Cycle 1)` : `Seed order #${i}`
      });
    }

    await Order.insertMany(mockOrders);
    await logAudit(null, "System", "Seed Data", "Cleared existing database and generated 999 mock orders for testing.");

    res.json({ message: "Successfully cleared database and seeded 999 mock orders!", count: 999 });
  } catch (error) {
    console.error("Failed to seed orders:", error.message);
    res.status(500).json({ message: "Failed to seed 999 orders", error: error.message });
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

// WhatsApp Templates Settings Endpoints
const DEFAULT_WHATSAPP_TEMPLATES = {
  waitlistTemplate: "Hi {customerName}, this is Liberty Uniforms. Your requested item(s): {items} is now back in stock! Please visit our shop to collect it.",
  orderReadyTemplate: "Hello {customerName},\n\nYour school uniform order (Order No. {orderNumber}) is now ready for collection.\n\n{collectionMsg}\n\nThank you,\nLiberty Uniform"
};

app.get("/api/settings/templates", authenticateJWT, async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ key: "whatsapp_templates" });
    if (!settings) {
      settings = await SystemSettings.create({
        key: "whatsapp_templates",
        value: DEFAULT_WHATSAPP_TEMPLATES
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch WhatsApp templates", error: error.message });
  }
});

app.post("/api/settings/templates", authenticateJWT, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || typeof value !== 'object') {
      return res.status(400).json({ message: "Invalid template payload." });
    }

    const templates = {
      waitlistTemplate: String(value.waitlistTemplate || DEFAULT_WHATSAPP_TEMPLATES.waitlistTemplate),
      orderReadyTemplate: String(value.orderReadyTemplate || DEFAULT_WHATSAPP_TEMPLATES.orderReadyTemplate)
    };

    let settings = await SystemSettings.findOneAndUpdate(
      { key: "whatsapp_templates" },
      { value: templates },
      { new: true, upsert: true }
    );

    await logAudit(null, "System", "Settings Update", "WhatsApp notification templates updated");
    res.json({ message: "WhatsApp notification templates updated successfully", settings });
  } catch (error) {
    res.status(500).json({ message: "Failed to update WhatsApp templates", error: error.message });
  }
});

// Serve static assets from the client build whenever client/dist exists
const distPath = path.join(__dirname, "../client/dist");
if (fs.existsSync(distPath)) {
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

    // Drop old deliveredAt index to ensure options are rebuilt with 75 days TTL
    try {
      await mongoose.connection.collection('orders').dropIndex('deliveredAt_1');
      console.log("Dropped old deliveredAt TTL index to apply new duration option");
    } catch (e) {
      // Index might not exist yet, safe to ignore
    }

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

    // Seed default pricing rates if not present or missing keys
    let settingsRecord = await SystemSettings.findOne({ key: "pricing_rates" });
    if (!settingsRecord) {
      await SystemSettings.create({
        key: "pricing_rates",
        value: DEFAULT_PRICING_RATES
      });
      console.log("Seeded default 38 pricing rates into MongoDB");
    } else {
      let updatedValue = { ...DEFAULT_PRICING_RATES, ...(settingsRecord.value || {}) };
      settingsRecord.value = updatedValue;
      await settingsRecord.save();
      console.log("Updated 38 pricing rates structure in MongoDB");
    }

    // Execute automatic startup database backup
    try {
      await performBackup();
      console.log("Startup database backup created successfully.");
    } catch (bErr) {
      console.error("Startup database backup error:", bErr.message);
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