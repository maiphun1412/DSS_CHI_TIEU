function applyRiskStyle(level) {
  const badge = document.getElementById("riskBadge");
  if (!badge) return;

  if (level === "Thấp") {
    badge.className = "inline-flex rounded-full bg-emerald-100 text-emerald-700 px-4 py-2 text-sm font-semibold";
  } else if (level === "Trung bình") {
    badge.className = "inline-flex rounded-full bg-amber-100 text-amber-700 px-4 py-2 text-sm font-semibold";
  } else if (level === "Cao") {
    badge.className = "inline-flex rounded-full bg-orange-100 text-orange-700 px-4 py-2 text-sm font-semibold";
  } else if (level === "Rất cao") {
    badge.className = "inline-flex rounded-full bg-red-100 text-red-700 px-4 py-2 text-sm font-semibold";
  } else {
    badge.className = "inline-flex rounded-full bg-blue-50 text-primary-700 border border-blue-100 px-4 py-2 text-sm font-semibold";
  }

  badge.textContent = level;
}

async function startAIPrediction() {
  const { allExpenses, budget, total, percent } = getSummaryStats();

  if (!allExpenses.length) {
    alert("Vui lòng nhập dữ liệu chi tiêu trước khi chạy AI.");
    return;
  }

  if (!budget || budget <= 0) {
    alert("Vui lòng nhập ngân sách hợp lệ trước khi chạy AI.");
    return;
  }

  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        total_expense: total,
        budget: budget,
        expense_count: allExpenses.length
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert(result.message || "Không thể dự đoán AI.");
      return;
    }

    const aiInputTotal = document.getElementById("aiInputTotal");
    const aiInputBudget = document.getElementById("aiInputBudget");
    const aiInputCount = document.getElementById("aiInputCount");
    const aiInputRatio = document.getElementById("aiInputRatio");
    const aiStatusBadge = document.getElementById("aiStatusBadge");

    const riskLevelText = document.getElementById("riskLevelText");
    const riskScoreText = document.getElementById("riskScoreText");
    const ratioText = document.getElementById("ratioText");
    const forecastExpenseText = document.getElementById("forecastExpenseText");
    const expectedOverText = document.getElementById("expectedOverText");
    const aiMessageText = document.getElementById("aiMessageText");
    const aiAdviceText = document.getElementById("aiAdviceText");
    const aiExplainLine = document.getElementById("aiExplainLine");

    if (aiInputTotal) aiInputTotal.textContent = formatCurrency(total);
    if (aiInputBudget) aiInputBudget.textContent = formatCurrency(budget);
    if (aiInputCount) aiInputCount.textContent = allExpenses.length;
    if (aiInputRatio) aiInputRatio.textContent = Number(result.ratio || 0).toFixed(2);

    if (riskLevelText) riskLevelText.textContent = result.risk_level || "Chưa đánh giá";
    if (riskScoreText) riskScoreText.textContent = Number(result.risk_score || 0).toFixed(2);
    if (ratioText) ratioText.textContent = Number(result.ratio || 0).toFixed(2);
    if (forecastExpenseText) forecastExpenseText.textContent = formatCurrency(result.forecast_expense || 0);
    if (expectedOverText) expectedOverText.textContent = formatCurrency(result.expected_over || 0);

    const aiMessage =
      result.risk_level === "Rất cao"
        ? "Nguy cơ vượt ngân sách rất cao."
        : result.risk_level === "Cao"
        ? "Nguy cơ vượt ngân sách ở mức cao."
        : result.risk_level === "Trung bình"
        ? "Nguy cơ vượt ngân sách ở mức trung bình."
        : "Chi tiêu hiện đang ở mức an toàn.";

    const aiAdvice =
      result.risk_level === "Rất cao" || result.risk_level === "Cao"
        ? "Nên ưu tiên cắt giảm các khoản linh hoạt như giải trí và mua sắm."
        : result.risk_level === "Trung bình"
        ? "Nên theo dõi sát chi tiêu trong thời gian tới."
        : "Tiếp tục duy trì kế hoạch chi tiêu hiện tại.";

    if (aiMessageText) aiMessageText.textContent = aiMessage;
    if (aiAdviceText) aiAdviceText.textContent = aiAdvice;

    if (aiExplainLine) {
      aiExplainLine.innerHTML = `<span class="font-semibold text-primary-800">Kết luận:</span> ${aiMessage} Tỷ lệ chi tiêu hiện tại là ${(Number(result.ratio || 0) * 100).toFixed(1)}% ngân sách.`;
    }

    if (aiStatusBadge) {
      aiStatusBadge.textContent = result.logged_in ? "Đã chạy AI và lưu lịch sử" : "Đã chạy AI";
      aiStatusBadge.className = "inline-flex rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-semibold";
    }

    applyRiskStyle(result.risk_level || "Chưa đánh giá");

    if (typeof updateRiskChart === "function") {
      updateRiskChart(percent);
    }
    if (typeof renderAIProbabilityChart === "function") {
      renderAIProbabilityChart(result.risk_score || 0);
    }
    if (typeof renderBudgetCompareChart === "function") {
      renderBudgetCompareChart(total, budget);
    }

  } catch (error) {
    alert("Lỗi kết nối khi chạy AI.");
    console.error(error);
  }
}