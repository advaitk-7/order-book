import { useEffect, useMemo, useState, useRef, useDeferredValue } from 'react'
import './App.css'
import { getSafeEmoji } from './emojiUtils.js'

const API_BASE = import.meta.env.VITE_API_BASE || (window.location.origin.includes('localhost') ? 'http://localhost:5001' : window.location.origin)

const measurementFields = {
  shirt: ['sizeFarma', 'length', 'chest', 'shoulder', 'sleeve', 'neck'],
  kurta: ['sizeFarma', 'length', 'chest', 'shoulder', 'sleeve', 'neck'],
  top: ['sizeFarma', 'length', 'chest', 'shoulder', 'sleeve', 'neck'],
  blazer: ['sizeFarma', 'length', 'chest', 'shoulder', 'sleeve', 'neck'],
  coaty: ['sizeFarma', 'length', 'chest', 'shoulder', 'sleeve', 'neck'],

  pant: ['sizeFarma', 'length', 'waist', 'seat', 'thighs', 'bottom'],
  shorts: ['sizeFarma', 'length', 'waist', 'seat', 'thighs', 'bottom'],
  pajama: ['sizeFarma', 'length', 'waist', 'seat', 'thighs', 'bottom'],

  pina: ['sizeFarma', 'length', 'waist', 'torsoLength'],
  skirt: ['sizeFarma', 'length', 'waist', 'torsoLength'],
  frock: ['sizeFarma', 'length', 'waist', 'torsoLength'],
}

const STANDARD_FIELDS = [
  'sizeFarma', 'length', 'chest', 'shoulder', 'sleeve', 'neck',
  'waist', 'seat', 'thighs', 'bottom', 'torsoLength'
]
const isStandardField = (field) => STANDARD_FIELDS.includes(field)

const getDefaultMeasurementsForType = (type = 'shirt') => {
  const fields = measurementFields[type] || measurementFields.shirt || []
  const initial = {}
  fields.forEach((f) => { initial[f] = '' })
  return initial
}

const getItemFields = (item) => {
  const type = (item?.itemType || 'shirt').toLowerCase()
  const defaultFields = measurementFields[type] || measurementFields.shirt || []
  const itemMeasurements = item?.measurements || {}

  const fields = defaultFields.filter((k) => itemMeasurements[k] !== undefined || Object.keys(itemMeasurements).length === 0)

  const allKeys = Object.keys(itemMeasurements)
  const extraKeys = allKeys.filter((k) => !fields.includes(k))

  return [...fields, ...extraKeys]
}

const createItem = (type = 'shirt') => ({
  itemType: type,
  sizeFarma: '',
  quantity: 1,
  productionCategory: '',
  measurements: getDefaultMeasurementsForType(type),
})

const getDefaultSpecifications = () => [
  { label: 'Fabric', value: '' },
  { label: 'Collar colour & pattern', value: '' },
  { label: 'Grip colour / without grip', value: '' },
  { label: 'Extra pattern', value: '' },
  { label: 'Logo printing / embroidery', value: '' },
  { label: 'Front side size', value: '' },
  { label: 'Back side size', value: '' },
  { label: 'Sleeve side size', value: '' },
  { label: 'Name & number', value: '' },
  { label: 'Extra printing', value: '' },
  { label: 'Size Farma', value: '' },
  { label: 'Side slit', value: '' }
]

const getNormalizedSpecifications = (product = {}) => {
  if (Array.isArray(product?.specifications) && product.specifications.length > 0) {
    return product.specifications.map(s => ({
      label: s?.label !== undefined ? String(s.label).replace(/^Greep/i, 'Grip').replace(/greep/gi, 'grip') : '',
      value: s?.value !== undefined ? String(s.value) : ''
    }))
  }

  const spec = product?.specification || {}
  const list = [
    { label: 'Fabric', value: String(spec.fabric || '').trim() },
    { label: 'Collar colour & pattern', value: String(spec.collarPattern || '').trim() },
    { label: 'Grip colour / without grip', value: String(spec.gripOption || spec.greepOption || '').trim() },
    { label: 'Extra pattern', value: String(spec.extraPattern || '').trim() },
    { label: 'Logo printing / embroidery', value: String(spec.logoType || '').trim() },
    { label: 'Front side size', value: String(spec.frontSideSize || '').trim() },
    { label: 'Back side size', value: String(spec.backSideSize || '').trim() },
    { label: 'Sleeve side size', value: String(spec.sleeveSideSize || '').trim() },
    { label: 'Name & number', value: String(spec.nameNumber || '').trim() },
    { label: 'Extra printing', value: String(spec.extraPrinting || '').trim() },
    { label: 'Size Farma', value: String(spec.sizeFarma || spec.sizeFormat || '').trim() },
    { label: 'Side slit', value: String(spec.sideSlit || '').trim() }
  ]

  Object.keys(spec).forEach(k => {
    if (!['fabric', 'collarPattern', 'greepOption', 'gripOption', 'extraPattern', 'logoType', 'frontSideSize', 'backSideSize', 'sleeveSideSize', 'nameNumber', 'extraPrinting', 'sizeFormat', 'sizeFarma', '_id'].includes(k)) {
      if (spec[k] && String(spec[k]).trim()) {
        list.push({ label: k, value: String(spec[k]).trim() })
      }
    }
  })

  return list
}

const createEmptyForm = (orderNumber = '') => ({
  orderNumber,
  customerName: '',
  contactNumber: '',
  gender: 'Male',
  school: '',
  grade: '',
  deliveryDate: '',
  amount: '',
  paymentStatus: 'Unpaid',
  status: 'Pending',
  contactStatus: 'Not contacted',
  items: [createItem()],
  notes: '',
})

const createEmptyWaitlistForm = () => ({
  customerName: '',
  contactNumber: '',
  schools: [],
  items: [{ name: '', status: 'Pending' }],
  notes: ''
})

const DEFAULT_WHATSAPP_TEMPLATES = {
  waitlistTemplate: "Hi {customerName}, this is Liberty Uniforms. Your requested item(s): {items} is now back in stock! Please visit our shop to collect it.",
  orderReadyTemplate: "Hello {customerName},\n\nYour school uniform order (Order No. {orderNumber}) is now ready for collection.\n\n{collectionMsg}\n\nThank you,\nLiberty Uniform"
}

const PRODUCTION_CATEGORIES = [
  { id: 'hs_shirt_20_30', name: 'H.S. Shirt (20 to 30)', defaultRate: 100 },
  { id: 'hs_shirt_32_44', name: 'H.S. Shirt (32 to 44)', defaultRate: 120 },
  { id: 'hs_order_shirt_20_30', name: 'H.S. Order Shirt (20 to 30)', defaultRate: 130 },
  { id: 'hs_order_shirt_32_44', name: 'H.S. Order Shirt (32 to 44)', defaultRate: 150 },
  { id: 'fs_shirt_20_30', name: 'F.S. Shirt (20 to 30)', defaultRate: 120 },
  { id: 'fs_shirt_32_44', name: 'F.S. Shirt (32 to 44)', defaultRate: 140 },
  { id: 'fs_order_shirt_20_30', name: 'F.S. Order Shirt (20 to 30)', defaultRate: 150 },
  { id: 'fs_order_shirt_32_44', name: 'F.S. Order Shirt (32 to 44)', defaultRate: 180 },
  { id: 'ni_top_reg', name: 'NI Top Regular', defaultRate: 100 },
  { id: 'ni_top_order', name: 'NI Top Order', defaultRate: 130 },
  { id: 'ni_top_cbse', name: 'NI Top CBSE', defaultRate: 160 },
  { id: 'ni_top_cb_sc_order', name: 'NI Top CBSE Order', defaultRate: 190 },
  { id: 'chefcoat', name: 'Chef Coat', defaultRate: 160 },
  { id: 'coaty_at', name: 'Coaty AT', defaultRate: 120 },
  { id: 'coaty_at_order', name: 'Coaty AT Order', defaultRate: 150 },
  { id: 'coaty_kv_dk', name: 'Coaty KV / DK', defaultRate: 100 },
  { id: 'coaty_kv_dk_order', name: 'Coaty KV / DK Order', defaultRate: 130 },
  { id: 'kurta_regular', name: 'Kurta Regular', defaultRate: 100 },
  { id: 'kurta_order', name: 'Kurta Order', defaultRate: 130 },
  { id: 'kitchen_apron', name: 'Kitchen Apron', defaultRate: 60 },
  { id: 'cooking_cap', name: 'Cooking Cap', defaultRate: 40 },
  { id: 'mody_apron', name: 'Modi Apron', defaultRate: 130 },
  { id: 'pinafore', name: 'Pinafore', defaultRate: 100 },
  { id: 'pinafore_order', name: 'Pinafore Order', defaultRate: 130 },
  { id: 'skirt_div_regular', name: 'Skirt / Divider Regular', defaultRate: 90 },
  { id: 'skirt_div_order', name: 'Skirt / Divider Order', defaultRate: 120 },
  { id: 'at_skirt', name: 'AT Skirt', defaultRate: 120 },
  { id: 'at_skirt_order', name: 'AT Skirt Order', defaultRate: 150 },
  { id: 'nirmala_sns_frock', name: 'Nirmala / SNS Frock', defaultRate: 150 },
  { id: 'nirmala_sns_frock_order', name: 'Nirmala / SNS Frock Order', defaultRate: 180 },
  { id: 'trousers_elastic_20_30', name: 'Trousers Elastic (20 to 30)', defaultRate: 100 },
  { id: 'trousers_elastic_20_30_order', name: 'Trousers Elastic Order (20 to 30)', defaultRate: 130 },
  { id: 'trousers_elastic_32_40', name: 'Trousers Elastic (32 to 40)', defaultRate: 125 },
  { id: 'trousers_elastic_32_40_order', name: 'Trousers Elastic Order (32 to 40)', defaultRate: 155 },
  { id: 'trousers_belt', name: 'Trousers Belt', defaultRate: 150 },
  { id: 'trousers_belt_order', name: 'Trousers Belt Order', defaultRate: 180 },
  { id: 'cargo_trousers', name: 'Cargo Trousers', defaultRate: 120 },
  { id: 'cargo_trousers_order', name: 'Cargo Trousers Order', defaultRate: 150 }
]

const DEFAULT_PRICING_RATES = PRODUCTION_CATEGORIES.reduce((acc, cat) => {
  acc[cat.id] = cat.defaultRate
  return acc
}, {})

const guessProductionCategory = (item) => {
  if (!item) return ''
  const prodType = (item.itemType || item.product || '').toLowerCase().trim()
  const notes = (item.notes || '').toLowerCase()
  const m = item.measurements || {}
  const sleeveVal = parseFloat(m.sleeve)

  const isExplicitFS = prodType.includes('fs') || prodType.includes('full') || notes.includes('fs') || notes.includes('full')
  const isExplicitHS = prodType.includes('hs') || prodType.includes('half') || notes.includes('hs') || notes.includes('half')

  let isFS = false
  if (isExplicitFS) {
    isFS = true
  } else if (isExplicitHS) {
    isFS = false
  } else if (!isNaN(sleeveVal)) {
    isFS = sleeveVal >= 12
  }

  const numVal = parseFloat(m.chest) || parseFloat(m.waist) || parseFloat(m.length) || parseFloat(m.size) || 0

  if (['shirt', 'kurta', 'top', 'blazer', 'coaty'].some(p => prodType.includes(p))) {
    if (prodType.includes('kurta')) return 'kurta_regular'
    if (prodType.includes('top')) return 'ni_top_reg'
    if (prodType.includes('blazer')) return 'blazer_regular'
    if (prodType.includes('coaty')) return 'coaty_regular'
    if (isFS) {
      return (numVal >= 32 || numVal === 0) ? 'fs_shirt_32_44' : 'fs_shirt_20_30'
    } else {
      return (numVal >= 32 || numVal === 0) ? 'hs_shirt_32_44' : 'hs_shirt_20_30'
    }
  }

  if (['pant', 'trouser', 'pajama', 'shorts'].some(p => prodType.includes(p))) {
    if (numVal >= 32) return 'trousers_elastic_32_40'
    return 'trousers_elastic_20_30'
  }

  if (['pina', 'skirt', 'frock'].some(p => prodType.includes(p))) {
    if (prodType.includes('skirt')) return 'skirt_div_regular'
    if (prodType.includes('frock')) return 'nirmala_sns_frock'
    return 'pinafore'
  }

  return ''
}


const formatDateToDMY = (dateStr) => {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }
  return dateStr
}

const getSleeveTag = (itemType, measurements) => {
  if (!itemType) return ''
  const type = itemType.toLowerCase()
  if (!['shirt', 'kurta'].includes(type)) return ''
  const sleeveVal = parseFloat(measurements?.sleeve)
  if (isNaN(sleeveVal)) return ''
  return sleeveVal >= 14 ? 'FS' : 'HS'
}

const isDateInFilter = (dateStr, filter, customStart, customEnd) => {
  if (filter === 'All') return true
  if (!dateStr || dateStr.trim() === '') return false

  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false

  d.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (filter === 'Today') {
    return d.getTime() === today.getTime()
  }
  if (filter === 'Tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return d.getTime() === tomorrow.getTime()
  }
  if (filter === 'This Week') {
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday of current week
    const monday = new Date(today.setDate(diff))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return d >= monday && d <= sunday
  }
  if (filter === 'This Month') {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }
  if (filter === 'Custom') {
    if (customStart) {
      const start = new Date(customStart)
      start.setHours(0, 0, 0, 0)
      if (d < start) return false
    }
    if (customEnd) {
      const end = new Date(customEnd)
      end.setHours(23, 59, 59, 999)
      if (d > end) return false
    }
    return true
  }
  return true
}

const getNextOrderNumber = (orders) => {
  if (!orders || orders.length === 0) return '1'

  const numericOrders = orders
    .map((o) => Number(o.orderNumber))
    .filter((n) => !Number.isNaN(n) && n > 0)

  if (numericOrders.length === 0) return '1'

  const maxNum = Math.max(...numericOrders)
  return String(maxNum + 1)
}

const getNextPoNumber = (vendorOrders) => {
  if (!vendorOrders || vendorOrders.length === 0) return 1
  const nums = vendorOrders
    .map(o => {
      const m = String(o.poNumber || '').match(/(\d+)$/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter(n => !isNaN(n) && n > 0)
  if (nums.length === 0) return 1
  return Math.max(...nums) + 1
}

// Gold-Standard Universal Search Matcher (Safe against null/undefined, supports Array, Object, String)
const checkFuzzyMatch = (searchQuery, target) => {
  if (!searchQuery || !String(searchQuery).trim()) return true
  const rawQuery = String(searchQuery).trim().toLowerCase()
  const cleanQuery = rawQuery.replace(/^#/, '').trim()
  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean)
  if (queryTokens.length === 0) return true

  let textToSearch = ''
  if (Array.isArray(target)) {
    textToSearch = target.filter(Boolean).map(item => String(item).toLowerCase()).join(' ')
  } else if (typeof target === 'object' && target !== null) {
    textToSearch = Object.values(target).filter(Boolean).map(val => {
      if (typeof val === 'object') return JSON.stringify(val).toLowerCase()
      return String(val).toLowerCase()
    }).join(' ')
  } else {
    textToSearch = String(target || '').toLowerCase()
  }

  for (const token of queryTokens) {
    const cleanToken = token.replace(/^#/, '')
    if (!textToSearch.includes(token) && !textToSearch.includes(cleanToken)) {
      return false
    }
  }

  return true
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [isForgotMode, setIsForgotMode] = useState(false)
  const [forgotStep, setForgotStep] = useState(1)
  const [otpCode, setOtpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotError, setForgotError] = useState('')

  // Manage Account States
  const [currentUsername, setCurrentUsername] = useState('')
  const [showManageModal, setShowManageModal] = useState(false)
  const [manageStep, setManageStep] = useState(1) // 1 = Verify Password, 2 = Change Details
  const [currentPasswordInput, setCurrentPasswordInput] = useState('')
  const [accountEditToken, setAccountEditToken] = useState('')
  const [newUsernameInput, setNewUsernameInput] = useState('')
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('')
  const [manageError, setManageError] = useState('')
  const [manageSuccess, setManageSuccess] = useState('')

  // Backups and Audit Logs States
  const [backups, setBackups] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)

  // Production Categories & Pricing Settings States
  const [productionCategories, setProductionCategories] = useState(PRODUCTION_CATEGORIES)
  const [newCatName, setNewCatName] = useState('')
  const [newCatRate, setNewCatRate] = useState('')
  const [pricingRates, setPricingRates] = useState(DEFAULT_PRICING_RATES)
  const [pricingInputs, setPricingInputs] = useState(DEFAULT_PRICING_RATES)
  const [loadingPricing, setLoadingPricing] = useState(false)

  const handleReturnToLogin = () => {
    setIsForgotMode(false);
    setForgotStep(1);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotMsg('');
    setForgotError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setLoginError(data.message || 'Login failed.');
      }
    } catch (err) {
      setLoginError('Failed to connect to the server.');
    }
  };

  const sendOTP = async () => {
    setForgotMsg('');
    setForgotError('');
    setForgotStep(1);
    setOtpCode('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        setForgotMsg('A 6-digit OTP code has been sent to your Telegram bot.');
      } else {
        setForgotError(data.message || 'Failed to send OTP.');
      }
    } catch (err) {
      setForgotError('Failed to connect to the server.');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setForgotError('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await response.json();
      if (response.ok) {
        setResetToken(data.resetToken);
        setForgotStep(2);
      } else {
        setForgotError(data.message || 'Verification failed.');
      }
    } catch (err) {
      setForgotError('Failed to connect to the server.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setForgotError('');

    if (!newPassword || !confirmPassword) {
      setForgotError('Password fields cannot be empty.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        setForgotStep(3);
        setTimeout(handleReturnToLogin, 5000);
      } else {
        setForgotError(data.message || 'Reset password failed.');
      }
    } catch (err) {
      setForgotError('Failed to connect to the server.');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setShowLogoutDropdown(false);
    setActivePage('Dashboard');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  useEffect(() => {
    if (!showLogoutDropdown) return;

    const handleOutsideClick = (event) => {
      const topbarActions = document.querySelector('.topbar-actions');
      if (topbarActions && !topbarActions.contains(event.target)) {
        setShowLogoutDropdown(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showLogoutDropdown]);

  const handleVerifyCurrentPassword = async (e) => {
    e.preventDefault();
    setManageError('');
    setManageSuccess('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-current-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: currentPasswordInput }),
      });
      const data = await response.json();
      if (response.ok) {
        setAccountEditToken(data.accountEditToken);
        setManageStep(2);
        setCurrentPasswordInput('');
      } else {
        setManageError(data.message || 'Verification failed.');
      }
    } catch (err) {
      setManageError('Failed to connect to the server.');
    }
  };

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    setManageError('');
    setManageSuccess('');

    if (!newUsernameInput.trim() || !newPasswordInput || !confirmNewPasswordInput) {
      setManageError('Fields cannot be empty.');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setManageError('New passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/update-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accountEditToken,
          newUsername: newUsernameInput,
          newPassword: newPasswordInput
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setManageSuccess('Credentials updated successfully! Logging out...');
        setNewUsernameInput('');
        setNewPasswordInput('');
        setConfirmNewPasswordInput('');
        setAccountEditToken('');
        setManageStep(1);
        setTimeout(() => {
          setShowManageModal(false);
          handleLogout();
        }, 3000);
      } else {
        setManageError(data.message || 'Failed to update credentials.');
      }
    } catch (err) {
      setManageError('Failed to connect to the server.');
    }
  };

  const handleCloseManageModal = () => {
    setShowManageModal(false);
    setManageStep(1);
    setCurrentPasswordInput('');
    setAccountEditToken('');
    setNewUsernameInput(currentUsername);
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    setManageError('');
    setManageSuccess('');
  };

  const [formData, setFormData] = useState(createEmptyForm('1'))
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [shouldScrollToDetails, setShouldScrollToDetails] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [pendingCustomField, setPendingCustomField] = useState(null) // { itemIndex, name }
  const [orderFilter, setOrderFilter] = useState('All')
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All')
  const [orderContactFilter, setOrderContactFilter] = useState('All')
  const [orderSchoolFilter, setOrderSchoolFilter] = useState('All')
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState('All')
  const [orderCustomStartDate, setOrderCustomStartDate] = useState('')
  const [orderCustomEndDate, setOrderCustomEndDate] = useState('')
  const [whatsappMode, setWhatsappMode] = useState(() => {
    return localStorage.getItem('whatsapp_mode') || 'web'
  })

  const handleUpdateWhatsappMode = (mode) => {
    setWhatsappMode(mode)
    localStorage.setItem('whatsapp_mode', mode)
  }
  const isEditing = Boolean(editingOrderId)
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [whatsappTemplates, setWhatsappTemplates] = useState(DEFAULT_WHATSAPP_TEMPLATES)
  const [waitlistTemplateInput, setWaitlistTemplateInput] = useState(DEFAULT_WHATSAPP_TEMPLATES.waitlistTemplate)
  const [orderReadyTemplateInput, setOrderReadyTemplateInput] = useState(DEFAULT_WHATSAPP_TEMPLATES.orderReadyTemplate)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [logSearch, setLogSearch] = useState('')
  const [logTypeFilter, setLogTypeFilter] = useState('All')
  const [logDateFilter, setLogDateFilter] = useState('')
  const [waitlist, setWaitlist] = useState([])
  const [loadingWaitlist, setLoadingWaitlist] = useState(false)
  const [waitlistSearch, setWaitlistSearch] = useState('')
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState('All')
  const [showWaitlistModal, setShowWaitlistModal] = useState(false)
  const [selectedWaitlistRequest, setSelectedWaitlistRequest] = useState(null)
  const [waitlistFormData, setWaitlistFormData] = useState(createEmptyWaitlistForm())
  const [waitlistSchools, setWaitlistSchools] = useState([])
  const [waitlistSchoolFilter, setWaitlistSchoolFilter] = useState('All')
  const [showSchoolManager, setShowSchoolManager] = useState(false)
  const [newSchoolNameInput, setNewSchoolNameInput] = useState('')
  const [editingSchoolId, setEditingSchoolId] = useState(null)
  const [editingSchoolNameInput, setEditingSchoolNameInput] = useState('')
  const getInitialPdfFileName = () => {
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    return `Tailor_Production_Queue_${dd}-${mm}-${yyyy}`
  }

  const [activePage, setActivePage] = useState('Dashboard')
  const [restockSubSection, setRestockSubSection] = useState(null)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [pdfOrientation, setPdfOrientation] = useState('landscape')
  const [pdfFormat, setPdfFormat] = useState('a4')
  const [pdfMargin, setPdfMargin] = useState('normal')
  const [pdfScale, setPdfScale] = useState('normal')
  const [pdfFileName, setPdfFileName] = useState(getInitialPdfFileName)
  const pdfPreviewSheetRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(20)
  const loadStep = 20
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedWaitlistIds, setSelectedWaitlistIds] = useState([])
  const [now, setNow] = useState(Date.now())
  const [timerAlertOrder, setTimerAlertOrder] = useState(null)
  const [timerAlertWaitlist, setTimerAlertWaitlist] = useState(null)
  const [highlightedOrderId, setHighlightedOrderId] = useState(null)
  const [originalFormData, setOriginalFormData] = useState(null)

  // Cycle & Cleanup Modals State
  const [showCleanupConfirmModal, setShowCleanupConfirmModal] = useState(false)
  const [cleanupPreviewData, setCleanupPreviewData] = useState(null)
  const [pendingOrderPayload, setPendingOrderPayload] = useState(null)

  // Party Restock State
  const [parties, setParties] = useState([])
  const [loadingParties, setLoadingParties] = useState(false)
  const [vendorOrders, setVendorOrders] = useState([])
  const [loadingVendorOrders, setLoadingVendorOrders] = useState(false)
  const [vendorOrderSearch, setVendorOrderSearch] = useState('')
  const [vendorOrderSearchFocused, setVendorOrderSearchFocused] = useState(false)
  const poSearchInputRef = useRef(null)
  const [vendorOrderPartyFilter, setVendorOrderPartyFilter] = useState('All')
  const [vendorOrderStatusFilter, setVendorOrderStatusFilter] = useState('All')
  const [vendorOrderSchoolFilter, setVendorOrderSchoolFilter] = useState('All')

  // Vendor Order Modals
  const [showVendorOrderModal, setShowVendorOrderModal] = useState(false)
  const [selectedVendorOrder, setSelectedVendorOrder] = useState(null)
  const [vendorOrderFormData, setVendorOrderFormData] = useState({
    poNumber: '',
    partyName: '',
    targetDate: '',
    notes: '',
    products: [{ productName: '', school: '', specifications: getDefaultSpecifications(), sizeBreakdown: [{ size: '28', orderedQty: '' }] }]
  })

  // PO PDF Export Modal State
  const [showPOPDFModal, setShowPOPDFModal] = useState(false)
  const [selectedPOForPDF, setSelectedPOForPDF] = useState(null)
  const [poPdfFileName, setPoPdfFileName] = useState('')
  const [poPdfOrientation, setPoPdfOrientation] = useState('landscape')
  const [poPdfFormat, setPoPdfFormat] = useState('a4')
  const [poPdfMargin, setPoPdfMargin] = useState('normal')
  const [poPdfScale, setPoPdfScale] = useState('normal')
  const [exportingPOPDF, setExportingPOPDF] = useState(false)
  const poPdfPreviewSheetRef = useRef(null)

  // Installment Modal
  const [showInstallmentModal, setShowInstallmentModal] = useState(false)
  const [selectedOrderForInstallment, setSelectedOrderForInstallment] = useState(null)
  const [installmentFormData, setInstallmentFormData] = useState({
    notes: '',
    items: []
  })

  // Supplier Manager Modal
  const [showPartyManagerModal, setShowPartyManagerModal] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState(null)
  const [partyFormData, setPartyFormData] = useState({
    name: '',
    contactNumber: '',
    notes: ''
  })

  // Edit Installment Modal State
  const [showEditInstallmentModal, setShowEditInstallmentModal] = useState(false)
  const [editingInstallment, setEditingInstallment] = useState(null)

  const [editingLabelKey, setEditingLabelKey] = useState(null)

  // Bulk Client Orders State
  const [clients, setClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [bulkOrders, setBulkOrders] = useState([])
  const [loadingBulkOrders, setLoadingBulkOrders] = useState(false)
  const [bulkOrderSearch, setBulkOrderSearch] = useState('')
  const [bulkOrderSearchFocused, setBulkOrderSearchFocused] = useState(false)
  const boSearchInputRef = useRef(null)
  const [bulkOrderClientFilter, setBulkOrderClientFilter] = useState('All')
  const [bulkOrderStatusFilter, setBulkOrderStatusFilter] = useState('All')
  const [bulkOrderSchoolFilter, setBulkOrderSchoolFilter] = useState('All')

  // Bulk Order Modals
  const [showBulkOrderModal, setShowBulkOrderModal] = useState(false)
  const [selectedBulkOrder, setSelectedBulkOrder] = useState(null)
  const [bulkOrderFormData, setBulkOrderFormData] = useState({
    boNumber: '',
    clientName: '',
    targetDate: '',
    notes: '',
    products: [{ productName: '', school: '', specifications: getDefaultSpecifications(), sizeBreakdown: [{ size: '28', orderedQty: '', unitPrice: '' }] }]
  })

  // Bulk Order PDF Export Modal State
  const [showBOPDFModal, setShowBOPDFModal] = useState(false)
  const [selectedBOForPDF, setSelectedBOForPDF] = useState(null)
  const [boPdfFileName, setBoPdfFileName] = useState('')
  const [boPdfOrientation, setBoPdfOrientation] = useState('landscape')
  const [boPdfFormat, setBoPdfFormat] = useState('a4')
  const [boPdfMargin, setBoPdfMargin] = useState('normal')
  const [boPdfScale, setBoPdfScale] = useState('normal')
  const [exportingBOPDF, setExportingBOPDF] = useState(false)
  const boPdfPreviewSheetRef = useRef(null)

  // Dispatch Stock Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState(null)
  const [dispatchFormData, setDispatchFormData] = useState({
    challanNumber: '',
    notes: '',
    items: []
  })

  // Clients Directory Manager Modal
  const [showClientManagerModal, setShowClientManagerModal] = useState(false)
  const [editingClientId, setEditingClientId] = useState(null)
  const [clientFormData, setClientFormData] = useState({
    name: '',
    contactNumber: '',
    address: '',
    gstNumber: '',
    email: '',
    notes: ''
  })
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('')

  // Edit Dispatch Batch Modal State
  const [showEditDispatchModal, setShowEditDispatchModal] = useState(false)
  const [editingDispatch, setEditingDispatch] = useState(null)

  // Tailor Work Page Filters & Selections
  const [tailorStatusFilter, setTailorStatusFilter] = useState('Pending')
  const [tailorProductFilter, setTailorProductFilter] = useState('All')
  const [tailorCategoryFilter, setTailorCategoryFilter] = useState('All')
  const [tailorSchoolFilter, setTailorSchoolFilter] = useState('All')
  const [tailorDeliveryFilter, setTailorDeliveryFilter] = useState('All')
  const [tailorCustomStartDate, setTailorCustomStartDate] = useState('')
  const [tailorCustomEndDate, setTailorCustomEndDate] = useState('')
  const [tailorSearchTerm, setTailorSearchTerm] = useState('')

  const deferredSearchTerm = useDeferredValue(searchTerm)
  const deferredTailorSearchTerm = useDeferredValue(tailorSearchTerm)
  const [tailorSortKey, setTailorSortKey] = useState('deliveryDate')
  const [tailorSortOrder, setTailorSortOrder] = useState('asc')

  const hasFormChanges = useMemo(() => {
    if (!editingOrderId || !originalFormData) return true
    return JSON.stringify(formData) !== JSON.stringify(originalFormData)
  }, [editingOrderId, formData, originalFormData])

  const maxActiveCycle = useMemo(() => {
    if (!orders || orders.length === 0) return 1
    return Math.max(...orders.map((o) => Number(o.cycle || 1)))
  }, [orders])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!highlightedOrderId) return undefined

    const handleClear = () => {
      setHighlightedOrderId(null)
    }

    window.addEventListener('keydown', handleClear)
    window.addEventListener('mousedown', handleClear)

    return () => {
      window.removeEventListener('keydown', handleClear)
      window.removeEventListener('mousedown', handleClear)
    }
  }, [highlightedOrderId])

  useEffect(() => {
    if (!timerAlertOrder) return undefined
    const timeout = setTimeout(() => {
      setTimerAlertOrder(null)
    }, 5000)
    return () => clearTimeout(timeout)
  }, [timerAlertOrder])

  useEffect(() => {
    if (!timerAlertWaitlist) return undefined
    const timeout = setTimeout(() => {
      setTimerAlertWaitlist(null)
    }, 5000)
    return () => clearTimeout(timeout)
  }, [timerAlertWaitlist])

  useEffect(() => {
    if (!message) return undefined
    const timeout = setTimeout(() => {
      setMessage('')
    }, 5000)
    return () => clearTimeout(timeout)
  }, [message])

  const detailsPanelRef = useRef(null)

  useEffect(() => {
    if (selectedOrder && shouldScrollToDetails && detailsPanelRef.current) {
      detailsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setShouldScrollToDetails(false)
    }
  }, [selectedOrder, shouldScrollToDetails])


  const currentTimerAlertOrder = timerAlertOrder
    ? orders.find((o) => o._id === timerAlertOrder._id) || timerAlertOrder
    : null

  const tableWrapRef = useRef(null)
  const tailorTableWrapRef = useRef(null)
  const editScrollSaved = useRef({ scrollY: 0, visibleCount: 20, orderId: null, pendingRestore: false })


  const scrollTailorToTop = () => {
    if (tailorTableWrapRef.current) {
      tailorTableWrapRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const scrollTailorToBottom = () => {
    if (tailorTableWrapRef.current) {
      const table = tailorTableWrapRef.current.querySelector('table')
      if (table) {
        const rows = table.querySelectorAll('tbody tr')
        if (rows.length > 0) {
          rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' })
          return
        }
      }
      tailorTableWrapRef.current.scrollTo({
        top: tailorTableWrapRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  const scrollToTop = () => {
    if (tableWrapRef.current) {
      tableWrapRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    if (visibleCount < sortedOrders.length) {
      setVisibleCount(sortedOrders.length)
    }
    setTimeout(() => {
      if (tableWrapRef.current) {
        const table = tableWrapRef.current.querySelector('table')
        if (table) {
          const rows = table.querySelectorAll('tbody tr')
          if (rows.length > 0) {
            rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' })
            return
          }
        }
        tableWrapRef.current.scrollTo({
          top: tableWrapRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth',
      })
    }, 250)
  }

  const fetchOrders = async (term = '') => {
    if (!token) return;
    setLoadingOrders(true)

    try {
      const response = await fetch(`${API_BASE}/api/orders?search=${encodeURIComponent(term)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      const data = await response.json()

      if (response.ok) {
        setOrders(data)
        if (!selectedOrder) {
          setSelectedOrder(data[0] || null)
        }
      }
    } catch (error) {
      console.error('Unable to load orders', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    if (token) {
      Promise.all([
        fetchOrders(''),
        fetchPricingRates(),
        fetchCurrentUser(),
        fetchWaitlist('', 'All', 'All', true),
        fetchWaitlistSchools(),
        fetchParties(),
        fetchVendorOrders('', 'All', 'All', true),
        fetchClients(),
        fetchBulkOrders('', 'All', 'All', true)
      ]).catch(() => { })
    } else {
      setOrders([])
      setSelectedOrder(null)
      setWaitlist([])
      setWaitlistSchools([])
      setParties([])
      setVendorOrders([])
      setClients([])
      setBulkOrders([])
    }
  }, [token])

  const fetchCurrentUser = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setCurrentUsername(data.username);
        setNewUsernameInput(data.username);
      }
    } catch (error) {
      console.error('Failed to fetch user context', error);
    }
  };

  const fetchSessions = async () => {
    if (!token) return
    setLoadingSessions(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }
      const data = await response.json()
      if (response.ok) {
        setSessions(data)
      } else {
        console.error('Failed to load active sessions:', data.message)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    if (!token) return
    if (!window.confirm('Are you sure you want to log out this device?')) return

    try {
      const response = await fetch(`${API_BASE}/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }
      const data = await response.json()
      if (response.ok) {
        fetchSessions()
      } else {
        alert(data.message || 'Failed to revoke session')
      }
    } catch (error) {
      console.error('Error revoking session:', error)
    }
  }

  const handleRevokeOthers = async () => {
    if (!token) return
    if (!window.confirm('Are you sure you want to log out all other devices?')) return

    try {
      const response = await fetch(`${API_BASE}/api/auth/sessions/logout-others`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }
      const data = await response.json()
      if (response.ok) {
        fetchSessions()
      } else {
        alert(data.message || 'Failed to bulk log out other devices')
      }
    } catch (error) {
      console.error('Error bulk revoking sessions:', error)
    }
  }

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setCurrentUsername('');
      setNewUsernameInput('');
    }
  }, [token]);

  useEffect(() => {
    if (activePage === 'Settings' && token) {
      fetchSessions()
    }
  }, [activePage, token]);

  const fetchPricingRates = async () => {
    if (!token) return
    setLoadingPricing(true)
    try {
      const response = await fetch(`${API_BASE}/api/settings/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.categories) {
          setProductionCategories(data.categories)
        }
        if (data.rates) {
          setPricingRates(data.rates)
          setPricingInputs(data.rates)
        }
      }
    } catch (error) {
      console.error('Failed to load production categories & pricing rates', error)
    } finally {
      setLoadingPricing(false)
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!token || !newCatName.trim()) return
    setLoadingPricing(true)
    try {
      const response = await fetch(`${API_BASE}/api/settings/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCatName.trim(), defaultRate: Number(newCatRate || 0) })
      })
      const data = await response.json()
      if (response.ok) {
        alert(data.message || 'Production category added successfully!')
        if (data.categories) setProductionCategories(data.categories)
        if (data.rates) {
          setPricingRates(data.rates)
          setPricingInputs(data.rates)
        }
        setNewCatName('')
        setNewCatRate('')
        fetchAuditLogs()
      } else {
        alert('Failed to add category: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Add category error', error)
      alert('Network error while adding category.')
    } finally {
      setLoadingPricing(false)
    }
  }

  const handleDeleteCategory = async (id, name) => {
    if (!token) return
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return
    setLoadingPricing(true)
    try {
      const response = await fetch(`${API_BASE}/api/settings/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        alert(data.message || 'Production category deleted!')
        if (data.categories) setProductionCategories(data.categories)
        fetchAuditLogs()
      } else {
        alert('Failed to delete category: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Delete category error', error)
      alert('Network error while deleting category.')
    } finally {
      setLoadingPricing(false)
    }
  }

  const handleUpdatePricing = async (e) => {
    e.preventDefault()
    if (!token) return
    setLoadingPricing(true)
    try {
      const response = await fetch(`${API_BASE}/api/settings/pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: pricingInputs })
      })
      if (response.ok) {
        const data = await response.json()
        setMessage(data.message || 'Garment cost pricing rates updated successfully!')
        if (data.settings && data.settings.value) {
          setPricingRates(data.settings.value)
          setPricingInputs(data.settings.value)
        } else {
          setPricingRates(pricingInputs)
        }
        fetchAuditLogs()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update pricing rates')
      }
    } catch (error) {
      console.error('Failed to update pricing rates', error)
      alert('Network error while updating pricing rates.')
    } finally {
      setLoadingPricing(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchPricingRates()
    }
  }, [token])

  const fetchBackups = async () => {
    if (!token) return
    setLoadingBackups(true)
    try {
      const response = await fetch(`${API_BASE}/api/backups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setBackups(data)
      }
    } catch (error) {
      console.error('Failed to load backups', error)
    } finally {
      setLoadingBackups(false)
    }
  }

  const fetchAuditLogs = async (search = '', type = logTypeFilter, date = logDateFilter) => {
    if (!token) return
    setLoadingAuditLogs(true)
    try {
      let url = `${API_BASE}/api/audit-logs?type=${type}`;
      if (date) {
        url += `&date=${date}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAuditLogs(data)
      }
    } catch (error) {
      console.error('Failed to load audit logs', error)
    } finally {
      setLoadingAuditLogs(false)
    }
  }

  const filteredAuditLogs = useMemo(() => {
    if (!logSearch || logSearch.trim() === '') return auditLogs

    const rawQuery = logSearch.trim().toLowerCase()
    const cleanQuery = rawQuery.replace(/^#/, '').trim()
    const queryTokens = cleanQuery.split(/\s+/).filter(Boolean)

    if (queryTokens.length === 0) return auditLogs

    return auditLogs.filter(log => {
      const orderNum = String(log.orderNumber || '').trim().toLowerCase()
      const action = String(log.action || '').trim().toLowerCase()
      const details = String(log.details || log.message || '').trim().toLowerCase()
      const username = String(log.performedBy || log.username || '').trim().toLowerCase()

      const targetText = `${orderNum} ${action} ${details} ${username}`
      return queryTokens.every(token => targetText.includes(token))
    })
  }, [auditLogs, logSearch])

  const fetchWaitlist = async (search = waitlistSearch, status = waitlistStatusFilter, school = waitlistSchoolFilter, silent = false) => {
    if (!token) return
    if (!silent && waitlist.length === 0) setLoadingWaitlist(true)
    try {
      const response = await fetch(`${API_BASE}/api/waitlist?search=${encodeURIComponent(search)}&status=${status}&school=${school}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }
      if (response.ok) {
        const data = await response.json()
        setWaitlist(data)
      }
    } catch (error) {
      console.error('Failed to load waitlist', error)
    } finally {
      setLoadingWaitlist(false)
    }
  }

  const fetchWaitlistSchools = async () => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/schools`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setWaitlistSchools(data)
      }
    } catch (error) {
      console.error('Failed to load waitlist schools', error)
    }
  }

  const handleSaveWaitlistSchool = async (e) => {
    e.preventDefault()
    if (!token || !newSchoolNameInput.trim()) return
    const rawName = newSchoolNameInput.trim()
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/schools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: formattedName })
      })

      const data = await response.json()
      if (response.ok) {
        setNewSchoolNameInput('')
        fetchWaitlistSchools()
        setWaitlistFormData(prev => ({ ...prev, schools: [...(prev.schools || []), data.name] }))
        setFormData(prev => ({ ...prev, school: data.name }))
      } else {
        alert(data.message || 'Failed to create school')
      }
    } catch (error) {
      console.error('Failed to save school', error)
    }
  }

  const handleRenameWaitlistSchool = async (id, newName) => {
    if (!token || !newName.trim()) return
    const schoolObj = waitlistSchools.find(s => s._id === id)
    const oldName = schoolObj?.name
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/schools/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName.trim() })
      })

      if (response.ok) {
        setEditingSchoolId(null)
        setEditingSchoolNameInput('')
        fetchWaitlistSchools()
        fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, true)
        fetchOrders(searchTerm)
        if (oldName && formData.school === oldName) {
          setFormData(prev => ({ ...prev, school: newName.trim() }))
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to rename school')
      }
    } catch (error) {
      console.error('Failed to rename school', error)
    }
  }

  const handleDeleteWaitlistSchool = async (id, name) => {
    if (!token) return
    if (!window.confirm(`Are you sure you want to delete "${name}" from the school list? This will clear this school name from active waitlist requests.`)) return
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/schools/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        fetchWaitlistSchools()
        fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, true)
        setWaitlistFormData(prev => ({
          ...prev,
          schools: (prev.schools || []).filter(s => s !== name)
        }))
        if (formData.school === name) {
          setFormData(prev => ({ ...prev, school: '' }))
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete school')
      }
    } catch (error) {
      console.error('Failed to delete school', error)
    }
  }

  const handleSaveWaitlistRequest = async (e) => {
    e.preventDefault()
    if (!token) return
    const isEditing = Boolean(selectedWaitlistRequest)
    const url = isEditing ? `${API_BASE}/api/waitlist/${selectedWaitlistRequest._id}` : `${API_BASE}/api/waitlist`
    const method = isEditing ? 'PATCH' : 'POST'

    const cleanPhone = (waitlistFormData.contactNumber || '').replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      alert("Contact number must contain exactly 10 digits.")
      return
    }

    const cleanedItems = (waitlistFormData.items || [])
      .map(item => ({
        name: item.name ? item.name.trim() : '',
        status: item.status || 'Pending'
      }))
      .filter(item => item.name)

    if (cleanedItems.length === 0) {
      alert("Please fill in at least one item details field.")
      return
    }

    const payload = {
      ...waitlistFormData,
      contactNumber: cleanPhone,
      items: cleanedItems
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }

      const data = await response.json()
      if (response.ok) {
        setMessage(`Waitlist request for '${data.customerName}' saved successfully.`)
        handleCloseWaitlistModal()
        fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, true)
      } else {
        alert(data.message || 'Failed to save waitlist entry')
      }
    } catch (error) {
      console.error('Waitlist submit error:', error)
    }
  }

  const handleToggleWaitlistStatus = async (request) => {
    if (!token) return
    const nextStatus = request.status === 'Pending' ? 'Notified' : 'Pending'
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/${request._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }

      if (response.ok) {
        fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, true)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to toggle status')
      }
    } catch (error) {
      console.error('Waitlist toggle status error:', error)
    }
  }

  const handleDeleteWaitlistRequest = async (id, customerName) => {
    if (!token) return
    if (!window.confirm(`Are you sure you want to remove the waitlist request for ${customerName}?`)) return
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }

      if (response.ok) {
        setMessage(`Waitlist entry removed.`)
        fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, true)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete waitlist entry')
      }
    } catch (error) {
      console.error('Waitlist delete error:', error)
    }
  }

  const toggleSelectWaitlist = (id) => {
    setSelectedWaitlistIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const unselectAllWaitlist = () => {
    setSelectedWaitlistIds([])
  }

  const handleBulkDeleteWaitlist = async () => {
    if (!selectedWaitlistIds.length) return
    if (!window.confirm(`Are you sure you want to delete ${selectedWaitlistIds.length} waitlist request(s)? This action cannot be undone.`)) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedWaitlistIds })
      })

      if (response.ok) {
        const data = await response.json()
        setMessage(data.message || `Deleted ${selectedWaitlistIds.length} waitlist entry(s).`)
        setSelectedWaitlistIds([])
        fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, true)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to bulk delete waitlist entries.')
      }
    } catch (error) {
      console.error('Failed to bulk delete waitlist entries', error)
    }
  }

  const handleOpenAddWaitlistModal = () => {
    setSelectedWaitlistRequest(null)
    setWaitlistFormData(createEmptyWaitlistForm())
    setShowWaitlistModal(true)
  }

  const handleOpenEditWaitlistModal = (request) => {
    setSelectedWaitlistRequest(request)
    setWaitlistFormData({
      customerName: request.customerName || '',
      contactNumber: request.contactNumber || '',
      schools: request.schools && request.schools.length > 0
        ? [...request.schools]
        : (request.school ? [request.school] : []),
      items: request.items && request.items.length > 0
        ? [...request.items]
        : [request.itemDetails || ''],
      notes: request.notes || ''
    })
    setShowWaitlistModal(true)
  }

  const handleCloseWaitlistModal = () => {
    setShowSchoolManager(false)
    setShowWaitlistModal(false)
    setSelectedWaitlistRequest(null)
    setWaitlistFormData(createEmptyWaitlistForm())
  }

  const handleToggleItemStatus = async (request, itemIndex) => {
    if (!token) return
    const updatedItems = [...request.items]
    const currentStatus = updatedItems[itemIndex].status || 'Pending'
    updatedItems[itemIndex].status = currentStatus === 'Pending' ? 'Notified' : 'Pending'

    try {
      const response = await fetch(`${API_BASE}/api/waitlist/${request._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items: updatedItems })
      })
      if (response.ok) {
        fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, true)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update item status')
      }
    } catch (error) {
      console.error('Failed to toggle item status', error)
    }
  }

  const handleSendSingleWhatsAppNotification = async (request, itemIndex) => {
    const item = request.items[itemIndex]
    const cleanPhone = request.contactNumber.replace(/\D/g, '')
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone

    const rawTemplate = (whatsappTemplates && whatsappTemplates.waitlistTemplate) || DEFAULT_WHATSAPP_TEMPLATES.waitlistTemplate
    const messageText = rawTemplate
      .replace(/\{customerName\}/g, request.customerName || 'Customer')
      .replace(/\{items\}/g, `"${item.name}"`)
      .replace(/\{school\}/g, (request.schools && request.schools.length) ? request.schools.join(', ') : 'General')

    const encodedText = encodeURIComponent(messageText)

    const link = whatsappMode === 'app'
      ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
      : `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`

    window.open(link, '_blank')
  }

  const handleSendAllWhatsAppNotification = async (request) => {
    const cleanPhone = request.contactNumber.replace(/\D/g, '')
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone

    const remainingItems = (request.items || []).filter(i => i.status !== 'Notified')
    if (remainingItems.length === 0) return

    const itemNames = remainingItems.map(i => `"${i.name}"`).join(', ')
    const rawTemplate = (whatsappTemplates && whatsappTemplates.waitlistTemplate) || DEFAULT_WHATSAPP_TEMPLATES.waitlistTemplate
    const messageText = rawTemplate
      .replace(/\{customerName\}/g, request.customerName || 'Customer')
      .replace(/\{items\}/g, itemNames)
      .replace(/\{school\}/g, (request.schools && request.schools.length) ? request.schools.join(', ') : 'General')

    const encodedText = encodeURIComponent(messageText)

    const link = whatsappMode === 'app'
      ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
      : `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`

    window.open(link, '_blank')
  }

  const fetchParties = async () => {
    if (!token) return
    setLoadingParties(true)
    try {
      const response = await fetch(`${API_BASE}/api/parties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setParties(data)
      }
    } catch (err) {
      console.error('Failed to load parties', err)
    } finally {
      setLoadingParties(false)
    }
  }

  const fetchVendorOrders = async (search = vendorOrderSearch, party = vendorOrderPartyFilter, status = vendorOrderStatusFilter, silent = false) => {
    if (!token) return
    if (!silent && vendorOrders.length === 0) setLoadingVendorOrders(true)
    try {
      const response = await fetch(`${API_BASE}/api/vendor-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }
      if (response.ok) {
        const data = await response.json()
        setVendorOrders(data)
      }
    } catch (err) {
      console.error('Failed to load vendor orders', err)
    } finally {
      setLoadingVendorOrders(false)
    }
  }

  const fetchClients = async () => {
    if (!token) return
    setLoadingClients(true)
    try {
      const response = await fetch(`${API_BASE}/api/clients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (err) {
      console.error('Failed to load clients', err)
    } finally {
      setLoadingClients(false)
    }
  }

  const fetchBulkOrders = async (search = bulkOrderSearch, client = bulkOrderClientFilter, status = bulkOrderStatusFilter, silent = false) => {
    if (!token) return
    if (!silent && bulkOrders.length === 0) setLoadingBulkOrders(true)
    try {
      const response = await fetch(`${API_BASE}/api/bulk-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        handleLogout()
        return
      }
      if (response.ok) {
        const data = await response.json()
        setBulkOrders(data)
      }
    } catch (err) {
      console.error('Failed to load bulk orders', err)
    } finally {
      setLoadingBulkOrders(false)
    }
  }

  const sortSizesAscending = (sizeArray) => {
    if (!Array.isArray(sizeArray)) return []
    return [...sizeArray].sort((a, b) => {
      const numA = parseFloat(a.size)
      const numB = parseFloat(b.size)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
      return String(a.size || '').localeCompare(String(b.size || ''), undefined, { numeric: true, sensitivity: 'base' })
    })
  }

  const handleSaveParty = async (e) => {
    e.preventDefault()
    if (!partyFormData.name || !partyFormData.name.trim()) {
      setMessage('Supplier name is required.')
      return
    }

    const isEditing = Boolean(editingSupplierId)
    const url = isEditing ? `${API_BASE}/api/parties/${editingSupplierId}` : `${API_BASE}/api/parties`
    const method = isEditing ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: partyFormData.name,
          contactNumber: partyFormData.contactNumber,
          notes: partyFormData.notes
        })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(isEditing ? `Supplier '${data.name}' updated.` : `Supplier '${data.name}' added successfully.`)
        setPartyFormData({ name: '', contactNumber: '', notes: '' })
        setEditingSupplierId(null)
        fetchParties()
      } else {
        setMessage(data.message || 'Failed to save supplier.')
      }
    } catch (err) {
      setMessage('Network error saving supplier.')
    }
  }

  const handleDeleteParty = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete supplier "${name}"?`)) return
    try {
      const response = await fetch(`${API_BASE}/api/parties/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setMessage(`Supplier '${name}' deleted.`)
        if (editingSupplierId === id) setEditingSupplierId(null)
        fetchParties()
      }
    } catch (err) {
      console.error('Failed to delete supplier', err)
    }
  }

  const getNormalizedProducts = (order) => {
    if (!order) return []
    if (Array.isArray(order.products) && order.products.length > 0) {
      return order.products
    }
    if (order.itemType && Array.isArray(order.sizeBreakdown)) {
      return [{
        productName: order.itemType,
        school: order.school || 'General',
        sizeBreakdown: order.sizeBreakdown
      }]
    }
    return []
  }

  const handleSaveVendorOrder = async (e) => {
    e.preventDefault()
    if (!vendorOrderFormData.partyName || !vendorOrderFormData.partyName.trim()) {
      setMessage('Supplier Name is required.')
      return
    }

    if (!Array.isArray(vendorOrderFormData.products) || vendorOrderFormData.products.length === 0) {
      setMessage('At least one product is required.')
      return
    }

    const cleanProducts = []
    for (const p of vendorOrderFormData.products) {
      const productName = (p.productName || '').trim()
      const school = (p.school || '').trim()
      if (!productName) {
        setMessage('Product Category / Name is required for all products.')
        return
      }
      if (!school) {
        setMessage('School / Institution / Firm Name is required for all products.')
        return
      }

      const cleanBreakdown = sortSizesAscending(
        (p.sizeBreakdown || [])
          .map(sb => ({ size: (sb.size || '').trim(), orderedQty: Number(sb.orderedQty || 0), unitPrice: Math.max(0, Number(sb.unitPrice || 0)) }))
          .filter(sb => sb.size && sb.orderedQty > 0)
      )

      if (cleanBreakdown.length === 0) {
        setMessage(`Product '${productName}' must have at least one size with ordered quantity > 0.`)
        return
      }

      const specs = getNormalizedSpecifications(p)
      cleanProducts.push({
        productName,
        school,
        specifications: specs,
        sizeBreakdown: cleanBreakdown
      })
    }

    const isEditing = Boolean(selectedVendorOrder)
    const url = isEditing ? `${API_BASE}/api/vendor-orders/${selectedVendorOrder._id}` : `${API_BASE}/api/vendor-orders`
    const method = isEditing ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          poNumber: !selectedVendorOrder ? `PO-${String(Number(vendorOrderFormData.poNumber) || getNextPoNumber(vendorOrders)).padStart(4, '0')}` : undefined,
          partyName: vendorOrderFormData.partyName,
          products: cleanProducts,
          targetDate: vendorOrderFormData.targetDate,
          notes: vendorOrderFormData.notes
        })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(isEditing ? `Order ${data.poNumber} updated.` : `Order ${data.poNumber} placed with supplier '${data.partyName}'.`)
        setShowVendorOrderModal(false)
        setSelectedVendorOrder(null)
        fetchVendorOrders(vendorOrderSearch, vendorOrderPartyFilter, vendorOrderStatusFilter, true)
      } else {
        setMessage(data.message || 'Failed to save supplier order.')
      }
    } catch (err) {
      setMessage('Network error saving supplier order.')
    }
  }

  const handleDeleteVendorOrder = async (id, poNumber) => {
    if (!window.confirm(`Delete Supplier Order ${poNumber}? This cannot be undone.`)) return
    try {
      const response = await fetch(`${API_BASE}/api/vendor-orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setMessage(`Supplier Order ${poNumber} deleted.`)
        fetchVendorOrders(vendorOrderSearch, vendorOrderPartyFilter, vendorOrderStatusFilter, true)
      }
    } catch (err) {
      console.error('Failed to delete supplier order', err)
    }
  }

  const handleOpenInstallmentModal = (order) => {
    setSelectedOrderForInstallment(order)
    const prods = getNormalizedProducts(order)
    const initialItems = []
    prods.forEach(p => {
      sortSizesAscending(p.sizeBreakdown || []).forEach(sb => {
        const remainingQty = Math.max(0, (sb.orderedQty || 0) - (sb.receivedQty || 0))
        initialItems.push({
          productName: p.productName,
          school: p.school,
          size: sb.size,
          orderedQty: sb.orderedQty,
          receivedQty: sb.receivedQty || 0,
          remainingQty,
          newQty: ''
        })
      })
    })

    setInstallmentFormData({
      notes: '',
      items: initialItems
    })
    setShowInstallmentModal(true)
  }

  const handleLogInstallment = async (e) => {
    e.preventDefault()
    if (!selectedOrderForInstallment) return

    const itemsToSubmit = (installmentFormData.items || [])
      .map(i => ({ productName: i.productName, size: i.size, qty: Number(i.newQty || 0) }))
      .filter(i => i.size && i.qty > 0)

    if (itemsToSubmit.length === 0) {
      setMessage('Please enter quantity > 0 for at least one product size.')
      return
    }

    // Submit installment without strict remainingQty ceiling check

    try {
      const response = await fetch(`${API_BASE}/api/vendor-orders/${selectedOrderForInstallment._id}/installments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: itemsToSubmit,
          notes: installmentFormData.notes
        })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(`Stock installment logged for Order ${data.poNumber}.`)
        setShowInstallmentModal(false)
        setSelectedOrderForInstallment(null)
        fetchVendorOrders(vendorOrderSearch, vendorOrderPartyFilter, vendorOrderStatusFilter, true)
      } else {
        setMessage(data.message || 'Failed to log installment.')
      }
    } catch (err) {
      setMessage('Network error logging installment.')
    }
  }

  const handleOpenEditInstallment = (order, installment) => {
    setSelectedOrderForInstallment(order)
    const prods = getNormalizedProducts(order)
    const items = []
    prods.forEach(p => {
      const legacyPrice = Number(p?.unitPrice || 0)
      const sbList = Array.isArray(p?.sizeBreakdown) ? p.sizeBreakdown : []
      sortSizesAscending(sbList).forEach(sb => {
        const instItem = (installment.items || []).find(i => (!i.productName || i.productName === p.productName) && i.size === sb.size)
        // Calculate received from all OTHER installments
        let otherReceived = 0
        ;(order.installments || []).forEach(otherInst => {
          if (String(otherInst._id) !== String(installment._id)) {
            ;(otherInst.items || []).forEach(oi => {
              if ((!oi.productName || oi.productName === p.productName) && oi.size === sb.size) {
                otherReceived += (oi.qty || 0)
              }
            })
          }
        })
        const sbPrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))

        items.push({
          productName: p.productName,
          school: p.school,
          size: sb.size,
          orderedQty: sb.orderedQty || 0,
          unitPrice: sbPrice,
          otherReceived,
          qty: instItem ? String(instItem.qty || 0) : '0'
        })
      })
    })

    setEditingInstallment({
      orderId: order._id,
      installmentId: installment._id,
      challanNumber: installment.challanNumber || '',
      notes: installment.notes || '',
      items
    })
    setShowEditInstallmentModal(true)
  }

  const handleUpdateInstallment = async (e) => {
    e.preventDefault()
    if (!editingInstallment) return

    const itemsToSubmit = (editingInstallment.items || [])
      .map(i => ({ productName: i.productName, size: i.size, qty: Number(i.qty || 0) }))
      .filter(i => i.size && i.qty >= 0)

    // Submit installment edit without strict remainingQty ceiling check

    try {
      const response = await fetch(`${API_BASE}/api/vendor-orders/${editingInstallment.orderId}/installments/${editingInstallment.installmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          challanNumber: editingInstallment.challanNumber || '',
          items: itemsToSubmit,
          notes: editingInstallment.notes
        })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(`Stock installment updated for Order ${data.poNumber}.`)
        setShowEditInstallmentModal(false)
        setEditingInstallment(null)
        fetchVendorOrders(vendorOrderSearch, vendorOrderPartyFilter, vendorOrderStatusFilter, true)
      } else {
        setMessage(data.message || 'Failed to update installment.')
      }
    } catch (err) {
      setMessage('Network error updating installment.')
    }
  }

  const handleDeleteInstallment = async (order, installmentId) => {
    if (!window.confirm('Delete this logged stock installment batch? Stock totals will be recalculated automatically.')) return
    try {
      const response = await fetch(`${API_BASE}/api/vendor-orders/${order._id}/installments/${installmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setMessage(`Stock installment batch deleted for Order ${order.poNumber}.`)
        fetchVendorOrders(vendorOrderSearch, vendorOrderPartyFilter, vendorOrderStatusFilter, true)
      }
    } catch (err) {
      console.error('Failed to delete installment', err)
    }
  }


  const getDisplayCoNumber = (o) => {
    if (!o) return ''
    const raw = String(o.coNumber || o.boNumber || '')
    return raw.replace(/^BO-/i, 'CO-')
  }

  const getNextBoNumber = (ordersList) => {
    const list = Array.isArray(ordersList) ? ordersList : bulkOrders
    const nums = list.map(o => {
      const match = String(o.coNumber || o.boNumber || '').match(/(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    }).filter(n => !isNaN(n))
    return nums.length > 0 ? Math.max(...nums) + 1 : 1
  }

  const getNextCoNumber = getNextBoNumber

  const handleSaveClient = async (e) => {
    e.preventDefault()
    if (!clientFormData.name || !clientFormData.name.trim()) {
      setMessage('Client name is required.')
      return
    }

    const isEditing = Boolean(editingClientId)
    const url = isEditing ? `${API_BASE}/api/clients/${editingClientId}` : `${API_BASE}/api/clients`
    const method = isEditing ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: clientFormData.name,
          contactNumber: clientFormData.contactNumber,
          address: clientFormData.address,
          gstNumber: clientFormData.gstNumber,
          email: clientFormData.email,
          notes: clientFormData.notes
        })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(isEditing ? `Client '${data.name}' updated.` : `Client '${data.name}' added successfully.`)
        setClientFormData({ name: '', contactNumber: '', address: '', gstNumber: '', email: '', notes: '' })
        setEditingClientId(null)
        fetchClients()
      } else {
        setMessage(data.message || 'Failed to save client.')
      }
    } catch (err) {
      setMessage('Network error saving client.')
    }
  }

  const handleDeleteClient = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete client "${name}"?`)) return
    try {
      const response = await fetch(`${API_BASE}/api/clients/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setMessage(`Client '${name}' deleted.`)
        if (editingClientId === id) setEditingClientId(null)
        fetchClients()
      }
    } catch (err) {
      console.error('Failed to delete client', err)
    }
  }

  const handleSaveBulkOrder = async (e) => {
    e.preventDefault()
    if (!bulkOrderFormData.clientName || !bulkOrderFormData.clientName.trim()) {
      setMessage('Client Name is required.')
      return
    }

    if (!Array.isArray(bulkOrderFormData.products) || bulkOrderFormData.products.length === 0) {
      setMessage('At least one product is required.')
      return
    }

    const cleanProducts = []
    for (const p of bulkOrderFormData.products) {
      const productName = (p.productName || '').trim()
      const school = (p.school || '').trim()
      if (!productName) {
        setMessage('Product Category / Name is required for all products.')
        return
      }

      const cleanBreakdown = sortSizesAscending(
        (p.sizeBreakdown || [])
          .map(sb => ({
            size: (sb.size || '').trim(),
            orderedQty: Number(sb.orderedQty || 0),
            unitPrice: Math.max(0, Number(sb.unitPrice || 0))
          }))
          .filter(sb => sb.size && sb.orderedQty > 0)
      )

      if (cleanBreakdown.length === 0) {
        setMessage(`Product '${productName}' must have at least one size with ordered quantity > 0.`)
        return
      }

      const specs = getNormalizedSpecifications(p)
      cleanProducts.push({
        productName,
        school: 'General',
        specifications: specs,
        unitPrice: Math.max(0, Number(p.unitPrice || 0)),
        frontLogoCost: Math.max(0, Number(p.frontLogoCost || 0)),
        backLogoCost: Math.max(0, Number(p.backLogoCost || 0)),
        sizeBreakdown: cleanBreakdown
      })
    }

    const isEditing = Boolean(selectedBulkOrder)
    const url = isEditing ? `${API_BASE}/api/bulk-orders/${selectedBulkOrder._id}` : `${API_BASE}/api/bulk-orders`
    const method = isEditing ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          boNumber: !selectedBulkOrder ? `CO-${String(Number(bulkOrderFormData.boNumber) || getNextCoNumber(bulkOrders)).padStart(4, '0')}` : undefined,
          clientName: bulkOrderFormData.clientName,
          products: cleanProducts,
          targetDate: bulkOrderFormData.targetDate,
          notes: bulkOrderFormData.notes
        })
      })

      // Read response safely (handle JSON and plain text)
      let respBody = null
      const contentType = response.headers.get('content-type') || ''
      try {
        if (contentType.includes('application/json')) respBody = await response.json()
        else respBody = await response.text()
      } catch (e) {
        respBody = await response.text().catch(() => null)
      }

      if (response.status === 401 || response.status === 403) {
        console.warn('Auth error when saving bulk order', respBody)
        handleLogout()
        return
      }

      if (!response.ok) {
        console.error('Failed to save bulk order', response.status, respBody)
        const serverMsg = (respBody && typeof respBody === 'object' && respBody.message) ? respBody.message : (typeof respBody === 'string' ? respBody : null)
        setMessage(serverMsg || `Failed to save client order (status ${response.status}).`)
        return
      }

      const data = respBody
      const coStr = getDisplayCoNumber(data)
      setMessage(isEditing ? `Client Order ${coStr} updated.` : `Client Order ${coStr} created for client '${data.clientName}'.`)
      setShowBulkOrderModal(false)
      setSelectedBulkOrder(null)
      fetchBulkOrders(bulkOrderSearch, bulkOrderClientFilter, bulkOrderStatusFilter, true)
    } catch (err) {
      console.error('Network error saving client order', err)
      setMessage('Network error saving client order. Check console for details.')
    }
  }

  const handleDeleteBulkOrder = async (id, boNumber) => {
    const coStr = String(boNumber || '').replace(/^BO-/i, 'CO-')
    if (!window.confirm(`Delete Client Order ${coStr}? This cannot be undone.`)) return
    try {
      const response = await fetch(`${API_BASE}/api/bulk-orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setMessage(`Client Order ${coStr} deleted.`)
        fetchBulkOrders(bulkOrderSearch, bulkOrderClientFilter, bulkOrderStatusFilter, true)
      }
    } catch (err) {
      console.error('Failed to delete bulk order', err)
    }
  }

  const handleOpenDispatchModal = (order) => {
    setSelectedOrderForDispatch(order)
    const prods = getNormalizedProducts(order)
    const initialItems = []
    prods.forEach(p => {
      sortSizesAscending(p.sizeBreakdown || []).forEach(sb => {
        const remainingQty = Math.max(0, (sb.orderedQty || 0) - (sb.deliveredQty || 0))
        initialItems.push({
          productName: p.productName,
          school: p.school,
          size: sb.size,
          orderedQty: sb.orderedQty,
          deliveredQty: sb.deliveredQty || 0,
          remainingQty,
          newQty: ''
        })
      })
    })

    setDispatchFormData({
      challanNumber: '',
      notes: '',
      items: initialItems
    })
    setShowDispatchModal(true)
  }

  const handleLogDispatch = async (e) => {
    e.preventDefault()
    if (!selectedOrderForDispatch) return

    const itemsToSubmit = (dispatchFormData.items || [])
      .map(i => ({ productName: i.productName, size: i.size, qty: Number(i.newQty || 0) }))
      .filter(i => i.size && i.qty > 0)

    if (itemsToSubmit.length === 0) {
      setMessage('Please enter quantity > 0 for at least one product size.')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/bulk-orders/${selectedOrderForDispatch._id}/dispatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          challanNumber: dispatchFormData.challanNumber,
          items: itemsToSubmit,
          notes: dispatchFormData.notes
        })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(`Stock dispatch logged for Order ${data.boNumber}.`)
        setShowDispatchModal(false)
        setSelectedOrderForDispatch(null)
        fetchBulkOrders(bulkOrderSearch, bulkOrderClientFilter, bulkOrderStatusFilter, true)
      } else {
        setMessage(data.message || 'Failed to log dispatch batch.')
      }
    } catch (err) {
      setMessage('Network error logging dispatch batch.')
    }
  }

  const handleOpenEditDispatch = (order, dispatch) => {
    setSelectedOrderForDispatch(order)
    const prods = getNormalizedProducts(order)
    const items = []
    prods.forEach(p => {
      const frontLogo = Number(p?.frontLogoCost || 0)
      const backLogo = Number(p?.backLogoCost || 0)
      const logoPerPc = (isNaN(frontLogo) ? 0 : Math.max(0, frontLogo)) + (isNaN(backLogo) ? 0 : Math.max(0, backLogo))
      const legacyPrice = Number(p?.unitPrice || 0)
      const sbList = Array.isArray(p?.sizeBreakdown) ? p.sizeBreakdown : []
      sortSizesAscending(sbList).forEach(sb => {
        const instItem = (dispatch.items || []).find(i => (!i.productName || i.productName === p.productName) && i.size === sb.size)
        let otherDelivered = 0
        ;(order.dispatches || []).forEach(otherInst => {
          if (String(otherInst._id) !== String(dispatch._id)) {
            ;(otherInst.items || []).forEach(oi => {
              if ((!oi.productName || oi.productName === p.productName) && oi.size === sb.size) {
                otherDelivered += (oi.qty || 0)
              }
            })
          }
        })
        const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
        const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0

        items.push({
          productName: p.productName,
          school: p.school,
          size: sb.size,
          orderedQty: sb.orderedQty || 0,
          unitPrice: effectiveUnitPrice,
          otherDelivered,
          qty: instItem ? String(instItem.qty || 0) : '0'
        })
      })
    })

    setEditingDispatch({
      orderId: order._id,
      dispatchId: dispatch._id,
      challanNumber: dispatch.challanNumber || '',
      notes: dispatch.notes || '',
      items
    })
    setShowEditDispatchModal(true)
  }

  const handleUpdateDispatch = async (e) => {
    e.preventDefault()
    if (!editingDispatch) return

    const itemsToSubmit = (editingDispatch.items || [])
      .map(i => ({ productName: i.productName, size: i.size, qty: Number(i.qty || 0) }))
      .filter(i => i.size && i.qty >= 0)

    try {
      const response = await fetch(`${API_BASE}/api/bulk-orders/${editingDispatch.orderId}/dispatches/${editingDispatch.dispatchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          challanNumber: editingDispatch.challanNumber,
          items: itemsToSubmit,
          notes: editingDispatch.notes
        })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(`Stock dispatch updated for Order ${data.boNumber}.`)
        setShowEditDispatchModal(false)
        setEditingDispatch(null)
        fetchBulkOrders(bulkOrderSearch, bulkOrderClientFilter, bulkOrderStatusFilter, true)
      } else {
        setMessage(data.message || 'Failed to update dispatch batch.')
      }
    } catch (err) {
      setMessage('Network error updating dispatch batch.')
    }
  }

  const handleDeleteDispatch = async (order, dispatchId) => {
    if (!window.confirm('Delete this logged stock dispatch batch? Stock totals will be recalculated automatically.')) return
    try {
      const response = await fetch(`${API_BASE}/api/bulk-orders/${order._id}/dispatches/${dispatchId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setMessage(`Stock dispatch batch deleted for Order ${order.boNumber}.`)
        fetchBulkOrders(bulkOrderSearch, bulkOrderClientFilter, bulkOrderStatusFilter, true)
      }
    } catch (err) {
      console.error('Failed to delete dispatch batch', err)
    }
  }


  const exportVendorOrderCSV = (order) => {
    if (!order) return
    const prods = getNormalizedProducts(order)
    const partyClean = (order.partyName || 'Supplier').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `Purchase_Order_${order.poNumber || 'PO'}_${partyClean}.csv`

    const rows = []
    rows.push([`RESTOCK PURCHASE ORDER — ${order.poNumber}`])
    rows.push([`Supplier Name:`, order.partyName, `Target Date:`, order.targetDate || '-'])
    rows.push([])

    rows.push(['Product Breakdown'])
    rows.push(['Product Name', 'School / Firm', 'Size', 'Cost / Unit (₹)', 'Ordered Qty', 'Received Qty', 'Pending Balance', 'Row Cost (₹)'])

    let grandOrdered = 0
    let grandReceived = 0
    let grandPending = 0
    let grandCost = 0

    prods.forEach((p, pIdx) => {
      const sorted = sortSizesAscending(p.sizeBreakdown || [])
      // Legacy fallback: product-level price if no per-size prices set
      const legacyPrice = Number(p.unitPrice || 0)
      let pOrdered = 0
      let pReceived = 0
      let pPending = 0
      let pTotalCost = 0

      sorted.forEach((sb, idx) => {
        const ordered = sb.orderedQty || 0
        const received = sb.receivedQty || 0
        const pending = Math.max(0, ordered - received)
        const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
        const rowCost = sbPrice > 0 ? received * sbPrice : 0

        pOrdered += ordered
        pReceived += received
        pPending += pending
        pTotalCost += rowCost
        grandOrdered += ordered
        grandReceived += received
        grandPending += pending
        grandCost += rowCost

        const surplus = received > ordered ? received - ordered : 0
        const recStr = surplus > 0 ? `${received} pcs (+${surplus} Extra)` : `${received} pcs`

        rows.push([
          idx === 0 ? p.productName : '',
          idx === 0 ? p.school : '',
          sb.size,
          sbPrice > 0 ? `Rs. ${sbPrice}` : '-',
          `${ordered} pcs`,
          recStr,
          pending > 0 ? `${pending} pcs` : 'Done',
          rowCost > 0 ? `Rs. ${rowCost}` : '-'
        ])

        // Add specifications after the first size row
        if (idx === 0) {
          const specs = getNormalizedSpecifications(p).filter(s => s.value && String(s.value).trim())
          specs.forEach(spec => {
            rows.push(['', `  ${spec.label}${spec.value ? ': ' + spec.value : ''}`, '', '', '', '', '', ''])
          })
        }
      })

      const pSurplus = pReceived > pOrdered ? pReceived - pOrdered : 0
      const pRecStr = pSurplus > 0 ? `${pReceived} pcs (+${pSurplus} Extra)` : `${pReceived} pcs`

      rows.push([
        `Total (${p.productName})`,
        '',
        '',
        '',
        `${pOrdered} pcs`,
        pRecStr,
        pPending > 0 ? `${pPending} pcs` : 'Done',
        pTotalCost > 0 ? `Total Product Cost: Rs. ${pTotalCost}` : '-'
      ])

      if (pIdx < prods.length - 1) {
        rows.push([])
      }
    })

    const grandSurplus = grandReceived > grandOrdered ? grandReceived - grandOrdered : 0
    const grandRecStr = grandSurplus > 0 ? `${grandReceived} pcs (+${grandSurplus} Extra)` : `${grandReceived} pcs`

    rows.push([])
    rows.push([
      'TOTAL PO SUMMARY', '', '',
      `${grandOrdered} pcs`,
      grandRecStr,
      `${grandPending > 0 ? grandPending + ' pcs' : 'Done'}`,
      grandCost > 0 ? `Total PO Value: Rs. ${grandCost}` : '-'
    ])

    if (order.notes) {
      rows.push([])
      rows.push(['PO Special Instructions / Notes'])
      rows.push([order.notes])
    }

    if (order.installments && order.installments.length > 0) {
      rows.push([])
      rows.push(['Received Stock Installment History (Batches)'])
      rows.push(['Batch #', 'Received Date', 'Received Qty', 'Product', 'Size', 'Qty', 'Notes'])
      order.installments.forEach((inst, idx) => {
        const bTotal = (inst.items || []).reduce((s, i) => s + (i.qty || 0), 0)
        const items = inst.items || []
        if (items.length === 0) {
          rows.push([
            `Batch #${idx + 1}`,
            new Date(inst.receivedAt).toLocaleDateString(),
            `${bTotal} pcs`,
            '-', '-', '-',
            inst.notes || '-'
          ])
        } else {
          items.forEach((item, iIdx) => {
            rows.push([
              iIdx === 0 ? `Batch #${idx + 1}` : '',
              iIdx === 0 ? new Date(inst.receivedAt).toLocaleDateString() : '',
              iIdx === 0 ? `${bTotal} pcs` : '',
              item.productName || '-',
              `Size ${item.size}`,
              `${item.qty} pcs`,
              iIdx === 0 ? (inst.notes || '-') : ''
            ])
          })
        }

        if (idx < order.installments.length - 1) {
          rows.push([])
        }
      })
    }

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportBulkOrderCSV = (order) => {
    if (!order) return
    const prods = getNormalizedProducts(order)
    const clientClean = (order.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_')
    const coNum = getDisplayCoNumber(order)
    const fileName = `Client_Order_${coNum || 'CO'}_${clientClean}.csv`

    const rows = []
    rows.push([`CLIENT SALES ORDER (CO) — ${coNum}`])
    rows.push([`Client Name:`, order.clientName, `Target Delivery:`, order.targetDate || '-'])
    rows.push([])

    rows.push(['Product Breakdown'])
    rows.push(['Product Name', 'Front Logo Cost (₹)', 'Back Logo Cost (₹)', 'Size', 'Cost / Unit (₹)', 'Ordered Qty', 'Dispatched Qty', 'Pending Balance', 'Row Cost (₹)'])

    let grandOrdered = 0
    let grandDelivered = 0
    let grandPending = 0
    let grandCost = 0

    prods.forEach((p, pIdx) => {
      const frontLogo = Number(p?.frontLogoCost || 0)
      const backLogo = Number(p?.backLogoCost || 0)
      const logoPerPc = (isNaN(frontLogo) ? 0 : Math.max(0, frontLogo)) + (isNaN(backLogo) ? 0 : Math.max(0, backLogo))
      const sorted = sortSizesAscending(p?.sizeBreakdown || [])
      const legacyPrice = Number(p?.unitPrice || 0)
      let pOrdered = 0
      let pDelivered = 0
      let pPending = 0
      let pTotalCost = 0

      sorted.forEach((sb, idx) => {
        const ordered = Number(sb?.orderedQty || 0) || 0
        const delivered = Number(sb?.deliveredQty || 0) || 0
        const pending = Math.max(0, ordered - delivered)
        const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
        const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
        const rowCost = effectiveUnitPrice > 0 ? delivered * effectiveUnitPrice : 0

        pOrdered += ordered
        pDelivered += delivered
        pPending += pending
        pTotalCost += rowCost
        grandOrdered += ordered
        grandDelivered += delivered
        grandPending += pending
        grandCost += rowCost

        const surplus = delivered > ordered ? delivered - ordered : 0
        const delStr = surplus > 0 ? `${delivered} pcs (+${surplus} Extra)` : `${delivered} pcs`

        const unitPriceDisplay = logoPerPc > 0
          ? `Rs. ${effectiveUnitPrice} (Base Rs. ${basePrice} + Logo Rs. ${logoPerPc})`
          : (basePrice > 0 ? `Rs. ${basePrice}` : '-')

        rows.push([
          idx === 0 ? p.productName : '',
          idx === 0 ? (frontLogo > 0 ? `Rs. ${frontLogo}` : '-') : '',
          idx === 0 ? (backLogo > 0 ? `Rs. ${backLogo}` : '-') : '',
          sb.size,
          unitPriceDisplay,
          `${ordered} pcs`,
          delStr,
          pending > 0 ? `${pending} pcs` : 'Done',
          rowCost > 0 ? `Rs. ${rowCost}` : '-'
        ])

        // Add specifications after the first size row
        if (idx === 0) {
          const specs = getNormalizedSpecifications(p).filter(s => s.value && String(s.value).trim())
          specs.forEach(spec => {
            rows.push(['', `  ${spec.label}${spec.value ? ': ' + spec.value : ''}`, '', '', '', '', '', '', ''])
          })
        }
      })

      const pSurplus = pDelivered > pOrdered ? pDelivered - pOrdered : 0
      const pDelStr = pSurplus > 0 ? `${pDelivered} pcs (+${pSurplus} Extra)` : `${pDelivered} pcs`

      rows.push([
        `Total (${p.productName})`,
        '',
        '',
        '',
        '',
        `${pOrdered} pcs`,
        pDelStr,
        pPending > 0 ? `${pPending} pcs` : 'Done',
        pTotalCost > 0 ? `Total Product Cost: Rs. ${pTotalCost}` : '-'
      ])

      if (pIdx < prods.length - 1) {
        rows.push([])
      }
    })

    const grandSurplus = grandDelivered > grandOrdered ? grandDelivered - grandOrdered : 0
    const grandDelStr = grandSurplus > 0 ? `${grandDelivered} pcs (+${grandSurplus} Extra)` : `${grandDelivered} pcs`

    rows.push([])
    rows.push([
      'TOTAL CO SUMMARY', '', '', '',
      `${grandOrdered} pcs`,
      grandDelStr,
      `${grandPending > 0 ? grandPending + ' pcs' : 'Done'}`,
      grandCost > 0 ? `Total Order Value: Rs. ${grandCost}` : '-'
    ])

    if (order.dispatches && order.dispatches.length > 0) {
      rows.push([])
      rows.push([])
      rows.push(['STOCK DISPATCH HISTORY LOG'])
      rows.push(['Batch #', 'Dispatch Date', 'Batch Total Pcs', 'Product Name', 'Size', 'Dispatched Qty', 'Remarks / Notes'])

      order.dispatches.forEach((inst, idx) => {
        const items = inst.items || []
        const bTotal = items.reduce((sum, item) => sum + (item.qty || 0), 0)

        if (items.length === 0) {
          rows.push([
            `Batch #${idx + 1}`,
            new Date(inst.dispatchedAt).toLocaleDateString(),
            `${bTotal} pcs`,
            '-', '-', '-',
            inst.notes || '-'
          ])
        } else {
          items.forEach((item, iIdx) => {
            rows.push([
              iIdx === 0 ? `Batch #${idx + 1}` : '',
              iIdx === 0 ? new Date(inst.dispatchedAt).toLocaleDateString() : '',
              iIdx === 0 ? `${bTotal} pcs` : '',
              item.productName || '-',
              `Size ${item.size}`,
              `${item.qty} pcs`,
              iIdx === 0 ? (inst.notes || '-') : ''
            ])
          })
        }

        if (idx < order.dispatches.length - 1) {
          rows.push([])
        }
      })
    }

    if (order.notes) {
      rows.push([])
      rows.push(['BO Special Instructions / Notes'])
      rows.push([order.notes])
    }

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleOpenBOPDFModal = (order) => {
    if (!order) return
    setSelectedBOForPDF(order)
    const clientClean = (order.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_')
    const coNum = getDisplayCoNumber(order)
    setBoPdfFileName(`Client_Order_${coNum || 'CO-0001'}_${clientClean}`)
    setShowBOPDFModal(true)
  }

  const handleOpenPOPDFModal = (order) => {
    if (!order) return
    setSelectedPOForPDF(order)
    const partyClean = (order.partyName || 'Supplier').replace(/[^a-zA-Z0-9_-]/g, '_')
    setPoPdfFileName(`Purchase_Order_${order.poNumber || 'PO-0001'}_${partyClean}`)
    setShowPOPDFModal(true)
  }

  const executeBOPDFDownload = async () => {
    if (!selectedBOForPDF) return
    try {
      setExportingBOPDF(true)
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
      }
      if (!window.jspdfAutoTable) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
        window.jspdfAutoTable = true
      }

      const { jsPDF } = window.jspdf
      const doc = new jsPDF({
        orientation: boPdfOrientation,
        unit: 'mm',
        format: boPdfFormat
      })

      const order = selectedBOForPDF
      const prods = getNormalizedProducts(order)
      const coNum = getDisplayCoNumber(order)

      doc.setFontSize(16)
      doc.setTextColor(37, 99, 235)
      doc.setFont('helvetica', 'bold')
      doc.text(`LIBERTY UNIFORM — CLIENT SALES ORDER (CO)`, 14, 16)

      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.text(`CO Number: ${coNum}  |  Client: ${order.clientName}`, 14, 23)
      if (order.targetDate) {
        doc.text(`Target Delivery Date: ${order.targetDate}`, 14, 28)
      }

      let startY = order.targetDate ? 34 : 29

      let grandBOCost = 0
      let grandBOHasCost = false
      prods.forEach(p => {
        const frontLogo = Number(p?.frontLogoCost || 0)
        const backLogo = Number(p?.backLogoCost || 0)
        const logoPerPc = (isNaN(frontLogo) ? 0 : Math.max(0, frontLogo)) + (isNaN(backLogo) ? 0 : Math.max(0, backLogo))
        const legacyPrice = Number(p?.unitPrice || 0)
        ;(p?.sizeBreakdown || []).forEach(sb => {
          const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
          const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
          if (effectiveUnitPrice > 0) {
            grandBOCost += (sb?.deliveredQty || 0) * effectiveUnitPrice
            grandBOHasCost = true
          }
        })
      })

      prods.forEach((prod, pIdx) => {
        if (startY > 240) { doc.addPage(); startY = 16 }
        const frontLogo = Number(prod?.frontLogoCost || 0)
        const backLogo = Number(prod?.backLogoCost || 0)
        const logoPerPc = (isNaN(frontLogo) ? 0 : Math.max(0, frontLogo)) + (isNaN(backLogo) ? 0 : Math.max(0, backLogo))
        const sorted = sortSizesAscending(prod?.sizeBreakdown || [])
        const legacyPrice = Number(prod?.unitPrice || 0)

        doc.setFontSize(10.5)
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        let logoText = []
        if (frontLogo > 0) logoText.push(`Front Logo: Rs.${frontLogo}`)
        if (backLogo > 0) logoText.push(`Back Logo: Rs.${backLogo}`)
        const logoStr = logoText.length > 0 ? `  [${logoText.join(' | ')}]` : ''
        doc.text(`Product ${pIdx + 1}: ${prod.productName}${logoStr}`, 14, startY)
        startY += 5

        // Specifications
        const coSpecs = getNormalizedSpecifications(prod).filter(s => s.value && String(s.value).trim())
        if (coSpecs.length > 0) {
          doc.setFontSize(8.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(71, 85, 105)
          const specText = coSpecs.map(s => `${s.label}: ${s.value}`).join('  |  ')
          const pageWidth = doc.internal.pageSize.getWidth()
          const maxWidth = pageWidth - 28
          const splitSpec = doc.splitTextToSize(`Specifications: ${specText}`, maxWidth)
          doc.text(splitSpec, 14, startY)
          startY += splitSpec.length * 4.5 + 1
        }

        let pTotalCost = 0
        let pDelivered = 0
        let pOrdered = 0
        const tableData = sorted.map(sb => {
          const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
          const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
          const pending = Math.max(0, (sb?.orderedQty || 0) - (sb?.deliveredQty || 0))
          const rowCost = effectiveUnitPrice > 0 ? (sb?.deliveredQty || 0) * effectiveUnitPrice : 0
          pTotalCost += rowCost
          pDelivered += (sb?.deliveredQty || 0)
          pOrdered += (sb?.orderedQty || 0)
          const delQty = sb?.deliveredQty || 0
          const ordQty = sb?.orderedQty || 0
          const surplus = delQty > ordQty ? delQty - ordQty : 0
          const delStr = surplus > 0 ? `${delQty} pcs (+${surplus} Extra)` : `${delQty} pcs`

          const unitPriceDisplay = logoPerPc > 0
            ? `Rs.${effectiveUnitPrice} (Base Rs.${basePrice} + Logo Rs.${logoPerPc})`
            : (basePrice > 0 ? `Rs.${basePrice}` : '-')

          return [
            `${sb.size}`,
            unitPriceDisplay,
            `${ordQty} pcs`,
            delStr,
            pending > 0 ? `${pending} pcs` : 'Done',
            rowCost > 0 ? `Rs.${rowCost.toLocaleString('en-IN')}` : '-'
          ]
        })

        const pPending = Math.max(0, pOrdered - pDelivered)
        const pSurplus = pDelivered > pOrdered ? pDelivered - pOrdered : 0
        const pDelStr = pSurplus > 0 ? `${pDelivered} pcs (+${pSurplus} Extra)` : `${pDelivered} pcs`

        tableData.push([
          'Total',
          '',
          `${pOrdered} pcs`,
          pDelStr,
          pPending > 0 ? `${pPending} pcs` : 'Done',
          pTotalCost > 0 ? `Rs.${pTotalCost.toLocaleString('en-IN')}` : '-'
        ])

        doc.autoTable({
          startY,
          head: [['Size', 'Cost / Unit', 'Ordered', 'Dispatched', 'Pending', 'Row Cost']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
          styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak' },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 34 },
            5: { fontStyle: 'bold', textColor: [5, 150, 105] }
          },
          rowPageBreak: 'avoid',
          pageBreak: 'avoid'
        })

        startY = doc.lastAutoTable.finalY + 3

        if (pTotalCost > 0) {
          doc.setFontSize(9.5)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(5, 150, 105)
          doc.text(
            `Total Product Cost (${prod.productName}): Rs.${pTotalCost.toLocaleString('en-IN')}  (${pDelivered} pcs dispatched)`,
            14, startY
          )
          startY += 7
        } else {
          startY += 4
        }
      })

      if (grandBOHasCost) {
        if (startY > 255) { doc.addPage(); startY = 16 }
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(37, 99, 235)
        doc.text(`Total Order Value: Rs.${grandBOCost.toLocaleString('en-IN')}`, 14, startY)
        startY += 10
      }

      if (order.dispatches && order.dispatches.length > 0) {
        const pageHeight = doc.internal.pageSize.getHeight()
        const marginBottom = 15
        if (startY + 21 > pageHeight - marginBottom) {
          doc.addPage()
          startY = 16
        }

        const batchRows = []
        order.dispatches.forEach((inst, idx) => {
          const bTotal = (inst.items || []).reduce((s, i) => s + (i.qty || 0), 0)
          const items = inst.items || []
          if (items.length === 0) {
            batchRows.push([`Batch #${idx + 1}`, new Date(inst.dispatchedAt).toLocaleDateString(), `${bTotal} pcs`, '-', '-', inst.notes || '-'])
          } else {
            items.forEach((item, iIdx) => {
              batchRows.push([
                iIdx === 0 ? `Batch #${idx + 1}` : '',
                iIdx === 0 ? new Date(inst.dispatchedAt).toLocaleDateString() : '',
                iIdx === 0 ? `${bTotal} pcs` : '',
                item.productName || '-',
                `Size ${item.size}: ${item.qty} pcs`,
                iIdx === 0 ? (inst.notes || '-') : ''
              ])
            })
          }
        })

        const batchHeadingY = startY
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text(`Dispatched Stock History (Batches):`, 14, batchHeadingY)

        doc.autoTable({
          startY: batchHeadingY + 5,
          head: [['Batch #', 'Dispatch Date', 'Total Qty', 'Product', 'Size & Qty', 'Notes']],
          body: batchRows,
          theme: 'striped',
          headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
          rowPageBreak: 'avoid',
          didDrawPage: (data) => {
            if (data.pageNumber > 1) {
              doc.setFontSize(10)
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(15, 23, 42)
              doc.text(`Dispatched Stock History (Batches) — continued:`, 14, 12)
            }
          }
        })

        startY = doc.lastAutoTable.finalY + 8
      }

      if (order.notes) {
        if (startY > 250) { doc.addPage(); startY = 16 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(180, 83, 9)
        doc.text(`Special Instructions / Notes:`, 14, startY)
        startY += 5
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 65, 85)
        const splitNotes = doc.splitTextToSize(order.notes, 180)
        doc.text(splitNotes, 14, startY)
        startY += (splitNotes.length * 4) + 6
      }

      const cleanFileName = boPdfFileName ? boPdfFileName.replace(/[^a-zA-Z0-9_-]/g, '_') : `${order.boNumber}_BulkOrder`
      doc.save(`${cleanFileName}.pdf`)
      setShowBOPDFModal(false)
    } catch (err) {
      console.error('Error generating BO PDF:', err)
      alert('Failed to generate BO PDF. Please try again.')
    } finally {
      setExportingBOPDF(false)
    }
  }

  const executePOPDFDownload = async () => {
    if (!selectedPOForPDF) return
    try {
      setExportingPOPDF(true)
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
      }
      if (!window.jspdfAutoTable) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
        window.jspdfAutoTable = true
      }

      const { jsPDF } = window.jspdf
      const doc = new jsPDF({
        orientation: poPdfOrientation,
        unit: 'mm',
        format: poPdfFormat
      })

      const order = selectedPOForPDF
      const prods = getNormalizedProducts(order)

      doc.setFontSize(16)
      doc.setTextColor(37, 99, 235)
      doc.setFont('helvetica', 'bold')
      doc.text(`LIBERTY UNIFORM — RESTOCK PURCHASE ORDER`, 14, 16)

      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.text(`PO Number: ${order.poNumber}  |  Supplier: ${order.partyName}`, 14, 23)
      if (order.targetDate) {
        doc.text(`Target Delivery Date: ${order.targetDate}`, 14, 28)
      }

      let startY = order.targetDate ? 34 : 29

      // Calculate grand PO total cost upfront (per-size pricing, legacy fallback)
      let grandPOCost = 0
      let grandPOHasCost = false
      prods.forEach(p => {
        const legacyPrice = Number(p.unitPrice || 0)
          ; (p.sizeBreakdown || []).forEach(sb => {
            const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
            if (sbPrice > 0) {
              grandPOCost += (sb.receivedQty || 0) * sbPrice
              grandPOHasCost = true
            }
          })
      })

      prods.forEach((prod, pIdx) => {
        if (startY > 240) { doc.addPage(); startY = 16 }
        const prodUnitPrice = Number(prod.unitPrice || 0)
        const sorted = sortSizesAscending(prod.sizeBreakdown || [])
        const legacyPrice = Number(prod.unitPrice || 0)

        // Product heading
        doc.setFontSize(10.5)
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.text(`Product ${pIdx + 1}: ${prod.productName} (${prod.school || 'N/A'})`, 14, startY)
        startY += 5

        // Specifications
        const poSpecs = getNormalizedSpecifications(prod).filter(s => s.value && String(s.value).trim())
        if (poSpecs.length > 0) {
          doc.setFontSize(8.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(71, 85, 105)
          const specText = poSpecs.map(s => `${s.label}: ${s.value}`).join('  |  ')
          const pageWidth = doc.internal.pageSize.getWidth()
          const maxWidth = pageWidth - 28
          const splitSpec = doc.splitTextToSize(`Specifications: ${specText}`, maxWidth)
          doc.text(splitSpec, 14, startY)
          startY += splitSpec.length * 4.5 + 1
        }

        // Size rows — Price/Unit per row, no Fulfillment%
        let pTotalCost = 0
        let pReceived = 0
        let pOrdered = 0
        const tableData = sorted.map(sb => {
          const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
          const pending = Math.max(0, (sb.orderedQty || 0) - (sb.receivedQty || 0))
          const rowCost = sbPrice > 0 ? (sb.receivedQty || 0) * sbPrice : 0
          pTotalCost += rowCost
          pReceived += (sb.receivedQty || 0)
          pOrdered += (sb.orderedQty || 0)
          const recQty = sb.receivedQty || 0
          const ordQty = sb.orderedQty || 0
          const surplus = recQty > ordQty ? recQty - ordQty : 0
          const recStr = surplus > 0 ? `${recQty} pcs (+${surplus} Extra)` : `${recQty} pcs`

          return [
            `${sb.size}`,
            sbPrice > 0 ? `Rs.${sbPrice}` : '-',
            `${ordQty} pcs`,
            recStr,
            pending > 0 ? `${pending} pcs` : 'Done',
            rowCost > 0 ? `Rs.${rowCost.toLocaleString('en-IN')}` : '-'
          ]
        })

        const pPending = Math.max(0, pOrdered - pReceived)
        const pSurplus = pReceived > pOrdered ? pReceived - pOrdered : 0
        const pRecStr = pSurplus > 0 ? `${pReceived} pcs (+${pSurplus} Extra)` : `${pReceived} pcs`

        tableData.push([
          'Total',
          '',
          `${pOrdered} pcs`,
          pRecStr,
          pPending > 0 ? `${pPending} pcs` : 'Done',
          pTotalCost > 0 ? `Rs.${pTotalCost.toLocaleString('en-IN')}` : '-'
        ])

        doc.autoTable({
          startY,
          head: [['Size', 'Cost / Unit', 'Ordered', 'Received', 'Pending', 'Row Cost']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
          styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak' },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 34 },
            5: { fontStyle: 'bold', textColor: [5, 150, 105] }
          },
          rowPageBreak: 'avoid',
          pageBreak: 'avoid'
        })

        startY = doc.lastAutoTable.finalY + 3

        // Total Product Cost summary line
        if (pTotalCost > 0) {
          doc.setFontSize(9.5)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(5, 150, 105)
          doc.text(
            `Total Product Cost (${prod.productName}): Rs.${pTotalCost.toLocaleString('en-IN')}  (${pReceived} pcs received)`,
            14, startY
          )
          startY += 7
        } else {
          startY += 4
        }
      })

      // Total PO Value summary
      if (grandPOHasCost) {
        if (startY > 255) { doc.addPage(); startY = 16 }
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(37, 99, 235)
        doc.text(`Total PO Value: Rs.${grandPOCost.toLocaleString('en-IN')}`, 14, startY)
        startY += 10
      }

      if (order.installments && order.installments.length > 0) {
        // Use a minimum space check: heading text (6mm) + table header (8mm) + first row (7mm) = ~21mm needed
        const pageHeight = doc.internal.pageSize.getHeight()
        const marginBottom = 15
        if (startY + 21 > pageHeight - marginBottom) {
          doc.addPage()
          startY = 16
        }

        const batchRows = []
        order.installments.forEach((inst, idx) => {
          const bTotal = (inst.items || []).reduce((s, i) => s + (i.qty || 0), 0)
          const items = inst.items || []
          if (items.length === 0) {
            batchRows.push([`Batch #${idx + 1}`, new Date(inst.receivedAt).toLocaleDateString(), `${bTotal} pcs`, '-', '-', inst.notes || '-'])
          } else {
            items.forEach((item, iIdx) => {
              batchRows.push([
                iIdx === 0 ? `Batch #${idx + 1}` : '',
                iIdx === 0 ? new Date(inst.receivedAt).toLocaleDateString() : '',
                iIdx === 0 ? `${bTotal} pcs` : '',
                item.productName || '-',
                `Size ${item.size}: ${item.qty} pcs`,
                iIdx === 0 ? (inst.notes || '-') : ''
              ])
            })
          }
        })

        // Draw heading on EVERY page the table spans via didDrawPage
        const batchHeadingY = startY
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text(`Received Stock Installment History (Batches):`, 14, batchHeadingY)

        doc.autoTable({
          startY: batchHeadingY + 5,
          head: [['Batch #', 'Received Date', 'Total Qty', 'Product', 'Size & Qty', 'Notes']],
          body: batchRows,
          theme: 'striped',
          headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
          rowPageBreak: 'avoid',
          didDrawPage: (data) => {
            // Repeat heading on subsequent pages
            if (data.pageNumber > 1) {
              doc.setFontSize(10)
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(15, 23, 42)
              doc.text(`Received Stock Installment History (Batches) — continued:`, 14, 12)
            }
          }
        })

        startY = doc.lastAutoTable.finalY + 8
      }

      if (order.notes) {
        if (startY > 250) { doc.addPage(); startY = 16 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(180, 83, 9)
        doc.text(`Special Instructions / Notes:`, 14, startY)
        startY += 5
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 65, 85)
        const splitNotes = doc.splitTextToSize(order.notes, 180)
        doc.text(splitNotes, 14, startY)
        startY += (splitNotes.length * 4) + 6
      }

      let cleanName = poPdfFileName.trim() ? poPdfFileName.trim() : `PO_${order.poNumber}`
      if (!cleanName.toLowerCase().endsWith('.pdf')) cleanName += '.pdf'
      doc.save(cleanName)
      setShowPOPDFModal(false)
    } catch (err) {
      console.error('PO PDF export failed:', err)
      alert('Failed to generate PO PDF: ' + err.message)
    } finally {
      setExportingPOPDF(false)
    }
  }

  useEffect(() => {
    if ((activePage === 'Restock & Bulk Orders' || activePage === 'Supplier Restock') && token) {
      fetchVendorOrders(vendorOrderSearch, vendorOrderPartyFilter, vendorOrderStatusFilter, vendorOrders.length > 0)
      fetchParties()
    }
  }, [vendorOrderPartyFilter, vendorOrderStatusFilter, activePage, token])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if ((activePage === 'Restock & Bulk Orders' || activePage === 'Supplier Restock') && poSearchInputRef.current) {
          e.preventDefault()
          poSearchInputRef.current.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePage])

  useEffect(() => {
    if (activePage === 'Stock Waitlist' && token) {
      fetchWaitlist(waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, waitlist.length > 0)
    }
  }, [waitlistSearch, waitlistStatusFilter, waitlistSchoolFilter, activePage, token])

  useEffect(() => {
    if (activePage === 'Stock Waitlist' && token) {
      fetchWaitlistSchools()
    }
  }, [activePage, token])

  useEffect(() => {
    if (token) {
      fetchWhatsAppTemplates()
    }
  }, [token])

  useEffect(() => {
    if (activePage === 'Settings' && token) {
      fetchBackups()
      fetchPricingRates()
      fetchWhatsAppTemplates()
    }
  }, [activePage, token])

  useEffect(() => {
    if (activePage === 'Settings' && token) {
      fetchAuditLogs('', logTypeFilter, logDateFilter)
    }
  }, [logTypeFilter, logDateFilter, activePage, token])

  const handleCreateBackup = async () => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE}/api/backups/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        alert('Backup created successfully!')
        fetchBackups()
        fetchAuditLogs()
      } else {
        alert(data.message || 'Failed to create backup')
      }
    } catch (error) {
      console.error('Failed to create backup', error)
      alert('Network error while creating backup.')
    }
  }

  const handleDownloadBackup = async (filename) => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE}/api/backups/download/${encodeURIComponent(filename)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
      } else {
        alert('Failed to download backup file.')
      }
    } catch (error) {
      console.error('Download error', error)
    }
  }

  const handleRestoreBackup = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const confirmRestore = window.confirm(
      "WARNING: Restoring a backup will overwrite and replace ALL existing database records (orders, users, logs) with the data inside this backup file. This cannot be undone.\n\nAre you sure you want to proceed?"
    )
    if (!confirmRestore) {
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(',')[1]
        const response = await fetch(`${API_BASE}/api/backups/restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ fileData: base64 })
        })
        const data = await response.json()
        if (response.ok) {
          alert('Database restored successfully!')
          fetchBackups()
          fetchAuditLogs()
          fetchOrders(searchTerm)
        } else {
          alert('Restore failed: ' + (data.message || 'Unknown error'))
        }
      } catch (err) {
        console.error('Error restoring database', err)
        alert('Failed to parse backup file.')
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }



  const fetchWhatsAppTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/settings/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        if (data && data.value) {
          setWhatsappTemplates(data.value)
          setWaitlistTemplateInput(data.value.waitlistTemplate || DEFAULT_WHATSAPP_TEMPLATES.waitlistTemplate)
          setOrderReadyTemplateInput(data.value.orderReadyTemplate || DEFAULT_WHATSAPP_TEMPLATES.orderReadyTemplate)
        }
      }
    } catch (error) {
      console.error('Failed to fetch WhatsApp templates', error)
    }
  }

  const handleUpdateWhatsAppTemplates = async (e) => {
    e.preventDefault()
    setLoadingTemplates(true)
    try {
      const response = await fetch(`${API_BASE}/api/settings/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          value: {
            waitlistTemplate: waitlistTemplateInput,
            orderReadyTemplate: orderReadyTemplateInput
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMessage(data.message || 'WhatsApp notification templates updated successfully!')
        if (data.settings && data.settings.value) {
          setWhatsappTemplates(data.settings.value)
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update WhatsApp templates')
      }
    } catch (error) {
      console.error('Failed to update WhatsApp templates:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const resetForm = () => {
    setEditingOrderId(null)
    setFormData(createEmptyForm(getNextOrderNumber(orders)))
    setOriginalFormData(null)
    setSelectedIds([])
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    if (!window.confirm(`Delete ${selectedIds.length} selected orders? This cannot be undone.`)) return

    try {
      const response = await fetch(`${API_BASE}/api/orders/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds }),
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      const data = await response.json()
      if (response.ok) {
        setOrders((prev) => prev.filter((o) => !selectedIds.includes(o._id)))
        setSelectedIds([])
        setMessage(data.message || `Deleted ${data.deletedCount || selectedIds.length} orders.`)
      } else {
        setMessage(data.message || 'Bulk delete failed')
      }
    } catch (error) {
      console.error('Bulk delete error', error)
      setMessage('Could not reach server for bulk delete')
    }
  }

  const unselectAll = () => setSelectedIds([])

  const handleStatusTap = async (order) => {
    // 75-day auto delete timer popup removed in favor of 100-block rolling cycle cleanup
    return
  }

  const startEditingOrder = (order) => {
    setSelectedOrder(order)
    setEditingOrderId(order._id)
    const initialForm = {
      orderNumber: order.orderNumber || '',
      customerName: order.customerName || '',
      contactNumber: order.contactNumber || '',
      gender: order.gender || 'Male',
      school: order.school || '',
      grade: order.grade || '',
      deliveryDate: order.deliveryDate || '',
      amount: order.amount?.toString() || '',
      paymentStatus: order.paymentStatus || 'Unpaid',
      status: order.status || 'Pending',
      contactStatus: order.contactStatus || 'Not contacted',
      items:
        order.items?.map((item) => {
          const itemType = item.itemType || 'shirt'
          const defaultMeasurements = getDefaultMeasurementsForType(itemType)
          const mergedMeasurements = {
            ...defaultMeasurements,
            ...(item.measurements || {}),
          }
          if (item.sizeFarma || item.measurements?.sizeFarma) {
            mergedMeasurements.sizeFarma = item.measurements?.sizeFarma || item.sizeFarma || ''
          }
          return {
            itemType,
            sizeFarma: item.sizeFarma || item.measurements?.sizeFarma || '',
            quantity: item.quantity || 1,
            productionCategory: item.productionCategory || '',
            measurements: mergedMeasurements,
          }
        }) || [createItem()],
      notes: order.notes || '',
    }
    setFormData(initialForm)
    setOriginalFormData(initialForm)

    // Calculate index of this order in sortedOrders to preserve visibility
    const orderIdx = sortedOrders.findIndex((o) => o._id === order._id)
    const neededVisible = orderIdx >= 0 ? Math.max(visibleCount, orderIdx + 1) : visibleCount

    // Save scroll position and target orderId for post-save scroll restoration
    editScrollSaved.current = {
      scrollY: window.scrollY,
      visibleCount: neededVisible,
      orderId: order._id,
      pendingRestore: true,
    }
    setActivePage('New Order')
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'orderNumber' || name === 'customerName' || name === 'contactNumber') {
      setFormError('')
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (selectedOrder && selectedOrder._id === editingOrderId) {
      setSelectedOrder((prev) => ({ ...prev, [name]: value }))
    }
  }

  const goToPage = (page) => {
    setMessage('')
    setTimerAlertOrder(null)
    setFormError('')

    if (page === 'Restock & Bulk Orders' || page === 'Supplier Restock') {
      setRestockSubSection(null)
    }

    // Automatically reset Production Queue and Orders Desk filters to default when navigating
    setTailorStatusFilter('Pending')
    setTailorProductFilter('All')
    setTailorCategoryFilter('All')
    setTailorSchoolFilter('All')
    setTailorDeliveryFilter('All')
    setTailorCustomStartDate('')
    setTailorCustomEndDate('')
    setTailorSearchTerm('')

    setOrderDeliveryFilter('All')
    setOrderCustomStartDate('')
    setOrderCustomEndDate('')

    // When navigating TO New Order for the first time (no ongoing draft), initialize a fresh form
    // Do NOT reset if we already have a draft in progress (user navigated away and came back)
    if (page === 'New Order' && !editingOrderId) {
      // Only init if the form is completely empty (no customer name typed yet)
      if (!formData.customerName && !formData.orderNumber && !formData.contactNumber) {
        setFormData(createEmptyForm(getNextOrderNumber(orders)))
      }
      setSelectedOrder(null)
    }
    if (page === 'Orders') {
      setEditingOrderId(null)
    }
    setActivePage(page)
  }

  const cancelNewOrder = () => {
    resetForm()
    setSelectedOrder(null)
    setActivePage('Orders')
  }

  const handleItemChange = (index, event) => {
    const { name, value } = event.target

    setFormData((prev) => {
      const updatedItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        if (name === 'itemType') {
          const defaultFields = measurementFields[value] || measurementFields.shirt || []
          const updatedMeasurements = { ...item.measurements }
          defaultFields.forEach((field) => {
            if (updatedMeasurements[field] === undefined) {
              updatedMeasurements[field] = ''
            }
          })
          return { ...item, itemType: value, measurements: updatedMeasurements }
        }
        return { ...item, [name]: value }
      })

      if (selectedOrder && selectedOrder._id === editingOrderId) {
        setSelectedOrder((prevSelected) => ({
          ...prevSelected,
          items: updatedItems,
        }))
      }

      return { ...prev, items: updatedItems }
    })
  }

  const handleMeasurementChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const updatedItem = {
          ...item,
          measurements: {
            ...item.measurements,
            [field]: value,
          },
        }
        if (field === 'sizeFarma') {
          updatedItem.sizeFarma = value
        }
        return updatedItem
      })

      if (selectedOrder && selectedOrder._id === editingOrderId) {
        setSelectedOrder((prevSelected) => ({
          ...prevSelected,
          items: updatedItems,
        }))
      }

      return { ...prev, items: updatedItems }
    })
  }

  const handleAddMeasurementField = (itemIndex) => {
    setPendingCustomField({ itemIndex, name: '' })
  }

  const commitPendingCustomField = () => {
    if (!pendingCustomField) return
    const { itemIndex, name } = pendingCustomField
    const trimmedName = name.trim()
    if (!trimmedName) {
      setPendingCustomField(null)
      return
    }
    setFormData((prev) => {
      const updatedItems = prev.items.map((item, idx) => {
        if (idx !== itemIndex) return item
        let finalName = trimmedName
        let counter = 2
        while (Object.prototype.hasOwnProperty.call(item.measurements || {}, finalName)) {
          finalName = `${trimmedName} (${counter})`
          counter++
        }
        return { ...item, measurements: { ...item.measurements, [finalName]: '' } }
      })
      if (selectedOrder && selectedOrder._id === editingOrderId) {
        setSelectedOrder((prevSelected) => ({ ...prevSelected, items: updatedItems }))
      }
      return { ...prev, items: updatedItems }
    })
    setPendingCustomField(null)
  }

  const handleRemoveMeasurement = (itemIndex, fieldKey) => {
    setFormData((prev) => {
      const updatedItems = prev.items.map((item, idx) => {
        if (idx !== itemIndex) return item
        const updatedMeasurements = { ...item.measurements }
        delete updatedMeasurements[fieldKey]
        const updatedItem = {
          ...item,
          measurements: updatedMeasurements,
        }
        if (fieldKey === 'sizeFarma') {
          updatedItem.sizeFarma = ''
        }
        return updatedItem
      })

      if (selectedOrder && selectedOrder._id === editingOrderId) {
        setSelectedOrder((prevSelected) => ({
          ...prevSelected,
          items: updatedItems,
        }))
      }

      return { ...prev, items: updatedItems }
    })
  }

  const handleRenameMeasurementKey = (itemIndex, oldKey, newKey) => {
    setFormData((prev) => {
      const updatedItems = prev.items.map((item, idx) => {
        if (idx !== itemIndex) return item
        const updatedMeasurements = {}
        Object.keys(item.measurements || {}).forEach((k) => {
          if (k === oldKey) {
            updatedMeasurements[newKey] = item.measurements[oldKey]
          } else {
            updatedMeasurements[k] = item.measurements[k]
          }
        })
        const updatedItem = {
          ...item,
          measurements: updatedMeasurements,
        }
        if (oldKey === 'sizeFarma') {
          updatedItem.sizeFarma = ''
        }
        if (newKey === 'sizeFarma') {
          updatedItem.sizeFarma = item.measurements[oldKey] || ''
        }
        return updatedItem
      })

      if (selectedOrder && selectedOrder._id === editingOrderId) {
        setSelectedOrder((prevSelected) => ({
          ...prevSelected,
          items: updatedItems,
        }))
      }

      return { ...prev, items: updatedItems }
    })
  }

  const addItem = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, createItem()] }))
  }

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const executeSubmitOrder = async (payloadToSubmit) => {
    try {
      const isEditing = Boolean(editingOrderId)
      const url = isEditing ? `${API_BASE}/api/orders/${editingOrderId}` : `${API_BASE}/api/orders`
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payloadToSubmit),
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      const data = await response.json()

      if (response.ok) {
        const actionText = isEditing ? 'updated' : 'saved'
        const msgText = data.purgedCount && data.purgedCount > 0
          ? `Order ${data.order.orderNumber} saved successfully. Purged ${data.purgedCount} delivered orders from earlier range.`
          : `Order ${data.order.orderNumber} ${actionText} successfully.`
        setMessage(msgText)
        setFormError('')
        setOrders((prev) => {
          if (isEditing) {
            return prev.map((order) => (order._id === data.order._id ? data.order : order))
          }
          return [data.order, ...prev.filter((o) => o._id !== data.order._id)]
        })
        if (isEditing && editScrollSaved.current.pendingRestore) {
          const savedCount = editScrollSaved.current.visibleCount
          setVisibleCount((prev) => Math.max(prev, savedCount))
        }
        if (isEditing) {
          setHighlightedOrderId(data.order._id)
        }
        resetForm()
        setSelectedOrder(data.order)
        setActivePage('Orders')
        fetchOrders(searchTerm)
      } else {
        setFormError(data.message || data.error || 'Unable to save order')
        setMessage('')
      }
    } catch (error) {
      console.error('Order submit error:', error)
      setFormError('Could not reach the server. Make sure the backend is running.')
      setMessage('')
    } finally {
      setLoading(false)
      setShowCleanupConfirmModal(false)
      setCleanupPreviewData(null)
      setPendingOrderPayload(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setFormError('')

    if (!formData.deliveryDate || !formData.deliveryDate.trim()) {
      setFormError('Delivery Date is required.')
      setLoading(false)
      return
    }

    const payload = {
      ...formData,
      amount: formData.amount === '' ? 0 : Number(formData.amount),
      paymentStatus: formData.paymentStatus || 'Unpaid',
      contactStatus: formData.contactStatus || 'Not contacted',
      items: formData.items.map((item) => ({
        ...item,
        sizeFarma: item.measurements?.sizeFarma || item.sizeFarma || '',
        quantity: Number(item.quantity || 0),
      })),
    }

    const isEditing = Boolean(editingOrderId)

    // Run cleanup-preview check in background (non-blocking) — save proceeds immediately
    // If cleanup is needed, show a modal AFTER save completes
    if (!isEditing && formData.orderNumber) {
      // Fire cleanup check async without awaiting — don't block the save
      fetch(`${API_BASE}/api/orders/cleanup-preview?orderNumber=${encodeURIComponent(formData.orderNumber.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(async (checkRes) => {
        if (checkRes.ok) {
          const previewData = await checkRes.json()
          if (previewData.shouldTrigger && previewData.deliveredCount > 0) {
            setCleanupPreviewData(previewData)
            setPendingOrderPayload(payload)
            setShowCleanupConfirmModal(true)
          }
        }
      }).catch((err) => {
        console.error('Cleanup preview check failed:', err)
      })
    }

    await executeSubmitOrder(payload)
  }

  const updateStatus = async (orderId, status) => {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }),
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      if (response.ok) {
        const updatedOrder = await response.json()
        setOrders((prev) => prev.map((order) => (order._id === orderId ? updatedOrder : order)))
        setSelectedOrder((prev) => (prev && prev._id === orderId ? updatedOrder : prev))
      }
    } catch (error) {
      console.error('Unable to update status', error)
    }
  }

  const updateContactStatus = async (orderId, contactStatus) => {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}/contact-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contactStatus }),
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      if (response.ok) {
        const updatedOrder = await response.json()
        setOrders((prev) => prev.map((order) => (order._id === orderId ? updatedOrder : order)))
        setSelectedOrder((prev) => (prev && prev._id === orderId ? updatedOrder : prev))
      }
    } catch (error) {
      console.error('Unable to update contact status', error)
    }
  }

  const deleteOrder = async (orderId) => {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      if (response.ok) {
        setOrders((prev) => prev.filter((order) => order._id !== orderId))
        if (selectedOrder?._id === orderId) {
          setSelectedOrder(null)
        }
      }
    } catch (error) {
      console.error('Unable to delete order', error)
    }
  }

  const statusLabel = useMemo(
    () => ({
      Pending: 'Pending',
      Ready: 'Ready',
      Delivered: 'Delivered',
    }),
    [],
  )

  const computeTimeLeftDescription = (deliveredAt, updatedAt, createdAt) => {
    const timestamp = deliveredAt || updatedAt || createdAt
    if (!timestamp) return 'unknown'
    const timeLeftMs = new Date(timestamp).getTime() + 75 * 24 * 60 * 60 * 1000 - now
    if (timeLeftMs <= 0) {
      return 'Due for deletion'
    }

    const oneSecond = 1000
    const oneMinute = 60 * 1000
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * 60 * 60 * 1000

    if (timeLeftMs < oneHour) {
      const minutes = Math.floor(timeLeftMs / oneMinute)
      const seconds = Math.floor((timeLeftMs % oneMinute) / oneSecond)
      return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
    }
    if (timeLeftMs < oneDay) {
      const hours = Math.floor(timeLeftMs / oneHour)
      const minutes = Math.floor((timeLeftMs % oneHour) / oneMinute)
      const seconds = Math.floor((timeLeftMs % oneMinute) / oneSecond)
      return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
    }
    const days = Math.ceil(timeLeftMs / oneDay)
    return `${days} day${days === 1 ? '' : 's'}`
  }

  const computeWaitlistTimeLeftDescription = (notifiedAt, updatedAt, createdAt) => {
    const timestamp = notifiedAt || updatedAt || createdAt
    if (!timestamp) return 'unknown'
    const timeLeftMs = new Date(timestamp).getTime() + 7 * 24 * 60 * 60 * 1000 - now
    if (timeLeftMs <= 0) {
      return 'Due for deletion'
    }

    const oneSecond = 1000
    const oneMinute = 60 * 1000
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * 60 * 60 * 1000

    if (timeLeftMs < oneHour) {
      const minutes = Math.floor(timeLeftMs / oneMinute)
      const seconds = Math.floor((timeLeftMs % oneMinute) / oneSecond)
      return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
    }
    if (timeLeftMs < oneDay) {
      const hours = Math.floor(timeLeftMs / oneHour)
      const minutes = Math.floor((timeLeftMs % oneHour) / oneMinute)
      const seconds = Math.floor((timeLeftMs % oneMinute) / oneSecond)
      return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
    }
    const days = Math.ceil(timeLeftMs / oneDay)
    return `${days} day${days === 1 ? '' : 's'}`
  }



  const nowDate = new Date().toISOString().slice(0, 10)
  const totalOrders = orders.length
  const pendingOrders = orders.filter((order) => order.status === 'Pending').length
  const readyOrders = orders.filter((order) => order.status === 'Ready').length
  const deliveredOrders = orders.filter((order) => order.status === 'Delivered').length
  const pendingPayments = orders.filter((order) => (order.paymentStatus || 'Unpaid') === 'Unpaid').length

  const stats = [
    { label: 'Total Orders', value: totalOrders, icon: getSafeEmoji('📦'), description: 'All time orders', filter: 'All' },
    { label: 'Pending Orders', value: pendingOrders, icon: getSafeEmoji('⏳'), description: 'Awaiting processing', filter: 'Pending' },
    { label: 'Ready Orders', value: readyOrders, icon: getSafeEmoji('✅'), description: 'Ready for collection', filter: 'Ready' },
    { label: 'Delivered Orders', value: deliveredOrders, icon: getSafeEmoji('🚚'), description: 'Completed orders', filter: 'Delivered' },
    { label: 'Pending Payments', value: pendingPayments, icon: getSafeEmoji('💰'), description: 'Amount unpaid', filter: 'PendingPayments' },
  ]

  const pageSubtitles = {
    Dashboard: 'Operational overview and recent activity',
    'New Order': 'Create a new uniform order with full details',
    Orders: 'Search, filter and manage existing orders',
    'Production Queue': 'Garment-level measurements, deadlines and notes for tailors',
    'Stock Waitlist': 'Manage out-of-stock items and customer notification list',
    'Restock & Bulk Orders': 'Manage supplier procurement restock orders and corporate/bulk client supply contracts',
    'Supplier Restock': 'Track bulk manufacturing orders, supplier details, and size-wise partial stock installments',
    Reports: 'Business performance and delivery trends',
    Settings: 'System preferences and administrative settings',
  }

  const applyFilters = (status, payment, contact, school) => {
    const matching = orders.filter((order) => {
      if (school !== 'All' && order.school !== school) return false
      if (status !== 'All' && order.status !== status) return false
      if (payment !== 'All' && (order.paymentStatus || 'Unpaid') !== payment) return false
      if (contact !== 'All' && order.contactStatus !== contact) return false
      return true
    })
    setSelectedOrder(matching[0] || null)
    setVisibleCount(loadStep)
  }

  const handleStatusFilterChange = (val) => {
    setOrderFilter(val)
    applyFilters(val, orderPaymentFilter, orderContactFilter, orderSchoolFilter)
  }

  const handlePaymentFilterChange = (val) => {
    setOrderPaymentFilter(val)
    applyFilters(orderFilter, val, orderContactFilter, orderSchoolFilter)
  }

  const handleContactFilterChange = (val) => {
    setOrderContactFilter(val)
    applyFilters(orderFilter, orderPaymentFilter, val, orderSchoolFilter)
  }

  const applyOrderSchoolFilter = (school) => {
    setOrderSchoolFilter(school)
    applyFilters(orderFilter, orderPaymentFilter, orderContactFilter, school)
  }

  const applyOrderFilter = (filter) => {
    setOrderSchoolFilter('All')
    setOrderContactFilter('All')

    let targetStatus = 'All'
    let targetPayment = 'All'

    if (filter === 'PendingPayments') {
      targetStatus = 'All'
      targetPayment = 'Unpaid'
      setOrderFilter('All')
      setOrderPaymentFilter('Unpaid')
    } else {
      targetStatus = filter
      targetPayment = 'All'
      setOrderFilter(filter)
      setOrderPaymentFilter('All')
    }

    applyFilters(targetStatus, targetPayment, 'All', 'All')
    setActivePage('Orders')
  }

  const filteredOrders = orders.filter((order) => {
    if (orderSchoolFilter !== 'All' && order.school !== orderSchoolFilter) {
      return false
    }
    if (orderFilter !== 'All' && order.status !== orderFilter) {
      return false
    }
    if (orderPaymentFilter !== 'All' && (order.paymentStatus || 'Unpaid') !== orderPaymentFilter) {
      return false
    }
    if (orderContactFilter !== 'All' && order.contactStatus !== orderContactFilter) {
      return false
    }
    if (!isDateInFilter(order.deliveryDate, orderDeliveryFilter, orderCustomStartDate, orderCustomEndDate)) {
      return false
    }
    return true
  })

  const sortedOrders = useMemo(() => {
    const scored = []
    const rawQuery = (deferredSearchTerm || '').trim().toLowerCase()
    const cleanQuery = rawQuery.replace(/^#/, '').trim()
    const queryTokens = cleanQuery.split(/\s+/).filter(Boolean)

    if (queryTokens.length === 0) {
      return [...filteredOrders].sort((a, b) => {
        const aNum = Number(a.orderNumber)
        const bNum = Number(b.orderNumber)
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          return aNum - bNum
        }
        return String(a.orderNumber).localeCompare(String(b.orderNumber), undefined, { numeric: true, sensitivity: 'base' })
      })
    }

    filteredOrders.forEach(order => {
      const orderNum = String(order.orderNumber || '').trim().toLowerCase()
      const custName = String(order.customerName || '').trim().toLowerCase()
      const schoolName = String(order.school || '').trim().toLowerCase()
      const phone = String(order.contactNumber || '').replace(/\D/g, '')

      let totalScore = 0
      let allMatched = true

      for (const token of queryTokens) {
        const tokenDigits = token.replace(/\D/g, '')
        let tokenMatch = false

        if (orderNum === token || orderNum === cleanQuery) {
          totalScore += 100
          tokenMatch = true
        } else if (orderNum.includes(token)) {
          totalScore += 75
          tokenMatch = true
        }

        if (custName.includes(token)) {
          totalScore += 50
          tokenMatch = true
        }

        if (schoolName.includes(token)) {
          totalScore += 40
          tokenMatch = true
        }

        if (tokenDigits.length >= 3 && phone.includes(tokenDigits)) {
          totalScore += 30
          tokenMatch = true
        }

        if (!tokenMatch) {
          allMatched = false
          break
        }
      }

      if (allMatched) {
        scored.push({ order, score: totalScore })
      }
    })

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      const aNum = Number(a.order.orderNumber)
      const bNum = Number(b.order.orderNumber)
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum
      }
      return String(a.order.orderNumber).localeCompare(String(b.order.orderNumber), undefined, { numeric: true, sensitivity: 'base' })
    })

    return scored.map(s => s.order)
  }, [filteredOrders, deferredSearchTerm])

  const visibleOrders = useMemo(() => {
return sortedOrders.slice(0, visibleCount)
  }, [sortedOrders, visibleCount])

  const hasMoreOrders = visibleCount < sortedOrders.length

  // Tailor Work - Derived Selectors and Helpers
  const tailorAvailableSchools = useMemo(() => {
    const map = new Map()
    // 1. Official Directory Schools (takes precedence with exact casing, e.g. "Custom")
    waitlistSchools.forEach((s) => {
      if (s.name && s.name.trim() !== '') {
        const trimmed = s.name.trim()
        const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
        map.set(trimmed.toLowerCase(), formatted)
      }
    })
    // 2. Schools from existing orders (auto-capitalizes first letter if stored in lowercase)
    orders.forEach((o) => {
      if (o.school && o.school.trim() !== '') {
        const trimmed = o.school.trim()
        const lower = trimmed.toLowerCase()
        if (!map.has(lower)) {
          const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
          map.set(lower, formatted)
        }
      }
    })
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b))
  }, [orders, waitlistSchools])

  const tailorAvailableCategories = useMemo(() => {
    const catsMap = new Map()
    let hasUncategorized = false

    orders.forEach((o) => {
      if (o.items && o.items.length > 0) {
        o.items.forEach((item) => {
          let catId = item.productionCategory || ''
          if (catId === 'trouser_elastic_20_30') catId = 'trousers_elastic_20_30'
          if (catId === 'trouser_elastic_32_40') catId = 'trousers_elastic_32_40'

          if (!catId) {
            hasUncategorized = true
          } else {
            const catObj = productionCategories.find(c => c.id === catId)
            const name = catObj ? catObj.name : catId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            const id = catObj ? catObj.id : catId
            if (id && !catsMap.has(id)) {
              catsMap.set(id, { id, name })
            }
          }
        })
      }
    })

    const list = Array.from(catsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    list.unshift({ id: 'Uncategorized', name: 'Uncategorized' })
    return list
  }, [orders])

  const flatTailorGarments = useMemo(() => {
    const rows = []

    orders.forEach((order) => {
      // 1. Order Status Filter
      if (tailorStatusFilter !== 'All' && order.status !== tailorStatusFilter) {
        return
      }

      // 2. School Filter
      if (tailorSchoolFilter !== 'All' && order.school !== tailorSchoolFilter) {
        return
      }

      // 3. Delivery Date Filter
      if (!isDateInFilter(order.deliveryDate, tailorDeliveryFilter, tailorCustomStartDate, tailorCustomEndDate)) {
        return
      }

      // 4. Search Filter (Order Number or Customer Name)
      if (deferredTailorSearchTerm.trim() !== '') {
        const term = deferredTailorSearchTerm.toLowerCase()
        const orderNum = (order.orderNumber || '').toLowerCase()
        const custName = (order.customerName || '').toLowerCase()
        if (!orderNum.includes(term) && !custName.includes(term)) {
          return
        }
      }

      // 5. Extract items
      if (order.items && order.items.length > 0) {
        order.items.forEach((item, index) => {
          // 6. Product Filter
          if (tailorProductFilter !== 'All') {
            if (item.itemType !== tailorProductFilter.toLowerCase()) {
              return
            }
          }

          // 7. Category Filter
          if (tailorCategoryFilter !== 'All') {
            let catId = item.productionCategory || ''
            if (catId === 'trouser_elastic_20_30') catId = 'trousers_elastic_20_30'
            if (catId === 'trouser_elastic_32_40') catId = 'trousers_elastic_32_40'

            if (tailorCategoryFilter === 'Uncategorized') {
              if (catId !== '') return
            } else {
              const catObj = productionCategories.find(c => c.id === catId)
              const catName = catObj ? catObj.name : catId
              if (catId !== tailorCategoryFilter && catName !== tailorCategoryFilter) {
                return
              }
            }
          }

          rows.push({
            orderId: order._id,
            orderNumber: order.orderNumber || '',
            customerName: order.customerName || '',
            school: order.school || '',
            gender: order.gender || 'Male',
            product: item.itemType ? item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1) : 'Unknown',
            quantity: item.quantity || 0,
            productionCategory: item.productionCategory || '',
            measurements: item.measurements || {},
            notes: order.notes || '',
            deliveryDate: order.deliveryDate || '',
            status: order.status || 'Pending',
            itemIndex: index,
            uniqueRowId: `${order._id}_${item._id || index}`,
            order: order
          })
        })
      }
    })

    return rows
  }, [
    orders,
    tailorStatusFilter,
    tailorProductFilter,
    tailorCategoryFilter,
    tailorSchoolFilter,
    tailorDeliveryFilter,
    tailorCustomStartDate,
    tailorCustomEndDate,
    deferredTailorSearchTerm
  ])

  const sortedTailorGarments = useMemo(() => {
    const rows = [...flatTailorGarments]

    return rows.sort((a, b) => {
      let valA = a[tailorSortKey]
      let valB = b[tailorSortKey]

      if (tailorSortKey === 'deliveryDate') {
        const timeA = valA ? new Date(valA).getTime() : Infinity
        const timeB = valB ? new Date(valB).getTime() : Infinity
        return tailorSortOrder === 'asc' ? timeA - timeB : timeB - timeA
      }

      if (tailorSortKey === 'orderNumber') {
        const numA = Number(valA)
        const numB = Number(valB)
        if (!isNaN(numA) && !isNaN(numB)) {
          return tailorSortOrder === 'asc' ? numA - numB : numB - numA
        }
      }

      valA = valA ? String(valA).toLowerCase() : ''
      valB = valB ? String(valB).toLowerCase() : ''

      if (valA < valB) return tailorSortOrder === 'asc' ? -1 : 1
      if (valA > valB) return tailorSortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [flatTailorGarments, tailorSortKey, tailorSortOrder])

  const productionCostDetails = useMemo(() => {
    let totalCost = 0;
    let totalQty = 0;
    const categoryCounts = {};

    sortedTailorGarments.forEach((row) => {
      const qty = Number(row.quantity) || 0;
      let catId = row.productionCategory || '';
      if (catId === 'trouser_elastic_20_30') catId = 'trousers_elastic_20_30';
      if (catId === 'trouser_elastic_32_40') catId = 'trousers_elastic_32_40';

      const catInfo = productionCategories.find(c => c.id === catId);
      const catName = catInfo ? catInfo.name : (catId ? catId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Uncategorized');
      const rate = (pricingRates && pricingRates[catId] !== undefined)
        ? Number(pricingRates[catId])
        : (catInfo ? catInfo.defaultRate : 0);

      const itemCost = qty * rate;
      totalCost += itemCost;
      totalQty += qty;

      if (!categoryCounts[catId]) {
        categoryCounts[catId] = {
          id: catId,
          name: catName,
          rate,
          qty: 0,
          cost: 0
        };
      }
      categoryCounts[catId].qty += qty;
      categoryCounts[catId].cost += itemCost;
    });

    const activeCategories = Object.values(categoryCounts).filter(c => c.qty > 0);

    return {
      totalCost,
      totalQty,
      categoryCounts,
      activeCategories
    };
  }, [sortedTailorGarments, pricingRates]);

  const handleInlineCategoryChange = async (row, newCategory) => {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${row.orderId}/item-category`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itemIndex: row.itemIndex,
          category: newCategory
        })
      })

      if (response.ok) {
        const data = await response.json()
        setOrders(prev => prev.map(o => o._id === row.orderId ? data.order : o))
      } else {
        alert('Failed to update garment category')
      }
    } catch (error) {
      console.error('Failed to update category', error)
    }
  }

  const handleSendWhatsApp = (order) => {
    if (!order || !order.contactNumber) {
      alert('No customer phone number available!')
      return
    }

    const cleanPhone = order.contactNumber.replace(/\D/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone

    // If the order status is not 'Ready', just open WhatsApp with no pre-filled message draft
    if (order.status !== 'Ready') {
      const url = whatsappMode === 'app'
        ? `whatsapp://send?phone=${fullPhone}`
        : `https://wa.me/${fullPhone}`
      window.open(url, '_blank')
      return
    }

    const customerName = order.customerName || 'Customer'
    const orderNo = order.orderNumber || ''
    const amount = order.amount || 0
    const paymentStatus = order.paymentStatus || 'Unpaid'
    const school = order.school || ''

    // Payment notice adjustment
    let collectionMsg = ''
    if (paymentStatus === 'Paid') {
      collectionMsg = 'Please visit Liberty Uniform at your convenience to collect your order. (Paid in Full)'
    } else {
      collectionMsg = `Please visit Liberty Uniform at your convenience to collect your order. (Remaining balance to pay: ₹${amount})`
    }

    const rawTemplate = (whatsappTemplates && whatsappTemplates.orderReadyTemplate) || DEFAULT_WHATSAPP_TEMPLATES.orderReadyTemplate
    const message = rawTemplate
      .replace(/\{customerName\}/g, customerName)
      .replace(/\{orderNumber\}/g, orderNo)
      .replace(/\{school\}/g, school)
      .replace(/\{amount\}/g, amount)
      .replace(/\{paymentStatus\}/g, paymentStatus)
      .replace(/\{collectionMsg\}/g, collectionMsg)

    const encodedText = encodeURIComponent(message)
    const url = whatsappMode === 'app'
      ? `whatsapp://send?phone=${fullPhone}&text=${encodedText}`
      : `https://wa.me/${fullPhone}?text=${encodedText}`
    window.open(url, '_blank')
  }

  const exportToCSV = () => {
    const headers = [
      'Order No.',
      'Product',
      'Category',
      'Customer Name',
      'School',
      'Gender',
      'Quantity',
      'Measurements',
      'Notes',
      'Delivery Date'
    ]

    const csvRows = [headers.join(',')]

    sortedTailorGarments.forEach((row) => {
      const items = []
      const prod = row.product.toLowerCase()
      const m = row.measurements || {}

      Object.entries(m).forEach(([fieldKey, val]) => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const label = fieldKey === 'sizeFarma'
            ? 'Size Farma'
            : fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
          items.push(`${label}: ${String(val).trim()}`)
        }
      })

      const measurementsStr = items.length > 0 ? items.join(' | ') : '-'

      const formatField = (field) => {
        const str = field !== undefined && field !== null ? String(field) : ''
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const sleeveTag = getSleeveTag(row.product, row.measurements);
      const productVal = sleeveTag ? `${row.product} (${sleeveTag})` : row.product;
      const catObj = productionCategories.find(c => c.id === (row.productionCategory || guessProductionCategory(row)));
      const catName = catObj ? catObj.name : (row.productionCategory || '');

      const csvRow = [
        formatField(row.orderNumber),
        formatField(productVal),
        formatField(catName),
        formatField(row.customerName),
        formatField(row.school),
        formatField(row.gender),
        formatField(row.quantity),
        formatField(measurementsStr),
        formatField(row.notes || '-'),
        formatField(formatDateToDMY(row.deliveryDate))
      ]

      csvRows.push(csvRow.join(','))
    })

    if (tailorStatusFilter === 'Pending') {
      csvRows.push('')
      csvRows.push('')
      csvRows.push('PRODUCTION COST SUMMARY,,,,,,,,,,')
      csvRows.push('Category Component,Unit Rate (₹),Quantity (Pcs),Subtotal (₹),,,,,,,')
      productionCostDetails.activeCategories.forEach(cat => {
        csvRows.push(`"${cat.name}",₹${cat.rate},${cat.qty},"₹${cat.cost.toLocaleString()}",,,,,,,`)
      })
      csvRows.push(`"Total Production Cost",,${productionCostDetails.totalQty},"₹${productionCostDetails.totalCost.toLocaleString()}",,,,,,,`)
    }

    const csvContent = '\uFEFF' + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    const statusPart = tailorStatusFilter.toLowerCase()
    const productPart = tailorProductFilter.toLowerCase()
    const dateStr = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `tailor_work_${statusPart}_${productPart}_${dateStr}.csv`)

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveAsPDF = () => {
    setShowPDFModal(true)
  }

  // Paper pixel widths at 96dpi matching exact PDF page sizes
  // (These must match the preview widths below exactly)
  const getPaperPxWidth = () => {
    if (pdfFormat === 'a3') return pdfOrientation === 'landscape' ? 1587 : 1123
    if (pdfFormat === 'legal') return pdfOrientation === 'landscape' ? 1344 : 816
    if (pdfFormat === 'letter') return pdfOrientation === 'landscape' ? 1056 : 816
    // a4 default
    return pdfOrientation === 'landscape' ? 1123 : 794
  }

  const executePDFDownload = async () => {
    try {
      setExportingPDF(true)

      // Load jsPDF + autoTable if not already loaded
      // These generate PDF purely from data — no screenshots, no device-dependent canvas
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
      }
      if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('jsPDF failed to load')
      }
      if (!window.jspdfAutoTable) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
        window.jspdfAutoTable = true
      }

      let cleanFileName = pdfFileName.trim() ? pdfFileName.trim() : getInitialPdfFileName()
      if (!cleanFileName.toLowerCase().endsWith('.pdf')) cleanFileName += '.pdf'

      // Margin in mm
      let marginMm = 10
      if (pdfMargin === 'compact') marginMm = 6
      if (pdfMargin === 'wide') marginMm = 18

      // Font size based on scale
      let bodyFontSize = 8
      let headerFontSize = 8.5
      if (pdfScale === 'compact') { bodyFontSize = 7; headerFontSize = 7.5 }
      if (pdfScale === 'large') { bodyFontSize = 9.5; headerFontSize = 10 }

      const { jsPDF } = window.jspdf
      const doc = new jsPDF({
        orientation: pdfOrientation,
        unit: 'mm',
        format: pdfFormat
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const usableWidth = pageWidth - marginMm * 2

      // ── Header ──────────────────────────────────────────────────────────
      doc.setFillColor(29, 78, 216)
      doc.rect(marginMm, marginMm, usableWidth, 7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Liberty Uniform \u2014 Production Queue', marginMm + 3, marginMm + 5)

      doc.setTextColor(100, 116, 139)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      const genDate = new Date().toLocaleDateString('en-GB')
      const headerRight = `Generated: ${genDate}  |  ${pdfFormat.toUpperCase()} ${pdfOrientation}`
      doc.text(headerRight, pageWidth - marginMm, marginMm + 5, { align: 'right' })

      doc.setTextColor(71, 85, 105)
      doc.setFontSize(7)
      doc.text(
        `Status: ${tailorStatusFilter || 'All'}   School: ${tailorSchoolFilter || 'All'}   Date: ${tailorDeliveryFilter || 'All'}`,
        marginMm, marginMm + 11
      )

      const tableStartY = marginMm + 15

      // ── Garments Table ──────────────────────────────────────────────────
      const garmentRows = sortedTailorGarments.map(row => {
        const catVal = row.productionCategory || guessProductionCategory(row)
        const catObj = productionCategories.find(c => c.id === catVal)
        const catName = catObj ? catObj.name : (catVal || '-')
        const gender = row.gender === 'Female' ? 'F' : (row.gender === 'Male' ? 'M' : (row.gender || '-'))
        const meas = renderPDFMeasurements(row.product, row.measurements)
        const delivery = formatDateToDMY(row.deliveryDate) || '-'
        return [
          `#${row.orderNumber}`,
          row.product.toUpperCase(),
          catName,
          row.school || '-',
          gender,
          String(row.quantity || '-'),
          meas,
          row.notes || '-',
          delivery
        ]
      })

      // Column widths as % of usable width (total = 100%)
      const colWidths = [6, 8, 13, 13, 4, 4, 29, 12, 11].map(pct => usableWidth * pct / 100)

      const containsEmoji = (str) => {
        if (!str) return false
        return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u.test(String(str))
      }

      doc.autoTable({
        startY: tableStartY,
        head: [['Order #', 'Product', 'Category', 'School', 'G', 'Qty', 'Measurements', 'Notes', 'Delivery']],
        body: garmentRows.length > 0 ? garmentRows : [['No garments match the selected filters.', '', '', '', '', '', '', '', '']],
        margin: { left: marginMm, right: marginMm },
        tableWidth: usableWidth,
        columnStyles: {
          0: { cellWidth: colWidths[0], fontStyle: 'bold' },
          1: { cellWidth: colWidths[1], fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: colWidths[2] },
          3: { cellWidth: colWidths[3] },
          4: { cellWidth: colWidths[4], halign: 'center' },
          5: { cellWidth: colWidths[5], halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: colWidths[6] },
          7: { cellWidth: colWidths[7] },
          8: { cellWidth: colWidths[8], textColor: [225, 29, 72], fontStyle: 'bold' }
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          fontSize: headerFontSize,
          lineColor: [203, 213, 225],
          lineWidth: 0.3
        },
        bodyStyles: {
          fontSize: bodyFontSize,
          textColor: [15, 23, 42],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
          overflow: 'linebreak',
          valign: 'middle'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          // Product col: color the text by product type
          if (data.section === 'body' && data.column.index === 1) {
            const val = String(data.cell.raw).toLowerCase()
            if (val === 'shirt') data.cell.styles.textColor = [29, 78, 216]
            else if (val === 'pant' || val === 'shorts') data.cell.styles.textColor = [124, 58, 237]
            else data.cell.styles.textColor = [225, 29, 72]
          }
          // Transparent text if cell has emoji to avoid drawing broken box glyphs
          if (data.section === 'body' && containsEmoji(data.cell.raw)) {
            data.cell.styles.textColor = [255, 255, 255]
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && containsEmoji(data.cell.raw)) {
            try {
              const cell = data.cell
              const text = String(cell.raw)
              const scale = 3
              const mmToPx = 3.78
              const widthPx = Math.ceil(cell.width * mmToPx * scale)
              const heightPx = Math.ceil(cell.height * mmToPx * scale)

              const canvas = document.createElement('canvas')
              canvas.width = Math.max(widthPx, 10)
              canvas.height = Math.max(heightPx, 10)

              const ctx = canvas.getContext('2d')
              ctx.scale(scale, scale)

              const fontSizePx = Math.max(9, Math.round(cell.styles.fontSize * 1.33))
              ctx.font = `${fontSizePx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
              ctx.fillStyle = '#0F172A'
              ctx.textBaseline = 'top'

              const maxW = cell.width * mmToPx - 4
              const words = text.split(' ')
              const lines = []
              let currentLine = ''

              for (let i = 0; i < words.length; i++) {
                const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i]
                const metrics = ctx.measureText(testLine)
                if (metrics.width > maxW && currentLine) {
                  lines.push(currentLine)
                  currentLine = words[i]
                } else {
                  currentLine = testLine
                }
              }
              if (currentLine) lines.push(currentLine)

              const lineHeight = fontSizePx * 1.25
              const totalTextHeight = lines.length * lineHeight
              let startY = (cell.height * mmToPx - totalTextHeight) / 2
              if (startY < 2) startY = 2

              lines.forEach((line, index) => {
                let startX = 2
                if (cell.styles.halign === 'center') {
                  startX = (cell.width * mmToPx - ctx.measureText(line).width) / 2
                } else if (cell.styles.halign === 'right') {
                  startX = cell.width * mmToPx - ctx.measureText(line).width - 2
                }
                ctx.fillText(line, Math.max(0, startX), startY + index * lineHeight)
              })

              const imgData = canvas.toDataURL('image/png')
              doc.addImage(imgData, 'PNG', cell.x, cell.y, cell.width, cell.height)
            } catch (e) {
              console.warn('Emoji canvas render fallback:', e)
            }
          }
        },
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        showHead: 'everyPage'
      })

      // ── Production Cost Summary Table ─────────────────────────────────
      const costStartY = doc.lastAutoTable.finalY + 8

      // Section heading
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('PRODUCTION COST SUMMARY', marginMm, costStartY)
      doc.setLineWidth(0.5)
      doc.setDrawColor(15, 23, 42)
      doc.line(marginMm, costStartY + 1.5, pageWidth - marginMm, costStartY + 1.5)

      const costRows = productionCostDetails.activeCategories.map(cat => [
        cat.name,
        `Rs.${cat.rate}`,
        String(cat.qty),
        `Rs.${cat.cost.toLocaleString()}`
      ])
      costRows.push([
        'TOTAL PRODUCTION COST',
        '',
        `${productionCostDetails.totalQty} pcs`,
        `Rs.${productionCostDetails.totalCost.toLocaleString()}`
      ])

      // Cost table: full-width across the entire usable page width
      doc.autoTable({
        startY: costStartY + 4,
        head: [['Component Category', 'Rate/Unit', 'Pieces', 'Total Cost']],
        body: costRows.length > 0 ? costRows : [['No categories', '', '', '']],
        margin: { left: marginMm, right: marginMm },
        tableWidth: usableWidth,
        columnStyles: {
          0: { cellWidth: usableWidth * 0.45 },
          1: { cellWidth: usableWidth * 0.18, halign: 'right' },
          2: { cellWidth: usableWidth * 0.15, halign: 'center' },
          3: { cellWidth: usableWidth * 0.22, halign: 'right', fontStyle: 'bold' }
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          fontSize: bodyFontSize,
          lineColor: [203, 213, 225],
          lineWidth: 0.3
        },
        bodyStyles: {
          fontSize: bodyFontSize,
          textColor: [15, 23, 42],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 }
        },
        didParseCell: (data) => {
          // Total row styling
          if (data.section === 'body' && data.row.index === costRows.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [239, 246, 255]
            data.cell.styles.textColor = [29, 78, 216]
            data.cell.styles.lineWidth = 0.5
            data.cell.styles.lineColor = [37, 99, 235]
          }
        },
        pageBreak: 'avoid'
      })

      // ── Footer: page numbers ──────────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Page ${i} of ${totalPages}  |  Liberty Uniform Order Book`,
          pageWidth / 2, pageHeight - marginMm / 2,
          { align: 'center' }
        )
      }

      doc.save(cleanFileName)
      setShowPDFModal(false)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('PDF generation failed: ' + err.message)
    } finally {
      setExportingPDF(false)
    }
  }


  const renderTailorMeasurements = (product, measurements) => {
    if (!measurements || Object.keys(measurements).length === 0) return '-'
    const items = []

    Object.entries(measurements).forEach(([fieldKey, val]) => {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const label = fieldKey === 'sizeFarma'
          ? 'Size Farma'
          : fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
        items.push({ label, val: String(val).trim() })
      }
    })

    if (items.length === 0) return '-'

    return (
      <>
        <div className="tailor-measurements-list screen-and-landscape-measurements">
          {items.map((it) => (
            <span key={it.label} className="measurement-tag">
              <strong>{it.label}:</strong> {it.val}
            </span>
          ))}
        </div>
        <div className="print-portrait-measurements" style={{ display: 'none' }}>
          {items.map((it, idx) => (
            <span key={it.label} style={{ display: 'inline-block', whiteSpace: 'nowrap', marginRight: '6px', fontSize: '8px' }}>
              <strong>{it.label}:</strong> {it.val}
              {idx > 0 && idx % 3 === 0 ? <br /> : null}
            </span>
          ))}
        </div>
      </>
    )
  }

  // PDF measurement renderer — full labels (Length, Waist, Chest, etc.), clear formatting, no clipping
  const renderPDFMeasurements = (product, measurements) => {
    if (!measurements || Object.keys(measurements).length === 0) return '-'
    const parts = []

    Object.entries(measurements).forEach(([fieldKey, val]) => {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const label = fieldKey === 'sizeFarma'
          ? 'Size Farma'
          : fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
        parts.push(`${label}: ${String(val).trim()}`)
      }
    })

    return parts.length === 0 ? '-' : parts.join('  ')
  }

  const recentOrders = orders.slice(0, 5)
  const recentActivity = orders.slice(0, 5).map((order) => `Order ${order.orderNumber} updated to ${order.status}`)

  useEffect(() => {
    if (activePage !== 'Orders') return undefined

    const handleScroll = () => {
      if (!hasMoreOrders) return
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 120
      const containerNearBottom = tableWrapRef.current
        ? tableWrapRef.current.scrollTop + tableWrapRef.current.clientHeight >= tableWrapRef.current.scrollHeight - 80
        : false
      if (nearBottom || containerNearBottom) {
        setVisibleCount((prev) => Math.min(prev + loadStep, sortedOrders.length))
      }
    }

    window.addEventListener('scroll', handleScroll)
    const container = tableWrapRef.current
    if (container) container.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (container) container.removeEventListener('scroll', handleScroll)
    }
  }, [activePage, hasMoreOrders, sortedOrders.length])

  useEffect(() => {
    if (activePage === 'Orders' && editScrollSaved.current?.pendingRestore) {
      const saved = editScrollSaved.current
      const timer = setTimeout(() => {
        const rowEl = document.getElementById(`order-row-${saved.orderId}`) || document.querySelector('.highlighted-row')
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (saved.scrollY) {
          window.scrollTo({ top: saved.scrollY, behavior: 'instant' })
        }
        editScrollSaved.current.pendingRestore = false
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [activePage, highlightedOrderId, orders])

  useEffect(() => {
    if (activePage === 'Orders') {
      if (editScrollSaved.current?.pendingRestore) return
      setVisibleCount(loadStep)
    }
  }, [activePage, orderFilter, orderPaymentFilter, orderContactFilter, orderSchoolFilter, searchTerm])

  useEffect(() => {
    if (activePage === 'New Order' && !isEditing) {
      setFormData(createEmptyForm(getNextOrderNumber(orders)))
    }
  }, [activePage, orders, isEditing])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (timerAlertOrder) {
        if (e.target.closest('.status-badge') || e.target.closest('.timer-popup')) {
          return
        }
        setTimerAlertOrder(null)
      }
      if (timerAlertWaitlist) {
        if (e.target.closest('.status-badge') || e.target.closest('.timer-popup')) {
          return
        }
        setTimerAlertWaitlist(null)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [timerAlertOrder, timerAlertWaitlist])

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="brand-block" style={{ justifyContent: 'center', marginBottom: '24px' }}>
            <div className="brand-logo">LU</div>
            <div>
              <p className="brand-title" style={{ fontSize: '20px' }}>Liberty Uniform</p>
              <p className="brand-subtitle" style={{ fontSize: '12px' }}>Order Book Admin Panel</p>
            </div>
          </div>

          {!isForgotMode ? (
            <form onSubmit={handleLogin} className="login-form">
              <h2 className="login-title">Admin Sign In</h2>
              <p className="login-subtitle">Enter your admin credentials to access the book</p>

              {loginError && <div className="login-error-alert">{loginError}</div>}

              <div className="login-input-group">
                <label>
                  Username
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                  />
                </label>
              </div>

              <div className="login-input-group">
                <label>
                  Password
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      style={{ paddingRight: '40px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="password-toggle-btn"
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: '16px',
                        color: '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {showLoginPassword ? getSafeEmoji('🙈') : getSafeEmoji('👁️')}
                    </button>
                  </div>
                </label>
              </div>

              <button type="submit" className="primary-btn login-btn" style={{ width: '100%', marginTop: '8px' }}>
                Sign In
              </button>

              <button
                type="button"
                className="forgot-link-btn"
                onClick={() => {
                  setIsForgotMode(true);
                  setLoginError('');
                  setForgotMsg('');
                  setForgotError('');
                  setOtpCode('');
                  sendOTP();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginTop: '16px',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                Forgot Password?
              </button>
            </form>
          ) : (
            <>
              {forgotStep === 1 && (
                <form onSubmit={handleVerifyOTP} className="login-form">
                  <h2 className="login-title">Enter Verification Code</h2>
                  <p className="login-subtitle">Please enter the 6-digit OTP code sent to your Telegram bot</p>

                  {forgotError && <div className="login-error-alert">{forgotError}</div>}
                  {forgotMsg && <div className="login-success-alert">{forgotMsg}</div>}

                  <div className="login-input-group">
                    <label style={{ lineHeight: '1.6' }}>
                      OTP Verification Code
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        required
                        maxLength="6"
                        style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: '700' }}
                      />
                    </label>
                  </div>

                  <button type="submit" className="primary-btn login-btn" style={{ width: '100%', marginTop: '12px' }}>
                    Verify Code
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={sendOTP}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {getSafeEmoji('🔄')} Resend Code
                    </button>
                    <button
                      type="button"
                      onClick={handleReturnToLogin}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563EB',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleResetPassword} className="login-form">
                  <h2 className="login-title">Reset Password</h2>
                  <p className="login-subtitle">Set your new custom administrator password</p>

                  {forgotError && <div className="login-error-alert">{forgotError}</div>}

                  <div className="login-input-group">
                    <label>
                      New Password
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                      />
                    </label>
                  </div>

                  <div className="login-input-group">
                    <label>
                      Confirm Password
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                      />
                    </label>
                  </div>

                  <button type="submit" className="primary-btn login-btn" style={{ width: '100%', marginTop: '12px' }}>
                    Save Password
                  </button>

                  <button
                    type="button"
                    className="forgot-link-btn"
                    onClick={handleReturnToLogin}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginTop: '16px',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'center'
                    }}
                  >
                    Cancel and Login
                  </button>
                </form>
              )}

              {forgotStep === 3 && (
                <div className="login-form" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', color: '#10B981', marginBottom: '16px' }}>{getSafeEmoji('✓')}</div>
                  <h2 className="login-title">Password Updated Successfully</h2>
                  <p className="login-subtitle" style={{ marginBottom: '24px' }}>
                    Your password has been changed successfully.
                  </p>

                  <button
                    type="button"
                    className="primary-btn login-btn"
                    onClick={handleReturnToLogin}
                    style={{ width: '100%' }}
                  >
                    Return to Login
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-logo">LU</div>
          <div>
            <p className="brand-title">Liberty Uniform</p>
            <p className="brand-subtitle">Order Book</p>
          </div>
        </div>

        <div className="sidebar-credit">
          <p>Created by Advait Karia</p>
        </div>

        <nav className="sidebar-nav">
          {['Dashboard', 'New Order', 'Orders', 'Production Queue', 'Stock Waitlist', 'Restock & Bulk Orders', 'Settings'].map((page) => {
            const emojis = {
              'Dashboard': getSafeEmoji('📊'),
              'New Order': getSafeEmoji('➕'),
              'Orders': getSafeEmoji('📋'),
              'Production Queue': getSafeEmoji('🧵'),
              'Stock Waitlist': getSafeEmoji('🔔'),
              'Restock & Bulk Orders': getSafeEmoji('🏬'),
              'Supplier Restock': getSafeEmoji('🏬'),
              'Settings': getSafeEmoji('⚙️')
            };
            return (
              <button
                key={page}
                type="button"
                className={`nav-link ${activePage === page ? 'active' : ''}`}
                onClick={() => goToPage(page)}
              >
                <span className="nav-icon">{emojis[page]}</span>
                <span className="nav-text">{page}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="topbar-title">
            <p className="page-title">{activePage}</p>
            <p className="page-subtitle">{pageSubtitles[activePage]}</p>
          </div>
          <div className="topbar-actions" style={{ position: 'relative' }}>
            <div
              className="profile-badge"
              onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
              style={{ cursor: 'pointer' }}
            >
              AK
            </div>
            {showLogoutDropdown && (
              <div className="logout-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutDropdown(false);
                    setShowManageModal(true);
                    setManageStep(1);
                  }}
                >
                  Manage Account
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                >
                  Appearance: {theme === 'light' ? 'Dark' : 'Light'}
                </button>
                <button type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="main-section">
          {activePage === 'Dashboard' && (
            <>
              <section className="stats-grid">
                {stats.map((stat) => (
                  <article
                    key={stat.label}
                    className="stat-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => applyOrderFilter(stat.filter)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        applyOrderFilter(stat.filter)
                      }
                    }}
                  >
                    <div className="stat-card-top">
                      <div className="stat-icon">{stat.icon}</div>
                      <span className="stat-label">{stat.label}</span>
                    </div>
                    <p className="stat-value">{stat.value}</p>
                    <p className="stat-description">{stat.description}</p>
                  </article>
                ))}
              </section>
            </>
          )}

          {(activePage === 'New Order' || (activePage === 'Orders' && isEditing)) && (
            <section className="page-panel page-form-panel">
              <div className="form-layout-grid">
                <form onSubmit={handleSubmit} className="new-order-form">
                  <div className="form-status-row">
                    {formError ? (
                      <div className="form-alert error">{formError}</div>
                    ) : message ? (
                      <div className="form-alert success">{message}</div>
                    ) : null}
                  </div>
                  <div className="form-columns">
                    <div className="card card-panel">
                      <div className="card-header">
                        <div>
                          <p className="card-title">Customer Details</p>
                          <p className="card-subtitle">Order number, school and contact information</p>
                        </div>
                      </div>
                      <div className="form-grid">
                        <label>
                          Order Number
                          <input name="orderNumber" value={formData.orderNumber} onChange={handleChange} required />
                        </label>
                        <label>
                          Customer Name
                          <input name="customerName" value={formData.customerName} onChange={handleChange} required />
                        </label>
                        <label>
                          Contact Number
                          <input name="contactNumber" value={formData.contactNumber} onChange={handleChange} required />
                        </label>
                        <label>
                          Gender
                          <select name="gender" value={formData.gender} onChange={handleChange}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </label>
                        <label style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span>School / Firm</span>
                            <button
                              type="button"
                              className="ghost-btn"
                              onClick={() => setShowSchoolManager(!showSchoolManager)}
                              style={{ fontSize: '11px', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              {showSchoolManager ? `${getSafeEmoji('✕')} Hide Directory` : `${getSafeEmoji('⚙️')} Manage Directory`}
                            </button>
                          </div>
                          <select
                            name="school"
                            value={formData.school}
                            onChange={handleChange}
                            required
                          >
                            <option value="">-- Select School / Firm --</option>
                            {tailorAvailableSchools.map((schoolName) => (
                              <option key={schoolName} value={schoolName}>
                                {schoolName}
                              </option>
                            ))}
                            {formData.school && !tailorAvailableSchools.includes(formData.school) && (
                              <option value={formData.school}>{formData.school}</option>
                            )}
                          </select>
                        </label>
                        {showSchoolManager && (
                          <div style={{
                            gridColumn: '1 / -1',
                            background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '10px'
                          }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#93C5FD' : '#1D4ED8', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>School Directory Manager</span>
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'normal' }}>Add, rename or remove registered schools</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                              <input
                                type="text"
                                placeholder="Type new school name..."
                                value={newSchoolNameInput}
                                onChange={(e) => setNewSchoolNameInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveWaitlistSchool(e) }}
                                style={{
                                  flex: 1,
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1',
                                  background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                                  color: 'inherit'
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleSaveWaitlistSchool}
                                className="primary-btn"
                                style={{ padding: '0 12px', fontSize: '11px', height: '28px', minWidth: 'auto', display: 'flex', alignItems: 'center' }}
                              >
                                Add
                              </button>
                            </div>
                            <div style={{ maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                              {waitlistSchools.length === 0 ? (
                                <p style={{ fontSize: '11px', color: '#64748B', textAlign: 'center', margin: '8px 0' }}>No registered schools yet in directory.</p>
                              ) : (
                                waitlistSchools.map((s) => (
                                  <div key={s._id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 0',
                                    borderBottom: '1px solid var(--border-color, #E5E7EB)'
                                  }}>
                                    {editingSchoolId === s._id ? (
                                      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                        <input
                                          type="text"
                                          value={editingSchoolNameInput}
                                          onChange={(e) => setEditingSchoolNameInput(e.target.value)}
                                          style={{ flex: 1, padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #2563EB', background: theme === 'dark' ? '#1E293B' : '#FFFFFF', color: 'inherit' }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleRenameWaitlistSchool(s._id, editingSchoolNameInput)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                          title="Save Rename"
                                        >
                                          {getSafeEmoji('💾')}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setEditingSchoolId(null); setEditingSchoolNameInput(''); }}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                          title="Cancel"
                                        >
                                          {getSafeEmoji('❌')}
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span style={{ fontSize: '12px', fontWeight: '500' }}>{s.name}</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button
                                            type="button"
                                            onClick={() => { setEditingSchoolId(s._id); setEditingSchoolNameInput(s.name); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                                            title="Rename School"
                                          >
                                            {getSafeEmoji('✏️')}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteWaitlistSchool(s._id, s.name)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                                            title="Delete School"
                                          >
                                            {getSafeEmoji('🗑️')}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                        <label>
                          Grade
                          <input name="grade" value={formData.grade || ''} onChange={handleChange} placeholder="e.g. 5th, Std 10, Grade A" />
                        </label>
                      </div>
                    </div>

                    <div className="card card-panel">
                      <div className="card-header">
                        <div>
                          <p className="card-title">Delivery & Payment</p>
                          <p className="card-subtitle">Delivery date, amount and payment status</p>
                        </div>
                      </div>
                      <div className="form-grid">
                        <label>
                          Delivery Date <span className="required-star" style={{ color: '#ef4444' }}>*</span>
                          <input type="date" name="deliveryDate" value={formData.deliveryDate} onChange={handleChange} required />
                        </label>
                        <label>
                          Amount
                          <input type="number" name="amount" value={formData.amount} onChange={handleChange} placeholder="Optional" />
                        </label>
                        <label>
                          Payment Status
                          <select name="paymentStatus" value={formData.paymentStatus} onChange={handleChange}>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                          </select>
                        </label>
                        <label>
                          Production Status
                          <select name="status" value={formData.status} onChange={handleChange}>
                            <option value="Pending">Pending</option>
                            <option value="Ready">Ready</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                        </label>
                        <label>
                          Contact Status
                          <select name="contactStatus" value={formData.contactStatus} onChange={handleChange}>
                            <option value="Not contacted">Not contacted</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Unable to contact">Unable to contact</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="card card-panel notes-panel">
                      <div className="card-header">
                        <div>
                          <p className="card-title">Notes</p>
                          <p className="card-subtitle">Save any important order details</p>
                        </div>
                      </div>
                      <label className="notes-label">
                        Notes
                        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="8" />
                      </label>
                      <div className="form-actions">
                        <button type="button" className="ghost-btn" onClick={() => setFormData(createEmptyForm())}>
                          Clear Form
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="card card-panel card-products">
                    <div className="card-header space-between">
                      <div>
                        <p className="card-title">Products Ordered</p>
                        <p className="card-subtitle">Add items and record measurements</p>
                      </div>
                      <button type="button" className="secondary-btn" onClick={addItem}>
                        + Add Item
                      </button>
                    </div>

                    <div className="product-body">
                      {formData.items.length === 0 ? (
                        <div className="empty-state">No items added yet. Click Add Item to begin.</div>
                      ) : (
                        formData.items.map((item, index) => (
                          <div key={index} className="item-card">
                            <div className="item-card-header">
                              <div>
                                <span className="item-badge">{item.itemType.toUpperCase()}</span>
                                {getSleeveTag(item.itemType, item.measurements) && (
                                  <span className="sleeve-badge-tag" style={{ marginLeft: '6px', fontSize: '11px', padding: '2px 6px', background: theme === 'dark' ? '#334155' : '#E2E8F0', color: theme === 'dark' ? '#f8fafc' : '#334155', borderRadius: '6px', fontWeight: 'bold' }}>
                                    ({getSleeveTag(item.itemType, item.measurements)})
                                  </span>
                                )}
                                <p className="item-title">Item {index + 1}</p>
                              </div>
                              <button type="button" className="ghost-btn" onClick={() => removeItem(index)}>
                                Remove
                              </button>
                            </div>

                            <div className="form-grid compact">
                              <label>
                                Type
                                <select name="itemType" value={item.itemType} onChange={(event) => handleItemChange(index, event)}>
                                  <option value="shirt">Shirt</option>
                                  <option value="kurta">Kurta</option>
                                  <option value="top">Top</option>
                                  <option value="blazer">Blazer</option>
                                  <option value="coaty">Coaty</option>
                                  <option value="pant">Pant</option>
                                  <option value="shorts">Shorts</option>
                                  <option value="pajama">Pajama</option>
                                  <option value="pina">Pina</option>
                                  <option value="skirt">Skirt</option>
                                  <option value="frock">Frock</option>
                                </select>
                              </label>
                              <label>
                                Quantity
                                <input type="number" name="quantity" value={item.quantity} onChange={(event) => handleItemChange(index, event)} min="1" required />
                              </label>
                            </div>

                            <div className="measurement-section" style={{ marginTop: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                  Measurement Components
                                </span>
                                {pendingCustomField?.itemIndex === index ? null : (
                                  <button
                                    type="button"
                                    className="ghost-btn"
                                    onClick={() => handleAddMeasurementField(index)}
                                    style={{ fontSize: '12px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    + Add Measurement Component
                                  </button>
                                )}
                              </div>

                              {/* Inline add form */}
                              {pendingCustomField?.itemIndex === index && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px', padding: '8px 10px', borderRadius: '8px', background: theme === 'dark' ? '#1E293B' : '#F0F9FF', border: `1px solid ${theme === 'dark' ? '#334155' : '#BAE6FD'}` }}>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={pendingCustomField.name}
                                    onChange={(e) => setPendingCustomField({ ...pendingCustomField, name: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); commitPendingCustomField() }
                                      if (e.key === 'Escape') setPendingCustomField(null)
                                    }}
                                    placeholder="Component name (e.g. Pocket, Logo, Embroidery)"
                                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #7DD3FC', fontSize: '13px', background: theme === 'dark' ? '#0F172A' : '#FFFFFF', color: 'inherit' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={commitPendingCustomField}
                                    style={{ padding: '6px 14px', borderRadius: '6px', background: '#2563EB', color: '#fff', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  >
                                    Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingCustomField(null)}
                                    style={{ padding: '6px 10px', borderRadius: '6px', background: 'none', border: '1px solid #94A3B8', color: '#94A3B8', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}

                              <div className="measurement-grid">
                                {getItemFields(item).map((field, fieldIdx) => {
                                  const isStandard = isStandardField(field);
                                  const displayLabel = field === 'sizeFarma'
                                    ? 'Size Farma'
                                    : field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
                                  const showTag = ['shirt', 'kurta'].includes(item.itemType) && field === 'sleeve' && getSleeveTag(item.itemType, item.measurements);
                                  const itemKey = isStandard ? field : `custom-field-${index}-${fieldIdx}`;

                                  return (
                                    <label key={itemKey} style={{ position: 'relative' }}>
                                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                        {isStandard ? (
                                          <span>
                                            {displayLabel}
                                            {showTag && (
                                              <span style={{ marginLeft: '6px', fontSize: '12px', color: '#2563EB', fontWeight: 'bold' }}>
                                                ({showTag})
                                              </span>
                                            )}
                                          </span>
                                        ) : (
                                          <input
                                            key={`name-${field}`}
                                            type="text"
                                            defaultValue={field}
                                            onBlur={(e) => {
                                              const newName = e.target.value.trim()
                                              if (newName && newName !== field) handleRenameMeasurementKey(index, field, newName)
                                              else if (!newName) e.target.value = field
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') e.target.blur()
                                              if (e.key === 'Escape') { e.target.value = field; e.target.blur() }
                                            }}
                                            placeholder="Component name"
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              padding: '2px 6px',
                                              border: '1px dashed #cbd5e1',
                                              borderRadius: '4px',
                                              width: '82%',
                                              background: theme === 'dark' ? '#1e293b' : '#ffffff',
                                              color: 'inherit'
                                            }}
                                          />
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveMeasurement(index, field)}
                                          title="Remove component"
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            padding: '0 2px',
                                            lineHeight: '1'
                                          }}
                                        >
                                          ×
                                        </button>
                                      </span>
                                      <input
                                        value={item.measurements[field] || (field === 'sizeFarma' ? item.sizeFarma : '') || ''}
                                        onChange={(event) => handleMeasurementChange(index, field, event.target.value)}
                                        placeholder={field === 'sizeFarma' ? 'e.g. Farma 32, Regular' : ''}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="form-actions form-actions-end">
                    {editingOrderId ? (
                      <button type="button" className="ghost-btn" onClick={cancelNewOrder}>
                        Cancel Edit
                      </button>
                    ) : (
                      <button type="button" className="ghost-btn" onClick={cancelNewOrder}>
                        Cancel
                      </button>
                    )}
                    <button
                      className="primary-btn"
                      type="submit"
                      disabled={loading || !hasFormChanges}
                    >
                      {loading ? 'Saving...' : editingOrderId ? 'Update Order' : 'Save Order'}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {activePage === 'Orders' && !isEditing && (
            <section className="page-panel page-orders-panel">
              {message && (
                <div className="form-status-row">
                  <div className="form-alert success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{message}</span>
                    <button
                      type="button"
                      className="close-btn"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'inherit', padding: '0 4px', fontWeight: 'bold' }}
                      onClick={() => setMessage('')}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              <div className="orders-toolbar">
                <div className="orders-search-bar">
                  <span className="topbar-search-icon">{getSafeEmoji('🔍')}</span>
                  <input
                    type="search"
                    placeholder="Search by order, customer or school..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="orders-toolbar-actions">
                  <label className="orders-filter-select">
                    <span>Production Status</span>
                    <select value={orderFilter} onChange={(event) => handleStatusFilterChange(event.target.value)}>
                      <option value="All">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Ready">Ready</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </label>
                  <label className="orders-filter-select">
                    <span>Payment Status</span>
                    <select value={orderPaymentFilter} onChange={(event) => handlePaymentFilterChange(event.target.value)}>
                      <option value="All">All Payments</option>
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </label>
                  <label className="orders-filter-select">
                    <span>Contact Status</span>
                    <select value={orderContactFilter} onChange={(event) => handleContactFilterChange(event.target.value)}>
                      <option value="All">All Contacts</option>
                      <option value="Not contacted">Not contacted</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Unable to contact">Unable to contact</option>
                    </select>
                  </label>
                  <label className="orders-filter-select">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>School</span>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setShowSchoolManager(!showSchoolManager)}
                        style={{ fontSize: '10px', padding: '0 4px', marginLeft: '6px', lineHeight: 1 }}
                        title="Manage School Directory"
                      >
                        {getSafeEmoji('⚙️')}
                      </button>
                    </div>
                    <select value={orderSchoolFilter} onChange={(event) => applyOrderSchoolFilter(event.target.value)}>
                      <option value="All">All Schools</option>
                      {tailorAvailableSchools.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>

                  <label className="orders-filter-select">
                    <span>Delivery</span>
                    <select value={orderDeliveryFilter} onChange={(e) => setOrderDeliveryFilter(e.target.value)}>
                      <option value="All">All Dates</option>
                      <option value="Today">Today</option>
                      <option value="Tomorrow">Tomorrow</option>
                      <option value="This Week">This Week</option>
                      <option value="This Month">This Month</option>
                      <option value="Custom">Custom Range</option>
                    </select>
                  </label>

                  {orderDeliveryFilter === 'Custom' && (
                    <div className="custom-date-inputs" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="date"
                        value={orderCustomStartDate}
                        onChange={(e) => setOrderCustomStartDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#64748B' }}>to</span>
                      <input
                        type="date"
                        value={orderCustomEndDate}
                        onChange={(e) => setOrderCustomEndDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  )}
                  <button type="button" className="danger-btn" onClick={handleBulkDelete} disabled={selectedIds.length === 0}>
                    Delete Selected{selectedIds.length ? ` (${selectedIds.length})` : ''}
                  </button>
                  {selectedIds.length > 0 && (
                    <button type="button" className="ghost-btn" onClick={unselectAll}>
                      Unselect All
                    </button>
                  )}
                  {sortedOrders.length > 0 && (
                    <button type="button" className="secondary-btn" onClick={scrollToBottom}>
                      ▼ Go to Bottom
                    </button>
                  )}
                </div>
              </div>

              <div className="table-panel">
                <div className="table-wrap" ref={tableWrapRef}>
                  <table>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={visibleOrders.length > 0 && visibleOrders.every((o) => selectedIds.includes(o._id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(visibleOrders.map((o) => o._id))
                              } else {
                                setSelectedIds([])
                              }
                            }}
                          />
                        </th>
                        <th>Order Number</th>
                        <th>Customer</th>
                        <th>School</th>
                        <th>Delivery Date</th>
                        <th>Amount</th>
                        <th>Payment Status</th>
                        <th>Production Status</th>
                        <th>Contact Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((order) => (
                        <tr
                          key={order._id}
                          id={`order-row-${order._id}`}
                          className={`clickable-row ${highlightedOrderId === order._id ? 'highlighted-row' : ''}`}
                          onClick={() => {
                            setSelectedOrder(order)
                            setHighlightedOrderId(order._id)
                            setShouldScrollToDetails(true)
                          }}
                          style={{
                            cursor: 'pointer',
                            position: (timerAlertOrder && timerAlertOrder._id === order._id) ? 'relative' : 'static',
                            zIndex: (timerAlertOrder && timerAlertOrder._id === order._id) ? 10 : 'auto'
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(order._id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelect(order._id)}
                            />
                          </td>
                          <td>
                            <span>#{order.orderNumber}</span>
                          </td>
                          <td>{order.customerName}</td>
                          <td>{order.school}</td>
                          <td>{formatDateToDMY(order.deliveryDate)}</td>
                          <td>{order.amount}</td>
                          <td>
                            <span className={`payment-badge ${(order.paymentStatus || 'Unpaid').toLowerCase()}`}>
                              {order.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'inline-block', position: 'relative' }}>
                              <span
                                className={`status-badge ${order.status === 'Delivered' ? 'clickable' : ''} ${order.status.toLowerCase()}`}
                                onClick={(e) => {
                                  if (order.status === 'Delivered') {
                                    e.stopPropagation();
                                    handleStatusTap(order)
                                  }
                                }}
                              >
                                {statusLabel[order.status] || order.status}
                              </span>

                              {timerAlertOrder && timerAlertOrder._id === order._id && (
                                <div
                                  className="timer-popup"
                                  style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%) translateY(-8px)',
                                    background: '#1E293B',
                                    color: 'white',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                                    zIndex: 100,
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px',
                                    pointerEvents: 'none'
                                  }}
                                >
                                  <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-deletes in</span>
                                  <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '700', color: '#38BDF8' }}>
                                    {computeTimeLeftDescription(order.deliveredAt, order.updatedAt, order.createdAt)}
                                  </span>
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: 0,
                                    height: 0,
                                    borderLeft: '6px solid transparent',
                                    borderRight: '6px solid transparent',
                                    borderTop: '6px solid #1E293B'
                                  }} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            {order.contactStatus || 'Not contacted'}
                          </td>
                          <td className="actions-cell">
                            <div className="actions-wrapper">
                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit order"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingOrder(order);
                                }}
                              >
                                {getSafeEmoji('✏️')}
                              </button>
                              <button
                                type="button"
                                className="icon-btn danger"
                                title="Delete order"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete order ${order.orderNumber}? This cannot be undone.`)) {
                                    deleteOrder(order._id)
                                  }
                                }}
                              >
                                {getSafeEmoji('🗑️')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pagination-row">
                  <span>
                    Showing {visibleOrders.length} of {sortedOrders.length} orders
                  </span>
                  <button type="button" className="ghost-btn" onClick={scrollToTop}>
                    ▲ Go to Top
                  </button>
                  {hasMoreOrders && (
                    <span className="load-more-hint">Scroll down to load more orders</span>
                  )}
                </div>
              </div>

              {selectedOrder && (
                <section className="card card-panel details-panel" ref={detailsPanelRef}>
                  <div className="card-header space-between" style={{ position: 'relative' }}>
                    <div>
                      <p className="card-title">Selected Order Details</p>
                      {selectedOrder.createdAt && (
                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500', display: 'block', marginTop: '2px' }}>
                          Order Created: {formatDateToDMY(String(selectedOrder.createdAt).split('T')[0])}
                        </span>
                      )}
                    </div>
                    <span
                      className={`status-badge ${selectedOrder.status === 'Delivered' ? 'clickable' : ''} ${selectedOrder.status.toLowerCase()}`}
                      onClick={() => {
                        if (selectedOrder.status === 'Delivered') {
                          handleStatusTap(selectedOrder)
                        }
                      }}
                    >
                      {selectedOrder.status}
                    </span>

                    {timerAlertOrder && timerAlertOrder._id === selectedOrder._id && (
                      <div
                        className="timer-popup"
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: '24px',
                          transform: 'translateY(-4px)',
                          background: '#1E293B',
                          color: 'white',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                          zIndex: 100,
                          fontSize: '13px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          pointerEvents: 'none'
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-deletes in</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '700', color: '#38BDF8' }}>
                          {computeTimeLeftDescription(selectedOrder.deliveredAt, selectedOrder.updatedAt, selectedOrder.createdAt)}
                        </span>
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: '48px',
                          transform: 'translateX(50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: '6px solid #1E293B'
                        }} />
                      </div>
                    )}
                  </div>
                  <div className="details-grid">
                    <div>
                      <p className="details-label">Order No.</p>
                      <p>{selectedOrder.orderNumber}</p>
                    </div>
                    <div>
                      <p className="details-label">Customer</p>
                      <p>{selectedOrder.customerName}</p>
                    </div>
                    <div>
                      <p className="details-label">Contact</p>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{selectedOrder.contactNumber}</span>
                        <button
                          type="button"
                          className="whatsapp-btn"
                          onClick={() => handleSendWhatsApp(selectedOrder)}
                          style={{
                            background: '#25D366',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                            transition: 'background-color 0.2s, transform 0.1s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#128C7E'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#25D366'}
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ display: 'block' }}>
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.805-9.801.001-2.618-1.02-5.08-2.875-6.936C16.347 2.012 13.882 1.02 11.272 1.02 5.867 1.02 1.468 5.418 1.465 10.825c-.001 1.562.41 3.09 1.194 4.437l-.993 3.626 3.72-.977c1.332.723 2.768 1.103 4.261 1.103zm10.455-7.464c-.282-.141-1.666-.822-1.925-.916-.259-.094-.447-.141-.635.141-.188.282-.729.916-.893 1.101-.165.185-.329.209-.611.069-.282-.141-1.192-.44-2.27-1.402-.839-.748-1.406-1.672-1.57-1.954-.165-.282-.018-.434.123-.574.127-.127.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.528-.87-2.093-.229-.553-.46-.477-.635-.487-.165-.008-.353-.01-.54-.01-.188 0-.494.071-.753.353-.259.282-.988.963-.988 2.348 0 1.385 1.008 2.724 1.15 2.912.141.188 1.984 3.029 4.806 4.244.671.29 1.196.463 1.604.593.674.214 1.288.184 1.773.111.54-.08 1.666-.68 1.901-1.338.235-.658.235-1.222.165-1.338-.071-.118-.259-.188-.541-.329z" />
                          </svg>
                          WhatsApp
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="details-label">Gender</p>
                      <p>{selectedOrder.gender}</p>
                    </div>
                    <div>
                      <p className="details-label">School</p>
                      <p>{selectedOrder.school}{selectedOrder.grade ? ` (Grade: ${selectedOrder.grade})` : ''}</p>
                    </div>
                    <div>
                      <p className="details-label">Delivery Date</p>
                      <p>{formatDateToDMY(selectedOrder.deliveryDate)}</p>
                    </div>
                    <div>
                      <p className="details-label">Amount</p>
                      <p>{selectedOrder.amount}</p>
                    </div>
                    <div>
                      <p className="details-label">Payment Status</p>
                      <p>
                        <span className={`payment-badge ${(selectedOrder.paymentStatus || 'Unpaid').toLowerCase()}`}>
                          {selectedOrder.paymentStatus || 'Unpaid'}
                        </span>
                      </p>
                    </div>
                    {selectedOrder.status === 'Delivered' && (
                      <div>
                        <p className="details-label">Auto-delete in</p>
                        <p>{computeTimeLeftDescription(selectedOrder.deliveredAt, selectedOrder.updatedAt, selectedOrder.createdAt)}</p>
                      </div>
                    )}
                    <div>
                      <p className="details-label">Contact Status</p>
                      {selectedOrder.status === 'Ready' ? (
                        <select
                          value={selectedOrder.contactStatus || 'Not contacted'}
                          onChange={(event) => updateContactStatus(selectedOrder._id, event.target.value)}
                        >
                          <option value="Not contacted">Not contacted</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Unable to contact">Unable to contact</option>
                        </select>
                      ) : (
                        <p>{selectedOrder.contactStatus || 'Not contacted'}</p>
                      )}
                    </div>
                    <div className="details-full">
                      <p className="details-label">Notes</p>
                      <p>{selectedOrder.notes || 'No notes available.'}</p>
                    </div>
                  </div>

                  <div className="details-full order-items-summary">
                    <p className="details-label">Ordered Items</p>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      <div className="order-items-list">
                        {selectedOrder.items.map((item, index) => (
                          <div key={index} className="order-item-card">
                            <div className="order-item-header">
                              <span className="item-badge">{item.itemType?.toUpperCase() || 'ITEM'}</span>
                              {getSleeveTag(item.itemType, item.measurements) && (
                                <span className="sleeve-badge-tag" style={{ marginLeft: '6px', fontSize: '11px', padding: '2px 6px', background: theme === 'dark' ? '#334155' : '#E2E8F0', color: theme === 'dark' ? '#f8fafc' : '#334155', borderRadius: '6px', fontWeight: 'bold' }}>
                                  ({getSleeveTag(item.itemType, item.measurements)})
                                </span>
                              )}
                              <div>
                                <p className="item-title">Item {index + 1}</p>
                                <p className="item-meta">Quantity: {item.quantity || 0}</p>
                              </div>
                            </div>
                            <div className="order-item-measurements">
                              {Object.entries(item.measurements || {})
                                .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
                                .map(([field, value]) => (
                                  <div key={field} className="measurement-row">
                                    <span>{field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                                    <span>{value}</span>
                                  </div>
                                ))}
                              {(!item.measurements || Object.values(item.measurements).every((value) => !String(value).trim())) && (
                                <p className="empty-measurements">No measurements provided.</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No items have been added for this order.</p>
                    )}
                  </div>
                </section>
              )}
            </section>
          )}

          {activePage === 'Production Queue' && (
            <section className="page-panel page-tailor-panel">
              {/* Filter bar container */}
              <div className="orders-toolbar tailor-toolbar">
                <div className="orders-search-bar">
                  <span className="topbar-search-icon">{getSafeEmoji('🔍')}</span>
                  <input
                    type="search"
                    placeholder="Search by order or customer..."
                    value={tailorSearchTerm}
                    onChange={(e) => setTailorSearchTerm(e.target.value)}
                  />
                </div>

                <div className="orders-toolbar-actions tailor-toolbar-actions" style={{ flexWrap: 'wrap', gap: '10px' }}>
                  <label className="orders-filter-select">
                    <span>Production Status</span>
                    <select value={tailorStatusFilter} onChange={(e) => setTailorStatusFilter(e.target.value)}>
                      <option value="All">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Ready">Ready</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </label>

                  <label className="orders-filter-select">
                    <span>Product</span>
                    <select value={tailorProductFilter} onChange={(e) => setTailorProductFilter(e.target.value)}>
                      <option value="All">All Products</option>
                      <option value="Shirt">Shirt</option>
                      <option value="Kurta">Kurta</option>
                      <option value="Top">Top</option>
                      <option value="Blazer">Blazer</option>
                      <option value="Coaty">Coaty</option>
                      <option value="Pant">Pant</option>
                      <option value="Shorts">Shorts</option>
                      <option value="Pajama">Pajama</option>
                      <option value="Pina">Pina</option>
                      <option value="Skirt">Skirt</option>
                      <option value="Frock">Frock</option>
                    </select>
                  </label>

                  <label className="orders-filter-select">
                    <span>Category</span>
                    <select value={tailorCategoryFilter} onChange={(e) => setTailorCategoryFilter(e.target.value)}>
                      <option value="All">All Categories</option>
                      {tailorAvailableCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="orders-filter-select">
                    <span>School</span>
                    <select value={tailorSchoolFilter} onChange={(e) => setTailorSchoolFilter(e.target.value)}>
                      <option value="All">All Schools</option>
                      {tailorAvailableSchools.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>

                  <label className="orders-filter-select">
                    <span>Delivery</span>
                    <select value={tailorDeliveryFilter} onChange={(e) => setTailorDeliveryFilter(e.target.value)}>
                      <option value="All">All Dates</option>
                      <option value="Today">Today</option>
                      <option value="Tomorrow">Tomorrow</option>
                      <option value="This Week">This Week</option>
                      <option value="This Month">This Month</option>
                      <option value="Custom">Custom Range</option>
                    </select>
                  </label>

                  {tailorDeliveryFilter === 'Custom' && (
                    <div className="custom-date-inputs" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="date"
                        value={tailorCustomStartDate}
                        onChange={(e) => setTailorCustomStartDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#64748B' }}>to</span>
                      <input
                        type="date"
                        value={tailorCustomEndDate}
                        onChange={(e) => setTailorCustomEndDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Export and Print Actions */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }} className="tailor-export-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => window.print()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px' }}
                  >
                    {getSafeEmoji('🖨️')} Print Table
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleSaveAsPDF}
                    disabled={exportingPDF}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px' }}
                  >
                    {exportingPDF ? `${getSafeEmoji('⌛')} Generating PDF...` : `${getSafeEmoji('📄')} Save as PDF`}
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={exportToCSV}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px' }}
                  >
                    {getSafeEmoji('📊')} Export Excel (CSV)
                  </button>
                </div>
              </div>

              {/* Production Cost Panel (Only shown when tailorStatusFilter is 'Pending') */}
              {tailorStatusFilter === 'Pending' && (
                <div className="card production-cost-panel" style={{
                  marginBottom: '24px',
                  padding: '18px 20px',
                  borderRadius: '20px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E5E7EB',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                  display: 'grid',
                  gridTemplateColumns: '220px minmax(0, 1fr)',
                  gap: '16px',
                  maxWidth: '100%',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  {/* Total Cost Block */}
                  <div style={{
                    background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
                    padding: '16px 18px',
                    borderRadius: '16px',
                    color: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px -5px rgba(37, 99, 235, 0.3)'
                  }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#E0E7FF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800' }}>
                      Total Production Cost
                    </h3>
                    <p style={{ margin: 0, fontSize: '28px', fontWeight: '900', letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ₹{productionCostDetails.totalCost.toLocaleString()}
                    </p>
                    <span style={{ marginTop: '4px', fontSize: '11px', color: '#C7D2FE', fontWeight: '600' }}>
                      {productionCostDetails.totalQty} pending garments ({productionCostDetails.activeCategories.length} categories active)
                    </span>
                  </div>

                  {/* Dynamic Category Cost Breakdown Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                    gap: '10px',
                    maxHeight: '135px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                    minWidth: 0,
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    {productionCostDetails.activeCategories.map(cat => (
                      <div key={cat.id} style={{
                        background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #E5E7EB',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3', minHeight: '28px' }} title={cat.name}>
                            {cat.name}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: theme === 'dark' ? '#94A3B8' : '#475569', marginTop: '1px', fontWeight: '500' }}>
                            ₹{cat.rate} / unit
                          </span>
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '17px', fontWeight: '800', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{cat.qty} pcs</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#38BDF8' : '#2563EB' }}>₹{cat.cost.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sortedTailorGarments.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }} className="tailor-export-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={scrollTailorToBottom}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px' }}
                  >
                    ▼ Go to Bottom
                  </button>
                </div>
              )}

              {/* Print-only Header */}
              <div className="print-only-header" style={{ display: 'none' }}>
                <h1 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#0F172A' }}>Liberty Uniform - Stitching Work Sheet</h1>
                <p style={{ fontSize: '13px', margin: '0 0 20px 0', color: '#475569' }}>
                  Generated on {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()} | Filtered by: Status ({tailorStatusFilter}), Product ({tailorProductFilter}), School ({tailorSchoolFilter})
                </p>
              </div>

              {/* Table */}
              <div className="table-panel">
                {sortedTailorGarments.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <p style={{ margin: 0, fontSize: '15px', color: '#64748B', fontWeight: '500' }}>
                      No pending garments found for the selected filters.
                    </p>
                  </div>
                ) : (
                  <>
<div className="table-wrap" ref={tailorTableWrapRef} style={{ maxHeight: '560px', overflow: 'auto' }}>
                      <table>
                        <thead>
                          <tr>

                            <th className="sortable-header" onClick={() => handleTailorSort('orderNumber')} style={{ cursor: 'pointer' }}>
                              Order # {tailorSortKey === 'orderNumber' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="sortable-header" onClick={() => handleTailorSort('product')} style={{ cursor: 'pointer' }}>
                              Product {tailorSortKey === 'product' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th style={{ width: '130px' }}>Category</th>
                            <th className="sortable-header" onClick={() => handleTailorSort('customerName')} style={{ cursor: 'pointer' }}>
                              Customer {tailorSortKey === 'customerName' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="sortable-header" onClick={() => handleTailorSort('school')} style={{ cursor: 'pointer' }}>
                              School {tailorSortKey === 'school' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th>Gender</th>
                            <th>Qty</th>
                            <th style={{ width: '150px' }}>Measurements</th>
                            <th style={{ minWidth: '100px' }}>Notes</th>
                            <th className="sortable-header" onClick={() => handleTailorSort('deliveryDate')} style={{ cursor: 'pointer' }}>
                              Delivery {tailorSortKey === 'deliveryDate' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th>Production Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTailorGarments.map((row) => (
                            <tr
                              key={row.uniqueRowId}
                              className={`clickable-row ${highlightedOrderId === row.orderId ? 'highlighted-row' : ''}`}
                              onClick={() => {
                                setSelectedOrder(row.order)
                                setHighlightedOrderId(row.orderId)
                                setShouldScrollToDetails(true)
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <td style={{ fontWeight: '600' }}>
                                <span>#{row.orderNumber}</span>
                              </td>
                              <td>
                                <span className={`product-tag ${row.product.toLowerCase()}`} style={{ whiteSpace: 'nowrap' }}>
                                  {row.product}
                                  {getSleeveTag(row.product, row.measurements) && (
                                    <span className="sleeve-badge-tag" style={{ marginLeft: '4px', fontSize: '9px', padding: '1px 4px', background: 'rgba(0,0,0,0.08)', color: 'inherit', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                      ({getSleeveTag(row.product, row.measurements)})
                                    </span>
                                  )}
                                </span>
                                <div className="portrait-print-product-tag" style={{ display: 'none' }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '8px', lineHeight: '1' }}>{row.product}</div>
                                  {getSleeveTag(row.product, row.measurements) && (
                                    <div style={{ fontSize: '7.5px', color: '#475569', marginTop: '2px', fontWeight: '600' }}>
                                      ({getSleeveTag(row.product, row.measurements)})
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div className="screen-only-category-select">
                                  <select
                                    value={row.productionCategory || ''}
                                    onChange={(e) => handleInlineCategoryChange(row, e.target.value)}
                                    style={{
                                      maxWidth: '130px'
                                    }}
                                  >
                                    <option value="">Select Category</option>
                                    {productionCategories.map(cat => (
                                      <option key={cat.id} value={cat.id}>
                                        {cat.name} (₹{(pricingRates && pricingRates[cat.id] !== undefined) ? pricingRates[cat.id] : cat.defaultRate})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <span className="print-landscape-only-category" style={{ display: 'none' }}>
                                  {(() => {
                                    const catVal = row.productionCategory || '';
                                    const catObj = productionCategories.find(c => c.id === catVal);
                                    return catObj ? `${catObj.name} (₹${pricingRates[catVal] !== undefined ? pricingRates[catVal] : catObj.defaultRate})` : (catVal || 'Uncategorized');
                                  })()}
                                </span>
                                <span className="print-portrait-only-category" style={{ display: 'none' }}>
                                  {(() => {
                                    const catVal = row.productionCategory || '';
                                    const catObj = productionCategories.find(c => c.id === catVal);
                                    return catObj ? `${catObj.name} (₹${pricingRates[catVal] !== undefined ? pricingRates[catVal] : catObj.defaultRate})` : (catVal || 'Uncategorized');
                                  })()}
                                </span>
                              </td>
                              <td style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>{row.customerName}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{row.school}</td>
                              <td>
                                <span className="screen-only-gender">{row.gender}</span>
                                <span className="print-only-gender">{row.gender === 'Female' ? 'F' : (row.gender === 'Male' ? 'M' : (row.gender || '-'))}</span>
                              </td>
                              <td style={{ fontWeight: '700' }}>{row.quantity}</td>
                              <td>{renderTailorMeasurements(row.product, row.measurements)}</td>
                              <td className="notes-cell" style={{ color: row.notes ? (theme === 'dark' ? '#cbd5e1' : '#334155') : '#94A3B8', fontSize: '13px' }}>
                                {row.notes || '-'}
                              </td>
                              <td style={{ color: '#E11D48', fontWeight: '600' }}>
                                <span className="screen-and-landscape-delivery">{formatDateToDMY(row.deliveryDate)}</span>
                                <span className="print-portrait-delivery" style={{ display: 'none' }}>
                                  {(() => {
                                    const d = new Date(row.deliveryDate);
                                    if (isNaN(d.getTime())) return '-';
                                    const day = String(d.getDate()).padStart(2, '0');
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const year = String(d.getFullYear()).slice(-2);
                                    return `${day}/${month}/${year}`;
                                  })()}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${row.status.toLowerCase()}`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="pagination-row">
                      <span>
                        Showing all {sortedTailorGarments.length} product rows
                      </span>
                      <button type="button" className="ghost-btn" onClick={scrollTailorToTop}>
                        ▲ Go to Top
                      </button>
                    </div>

                    {/* Print-only Footer Summary (only visible in print mode) */}
                    {tailorStatusFilter === 'Pending' && (
                      <div className="print-only-footer-summary" style={{ marginTop: '30px', borderTop: '2px solid #0F172A', paddingTop: '15px' }}>
                        <h3 style={{ fontSize: '15px', margin: '0 0 10px 0', color: '#0F172A', fontWeight: 'bold' }}>Production Cost Summary</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#0F172A' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #475569', textAlign: 'left', fontWeight: 'bold' }}>
                              <th style={{ padding: '6px 0', width: '40%' }}>Component</th>
                              <th style={{ padding: '6px 0', width: '20%' }}>Production Cost / Unit</th>
                              <th style={{ padding: '6px 0', width: '20%' }}>Number of Pieces</th>
                              <th style={{ padding: '6px 0', width: '20%', textAlign: 'right' }}>Total Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {productionCostDetails.activeCategories.map(cat => (
                              <tr key={cat.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '6px 0' }}>{cat.name}</td>
                                <td style={{ padding: '6px 0' }}>₹{cat.rate}</td>
                                <td style={{ padding: '6px 0' }}>{cat.qty}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{cat.cost.toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="total-row" style={{ fontWeight: 'bold', fontSize: '13px' }}>
                              <td style={{ padding: '10px 0' }}>Total Production Cost</td>
                              <td style={{ padding: '10px 0' }}></td>
                              <td style={{ padding: '10px 0' }}>{productionCostDetails.totalQty} pieces</td>
                              <td style={{ padding: '10px 0', textAlign: 'right' }}>₹{productionCostDetails.totalCost.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              {selectedOrder && (
                <section className="card card-panel details-panel" ref={detailsPanelRef}>
                  <div className="card-header space-between" style={{ position: 'relative' }}>
                    <div>
                      <p className="card-title">Selected Order Details</p>
                      {selectedOrder.createdAt && (
                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500', display: 'block', marginTop: '2px' }}>
                          Order Created: {formatDateToDMY(String(selectedOrder.createdAt).split('T')[0])}
                        </span>
                      )}
                    </div>
                    <span
                      className={`status-badge ${selectedOrder.status === 'Delivered' ? 'clickable' : ''} ${selectedOrder.status.toLowerCase()}`}
                      onClick={() => {
                        if (selectedOrder.status === 'Delivered') {
                          handleStatusTap(selectedOrder)
                        }
                      }}
                    >
                      {selectedOrder.status}
                    </span>

                    {timerAlertOrder && timerAlertOrder._id === selectedOrder._id && (
                      <div
                        className="timer-popup"
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: '24px',
                          transform: 'translateY(-4px)',
                          background: '#1E293B',
                          color: 'white',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                          zIndex: 100,
                          fontSize: '13px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          pointerEvents: 'none'
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-deletes in</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '700', color: '#38BDF8' }}>
                          {computeTimeLeftDescription(selectedOrder.deliveredAt, selectedOrder.updatedAt, selectedOrder.createdAt)}
                        </span>
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: '48px',
                          transform: 'translateX(50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: '6px solid #1E293B'
                        }} />
                      </div>
                    )}
                  </div>
                  <div className="details-grid">
                    <div>
                      <p className="details-label">Order No.</p>
                      <p>{selectedOrder.orderNumber}</p>
                    </div>
                    <div>
                      <p className="details-label">Customer</p>
                      <p>{selectedOrder.customerName}</p>
                    </div>
                    <div>
                      <p className="details-label">Contact</p>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{selectedOrder.contactNumber}</span>
                        <button
                          type="button"
                          className="whatsapp-btn"
                          onClick={() => handleSendWhatsApp(selectedOrder)}
                          style={{
                            background: '#25D366',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                            transition: 'background-color 0.2s, transform 0.1s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#128C7E'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#25D366'}
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ display: 'block' }}>
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.805-9.801.001-2.618-1.02-5.08-2.875-6.936C16.347 2.012 13.882 1.02 11.272 1.02 5.867 1.02 1.468 5.418 1.465 10.825c-.001 1.562.41 3.09 1.194 4.437l-.993 3.626 3.72-.977c1.332.723 2.768 1.103 4.261 1.103zm10.455-7.464c-.282-.141-1.666-.822-1.925-.916-.259-.094-.447-.141-.635.141-.188.282-.729.916-.893 1.101-.165.185-.329.209-.611.069-.282-.141-1.192-.44-2.27-1.402-.839-.748-1.406-1.672-1.57-1.954-.165-.282-.018-.434.123-.574.127-.127.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.528-.87-2.093-.229-.553-.46-.477-.635-.487-.165-.008-.353-.01-.54-.01-.188 0-.494.071-.753.353-.259.282-.988.963-.988 2.348 0 1.385 1.008 2.724 1.15 2.912.141.188 1.984 3.029 4.806 4.244.671.29 1.196.463 1.604.593.674.214 1.288.184 1.773.111.54-.08 1.666-.68 1.901-1.338.235-.658.235-1.222.165-1.338-.071-.118-.259-.188-.541-.329z" />
                          </svg>
                          WhatsApp
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="details-label">Gender</p>
                      <p>{selectedOrder.gender}</p>
                    </div>
                    <div>
                      <p className="details-label">School</p>
                      <p>{selectedOrder.school}{selectedOrder.grade ? ` (Grade: ${selectedOrder.grade})` : ''}</p>
                    </div>
                    <div>
                      <p className="details-label">Delivery Date</p>
                      <p>{formatDateToDMY(selectedOrder.deliveryDate)}</p>
                    </div>
                    <div>
                      <p className="details-label">Amount</p>
                      <p>{selectedOrder.amount}</p>
                    </div>
                    <div>
                      <p className="details-label">Payment Status</p>
                      <p>
                        <span className={`payment-badge ${(selectedOrder.paymentStatus || 'Unpaid').toLowerCase()}`}>
                          {selectedOrder.paymentStatus || 'Unpaid'}
                        </span>
                      </p>
                    </div>
                    {selectedOrder.status === 'Delivered' && (
                      <div>
                        <p className="details-label">Auto-delete in</p>
                        <p>{computeTimeLeftDescription(selectedOrder.deliveredAt, selectedOrder.updatedAt, selectedOrder.createdAt)}</p>
                      </div>
                    )}
                    <div>
                      <p className="details-label">Contact Status</p>
                      {selectedOrder.status === 'Ready' ? (
                        <select
                          value={selectedOrder.contactStatus || 'Not contacted'}
                          onChange={(event) => updateContactStatus(selectedOrder._id, event.target.value)}
                        >
                          <option value="Not contacted">Not contacted</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Unable to contact">Unable to contact</option>
                        </select>
                      ) : (
                        <p>{selectedOrder.contactStatus || 'Not contacted'}</p>
                      )}
                    </div>
                    <div className="details-full">
                      <p className="details-label">Notes</p>
                      <p>{selectedOrder.notes || 'No notes available.'}</p>
                    </div>
                  </div>

                  <div className="details-full order-items-summary">
                    <p className="details-label">Ordered Items</p>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      <div className="order-items-list">
                        {selectedOrder.items.map((item, index) => (
                          <div key={index} className="order-item-card">
                            <div className="order-item-header">
                              <span className="item-badge">{item.itemType?.toUpperCase() || 'ITEM'}</span>
                              {getSleeveTag(item.itemType, item.measurements) && (
                                <span className="sleeve-badge-tag" style={{ marginLeft: '6px', fontSize: '11px', padding: '2px 6px', background: theme === 'dark' ? '#334155' : '#E2E8F0', color: theme === 'dark' ? '#f8fafc' : '#334155', borderRadius: '6px', fontWeight: 'bold' }}>
                                  ({getSleeveTag(item.itemType, item.measurements)})
                                </span>
                              )}
                              <div>
                                <p className="item-title">Item {index + 1}</p>
                                <p className="item-meta">Quantity: {item.quantity || 0}</p>
                              </div>
                            </div>
                            <div className="order-item-measurements">
                              {Object.entries(item.measurements || {})
                                .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
                                .map(([field, value]) => (
                                  <div key={field} className="measurement-row">
                                    <span>{field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                                    <span>{value}</span>
                                  </div>
                                ))}
                              {(!item.measurements || Object.values(item.measurements).every((value) => !String(value).trim())) && (
                                <p className="empty-measurements">No measurements provided.</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No items have been added for this order.</p>
                    )}
                  </div>
                </section>
              )}
            </section>
          )}

          {activePage === 'Stock Waitlist' && (
            <section className="page-panel placeholder-panel">
              <div className="card card-panel placeholder-card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div className="card-header space-between" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                  <div>
                    <p className="card-title">Stock Waitlist Registry</p>
                    <p className="card-subtitle">Notify customers when out-of-stock sizes or accessories arrive.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handleOpenAddWaitlistModal}
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{getSafeEmoji('➕')}</span> Add Request
                  </button>
                </div>

                {/* Search & Filters */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  margin: '20px 24px 16px',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <div className="table-search" style={{ flex: 1, minWidth: '200px' }}>
                    <input
                      type="text"
                      placeholder={`${getSafeEmoji('🔍')} Search name, phone number, school or item...`}
                      value={waitlistSearch}
                      onChange={(e) => setWaitlistSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#94A3B8' : '#64748B' }}>Notification Status:</span>
                    <select
                      value={waitlistStatusFilter}
                      onChange={(e) => setWaitlistStatusFilter(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        minHeight: '34px',
                        background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                        color: 'inherit',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1'
                      }}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Notified">Notified</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#94A3B8' : '#64748B' }}>School:</span>
                    <select
                      value={waitlistSchoolFilter}
                      onChange={(e) => setWaitlistSchoolFilter(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        minHeight: '34px',
                        background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                        color: 'inherit',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1'
                      }}
                    >
                      <option value="All">All Schools</option>
                      {waitlistSchools.map((s) => (
                        <option key={s._id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="danger-btn" onClick={handleBulkDeleteWaitlist} disabled={selectedWaitlistIds.length === 0}>
                    Delete Selected{selectedWaitlistIds.length ? ` (${selectedWaitlistIds.length})` : ''}
                  </button>
                  {selectedWaitlistIds.length > 0 && (
                    <button type="button" className="ghost-btn" onClick={unselectAllWaitlist}>
                      Unselect All
                    </button>
                  )}
                </div>

                <div className="table-wrap" style={{ margin: '0 24px 24px', overflowX: 'auto' }}>
                  {loadingWaitlist ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading waitlist...</div>
                  ) : waitlist.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>No waitlist entries found.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color, #E5E7EB)' }}>
                            <input
                              type="checkbox"
                              checked={waitlist.length > 0 && waitlist.every((w) => selectedWaitlistIds.includes(w._id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedWaitlistIds(waitlist.map((w) => w._id))
                                } else {
                                  setSelectedWaitlistIds([])
                                }
                              }}
                            />
                          </th>
                          <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color, #E5E7EB)' }}>Customer</th>
                          <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color, #E5E7EB)' }}>School</th>
                          <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color, #E5E7EB)' }}>Requested Item</th>
                          <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color, #E5E7EB)' }}>Notes</th>
                          <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color, #E5E7EB)' }}>Notification Status</th>
                          <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--border-color, #E5E7EB)', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitlist.map((request) => (
                          <tr
                            key={request._id}
                            style={{
                              borderBottom: '1px solid var(--border-color, #E5E7EB)',
                              position: (timerAlertWaitlist && timerAlertWaitlist._id === request._id) ? 'relative' : 'static',
                              zIndex: (timerAlertWaitlist && timerAlertWaitlist._id === request._id) ? 10 : 'auto'
                            }}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <input
                                type="checkbox"
                                checked={selectedWaitlistIds.includes(request._id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectWaitlist(request._id)}
                              />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: '600' }}>{request.customerName}</div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>{request.contactNumber}</div>
                            </td>
                            <td style={{ padding: '12px 16px', color: (request.schools && request.schools.length > 0) ? 'inherit' : '#94A3B8' }}>
                              {(request.schools && request.schools.length > 0) ? request.schools.join(", ") : 'General'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {request.items && request.items.length > 0 ? (
                                <>
                                  <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                                    {request.items.map((item, idx) => (
                                      <li key={idx} style={{ marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: '500' }}>{item.name}</span>
                                          <span
                                            className={`status-badge ${item.status === 'Pending' ? 'pending' : 'ready'}`}
                                            style={{ fontSize: '10px', padding: '2px 6px', height: '18px', display: 'inline-flex', alignItems: 'center' }}
                                          >
                                            {item.status || 'Pending'}
                                          </span>

                                          <button
                                            type="button"
                                            disabled={item.status === 'Notified'}
                                            title={item.status === 'Notified' ? "Item already notified" : "Send WhatsApp for this item"}
                                            onClick={() => handleSendSingleWhatsAppNotification(request, idx)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: item.status === 'Notified' ? 'not-allowed' : 'pointer',
                                              fontSize: '11px',
                                              padding: '2px 4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              color: item.status === 'Notified' ? '#94A3B8' : '#10B981',
                                              fontWeight: '700',
                                              opacity: item.status === 'Notified' ? 0.6 : 1
                                            }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={item.status === 'Notified' ? "#94A3B8" : "#10B981"} style={{ verticalAlign: 'middle' }}>
                                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.49-3.99c1.657.982 3.585 1.502 5.547 1.503 5.714 0 10.364-4.65 10.368-10.366.002-2.772-1.077-5.378-3.037-7.338C17.466 2.25 14.86 1.17 12.088 1.17c-5.722 0-10.371 4.65-10.375 10.367a10.29 10.29 0 0 0 1.523 5.44L2.247 20.91l4.3-1.129-.001.001zM18.06 14.65c-.328-.164-1.94-.957-2.24-1.068-.3-.11-.518-.164-.737.164-.219.328-.847 1.068-1.038 1.286-.19.219-.382.246-.71.082a10.428 10.428 0 0 1-2.737-1.69 11.48 11.48 0 0 1-1.895-2.36c-.19-.328-.02-.507.143-.672.147-.148.328-.382.492-.574.164-.19.219-.328.328-.548.11-.219.055-.41-.027-.574-.082-.164-.737-1.777-1.01-2.435-.267-.643-.56-.553-.768-.564-.199-.01-.427-.01-.656-.01-.228 0-.6-.086-.913.256-.312.342-1.192 1.166-1.192 2.842 0 1.677 1.22 3.296 1.39 3.515.17.219 2.4 3.666 5.816 5.143.812.35 1.447.56 1.942.718.816.26 1.56.223 2.148.135.656-.098 1.94-.794 2.213-1.56.273-.767.273-1.423.19-1.56-.081-.137-.3-.22-.627-.383z" />
                                            </svg>
                                            Notify
                                          </button>
                                          <button
                                            type="button"
                                            title="Toggle status"
                                            onClick={() => handleToggleItemStatus(request, idx)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              fontSize: '11px',
                                              padding: '2px 4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              color: '#64748B'
                                            }}
                                          >
                                            {item.status === 'Pending' ? getSafeEmoji('✅') : getSafeEmoji('⏳')}
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                  {request.items.length > 1 && (
                                    <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color, #E5E7EB)', paddingTop: '8px' }}>
                                      {(() => {
                                        const pendingItems = request.items.filter(i => i.status !== 'Notified');
                                        const allAlreadyNotified = pendingItems.length === 0;
                                        const isAllPending = pendingItems.length === request.items.length;
                                        return (
                                          <button
                                            type="button"
                                            disabled={allAlreadyNotified}
                                            title={allAlreadyNotified ? "All items already notified" : (isAllPending ? "Notify all items together" : "Notify remaining items")}
                                            onClick={() => handleSendAllWhatsAppNotification(request)}
                                            style={{
                                              background: allAlreadyNotified ? '#E2E8F0' : '#10B981',
                                              border: 'none',
                                              borderRadius: '4px',
                                              color: allAlreadyNotified ? '#64748B' : '#FFFFFF',
                                              cursor: allAlreadyNotified ? 'not-allowed' : 'pointer',
                                              fontSize: '11px',
                                              padding: '4px 8px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              fontWeight: '700',
                                              opacity: allAlreadyNotified ? 0.6 : 1
                                            }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={allAlreadyNotified ? "#64748B" : "#FFFFFF"} style={{ verticalAlign: 'middle' }}>
                                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.49-3.99c1.657.982 3.585 1.502 5.547 1.503 5.714 0 10.364-4.65 10.368-10.366.002-2.772-1.077-5.378-3.037-7.338C17.466 2.25 14.86 1.17 12.088 1.17c-5.722 0-10.371 4.65-10.375 10.367a10.29 10.29 0 0 0 1.523 5.44L2.247 20.91l4.3-1.129-.001.001zM18.06 14.65c-.328-.164-1.94-.957-2.24-1.068-.3-.11-.518-.164-.737.164-.219.328-.847 1.068-1.038 1.286-.19.219-.382.246-.71.082a10.428 10.428 0 0 1-2.737-1.69 11.48 11.48 0 0 1-1.895-2.36c-.19-.328-.02-.507.143-.672.147-.148.328-.382.492-.574.164-.19.219-.328.328-.548.11-.219.055-.41-.027-.574-.082-.164-.737-1.777-1.01-2.435-.267-.643-.56-.553-.768-.564-.199-.01-.427-.01-.656-.01-.228 0-.6-.086-.913.256-.312.342-1.192 1.166-1.192 2.842 0 1.677 1.22 3.296 1.39 3.515.17.219 2.4 3.666 5.816 5.143.812.35 1.447.56 1.942.718.816.26 1.56.223 2.148.135.656-.098 1.94-.794 2.213-1.56.273-.767.273-1.423.19-1.56-.081-.137-.3-.22-.627-.383z" />
                                            </svg>
                                            {isAllPending ? "Notify All Items" : "Notify Remaining Items"}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span style={{ fontWeight: '500' }}>{request.itemDetails}</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>
                              {request.notes || '-'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {(() => {
                                const allNotified = request.items && request.items.length > 0 && request.items.every(i => i.status === 'Notified');
                                return (
                                  <div style={{ display: 'inline-block', position: 'relative' }}>
                                    <span
                                      className={`status-badge ${allNotified ? 'ready' : 'pending'}`}
                                    >
                                      {allNotified ? 'Notified' : 'Pending'}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="actions-cell">
                              <div className="actions-wrapper">
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Edit entry"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditWaitlistModal(request);
                                  }}
                                >
                                  {getSafeEmoji('✏️')}
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn danger"
                                  title="Delete entry"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWaitlistRequest(request._id, request.customerName);
                                  }}
                                >
                                  {getSafeEmoji('🗑️')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>
          )}

          {(activePage === 'Restock & Bulk Orders' || activePage === 'Supplier Restock') && (
            <section className="page-panel">
              {/* Landing Page: Two Big Cards */}
              {restockSubSection === null && (
                <div style={{ padding: '10px 0' }}>
                  <div style={{ marginBottom: '32px', textAlign: 'center', maxWidth: '650px', margin: '0 auto 32px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>
                      {getSafeEmoji('🏬')} Restock &amp; Bulk Orders Hub
                    </h2>
                    <p style={{ fontSize: '14px', color: theme === 'dark' ? '#94A3B8' : '#64748B', lineHeight: '1.5' }}>
                      Select a subsection below to manage manufacturing orders placed with suppliers or bulk uniform supply contracts taken from commercial clients.
                    </p>
                  </div>

                  <div className="restock-hub-grid">
                    {/* Card 1: Supplier Restock Orders */}
                    <div
                      onClick={() => setRestockSubSection('supplier')}
                      className="card"
                      style={{
                        padding: '28px 24px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        border: theme === 'dark' ? '2px solid #334155' : '2px solid #E2E8F0',
                        background: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                        transition: 'all 0.25s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#2563EB'
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(37,99,235,0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = theme === 'dark' ? '#334155' : '#E2E8F0'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                            {getSafeEmoji('🏬')}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', background: '#EFF6FF', color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Outbound Purchase Orders
                          </span>
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>
                          Supplier Restock Orders
                        </h3>
                        <p style={{ fontSize: '13px', color: theme === 'dark' ? '#94A3B8' : '#64748B', lineHeight: '1.5', marginBottom: '20px' }}>
                          Track manufacturing orders given to suppliers &amp; factories, size-wise stock installments, supplier accounts, and pending balances.
                        </p>
                      </div>
                      <div>
                        <div style={{ borderTop: theme === 'dark' ? '1px solid #1E293B' : '1px solid #F1F5F9', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB' }}>
                            {vendorOrders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length} Active Supplier POs
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Open Section &rarr;
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Corporate & Bulk Orders */}
                    <div
                      onClick={() => setRestockSubSection('corporate')}
                      className="card"
                      style={{
                        padding: '28px 24px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        border: theme === 'dark' ? '2px solid #334155' : '2px solid #E2E8F0',
                        background: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                        transition: 'all 0.25s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#059669'
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(5,150,105,0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = theme === 'dark' ? '#334155' : '#E2E8F0'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                            {getSafeEmoji('🏢')}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', background: '#ECFDF5', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Inbound Client Orders
                          </span>
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>
                          Corporate &amp; Bulk Orders
                        </h3>
                        <p style={{ fontSize: '13px', color: theme === 'dark' ? '#94A3B8' : '#64748B', lineHeight: '1.5', marginBottom: '20px' }}>
                          Take and manage bulk uniform supply contracts from firms, corporates, factories, schools, and commercial clients.
                        </p>
                      </div>
                      <div>
                        <div style={{ borderTop: theme === 'dark' ? '1px solid #1E293B' : '1px solid #F1F5F9', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>
                            {bulkOrders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length} Active Client COs
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Open Section &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Section 1: Supplier Restock Orders */}
              {restockSubSection === 'supplier' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setRestockSubSection(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px', fontWeight: '700' }}
                    >
                      &larr; Back to Restock &amp; Bulk Hub
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Subsection:</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', background: '#EFF6FF', color: '#2563EB', padding: '4px 12px', borderRadius: '6px' }}>
                        {getSafeEmoji('🏬')} Supplier Restock Orders
                      </span>
                    </div>
                  </div>
                  {/* Summary Metric Cards */}
                  {(() => {
                    const ordersForStats = vendorOrderPartyFilter === 'All'
                      ? vendorOrders
                      : vendorOrders.filter(o => o.partyName === vendorOrderPartyFilter)

                    return (
                      <div className="stats-grid grid-4" style={{ marginBottom: '24px' }}>
                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('🏬')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Active Restock POs</p>
                            <p className="stat-value">{ordersForStats.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length}</p>
                            <p className="stat-desc">
                              {vendorOrderPartyFilter === 'All' ? 'In-progress supplier orders' : `Active orders for ${vendorOrderPartyFilter}`}
                            </p>
                          </div>
                        </div>
                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('📦')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Total Ordered Pcs</p>
                            <p className="stat-value">
                              {ordersForStats.reduce((acc, o) => {
                                const prods = getNormalizedProducts(o)
                                let ord = 0
                                prods.forEach(p => {
                                  (p.sizeBreakdown || []).forEach(sb => { ord += (sb.orderedQty || 0) })
                                })
                                return acc + ord
                              }, 0)}
                            </p>
                            <p className="stat-desc">
                              {vendorOrderPartyFilter === 'All' ? 'Across all supplier orders' : `Total ordered from ${vendorOrderPartyFilter}`}
                            </p>
                          </div>
                        </div>
                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('⏳')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Pending Balance Pcs</p>
                            <p className="stat-value" style={{ color: '#EAB308' }}>
                              {ordersForStats.reduce((acc, o) => {
                                const prods = getNormalizedProducts(o)
                                let ord = 0, rec = 0
                                prods.forEach(p => {
                                  (p.sizeBreakdown || []).forEach(sb => {
                                    ord += (sb.orderedQty || 0)
                                    rec += (sb.receivedQty || 0)
                                  })
                                })
                                return acc + Math.max(0, ord - rec)
                              }, 0)}
                            </p>
                            <p className="stat-desc">
                              {vendorOrderPartyFilter === 'All' ? 'Awaiting arrival from suppliers' : `Pending arrival from ${vendorOrderPartyFilter}`}
                            </p>
                          </div>
                        </div>
                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('✅')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Received Stock Pcs</p>
                            <p className="stat-value" style={{ color: '#10B981' }}>
                              {ordersForStats.reduce((acc, o) => {
                                const prods = getNormalizedProducts(o)
                                let rec = 0
                                prods.forEach(p => {
                                  (p.sizeBreakdown || []).forEach(sb => { rec += (sb.receivedQty || 0) })
                                })
                                return acc + rec
                              }, 0)}
                            </p>
                            <p className="stat-desc">
                              {vendorOrderPartyFilter === 'All' ? 'Total stock arrived in shop' : `Stock received from ${vendorOrderPartyFilter}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Main Panel Card */}
                  <div className="card card-panel">
                    <div className="card-header space-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 className="card-title" style={{ color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{getSafeEmoji('🏬')} Supplier Restock & Orders</h2>
                        <p className="card-subtitle">Track bulk manufacturing orders, supplier details, and size-wise partial stock installments.</p>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => {
                            setSelectedVendorOrder(null)
                            const nextNum = getNextPoNumber(vendorOrders)
                            setVendorOrderFormData({
                              poNumber: String(nextNum),
                              partyName: '',
                              targetDate: '',
                              notes: '',
                              products: [
                                {
                                  productName: '',
                                  school: '',
                                  specifications: getDefaultSpecifications(),
                                  sizeBreakdown: [
                                    { size: '28', orderedQty: '' },
                                    { size: '30', orderedQty: '' },
                                    { size: '32', orderedQty: '' },
                                    { size: '34', orderedQty: '' },
                                    { size: '36', orderedQty: '' }
                                  ]
                                }
                              ]
                            })
                            setShowVendorOrderModal(true)
                          }}
                          style={{ padding: '0 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span>{getSafeEmoji('➕')}</span> New Restock PO
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => setShowPartyManagerModal(true)}
                          style={{ padding: '0 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {getSafeEmoji('🏭')} Manage Suppliers ({parties.length})
                        </button>
                      </div>
                    </div>

                    {/* Supplier Directory Hub Bar (Subsections Selector) */}
                    <div className="restock-section-margin">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#475569' }}>
                          Select Supplier Sub-section:
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPartyManagerModal(true)}
                          style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          {getSafeEmoji('⚙️')} Manage Supplier Profiles
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {/* All Suppliers Tab/Card */}
                        <div
                          onClick={() => setVendorOrderPartyFilter('All')}
                          style={{
                            minWidth: '160px',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            border: vendorOrderPartyFilter === 'All' ? '2px solid #2563EB' : '1px solid var(--border-color, #E2E8F0)',
                            background: vendorOrderPartyFilter === 'All' ? (theme === 'dark' ? '#1E293B' : '#EFF6FF') : (theme === 'dark' ? '#0F172A' : '#FFFFFF'),
                            boxShadow: vendorOrderPartyFilter === 'All' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ fontWeight: '800', fontSize: '13px', color: vendorOrderPartyFilter === 'All' ? '#2563EB' : 'inherit' }}>
                            {getSafeEmoji('🏬')} All Suppliers
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                            {parties.length} Registered Suppliers
                          </div>
                        </div>

                        {/* Individual Supplier Sub-section Cards */}
                        {parties.map(p => {
                          const isSelected = vendorOrderPartyFilter === p.name
                          const partyOrders = vendorOrders.filter(o => o.partyName === p.name)
                          let partyPendingPcs = 0
                          partyOrders.forEach(o => {
                            const prods = getNormalizedProducts(o)
                            prods.forEach(pr => {
                              (pr.sizeBreakdown || []).forEach(sb => {
                                partyPendingPcs += Math.max(0, (sb.orderedQty || 0) - (sb.receivedQty || 0))
                              })
                            })
                          })

                          return (
                            <div
                              key={p._id}
                              onClick={() => setVendorOrderPartyFilter(p.name)}
                              style={{
                                minWidth: '180px',
                                padding: '12px 14px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                border: isSelected ? '2px solid #2563EB' : '1px solid var(--border-color, #E2E8F0)',
                                background: isSelected ? (theme === 'dark' ? '#1E293B' : '#EFF6FF') : (theme === 'dark' ? '#0F172A' : '#FFFFFF'),
                                boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ fontWeight: '800', fontSize: '13px', color: isSelected ? '#2563EB' : 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{getSafeEmoji('🏭')} {p.name}</span>
                                {isSelected && <span style={{ fontSize: '10px', background: '#2563EB', color: '#FFF', padding: '2px 6px', borderRadius: '10px' }}>Active</span>}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                {p.contactNumber ? `📞 ${p.contactNumber}` : 'No phone logged'}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: '700', marginTop: '6px', color: partyPendingPcs > 0 ? '#D97706' : '#10B981' }}>
                                {partyPendingPcs > 0 ? `Pending: ${partyPendingPcs} pcs` : 'No Pending Stock'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Filter Controls */}
                    <div className="restock-section-margin">
                      {/* Premium Gold-Standard Search Bar */}
                      <form onSubmit={(e) => e.preventDefault()} style={{ marginBottom: '14px' }}>
                        <div
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                            borderRadius: '10px',
                            border: vendorOrderSearchFocused
                              ? '1px solid #2563EB'
                              : `1px solid ${theme === 'dark' ? '#334155' : '#CBD5E1'}`,
                            boxShadow: vendorOrderSearchFocused
                              ? '0 0 0 3px rgba(37, 99, 235, 0.2)'
                              : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span style={{ position: 'absolute', left: '14px', color: vendorOrderSearchFocused ? '#2563EB' : '#94A3B8', fontSize: '15px', pointerEvents: 'none', transition: 'color 0.2s' }}>
                            {getSafeEmoji('🔍')}
                          </span>
                          <input
                            ref={poSearchInputRef}
                            type="text"
                            placeholder="Search PO#, Product, Size, Notes or Date..."
                            value={vendorOrderSearch}
                            onFocus={() => setVendorOrderSearchFocused(true)}
                            onBlur={() => setVendorOrderSearchFocused(false)}
                            onChange={(e) => setVendorOrderSearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                            style={{
                              width: '100%',
                              padding: '10px 70px 10px 38px',
                              fontSize: '13px',
                              fontWeight: '500',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
                              borderRadius: '10px'
                            }}
                          />
                          <div style={{ position: 'absolute', right: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {vendorOrderSearch ? (
                              <button
                                type="button"
                                onClick={() => setVendorOrderSearch('')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94A3B8',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Clear search (Esc)"
                              >
                                {getSafeEmoji('✕')}
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', background: theme === 'dark' ? '#0F172A' : '#F1F5F9', border: '1px solid var(--border-color, #CBD5E1)', padding: '2px 6px', borderRadius: '4px' }}>
                                ⌘K
                              </span>
                            )}
                          </div>
                        </div>
                      </form>
                      {/* Filter Dropdowns Row */}
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: theme === 'dark' ? '#94A3B8' : '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Filter</span>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#374151', whiteSpace: 'nowrap' }}>Supplier</span>
                            <select
                              value={vendorOrderPartyFilter}
                              onChange={(e) => setVendorOrderPartyFilter(e.target.value)}
                              style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`, fontSize: '13px', background: theme === 'dark' ? '#1E293B' : '#FFFFFF', color: 'inherit', fontWeight: '500', cursor: 'pointer' }}
                            >
                              <option value="All">All Suppliers ({parties.length})</option>
                              {parties.map(p => (
                                <option key={p._id} value={p.name}>{p.name}</option>
                              ))}
                            </select>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#374151', whiteSpace: 'nowrap' }}>School / Firm</span>
                            <select
                              value={vendorOrderSchoolFilter}
                              onChange={(e) => setVendorOrderSchoolFilter(e.target.value)}
                              style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`, fontSize: '13px', background: theme === 'dark' ? '#1E293B' : '#FFFFFF', color: 'inherit', fontWeight: '500', cursor: 'pointer' }}
                            >
                              <option value="All">All Schools / Firms</option>
                              {Array.from(new Set(vendorOrders.flatMap(o => getNormalizedProducts(o).map(p => p.school)).filter(Boolean))).sort().map(school => (
                                <option key={school} value={school}>{school}</option>
                              ))}
                            </select>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#374151', whiteSpace: 'nowrap' }}>Status</span>
                            <select
                              value={vendorOrderStatusFilter}
                              onChange={(e) => setVendorOrderStatusFilter(e.target.value)}
                              style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`, fontSize: '13px', background: theme === 'dark' ? '#1E293B' : '#FFFFFF', color: 'inherit', fontWeight: '500', cursor: 'pointer' }}
                            >
                              <option value="All">All Statuses</option>
                              <option value="Pending">Pending</option>
                              <option value="Partial">Partial</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </label>
                        </div>

                        {/* Live PO Counter Pill */}
                        {(() => {
                          const tempFiltered = vendorOrders.filter(o => {
                            if (vendorOrderPartyFilter !== 'All' && o.partyName !== vendorOrderPartyFilter) return false
                            if (vendorOrderStatusFilter !== 'All' && o.status !== vendorOrderStatusFilter) return false
                            if (vendorOrderSchoolFilter !== 'All') {
                              const prods = getNormalizedProducts(o)
                              if (!prods.some(p => p.school === vendorOrderSchoolFilter)) return false
                            }
                            if (vendorOrderSearch && vendorOrderSearch.trim()) {
                              const prods = getNormalizedProducts(o)
                              const sizes = prods.flatMap(p => (p.sizeBreakdown || []).map(sb => `Size ${sb.size} ${sb.size}`))
                              const dates = [
                                o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '',
                                o.targetDate || '',
                                ...(o.installments || []).map(i => i.receivedAt ? new Date(i.receivedAt).toLocaleDateString() : '')
                              ]
                              const fields = [
                                o.poNumber,
                                o.notes,
                                ...(prods.map(p => p.productName)),
                                ...sizes,
                                ...dates
                              ]
                              return checkFuzzyMatch(vendorOrderSearch, fields)
                            }
                            return true
                          })
                          return (
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                padding: '5px 12px',
                                borderRadius: '20px',
                                background: theme === 'dark' ? '#0F172A' : '#EFF6FF',
                                color: theme === 'dark' ? '#38BDF8' : '#0284C7',
                                border: theme === 'dark' ? '1px solid #0284C7' : '1px solid #BAE6FD',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Showing {tempFiltered.length} of {vendorOrders.length} POs
                            </span>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Orders List View */}
                    <div className="table-wrap" style={{ margin: '0 24px 24px', overflowX: 'auto' }}>
                      {(() => {
                        const filteredOrders = vendorOrders.filter(o => {
                          if (vendorOrderPartyFilter !== 'All' && o.partyName !== vendorOrderPartyFilter) return false
                          if (vendorOrderStatusFilter !== 'All' && o.status !== vendorOrderStatusFilter) return false
                          if (vendorOrderSchoolFilter !== 'All') {
                            const prods = getNormalizedProducts(o)
                            if (!prods.some(p => p.school === vendorOrderSchoolFilter)) return false
                          }
                          if (vendorOrderSearch && vendorOrderSearch.trim()) {
                            const prods = getNormalizedProducts(o)
                            const sizes = prods.flatMap(p => (p.sizeBreakdown || []).map(sb => `Size ${sb.size} ${sb.size}`))
                            const dates = [
                              o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '',
                              o.targetDate || '',
                              ...(o.installments || []).map(i => i.receivedAt ? new Date(i.receivedAt).toLocaleDateString() : '')
                            ]
                            const fields = [
                              o.poNumber,
                              o.notes,
                              ...(prods.map(p => p.productName)),
                              ...sizes,
                              ...dates
                            ]
                            return checkFuzzyMatch(vendorOrderSearch, fields)
                          }
                          return true
                        })

                        // Sort POs ascending (lower PO numbers above, increasing as we go down)
                        filteredOrders.sort((a, b) => {
                          const numA = parseInt(String(a.poNumber || '').replace(/\D/g, ''), 10) || 0
                          const numB = parseInt(String(b.poNumber || '').replace(/\D/g, ''), 10) || 0
                          if (numA !== numB) return numA - numB
                          return String(a.poNumber || '').localeCompare(String(b.poNumber || ''), undefined, { numeric: true, sensitivity: 'base' })
                        })

                        if (loadingVendorOrders) {
                          return <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading supplier restock orders...</div>
                        }

                        if (filteredOrders.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                              No supplier restock orders found for this view. Click "+ New Restock PO" above to place a new order!
                            </div>
                          )
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredOrders.map((order) => {
                              const prods = getNormalizedProducts(order)
                              let totalOrdered = 0
                              let totalReceived = 0
                              let pendingBalance = 0
                              let poTotalCost = 0
                              let poHasAnyPrices = false

                              prods.forEach(p => {
                                (p.sizeBreakdown || []).forEach(sb => {
                                  // Per-size price (new) takes priority; fall back to product-level price (legacy)
                                  const sbPrice = Number(sb.unitPrice || 0) || Number(p.unitPrice || 0)
                                  if (sbPrice > 0) {
                                    poTotalCost += (sb.receivedQty || 0) * sbPrice
                                    poHasAnyPrices = true
                                  }
                                  const ord = sb.orderedQty || 0
                                  const rec = sb.receivedQty || 0
                                  totalOrdered += ord
                                  totalReceived += rec
                                  if (rec < ord) {
                                    pendingBalance += (ord - rec)
                                  }
                                })
                              })
                              const progressPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0

                              let daysLeftForDeletion = null
                              let completedDateStr = ''
                              let expiryDateStr = ''
                              if (order.status === 'Completed') {
                                const completedTime = order.completedAt ? new Date(order.completedAt).getTime() : new Date(order.updatedAt || order.createdAt).getTime()
                                const expiryTime = completedTime + (90 * 24 * 60 * 60 * 1000)
                                const msDiff = expiryTime - Date.now()
                                daysLeftForDeletion = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)))
                                completedDateStr = new Date(completedTime).toLocaleDateString()
                                expiryDateStr = new Date(expiryTime).toLocaleDateString()
                              }

                              return (
                                <div
                                  key={order._id}
                                  style={{
                                    border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    background: theme === 'dark' ? '#1E293B' : '#F8FAFC'
                                  }}
                                >
                                  {/* Card Top Header */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: '800', fontSize: '15px', color: '#2563EB' }}>{order.poNumber}</span>
                                        <span style={{ fontWeight: '700', fontSize: '15px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>Supplier: {order.partyName}</span>
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span>Products: <strong>{prods.length}</strong></span>
                                        {order.targetDate && <span>Target Date: <strong>{order.targetDate}</strong></span>}
                                        <span>Created: <strong>{new Date(order.createdAt).toLocaleDateString()}</strong></span>
                                        <span style={{ fontWeight: '700', color: poHasAnyPrices ? (theme === 'dark' ? '#34D399' : '#059669') : '#64748B' }}>
                                          Total PO Value: <strong>{poHasAnyPrices ? `₹${poTotalCost.toLocaleString('en-IN')}` : '-'}</strong>
                                        </span>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span className={`status-badge ${order.status === 'Completed' ? 'ready' : order.status === 'Partial' ? 'partial' : order.status === 'Cancelled' ? 'delivered' : 'pending'}`}>
                                        {order.status === 'Completed' ? `Completed (${progressPct}%)` : order.status === 'Partial' ? `Partial (${progressPct}%)` : order.status}
                                      </span>

                                      {order.status === 'Completed' && (
                                        <span
                                          title={`Completed on ${completedDateStr}. Scheduled for auto-deletion on ${expiryDateStr}`}
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            background: theme === 'dark' ? '#312E81' : '#F3E8FF',
                                            color: theme === 'dark' ? '#C084FC' : '#7E22CE',
                                            border: theme === 'dark' ? '1px solid #6B21A8' : '1px solid #E9D5FF'
                                          }}
                                        >
                                          {getSafeEmoji('⏱️')} Auto-deletes in {daysLeftForDeletion} {daysLeftForDeletion === 1 ? 'day' : 'days'}
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        className="primary-btn"
                                        onClick={() => handleOpenInstallmentModal(order)}
                                        disabled={order.status === 'Completed' || order.status === 'Cancelled'}
                                        style={{
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          borderRadius: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          background: order.status === 'Completed' ? (theme === 'dark' ? '#334155' : '#E2E8F0') : '#2563EB',
                                          color: order.status === 'Completed' ? (theme === 'dark' ? '#94A3B8' : '#475569') : '#FFFFFF',
                                          border: order.status === 'Completed' ? (theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1') : '1px solid #2563EB',
                                          cursor: order.status === 'Completed' ? 'not-allowed' : 'pointer',
                                          fontWeight: '700'
                                        }}
                                        title={order.status === 'Completed' ? 'All stock received for this order' : 'Receive stock batch for this order'}
                                      >
                                        {getSafeEmoji('➕')} {order.status === 'Completed' ? 'All Received' : 'Receive Stock'}
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        title="Edit PO details"
                                        onClick={() => {
                                          setSelectedVendorOrder(order)
                                          setVendorOrderFormData({
                                            poNumber: order.poNumber ? String(order.poNumber).replace(/^PO-0*/i, '') : '',
                                            partyName: order.partyName,
                                            targetDate: order.targetDate || '',
                                            notes: order.notes || '',
                                            products: prods.map(p => ({
                                              productName: p.productName,
                                              school: p.school,
                                              specifications: getNormalizedSpecifications(p),
                                              sizeBreakdown: (p.sizeBreakdown || []).map(sb => ({ size: sb.size, orderedQty: sb.orderedQty, unitPrice: sb.unitPrice !== undefined ? sb.unitPrice : '' }))
                                            }))
                                          })
                                          setShowVendorOrderModal(true)
                                        }}
                                      >
                                        {getSafeEmoji('✏️')}
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-btn danger"
                                        title="Delete PO"
                                        onClick={() => handleDeleteVendorOrder(order._id, order.poNumber)}
                                      >
                                        {getSafeEmoji('🗑️')}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Export Actions Row */}
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
                                    background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(37,99,235,0.03)',
                                    borderRadius: '0 0 10px 10px',
                                    flexWrap: 'wrap'
                                  }}>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: theme === 'dark' ? '#94A3B8' : '#64748B', marginRight: '2px' }}>Export:</span>
                                    <button
                                      type="button"
                                      onClick={() => exportVendorOrderCSV(order)}
                                      style={{
                                        background: '#2563EB',
                                        color: '#FFFFFF',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '5px 13px',
                                        fontSize: '11.5px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 4px rgba(37,99,235,0.25)',
                                        transition: 'all 0.2s ease'
                                      }}
                                      title="Export Excel (CSV) Spreadsheet"
                                    >
                                      <span style={{ fontSize: '13px' }}>{getSafeEmoji('📊')}</span>
                                      Export Excel (CSV)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPOPDFModal(order)}
                                      style={{
                                        background: theme === 'dark' ? '#1E293B' : '#F1F5F9',
                                        color: theme === 'dark' ? '#E2E8F0' : '#334155',
                                        border: theme === 'dark' ? '1px solid #334155' : '1px solid #CBD5E1',
                                        borderRadius: '16px',
                                        padding: '5px 13px',
                                        fontSize: '11.5px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                      }}
                                      title="Configure and Save as PDF"
                                    >
                                      <span style={{ fontSize: '13px' }}>{getSafeEmoji('📄')}</span>
                                      Save as PDF
                                    </button>
                                  </div>

                                  {/* Prominent Order Notes Callout Banner */}
                                  {order.notes && (
                                    <div
                                      style={{
                                        margin: '10px 0 14px 0',
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        background: theme === 'dark' ? '#1E293B' : '#FEF3C7',
                                        border: theme === 'dark' ? '1px solid #D97706' : '1px solid #FCD34D',
                                        color: theme === 'dark' ? '#FDE68A' : '#92400E',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        fontWeight: '600',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                        wordBreak: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: '1.5'
                                      }}
                                    >
                                      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '2px' }}>{getSafeEmoji('📝')}</span>
                                      <div style={{ flex: 1 }}>
                                        <strong style={{ color: theme === 'dark' ? '#FBBF24' : '#B45309' }}>PO Special Instructions / Note:</strong> {order.notes}
                                      </div>
                                    </div>
                                  )}

                                  {/* Overall Progress Bar */}
                                  <div style={{ margin: '12px 0 16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                                      <span>Stock Received Progress: {totalReceived} / {totalOrdered} pcs ({progressPct}%)</span>
                                      <span style={{ color: pendingBalance > 0 ? '#EAB308' : '#10B981' }}>
                                        {pendingBalance > 0 ? `Pending: ${pendingBalance} pcs` : 'All Stock Received'}
                                      </span>
                                    </div>
                                    <div style={{ height: '8px', width: '100%', background: theme === 'dark' ? '#334155' : '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          height: '100%',
                                          width: `${progressPct}%`,
                                          background: progressPct === 100 ? '#10B981' : progressPct > 0 ? '#EAB308' : '#94A3B8',
                                          borderRadius: '4px',
                                          transition: 'width 0.3s ease'
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Size Breakdown Tables Per Product */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {prods.map((prod, pIdx) => {
                                      const sortedSizes = sortSizesAscending(prod.sizeBreakdown || [])
                                      const legacyPrice = Number(prod.unitPrice || 0)
                                      let totalProdOrdered = 0
                                      let totalProdReceived = 0
                                      let totalProdPending = 0
                                      let totalProdCost = 0

                                      sortedSizes.forEach(sb => {
                                        const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
                                        totalProdOrdered += (sb.orderedQty || 0)
                                        totalProdReceived += (sb.receivedQty || 0)
                                        totalProdPending += Math.max(0, (sb.orderedQty || 0) - (sb.receivedQty || 0))
                                        totalProdCost += sbPrice > 0 ? (sb.receivedQty || 0) * sbPrice : 0
                                      })
                                      const totalProdPct = totalProdOrdered > 0 ? Math.round((totalProdReceived / totalProdOrdered) * 100) : 0

                                      return (
                                        <div key={pIdx} style={{ background: theme === 'dark' ? '#0F172A' : '#FFFFFF', borderRadius: '8px', padding: '14px 16px', border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div>
                                              <div style={{ fontSize: '13px', fontWeight: '800', color: theme === 'dark' ? '#38BDF8' : '#0284C7', marginBottom: '4px' }}>
                                                Product {pIdx + 1} &mdash; {prod.productName}
                                              </div>
                                              {prod.school && (
                                                <div style={{ fontSize: '12px', color: theme === 'dark' ? '#94A3B8' : '#64748B' }}>
                                                  School / Firm: <strong style={{ color: theme === 'dark' ? '#F1F5F9' : '#0F172A', fontWeight: '700' }}>{prod.school}</strong>
                                                </div>
                                              )}
                                              {/* Specifications */}
                                              {getNormalizedSpecifications(prod).filter(s => s.value && String(s.value).trim()).length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                                  {getNormalizedSpecifications(prod).filter(s => s.value && String(s.value).trim()).map((spec, si) => (
                                                    <span key={si} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: theme === 'dark' ? '#1E3A5F' : '#EFF6FF', color: theme === 'dark' ? '#93C5FD' : '#1D4ED8', border: '1px solid #BFDBFE', fontWeight: '600' }}>
                                                      <strong>{spec.label}:</strong> {spec.value}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>

                                            {totalProdCost > 0 && (
                                              <div style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#34D399' : '#059669' }}>
                                                Total Product Cost: ₹{totalProdCost.toLocaleString('en-IN')}
                                              </div>
                                            )}
                                          </div>
                                          <div className="restock-table-scroll-container">
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                              <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-color, #E5E7EB)', color: '#64748B', textAlign: 'left' }}>
                                                  <th style={{ padding: '8px 16px 8px 8px', whiteSpace: 'nowrap', minWidth: '100px' }}>Size</th>
                                                  <th style={{ padding: '8px 16px 8px 8px', whiteSpace: 'nowrap', minWidth: '120px' }}>Cost / Unit</th>
                                                  <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Ordered</th>
                                                  <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Received</th>
                                                  <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Pending</th>
                                                  <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Row Cost</th>
                                                  <th style={{ padding: '8px 8px 8px 8px', whiteSpace: 'nowrap', minWidth: '100px' }}>Fulfillment</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {sortedSizes.map((sb) => {
                                                  const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
                                                  const recQty = sb.receivedQty || 0
                                                  const ordQty = sb.orderedQty || 0
                                                  const pending = Math.max(0, ordQty - recQty)
                                                  const surplus = recQty > ordQty ? recQty - ordQty : 0
                                                  const rowCost = sbPrice > 0 ? recQty * sbPrice : 0
                                                  const sizePct = ordQty > 0 ? Math.round((recQty / ordQty) * 100) : 0
                                                  return (
                                                    <tr key={sb.size} style={{ borderBottom: '1px dashed var(--border-color, #F1F5F9)' }}>
                                                      <td style={{ padding: '8px 16px 8px 8px', fontWeight: '700', whiteSpace: 'nowrap', minWidth: '100px' }}>{sb.size}</td>
                                                      <td style={{ padding: '8px 16px 8px 8px', color: theme === 'dark' ? '#34D399' : '#059669', fontWeight: '600', whiteSpace: 'nowrap', minWidth: '120px' }}>
                                                        {sbPrice > 0 ? `₹${sbPrice.toLocaleString('en-IN')}` : '-'}
                                                      </td>
                                                      <td style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>{ordQty} pcs</td>
                                                      <td style={{ padding: '8px 12px 8px 8px', color: '#10B981', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                        {recQty} pcs
                                                        {surplus > 0 && (
                                                          <span style={{ marginLeft: '6px', fontSize: '11px', background: theme === 'dark' ? '#064E3B' : '#D1FAE5', color: theme === 'dark' ? '#34D399' : '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                                            (+{surplus} Extra)
                                                          </span>
                                                        )}
                                                      </td>
                                                      <td style={{ padding: '8px 12px 8px 8px', color: pending > 0 ? '#EAB308' : '#10B981', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                        {pending > 0 ? `${pending} pcs` : 'Done'}
                                                      </td>
                                                      <td style={{ padding: '8px 12px 8px 8px', color: theme === 'dark' ? '#34D399' : '#059669', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                        {rowCost > 0 ? `₹${rowCost.toLocaleString('en-IN')}` : '-'}
                                                      </td>
                                                      <td style={{ padding: '6px 8px', minWidth: '100px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                          <div style={{ flex: 1, height: '6px', background: theme === 'dark' ? '#334155' : '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${sizePct}%`, background: sizePct === 100 ? '#10B981' : '#3B82F6', borderRadius: '3px' }} />
                                                          </div>
                                                          <span style={{ fontSize: '10px', width: '32px', textAlign: 'right' }}>{sizePct}%</span>
                                                        </div>
                                                      </td>
                                                    </tr>
                                                  )
                                                })}
                                              </tbody>
                                              <tfoot style={{ borderTop: '2px solid var(--border-color, #CBD5E1)', fontWeight: '800', background: theme === 'dark' ? '#1E293B' : '#F8FAFC' }}>
                                                <tr>
                                                  <td style={{ padding: '8px 16px 8px 8px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A', whiteSpace: 'nowrap', minWidth: '100px' }}>Total</td>
                                                  <td style={{ padding: '8px 16px 8px 8px', color: theme === 'dark' ? '#94A3B8' : '#64748B', whiteSpace: 'nowrap', minWidth: '120px' }}>-</td>
                                                  <td style={{ padding: '8px 12px 8px 8px', color: '#2563EB', whiteSpace: 'nowrap' }}>{totalProdOrdered} pcs</td>
                                                  <td style={{ padding: '8px 12px 8px 8px', color: '#10B981', whiteSpace: 'nowrap' }}>
                                                    {totalProdReceived} pcs
                                                    {totalProdReceived > totalProdOrdered && (
                                                      <span style={{ marginLeft: '4px', fontSize: '11px', color: theme === 'dark' ? '#34D399' : '#047857', fontWeight: '700' }}>
                                                        (+{totalProdReceived - totalProdOrdered} Extra)
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td style={{ padding: '8px 12px 8px 8px', color: totalProdPending > 0 ? '#EAB308' : '#10B981', whiteSpace: 'nowrap' }}>
                                                    {totalProdPending > 0 ? `${totalProdPending} pcs` : 'Done'}
                                                  </td>
                                                  <td style={{ padding: '8px 12px 8px 8px', color: theme === 'dark' ? '#34D399' : '#059669', whiteSpace: 'nowrap' }}>
                                                    {totalProdCost > 0 ? `₹${totalProdCost.toLocaleString('en-IN')}` : '-'}
                                                  </td>
                                                  <td style={{ padding: '6px 8px', minWidth: '100px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                      <div style={{ flex: 1, height: '6px', background: theme === 'dark' ? '#334155' : '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${totalProdPct}%`, background: totalProdPct === 100 ? '#10B981' : '#3B82F6', borderRadius: '3px' }} />
                                                      </div>
                                                      <span style={{ fontSize: '11px', width: '32px', textAlign: 'right', fontWeight: '800' }}>{totalProdPct}%</span>
                                                    </div>
                                                  </td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Received Installment History Log Timeline */}
                                  {order.installments && order.installments.length > 0 && (
                                    <div style={{ marginTop: '16px', borderTop: '1px dashed var(--border-color, #CBD5E1)', paddingTop: '14px' }}>
                                      <div style={{ fontSize: '13px', fontWeight: '800', color: theme === 'dark' ? '#38BDF8' : '#0284C7', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{getSafeEmoji('📦')}</span> Received Installment History ({order.installments.length} {order.installments.length === 1 ? 'Batch' : 'Batches'}):
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {order.installments.map((inst, idx) => {
                                          const batchTotal = (inst.items || []).reduce((s, i) => s + (i.qty || 0), 0)
                                          return (
                                            <div
                                              key={inst._id || idx}
                                              style={{
                                                background: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                                                padding: '12px 16px',
                                                borderRadius: '10px',
                                                border: theme === 'dark' ? '1px solid #334155' : '1px solid #CBD5E1',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                flexWrap: 'wrap'
                                              }}
                                            >
                                              <div style={{ flex: 1, minWidth: '240px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                  <span style={{ fontWeight: '800', fontSize: '13px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>
                                                    Batch #{idx + 1} ({new Date(inst.receivedAt).toLocaleDateString()})
                                                  </span>
                                                  <span
                                                    style={{
                                                      fontSize: '12px',
                                                      fontWeight: '800',
                                                      padding: '2px 8px',
                                                      borderRadius: '6px',
                                                      background: theme === 'dark' ? '#064E3B' : '#D1FAE5',
                                                      color: theme === 'dark' ? '#34D399' : '#059669',
                                                      border: theme === 'dark' ? '1px solid #059669' : '1px solid #6EE7B7'
                                                    }}
                                                  >
                                                    Received {batchTotal} pcs
                                                  </span>
                                                </div>

                                                <div style={{ fontSize: '12px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#374151', lineHeight: '1.4' }}>
                                                  {(inst.items || []).map(i => `${i.productName ? i.productName + ' ' : ''}Size ${i.size}: ${i.qty}pcs`).join(' • ')}
                                                </div>

                                                {inst.notes && (
                                                  <div style={{ color: '#2563EB', fontWeight: '600', marginTop: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span>📝</span> Note: {inst.notes}
                                                  </div>
                                                )}
                                              </div>

                                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <button
                                                  type="button"
                                                  className="icon-btn"
                                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                                  title="Edit Installment Batch"
                                                  onClick={() => handleOpenEditInstallment(order, inst)}
                                                >
                                                  {getSafeEmoji('✏️')}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="icon-btn danger"
                                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                                  title="Delete Installment Batch"
                                                  onClick={() => handleDeleteInstallment(order, inst._id)}
                                                >
                                                  {getSafeEmoji('🗑️')}
                                                </button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Section 2: Corporate & Bulk Orders */}
              {restockSubSection === 'corporate' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setRestockSubSection(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px', fontWeight: '700' }}
                    >
                      &larr; Back to Restock &amp; Bulk Hub
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Subsection:</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '6px' }}>
                        {getSafeEmoji('🏢')} Bulk Client Orders
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  {(() => {
                    const ordersForStats = bulkOrderClientFilter === 'All'
                      ? bulkOrders
                      : bulkOrders.filter(o => o.clientName === bulkOrderClientFilter)

                    return (
                      <div className="stats-grid grid-4" style={{ marginBottom: '24px' }}>
                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('🏢')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Active Bulk Orders</p>
                            <p className="stat-value">{ordersForStats.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length}</p>
                            <p className="stat-desc">
                              {bulkOrderClientFilter === 'All' ? 'In-progress client orders' : `Active orders for ${bulkOrderClientFilter}`}
                            </p>
                          </div>
                        </div>

                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('📦')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Total Ordered Pcs</p>
                            <p className="stat-value">
                              {ordersForStats.reduce((acc, o) => {
                                const prods = getNormalizedProducts(o)
                                let ord = 0
                                prods.forEach(p => {
                                  const sbList = Array.isArray(p?.sizeBreakdown) ? p.sizeBreakdown : []
                                  sbList.forEach(sb => { ord += (sb.orderedQty || 0) })
                                })
                                return acc + ord
                              }, 0)}
                            </p>
                            <p className="stat-desc">
                              {bulkOrderClientFilter === 'All' ? 'Total client contract pcs' : `Ordered by ${bulkOrderClientFilter}`}
                            </p>
                          </div>
                        </div>

                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('⏳')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Pending Delivery Balance</p>
                            <p className="stat-value" style={{ color: '#D97706' }}>
                              {ordersForStats.reduce((acc, o) => {
                                const prods = getNormalizedProducts(o)
                                let pend = 0
                                prods.forEach(p => {
                                  const sbList = Array.isArray(p?.sizeBreakdown) ? p.sizeBreakdown : []
                                  sbList.forEach(sb => {
                                    pend += Math.max(0, (sb.orderedQty || 0) - (sb.deliveredQty || 0))
                                  })
                                })
                                return acc + pend
                              }, 0)}
                            </p>
                            <p className="stat-desc">Awaiting dispatch to clients</p>
                          </div>
                        </div>

                        <div className="stat-card">
                          <span className="stat-icon">{getSafeEmoji('🚚')}</span>
                          <div className="stat-info">
                            <p className="stat-label">Dispatched Stock Pcs</p>
                            <p className="stat-value" style={{ color: '#059669' }}>
                              {ordersForStats.reduce((acc, o) => {
                                const prods = getNormalizedProducts(o)
                                let del = 0
                                prods.forEach(p => {
                                  const sbList = Array.isArray(p?.sizeBreakdown) ? p.sizeBreakdown : []
                                  sbList.forEach(sb => { del += (sb.deliveredQty || 0) })
                                })
                                return acc + del
                              }, 0)}
                            </p>
                            <p className="stat-desc">
                              {bulkOrderClientFilter === 'All' ? 'Total stock delivered to clients' : `Stock delivered to ${bulkOrderClientFilter}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Main Panel Card */}
                  <div className="card card-panel">
                    <div className="card-header space-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 className="card-title" style={{ color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{getSafeEmoji('🏢')} Bulk Client Sales Orders</h2>
                        <p className="card-subtitle">Manage uniform supply contracts, commercial client orders, size-wise dispatch batches, and delivery balances.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setEditingClientId(null)
                            setClientFormData({ name: '', contactNumber: '', address: '', gstNumber: '', email: '', notes: '' })
                            setClientSearchQuery('')
                            setShowClientManagerModal(true)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', fontWeight: '700' }}
                        >
                          <span>{getSafeEmoji('🏢')}</span> Clients Directory ({clients.length})
                        </button>
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => {
                            setSelectedBulkOrder(null)
                            setBulkOrderFormData({
                              boNumber: String(getNextBoNumber(bulkOrders)),
                              clientName: clients.length > 0 ? clients[0].name : '',
                              targetDate: '',
                              notes: '',
                              products: [{ productName: '', frontLogoCost: '', backLogoCost: '', sizeBreakdown: [{ size: '28', orderedQty: '', unitPrice: '' }] }]
                            })
                            setShowBulkOrderModal(true)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', fontWeight: '700' }}
                        >
                          + Create Bulk Order
                        </button>
                      </div>
                    </div>

                    {/* Filter Controls */}
                    <div className="restock-section-margin">
                      {/* Search Bar */}
                      <form onSubmit={(e) => e.preventDefault()} style={{ marginBottom: '14px' }}>
                        <div
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                            borderRadius: '10px',
                            border: bulkOrderSearchFocused
                              ? '1px solid #059669'
                              : `1px solid ${theme === 'dark' ? '#334155' : '#CBD5E1'}`,
                            boxShadow: bulkOrderSearchFocused
                              ? '0 0 0 3px rgba(5, 150, 105, 0.2)'
                              : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span style={{ position: 'absolute', left: '14px', color: bulkOrderSearchFocused ? '#059669' : '#94A3B8', fontSize: '15px', pointerEvents: 'none', transition: 'color 0.2s' }}>
                            {getSafeEmoji('🔍')}
                          </span>
                          <input
                            ref={boSearchInputRef}
                            type="text"
                            placeholder="Search by CO #, Client Name, Product, Size, Notes, Date..."
                            value={bulkOrderSearch}
                            onChange={(e) => setBulkOrderSearch(e.target.value)}
                            onFocus={() => setBulkOrderSearchFocused(true)}
                            onBlur={() => setBulkOrderSearchFocused(false)}
                            style={{
                              width: '100%',
                              padding: '11px 40px 11px 42px',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              fontSize: '13px',
                              fontWeight: '600',
                              color: 'inherit'
                            }}
                          />
                          {bulkOrderSearch && (
                            <button
                              type="button"
                              onClick={() => {
                                setBulkOrderSearch('')
                                if (boSearchInputRef.current) boSearchInputRef.current.focus()
                              }}
                              style={{
                                position: 'absolute',
                                right: '12px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#94A3B8',
                                padding: '4px'
                              }}
                            >
                              {getSafeEmoji('✕')}
                            </button>
                          )}
                        </div>
                      </form>

                      {/* Dropdown Filters */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Client Filter Dropdown */}
                        <select
                          value={bulkOrderClientFilter}
                          onChange={(e) => setBulkOrderClientFilter(e.target.value)}
                          className="filter-select"
                          style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', width: '280px', maxWidth: '100%' }}
                        >
                          <option value="All">All Clients ({clients.length})</option>
                          {clients.map(c => (
                            <option key={c._id} value={c.name}>🏢 {c.name}</option>
                          ))}
                        </select>

                        {/* Status Filter Dropdown */}
                        <select
                          value={bulkOrderStatusFilter}
                          onChange={(e) => setBulkOrderStatusFilter(e.target.value)}
                          className="filter-select"
                          style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', width: '180px', maxWidth: '100%' }}
                        >
                          <option value="All">All Statuses</option>
                          <option value="Pending">Pending (0% Dispatched)</option>
                          <option value="Partial">Partial (Dispatched In Progress)</option>
                          <option value="Completed">Completed (100% Dispatched)</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {/* Orders List View */}
                    <div className="table-wrap restock-table-wrap-margin">
                      {(() => {
                        const filteredOrders = bulkOrders.filter(o => {
                          if (bulkOrderClientFilter !== 'All' && o.clientName !== bulkOrderClientFilter) return false
                          if (bulkOrderStatusFilter !== 'All' && o.status !== bulkOrderStatusFilter) return false
                          if (bulkOrderSearch && bulkOrderSearch.trim()) {
                            const prods = getNormalizedProducts(o)
                            const sizes = prods.flatMap(p => (p.sizeBreakdown || []).map(sb => `Size ${sb.size} ${sb.size}`))
                            const dates = [
                              o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '',
                              o.targetDate || '',
                              ...(o.dispatches || []).map(inst => inst.dispatchedAt ? new Date(inst.dispatchedAt).toLocaleDateString() : '')
                            ]
                            const fields = [
                              o.boNumber,
                              o.clientName,
                              o.notes,
                              o.status,
                              ...prods.map(p => p.productName),
                              ...prods.map(p => p.school),
                              ...sizes,
                              ...dates,
                              ...(o.dispatches || []).map(inst => inst.challanNumber || ''),
                              ...(o.dispatches || []).map(inst => inst.notes || '')
                            ]
                            return checkFuzzyMatch(bulkOrderSearch, fields)
                          }
                          return true
                        })

                        filteredOrders.sort((a, b) => {
                          const numA = parseInt(String(a.boNumber || '').replace(/\D/g, ''), 10) || 0
                          const numB = parseInt(String(b.boNumber || '').replace(/\D/g, ''), 10) || 0
                          if (numA !== numB) return numA - numB
                          return String(a.boNumber || '').localeCompare(String(b.boNumber || ''), undefined, { numeric: true, sensitivity: 'base' })
                        })

                        if (loadingBulkOrders) {
                          return <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading bulk client orders...</div>
                        }

                        if (filteredOrders.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                              No bulk client orders found for this view. Click "+ Create Bulk Order" above to place a new order!
                            </div>
                          )
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredOrders.map((order) => {
                              const prods = getNormalizedProducts(order)
                              let orderTotalCost = 0
                              let totalOrdered = 0
                              let totalDelivered = 0
                              let pendingBalance = 0

                              prods.forEach(p => {
                                const frontLogo = Number(p?.frontLogoCost || 0)
                                const backLogo = Number(p?.backLogoCost || 0)
                                const logoPerPc = (isNaN(frontLogo) ? 0 : Math.max(0, frontLogo)) + (isNaN(backLogo) ? 0 : Math.max(0, backLogo))
                                const legacyPrice = Number(p?.unitPrice || 0)
                                const sbList = Array.isArray(p?.sizeBreakdown) ? p.sizeBreakdown : []
                                sbList.forEach(sb => {
                                  const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
                                  const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
                                  const del = Number(sb?.deliveredQty || 0) || 0
                                  const ord = Number(sb?.orderedQty || 0) || 0
                                  if (effectiveUnitPrice > 0) {
                                    orderTotalCost += del * effectiveUnitPrice
                                  }
                                  totalOrdered += ord
                                  totalDelivered += del
                                  if (del < ord) {
                                    pendingBalance += (ord - del)
                                  }
                                })
                              })

                              const totalPct = totalOrdered > 0 ? Math.round((totalDelivered / totalOrdered) * 100) : 0
                              const boHasAnyPrices = orderTotalCost > 0

                              return (
                                <div
                                  key={order._id}
                                  style={{
                                    border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    background: theme === 'dark' ? '#1E293B' : '#F8FAFC'
                                  }}
                                >
                                  {/* Card Top Header */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: '800', fontSize: '15px', color: '#2563EB' }}>{getDisplayCoNumber(order)}</span>
                                        <span style={{ fontWeight: '700', fontSize: '15px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>Client: {order.clientName}</span>
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span>Products: <strong>{prods.length}</strong></span>
                                        {order.targetDate && <span>Target Delivery: <strong>{order.targetDate}</strong></span>}
                                        <span>Created: <strong>{new Date(order.createdAt).toLocaleDateString()}</strong></span>
                                        <span style={{ fontWeight: '700', color: boHasAnyPrices ? (theme === 'dark' ? '#34D399' : '#059669') : '#64748B' }}>
                                          Total Order Value: <strong>{boHasAnyPrices ? `₹${orderTotalCost.toLocaleString('en-IN')}` : '-'}</strong>
                                        </span>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span className={`status-badge ${order.status === 'Completed' ? 'ready' : order.status === 'Partial' ? 'partial' : order.status === 'Cancelled' ? 'delivered' : 'pending'}`}>
                                        {order.status === 'Completed' ? `Completed (${totalPct}%)` : order.status === 'Partial' ? `Partial (${totalPct}%)` : order.status}
                                      </span>

                                      <button
                                        type="button"
                                        className="primary-btn"
                                        onClick={() => handleOpenDispatchModal(order)}
                                        disabled={order.status === 'Completed' || order.status === 'Cancelled'}
                                        style={{
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          borderRadius: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          background: order.status === 'Completed' ? (theme === 'dark' ? '#334155' : '#E2E8F0') : '#059669',
                                          color: order.status === 'Completed' ? (theme === 'dark' ? '#94A3B8' : '#475569') : '#FFFFFF',
                                          border: order.status === 'Completed' ? (theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1') : '1px solid #059669',
                                          cursor: order.status === 'Completed' ? 'not-allowed' : 'pointer',
                                          fontWeight: '700'
                                        }}
                                        title={order.status === 'Completed' ? 'All items fully dispatched' : 'Dispatch stock batch for this order'}
                                      >
                                        {getSafeEmoji('🚚')} {order.status === 'Completed' ? 'All Dispatched' : 'Dispatch Stock'}
                                      </button>

                                      <button
                                        type="button"
                                        className="icon-btn"
                                        title="Edit Bulk Order details"
                                        onClick={() => {
                                          setSelectedBulkOrder(order)
                                          const boNumOnly = String(getDisplayCoNumber(order) || '').replace(/\D/g, '')
                                          const formattedProducts = getNormalizedProducts(order).map(p => ({
                                            productName: p.productName,
                                            frontLogoCost: p.frontLogoCost !== undefined ? String(p.frontLogoCost || '') : '',
                                            backLogoCost: p.backLogoCost !== undefined ? String(p.backLogoCost || '') : '',
                                            specifications: getNormalizedSpecifications(p),
                                            sizeBreakdown: (p.sizeBreakdown || []).map(sb => ({
                                              size: sb.size,
                                              orderedQty: String(sb.orderedQty || ''),
                                              unitPrice: String(sb.unitPrice || '')
                                            }))
                                          }))

                                          setBulkOrderFormData({
                                            boNumber: boNumOnly,
                                            clientName: order.clientName,
                                            targetDate: order.targetDate || '',
                                            notes: order.notes || '',
                                            products: formattedProducts.length > 0 ? formattedProducts : [{ productName: '', frontLogoCost: '', backLogoCost: '', sizeBreakdown: [{ size: '28', orderedQty: '', unitPrice: '' }] }]
                                          })
                                          setShowBulkOrderModal(true)
                                        }}
                                      >
                                        {getSafeEmoji('✏️')}
                                      </button>

                                      <button
                                        type="button"
                                        className="icon-btn danger"
                                        title="Delete Bulk Order"
                                        onClick={() => handleDeleteBulkOrder(order._id, order.boNumber)}
                                      >
                                        {getSafeEmoji('🗑️')}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Export Actions Row */}
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
                                    background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(37,99,235,0.03)',
                                    borderRadius: '0 0 10px 10px',
                                    flexWrap: 'wrap',
                                    margin: '10px 0'
                                  }}>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: theme === 'dark' ? '#94A3B8' : '#64748B', marginRight: '2px' }}>Export:</span>
                                    <button
                                      type="button"
                                      onClick={() => exportBulkOrderCSV(order)}
                                      style={{
                                        background: '#2563EB',
                                        color: '#FFFFFF',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '5px 13px',
                                        fontSize: '11.5px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 4px rgba(37,99,235,0.25)',
                                        transition: 'all 0.2s ease'
                                      }}
                                      title="Export Excel (CSV) Spreadsheet"
                                    >
                                      <span style={{ fontSize: '13px' }}>{getSafeEmoji('📊')}</span>
                                      Export Excel (CSV)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenBOPDFModal(order)}
                                      style={{
                                        background: theme === 'dark' ? '#1E293B' : '#F1F5F9',
                                        color: theme === 'dark' ? '#E2E8F0' : '#334155',
                                        border: theme === 'dark' ? '1px solid #334155' : '1px solid #CBD5E1',
                                        borderRadius: '16px',
                                        padding: '5px 13px',
                                        fontSize: '11.5px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                      }}
                                      title="Configure and Save as PDF"
                                    >
                                      <span style={{ fontSize: '13px' }}>{getSafeEmoji('📄')}</span>
                                      Save as PDF
                                    </button>
                                  </div>

                                  {/* Prominent Order Notes Callout Banner */}
                                  {order.notes && (
                                    <div
                                      style={{
                                        margin: '10px 0 14px 0',
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        background: theme === 'dark' ? '#1E293B' : '#FEF3C7',
                                        border: theme === 'dark' ? '1px solid #D97706' : '1px solid #FCD34D',
                                        color: theme === 'dark' ? '#FDE68A' : '#92400E',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        fontWeight: '600',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                        wordBreak: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: '1.5'
                                      }}
                                    >
                                      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '2px' }}>{getSafeEmoji('📝')}</span>
                                      <div style={{ flex: 1 }}>
                                        <strong style={{ color: theme === 'dark' ? '#FBBF24' : '#B45309' }}>Order Special Instructions / Note:</strong> {order.notes}
                                      </div>
                                    </div>
                                  )}

                                  {/* Overall Progress Bar */}
                                  <div style={{ margin: '12px 0 16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                                      <span>Dispatch Progress: {totalDelivered} / {totalOrdered} pcs ({totalPct}%)</span>
                                      <span style={{ color: pendingBalance > 0 ? '#EAB308' : '#10B981' }}>
                                        {pendingBalance > 0 ? `Pending: ${pendingBalance} pcs` : 'All Stock Dispatched'}
                                      </span>
                                    </div>
                                    <div style={{ height: '8px', width: '100%', background: theme === 'dark' ? '#334155' : '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          height: '100%',
                                          width: `${Math.min(100, totalPct)}%`,
                                          background: totalPct >= 100 ? '#10B981' : (totalPct > 0 ? '#3B82F6' : '#F59E0B'),
                                          borderRadius: '4px',
                                          transition: 'width 0.3s ease'
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Products & Size Breakdown Tables */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {prods.map((prod, pIdx) => {
                                      const sortedBreakdown = sortSizesAscending(prod?.sizeBreakdown || [])
                                      const frontLogo = Number(prod?.frontLogoCost || 0)
                                      const backLogo = Number(prod?.backLogoCost || 0)
                                      const logoPerPc = (isNaN(frontLogo) ? 0 : Math.max(0, frontLogo)) + (isNaN(backLogo) ? 0 : Math.max(0, backLogo))
                                      const legacyPrice = Number(prod?.unitPrice || 0)

                                      let totalProdOrd = 0
                                      let totalProdDel = 0
                                      let totalProdPending = 0
                                      let totalProdCost = 0

                                      sortedBreakdown.forEach(sb => {
                                        const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
                                        const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
                                        const ord = Number(sb?.orderedQty || 0) || 0
                                        const del = Number(sb?.deliveredQty || 0) || 0
                                        totalProdOrd += ord
                                        totalProdDel += del
                                        totalProdPending += Math.max(0, ord - del)
                                        totalProdCost += effectiveUnitPrice > 0 ? del * effectiveUnitPrice : 0
                                      })

                                      const totalProdPct = totalProdOrd > 0 ? Math.round((totalProdDel / totalProdOrd) * 100) : 0

                                      return (
                                        <div key={pIdx} style={{ background: theme === 'dark' ? '#0F172A' : '#FFFFFF', borderRadius: '8px', padding: '14px 16px', border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '800', color: theme === 'dark' ? '#38BDF8' : '#0284C7', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                              <span>Product {pIdx + 1} &mdash; {prod.productName}</span>
                                              {logoPerPc > 0 && (
                                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                                                  🏷️ Logos: {frontLogo > 0 ? `Front ₹${frontLogo}` : ''}{frontLogo > 0 && backLogo > 0 ? ' | ' : ''}{backLogo > 0 ? `Back ₹${backLogo}` : ''} (Total ₹{logoPerPc}/pc)
                                                </span>
                                              )}
                                              {/* Specifications */}
                                              {getNormalizedSpecifications(prod).filter(s => s.value && String(s.value).trim()).length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', width: '100%' }}>
                                                  {getNormalizedSpecifications(prod).filter(s => s.value && String(s.value).trim()).map((spec, si) => (
                                                    <span key={si} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: theme === 'dark' ? '#064E3B' : '#ECFDF5', color: theme === 'dark' ? '#34D399' : '#065F46', border: '1px solid #6EE7B7', fontWeight: '600' }}>
                                                      <strong>{spec.label}:</strong> {spec.value}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>

                                            {totalProdCost > 0 && (
                                              <div style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#34D399' : '#059669' }}>
                                                Total Product Cost: ₹{totalProdCost.toLocaleString('en-IN')}
                                              </div>
                                            )}
                                          </div>

                                          <div className="restock-table-scroll-container">
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead>
                                              <tr style={{ borderBottom: '1px solid var(--border-color, #E5E7EB)', color: '#64748B', textAlign: 'left' }}>
                                                <th style={{ padding: '8px 16px 8px 8px', whiteSpace: 'nowrap', minWidth: '100px' }}>Size</th>
                                                <th style={{ padding: '8px 16px 8px 8px', whiteSpace: 'nowrap', minWidth: '120px' }}>Cost / Unit</th>
                                                <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Ordered</th>
                                                <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Dispatched</th>
                                                <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Pending</th>
                                                <th style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>Row Cost</th>
                                                <th style={{ padding: '8px 8px 8px 8px', whiteSpace: 'nowrap', minWidth: '100px' }}>Fulfillment</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {sortedBreakdown.map((sb, sbIdx) => {
                                                const ord = Number(sb?.orderedQty || 0) || 0
                                                const del = Number(sb?.deliveredQty || 0) || 0
                                                const pend = Math.max(0, ord - del)
                                                const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
                                                const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
                                                const rowCost = effectiveUnitPrice > 0 ? del * effectiveUnitPrice : 0
                                                const sizePct = ord > 0 ? Math.round((del / ord) * 100) : 0

                                                return (
                                                  <tr key={sbIdx} style={{ borderBottom: '1px dashed var(--border-color, #F1F5F9)' }}>
                                                    <td style={{ padding: '8px 16px 8px 8px', fontWeight: '700', whiteSpace: 'nowrap', minWidth: '100px' }}>{sb.size}</td>
                                                    <td style={{ padding: '8px 16px 8px 8px', color: theme === 'dark' ? '#34D399' : '#059669', fontWeight: '600', whiteSpace: 'nowrap', minWidth: '120px' }}>
                                                      {effectiveUnitPrice > 0 ? (
                                                        <div>
                                                          <span>₹{effectiveUnitPrice.toLocaleString('en-IN')}</span>
                                                          {logoPerPc > 0 && (
                                                            <span style={{ fontSize: '10px', color: theme === 'dark' ? '#94A3B8' : '#64748B', display: 'block', fontWeight: '500' }}>
                                                              (Base ₹{basePrice} + Logo ₹{logoPerPc})
                                                            </span>
                                                          )}
                                                        </div>
                                                      ) : '-'}
                                                    </td>
                                                    <td style={{ padding: '8px 12px 8px 8px', whiteSpace: 'nowrap' }}>{ord} pcs</td>
                                                    <td style={{ padding: '8px 12px 8px 8px', color: '#10B981', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                      {del} pcs
                                                    </td>
                                                    <td style={{ padding: '8px 12px 8px 8px', color: pend > 0 ? '#EAB308' : '#10B981', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                      {pend > 0 ? `${pend} pcs` : 'Done'}
                                                    </td>
                                                    <td style={{ padding: '8px 12px 8px 8px', color: theme === 'dark' ? '#34D399' : '#059669', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                      {rowCost > 0 ? `₹${rowCost.toLocaleString('en-IN')}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '6px 8px', minWidth: '100px' }}>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ flex: 1, height: '6px', background: theme === 'dark' ? '#334155' : '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                                          <div style={{ height: '100%', width: `${sizePct}%`, background: sizePct === 100 ? '#10B981' : '#3B82F6', borderRadius: '3px' }} />
                                                        </div>
                                                        <span style={{ fontSize: '10px', width: '32px', textAlign: 'right' }}>{sizePct}%</span>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                            <tfoot style={{ borderTop: '2px solid var(--border-color, #CBD5E1)', fontWeight: '800', background: theme === 'dark' ? '#1E293B' : '#F8FAFC' }}>
                                              <tr>
                                                <td style={{ padding: '8px 16px 8px 8px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A', whiteSpace: 'nowrap', minWidth: '100px' }}>Total</td>
                                                <td style={{ padding: '8px 16px 8px 8px', color: theme === 'dark' ? '#94A3B8' : '#64748B', whiteSpace: 'nowrap', minWidth: '120px' }}>-</td>
                                                <td style={{ padding: '8px 12px 8px 8px', color: '#2563EB', whiteSpace: 'nowrap' }}>{totalProdOrd} pcs</td>
                                                <td style={{ padding: '8px 12px 8px 8px', color: '#10B981', whiteSpace: 'nowrap' }}>
                                                  {totalProdDel} pcs
                                                  {totalProdDel > totalProdOrd && (
                                                    <span style={{ marginLeft: '4px', fontSize: '11px', color: theme === 'dark' ? '#34D399' : '#047857', fontWeight: '700' }}>
                                                      (+{totalProdDel - totalProdOrd} Extra)
                                                    </span>
                                                  )}
                                                </td>
                                                <td style={{ padding: '8px 12px 8px 8px', color: totalProdPending > 0 ? '#EAB308' : '#10B981', whiteSpace: 'nowrap' }}>
                                                  {totalProdPending > 0 ? `${totalProdPending} pcs` : 'Done'}
                                                </td>
                                                <td style={{ padding: '8px 12px 8px 8px', color: theme === 'dark' ? '#34D399' : '#059669', whiteSpace: 'nowrap' }}>
                                                  {totalProdCost > 0 ? `₹${totalProdCost.toLocaleString('en-IN')}` : '-'}
                                                </td>
                                                <td style={{ padding: '6px 8px', minWidth: '100px' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, height: '6px', background: theme === 'dark' ? '#334155' : '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                                      <div style={{ height: '100%', width: `${totalProdPct}%`, background: totalProdPct === 100 ? '#10B981' : '#3B82F6', borderRadius: '3px' }} />
                                                    </div>
                                                    <span style={{ fontSize: '10px', width: '32px', textAlign: 'right' }}>{totalProdPct}%</span>
                                                  </div>
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Dispatched History Log Accordion */}
                                  {order.dispatches && order.dispatches.length > 0 && (
                                    <div style={{ marginTop: '16px', borderTop: '1px dashed var(--border-color, #CBD5E1)', paddingTop: '14px' }}>
                                      <div style={{ fontSize: '13px', fontWeight: '800', color: theme === 'dark' ? '#34D399' : '#059669', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{getSafeEmoji('🚚')}</span> Dispatched Stock Batches ({order.dispatches.length} {order.dispatches.length === 1 ? 'Batch' : 'Batches'}):
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {order.dispatches.map((inst, idx) => {
                                          const batchTotal = (inst.items || []).reduce((s, i) => s + (i.qty || 0), 0)
                                          return (
                                            <div
                                              key={inst._id || idx}
                                              style={{
                                                background: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                                                padding: '12px 16px',
                                                borderRadius: '10px',
                                                border: theme === 'dark' ? '1px solid #334155' : '1px solid #CBD5E1',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                flexWrap: 'wrap'
                                              }}
                                            >
                                              <div style={{ flex: 1, minWidth: '240px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                  <span style={{ fontWeight: '800', fontSize: '13px', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>
                                                    Dispatch Batch #{idx + 1} ({new Date(inst.dispatchedAt).toLocaleDateString()})
                                                  </span>
                                                  <span
                                                    style={{
                                                      fontSize: '12px',
                                                      fontWeight: '800',
                                                      padding: '2px 8px',
                                                      borderRadius: '6px',
                                                      background: theme === 'dark' ? '#064E3B' : '#D1FAE5',
                                                      color: theme === 'dark' ? '#34D399' : '#059669',
                                                      border: theme === 'dark' ? '1px solid #059669' : '1px solid #6EE7B7'
                                                    }}
                                                  >
                                                    Total: {batchTotal} pcs dispatched
                                                  </span>
                                                  {inst.challanNumber && (
                                                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                                                      Delivery Challan / Invoice: <strong>{inst.challanNumber}</strong>
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Items breakdown pills */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                                  {(inst.items || []).map((item, itemIdx) => (
                                                    <span
                                                      key={itemIdx}
                                                      style={{
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        background: theme === 'dark' ? '#1E293B' : '#F1F5F9',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        color: theme === 'dark' ? '#94A3B8' : '#475569'
                                                      }}
                                                    >
                                                      {item.productName ? `${item.productName} - ` : ''}Size {item.size}: <strong>{item.qty} pcs</strong>
                                                    </span>
                                                  ))}
                                                </div>

                                                {inst.notes && (
                                                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', fontStyle: 'italic' }}>
                                                    Notes: {inst.notes}
                                                  </div>
                                                )}
                                              </div>

                                              {/* Action Buttons for Dispatch Batch */}
                                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenEditDispatch(order, inst)}
                                                  style={{
                                                    fontSize: '11px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    background: theme === 'dark' ? '#1E293B' : '#EFF6FF',
                                                    color: '#2563EB',
                                                    border: '1px solid #93C5FD',
                                                    cursor: 'pointer',
                                                    fontWeight: '700'
                                                  }}
                                                >
                                                  ✏️ Edit Batch
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteDispatch(order, inst._id)}
                                                  style={{
                                                    fontSize: '11px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    background: theme === 'dark' ? '#450A0A' : '#FEE2E2',
                                                    color: '#EF4444',
                                                    border: '1px solid #FCA5A5',
                                                    cursor: 'pointer',
                                                    fontWeight: '700'
                                                  }}
                                                >
                                                  🗑️ Delete
                                                </button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activePage === 'Settings' && (
            <section className="page-panel placeholder-panel">
              <div className="card card-panel placeholder-card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div className="card-header space-between">
                  <div>
                    <p className="card-title">Settings & System Management</p>
                    <p className="card-subtitle">Configure credentials, manage database backups, and inspect system audit trails.</p>
                  </div>
                </div>

                <div className="settings-layout">
                  <div className="settings-left-col">
                    {/* Account management */}
                    <div className="settings-box">
                      <p className="settings-box-title">{getSafeEmoji('🔒')} Administrator Account</p>
                      <p className="settings-box-desc">Update your secure administrator credentials for accessing the Liberty Uniform Order Book.</p>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => setShowManageModal(true)}
                        style={{ marginTop: 'auto', alignSelf: 'center' }}
                      >
                        Manage Admin Credentials
                      </button>
                    </div>

                    {/* Production Categories & Pricing Rates */}
                    <div className="settings-box" style={{ gridColumn: 'span 2' }}>
                      <p className="settings-box-title">{getSafeEmoji('💵')} Production Categories & Pricing Rates ({productionCategories.length} Categories)</p>
                      <p className="settings-box-desc">Add new categories, edit unit rates (₹), or remove categories used inside the Production Queue Cost Calculator.</p>

                      {/* Add New Category Form */}
                      <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', background: theme === 'dark' ? '#0F172A' : '#F8FAFC', padding: '14px', borderRadius: '12px', marginBottom: '16px', border: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E2E8F0' }}>
                        <div style={{ flex: 2, minWidth: '180px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '6px' }}>
                            {getSafeEmoji('➕')} New Category Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Blazer (28 to 36)"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
                            required
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '6px' }}>
                            Tailor Rate (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 250"
                            value={newCatRate}
                            onChange={(e) => setNewCatRate(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
                            required
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button
                            type="submit"
                            className="primary-btn"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 18px',
                              fontSize: '13px',
                              fontWeight: '600',
                              height: '38px',
                              borderRadius: '8px',
                              whiteSpace: 'nowrap',
                              lineHeight: 1
                            }}
                            disabled={loadingPricing}
                          >
                            + Add Category
                          </button>
                        </div>
                      </form>

                      {/* Category Rates List */}
                      <form onSubmit={handleUpdatePricing} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                          gap: '10px',
                          maxHeight: '380px',
                          overflowY: 'auto',
                          paddingRight: '6px'
                        }}>
                          {productionCategories.map((cat) => (
                            <div key={cat.id} style={{
                              background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E2E8F0',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cat.name}>
                                  {cat.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: '#EF4444',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    lineHeight: 1
                                  }}
                                  title={`Delete ${cat.name}`}
                                >
                                  {getSafeEmoji('🗑️')}
                                </button>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Rate (₹):</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={pricingInputs[cat.id] !== undefined ? pricingInputs[cat.id] : cat.defaultRate}
                                  onChange={(e) => setPricingInputs(prev => ({ ...prev, [cat.id]: Number(e.target.value || 0) }))}
                                  style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}
                                  required
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="submit"
                          className="primary-btn"
                          style={{
                            marginTop: '8px',
                            width: '100%',
                            opacity: loadingPricing ? 0.55 : 1,
                            cursor: loadingPricing ? 'not-allowed' : 'pointer'
                          }}
                          disabled={loadingPricing}
                        >
                          {loadingPricing ? 'Saving All Pricing Rates...' : `Save All ${productionCategories.length} Pricing Rates`}
                        </button>
                      </form>
                    </div>

                    {/* WhatsApp Notification Message Templates */}
                    <div className="settings-box">
                      <p className="settings-box-title">{getSafeEmoji('💬')} WhatsApp Notification Message Templates</p>
                      <p className="settings-box-desc">Customize automated WhatsApp message templates for Stock Waitlist restocks and Order Ready alerts. Use variables in curly braces like <code>{"{customerName}"}</code>.</p>

                      <form onSubmit={handleUpdateWhatsAppTemplates} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '4px' }}>
                            Stock Waitlist Restock Template
                          </label>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                            Available variables: <code>{"{customerName}"}</code>, <code>{"{items}"}</code>, <code>{"{school}"}</code>
                          </span>
                          <textarea
                            rows="3"
                            value={waitlistTemplateInput}
                            onChange={(e) => setWaitlistTemplateInput(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #CBD5E1',
                              background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                              color: 'inherit',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '4px' }}>
                            Ready Order Notification Template
                          </label>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                            Available variables: <code>{"{customerName}"}</code>, <code>{"{orderNumber}"}</code>, <code>{"{school}"}</code>, <code>{"{amount}"}</code>, <code>{"{paymentStatus}"}</code>, <code>{"{collectionMsg}"}</code>
                          </span>
                          <textarea
                            rows="5"
                            value={orderReadyTemplateInput}
                            onChange={(e) => setOrderReadyTemplateInput(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #CBD5E1',
                              background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                              color: 'inherit',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="primary-btn"
                          style={{
                            marginTop: '4px',
                            width: '100%',
                            opacity: (loadingTemplates || (
                              waitlistTemplateInput === whatsappTemplates.waitlistTemplate &&
                              orderReadyTemplateInput === whatsappTemplates.orderReadyTemplate
                            )) ? 0.55 : 1,
                            cursor: (loadingTemplates || (
                              waitlistTemplateInput === whatsappTemplates.waitlistTemplate &&
                              orderReadyTemplateInput === whatsappTemplates.orderReadyTemplate
                            )) ? 'not-allowed' : 'pointer',
                            backgroundColor: (loadingTemplates || (
                              waitlistTemplateInput === whatsappTemplates.waitlistTemplate &&
                              orderReadyTemplateInput === whatsappTemplates.orderReadyTemplate
                            )) ? (theme === 'dark' ? '#334155' : '#E2E8F0') : '',
                            color: (loadingTemplates || (
                              waitlistTemplateInput === whatsappTemplates.waitlistTemplate &&
                              orderReadyTemplateInput === whatsappTemplates.orderReadyTemplate
                            )) ? (theme === 'dark' ? '#64748B' : '#94A3B8') : '',
                            border: (loadingTemplates || (
                              waitlistTemplateInput === whatsappTemplates.waitlistTemplate &&
                              orderReadyTemplateInput === whatsappTemplates.orderReadyTemplate
                            )) ? 'none' : ''
                          }}
                          disabled={loadingTemplates || (
                            waitlistTemplateInput === whatsappTemplates.waitlistTemplate &&
                            orderReadyTemplateInput === whatsappTemplates.orderReadyTemplate
                          )}
                        >
                          {loadingTemplates ? 'Saving Templates...' : 'Save WhatsApp Templates'}
                        </button>
                      </form>
                    </div>

                    {/* Backup & restore management */}
                    <div className="settings-box">
                      <p className="settings-box-title">{getSafeEmoji('💾')} Database Backups & Recovery</p>
                      <p className="settings-box-desc">Create and restore backups to safeguard against accidental data deletion or hardware failures.</p>

                      <div className="backups-list">
                        {loadingBackups ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>Loading backup list...</p>
                        ) : backups.length === 0 ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>No backups found.</p>
                        ) : (
                          backups.map((backup) => (
                            <div key={backup.filename} className="backup-item">
                              <div className="backup-details">
                                <span className="backup-name">{backup.filename}</span>
                                <span className="backup-meta">
                                  Size: {(backup.size / 1024).toFixed(1)} KB • Created: {new Date(backup.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="backup-actions">
                                <button
                                  type="button"
                                  className="primary-btn"
                                  onClick={() => handleDownloadBackup(backup.filename)}
                                  style={{ padding: '4px 8px', fontSize: '11px', minWidth: 'auto' }}
                                >
                                  {getSafeEmoji('⬇️')} Download
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={handleCreateBackup}
                          style={{ flex: 1, minWidth: '140px' }}
                        >
                          Create Backup Now
                        </button>
                        <label className="backup-upload-label" style={{ flex: 1, minWidth: '140px', padding: '0', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          Restore from File
                          <input
                            type="file"
                            accept=".gz,.json"
                            onChange={handleRestoreBackup}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* WhatsApp integration configuration card */}
                    <div className="settings-box">
                      <p className="settings-box-title">{getSafeEmoji('💬')} WhatsApp Integration Mode</p>
                      <p className="settings-box-desc">Choose whether customer alerts launch the native WhatsApp app (supporting drafts stack-to-top) or load WhatsApp Web in browser tabs.</p>
                      <div style={{ marginTop: 'auto' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '6px' }}>Integration Type</label>
                        <select
                          value={whatsappMode}
                          onChange={(e) => handleUpdateWhatsappMode(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #CBD5E1', background: theme === 'dark' ? '#1E293B' : '#FFFFFF', color: 'inherit' }}
                        >
                          <option value="web">WhatsApp Web (Browser Tabs)</option>
                          <option value="app">WhatsApp App (Desktop/Mobile App)</option>
                        </select>
                      </div>
                    </div>

                    {/* Active Logged-In Devices card */}
                    <div className="settings-box">
                      <p className="settings-box-title">{getSafeEmoji('📱')} Active Logged-In Devices</p>
                      <p className="settings-box-desc">Manage other devices that are currently logged in to your account.</p>

                      <div className="backups-list" style={{ maxHeight: '200px' }}>
                        {loadingSessions ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>Loading active devices...</p>
                        ) : sessions.length === 0 ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>No active devices found.</p>
                        ) : (
                          sessions.map((s) => (
                            <div key={s.id} className="backup-item" style={{ gap: '10px' }}>
                              <div className="backup-details" style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                  <span style={{ fontSize: '14px' }}>
                                    {s.userAgent.toLowerCase().includes('iphone') || s.userAgent.toLowerCase().includes('android') || s.userAgent.toLowerCase().includes('ios') ? getSafeEmoji('📱') : getSafeEmoji('💻')}
                                  </span>
                                  <span style={{ fontWeight: '600', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>
                                    {s.userAgent}
                                  </span>
                                  {s.isCurrent && (
                                    <span style={{ fontSize: '9px', background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                      Current
                                    </span>
                                  )}
                                </div>
                                <span className="backup-meta" style={{ fontSize: '10px' }}>
                                  IP: {s.ipAddress} • Active: {new Date(s.lastActive).toLocaleString()}
                                </span>
                              </div>
                              <div className="backup-actions">
                                {!s.isCurrent && (
                                  <button
                                    type="button"
                                    className="danger-btn"
                                    onClick={() => handleRevokeSession(s.id)}
                                    style={{ padding: '6px 12px', fontSize: '11px', minWidth: 'auto', borderRadius: '8px', height: '28px', display: 'flex', alignItems: 'center' }}
                                  >
                                    Log Out
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {sessions.filter(s => !s.isCurrent).length > 0 && (
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={handleRevokeOthers}
                          style={{ marginTop: 'auto', width: '100%', borderRadius: '12px', height: '38px', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          {getSafeEmoji('🚪')} Log Out All Other Devices
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="settings-right-col">
                    {/* Timeline Audit Logs */}
                    <div className="settings-box" style={{ height: '100%' }}>
                      <p className="settings-box-title">{getSafeEmoji('📋')} System Audit Logs</p>
                      <p className="settings-box-desc">Real-time trail of edits, creations, deletions, and status changes made to your data.</p>

                      {/* Search and Filters Controls */}
                      <div className="log-filters-container" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                        padding: '12px',
                        borderRadius: '12px',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #E2E8F0'
                      }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="search"
                            placeholder={`${getSafeEmoji('🔍')} Search log messages...`}
                            value={logSearch}
                            onChange={(e) => setLogSearch(e.target.value)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '8px 12px',
                              fontSize: '12px',
                              borderRadius: '8px',
                              minHeight: '34px',
                              background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                              color: 'inherit',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1'
                            }}
                          />
                          <select
                            value={logTypeFilter}
                            onChange={(e) => setLogTypeFilter(e.target.value)}
                            style={{
                              width: '125px',
                              flexShrink: 0,
                              padding: '8px 10px',
                              fontSize: '12px',
                              borderRadius: '8px',
                              minHeight: '34px',
                              background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                              color: 'inherit',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1'
                            }}
                          >
                            <option value="All">All Types</option>
                            <option value="Order">Orders</option>
                            <option value="Waitlist">Waitlist</option>
                            <option value="StatusChange">Status Changes</option>
                            <option value="Delete">Deletions</option>
                            <option value="System">System</option>
                            <option value="Backup">Backups</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: theme === 'dark' ? '#94A3B8' : '#64748B' }}>{getSafeEmoji('📅')} View Specific Day:</span>
                          <input
                            type="date"
                            value={logDateFilter}
                            onChange={(e) => setLogDateFilter(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              fontSize: '12px',
                              borderRadius: '8px',
                              minHeight: '32px',
                              background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                              color: 'inherit',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1'
                            }}
                          />
                          {logDateFilter && (
                            <button
                              type="button"
                              onClick={() => setLogDateFilter('')}
                              className="danger-btn"
                              style={{
                                padding: '6px 10px',
                                fontSize: '11px',
                                borderRadius: '8px',
                                minWidth: 'auto',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="audit-timeline" style={{ maxHeight: '620px', overflowY: 'auto' }}>
                        {loadingAuditLogs ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>Loading audit trail...</p>
                        ) : filteredAuditLogs.length === 0 ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>No matching log entries found.</p>
                        ) : (
                          filteredAuditLogs.map((log) => (
                            <div key={log._id} className="audit-card">
                              <div className="audit-header">
                                <span className={`audit-action ${log.action.toLowerCase().replace(' ', '-')}`}>
                                  {log.action}
                                </span>
                                <span className="audit-time">
                                  {new Date(log.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="audit-detail">
                                {log.orderNumber && log.orderNumber !== 'System' && (
                                  <span className="audit-order-num">#{log.orderNumber}</span>
                                )}
                                {log.details}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {showPDFModal && (
        <div className="pdf-modal-backdrop">
          <div className="pdf-modal-card">
            <div className="pdf-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{getSafeEmoji('📄')} PDF Export & Live Preview</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
                  Configure paper format, orientation, margins, and density with a live sheet preview.
                </p>
              </div>
              <button
                type="button"
                className="manage-modal-close"
                onClick={() => setShowPDFModal(false)}
                style={{ position: 'static', fontSize: '20px' }}
              >
                {getSafeEmoji('✕')}
              </button>
            </div>

            <div className="pdf-modal-body">
              {/* Settings Controls Sidebar */}
              <div className="pdf-controls-sidebar">
                <div className="pdf-control-group">
                  <label>File Name</label>
                  <input
                    type="text"
                    value={pdfFileName}
                    onChange={(e) => setPdfFileName(e.target.value)}
                    placeholder="Enter file name"
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="pdf-control-group">
                  <label>Orientation</label>
                  <select
                    value={pdfOrientation}
                    onChange={(e) => setPdfOrientation(e.target.value)}
                  >
                    <option value="landscape">Landscape (Horizontal - Rec.)</option>
                    <option value="portrait">Portrait (Vertical)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>Paper Format</label>
                  <select
                    value={pdfFormat}
                    onChange={(e) => setPdfFormat(e.target.value)}
                  >
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="a3">A3 (297 × 420 mm - Large Format)</option>
                    <option value="letter">Letter (8.5 × 11 in)</option>
                    <option value="legal">Legal (8.5 × 14 in)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>Margins</label>
                  <select
                    value={pdfMargin}
                    onChange={(e) => setPdfMargin(e.target.value)}
                  >
                    <option value="compact">Compact (3mm)</option>
                    <option value="normal">Normal (6mm)</option>
                    <option value="wide">Wide (12mm)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>Table Scale</label>
                  <select
                    value={pdfScale}
                    onChange={(e) => setPdfScale(e.target.value)}
                  >
                    <option value="compact">Compact (85%)</option>
                    <option value="normal">Normal (100%)</option>
                    <option value="large">Large Text (115%)</option>
                  </select>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={executePDFDownload}
                    disabled={exportingPDF}
                    style={{ padding: '12px', fontSize: '14px', fontWeight: '700', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {exportingPDF ? `${getSafeEmoji('⌛')} Generating PDF...` : `${getSafeEmoji('⬇️')} Download PDF`}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setShowPDFModal(false)}
                    style={{ padding: '10px', fontSize: '13px', justifyContent: 'center', display: 'flex', alignItems: 'center' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Live Preview Workspace */}
              <div className="pdf-preview-workspace">
                {/* The preview element: width matches exact PDF paper px dimensions for WYSIWYG accuracy */}
                <div
                  ref={pdfPreviewSheetRef}
                  className="pdf-paper-sheet"
                  style={{
                    // Exact paper pixel widths at 96dpi (matches getPaperPxWidth exactly)
                    width: (() => {
                      if (pdfFormat === 'a3') return pdfOrientation === 'landscape' ? '1587px' : '1123px'
                      if (pdfFormat === 'legal') return pdfOrientation === 'landscape' ? '1344px' : '816px'
                      if (pdfFormat === 'letter') return pdfOrientation === 'landscape' ? '1056px' : '816px'
                      return pdfOrientation === 'landscape' ? '1123px' : '794px' // A4
                    })(),
                    minHeight: (() => {
                      if (pdfFormat === 'a3') return pdfOrientation === 'landscape' ? '1123px' : '1587px'
                      if (pdfFormat === 'legal') return pdfOrientation === 'landscape' ? '816px' : '1344px'
                      return pdfOrientation === 'landscape' ? '794px' : '1123px' // A4
                    })(),
                    // No padding here — we use an inner content div with the margin guide
                    padding: '0',
                    fontSize: pdfScale === 'compact' ? '10px' : (pdfScale === 'large' ? '13px' : '11.5px'),
                    boxSizing: 'border-box',
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: '1.3',
                    overflowX: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Margin Guide — dashed border showing exact printable area boundary */}
                  {(() => {
                    const marginPx = pdfMargin === 'compact' ? 23 : (pdfMargin === 'wide' ? 68 : 38)
                    return (
                      <div style={{
                        position: 'absolute',
                        top: `${marginPx}px`,
                        left: `${marginPx}px`,
                        right: `${marginPx}px`,
                        bottom: `${marginPx}px`,
                        border: '1.5px dashed rgba(37,99,235,0.35)',
                        borderRadius: '2px',
                        pointerEvents: 'none',
                        zIndex: 10
                      }} />
                    )
                  })()}

                  {/* Inner content area with same padding as PDF margin */}
                  <div style={{
                    padding: pdfMargin === 'compact' ? '24px 24px' : (pdfMargin === 'wide' ? '68px 68px' : '38px 38px'),
                    boxSizing: 'border-box',
                  }}>
                    {/* Sheet Header */}
                    <div style={{ borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '16px', color: '#1D4ED8', fontWeight: '800' }}>
                          Liberty Uniform — Production Queue
                        </h2>
                        <p style={{ margin: '3px 0 0 0', fontSize: '10px', color: '#475569' }}>
                          Status: <strong>{tailorStatusFilter || 'All'}</strong> &nbsp;|&nbsp; School: <strong>{tailorSchoolFilter || 'All'}</strong> &nbsp;|&nbsp; Date: {tailorDeliveryFilter || 'All'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '10px', color: '#64748B' }}>
                        <div style={{ fontWeight: '700' }}>Generated: {new Date().toLocaleDateString('en-GB')}</div>
                        <div style={{ marginTop: '2px' }}>{pdfFormat.toUpperCase()} · {pdfOrientation}</div>
                      </div>
                    </div>

                    {/* Garments Table — fixed layout with % column widths so nothing overflows */}
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                      fontSize: pdfScale === 'compact' ? '9px' : (pdfScale === 'large' ? '11.5px' : '10.5px'),
                      color: '#0F172A',
                      marginBottom: '18px'
                    }}>
                      <colgroup>
                        <col style={{ width: '6%' }} />   {/* Order # */}
                        <col style={{ width: '8%' }} />   {/* Product */}
                        <col style={{ width: '13%' }} />  {/* Category */}
                        <col style={{ width: '13%' }} />  {/* School */}
                        <col style={{ width: '4%' }} />   {/* Gender */}
                        <col style={{ width: '4%' }} />   {/* Qty */}
                        <col style={{ width: '29%' }} />  {/* Measurements */}
                        <col style={{ width: '12%' }} />  {/* Notes */}
                        <col style={{ width: '11%' }} />  {/* Delivery */}
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', textAlign: 'left' }}>
                          <th style={{ padding: '6px 5px', overflow: 'hidden', wordBreak: 'break-word' }}>Order #</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden' }}>Product</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden', wordBreak: 'break-word' }}>Category</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden', wordBreak: 'break-word' }}>School</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden' }}>G</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden' }}>Qty</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden', wordBreak: 'break-word' }}>Measurements</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden', wordBreak: 'break-word' }}>Notes</th>
                          <th style={{ padding: '6px 5px', overflow: 'hidden', wordBreak: 'break-word' }}>Delivery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTailorGarments.length === 0 ? (
                          <tr>
                            <td colSpan="9" style={{ padding: '16px', textAlign: 'center', color: '#64748B' }}>
                              No garments match the selected filters.
                            </td>
                          </tr>
                        ) : (
                          sortedTailorGarments.map((row) => (
                            <tr key={row.uniqueRowId} style={{ borderBottom: '1px solid #E2E8F0', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                              <td style={{ padding: '5px', fontWeight: '800', overflow: 'hidden' }}>#{row.orderNumber}</td>
                              <td style={{ padding: '5px', overflow: 'hidden' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  fontSize: '9px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  background: row.product.toLowerCase() === 'shirt' ? '#EFF6FF' : ['pant', 'shorts'].includes(row.product.toLowerCase()) ? '#FAF5FF' : '#FFF1F2',
                                  color: row.product.toLowerCase() === 'shirt' ? '#1D4ED8' : ['pant', 'shorts'].includes(row.product.toLowerCase()) ? '#7C3AED' : '#E11D48',
                                }}>{row.product}</span>
                              </td>
                              <td style={{ padding: '5px', overflow: 'hidden', wordBreak: 'break-word', fontSize: '9.5px' }}>
                                {(() => {
                                  const catVal = row.productionCategory || guessProductionCategory(row);
                                  const catObj = PRODUCTION_CATEGORIES.find(c => c.id === catVal);
                                  return catObj ? catObj.name : (catVal || '-');
                                })()}
                              </td>
                              <td style={{ padding: '5px', overflow: 'hidden', wordBreak: 'break-word' }}>{row.school}</td>
                              <td style={{ padding: '5px', fontWeight: '800', overflow: 'hidden' }}>
                                {row.gender === 'Female' ? 'F' : (row.gender === 'Male' ? 'M' : (row.gender || '-'))}
                              </td>
                              <td style={{ padding: '5px', fontWeight: '800', overflow: 'hidden' }}>{row.quantity}</td>
                              <td style={{ padding: '5px', overflow: 'hidden', wordBreak: 'break-word', fontSize: '9.5px', letterSpacing: '-0.01em' }}>
                                {renderPDFMeasurements(row.product, row.measurements)}
                              </td>
                              <td style={{ padding: '5px', overflow: 'hidden', wordBreak: 'break-word', fontSize: '9.5px', color: '#475569' }}>{row.notes || '-'}</td>
                              <td style={{ padding: '5px', overflow: 'hidden', color: '#E11D48', fontWeight: '600', wordBreak: 'break-word' }}>
                                {formatDateToDMY(row.deliveryDate)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Production Cost Summary Table */}
                    <div style={{ marginTop: '16px', borderTop: '2px solid #0F172A', paddingTop: '12px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <h3 style={{ fontSize: '11px', margin: '0 0 8px 0', color: '#0F172A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Production Cost Summary
                      </h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10px', color: '#0F172A' }}>
                        <colgroup>
                          <col style={{ width: '45%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '22%' }} />
                        </colgroup>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #475569', textAlign: 'left', background: '#F8FAFC' }}>
                            <th style={{ padding: '5px 6px' }}>Component Category</th>
                            <th style={{ padding: '5px 6px', textAlign: 'right' }}>Rate/Unit</th>
                            <th style={{ padding: '5px 6px', textAlign: 'center' }}>Pieces</th>
                            <th style={{ padding: '5px 6px', textAlign: 'right' }}>Total Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productionCostDetails.activeCategories.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ padding: '6px', color: '#64748B', fontStyle: 'italic' }}>
                                No active production categories.
                              </td>
                            </tr>
                          ) : (
                            productionCostDetails.activeCategories.map(cat => (
                              <tr key={cat.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '5px 6px', fontWeight: '600' }}>{cat.name}</td>
                                <td style={{ padding: '5px 6px', textAlign: 'right' }}>Rs.{cat.rate}</td>
                                <td style={{ padding: '5px 6px', textAlign: 'center' }}>{cat.qty}</td>
                                <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '600' }}>Rs.{cat.cost.toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                          <tr style={{ fontWeight: '800', background: '#EFF6FF', borderTop: '2px solid #2563EB' }}>
                            <td style={{ padding: '6px', color: '#1D4ED8' }}>Total Production Cost</td>
                            <td style={{ padding: '6px' }}></td>
                            <td style={{ padding: '6px', textAlign: 'center', color: '#1D4ED8' }}>{productionCostDetails.totalQty} pcs</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: '#1D4ED8' }}>Rs.{productionCostDetails.totalCost.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div> {/* end inner content div */}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showManageModal && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card">
            <button type="button" className="manage-modal-close" onClick={handleCloseManageModal}>
              &times;
            </button>

            {manageStep === 1 && (
              <form onSubmit={handleVerifyCurrentPassword} className="manage-form">
                <h3 className="manage-title">Verify Identity</h3>
                <p className="manage-subtitle">Please enter your current administrator password to continue.</p>

                {manageError && <div className="manage-error-alert">{manageError}</div>}

                <div className="manage-input-group">
                  <label>
                    Current Password
                    <input
                      type="password"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder="Enter current password"
                      required
                    />
                  </label>
                </div>

                <div className="manage-btn-group">
                  <button type="button" className="secondary-btn" onClick={handleCloseManageModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn">
                    Verify Password
                  </button>
                </div>
              </form>
            )}

            {manageStep === 2 && (
              <form onSubmit={handleUpdateCredentials} className="manage-form">
                <h3 className="manage-title">Edit Account Credentials</h3>
                <p className="manage-subtitle">Specify your new administrator username and password.</p>

                {manageError && <div className="manage-error-alert">{manageError}</div>}
                {manageSuccess && <div className="manage-success-alert">{manageSuccess}</div>}

                <div className="manage-input-group">
                  <label>
                    New Username
                    <input
                      type="text"
                      value={newUsernameInput}
                      onChange={(e) => setNewUsernameInput(e.target.value)}
                      placeholder="Enter new username"
                      required
                    />
                  </label>
                </div>

                <div className="manage-input-group">
                  <label>
                    New Password
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                  </label>
                </div>

                <div className="manage-input-group">
                  <label>
                    Confirm New Password
                    <input
                      type="password"
                      value={confirmNewPasswordInput}
                      onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                      placeholder="Confirm new password"
                      required
                    />
                  </label>
                </div>

                <div className="manage-btn-group">
                  <button type="button" className="secondary-btn" onClick={handleCloseManageModal} disabled={Boolean(manageSuccess)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={Boolean(manageSuccess)}>
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showWaitlistModal && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '500px' }}>
            <button type="button" className="manage-modal-close" onClick={handleCloseWaitlistModal}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">
              {selectedWaitlistRequest ? `${getSafeEmoji('✏️')} Edit Waitlist Request` : `${getSafeEmoji('➕')} Add Waitlist Request`}
            </p>
            <p className="manage-modal-subtitle">
              Enter customer and product details for waitlist notification.
            </p>

            <form onSubmit={handleSaveWaitlistRequest}>
              <div className="manage-input-group">
                <label>
                  Customer Name *
                  <input
                    type="text"
                    value={waitlistFormData.customerName}
                    onChange={(e) => setWaitlistFormData({ ...waitlistFormData, customerName: e.target.value })}
                    placeholder="Enter customer name"
                    required
                  />
                </label>
              </div>

              <div className="manage-input-group">
                <label>
                  Contact Number *
                  <input
                    type="text"
                    value={waitlistFormData.contactNumber}
                    onChange={(e) => setWaitlistFormData({ ...waitlistFormData, contactNumber: e.target.value })}
                    placeholder="Enter phone number"
                    required
                  />
                </label>
              </div>

              <div className="manage-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>School Name</span>
                  <button
                    type="button"
                    onClick={() => setShowSchoolManager(!showSchoolManager)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showSchoolManager ? `${getSafeEmoji('✕')} Hide Directory` : `${getSafeEmoji('⚙️')} Manage Directory`}
                  </button>
                </div>

                {!showSchoolManager ? (
                  <div style={{
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '12px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {waitlistSchools.length === 0 ? (
                      <span style={{ fontSize: '12px', color: '#64748B' }}>No registered schools yet. Add one via "Manage Directory".</span>
                    ) : (
                      waitlistSchools.map((s) => {
                        const isChecked = (waitlistFormData.schools || []).includes(s.name)
                        return (
                          <label
                            key={s._id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              flexDirection: 'row',
                              color: 'inherit',
                              margin: 0
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const currentSchools = [...(waitlistFormData.schools || [])]
                                if (e.target.checked) {
                                  currentSchools.push(s.name)
                                } else {
                                  const idx = currentSchools.indexOf(s.name)
                                  if (idx > -1) currentSchools.splice(idx, 1)
                                }
                                setWaitlistFormData({ ...waitlistFormData, schools: currentSchools })
                              }}
                              style={{ width: 'auto', margin: 0 }}
                            />
                            <span>{s.name}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                ) : (
                  /* Inline School Manager Pane */
                  <div style={{
                    background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    {/* Add School Row */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="Type new school name..."
                        value={newSchoolNameInput}
                        onChange={(e) => setNewSchoolNameInput(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          fontSize: '12px',
                          borderRadius: '6px',
                          border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1',
                          background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                          color: 'inherit'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveWaitlistSchool}
                        className="primary-btn"
                        style={{
                          padding: '0 12px',
                          fontSize: '11px',
                          height: '28px',
                          minWidth: 'auto',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        Add
                      </button>
                    </div>

                    {/* Schools List */}
                    <div style={{ maxHeight: '130px', overflowY: 'auto', paddingRight: '4px' }}>
                      {waitlistSchools.length === 0 ? (
                        <p style={{ fontSize: '11px', color: '#64748B', textAlign: 'center', margin: '8px 0' }}>No registered schools yet.</p>
                      ) : (
                        waitlistSchools.map((s) => (
                          <div key={s._id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border-color, #E5E7EB)'
                          }}>
                            {editingSchoolId === s._id ? (
                              <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                <input
                                  type="text"
                                  value={editingSchoolNameInput}
                                  onChange={(e) => setEditingSchoolNameInput(e.target.value)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 6px',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    border: '1px solid #2563EB',
                                    background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                                    color: 'inherit'
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameWaitlistSchool(s._id, editingSchoolNameInput)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                  title="Save Rename"
                                >
                                  {getSafeEmoji('💾')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingSchoolId(null); setEditingSchoolNameInput(''); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                  title="Cancel"
                                >
                                  {getSafeEmoji('❌')}
                                </button>
                              </div>
                            ) : (
                              <>
                                <span style={{ fontSize: '12px', fontWeight: '500' }}>{s.name}</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingSchoolId(s._id); setEditingSchoolNameInput(s.name); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                                    title="Rename School"
                                  >
                                    {getSafeEmoji('✏️')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWaitlistSchool(s._id, s.name)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                                    title="Delete School"
                                  >
                                    {getSafeEmoji('🗑️')}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="manage-input-group">
                <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                  Desired Product Details *
                </label>
                {(waitlistFormData.items || [{ name: '', status: 'Pending' }]).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={item.name || ''}
                      onChange={(e) => {
                        const updated = [...(waitlistFormData.items || [{ name: '', status: 'Pending' }])]
                        updated[idx] = { ...updated[idx], name: e.target.value }
                        setWaitlistFormData({ ...waitlistFormData, items: updated })
                      }}
                      placeholder={`Item #${idx + 1} (e.g. Blazer Size 34)`}
                      required
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...(waitlistFormData.items || [{ name: '', status: 'Pending' }])]
                        updated.splice(idx, 1)
                        setWaitlistFormData({ ...waitlistFormData, items: updated })
                      }}
                      disabled={(waitlistFormData.items || [{ name: '', status: 'Pending' }]).length <= 1}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: (waitlistFormData.items || [{ name: '', status: 'Pending' }]).length > 1 ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        padding: '0 4px',
                        opacity: (waitlistFormData.items || [{ name: '', status: 'Pending' }]).length <= 1 ? 0.3 : 1
                      }}
                      title="Remove Item"
                    >
                      {getSafeEmoji('🗑️')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(waitlistFormData.items || [{ name: '', status: 'Pending' }]), { name: '', status: 'Pending' }]
                    setWaitlistFormData({ ...waitlistFormData, items: updated })
                  }}
                  className="secondary-btn"
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    height: '28px',
                    minWidth: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '4px'
                  }}
                >
                  {getSafeEmoji('➕')} Add Item
                </button>
              </div>

              <div className="manage-input-group">
                <label>
                  Notes
                  <textarea
                    value={waitlistFormData.notes}
                    onChange={(e) => setWaitlistFormData({ ...waitlistFormData, notes: e.target.value })}
                    placeholder="Add any extra details or instructions..."
                    style={{
                      width: '100%',
                      minHeight: '70px',
                      padding: '10px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #CBD5E1',
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </label>
              </div>

              <div className="manage-btn-group" style={{ marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={handleCloseWaitlistModal}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {selectedWaitlistRequest ? 'Save Changes' : 'Add Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cycle Cleanup Confirmation Warning Modal */}
      {showCleanupConfirmModal && cleanupPreviewData && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '440px' }}>
            <button
              type="button"
              className="manage-modal-close"
              onClick={() => {
                setShowCleanupConfirmModal(false)
                setCleanupPreviewData(null)
                setPendingOrderPayload(null)
              }}
            >
              &times;
            </button>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '38px', marginBottom: '8px' }}>{getSafeEmoji('⚠️')}</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#B45309' }}>
                Cycle Cleanup Warning
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                Saving <strong>Order #{cleanupPreviewData.orderNumber}</strong> reaches a cycle threshold.
                This will automatically purge <strong>{cleanupPreviewData.deliveredCount} delivered order(s)</strong> in range <strong>#{cleanupPreviewData.startNum} - #{cleanupPreviewData.endNum}</strong> to free space for the next cycle.
              </p>
              <div style={{ background: '#FEF3C7', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', textAlign: 'left', marginBottom: '20px' }}>
                {getSafeEmoji('ℹ️')} <strong>Safety Note:</strong> Any active (Pending or Ready) orders in this range will remain completely safe.
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowCleanupConfirmModal(false)
                    setCleanupPreviewData(null)
                    setPendingOrderPayload(null)
                  }}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    if (pendingOrderPayload) {
                      executeSubmitOrder(pendingOrderPayload)
                    }
                  }}
                  style={{ flex: 1, padding: '10px', background: '#D97706', borderColor: '#B45309' }}
                >
                  Confirm & Save Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Order (Restock PO) Modal */}
      {showVendorOrderModal && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button type="button" className="manage-modal-close" onClick={() => setShowVendorOrderModal(false)}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">
              {selectedVendorOrder ? `${getSafeEmoji('✏️')} Edit Restock PO ${selectedVendorOrder.poNumber}` : `${getSafeEmoji('➕')} Create New Restock PO`}
            </p>
            <p className="manage-modal-subtitle">
              Issue a bulk manufacturing order to a supplier with products, schools, and size-wise target quantities.
            </p>

            <form onSubmit={handleSaveVendorOrder}>
              {/* PO Number Row */}
              <div className="manage-input-group">
                <label>
                  PO Number
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#2563EB', letterSpacing: '0.02em' }}>
                      PO-
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={vendorOrderFormData.poNumber}
                      onChange={(e) => setVendorOrderFormData({ ...vendorOrderFormData, poNumber: e.target.value })}
                      disabled={Boolean(selectedVendorOrder)}
                      style={{ width: '100px', fontWeight: '700', fontSize: '14px' }}
                      placeholder="e.g. 1"
                    />
                    {!selectedVendorOrder && (
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        → Will be saved as <strong>PO-{String(Number(vendorOrderFormData.poNumber) || getNextPoNumber(vendorOrders)).padStart(4, '0')}</strong>
                      </span>
                    )}
                  </div>
                </label>
              </div>

              <div className="manage-input-group">
                <label>
                  Supplier Name *
                  <select
                    value={vendorOrderFormData.partyName}
                    onChange={(e) => setVendorOrderFormData({ ...vendorOrderFormData, partyName: e.target.value })}
                    required
                  >
                    <option value="">-- Select Supplier --</option>
                    {parties.map(p => (
                      <option key={p._id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="manage-input-group">
                <label>
                  Expected Target Delivery Date (Optional)
                  <input
                    type="date"
                    value={vendorOrderFormData.targetDate}
                    onChange={(e) => setVendorOrderFormData({ ...vendorOrderFormData, targetDate: e.target.value })}
                  />
                </label>
              </div>

              {/* Multi-Product Entry Section */}
              <div style={{ margin: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontWeight: '800', fontSize: '14px', margin: 0, color: '#2563EB' }}>
                    Products & Size Quantities *
                  </label>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setVendorOrderFormData(prev => ({
                        ...prev,
                        products: [
                          ...(prev.products || []),
                          {
                            productName: '',
                            school: '',
                            sizeBreakdown: [
                              { size: '28', orderedQty: '' },
                              { size: '30', orderedQty: '' },
                              { size: '32', orderedQty: '' }
                            ]
                          }
                        ]
                      }))
                    }}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {getSafeEmoji('➕')} Add Another Product to Order
                  </button>
                </div>

                {(vendorOrderFormData.products || []).map((prod, pIdx) => (
                  <div
                    key={pIdx}
                    style={{
                      background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                      padding: '14px',
                      borderRadius: '10px',
                      marginBottom: '16px',
                      border: '1px solid var(--border-color, #E2E8F0)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: theme === 'dark' ? '#38BDF8' : '#0284C7' }}>
                        Product #{pIdx + 1}
                      </span>
                      {(vendorOrderFormData.products || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updatedProds = [...(vendorOrderFormData.products || [])]
                            updatedProds.splice(pIdx, 1)
                            setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          {getSafeEmoji('🗑️')} Remove Product
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                          Product / Garment Type *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. T-Shirt, Jeans, Track Suit, Pant"
                          value={prod.productName}
                          onChange={(e) => {
                            const updatedProds = [...(vendorOrderFormData.products || [])]
                            updatedProds[pIdx] = { ...updatedProds[pIdx], productName: e.target.value }
                            setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                          }}
                          required
                          style={{ padding: '8px 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                          School / Firm Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. DPS School, St. Xavier, Reliance Corp"
                          value={prod.school}
                          onChange={(e) => {
                            const updatedProds = [...(vendorOrderFormData.products || [])]
                            updatedProds[pIdx] = { ...updatedProds[pIdx], school: e.target.value }
                            setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                          }}
                          required
                          style={{ padding: '8px 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: theme === 'dark' ? '#0F172A' : '#F8FAFC', border: '1px solid var(--border-color, #E2E8F0)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: theme === 'dark' ? '#60A5FA' : '#2563EB', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Product Specifications
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const curSpecs = getNormalizedSpecifications(prod)
                            const updated = [...curSpecs, { label: '', value: '' }]
                            setVendorOrderFormData(prev => ({
                              ...prev,
                              products: (prev.products || []).map((item, idx) => idx === pIdx ? { ...item, specifications: updated } : item)
                            }))
                          }}
                          style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', background: '#059669', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                        >
                          ➕ Add Category
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {getNormalizedSpecifications(prod).map((spec, sIdx, allSpecs) => {
                          const isEditingLabel = editingLabelKey === `vendor-${pIdx}-${sIdx}`
                          return (
                            <div
                              key={sIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color, #CBD5E1)',
                                boxSizing: 'border-box',
                                width: '100%',
                                transition: 'all 0.15s ease'
                              }}
                            >

                              {/* Category Label Section */}
                              <div style={{ width: '165px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isEditingLabel ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                    <input
                                      type="text"
                                      autoFocus
                                      value={spec.label}
                                      onChange={(e) => {
                                        const updated = [...allSpecs]
                                        updated[sIdx] = { ...updated[sIdx], label: e.target.value }
                                        setVendorOrderFormData(prev => ({
                                          ...prev,
                                          products: (prev.products || []).map((item, idx) => idx === pIdx ? { ...item, specifications: updated } : item)
                                        }))
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') setEditingLabelKey(null)
                                      }}
                                      style={{ width: '100%', fontSize: '11px', padding: '3px 5px', fontWeight: '700', borderRadius: '4px', border: '1px solid #2563EB', boxSizing: 'border-box' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setEditingLabelKey(null)}
                                      title="Save category name"
                                      style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: '#2563EB', color: '#FFF', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                                    >
                                      ✓
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                    <span
                                      title={spec.label}
                                      style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#334155', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.25', flex: 1 }}
                                    >
                                      {spec.label || 'Category'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingLabelKey(`vendor-${pIdx}-${sIdx}`)}
                                      title="Edit Category Name"
                                      style={{ background: 'none', border: 'none', fontSize: '11px', color: '#64748B', cursor: 'pointer', padding: '2px', opacity: 0.8, flexShrink: 0 }}
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Value Detail Input */}
                              <input
                                type="text"
                                value={spec.value}
                                onChange={(e) => {
                                  const updated = [...allSpecs]
                                  updated[sIdx] = { ...updated[sIdx], value: e.target.value }
                                  setVendorOrderFormData(prev => ({
                                    ...prev,
                                    products: (prev.products || []).map((item, idx) => idx === pIdx ? { ...item, specifications: updated } : item)
                                  }))
                                }}
                                placeholder="Enter detail / value (optional)"
                                style={{ flex: 1, minWidth: '0', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                              />

                              {/* Delete Category Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = allSpecs.filter((_, idx) => idx !== sIdx)
                                  setVendorOrderFormData(prev => ({
                                    ...prev,
                                    products: (prev.products || []).map((item, idx) => idx === pIdx ? { ...item, specifications: updated } : item)
                                  }))
                                }}
                                title="Delete Category"
                                style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5', cursor: 'pointer', fontWeight: '700', flexShrink: 0 }}
                              >
                                🗑️
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Size Breakdown per Product */}
                    <div style={{ background: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontWeight: '700', fontSize: '12px', margin: 0 }}>
                          Size-wise Ordered Quantity *
                        </label>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            const updatedProds = [...(vendorOrderFormData.products || [])]
                            const currentBreakdown = [...(updatedProds[pIdx].sizeBreakdown || [])]
                            currentBreakdown.push({ size: '', orderedQty: '' })
                            updatedProds[pIdx] = { ...updatedProds[pIdx], sizeBreakdown: currentBreakdown }
                            setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                          }}
                          style={{ fontSize: '10px', padding: '2px 8px' }}
                        >
                          + Add Size Row
                        </button>
                      </div>

                      {(prod.sizeBreakdown || []).map((sb, sIdx) => (
                        <div key={sIdx} className="restock-modal-size-row" style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                          <div style={{ flex: 1.2 }}>
                            <input
                              type="text"
                              placeholder="Size (e.g. 28, 30, M, L)"
                              value={sb.size}
                              onChange={(e) => {
                                const updatedProds = [...(vendorOrderFormData.products || [])]
                                const updatedBreakdown = [...(updatedProds[pIdx].sizeBreakdown || [])]
                                updatedBreakdown[sIdx] = { ...updatedBreakdown[sIdx], size: e.target.value }
                                updatedProds[pIdx] = { ...updatedProds[pIdx], sizeBreakdown: updatedBreakdown }
                                setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                              }}
                              required
                              style={{ padding: '4px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <input
                              type="number"
                              min="1"
                              placeholder="Ordered Qty"
                              value={sb.orderedQty}
                              onChange={(e) => {
                                const updatedProds = [...(vendorOrderFormData.products || [])]
                                const updatedBreakdown = [...(updatedProds[pIdx].sizeBreakdown || [])]
                                updatedBreakdown[sIdx] = { ...updatedBreakdown[sIdx], orderedQty: e.target.value }
                                updatedProds[pIdx] = { ...updatedProds[pIdx], sizeBreakdown: updatedBreakdown }
                                setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                              }}
                              required
                              style={{ padding: '4px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Cost/Unit (₹)"
                              value={sb.unitPrice !== undefined ? sb.unitPrice : ''}
                              onChange={(e) => {
                                const updatedProds = [...(vendorOrderFormData.products || [])]
                                const updatedBreakdown = [...(updatedProds[pIdx].sizeBreakdown || [])]
                                updatedBreakdown[sIdx] = { ...updatedBreakdown[sIdx], unitPrice: e.target.value }
                                updatedProds[pIdx] = { ...updatedProds[pIdx], sizeBreakdown: updatedBreakdown }
                                setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                              }}
                              style={{ padding: '4px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedProds = [...(vendorOrderFormData.products || [])]
                              const updatedBreakdown = [...(updatedProds[pIdx].sizeBreakdown || [])]
                              updatedBreakdown.splice(sIdx, 1)
                              updatedProds[pIdx] = { ...updatedProds[pIdx], sizeBreakdown: updatedBreakdown }
                              setVendorOrderFormData({ ...vendorOrderFormData, products: updatedProds })
                            }}
                            disabled={(prod.sizeBreakdown || []).length <= 1}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: (prod.sizeBreakdown || []).length <= 1 ? 0.3 : 1 }}
                            title="Remove Row"
                          >
                            {getSafeEmoji('🗑️')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="manage-input-group">
                <label>
                  PO Order Special Instructions / Notes (Optional &mdash; Unlimited Length)
                  <textarea
                    rows={3}
                    value={vendorOrderFormData.notes}
                    onChange={(e) => setVendorOrderFormData({ ...vendorOrderFormData, notes: e.target.value })}
                    placeholder="Enter any detailed notes, special instructions, fabric specs, delivery addresses, terms..."
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: '1.5',
                      boxSizing: 'border-box'
                    }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowVendorOrderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {selectedVendorOrder ? 'Save Order Changes' : 'Place Restock PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Stock Installment Modal */}
      {showInstallmentModal && selectedOrderForInstallment && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button type="button" className="manage-modal-close" onClick={() => { setShowInstallmentModal(false); setSelectedOrderForInstallment(null); }}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">📦 Record Stock Delivery Batch</p>
            <p className="manage-modal-subtitle">
              Order <strong>{selectedOrderForInstallment.poNumber}</strong> for Supplier <strong>{selectedOrderForInstallment.partyName}</strong>
            </p>

            <form onSubmit={handleLogInstallment}>
              {/* Items Table */}
              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px' }}>Received Stock Quantities by Size:</div>
                <table className="mini-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Product &amp; Size</th>
                      <th>Ordered</th>
                      <th>Previously Received</th>
                      <th>Pending Balance</th>
                      <th>New Received Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(installmentFormData.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.productName} - Size {item.size}</strong></td>
                        <td>{item.orderedQty} pcs</td>
                        <td style={{ color: '#059669', fontWeight: '700' }}>{item.receivedQty} pcs</td>
                        <td style={{ color: item.remainingQty > 0 ? '#D97706' : '#64748B', fontWeight: item.remainingQty > 0 ? '700' : 'normal' }}>
                          {item.remainingQty} pcs
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={item.newQty}
                            onChange={(e) => {
                              const updated = [...(installmentFormData.items || [])]
                              updated[idx] = { ...updated[idx], newQty: e.target.value }
                              setInstallmentFormData({ ...installmentFormData, items: updated })
                            }}
                            placeholder="0"
                            style={{ width: '80px', padding: '4px 6px', fontSize: '12px', fontWeight: '800' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="manage-input-group">
                <label>
                  Batch Notes / Remarks
                  <textarea
                    rows={2}
                    value={installmentFormData.notes}
                    onChange={(e) => setInstallmentFormData({ ...installmentFormData, notes: e.target.value })}
                    placeholder="e.g. Received 50 pcs via Speed Post / Supplier Delivery Van..."
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={() => { setShowInstallmentModal(false); setSelectedOrderForInstallment(null); }}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" style={{ background: '#059669', borderColor: '#059669' }}>
                  Confirm Stock Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Installment Modal */}
      {showEditInstallmentModal && editingInstallment && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button type="button" className="manage-modal-close" onClick={() => { setShowEditInstallmentModal(false); setEditingInstallment(null); }}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">✏️ Edit Stock Delivery Batch</p>
            <p className="manage-modal-subtitle">
              Modify or adjust received stock quantities for this batch log.
            </p>

            <form onSubmit={handleUpdateInstallment}>
              {/* Items Table */}
              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px' }}>Adjust Received Stock Quantities:</div>
                <table className="mini-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px' }}>Product &amp; Size</th>
                      <th style={{ padding: '8px' }}>Cost / Unit</th>
                      <th style={{ padding: '8px' }}>Ordered</th>
                      <th style={{ padding: '8px' }}>Other Batches</th>
                      <th style={{ padding: '8px' }}>Qty in This Batch</th>
                      <th style={{ padding: '8px' }}>Batch Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(editingInstallment.items || []).map((item, idx) => {
                      const uPrice = Number(item.unitPrice || 0)
                      const bQty = Number(item.qty || 0)
                      const bValue = uPrice > 0 ? bQty * uPrice : 0
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '8px' }}><strong>{item.productName} - Size {item.size}</strong></td>
                          <td style={{ padding: '8px', color: '#059669', fontWeight: '600' }}>
                            {uPrice > 0 ? `₹${uPrice.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td style={{ padding: '8px' }}>{item.orderedQty || 0} pcs</td>
                          <td style={{ padding: '8px', color: '#64748B' }}>{item.otherReceived || 0} pcs</td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => {
                                const updated = [...(editingInstallment.items || [])]
                                updated[idx] = { ...updated[idx], qty: e.target.value }
                                setEditingInstallment({ ...editingInstallment, items: updated })
                              }}
                              placeholder="0"
                              style={{ width: '80px', padding: '4px 6px', fontSize: '12px', fontWeight: '800' }}
                            />
                          </td>
                          <td style={{ padding: '8px', color: '#059669', fontWeight: '700' }}>
                            {bValue > 0 ? `₹${bValue.toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="manage-input-group">
                <label>
                  Batch Notes / Remarks
                  <textarea
                    rows={2}
                    value={editingInstallment.notes}
                    onChange={(e) => setEditingInstallment({ ...editingInstallment, notes: e.target.value })}
                    placeholder="e.g. Updated batch count after physical audit"
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={() => { setShowEditInstallmentModal(false); setEditingInstallment(null); }}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" style={{ background: '#059669', borderColor: '#059669' }}>
                  Save Batch Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Manager Directory Modal */}
      {showPartyManagerModal && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              type="button"
              className="manage-modal-close"
              onClick={() => {
                setShowPartyManagerModal(false)
                setEditingSupplierId(null)
                setPartyFormData({ name: '', contactNumber: '', notes: '' })
              }}
            >
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">
              {getSafeEmoji('🏭')} Manage Supplier Directory ({parties.length})
            </p>
            <p className="manage-modal-subtitle">
              Add supplier profiles to issue bulk restock orders.
            </p>

            {/* Add / Edit Supplier Form */}
            <form onSubmit={handleSaveParty} style={{ background: theme === 'dark' ? '#0F172A' : '#F8FAFC', padding: '14px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-color, #E2E8F0)' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 10px 0' }}>
                {editingSupplierId ? 'Edit Supplier Details:' : 'Add New Supplier:'}
              </p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Supplier Name * (e.g. Ramsons)"
                  value={partyFormData.name}
                  onChange={(e) => setPartyFormData({ ...partyFormData, name: e.target.value })}
                  required
                  style={{ flex: 1, minWidth: '160px', padding: '6px 10px', fontSize: '13px' }}
                />
                <input
                  type="text"
                  placeholder="Contact Number (Optional)"
                  value={partyFormData.contactNumber}
                  onChange={(e) => setPartyFormData({ ...partyFormData, contactNumber: e.target.value })}
                  style={{ flex: 1, minWidth: '140px', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="primary-btn" style={{ flex: 1, padding: '8px', fontSize: '13px', marginTop: '4px' }}>
                  {editingSupplierId ? 'Save Supplier Changes' : '+ Add Supplier to Directory'}
                </button>
                {editingSupplierId && (
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ padding: '8px', fontSize: '13px', marginTop: '4px' }}
                    onClick={() => {
                      setEditingSupplierId(null)
                      setPartyFormData({ name: '', contactNumber: '', notes: '' })
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Supplier List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <p style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>
                  Existing Suppliers ({parties.length}):
                </p>
                {parties.length > 3 && (
                  <input
                    type="text"
                    placeholder="🔍 Search supplier..."
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color, #CBD5E1)', width: '180px' }}
                  />
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  border: '1px solid var(--border-color, #E2E8F0)',
                  borderRadius: '8px',
                  padding: '8px',
                  background: theme === 'dark' ? '#0F172A' : '#FAFAFA'
                }}
              >
                {parties.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748B', padding: '12px', textAlign: 'center', margin: 0 }}>No suppliers added yet.</p>
                ) : (() => {
                  const filtered = parties.filter(p => {
                    if (!supplierSearchQuery || !supplierSearchQuery.trim()) return true
                    const q = supplierSearchQuery.toLowerCase().trim()
                    return (p.name || '').toLowerCase().includes(q) || (p.contactNumber || '').toLowerCase().includes(q)
                  })
                  if (filtered.length === 0) {
                    return <p style={{ fontSize: '12px', color: '#64748B', padding: '12px', textAlign: 'center', margin: 0 }}>No suppliers found matching "{supplierSearchQuery}".</p>
                  }
                  return filtered.map(p => (
                    <div
                      key={p._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #E2E8F0)',
                        background: theme === 'dark' ? '#1E293B' : '#FFFFFF'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>
                          {p.name} {p.contactNumber && <span style={{ fontWeight: 'normal', color: '#64748B', fontSize: '11px' }}>({p.contactNumber})</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            setEditingSupplierId(p._id)
                            setPartyFormData({ name: p.name, contactNumber: p.contactNumber || '', notes: p.notes || '' })
                          }}
                          title="Edit Supplier Details"
                        >
                          {getSafeEmoji('✏️')}
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDeleteParty(p._id, p.name)}
                          title="Delete Supplier"
                        >
                          {getSafeEmoji('🗑️')}
                        </button>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '20px' }}>
              <button type="button" className="secondary-btn" onClick={() => setShowPartyManagerModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cycle Cleanup Confirmation Warning Modal */}
      {/* Restock PO PDF Export & Live Preview Modal */}
      {showPOPDFModal && selectedPOForPDF && (
        <div className="pdf-modal-backdrop">
          <div className="pdf-modal-card">
            <div className="pdf-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{getSafeEmoji('📄')} PO PDF Export & Live Preview</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
                  Configure paper format, orientation, margins, and density with a live sheet preview for {selectedPOForPDF.poNumber}.
                </p>
              </div>
              <button
                type="button"
                className="manage-modal-close"
                onClick={() => setShowPOPDFModal(false)}
                style={{ position: 'static', fontSize: '20px' }}
              >
                {getSafeEmoji('✕')}
              </button>
            </div>

            <div className="pdf-modal-body">
              {/* Settings Controls Sidebar */}
              <div className="pdf-controls-sidebar">
                <div className="pdf-control-group">
                  <label>FILE NAME</label>
                  <input
                    type="text"
                    value={poPdfFileName}
                    onChange={(e) => setPoPdfFileName(e.target.value)}
                    placeholder="Enter file name"
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="pdf-control-group">
                  <label>ORIENTATION</label>
                  <select
                    value={poPdfOrientation}
                    onChange={(e) => setPoPdfOrientation(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="landscape">Landscape (Horizontal &mdash; Recommended)</option>
                    <option value="portrait">Portrait (Vertical)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>PAPER FORMAT</label>
                  <select
                    value={poPdfFormat}
                    onChange={(e) => setPoPdfFormat(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="a4">A4 (210 &times; 297 mm)</option>
                    <option value="letter">Letter (8.5 &times; 11 in)</option>
                    <option value="legal">Legal (8.5 &times; 14 in)</option>
                    <option value="a3">A3 (297 &times; 420 mm)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>MARGINS</label>
                  <select
                    value={poPdfMargin}
                    onChange={(e) => setPoPdfMargin(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="compact">Compact (3mm)</option>
                    <option value="normal">Normal (6mm)</option>
                    <option value="wide">Wide (12mm)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>TABLE SCALE</label>
                  <select
                    value={poPdfScale}
                    onChange={(e) => setPoPdfScale(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="compact">Compact (80%)</option>
                    <option value="normal">Normal (100%)</option>
                    <option value="large">Large (120%)</option>
                  </select>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={executePOPDFDownload}
                    disabled={exportingPOPDF}
                    style={{ padding: '12px', width: '100%', fontSize: '13px', justifyContent: 'center' }}
                  >
                    {exportingPOPDF ? `${getSafeEmoji('⌛')} Generating PDF...` : `${getSafeEmoji('⬇️')} Download PDF`}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setShowPOPDFModal(false)}
                    style={{ padding: '10px', width: '100%', fontSize: '13px', justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Right Live Sheet Preview */}
              <div className="pdf-preview-pane">
                {(() => {
                  const order = selectedPOForPDF
                  const prods = getNormalizedProducts(order)
                  let poTotalCost = 0
                  let poHasAnyPrices = false
                  prods.forEach(p => {
                    const legacyPrice = Number(p.unitPrice || 0)
                      ; (p.sizeBreakdown || []).forEach(sb => {
                        const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
                        if (sbPrice > 0) {
                          poTotalCost += (sb.receivedQty || 0) * sbPrice
                          poHasAnyPrices = true
                        }
                      })
                  })

                  return (
                    <div
                      ref={poPdfPreviewSheetRef}
                      className="pdf-sheet-page"
                      style={{
                        background: '#FFFFFF',
                        color: '#0F172A',
                        padding: poPdfMargin === 'compact' ? '12px' : poPdfMargin === 'wide' ? '32px' : '20px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        borderRadius: '4px',
                        minHeight: '600px'
                      }}
                    >
                      {/* Document Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2563EB', paddingBottom: '12px', marginBottom: '16px' }}>
                        <div>
                          <h2 style={{ margin: 0, fontSize: '18px', color: '#2563EB', fontWeight: '800' }}>
                            Liberty Uniform &mdash; Purchase Order
                          </h2>
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                            <strong>PO Number:</strong> {order.poNumber} &nbsp;|&nbsp; <strong>Supplier:</strong> {order.partyName}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748B' }}>
                          <div>Generated: {new Date().toLocaleDateString()}</div>
                        </div>
                      </div>

                      {/* Meta Information Bar */}
                      <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid #E2E8F0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <div>Target Delivery Date: <strong>{order.targetDate || 'Not specified'}</strong></div>
                        <div>Total PO Value: <strong style={{ color: poHasAnyPrices ? '#059669' : '#64748B' }}>{poHasAnyPrices ? `₹${poTotalCost.toLocaleString('en-IN')}` : '-'}</strong></div>
                      </div>

                      {/* Product Tables */}
                      {prods.map((prod, pIdx) => {
                        const sortedSizes = sortSizesAscending(prod.sizeBreakdown || [])
                        const legacyPrice = Number(prod.unitPrice || 0)
                        let totalProdOrdered = 0
                        let totalProdReceived = 0
                        let totalProdPending = 0
                        let totalProdCost = 0

                        sortedSizes.forEach(sb => {
                          const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
                          totalProdOrdered += (sb.orderedQty || 0)
                          totalProdReceived += (sb.receivedQty || 0)
                          totalProdPending += Math.max(0, (sb.orderedQty || 0) - (sb.receivedQty || 0))
                          totalProdCost += sbPrice > 0 ? (sb.receivedQty || 0) * sbPrice : 0
                        })

                        return (
                          <div key={pIdx} style={{ marginBottom: '16px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ fontWeight: '800', fontSize: '13px', color: '#0284C7', marginBottom: '8px' }}>
                              Product {pIdx + 1} &mdash; {prod.productName} {prod.school ? `(School/Firm: ${prod.school})` : ''}
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                              <thead>
                                <tr style={{ background: '#2563EB', color: '#FFFFFF' }}>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Size</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Cost / Unit</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Ordered</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Received</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Pending</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Row Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedSizes.map((sb) => {
                                  const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
                                  const recQty = sb.receivedQty || 0
                                  const ordQty = sb.orderedQty || 0
                                  const pending = Math.max(0, ordQty - recQty)
                                  const surplus = recQty > ordQty ? recQty - ordQty : 0
                                  const rowCost = sbPrice > 0 ? recQty * sbPrice : 0
                                  return (
                                    <tr key={sb.size} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                      <td style={{ padding: '5px 8px', fontWeight: '700' }}>{sb.size}</td>
                                      <td style={{ padding: '5px 8px', color: '#475569' }}>{sbPrice > 0 ? `₹${sbPrice}` : '-'}</td>
                                      <td style={{ padding: '5px 8px' }}>{ordQty} pcs</td>
                                      <td style={{ padding: '5px 8px', color: '#059669', fontWeight: '600' }}>
                                        {recQty} pcs {surplus > 0 ? `(+${surplus} Extra)` : ''}
                                      </td>
                                      <td style={{ padding: '5px 8px', color: pending > 0 ? '#D97706' : '#059669', fontWeight: '600' }}>{pending > 0 ? `${pending} pcs` : 'Done'}</td>
                                      <td style={{ padding: '5px 8px', color: '#059669', fontWeight: '700' }}>{rowCost > 0 ? `₹${rowCost.toLocaleString('en-IN')}` : '-'}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot style={{ background: '#F8FAFC', fontWeight: '800', borderTop: '2px solid #CBD5E1' }}>
                                <tr>
                                  <td style={{ padding: '6px 8px' }}>Total</td>
                                  <td style={{ padding: '6px 8px' }}>—</td>
                                  <td style={{ padding: '6px 8px', color: '#2563EB' }}>{totalProdOrdered} pcs</td>
                                  <td style={{ padding: '6px 8px', color: '#059669' }}>{totalProdReceived} pcs</td>
                                  <td style={{ padding: '6px 8px', color: totalProdPending > 0 ? '#D97706' : '#059669' }}>{totalProdPending > 0 ? `${totalProdPending} pcs` : 'Done'}</td>
                                  <td style={{ padding: '6px 8px', color: '#059669' }}>{totalProdCost > 0 ? `₹${totalProdCost.toLocaleString('en-IN')}` : '-'}</td>
                                </tr>
                              </tfoot>
                            </table>

                            {/* Total Product Cost summary below table */}
                            {totalProdCost > 0 && (
                              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '700', color: '#059669' }}>
                                Total Product Cost: ₹{totalProdCost.toLocaleString('en-IN')}
                                <span style={{ fontWeight: '400', color: '#64748B', marginLeft: '6px' }}>({totalProdReceived} pcs received)</span>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Total PO Value block */}
                      {poHasAnyPrices && (
                        <div style={{ background: '#EFF6FF', border: '2px solid #2563EB', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E40AF' }}>Total PO Value</span>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: '#2563EB' }}>₹{poTotalCost.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {/* Received Stock Batches Section */}
                      {order.installments && order.installments.length > 0 && (
                        <div style={{ marginTop: '16px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '12px' }}>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: '#059669', marginBottom: '8px' }}>
                            Received Stock Installment History (Batches)
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                              <tr style={{ background: '#059669', color: '#FFFFFF' }}>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Batch #</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Received Date</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Received Qty</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Product & Size Breakdown</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.installments.map((inst, idx) => {
                                const bTotal = (inst.items || []).reduce((s, i) => s + (i.qty || 0), 0)
                                const itemsStr = (inst.items || []).map(i => `${i.productName ? i.productName + ' ' : ''}Size ${i.size}: ${i.qty}pcs`).join(' • ')
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '5px 8px', fontWeight: '700' }}>Batch #{idx + 1}</td>
                                    <td style={{ padding: '5px 8px' }}>{new Date(inst.receivedAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '5px 8px', color: '#059669', fontWeight: '700' }}>{bTotal} pcs</td>
                                    <td style={{ padding: '5px 8px' }}>{itemsStr}</td>
                                    <td style={{ padding: '5px 8px', color: '#64748B' }}>{inst.notes || '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Notes Section */}
                      {order.notes && (
                        <div style={{ background: '#FEF3C7', padding: '10px 14px', borderRadius: '6px', border: '1px solid #FCD34D', fontSize: '11px', color: '#92400E', marginTop: '12px' }}>
                          <strong>PO Special Instructions / Notes:</strong> {order.notes}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Order Modal */}
      {showBulkOrderModal && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button type="button" className="manage-modal-close" onClick={() => setShowBulkOrderModal(false)}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">
              {selectedBulkOrder ? `${getSafeEmoji('✏️')} Edit Client Order ${getDisplayCoNumber(selectedBulkOrder)}` : `${getSafeEmoji('➕')} Create Client Order`}
            </p>
            <p className="manage-modal-subtitle">
              Issue a bulk supply order to a client with products, school/firm details, and size-wise target quantities.
            </p>

            <form onSubmit={handleSaveBulkOrder}>
              {/* BO Number Row */}
              <div className="manage-input-group">
                <label>
                  Client Order Number (CO Number)
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#059669', letterSpacing: '0.02em' }}>
                      CO-
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={bulkOrderFormData.boNumber}
                      onChange={(e) => setBulkOrderFormData({ ...bulkOrderFormData, boNumber: e.target.value })}
                      disabled={Boolean(selectedBulkOrder)}
                      style={{ width: '100px', fontWeight: '700', fontSize: '14px' }}
                      placeholder="e.g. 1"
                    />
                    {!selectedBulkOrder && (
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        → Will be saved as <strong>CO-{String(Number(bulkOrderFormData.boNumber) || getNextCoNumber(bulkOrders)).padStart(4, '0')}</strong>
                      </span>
                    )}
                  </div>
                </label>
              </div>

              {/* Client Selection */}
              <div className="manage-input-group">
                <label>
                  Client Firm / Customer Name *
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={bulkOrderFormData.clientName}
                      onChange={(e) => setBulkOrderFormData({ ...bulkOrderFormData, clientName: e.target.value })}
                      required
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}
                    >
                      {clients.length === 0 ? (
                        <option value="">No registered clients. Type client name below or add via directory.</option>
                      ) : (
                        clients.map(c => (
                          <option key={c._id} value={c.name}>{c.name}</option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setEditingClientId(null)
                        setClientFormData({ name: '', contactNumber: '', address: '', email: '', notes: '' })
                        setShowClientManagerModal(true)
                      }}
                      style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      + New Client
                    </button>
                  </div>
                </label>
              </div>

              {/* Target Delivery Date */}
              <div className="manage-input-group">
                <label>
                  Target Delivery Date (Optional)
                  <input
                    type="date"
                    value={bulkOrderFormData.targetDate}
                    onChange={(e) => setBulkOrderFormData({ ...bulkOrderFormData, targetDate: e.target.value })}
                  />
                </label>
              </div>

              {/* Products Section */}
              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800' }}>Products & Size Breakdown</span>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setBulkOrderFormData({
                        ...bulkOrderFormData,
                        products: [
                          ...(bulkOrderFormData.products || []),
                          { productName: '', frontLogoCost: '', backLogoCost: '', sizeBreakdown: [{ size: '28', orderedQty: '', unitPrice: '' }] }
                        ]
                      })
                    }}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    + Add Product
                  </button>
                </div>

                {(bulkOrderFormData.products || []).map((p, pIdx) => (
                  <div key={pIdx} style={{ background: theme === 'dark' ? '#1E293B' : '#F8FAFC', padding: '14px', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--border-color, #E2E8F0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669' }}>Product #{pIdx + 1}</span>
                      {bulkOrderFormData.products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newProds = bulkOrderFormData.products.filter((_, idx) => idx !== pIdx)
                            setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                        >
                          {getSafeEmoji('✕')} Remove Product
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Product Category / Name *</label>
                        <input
                          type="text"
                          value={p.productName}
                          onChange={(e) => {
                            const newProds = [...bulkOrderFormData.products]
                            newProds[pIdx].productName = e.target.value
                            setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                          }}
                          placeholder="e.g. Blazer, Trackpant, Shirt"
                          required
                          style={{ fontSize: '13px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: theme === 'dark' ? '#0F172A' : '#F8FAFC', border: '1px solid var(--border-color, #E2E8F0)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: theme === 'dark' ? '#34D399' : '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Product Specifications
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const curSpecs = getNormalizedSpecifications(p)
                            const updated = [...curSpecs, { label: '', value: '' }]
                            const newProds = [...bulkOrderFormData.products]
                            newProds[pIdx] = { ...newProds[pIdx], specifications: updated }
                            setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                          }}
                          style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', background: '#059669', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                        >
                          ➕ Add Category
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {getNormalizedSpecifications(p).map((spec, sIdx, allSpecs) => {
                          const isEditingLabel = editingLabelKey === `bulk-${pIdx}-${sIdx}`
                          return (
                            <div
                              key={sIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color, #CBD5E1)',
                                boxSizing: 'border-box',
                                width: '100%',
                                transition: 'all 0.15s ease'
                              }}
                            >

                              {/* Category Label Section */}
                              <div style={{ width: '165px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isEditingLabel ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                    <input
                                      type="text"
                                      autoFocus
                                      value={spec.label}
                                      onChange={(e) => {
                                        const updated = [...allSpecs]
                                        updated[sIdx] = { ...updated[sIdx], label: e.target.value }
                                        const newProds = [...bulkOrderFormData.products]
                                        newProds[pIdx] = { ...newProds[pIdx], specifications: updated }
                                        setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') setEditingLabelKey(null)
                                      }}
                                      style={{ width: '100%', fontSize: '11px', padding: '3px 5px', fontWeight: '700', borderRadius: '4px', border: '1px solid #059669', boxSizing: 'border-box' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setEditingLabelKey(null)}
                                      title="Save category name"
                                      style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', background: '#059669', color: '#FFF', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                                    >
                                      ✓
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                    <span
                                      title={spec.label}
                                      style={{ fontSize: '12px', fontWeight: '700', color: theme === 'dark' ? '#CBD5E1' : '#334155', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.25', flex: 1 }}
                                    >
                                      {spec.label || 'Category'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingLabelKey(`bulk-${pIdx}-${sIdx}`)}
                                      title="Edit Category Name"
                                      style={{ background: 'none', border: 'none', fontSize: '11px', color: '#64748B', cursor: 'pointer', padding: '2px', opacity: 0.8, flexShrink: 0 }}
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Value Detail Input */}
                              <input
                                type="text"
                                value={spec.value}
                                onChange={(e) => {
                                  const updated = [...allSpecs]
                                  updated[sIdx] = { ...updated[sIdx], value: e.target.value }
                                  const newProds = [...bulkOrderFormData.products]
                                  newProds[pIdx] = { ...newProds[pIdx], specifications: updated }
                                  setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                                }}
                                placeholder="Enter detail / value (optional)"
                                style={{ flex: 1, minWidth: '0', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                              />

                              {/* Delete Category Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = allSpecs.filter((_, idx) => idx !== sIdx)
                                  const newProds = [...bulkOrderFormData.products]
                                  newProds[pIdx] = { ...newProds[pIdx], specifications: updated }
                                  setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                                }}
                                title="Delete Category"
                                style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5', cursor: 'pointer', fontWeight: '700', flexShrink: 0 }}
                              >
                                🗑️
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Optional Front & Back Logo Costs Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', background: theme === 'dark' ? '#0F172A' : '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #E2E8F0)' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Front Logo Cost (₹/pc) (Optional)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={p.frontLogoCost !== undefined ? p.frontLogoCost : ''}
                          onChange={(e) => {
                            const newProds = [...bulkOrderFormData.products]
                            newProds[pIdx].frontLogoCost = e.target.value
                            setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                          }}
                          placeholder="e.g. 25"
                          style={{ fontSize: '12px', padding: '6px', width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Back Logo Cost (₹/pc) (Optional)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={p.backLogoCost !== undefined ? p.backLogoCost : ''}
                          onChange={(e) => {
                            const newProds = [...bulkOrderFormData.products]
                            newProds[pIdx].backLogoCost = e.target.value
                            setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                          }}
                          placeholder="e.g. 35"
                          style={{ fontSize: '12px', padding: '6px', width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    {/* Size Breakdown Rows */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>Sizes, Quantities & Costs:</div>
                      {(p.sizeBreakdown || []).map((sb, sbIdx) => (
                        <div key={sbIdx} className="restock-modal-size-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <input
                            type="text"
                            value={sb.size}
                            onChange={(e) => {
                              const newProds = [...bulkOrderFormData.products]
                              newProds[pIdx].sizeBreakdown[sbIdx].size = e.target.value
                              setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                            }}
                            placeholder="Size e.g. 28"
                            style={{ width: '80px', padding: '6px', fontSize: '12px' }}
                          />
                          <input
                            type="number"
                            min="0"
                            value={sb.orderedQty}
                            onChange={(e) => {
                              const newProds = [...bulkOrderFormData.products]
                              newProds[pIdx].sizeBreakdown[sbIdx].orderedQty = e.target.value
                              setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                            }}
                            placeholder="Qty"
                            style={{ width: '90px', padding: '6px', fontSize: '12px' }}
                          />
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={sb.unitPrice || ''}
                            onChange={(e) => {
                              const newProds = [...bulkOrderFormData.products]
                              newProds[pIdx].sizeBreakdown[sbIdx].unitPrice = e.target.value
                              setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                            }}
                            placeholder="Cost/Unit ₹"
                            style={{ width: '100px', padding: '6px', fontSize: '12px' }}
                          />
                          {p.sizeBreakdown.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newProds = [...bulkOrderFormData.products]
                                newProds[pIdx].sizeBreakdown = newProds[pIdx].sizeBreakdown.filter((_, idx) => idx !== sbIdx)
                                setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                              }}
                              style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer' }}
                            >
                              {getSafeEmoji('✕')}
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const newProds = [...bulkOrderFormData.products]
                          newProds[pIdx].sizeBreakdown.push({ size: '', orderedQty: '', unitPrice: '' })
                          setBulkOrderFormData({ ...bulkOrderFormData, products: newProds })
                        }}
                        style={{ fontSize: '11px', background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontWeight: '700', marginTop: '4px' }}
                      >
                        + Add Size Row
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Special Notes */}
              <div className="manage-input-group">
                <label>
                  Special Notes / Instructions
                  <textarea
                    rows={2}
                    value={bulkOrderFormData.notes}
                    onChange={(e) => setBulkOrderFormData({ ...bulkOrderFormData, notes: e.target.value })}
                    placeholder="Enter special instructions or remarks..."
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowBulkOrderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" style={{ background: '#059669', borderColor: '#059669' }}>
                  {selectedBulkOrder ? 'Save Changes' : 'Create Bulk Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clients Directory Manager Modal */}
      {showClientManagerModal && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button type="button" className="manage-modal-close" onClick={() => setShowClientManagerModal(false)}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">🏢 Clients Directory</p>
            <p className="manage-modal-subtitle">Manage corporate and commercial client directory for bulk uniform supply orders.</p>

            <form onSubmit={handleSaveClient} style={{ background: theme === 'dark' ? '#1E293B' : '#F8FAFC', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-color, #E2E8F0)' }}>
              <div style={{ fontWeight: '800', fontSize: '13px', marginBottom: '10px' }}>
                {editingClientId ? '✏️ Edit Client Details' : '➕ Add New Client'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Client Name *</label>
                  <input
                    type="text"
                    value={clientFormData.name}
                    onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                    placeholder="e.g. Reliance Industries"
                    required
                    style={{ fontSize: '13px', padding: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Contact Number</label>
                  <input
                    type="text"
                    value={clientFormData.contactNumber}
                    onChange={(e) => setClientFormData({ ...clientFormData, contactNumber: e.target.value })}
                    placeholder="e.g. 9876543210"
                    style={{ fontSize: '13px', padding: '8px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>GST Number (GSTIN)</label>
                  <input
                    type="text"
                    value={clientFormData.gstNumber}
                    onChange={(e) => setClientFormData({ ...clientFormData, gstNumber: e.target.value })}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    style={{ fontSize: '13px', padding: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Address / Location</label>
                  <input
                    type="text"
                    value={clientFormData.address}
                    onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })}
                    placeholder="e.g. Mumbai, MH"
                    style={{ fontSize: '13px', padding: '8px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {editingClientId && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setEditingClientId(null)
                      setClientFormData({ name: '', contactNumber: '', address: '', gstNumber: '', email: '', notes: '' })
                    }}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="primary-btn" style={{ fontSize: '12px', padding: '6px 14px', background: '#059669', borderColor: '#059669' }}>
                  {editingClientId ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>

            {/* List of Registered Clients with Search & Scroll */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontWeight: '800', fontSize: '13px' }}>
                Registered Clients ({clients.length}):
              </div>
              {clients.length > 0 && (
                <input
                  type="text"
                  placeholder="🔍 Search clients..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                    background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                    color: 'inherit',
                    width: '200px',
                    outline: 'none'
                  }}
                />
              )}
            </div>

            {(() => {
              const filteredClients = clients.filter(c => {
                if (!clientSearchQuery.trim()) return true
                const q = clientSearchQuery.toLowerCase()
                return (
                  (c.name || '').toLowerCase().includes(q) ||
                  (c.contactNumber || '').toLowerCase().includes(q) ||
                  (c.gstNumber || '').toLowerCase().includes(q) ||
                  (c.address || '').toLowerCase().includes(q)
                )
              })

              if (filteredClients.length === 0) {
                return (
                  <div style={{ textAlign: 'center', color: '#64748B', padding: '20px', fontSize: '13px' }}>
                    {clientSearchQuery ? 'No matching clients found.' : 'No clients added yet.'}
                  </div>
                )
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                  {filteredClients.map(c => (
                    <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: theme === 'dark' ? '#0F172A' : '#FAFAFA', borderRadius: '8px', border: '1px solid var(--border-color, #E2E8F0)' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '13px' }}>🏢 {c.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {c.contactNumber && `📞 ${c.contactNumber}`} {c.gstNumber && ` | 📑 GSTIN: ${c.gstNumber}`} {c.address && ` | 📍 ${c.address}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClientId(c._id)
                            setClientFormData({
                              name: c.name || '',
                              contactNumber: c.contactNumber || '',
                              address: c.address || '',
                              gstNumber: c.gstNumber || '',
                              email: c.email || '',
                              notes: c.notes || ''
                            })
                          }}
                          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #93C5FD', cursor: 'pointer', fontWeight: '700' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(c._id, c.name)}
                          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5', cursor: 'pointer', fontWeight: '700' }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Dispatch Stock Batch Modal */}
      {showDispatchModal && selectedOrderForDispatch && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button type="button" className="manage-modal-close" onClick={() => setShowDispatchModal(false)}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">🚚 Dispatch Stock Batch</p>
            <p className="manage-modal-subtitle">
              Order <strong>{getDisplayCoNumber(selectedOrderForDispatch)}</strong> for Client <strong>{selectedOrderForDispatch.clientName}</strong>
            </p>

            <form onSubmit={handleLogDispatch}>
              {/* Items Table */}
              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px' }}>Dispatched Stock Quantities by Size:</div>
                <table className="mini-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Product &amp; Size</th>
                      <th>Ordered</th>
                      <th>Previously Dispatched</th>
                      <th>Pending Balance</th>
                      <th>New Dispatched Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dispatchFormData.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.productName} - Size {item.size}</strong></td>
                        <td>{item.orderedQty} pcs</td>
                        <td style={{ color: '#059669' }}>{item.deliveredQty} pcs</td>
                        <td style={{ color: item.remainingQty > 0 ? '#D97706' : '#64748B', fontWeight: item.remainingQty > 0 ? '700' : 'normal' }}>
                          {item.remainingQty} pcs
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={item.newQty}
                            onChange={(e) => {
                              const newItems = [...dispatchFormData.items]
                              newItems[idx].newQty = e.target.value
                              setDispatchFormData({ ...dispatchFormData, items: newItems })
                            }}
                            placeholder="0"
                            style={{ width: '80px', padding: '4px 6px', fontSize: '12px', fontWeight: '800' }}
                          />
                          {Number(item.newQty || 0) > item.remainingQty && (
                            <span style={{ color: '#2563EB', fontSize: '10px', display: 'block', fontWeight: '600' }}>
                              +{Number(item.newQty || 0) - item.remainingQty} Extra stock!
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="manage-input-group">
                <label>
                  Batch Notes / Remarks
                  <textarea
                    rows={2}
                    value={dispatchFormData.notes}
                    onChange={(e) => setDispatchFormData({ ...dispatchFormData, notes: e.target.value })}
                    placeholder="e.g. Dispatched 50 pcs via Speed Post / Delivery Van..."
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowDispatchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" style={{ background: '#059669', borderColor: '#059669' }}>
                  Confirm Stock Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dispatch Batch Modal */}
      {showEditDispatchModal && editingDispatch && (
        <div className="manage-modal-backdrop">
          <div className="manage-modal-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button type="button" className="manage-modal-close" onClick={() => { setShowEditDispatchModal(false); setEditingDispatch(null); }}>
              {getSafeEmoji('✕')}
            </button>
            <p className="manage-modal-title">✏️ Edit Stock Dispatch Batch</p>

            <form onSubmit={handleUpdateDispatch}>
              <div className="manage-input-group">
                <label>
                  Delivery Challan / Invoice #
                  <input
                    type="text"
                    value={editingDispatch.challanNumber}
                    onChange={(e) => setEditingDispatch({ ...editingDispatch, challanNumber: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px' }}>Dispatched Quantities:</div>
                <table className="mini-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px' }}>Product &amp; Size</th>
                      <th style={{ padding: '8px' }}>Cost / Unit</th>
                      <th style={{ padding: '8px' }}>Ordered</th>
                      <th style={{ padding: '8px' }}>Other Batches</th>
                      <th style={{ padding: '8px' }}>Qty in This Batch</th>
                      <th style={{ padding: '8px' }}>Batch Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(editingDispatch.items || []).map((item, idx) => {
                      const uPrice = Number(item.unitPrice || 0)
                      const bQty = Number(item.qty || 0)
                      const bValue = uPrice > 0 ? bQty * uPrice : 0
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '8px' }}><strong>{item.productName} - Size {item.size}</strong></td>
                          <td style={{ padding: '8px', color: '#059669', fontWeight: '600' }}>
                            {uPrice > 0 ? `₹${uPrice.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td style={{ padding: '8px' }}>{item.orderedQty || 0} pcs</td>
                          <td style={{ padding: '8px', color: '#64748B' }}>{item.otherDelivered || 0} pcs</td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => {
                                const newItems = [...editingDispatch.items]
                                newItems[idx].qty = e.target.value
                                setEditingDispatch({ ...editingDispatch, items: newItems })
                              }}
                              style={{ width: '80px', padding: '4px 6px', fontSize: '12px', fontWeight: '800' }}
                            />
                          </td>
                          <td style={{ padding: '8px', color: '#059669', fontWeight: '700' }}>
                            {bValue > 0 ? `₹${bValue.toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="manage-input-group">
                <label>
                  Batch Notes
                  <textarea
                    rows={2}
                    value={editingDispatch.notes}
                    onChange={(e) => setEditingDispatch({ ...editingDispatch, notes: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowEditDispatchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" style={{ background: '#059669', borderColor: '#059669' }}>
                  Save Dispatch Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Client Order PDF Export & Live Preview Modal */}
      {showBOPDFModal && selectedBOForPDF && (
        <div className="pdf-modal-backdrop">
          <div className="pdf-modal-card">
            <div className="pdf-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{getSafeEmoji('📄')} CO PDF Export &amp; Live Preview</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
                  Configure paper format, orientation, margins, and density with a live sheet preview for {getDisplayCoNumber(selectedBOForPDF)}.
                </p>
              </div>
              <button
                type="button"
                className="manage-modal-close"
                onClick={() => setShowBOPDFModal(false)}
                style={{ position: 'static', fontSize: '20px' }}
              >
                {getSafeEmoji('✕')}
              </button>
            </div>

            <div className="pdf-modal-body">
              {/* Settings Controls Sidebar */}
              <div className="pdf-controls-sidebar">
                <div className="pdf-control-group">
                  <label>FILE NAME</label>
                  <input
                    type="text"
                    value={boPdfFileName}
                    onChange={(e) => setBoPdfFileName(e.target.value)}
                    placeholder="Enter file name"
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="pdf-control-group">
                  <label>ORIENTATION</label>
                  <select
                    value={boPdfOrientation}
                    onChange={(e) => setBoPdfOrientation(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="landscape">Landscape (Horizontal &mdash; Recommended)</option>
                    <option value="portrait">Portrait (Vertical)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>PAPER FORMAT</label>
                  <select
                    value={boPdfFormat}
                    onChange={(e) => setBoPdfFormat(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="a4">A4 (210 &times; 297 mm)</option>
                    <option value="letter">Letter (8.5 &times; 11 in)</option>
                    <option value="legal">Legal (8.5 &times; 14 in)</option>
                    <option value="a3">A3 (297 &times; 420 mm)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>MARGINS</label>
                  <select
                    value={boPdfMargin}
                    onChange={(e) => setBoPdfMargin(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="compact">Compact (3mm)</option>
                    <option value="normal">Normal (6mm)</option>
                    <option value="wide">Wide (12mm)</option>
                  </select>
                </div>

                <div className="pdf-control-group">
                  <label>TABLE SCALE</label>
                  <select
                    value={boPdfScale}
                    onChange={(e) => setBoPdfScale(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#CBD5E1'}`,
                      background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                      color: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="compact">Compact (80%)</option>
                    <option value="normal">Normal (100%)</option>
                    <option value="large">Large (120%)</option>
                  </select>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={executeBOPDFDownload}
                    disabled={exportingBOPDF}
                    style={{ padding: '12px', width: '100%', fontSize: '13px', justifyContent: 'center' }}
                  >
                    {exportingBOPDF ? `${getSafeEmoji('⌛')} Generating PDF...` : `${getSafeEmoji('⬇️')} Download PDF`}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setShowBOPDFModal(false)}
                    style={{ padding: '10px', width: '100%', fontSize: '13px', justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Right Live Sheet Preview */}
              <div className="pdf-preview-pane">
                {(() => {
                  const order = selectedBOForPDF
                  const prods = getNormalizedProducts(order)
                  let boTotalCost = 0
                  let boHasAnyPrices = false
                  prods.forEach(p => {
                    const legacyPrice = Number(p.unitPrice || 0)
                    ;(p.sizeBreakdown || []).forEach(sb => {
                      const sbPrice = Number(sb.unitPrice || 0) || legacyPrice
                      if (sbPrice > 0) {
                        boTotalCost += (sb.deliveredQty || 0) * sbPrice
                        boHasAnyPrices = true
                      }
                    })
                  })

                  return (
                    <div
                      ref={boPdfPreviewSheetRef}
                      className="pdf-sheet-page"
                      style={{
                        background: '#FFFFFF',
                        color: '#0F172A',
                        padding: boPdfMargin === 'compact' ? '12px' : boPdfMargin === 'wide' ? '32px' : '20px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        borderRadius: '4px',
                        minHeight: '600px'
                      }}
                    >
                      {/* Document Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2563EB', paddingBottom: '12px', marginBottom: '16px' }}>
                        <div>
                          <h2 style={{ margin: 0, fontSize: '18px', color: '#2563EB', fontWeight: '800' }}>
                            Liberty Uniform &mdash; Bulk Client Sales Order
                          </h2>
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                            <strong>BO Number:</strong> {order.boNumber} &nbsp;|&nbsp; <strong>Client:</strong> {order.clientName}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748B' }}>
                          <div>Generated: {new Date().toLocaleDateString()}</div>
                        </div>
                      </div>

                      {/* Meta Information Bar */}
                      <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid #E2E8F0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <div>Target Delivery Date: <strong>{order.targetDate || 'Not specified'}</strong></div>
                        <div>Total Order Value: <strong style={{ color: boHasAnyPrices ? '#059669' : '#64748B' }}>{boHasAnyPrices ? `₹${boTotalCost.toLocaleString('en-IN')}` : '-'}</strong></div>
                      </div>

                      {/* Product Tables */}
                      {prods.map((prod, pIdx) => {
                        const frontLogo = Number(prod?.frontLogoCost || 0)
                        const backLogo = Number(prod?.backLogoCost || 0)
                        const logoPerPc = (isNaN(frontLogo) ? 0 : Math.max(0, frontLogo)) + (isNaN(backLogo) ? 0 : Math.max(0, backLogo))
                        const sortedSizes = sortSizesAscending(prod?.sizeBreakdown || [])
                        const legacyPrice = Number(prod?.unitPrice || 0)
                        let totalProdOrdered = 0
                        let totalProdDelivered = 0
                        let totalProdPending = 0
                        let totalProdCost = 0

                        sortedSizes.forEach(sb => {
                          const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
                          const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
                          const ord = Number(sb?.orderedQty || 0) || 0
                          const del = Number(sb?.deliveredQty || 0) || 0
                          totalProdOrdered += ord
                          totalProdDelivered += del
                          totalProdPending += Math.max(0, ord - del)
                          totalProdCost += effectiveUnitPrice > 0 ? del * effectiveUnitPrice : 0
                        })

                        return (
                          <div key={pIdx} style={{ marginBottom: '16px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ fontWeight: '800', fontSize: '13px', color: '#0284C7', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Product {pIdx + 1} &mdash; {prod.productName}</span>
                              {logoPerPc > 0 && (
                                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                                  {frontLogo > 0 && `Front Logo: ₹${frontLogo}`}
                                  {frontLogo > 0 && backLogo > 0 && ' | '}
                                  {backLogo > 0 && `Back Logo: ₹${backLogo}`}
                                  {` (Total ₹${logoPerPc}/pc)`}
                                </span>
                              )}
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                              <thead>
                                <tr style={{ background: '#2563EB', color: '#FFFFFF' }}>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Size</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Cost / Unit</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Ordered</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Dispatched</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Pending</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Row Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedSizes.map((sb) => {
                                  const basePrice = Number(sb?.unitPrice || 0) || (isNaN(legacyPrice) ? 0 : Math.max(0, legacyPrice))
                                  const effectiveUnitPrice = basePrice > 0 || logoPerPc > 0 ? basePrice + logoPerPc : 0
                                  const delQty = Number(sb?.deliveredQty || 0) || 0
                                  const ordQty = Number(sb?.orderedQty || 0) || 0
                                  const pending = Math.max(0, ordQty - delQty)
                                  const surplus = delQty > ordQty ? delQty - ordQty : 0
                                  const rowCost = effectiveUnitPrice > 0 ? delQty * effectiveUnitPrice : 0
                                  return (
                                    <tr key={sb.size} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                      <td style={{ padding: '5px 8px', fontWeight: '700' }}>{sb.size}</td>
                                      <td style={{ padding: '5px 8px', color: '#475569' }}>
                                        {effectiveUnitPrice > 0 ? (
                                          <span>
                                            ₹{effectiveUnitPrice}
                                            {logoPerPc > 0 && <span style={{ fontSize: '9px', color: '#64748B', display: 'block' }}>(Base ₹{basePrice} + Logo ₹{logoPerPc})</span>}
                                          </span>
                                        ) : '-'}
                                      </td>
                                      <td style={{ padding: '5px 8px' }}>{ordQty} pcs</td>
                                      <td style={{ padding: '5px 8px', color: '#059669', fontWeight: '600' }}>
                                        {delQty} pcs {surplus > 0 ? `(+${surplus} Extra)` : ''}
                                      </td>
                                      <td style={{ padding: '5px 8px', color: pending > 0 ? '#D97706' : '#059669', fontWeight: '600' }}>{pending > 0 ? `${pending} pcs` : 'Done'}</td>
                                      <td style={{ padding: '5px 8px', color: '#059669', fontWeight: '700' }}>{rowCost > 0 ? `₹${rowCost.toLocaleString('en-IN')}` : '-'}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot style={{ background: '#F8FAFC', fontWeight: '800', borderTop: '2px solid #CBD5E1' }}>
                                <tr>
                                  <td style={{ padding: '6px 8px' }}>Total</td>
                                  <td style={{ padding: '6px 8px' }}>—</td>
                                  <td style={{ padding: '6px 8px', color: '#2563EB' }}>{totalProdOrdered} pcs</td>
                                  <td style={{ padding: '6px 8px', color: '#059669' }}>{totalProdDelivered} pcs</td>
                                  <td style={{ padding: '6px 8px', color: totalProdPending > 0 ? '#D97706' : '#059669' }}>{totalProdPending > 0 ? `${totalProdPending} pcs` : 'Done'}</td>
                                  <td style={{ padding: '6px 8px', color: '#059669' }}>{totalProdCost > 0 ? `₹${totalProdCost.toLocaleString('en-IN')}` : '-'}</td>
                                </tr>
                              </tfoot>
                            </table>

                            {/* Total Product Cost summary below table */}
                            {totalProdCost > 0 && (
                              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '700', color: '#059669' }}>
                                Total Product Cost: ₹{totalProdCost.toLocaleString('en-IN')}
                                <span style={{ fontWeight: '400', color: '#64748B', marginLeft: '6px' }}>({totalProdDelivered} pcs dispatched)</span>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Total BO Value block */}
                      {boHasAnyPrices && (
                        <div style={{ background: '#EFF6FF', border: '2px solid #2563EB', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E40AF' }}>Total Order Value</span>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: '#2563EB' }}>₹{boTotalCost.toLocaleString('en-IN')}</span>
                        </div>
                      )}

                      {/* Dispatched Stock Batches Section */}
                      {order.dispatches && order.dispatches.length > 0 && (
                        <div style={{ marginTop: '16px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '12px' }}>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: '#059669', marginBottom: '8px' }}>
                            Dispatched Stock History (Batches)
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                              <tr style={{ background: '#059669', color: '#FFFFFF' }}>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Batch #</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Dispatch Date</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Dispatched Qty</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Product &amp; Size Breakdown</th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.dispatches.map((inst, idx) => {
                                const bTotal = (inst.items || []).reduce((s, i) => s + (i.qty || 0), 0)
                                const itemsStr = (inst.items || []).map(i => `${i.productName ? i.productName + ' ' : ''}Size ${i.size}: ${i.qty}pcs`).join(' • ')
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '5px 8px', fontWeight: '700' }}>Batch #{idx + 1}</td>
                                    <td style={{ padding: '5px 8px' }}>{new Date(inst.dispatchedAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '5px 8px', color: '#059669', fontWeight: '600' }}>{bTotal} pcs</td>
                                    <td style={{ padding: '5px 8px' }}>{itemsStr || '-'}</td>
                                    <td style={{ padding: '5px 8px', color: '#64748B' }}>{inst.notes || '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Special Instructions / Notes Banner */}
                      {order.notes && (
                        <div style={{ marginTop: '16px', background: '#FEF3C7', border: '1px solid #FCD34D', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: '#92400E' }}>
                          <strong>Special Instructions / Notes:</strong> {order.notes}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App