from django.db import migrations

BOOK_HOMES = {
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
DECORATIONS = [
    ("bust", "Marble bust", 0, 2),
    ("bust", "Doll couple", 1, 2),
    ("vase", "Ceramic vase", 6, 1),
    ("vase", "Tea set", 9, 1),
    ("globe", "Crystal globe", 7, 1),
    ("plant", "Rose vase", 8, 1),
    ("plant", "Rose keepsake", 11, 1),
    ("candle", "Tea candles", 11, 3),
    ("postcard", "Moon print", 2, 1),
    ("postcard", "Keepsake boxes", 10, 1),
    ("ticket", "Music box", 5, 1),
    ("ticket", "Instrument case", 3, 1),
]


def refresh_shelf(apps, schema_editor):
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
    for title, (cubby, position, orientation, stack) in BOOK_HOMES.items():
        entry = RoomEntry.objects.filter(kind="book", title=title).first()
        if entry is None:
            continue
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
    ShelfLayout.objects.get_or_create(pk=1)
    for index, (kind, label, cubby, position) in enumerate(DECORATIONS):
        decoration = ShelfDecoration.objects.filter(kind=kind).order_by("created_at").first()
        if index and decoration and ShelfDecoration.objects.filter(kind=kind, label=label).exists():
            continue
        if index and decoration:
            decoration = None
        if decoration is None:
            ShelfDecoration.objects.create(
                kind=kind, label=label, cubby=cubby, position=position, created_by=owner
            )
        else:
            decoration.label = label
            decoration.cubby = cubby
            decoration.position = position
            decoration.save(update_fields=["label", "cubby", "position"])


class Migration(migrations.Migration):
    dependencies = [("room", "0004_physical_bookshelf_seed")]
    operations = [migrations.RunPython(refresh_shelf, migrations.RunPython.noop)]
