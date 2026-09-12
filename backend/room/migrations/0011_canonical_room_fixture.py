from importlib import import_module

from django.db import migrations


def apply_fixture(apps, schema_editor):
    User = apps.get_model("auth", "User")
    owner = User.objects.filter(room_membership__role="owner").first()
    if owner is None:
        owner = User.objects.order_by("id").first()
    if owner is None:
        return
    import_module("room.bookshelf_fixture").apply_room_fixture(owner=owner, apps=apps)


class Migration(migrations.Migration):
    dependencies = [("room", "0010_remove_roomentry_edge_image_file")]
    operations = [migrations.RunPython(apply_fixture, migrations.RunPython.noop)]
