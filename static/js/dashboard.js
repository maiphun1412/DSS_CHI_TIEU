let lastScreen = "start";
let csvExpenses = [];
let manualExpenses = [];
let previousScreenBeforeHistory = "start";
let latestAHPResult = null;
let latestDSSResult = null;
let criteriaPieChartInstance = null;
let priorityBarChartInstance = null;

const categoryMap = {
  "nha o": "Nhà ở",
  "nhà ở": "Nhà ở",
  "house": "Nhà ở",
  "rent": "Nhà ở",
  "motel": "Nhà ở",
  "communal": "Nhà ở",
  "phone": "Nhà ở",

  "an uong": "Ăn uống",
  "ăn uống": "Ăn uống",
  "restaurant": "Ăn uống",
  "restuarant": "Ăn uống",
  "coffee": "Ăn uống",
  "coffe": "Ăn uống",
  "business lunch": "Ăn uống",

  "di chuyen": "Di chuyển",
  "di chuyển": "Di chuyển",
  "transport": "Di chuyển",
  "taxi": "Di chuyển",
  "travel": "Di chuyển",

  "mua sam": "Mua sắm",
  "mua sắm": "Mua sắm",
  "market": "Mua sắm",
  "clothing": "Mua sắm",
  "tech": "Mua sắm",
  "other": "Mua sắm",

  "giai tri": "Giải trí",
  "giải trí": "Giải trí",
  "entertainment": "Giải trí",
  "film/enjoyment": "Giải trí",
  "events": "Giải trí",
  "joy": "Giải trí",
  "sport": "Giải trí",
  "learning": "Giải trí",
  "health": "Giải trí"
};

function hideAllScreens() {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.add("hidden");
  });
}

async function showStep(step) {
  hideAllScreens();
  const target = document.getElementById(`step${step}`);
  if (target) {
    target.classList.remove("hidden");
  }
  lastScreen = `step${step}`;

  if (step === 3) {
    initializeAHPInputs();
  }

  if (step === 4) {
    renderCategoryChips();
    await renderStep4Analysis();
  }

  if (step === 5) {
    await calculateDSS();
  }
}

function showStart() {
  hideAllScreens();
  const startScreen = document.getElementById("startScreen");
  if (startScreen) {
    startScreen.classList.remove("hidden");
  }
  lastScreen = "start";
}

function getActiveTabClass() {
  return "rounded-xl bg-gradient-to-r from-primary-600 to-sky-500 px-4 py-2 text-white text-sm font-medium hover:from-primary-700 hover:to-sky-600 transition shadow";
}

function getInactiveTabClass() {
  return "rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-primary-700 hover:bg-blue-50 transition";
}

