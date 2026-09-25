from django.conf import settings
from ninja import NinjaAPI
from ninja.errors import HttpError
from ninja.security import APIKeyCookie

from . import auth_views, bookshelf_views, imdb_views, song_views, spotify_views, views
from .auth_views import member_for

api = NinjaAPI(
    title="For Nooshin room API",
    version="1.0.0",
    description="Private room API. Every data endpoint requires an invited Django session.",
    docs_url="/docs" if settings.DEBUG else None,
)


class MemberAuth(APIKeyCookie):
    """Authenticate Django's HttpOnly session cookie and enforce room membership."""

    param_name = "sessionid"

    def __init__(self):
        super().__init__(csrf=True)

    def authenticate(self, request, key):
        if not request.user.is_authenticated:
            raise HttpError(401, "Sign in required.")
        if member_for(request) is None:
            raise HttpError(403, "Room invitation required.")
        return request.user


member_auth = MemberAuth()


@api.get("/health/")
def health(request):
    return views.health(request)


@api.get("/auth/csrf/")
def csrf(request):
    return auth_views.csrf(request)


@api.get("/auth/session/")
def auth_session(request):
    return auth_views.session(request)


@api.post("/auth/login/")
def auth_login(request):
    return auth_views.login_view(request)


@api.post("/auth/logout/")
def auth_logout(request):
    return auth_views.logout_view(request)


@api.post("/auth/password/")
def auth_password(request):
    return auth_views.password(request)


@api.post("/auth/password-reset/")
def auth_password_reset(request):
    return auth_views.password_reset(request)


@api.post("/auth/password-reset/confirm/")
def auth_password_reset_confirm(request):
    return auth_views.password_reset_confirm(request)


@api.get("/room/", auth=member_auth)
def room_snapshot(request):
    return views.room_snapshot(request)


@api.get("/bookshelf/", auth=member_auth)
def bookshelf_snapshot(request):
    return bookshelf_views.snapshot(request)


@api.patch("/bookshelf/", auth=member_auth)
def bookshelf_update(request):
    return bookshelf_views.update(request)


@api.put("/bookshelf/", auth=member_auth)
def bookshelf_put(request):
    return bookshelf_views.update(request)


@api.post("/bookshelf/decorations/", auth=member_auth)
def bookshelf_create_decoration(request):
    return bookshelf_views.create_decoration(request)


@api.get("/media/decorations/{decoration_id}/", auth=member_auth)
def bookshelf_decoration_media(request, decoration_id):
    return bookshelf_views.decoration_media(request, decoration_id)


@api.post("/entries/", auth=member_auth)
def entry_collection(request):
    return views.entry_collection(request)


@api.put("/entries/{entry_id}/", auth=member_auth)
def entry_put(request, entry_id):
    return views.entry_detail(request, entry_id)


@api.patch("/entries/{entry_id}/", auth=member_auth)
def entry_patch(request, entry_id):
    return views.entry_detail(request, entry_id)


@api.delete("/entries/{entry_id}/", auth=member_auth)
def entry_delete(request, entry_id):
    return views.entry_detail(request, entry_id)


@api.get("/media/{media_kind}/{entry_id}/", auth=member_auth)
def entry_media(request, media_kind, entry_id):
    return views.entry_media(request, media_kind, entry_id)


@api.post("/import/spotify/", auth=member_auth)
def import_spotify(request):
    return views.import_spotify(request)


@api.post("/import/imdb/", auth=member_auth)
def import_imdb(request):
    return views.import_imdb(request)


@api.get("/spotify/status/", auth=member_auth)
def spotify_status(request):
    return spotify_views.status(request)


@api.get("/spotify/authorize/", auth=member_auth)
def spotify_authorize(request):
    return spotify_views.authorize(request)


@api.get("/spotify/callback/")
def spotify_callback(request):
    return spotify_views.callback(request)


@api.post("/spotify/disconnect/", auth=member_auth)
def spotify_disconnect(request):
    return spotify_views.disconnect(request)


@api.get("/spotify/liked/", auth=member_auth)
def spotify_liked(request):
    return spotify_views.liked(request)


@api.get("/spotify/listening/", auth=member_auth)
def spotify_listening(request):
    return spotify_views.listening(request)


@api.get("/songs/{entry_id}/download/", auth=member_auth)
def song_download(request, entry_id):
    return song_views.lookup(request, entry_id)


@api.get("/songs/{entry_id}/download/file/", auth=member_auth)
def song_download_file(request, entry_id):
    return song_views.file(request, entry_id)


@api.post("/songs/{entry_id}/upload/", auth=member_auth)
def song_upload(request, entry_id):
    return song_views.upload(request, entry_id)


@api.post("/songs/{entry_id}/upload/remove/", auth=member_auth)
def song_upload_remove(request, entry_id):
    return song_views.remove(request, entry_id)


@api.get("/imdb/status/", auth=member_auth)
def imdb_status(request):
    return imdb_views.status(request)


@api.post("/imdb/connect/", auth=member_auth)
def imdb_connect(request):
    return imdb_views.connect(request)


@api.post("/imdb/refresh/", auth=member_auth)
def imdb_refresh(request):
    return imdb_views.refresh(request)


@api.post("/imdb/disconnect/", auth=member_auth)
def imdb_disconnect(request):
    return imdb_views.disconnect(request)
