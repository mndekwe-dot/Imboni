"""
Teaching materials: notes, slides, past papers and video links a teacher
shares with a class.

    /imboni/teacher/materials/          teacher: list, post, edit, delete their own
    /imboni/student/materials/          student: their class's materials this term
    /imboni/parents/<id>/materials/     parent: the same list for their own child

A teacher may post only to a class and subject they teach this term - the
same rule the attendance and results views apply - so a material cannot land
in a class that never asked for it.
"""
import logging
import os

from django.http import Http404
from rest_framework import serializers, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsParent, IsStudent, IsTeacher
from apps.results.models import AcademicTerm

from .models import ClassAssignment, SubjectTeacherAssignment, TeachingMaterial

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
    '.odt', '.odp', '.ods', '.txt', '.rtf', '.csv',
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.mp3', '.m4a', '.mp4', '.zip',
}


def _current_term():
    return AcademicTerm.objects.filter(is_current=True).first()


class TeachingMaterialSerializer(serializers.ModelSerializer):
    class_id     = serializers.UUIDField(source='class_obj_id', read_only=True)
    class_name   = serializers.SerializerMethodField()
    subject_id   = serializers.UUIDField(read_only=True)
    subject_name = serializers.ReadOnlyField(source='subject.name')
    teacher_name = serializers.ReadOnlyField(source='teacher.full_name')
    file         = serializers.SerializerMethodField()
    file_name    = serializers.SerializerMethodField()
    file_size    = serializers.SerializerMethodField()

    class Meta:
        model = TeachingMaterial
        fields = [
            'id', 'title', 'description', 'kind', 'file', 'file_name', 'file_size', 'url',
            'class_id', 'class_name', 'subject_id', 'subject_name', 'teacher_name',
            'created_at', 'updated_at',
        ]

    def get_class_name(self, obj):
        return str(obj.class_obj)

    def get_file(self, obj):
        # Same-origin path, not an absolute URL: DRF would build that from the
        # Host header, which the dev proxy rewrites to the tenant's host and
        # which the browser then cannot reach.
        return obj.file.url if obj.file else None

    def get_file_name(self, obj):
        return os.path.basename(obj.file.name) if obj.file else ''

    def get_file_size(self, obj):
        if not obj.file:
            return None
        try:
            return obj.file.size
        except OSError:
            # The row outlived its file (a restored database, a wiped volume).
            # The list must still load; the link will say what is wrong.
            return None


class TeachingMaterialWriteSerializer(serializers.ModelSerializer):
    """
    What a teacher sets. Exactly one of `file` and `url`: sending one clears
    the other, so switching a material from an upload to a link does not
    leave the old file behind it.
    """
    class Meta:
        model = TeachingMaterial
        fields = ['id', 'title', 'description', 'class_obj', 'subject', 'file', 'url']
        read_only_fields = ['id']

    def validate_file(self, value):
        if not value:
            return value
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f'{ext or "This file type"} cannot be shared. Use a PDF, an Office '
                'document, an image, audio or video, or share a link instead.')
        if value.size > MAX_FILE_BYTES:
            raise serializers.ValidationError(
                'The file is larger than 25 MB. Share a link to it instead.')
        return value

    def validate(self, attrs):
        instance = self.instance
        has = lambda key: attrs[key] if key in attrs else getattr(instance, key, None)  # noqa: E731

        file, url = has('file'), (has('url') or '').strip()
        if 'file' in attrs and attrs['file']:
            url = ''
        elif 'url' in attrs and url:
            file = None
        if not file and not url:
            raise serializers.ValidationError({'detail': 'Attach a file or give a link.'})
        if file and url:
            raise serializers.ValidationError({'detail': 'Share a file or a link, not both.'})
        attrs['url'] = url
        if url:
            attrs['file'] = None

        teacher = self.context['request'].user
        term = _current_term()
        if term is None:
            raise serializers.ValidationError({'detail': 'There is no current term to post to.'})
        class_obj, subject = has('class_obj'), has('subject')
        if not SubjectTeacherAssignment.objects.filter(
            teacher=teacher, class_obj=class_obj, subject=subject, term=term,
        ).exists():
            raise serializers.ValidationError(
                {'detail': 'You can only share materials with a class and subject you teach.'})
        return attrs


