from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import sqlite3
import threading

from health_tracker import analyze_health_report
from datetime import datetime

from reminder import check_reminders


# ==========================================
# FLASK APPLICATION
# ==========================================

app = Flask(__name__)

CORS(app)

DATABASE = "medicines.db"


# ==========================================
# DATABASE
# ==========================================

def create_database():

    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()


    cursor.execute("""
        CREATE TABLE IF NOT EXISTS medicines (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            dosage TEXT NOT NULL,

            reminder_time TEXT NOT NULL

        )
    """)


    cursor.execute("""
        CREATE TABLE IF NOT EXISTS medicine_history (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            medicine_id INTEGER,

            medicine_name TEXT NOT NULL,

            dosage TEXT NOT NULL,

            reminder_time TEXT NOT NULL,

            taken_at TEXT NOT NULL

        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS health_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            age REAL,
            weight REAL,
            bmi REAL,
            systolic_bp INTEGER,
            diastolic_bp INTEGER,
            heart_rate REAL,
            glucose REAL,
            recorded_at TEXT NOT NULL
        )
    """)



    conn.commit()

    conn.close()


# ==========================================
# HOME
# ==========================================

@app.route("/")
def home():

    return "Medicine Reminder Backend is Running! 💊"


# ==========================================
# ADD MEDICINE
# ==========================================

@app.route("/medicines", methods=["POST"])
def add_medicine():

    data = request.get_json()


    name = data.get("name")

    dosage = data.get("dosage")

    reminder_time = data.get("reminder_time")


    if not name or not dosage or not reminder_time:

        return jsonify({
            "message": "Please fill all fields"
        }), 400


    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()


    cursor.execute("""
        INSERT INTO medicines
        (
            name,
            dosage,
            reminder_time
        )
        VALUES (?, ?, ?)
    """, (
        name,
        dosage,
        reminder_time
    ))


    conn.commit()

    conn.close()


    return jsonify({
        "message": "Medicine added successfully!"
    })


# ==========================================
# GET MEDICINES
# ==========================================

@app.route("/medicines", methods=["GET"])
def get_medicines():

    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()


    cursor.execute("""
        SELECT
            id,
            name,
            dosage,
            reminder_time
        FROM medicines
        ORDER BY reminder_time
    """)


    medicines = cursor.fetchall()

    conn.close()


    result = []


    for medicine in medicines:

        result.append({

            "id": medicine[0],

            "name": medicine[1],

            "dosage": medicine[2],

            "reminder_time": medicine[3]

        })


    return jsonify(result)


# ==========================================
# DELETE MEDICINE
# ==========================================

@app.route(
    "/medicines/<int:medicine_id>",
    methods=["DELETE"]
)
def delete_medicine(medicine_id):

    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()


    cursor.execute(
        "DELETE FROM medicines WHERE id = ?",
        (medicine_id,)
    )


    conn.commit()

    conn.close()


    return jsonify({
        "message": "Medicine deleted successfully!"
    })


# ==========================================
# MARK MEDICINE AS TAKEN
# ==========================================

