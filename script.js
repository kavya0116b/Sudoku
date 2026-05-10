const boardElement = document.querySelector("#board");
const padElement = document.querySelector("#number-pad");
const timerElement = document.querySelector("#timer");
const mistakesElement = document.querySelector("#mistakes");
const difficultyElement = document.querySelector("#difficulty");
const statusLabel = document.querySelector("#status-label");
const statusText = document.querySelector("#status-text");
const notesToggle = document.querySelector("#notes-toggle");
const modal = document.querySelector("#modal");
const modalKicker = document.querySelector("#modal-kicker");
const modalTitle = document.querySelector("#modal-title");
const modalMessage = document.querySelector("#modal-message");

const difficultyMap = {
  easy: 36,
  medium: 46,
  hard: 52,
  expert: 58
};

let solution = [];
let puzzle = [];
let player = [];
let notes = [];
let selectedIndex = 0;
let selectedNumber = null;
let mistakes = 0;
let elapsed = 0;
let timer = null;
let paused = false;
let gameOver = false;
let notesMode = false;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pattern(row, col) {
  return (row * 3 + Math.floor(row / 3) + col) % 9;
}

function generateSolution() {
  const rows = shuffle([0, 1, 2]).flatMap(group => shuffle([0, 1, 2]).map(row => group * 3 + row));
  const cols = shuffle([0, 1, 2]).flatMap(group => shuffle([0, 1, 2]).map(col => group * 3 + col));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  return rows.flatMap(row => cols.map(col => nums[pattern(row, col)]));
}

function makePuzzle(fullSolution, removeCount) {
  const grid = [...fullSolution];
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));

  positions.slice(0, removeCount).forEach(index => {
    grid[index] = 0;
  });

  return grid;
}

function formatTime(value) {
  const minutes = String(Math.floor(value / 60)).padStart(2, "0");
  const seconds = String(value % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (!paused && !gameOver) {
      elapsed += 1;
      timerElement.textContent = formatTime(elapsed);
    }
  }, 1000);
}

function rowOf(index) {
  return Math.floor(index / 9);
}

function colOf(index) {
  return index % 9;
}

function boxOf(index) {
  return Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3);
}

function sameUnit(a, b) {
  return rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b);
}

function updateStatus(label, text) {
  statusLabel.textContent = label;
  statusText.textContent = text;
}

