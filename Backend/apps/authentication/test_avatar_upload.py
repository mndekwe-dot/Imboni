"""
Profile picture upload: PATCH /imboni/account/avatar/.

These send real image bytes through the real endpoint. The rules worth pinning
are the ones that keep junk off the disk: only jpg/jpeg/png, at most 2 MB, and
the bytes have to BE an image (a text file renamed to .png is not one).

Run with:
    python -m pytest apps/authentication/test_avatar_upload.py -q
"""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image


def _image_bytes(fmt='PNG', size=(40, 40)):
    buf = io.BytesIO()
    Image.new('RGB', size, (30, 90, 160)).save(buf, fmt)
    return buf.getvalue()


def _upload(name, content, content_type):
    return SimpleUploadedFile(name, content, content_type=content_type)


@pytest.fixture(autouse=True)
def _media_in_tmp(settings, tmp_path):
    """Uploads land in a throwaway directory, never in the repo's media/."""
    settings.MEDIA_ROOT = str(tmp_path)


@pytest.mark.django_db
class TestAvatarUpload:
    URL_NAME = 'account-avatar'

    def _patch(self, client, upload):
        return client.patch(reverse(self.URL_NAME), {'avatar': upload}, format='multipart')

    def test_a_png_is_accepted_stored_and_linked(self, make_authenticated_client, tmp_path):
        client, user = make_authenticated_client('teacher')

        res = self._patch(client, _upload('me.png', _image_bytes('PNG'), 'image/png'))

        assert res.status_code == 200
        assert res.data['avatar'] and '/avatars/' in res.data['avatar']
        user.refresh_from_db()
        assert user.avatar and user.avatar.name.startswith('avatars/')
        # The file really is on disk, and it is still a readable image.
        with user.avatar.open('rb') as handle:
            assert Image.open(handle).size == (40, 40)
        assert any(tmp_path.rglob('*.png'))

    def test_a_jpeg_is_accepted(self, make_authenticated_client):
        client, _ = make_authenticated_client('student')
        res = self._patch(client, _upload('me.jpg', _image_bytes('JPEG'), 'image/jpeg'))
        assert res.status_code == 200

    @pytest.mark.parametrize('name, fmt, ctype', [
        ('me.gif', 'GIF', 'image/gif'),
        ('me.bmp', 'BMP', 'image/bmp'),
        ('me.webp', 'WEBP', 'image/webp'),
    ])
    def test_other_image_types_are_refused(self, make_authenticated_client, name, fmt, ctype):
        client, user = make_authenticated_client('teacher')
        res = self._patch(client, _upload(name, _image_bytes(fmt), ctype))
        assert res.status_code == 400
        assert 'avatar' in res.data
        user.refresh_from_db()
        assert not user.avatar

    def test_svg_is_refused(self, make_authenticated_client):
        """An SVG can carry script; it must never be stored and served back."""
        client, _ = make_authenticated_client('teacher')
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        res = self._patch(client, _upload('me.svg', svg, 'image/svg+xml'))
        assert res.status_code == 400

    def test_a_text_file_renamed_to_png_is_refused(self, make_authenticated_client):
        """The extension is not proof. The bytes have to decode as an image."""
        client, user = make_authenticated_client('teacher')
        res = self._patch(client, _upload('me.png', b'this is not an image', 'image/png'))
        assert res.status_code == 400
        user.refresh_from_db()
        assert not user.avatar

    def test_a_file_over_2mb_is_refused_with_a_message_that_says_why(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        # A valid PNG header padded past the limit; the size check runs first.
        big = _image_bytes('PNG') + b'\0' * (2 * 1024 * 1024 + 1)
        res = self._patch(client, _upload('big.png', big, 'image/png'))
        assert res.status_code == 400
        assert 'exceeds the 2MB limit' in str(res.data['avatar'])

    def test_no_file_is_a_clear_error_not_a_crash(self, make_authenticated_client):
        client, _ = make_authenticated_client('teacher')
        res = client.patch(reverse(self.URL_NAME), {}, format='multipart')
        assert res.status_code == 400

    def test_signing_in_is_required(self, api_client):
        res = api_client.patch(
            reverse(self.URL_NAME),
            {'avatar': _upload('me.png', _image_bytes(), 'image/png')},
            format='multipart',
        )
        assert res.status_code in (401, 403)

    def test_one_user_cannot_change_anothers_picture(self, make_authenticated_client):
        """The endpoint takes no user id: it can only ever edit the caller."""
        from apps.authentication.factories import UserFactory
        other = UserFactory(role='teacher')
        client, me = make_authenticated_client('teacher')

        self._patch(client, _upload('me.png', _image_bytes(), 'image/png'))

        other.refresh_from_db()
        me.refresh_from_db()
        assert me.avatar and not other.avatar
