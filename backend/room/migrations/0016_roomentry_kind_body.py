from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("room", "0015_roomentry_kind_cycle")]

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
                    ("movie_night", "Movie night"),
                    ("adventure", "Adventure"),
                    ("lyric", "Lyric"),
                    ("love", "Little love"),
                    ("cycle", "Moon days"),
                    ("body", "Weigh-in"),
                ],
                max_length=32,
            ),
        ),
    ]
