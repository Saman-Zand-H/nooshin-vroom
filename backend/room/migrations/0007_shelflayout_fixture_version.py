from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("room", "0006_refresh_physical_bookshelf_items"),
    ]

    operations = [
        migrations.AddField(
            model_name="shelflayout",
            name="fixture_version",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
