from django.conf import settings
from django.http import HttpResponse


class FrontendCorsMiddleware:
    """Allow only the configured frontend origins to use session API calls."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        # pyrefly: ignore [not-iterable]
        if request.method == "OPTIONS" and origin in settings.FRONTEND_ORIGINS:
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)
        # pyrefly: ignore [not-iterable]
        if origin in settings.FRONTEND_ORIGINS:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Headers"] = (
                "Content-Type, X-CSRFToken, X-Entry-Version, X-Spotify-Host"
            )
            response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
            response["Vary"] = "Origin"
        return response


class PrivateApiCacheMiddleware:
    """Keep every API response out of shared caches.

    The CDN in front of the site stores responses that carry no Cache-Control
    header and ignores Vary: Cookie, so it served the room snapshot to signed-out
    visitors and handed members a stale room right after they saved.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/"):
            response.setdefault("Cache-Control", "private, no-store")
        return response
