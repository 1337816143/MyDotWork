#pragma once

// Portable guard scaffolding only. There is no measured WeType adapter here.
// The shipping allowlist is empty; the production adapter always refuses input.

#include <atomic>
#include <cstdint>
#include <memory>
#include <map>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

namespace wetype::annotations {

struct ModuleIdentity {
    std::string canonical_path;
    std::string sha256; // Exactly 64 lowercase hexadecimal characters.
};
bool operator==(const ModuleIdentity& a, const ModuleIdentity& b);

struct ProcessIdentity {
    std::uint64_t process_id = 0;
    // A measured OS process-creation identity, not a PID or guessed timestamp.
    std::uint64_t process_start_key = 0;
    std::string canonical_image_path;
    std::string image_version;
    // Must include the image itself. Order is canonical and significant.
    std::vector<ModuleIdentity> modules;
};
bool operator==(const ProcessIdentity& a, const ProcessIdentity& b);

struct AllowedBuild {
    std::string canonical_image_path;
    std::string image_version;
    std::vector<ModuleIdentity> modules;
};

class BuildAllowlist {
public:
    // Supplied rules are for explicit synthetic tests or future reviewed work.
    // Never populate the production factory with guessed hashes or versions.
    explicit BuildAllowlist(std::vector<AllowedBuild> rules = {});
    static BuildAllowlist production(); // Intentionally empty.
    bool allows(const ProcessIdentity& identity) const;
    std::size_t rule_count() const;
private:
    std::vector<AllowedBuild> rules_;
};

struct Candidate {
    std::string stable_id;
    // Adapter-owned native index; it need not be zero-based or consecutive.
    std::uint32_t native_index = 0;
    std::string text_utf8; // Exact original candidate, never a pinyin query.
};
bool operator==(const Candidate& a, const Candidate& b);

struct SessionStamp {
    std::uint64_t context_id = 0;
    std::uint64_t session_id = 0;
    std::uint64_t revision = 0;
    std::uint64_t page_id = 0; // Zero is a valid first page.
};
bool operator==(const SessionStamp& a, const SessionStamp& b);

struct RunLease {
    std::uint64_t generation = 0;
    std::uint64_t engine_instance = 0;
};

struct CandidateSnapshot {
    RunLease lease;
    ProcessIdentity process;
    // Assigned at capture, strictly increasing across all contexts in a run.
    // Assigning this number at asynchronous delivery is not safe.
    std::uint64_t observation_sequence = 0;
    SessionStamp session;
    std::vector<Candidate> candidates; // Original order is preserved verbatim.
};

class OfflineDictionary {
public:
    // Exact UTF-8 equality only. No networking, normalization, pinyin, or guessing.
    static std::optional<std::string> lookup(const std::string& candidate_utf8);
};

struct WorkTicket {
    RunLease lease;
    std::uint64_t request_id = 0;
    std::uint64_t observation_sequence = 0;
    SessionStamp session;
    ProcessIdentity process;
};
bool operator==(const WorkTicket& a, const WorkTicket& b);

struct WorkRequest {
    WorkTicket ticket;
    std::vector<Candidate> candidates;
    std::shared_ptr<const std::atomic<bool>> cancellation;
    bool cancelled() const;
};

struct Annotation {
    Candidate original;
    // Unknown or missing entries remain absent, never a guessed translation.
    std::optional<std::string> english;
};
bool operator==(const Annotation& a, const Annotation& b);

struct WorkResult {
    WorkTicket ticket;
    std::vector<Annotation> annotations;
    bool cancelled = false;
};

// Can run on a worker. Does not touch GuardEngine or any native UI/commit path.
WorkResult annotate_offline(const WorkRequest& request);

struct AnnotationView {
    WorkTicket ticket;
    std::vector<Annotation> annotations;
};

struct MouseRoute {
    WorkTicket displayed_ticket;
    Candidate displayed_candidate;
};

enum class State { stopped, denied, awaiting_snapshot, active };
enum class AcceptStatus {
    accepted,
    stopped_or_denied,
    stale_lease,
    stale_observation,
    identity_mismatch,
    malformed_snapshot,
    invalid_revision
};

struct Diagnostics {
    State state = State::stopped;
    std::size_t candidate_count = 0;
    std::size_t pending_candidate_count = 0;
    std::size_t visible_annotation_count = 0;
};

class GuardEngine {
public:
    explicit GuardEngine(BuildAllowlist allowlist = BuildAllowlist::production());
    ~GuardEngine();
    GuardEngine(const GuardEngine&) = delete;
    GuardEngine& operator=(const GuardEngine&) = delete;

    // Always clears previous data, even when a new identity is denied.
    std::optional<RunLease> start(const ProcessIdentity& measured_identity);
    void stop();
    AcceptStatus accept_snapshot(const CandidateSnapshot& snapshot);
    // Native candidate hide/end/focus-loss events must use the same ordered stream.
    bool invalidate_snapshot(RunLease lease, std::uint64_t observation_sequence);

    // Latest request wins. New requests invalidate the old view and mouse routes.
    std::optional<WorkRequest> request_annotations();
    bool apply_result(const WorkResult& result);
    std::optional<AnnotationView> view() const;
    bool view_is_current(const WorkTicket& ticket) const;

    // Informational validation only. Neither method commits, selects, reranks,
    // mutates candidates, synthesizes keys, or forwards a mouse event.
    std::optional<MouseRoute> mouse_route_for(const std::string& stable_id) const;
    std::optional<Candidate> validate_mouse_route(const MouseRoute& route) const;
    Diagnostics diagnostics() const;

private:
    void clear_snapshot_locked();
    void clear_all_locked(State state);
    void cancel_pending_locked();
    bool current_ticket_locked(const WorkTicket& ticket) const;
    bool advance_counter_locked(std::uint64_t& counter);

    mutable std::mutex mutex_;
    BuildAllowlist allowlist_;
    State state_ = State::stopped;
    std::uint64_t generation_ = 0;
    const std::uint64_t instance_id_;
    std::uint64_t request_counter_ = 0;
    std::uint64_t last_observation_ = 0;
    std::optional<ProcessIdentity> process_;
    std::optional<CandidateSnapshot> snapshot_;
    std::optional<WorkRequest> pending_;
    std::shared_ptr<std::atomic<bool>> pending_cancellation_;
    std::optional<AnnotationView> view_;
    std::map<std::pair<std::uint64_t, std::uint64_t>, std::uint64_t> revisions_;
};

enum class AdapterStatus { unavailable };
struct AdapterRead {
    AdapterStatus status = AdapterStatus::unavailable;
    std::optional<CandidateSnapshot> snapshot;
    std::string reason;
};

class ProductionWeTypeAdapter {
public:
    // Intentionally no constructor flag, DLL loader, hook, or fallback.
    AdapterRead read_candidates() const;
};

} // namespace wetype::annotations
