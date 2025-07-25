from django.db import models
from django.contrib.auth.models import User
from vehicules.models import Vehicle

class Detection(models.Model):
    image = models.ImageField(upload_to='detection_images/', null=True, blank=True)
    video = models.FileField(upload_to='detection_videos/', null=True, blank=True)
    detected_plate = models.CharField(max_length=20)
    detection_date = models.DateTimeField(auto_now_add=True)
    found_vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.detected_plate} detected on {self.detection_date}"