function showDataInputTab(tab) {
  const csvPanel = document.getElementById("csvInputPanel");
  const manualPanel = document.getElementById("manualInputPanel");
  const csvBtn = document.getElementById("csvTabBtn");
  const manualBtn = document.getElementById("manualTabBtn");

  if (!csvPanel || !manualPanel || !csvBtn || !manualBtn) return;

  if (tab === "csv") {
    csvPanel.classList.remove("hidden");
    manualPanel.classList.add("hidden");
    csvBtn.className = getActiveTabClass();
    manualBtn.className = getInactiveTabClass();
  } else {
    manualPanel.classList.remove("hidden");
    csvPanel.classList.add("hidden");
    manualBtn.className = getActiveTabClass();
    csvBtn.className = getInactiveTabClass();
  }
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function normalizeCategory(rawCategory) {
  if (!rawCategory) return "Mua sắm";
  const key = rawCategory.toString().trim().toLowerCase();
  return categoryMap[key] || "Mua sắm";
}

function convertToDateInputValue(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function getAllExpenses() {
  return [...csvExpenses, ...manualExpenses];
}

function getSummaryStats() {
  const allExpenses = getAllExpenses();
  const budget = Number(document.getElementById("budgetInput")?.value || 0);
  const total = allExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const remaining = budget - total;
  const percent = budget > 0 ? (total / budget) * 100 : 0;

  return { allExpenses, budget, total, remaining, percent };
}

function updateSourceBadge() {
  const badge = document.getElementById("dataSourceBadge");
  const preferredSourceValue = document.getElementById("preferredSourceValue");

  if (!badge || !preferredSourceValue) return;

  if (csvExpenses.length > 0) {
    badge.textContent = `Ưu tiên CSV • CSV: ${csvExpenses.length} khoản • Nhập tay: ${manualExpenses.length} khoản`;
    badge.className = "inline-flex rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-semibold";
    preferredSourceValue.textContent = "CSV";
  } else if (manualExpenses.length > 0) {
    badge.textContent = `Nhập tay • ${manualExpenses.length} khoản`;
    badge.className = "inline-flex rounded-full bg-blue-50 text-primary-700 border border-blue-100 px-4 py-2 text-xs font-semibold";
    preferredSourceValue.textContent = "Nhập tay";
  } else {
    badge.textContent = "Chưa có dữ liệu";
    badge.className = "inline-flex rounded-full bg-blue-50 text-primary-700 border border-blue-100 px-4 py-2 text-xs font-semibold";
    preferredSourceValue.textContent = "Nhập tay";
  }
}

function renderExpenseTable() {
  const tbody = document.getElementById("expenseTableBody");
  if (!tbody) return;

  const allExpenses = getAllExpenses();

  if (allExpenses.length === 0) {
    tbody.innerHTML = `
      <tr id="emptyRow">
        <td colspan="6" class="px-4 py-6 text-center text-slate-500">
          Chưa có dữ liệu chi tiêu. Hãy tải CSV hoặc nhập tay.
        </td>
      </tr>
    `;
    updateSourceBadge();
    updateAnalysis();
    return;
  }

  tbody.innerHTML = allExpenses
    .map((item, index) => {
      const sourceLabel =
        item.source === "csv"
          ? `<span class="inline-flex rounded-full bg-blue-600 text-white px-3 py-1 text-xs font-semibold">CSV</span>`
          : `<span class="inline-flex rounded-full bg-blue-50 text-primary-700 border border-blue-100 px-3 py-1 text-xs font-semibold">Nhập tay</span>`;

      const deleteAction =
        item.source === "csv"
          ? `removeCSVExpense(${index})`
          : `removeManualExpense(${index - csvExpenses.length})`;

      return `
        <tr class="hover:bg-blue-50/40 transition">
          <td class="px-4 py-3">${item.date || ""}</td>
          <td class="px-4 py-3">${item.category || ""}</td>
          <td class="px-4 py-3 font-medium text-primary-800">${formatCurrency(item.amount)}</td>
          <td class="px-4 py-3">${item.note || ""}</td>
          <td class="px-4 py-3 text-center">${sourceLabel}</td>
          <td class="px-4 py-3 text-center">
            <button type="button" onclick="${deleteAction}" class="text-red-600 font-medium hover:underline">
              Xóa
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  updateSourceBadge();
  updateAnalysis();
}

function updateAnalysis() {
  const { allExpenses, total, remaining, percent } = getSummaryStats();

  const totalEl = document.getElementById("totalExpenseValue");
  const remainingEl = document.getElementById("remainingValue");
  const percentEl = document.getElementById("usedBudgetPercent");
  const countEl = document.getElementById("expenseCountValue");

  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (remainingEl) remainingEl.textContent = formatCurrency(remaining);
  if (percentEl) percentEl.textContent = `${percent.toFixed(1)}%`;
  if (countEl) countEl.textContent = allExpenses.length;

  if (typeof updateRiskChart === "function") {
    updateRiskChart(percent);
  }
  if (typeof renderExpenseCategoryChart === "function") {
    renderExpenseCategoryChart(allExpenses);
  }
}

function addManualExpense() {
  const date = document.getElementById("manualDate")?.value || "";
  const category = document.getElementById("manualCategory")?.value || "";
  const amount = Number(document.getElementById("manualAmount")?.value);
  const note = document.getElementById("manualNote")?.value.trim() || "";

  if (!date || !category || !amount || amount <= 0) {
    alert("Vui lòng nhập đầy đủ ngày, danh mục và số tiền hợp lệ.");
    return;
  }

  manualExpenses.push({
    date,
    category,
    amount,
    note,
    source: "manual"
  });

  const manualAmount = document.getElementById("manualAmount");
  const manualNote = document.getElementById("manualNote");
  if (manualAmount) manualAmount.value = "";
  if (manualNote) manualNote.value = "";

  renderExpenseTable();
}

function removeManualExpense(index) {
  manualExpenses.splice(index, 1);
  renderExpenseTable();
}

function removeCSVExpense(index) {
  csvExpenses.splice(index, 1);
  renderExpenseTable();
}

function setStatusMessage(message, type = "info") {
  const status = document.getElementById("csvStatus");
  if (!status) return;

  status.classList.remove("hidden");

  if (type === "success") {
    status.className = "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mt-4";
  } else if (type === "warning") {
    status.className = "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mt-4";
  } else {
    status.className = "rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-primary-700 mt-4";
  }

  status.textContent = message;
}

function clearCSVData() {
  csvExpenses = [];
  const input = document.getElementById("csvFileInput");
  if (input) input.value = "";

  setStatusMessage("Đã xóa dữ liệu CSV. Hệ thống sẽ dùng dữ liệu nhập tay nếu có.", "info");
  renderExpenseTable();
}

function handleCSVUpload() {
  const fileInput = document.getElementById("csvFileInput");

  if (!fileInput || !fileInput.files.length) {
    alert("Vui lòng chọn file CSV.");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const text = e.target.result;
    const rows = text.trim().split(/\r?\n/);

    if (rows.length < 2) {
      alert("File CSV không có dữ liệu.");
      return;
    }

    const header = rows[0].split(",").map((h) => h.trim().toLowerCase());
    const dateIndex = header.indexOf("date");
    const categoryIndex = header.indexOf("category");
    const amountIndex = header.indexOf("amount");
    const noteIndex = header.indexOf("note");

    if (dateIndex === -1 || categoryIndex === -1 || amountIndex === -1) {
      alert("CSV phải có các cột tối thiểu: date, category, amount");
      return;
    }

    const parsed = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(",").map((c) => c.trim());
      const amount = Number(cols[amountIndex]);

      if (!cols[dateIndex] || !cols[categoryIndex] || isNaN(amount)) continue;

      parsed.push({
        date: convertToDateInputValue(cols[dateIndex]) || cols[dateIndex],
        category: normalizeCategory(cols[categoryIndex]),
        amount: amount,
        note: noteIndex !== -1 ? (cols[noteIndex] || "") : "Từ file CSV",
        source: "csv"
      });
    }

    csvExpenses = parsed;
    setStatusMessage(`Đã tải ${parsed.length} khoản chi từ file CSV. Hệ thống đang ưu tiên dữ liệu CSV.`, "success");
    renderExpenseTable();
  };

  reader.readAsText(file, "UTF-8");
}

function renderCategoryChips() {
  const container = document.getElementById("categoryChips");
  if (!container) return;

  const categories = [...new Set(getAllExpenses().map((item) => item.category).filter(Boolean))];
  const finalCategories = categories.length > 0
    ? categories
    : ["Nhà ở", "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí"];

  container.innerHTML = finalCategories.map((cat) => `
    <span class="rounded-full bg-white border border-blue-200 text-primary-700 px-4 py-2 text-sm font-medium shadow-sm">${cat}</span>
  `).join("");
}

async function showHistory() {
  previousScreenBeforeHistory = lastScreen;

  try {
    const response = await fetch("/auth-status");
    const result = await response.json();

    if (!result.logged_in) {
      openAuthModal();
      return;
    }

    hideAllScreens();
    const historySection = document.getElementById("userHistorySection");
    if (historySection) {
      historySection.classList.remove("hidden");
    }
    lastScreen = "userHistorySection";

    const historyUsernameText = document.getElementById("historyUsernameText");
    if (historyUsernameText) {
      historyUsernameText.textContent = `Tài khoản: ${result.username || ""}`;
    }

    await loadHistoryFromServer();
  } catch (error) {
    openAuthModal();
  }
}

function goBackFromHistory() {
  hideAllScreens();

  if (previousScreenBeforeHistory === "start") {
    const startScreen = document.getElementById("startScreen");
    if (startScreen) {
      startScreen.classList.remove("hidden");
    }
    lastScreen = "start";
    return;
  }

  if (previousScreenBeforeHistory && previousScreenBeforeHistory.startsWith("step")) {
    const previous = document.getElementById(previousScreenBeforeHistory);
    if (previous) {
      previous.classList.remove("hidden");
    }
    lastScreen = previousScreenBeforeHistory;
    return;
  }

  const startScreen = document.getElementById("startScreen");
  if (startScreen) {
    startScreen.classList.remove("hidden");
  }
  lastScreen = "start";
}

async function loadHistoryFromServer() {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="px-4 py-6 text-center text-slate-500">
        Đang tải lịch sử...
      </td>
    </tr>
  `;

  try {
    const response = await fetch("/history-data");
    const result = await response.json();

    if (!response.ok || !result.success) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-6 text-center text-red-500">
            Không tải được lịch sử phân tích.
          </td>
        </tr>
      `;
      return;
    }

    const items = result.data || [];

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-6 text-center text-slate-500">
            Chưa có lịch sử phân tích.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map((item) => `
      <tr class="hover:bg-blue-50/40 transition">
        <td class="px-4 py-3">${item.analysis_date || ""}</td>
        <td class="px-4 py-3">${formatCurrency(item.budget || 0)}</td>
        <td class="px-4 py-3">${formatCurrency(item.total_expense || 0)}</td>
        <td class="px-4 py-3">${item.risk_level || ""}</td>
        <td class="px-4 py-3">${Number(item.risk_score || 0).toFixed(2)}</td>
        <td class="px-4 py-3">${item.recommendation || ""}</td>
      </tr>
    `).join("");
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-6 text-center text-red-500">
          Lỗi kết nối khi tải lịch sử.
        </td>
      </tr>
    `;
  }
}

function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("hidden");
  showAuthTab("login");
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.add("hidden");
}

function showAuthTab(tab) {
  const loginPanel = document.getElementById("loginPanel");
  const registerPanel = document.getElementById("registerPanel");
  const loginBtn = document.getElementById("loginTabBtn");
  const registerBtn = document.getElementById("registerTabBtn");

  if (!loginPanel || !registerPanel || !loginBtn || !registerBtn) return;

  if (tab === "login") {
    loginPanel.classList.remove("hidden");
    registerPanel.classList.add("hidden");
    loginBtn.className = "rounded-xl bg-gradient-to-r from-primary-600 to-sky-500 px-4 py-2 text-white text-sm font-medium";
    registerBtn.className = "rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-primary-700";
  } else {
    registerPanel.classList.remove("hidden");
    loginPanel.classList.add("hidden");
    registerBtn.className = "rounded-xl bg-gradient-to-r from-primary-600 to-sky-500 px-4 py-2 text-white text-sm font-medium";
    loginBtn.className = "rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-primary-700";
  }
}

function setAuthMessage(message, type = "info") {
  const box = document.getElementById("authMessage");
  if (!box) return;

  box.classList.remove("hidden");

  if (type === "success") {
    box.className = "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mb-4";
  } else if (type === "error") {
    box.className = "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4";
  } else {
    box.className = "rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-primary-700 mb-4";
  }

  box.textContent = message;
}

async function loginUser() {
  const username = document.getElementById("loginUsername")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value.trim() || "";

  if (!username || !password) {
    setAuthMessage("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.", "error");
    return;
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setAuthMessage(result.message || "Đăng nhập thất bại.", "error");
      return;
    }

    setAuthMessage(result.message || "Đăng nhập thành công.", "success");
    closeAuthModal();
    await showHistory();
  } catch (error) {
    setAuthMessage("Lỗi kết nối khi đăng nhập.", "error");
  }
}

async function registerUser() {
  const username = document.getElementById("registerUsername")?.value.trim() || "";
  const password = document.getElementById("registerPassword")?.value.trim() || "";

  if (!username || !password) {
    setAuthMessage("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.", "error");
    return;
  }

  try {
    const response = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setAuthMessage(result.message || "Đăng ký thất bại.", "error");
      return;
    }

    setAuthMessage(result.message || "Đăng ký thành công.", "success");
    closeAuthModal();
    await showHistory();
  } catch (error) {
    setAuthMessage("Lỗi kết nối khi đăng ký.", "error");
  }
}

async function logoutUser() {
  try {
    await fetch("/logout", { method: "POST" });
  } catch (error) {
    console.error(error);
  }
  showStart();
}

/* =========================
   AHP
========================= */

function parseAHPValue(raw) {
  const value = String(raw || "").trim().replace(",", ".");

  if (!value) {
    throw new Error("Không được để trống ô trong ma trận AHP.");
  }

  if (value.includes("/")) {
    const parts = value.split("/");
    if (parts.length !== 2) {
      throw new Error(`Giá trị '${value}' không hợp lệ.`);
    }

    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);

    if (!isFinite(numerator) || !isFinite(denominator) || denominator === 0) {
      throw new Error(`Giá trị '${value}' không hợp lệ.`);
    }

    return numerator / denominator;
  }

  const parsed = Number(value);
  if (!isFinite(parsed)) {
    throw new Error(`Giá trị '${value}' không hợp lệ.`);
  }

  return parsed;
}

