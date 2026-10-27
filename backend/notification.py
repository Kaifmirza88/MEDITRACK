import winsound
from plyer import notification


def send_notification(medicine, dosage):

    notification.notify(
        title="💊 Medicine Reminder",
        message=f"Time to take {medicine}\nDosage: {dosage}",
        timeout=10
    )

    for i in range(3):
        winsound.Beep(1000, 800)
        winsound.Beep(1400, 800)