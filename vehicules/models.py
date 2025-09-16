from django.db import models
from django.contrib.auth.models import User


class Vehicle(models.Model):
    
    plate = models.CharField(max_length=20, unique=True)
    brand = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    color = models.CharField(max_length=30)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.plate} - {self.brand} {self.model}"
