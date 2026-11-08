from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, F, Max, OuterRef, Q, Subquery, Sum
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User

from .script_service import Interpreter
from .models import Map, Score, Script, UserProfile
from .serializers import MapSerializer, ScoreSerializer, ScriptSerializer


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

    def save_map(self, save):
        try:
            with transaction.atomic():
                save()
        except IntegrityError as error:
            error_text = str(error)
            if (
                'unique_user_map_name' in error_text
                or 'api_map.created_by_id, api_map.name' in error_text
            ):
                raise ValidationError({
                    'name': ['Nem menthető a pálya, mert már van saját pályád ugyanezzel a névvel.']
                }) from error
            raise

    def perform_create(self, serializer):
        self.save_map(lambda: serializer.save(created_by=self.request.user))

    def perform_update(self, serializer):
        self.save_map(serializer.save)

# 2. Ranglista / Eredmények kezelése (Itt adjuk hozzá a rendezést!)
class ScoreViewSet(viewsets.ModelViewSet):
    queryset = Score.objects.all().order_by('-points', '-gold_count', 'step_count')
    serializer_class = ScoreSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ScriptViewSet(viewsets.ModelViewSet):
    serializer_class = ScriptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Script.objects.filter(created_by=self.request.user).order_by('name', 'id')

    def save_script(self, save):
        try:
            with transaction.atomic():
                save()
        except IntegrityError as error:
            error_text = str(error)
            if (
                'unique_user_script_name' in error_text
                or 'api_script.created_by_id, api_script.name' in error_text
            ):
                raise ValidationError({
                    'name': ['Már van mentett scripted ugyanezzel a névvel.']
                }) from error
            raise

    def perform_create(self, serializer):
        self.save_script(lambda: serializer.save(created_by=self.request.user))

    def perform_update(self, serializer):
        self.save_script(serializer.save)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def leaderboard(request):
    map_id = request.query_params.get('map')
    selected_map = None

    if map_id:
        try:
            selected_map = Map.objects.get(pk=int(map_id), is_builtin=True)
        except (Map.DoesNotExist, TypeError, ValueError):
            return Response(
                {'detail': 'A kiválasztott sablonpálya nem található.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    best_scores = Score.objects.filter(user=OuterRef('user'))
    scores = Score.objects.select_related('user', 'map')
    if selected_map:
        best_scores = best_scores.filter(map=selected_map)
        scores = scores.filter(map=selected_map)

    best_score_ids = best_scores.order_by(
        '-points',
        '-gold_count',
        'step_count',
        '-created_at',
        '-id',
    ).values('id')[:1]
    results = scores.annotate(best_score_id=Subquery(best_score_ids)).filter(
        id=F('best_score_id')
    ).order_by('-points', '-gold_count', 'step_count', '-created_at', '-id')

    return Response({
        'maps': list(
            Map.objects.filter(is_builtin=True)
            .order_by('name')
            .values('id', 'name')
        ),
        'results': ScoreSerializer(results, many=True).data,
    })


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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_statistics(request):
    user_scores = Score.objects.filter(user=request.user)
    totals = user_scores.aggregate(
        games_played=Count('id'),
        total_gold=Sum('gold_count'),
        total_steps=Sum('step_count'),
        total_points=Sum('points'),
        average_points=Avg('points'),
        best_points=Max('points'),
        best_gold=Max('gold_count'),
    )
    recent_games = user_scores.select_related('map').order_by('-created_at', '-id')[:5]

    return Response({
        'games_played': totals['games_played'],
        'total_gold': totals['total_gold'] or 0,
        'total_steps': totals['total_steps'] or 0,
        'total_points': totals['total_points'] or 0,
        'average_points': totals['average_points'] or 0,
        'best_points': totals['best_points'] or 0,
        'best_gold': totals['best_gold'] or 0,
        'recent_games': [
            {
                'id': score.id,
                'map_name': score.map.name,
                'map_snapshot': score.map_snapshot,
                'points': score.points,
                'gold_count': score.gold_count,
                'step_count': score.step_count,
                'created_at': score.created_at,
            }
            for score in recent_games
        ],
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])  # Csak bejelentkezve menthető!
def save_ending(request):
    
    map_id = request.data.get('map_id')
    gold = request.data.get('gold', 0)
    steps = request.data.get('steps', 0)
    history = request.data.get('history', [])
    script_text = request.data.get('script', '')
    console_output = request.data.get('console', [])
    script_id = request.data.get('script_id')

    if not map_id:
        return Response({"error": "Hiányzó térkép ID."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        map_obj = Map.objects.get(pk=map_id)
        script = None
        if script_id:
            script = Script.objects.filter(pk=script_id, created_by=request.user).first()
            if script is None:
                return Response(
                    {"error": "A megadott script nem található."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        
        score = Score.objects.create(
            user=request.user,
            map=map_obj,
            gold_count=gold,
            step_count=steps,
            steps=history,
            script=script,
            map_complete="\n".join(console_output),
            map_snapshot={
                "map_data": map_obj.map_data,
                "width": map_obj.width,
                "height": map_obj.height,
            }
        )
        if script is None and script_text:
            script = Script.objects.create(
                name=request.data.get('script_name') or f'Futtatott script {score.id}',
                code=script_text,
                created_by=request.user,
            )
            score.script = script
            score.save(update_fields=['script'])
        
        return Response({
            "status": "success",
            "message": "Eredmény sikeresen elmentve!",
            "score_id": score.id,
            "points": float(score.points),
            "gold": score.gold_count,
            "steps": score.step_count
        }, status=status.HTTP_201_CREATED)

    except Map.DoesNotExist:
        return Response({"error": "A megadott térkép nem található."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)