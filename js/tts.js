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

  noEnglishVoiceWarning = true;
  return null;
}

export function init() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      available = false;
      initialized = true;
      resolve(false);
      return;
    }

    let voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      selectedVoice = selectBestVoice(voices);
      available = !!selectedVoice;
      initialized = true;
      resolve(available);
      return;
    }

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
        voices = speechSynthesis.getVoices();
        selectedVoice = selectBestVoice(voices);
        available = !!selectedVoice;
        initialized = true;
        resolved = true;
        resolve(available);
      }
    }, VOICE_POLL_INTERVAL_MS);

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

export function speak(text, speed = 'normal') {
  return new Promise((resolve, reject) => {
    if (!available || !selectedVoice) {
      reject(new Error('TTS not available'));
      return;
    }

    speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || 'en-US';
      utterance.rate = RATE_MAP[speed] || 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => resolve();

      utterance.onerror = (event) => {
        if (!navigator.onLine) {
          reject(new Error('offline'));
        } else if (event.error === 'canceled') {
          resolve();
        } else {
          reject(new Error('tts_error'));
        }
      };

      speechSynthesis.speak(utterance);
    }, 100);
  });
}

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

export function stop() {
  if (window.speechSynthesis) {
    speechSynthesis.cancel();
  }
}

export function isAvailable() {
  return available;
}

export function getVoiceName() {
  return selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : 'none';
}

export function hasNoEnglishVoice() {
  return noEnglishVoiceWarning;
}

export function onInterrupt(callback) {
  onInterruptCallback = callback;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else if (onInterruptCallback) {
      onInterruptCallback();
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => stop());
}