class TeacherMaterialViewSet(viewsets.ModelViewSet):
    """
    GET    /imboni/teacher/materials/          ?class_id= ?subject_id=
    POST   /imboni/teacher/materials/          multipart (file) or JSON (url)
    PATCH  /imboni/teacher/materials/<id>/
    DELETE /imboni/teacher/materials/<id>/
    """
    permission_classes = [IsTeacher]
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return TeachingMaterialWriteSerializer
        return TeachingMaterialSerializer

    def get_queryset(self):
        qs = (TeachingMaterial.objects
              .filter(teacher=self.request.user)
              .select_related('class_obj', 'subject', 'teacher'))
        params = self.request.query_params
        if params.get('class_id'):
            qs = qs.filter(class_obj_id=params['class_id'])
        if params.get('subject_id'):
            qs = qs.filter(subject_id=params['subject_id'])
        return qs

    def create(self, request, *args, **kwargs):
        # Answer in the read shape, so the list can show the new row as is.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        material = serializer.save(teacher=request.user, term=_current_term())
        self._notify_class(material)
        return Response(TeachingMaterialSerializer(material, context={'request': request}).data,
                        status=201)

    def update(self, request, *args, **kwargs):
        material = self.get_object()
        old_file = material.file.name if material.file else ''
        serializer = self.get_serializer(material, data=request.data,
                                         partial=kwargs.get('partial', False))
        serializer.is_valid(raise_exception=True)
        material = serializer.save()
        if old_file and old_file != (material.file.name if material.file else ''):
            material.file.storage.delete(old_file)
        return Response(TeachingMaterialSerializer(material, context={'request': request}).data)

    def perform_destroy(self, instance):
        if instance.file:
            instance.file.delete(save=False)
        instance.delete()

    def _notify_class(self, material):
        from apps.notifications.services import notify_users

        users = [
            ca.student.user for ca in
            ClassAssignment.objects
            .filter(class_obj=material.class_obj, term=material.term)
            .select_related('student__user')
            if ca.student.user_id
        ]
        if not users:
            return
        try:
            notify_users(users, f'New material: {material.title}',
                         f'{material.subject.name} - shared by {material.teacher.full_name}.',
                         'announcement', '/student/materials')
        except Exception:
            # The material is shared either way; the nudge is not worth
            # failing the request over.
            logger.warning('Could not notify class of material %s', material.pk, exc_info=True)


def _class_materials(request, student):
    term = _current_term()
    if term is None:
        return Response([])
    placement = ClassAssignment.objects.filter(student=student, term=term).first()
    if placement is None:
        return Response([])
    qs = (TeachingMaterial.objects
          .filter(class_obj_id=placement.class_obj_id, term=term)
          .select_related('class_obj', 'subject', 'teacher'))
    if request.query_params.get('subject_id'):
        qs = qs.filter(subject_id=request.query_params['subject_id'])
    return Response(TeachingMaterialSerializer(qs, many=True, context={'request': request}).data)


class StudentMaterialsView(APIView):
    """GET /imboni/student/materials/ ?subject_id= - everything shared with my class this term."""
    permission_classes = [IsStudent]

    def get(self, request):
        student = getattr(request.user, 'student_profile', None)
        if student is None:
            return Response({'error': 'Student profile not found.'}, status=404)
        return _class_materials(request, student)


class ParentChildMaterialsView(APIView):
    """GET /imboni/parents/<id>/materials/ - what the child's teachers have shared this term."""
    permission_classes = [IsParent]

    def get(self, request, pk):
        from apps.parents.views import _verify_parent_owns_student

        student = _verify_parent_owns_student(request, pk)
        if student is None:
            raise Http404
        return _class_materials(request, student)
