from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('convocatorias', '0001_initial'),
        ('ponderaciones', '0004_remove_convocatoria_fk'),
        ('resultados', '0005_remove_convocatoria_fk'),
    ]

    operations = [
        migrations.AlterUniqueTogether(name='area', unique_together=set()),
        migrations.AlterModelOptions(
            name='area',
            options={'db_table': 'areas', 'ordering': ['order', 'name']},
        ),
        migrations.RemoveField(
            model_name='area',
            name='convocatoria',
        ),
        migrations.AlterField(
            model_name='area',
            name='name',
            field=models.CharField(max_length=100, unique=True),
        ),
        migrations.DeleteModel(name='CalificationConfig'),
        migrations.RemoveField(
            model_name='datformatconfig',
            name='convocatoria',
        ),
        migrations.DeleteModel(name='Convocatoria'),
    ]
