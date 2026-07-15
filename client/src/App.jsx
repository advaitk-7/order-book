import { useEffect, useMemo, useState, useRef } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || (window.location.origin.includes('localhost') ? 'http://localhost:5001' : window.location.origin)

const measurementFields = {
  shirt: ['length', 'chest', 'shoulder', 'sleeve', 'neck'],
  pant: ['length', 'waist', 'seat', 'thighs', 'bottom'],
  pina: ['length', 'waist', 'torsoLength'],
}

const createItem = () => ({
  itemType: 'shirt',
  quantity: 1,
  measurements: {
    length: '',
    chest: '',
    shoulder: '',
    sleeve: '',
    neck: '',
    waist: '',
    seat: '',
    thighs: '',
    bottom: '',
    torsoLength: '',
  },
})

const createEmptyForm = (orderNumber = '') => ({
  orderNumber,
  customerName: '',
  contactNumber: '',
  gender: 'Male',
  school: '',
  deliveryDate: '',
  amount: '',
  paymentStatus: 'Unpaid',
  status: 'Pending',
  contactStatus: 'Not contacted',
  items: [createItem()],
  notes: '',
})

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
  if (!itemType || itemType.toLowerCase() !== 'shirt') return ''
  const sleeveVal = parseFloat(measurements?.sleeve)
  if (isNaN(sleeveVal)) return ''
  return sleeveVal >= 14 ? 'FS' : 'HS'
}

