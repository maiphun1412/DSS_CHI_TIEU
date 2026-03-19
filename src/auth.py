from flask_bcrypt import Bcrypt
from src.db import get_connection

bcrypt = Bcrypt()


def register_user(username, password):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE username = ?", username)
    existing_user = cursor.fetchone()

    if existing_user:
        conn.close()
        return {
            "success": False,
            "message": "Tên đăng nhập đã tồn tại."
        }

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    cursor.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        username,
        password_hash
    )

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Đăng ký thành công."
    }


def login_user(username, password):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, password_hash FROM users WHERE username = ?",
        username
    )

    row = cursor.fetchone()
    conn.close()

    if row and bcrypt.check_password_hash(row.password_hash, password):
        return {
            "success": True,
            "user_id": row.id,
            "message": "Đăng nhập thành công."
        }

    return {
        "success": False,
        "message": "Sai tên đăng nhập hoặc mật khẩu."
    }