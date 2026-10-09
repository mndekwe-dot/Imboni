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


@pytest.mark.django_db
class TestLinksAndEmails:
    def test_emailed_links_point_at_the_schools_own_address(self, settings):
        from apps.common.branding import frontend_url
        settings.FRONTEND_URL = 'https://imboni.rw'
        url = frontend_url()
        # The harness school is served from the test host, never the bare domain.
        assert url.startswith('https://') and 'imboni.rw' not in url

    def test_a_local_http_port_is_kept(self, settings):
        from apps.common.branding import frontend_url
        settings.FRONTEND_URL = 'http://localhost:5173'
        url = frontend_url()
        assert url.startswith('http://') and url.endswith(':5173')

    def test_a_password_reset_is_from_the_school_and_links_to_it(self, api_client, settings):
        from django.core import mail
        from apps.authentication.models import User
        settings.FRONTEND_URL = 'https://imboni.rw'
        setting = SchoolSetting.get_setting()
        setting.school_name = 'Green Hills Secondary'
        setting.save()
        User.objects.create_user(username='t1', email='t1@example.com', password='x-Pass-12345', first_name='Eric')

        out = api_client.post('/imboni/auth/password-reset/', {'email': 't1@example.com'}, format='json')

        assert out.status_code == 200
        message = mail.outbox[-1]
        assert 'Green Hills Secondary' in message.subject
        html = message.alternatives[0][0]
        assert 'Green Hills Secondary' in html
        assert 'https://imboni.rw/reset-password/' not in html and '/reset-password/' in html


@pytest.mark.django_db
class TestInstallableApp:
    def test_the_manifest_is_named_for_the_school(self, client, setting):
        setting.school_name = 'Green Hills Secondary'
        setting.save()
        out = client.get('/imboni/dos/manifest.webmanifest')
        assert out.status_code == 200
        assert out['Content-Type'].startswith('application/manifest+json')
        body = out.json()
        assert body['name'] == 'Green Hills Secondary' and body['short_name'] == 'Green Hills'
        assert body['icons'][0]['src'] == '/icon-192.png'     # no logo yet: the product's own mark

    def test_with_a_logo_the_icons_are_the_schools_own(self, client, setting):
        setting.logo.save('mark.png', png_upload(size=(300, 120)), save=True)
        body = client.get('/imboni/dos/manifest.webmanifest').json()
        assert body['icons'][0]['src'].startswith('/imboni/dos/branding/icon/')
        out = client.get('/imboni/dos/branding/icon/192/')
        assert out.status_code == 200 and out['Content-Type'] == 'image/png'
        image = Image.open(io.BytesIO(out.content))
        assert image.size == (192, 192)

    def test_there_is_no_icon_without_a_logo_or_for_an_odd_size(self, client, setting):
        assert client.get('/imboni/dos/branding/icon/192/').status_code == 404
        setting.logo.save('mark.png', png_upload(), save=True)
        assert client.get('/imboni/dos/branding/icon/100/').status_code == 404


@pytest.mark.django_db
class TestBrandColor:
    def test_a_readable_colour_saves_and_is_public(self, make_authenticated_client, client):
        api, _ = make_authenticated_client('admin')
        assert api.patch(SETTINGS_URL, {'brand_color': '#7c2d12'}, format='json').status_code == 200
        assert client.get('/imboni/dos/branding/').json()['brand_color'] == '#7c2d12'

    def test_a_colour_white_text_cannot_be_read_on_is_refused(self, make_authenticated_client):
        api, _ = make_authenticated_client('admin')
        res = api.patch(SETTINGS_URL, {'brand_color': '#ffeb3b'}, format='json')
        assert res.status_code == 400 and 'brand_color' in res.json()

    def test_junk_is_refused_and_blank_resets(self, make_authenticated_client, setting):
        api, _ = make_authenticated_client('admin')
        assert api.patch(SETTINGS_URL, {'brand_color': 'red'}, format='json').status_code == 400
        assert api.patch(SETTINGS_URL, {'brand_color': '#7c2d12'}, format='json').status_code == 200
        assert api.patch(SETTINGS_URL, {'brand_color': ''}, format='json').status_code == 200
        setting.refresh_from_db()
        assert setting.brand_color == ''

    def test_the_letterhead_uses_the_schools_colour(self, setting):
        from django.template.loader import render_to_string
        setting.brand_color = '#7c2d12'
        setting.save()
        html = render_to_string('documents/finance_cash.html', document_context('Cash', position={}, movements=[]))
        assert '#7c2d12' in html and '#14532d' not in html


@pytest.mark.django_db
class TestDocumentWording:
    def test_defaults_when_nothing_is_set(self, setting):
        from apps.common.branding import document_text
        assert document_text()['report_signatory_right'] == 'The School HeadMaster'

    def test_the_school_can_reword_what_it_prints(self, make_authenticated_client, setting):
        api, _ = make_authenticated_client('admin')
        body = {'document_text': {'motto': 'Learn to lead', 'report_signatory_right': 'Head Teacher',
                                  'footer_text': 'P.O. Box 12, Kigali'}}
        assert api.patch(SETTINGS_URL, body, format='json').status_code == 200
        from django.template.loader import render_to_string
        html = render_to_string('documents/finance_cash.html', document_context('Cash', position={}, movements=[]))
        assert 'Learn to lead' in html and 'P.O. Box 12, Kigali' in html
        assert document_context('x')['doc']['report_signatory_right'] == 'Head Teacher'

    def test_wording_is_escaped_not_run_as_a_template(self, setting):
        from django.template.loader import render_to_string
        setting.document_text = {'motto': '<script>x</script>{{ 7|add:7 }}'}
        setting.save()
        html = render_to_string('documents/finance_cash.html', document_context('Cash', position={}, movements=[]))
        assert '<script>x' not in html and '14' not in html.split('lh-contact')[1][:80]

    def test_unknown_keys_and_overlong_text_are_refused(self, make_authenticated_client):
        api, _ = make_authenticated_client('admin')
        assert api.patch(SETTINGS_URL, {'document_text': {'template': '<b>'}}, format='json').status_code == 400
        assert api.patch(SETTINGS_URL, {'document_text': {'motto': 'x' * 500}}, format='json').status_code == 400

    def test_exam_default_instructions_fill_in_only_when_the_paper_has_none(self, setting):
        from django.template.loader import render_to_string
        setting.document_text = {'exam_instructions': 'Answer all questions.'}
        setting.save()
        paper = type('P', (), {'title': 'T', 'class_obj': type('C', (), {'name': 'S1'})(), 'instructions': '',
                               'term': type('Tm', (), {'term': 'Term 1', 'year': 2026})(), 'total_marks': 10})()
        ctx = {**branding_context(), 'paper': paper, 'sections': [], 'scheme': False, 'draft': False,
               'total_marks': 10, 'printed_on': None}
        assert 'Answer all questions.' in render_to_string('reports/exam_paper.html', ctx)
        paper.instructions = 'Use black ink.'
        out = render_to_string('reports/exam_paper.html', ctx)
        assert 'Use black ink.' in out and 'Answer all questions.' not in out
