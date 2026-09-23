from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from .auth_views import member_for
from .models import SpotifyAccount
from .spotify_service import (
    SpotifyProviderError,
    authorize_url,
    configuration_issues,
    finish_callback,
    is_configured,
    redirect_uri_for_host,
    redirect_uris,
    saved_song,
    spotify,
    track,
)
from .views import member_required


def provider_error(error):
    return JsonResponse(
        {"error": "Spotify is temporarily unavailable."},
        status=error.status if error.status in {400, 401, 409, 429, 503} else 502,
    )


@require_GET
@member_required
def status(request):
    # pyrefly: ignore [missing-attribute]
    account = SpotifyAccount.objects.filter(user=request.user).first()
    member = member_for(request)
    issues = configuration_issues()
    setup = (
        {"setupIssues": issues, "redirectUris": redirect_uris()}
        if member and member.role == "owner"
        else {}
    )
    return JsonResponse(
        {
            "configured": not issues,
            "connected": bool(account),
            **setup,
            **({"name": account.display_name} if account and account.display_name else {}),
        }
    )


@require_GET
@member_required
def authorize(request):
    try:
        browser_host = (
            request.headers.get("X-Spotify-Host") or request.GET.get("host") or request.get_host()
        )
        return JsonResponse(
            {"url": authorize_url(request.user, redirect_uri_for_host(browser_host))}
        )
    except SpotifyProviderError as error:
        return provider_error(error)


@require_GET
def callback(request):
    state = request.GET.get("state", "")
    code = request.GET.get("code", "")
    try:
        if not state or not code or not is_configured():
            raise SpotifyProviderError(400)
        finish_callback(state, code)
        destination = f"{settings.APP_URL}/connections?spotify=connected"
        return HttpResponse(
            f"<script>location.replace({destination!r})</script>"
            "<p>Spotify is connected. You can close this tab.</p>",
            content_type="text/html",
        )
    except SpotifyProviderError:
        return HttpResponse(
            "<p>Spotify could not be connected. Close this tab and try again.</p>",
            status=400,
            content_type="text/html",
        )


@require_POST
@csrf_protect
@member_required
def disconnect(request):
    # pyrefly: ignore [missing-attribute]
    SpotifyAccount.objects.filter(user=request.user).delete()
    return JsonResponse({"configured": is_configured(), "connected": False})


@require_GET
@member_required
def liked(request):
    try:
        offset = int(request.GET.get("offset", "0"))
        if offset < 0 or offset > 50_000:
            return JsonResponse({"error": "Invalid Spotify page."}, status=400)
        page = spotify(f"me/tracks?limit=50&offset={offset}", request.user)
        # pyrefly: ignore [missing-attribute]
        total = int(page.get("total", -1))
        # pyrefly: ignore [missing-attribute]
        items = page.get("items")
        if total < 0 or total > 50_000 or not isinstance(items, list) or len(items) > 50:
            raise SpotifyProviderError(502)
        songs = [saved_song(item) for item in items]
        if any(song is None for song in songs):
            raise SpotifyProviderError(502)
        # pyrefly: ignore [missing-attribute]
        next_offset = offset + len(items) if page.get("next") else None
        # pyrefly: ignore [missing-attribute, unsupported-operation]
        if page.get("next") and (not items or next_offset > total):
            raise SpotifyProviderError(502)
        return JsonResponse(
            {"songs": songs, "offset": offset, "total": total, "nextOffset": next_offset}
        )
    except (ValueError, SpotifyProviderError) as error:
        return provider_error(
            error if isinstance(error, SpotifyProviderError) else SpotifyProviderError(400)
        )


@require_GET
@member_required
def listening(request):
    try:
        current = spotify("me/player/currently-playing", request.user)
        # Fifty is Spotify's maximum page for recently played; the stats page
        # counts the room member's real rotation from it.
        recent = spotify("me/player/recently-played?limit=50", request.user)
        liked_page = spotify("me/tracks?limit=10", request.user)
        playlists = spotify("me/playlists?limit=10", request.user)
        return JsonResponse(
            {
                "current": track(current.get("item"))
                if current and current.get("is_playing")
                else None,
                "recent": [
                    song
                    for song in (
                        track(item.get("track")) for item in (recent or {}).get("items", [])
                    )
                    if song
                ],
                "liked": [
                    song
                    for song in (
                        track(item.get("track") or item.get("item"))
                        for item in (liked_page or {}).get("items", [])
                    )
                    if song
                ],
                "playlists": [
                    {
                        "id": item.get("id"),
                        "title": str(item.get("name", ""))[:240],
                        "url": item.get("external_urls", {}).get("spotify"),
                        "image": (item.get("images") or [{}])[0].get("url"),
                    }
                    for item in (playlists or {}).get("items", [])
                    if item.get("external_urls", {}).get("spotify")
                ],
            }
        )
    except SpotifyProviderError as error:
        return provider_error(error)
