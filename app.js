const els = {
  runningCount: document.querySelector('#runningCount'),
  timer: document.querySelector('#timer'),
  settingsToggle: document.querySelector('#settingsToggle'),
  settingsPanel: document.querySelector('#settingsPanel'),
  deckCount: document.querySelector('#deckCount'),
  cutPercent: document.querySelector('#cutPercent'),
  cutLabel: document.querySelector('#cutLabel'),
  autoMode: document.querySelector('#autoMode'),
  speedField: document.querySelector('#speedField'),
  speed: document.querySelector('#speed'),
  speedLabel: document.querySelector('#speedLabel'),
  dealtInfo: document.querySelector('#dealtInfo'),
  remainingInfo: document.querySelector('#remainingInfo'),
  progressFill: document.querySelector('#progressFill'),
  cardButton: document.querySelector('#cardButton'),
  card: document.querySelector('#card'),
  cardRankTop: document.querySelector('#cardRankTop'),
  cardRankBottom: document.querySelector('#cardRankBottom'),
  cardSuit: document.querySelector('#cardSuit'),
  mainHint: document.querySelector('#mainHint'),
  primaryAction: document.querySelector('#primaryAction'),
  newShoe: document.querySelector('#newShoe'),
  correctAnswers: document.querySelector('#correctAnswers'),
  wrongAnswers: document.querySelector('#wrongAnswers'),
  accuracy: document.querySelector('#accuracy'),
  countDialog: document.querySelector('#countDialog'),
  countForm: document.querySelector('#countForm'),
  countInput: document.querySelector('#countInput'),
  resultDialog: document.querySelector('#resultDialog'),
  resultTitle: document.querySelector('#resultTitle'),
  resultMessage: document.querySelector('#resultMessage'),
  resultOk: document.querySelector('#resultOk'),
  appVersion: document.querySelector('#appVersion'),
};

const STORAGE_KEY = 'bj-hi-lo-trainer-settings-v1';
const SUITS = [
  { symbol: '♠', color: 'black-card' },
  { symbol: '♥', color: 'red-card' },
  { symbol: '♦', color: 'red-card' },
  { symbol: '♣', color: 'black-card' },
];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const APP_VERSION = 'v0.007';

let state = {
  shoe: [],
  dealt: 0,
  runningCount: 0,
  cutLimit: 0,
  startedAt: null,
  elapsedBeforePause: 0,
  timerId: null,
  autoId: null,
  isRunning: false,
  awaitingAnswer: false,
  nextPromptAt: 0,
  correct: 0,
  wrong: 0,
};

function hiLoValue(rank) {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) return -1;
  return 0;
}

function formatCount(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createShoe(deckCount) {
  const cards = [];
  for (let deck = 0; deck < deckCount; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit: suit.symbol, colorClass: suit.color, value: hiLoValue(rank) });
      }
    }
  }
  return shuffle(cards);
}

function randomPromptGap() {
  return Math.floor(Math.random() * 10) + 7; // 7-16 cards
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.deckCount) els.deckCount.value = String(saved.deckCount);
    if (saved.cutPercent) els.cutPercent.value = String(saved.cutPercent);
    if (typeof saved.autoMode === 'boolean') els.autoMode.checked = saved.autoMode;
    if (saved.speed) els.speed.value = String(saved.speed);
  } catch (_) {
    // Default settings remain valid.
  }
}

