from django.db import models

class Owner(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    address = models.TextField()

    def __str__(self):
        return self.name

class Vehicle(models.Model):
    plate = models.CharField(max_length=20, unique=True)
    brand = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    color = models.CharField(max_length=30)
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.plate} - {self.brand} {self.model}"
