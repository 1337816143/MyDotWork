"""Fail closed on unlisted output, then replace only a verified generated tree."""
from pathlib import Path
import shutil
import tempfile


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