const getNextOrderNumber = (orders) => {
  // find first unused number in 1..1000 (wrap after 1000)
  const used = new Set(
    orders
      .map((o) => Number(o.orderNumber))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 1000),
  )

  for (let i = 1; i <= 1000; i++) {
    if (!used.has(i)) return String(i)
  }

  // if all 1..1000 are used, fall back to next numeric after max
  const numeric = orders.map((order) => Number(order.orderNumber)).filter((num) => !Number.isNaN(num))
  const nextNumber = numeric.length ? Math.max(...numeric) + 1 : 1001
  return String(nextNumber)
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

  // Pricing Settings States
  const [pricingRates, setPricingRates] = useState({ pant: 150, pina: 75, shirtHs: 90, shirtFs: 110 })
  const [pantPriceInput, setPantPriceInput] = useState('150')
  const [pinaPriceInput, setPinaPriceInput] = useState('75')
  const [shirtHsPriceInput, setShirtHsPriceInput] = useState('90')
  const [shirtFsPriceInput, setShirtFsPriceInput] = useState('110')
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
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
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
  const [orderFilter, setOrderFilter] = useState('All')
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All')
  const [orderContactFilter, setOrderContactFilter] = useState('All')
  const [orderSchoolFilter, setOrderSchoolFilter] = useState('All')
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
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [activePage, setActivePage] = useState('Dashboard')
  const [visibleCount, setVisibleCount] = useState(20)
  const loadStep = 20
  const [selectedIds, setSelectedIds] = useState([])
  const [now, setNow] = useState(Date.now())
  const [timerAlertOrder, setTimerAlertOrder] = useState(null)
  const [highlightedOrderId, setHighlightedOrderId] = useState(null)
  const [originalFormData, setOriginalFormData] = useState(null)

  // Tailor Work Page Filters & Selections
  const [tailorStatusFilter, setTailorStatusFilter] = useState('Pending')
  const [tailorProductFilter, setTailorProductFilter] = useState('All')
  const [tailorSchoolFilter, setTailorSchoolFilter] = useState('All')
  const [tailorDeliveryFilter, setTailorDeliveryFilter] = useState('All')
  const [tailorCustomStartDate, setTailorCustomStartDate] = useState('')
  const [tailorCustomEndDate, setTailorCustomEndDate] = useState('')
  const [tailorSearchTerm, setTailorSearchTerm] = useState('')
  const [tailorSortKey, setTailorSortKey] = useState('deliveryDate')
  const [tailorSortOrder, setTailorSortOrder] = useState('asc')

  const hasFormChanges = useMemo(() => {
    if (!editingOrderId || !originalFormData) return true
    return JSON.stringify(formData) !== JSON.stringify(originalFormData)
  }, [editingOrderId, formData, originalFormData])

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

  const fetchOrders = async (term = searchTerm) => {
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
      fetchOrders(searchTerm)
    } else {
      setOrders([])
      setSelectedOrder(null)
    }
  }, [searchTerm, token])

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
      const response = await fetch(`${API_BASE}/api/settings/pricing`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setPricingRates(data.value)
        setPantPriceInput(String(data.value.pant))
        setPinaPriceInput(String(data.value.pina))
        setShirtHsPriceInput(String(data.value.shirtHs))
        setShirtFsPriceInput(String(data.value.shirtFs))
      }
    } catch (error) {
      console.error('Failed to load pricing rates', error)
    } finally {
      setLoadingPricing(false)
    }
  }

  const handleUpdatePricing = async (e) => {
    e.preventDefault()
    if (!token) return
    const rates = {
      pant: Number(pantPriceInput || 0),
      pina: Number(pinaPriceInput || 0),
      shirtHs: Number(shirtHsPriceInput || 0),
      shirtFs: Number(shirtFsPriceInput || 0)
    }

    try {
      const response = await fetch(`${API_BASE}/api/settings/pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: rates })
      })
      const data = await response.json()
      if (response.ok) {
        alert('Pricing rates updated successfully!')
        setPricingRates(rates)
        fetchAuditLogs()
      } else {
        alert(data.message || 'Failed to update pricing')
      }
    } catch (error) {
      console.error('Failed to update pricing', error)
      alert('Network error while updating pricing.')
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

  const fetchAuditLogs = async () => {
    if (!token) return
    setLoadingAuditLogs(true)
    try {
      const response = await fetch(`${API_BASE}/api/audit-logs`, {
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

  useEffect(() => {
    if (activePage === 'Settings' && token) {
      fetchBackups()
      fetchAuditLogs()
      fetchPricingRates()
    }
  }, [activePage, token])

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
    if (!order) return
    if (order.status === 'Delivered') {
      setTimerAlertOrder(order)
      setMessage('')
    }
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
      deliveryDate: order.deliveryDate || '',
      amount: order.amount?.toString() || '',
      paymentStatus: order.paymentStatus || 'Unpaid',
      status: order.status || 'Pending',
      contactStatus: order.contactStatus || 'Not contacted',
      items:
        order.items?.map((item) => ({
          itemType: item.itemType || 'shirt',
          quantity: item.quantity || 1,
          measurements: {
            ...createItem().measurements,
            ...item.measurements,
          },
        })) || [createItem()],
      notes: order.notes || '',
    }
    setFormData(initialForm)
    setOriginalFormData(initialForm)
    setActivePage('Orders')
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
    if (page === 'New Order') {
      resetForm()
      setSelectedOrder(null)
    }
    if (page === 'Orders') {
      setEditingOrderId(null)
    }
    setActivePage(page)
  }

  const handleItemChange = (index, event) => {
    const { name, value } = event.target

    setFormData((prev) => {
      const updatedItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return name === 'itemType' ? { ...item, itemType: value } : { ...item, [name]: value }
      })

      if (selectedOrder && selectedOrder._id === editingOrderId) {
        setSelectedOrder((prevSelected) => ({
          ...prevSelected,
          items: prevSelected.items.map((item, itemIndex) => {
            if (itemIndex !== index) return item
            return name === 'itemType' ? { ...item, itemType: value } : { ...item, [name]: value }
          })
        }))
      }

      return { ...prev, items: updatedItems }
    })
  }

  const handleMeasurementChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return {
          ...item,
          measurements: {
            ...item.measurements,
            [field]: value,
          },
        }
      })

      if (selectedOrder && selectedOrder._id === editingOrderId) {
        setSelectedOrder((prevSelected) => ({
          ...prevSelected,
          items: prevSelected.items.map((item, itemIndex) => {
            if (itemIndex !== index) return item
            return {
              ...item,
              measurements: {
                ...item.measurements,
                [field]: value,
              },
            }
          })
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setFormError('')

    try {
      const payload = {
        ...formData,
        amount: formData.amount === '' ? 0 : Number(formData.amount),
        paymentStatus: formData.paymentStatus || 'Unpaid',
        contactStatus: formData.contactStatus || 'Not contacted',
        items: formData.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity || 0),
        })),
      }

      const isEditing = Boolean(editingOrderId)
      const url = isEditing ? `${API_BASE}/api/orders/${editingOrderId}` : `${API_BASE}/api/orders`
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      const data = await response.json()

      if (response.ok) {
        const actionText = isEditing ? 'updated' : 'saved'
        setMessage(`Order ${data.order.orderNumber} ${actionText} successfully.`)
        setFormError('')
        if (isEditing) {
          setHighlightedOrderId(data.order._id)
        }
        resetForm()
        setSelectedOrder(data.order)
        setActivePage('Orders')
        fetchOrders(searchTerm)
      } else {
        setFormError(data.message || 'Unable to save order')
        setMessage('')
      }
    } catch (error) {
      console.error('Order submit error:', error)
      setFormError('Could not reach the server. Make sure the backend is running.')
      setMessage('')
    } finally {
      setLoading(false)
    }
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
    const timeLeftMs = new Date(timestamp).getTime() + 25 * 24 * 60 * 60 * 1000 - now
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
    { label: 'Total Orders', value: totalOrders, icon: '📦', description: 'All time orders', filter: 'All' },
    { label: 'Pending Orders', value: pendingOrders, icon: '⏳', description: 'Awaiting processing', filter: 'Pending' },
    { label: 'Ready Orders', value: readyOrders, icon: '✅', description: 'Ready for collection', filter: 'Ready' },
    { label: 'Delivered Orders', value: deliveredOrders, icon: '🚚', description: 'Completed orders', filter: 'Delivered' },
    { label: 'Pending Payments', value: pendingPayments, icon: '💰', description: 'Amount unpaid', filter: 'PendingPayments' },
  ]

  const pageSubtitles = {
    Dashboard: 'Operational overview and recent activity',
    'New Order': 'Create a new uniform order with full details',
    Orders: 'Search, filter and manage existing orders',
    'Production Queue': 'Garment-level measurements, deadlines and notes for tailors',
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
    return true
  })

  const sortedOrders = useMemo(() => {
    const parsed = [...filteredOrders]
    return parsed.sort((a, b) => {
      const aNum = Number(a.orderNumber)
      const bNum = Number(b.orderNumber)
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum
      }
      return String(a.orderNumber).localeCompare(String(b.orderNumber), undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [filteredOrders])

  const visibleOrders = sortedOrders.slice(0, visibleCount)
  const hasMoreOrders = visibleCount < sortedOrders.length

  // Tailor Work - Derived Selectors and Helpers
  const tailorAvailableSchools = useMemo(() => {
    const schoolsSet = new Set()
    orders.forEach((o) => {
      if (o.school && o.school.trim() !== '') {
        schoolsSet.add(o.school.trim())
      }
    })
    return Array.from(schoolsSet).sort()
  }, [orders])

  const isDateInFilter = (dateStr, filter, customStart, customEnd) => {
    if (filter === 'All') return true
    if (!dateStr) return false

    const d = new Date(dateStr)
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
      if (tailorSearchTerm.trim() !== '') {
        const term = tailorSearchTerm.toLowerCase()
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

          rows.push({
            orderId: order._id,
            orderNumber: order.orderNumber || '',
            customerName: order.customerName || '',
            school: order.school || '',
            gender: order.gender || 'Male',
            product: item.itemType ? item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1) : 'Unknown',
            quantity: item.quantity || 0,
            measurements: item.measurements || {},
            notes: order.notes || '',
            deliveryDate: order.deliveryDate || '',
            status: order.status || 'Pending',
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
    tailorSchoolFilter,
    tailorDeliveryFilter,
    tailorCustomStartDate,
    tailorCustomEndDate,
    tailorSearchTerm
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
    let pantQty = 0;
    let pinaQty = 0;
    let shirtHSQty = 0;
    let shirtFSQty = 0;

    sortedTailorGarments.forEach((row) => {
      const prod = row.product?.toLowerCase().trim();
      const qty = Number(row.quantity) || 0;
      if (prod === 'pant') {
        pantQty += qty;
      } else if (prod === 'pina') {
        pinaQty += qty;
      } else if (prod === 'shirt') {
        const sleeveTag = getSleeveTag(row.product, row.measurements);
        if (sleeveTag === 'FS') {
          shirtFSQty += qty;
        } else {
          shirtHSQty += qty;
        }
      }
    });

    const pantCost = pantQty * pricingRates.pant;
    const pinaCost = pinaQty * pricingRates.pina;
    const shirtHSCost = shirtHSQty * pricingRates.shirtHs;
    const shirtFSCost = shirtFSQty * pricingRates.shirtFs;
    const totalCost = pantCost + pinaCost + shirtHSCost + shirtFSCost;

    return {
      pantQty,
      pinaQty,
      shirtHSQty,
      shirtFSQty,
      pantCost,
      pinaCost,
      shirtHSCost,
      shirtFSCost,
      totalCost,
    };
  }, [sortedTailorGarments, pricingRates]);

  const handleTailorSort = (key) => {
    if (tailorSortKey === key) {
      setTailorSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setTailorSortKey(key)
      setTailorSortOrder('asc')
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

    // Payment notice adjustment
    let collectionMsg = ''
    if (paymentStatus === 'Paid') {
      collectionMsg = 'Please visit Liberty Uniform at your convenience to collect your order. (Paid in Full)'
    } else {
      collectionMsg = `Please visit Liberty Uniform at your convenience to collect your order. (Remaining balance to pay: ₹${amount})`
    }

    const message = `Hello ${customerName},

Your school uniform order (Order No. ${orderNo}) is now ready for collection.

${collectionMsg}

If you have any questions, feel free to contact us.

Thank you,
Liberty Uniform`

    const encodedText = encodeURIComponent(message)
    const url = whatsappMode === 'app'
      ? `whatsapp://send?phone=${fullPhone}&text=${encodedText}`
      : `https://wa.me/${fullPhone}?text=${encodedText}`
    window.open(url, '_blank')
  }


  const exportToCSV = () => {
    const headers = [
      'Order Number',
      'Product',
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

      if (prod === 'shirt') {
        if (m.length) items.push(`Length: ${m.length}`)
        if (m.chest) items.push(`Chest: ${m.chest}`)
        if (m.shoulder) items.push(`Shoulder: ${m.shoulder}`)
        if (m.sleeve) items.push(`Sleeve: ${m.sleeve}`)
        if (m.neck) items.push(`Neck: ${m.neck}`)
      } else if (prod === 'pant') {
        if (m.length) items.push(`Length: ${m.length}`)
        if (m.waist) items.push(`Waist: ${m.waist}`)
        if (m.seat) items.push(`Seat: ${m.seat}`)
        if (m.thighs) items.push(`Thigh: ${m.thighs}`)
        if (m.bottom) items.push(`Bottom: ${m.bottom}`)
      } else if (prod === 'pina') {
        if (m.length) items.push(`Length: ${m.length}`)
        if (m.waist) items.push(`Waist: ${m.waist}`)
        if (m.torsoLength) items.push(`Torso: ${m.torsoLength}`)
      }

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

      const csvRow = [
        formatField(row.orderNumber),
        formatField(productVal),
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
      csvRows.push('')
      csvRows.push('Production Cost Summary,,,,,,,,')
      csvRows.push('Component,Unit Rate,Quantity,Subtotal,,,,,')
      if (productionCostDetails.pantQty > 0) {
        csvRows.push(`Pants,₹${pricingRates.pant},${productionCostDetails.pantQty},"₹${productionCostDetails.pantCost.toLocaleString()}",,,,,`)
      }
      if (productionCostDetails.pinaQty > 0) {
        csvRows.push(`Pina,₹${pricingRates.pina},${productionCostDetails.pinaQty},"₹${productionCostDetails.pinaCost.toLocaleString()}",,,,,`)
      }
      if (productionCostDetails.shirtHSQty > 0) {
        csvRows.push(`Shirt HS,₹${pricingRates.shirtHs},${productionCostDetails.shirtHSQty},"₹${productionCostDetails.shirtHSCost.toLocaleString()}",,,,,`)
      }
      if (productionCostDetails.shirtFSQty > 0) {
        csvRows.push(`Shirt FS,₹${pricingRates.shirtFs},${productionCostDetails.shirtFSQty},"₹${productionCostDetails.shirtFSCost.toLocaleString()}",,,,,`)
      }
      const totalQty = productionCostDetails.pantQty + productionCostDetails.pinaQty + productionCostDetails.shirtHSQty + productionCostDetails.shirtFSQty;
      csvRows.push(`Total Production Cost,,${totalQty},"₹${productionCostDetails.totalCost.toLocaleString()}",,,,,`)
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

  const renderTailorMeasurements = (product, measurements) => {
    if (!measurements) return '-'
    const items = []
    const prod = product.toLowerCase()

    if (prod === 'shirt') {
      if (measurements.length) items.push({ label: 'Length', val: measurements.length })
      if (measurements.chest) items.push({ label: 'Chest', val: measurements.chest })
      if (measurements.shoulder) items.push({ label: 'Shoulder', val: measurements.shoulder })
      if (measurements.sleeve) items.push({ label: 'Sleeve', val: measurements.sleeve })
      if (measurements.neck) items.push({ label: 'Neck', val: measurements.neck })
    } else if (prod === 'pant') {
      if (measurements.length) items.push({ label: 'Length', val: measurements.length })
      if (measurements.waist) items.push({ label: 'Waist', val: measurements.waist })
      if (measurements.seat) items.push({ label: 'Seat', val: measurements.seat })
      if (measurements.thighs) items.push({ label: 'Thigh', val: measurements.thighs })
      if (measurements.bottom) items.push({ label: 'Bottom', val: measurements.bottom })
    } else if (prod === 'pina') {
      if (measurements.length) items.push({ label: 'Length', val: measurements.length })
      if (measurements.waist) items.push({ label: 'Waist', val: measurements.waist })
      if (measurements.torsoLength) items.push({ label: 'Torso', val: measurements.torsoLength })
    }

    if (items.length === 0) return '-'

    return (
      <div className="tailor-measurements-list">
        {items.map((it) => (
          <span key={it.label} className="measurement-tag">
            <strong>{it.label}:</strong> {it.val}
          </span>
        ))}
      </div>
    )
  }

  const recentOrders = orders.slice(0, 5)
  const recentActivity = orders.slice(0, 5).map((order) => `Order ${order.orderNumber} updated to ${order.status}`)

  useEffect(() => {
    if (activePage !== 'Orders') return undefined

    const handleScroll = () => {
      if (!hasMoreOrders) return
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 120) {
        setVisibleCount((prev) => Math.min(prev + loadStep, sortedOrders.length))
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [activePage, hasMoreOrders, sortedOrders.length])

  useEffect(() => {
    if (activePage === 'Orders') {
      setVisibleCount(loadStep)
    }
  }, [activePage, orderFilter, orderPaymentFilter, orderContactFilter, orderSchoolFilter, searchTerm, orders])

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
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [timerAlertOrder])

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
                      {showLoginPassword ? '🙈' : '👁️'}
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
                      🔄 Resend Code
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
                  <div style={{ fontSize: '48px', color: '#10B981', marginBottom: '16px' }}>✓</div>
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
          {['Dashboard', 'New Order', 'Orders', 'Production Queue', 'Settings'].map((page) => (
            <button
              key={page}
              type="button"
              className={`nav-link ${activePage === page ? 'active' : ''}`}
              onClick={() => goToPage(page)}
            >
              {page}
            </button>
          ))}
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
                        <label>
                          School
                          <input name="school" value={formData.school} onChange={handleChange} required />
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
                          Delivery Date
                          <input type="date" name="deliveryDate" value={formData.deliveryDate} onChange={handleChange} required />
                        </label>
                        <label>
                          Amount
                          <input type="number" name="amount" value={formData.amount} onChange={handleChange} required />
                        </label>
                        <label>
                          Payment Status
                          <select name="paymentStatus" value={formData.paymentStatus} onChange={handleChange}>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                          </select>
                        </label>
                        <label>
                          Status
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
                                  <option value="pant">Pant</option>
                                  <option value="pina">Pina</option>
                                </select>
                              </label>
                              <label>
                                Quantity
                                <input type="number" name="quantity" value={item.quantity} onChange={(event) => handleItemChange(index, event)} min="1" required />
                              </label>
                            </div>

                            <div className="measurement-grid">
                              {measurementFields[item.itemType].map((field) => {
                                const showTag = item.itemType === 'shirt' && field === 'sleeve' && getSleeveTag(item.itemType, item.measurements);
                                return (
                                  <label key={field}>
                                    <span>
                                      {field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}
                                      {showTag && (
                                        <span style={{ marginLeft: '6px', fontSize: '12px', color: '#2563EB', fontWeight: 'bold' }}>
                                          ({showTag})
                                        </span>
                                      )}
                                    </span>
                                    <input
                                      value={item.measurements[field] || ''}
                                      onChange={(event) => handleMeasurementChange(index, field, event.target.value)}
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="form-actions form-actions-end">
                    {editingOrderId && (
                      <button type="button" className="ghost-btn" onClick={resetForm}>
                        Cancel Edit
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
                  <span className="topbar-search-icon">🔍</span>
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
                    <span>School</span>
                    <select value={orderSchoolFilter} onChange={(event) => applyOrderSchoolFilter(event.target.value)}>
                      <option value="All">All Schools</option>
                      {tailorAvailableSchools.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="danger-btn" onClick={handleBulkDelete} disabled={selectedIds.length === 0}>
                    Delete Selected{selectedIds.length ? ` (${selectedIds.length})` : ''}
                  </button>
                  {selectedIds.length > 0 && (
                    <button type="button" className="ghost-btn" onClick={unselectAll}>
                      Unselect All
                    </button>
                  )}

                </div>
              </div>

              {sortedOrders.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button type="button" className="secondary-btn" onClick={scrollToBottom}>
                    ▼ Go to Bottom
                  </button>
                </div>
              )}

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
                          className={`clickable-row ${highlightedOrderId === order._id ? 'highlighted-row' : ''}`}
                          onClick={() => {
                            setSelectedOrder(order)
                            setHighlightedOrderId(order._id)
                            setShouldScrollToDetails(true)
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(order._id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelect(order._id)}
                            />
                          </td>
                          <td>{order.orderNumber}</td>
                          <td>{order.customerName}</td>
                          <td>{order.school}</td>
                          <td>{formatDateToDMY(order.deliveryDate)}</td>
                          <td>{order.amount}</td>
                          <td>
                            <span className={`payment-badge ${(order.paymentStatus || 'Unpaid').toLowerCase()}`}>
                              {order.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ position: 'relative' }}>
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
                                ✏️
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
                                🗑️
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
                    <p className="card-title">Selected Order Details</p>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ margin: 0 }}>{selectedOrder.contactNumber}</p>
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
                      <p>{selectedOrder.school}</p>
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
                  <span className="topbar-search-icon">🔍</span>
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
                      <option value="Pant">Pant</option>
                      <option value="Pina">Pina</option>
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
                    🖨️ Print / Save PDF
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={exportToCSV}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px' }}
                  >
                    📊 Export Excel (CSV)
                  </button>
                </div>
              </div>

              {/* Production Cost Panel (Only shown when tailorStatusFilter is 'Pending') */}
              {tailorStatusFilter === 'Pending' && (
                <div className="card production-cost-panel" style={{
                  marginBottom: '24px',
                  padding: '20px',
                  borderRadius: '20px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E5E7EB',
                  background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px, 1fr) 3.5fr',
                  gap: '20px',
                  alignItems: 'stretch'
                }}>
                  {/* Total Cost Block */}
                  <div style={{
                    background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
                    padding: '20px',
                    borderRadius: '16px',
                    color: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px -5px rgba(37, 99, 235, 0.3)'
                  }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#E0E7FF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800' }}>
                      Total Production Cost
                    </h3>
                    <p style={{ margin: 0, fontSize: '32px', fontWeight: '900', letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ₹{productionCostDetails.totalCost.toLocaleString()}
                    </p>
                    <span style={{ marginTop: '6px', fontSize: '12px', color: '#C7D2FE', fontWeight: '600' }}>
                      {productionCostDetails.pantQty + productionCostDetails.pinaQty + productionCostDetails.shirtHSQty + productionCostDetails.shirtFSQty} pending garments
                    </span>
                  </div>

                  {/* Individual Cost Breakdown Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: '12px'
                  }}>
                    {/* Pants */}
                    <div className={productionCostDetails.pantQty === 0 ? 'print-hide-zero' : ''} style={{
                      background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #E5E7EB',
                      padding: '14px',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pants</span>
                        <span style={{ display: 'block', fontSize: '12px', color: theme === 'dark' ? '#94A3B8' : '#475569', marginTop: '2px', fontWeight: '500' }}>₹{pricingRates.pant} / unit</span>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{productionCostDetails.pantQty}</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: theme === 'dark' ? '#38BDF8' : '#2563EB' }}>₹{productionCostDetails.pantCost.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Pina */}
                    <div className={productionCostDetails.pinaQty === 0 ? 'print-hide-zero' : ''} style={{
                      background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #E5E7EB',
                      padding: '14px',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pina</span>
                        <span style={{ display: 'block', fontSize: '12px', color: theme === 'dark' ? '#94A3B8' : '#475569', marginTop: '2px', fontWeight: '500' }}>₹{pricingRates.pina} / unit</span>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{productionCostDetails.pinaQty}</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: theme === 'dark' ? '#38BDF8' : '#2563EB' }}>₹{productionCostDetails.pinaCost.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Shirt HS */}
                    <div className={productionCostDetails.shirtHSQty === 0 ? 'print-hide-zero' : ''} style={{
                      background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #E5E7EB',
                      padding: '14px',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shirt HS</span>
                        <span style={{ display: 'block', fontSize: '12px', color: theme === 'dark' ? '#94A3B8' : '#475569', marginTop: '2px', fontWeight: '500' }}>₹{pricingRates.shirtHs} / unit</span>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{productionCostDetails.shirtHSQty}</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: theme === 'dark' ? '#38BDF8' : '#2563EB' }}>₹{productionCostDetails.shirtHSCost.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Shirt FS */}
                    <div className={productionCostDetails.shirtFSQty === 0 ? 'print-hide-zero' : ''} style={{
                      background: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #E5E7EB',
                      padding: '14px',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shirt FS</span>
                        <span style={{ display: 'block', fontSize: '12px', color: theme === 'dark' ? '#94A3B8' : '#475569', marginTop: '2px', fontWeight: '500' }}>₹{pricingRates.shirtFs} / unit</span>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: theme === 'dark' ? '#F8FAFC' : '#0F172A' }}>{productionCostDetails.shirtFSQty}</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: theme === 'dark' ? '#38BDF8' : '#2563EB' }}>₹{productionCostDetails.shirtFSCost.toLocaleString()}</span>
                      </div>
                    </div>
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
                              Order No. {tailorSortKey === 'orderNumber' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="sortable-header" onClick={() => handleTailorSort('product')} style={{ cursor: 'pointer' }}>
                              Product {tailorSortKey === 'product' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="sortable-header" onClick={() => handleTailorSort('customerName')} style={{ cursor: 'pointer' }}>
                              Customer {tailorSortKey === 'customerName' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="sortable-header" onClick={() => handleTailorSort('school')} style={{ cursor: 'pointer' }}>
                              School {tailorSortKey === 'school' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th>Gender</th>
                            <th>Qty</th>
                            <th style={{ minWidth: '240px' }}>Measurements</th>
                            <th style={{ minWidth: '180px' }}>Notes</th>
                            <th className="sortable-header" onClick={() => handleTailorSort('deliveryDate')} style={{ cursor: 'pointer' }}>
                              Delivery Date {tailorSortKey === 'deliveryDate' ? (tailorSortOrder === 'asc' ? '▲' : '▼') : ''}
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

                              <td style={{ fontWeight: '600' }}>#{row.orderNumber}</td>
                              <td>
                                <span className={`product-tag ${row.product.toLowerCase()}`}>
                                  {row.product}
                                  {getSleeveTag(row.product, row.measurements) && (
                                    <span className="sleeve-badge-tag" style={{ marginLeft: '6px', fontSize: '9px', padding: '1px 4px', background: 'rgba(0,0,0,0.08)', color: 'inherit', borderRadius: '4px', fontWeight: 'bold' }}>
                                      ({getSleeveTag(row.product, row.measurements)})
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td style={{ fontWeight: '500' }}>{row.customerName}</td>
                              <td>{row.school}</td>
                              <td>{row.gender}</td>
                              <td style={{ fontWeight: '700' }}>{row.quantity}</td>
                              <td>{renderTailorMeasurements(row.product, row.measurements)}</td>
                              <td className="notes-cell" style={{ color: row.notes ? (theme === 'dark' ? '#cbd5e1' : '#334155') : '#94A3B8', fontSize: '13px' }}>
                                {row.notes || '-'}
                              </td>
                              <td style={{ color: '#E11D48', fontWeight: '600' }}>{formatDateToDMY(row.deliveryDate)}</td>
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
                        Showing {sortedTailorGarments.length} product rows
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
                            {productionCostDetails.pantQty > 0 && (
                              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '6px 0' }}>Pants</td>
                                <td style={{ padding: '6px 0' }}>₹{pricingRates.pant}</td>
                                <td style={{ padding: '6px 0' }}>{productionCostDetails.pantQty}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{productionCostDetails.pantCost.toLocaleString()}</td>
                              </tr>
                            )}
                            {productionCostDetails.pinaQty > 0 && (
                              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '6px 0' }}>Pina</td>
                                <td style={{ padding: '6px 0' }}>₹{pricingRates.pina}</td>
                                <td style={{ padding: '6px 0' }}>{productionCostDetails.pinaQty}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{productionCostDetails.pinaCost.toLocaleString()}</td>
                              </tr>
                            )}
                            {productionCostDetails.shirtHSQty > 0 && (
                              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '6px 0' }}>Shirt HS</td>
                                <td style={{ padding: '6px 0' }}>₹{pricingRates.shirtHs}</td>
                                <td style={{ padding: '6px 0' }}>{productionCostDetails.shirtHSQty}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{productionCostDetails.shirtHSCost.toLocaleString()}</td>
                              </tr>
                            )}
                            {productionCostDetails.shirtFSQty > 0 && (
                              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '6px 0' }}>Shirt FS</td>
                                <td style={{ padding: '6px 0' }}>₹{pricingRates.shirtFs}</td>
                                <td style={{ padding: '6px 0' }}>{productionCostDetails.shirtFSQty}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{productionCostDetails.shirtFSCost.toLocaleString()}</td>
                              </tr>
                            )}
                            <tr className="total-row" style={{ fontWeight: 'bold', fontSize: '13px' }}>
                              <td style={{ padding: '10px 0' }}>Total Production Cost</td>
                              <td style={{ padding: '10px 0' }}></td>
                              <td style={{ padding: '10px 0' }}>
                                {productionCostDetails.pantQty +
                                  productionCostDetails.pinaQty +
                                  productionCostDetails.shirtHSQty +
                                  productionCostDetails.shirtFSQty} pieces
                              </td>
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
                    <p className="card-title">Selected Order Details</p>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ margin: 0 }}>{selectedOrder.contactNumber}</p>
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
                      <p>{selectedOrder.school}</p>
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
                      <p className="settings-box-title">🔒 Administrator Account</p>
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

                    {/* Production Pricing Rates */}
                    <div className="settings-box">
                      <p className="settings-box-title">💵 Garment Cost Pricing Rates</p>
                      <p className="settings-box-desc">Configure the unit prices used inside the Production Queue Cost Calculator.</p>

                      <form onSubmit={handleUpdatePricing} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '4px' }}>Pants (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={pantPriceInput}
                              onChange={(e) => setPantPriceInput(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '4px' }}>Pina (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={pinaPriceInput}
                              onChange={(e) => setPinaPriceInput(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '4px' }}>Shirt HS (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={shirtHsPriceInput}
                              onChange={(e) => setShirtHsPriceInput(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: theme === 'dark' ? '#CBD5E1' : '#475569', display: 'block', marginBottom: '4px' }}>Shirt FS (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={shirtFsPriceInput}
                              onChange={(e) => setShirtFsPriceInput(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="primary-btn"
                          style={{
                            marginTop: '8px',
                            width: '100%',
                            opacity: (loadingPricing || (
                              Number(pantPriceInput) === pricingRates.pant &&
                              Number(pinaPriceInput) === pricingRates.pina &&
                              Number(shirtHsPriceInput) === pricingRates.shirtHs &&
                              Number(shirtFsPriceInput) === pricingRates.shirtFs
                            )) ? 0.55 : 1,
                            cursor: (loadingPricing || (
                              Number(pantPriceInput) === pricingRates.pant &&
                              Number(pinaPriceInput) === pricingRates.pina &&
                              Number(shirtHsPriceInput) === pricingRates.shirtHs &&
                              Number(shirtFsPriceInput) === pricingRates.shirtFs
                            )) ? 'not-allowed' : 'pointer',
                            backgroundColor: (loadingPricing || (
                              Number(pantPriceInput) === pricingRates.pant &&
                              Number(pinaPriceInput) === pricingRates.pina &&
                              Number(shirtHsPriceInput) === pricingRates.shirtHs &&
                              Number(shirtFsPriceInput) === pricingRates.shirtFs
                            )) ? (theme === 'dark' ? '#334155' : '#E2E8F0') : '',
                            color: (loadingPricing || (
                              Number(pantPriceInput) === pricingRates.pant &&
                              Number(pinaPriceInput) === pricingRates.pina &&
                              Number(shirtHsPriceInput) === pricingRates.shirtHs &&
                              Number(shirtFsPriceInput) === pricingRates.shirtFs
                            )) ? (theme === 'dark' ? '#64748B' : '#94A3B8') : '',
                            border: (loadingPricing || (
                              Number(pantPriceInput) === pricingRates.pant &&
                              Number(pinaPriceInput) === pricingRates.pina &&
                              Number(shirtHsPriceInput) === pricingRates.shirtHs &&
                              Number(shirtFsPriceInput) === pricingRates.shirtFs
                            )) ? 'none' : ''
                          }}
                          disabled={loadingPricing || (
                            Number(pantPriceInput) === pricingRates.pant &&
                            Number(pinaPriceInput) === pricingRates.pina &&
                            Number(shirtHsPriceInput) === pricingRates.shirtHs &&
                            Number(shirtFsPriceInput) === pricingRates.shirtFs
                          )}
                        >
                          {loadingPricing ? 'Saving...' : 'Save Pricing Rates'}
                        </button>
                      </form>
                    </div>

                    {/* Backup & restore management */}
                    <div className="settings-box">
                      <p className="settings-box-title">💾 Database Backups & Recovery</p>
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
                                  ⬇️ Download
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={handleCreateBackup}
                          style={{ flex: 1 }}
                        >
                          Create Backup Now
                        </button>
                        <label className="backup-upload-label" style={{ flex: 1, padding: '0', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                      <p className="settings-box-title">💬 WhatsApp Integration Mode</p>
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
                      <p className="settings-box-title">📱 Active Logged-In Devices</p>
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
                                    {s.userAgent.toLowerCase().includes('iphone') || s.userAgent.toLowerCase().includes('android') || s.userAgent.toLowerCase().includes('ios') ? '📱' : '💻'}
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
                          🚪 Log Out All Other Devices
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="settings-right-col">
                    {/* Timeline Audit Logs */}
                    <div className="settings-box" style={{ height: '100%' }}>
                      <p className="settings-box-title">📋 System Audit Logs</p>
                      <p className="settings-box-desc">Real-time trail of edits, creations, deletions, and status changes made to your data.</p>

                      <div className="audit-timeline" style={{ maxHeight: '620px', overflowY: 'auto' }}>
                        {loadingAuditLogs ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>Loading audit trail...</p>
                        ) : auditLogs.length === 0 ? (
                          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B', margin: '16px 0' }}>No logs recorded yet.</p>
                        ) : (
                          auditLogs.map((log) => (
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
    </div>
  )
}

export default App
