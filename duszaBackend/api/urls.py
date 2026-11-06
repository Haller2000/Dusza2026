from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MapViewSet, ScoreViewSet, register_user

router = DefaultRouter()
router.register(r'maps', MapViewSet)
router.register(r'scores', ScoreViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', register_user, name='register'),
]