from django.shortcuts import render

# Create your views here.

def detect_home(request):
    return render(request, 'detection/home_detect.html')
