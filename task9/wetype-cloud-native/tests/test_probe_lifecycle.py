"""Deterministic interleaving models and C# source contracts, NOT Windows tests.

The legacy predicate is modeled explicitly to expose two lost-cancellation
interleavings. Source checks guard the event wiring. CaptureScopeTests.cs is the
separate executable C# regression suite; its native run status must be reported
separately. These Python tests do not execute C#, UIA, WinForms or WeType.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'probe/NativeProbe.cs').read_text(encoding='utf-8-sig')


class LegacyScope:
    def __init__(self):
        self.saving = False
        self.epoch = self.captured_epoch = 0
        self.foreground_host = True
        self.input_focused = True

    def tick(self):
        if not self.input_focused or not self.foreground_host:
            self.epoch += 1

    def eligible(self):
        # Exact conditions in the baseline UIA stillScoped delegate.
        return (not self.saving and self.epoch == self.captured_epoch
                and self.foreground_host)


class TicketScopeModel:
    """Specification only; the C# implementation is tested by its own suite."""
    def __init__(self):
        self.current = None

    def begin(self):
        self.current = object()
        return self.current

    def invalidate(self):
        self.current = None

    def publish(self, ticket, eligible):
        if ticket is None or ticket is not self.current or not eligible:
            return False
        self.current = None
        return True


class ProbeLifecycleTests(unittest.TestCase):
    def test_reproduce_legacy_same_window_focus_gap(self):
        old = LegacyScope()
        old.input_focused = False  # Tab to the same form's Finish button.
        self.assertTrue(old.eligible())  # Baseline accepts before next 300 ms tick.
        old.tick()
        self.assertFalse(old.eligible())

    def test_reproduce_legacy_loss_and_regain_between_ticks(self):
        old = LegacyScope()
        old.foreground_host = old.input_focused = False
        old.foreground_host = old.input_focused = True
        old.tick()
        self.assertTrue(old.eligible())  # Delayed old provider result can reappear.

    def test_reproduce_legacy_extra_sibling_call_after_cancel(self):
        calls = []
        active = False  # Nested Walk returned after detecting cancellation.
        if active:
            calls.append('Walk')
        calls.append('GetNextSibling')  # Legacy unconditional statement.
        self.assertEqual(calls, ['GetNextSibling'])
        fixed_calls = []
        if active:
            fixed_calls.append('GetNextSibling')
        self.assertEqual(fixed_calls, [])

    def test_revocation_is_permanent_across_refocus(self):
        scope = TicketScopeModel()
        old = scope.begin()
        scope.invalidate()
        self.assertFalse(scope.publish(old, True))
        new = scope.begin()
        self.assertFalse(scope.publish(old, True))
        self.assertTrue(scope.publish(new, True))
        self.assertFalse(scope.publish(new, True))

    def test_all_closing_focus_and_handle_events_are_wired(self):
        for hook in ('input.LostFocus += InvalidateScope;',
                     'input.HandleDestroyed += InvalidateScope;',
                     'Deactivate += InvalidateScope;',
                     'HandleDestroyed += InvalidateScope;',
                     'FormClosing += delegate { InvalidateScope(this, EventArgs.Empty); Save(); };'):
            self.assertIn(hook, SOURCE)
        self.assertNotIn('scopeEpoch', SOURCE)
        self.assertIn('input.GotFocus += delegate { editorFocused = true; };', SOURCE)
        self.assertIn('private volatile bool editorFocused;', SOURCE)

    def test_publication_uses_same_lock_and_unreusable_ticket(self):
        self.assertIn('scope = new CaptureScope(sync);', SOURCE)
        self.assertIn('current = new object();', SOURCE)
        self.assertIn('Object.ReferenceEquals(ticket, current)', SOURCE)
        self.assertIn('scope.TryPublish(scopedTicket, eligible, delegate { accessibility.Add(captured); });', SOURCE)
        self.assertIn('!saving && editorFocused && Native.GetForegroundWindow() == scopedHost', SOURCE)
        self.assertIn('lock (sync) { saving = true; editorFocused = false; scope.Invalidate(); }', SOURCE)

    def test_no_more_navigation_after_nested_walk_cancel(self):
        self.assertIn('while (stillScoped() && child != null', SOURCE)
        self.assertIn('Walk(child, depth + 1, root, pids, nodes, errors, watch, stillScoped);\n'
                      '                    if (!stillScoped()) return;\n'
                      '                    child = walker.GetNextSibling(child);', SOURCE)
        self.assertIn('if (!stillScoped()) return;\n'
                      '                TreeWalker walker = TreeWalker.RawViewWalker;\n'
                      '                AutomationElement child = walker.GetFirstChild(element);', SOURCE)

    def test_password_text_and_children_remain_skipped(self):
        self.assertIn('string name = password ? "" : (info.Name ?? "");', SOURCE)
        self.assertIn('if (password) return;', SOURCE)
        self.assertIn('!input.UseSystemPasswordChar && input.PasswordChar ==', SOURCE)
        for forbidden in ('GetCurrentPattern(ValuePattern', 'GetCurrentPattern(TextPattern',
                          'WebClient(', 'HttpClient(', 'HttpWebRequest', 'cloud_translation_enabled = true'):
            self.assertNotIn(forbidden, SOURCE)


if __name__ == '__main__':
    unittest.main()
