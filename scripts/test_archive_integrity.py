"""Regressions for exact baseline preservation with non-positional archive increments."""
import copy
import unittest
from validate_archive import archive_messages_sha256, validate_archive_integrity, validate_no_platform_control_cards, scan


def fixture():
    def message(name, hour, text):
        return {'id': 'Sentinel_' + name, 'role': 'user', 'time': f'2026-10-02T{hour:02d}:00:00Z', 'text': text}
    baseline = [message('old1', 2, 'Original one'), message('old2', 4, 'Original two'), message('old3', 6, '')]
    added = [message('early', 1, 'Recovered before baseline'), message('middle', 3, 'Recovered between old records'), message('empty', 5, '')]
    messages = [added[0], baseline[0], added[1], baseline[1], added[2], baseline[2]]
    increment = {'baselineMessageCount': 3, 'baselineMessagesSha256': archive_messages_sha256(baseline), 'newMessageIds': [message['id'] for message in added], 'returnedRecordCount': 8, 'uniqueCandidateCount': 7, 'pageOverlapDuplicateCount': 1, 'overlapByIdCount': 2, 'newMessageCount': 3, 'newNonemptyTextCount': 2, 'newEmptyTextCount': 1, 'controlExcludedCount': 2, 'partialPageCount': 3, 'allPagesPartial': True, 'newSecretRedactionCount': 0}
    integrity = {'schemaVersion': 2, 'baselineMessageCount': 3, 'baselineMessagesSha256': increment['baselineMessagesSha256'], 'approvedMessageCount': 6, 'approvedMessagesSha256': archive_messages_sha256(messages), 'incrementMessageCount': 3, 'newMessageIds': list(increment['newMessageIds']), 'partialPages': True}
    return messages, increment, integrity


