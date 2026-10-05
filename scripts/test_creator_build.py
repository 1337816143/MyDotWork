"""The runtime allowlist must not discover private files or follow links."""
from pathlib import Path
import tempfile
import unittest
from build_creator import build_creator, CREATOR_FILES


class CreatorBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.out = self.root / 'out'
        self.source.mkdir()
        self.out.mkdir()
        for name in CREATOR_FILES:
            (self.source / name).parent.mkdir(exist_ok=True)
            (self.source / name).write_text('reviewed synthetic code: ' + name)

    def test_explicit_files_are_byte_exact(self):
        build_creator(self.out, source=self.source)
        self.assertEqual(sorted(p.relative_to(self.out / 'creator').as_posix() for p in (self.out / 'creator').rglob('*') if p.is_file()), sorted(CREATOR_FILES))
        for name in CREATOR_FILES:
            self.assertEqual((self.out / 'creator' / name).read_bytes(), (self.source / name).read_bytes())

    def test_private_sentinel_never_enters_output(self):
        sentinel = 'PRIVATE_CREATOR_SENTINEL_EXCLUDED_20261005'
        for name in ('private-backup.json', 'metrics.csv', 'draft.txt', 'index.html.map', 'local.log'):
            (self.source / name).write_text(sentinel)
        private = self.source / 'private'
        private.mkdir()
        (private / 'work.json').write_text(sentinel)
        build_creator(self.out, source=self.source)
        for path in self.out.rglob('*'):
            if path.is_file():
                self.assertNotIn(sentinel.encode(), path.read_bytes())
        self.assertEqual(len([p for p in self.out.rglob('*') if p.is_file()]), len(CREATOR_FILES))

    def test_linked_required_input_rejected_before_writes(self):
        path = self.source / 'core/core.mjs'
        path.unlink()
        secret = self.root / 'private.txt'
        secret.write_text('private')
        path.symlink_to(secret)
        with self.assertRaises(ValueError):
            build_creator(self.out, source=self.source)
        self.assertEqual(list(self.out.iterdir()), [])

    def test_missing_input_does_not_produce_partial_app(self):
        (self.source / 'core/fixtures.mjs').unlink()
        with self.assertRaises(ValueError):
            build_creator(self.out, source=self.source)
        self.assertEqual(list(self.out.iterdir()), [])

    def test_linked_output_and_stale_private_export_rejected(self):
        target = self.out / 'creator'
        target.symlink_to(self.source, target_is_directory=True)
        with self.assertRaises(ValueError):
            build_creator(self.out, source=self.source)
        target.unlink()
        target.mkdir()
        (target / 'private-backup.json').write_text('must remain private')
        with self.assertRaises(ValueError):
            build_creator(self.out, source=self.source)
        self.assertEqual((target / 'private-backup.json').read_text(), 'must remain private')


if __name__ == '__main__':
    unittest.main()
