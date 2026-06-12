from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ponderaciones', '0003_plantillaponderacion_plantillaitem'),
        ('convocatorias', '0001_initial'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='ponderacion',
            unique_together=set(),
        ),
        migrations.RemoveField(
            model_name='ponderacion',
            name='convocatoria',
        ),
        migrations.AlterUniqueTogether(
            name='ponderacion',
            unique_together={('area', 'subject')},
        ),
        migrations.RemoveIndex(
            model_name='plantillaponderacion',
            name='plantillas_conv_area_idx',
        ),
        migrations.RemoveField(
            model_name='plantillaponderacion',
            name='convocatoria',
        ),
    ]
