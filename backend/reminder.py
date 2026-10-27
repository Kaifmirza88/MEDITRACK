import sqlite3
import time
from datetime import datetime

from notification import send_notification


DATABASE = "medicines.db"


def check_reminders():

    notified = set()

    while True:

        current_time = datetime.now().strftime("%H:%M")
        today = datetime.now().strftime("%Y-%m-%d")

        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, dosage, reminder_time
            FROM medicines
        """)

        medicines = cursor.fetchall()

        conn.close()


        for medicine in medicines:

            medicine_id = medicine[0]
            name = medicine[1]
            dosage = medicine[2]
            reminder_time = medicine[3]


            reminder_key = (
                today,
                medicine_id,
                reminder_time
            )


            if (
                reminder_time == current_time
                and reminder_key not in notified
            ):

                print(
                    f"🔔 Reminder: Take {name} - {dosage}"
                )


                send_notification(
                    name,
                    dosage
                )


                notified.add(reminder_key)


        # Remove old notification records
        # after the day changes

        if len(notified) > 100:

            notified.clear()


        time.sleep(20)