from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'students', views.StudentViewSet, basename='student')
router.register(r'parent-relationships', views.ParentStudentRelationshipViewSet, basename='parent-relationship')

urlpatterns = router.urls
