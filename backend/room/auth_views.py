import json

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.mail import send_mail
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import RoomMember


def body(request):
    try:
        value = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def member_for(request):
    if not request.user.is_authenticated:
        return None
    try:
        return request.user.room_membership
    # pyrefly: ignore [missing-attribute]
    except RoomMember.DoesNotExist:
        return None


def member_json(member):
    return {
        "user_id": str(member.user_id),
        "display_name": member.display_name,
        "role": member.role,
    }


@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_GET
def session(request):
    member = member_for(request)
    if not request.user.is_authenticated or member is None:
        return JsonResponse({"authenticated": False})
    return JsonResponse(
        {
            "authenticated": True,
            "user": {"id": str(request.user.id), "email": request.user.email},
            "member": member_json(member),
        }
    )


@require_POST
@csrf_protect
def login_view(request):
    data = body(request)
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password")
    throttle_key = f"room-login:{request.META.get('REMOTE_ADDR', 'unknown')}"
    attempts = cache.get(throttle_key, 0)
    if attempts >= 10:
        return JsonResponse(
            {"error": "Too many attempts. Please wait a little and try again."}, status=429
        )
    cache.set(throttle_key, attempts + 1, 15 * 60)
    if not email or not isinstance(password, str) or len(password) > 1024:
        return JsonResponse({"error": "That email and password did not open the room."}, status=400)
    user = authenticate(request, username=email, password=password)
    if user is None or not user.is_active:
        return JsonResponse({"error": "That email and password did not open the room."}, status=401)
    try:
        member = user.room_membership
    # pyrefly: ignore [missing-attribute]
    except RoomMember.DoesNotExist:
        return JsonResponse({"error": "That email and password did not open the room."}, status=401)
    login(request, user)
    cache.delete(throttle_key)
    return JsonResponse(
        {
            "authenticated": True,
            "user": {"id": str(user.id), "email": user.email},
            "member": member_json(member),
            "csrfToken": get_token(request),
        }
    )


@require_POST
@csrf_protect
def logout_view(request):
    logout(request)
    return JsonResponse({"authenticated": False})


@require_POST
@csrf_protect
def password(request):
    if not request.user.is_authenticated or member_for(request) is None:
        return JsonResponse({"error": "Sign in required."}, status=401)
    data = body(request)
    form = SetPasswordForm(
        request.user,
        {"new_password1": data.get("password", ""), "new_password2": data.get("confirm", "")},
    )
    if not form.is_valid():
        return JsonResponse({"error": "Choose a password of at least 12 characters."}, status=400)
    form.save()
    return JsonResponse({"ok": True})


@require_POST
@csrf_protect
def password_reset(request):
    data = body(request)
    email = str(data.get("email", "")).strip().lower()
    # Always return the same response so the endpoint does not disclose account existence.
    if email and len(email) <= 320:
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.filter(email__iexact=email, is_active=True).first()
        if user and member_for_user(user):
            token = default_token_generator.make_token(user)
            uid = str(user.pk)
            link = f"{settings.APP_URL}/?password_reset={uid}:{token}"
            send_mail(
                "Your For Nooshin room key",
                f"Open this link to choose a new password:\n\n{link}",
                None,
                [user.email],
                fail_silently=True,
            )
    return JsonResponse({"message": "If that email has an account, a recovery link is on its way."})


def member_for_user(user):
    try:
        return user.room_membership
    # pyrefly: ignore [missing-attribute]
    except RoomMember.DoesNotExist:
        return None


@require_POST
@csrf_protect
def password_reset_confirm(request):
    data = body(request)
    raw = str(data.get("token", ""))
    uid, separator, token = raw.partition(":")
    if not separator or not uid or not token:
        return JsonResponse({"error": "This recovery link is invalid or expired."}, status=400)
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.filter(pk=uid, is_active=True).first()
    if (
        not user
        or not member_for_user(user)
        or not default_token_generator.check_token(user, token)
    ):
        return JsonResponse({"error": "This recovery link is invalid or expired."}, status=400)
    form = SetPasswordForm(
        user, {"new_password1": data.get("password", ""), "new_password2": data.get("confirm", "")}
    )
    if not form.is_valid():
        return JsonResponse({"error": "Choose a password of at least 12 characters."}, status=400)
    form.save()
    login(request, user)
    return JsonResponse({"authenticated": True, "member": member_json(member_for_user(user))})
