import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, 'D:/aplications/calificadordad/backend')
django.setup()

from convocatorias.models import AnswerKeySource, AnswerKeyRow

print('=== ANSWER KEY SOURCES ===')
for s in AnswerKeySource.objects.all():
    print(f'  id={s.id} name={repr(s.name)}')

print()
print('=== ANSWER KEY ROWS ===')
for r in AnswerKeyRow.objects.all():
    print(f'  id={r.id} area={repr(r.area)} tipo={repr(r.tipo)} answers_len={len(r.answers or "")} obs={repr(r.observaciones[:40] if r.observaciones else "")}')

print()
print('=== CANDIDATOS por area ===')
from convocatorias.models import Candidato
from django.db.models import Count
for a in Candidato.objects.values('area').annotate(t=Count('id')).order_by('-t'):
    print(f'  {repr(a["area"])} -> {a["t"]}')

print()
print('=== RESPUESTAS vinculadas (muestra DNI) ===')
from convocatorias.models import ResponseRow
linked = ResponseRow.objects.exclude(dni='').exclude(dni=None)[:5]
for r in linked:
    print(f'  litho={r.litho} dni={r.dni} tipo={repr(r.tipo)} answers_len={len(r.answers or "")}')
unlinked = ResponseRow.objects.filter(dni='').count()
print(f'  ... sin DNI: {unlinked}')
