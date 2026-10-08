from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .modules import snapshot


class SchoolModulesView(APIView):
    """GET /imboni/school/modules/ - which switchable parts of Imboni this school has on.

    Not gated by the modules it reports on, for the same reason the library's
    availability endpoint is not: the UI asks this to decide what to show.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(snapshot())
