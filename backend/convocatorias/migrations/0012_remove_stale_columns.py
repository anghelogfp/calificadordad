"""Remove stale area/proceso_id columns not present in current models."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('convocatorias', '0011_candidato_padron_oficial_fields'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                # ── Drop indexes that reference proceso_id or area ───────────────

                # identifier_sources
                "DROP INDEX IF EXISTS identifier_sources_proceso_id_client_id_0f316743_uniq;",
                "DROP INDEX IF EXISTS identifier_sources_proceso_id_68d90650;",

                # response_sources
                "DROP INDEX IF EXISTS response_sources_proceso_id_client_id_2e40eb49_uniq;",
                "DROP INDEX IF EXISTS response_sources_proceso_id_5512d6d6;",

                # answer_key_sources
                "DROP INDEX IF EXISTS answer_key_sources_proceso_id_client_id_12050942_uniq;",
                "DROP INDEX IF EXISTS answer_key_sources_proceso_id_935a78e9;",

                # candidatos_padron
                "DROP INDEX IF EXISTS candidatos_padron_proceso_id_client_id_5d69da60_uniq;",
                "DROP INDEX IF EXISTS candidatos_padron_proceso_id_7a2b8fd3;",
                "DROP INDEX IF EXISTS candidatos__proceso_bc2c1d_idx;",
                "DROP INDEX IF EXISTS candidatos__proceso_586e04_idx;",
                "DROP INDEX IF EXISTS candidatos__proceso_c3b169_idx;",

                # identifier_rows
                "DROP INDEX IF EXISTS identifier_rows_proceso_id_client_id_515f2abc_uniq;",
                "DROP INDEX IF EXISTS identifier_rows_proceso_id_a1c72cf4;",
                "DROP INDEX IF EXISTS identifier__proceso_4f20f5_idx;",
                "DROP INDEX IF EXISTS identifier__proceso_1b35fa_idx;",
                "DROP INDEX IF EXISTS identifier__proceso_beb338_idx;",
                "DROP INDEX IF EXISTS identifier__proceso_cbaee1_idx;",
                "DROP INDEX IF EXISTS identifier__proceso_31f5a4_idx;",
                "DROP INDEX IF EXISTS identifier__proceso_d59622_idx;",

                # response_rows
                "DROP INDEX IF EXISTS response_rows_proceso_id_client_id_f8758174_uniq;",
                "DROP INDEX IF EXISTS response_rows_proceso_id_4b72170c;",
                "DROP INDEX IF EXISTS response_ro_proceso_802956_idx;",
                "DROP INDEX IF EXISTS response_ro_proceso_69a841_idx;",
                "DROP INDEX IF EXISTS response_ro_proceso_bfe43f_idx;",
                "DROP INDEX IF EXISTS response_ro_proceso_ed96b2_idx;",

                # answer_key_rows
                "DROP INDEX IF EXISTS answer_key_rows_proceso_id_client_id_b551dd22_uniq;",
                "DROP INDEX IF EXISTS answer_key_rows_proceso_id_c80a5e9f;",
                "DROP INDEX IF EXISTS answer_key__proceso_8ff567_idx;",
                "DROP INDEX IF EXISTS answer_key__proceso_8b1664_idx;",
                "DROP INDEX IF EXISTS answer_key__proceso_c45df5_idx;",
                "DROP INDEX IF EXISTS answer_key__proceso_974b30_idx;",

                # ── Drop stale columns ─────────────────────────────────────────────

                # identifier_sources: remove area, proceso_id
                "ALTER TABLE identifier_sources DROP COLUMN area;",
                "ALTER TABLE identifier_sources DROP COLUMN proceso_id;",

                # response_sources: remove area, proceso_id
                "ALTER TABLE response_sources DROP COLUMN area;",
                "ALTER TABLE response_sources DROP COLUMN proceso_id;",

                # answer_key_sources: remove proceso_id (area is in the model)
                "ALTER TABLE answer_key_sources DROP COLUMN proceso_id;",

                # candidatos_padron: remove proceso_id
                "ALTER TABLE candidatos_padron DROP COLUMN proceso_id;",

                # identifier_rows: remove area, proceso_id
                "ALTER TABLE identifier_rows DROP COLUMN area;",
                "ALTER TABLE identifier_rows DROP COLUMN proceso_id;",

                # response_rows: remove area, proceso_id
                "ALTER TABLE response_rows DROP COLUMN area;",
                "ALTER TABLE response_rows DROP COLUMN proceso_id;",

                # answer_key_rows: remove proceso_id
                "ALTER TABLE answer_key_rows DROP COLUMN proceso_id;",
            ],
            reverse_sql=[],
        ),
    ]
