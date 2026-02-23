from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'students', views.UserViewSet, basename='student')

urlpatterns = router.urls