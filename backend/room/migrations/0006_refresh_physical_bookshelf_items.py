from importlib import import_module

from django.db import migrations


def refresh(apps, schema_editor):
    import_module("room.migrations.0005_refresh_physical_bookshelf").refresh_shelf(
        apps, schema_editor
    )


class Migration(migrations.Migration):
    dependencies = [("room", "0005_refresh_physical_bookshelf")]
    operations = [migrations.RunPython(refresh, migrations.RunPython.noop)]
