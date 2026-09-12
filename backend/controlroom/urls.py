from django.urls import path

from room.api import api

urlpatterns = [
    path("api/", api.urls),
]
