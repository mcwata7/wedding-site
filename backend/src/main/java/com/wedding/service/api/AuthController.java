package com.wedding.service.api;

import com.wedding.service.config.AppProperties;
import com.wedding.service.security.JwtService;
import com.wedding.service.service.DataService;
import com.wedding.service.service.GuestLoginThrottle;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class AuthController {
  private final DataService db; private final JwtService jwt; private final AppProperties props; private final GuestLoginThrottle throttle;
  AuthController(DataService db, JwtService jwt, AppProperties props, GuestLoginThrottle throttle) {this.db=db;this.jwt=jwt;this.props=props;this.throttle=throttle;}
  public record Login(@NotBlank String email,@NotBlank String password) {} public record GuestSession(@NotBlank String name,@NotBlank String answer) {}
  public record InviteLookup(@NotBlank String name) {}

  /** Guests identify themselves by their own name rather than an invitation code: the name maps to
   * a guest row, the guest to a party, and the party carries the verification question/answer that
   * actually gates entry. Matching is case/whitespace-insensitive on "first last", falling back to
   * first name alone; a name that resolves to more than one party is rejected rather than guessed. */
  static String normalizeName(String raw) { return raw==null?"":raw.trim().replaceAll("\\s+"," ").toLowerCase(); }
  private Map<String,Object> resolveParty(String rawName) {
    String n = normalizeName(rawName);
    String base = "SELECT DISTINCT p.id,p.display_name,p.verification_question,p.verification_answer_hash,i.id invitation_id "
      + "FROM guest g JOIN party p ON p.id=g.party_id JOIN invitation i ON i.party_id=p.id "
      + "WHERE g.active=true AND p.archived=false AND i.status<>'CLOSED' "
      + "AND (i.token_expires_at IS NULL OR i.token_expires_at>now()) AND ";
    var rows = db.many(base+"lower(g.first_name)||' '||lower(g.last_name)=:n",Map.of("n",n));
    if (rows.isEmpty()) rows = db.many(base+"lower(g.first_name)=:n",Map.of("n",n));
    if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"GUEST_NOT_FOUND","We couldn't find that name on the guest list. Try your full name as it appears on your invitation.");
    if (rows.stream().map(r->r.get("id")).distinct().count()>1) throw new ApiException(HttpStatus.CONFLICT,"AMBIGUOUS_NAME","More than one guest matches that name. Please enter your full first and last name.");
    return rows.getFirst();
  }
  @PostMapping("/auth/planner/login") Map<String,Object> login(@Valid @RequestBody Login in) { var u=db.one("SELECT id,email,password_hash,role FROM planner_user WHERE email=:e AND active=true",Map.of("e",in.email().toLowerCase())); if(!db.passwords.matches(in.password(),u.get("password_hash").toString())) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_CREDENTIALS","Invalid email or password"); return Map.of("accessToken",jwt.create(db.id(u.get("id")),u.get("role").toString(),null,props.security().plannerSessionMinutes()),"tokenType","Bearer","role",u.get("role")); }
  @PostMapping("/guest/sessions") Map<String,Object> guest(@Valid @RequestBody GuestSession in) { var p=resolveParty(in.name()); UUID partyId=db.id(p.get("id")); throttle.checkAllowed(partyId); if(!db.passwords.matches(in.answer().trim().toLowerCase(),p.get("verification_answer_hash").toString())) throttle.recordFailureAndThrow(partyId); throttle.recordSuccess(partyId); db.named.update("UPDATE invitation SET status=CASE WHEN status='DRAFT' THEN 'VIEWED' ELSE status END,viewed_at=COALESCE(viewed_at,now()) WHERE id=:id",Map.of("id",p.get("invitation_id"))); return Map.of("accessToken",jwt.create(db.id(p.get("id")),"GUEST",db.id(p.get("id")),props.security().guestSessionMinutes()),"tokenType","Bearer"); }
  @PostMapping("/guest/invitations/lookup") Map<String,Object> lookup(@Valid @RequestBody InviteLookup in) { var p=resolveParty(in.name()); throttle.assertNotLocked(db.id(p.get("id"))); return Map.of("partyName",p.get("display_name"),"verificationQuestion",p.get("verification_question")); }
}
