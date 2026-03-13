// app.js — Orchestrator: navigation, lifecycle, event wiring

import * as tts from './tts.js';
import * as game from './game.js';
import * as ui from './ui.js';
import * as storage from './storage.js';

// ── Constants ──────────────────────────────────────────────────────────────

const AUTO_ADVANCE_DELAY_MS = 1500;
const WRONG_REPLAY_DELAY_MS = 500;

// ── State ──────────────────────────────────────────────────────────────────

let currentSpeed = 'normal';
let lastMode = null;  // UX-001: remember last training mode
let ttsReady = false;

// ── Initialization ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  ui.initScreens();

  // Load saved speed preference
  currentSpeed = storage.get('speed', 'normal');
  ui.setActiveSpeed(currentSpeed);

  // Initialize TTS
  ttsReady = await tts.init();

  // BUG-002: Warn user if no English voice was found
  if (!ttsReady && tts.hasNoEnglishVoice()) {
    ui.showError(
      'Не знайдено англійського голосу на вашому пристрої. ' +
      'Перевірте налаштування мов або встановіть English голосовий пакет.'
    );
  }

  // Set up TTS interrupt handler (EC-3)
  tts.onInterrupt(() => {
    // When returning from background, user can tap replay
  });

  // Wire up all event handlers
  wireOnboarding();
  wireMenu();
  wireTraining();
  wireSummary();
  wireSpeedControls();
  wireError();

  // Decide which screen to show
  const onboarded = storage.get('onboarded', false);
  if (!onboarded) {
    ui.showScreen('onboarding');
  } else {
    ui.showScreen('menu');
  }

  // Register service worker
  registerSW();
});

// ── Service Worker Registration ────────────────────────────────────────────

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // SW registration failed — non-critical
    });
  }
}

// ── Onboarding (US-009) ────────────────────────────────────────────────────

function wireOnboarding() {
  const btnStart = document.getElementById('btn-onboarding-start');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      storage.set('onboarded', true);
      // iOS TTS: first speak() must happen in user gesture handler (R-2)
      // UX-002: Use silent warm-up instead of audible "Ready"
      if (ttsReady) {
        tts.warmUp();
      }
      ui.showScreen('menu');
    });
  }
}

// ── Menu ───────────────────────────────────────────────────────────────────

function wireMenu() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (!mode) return;

      // Check TTS availability
      if (!ttsReady) {
        ui.showError(
          'Ваш браузер не підтримує озвучення. ' +
          'Рекомендуємо Safari на iPhone або Chrome на Android.'
        );
        return;
      }

      startTraining(mode);
    });
  });

  // Help button to re-show onboarding
  const btnHelp = document.getElementById('btn-help');
  if (btnHelp) {
    btnHelp.addEventListener('click', () => ui.showScreen('onboarding'));
  }
}

// ── Training ───────────────────────────────────────────────────────────────

function startTraining(mode) {
  lastMode = mode;  // UX-001: remember mode for "Нова сесія"
  game.startSession(mode);
  ui.showScreen('training');
  ui.updateScore(0, 0);
  playNextRound();
}

function playNextRound() {
  const round = game.nextRound();
  ui.clearFeedback();
  ui.showNextButton(false);
  ui.showSkipButton(true);

  ui.renderOptions(round.options, handleAnswer);

  // Speak the sentence
  speakCurrent();
}

function handleAnswer(selected, buttonIndex) {
  const result = game.submitAnswer(selected);
  if (!result) return;

  const score = game.getScore();
  ui.updateScore(score.correct, score.total);

  if (result.isCorrect) {
    // Correct: green highlight, auto-advance
    ui.showCorrect(result.correctIndex);
    ui.showSkipButton(false);
    setTimeout(() => playNextRound(), AUTO_ADVANCE_DELAY_MS);
  } else {
    // Wrong: red + green highlight, show next button (ISSUE-003)
    ui.showWrong(buttonIndex, result.correctIndex);
    ui.showSkipButton(false);
    ui.showNextButton(true);

    // Auto-replay after wrong answer (500ms delay)
    setTimeout(() => speakCurrent(), WRONG_REPLAY_DELAY_MS);
  }
}

function speakCurrent() {
  const sentence = game.getCurrentSentence();
  tts.speak(sentence, currentSpeed).catch(err => {
    if (err.message === 'offline') {
      ui.showOfflineWarning();
    } else if (err.message === 'tts_error') {
      ui.showToast('Озвучення не вдалося. Спробуйте ще раз.');
    }
  });
}

function wireTraining() {
  // Replay button (US-010)
  const btnReplay = document.getElementById('btn-replay');
  if (btnReplay) {
    btnReplay.addEventListener('click', () => speakCurrent());
  }

  // Skip button (US-013)
  const btnSkip = document.getElementById('btn-skip');
  if (btnSkip) {
    btnSkip.addEventListener('click', () => {
      const result = game.skipRound();
      if (!result) return;

      const score = game.getScore();
      ui.updateScore(score.correct, score.total);
      ui.lockButtons();
      ui.showCorrect(result.correctIndex);
      ui.showSkipButton(false);

      setTimeout(() => playNextRound(), AUTO_ADVANCE_DELAY_MS);
    });
  }

  // Next button (after wrong answer)
  const btnNext = document.getElementById('btn-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => playNextRound());
  }

  // End session button (US-011)
  const btnEnd = document.getElementById('btn-end');
  if (btnEnd) {
    btnEnd.addEventListener('click', () => {
      tts.stop();
      const stats = game.endSession();
      ui.showSummary(stats);
    });
  }
}

// ── Summary ────────────────────────────────────────────────────────────────

function wireSummary() {
  // UX-001: "Нова сесія" restarts training in the SAME mode, not back to menu
  const btnNewSession = document.getElementById('btn-new-session');
  if (btnNewSession) {
    btnNewSession.addEventListener('click', () => {
      if (lastMode) {
        startTraining(lastMode);
      } else {
        ui.showScreen('menu');
      }
    });
  }

  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => ui.showScreen('menu'));
  }
}

// ── Speed controls (US-005) ────────────────────────────────────────────────

function wireSpeedControls() {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSpeed = btn.dataset.speed;
      storage.set('speed', currentSpeed);
      ui.setActiveSpeed(currentSpeed);
    });
  });
}

// ── Error screen ───────────────────────────────────────────────────────────

function wireError() {
  const btnRetry = document.getElementById('btn-error-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', async () => {
      ttsReady = await tts.init();
      if (ttsReady) {
        ui.showScreen('menu');
      } else {
        ui.showError(
          'Озвучення все ще недоступне. Перезавантажте сторінку або перевірте налаштування мов пристрою.'
        );
      }
    });
  }
}