class ArchiveIntegrityTests(unittest.TestCase):
    def test_archive_scan_rejects_synthetic_windows_profile_names(self):
        samples = [
            r'Log: C:\Users\synthetic-person\.codex\sample.log',
            r'路径是C:\Users\synthetic-person\sample.log',
            r'日志在c:/uSeRs/synthetic-person/sample.log',
            r'路径是D:\\USERS\\synthetic-person\\sample.log',
            r'路径是C:\u005cUsers\u005csynthetic-person\u005csample.log',
        ]
        for text in samples:
            with self.subTest(sample=samples.index(text)):
                with self.assertRaises(AssertionError) as caught:
                    scan(text)
                self.assertNotIn('synthetic-person', str(caught.exception))
        scan(r'Log: C:\Users\[已脱敏用户名]\.codex\sample.log')
        scan(r'Error: C:\Users\[已脱敏用户名].codex.sandbox')
        scan(r'路径是C:\Users\[已脱敏用户名]\.codex\sample.log')

    def test_early_and_noncontiguous_backfills_with_empty_text(self):
        messages, increment, integrity = fixture()
        self.assertLess(messages[0]['time'], messages[1]['time'])
        self.assertNotEqual([message['id'] for message in messages[3:]], increment['newMessageIds'])
        validate_archive_integrity(messages, increment, integrity)

    def test_new_id_sets_do_not_imply_archive_order(self):
        messages, increment, integrity = fixture()
        increment['newMessageIds'].reverse()
        validate_archive_integrity(messages, increment, integrity)

    def test_missing_duplicate_unknown_and_reclassified_ids(self):
        for target in ('increment', 'integrity'):
            for replacement in (None, [], ['Sentinel_early'] * 3, ['Sentinel_missing', 'Sentinel_middle', 'Sentinel_empty']):
                with self.subTest(target=target, replacement=replacement):
                    messages, increment, integrity = fixture()
                    (increment if target == 'increment' else integrity)['newMessageIds'] = replacement
                    with self.assertRaises(AssertionError):
                        validate_archive_integrity(messages, increment, integrity)
        messages, increment, integrity = fixture()
        increment['newMessageIds'][0] = integrity['newMessageIds'][0] = 'Sentinel_old1'
        # Even a freshly recomputed full hash cannot reclassify an old record.
        integrity['approvedMessagesSha256'] = archive_messages_sha256(messages)
        with self.assertRaisesRegex(AssertionError, 'Previously published'):
            validate_archive_integrity(messages, increment, integrity)

    def test_integrity_and_increment_id_sets_must_match(self):
        messages, increment, integrity = fixture()
        integrity['newMessageIds'][0] = 'Sentinel_old1'
        with self.assertRaisesRegex(AssertionError, 'ID sets differ'):
            validate_archive_integrity(messages, increment, integrity)

    def test_old_objects_and_their_order_remain_exact(self):
        for field, replacement in (('text', 'Altered original body'), ('time', '2026-10-02T02:00:00.000Z'), ('role', 'assistant')):
            with self.subTest(field=field):
                messages, increment, integrity = fixture()
                messages[1][field] = replacement
                integrity['approvedMessagesSha256'] = archive_messages_sha256(messages)
                with self.assertRaisesRegex(AssertionError, 'Previously published'):
                    validate_archive_integrity(messages, increment, integrity)
        messages, increment, integrity = fixture()
        messages[1], messages[3] = messages[3], messages[1]
        integrity['approvedMessagesSha256'] = archive_messages_sha256(messages)
        with self.assertRaisesRegex(AssertionError, 'Previously published'):
            validate_archive_integrity(messages, increment, integrity)

    def test_new_objects_still_require_full_approved_hash(self):
        messages, increment, integrity = fixture()
        messages[0]['text'] = 'Unreviewed replacement'
        with self.assertRaisesRegex(AssertionError, 'Reviewed messages changed'):
            validate_archive_integrity(messages, increment, integrity)

    def test_wrong_nonempty_count_cannot_follow_the_tail(self):
        messages, increment, integrity = fixture()
        increment['newNonemptyTextCount'] = sum(bool(message['text']) for message in messages[3:])
        increment['newEmptyTextCount'] = 3 - increment['newNonemptyTextCount']
        with self.assertRaisesRegex(AssertionError, 'New nonempty'):
            validate_archive_integrity(messages, increment, integrity)

    def test_counts_and_partial_page_guards_remain_active(self):
        for field, replacement in (('returnedRecordCount', 9), ('uniqueCandidateCount', 6), ('baselineMessageCount', 4), ('newMessageCount', 4), ('overlapByIdCount', 4), ('newEmptyTextCount', 0), ('newSecretRedactionCount', 4), ('partialPageCount', 0), ('allPagesPartial', 1), ('newMessageCount', True)):
            with self.subTest(field=field):
                messages, increment, integrity = fixture()
                increment[field] = replacement
                with self.assertRaises(AssertionError):
                    validate_archive_integrity(messages, increment, integrity)

    def test_schema_and_integrity_approval_guards_remain_active(self):
        for field, replacement in (('schemaVersion', 1), ('schemaVersion', True), ('baselineMessagesSha256', 'a' * 64), ('approvedMessagesSha256', 'b' * 64), ('approvedMessageCount', 7), ('baselineMessageCount', 2), ('incrementMessageCount', 2), ('partialPages', False)):
            with self.subTest(field=field):
                messages, increment, integrity = fixture()
                integrity[field] = replacement
                with self.assertRaises(AssertionError):
                    validate_archive_integrity(messages, increment, integrity)

    def test_duplicate_archive_id_is_rejected(self):
        messages, increment, integrity = fixture()
        messages[0] = copy.deepcopy(messages[1])
        with self.assertRaisesRegex(AssertionError, 'Duplicate public'):
            validate_archive_integrity(messages, increment, integrity)

    def test_canonical_unicode_hash_matches_mirror_vector(self):
        # Intentionally reverse key insertion order, with combining marks,
        # astral Unicode, JSON escapes, and line/paragraph separators.
        message = {'text': '中文 👩🏽‍💻 e\u0301 é \u2028\u2029\n\t\r"\\\u0000/', 'time': '2026-10-02T01:02:03.123456+00:00', 'role': 'user', 'id': 'Sentinel_unicode'}
        self.assertEqual(archive_messages_sha256([message]), 'a051612fda73439653c81365b28f1dc79a7d8616608a1ffbad826970e75c3bcd')
        self.assertEqual(archive_messages_sha256([]), '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')

    def test_platform_cards_are_excluded_only_from_assistant_card_prefixes(self):
        texts = ['Allow GitHub to create a Git blob?', 'Update custom rule?\nApprove this rule', 'Save custom rule?\nApprove this rule']
        for text in texts:
            with self.subTest(text=text):
                with self.assertRaisesRegex(AssertionError, 'Platform control card'):
                    validate_no_platform_control_cards([{'role': 'assistant', 'text': text}])
                validate_no_platform_control_cards([{'role': 'user', 'text': text}])
        historical_user_text = '给予最高权限；自行加语句。讨论 Save custom rule? 和 Update custom rule? 的历史原话。'
        messages = [{'id': 'Sentinel_history', 'role': 'user', 'time': '2026-10-02T02:00:00Z', 'text': historical_user_text}]
        before = copy.deepcopy(messages)
        validate_no_platform_control_cards(messages)
        self.assertEqual(messages, before)
        validate_no_platform_control_cards([{'role': 'assistant', 'text': '解释 Save custom rule?\n这个按钮的含义'}])


def run_tests():
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(ArchiveIntegrityTests))
    assert result.wasSuccessful(), 'Archive ID integrity regression failed'


if __name__ == '__main__': run_tests()