function formatAHPInputValue(value) {
  const num = Number(value || 0);
  if (!isFinite(num) || num <= 0) return "";

  if (Math.abs(num - 1) < 0.000001) return "1.000";

  if (num < 1) {
    const reciprocal = 1 / num;
    const roundedReciprocal = Math.round(reciprocal);
    if (Math.abs(reciprocal - roundedReciprocal) < 0.03) {
      return `1/${roundedReciprocal}`;
    }
  }

  if (Math.abs(num - Math.round(num)) < 0.000001) {
    return String(Math.round(num));
  }

  return num.toFixed(3);
}

function getAHPInputs() {
  return Array.from(document.querySelectorAll("[data-ahp-input='1']"));
}

function getAHPInputMatrix() {
  const inputs = getAHPInputs();
  if (inputs.length === 0) {
    throw new Error("Không tìm thấy ô nhập AHP.");
  }

  const rows = [...new Set(inputs.map((item) => Number(item.dataset.row)))].sort((a, b) => a - b);
  const size = rows.length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  inputs.forEach((input) => {
    const r = Number(input.dataset.row);
    const c = Number(input.dataset.col);
    matrix[r][c] = parseAHPValue(input.value);
  });

  return matrix;
}

function setAHPStatus(message, type = "info") {
  const box = document.getElementById("ahpStatusMessage");
  if (!box) return;

  box.classList.remove("hidden");

  if (type === "success") {
    box.className = "rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700 font-medium";
  } else if (type === "error") {
    box.className = "rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 font-medium";
  } else {
    box.className = "rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-primary-800 font-medium";
  }

  box.textContent = message;
}

