from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("room", "0016_roomentry_kind_body"),
    ]

    operations = [
        migrations.AddField(
            model_name="roomentry",
            name="song_file",
            field=models.FileField(blank=True, null=True, upload_to="room/songs/%Y/%m/"),
        ),
    ]
