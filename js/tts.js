// tts.js — Web Speech API wrapper with iOS workarounds, offline detection, error handling

// ── Constants ──────────────────────────────────────────────────────────────

const VOICE_WAIT_TIMEOUT_MS = 3000;
const VOICE_POLL_INTERVAL_MS = 250;
const VOICE_POLL_MAX_MS = 3000;

const RATE_MAP = {
  slow: 0.7,
  normal: 1.0,
  fast: 1.3,
};

// ── State ──────────────────────────────────────────────────────────────────

let selectedVoice = null;
let available = false;
let initialized = false;
let onInterruptCallback = null;
let noEnglishVoiceWarning = false;

// ── Voice selection (TD-008) ───────────────────────────────────────────────

/**
 * Select the best English voice from a list.
 * Priority: Samantha/Daniel → en-US → en-* → null (with warning).
 * BUG-002: No longer silently falls back to non-English voice.
 */
function selectBestVoice(voices) {
  if (!voices || voices.length === 0) return null;

  const preferred = voices.find(v =>
    /samantha|daniel/i.test(v.name) && v.lang.startsWith('en')
  );
  if (preferred) { noEnglishVoiceWarning = false; return preferred; }

  const enUS = voices.find(v => v.lang === 'en-US');
  if (enUS) { noEnglishVoiceWarning = false; return enUS; }

  const enAny = voices.find(v => v.lang.startsWith('en'));
  if (enAny) { noEnglishVoiceWarning = false; return enAny; }

  // BUG-002: Do NOT silently fall back to a non-English voice.
  // Set warning flag so init() can notify the UI.
  noEnglishVoiceWarning = true;
  return null;
}

// ── Initialization ─────────────────────────────────────────────────────────

/**
 * Initialize TTS: wait for voices, select best English voice.
 * Must be called once at startup. Returns true if TTS is usable.
 * @returns {Promise<boolean>}
 */
export function init() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      available = false;
      initialized = true;
      resolve(false);
      return;
    }

    // Try getting voices immediately
    let voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      selectedVoice = selectBestVoice(voices);
      available = !!selectedVoice;
      initialized = true;
      resolve(available);
      return;
    }

    // Wait for voiceschanged event (async on most browsers)
    let resolved = false;

    const onVoicesChanged = () => {
      if (resolved) return;
      voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        selectedVoice = selectBestVoice(voices);
        available = !!selectedVoice;
        initialized = true;
        resolved = true;
        resolve(available);
      }
    };

    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    // Fallback: poll for voices if event doesn't fire (iOS quirk)
    let pollElapsed = 0;
    const pollTimer = setInterval(() => {
      pollElapsed += VOICE_POLL_INTERVAL_MS;
      voices = speechSynthesis.getVoices();
      if (voices.length > 0 && !resolved) {
        clearInterval(pollTimer);
        onVoicesChanged();
      }
      if (pollElapsed >= VOICE_POLL_MAX_MS && !resolved) {
        clearInterval(pollTimer);
        // Last attempt
        voices = speechSynthesis.getVoices();
        selectedVoice = selectBestVoice(voices);
        available = !!selectedVoice;
        initialized = true;
        resolved = true;
        resolve(available);
      }
    }, VOICE_POLL_INTERVAL_MS);

    // Hard timeout
    setTimeout(() => {
      if (!resolved) {
        clearInterval(pollTimer);
        voices = speechSynthesis.getVoices();
        selectedVoice = selectBestVoice(voices);
        available = !!selectedVoice;
        initialized = true;
        resolved = true;
        resolve(available);
      }
    }, VOICE_WAIT_TIMEOUT_MS);
  });
}

// ── Speak ──────────────────────────────────────────────────────────────────

/**
 * Speak the given text using Web Speech API.
 * @param {string} text - Text to speak (in English)
 * @param {'slow'|'normal'|'fast'} speed - Speed preset name
 * @returns {Promise<void>} Resolves when speech ends, rejects on error
 */
export function speak(text, speed = 'normal') {
  return new Promise((resolve, reject) => {
    if (!available || !selectedVoice) {
      reject(new Error('TTS not available'));
      return;
    }

    // Cancel any ongoing speech (TR-6 workaround)
    speechSynthesis.cancel();

    // Small delay after cancel for iOS stability
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || 'en-US';
      utterance.rate = RATE_MAP[speed] || 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => resolve();

      utterance.onerror = (event) => {
        // Distinguish offline vs generic TTS error (ISSUE-005)
        if (!navigator.onLine) {
          reject(new Error('offline'));
        } else if (event.error === 'canceled') {
          // Canceled is not a real error (user triggered cancel)
          resolve();
        } else {
          reject(new Error('tts_error'));
        }
      };

      speechSynthesis.speak(utterance);
    }, 100);
  });
}

// ── Warm-up (UX-002) ───────────────────────────────────────────────────────

/**
 * Silent warm-up for iOS: triggers speech in a user gesture handler
 * without producing audible sound. Uses volume=0 with a single space.
 */
export function warmUp() {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(' ');
  utterance.volume = 0;
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || 'en-US';
  }
  speechSynthesis.speak(utterance);
}

// ── Stop ───────────────────────────────────────────────────────────────────

/**
 * Stop any ongoing speech.
 */
export function stop() {
  if (window.speechSynthesis) {
    speechSynthesis.cancel();
  }
}

// ── Status ─────────────────────────────────────────────────────────────────

/**
 * Check if TTS is available and initialized.
 */
export function isAvailable() {
  return available;
}

/**
 * Get the name of the selected voice (for diagnostics).
 */
export function getVoiceName() {
  return selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : 'none';
}

/**
 * Check if no English voice was found (BUG-002).
 * When true, the UI should warn the user.
 */
export function hasNoEnglishVoice() {
  return noEnglishVoiceWarning;
}

// ── Visibility change handler (EC-3) ───────────────────────────────────────

/**
 * Set a callback for when TTS may have been interrupted by tab switch.
 */
export function onInterrupt(callback) {
  onInterruptCallback = callback;
}

// Handle visibility changes — cancel TTS when tab goes hidden
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else if (onInterruptCallback) {
      onInterruptCallback();
    }
  });
}

// Cancel TTS on page unload (EC-2)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => stop());
}
