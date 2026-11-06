from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from .models import Map, Score, UserProfile
from .serializers import MapSerializer, ScoreSerializer


class MapPermissions(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return obj.is_builtin or obj.created_by_id == request.user.id
        return not obj.is_builtin and obj.created_by_id == request.user.id


# 1. Térképek kezelése
class MapViewSet(viewsets.ModelViewSet):
    serializer_class = MapSerializer
    permission_classes = [MapPermissions]

    def get_queryset(self):
        return Map.objects.filter(Q(is_builtin=True) | Q(created_by=self.request.user))

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

# 2. Ranglista / Eredmények kezelése (Itt adjuk hozzá a rendezést!)
class ScoreViewSet(viewsets.ModelViewSet):
    queryset = Score.objects.all().order_by('-gold_count', 'step_count') # Több arany előre (-), kevesebb lépés (+)
    serializer_class = ScoreSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
# 3. Egyszerű regisztrációs végpont
@api_view(['POST'])
def register_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    raw_avatar_id = request.data.get('avatar_id', 1)

    try:
        avatar_id = int(raw_avatar_id)
    except (TypeError, ValueError):
        return Response({'error': 'Érvénytelen avatár.'}, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(raw_avatar_id, bool) or not 1 <= avatar_id <= 20:
        return Response({'error': 'Az avatár azonosítójának 1 és 20 közé kell esnie.'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not username or not password:
        return Response({'error': 'A felhasználónév és jelszó megadása kötelező!'}, status=status.HTTP_400_BAD_REQUEST)
        
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Ez a felhasználónév már foglalt!'}, status=status.HTTP_400_BAD_REQUEST)
        
    user = User.objects.create_user(username=username, password=password)
    profile = UserProfile.objects.create(user=user, avatar_id=avatar_id)
    token = Token.objects.create(user=user) # Létrehozzuk a tokent regisztrációnál is
    
    return Response({
        'token': token.key,
        'username': user.username,
        'avatar_id': profile.avatar_id,
        'message': 'Sikeres regisztráció!'
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def login_user(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'A felhasználónév és a jelszó megadása kötelező!'}, status=status.HTTP_400_BAD_REQUEST)

    # Felhasználó hitelesítése a Django beépített authenticate függvényével
    user = authenticate(username=username, password=password)

    if user is not None:
        # Ha létezik a user és helyes a jelszó, generálunk vagy lekérjük a tokenjét
        profile, _ = UserProfile.objects.get_or_create(user=user)
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'username': user.username,
            'avatar_id': profile.avatar_id,
            'message': 'Sikeres bejelentkezés!'
        }, status=status.HTTP_200_STATUS_OK if hasattr(status, 'HTTP_200_STATUS_OK') else status.HTTP_200_OK)
    else:
        return Response({'error': 'Hibás felhasználónév vagy jelszó!'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def user_profile(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    if request.method == 'PATCH':
        raw_avatar_id = request.data.get('avatar_id')
        try:
            avatar_id = int(raw_avatar_id)
        except (TypeError, ValueError):
            return Response({'error': 'Érvénytelen avatár.'}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(raw_avatar_id, bool) or not 1 <= avatar_id <= 20:
            return Response({'error': 'Az avatár azonosítójának 1 és 20 közé kell esnie.'}, status=status.HTTP_400_BAD_REQUEST)

        profile.avatar_id = avatar_id
        profile.save(update_fields=['avatar_id'])

    return Response({
        'username': request.user.username,
        'avatar_id': profile.avatar_id,
        'date_joined': request.user.date_joined,
    })

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not old_password or not new_password or not confirm_password:
        return Response({'error': 'Minden jelszómező kitöltése kötelező.'}, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.check_password(old_password):
        return Response({'error': 'A jelenlegi jelszó hibás.'}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        return Response({'error': 'Az új jelszavak nem egyeznek.'}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])
    return Response({'message': 'A jelszó sikeresen megváltozott.'})