from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("room", "0012_roomentry_provider_duration_ms")]

    operations = [
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
                    ("rabbit_hole", "Rabbit hole"),
                    ("movie_night", "Movie night"),
                    ("adventure", "Adventure"),
                    ("lyric", "Lyric"),
                    ("love", "Little love"),
                ],
                max_length=32,
            ),
        ),
    ]
