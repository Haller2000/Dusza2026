from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Map, Score
from .serializers import MapSerializer, ScoreSerializer

# 1. Térképek kezelése
class MapViewSet(viewsets.ModelViewSet):
    queryset = Map.objects.all()
    serializer_class = MapSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

# 2. Ranglista / Eredmények kezelése (Itt adjuk hozzá a rendezést!)
class ScoreViewSet(viewsets.ModelViewSet):
    queryset = Score.objects.all().order_by('-gold_count', 'step_count') # Több arany előre (-), azonnal kevesebb lépés (+)
    serializer_class = ScoreSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# 3. Egyszerű regisztrációs végpont
@api_view(['POST'])
def register_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({'error': 'A felhasználónév és jelszó megadása kötelező!'}, status=status.HTTP_400_BAD_REQUEST)
        
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Ez a felhasználónév már foglalt!'}, status=status.HTTP_400_BAD_REQUEST)
        
    User.objects.create_user(username=username, password=password)
    return Response({'message': 'Sikeres regisztráció!'}, status=status.HTTP_201_CREATED)