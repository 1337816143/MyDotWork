"""Regression cases for approved nested archives and rejected unsafe members."""
import io
import unittest
import zipfile
from pathlib import Path
from validate_publication_archive import inspect_archive, validate_publication_archive


def package(entries):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries:
            archive.writestr(name, data)
    return out.getvalue()


class PublicArchiveTests(unittest.TestCase):
    def test_reviewed_package(self):
        root = Path(__file__).resolve().parents[1]
        name = 'research/ai-side-income/sample-v0.1.zip'
        content = (root / 'publications' / name).read_bytes()
        self.assertEqual(len(validate_publication_archive(content, name)), 42)
        with self.assertRaises(AssertionError):
            validate_publication_archive(content + b'x', name)

    def test_nested_path_rejected(self):
        content = package([('sample.zip', package([('../private.txt', 'unexpected')]))])
        with self.assertRaises(AssertionError): inspect_archive(content)

    def test_nested_credential_rejected(self):
        content = package([('sample.zip', package([('notes.txt', 'github_pat_' + 'a' * 30)]))])
        with self.assertRaises(AssertionError): inspect_archive(content)

    def test_private_windows_path_rejected(self):
        with self.assertRaises(AssertionError): inspect_archive(package([('notes.txt', r'C:\Users\private\report.txt')]))

    def test_ooxml_external_relationship_rejected(self):
        content = package([('sample.docx', package([('_rels/.rels', '<Relationship TargetMode="External" />')]))])
        with self.assertRaises(AssertionError): inspect_archive(content)

    def test_unreviewed_member_rejected(self):
        with self.assertRaises(AssertionError): inspect_archive(package([('run.exe', b'MZ')]))


def run_tests():
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(PublicArchiveTests))
    assert result.wasSuccessful(), 'Publication archive regression failed'


if __name__ == '__main__': run_tests()
