from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MapViewSet, ScoreViewSet, register_user, login_user, user_profile, change_password

router = DefaultRouter()
router.register(r'maps', MapViewSet, basename='map')
router.register(r'scores', ScoreViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', register_user, name='register'),
    path('login/', login_user, name='login'), # EZT ADD HOZZÁ
    path('profile/', user_profile, name='profile'),
    path('change-password/', change_password, name='change-password'),
]