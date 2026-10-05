#include "candidate_guard.hpp"

#include <atomic>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <thread>
#include <utility>

using namespace wetype::annotations;

namespace {

// Every identity, version, hash, candidate ID, and sequence in this file is a
// SYNTHETIC TEST FIXTURE. None was captured from WeType or any live process.
int assertions = 0;
#define REQUIRE(expression) do { ++assertions; if (!(expression)) \
    throw std::runtime_error(std::string(__func__) + ": " + #expression); } while (false)

ProcessIdentity synthetic_process() {
    return {73, 9001, "synthetic://fixture/WeType-NOT-REAL.exe", "SYNTHETIC-ONLY-0.0",
            {{"synthetic://fixture/WeType-NOT-REAL.exe", std::string(64, 'a')},
             {"synthetic://fixture/candidate-NOT-REAL.dll", std::string(64, 'b')}}};
}
BuildAllowlist synthetic_allowlist() {
    const auto p = synthetic_process();
    return BuildAllowlist({{p.canonical_image_path, p.image_version, p.modules}});
}
std::vector<Candidate> synthetic_candidates() {
    return {{"fixture-a", 4, u8"开发"}, {"fixture-b", 7, u8"学习"},
            {"fixture-c", 9, u8"词典"}, {"fixture-d", 12, u8"开发"},
            {"fixture-e", 15, u8"未知词"}};
}
struct Fixture {
    ProcessIdentity process = synthetic_process();
    GuardEngine engine{synthetic_allowlist()};
    RunLease lease;
    Fixture() {
        const auto started = engine.start(process);
        if (!started) throw std::runtime_error("Synthetic fixture failed to start");
        lease = *started;
    }
    CandidateSnapshot frame(std::uint64_t sequence = 1, std::uint64_t revision = 1) const {
        return {lease, process, sequence, {100, 200, revision, 0}, synthetic_candidates()};
    }
    WorkRequest pending() {
        REQUIRE(engine.accept_snapshot(frame()) == AcceptStatus::accepted);
        const auto request = engine.request_annotations();
        REQUIRE(request.has_value());
        return *request;
    }
    AnnotationView visible() {
        const auto request = pending();
        REQUIRE(engine.apply_result(annotate_offline(request)));
        const auto result = engine.view();
        REQUIRE(result.has_value());
        return *result;
    }
};

void production_is_disabled() {
    const auto p = synthetic_process();
    REQUIRE(BuildAllowlist::production().rule_count() == 0);
    REQUIRE(!BuildAllowlist::production().allows(p));
    GuardEngine engine;
    REQUIRE(!engine.start(p));
    REQUIRE(engine.diagnostics().state == State::denied);
    REQUIRE(!engine.request_annotations());
    ProductionWeTypeAdapter adapter;
    for (int i = 0; i < 3; ++i) {
        const auto read = adapter.read_candidates();
        REQUIRE(read.status == AdapterStatus::unavailable);
        REQUIRE(!read.snapshot);
        REQUIRE(read.reason.find("not been measured") != std::string::npos);
    }
}

void exact_dictionary_only() {
    REQUIRE(OfflineDictionary::lookup(u8"开发") == std::optional<std::string>("development"));
    REQUIRE(OfflineDictionary::lookup(u8"学习") == std::optional<std::string>("learning"));
    REQUIRE(OfflineDictionary::lookup(u8"词典") == std::optional<std::string>("dictionary"));
    for (const auto* unknown : {"", "kaifa", "kai fa", "xuexi", "cidian", "development",
                               u8"开发者", u8" 开发", u8"开发 ", u8"開發", u8"学习开发"}) {
        REQUIRE(!OfflineDictionary::lookup(unknown));
    }
}

void valid_build_and_fail_closed_mismatches() {
    const auto allowlist = synthetic_allowlist();
    REQUIRE(allowlist.allows(synthetic_process()));
    const std::vector<std::function<void(ProcessIdentity&)>> changes = {
        [](auto& p) { p.process_id = 0; },
        [](auto& p) { p.process_start_key = 0; },
        [](auto& p) { p.canonical_image_path += ".other"; },
        [](auto& p) { p.image_version += ".other"; },
        [](auto& p) { p.image_version.clear(); },
        [](auto& p) { p.modules[0].sha256[0] = 'c'; },
        [](auto& p) { p.modules[1].sha256[0] = 'd'; },
        [](auto& p) { p.modules[0].sha256[0] = 'A'; },
        [](auto& p) { p.modules[0].sha256[0] = 'z'; },
        [](auto& p) { p.modules[0].sha256.pop_back(); },
        [](auto& p) { p.modules[1].canonical_path += ".other"; },
        [](auto& p) { p.modules.clear(); },
        [](auto& p) { p.modules.erase(p.modules.begin()); },
        [](auto& p) { p.modules.pop_back(); },
        [](auto& p) { p.modules.push_back(p.modules[0]); },
        [](auto& p) { p.modules.push_back({"synthetic://extra.dll", std::string(64, 'c')}); },
        [](auto& p) { std::swap(p.modules[0], p.modules[1]); }
    };
    for (const auto& change : changes) {
        auto p = synthetic_process(); change(p);
        REQUIRE(!allowlist.allows(p));
    }
    auto malformed = synthetic_process();
    malformed.modules[0].sha256 = "not-a-hash";
    BuildAllowlist bad({{malformed.canonical_image_path, malformed.image_version, malformed.modules}});
    REQUIRE(!bad.allows(malformed));
}

void preserve_candidates_order_indices_and_duplicates() {
    Fixture f;
    const auto original = f.frame();
    const auto visible = f.visible();
    REQUIRE(visible.annotations.size() == original.candidates.size());
    for (std::size_t i = 0; i < original.candidates.size(); ++i)
        REQUIRE(visible.annotations[i].original == original.candidates[i]);
    REQUIRE(visible.annotations[0].english == visible.annotations[3].english);
    REQUIRE(visible.annotations[0].original.stable_id != visible.annotations[3].original.stable_id);
    REQUIRE(!visible.annotations[4].english);
    REQUIRE(f.engine.view_is_current(visible.ticket));
    REQUIRE(!f.engine.mouse_route_for("fixture-e"));
    const auto route = f.engine.mouse_route_for("fixture-d");
    REQUIRE(route);
    const auto target = f.engine.validate_mouse_route(*route);
    REQUIRE(target && target->stable_id == "fixture-d" && target->native_index == 12);
}

void caller_mutation_does_not_change_owned_state() {
    Fixture f;
    auto frame = f.frame();
    REQUIRE(f.engine.accept_snapshot(frame) == AcceptStatus::accepted);
    frame.candidates[0].text_utf8 = "modified by caller";
    auto request = f.engine.request_annotations();
    REQUIRE(request && request->candidates[0].text_utf8 == u8"开发");
    const auto correct = annotate_offline(*request);
    request->candidates[0].text_utf8 = "modified request";
    REQUIRE(f.engine.apply_result(correct));
    auto view = f.engine.view();
    view->annotations[0].english = "modified view";
    REQUIRE(f.engine.view()->annotations[0].english == std::optional<std::string>("development"));
}

void latest_revision_rejects_late_result() {
    Fixture f;
    const auto old_request = f.pending();
    const auto old_result = annotate_offline(old_request);
    REQUIRE(f.engine.accept_snapshot(f.frame(2, 2)) == AcceptStatus::accepted);
    REQUIRE(old_request.cancelled());
    const auto latest = f.engine.request_annotations();
    REQUIRE(latest);
    REQUIRE(!f.engine.apply_result(old_result));
    REQUIRE(f.engine.diagnostics().pending_candidate_count == 5);
    REQUIRE(f.engine.apply_result(annotate_offline(*latest)));
    REQUIRE(f.engine.view()->ticket.session.revision == 2);
}

void latest_request_rejects_late_result() {
    Fixture f;
    const auto first = f.pending();
    const auto first_result = annotate_offline(first);
    const auto second = f.engine.request_annotations();
    REQUIRE(second && first.cancelled());
    REQUIRE(second->ticket.request_id != first.ticket.request_id);
    REQUIRE(!f.engine.apply_result(first_result));
    REQUIRE(f.engine.apply_result(annotate_offline(*second)));
    REQUIRE(!f.engine.apply_result(annotate_offline(*second))); // One-shot consumption.
    REQUIRE(f.engine.view()->ticket == second->ticket);
}

void late_session_context_and_page_results() {
    for (int change = 0; change < 3; ++change) {
        Fixture f;
        const auto old_request = f.pending();
        const auto result = annotate_offline(old_request);
        auto next = f.frame(2, 2);
        if (change == 0) { next.session.session_id = 201; next.session.revision = 1; }
        if (change == 1) { next.session.context_id = 101; next.session.revision = 1; }
        if (change == 2) { next.session.page_id = 1; }
        REQUIRE(f.engine.accept_snapshot(next) == AcceptStatus::accepted);
        REQUIRE(!f.engine.apply_result(result));
        REQUIRE(!f.engine.view());
    }
}

void reject_replayed_capture_without_clearing_current_view() {
    Fixture f;
    const auto shown = f.visible();
    REQUIRE(f.engine.accept_snapshot(f.frame()) == AcceptStatus::stale_observation);
    REQUIRE(f.engine.accept_snapshot(f.frame(0, 99)) == AcceptStatus::stale_observation);
    REQUIRE(f.engine.view_is_current(shown.ticket));
}

void revisions_remain_monotonic_after_hide_and_bad_frame() {
    for (int change = 0; change < 3; ++change) {
        Fixture f;
        f.visible();
        if (change == 0) REQUIRE(f.engine.invalidate_snapshot(f.lease, 2));
        if (change == 1) {
            auto bad = f.frame(2, 2); bad.candidates[0].stable_id.clear();
            REQUIRE(f.engine.accept_snapshot(bad) == AcceptStatus::malformed_snapshot);
        }
        if (change == 2) {
            REQUIRE(f.engine.accept_snapshot(f.frame(2, 1)) == AcceptStatus::invalid_revision);
        }
        REQUIRE(f.engine.accept_snapshot(f.frame(3, 1)) == AcceptStatus::invalid_revision);
        REQUIRE(!f.engine.view());
        REQUIRE(f.engine.accept_snapshot(f.frame(4, 2)) == AcceptStatus::accepted);
    }
}

void page_change_requires_revision_change() {
    Fixture f; f.visible();
    auto page = f.frame(2, 1); page.session.page_id = 1;
    REQUIRE(f.engine.accept_snapshot(page) == AcceptStatus::invalid_revision);
    REQUIRE(!f.engine.view());
}

void malformed_new_snapshots_clear_sensitive_state() {
    const std::vector<std::function<void(CandidateSnapshot&)>> changes = {
        [](auto& s) { s.session.context_id = 0; },
        [](auto& s) { s.session.session_id = 0; },
        [](auto& s) { s.session.revision = 0; },
        [](auto& s) { s.candidates[0].stable_id.clear(); },
        [](auto& s) { s.candidates[0].stable_id = std::string("id\0tail", 7); },
        [](auto& s) { s.candidates[0].text_utf8.clear(); },
        [](auto& s) { s.candidates[0].text_utf8 = std::string("x\0y", 3); },
        [](auto& s) { s.candidates[1].stable_id = s.candidates[0].stable_id; },
        [](auto& s) { s.candidates[1].native_index = s.candidates[0].native_index; },
        [](auto& s) { s.candidates[0].text_utf8 = std::string(16385, 'x'); },
        [](auto& s) { s.candidates[0].stable_id = std::string(4097, 'x'); },
        [](auto& s) { s.candidates.resize(257); }
    };
    for (const auto& change : changes) {
        Fixture f; const auto old = f.pending();
        auto snapshot = f.frame(2, 2); change(snapshot);
        REQUIRE(f.engine.accept_snapshot(snapshot) == AcceptStatus::malformed_snapshot);
        REQUIRE(old.cancelled());
        const auto diagnostics = f.engine.diagnostics();
        REQUIRE(diagnostics.candidate_count == 0);
        REQUIRE(diagnostics.pending_candidate_count == 0);
        REQUIRE(diagnostics.visible_annotation_count == 0);
    }
}

void reject_invalid_utf8_without_guessing() {
    const std::vector<std::string> invalid = {
        std::string("\x80", 1), std::string("\xc0\xaf", 2), std::string("\xe0\x80\xaf", 3),
        std::string("\xed\xa0\x80", 3), std::string("\xf4\x90\x80\x80", 4),
        std::string("\xf5\x80\x80\x80", 4), std::string("\xe5\xbc", 2),
        std::string("\xe5\x41\x80", 3)
    };
    for (const auto& bytes : invalid) {
        Fixture f; auto frame = f.frame(); frame.candidates[0].text_utf8 = bytes;
        REQUIRE(f.engine.accept_snapshot(frame) == AcceptStatus::malformed_snapshot);
    }
    Fixture f; auto frame = f.frame(); frame.candidates[0].text_utf8 = u8"😀";
    REQUIRE(f.engine.accept_snapshot(frame) == AcceptStatus::accepted);
    const auto request = f.engine.request_annotations();
    REQUIRE(request && !annotate_offline(*request).annotations[0].english);
}

void empty_and_unknown_candidates_do_not_create_translations() {
    Fixture f; auto frame = f.frame(); frame.candidates.clear();
    REQUIRE(f.engine.accept_snapshot(frame) == AcceptStatus::accepted);
    auto request = f.engine.request_annotations();
    REQUIRE(request && f.engine.apply_result(annotate_offline(*request)));
    REQUIRE(f.engine.view()->annotations.empty());
    frame = f.frame(2, 2);
    frame.candidates = {{"unknown-1", 99, "kaifa"}, {"unknown-2", 100, u8"未收录"}};
    REQUIRE(f.engine.accept_snapshot(frame) == AcceptStatus::accepted);
    request = f.engine.request_annotations();
    REQUIRE(request && f.engine.apply_result(annotate_offline(*request)));
    REQUIRE(!f.engine.view()->annotations[0].english);
    REQUIRE(!f.engine.view()->annotations[1].english);
    REQUIRE(!f.engine.mouse_route_for("unknown-1"));
}

void malformed_or_forged_results_never_rewrite_candidates() {
    const std::vector<std::function<void(WorkResult&)>> changes = {
        [](auto& r) { r.annotations.pop_back(); },
        [](auto& r) { r.annotations.push_back(r.annotations[0]); },
        [](auto& r) { r.annotations[0].original.text_utf8 = u8"学习"; },
        [](auto& r) { r.annotations[0].original.native_index = 100; },
        [](auto& r) { r.annotations[0].original.stable_id = "wrong"; },
        [](auto& r) { std::swap(r.annotations[0], r.annotations[1]); },
        [](auto& r) { r.annotations[0].english = "wrong"; },
        [](auto& r) { r.annotations[0].english = ""; },
        [](auto& r) { r.annotations[0].english.reset(); },
        [](auto& r) { r.annotations[4].english = "guessed"; },
        [](auto& r) { r.annotations[4].english = ""; },
        [](auto& r) { r.cancelled = true; }
    };
    for (const auto& change : changes) {
        Fixture f; const auto request = f.pending();
        auto result = annotate_offline(request); change(result);
        REQUIRE(!f.engine.apply_result(result));
        REQUIRE(!f.engine.view());
        REQUIRE(f.engine.diagnostics().pending_candidate_count == 0);
        REQUIRE(f.engine.diagnostics().candidate_count == 5);
        const auto retry = f.engine.request_annotations();
        REQUIRE(retry && f.engine.apply_result(annotate_offline(*retry)));
    }
}

void forged_ticket_is_rejected_without_consuming_current_request() {
    const std::vector<std::function<void(WorkTicket&)>> changes = {
        [](auto& t) { ++t.lease.generation; }, [](auto& t) { ++t.lease.engine_instance; },
        [](auto& t) { ++t.request_id; }, [](auto& t) { ++t.observation_sequence; },
        [](auto& t) { ++t.session.context_id; }, [](auto& t) { ++t.session.session_id; },
        [](auto& t) { ++t.session.revision; }, [](auto& t) { ++t.session.page_id; },
        [](auto& t) { ++t.process.process_id; }, [](auto& t) { ++t.process.process_start_key; },
        [](auto& t) { t.process.modules[0].sha256[0] = 'c'; }
    };
    for (const auto& change : changes) {
        Fixture f; const auto request = f.pending();
        auto bad = annotate_offline(request); change(bad.ticket);
        REQUIRE(!f.engine.apply_result(bad));
        REQUIRE(f.engine.apply_result(annotate_offline(request)));
    }
}

void stale_mouse_routes_never_resolve() {
    for (int change = 0; change < 7; ++change) {
        Fixture f; const auto old_view = f.visible();
        const auto route = f.engine.mouse_route_for("fixture-a");
        REQUIRE(route && f.engine.validate_mouse_route(*route));
        auto next = f.frame(2, 2);
        if (change == 0) { ++next.session.page_id; }
        if (change == 1) { ++next.session.session_id; }
        if (change == 2) { ++next.session.context_id; }
        if (change == 3) { std::swap(next.candidates[0], next.candidates[1]); }
        if (change < 4) REQUIRE(f.engine.accept_snapshot(next) == AcceptStatus::accepted);
        if (change == 4) f.engine.stop();
        if (change == 5) REQUIRE(f.engine.invalidate_snapshot(f.lease, 2));
        if (change == 6) REQUIRE(f.engine.request_annotations());
        REQUIRE(!f.engine.validate_mouse_route(*route));
        REQUIRE(!f.engine.view_is_current(old_view.ticket));
    }
}

void forged_mouse_routes_and_unknown_ids_are_rejected() {
    Fixture f; f.visible();
    REQUIRE(!f.engine.mouse_route_for("not-present"));
    auto route = *f.engine.mouse_route_for("fixture-a");
    route.displayed_candidate.native_index = 12;
    REQUIRE(!f.engine.validate_mouse_route(route));
    route = *f.engine.mouse_route_for("fixture-a");
    route.displayed_candidate.stable_id = "fixture-d";
    REQUIRE(!f.engine.validate_mouse_route(route));
    route = *f.engine.mouse_route_for("fixture-a");
    route.displayed_candidate.text_utf8 = u8"学习";
    REQUIRE(!f.engine.validate_mouse_route(route));
}

void process_changes_and_pid_reuse_revoke_run() {
    const std::vector<std::function<void(ProcessIdentity&)>> changes = {
        [](auto& p) { ++p.process_id; }, [](auto& p) { ++p.process_start_key; },
        [](auto& p) { p.image_version += "-changed"; },
        [](auto& p) { p.modules[0].sha256[0] = 'c'; },
        [](auto& p) { p.modules[1].sha256[0] = 'c'; }
    };
    for (const auto& change : changes) {
        Fixture f; const auto pending = f.pending();
        const auto result = annotate_offline(pending);
        auto next = f.frame(2, 2); change(next.process);
        REQUIRE(f.engine.accept_snapshot(next) == AcceptStatus::identity_mismatch);
        REQUIRE(pending.cancelled());
        REQUIRE(!f.engine.apply_result(result));
        REQUIRE(f.engine.diagnostics().state == State::denied);
        REQUIRE(f.engine.diagnostics().candidate_count == 0);
        REQUIRE(!f.engine.request_annotations());
    }
}

void stop_clears_and_cancels_all_internal_data() {
    Fixture f; const auto request = f.pending();
    const auto result = annotate_offline(request);
    f.engine.stop(); f.engine.stop();
    REQUIRE(request.cancelled());
    const auto cancelled_result = annotate_offline(request);
    REQUIRE(cancelled_result.cancelled && cancelled_result.annotations.empty());
    REQUIRE(!f.engine.apply_result(result));
    const auto d = f.engine.diagnostics();
    REQUIRE(d.state == State::stopped && d.candidate_count == 0 &&
            d.pending_candidate_count == 0 && d.visible_annotation_count == 0);
    REQUIRE(!f.engine.view());
    REQUIRE(!f.engine.request_annotations());
    REQUIRE(f.engine.accept_snapshot(f.frame(2, 2)) == AcceptStatus::stopped_or_denied);
}

void restart_rejects_old_lease_and_results() {
    Fixture f; const auto old_request = f.pending();
    const auto old_result = annotate_offline(old_request);
    const auto lease = f.engine.start(f.process);
    REQUIRE(lease && lease->generation != f.lease.generation);
    REQUIRE(old_request.cancelled());
    REQUIRE(f.engine.accept_snapshot(f.frame(100, 100)) == AcceptStatus::stale_lease);
    REQUIRE(!f.engine.invalidate_snapshot(f.lease, 100));
    f.lease = *lease;
    REQUIRE(f.engine.accept_snapshot(f.frame()) == AcceptStatus::accepted);
    const auto fresh = f.engine.request_annotations();
    REQUIRE(fresh && !f.engine.apply_result(old_result));
    REQUIRE(f.engine.apply_result(annotate_offline(*fresh)));
}

void denied_restart_clears_existing_view() {
    Fixture f; const auto shown = f.visible();
    auto denied = f.process; denied.image_version = "unapproved";
    REQUIRE(!f.engine.start(denied));
    REQUIRE(!f.engine.view() && !f.engine.view_is_current(shown.ticket));
    REQUIRE(f.engine.diagnostics().candidate_count == 0);
}

void cross_engine_requests_cannot_be_replayed() {
    Fixture a; Fixture b;
    const auto request_a = a.pending(); const auto request_b = b.pending();
    REQUIRE(request_a.ticket.lease.engine_instance != request_b.ticket.lease.engine_instance);
    REQUIRE(!b.engine.apply_result(annotate_offline(request_a)));
    REQUIRE(b.engine.apply_result(annotate_offline(request_b)));
    REQUIRE(b.engine.accept_snapshot(a.frame(2, 2)) == AcceptStatus::stale_lease);
}

void stale_hide_does_not_remove_newer_view() {
    Fixture f; const auto shown = f.visible();
    REQUIRE(!f.engine.invalidate_snapshot(f.lease, 0));
    REQUIRE(!f.engine.invalidate_snapshot(f.lease, 1));
    REQUIRE(f.engine.view_is_current(shown.ticket));
    REQUIRE(f.engine.invalidate_snapshot(f.lease, 2));
    REQUIRE(!f.engine.view());
    REQUIRE(f.engine.accept_snapshot(f.frame(1, 2)) == AcceptStatus::stale_observation);
}

void session_revision_history_is_bounded_fail_closed() {
    Fixture f;
    for (std::uint64_t i = 1; i <= 4096; ++i) {
        auto frame = f.frame(i, 1); frame.session.session_id = i;
        frame.candidates.clear();
        REQUIRE(f.engine.accept_snapshot(frame) == AcceptStatus::accepted);
    }
    auto overflow = f.frame(4097, 1); overflow.session.session_id = 4097;
    REQUIRE(f.engine.accept_snapshot(overflow) == AcceptStatus::malformed_snapshot);
    REQUIRE(f.engine.diagnostics().state == State::denied);
    REQUIRE(!f.engine.request_annotations());
}

void externally_held_worker_is_cancelled_after_engine_destruction() {
    std::optional<WorkRequest> held;
    { Fixture f; held = f.pending(); }
    REQUIRE(held && held->cancelled());
    REQUIRE(annotate_offline(*held).cancelled);
    WorkRequest invalid;
    REQUIRE(invalid.cancelled());
    REQUIRE(annotate_offline(invalid).cancelled);
}

void simultaneous_stop_and_worker_results_are_safe() {
    for (int iteration = 0; iteration < 32; ++iteration) {
        Fixture f; const auto request = f.pending();
        std::atomic<bool> go{false};
        std::thread worker([&] {
            while (!go.load(std::memory_order_acquire)) std::this_thread::yield();
            f.engine.apply_result(annotate_offline(request));
        });
        std::thread reader([&] {
            while (!go.load(std::memory_order_acquire)) std::this_thread::yield();
            for (int i = 0; i < 16; ++i) {
                f.engine.view(); f.engine.diagnostics(); f.engine.mouse_route_for("fixture-a");
            }
        });
        go.store(true, std::memory_order_release);
        f.engine.stop();
        worker.join(); reader.join();
        REQUIRE(!f.engine.view());
        REQUIRE(request.cancelled());
        REQUIRE(f.engine.diagnostics().state == State::stopped);
        REQUIRE(!f.engine.apply_result(annotate_offline(request)));
    }
}

} // namespace

int main() {
    const std::vector<std::pair<const char*, std::function<void()>>> tests = {
        {"production is disabled", production_is_disabled},
        {"exact dictionary only", exact_dictionary_only},
        {"build allowlist mismatches", valid_build_and_fail_closed_mismatches},
        {"candidate order and duplicate words", preserve_candidates_order_indices_and_duplicates},
        {"owned state is not caller-mutated", caller_mutation_does_not_change_owned_state},
        {"late revision result", latest_revision_rejects_late_result},
        {"latest request wins", latest_request_rejects_late_result},
        {"late session/context/page", late_session_context_and_page_results},
        {"capture replay", reject_replayed_capture_without_clearing_current_view},
        {"revision floor survives hide/bad frame", revisions_remain_monotonic_after_hide_and_bad_frame},
        {"page revision requirement", page_change_requires_revision_change},
        {"malformed snapshots clear state", malformed_new_snapshots_clear_sensitive_state},
        {"invalid UTF-8", reject_invalid_utf8_without_guessing},
        {"empty and missing translations", empty_and_unknown_candidates_do_not_create_translations},
        {"malformed results", malformed_or_forged_results_never_rewrite_candidates},
        {"forged result tickets", forged_ticket_is_rejected_without_consuming_current_request},
        {"stale mouse routes", stale_mouse_routes_never_resolve},
        {"forged mouse routes", forged_mouse_routes_and_unknown_ids_are_rejected},
        {"process identity and PID reuse", process_changes_and_pid_reuse_revoke_run},
        {"stop clears pending data", stop_clears_and_cancels_all_internal_data},
        {"restart lease", restart_rejects_old_lease_and_results},
        {"denied restart clears view", denied_restart_clears_existing_view},
        {"cross-engine replay", cross_engine_requests_cannot_be_replayed},
        {"stale hide events", stale_hide_does_not_remove_newer_view},
        {"bounded revision history", session_revision_history_is_bounded_fail_closed},
        {"destruction cancellation", externally_held_worker_is_cancelled_after_engine_destruction},
        {"concurrent stop/result/read", simultaneous_stop_and_worker_results_are_safe}
    };
    std::cout << "SYNTHETIC PORTABLE CORE TESTS; NOT A WETYPE INTEGRATION TEST\n";
    try {
        for (const auto& test : tests) {
            test.second();
            std::cout << "PASS " << test.first << '\n';
        }
    } catch (const std::exception& error) {
        std::cerr << "FAIL " << error.what() << '\n';
        return 1;
    }
    std::cout << "PASS " << tests.size() << " cases, " << assertions << " assertions\n";
    return 0;
}
