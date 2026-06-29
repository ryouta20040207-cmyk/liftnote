const STORAGE_KEY = "liftnote-state-v1";
const ONBOARDING_KEY = "liftnote-onboarding-seen-v1";
const defaultExercises = [
  "ベンチプレス",
  "スクワット",
  "デッドリフト",
  "ショルダープレス",
  "ラットプルダウン",
  "ダンベルカール",
  "レッグプレス",
  "プランク"
];

const state = loadState();
let activeView = "workout";
let restSeconds = state.restSeconds || 90;
let timerRemaining = restSeconds;
let timerId = null;
let sessionStartedAt = state.today.startedAt || Date.now();

const todayLabel = document.querySelector("#todayLabel");
const totalSets = document.querySelector("#totalSets");
const totalVolume = document.querySelector("#totalVolume");
const sessionTime = document.querySelector("#sessionTime");
const tabs = document.querySelectorAll(".tab");
const views = {
  workout: document.querySelector("#workoutView"),
  recommend: document.querySelector("#recommendView"),
  history: document.querySelector("#historyView"),
  library: document.querySelector("#libraryView")
};
const setForm = document.querySelector("#setForm");
const exerciseInput = document.querySelector("#exerciseInput");
const weightInput = document.querySelector("#weightInput");
const repsInput = document.querySelector("#repsInput");
const noteInput = document.querySelector("#noteInput");
const exerciseList = document.querySelector("#exerciseList");
const setList = document.querySelector("#setList");
const recommendationList = document.querySelector("#recommendationList");
const historyList = document.querySelector("#historyList");
const exerciseCloud = document.querySelector("#exerciseCloud");
const libraryForm = document.querySelector("#libraryForm");
const newExerciseInput = document.querySelector("#newExerciseInput");
const timerDisplay = document.querySelector("#timerDisplay");
const timerToggle = document.querySelector("#timerToggle");
const toast = document.querySelector("#toast");
const connectionStatus = document.querySelector("#connectionStatus");
const importFile = document.querySelector("#importFile");
const onboarding = document.querySelector("#onboarding");
const closeOnboardingButton = document.querySelector("#closeOnboarding");
const replayOnboardingButton = document.querySelector("#replayOnboarding");

document.querySelector("#finishWorkout").addEventListener("click", finishWorkout);
document.querySelector("#exportButton").addEventListener("click", exportRecords);
document.querySelector("#importButton").addEventListener("click", () => importFile.click());
document.querySelector("#clearAll").addEventListener("click", clearAllData);
document.querySelector("#resetLibrary").addEventListener("click", resetLibrary);
document.querySelector("#refreshRecommendations")?.addEventListener("click", () => {
  renderRecommendations();
  showToast("おすすめを更新しました");
});
setForm.addEventListener("submit", addSet);
libraryForm.addEventListener("submit", addExercise);
timerToggle.addEventListener("click", toggleTimer);
importFile.addEventListener("change", importRecords);
closeOnboardingButton?.addEventListener("click", closeOnboarding);
replayOnboardingButton?.addEventListener("click", replayOnboarding);

document.querySelectorAll("[data-rest]").forEach((button) => {
  button.addEventListener("click", () => {
    restSeconds = Number(button.dataset.rest);
    timerRemaining = restSeconds;
    stopTimer();
    state.restSeconds = restSeconds;
    saveState();
    renderTimer();
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

setList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-set]");
  if (!button) return;
  state.today.sets = state.today.sets.filter((set) => set.id !== button.dataset.deleteSet);
  saveState();
  render();
});

recommendationList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-recommendation]");
  if (!button) return;
  const recommendation = buildRecommendations()
    .find((item) => item.exercise === button.dataset.addRecommendation);
  if (!recommendation) return;
  addRecommendedSet(recommendation);
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-load-session]");
  if (!button) return;
  const session = state.history.find((item) => item.id === button.dataset.loadSession);
  if (!session) return;
  state.today = {
    id: crypto.randomUUID(),
    date: dateKey(),
    startedAt: Date.now(),
    sets: session.sets.map((set) => ({ ...set, id: crypto.randomUUID(), createdAt: Date.now() }))
  };
  sessionStartedAt = state.today.startedAt;
  saveState();
  switchView("workout");
  showToast("履歴から今日のメニューにコピーしました");
});

