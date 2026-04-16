from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response(
            {'detail': 'Usuario y contraseña requeridos.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'detail': 'Credenciales incorrectas.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.check_password(password):
        return Response(
            {'detail': 'Credenciales incorrectas.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {'detail': 'Cuenta desactivada.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_staff': user.is_staff,
        },
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    refresh_str = request.data.get('refresh', '')
    if not refresh_str:
        return Response(
            {'detail': 'Token de refresco requerido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        refresh = RefreshToken(refresh_str)
        return Response({'access': str(refresh.access_token)})
    except Exception:
        return Response(
            {'detail': 'Token inválido o expirado.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    # Con JWT stateless el logout es del lado del cliente (borrar tokens).
    # Este endpoint existe para que el frontend tenga un punto de cierre formal.
    return Response({'detail': 'Sesión cerrada.'})


def _serialize_user(user):
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'is_active': user.is_active,
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def usuarios_list(request):
    if request.method == 'GET':
        users = User.objects.all().order_by('username')
        return Response([_serialize_user(u) for u in users])

    # POST — crear usuario
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    email = request.data.get('email', '').strip()
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    is_staff = bool(request.data.get('is_staff', False))

    if not username or not password:
        return Response(
            {'detail': 'Usuario y contraseña son obligatorios.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {'detail': 'El nombre de usuario ya existe.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=username,
        password=password,
        email=email,
        first_name=first_name,
        last_name=last_name,
        is_staff=is_staff,
    )
    return Response(_serialize_user(user), status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def usuario_detail(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    # No permitir editar al superusuario desde este endpoint
    if user.is_superuser and not request.user.is_superuser:
        return Response({'detail': 'No tienes permiso para editar este usuario.'}, status=status.HTTP_403_FORBIDDEN)

    for field in ('email', 'first_name', 'last_name'):
        if field in request.data:
            setattr(user, field, request.data[field].strip())

    if 'is_staff' in request.data:
        user.is_staff = bool(request.data['is_staff'])

    if 'is_active' in request.data:
        user.is_active = bool(request.data['is_active'])

    if 'username' in request.data:
        new_username = request.data['username'].strip()
        if new_username and new_username != user.username:
            if User.objects.filter(username=new_username).exclude(pk=pk).exists():
                return Response({'detail': 'El nombre de usuario ya existe.'}, status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username

    user.save()
    return Response(_serialize_user(user))


@api_view(['POST'])
@permission_classes([IsAdminUser])
def usuario_set_password(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    password = request.data.get('password', '')
    if not password:
        return Response({'detail': 'La contraseña no puede estar vacía.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.save()
    return Response({'detail': 'Contraseña actualizada correctamente.'})
