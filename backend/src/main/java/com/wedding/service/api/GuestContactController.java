package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/guest/contact")
public class GuestContactController {
  private final DataService db;
  GuestContactController(DataService db) { this.db = db; }
  public record ContactUpdate(@Email @Size(max=254) String email,
      @Size(max=50) String phone, @Size(max=2000) String mailingAddress,
      @Size(max=200) String firstName, @Size(max=200) String lastName) {}

  private Map<String,Object> current(Principal p) {
    if (p.guestId() == null) throw new ApiException(HttpStatus.CONFLICT,
        "GUEST_IDENTITY_REQUIRED", "Please sign in again to provide your contact information.");
    return db.one("SELECT g.first_name,g.last_name,g.email,g.phone,p.mailing_address FROM guest g JOIN party p ON p.id=g.party_id "
        + "WHERE g.id=:g AND g.party_id=:p AND g.active AND NOT p.archived",
        Map.of("g",p.guestId(),"p",p.partyId()));
  }
  static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
  static String cleanName(String value) {
    String name=clean(value);
    return name==null ? null : name.replaceAll("\\s+"," ");
  }
  static Map<String,Object> response(Map<String,Object> row) {
    var result = new LinkedHashMap<String,Object>();
    result.put("firstName",row.get("first_name")); result.put("lastName",row.get("last_name"));
    result.put("email", row.get("email")); result.put("phone", row.get("phone"));
    result.put("mailingAddress", row.get("mailing_address"));
    result.put("complete", List.of("email","phone","mailing_address").stream()
        .allMatch(k -> row.get(k) != null && !row.get(k).toString().isBlank()));
    return result;
  }
  @GetMapping
  Map<String,Object> get(@AuthenticationPrincipal Principal p) { return response(current(p)); }

  // Null and blank inputs preserve existing values; this form collects missing information.
  @PatchMapping @Transactional
  Map<String,Object> update(@AuthenticationPrincipal Principal p, @Valid @RequestBody ContactUpdate in) {
    current(p);
    var params = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
        .addValue("g",p.guestId()).addValue("p",p.partyId())
        .addValue("e",clean(in.email())).addValue("ph",clean(in.phone()))
        .addValue("a",clean(in.mailingAddress()))
        .addValue("fn",cleanName(in.firstName())).addValue("ln",cleanName(in.lastName()));
    try {
      db.named.update("UPDATE guest SET first_name=COALESCE(:fn,first_name),last_name=COALESCE(:ln,last_name),email=COALESCE(:e,email),phone=COALESCE(:ph,phone),updated_at=now() "
          + "WHERE id=:g AND party_id=:p AND active",params);
    } catch (org.springframework.dao.DuplicateKeyException e) {
      throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_IN_USE",
          "This email is already in use. Please use a different email or skip for now.");
    }
    db.named.update("UPDATE party SET mailing_address=COALESCE(:a,mailing_address) WHERE id=:p AND NOT archived",params);
    return response(current(p));
  }
}
