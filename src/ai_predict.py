import os
import joblib
import numpy as np
import pandas as pd


MODEL_PATH = os.path.join("model", "budget_model.pkl")


def _load_model():
    """
    Load model nếu có.
    Nếu không có model hoặc lỗi load thì trả về None để dùng chế độ fallback.
    """
    try:
        if os.path.exists(MODEL_PATH):
            return joblib.load(MODEL_PATH)
    except Exception as exc:
        print(f"[WARNING] Không load được model AI: {exc}")
    return None


MODEL = _load_model()


def _fallback_predict(total_expense: float, budget: float, expense_count: int) -> dict:
    """
    Dự phòng nếu chưa có model hoặc model lỗi.
    Tính theo rule-based để app vẫn chạy.
    """
    ratio = total_expense / budget if budget > 0 else 0

    # dự đoán tổng chi cuối kỳ đơn giản
    if ratio >= 1:
        growth_factor = 1.08
    elif ratio >= 0.85:
        growth_factor = 1.12
    elif ratio >= 0.65:
        growth_factor = 1.10
    else:
        growth_factor = 1.05

    if expense_count >= 20:
        growth_factor += 0.03
    elif expense_count >= 10:
        growth_factor += 0.02
    elif expense_count >= 5:
        growth_factor += 0.01

    forecast_expense = round(total_expense * growth_factor, 2)
    expected_over = max(0.0, round(forecast_expense - budget, 2))

    # risk score đúng nghĩa cho biểu đồ: 0 -> 1
    risk_score = min(0.99, max(0.01, (ratio * 0.75) + min(expense_count / 100, 0.20)))

    if ratio >= 1.0 or expected_over > 0:
        risk_level = "Rất cao" if ratio >= 1.15 else "Cao"
    elif ratio >= 0.85:
        risk_level = "Cao"
    elif ratio >= 0.65:
        risk_level = "Trung bình"
    elif ratio > 0:
        risk_level = "Thấp"
    else:
        risk_level = "Chưa đánh giá"

    if risk_level in ["Rất cao", "Cao"]:
        message = "AI nhận thấy nguy cơ vượt ngân sách ở mức cao."
        advice = "Nên ưu tiên giảm các khoản Giải trí và Mua sắm, đồng thời kiểm soát các khoản phát sinh ngắn hạn."
    elif risk_level == "Trung bình":
        message = "AI nhận thấy ngân sách đang chịu áp lực ở mức trung bình."
        advice = "Nên theo dõi chặt nhóm chi linh hoạt và hạn chế phát sinh thêm trong thời gian tới."
    elif risk_level == "Thấp":
        message = "AI đánh giá nguy cơ vượt ngân sách hiện tại là thấp."
        advice = "Có thể tiếp tục duy trì mức chi hiện tại, nhưng vẫn nên theo dõi các nhóm chi không thiết yếu."
    else:
        message = "Chưa đủ dữ liệu rõ ràng để đánh giá rủi ro."
        advice = "Hãy bổ sung thêm dữ liệu chi tiêu và ngân sách để AI phân tích chính xác hơn."

    return {
        "risk_level": risk_level,
        "risk_score": round(risk_score, 2),
        "ratio": round(ratio, 2),
        "forecast_expense": forecast_expense,
        "expected_over": expected_over,
        "message": message,
        "advice": advice,
        "model_source": "fallback"
    }


def _normalize_prediction_to_level(prediction, ratio: float) -> str:
    pred_text = str(prediction).strip().lower()

    if pred_text in ["2", "high", "cao"]:
        return "Cao"
    if pred_text in ["1", "medium", "trung bình", "trung_binh"]:
        return "Trung bình"
    if pred_text in ["0", "low", "thấp", "thap"]:
        return "Thấp"

    # fallback theo ratio nếu prediction lạ
    if ratio >= 0.85:
        return "Cao"
    if ratio >= 0.65:
        return "Trung bình"
    return "Thấp"


