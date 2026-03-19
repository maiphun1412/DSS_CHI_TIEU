import pyodbc
from datetime import datetime


def get_connection():
    conn = pyodbc.connect(
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=LAPTOP-VDKBJUCL;"
        "DATABASE=DSSBudgetAI;"
        "UID=sa;"
        "PWD=14122003;"
        "TrustServerCertificate=yes;"
    )
    return conn


def ensure_users_table():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    IF OBJECT_ID('Users', 'U') IS NULL
    BEGIN
        CREATE TABLE Users (
            id INT IDENTITY(1,1) PRIMARY KEY,
            username NVARCHAR(100) NOT NULL UNIQUE,
            password_hash NVARCHAR(255) NOT NULL
        )
    END
    """)

    conn.commit()
    conn.close()


def ensure_analysis_history_table():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    IF OBJECT_ID('AnalysisHistory', 'U') IS NULL
    BEGIN
        CREATE TABLE AnalysisHistory (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id INT NULL,
            analysis_date DATETIME,
            budget FLOAT,
            total_expense FLOAT,
            risk_level NVARCHAR(50),
            risk_score FLOAT,
            forecast_expense FLOAT,
            expected_over FLOAT,
            ratio FLOAT,
            expense_count INT,
            recommendation NVARCHAR(255)
        )
    END
    """)

    # nếu bảng cũ đã tồn tại nhưng chưa có cột user_id thì thêm vào
    cursor.execute("""
    IF COL_LENGTH('AnalysisHistory', 'user_id') IS NULL
    BEGIN
        ALTER TABLE AnalysisHistory
        ADD user_id INT NULL
    END
    """)

    # nếu bảng cũ chưa có recommendation thì thêm vào
    cursor.execute("""
    IF COL_LENGTH('AnalysisHistory', 'recommendation') IS NULL
    BEGIN
        ALTER TABLE AnalysisHistory
        ADD recommendation NVARCHAR(255) NULL
    END
    """)

    conn.commit()
    conn.close()


def get_user_by_username(username: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, username, password_hash
    FROM Users
    WHERE username = ?
    """, (username,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "username": row[1],
        "password_hash": row[2]
    }


def create_user(username: str, password_hash: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO Users (username, password_hash)
    OUTPUT INSERTED.id
    VALUES (?, ?)
    """, (username, password_hash))

    row = cursor.fetchone()
    conn.commit()
    conn.close()

    return row[0]


def save_analysis_history(
    user_id,
    budget,
    total_expense,
    risk_level,
    risk_score,
    forecast_expense,
    expected_over,
    ratio,
    expense_count,
    recommendation=""
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO AnalysisHistory
    (
        user_id,
        analysis_date,
        budget,
        total_expense,
        risk_level,
        risk_score,
        forecast_expense,
        expected_over,
        ratio,
        expense_count,
        recommendation
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
    (
        user_id,
        datetime.now(),
        budget,
        total_expense,
        risk_level,
        risk_score,
        forecast_expense,
        expected_over,
        ratio,
        expense_count,
        recommendation
    ))

    conn.commit()
    conn.close()


def get_analysis_history_by_user(user_id: int, limit: int = 50):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(f"""
    SELECT TOP {int(limit)}
        analysis_date,
        budget,
        total_expense,
        risk_level,
        risk_score,
        forecast_expense,
        expected_over,
        ratio,
        expense_count,
        recommendation
    FROM AnalysisHistory
    WHERE user_id = ?
    ORDER BY analysis_date DESC
    """, (user_id,))

    rows = cursor.fetchall()
    conn.close()

    data = []

    for r in rows:
        data.append({
            "analysis_date": str(r.analysis_date),
            "budget": r.budget,
            "total_expense": r.total_expense,
            "risk_level": r.risk_level,
            "risk_score": r.risk_score,
            "forecast_expense": r.forecast_expense,
            "expected_over": r.expected_over,
            "ratio": r.ratio,
            "expense_count": r.expense_count,
            "recommendation": r.recommendation or ""
        })

    return data


# Giữ lại hàm cũ để tránh lỗi nếu chỗ khác còn gọi
def get_analysis_history(limit: int = 50):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(f"""
    SELECT TOP {int(limit)}
        analysis_date,
        budget,
        total_expense,
        risk_level,
        risk_score,
        forecast_expense,
        expected_over,
        ratio,
        expense_count,
        recommendation
    FROM AnalysisHistory
    ORDER BY analysis_date DESC
    """)

    rows = cursor.fetchall()

    data = []

    for r in rows:
        data.append({
            "analysis_date": str(r.analysis_date),
            "budget": r.budget,
            "total_expense": r.total_expense,
            "risk_level": r.risk_level,
            "risk_score": r.risk_score,
            "forecast_expense": r.forecast_expense,
            "expected_over": r.expected_over,
            "ratio": r.ratio,
            "expense_count": r.expense_count,
            "recommendation": r.recommendation or ""
        })

    conn.close()
    return data