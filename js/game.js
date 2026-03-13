// game.js — Session and round logic, score tracking

import { generateTarget, generateConfusers } from './confuser.js';
import { getSentence } from './sentences.js';

// ── Session state ──────────────────────────────────────────────────────────

let state = {
  mode: 'simple',
  round: 0,
  correct: 0,
  total: 0,
  currentTarget: 0,
  currentSentence: '',
  currentOptions: [],
  answered: false,
};

// ── Shuffle utility ────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Start a new training session.
 * @param {'simple'|'years'|'large'|'mixed'} mode
 */
export function startSession(mode) {
  state = {
    mode,
    round: 0,
    correct: 0,
    total: 0,
    currentTarget: 0,
    currentSentence: '',
    currentOptions: [],
    answered: false,
  };
}

/**
 * Generate the next round: target number, confusers, sentence.
 * @returns {{ target: number, options: number[], sentence: string }}
 */
export function nextRound() {
  const target = generateTarget(state.mode);
  const confusers = generateConfusers(target, state.mode);
  const sentence = getSentence(target, state.mode);
  const options = shuffle([target, ...confusers]);

  state.round++;
  state.currentTarget = target;
  state.currentSentence = sentence;
  state.currentOptions = options;
  state.answered = false;

  return { target, options, sentence };
}

/**
 * Submit an answer and check if it's correct.
 * @param {number} selected - The number the user chose
 * @returns {{ isCorrect: boolean, correctAnswer: number, correctIndex: number }}
 */
export function submitAnswer(selected) {
  if (state.answered) return null;

  state.answered = true;
  state.total++;
  const isCorrect = selected === state.currentTarget;
  if (isCorrect) state.correct++;

  const correctIndex = state.currentOptions.indexOf(state.currentTarget);

  return { isCorrect, correctAnswer: state.currentTarget, correctIndex };
}

/**
 * Skip the current round (counts as wrong).
 * @returns {{ correctAnswer: number, correctIndex: number }}
 */
export function skipRound() {
  if (state.answered) return null;

  state.answered = true;
  state.total++;
  const correctIndex = state.currentOptions.indexOf(state.currentTarget);

  return { correctAnswer: state.currentTarget, correctIndex };
}

/**
 * Get the current sentence (for replay).
 * @returns {string}
 */
export function getCurrentSentence() {
  return state.currentSentence;
}

/**
 * Get the current score.
 * @returns {{ correct: number, total: number, percent: number }}
 */
export function getScore() {
  const percent = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0;
  return { correct: state.correct, total: state.total, percent };
}

/**
 * End the session and return final stats.
 * @returns {{ correct: number, total: number, percent: number, mode: string }}
 */
export function endSession() {
  const percent = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0;
  return {
    correct: state.correct,
    total: state.total,
    percent,
    mode: state.mode,
  };
}
