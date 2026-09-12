from django.contrib.auth import get_user_model


class EmailBackend:
    """Authenticate the provisioned Django user by email address."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not isinstance(password, str):
            return None
        user = get_user_model().objects.filter(email__iexact=username).first()
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

    def get_user(self, user_id):
        try:
            return get_user_model().objects.get(pk=user_id)
        except get_user_model().DoesNotExist:
            return None

    @staticmethod
    def user_can_authenticate(user):
        return getattr(user, "is_active", True)
