from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAuthenticatedReadAdminWrite(BasePermission):
    """Allow authenticated reads, but reserve global configuration writes to staff."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or request.user.is_staff
