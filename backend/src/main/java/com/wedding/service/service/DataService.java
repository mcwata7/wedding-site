package com.wedding.service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.api.ApiException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import org.postgresql.util.PGobject;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class DataService {
  public final JdbcTemplate jdbc; public final NamedParameterJdbcTemplate named; public final ObjectMapper json; public final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
  private final SecureRandom secureRandom = new SecureRandom();
  public DataService(JdbcTemplate jdbc, NamedParameterJdbcTemplate named, ObjectMapper json) { this.jdbc=jdbc; this.named=named; this.json=json; }
  public UUID uuid() { return UUID.randomUUID(); }
  public String hashToken(String v) { try { return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(v.getBytes())); } catch(Exception e) { throw new IllegalStateException(e); } }
  /** 8-char URL-safe token: 6 random bytes, base64url, no padding (alphabet A-Za-z0-9-_).
   * ~2.8e14 possible values; invitation.token_hash's UNIQUE constraint turns the near-impossible
   * collision case into a loud failure, not silent cross-party access, so no retry loop. */
  public String newToken() {
    byte[] bytes = new byte[6];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
  public Map<String,Object> one(String sql, Map<String,?> p) { var rows=named.queryForList(sql,p); if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"NOT_FOUND","Resource was not found"); rows.forEach(this::decodeJsonb); return rows.getFirst(); }
  public List<Map<String,Object>> many(String sql, Map<String,?> p) { var rows=named.queryForList(sql,p); rows.forEach(this::decodeJsonb); return rows; }
  /** Postgres hands back a jsonb column as a PGobject wrapper, not a plain value -- decode it here,
   * once, so every SELECT * caller (settings reads, audit snapshots) gets usable nested Java data
   * instead of having to unwrap PGobject.getValue() itself. */
  private void decodeJsonb(Map<String,Object> row) {
    for (var entry : row.entrySet()) {
      if (entry.getValue() instanceof PGobject pg && ("json".equals(pg.getType()) || "jsonb".equals(pg.getType()))) {
        try { entry.setValue(json.readValue(pg.getValue(), Object.class)); }
        catch (Exception e) { throw new IllegalStateException(e); }
      }
    }
  }
  public void audit(UUID actor,String action,String type,UUID id,Object before,Object after) { try { named.update("INSERT INTO audit_record(actor_id,action,entity_type,entity_id,before_value,after_value) VALUES(:a,:ac,:t,:id,cast(:b as jsonb),cast(:af as jsonb))", Map.of("a",actor,"ac",action,"t",type,"id",id,"b",json.writeValueAsString(before==null?Map.of():before),"af",json.writeValueAsString(after==null?Map.of():after))); } catch(Exception e) { throw new IllegalStateException(e); } }
  public UUID id(Object value) { return UUID.fromString(value.toString()); }
  /** Request bodies bind "*_id" fields as JSON strings; the JDBC driver sends an unconverted
   * String as varchar, which Postgres refuses to assign into a uuid column without a cast.
   * Parsing to a real UUID here binds it as the native type instead, same as path-variable UUIDs. */
  public Object coerceUuidLike(String key, Object value) {
    if (value instanceof String s && key.endsWith("_id") && !s.isBlank()) { try { return UUID.fromString(s); } catch (IllegalArgumentException ignored) { } }
    return value;
  }
  public static final Map<String,Set<String>> ENUMS = Map.of(
    "relationship_group", Set.of("FAMILY","RELATIVE","FRIEND","OTHER"),
    "wedding_side", Set.of("BRIDE","GROOM"),
    "attendance_probability", Set.of("CERTAIN","VERY_LIKELY","LIKELY","MAYBE","UNLIKELY","NA"),
    "passport", Set.of("NEPALI","INDIAN","OTHER"),
    "fee_type", Set.of("SANGEET_DAY_CATERING","WEDDING_LUNCH_CATERING","WEDDING_DINNER_CATERING","CORKAGE"));
  /** Generic write paths pass column values straight to SQL, so a bad enum value would otherwise
   * only surface once it hits the DB CHECK constraint, as an opaque 500. Catch it here as a 400. */
  public Object checkEnum(String key, Object value) {
    Set<String> allowed = ENUMS.get(key);
    if (allowed == null || !(value instanceof String s)) return value;
    if (s.isBlank()) return null;
    String upper = s.trim().toUpperCase();
    if (!allowed.contains(upper)) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR",key+" must be one of "+allowed);
    return upper;
  }

  /** Every party attends every event -- there is no per-event invitation decision any more.
   * `event_eligibility` is kept as a maintained invariant (all parties x all events, insert-only:
   * archiving an event must not delete its rsvp rows, so nothing ever removes an eligibility row)
   * rather than dropped, because `rsvp`'s composite FK to it is part of the data model. The
   * guest-level rsvp rows are still a derived projection of (active guests) x (eligible events).
   * Every path that changes either side -- adding a guest, archiving a guest, importing guests,
   * creating a party, creating an event -- must call this so the projection stays in sync.
   * Returns the number of rsvp rows actually inserted. */
  public int syncRsvps() {
    named.update(
      "INSERT INTO event_eligibility(event_id,party_id) SELECT e.id,p.id FROM event e CROSS JOIN party p "
      + "ON CONFLICT DO NOTHING", Map.of());
    int inserted = named.update(
      "INSERT INTO rsvp(guest_id,event_id,party_id) "
      + "SELECT g.id, ee.event_id, g.party_id FROM guest g JOIN event_eligibility ee ON ee.party_id=g.party_id "
      + "WHERE g.active "
      + "ON CONFLICT (guest_id,event_id) DO NOTHING",
      Map.of());
    named.update(
      "DELETE FROM rsvp r USING guest g WHERE g.id=r.guest_id "
      + "AND (NOT g.active OR NOT EXISTS (SELECT 1 FROM event_eligibility ee WHERE ee.event_id=r.event_id AND ee.party_id=g.party_id))",
      Map.of());
    return inserted;
  }
}
