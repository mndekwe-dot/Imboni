"""API answers are never cached, never executable and never framed."""
import pytest

from apps.common.middleware import API_CSP


@pytest.mark.django_db
class TestApiSecurityHeaders:
    def test_a_json_answer_is_not_stored_and_cannot_run_anything(self, client):
        res = client.get('/imboni/dos/branding/')
        assert res.status_code == 200
        assert res['Cache-Control'] == 'no-store'
        assert res['Content-Security-Policy'] == API_CSP
        assert 'camera=()' in res['Permissions-Policy']

    def test_an_authenticated_answer_is_not_stored_either(self, make_authenticated_client):
        api, _ = make_authenticated_client('admin')
        res = api.get('/imboni/dos/school-settings/')
        assert res.status_code == 200
        assert res['Cache-Control'] == 'no-store'

    def test_an_error_answer_carries_them_too(self, client):
        res = client.get('/imboni/dos/school-settings/')
        assert res.status_code in (401, 403)
        assert res['Cache-Control'] == 'no-store'

    def test_a_response_that_asks_to_be_cached_keeps_its_own_header(self, client):
        # The installed app's icon is public and deliberately cacheable.
        from apps.dos.models import SchoolSetting
        import io
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        out = io.BytesIO()
        Image.new('RGB', (64, 64), (20, 80, 160)).save(out, 'PNG')
        setting = SchoolSetting.get_setting()
        setting.logo = SimpleUploadedFile('m.png', out.getvalue(), content_type='image/png')
        setting.save()
        res = client.get('/imboni/dos/branding/icon/192/')
        assert res.status_code == 200
        assert 'max-age' in res['Cache-Control']
        assert 'Content-Security-Policy' not in res
