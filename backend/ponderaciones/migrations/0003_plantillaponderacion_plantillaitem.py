from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('convocatorias', '0001_initial'),
        ('ponderaciones', '0002_alter_ponderacion_unique_together_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlantillaPonderacion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('area', models.CharField(blank=True, max_length=100, null=True)),
                ('question_total', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'convocatoria',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='plantillas_ponderacion',
                        to='convocatorias.convocatoria',
                    ),
                ),
            ],
            options={
                'db_table': 'plantillas_ponderacion',
                'ordering': ['area', 'name'],
            },
        ),
        migrations.AddIndex(
            model_name='plantillaponderacion',
            index=models.Index(fields=['area'], name='plantillas_area_idx'),
        ),
        migrations.AddIndex(
            model_name='plantillaponderacion',
            index=models.Index(fields=['convocatoria', 'area'], name='plantillas_conv_area_idx'),
        ),
        migrations.CreateModel(
            name='PlantillaItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject', models.CharField(max_length=200)),
                ('question_count', models.IntegerField(default=1)),
                ('ponderation', models.DecimalField(decimal_places=3, max_digits=10)),
                ('order', models.IntegerField(default=0)),
                (
                    'plantilla',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='items',
                        to='ponderaciones.plantillaponderacion',
                    ),
                ),
            ],
            options={
                'db_table': 'plantilla_items',
                'ordering': ['order', 'subject'],
            },
        ),
        migrations.AddIndex(
            model_name='plantillaitem',
            index=models.Index(fields=['plantilla', 'order'], name='plantilla_items_order_idx'),
        ),
    ]