function renderAHPResult(result) {
  latestAHPResult = result;

  const lambdaEl = document.getElementById("ahpLambdaMax");
  const ciEl = document.getElementById("ahpCI");
  const crEl = document.getElementById("ahpCR");
  const messageEl = document.getElementById("ahpConsistencyMessage");
  const weightsEl = document.getElementById("ahpWeightsList");

  if (lambdaEl) lambdaEl.textContent = Number(result.lambda_max || 0).toFixed(4);
  if (ciEl) ciEl.textContent = Number(result.ci || 0).toFixed(4);
  if (crEl) crEl.textContent = `${Number(result.cr_percent || 0).toFixed(4)}%`;

  if (messageEl) {
    messageEl.textContent = result.message || "";
    messageEl.className = result.is_consistent
      ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700 font-medium"
      : "rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 font-medium";
  }

  if (weightsEl) {
    const weights = result.weights || [];
    weightsEl.innerHTML = weights.map((item) => `
      <li>
        <span class="font-semibold">${item.name}:</span> ${Number(item.value || 0).toFixed(4)}
      </li>
    `).join("");
  }
}

async function calculateAHP() {
  try {
    setAHPStatus("Đang tính toán AHP...", "info");

    const matrix = getAHPInputMatrix();

    const response = await fetch("/api/ahp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ matrix })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể tính AHP.");
    }

    renderAHPResult(result);
    setAHPStatus("Đã tính toán AHP thành công.", "success");
  } catch (error) {
    setAHPStatus(error.message || "Có lỗi xảy ra khi tính AHP.", "error");
  }
}

