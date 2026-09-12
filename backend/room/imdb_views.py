from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from .imdb_service import WatchlistError, normalize_url, status_for
from .imdb_service import refresh as refresh_watchlist
from .views import member_required

ERROR_MESSAGES = {
    "private_or_missing": "IMDb did not return a public Watchlist.",
    "rate_limited": "IMDb is limiting requests. Try again later.",
    "unavailable": "IMDb could not be reached. Your saved films are safe.",
    "response_changed": "IMDb returned an unrecognised list response.",
    "too_large": "This Watchlist is too large to refresh in one visit.",
    "timed_out": "IMDb took too long to return the complete list.",
    "interrupted": "The last IMDb refresh did not finish.",
}


def failure(error):
    return JsonResponse(
        {
            "errorCode": error.code,
            "error": ERROR_MESSAGES.get(error.code, ERROR_MESSAGES["unavailable"]),
        },
        status=502,
    )


@require_GET
@member_required
def status(request):
    return JsonResponse(status_for(request.user))


@require_POST
@csrf_protect
@member_required
def connect(request):
    from .serializers import parse_json_body

    try:
        raw_url = parse_json_body(request).get("url")
        normalize_url(raw_url)
        return JsonResponse(refresh_watchlist(request.user, raw_url))
    except WatchlistError as error:
        return failure(error)


@require_POST
@csrf_protect
@member_required
def refresh(request):
    try:
        return JsonResponse(refresh_watchlist(request.user))
    except WatchlistError as error:
        return failure(error)


@require_POST
@csrf_protect
@member_required
def disconnect(request):
    from .models import ImdbWatchlistConnection

    # pyrefly: ignore [missing-attribute]
    ImdbWatchlistConnection.objects.filter(user=request.user).delete()
    return JsonResponse(status_for(request.user))
