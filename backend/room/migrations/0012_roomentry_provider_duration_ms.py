from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("room", "0011_canonical_room_fixture")]

    operations = [
        migrations.AddField(
            model_name="roomentry",
            name="provider_duration_ms",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
