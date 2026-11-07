from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MapViewSet,
    ScoreViewSet,
    change_password,
    leaderboard,
    login_user,
    register_user,
    save_ending,
    user_profile,
    user_statistics,
)

router = DefaultRouter()
router.register(r'maps', MapViewSet, basename='map')
router.register(r'scores', ScoreViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', register_user, name='register'),
    path('login/', login_user, name='login'),
    path('profile/', user_profile, name='profile'),
    path('change-password/', change_password, name='change-password'),
    path('statistics/', user_statistics, name='statistics'),
    path('leaderboard/', leaderboard, name='leaderboard'),
    path('save-ending/', save_ending, name='save-ending'),  # <--- ÚJ: A végpont beregisztrálása

]