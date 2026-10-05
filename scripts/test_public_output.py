"""Offline counterexamples for stale/private output and failure preservation."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from public_output import assert_output_tree, install_output


class PublicOutputTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target = self.root / 'dist'
        self.target.mkdir()
        self.files = ['index.html', 'creator/index.html']
        (self.target / 'index.html').write_text('old public output')

    def stage(self):
        out = self.root / 'staged'
        (out / 'creator').mkdir(parents=True)
        (out / 'index.html').write_text('new public output')
        (out / 'creator/index.html').write_text('synthetic app')
        return out

    def test_complete_and_missing(self):
        assert_output_tree(self.target, self.files)
        with self.assertRaises(ValueError):
            assert_output_tree(self.target, self.files, complete=True)
        assert_output_tree(self.stage(), self.files, complete=True)

    def test_extra_private_file_fails_without_logging_name(self):
        secret = self.target / 'private-creator-backup.json'
        secret.write_text('PRIVATE_SENTINEL_MUST_NOT_ENTER_PUBLIC_OUTPUT')
        with self.assertRaises(ValueError) as caught:
            install_output(self.stage(), self.target, self.files)
        self.assertNotIn(secret.name, str(caught.exception))
        self.assertEqual(secret.read_text(), 'PRIVATE_SENTINEL_MUST_NOT_ENTER_PUBLIC_OUTPUT')
        self.assertEqual((self.target / 'index.html').read_text(), 'old public output')

    def test_extra_empty_directory_rejected(self):
        (self.target / 'private').mkdir()
        with self.assertRaises(ValueError):
            assert_output_tree(self.target, self.files)

    def test_symlink_file_rejected(self):
        (self.target / 'index.html').unlink()
        outside = self.root / 'outside'
        outside.write_text('not approved')
        (self.target / 'index.html').symlink_to(outside)
        with self.assertRaises(ValueError):
            assert_output_tree(self.target, self.files)

    def test_symlink_directory_rejected(self):
        outside = self.root / 'outside'
        outside.mkdir()
        (self.target / 'creator').symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            assert_output_tree(self.target, self.files)

    def test_symlink_root_rejected(self):
        alias = self.root / 'alias'
        alias.symlink_to(self.target, target_is_directory=True)
        with self.assertRaises(ValueError):
            assert_output_tree(alias, self.files)

    def test_incomplete_stage_preserves_previous_output(self):
        staged = self.stage()
        (staged / 'creator/index.html').unlink()
        with self.assertRaises(ValueError):
            install_output(staged, self.target, self.files)
        self.assertEqual((self.target / 'index.html').read_text(), 'old public output')

    def test_success_installs_only_complete_allowlist(self):
        staged = self.stage()
        install_output(staged, self.target, self.files)
        self.assertFalse(staged.exists())
        assert_output_tree(self.target, self.files, complete=True)
        self.assertEqual((self.target / 'index.html').read_text(), 'new public output')
        self.assertEqual(list(self.root.glob('.previous-public-*')), [])

    def test_install_failure_restores_previous_directory(self):
        staged = self.stage()
        original = Path.rename
        def fail_new(source, destination):
            if source == staged:
                raise OSError('simulated install failure')
            return original(source, destination)
        with patch.object(Path, 'rename', fail_new):
            with self.assertRaises(OSError):
                install_output(staged, self.target, self.files)
        self.assertEqual((self.target / 'index.html').read_text(), 'old public output')


if __name__ == '__main__':
    unittest.main()