function handleAHPInputChange(event) {
  const input = event.target;
  if (!input || input.dataset.ahpInput !== "1") return;

  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);

  if (row === col) {
    input.value = "1.000";
    return;
  }

  try {
    const value = parseAHPValue(input.value);

    if (value <= 0) {
      throw new Error("Giá trị phải lớn hơn 0.");
    }

    const reciprocalInput = document.querySelector(
      `[data-ahp-input='1'][data-row='${col}'][data-col='${row}']`
    );

    if (reciprocalInput) {
      reciprocalInput.value = formatAHPInputValue(1 / value);
    }

    input.value = formatAHPInputValue(value);
  } catch (error) {
    setAHPStatus(error.message, "error");
  }
}

function initializeAHPInputs() {
  const inputs = getAHPInputs();
  if (!inputs.length) return;

  inputs.forEach((input) => {
    if (input.dataset.bound === "1") return;

    input.addEventListener("change", handleAHPInputChange);
    input.addEventListener("blur", handleAHPInputChange);

    if (Number(input.dataset.row) === Number(input.dataset.col)) {
      input.value = "1.000";
      input.readOnly = true;
      input.classList.add("bg-slate-100");
    }

    input.dataset.bound = "1";
  });
}

/* =========================
   DSS
========================= */

function getPriorityClass(priority) {
  const value = String(priority || "").toLowerCase();

  if (value === "rất cao") return "text-red-700 font-bold";
  if (value === "cao") return "text-red-600 font-bold";
  if (value === "trung bình") return "text-amber-600 font-bold";
  if (value === "thấp") return "text-blue-600 font-bold";
  return "text-emerald-600 font-bold";
}

