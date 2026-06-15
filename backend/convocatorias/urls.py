from rest_framework.routers import DefaultRouter
from .views import (
    AreaViewSet,
    AnswerKeyRowViewSet,
    AnswerKeySourceViewSet,
    CalificationConfigViewSet,
    CandidatoViewSet,
    DatFormatConfigViewSet,
    IdentifierRowViewSet,
    IdentifierSourceViewSet,
    ProgramaVacanteViewSet,
    ResponseRowViewSet,
    ResponseSourceViewSet,
)

router = DefaultRouter()
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'dat-format-configs', DatFormatConfigViewSet, basename='dat-format-config')
router.register(r'candidatos', CandidatoViewSet, basename='candidato')
router.register(r'identifier-sources', IdentifierSourceViewSet, basename='identifier-source')
router.register(r'identificadores', IdentifierRowViewSet, basename='identificador')
router.register(r'response-sources', ResponseSourceViewSet, basename='response-source')
router.register(r'respuestas', ResponseRowViewSet, basename='respuesta')
router.register(r'answer-key-sources', AnswerKeySourceViewSet, basename='answer-key-source')
router.register(r'answer-keys', AnswerKeyRowViewSet, basename='answer-key')
router.register(r'programa-vacantes', ProgramaVacanteViewSet, basename='programa-vacante')
router.register(r'calification-configs', CalificationConfigViewSet, basename='calification-config')

urlpatterns = router.urls
