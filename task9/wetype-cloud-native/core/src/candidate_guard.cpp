#include "candidate_guard.hpp"

#include <algorithm>
#include <limits>
#include <set>
#include <utility>

namespace wetype::annotations {
namespace {

constexpr std::size_t kMaxCandidates = 256;
constexpr std::size_t kMaxCandidateBytes = 16384;
constexpr std::size_t kMaxIdentityBytes = 4096;

std::uint64_t reserve_instance_id() {
    static std::atomic<std::uint64_t> next{0};
    auto current = next.load(std::memory_order_relaxed);
    while (current != std::numeric_limits<std::uint64_t>::max()) {
        if (next.compare_exchange_weak(current, current + 1, std::memory_order_relaxed))
            return current + 1;
    }
    return 0; // Exhaustion must never wrap into an old engine identity.
}

bool valid_token(const std::string& text, std::size_t max_bytes) {
    return !text.empty() && text.size() <= max_bytes &&
           text.find('\0') == std::string::npos;
}

bool valid_utf8(const std::string& text) {
    std::size_t i = 0;
    while (i < text.size()) {
        const auto first = static_cast<unsigned char>(text[i++]);
        if (first <= 0x7f) continue;
        unsigned count = 0;
        std::uint32_t point = 0;
        std::uint32_t minimum = 0;
        if (first >= 0xc2 && first <= 0xdf) {
            count = 1; point = first & 0x1fU; minimum = 0x80;
        } else if (first >= 0xe0 && first <= 0xef) {
            count = 2; point = first & 0x0fU; minimum = 0x800;
        } else if (first >= 0xf0 && first <= 0xf4) {
            count = 3; point = first & 0x07U; minimum = 0x10000;
        } else return false;
        if (text.size() - i < count) return false;
        for (unsigned n = 0; n < count; ++n) {
            const auto byte = static_cast<unsigned char>(text[i++]);
            if ((byte & 0xc0U) != 0x80U) return false;
            point = (point << 6U) | (byte & 0x3fU);
        }
        if (point < minimum || point > 0x10ffff ||
            (point >= 0xd800 && point <= 0xdfff)) return false;
    }
    return true;
}

bool valid_modules(const std::vector<ModuleIdentity>& modules,
                   const std::string& image_path) {
    if (modules.empty() || modules.size() > 256) return false;
    std::set<std::string> paths;
    bool contains_image = false;
    for (const auto& module : modules) {
        if (!valid_token(module.canonical_path, kMaxIdentityBytes) ||
            !paths.insert(module.canonical_path).second || module.sha256.size() != 64)
            return false;
        for (const char digit : module.sha256) {
            if (!((digit >= '0' && digit <= '9') ||
                  (digit >= 'a' && digit <= 'f'))) return false;
        }
        contains_image = contains_image || module.canonical_path == image_path;
    }
    return contains_image;
}

bool valid_build(const std::string& path, const std::string& version,
                 const std::vector<ModuleIdentity>& modules) {
    return valid_token(path, kMaxIdentityBytes) && valid_token(version, 128) &&
           valid_modules(modules, path);
}

bool valid_candidates(const CandidateSnapshot& snapshot) {
    if (!snapshot.session.context_id || !snapshot.session.session_id ||
        !snapshot.session.revision || snapshot.candidates.size() > kMaxCandidates)
        return false;
    std::set<std::string> ids;
    std::set<std::uint32_t> indices;
    for (const auto& candidate : snapshot.candidates) {
        if (!valid_token(candidate.stable_id, kMaxIdentityBytes) ||
            !valid_token(candidate.text_utf8, kMaxCandidateBytes) ||
            !valid_utf8(candidate.text_utf8) ||
            !ids.insert(candidate.stable_id).second ||
            !indices.insert(candidate.native_index).second) return false;
    }
    return true;
}

} // namespace

bool operator==(const ModuleIdentity& a, const ModuleIdentity& b) {
    return a.canonical_path == b.canonical_path && a.sha256 == b.sha256;
}
bool operator==(const ProcessIdentity& a, const ProcessIdentity& b) {
    return a.process_id == b.process_id && a.process_start_key == b.process_start_key &&
           a.canonical_image_path == b.canonical_image_path &&
           a.image_version == b.image_version && a.modules == b.modules;
}
bool operator==(const Candidate& a, const Candidate& b) {
    return a.stable_id == b.stable_id && a.native_index == b.native_index &&
           a.text_utf8 == b.text_utf8;
}
bool operator==(const SessionStamp& a, const SessionStamp& b) {
    return a.context_id == b.context_id && a.session_id == b.session_id &&
           a.revision == b.revision && a.page_id == b.page_id;
}
bool operator==(const WorkTicket& a, const WorkTicket& b) {
    return a.lease.generation == b.lease.generation &&
           a.lease.engine_instance == b.lease.engine_instance && a.request_id == b.request_id &&
           a.observation_sequence == b.observation_sequence &&
           a.session == b.session && a.process == b.process;
}
bool operator==(const Annotation& a, const Annotation& b) {
    return a.original == b.original && a.english == b.english;
}

BuildAllowlist::BuildAllowlist(std::vector<AllowedBuild> rules)
    : rules_(std::move(rules)) {}
BuildAllowlist BuildAllowlist::production() { return BuildAllowlist{}; }
std::size_t BuildAllowlist::rule_count() const { return rules_.size(); }
bool BuildAllowlist::allows(const ProcessIdentity& identity) const {
    if (!identity.process_id || !identity.process_start_key ||
        !valid_build(identity.canonical_image_path, identity.image_version,
                     identity.modules)) return false;
    return std::any_of(rules_.begin(), rules_.end(), [&](const AllowedBuild& build) {
        return valid_build(build.canonical_image_path, build.image_version, build.modules) &&
               identity.canonical_image_path == build.canonical_image_path &&
               identity.image_version == build.image_version &&
               identity.modules == build.modules;
    });
}

std::optional<std::string> OfflineDictionary::lookup(const std::string& candidate_utf8) {
    // Handwritten, minimal offline fixture dictionary. Exact candidate strings only.
    if (candidate_utf8 == u8"开发") return "development";
    if (candidate_utf8 == u8"学习") return "learning";
    if (candidate_utf8 == u8"词典") return "dictionary";
    return std::nullopt;
}

bool WorkRequest::cancelled() const {
    return !cancellation || cancellation->load(std::memory_order_acquire);
}
WorkResult annotate_offline(const WorkRequest& request) {
    WorkResult result;
    result.ticket = request.ticket;
    for (const auto& candidate : request.candidates) {
        if (request.cancelled()) {
            result.annotations.clear();
            result.cancelled = true;
            return result;
        }
        result.annotations.push_back({candidate, OfflineDictionary::lookup(candidate.text_utf8)});
    }
    if (request.cancelled()) {
        result.annotations.clear();
        result.cancelled = true;
    }
    return result;
}

GuardEngine::GuardEngine(BuildAllowlist allowlist)
    : allowlist_(std::move(allowlist)), instance_id_(reserve_instance_id()) {}
GuardEngine::~GuardEngine() { stop(); }

void GuardEngine::cancel_pending_locked() {
    if (pending_cancellation_)
        pending_cancellation_->store(true, std::memory_order_release);
    pending_.reset();
    pending_cancellation_.reset();
}
void GuardEngine::clear_snapshot_locked() {
    cancel_pending_locked();
    snapshot_.reset();
    view_.reset();
}
void GuardEngine::clear_all_locked(State state) {
    clear_snapshot_locked();
    process_.reset();
    revisions_.clear();
    last_observation_ = 0;
    state_ = state;
}
bool GuardEngine::advance_counter_locked(std::uint64_t& counter) {
    if (counter == std::numeric_limits<std::uint64_t>::max()) {
        clear_all_locked(State::denied);
        return false;
    }
    ++counter;
    return true;
}
std::optional<RunLease> GuardEngine::start(const ProcessIdentity& identity) {
    std::lock_guard<std::mutex> lock(mutex_);
    clear_all_locked(State::denied);
    if (!instance_id_ || !advance_counter_locked(generation_) || !allowlist_.allows(identity))
        return std::nullopt;
    process_ = identity;
    state_ = State::awaiting_snapshot;
    return RunLease{generation_, instance_id_};
}
void GuardEngine::stop() {
    std::lock_guard<std::mutex> lock(mutex_);
    clear_all_locked(State::stopped);
}
AcceptStatus GuardEngine::accept_snapshot(const CandidateSnapshot& snapshot) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!process_) return AcceptStatus::stopped_or_denied;
    if (snapshot.lease.generation != generation_ || snapshot.lease.engine_instance != instance_id_)
        return AcceptStatus::stale_lease;
    if (snapshot.observation_sequence <= last_observation_)
        return AcceptStatus::stale_observation;
    // A new observation of the wrong process/build revokes the entire run.
    if (!(snapshot.process == *process_) || !allowlist_.allows(snapshot.process)) {
        clear_all_locked(State::denied);
        return AcceptStatus::identity_mismatch;
    }
    last_observation_ = snapshot.observation_sequence;
    if (!valid_candidates(snapshot)) {
        clear_snapshot_locked();
        state_ = State::awaiting_snapshot;
        return AcceptStatus::malformed_snapshot;
    }
    const auto session_key = std::make_pair(snapshot.session.context_id, snapshot.session.session_id);
    const auto previous = revisions_.find(session_key);
    if (previous != revisions_.end() && snapshot.session.revision <= previous->second) {
        clear_snapshot_locked();
        state_ = State::awaiting_snapshot;
        return AcceptStatus::invalid_revision;
    }
    if (previous == revisions_.end() && revisions_.size() >= 4096) {
        clear_all_locked(State::denied);
        return AcceptStatus::malformed_snapshot;
    }
    revisions_[session_key] = snapshot.session.revision;
    clear_snapshot_locked();
    snapshot_ = snapshot;
    state_ = State::active;
    return AcceptStatus::accepted;
}
bool GuardEngine::invalidate_snapshot(RunLease lease, std::uint64_t sequence) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!process_ || lease.generation != generation_ || lease.engine_instance != instance_id_ ||
        sequence <= last_observation_)
        return false;
    last_observation_ = sequence;
    clear_snapshot_locked();
    state_ = State::awaiting_snapshot;
    return true;
}
std::optional<WorkRequest> GuardEngine::request_annotations() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!snapshot_ || !process_ || state_ != State::active) return std::nullopt;
    cancel_pending_locked();
    view_.reset();
    if (!advance_counter_locked(request_counter_)) return std::nullopt;
    pending_cancellation_ = std::make_shared<std::atomic<bool>>(false);
    WorkRequest request;
    request.ticket = {{generation_, instance_id_}, request_counter_, snapshot_->observation_sequence,
                      snapshot_->session, *process_};
    request.candidates = snapshot_->candidates;
    request.cancellation = pending_cancellation_;
    pending_ = request;
    return request;
}
bool GuardEngine::current_ticket_locked(const WorkTicket& ticket) const {
    return process_ && snapshot_ && state_ == State::active &&
           ticket.lease.generation == generation_ &&
           ticket.lease.engine_instance == instance_id_ &&
           ticket.observation_sequence == snapshot_->observation_sequence &&
           ticket.session == snapshot_->session && ticket.process == *process_;
}
bool GuardEngine::apply_result(const WorkResult& result) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!pending_ || !current_ticket_locked(result.ticket) ||
        !(result.ticket == pending_->ticket)) return false;
    bool valid = !result.cancelled && !pending_->cancelled() &&
                 result.annotations.size() == pending_->candidates.size();
    if (valid) {
        for (std::size_t i = 0; i < result.annotations.size(); ++i) {
            const auto& candidate = pending_->candidates[i];
            const auto& annotation = result.annotations[i];
            if (!(annotation.original == candidate) ||
                annotation.english != OfflineDictionary::lookup(candidate.text_utf8)) {
                valid = false;
                break;
            }
        }
    }
    cancel_pending_locked();
    view_.reset();
    if (!valid) return false;
    view_ = AnnotationView{result.ticket, result.annotations};
    return true;
}
std::optional<AnnotationView> GuardEngine::view() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return view_;
}
bool GuardEngine::view_is_current(const WorkTicket& ticket) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return view_ && current_ticket_locked(ticket) && view_->ticket == ticket;
}
std::optional<MouseRoute> GuardEngine::mouse_route_for(const std::string& id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!view_ || !current_ticket_locked(view_->ticket)) return std::nullopt;
    for (const auto& annotation : view_->annotations) {
        if (annotation.original.stable_id == id && annotation.english &&
            !annotation.english->empty()) return MouseRoute{view_->ticket, annotation.original};
    }
    return std::nullopt;
}
std::optional<Candidate> GuardEngine::validate_mouse_route(const MouseRoute& route) const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!view_ || !current_ticket_locked(route.displayed_ticket) ||
        !(view_->ticket == route.displayed_ticket)) return std::nullopt;
    for (const auto& annotation : view_->annotations) {
        if (annotation.original == route.displayed_candidate && annotation.english &&
            !annotation.english->empty()) return annotation.original;
    }
    return std::nullopt;
}
Diagnostics GuardEngine::diagnostics() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return {state_, snapshot_ ? snapshot_->candidates.size() : 0,
            pending_ ? pending_->candidates.size() : 0,
            view_ ? view_->annotations.size() : 0};
}

AdapterRead ProductionWeTypeAdapter::read_candidates() const {
    return {AdapterStatus::unavailable, std::nullopt,
            "Unavailable: real WeType candidate dataflow has not been measured; "
            "production adapter is not implemented and production allowlist is empty."};
}

} // namespace wetype::annotations
