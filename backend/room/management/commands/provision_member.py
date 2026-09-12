from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from room.models import RoomMember


class Command(BaseCommand):
    help = "Provision one of the two invited room members."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--display-name", required=True)
        parser.add_argument("--slot", type=int, choices=(1, 2), required=True)
        parser.add_argument("--role", choices=("owner", "member"), default="member")
        parser.add_argument(
            "--password", help="Optional initial password; omit to require password reset."
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        if not email or "@" not in email:
            raise CommandError("Use a valid email address.")
        User = get_user_model()
        # pyrefly: ignore [bad-context-manager]
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            created = user is None
            if created:
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    is_active=True,
                )
            if not created:
                user.email = email
                user.is_active = True
            password = options.get("password")
            if password:
                user.set_password(password)
            elif created:
                user.set_unusable_password()
            user.save()
            # pyrefly: ignore [missing-attribute]
            member, membership_created = RoomMember.objects.get_or_create(
                user=user,
                defaults={
                    "display_name": options["display_name"].strip(),
                    "slot": options["slot"],
                    "role": options["role"],
                },
            )
            if not membership_created:
                if (
                    member.slot != options["slot"]
                    and RoomMember.objects.filter(slot=options["slot"]).exclude(user=user).exists()  # pyrefly: ignore [missing-attribute]
                ):
                    raise CommandError("That room slot already belongs to the other member.")
                member.display_name = options["display_name"].strip()
                member.slot = options["slot"]
                member.role = options["role"]
                member.save()
        # pyrefly: ignore [missing-attribute]
        self.stdout.write(self.style.SUCCESS(f"Provisioned slot {options['slot']} for {email}."))
