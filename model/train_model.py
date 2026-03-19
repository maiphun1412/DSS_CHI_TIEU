import os
import pandas as pd
from sklearn.linear_model import LogisticRegression
import joblib

data = {
    "total_expense": [5000, 7000, 9000, 11000, 12000],
    "budget": [10000, 10000, 10000, 10000, 10000],
    "ratio": [0.5, 0.7, 0.9, 1.1, 1.2],
    "label": [0, 1, 1, 2, 2]
}

df = pd.DataFrame(data)

X = df[["total_expense", "budget", "ratio"]]
y = df["label"]

model = LogisticRegression(max_iter=1000)
model.fit(X, y)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH = os.path.join(MODEL_DIR, "budget_model.pkl")
joblib.dump(model, MODEL_PATH)

print(f"Model trained and saved to: {MODEL_PATH}")