function renderDSSResult(result) {
  latestDSSResult = result;

  const tbody = document.getElementById("dssSuggestionTableBody");
  const summary = document.getElementById("dssSummaryText");

  if (!tbody) return;

  const rows = result.recommendations || [];

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-6 text-center text-slate-500">
          Chưa có dữ liệu gợi ý.
        </td>
      </tr>
    `;
    if (summary) {
      summary.textContent = "Chưa có kết quả DSS để hiển thị.";
    }
    return;
  }

  tbody.innerHTML = rows.map((item) => `
    <tr class="hover:bg-blue-50/40 transition">
      <td class="px-4 py-3">${item.category}</td>
      <td class="px-4 py-3">${formatCurrency(item.amount)}</td>
      <td class="px-4 py-3 ${getPriorityClass(item.priority)}">${item.priority}</td>
      <td class="px-4 py-3">${Number(item.score || 0).toFixed(4)}</td>
      <td class="px-4 py-3">${item.reason}</td>
    </tr>
  `).join("");

  if (summary) {
    const top = rows[0];
    summary.textContent = `Nhóm ưu tiên điều chỉnh cao nhất hiện tại là ${top.category}, với điểm ưu tiên ${Number(top.score || 0).toFixed(4)}.`;
  }
}

async function calculateDSS() {
  try {
    const allExpenses = getAllExpenses();

    if (!allExpenses.length) {
      const tbody = document.getElementById("dssSuggestionTableBody");
      const summary = document.getElementById("dssSummaryText");

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="px-4 py-6 text-center text-slate-500">
              Chưa có dữ liệu chi tiêu để phân tích DSS.
            </td>
          </tr>
        `;
      }

      if (summary) {
        summary.textContent = "Vui lòng nhập dữ liệu chi tiêu trước khi xem gợi ý DSS.";
      }
      return;
    }

    if (!latestAHPResult || !latestAHPResult.weights) {
      const tbody = document.getElementById("dssSuggestionTableBody");
      const summary = document.getElementById("dssSummaryText");

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="px-4 py-6 text-center text-slate-500">
              Vui lòng tính AHP trước khi xem DSS gợi ý.
            </td>
          </tr>
        `;
      }

      if (summary) {
        summary.textContent = "Bạn cần tính AHP trước để hệ thống có trọng số ra quyết định.";
      }
      return;
    }

    const response = await fetch("/api/dss", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        expenses: allExpenses,
        ahp_weights: latestAHPResult.weights
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể phân tích DSS.");
    }

    renderDSSResult(result);
  } catch (error) {
    const tbody = document.getElementById("dssSuggestionTableBody");
    const summary = document.getElementById("dssSummaryText");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-6 text-center text-red-500">
            ${error.message || "Có lỗi xảy ra khi phân tích DSS."}
          </td>
        </tr>
      `;
    }

    if (summary) {
      summary.textContent = "Không thể tạo gợi ý DSS ở thời điểm hiện tại.";
    }
  }
}
function buildStep4RowsFromDSSResult(result) {
  return (result?.recommendations || []).map((item) => ({
    category: item.category,
    amount: Number(item.amount || 0),
    score: Number(item.score || 0),
    priority: item.priority || "Chưa rõ",
    reason: item.reason || ""
  }));
}

