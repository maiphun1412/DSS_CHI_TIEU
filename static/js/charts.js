let riskChart = null;
let criteriaPieChart = null;
let priorityBarChart = null;
let aiProbabilityChart = null;
let budgetCompareChart = null;
let expenseCategoryChart = null;

const chartPalette = {
  primary: "#2563eb",
  primarySoft: "rgba(37, 99, 235, 0.18)",
  sky: "#0ea5e9",
  skySoft: "rgba(14, 165, 233, 0.18)",
  cyan: "#06b6d4",
  cyanSoft: "rgba(6, 182, 212, 0.18)",
  indigo: "#4f46e5",
  indigoSoft: "rgba(79, 70, 229, 0.18)",
  emerald: "#10b981",
  emeraldSoft: "rgba(16, 185, 129, 0.18)",
  amber: "#f59e0b",
  amberSoft: "rgba(245, 158, 11, 0.18)",
  orange: "#f97316",
  orangeSoft: "rgba(249, 115, 22, 0.18)",
  red: "#ef4444",
  redSoft: "rgba(239, 68, 68, 0.18)",
  slate: "#64748b",
  slateSoft: "rgba(100, 116, 139, 0.18)",
  grid: "rgba(148, 163, 184, 0.18)",
  text: "#334155",
  white: "#ffffff"
};

function getCommonChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: chartPalette.text,
          usePointStyle: true,
          padding: 16,
          font: {
            size: 12,
            weight: "600"
          }
        }
      },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        padding: 12,
        cornerRadius: 10
      }
    },
    scales: {
      x: {
        ticks: {
          color: chartPalette.text
        },
        grid: {
          color: chartPalette.grid
        }
      },
      y: {
        ticks: {
          color: chartPalette.text
        },
        grid: {
          color: chartPalette.grid
        }
      }
    }
  };
}

function updateRiskChart(percent) {
  const canvas = document.getElementById("riskChart");
  if (!canvas) return;

  const probability =
    percent >= 100 ? 95 :
    percent >= 85 ? 87 :
    percent >= 65 ? 62 :
    percent > 0 ? 28 : 0;

  const safePercent = Math.max(0, 100 - probability);

  if (riskChart) riskChart.destroy();

  riskChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Xác suất vượt ngân sách", "Xác suất không vượt"],
      datasets: [{
        data: [probability, safePercent],
        backgroundColor: [chartPalette.red, chartPalette.primarySoft],
        borderColor: [chartPalette.white, chartPalette.white],
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: chartPalette.text,
            usePointStyle: true,
            padding: 16,
            font: {
              size: 12,
              weight: "600"
            }
          }
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          padding: 12,
          cornerRadius: 10
        }
      }
    }
  });
}

function renderBudgetCompareChart(total, budget) {
  const canvas = document.getElementById("budgetCompareChart");
  if (!canvas) return;

  if (budgetCompareChart) budgetCompareChart.destroy();

  budgetCompareChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Tổng chi", "Ngân sách"],
      datasets: [{
        label: "Số tiền",
        data: [total, budget],
        backgroundColor: [chartPalette.orange, chartPalette.primary],
        borderRadius: 12,
        maxBarThickness: 56
      }]
    },
    options: {
      ...getCommonChartOptions(),
      plugins: {
        ...getCommonChartOptions().plugins,
        legend: { display: false }
      }
    }
  });
}

function renderAIProbabilityChart(riskScore) {
  const canvas = document.getElementById("aiProbabilityChart");
  if (!canvas) return;

  let normalizedScore = Number(riskScore ?? 0);

  // Nếu backend trả theo thang 0-100 thì tự đổi về 0-1
  if (normalizedScore > 1) {
    normalizedScore = normalizedScore / 100;
  }

  // Chặn dữ liệu lỗi
  if (!isFinite(normalizedScore)) {
    normalizedScore = 0;
  }

  // Ép về đúng khoảng 0-1
  normalizedScore = Math.max(0, Math.min(1, normalizedScore));

  const riskPercent = Math.round(normalizedScore * 100);
  const safePercent = 100 - riskPercent;

  if (aiProbabilityChart) {
    aiProbabilityChart.destroy();
    aiProbabilityChart = null;
  }

  aiProbabilityChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Rủi ro", "An toàn"],
      datasets: [{
        label: "Tỷ lệ (%)",
        data: [riskPercent, safePercent],
        backgroundColor: [chartPalette.red, chartPalette.emerald],
        borderRadius: 12,
        maxBarThickness: 56
      }]
    },
    options: {
      ...getCommonChartOptions(),
      plugins: {
        ...getCommonChartOptions().plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: chartPalette.text },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: chartPalette.text,
            callback: (value) => `${value}%`
          },
          grid: { color: chartPalette.grid }
        }
      }
    }
  });
}

function renderExpenseCategoryChart(expenses) {
  const canvas = document.getElementById("expenseCategoryChart");
  if (!canvas) return;

  const totals = {};
  expenses.forEach((item) => {
    const category = item.category || "Khác";
    totals[category] = (totals[category] || 0) + Number(item.amount || 0);
  });

  const labels = Object.keys(totals);
  const values = Object.values(totals);

  if (expenseCategoryChart) expenseCategoryChart.destroy();

  expenseCategoryChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Chi tiêu",
        data: values,
        backgroundColor: [
          chartPalette.primary,
          chartPalette.sky,
          chartPalette.cyan,
          chartPalette.indigo,
          chartPalette.emerald,
          chartPalette.amber,
          chartPalette.orange
        ],
        borderRadius: 12,
        maxBarThickness: 48
      }]
    },
    options: {
      ...getCommonChartOptions(),
      plugins: {
        ...getCommonChartOptions().plugins,
        legend: { display: false }
      }
    }
  });
}

function renderCharts() {
  const criteriaPieCtx = document.getElementById("criteriaPieChart");
  const priorityBarCtx = document.getElementById("priorityBarChart");

  if (criteriaPieChart) criteriaPieChart.destroy();
  if (priorityBarChart) priorityBarChart.destroy();

  if (criteriaPieCtx) {
    criteriaPieChart = new Chart(criteriaPieCtx, {
      type: "pie",
      data: {
        labels: [
          "Mức độ cần thiết",
          "Tác động ngân sách",
          "Khả năng cắt giảm",
          "Tần suất phát sinh"
        ],
        datasets: [{
          data: [40.12, 24.86, 17.64, 10.98],
          backgroundColor: [
            chartPalette.primary,
            chartPalette.sky,
            chartPalette.cyan,
            chartPalette.indigo
          ],
          borderColor: chartPalette.white,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: chartPalette.text,
              usePointStyle: true,
              padding: 16,
              font: {
                size: 12,
                weight: "600"
              }
            }
          }
        }
      }
    });
  }

  if (priorityBarCtx) {
    priorityBarChart = new Chart(priorityBarCtx, {
      type: "bar",
      data: {
        labels: ["Giải trí", "Mua sắm", "Di chuyển", "Ăn uống", "Nhà ở"],
        datasets: [{
          label: "Điểm ưu tiên",
          data: [0.3021, 0.2485, 0.1914, 0.1570, 0.1010],
          backgroundColor: [
            chartPalette.red,
            chartPalette.orange,
            chartPalette.amber,
            chartPalette.sky,
            chartPalette.emerald
          ],
          borderRadius: 10,
          maxBarThickness: 48
        }]
      },
      options: {
        ...getCommonChartOptions(),
        plugins: {
          ...getCommonChartOptions().plugins,
          legend: { display: false }
        }
      }
    });
  }
}