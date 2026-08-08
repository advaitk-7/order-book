/**
 * emojiUtils.js
 * Canvas-based emoji glyph support detection with a per-emoji fallback registry.
 * Works entirely client-side. Zero external dependencies.
 * Results are cached so each emoji is tested only ONCE per page load.
 *
 * Behaviour:
 *  - If the primary emoji IS supported on this device -> returned unchanged.
 *  - If NOT supported -> walks the fallback list and returns the first one that IS supported.
 *  - If none are supported -> returns the last fallback as plain text.
 */

// --- Detection cache ---
const _supportCache = new Map();

/**
 * Tests whether the current OS / browser can render a given emoji as a
 * proper coloured glyph (not a tofu box / hollow square / question mark).
 *
 * Detection strategy (COLOR CHANNEL analysis):
 *   Modern color emoji have non-uniform RGB pixel values (R != G or G != B).
 *   Unsupported glyph fallbacks (boxes, dotted squares, etc.) are rendered as
 *   monochrome glyphs where R = G = B for every pixel.
 *   We draw the emoji on a canvas and check whether any pixel is truly coloured.
 *
 *   This is more reliable than comparing against a tofu char (\uFFFD), because
 *   on many older Android devices an unsupported emoji renders as a rectangular
 *   placeholder box whose pixel pattern differs from \uFFFD but is still not
 *   a real emoji -- the old detection would incorrectly report it as "supported".
 *
 * @param {string} emoji  - Single emoji string to test
 * @returns {boolean}
 */
export function isEmojiSupported(emoji) {
  if (_supportCache.has(emoji)) return _supportCache.get(emoji);

  // SSR / non-browser safety guard
  if (typeof document === 'undefined') return true;

  try {
    const SIZE = 24;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true; // canvas not supported - assume OK

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.font = `${SIZE - 4}px Arial, sans-serif`;
    ctx.fillText(emoji, 0, SIZE - 4);

    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    // Check for any non-grayscale (coloured) pixel.
    // Real color emoji -> at least some pixels have R != G or G != B.
    // Monochrome fallback boxes -> all pixels satisfy R = G = B.
    let hasColor = false;
    let hasPixels = false;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a > 10) { // pixel is visible
        hasPixels = true;
        if (Math.abs(r - g) > 10 || Math.abs(g - b) > 10) {
          hasColor = true;
          break;
        }
      }
    }

    // Emoji is "supported" only if it rendered with color.
    const supported = hasPixels && hasColor;
    _supportCache.set(emoji, supported);
    return supported;
  } catch {
    // Any error -> assume supported to avoid accidental fallbacks
    return true;
  }
}

// --- Fallback registry ---
/**
 * Central dictionary of every emoji used in the app.
 * Format:  primary -> [fallback1, fallback2, ...]
 *
 * Fallbacks are ordered from "richest supported" to "plain text last resort".
 * Short text/symbol fallbacks (like '+', 'x', checkmark) are universally safe.
 */
