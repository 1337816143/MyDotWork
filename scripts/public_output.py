"""Fail closed on unlisted output, then replace only a verified generated tree."""
from pathlib import Path
from html import unescape
from urllib.parse import unquote
import re
import shutil
import tempfile

WINDOWS_USER_MARKER = '[已脱敏用户名]'
# A path may directly follow Chinese text or an unspaced label. A Unicode
# word boundary would miss those cases because both the label and drive letter
# are word characters. The explicit drive/path syntax is sufficient here.
WINDOWS_USER_PREFIX = re.compile(r'(?i)[a-z]:[\\/]+users[\\/]+')
TEXT_SUFFIXES = {'.html', '.json', '.js', '.mjs', '.css', '.txt', '.md', '.csv', '.svg'}


def assert_no_windows_user_paths(text):
    """Reject personal profile names; retain explicit markers and error suffixes.

    Decode common HTML, URL, and JSON-ASCII escapes for output inspection only.
    This check never rewrites the source or prints a matched name/path.
    """
    for _ in range(3):
        decoded = unescape(unquote(text))
        decoded = re.sub(r'\\u00([0-9a-fA-F]{2})', lambda match: chr(int(match[1], 16)), decoded)
        if decoded == text:
            break
        text = decoded
    for match in WINDOWS_USER_PREFIX.finditer(text):
        tail = text[match.end():]
        if not tail.startswith(WINDOWS_USER_MARKER):
            raise ValueError('Unredacted Windows user directory in public output (value suppressed)')
        suffix = tail[len(WINDOWS_USER_MARKER):]
        # A dot may be an original malformed concatenation; do not repair it.
        if suffix and suffix[0] not in '\\/. \t\r\n<>"\'`，。；：、）)]}':
            raise ValueError('Invalid Windows user redaction boundary (value suppressed)')


def assert_output_tree(root, files, *, complete=False):
    root = Path(root)
    expected = set(files)
    if root.is_symlink():
        raise ValueError('Public output must not be a symbolic link')
    if not root.exists():
        if complete:
            raise ValueError('Public output is missing')
        return
    if not root.is_dir():
        raise ValueError('Public output must be a directory')
    directories = {str(parent) for name in expected for parent in Path(name).parents if str(parent) != '.'}
    actual = set()
    for path in root.rglob('*'):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            raise ValueError('Symbolic links are not accepted in public output')
        if path.is_file() and relative in expected:
            actual.add(relative)
            if complete and path.suffix.lower() in TEXT_SUFFIXES:
                assert_no_windows_user_paths(path.read_text(encoding='utf-8'))
        elif path.is_dir() and relative in directories:
            continue
        else:
            # Do not echo potentially private names or contents into build logs.
            raise ValueError('Unlisted file or directory in public output; preserve it outside dist before building')
    if complete and actual != expected:
        raise ValueError('Public output does not match the explicit artifact list')


def install_output(staged, target, files):
    """Keep the last known output if generation or preflight fails."""
    staged, target = Path(staged), Path(target)
    assert_output_tree(staged, files, complete=True)
    assert_output_tree(target, files)
    previous = None
    if target.exists():
        previous = Path(tempfile.mkdtemp(prefix='.previous-public-', dir=target.parent))
        previous.rmdir()
        target.rename(previous)
    try:
        staged.rename(target)
    except BaseException:
        if previous is not None:
            previous.rename(target)
        raise
    if previous is not None:
        shutil.rmtree(previous)
