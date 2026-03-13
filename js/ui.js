// ui.js — DOM manipulation, screen navigation, button rendering, feedback

// ── Screen management ──────────────────────────────────────────────────────

const screens = {};
let currentScreen = null;

/**
 * Initialize screen references from DOM.
 * Call once after DOMContentLoaded.
 */
export function initScreens() {
  document.querySelectorAll('.screen').forEach(el => {
    screens[el.id.replace('screen-', '')] = el;
  });
}

/**
 * Show a screen by name, hide all others.
 * @param {'onboarding'|'menu'|'training'|'summary'|'error'} name
 */
export function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('active', key === name);
  }
  currentScreen = name;
}

// ── Number formatting (ISSUE-007) ──────────────────────────────────────────

/**
 * Format a number for display: add thin spaces for large numbers.
 * Years (1100–2099) are never formatted with separators (BUG-001).
 * E.g. 999999 → "999 999", 1987 → "1987", 42 → "42"
 * @param {number} n
 * @param {boolean} [isYear=false] - If true, skip digit separators
 * @returns {string}
 */
export function formatNumber(n, isYear = false) {
  // Years should never have separators (BUG-001)
  if (isYear || (n >= 1100 && n <= 2099)) return String(n);
  if (n < 1000) return String(n);
  // Use non-breaking thin space as separator
  return n.toLocaleString('uk-UA').replace(/\s/g, '\u2009');
}

// ── Options rendering ──────────────────────────────────────────────────────

let buttonsLocked = false;
let optionClickHandler = null;

/**
 * Render 4 option buttons in the options grid.
 * @param {number[]} options - Array of 4 numbers (shuffled)
 * @param {function} onClick - Callback(selectedNumber, buttonIndex)
 */
export function renderOptions(options, onClick) {
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  buttonsLocked = false;
  optionClickHandler = onClick;

  options.forEach((num, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.setAttribute('lang', 'en');
    btn.textContent = formatNumber(num);
    btn.dataset.value = num;
    btn.dataset.index = index;
    btn.addEventListener('click', () => {
      if (buttonsLocked) return; // Double-tap protection (EC-5)
      lockButtons();
      onClick(num, index);
    });
    grid.appendChild(btn);
  });
}

// ── Button locking (US-002 AC-6) ───────────────────────────────────────────

/**
 * Lock all option buttons to prevent double-tap.
 */
export function lockButtons() {
  buttonsLocked = true;
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
  });
}

/**
 * Unlock all option buttons.
 */
export function unlockButtons() {
  buttonsLocked = false;
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = false;
  });
}

// ── Feedback ───────────────────────────────────────────────────────────────

/**
 * Show correct answer feedback (green highlight).
 * @param {number} correctIndex - Index of the correct button
 */
export function showCorrect(correctIndex) {
  const buttons = document.querySelectorAll('.option-btn');
  if (buttons[correctIndex]) {
    buttons[correctIndex].classList.add('correct');
  }
}

/**
 * Show wrong answer feedback: red on selected, green on correct.
 * @param {number} selectedIndex - Index of the button user tapped
 * @param {number} correctIndex - Index of the correct button
 */
export function showWrong(selectedIndex, correctIndex) {
  const buttons = document.querySelectorAll('.option-btn');
  if (buttons[selectedIndex]) {
    buttons[selectedIndex].classList.add('wrong');
  }
  if (buttons[correctIndex]) {
    buttons[correctIndex].classList.add('correct');
  }
}

/**
 * Clear all feedback classes from option buttons.
 */
export function clearFeedback() {
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.classList.remove('correct', 'wrong');
  });
}

// ── Score display ──────────────────────────────────────────────────────────

/**
 * Update the score counter display.
 * @param {number} correct
 * @param {number} total
 */
export function updateScore(correct, total) {
  const el = document.getElementById('score-display');
  if (el) {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    el.textContent = `${correct}/${total} — ${pct}%`;
  }
}

// ── Summary screen ─────────────────────────────────────────────────────────

const MODE_LABELS = {
  simple: 'Прості числа (1–100)',
  years: 'Роки (1900–2100)',
  large: 'Великі числа (100–999 999)',
  mixed: 'Змішаний',
};

/**
 * Show summary screen with session results.
 * @param {{correct: number, total: number, percent: number, mode: string}} stats
 */
export function showSummary(stats) {
  document.getElementById('summary-correct').textContent = stats.correct;
  document.getElementById('summary-total').textContent = stats.total;
  document.getElementById('summary-percent').textContent = stats.percent + '%';
  document.getElementById('summary-mode').textContent = MODE_LABELS[stats.mode] || stats.mode;
  showScreen('summary');
}

// ── Error display ──────────────────────────────────────────────────────────

/**
 * Show a TTS error message (US-012).
 * @param {string} message
 */
export function showError(message) {
  const el = document.getElementById('error-message');
  if (el) el.textContent = message;
  showScreen('error');
}

/**
 * Show an inline warning toast (non-blocking).
 * @param {string} message
 */
export function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

/**
 * Show offline warning for TTS (ISSUE-005).
 */
export function showOfflineWarning() {
  showToast('Потрібне з\'єднання для озвучення. Перевірте інтернет і спробуйте знову.');
}

// ── Next button visibility ─────────────────────────────────────────────────

/**
 * Show or hide the "Далі" (Next) button.
 */
export function showNextButton(visible) {
  const btn = document.getElementById('btn-next');
  if (btn) btn.classList.toggle('hidden', !visible);
}

/**
 * Show or hide the "Пропустити" (Skip) button.
 */
export function showSkipButton(visible) {
  const btn = document.getElementById('btn-skip');
  if (btn) btn.classList.toggle('hidden', !visible);
}

// ── Speed control ──────────────────────────────────────────────────────────

/**
 * Set the active state on speed buttons.
 * @param {'slow'|'normal'|'fast'} speed
 */
export function setActiveSpeed(speed) {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.speed === speed);
  });
}