function saveSettings() {
  const settings = {
    deckCount: Number(els.deckCount.value),
    cutPercent: Number(els.cutPercent.value),
    autoMode: els.autoMode.checked,
    speed: Number(els.speed.value),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function getElapsedMs() {
  if (!state.startedAt) return state.elapsedBeforePause;
  return state.elapsedBeforePause + (Date.now() - state.startedAt);
}


function getKeyboardInset() {
  if (!window.visualViewport) return 0;
  const viewport = window.visualViewport;
  const inset = window.innerHeight - (viewport.height + viewport.offsetTop);
  return Math.max(0, Math.round(inset));
}

function updateCountDialogPosition() {
  const inset = getKeyboardInset();
  const lift = inset > 0 ? Math.max(40, inset - 24) : 0;
  document.documentElement.style.setProperty('--count-dialog-lift', `${lift}px`);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startTimer() {
  if (state.timerId) return;
  state.startedAt = Date.now();
  state.timerId = window.setInterval(() => {
    els.timer.textContent = formatTime(getElapsedMs());
  }, 250);
}

function pauseTimer() {
  if (state.startedAt) state.elapsedBeforePause = getElapsedMs();
  state.startedAt = null;
  window.clearInterval(state.timerId);
  state.timerId = null;
  els.timer.textContent = formatTime(state.elapsedBeforePause);
}

function resetTimer() {
  pauseTimer();
  state.elapsedBeforePause = 0;
  els.timer.textContent = '00:00';
}

function updateSettingsUi() {
  els.cutLabel.textContent = `${els.cutPercent.value}%`;
  els.speedLabel.textContent = els.speed.value;
  els.speedField.classList.toggle('is-hidden', !els.autoMode.checked);
  els.primaryAction.textContent = state.isRunning ? 'Pausa' : 'Start';
  els.cardButton.disabled = els.autoMode.checked || state.awaitingAnswer || state.dealt >= state.cutLimit;
  els.mainHint.textContent = getMainHint();
}

function getMainHint() {
  if (state.awaitingAnswer) return 'Rispondi al conteggio per continuare.';
  if (state.dealt >= state.cutLimit) return 'Taglio raggiunto. Avvia una nuova scarpa.';
  if (els.autoMode.checked) return state.isRunning ? 'Distribuzione automatica in corso.' : 'Premi Start per distribuire in automatico.';
  return 'Tocca il dorso per girare una carta.';
}

function updateStatsUi() {
  if (els.runningCount) {
    els.runningCount.textContent = formatCount(state.runningCount);
    els.runningCount.classList.toggle('positive', state.runningCount > 0);
    els.runningCount.classList.toggle('negative', state.runningCount < 0);
  }

  const deckCount = Number(els.deckCount.value);
  const totalCards = deckCount * 52;
  const dealtPct = state.cutLimit ? Math.min(100, (state.dealt / state.cutLimit) * 100) : 0;
  els.dealtInfo.textContent = `${state.dealt} carte distribuite`;
  els.remainingInfo.textContent = `Taglio a ${state.cutLimit || Math.round(totalCards * Number(els.cutPercent.value) / 100)} carte`;
  els.progressFill.style.width = `${dealtPct}%`;

  els.correctAnswers.textContent = state.correct;
  els.wrongAnswers.textContent = state.wrong;
  const totalAnswers = state.correct + state.wrong;
  els.accuracy.textContent = totalAnswers ? `${Math.round((state.correct / totalAnswers) * 100)}%` : '—';
  updateSettingsUi();
}

function renderCard(card) {
  els.card.classList.remove('card-front');

  requestAnimationFrame(() => {
    els.cardRankTop.textContent = card.rank;
    els.cardRankBottom.textContent = card.rank;
    els.cardSuit.textContent = card.suit;
    els.cardSuit.className = `suit ${card.colorClass}`;
    els.cardRankTop.className = `rank top ${card.colorClass}`;
    els.cardRankBottom.className = `rank bottom ${card.colorClass}`;

    requestAnimationFrame(() => {
      els.card.classList.add('card-front');
    });
  });
}

function renderBack() {
  els.card.classList.remove('card-front');
  els.cardRankTop.textContent = '?';
  els.cardRankBottom.textContent = '?';
  els.cardSuit.textContent = '♠';
  els.cardSuit.className = 'suit black-card';
  els.cardRankTop.className = 'rank top black-card';
  els.cardRankBottom.className = 'rank bottom black-card';
}

function setupNewShoe({ keepScore = true } = {}) {
  pauseAuto();
  resetTimer();
  const deckCount = Number(els.deckCount.value);
  const cutPercent = Number(els.cutPercent.value);
  state.shoe = createShoe(deckCount);
  state.dealt = 0;
  state.runningCount = 0;
  state.cutLimit = Math.round(state.shoe.length * (cutPercent / 100));
  state.awaitingAnswer = false;
  state.nextPromptAt = randomPromptGap();
  state.isRunning = false;
  if (!keepScore) {
    state.correct = 0;
    state.wrong = 0;
  }
  renderBack();
  updateStatsUi();
}

function dealCard() {
  if (state.awaitingAnswer || state.dealt >= state.cutLimit) return;
  if (!state.timerId) startTimer();

  const card = state.shoe[state.dealt];
  if (!card) return;
  state.dealt += 1;
  state.runningCount += card.value;
  renderCard(card);
  updateStatsUi();

  if (state.dealt >= state.cutLimit) {
    pauseAuto();
    pauseTimer();
    showResult('Scarpa finita', `Taglio raggiunto. Running count finale: ${formatCount(state.runningCount)}.`);
    return;
  }

  if (state.dealt >= state.nextPromptAt) {
    askForCount();
  }
}

function askForCount() {
  state.awaitingAnswer = true;
  pauseAuto();
  pauseTimer();
  updateStatsUi();
  els.countInput.value = '';
  updateCountDialogPosition();
  window.setTimeout(() => {
    els.countDialog.showModal();
    els.countInput.focus();
  }, 520);
}

function showResult(title, message) {
  els.resultTitle.textContent = title;
  els.resultMessage.textContent = message;
  els.resultDialog.showModal();
}

function submitAnswer() {
  const answer = Number(els.countInput.value);
  if (!Number.isFinite(answer)) return;

  els.countDialog.close();
  const expected = state.runningCount;
  state.awaitingAnswer = false;

  if (answer === expected) {
    state.correct += 1;
    state.nextPromptAt = state.dealt + randomPromptGap();
    updateStatsUi();
    showResult('Corretto', `Conteggio attuale: ${formatCount(expected)}. Si continua.`);
    return;
  }

  state.wrong += 1;
  updateStatsUi();
  showResult('Sbagliato', `Risposta corretta: ${formatCount(expected)}. Reset a 0.`);
  setupNewShoe({ keepScore: true });
}

function startAuto() {
  if (state.awaitingAnswer || state.dealt >= state.cutLimit) return;
  state.isRunning = true;
  startTimer();
  dealCard();
  const intervalMs = Math.max(250, 60000 / Number(els.speed.value));
  state.autoId = window.setInterval(dealCard, intervalMs);
  updateStatsUi();
}

function pauseAuto() {
  window.clearInterval(state.autoId);
  state.autoId = null;
  state.isRunning = false;
  updateStatsUi();
}

function togglePrimaryAction() {
  if (els.autoMode.checked) {
    if (state.isRunning) {
      pauseAuto();
      pauseTimer();
    } else {
      startAuto();
    }
    return;
  }

  if (state.timerId) {
    pauseTimer();
  } else {
    startTimer();
  }
  updateStatsUi();
}

function bindEvents() {
  els.settingsToggle.addEventListener('click', () => {
    const isOpen = els.settingsPanel.classList.toggle('is-open');
    els.settingsToggle.setAttribute('aria-expanded', String(isOpen));
  });

  [els.deckCount, els.cutPercent].forEach((input) => {
    input.addEventListener('change', () => {
      saveSettings();
      setupNewShoe({ keepScore: true });
    });
  });

  els.autoMode.addEventListener('change', () => {
    saveSettings();
    pauseAuto();
    pauseTimer();
    updateSettingsUi();
  });

  els.speed.addEventListener('input', () => {
    saveSettings();
    updateSettingsUi();
    if (state.isRunning) {
      pauseAuto();
      startAuto();
    }
  });

  els.cutPercent.addEventListener('input', () => {
    els.cutLabel.textContent = `${els.cutPercent.value}%`;
  });

  els.cardButton.addEventListener('click', () => {
    if (!els.autoMode.checked) dealCard();
  });

  els.primaryAction.addEventListener('click', togglePrimaryAction);

  els.newShoe.addEventListener('click', () => setupNewShoe({ keepScore: false }));

  els.countForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAnswer();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateCountDialogPosition);
    window.visualViewport.addEventListener('scroll', updateCountDialogPosition);
  }

  els.countDialog.addEventListener('close', () => {
    document.documentElement.style.setProperty('--count-dialog-lift', '0px');
  });

  els.resultOk.addEventListener('click', () => {
    els.resultDialog.close();
    if (els.autoMode.checked && !state.awaitingAnswer && state.dealt < state.cutLimit) {
      startAuto();
    } else if (!els.autoMode.checked && state.dealt < state.cutLimit) {
      startTimer();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAuto();
      pauseTimer();
    }
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The app remains usable without offline cache.
    });
  }
}

loadSettings();
bindEvents();
setupNewShoe({ keepScore: false });
if (els.appVersion) {
  els.appVersion.textContent = `Versione app: ${APP_VERSION}`;
}

registerServiceWorker();
