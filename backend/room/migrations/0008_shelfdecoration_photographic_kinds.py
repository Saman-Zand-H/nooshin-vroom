from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("room", "0007_shelflayout_fixture_version")]

    operations = [
        migrations.AlterField(
            model_name="shelfdecoration",
            name="kind",
            field=models.CharField(
                max_length=20,
                choices=[
                    ("mug", "Engineer mug"),
                    ("pinecones", "Pinecones"),
                    ("dolls", "Doll couple"),
                    ("headphones", "Headphones"),
                    ("stationery", "Stationery"),
                    ("eggs", "Painted eggs"),
                    ("roses", "Rose vase"),
                    ("speaker", "Speaker"),
                    ("tea-set", "Tea set"),
                    ("keepsakes", "Keepsakes"),
                    ("notebooks", "Notebooks"),
                    ("binders", "Tall binders"),
                    ("paperback-stack", "Paperback stack"),
                    ("bust", "Bust"),
                    ("vase", "Vase"),
                    ("globe", "Globe"),
                    ("plant", "Plant"),
                    ("candle", "Candle"),
                    ("postcard", "Postcard"),
                    ("ticket", "Ticket"),
                    ("custom", "Custom"),
                ],
            ),
        )
    ]
