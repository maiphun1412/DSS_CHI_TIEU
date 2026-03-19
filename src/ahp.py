from typing import List, Dict, Any


RI_TABLE = {
    1: 0.00,
    2: 0.00,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
}


CRITERIA_NAMES = [
    "Mức độ cần thiết",
    "Tác động ngân sách",
    "Khả năng cắt giảm",
    "Tần suất phát sinh",
    "Mức độ linh hoạt",
]


def _validate_matrix(matrix: List[List[float]]) -> List[List[float]]:
    if not isinstance(matrix, list) or not matrix:
        raise ValueError("Ma trận AHP không được để trống.")

    n = len(matrix)

    for row in matrix:
        if not isinstance(row, list) or len(row) != n:
            raise ValueError("Ma trận AHP phải là ma trận vuông.")

    normalized = []
    for i in range(n):
        current_row = []
        for j in range(n):
            try:
                value = float(matrix[i][j])
            except (TypeError, ValueError):
                raise ValueError("Ma trận chứa giá trị không hợp lệ.")

            if value <= 0:
                raise ValueError("Mọi giá trị trong ma trận AHP phải lớn hơn 0.")

            if i == j and abs(value - 1.0) > 1e-6:
                raise ValueError("Các phần tử trên đường chéo chính phải bằng 1.")

            current_row.append(value)
        normalized.append(current_row)

    tolerance = 0.03
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            reciprocal = 1.0 / normalized[j][i]
            if abs(normalized[i][j] - reciprocal) > tolerance:
                raise ValueError(
                    f"Ma trận chưa đối nghịch đúng tại ô ({i + 1}, {j + 1}). "
                    "Hãy đảm bảo a[i][j] = 1 / a[j][i]."
                )

    return normalized


def _column_sums(matrix: List[List[float]]) -> List[float]:
    n = len(matrix)
    sums = [0.0] * n
    for j in range(n):
        for i in range(n):
            sums[j] += matrix[i][j]
    return sums


def _normalize_matrix(matrix: List[List[float]], col_sums: List[float]) -> List[List[float]]:
    n = len(matrix)
    norm = []
    for i in range(n):
        row = []
        for j in range(n):
            row.append(matrix[i][j] / col_sums[j])
        norm.append(row)
    return norm


def _row_averages(matrix: List[List[float]]) -> List[float]:
    return [sum(row) / len(row) for row in matrix]


def _mat_vec_mul(matrix: List[List[float]], vector: List[float]) -> List[float]:
    result = []
    for row in matrix:
        result.append(sum(a * b for a, b in zip(row, vector)))
    return result


def calculate_ahp_from_matrix(matrix: List[List[float]]) -> Dict[str, Any]:
    matrix = _validate_matrix(matrix)
    n = len(matrix)

    col_sums = _column_sums(matrix)
    normalized_matrix = _normalize_matrix(matrix, col_sums)
    weights = _row_averages(normalized_matrix)

    total_weight = sum(weights)
    if total_weight == 0:
        raise ValueError("Không thể tính trọng số từ ma trận hiện tại.")

    weights = [w / total_weight for w in weights]

    weighted_sum = _mat_vec_mul(matrix, weights)
    lambda_values = [
        weighted_sum[i] / weights[i] if weights[i] != 0 else 0
        for i in range(n)
    ]
    lambda_max = sum(lambda_values) / n

    ci = 0.0 if n <= 2 else (lambda_max - n) / (n - 1)
    ri = RI_TABLE.get(n, 1.49)
    cr = 0.0 if ri == 0 else ci / ri

    criteria_names = (
        CRITERIA_NAMES[:n] if n <= len(CRITERIA_NAMES)
        else [f"Tiêu chí {i + 1}" for i in range(n)]
    )

    weight_items = [
        {
            "name": criteria_names[i],
            "value": round(weights[i], 4)
        }
        for i in range(n)
    ]

    sorted_weights = sorted(weight_items, key=lambda x: x["value"], reverse=True)

    message = (
        "Tỷ số nhất quán CR nhỏ hơn 10%, có thể tiếp tục sử dụng kết quả."
        if cr < 0.1
        else "Tỷ số nhất quán CR lớn hơn hoặc bằng 10%, nên xem lại ma trận so sánh."
    )

    return {
        "lambda_max": round(lambda_max, 4),
        "ci": round(ci, 4),
        "cr": round(cr, 4),
        "cr_percent": round(cr * 100, 4),
        "message": message,
        "is_consistent": cr < 0.1,
        "weights": weight_items,
        "sorted_weights": sorted_weights,
        "normalized_matrix": [[round(v, 4) for v in row] for row in normalized_matrix],
    }