"""
A school's own name, mark and contact details reach everything it prints.

The sidebar read what the school typed into Settings while documents read other
sources, so a school that renamed itself still printed "Imboni School" on every
report card. These tests keep one answer, from one place.
"""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.common.branding import school_branding, branding_context
from apps.common.documents import document_context
from apps.dos.models import SchoolSetting

SETTINGS_URL = '/imboni/dos/school-settings/'


def png_bytes(size=(600, 300), colour=(20, 80, 160), mode='RGB'):
    out = io.BytesIO()
    Image.new(mode, size, colour).save(out, 'PNG')
    return out.getvalue()


def png_upload(**kw):
    return SimpleUploadedFile('mark.png', png_bytes(**kw), content_type='image/png')


@pytest.fixture
def setting(db):
    return SchoolSetting.get_setting()


@pytest.mark.django_db
class TestResolution:
    def test_the_name_the_school_set_wins(self, setting):
        setting.school_name = 'Green Hills Secondary'
        setting.save()
        assert school_branding()['name'] == 'Green Hills Secondary'
        assert document_context('Receipt')['school_name'] == 'Green Hills Secondary'

    def test_blank_name_falls_back_to_something_printable(self, setting):
        setting.school_name = '   '
        setting.save()
        assert school_branding()['name'].strip() != ''

    def test_contact_details_come_from_the_school_not_the_server(self, setting):
        setting.contact_email = 'office@greenhills.rw'
        setting.contact_phone = '+250 788 111 222'
        setting.save()
        ctx = branding_context()
        assert ctx['school_email'] == 'office@greenhills.rw'
        assert ctx['school_phone'] == '+250 788 111 222'

    def test_no_logo_is_none_not_an_error(self, setting):
        assert school_branding()['logo'] is None

    def test_a_logo_becomes_a_small_inline_png(self, setting):
        setting.logo.save('mark.png', png_upload(size=(2000, 1000)), save=True)
        uri = school_branding()['logo']
        assert uri.startswith('data:image/png;base64,')
        import base64
        image = Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1])))
        assert max(image.size) <= 360

    def test_a_transparent_logo_is_flattened_onto_white(self, setting):
        setting.logo.save('mark.png', png_upload(size=(40, 40), colour=(0, 0, 0, 0), mode='RGBA'), save=True)
        import base64
        uri = school_branding()['logo']
        image = Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1])))
        assert image.mode == 'RGB' and image.getpixel((5, 5)) == (255, 255, 255)

    def test_an_unreadable_logo_file_never_breaks_a_document(self, setting):
        setting.logo.save('mark.png', SimpleUploadedFile('mark.png', b'not an image'), save=True)
        assert school_branding()['logo'] is None


@pytest.mark.django_db
class TestSettingsUpload:
    def test_the_admin_can_set_and_remove_the_logo(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')

        out = client.patch(SETTINGS_URL, {'logo': png_upload()}, format='multipart')
        assert out.status_code == 200 and out.json()['logo']
        assert SchoolSetting.get_setting().logo

        out = client.patch(SETTINGS_URL, {'logo': ''}, format='multipart')
        assert out.status_code == 200
        assert not SchoolSetting.get_setting().logo

    def test_only_images_are_accepted(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        bad = SimpleUploadedFile('mark.png', b'<script>alert(1)</script>', content_type='image/png')
        assert client.patch(SETTINGS_URL, {'logo': bad}, format='multipart').status_code == 400

    def test_contact_details_save(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        out = client.patch(SETTINGS_URL, {'contact_email': 'office@greenhills.rw', 'contact_phone': '+250 788 111 222'}, format='json')
        assert out.status_code == 200
        assert SchoolSetting.get_setting().contact_email == 'office@greenhills.rw'

    def test_a_bad_contact_email_is_refused(self, make_authenticated_client):
        client, _ = make_authenticated_client('admin')
        assert client.patch(SETTINGS_URL, {'contact_email': 'nope'}, format='json').status_code == 400


@pytest.mark.django_db
class TestPrintedDocuments:
    def test_the_letterhead_carries_the_name_and_the_mark(self, setting):
        from django.template.loader import render_to_string
        setting.school_name = 'Green Hills Secondary'
        setting.logo.save('mark.png', png_upload(), save=True)
        html = render_to_string('documents/finance_cash.html', document_context('Cash position', position={}, movements=[]))
        assert 'Green Hills Secondary' in html
        assert 'data:image/png;base64,' in html

    def test_the_letterhead_without_a_mark_has_no_broken_image(self, setting):
        from django.template.loader import render_to_string
        html = render_to_string('documents/finance_cash.html', document_context('Cash position', position={}, movements=[]))
        assert '<img' not in html

    def test_an_exam_paper_is_headed_with_the_schools_own_name(self, setting):
        from django.template.loader import render_to_string
        setting.school_name = 'Green Hills Secondary'
        setting.save()
        html = render_to_string('reports/exam_paper.html', {
            **branding_context(), 'paper': type('P', (), {'title': 'T', 'class_obj': type('C', (), {'name': 'S1'})(),
                                                          'term': type('Tm', (), {'term': 'Term 1', 'year': 2026})(), 'total_marks': 10})(),
            'sections': [], 'scheme': False, 'draft': False, 'total_marks': 10, 'printed_on': None,
        })
        assert 'Green Hills Secondary' in html
        assert 'Imboni School' not in html
