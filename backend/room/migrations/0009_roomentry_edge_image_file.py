from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("room", "0008_shelfdecoration_photographic_kinds")]

    operations = [
        migrations.AddField(
            model_name="roomentry",
            name="edge_image_file",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="room/edge-images/%Y/%m/",
            ),
        ),
    ]
