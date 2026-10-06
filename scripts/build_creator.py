"""Copy reviewed creator application code only; never discover browser data."""
from pathlib import Path
from public_output import assert_output_tree

ROOT = Path(__file__).resolve().parents[1]
CREATOR_FILES = (
    'index.html', 'styles.css', 'appearance-boot.js', 'app.mjs',
    'controller.mjs', 'performance.mjs', 'studio-orb.mjs', 'core/core.mjs', 'core/store.mjs', 'core/exchange.mjs',
    'core/csv.mjs', 'core/fixtures.mjs',
    'graph/web.mjs', 'graph/snapshot.mjs', 'graph/project.mjs', 'graph/model.mjs', 'graph/view.mjs',
)
CREATOR_ARTIFACTS = ['creator/' + name for name in CREATOR_FILES]


def build_creator(out, *, source=None):
    source = Path(source) if source is not None else ROOT / 'src/creator'
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Creator source must be a regular directory')
    # Read and verify the complete allowlist before writing anything.
    payloads = {}
    for name in CREATOR_FILES:
        path = source / name
        parts = Path(name).parts
        linked = any(source.joinpath(*parts[:index]).is_symlink() for index in range(1, len(parts) + 1))
        if linked or not path.is_file():
            raise ValueError('A required creator code file is missing or linked')
        payloads[name] = path.read_bytes()
    out = Path(out)
    if out.is_symlink() or not out.is_dir():
        raise ValueError('Creator output must be a regular directory')
    target = out / 'creator'
    assert_output_tree(target, CREATOR_FILES)
    target.mkdir(exist_ok=True)
    for name, payload in payloads.items():
        (target / name).parent.mkdir(exist_ok=True)
        (target / name).write_bytes(payload)


if __name__ == '__main__':
    build_creator(ROOT / 'dist')
