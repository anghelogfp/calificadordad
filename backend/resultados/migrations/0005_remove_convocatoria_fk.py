from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('resultados', '0004_add_verificador_extra_fields'),
        ('convocatorias', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='procesocalificacion',
            name='convocatoria',
        ),
    ]
