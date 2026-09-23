from django.db import migrations, models


def remove_rabbit_holes(apps, schema_editor):
    RoomEntry = apps.get_model("room", "RoomEntry")
    RoomEvent = apps.get_model("room", "RoomEvent")
    for entry in RoomEntry.objects.filter(kind="rabbit_hole"):
        for field in ("image_file", "recording_file"):
            attachment = getattr(entry, field)
            if attachment:
                attachment.storage.delete(attachment.name)
    RoomEntry.objects.filter(kind="rabbit_hole").delete()
    RoomEvent.objects.filter(kind="rabbit_hole").delete()


class Migration(migrations.Migration):
    dependencies = [("room", "0013_roomentry_kind_love")]

    operations = [
        migrations.RunPython(remove_rabbit_holes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="roomentry",
            name="kind",
            field=models.CharField(
                choices=[
                    ("book", "Book"),
                    ("music", "Music"),
                    ("wish", "Wish"),
                    ("request", "Request"),
                    ("note", "Note"),
                    ("film", "Film"),
                    ("game", "Game"),
                    ("movie_night", "Movie night"),
                    ("adventure", "Adventure"),
                    ("lyric", "Lyric"),
                    ("love", "Little love"),
                ],
                max_length=32,
            ),
        ),
    ]
