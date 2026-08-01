/**
 * emojiUtils.js
 * Canvas-based emoji glyph support detection with a per-emoji fallback registry.
 * Works entirely client-side. Zero external dependencies.
 * Results are cached so each emoji is tested only ONCE per page load.
 */

// ─── Detection cache ──────────────────────────────────────────────────────────
const _supportCache = new Map();

/**
 * Tests whether the current OS / browser can render a given emoji as a
 * coloured glyph (i.e. not a tofu box or blank square).
 *
 * Strategy: Draw the emoji on a 16×16 canvas, then compare the ImageData
 * to a known "missing glyph" reference rendered with an unsupported character.
 * If the pixels differ from the reference, the emoji IS supported.
 *
 * @param {string} emoji  - Single emoji string to test
 * @returns {boolean}
 */
export function isEmojiSupported(emoji) {
  if (_supportCache.has(emoji)) return _supportCache.get(emoji);

  // SSR / non-browser safety guard
  if (typeof document === 'undefined') return true;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true; // canvas not supported – assume OK

    ctx.font = '14px Arial, sans-serif';
    ctx.clearRect(0, 0, 16, 16);

    // Render a known-unsupported character as the "tofu" reference
    ctx.fillText('\uFFFD', 0, 12);
    const tofuData = ctx.getImageData(0, 0, 16, 16).data;

    // Now render the actual emoji
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillText(emoji, 0, 12);
    const emojiData = ctx.getImageData(0, 0, 16, 16).data;

    // If the pixel arrays differ, the emoji rendered as something real
    let differs = false;
    for (let i = 0; i < emojiData.length; i++) {
      if (emojiData[i] !== tofuData[i]) { differs = true; break; }
    }

    _supportCache.set(emoji, differs);
    return differs;
  } catch {
    // Any error → assume supported to avoid accidental fallbacks
    return true;
  }
}

// ─── Fallback registry ────────────────────────────────────────────────────────
/**
 * Central dictionary of every emoji used in the app.
 * Format:  primary → [fallback1, fallback2, ...]
 *
 * Fallbacks use older, universally supported Unicode code-points that render
 * correctly on Windows 7/8, older macOS, older Android, and older Linux.
 */
export const EMOJI_REGISTRY = {
  // ── Navigation ──────────────────────────────────────────────────
  '📊': ['📈', '☰'],          // Dashboard
  '➕': ['+', '✚'],            // New Order
  '📋': ['📝', '☰'],          // Orders
  '🧵': ['✂️', '⚙️'],         // Production Queue
  '🔔': ['📢', '!'],           // Stock Waitlist
  '🏬': ['🏭', 'B'],          // Party Restock
  '🏭': ['🏬', 'F'],          // Vendor Factory
  '⚙️': ['☰', '*'],           // Settings

  // ── Login page ──────────────────────────────────────────────────
  '👁️': ['👁', '●'],          // Show password
  '🙈': ['●', '*'],            // Hide password

  // ── Order table actions ─────────────────────────────────────────
  '✏️': ['✎', '✐'],           // Edit order
  '🗑️': ['✕', '✖'],          // Delete order

  // ── Production Queue / Export ───────────────────────────────────
  '🖨️': ['⎙', '✉'],          // Print
  '📄': ['☐', '≡'],           // Save as PDF
  '⌛': ['…', '◔'],            // Generating / loading
  '⬇️': ['↓', '▼'],           // Download / export

  // ── Settings / sessions / account ──────────────────────────────
  '🔒': ['☐', '#'],            // Lock / security
  '💾': ['S', '↓'],            // Save
  '📱': ['☐', 'M'],            // Mobile device
  '💻': ['☐', 'PC'],           // Desktop / laptop
  '🚪': ['←', '◄'],            // Logout door
  '🔄': ['↺', '↻'],           // Refresh / sync

  // ── Waitlist / stock ────────────────────────────────────────────
  '📦': ['☐', '[  ]'],         // Package / item
  '💰': ['$', '₹'],            // Money / pricing
  '💵': ['$', '₹'],            // Cash
  '💬': ['✉', '…'],            // Comment / message
  '📅': ['☐', 'D'],            // Date / calendar

  // ── Status indicators ───────────────────────────────────────────
  '✅': ['✓', 'OK'],           // Delivered / done
  '⏳': ['…', '◔'],            // Pending
  '🚚': ['→', '▶'],            // Delivery
  '❌': ['✕', 'X'],            // Error / cancel
  '⚠️': ['!', '!!'],           // Warning

  // ── Misc / miscellaneous ────────────────────────────────────────
  '🔍': ['?', '»'],             // Search
  'ℹ️': ['(i)', '!'],          // Info note
};

// ─── Main resolver ────────────────────────────────────────────────────────────
/**
 * Returns the best supported emoji for the current device.
 * If the primary emoji is supported → returns it unchanged.
 * If not → walks through the fallback list in order and returns the
 *           first one that IS supported.
 * If nothing in the list is supported → returns the last fallback as plain text.
 *
 * @param {string} primaryEmoji - The preferred emoji (as shown on modern devices)
 * @returns {string} The best emoji string for this device
 */
export function getSafeEmoji(primaryEmoji) {
  if (isEmojiSupported(primaryEmoji)) return primaryEmoji;

  const fallbacks = EMOJI_REGISTRY[primaryEmoji];
  if (!fallbacks || fallbacks.length === 0) return primaryEmoji;

  for (const fb of fallbacks) {
    if (isEmojiSupported(fb)) return fb;
  }

  // Absolute last resort: return the final fallback as plain text
  return fallbacks[fallbacks.length - 1];
}
