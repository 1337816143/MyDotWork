"""Summarize a locally produced diagnostic report without asserting patch success.

Optional developer utility; running RunProbe.ps1 does not require Python.
Usage: python AnalyzeReport.py reports/report-YYYYMMDD-HHMMSS/report.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

CAPABILITY = "read_only_diagnostics_NOT_a_translation_patch"


def summarize(report: dict[str, Any]) -> dict[str, Any]:
    if report.get("schema_version") not in (1, 2) or report.get("capability") != CAPABILITY:
        raise ValueError("Unsupported report schema or capability marker.")
    processes: dict[tuple[Any, Any], dict[str, Any]] = {}
    for key in ("processes_at_start", "processes_at_end"):
        for proc in report.get(key) or []:
            if not isinstance(proc, dict):
                continue
            processes[(proc.get("pid"), proc.get("process_name"))] = proc
    renderers = [p for p in processes.values()
                 if str(p.get("process_name", "")).lower() == "wetype_renderer"]
    module_names = {str(m.get("name", "")).lower()
                    for proc in renderers for m in proc.get("modules", [])}
    hints: list[str] = []
    if "flutter_windows.dll" in module_names:
        hints.append("Flutter runtime is loaded; active candidate rendering is unverified.")
    if any(n.startswith(("qt5", "qt6")) for n in module_names):
        hints.append("Qt modules are loaded; active candidate rendering is unverified.")
    if "dwrite.dll" in module_names:
        hints.append("DirectWrite is loaded; this is not proof that DrawText is the candidate hook.")
    if "d2d1.dll" in module_names:
        hints.append("Direct2D is loaded; the candidate render path is unverified.")
    windows: dict[Any, dict[str, Any]] = {}
    for frame in report.get("window_frames") or []:
        for window in frame.get("windows") or []:
            windows[(window.get("pid"), window.get("hwnd"))] = window
    hits: set[str] = set()
    frameworks: set[str] = set()
    for frame in report.get("accessibility_frames") or []:
        for node in frame.get("nodes") or []:
            hits.update(str(x) for x in node.get("fixed_sample_hits") or [])
            if node.get("framework_id"):
                frameworks.add(str(node["framework_id"]))
    imm_observations = []
    for frame in report.get("window_frames") or []:
        observation = frame.get("standard_imm_candidates")
        if isinstance(observation, dict):
            imm_observations.append({k: observation.get(k) for k in
                ("status", "count", "selection", "page_start", "page_size", "keyboard_layout")})
    return {
        "standard_imm_observations": imm_observations,
        "imm_provider_verified_as_wetype": False,
        "native_modification_proven": False,
        "translation_feature_verified": False,
        "patch_ready": False,
        "renderer_builds": [{k: p.get(k) for k in (
            "pid", "file_version", "product_version", "executable_sha256", "module_enumeration")}
            for p in renderers],
        "discovered_window_classes": sorted({str(w.get("class_name", "")) for w in windows.values()}),
        "discovered_window_count": len(windows),
        "fixed_sample_name_hits": sorted(hits),
        "uia_framework_ids": sorted(frameworks),
        "framework_hints": hints,
        "uia_opt_in": bool(report.get("uia_opt_in")),
        "uia_pending_at_save": bool(report.get("uia_worker_pending_at_save")),
        "interpretation": (
            "Sample hits indicate accessible test strings somewhere in discovered target windows, "
            "not a proven native candidate model or writable layout. No hits are inconclusive. "
            "Next evidence: map the exact candidate HWND, model, layout, hit-testing, and commit boundary."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        data = json.loads(args.report.read_text(encoding="utf-8-sig"))
        result = summarize(data)
        content = json.dumps(result, ensure_ascii=False, indent=2)
        if args.output:
            args.output.write_text(content + "\n", encoding="utf-8")
        print(content)
    except (OSError, ValueError, TypeError, AttributeError) as exc:
        parser.exit(1, f"Cannot analyze report: {exc}\n")


if __name__ == "__main__":
    main()
