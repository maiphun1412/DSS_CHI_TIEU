from typing import List, Dict, Any


CATEGORY_PROFILES = {
    "Nhà ở": {
        "Mức độ cần thiết": 0.95,
        "Tác động ngân sách": 0.95,
        "Khả năng cắt giảm": 0.15,
        "Tần suất phát sinh": 0.90,
        "Mức độ linh hoạt": 0.10,
    },
    "Ăn uống": {
        "Mức độ cần thiết": 0.85,
        "Tác động ngân sách": 0.70,
        "Khả năng cắt giảm": 0.45,
        "Tần suất phát sinh": 0.95,
        "Mức độ linh hoạt": 0.35,
    },
    "Di chuyển": {
        "Mức độ cần thiết": 0.65,
        "Tác động ngân sách": 0.60,
        "Khả năng cắt giảm": 0.50,
        "Tần suất phát sinh": 0.80,
        "Mức độ linh hoạt": 0.45,
    },
    "Mua sắm": {
        "Mức độ cần thiết": 0.35,
        "Tác động ngân sách": 0.65,
        "Khả năng cắt giảm": 0.85,
        "Tần suất phát sinh": 0.55,
        "Mức độ linh hoạt": 0.90,
    },
    "Giải trí": {
        "Mức độ cần thiết": 0.20,
        "Tác động ngân sách": 0.50,
        "Khả năng cắt giảm": 0.95,
        "Tần suất phát sinh": 0.50,
        "Mức độ linh hoạt": 0.95,
    },
}


def _normalize_category_name(name: str) -> str:
    if not name:
        return "Mua sắm"

    value = str(name).strip().lower()

    mapping = {
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
        "health": "Giải trí",
    }

    return mapping.get(value, "Mua sắm")


def _priority_label(score: float) -> str:
    if score >= 0.75:
        return "Rất cao"
    if score >= 0.58:
        return "Cao"
    if score >= 0.42:
        return "Trung bình"
    if score >= 0.28:
        return "Thấp"
    return "Rất thấp"


def _build_reason(category: str, profile: Dict[str, float]) -> str:
    need = profile.get("Mức độ cần thiết", 0.5)
    reducible = profile.get("Khả năng cắt giảm", 0.5)
    flexibility = profile.get("Mức độ linh hoạt", 0.5)

    if reducible >= 0.75 and flexibility >= 0.75 and need <= 0.4:
        return "Dễ cắt giảm."
    if need >= 0.8 and reducible <= 0.3:
        return "Thiết yếu, nên hạn chế cắt."
    if flexibility >= 0.7:
        return "Có thể điều chỉnh."
    return "Cân nhắc tối ưu."


def build_dss_recommendation(expenses: List[Dict[str, Any]], ahp_weights: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(expenses, list) or len(expenses) == 0:
        raise ValueError("Chưa có dữ liệu chi tiêu để phân tích DSS.")

    if not isinstance(ahp_weights, list) or len(ahp_weights) == 0:
        raise ValueError("Chưa có trọng số AHP để phân tích DSS.")

    weights_map: Dict[str, float] = {}
    for item in ahp_weights:
        name = str(item.get("name", "")).strip()
        value = float(item.get("value", 0) or 0)
        if name:
            weights_map[name] = value

    if not weights_map:
        raise ValueError("Trọng số AHP không hợp lệ.")

    category_totals: Dict[str, float] = {}
    category_counts: Dict[str, int] = {}

    for item in expenses:
        category = _normalize_category_name(item.get("category"))
        amount = float(item.get("amount", 0) or 0)

        if amount <= 0:
            continue

        category_totals[category] = category_totals.get(category, 0.0) + amount
        category_counts[category] = category_counts.get(category, 0) + 1

    if not category_totals:
        raise ValueError("Không có khoản chi hợp lệ để phân tích DSS.")

    total_expense = sum(category_totals.values())
    max_amount = max(category_totals.values()) if category_totals else 1.0
    max_count = max(category_counts.values()) if category_counts else 1

    items = []

    for category, amount in category_totals.items():
        profile = CATEGORY_PROFILES[category]
        frequency_ratio = category_counts[category] / max_count

        need = profile.get("Mức độ cần thiết", 0.5)
        budget_impact = profile.get("Tác động ngân sách", 0.5)
        reducible = profile.get("Khả năng cắt giảm", 0.5)
        profile_frequency = profile.get("Tần suất phát sinh", 0.5)
        flexibility = profile.get("Mức độ linh hoạt", 0.5)

        weighted_profile_score = (
            weights_map.get("Mức độ cần thiết", 0) * (1 - need) +
            weights_map.get("Tác động ngân sách", 0) * budget_impact +
            weights_map.get("Khả năng cắt giảm", 0) * reducible +
            weights_map.get("Tần suất phát sinh", 0) * max(profile_frequency, frequency_ratio) +
            weights_map.get("Mức độ linh hoạt", 0) * flexibility
        )

        amount_factor = 0.65 + 0.35 * (amount / max_amount if max_amount > 0 else 0)
        final_score = weighted_profile_score * amount_factor

        items.append({
            "category": category,
            "amount": round(amount, 2),
            "score_raw": final_score,
            "profile": profile,
        })

    max_score = max(item["score_raw"] for item in items) if items else 1.0

    for item in items:
        normalized_score = item["score_raw"] / max_score if max_score > 0 else 0
        item["score"] = round(normalized_score, 4)
        item["priority"] = _priority_label(normalized_score)
        item["reason"] = _build_reason(item["category"], item["profile"])

    items.sort(key=lambda x: x["score"], reverse=True)

    return {
        "total_expense": round(total_expense, 2),
        "recommendations": [
            {
                "category": item["category"],
                "amount": item["amount"],
                "score": item["score"],
                "priority": item["priority"],
                "reason": item["reason"],
            }
            for item in items
        ]
    }