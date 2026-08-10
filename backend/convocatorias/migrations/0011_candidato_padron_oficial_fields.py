from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('convocatorias', '0010_datformatconfig_response_answers_offset'),
    ]

    operations = [
        migrations.AddField(model_name='candidato', name='codigo_modalidad', field=models.CharField(blank=True, max_length=20)),
        migrations.AddField(model_name='candidato', name='codigo_modular', field=models.CharField(blank=True, max_length=20)),
        migrations.AddField(model_name='candidato', name='codigo_programa', field=models.CharField(blank=True, max_length=20)),
        migrations.AddField(model_name='candidato', name='departamento_colegio', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='candidato', name='departamento_residencia', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='candidato', name='distrito_colegio', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='candidato', name='distrito_residencia', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='candidato', name='edad', field=models.PositiveSmallIntegerField(blank=True, null=True)),
        migrations.AddField(model_name='candidato', name='egreso', field=models.CharField(blank=True, max_length=10)),
        migrations.AddField(model_name='candidato', name='fecha_inscripcion', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='candidato', name='fecha_nacimiento', field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name='candidato', name='modalidad', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='candidato', name='provincia_colegio', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='candidato', name='provincia_residencia', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='candidato', name='sexo', field=models.CharField(blank=True, max_length=10)),
        migrations.AddField(model_name='candidato', name='ubigeo_colegio', field=models.CharField(blank=True, max_length=20)),
        migrations.AddField(model_name='candidato', name='ubigeo_residencia', field=models.CharField(blank=True, max_length=20)),
    ]