def _build_risk_score_from_proba(classes, proba, ratio: float, expense_count: int) -> float:
    """
    Chuyển xác suất dự đoán đa lớp thành 1 risk_score đúng nghĩa cho biểu đồ.
    Không dùng np.max(proba) vì đó chỉ là độ tự tin của model, không phải mức rủi ro.
    """
    score_map = {
        "0": 0.0,
        "low": 0.0,
        "thấp": 0.0,
        "thap": 0.0,

        "1": 0.5,
        "medium": 0.5,
        "trung bình": 0.5,
        "trung_binh": 0.5,

        "2": 1.0,
        "high": 1.0,
        "cao": 1.0,
    }

    weighted_score = 0.0
    matched = False

    for cls, p in zip(classes, proba):
        key = str(cls).strip().lower()
        if key in score_map:
            weighted_score += float(p) * score_map[key]
            matched = True

    if not matched:
        # nếu classes không map được thì quay về công thức mềm theo ratio
        weighted_score = (ratio * 0.75) + min(expense_count / 100, 0.20)

    return float(max(0.0, min(0.99, weighted_score)))


def predict_risk(total_expense: float, budget: float, expense_count: int = 0) -> dict:
    """
    Hàm chính dùng trong app.py
    """
    if budget <= 0:
        raise ValueError("Ngân sách phải lớn hơn 0.")

    ratio = total_expense / budget if budget > 0 else 0

    if MODEL is None:
        return _fallback_predict(total_expense, budget, expense_count)

    try:
        X = pd.DataFrame([{
            "total_expense": float(total_expense),
            "budget": float(budget),
            "ratio": float(ratio),
            "expense_count": int(expense_count)
        }])

        try:
            prediction = MODEL.predict(X)[0]
            X_used = X
        except Exception:
            X_simple = X[["total_expense", "budget", "ratio"]]
            prediction = MODEL.predict(X_simple)[0]
            X_used = X_simple

        risk_level = _normalize_prediction_to_level(prediction, ratio)

        risk_score = None
        try:
            if hasattr(MODEL, "predict_proba"):
                proba = MODEL.predict_proba(X_used)[0]

                if hasattr(MODEL, "classes_"):
                    classes = list(MODEL.classes_)
                    risk_score = _build_risk_score_from_proba(classes, proba, ratio, expense_count)
        except Exception:
            risk_score = None

        if risk_score is None:
            if risk_level == "Cao":
                risk_score = 0.85
            elif risk_level == "Trung bình":
                risk_score = 0.50
            else:
                risk_score = 0.15

        if risk_level == "Cao":
            forecast_factor = 1.12
        elif risk_level == "Trung bình":
            forecast_factor = 1.08
        else:
            forecast_factor = 1.05

        if expense_count >= 20:
            forecast_factor += 0.03
        elif expense_count >= 10:
            forecast_factor += 0.02
        elif expense_count >= 5:
            forecast_factor += 0.01

        forecast_expense = round(total_expense * forecast_factor, 2)
        expected_over = max(0.0, round(forecast_expense - budget, 2))

        if risk_level == "Cao":
            message = "AI dự đoán nguy cơ vượt ngân sách ở mức cao."
            advice = "Nên cắt giảm các khoản chi không thiết yếu như Giải trí, Mua sắm và kiểm soát chi tiêu phát sinh."
        elif risk_level == "Trung bình":
            message = "AI dự đoán nguy cơ vượt ngân sách ở mức trung bình."
            advice = "Nên theo dõi sát các khoản chi linh hoạt và hạn chế tăng chi trong giai đoạn tiếp theo."
        else:
            message = "AI dự đoán nguy cơ vượt ngân sách ở mức thấp."
            advice = "Ngân sách hiện khá ổn định, tuy nhiên vẫn nên duy trì theo dõi định kỳ."

        return {
            "risk_level": risk_level,
            "risk_score": round(float(risk_score), 2),
            "ratio": round(ratio, 2),
            "forecast_expense": forecast_expense,
            "expected_over": expected_over,
            "message": message,
            "advice": advice,
            "model_source": "model"
        }

    except Exception as exc:
        print(f"[WARNING] Model lỗi, chuyển sang fallback: {exc}")
        return _fallback_predict(total_expense, budget, expense_count)