exerciseCloud.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-exercise]");
  if (!chip) return;

  if (event.target.matches("button")) {
    state.exercises = state.exercises.filter((name) => name !== chip.dataset.exercise);
    saveState();
    render();
    return;
  }

  exerciseInput.value = chip.dataset.exercise;
  switchView("workout");
  repsInput.focus();
});

setInterval(() => {
  sessionTime.textContent = `${Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000))}m`;
}, 30000);

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

render();
showOnboardingIfNeeded();
registerServiceWorker();

function loadState() {
  const fallback = {
    today: { id: crypto.randomUUID(), date: dateKey(), startedAt: Date.now(), sets: [] },
    history: [],
    exercises: defaultExercises,
    restSeconds: 90
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fallback;
    const today = saved.today?.date === dateKey()
      ? saved.today
      : { id: crypto.randomUUID(), date: dateKey(), startedAt: Date.now(), sets: [] };

    return {
      today: { ...today, sets: Array.isArray(today.sets) ? today.sets : [] },
      history: Array.isArray(saved.history) ? saved.history : [],
      exercises: Array.isArray(saved.exercises) && saved.exercises.length ? saved.exercises : defaultExercises,
      restSeconds: Number(saved.restSeconds) || 90
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(startDate, endDate) {
  const [startYear, startMonth, startDay] = String(startDate).split("-").map(Number);
  const [endYear, endMonth, endDay] = String(endDate).split("-").map(Number);
  if (![startYear, startMonth, startDay, endYear, endMonth, endDay].every(Number.isFinite)) return 0;
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function formatDate(value) {
  let date;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(value);
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value);
}

function addSet(event) {
  event.preventDefault();
  const exercise = exerciseInput.value.trim();
  const reps = Number(repsInput.value);
  const weight = Number(weightInput.value || 0);
  const note = noteInput.value.trim();

  if (!exercise || reps < 1) return;

  state.today.sets.push({
    id: crypto.randomUUID(),
    exercise,
    reps,
    weight,
    note,
    createdAt: Date.now()
  });

  if (!state.exercises.includes(exercise)) {
    state.exercises.unshift(exercise);
  }

  noteInput.value = "";
  repsInput.select();
  timerRemaining = restSeconds;
  startTimer();
  saveState();
  render();
}

function finishWorkout() {
  if (!state.today.sets.length) {
    showToast("セットを追加すると完了できます");
    return;
  }

  const finishedAt = Date.now();
  const existingSession = state.history.find((item) => item.date === state.today.date);
  const finished = existingSession
    ? {
        ...existingSession,
        startedAt: Math.min(Number(existingSession.startedAt) || state.today.startedAt, state.today.startedAt),
        finishedAt,
        sets: [...(Array.isArray(existingSession.sets) ? existingSession.sets : []), ...state.today.sets]
      }
    : {
        ...state.today,
        finishedAt
      };

  state.history = [finished, ...state.history.filter((item) => item.date !== finished.date)].slice(0, 60);
  state.today = { id: crypto.randomUUID(), date: dateKey(), startedAt: Date.now(), sets: [] };
  sessionStartedAt = state.today.startedAt;
  stopTimer();
  saveState();
  render();
  switchView("history");
  showToast(existingSession ? "今日の履歴に追加しました" : "今日のトレーニングを保存しました");
}

function addExercise(event) {
  event.preventDefault();
  const name = newExerciseInput.value.trim();
  if (!name) return;
  if (!state.exercises.includes(name)) {
    state.exercises.unshift(name);
    saveState();
  }
  newExerciseInput.value = "";
  render();
}

function resetLibrary() {
  state.exercises = [...defaultExercises];
  saveState();
  render();
  showToast("種目テンプレを初期化しました");
}

function clearAllData() {
  if (!confirm("すべての記録を削除しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, loadState());
  sessionStartedAt = state.today.startedAt;
  stopTimer();
  render();
  showToast("記録を削除しました");
}

function exportRecords() {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    today: state.today,
    history: state.history,
    exercises: state.exercises,
    restSeconds: state.restSeconds
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `liftnote-${dateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importRecords(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(String(reader.result || "{}"));
      const nextState = normalizeImportedState(imported);
      if (!nextState) {
        showToast("読み込めないファイルです");
        return;
      }

      state.today = nextState.today;
      state.history = nextState.history;
      state.exercises = nextState.exercises;
      state.restSeconds = nextState.restSeconds;
      restSeconds = state.restSeconds;
      timerRemaining = restSeconds;
      sessionStartedAt = state.today.startedAt || Date.now();
      stopTimer();
      saveState();
      render();
      showToast("記録を読み込みました");
    } catch {
      showToast("JSONの読み込みに失敗しました");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeImportedState(imported) {
  const today = imported.today && typeof imported.today === "object"
    ? imported.today
    : { id: crypto.randomUUID(), date: dateKey(), startedAt: Date.now(), sets: [] };
  const history = Array.isArray(imported.history) ? imported.history : [];
  const importedExercises = Array.isArray(imported.exercises) ? imported.exercises : [];
  const exercisesFromSets = [...today.sets || [], ...history.flatMap((session) => session.sets || [])]
    .map((set) => set.exercise)
    .filter(Boolean);
  const exercises = [...new Set([...importedExercises, ...exercisesFromSets, ...defaultExercises])];

  if (!Array.isArray(today.sets)) return null;

  return {
    today: {
      id: today.id || crypto.randomUUID(),
      date: today.date === dateKey() ? today.date : dateKey(),
      startedAt: Number(today.startedAt) || Date.now(),
      sets: today.date === dateKey() ? today.sets.map(normalizeSet).filter(Boolean) : []
    },
    history: history.map(normalizeSession).filter(Boolean).slice(0, 60),
    exercises,
    restSeconds: Number(imported.restSeconds) || 90
  };
}

function normalizeSession(session) {
  if (!session || !Array.isArray(session.sets)) return null;
  return {
    id: session.id || crypto.randomUUID(),
    date: session.date || dateKey(),
    startedAt: Number(session.startedAt) || Date.now(),
    finishedAt: Number(session.finishedAt) || Number(session.startedAt) || Date.now(),
    sets: session.sets.map(normalizeSet).filter(Boolean)
  };
}

function normalizeSet(set) {
  if (!set || !set.exercise || !Number(set.reps)) return null;
  return {
    id: set.id || crypto.randomUUID(),
    exercise: String(set.exercise),
    reps: Number(set.reps),
    weight: Number(set.weight) || 0,
    note: set.note ? String(set.note) : "",
    createdAt: Number(set.createdAt) || Date.now()
  };
}

function switchView(view) {
  activeView = view;
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  Object.entries(views).forEach(([name, element]) => element.classList.toggle("is-active", name === view));
}

function render() {
  todayLabel.textContent = formatDate(new Date());
  updateConnectionStatus();
  renderSummary();
  renderExerciseOptions();
  renderSets();
  renderRecommendations();
  renderHistory();
  renderLibrary();
  renderTimer();
}

function renderSummary() {
  const stats = calculateStats(state.today.sets);
  totalSets.textContent = stats.sets;
  totalVolume.textContent = `${formatNumber(stats.volume)}kg`;
  sessionTime.textContent = `${Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000))}m`;
}

function renderExerciseOptions() {
  exerciseList.innerHTML = state.exercises
    .map((name) => `<option value="${escapeHTML(name)}"></option>`)
    .join("");
}

function renderSets() {
  if (!state.today.sets.length) {
    setList.innerHTML = `<div class="empty-state">最初のセットを記録しましょう。</div>`;
    return;
  }

  setList.innerHTML = groupSets(state.today.sets).map(([exercise, sets]) => {
    const stats = calculateStats(sets);
    return `
      <article class="exercise-block">
        <div class="exercise-head">
          <h3>${escapeHTML(exercise)}</h3>
          <span class="set-meta">${stats.sets} sets / ${formatNumber(stats.volume)}kg</span>
        </div>
        ${sets.map((set, index) => `
          <div class="set-row">
            <span class="set-index">${index + 1}</span>
            <div class="set-main">
              <strong>${formatNumber(set.weight)}kg × ${set.reps}</strong>
              ${set.note ? `<div class="set-note">${escapeHTML(set.note)}</div>` : ""}
            </div>
            <button class="delete-set" type="button" data-delete-set="${set.id}" aria-label="セットを削除">×</button>
          </div>
        `).join("")}
      </article>
    `;
  }).join("");
}

function renderRecommendations() {
  if (!recommendationList) return;
  const recommendations = buildRecommendations();
  const hasHistory = state.history.some((session) => Array.isArray(session.sets) && session.sets.length);

  recommendationList.innerHTML = `
    <div class="recommendation-intro">
      <strong>${hasHistory ? "記録から選びました" : "まずはこのメニューから"}</strong>
      <span>${hasHistory ? "最近の履歴、頻度、前回の内容をもとにしています。" : "履歴が増えると、あなたの記録に合わせて変わります。"}</span>
    </div>
    ${recommendations.map((item) => `
      <article class="recommendation-card">
        <div>
          <div class="recommendation-reason">${escapeHTML(item.reason)}</div>
          <h3>${escapeHTML(item.exercise)}</h3>
        </div>
        <div class="recommendation-plan">
          <span>${formatNumber(item.weight)}kg</span>
          <span>${item.reps}回</span>
          <span>${item.sets}セット</span>
        </div>
        <button type="button" data-add-recommendation="${escapeHTML(item.exercise)}">今日に追加</button>
      </article>
    `).join("")}
  `;
}

function buildRecommendations() {
  const hasHistory = state.history.some((session) => Array.isArray(session.sets) && session.sets.length);
  if (!hasHistory) return buildStarterRecommendations();

  const todayExercises = new Set(state.today.sets.map((set) => set.exercise));
  const summaries = summarizeExercises();
  const scored = summaries
    .filter((item) => !todayExercises.has(item.exercise))
    .map((item) => ({
      ...item,
      score: item.count * 2 + Math.min(item.daysSince, 14) + (item.lastVolume > 0 ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length) {
    return scored.map((item) => ({
      exercise: item.exercise,
      weight: item.weight,
      reps: item.reps,
      sets: Math.min(4, Math.max(2, item.typicalSets || 3)),
      reason: item.count === 0
        ? "まだ記録が少ない種目です"
        : item.daysSince >= 7
          ? `${item.daysSince}日空いています`
          : "よく記録している種目です"
    }));
  }

  return buildStarterRecommendations();
}

function buildStarterRecommendations() {
  return defaultExercises.slice(0, 4).map((exercise, index) => ({
    exercise,
    weight: [40, 50, 50, 20][index] || 20,
    reps: [10, 10, 8, 10][index] || 10,
    sets: 3,
    reason: "全身をバランスよく始める候補"
  }));
}

function summarizeExercises() {
  const summaries = new Map();
  const sessions = [...state.history].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  sessions.forEach((session) => {
    const sessionSets = Array.isArray(session.sets) ? session.sets : [];
    const grouped = groupSets(sessionSets);
    grouped.forEach(([exercise, sets]) => {
      const current = summaries.get(exercise) || {
        exercise,
        count: 0,
        lastDate: session.date,
        weight: 0,
        reps: 10,
        typicalSets: 0,
        lastVolume: 0
      };
      const lastSet = sets[sets.length - 1];
      current.count += sets.length;
      current.typicalSets = Math.max(current.typicalSets, sets.length);
      if (!summaries.has(exercise)) {
        current.lastDate = session.date;
        current.weight = Number(lastSet?.weight) || 0;
        current.reps = Number(lastSet?.reps) || 10;
        current.lastVolume = calculateStats(sets).volume;
      }
      summaries.set(exercise, current);
    });
  });

  state.exercises.forEach((exercise) => {
    if (summaries.has(exercise)) return;
    summaries.set(exercise, {
      exercise,
      count: 0,
      lastDate: "1970-01-01",
      weight: 20,
      reps: 10,
      typicalSets: 3,
      lastVolume: 0
    });
  });

  return [...summaries.values()].map((item) => ({
    ...item,
    daysSince: daysBetween(item.lastDate, dateKey())
  }));
}

function addRecommendedSet(recommendation) {
  const now = Date.now();
  const sets = Array.from({ length: recommendation.sets }, () => ({
    id: crypto.randomUUID(),
    exercise: recommendation.exercise,
    reps: recommendation.reps,
    weight: recommendation.weight,
    note: "おすすめメニューから追加",
    createdAt: now
  }));

  state.today.sets.push(...sets);
  if (!state.exercises.includes(recommendation.exercise)) {
    state.exercises.unshift(recommendation.exercise);
  }
  timerRemaining = restSeconds;
  saveState();
  render();
  switchView("workout");
  showToast(`${recommendation.exercise}を追加しました`);
}

function renderHistory() {
  if (!state.history.length) {
    historyList.innerHTML = `<div class="empty-state">完了したトレーニングがここに残ります。</div>`;
    return;
  }

  historyList.innerHTML = state.history.map((session) => {
    const stats = calculateStats(session.sets);
    const names = [...new Set(session.sets.map((set) => set.exercise))].join(" / ");
    return `
      <article class="history-card">
        <div>
          <div class="history-date">${formatDate(session.date)}</div>
          <h3>${escapeHTML(names || "トレーニング")}</h3>
        </div>
        <div class="history-stats">
          <span>${stats.sets} sets</span>
          <span>${stats.reps}回</span>
          <span>${stats.exercises}種目</span>
        </div>
        <button type="button" data-load-session="${session.id}">今日にコピー</button>
      </article>
    `;
  }).join("");
}

function renderLibrary() {
  exerciseCloud.innerHTML = state.exercises.map((name) => `
    <span class="exercise-chip" data-exercise="${escapeHTML(name)}">
      ${escapeHTML(name)}
      <button type="button" aria-label="${escapeHTML(name)}を削除">×</button>
    </span>
  `).join("");
}

function renderTimer() {
  const minutes = String(Math.floor(timerRemaining / 60)).padStart(2, "0");
  const seconds = String(timerRemaining % 60).padStart(2, "0");
  timerDisplay.textContent = `${minutes}:${seconds}`;
  timerToggle.textContent = timerId ? "停止" : "開始";
  timerToggle.classList.toggle("is-running", Boolean(timerId));
}

function startTimer() {
  stopTimer(false);
  timerId = setInterval(() => {
    timerRemaining = Math.max(0, timerRemaining - 1);
    renderTimer();
    if (timerRemaining === 0) {
      stopTimer(false);
      navigator.vibrate?.(160);
      showToast("休憩終了です");
    }
  }, 1000);
  renderTimer();
}

function stopTimer(resetButton = true) {
  if (timerId) clearInterval(timerId);
  timerId = null;
  if (resetButton) renderTimer();
}

function toggleTimer() {
  if (timerId) {
    stopTimer();
  } else {
    if (timerRemaining === 0) timerRemaining = restSeconds;
    startTimer();
  }
}

function calculateStats(sets) {
  return {
    sets: sets.length,
    exercises: new Set(sets.map((set) => set.exercise)).size,
    reps: sets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0),
    volume: sets.reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0)
  };
}

function groupSets(sets) {
  return sets.reduce((groups, set) => {
    const group = groups.find(([name]) => name === set.exercise);
    if (group) {
      group[1].push(set);
    } else {
      groups.push([set.exercise, [set]]);
    }
    return groups;
  }, []);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function showOnboardingIfNeeded() {
  if (!onboarding || !closeOnboardingButton) return;
  if (localStorage.getItem(ONBOARDING_KEY) === "seen") return;
  openOnboarding();
}

function openOnboarding() {
  onboarding.classList.add("is-visible");
  onboarding.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  closeOnboardingButton.focus();
}

function closeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, "seen");
  onboarding.classList.remove("is-visible");
  onboarding.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal");
}

function replayOnboarding() {
  if (!onboarding) return;
  const demo = onboarding.querySelector(".demo-phone");
  if (!demo) return;
  const freshDemo = demo.cloneNode(true);
  demo.replaceWith(freshDemo);
}

function updateConnectionStatus() {
  if (!connectionStatus) return;
  const isOnline = navigator.onLine;
  connectionStatus.textContent = isOnline ? "オンライン" : "オフライン";
  connectionStatus.classList.toggle("is-offline", !isOnline);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