export const EMOJI_REGISTRY = {

  // Navigation
  '\u{1F4CA}': ['\u{1F4C8}', '\u2630'],          // Dashboard (bar chart -> line chart -> menu)
  '\u2795': ['+', '\u271A'],                       // New Order / add
  '\u{1F4CB}': ['\u{1F4DD}', '\u2630'],           // Orders list
  '\u{1F9F5}': ['\u2702', '~'],                    // Production Queue (thread 2018 emoji -> scissors)
  '\u{1F514}': ['\u{1F4E2}', '!'],                // Stock Waitlist (bell -> megaphone)
  '\u{1F3EC}': ['\u{1F3E2}', 'S'],                // Supplier Restock (store -> office)
  '\u{1F3E2}': ['\u{1F3EC}', 'C'],                // Corporate Orders (office -> store)
  '\u{1F3ED}': ['\u{1F3EC}', 'F'],                // Factory / supplier
  '\u2699\uFE0F': ['\u2630', '*'],                 // Settings (gear with variation selector)
  '\u{1F3F7}\uFE0F': ['\u{1F516}', '#'],          // Tag / label

  // Login page
  // Eye and monkey hide emoji often fail on older Android (variation-selector issue)
  '\u{1F441}\uFE0F': ['\u{1F441}', 'O'],          // Show password (eye with VS -> eye without VS)
  '\u{1F648}': ['X', '*'],                         // Hide password (see-no-evil)

  // Order table actions
  // Pencil and trash are the main reported problem emojis
  '\u270F\uFE0F': ['\u270E', '/'],                 // Edit (pencil with VS -> pencil without VS)
  '\u{1F5D1}\uFE0F': ['\u2715', 'x'],             // Delete (wastebasket with VS -> cross mark)

  // Production Queue / Export
  '\u{1F5A8}\uFE0F': ['\u2399', 'P'],             // Print
  '\u{1F4C4}': ['\u2610', 'F'],                   // PDF / document
  '\u231B': ['\u2026', 'O'],                       // Hourglass
  '\u2B07\uFE0F': ['\u2193', 'v'],                // Download

  // Time
  '\u23F1\uFE0F': ['\u231B', '\u23F3', 'T'],      // Timer / stopwatch
  '\u23F3': ['\u231B', '\u2026'],                  // Hourglass pending

  // Settings / account
  '\u{1F512}': ['#', 'L'],                         // Lock
  '\u{1F4BE}': ['\u2193', 'S'],                    // Save (floppy disk)
  '\u{1F4F1}': ['M', 'p'],                         // Mobile device
  '\u{1F4BB}': ['PC', 'L'],                        // Laptop
  '\u{1F6AA}': ['\u2190', '<'],                    // Logout door
  '\u{1F504}': ['\u21BA', 'R'],                    // Refresh / sync

  // Waitlist / stock
  '\u{1F4E6}': ['\u2610', 'B'],                    // Package / item
  '\u{1F4B0}': ['\u20B9', '$'],                    // Money (bag -> rupee -> dollar)
  '\u{1F4B5}': ['\u20B9', '$'],                    // Cash (note -> rupee -> dollar)
  '\u{1F4AC}': ['\u2709', '\u2026'],               // Message / comment
  '\u{1F4C5}': ['D', 'C'],                         // Calendar / date

  // Status indicators
  '\u2705': ['\u2713', 'Y'],                       // Done / ready (green check)
  '\u{1F69A}': ['\u2192', '>'],                    // Delivery truck
  '\u274C': ['\u2715', 'X'],                       // Error / cancel
  '\u26A0\uFE0F': ['!', 'W'],                      // Warning

  // Misc
  '\u{1F50D}': ['?', 'Q'],                         // Search
  '\u2139\uFE0F': ['(i)', 'i'],                    // Info
};

// --- Main resolver ---
/**
 * Returns the best supported emoji for the current device.
 * If the primary emoji is supported -> returns it unchanged.
 * If not -> walks through the fallback list in order and returns the
 *           first one that IS supported.
 * If nothing in the list is supported -> returns the last fallback as plain text.
 *
 * NOTE: Short text fallbacks (like 'x', '+', '/', 'O') always pass through
 * as-is since they are plain ASCII/Unicode and universally renderable.
 *
 * @param {string} primaryEmoji - The preferred emoji (as shown on modern devices)
 * @returns {string} The best emoji string for this device
 */
export function getSafeEmoji(primaryEmoji) {
  if (isEmojiSupported(primaryEmoji)) return primaryEmoji;

  const fallbacks = EMOJI_REGISTRY[primaryEmoji];
  if (!fallbacks || fallbacks.length === 0) return primaryEmoji;

  for (const fb of fallbacks) {
    // Short text / symbol fallbacks are always safe -- skip emoji color check
    if ([...fb].length <= 2) return fb;
    if (isEmojiSupported(fb)) return fb;
  }

  // Absolute last resort: return the final fallback as plain text
  return fallbacks[fallbacks.length - 1];
}
