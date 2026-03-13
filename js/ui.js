// ui.js — DOM manipulation, screen navigation, button rendering, feedback

const screens = {};
let currentScreen = null;

export function initScreens() {
  document.querySelectorAll('.screen').forEach(el => {
    screens[el.id.replace('screen-', '')] = el;
  });
}

export function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('active', key === name);
  }
  currentScreen = name;
}

export function formatNumber(n, isYear = false) {
  if (isYear || (n >= 1100 && n <= 2099)) return String(n);
  if (n < 1000) return String(n);
  return n.toLocaleString('uk-UA').replace(/\s/g, '\u2009');
}

let buttonsLocked = false;
let optionClickHandler = null;

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
      if (buttonsLocked) return;
      lockButtons();
      onClick(num, index);
    });
    grid.appendChild(btn);
  });
}

export function lockButtons() {
  buttonsLocked = true;
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
  });
}

export function unlockButtons() {
  buttonsLocked = false;
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = false;
  });
}

export function showCorrect(correctIndex) {
  const buttons = document.querySelectorAll('.option-btn');
  if (buttons[correctIndex]) {
    buttons[correctIndex].classList.add('correct');
  }
}

export function showWrong(selectedIndex, correctIndex) {
  const buttons = document.querySelectorAll('.option-btn');
  if (buttons[selectedIndex]) {
    buttons[selectedIndex].classList.add('wrong');
  }
  if (buttons[correctIndex]) {
    buttons[correctIndex].classList.add('correct');
  }
}

export function clearFeedback() {
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.classList.remove('correct', 'wrong');
  });
}

export function updateScore(correct, total) {
  const el = document.getElementById('score-display');
  if (el) {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    el.textContent = `${correct}/${total} — ${pct}%`;
  }
}

const MODE_LABELS = {
  simple: 'Прості числа (1–100)',
  years: 'Роки (1906–2100)',
  large: 'Великі числа (100–999 999)',
  mixed: 'Змішаний',
};

export function showSummary(stats) {
  document.getElementById('summary-correct').textContent = stats.correct;
  document.getElementById('summary-total').textContent = stats.total;
  document.getElementById('summary-percent').textContent = stats.percent + '%';
  document.getElementById('summary-mode').textContent = MODE_LABELS[stats.mode] || stats.mode;
  showScreen('summary');
}

export function showError(message) {
  const el = document.getElementById('error-message');
  if (el) el.textContent = message;
  showScreen('error');
}

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

export function showOfflineWarning() {
  showToast('Потрібне з\'єднання для озвучення. Перевірте інтернет і спробуйте знову.');
}

export function showNextButton(visible) {
  const btn = document.getElementById('btn-next');
  if (btn) btn.classList.toggle('hidden', !visible);
}

export function showSkipButton(visible) {
  const btn = document.getElementById('btn-skip');
  if (btn) btn.classList.toggle('hidden', !visible);
}

export function setActiveSpeed(speed) {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.speed === speed);
  });
}