function renderStep4Table(rows) {
  const tbody = document.getElementById("step4TableBody");
  const summary = document.getElementById("step4SummaryText");

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-6 text-center text-slate-500">
          Chưa có dữ liệu để phân tích.
        </td>
      </tr>
    `;
    if (summary) {
      summary.textContent = "Vui lòng nhập chi tiêu và tính AHP trước.";
    }
    return;
  }

  tbody.innerHTML = rows.map((item) => `
    <tr class="hover:bg-blue-50/40 transition">
      <td class="px-4 py-3 font-medium">${item.category}</td>
      <td class="px-4 py-3 text-center">${formatCurrency(item.amount)}</td>
      <td class="px-4 py-3 text-center font-semibold text-primary-800">${item.score.toFixed(4)}</td>
      <td class="px-4 py-3 text-center ${getPriorityClass(item.priority)}">${item.priority}</td>
      <td class="px-4 py-3">${item.reason}</td>
    </tr>
  `).join("");

  if (summary) {
    summary.textContent = `Đang phân tích ${rows.length} danh mục từ dữ liệu thực tế.`;
  }
}

function renderCriteriaPieChart() {
  const canvas = document.getElementById("criteriaPieChart");
  if (!canvas || !latestAHPResult || !latestAHPResult.weights) return;

  const labels = latestAHPResult.weights.map((item) => item.name);
  const values = latestAHPResult.weights.map((item) => Number(item.value || 0));

  if (criteriaPieChartInstance) {
    criteriaPieChartInstance.destroy();
  }

  criteriaPieChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}function renderCriteriaPieChart() {
  const canvas = document.getElementById("criteriaPieChart");
  if (!canvas || !latestAHPResult || !latestAHPResult.weights) return;

  const labels = latestAHPResult.weights.map((item) => item.name);
  const values = latestAHPResult.weights.map((item) => Number(item.value || 0));

  const oldChart = Chart.getChart(canvas);
  if (oldChart) {
    oldChart.destroy();
  }

  if (criteriaPieChartInstance) {
    criteriaPieChartInstance.destroy();
    criteriaPieChartInstance = null;
  }

  criteriaPieChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderPriorityBarChart(rows) {
  const canvas = document.getElementById("priorityBarChart");
  if (!canvas) return;

  const labels = rows.map((item) => item.category);
  const values = rows.map((item) => Number(item.score || 0));

  const oldChart = Chart.getChart(canvas);
  if (oldChart) {
    oldChart.destroy();
  }

  if (priorityBarChartInstance) {
    priorityBarChartInstance.destroy();
    priorityBarChartInstance = null;
  }

  priorityBarChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Điểm ưu tiên",
          data: values
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 1
        }
      }
    }
  });
}

async function getStep4AnalysisData() {
  const allExpenses = getAllExpenses();

  if (!allExpenses.length) {
    throw new Error("Chưa có dữ liệu chi tiêu.");
  }

  if (!latestAHPResult || !latestAHPResult.weights) {
    throw new Error("Vui lòng tính AHP trước.");
  }

  const response = await fetch("/api/dss", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      expenses: allExpenses,
      ahp_weights: latestAHPResult.weights
    })
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Không thể phân tích dữ liệu STEP 4.");
  }

  return result;
}

async function renderStep4Analysis() {
  const tbody = document.getElementById("step4TableBody");
  const summary = document.getElementById("step4SummaryText");

  try {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-6 text-center text-slate-500">
            Đang phân tích dữ liệu...
          </td>
        </tr>
      `;
    }

    if (summary) {
      summary.textContent = "Đang xử lý dữ liệu thực tế...";
    }

    const result = await getStep4AnalysisData();
    const rows = buildStep4RowsFromDSSResult(result);

    renderStep4Table(rows);
    renderCriteriaPieChart();
    renderPriorityBarChart(rows);
    } catch (error) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-6 text-center text-red-500">
            ${error.message || "Không thể phân tích STEP 4."}
          </td>
        </tr>
      `;
    }

    if (summary) {
      summary.textContent = "Chưa thể hiển thị kết quả phân tích.";
    }

    if (criteriaPieChartInstance) {
      criteriaPieChartInstance.destroy();
      criteriaPieChartInstance = null;
    }

    if (priorityBarChartInstance) {
      priorityBarChartInstance.destroy();
      priorityBarChartInstance = null;
    }

    const pieOld = Chart.getChart("criteriaPieChart");
    if (pieOld) pieOld.destroy();

    const barOld = Chart.getChart("priorityBarChart");
    if (barOld) barOld.destroy();
  }
}
window.addEventListener("DOMContentLoaded", () => {
  const manualDate = document.getElementById("manualDate");
  if (manualDate && !manualDate.value) {
    manualDate.value = new Date().toISOString().split("T")[0];
  }

  const startBtn = document.getElementById("startBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      showStep(1);
    });
  }

  showDataInputTab("csv");
  renderExpenseTable();
  initializeAHPInputs();

  if (typeof renderCharts === "function") {
    renderCharts();
  }

  if (typeof applyRiskStyle === "function") {
    applyRiskStyle("Chưa đánh giá");
  }

  showStart();
});