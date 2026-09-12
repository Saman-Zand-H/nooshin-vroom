from django.db import migrations


def delete_edge_images(apps, schema_editor):
    RoomEntry = apps.get_model("room", "RoomEntry")
    for entry in RoomEntry.objects.exclude(edge_image_file=""):
        if entry.edge_image_file:
            entry.edge_image_file.delete(save=False)


class Migration(migrations.Migration):
    dependencies = [("room", "0009_roomentry_edge_image_file")]

    operations = [
        migrations.RunPython(delete_edge_images, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="roomentry",
            name="edge_image_file",
        ),
    ]
