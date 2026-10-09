"""
The upload allowlist: name, size and content.

The cases that matter are the disguised ones: a page or a script given a
harmless-looking name. The check has to look at the bytes, because the name is
only what the uploader typed.

Run with:
    python -m pytest apps/common/test_uploads.py -q
"""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError

from apps.common.uploads import (
    MATERIAL_TYPES, MAX_UPLOAD_BYTES, check_content, validate_csv, validate_document,
)

PDF = b'%PDF-1.7\n1 0 obj\n'
ZIP = b'PK\x03\x04' + b'\x00' * 20
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 20
JPEG = b'\xff\xd8\xff\xe0' + b'\x00' * 20
GIF = b'GIF89a' + b'\x00' * 20
OLE = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\x00' * 20


def up(name, content):
    return SimpleUploadedFile(name, content)


class TestAccepts:
    @pytest.mark.parametrize('name, content', [
        ('notes.pdf', PDF), ('worksheet.docx', ZIP), ('marks.xlsx', ZIP), ('slides.pptx', ZIP),
        ('old.doc', OLE), ('old.xls', OLE), ('photo.png', PNG), ('photo.jpg', JPEG),
        ('photo.jpeg', JPEG), ('anim.gif', GIF), ('plain.txt', b'just some words\n'),
        ('data.csv', b'name,mark\nAmina,80\n'), ('doc.rtf', b'{\\rtf1\\ansi text}'),
    ])
    def test_a_genuine_file(self, name, content):
        assert validate_document(up(name, content)).name == name

    def test_the_extension_is_case_insensitive(self):
        validate_document(up('REPORT.PDF', PDF))

    def test_text_in_latin1_from_an_older_tool_is_still_text(self):
        validate_document(up('export.csv', 'Nom,Prénom\nÉlodie,Zoé\n'.encode('latin-1')))

    def test_the_stream_is_left_where_it_was_for_the_save_that_follows(self):
        f = up('a.pdf', PDF)
        validate_document(f)
        assert f.tell() == 0 and f.read() == PDF


class TestRefusesByName:
    @pytest.mark.parametrize('name', [
        'page.html', 'page.htm', 'page.xhtml', 'image.svg', 'script.js', 'run.exe',
        'run.bat', 'run.sh', 'shell.php', 'macro.docm', 'archive.zip', 'noext', '.hidden',
    ])
    def test_anything_not_on_the_list(self, name):
        with pytest.raises(ValidationError) as err:
            validate_document(up(name, b'<script>alert(1)</script>'))
        assert 'not accepted' in str(err.value.detail[0])


class TestRefusesByContent:
    """The name says one thing and the bytes say another."""

    @pytest.mark.parametrize('name', ['fake.pdf', 'fake.docx', 'fake.png', 'fake.jpg', 'fake.gif', 'fake.doc'])
    def test_a_script_renamed_to_a_document_or_image(self, name):
        with pytest.raises(ValidationError) as err:
            validate_document(up(name, b'<html><script>steal()</script></html>'))
        assert 'does not look like a real' in str(err.value.detail[0])

    def test_a_png_renamed_to_a_pdf(self):
        with pytest.raises(ValidationError):
            validate_document(up('x.pdf', PNG))

    def test_a_binary_renamed_to_txt_or_csv(self):
        for name in ('x.txt', 'x.csv'):
            with pytest.raises(ValidationError):
                validate_document(up(name, b'MZ\x90\x00\x03\x00\x00\x00\x04'))


class TestRefusesBySize:
    def test_over_the_limit(self):
        big = up('big.pdf', PDF + b'\0' * MAX_UPLOAD_BYTES)
        with pytest.raises(ValidationError) as err:
            validate_document(big)
        assert 'the limit is 15 MB' in str(err.value.detail[0])

    def test_an_empty_file(self):
        with pytest.raises(ValidationError) as err:
            validate_document(up('empty.pdf', b''))
        assert 'empty' in str(err.value.detail[0])


class TestMaterials:
    """Teaching materials keep their own name and size rules; this adds the content check."""

    @pytest.mark.parametrize('name, content', [
        ('clip.mp4', b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 20),
        ('talk.m4a', b'\x00\x00\x00\x18ftypM4A ' + b'\x00' * 20),
        ('song.mp3', b'ID3\x04\x00\x00' + b'\x00' * 20),
        ('song2.mp3', b'\xff\xfb\x90\x00' + b'\x00' * 20),
        ('pic.webp', b'RIFF\x00\x00\x00\x00WEBPVP8 ' + b'\x00' * 20),
        ('pack.zip', ZIP),
    ])
    def test_genuine_media_passes(self, name, content):
        check_content(up(name, content), MATERIAL_TYPES)

    @pytest.mark.parametrize('name', ['clip.mp4', 'song.mp3', 'pic.webp', 'pack.zip'])
    def test_disguised_media_is_refused(self, name):
        with pytest.raises(ValidationError):
            check_content(up(name, b'<html>not media</html>'), MATERIAL_TYPES)

    def test_a_type_it_cannot_recognise_is_left_to_the_caller(self):
        # The caller's own allowlist already ruled on the name.
        check_content(up('thing.unknown', b'whatever'), MATERIAL_TYPES)


class TestCsv:
    def test_a_real_csv(self):
        validate_csv(up('students.csv', b'a,b\n1,2\n'))

    def test_only_csv(self):
        with pytest.raises(ValidationError):
            validate_csv(up('students.xlsx', ZIP))

    def test_a_smaller_cap_than_documents(self):
        with pytest.raises(ValidationError):
            validate_csv(up('big.csv', b'a,b\n' + b'1,2\n' * (2 * 1024 * 1024)))