@app.route(
    "/medicines/<int:medicine_id>/taken",
    methods=["POST"]
)
def mark_taken(medicine_id):

    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()


    cursor.execute("""
        SELECT
            name,
            dosage,
            reminder_time
        FROM medicines
        WHERE id = ?
    """, (medicine_id,))


    medicine = cursor.fetchone()


    if medicine is None:

        conn.close()

        return jsonify({
            "message": "Medicine not found"
        }), 404


    name = medicine[0]

    dosage = medicine[1]

    reminder_time = medicine[2]


    taken_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )


    cursor.execute("""
        INSERT INTO medicine_history
        (
            medicine_id,
            medicine_name,
            dosage,
            reminder_time,
            taken_at
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        medicine_id,
        name,
        dosage,
        reminder_time,
        taken_at
    ))


    conn.commit()

    conn.close()


    return jsonify({
        "message": "Medicine marked as taken!"
    })


# ==========================================
# HISTORY
# ==========================================

@app.route("/history", methods=["GET"])
def get_history():

    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()


    cursor.execute("""
        SELECT
            medicine_name,
            dosage,
            reminder_time,
            taken_at
        FROM medicine_history
        ORDER BY taken_at DESC
    """)


    history = cursor.fetchall()

    conn.close()


    result = []


    for item in history:

        result.append({

            "medicine_name": item[0],

            "dosage": item[1],

            "reminder_time": item[2],

            "taken_at": item[3]

        })


    return jsonify(result)


# ==========================================
# DASHBOARD
# ==========================================

@app.route("/dashboard", methods=["GET"])
def dashboard():

    conn = sqlite3.connect(DATABASE)

    cursor = conn.cursor()


    cursor.execute("""
        SELECT
            id,
            name,
            dosage,
            reminder_time
        FROM medicines
    """)

    medicines = cursor.fetchall()


    cursor.execute("""
        SELECT
            medicine_name,
            dosage,
            reminder_time,
            taken_at
        FROM medicine_history
    """)

    history = cursor.fetchall()


    conn.close()


    today = datetime.now().strftime("%Y-%m-%d")

    current_time = datetime.now().strftime("%H:%M")


    medicine_count = len(medicines)


    # ======================================
    # TAKEN TODAY
    # ======================================

    taken_count = 0


    for item in history:

        if item[3].startswith(today):

            taken_count += 1


    # ======================================
    # MISSED
    # ======================================

    missed_count = 0


    for medicine in medicines:

        name = medicine[1]

        reminder_time = medicine[3]


        if reminder_time < current_time:

            taken = False


            for item in history:

                history_name = item[0]

                taken_at = item[3]


                if (
                    history_name == name
                    and taken_at.startswith(today)
                ):

                    taken = True

                    break


            if not taken:

                missed_count += 1


    # ======================================
    # NEXT REMINDER
    # ======================================

    future_times = []


    for medicine in medicines:

        reminder_time = medicine[3]


        if reminder_time >= current_time:

            future_times.append(
                reminder_time
            )


    if future_times:

        next_reminder = min(
            future_times
        )

    else:

        next_reminder = "No reminder"


    return jsonify({

        "medicine_count":
            medicine_count,

        "taken_count":
            taken_count,

        "missed_count":
            missed_count,

        "next_reminder":
            next_reminder

    })

# Save one health measurement
@app.route("/health-records", methods=["POST"])
def add_health_record():
    data = request.get_json(silent=True) or {}

    fields = [
        "age", "weight", "bmi", "systolic_bp",
        "diastolic_bp", "heart_rate", "glucose"
    ]

    try:
        values = [data.get(field) for field in fields]

        if any(value in (None, "") for value in values):
            return jsonify({
                "error": "Please fill in every health field."
            }), 400

        values = [float(value) for value in values]

        if any(value < 0 for value in values):
            return jsonify({
                "error": "Measurements cannot be negative."
            }), 400

        conn = sqlite3.connect(DATABASE)
        conn.execute("""
            INSERT INTO health_records
            (age, weight, bmi, systolic_bp, diastolic_bp,
             heart_rate, glucose, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (*values, datetime.now().isoformat(timespec="seconds")))

        conn.commit()
        conn.close()

        return jsonify({
            "message": "Health record saved successfully."
        }), 201

    except (ValueError, TypeError):
        return jsonify({
            "error": "Please enter valid numerical values."
        }), 400


# Get saved health history
@app.route("/health-records", methods=["GET"])
def get_health_records():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("""
        SELECT * FROM health_records
        ORDER BY recorded_at DESC
    """).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


# Analyze uploaded CSV using Pandas
@app.route("/health/analyze", methods=["POST"])
def analyze_health_csv():
    if "file" not in request.files:
        return jsonify({
            "error": "Please upload a CSV file."
        }), 400

    file = request.files["file"]

    if not file.filename or not file.filename.lower().endswith(".csv"):
        return jsonify({
            "error": "Only CSV files are supported."
        }), 400

    try:
        result = analyze_health_report(file)
        return jsonify(result)

    except (ValueError, pd.errors.ParserError) as error:
        return jsonify({"error": str(error)}), 400

    except Exception:
        app.logger.exception("Health CSV analysis failed")
        return jsonify({
            "error": "Unable to analyze this file."
        }), 500



@app.route("/health/summary", methods=["GET"])
def health_summary():
    conn = sqlite3.connect(DATABASE)

    try:
        df = pd.read_sql_query("""
            SELECT age, weight, bmi, systolic_bp,
                   diastolic_bp, heart_rate, glucose
            FROM health_records
        """, conn)
    finally:
        conn.close()

    if df.empty:
        return jsonify({
            "message": "No health records available yet.",
            "summary": {}
        })

    summary = df.describe().round(2)
    summary = summary.astype(object).where(
        pd.notna(summary), None
    )

    return jsonify({
        "record_count": len(df),
        "summary": summary.to_dict()
    })




# ==========================================
# START APPLICATION
# ==========================================

if __name__ == "__main__":

    # Create database
    create_database()


    # Start reminder system
    reminder_thread = threading.Thread(
        target=check_reminders,
        daemon=True
    )

    reminder_thread.start()


    print("===================================")
    print("💊 Medicine Reminder System")
    print("===================================")
    print("Flask: http://127.0.0.1:5000")
    print("Reminder system: Running")
    print("===================================")


    # Start Flask
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )