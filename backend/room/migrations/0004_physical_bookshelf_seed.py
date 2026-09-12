from django.db import migrations

BOOKS = [
    ("Six of Crows", "Leigh Bardugo", "Finished", 100),
    ("Rock Paper Scissors", "Alice Feeney", "Finished", 100),
    ("کوری", "ژوزه ساراماگو", "Finished", 100),
    ("بیمار خاموش", "الکس مایکلایدس", "Want to read", 0),
    ("زنی در کابین ۱۰", "روث ور", "Want to read", 0),
    ("دروغگو بودیم", "ای. لاکهارت", "Want to read", 0),
    ("هر دو در نهایت می‌میرند", "آدام سیلورا", "Want to read", 0),
    ("راز بین دو نفر", "کلر مکینتاش", "Want to read", 0),
    ("در ژرفای آب", "پائولا هاوکینز", "Want to read", 0),
    ("ساعت قصه‌گویی", "سالی پیج", "Want to read", 0),
]


def seed_physical_shelf(apps, schema_editor):
    User = apps.get_model("auth", "User")
    RoomEntry = apps.get_model("room", "RoomEntry")
    ShelfLayout = apps.get_model("room", "ShelfLayout")
    ShelfDecoration = apps.get_model("room", "ShelfDecoration")
    owner = (
        User.objects.filter(room_membership__role="owner").first()
        or User.objects.order_by("id").first()
    )
    if owner is None:
        return

    for title, creator, status, progress in BOOKS:
        RoomEntry.objects.get_or_create(
            kind="book",
            title=title,
            defaults={
                "creator": creator,
                "note": "A book that belongs on her shelf.",
                "status": status,
                "progress": progress,
                "rating": 0,
                "format": "Book",
                "link": "",
                "image_url": None,
                "source_id": None,
                "created_by": owner,
            },
        )

    # Cubby order follows the supplied photos: two wide bays at the top,
    # narrower book bays through the middle, then the display and storage bays.
    # Keep the two relationship books together in the upper-left bay.
    homes = {
        "Six of Crows": (0, 0, "vertical", ""),
        "Rock Paper Scissors": (0, 1, "vertical", ""),
        "کوری": (2, 0, "vertical", ""),
        "بیمار خاموش": (2, 1, "vertical", ""),
        "زنی در کابین ۱۰": (3, 0, "vertical", ""),
        "دروغگو بودیم": (4, 0, "horizontal", "stack-4-0"),
        "هر دو در نهایت می‌میرند": (4, 1, "horizontal", "stack-4-0"),
        "راز بین دو نفر": (5, 0, "vertical", ""),
        "در ژرفای آب": (7, 0, "vertical", ""),
        "ساعت قصه‌گویی": (8, 0, "vertical", ""),
    }
    entries = list(RoomEntry.objects.filter(kind="book").order_by("created_at", "id"))
    used = set()
    for entry in entries:
        home = homes.get(entry.title)
        if home is None:
            # New books get a quiet lower bay while retaining their existing
            # position if a person has already arranged them.
            if entry.shelf_cubby != 0 or entry.shelf_position != 0:
                continue
            home = (10 + (len(used) % 4), 0, "vertical", "")
        cubby, position, orientation, stack = home
        if entry.shelf_cubby == 0 and entry.shelf_position == 0 or entry.title in homes:
            entry.shelf_cubby = cubby
            entry.shelf_position = position
            entry.shelf_orientation = orientation
            entry.shelf_stack = stack
            entry.save(
                update_fields=[
                    "shelf_cubby",
                    "shelf_position",
                    "shelf_orientation",
                    "shelf_stack",
                ]
            )
        used.add(entry.title)

    ShelfLayout.objects.get_or_create(pk=1)
    decorations = [
        ("bust", "Marble bust", 0, 3),
        ("vase", "Ceramic vase", 1, 2),
        ("globe", "Small globe", 2, 2),
        ("plant", "Juniper bonsai", 4, 2),
        ("postcard", "Postcard", 7, 1),
        ("ticket", "Theatre ticket", 10, 1),
    ]
    for kind, label, cubby, position in decorations:
        ShelfDecoration.objects.get_or_create(
            kind=kind,
            cubby=cubby,
            position=position,
            defaults={"label": label, "created_by": owner},
        )


class Migration(migrations.Migration):
    dependencies = [("room", "0003_shelflayout_shelfdecoration")]

    operations = [migrations.RunPython(seed_physical_shelf, migrations.RunPython.noop)]
