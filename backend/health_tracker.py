
import pandas as pd

REQUIRED_COLUMNS = [
    "Age",
    "Weight",
    "BMI",
    "Systolic_BP",
    "Diastolic_BP",
    "Heart_Rate",
    "Glucose"
]


def analyze_health_report(file):
    # Read the uploaded CSV into a Pandas DataFrame
    df = pd.read_csv(file, encoding="utf-8-sig")

    # Check that required health columns exist
    missing = [
        column for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Missing required columns: " + ", ".join(missing)
        )

    # Convert measurements to numeric values
    for column in REQUIRED_COLUMNS:
        df[column] = pd.to_numeric(
            df[column], errors="coerce"
        )

    # Reject a file with no usable measurements
    if df[REQUIRED_COLUMNS].dropna(how="all").empty:
        raise ValueError("No usable numerical health data found.")

    # Pandas descriptive statistics
    summary = df[REQUIRED_COLUMNS].describe().round(2)

    # Prepare a small data preview
    preview = df.head(10).where(
        pd.notna(df.head(10)), None
    ).to_dict(orient="records")

    # Prepare chart data
    chart_data = {
        "systolic_bp": df["Systolic_BP"].fillna(0).tolist(),
        "diastolic_bp": df["Diastolic_BP"].fillna(0).tolist(),
        "heart_rate": df["Heart_Rate"].fillna(0).tolist(),
        "bmi": df["BMI"].fillna(0).tolist(),
        "glucose": df["Glucose"].fillna(0).tolist()
    }

    # Replace missing values in summary with JSON-safe values
    summary_data = summary.where(
        pd.notna(summary), None
    ).to_dict()

    return {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "summary": summary_data,
        "preview": preview,
        "charts": chart_data
    }
