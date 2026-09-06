package com.wedding.service.service;

import com.wedding.service.api.ApiException;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Brute-force protection for the guest verification answer. The guest gate is a single
 * low-entropy secret ("what street did we meet on?") and the identifier in front of it is now a
 * guest's name, which isn't secret at all -- so the answer has to be defended by attempt limits
 * rather than by the difficulty of guessing the identifier.
 *
 * <p>Three tiers, all counted per party (the party is the thing being logged into, and every
 * guest in it shares one answer, so a per-guest counter would just multiply the budget):
 * <ul>
 *   <li>{@code MAX_PER_MINUTE} answers per rolling minute -- rate limit, 429.
 *   <li>{@code TEMP_LOCK_AFTER} consecutive failures -- 5-minute lock, 429. Re-arms every
 *       further multiple of 10, so a slow attacker keeps paying it.
 *   <li>{@code PERMANENT_LOCK_AFTER} consecutive failures -- locked until an ADMIN clears it, 403.
 * </ul>
 * A successful answer resets all three. State lives in Postgres, not memory, so it survives a
 * restart and can't be sidestepped by a second API instance.
 */
@Service
public class GuestLoginThrottle {
  public static final int MAX_PER_MINUTE = 5;
  public static final int TEMP_LOCK_AFTER = 10;
  public static final int TEMP_LOCK_MINUTES = 5;
  public static final int PERMANENT_LOCK_AFTER = 30;

  private final DataService db;
  GuestLoginThrottle(DataService db) { this.db = db; }

  /** Call before checking the answer. Consumes one attempt from the rolling window and throws if
   * the party is rate-limited, temporarily locked, or permanently locked.
   *
   * <p>Deliberately NOT {@code @Transactional}: every method here both writes a counter and then
   * throws on it, and a rollback would undo the very increment the limit depends on -- an attacker
   * could then retry forever, since no attempt would ever be recorded. Each statement stands alone
   * and self-commits; the single-statement UPDATEs are atomic on their own, so concurrent attempts
   * still can't both read a stale count. */
  public void checkAllowed(UUID partyId) {
    db.named.update("INSERT INTO guest_login_throttle(party_id) VALUES(:p) ON CONFLICT(party_id) DO NOTHING", Map.of("p", partyId));
    // Window roll and increment happen in one statement so concurrent attempts can't both read a
    // stale count and each conclude they're under the limit. `window_start` on the right-hand side
    // is the pre-UPDATE value in Postgres, so the CASE arms stay consistent with each other.
    var row = db.many(
      "UPDATE guest_login_throttle SET"
      + " window_start = CASE WHEN window_start < now() - interval '1 minute' THEN now() ELSE window_start END,"
      + " window_count = CASE WHEN window_start < now() - interval '1 minute' THEN 1 ELSE window_count + 1 END,"
      + " updated_at = now() WHERE party_id = :p"
      + " RETURNING locked_permanently, window_count,"
      + " CASE WHEN locked_until > now() THEN ceil(extract(epoch FROM locked_until - now())) ELSE 0 END lock_seconds",
      Map.of("p", partyId)).getFirst();

    if (Boolean.TRUE.equals(row.get("locked_permanently")))
      throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED",
        "This invitation has been locked after too many incorrect answers. Please contact the couple to have it unlocked.");
    long lockSeconds = ((Number) row.get("lock_seconds")).longValue();
    if (lockSeconds > 0)
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TEMPORARILY_LOCKED",
        "Too many incorrect answers. Please try again in " + minutesLabel(lockSeconds) + ".");
    if (((Number) row.get("window_count")).intValue() > MAX_PER_MINUTE)
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
        "Too many attempts. Please wait a minute and try again.");
  }

  /** Read-only lock check with no attempt consumed -- for the name lookup step, so a locked-out
   * guest is told why up front instead of only after typing an answer. */
  public void assertNotLocked(UUID partyId) {
    var rows = db.many("SELECT locked_permanently, CASE WHEN locked_until > now()"
      + " THEN ceil(extract(epoch FROM locked_until - now())) ELSE 0 END lock_seconds"
      + " FROM guest_login_throttle WHERE party_id = :p", Map.of("p", partyId));
    if (rows.isEmpty()) return;
    var row = rows.getFirst();
    if (Boolean.TRUE.equals(row.get("locked_permanently")))
      throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED",
        "This invitation has been locked after too many incorrect answers. Please contact the couple to have it unlocked.");
    long lockSeconds = ((Number) row.get("lock_seconds")).longValue();
    if (lockSeconds > 0)
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TEMPORARILY_LOCKED",
        "Too many incorrect answers. Please try again in " + minutesLabel(lockSeconds) + ".");
  }

  /** Call when the answer was wrong. Throws the caller's 401 itself, escalating the message when
   * this failure tripped a lock, so the guest learns why the next attempt will be refused. */
  public void recordFailureAndThrow(UUID partyId) {
    var row = db.many(
      "UPDATE guest_login_throttle SET failed_count = failed_count + 1, last_failed_at = now(), updated_at = now(),"
      + " locked_permanently = (failed_count + 1 >= " + PERMANENT_LOCK_AFTER + "),"
      + " locked_until = CASE WHEN (failed_count + 1) < " + PERMANENT_LOCK_AFTER
      + "   AND (failed_count + 1) % " + TEMP_LOCK_AFTER + " = 0"
      + "   THEN now() + interval '" + TEMP_LOCK_MINUTES + " minutes' ELSE locked_until END"
      + " WHERE party_id = :p RETURNING failed_count, locked_permanently",
      Map.of("p", partyId)).getFirst();

    int failures = ((Number) row.get("failed_count")).intValue();
    if (Boolean.TRUE.equals(row.get("locked_permanently")))
      throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED",
        "That answer was incorrect, and this invitation is now locked after "
        + PERMANENT_LOCK_AFTER + " incorrect answers. Please contact the couple to have it unlocked.");
    if (failures % TEMP_LOCK_AFTER == 0)
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TEMPORARILY_LOCKED",
        "That answer was incorrect. After " + failures + " incorrect answers, please wait "
        + TEMP_LOCK_MINUTES + " minutes before trying again.");
    throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_VERIFICATION", "The verification answer is incorrect");
  }

  /** Call when the answer was right: clears the failure count, the temporary lock, and the window. */
  public void recordSuccess(UUID partyId) {
    db.named.update("UPDATE guest_login_throttle SET failed_count = 0, locked_until = NULL, window_count = 0,"
      + " window_start = now(), last_success_at = now(), updated_at = now() WHERE party_id = :p", Map.of("p", partyId));
  }

  /** ADMIN-only escape hatch for a permanent lock (and, incidentally, any lesser lock). */
  public void unlock(UUID partyId) {
    db.named.update("INSERT INTO guest_login_throttle(party_id) VALUES(:p) ON CONFLICT(party_id) DO NOTHING", Map.of("p", partyId));
    db.named.update("UPDATE guest_login_throttle SET locked_permanently = FALSE, locked_until = NULL,"
      + " failed_count = 0, window_count = 0, window_start = now(), updated_at = now() WHERE party_id = :p", Map.of("p", partyId));
  }

  static String minutesLabel(long seconds) {
    long minutes = (seconds + 59) / 60;
    return minutes <= 1 ? "a minute" : minutes + " minutes";
  }
}
