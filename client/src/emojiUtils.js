/**
 * emojiUtils.js
 * Targeted emoji support detection with per-emoji fallback registry.
 *
 * KEY DESIGN PRINCIPLE:
 *   Detection is ONLY applied to emoji that are KNOWN to cause empty boxes
 *   on certain devices (variation-selector emoji and newer Unicode emoji).
 *   All other emoji (like 📄, 📊, 🔔, ➕, etc.) are returned UNCHANGED --
 *   they will NEVER be incorrectly replaced on devices that support them.
 */

// --- Detection cache ---
const _supportCache = new Map();

/**
 * Set of emoji that need runtime detection.
 * These are known to show as empty boxes on older Android / Windows:
 *   1. Variation-selector emoji (U+FE0F): base char exists but emoji form may not
 *   2. Newer Unicode emoji (11.0+, 2018+): not in old OS emoji fonts
 */
const NEEDS_DETECTION = new Set([
  '\u270F\uFE0F',    // ✏️  pencil
  '\u{1F5D1}\uFE0F', // 🗑️  wastebasket
  '\u{1F441}\uFE0F', // 👁️  eye
  '\u2699\uFE0F',    // ⚙️  gear
  '\u{1F3F7}\uFE0F', // 🏷️  label/tag
  '\u{1F5A8}\uFE0F', // 🖨️  printer
  '\u2B07\uFE0F',    // ⬇️  down arrow
  '\u23F1\uFE0F',    // ⏱️  timer
  '\u26A0\uFE0F',    // ⚠️  warning
  '\u2139\uFE0F',    // ℹ️  info
  '\u{1F9F5}',       // 🧵  thread (Unicode 11.0, 2018)
  '\u{1F3EC}',       // 🏬  store building
  '\u{1F3ED}',       // 🏭  factory
]);

/**
 * Canvas-based detection for known-problematic emoji.
 * Compares rendering against a Private Use Area char (always unsupported).
 * For variation-selector emoji, also checks if it renders same as base char.
 */
function detectEmojiSupport(emoji) {
  if (_supportCache.has(emoji)) return _supportCache.get(emoji);
  if (typeof document === 'undefined') return true;

  try {
    const SIZE = 20;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    ctx.font = '16px sans-serif';

    // Baseline: a Private Use Area char that no font has a glyph for
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillText('\uE000', 0, 14);
    const tofuData = ctx.getImageData(0, 0, SIZE, SIZE).data;

    // Render the emoji
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillText(emoji, 0, 14);
    const emojiData = ctx.getImageData(0, 0, SIZE, SIZE).data;

    let differs = false;
    for (let i = 0; i < emojiData.length; i++) {
      if (emojiData[i] !== tofuData[i]) { differs = true; break; }
    }

    // Extra check for variation-selector emoji: if it renders the same as
    // the base char (without \uFE0F), the variation selector was ignored and
    // the device may show an empty box instead of the colored emoji.
    if (differs && emoji.includes('\uFE0F')) {
      const base = emoji.replace(/\uFE0F/g, '');
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillText(base, 0, 14);
      const baseData = ctx.getImageData(0, 0, SIZE, SIZE).data;
      let sameAsBase = true;
      for (let i = 0; i < emojiData.length; i++) {
        if (emojiData[i] !== baseData[i]) { sameAsBase = false; break; }
      }
      if (sameAsBase) differs = false;
    }

    _supportCache.set(emoji, differs);
    return differs;
  } catch {
    return true;
  }
}

// --- Fallback registry ---
// Only problematic emoji need entries here.
export const EMOJI_REGISTRY = {
  '\u270F\uFE0F':    ['\u270E', '/'],       // ✏️  -> pencil text form -> slash
  '\u{1F5D1}\uFE0F': ['\u2715', 'x'],      // 🗑️  -> cross mark -> x
  '\u{1F441}\uFE0F': ['\u{1F441}', 'O'],   // 👁️  -> eye without VS -> O
  '\u2699\uFE0F':    ['\u2630', '*'],       // ⚙️  -> three lines -> asterisk
  '\u{1F3F7}\uFE0F': ['\u{1F516}', '#'],   // 🏷️  -> bookmark -> hash
  '\u{1F5A8}\uFE0F': ['\u2399', 'P'],      // 🖨️  -> print symbol -> P
  '\u2B07\uFE0F':    ['\u2193', 'v'],      // ⬇️  -> down arrow -> v
  '\u23F1\uFE0F':    ['\u231B', 'T'],      // ⏱️  -> hourglass -> T
  '\u26A0\uFE0F':    ['!', 'W'],           // ⚠️  -> exclamation -> W
  '\u2139\uFE0F':    ['(i)', 'i'],         // ℹ️  -> info text -> i
  '\u{1F9F5}':       ['\u2702', '~'],      // 🧵  -> scissors -> tilde
  '\u{1F3EC}':       ['\u{1F3E2}', 'S'],  // 🏬  -> office building -> S
  '\u{1F3ED}':       ['\u{1F3EC}', 'F'],  // 🏭  -> store -> F
};

/**
 * Returns the best emoji for the current device.
 *
 * - If the emoji is NOT in NEEDS_DETECTION: returned unchanged immediately.
 *   This guarantees emoji like 📄, 📊, 🔔, ➕, 📋, etc. are NEVER replaced
 *   on devices that already support them.
 *
 * - If in NEEDS_DETECTION and supported on this device: returned unchanged.
 * - If in NEEDS_DETECTION and NOT supported: returns first available fallback.
 */
export function getSafeEmoji(primaryEmoji) {
  // Fast path: not a known-problematic emoji -- return as-is, no detection
  if (!NEEDS_DETECTION.has(primaryEmoji)) return primaryEmoji;

  // Detection only runs for known-problematic emoji
  if (detectEmojiSupport(primaryEmoji)) return primaryEmoji;

  const fallbacks = EMOJI_REGISTRY[primaryEmoji];
  if (!fallbacks || fallbacks.length === 0) return primaryEmoji;

  for (const fb of fallbacks) {
    if ([...fb].length <= 2) return fb; // Short text always safe
    if (detectEmojiSupport(fb)) return fb;
  }

  return fallbacks[fallbacks.length - 1];
}

export const isEmojiSupported = detectEmojiSupport;