function renderBoard() {
  boardElement.innerHTML = "";

  player.forEach((value, index) => {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.type = "button";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Row ${rowOf(index) + 1}, column ${colOf(index) + 1}`);
    cell.dataset.index = index;

    if (puzzle[index] !== 0) {
      cell.classList.add("given");
    }

    if (value !== 0) {
      cell.textContent = value;
    } else if (notes[index].size > 0) {
      const noteGrid = document.createElement("span");
      noteGrid.className = "notes";
      for (let number = 1; number <= 9; number++) {
        const note = document.createElement("span");
        note.textContent = notes[index].has(number) ? number : "";
        noteGrid.appendChild(note);
      }
      cell.appendChild(noteGrid);
    }

    cell.addEventListener("click", () => selectCell(index));
    boardElement.appendChild(cell);
  });

  refreshHighlights();
}

function renderPad() {
  padElement.innerHTML = "";

  for (let number = 1; number <= 9; number++) {
    const button = document.createElement("button");
    button.className = "num-btn";
    button.type = "button";
    button.textContent = number;
    button.dataset.number = number;
    button.addEventListener("click", () => placeNumber(number));
    padElement.appendChild(button);
  }
}

function refreshHighlights() {
  const selectedValue = player[selectedIndex];
  document.querySelectorAll(".cell").forEach((cell, index) => {
    cell.classList.toggle("selected", index === selectedIndex);
    cell.classList.toggle("related", index !== selectedIndex && sameUnit(index, selectedIndex));
    cell.classList.toggle("match", selectedValue !== 0 && player[index] === selectedValue);
  });

  document.querySelectorAll(".num-btn").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.number) === selectedNumber);
  });
}

function selectCell(index) {
  if (paused || gameOver) return;
  selectedIndex = index;
  selectedNumber = player[index] || null;
  refreshHighlights();
}

function clearNotesForNumber(index, number) {
  for (let i = 0; i < 81; i++) {
    if (sameUnit(index, i)) {
      notes[i].delete(number);
    }
  }
}

function flashCell(index, className) {
  const cell = boardElement.querySelector(`[data-index="${index}"]`);
  if (!cell) return;
  cell.classList.add(className);
  setTimeout(() => cell.classList.remove(className), 650);
}

function placeNumber(number) {
  if (paused || gameOver || puzzle[selectedIndex] !== 0) return;

  selectedNumber = number;

  if (notesMode) {
    if (player[selectedIndex] === 0) {
      if (notes[selectedIndex].has(number)) {
        notes[selectedIndex].delete(number);
      } else {
        notes[selectedIndex].add(number);
      }
      renderBoard();
    }
    return;
  }

  if (solution[selectedIndex] !== number) {
    mistakes += 1;
    mistakesElement.textContent = mistakes;
    flashCell(selectedIndex, "error");
    updateStatus("Check the pattern", "That number conflicts with the solved grid. You still have room to recover.");

    if (mistakes >= 3) {
      finishGame(false);
    }
    return;
  }

  player[selectedIndex] = number;
  notes[selectedIndex].clear();
  clearNotesForNumber(selectedIndex, number);
  renderBoard();
  updateStatus("Correct", "Clean placement. Keep scanning the highlighted row, column, and box.");
  checkWin();
}

function giveHint() {
  if (paused || gameOver) return;

  const empty = player
    .map((value, index) => value === 0 ? index : null)
    .filter(index => index !== null);

  if (empty.length === 0) return;

  const index = empty[Math.floor(Math.random() * empty.length)];
  selectedIndex = index;
  player[index] = solution[index];
  notes[index].clear();
  clearNotesForNumber(index, solution[index]);
  renderBoard();
  flashCell(index, "hint");
  updateStatus("Hint placed", "A safe number has been revealed. Use the new pattern to unlock the next move.");
  checkWin();
}

function clearCell() {
  if (paused || gameOver || puzzle[selectedIndex] !== 0) return;
  player[selectedIndex] = 0;
  notes[selectedIndex].clear();
  selectedNumber = null;
  renderBoard();
  updateStatus("Cell cleared", "The selected square is open again.");
}

function solvePuzzle() {
  if (gameOver) return;
  player = [...solution];
  notes = Array.from({ length: 81 }, () => new Set());
  renderBoard();
  finishGame(true, true);
}

function checkWin() {
  if (player.every((value, index) => value === solution[index])) {
    finishGame(true);
  }
}

function finishGame(won, solvedByButton = false) {
  gameOver = true;
  clearInterval(timer);
  modal.classList.remove("hidden");

  if (!won) {
    modalKicker.textContent = "Puzzle ended";
    modalTitle.textContent = "Three mistakes.";
    modalMessage.textContent = "Start a fresh grid and take another run at the pattern.";
    updateStatus("Game over", "Three mistakes ended this puzzle.");
    return;
  }

  modalKicker.textContent = solvedByButton ? "Solved grid" : "Puzzle complete";
  modalTitle.textContent = solvedByButton ? "Solution revealed." : "Sharp work.";
  modalMessage.textContent = solvedByButton
    ? "The complete board is shown so you can study the logic."
    : `Solved in ${formatTime(elapsed)} with ${mistakes} mistake${mistakes === 1 ? "" : "s"}.`;
  updateStatus(solvedByButton ? "Solved" : "Complete", "The board is filled correctly.");
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  document.querySelector("#pause").textContent = paused ? "Resume" : "Pause";
  boardElement.style.filter = paused ? "blur(10px)" : "none";
  updateStatus(paused ? "Paused" : "In progress", paused ? "Timer stopped. Resume when ready." : "Back to the grid.");
}

function newGame() {
  solution = generateSolution();
  puzzle = makePuzzle(solution, difficultyMap[difficultyElement.value]);
  player = [...puzzle];
  notes = Array.from({ length: 81 }, () => new Set());
  selectedIndex = player.findIndex(value => value === 0);
  selectedIndex = selectedIndex === -1 ? 0 : selectedIndex;
  selectedNumber = null;
  mistakes = 0;
  elapsed = 0;
  paused = false;
  gameOver = false;
  timerElement.textContent = "00:00";
  mistakesElement.textContent = "0";
  boardElement.style.filter = "none";
  document.querySelector("#pause").textContent = "Pause";
  modal.classList.add("hidden");
  updateStatus("In progress", "Select a cell, then choose a number. Matching rows, columns, and boxes glow as you play.");
  renderBoard();
  startTimer();
}

document.querySelector("#new-game").addEventListener("click", newGame);
document.querySelector("#modal-new").addEventListener("click", newGame);
document.querySelector("#hint").addEventListener("click", giveHint);
document.querySelector("#clear").addEventListener("click", clearCell);
document.querySelector("#solve").addEventListener("click", solvePuzzle);
document.querySelector("#pause").addEventListener("click", togglePause);
difficultyElement.addEventListener("change", newGame);

notesToggle.addEventListener("click", () => {
  notesMode = !notesMode;
  notesToggle.classList.toggle("active", notesMode);
  notesToggle.setAttribute("aria-pressed", String(notesMode));
  updateStatus(notesMode ? "Notes on" : "Notes off", notesMode ? "Number buttons now add small candidates." : "Number buttons now place final answers.");
});

document.addEventListener("keydown", event => {
  if (event.key >= "1" && event.key <= "9") {
    placeNumber(Number(event.key));
  }

  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
    clearCell();
  }

  const moves = {
    ArrowUp: -9,
    ArrowDown: 9,
    ArrowLeft: -1,
    ArrowRight: 1
  };

  if (moves[event.key] !== undefined) {
    event.preventDefault();
    const next = selectedIndex + moves[event.key];
    if (next >= 0 && next < 81 && Math.abs(colOf(next) - colOf(selectedIndex)) <= 1) {
      selectCell(next);
    }
  }
});

renderPad();
newGame();
