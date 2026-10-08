"""Offline counterexamples for stale/private output and failure preservation."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from public_output import assert_output_tree, install_output, assert_no_windows_user_paths


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

    def test_synthetic_windows_profiles_are_rejected_without_echoing(self):
        samples = [
            r'C:\Users\synthetic-person\logs\sample.log',
            r'C:\Users\synthetic-person.codex.sandbox',
            r'c:/USERS/synthetic-person/AppData/example',
            r'D:\\Users\\synthetic-person\\example',
            r'file:///C:/Users/synthetic-person/example',
            r'C%3A%5CUsers%5Csynthetic-person%5Cexample',
            r'C&#58;&#92;Users&#92;synthetic-person&#92;example',
            r'C:\u005cUsers\u005csynthetic-person\u005cexample',
            r'路径是C:\Users\synthetic-person\sample.log',
            r'日志在c:/uSeRs/synthetic-person/sample.log',
            r'路径是D:\\USERS\\synthetic-person\\sample.log',
            r'labelC:\Users\synthetic-person\sample.log',
            r'路径是C:\u005cUsers\u005csynthetic-person\u005csample.log',
            r'路径是c%3a%5cusers%5csynthetic-person%5csample.log',
            r'路径是c&#58;&#92;users&#92;synthetic-person&#92;sample.log',
        ]
        for text in samples:
            with self.subTest(sample=samples.index(text)):
                with self.assertRaises(ValueError) as caught:
                    assert_no_windows_user_paths(text)
                self.assertNotIn('synthetic-person', str(caught.exception))
                self.assertNotIn(text, str(caught.exception))

    def test_explicit_marker_preserves_normal_and_malformed_path_suffixes(self):
        samples = [
            r'C:\Users\[已脱敏用户名]',
            r'C:\Users\[已脱敏用户名]\.codex\.sandbox\sample.log',
            r'C:\Users\[已脱敏用户名].codex.sandbox',
            r'C:\\Users\\[已脱敏用户名]\\AppData\\example',
            r'路径是C:\Users\[已脱敏用户名]\.codex\sample.log',
            r'日志在c:/uSeRs/[已脱敏用户名]/sample.log',
            r'路径是D:\\USERS\\[已脱敏用户名]\\sample.log',
            'No profile path is present.',
        ]
        for text in samples:
            original = text
            assert_no_windows_user_paths(text)
            self.assertEqual(text, original)
        with self.assertRaises(ValueError):
            assert_no_windows_user_paths(r'C:\Users\[已脱敏用户名]synthetic-person\example')

    def test_profile_leak_in_each_text_artifact_blocks_install(self):
        for suffix in ('.html', '.json', '.js', '.mjs', '.css', '.txt', '.md', '.csv', '.svg'):
            with self.subTest(suffix=suffix):
                staged = self.root / ('staged-' + suffix[1:])
                staged.mkdir()
                name = 'payload' + suffix
                (staged / 'index.html').write_text('new public output')
                (staged / name).write_text(r'路径是C:\Users\synthetic-person\example')
                with self.assertRaises(ValueError):
                    install_output(staged, self.target, [name, 'index.html'])
                self.assertEqual((self.target / 'index.html').read_text(), 'old public output')
                self.assertTrue(staged.exists())

    def test_prior_output_can_be_replaced_by_reviewed_redacted_output(self):
        # The previous output may be exactly what the repair is removing.
        (self.target / 'index.html').write_text(r'C:\Users\synthetic-person\example')
        staged = self.stage()
        (staged / 'index.html').write_text(r'C:\Users\[已脱敏用户名]\example')
        install_output(staged, self.target, self.files)
        assert_output_tree(self.target, self.files, complete=True)


if __name__ == '__main__':
    unittest.main()
