/**
 * icons.jsx — Premium SVG Icon Library
 *
 * Lucide-style stroke icons: 24×24 viewBox, stroke="currentColor", fill="none"
 * Works identically on every device, OS, and browser — no emoji font dependency.
 */

const _baseSvg = (size, color, style, className, children) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color || 'currentColor'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    className={className}
    aria-hidden="true"
  >{children}</svg>
);

export const TrashIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  <path d="M10 11v6M14 11v6" />
  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
</>);

export const PencilIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
</>);

export const EyeIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
  <circle cx="12" cy="12" r="3" />
</>);

export const EyeOffIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
  <line x1="1" y1="1" x2="23" y2="23" />
</>);

export const PlusIcon = ({ size=16, color, style, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const XIcon = ({ size=16, color, style, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const SaveIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
  <polyline points="17 21 17 13 7 13 7 21" />
  <polyline points="7 3 7 8 15 8" />
</>);

export const SearchIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <circle cx="11" cy="11" r="8" />
  <line x1="21" y1="21" x2="16.65" y2="16.65" />
</>);

export const CheckIcon = ({ size=16, color, style, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CheckCircleIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
  <polyline points="22 4 12 14.01 9 11.01" />
</>);

export const RefreshIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <polyline points="23 4 23 10 17 10" />
  <polyline points="1 20 1 14 7 14" />
  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
  <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
</>);

export const SettingsIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
</>);

export const BarChartIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <line x1="18" y1="20" x2="18" y2="10" />
  <line x1="12" y1="20" x2="12" y2="4" />
  <line x1="6" y1="20" x2="6" y2="14" />
  <line x1="2" y1="20" x2="22" y2="20" />
</>);

export const PackageIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
  <line x1="12" y1="22.08" x2="12" y2="12" />
</>);

export const ClipboardIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  <line x1="12" y1="11" x2="16" y2="11" />
  <line x1="12" y1="15" x2="16" y2="15" />
</>);

export const ClockIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <circle cx="12" cy="12" r="10" />
  <polyline points="12 6 12 12 16 14" />
</>);

export const TruckIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <rect x="1" y="3" width="15" height="13" />
  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
  <circle cx="5.5" cy="18.5" r="2.5" />
  <circle cx="18.5" cy="18.5" r="2.5" />
</>);

export const CurrencyIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <line x1="12" y1="1" x2="12" y2="23" />
  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
</>);

export const BellIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
</>);

export const StoreIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
  <path d="M3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
  <path d="M12 3v6" />
  <path d="M9 14h6" />
</>);

export const ScissorsIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <circle cx="6" cy="6" r="3" />
  <circle cx="6" cy="18" r="3" />
  <line x1="20" y1="4" x2="8.12" y2="15.88" />
  <line x1="14.47" y1="14.48" x2="20" y2="20" />
  <line x1="8.12" y1="8.12" x2="12" y2="12" />
</>);

export const FactoryIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
  <path d="M17 18h1M12 18h1M7 18h1" />
</>);

export const BuildingIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <rect x="3" y="3" width="18" height="18" rx="2" />
  <path d="M9 22V12h6v10" />
  <path d="M8 7h.01M12 7h.01M16 7h.01" />
  <path d="M8 11h.01M12 11h.01M16 11h.01" />
</>);

export const FileIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <polyline points="14 2 14 8 20 8" />
  <line x1="16" y1="13" x2="8" y2="13" />
  <line x1="16" y1="17" x2="8" y2="17" />
</>);

export const NoteIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <polyline points="14 2 14 8 20 8" />
  <line x1="16" y1="13" x2="8" y2="13" />
  <line x1="13" y1="17" x2="8" y2="17" />
  <line x1="10" y1="9" x2="8" y2="9" />
</>);

export const PrinterIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <polyline points="6 9 6 2 18 2 18 9" />
  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
  <rect x="6" y="14" width="12" height="8" />
</>);

export const DownloadIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <polyline points="7 10 12 15 17 10" />
  <line x1="12" y1="15" x2="12" y2="3" />
</>);

export const AlertIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
  <line x1="12" y1="9" x2="12" y2="13" />
  <line x1="12" y1="17" x2="12.01" y2="17" />
</>);

export const InfoIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <circle cx="12" cy="12" r="10" />
  <line x1="12" y1="16" x2="12" y2="12" />
  <line x1="12" y1="8" x2="12.01" y2="8" />
</>);

export const LoaderIcon = ({ size=16, color, style, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'icon-spin 1s linear infinite', ...style }} className={className} aria-hidden="true">
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
);

export const TimerIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <circle cx="12" cy="12" r="10" />
  <polyline points="12 6 12 12 16 14" />
</>);

export const LockIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
</>);

export const TagIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
  <line x1="7" y1="7" x2="7.01" y2="7" />
</>);

export const MessageIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
</>);

export const CalendarIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
  <line x1="16" y1="2" x2="16" y2="6" />
  <line x1="8" y1="2" x2="8" y2="6" />
  <line x1="3" y1="10" x2="21" y2="10" />
</>);

export const DatabaseIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <ellipse cx="12" cy="5" rx="9" ry="3" />
  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
</>);

export const SmartphoneIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
  <line x1="12" y1="18" x2="12.01" y2="18" />
</>);

export const LaptopIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9" />
  <line x1="1" y1="16" x2="23" y2="16" />
</>);

export const LogOutIcon = ({ size=16, color, style, className }) => _baseSvg(size, color, style, className, <>
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  <polyline points="16 17 21 12 16 7" />
  <line x1="21" y1="12" x2="9" y2="12" />
</>);
