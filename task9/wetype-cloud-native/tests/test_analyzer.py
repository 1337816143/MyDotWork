"""Synthetic fixtures only. These tests do NOT exercise Windows or WeType."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "probe"))
from AnalyzeReport import summarize, CAPABILITY


def empty():
    return {"schema_version": 1, "capability": CAPABILITY}


class AnalyzerTests(unittest.TestCase):
    def test_schema_two_standard_imm_remains_unverified(self):
        report = {"schema_version": 2, "capability": CAPABILITY, "window_frames": [{
            "standard_imm_candidates": {"status": "observed", "count": 2,
                "provider_verified_as_wetype": False, "exact_fixed_word_hits": ["开发"]}}]}
        result = summarize(report)
        self.assertEqual(result["standard_imm_observations"][0]["count"], 2)
        self.assertFalse(result["imm_provider_verified_as_wetype"])
        self.assertFalse(result["patch_ready"])
        self.assertFalse(result["translation_feature_verified"])

    def test_no_process_is_inconclusive(self):
        r = summarize(empty())
        self.assertFalse(r["patch_ready"])
        self.assertEqual(r["renderer_builds"], [])
        self.assertIn("inconclusive", r["interpretation"])

    def test_invalid_schema_rejected(self):
        with self.assertRaises(ValueError):
            summarize({"schema_version": 999, "capability": CAPABILITY})

    def test_unknown_capability_rejected(self):
        with self.assertRaises(ValueError):
            summarize({"schema_version": 1, "capability": "finished_patch"})

    def test_final_inventory_covers_late_renderer(self):
        r = empty()
        r["processes_at_start"] = []
        r["processes_at_end"] = [{"pid": 17, "process_name": "wetype_renderer", "file_version": "TEST"}]
        self.assertEqual(summarize(r)["renderer_builds"][0]["file_version"], "TEST")

    def test_library_hint_is_not_render_proof(self):
        r = empty()
        r["processes_at_start"] = [{"pid": 17, "process_name": "wetype_renderer",
                                    "modules": [{"name": "flutter_windows.dll"}, {"name": "dwrite.dll"}]}]
        s = summarize(r)
        self.assertEqual(len(s["framework_hints"]), 2)
        self.assertFalse(s["native_modification_proven"])

    def test_regular_wechat_is_not_renderer(self):
        r = empty()
        r["processes_at_start"] = [{"pid": 17, "process_name": "WeChat",
                                    "modules": [{"name": "flutter_windows.dll"}]}]
        self.assertEqual(summarize(r)["framework_hints"], [])

    def test_sample_hits_are_deduplicated_without_success_claim(self):
        r = empty()
        r["accessibility_frames"] = [{"nodes": [
            {"fixed_sample_hits": ["开发", "开发"], "framework_id": "Synthetic"}]}]
        s = summarize(r)
        self.assertEqual(s["fixed_sample_name_hits"], ["开发"])
        self.assertFalse(s["translation_feature_verified"])

    def test_pending_worker_is_preserved(self):
        r = empty()
        r["uia_worker_pending_at_save"] = True
        self.assertTrue(summarize(r)["uia_pending_at_save"])

    def test_null_arrays_are_supported(self):
        r = empty()
        r.update(processes_at_start=None, window_frames=None, accessibility_frames=None)
        self.assertFalse(summarize(r)["patch_ready"])


if __name__ == "__main__":
    unittest.main()
