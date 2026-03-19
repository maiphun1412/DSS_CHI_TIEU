from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import generate_password_hash, check_password_hash
from src.dss import build_dss_recommendation
from src.ai_predict import predict_risk
from src.ahp import calculate_ahp_from_matrix
from src.db import (
    ensure_analysis_history_table,
    ensure_users_table,
    get_analysis_history_by_user,
    save_analysis_history,
    get_user_by_username,
    create_user,
)

app = Flask(__name__)
app.secret_key = "dss_budget_secret_key_2026"


@app.route("/")
def home():
    return render_template("dashboard.html")


@app.route("/auth-status", methods=["GET"])
def auth_status():
    return jsonify({
        "logged_in": "user_id" in session,
        "username": session.get("username")
    })


@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()

        if not username or not password:
            return jsonify({
                "success": False,
                "message": "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu."
            }), 400

        existing_user = get_user_by_username(username)
        if existing_user:
            return jsonify({
                "success": False,
                "message": "Tên đăng nhập đã tồn tại."
            }), 400

        password_hash = generate_password_hash(password)
        user_id = create_user(username=username, password_hash=password_hash)

        session["user_id"] = user_id
        session["username"] = username

        return jsonify({
            "success": True,
            "message": "Đăng ký thành công.",
            "username": username
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Lỗi đăng ký: {str(exc)}"
        }), 500


@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()

        if not username or not password:
            return jsonify({
                "success": False,
                "message": "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu."
            }), 400

        user = get_user_by_username(username)
        if not user:
            return jsonify({
                "success": False,
                "message": "Tài khoản không tồn tại."
            }), 404

        if not check_password_hash(user["password_hash"], password):
            return jsonify({
                "success": False,
                "message": "Sai mật khẩu."
            }), 400

        session["user_id"] = user["id"]
        session["username"] = user["username"]

        return jsonify({
            "success": True,
            "message": "Đăng nhập thành công.",
            "username": user["username"]
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Lỗi đăng nhập: {str(exc)}"
        }), 500


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({
        "success": True,
        "message": "Đã đăng xuất."
    })


@app.route("/api/predict", methods=["POST"])
def api_predict():
    try:
        data = request.get_json(silent=True) or {}

        total_expense = float(data.get("total_expense", 0) or 0)
        budget = float(data.get("budget", 0) or 0)
        expense_count = int(data.get("expense_count", 0) or 0)

        if budget <= 0:
            return jsonify({
                "success": False,
                "message": "Ngân sách phải lớn hơn 0."
            }), 400

        if total_expense < 0:
            return jsonify({
                "success": False,
                "message": "Tổng chi không hợp lệ."
            }), 400

        if expense_count < 0:
            return jsonify({
                "success": False,
                "message": "Số khoản chi không hợp lệ."
            }), 400

        result = predict_risk(
            total_expense=total_expense,
            budget=budget,
            expense_count=expense_count
        )

        if "user_id" in session:
            save_analysis_history(
                user_id=session["user_id"],
                budget=budget,
                total_expense=total_expense,
                risk_level=result["risk_level"],
                risk_score=result["risk_score"],
                forecast_expense=result["forecast_expense"],
                expected_over=result["expected_over"],
                ratio=result.get("ratio", 0),
                expense_count=expense_count,
                recommendation=result.get("advice", "")
            )

        return jsonify({
            "success": True,
            **result,
            "logged_in": "user_id" in session
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Lỗi dự đoán: {str(exc)}"
        }), 500


@app.route("/api/ahp", methods=["POST"])
def api_ahp():
    try:
        data = request.get_json(silent=True) or {}
        matrix = data.get("matrix", [])

        result = calculate_ahp_from_matrix(matrix)

        return jsonify({
            "success": True,
            **result
        })

    except ValueError as exc:
        return jsonify({
            "success": False,
            "message": str(exc)
        }), 400
    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Lỗi tính AHP: {str(exc)}"
        }), 500

@app.route("/api/dss", methods=["POST"])
def api_dss():
    try:
        data = request.get_json(silent=True) or {}
        expenses = data.get("expenses", [])
        ahp_weights = data.get("ahp_weights", [])

        result = build_dss_recommendation(
            expenses=expenses,
            ahp_weights=ahp_weights
        )

        return jsonify({
            "success": True,
            **result
        })

    except ValueError as exc:
        return jsonify({
            "success": False,
            "message": str(exc)
        }), 400
    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Lỗi phân tích DSS: {str(exc)}"
        }), 500
    
@app.route("/history-data", methods=["GET"])
def history_data():
    try:
        if "user_id" not in session:
            return jsonify({
                "success": False,
                "message": "Chưa đăng nhập."
            }), 401

        rows = get_analysis_history_by_user(user_id=session["user_id"], limit=50)

        return jsonify({
            "success": True,
            "data": rows
        })
    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Lỗi tải lịch sử: {str(exc)}"
        }), 500


if __name__ == "__main__":
    try:
        ensure_users_table()
        ensure_analysis_history_table()
    except Exception as exc:
        print(f"[WARNING] Không thể khởi tạo bảng dữ liệu: {exc}")

    app.run(debug=True)