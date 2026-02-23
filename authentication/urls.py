from django.urls import path
from rest_framework_nested import routers
from . import views

router = routers.DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'auth', views.AuthViewSet, basename='auth')

# Nested router for user preferences
user_nested_router = routers.NestedDefaultRouter(router, r'users', lookup='user')
user_nested_router.register(r'preferences', views.UserPreferencesViewSet, basename='user-preferences')

urlpatterns = router.urls + user_nested_router.urls
