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
