package com.wedding.service.api;

import com.wedding.service.config.AppProperties;
import com.wedding.service.security.JwtService;
import com.wedding.service.service.DataService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class AuthController {
  private final DataService db; private final JwtService jwt; private final AppProperties props;
  AuthController(DataService db, JwtService jwt, AppProperties props) {this.db=db;this.jwt=jwt;this.props=props;}
  public record Login(@NotBlank String email,@NotBlank String password) {} public record GuestSession(@NotBlank String qrToken,@NotBlank String answer) {}
  public record InviteLookup(@NotBlank String qrToken) {}
  @PostMapping("/auth/planner/login") Map<String,Object> login(@Valid @RequestBody Login in) { var u=db.one("SELECT id,email,password_hash,role FROM planner_user WHERE email=:e AND active=true",Map.of("e",in.email().toLowerCase())); if(!db.passwords.matches(in.password(),u.get("password_hash").toString())) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_CREDENTIALS","Invalid email or password"); return Map.of("accessToken",jwt.create(db.id(u.get("id")),u.get("role").toString(),null,props.security().plannerSessionMinutes()),"tokenType","Bearer","role",u.get("role")); }
  @PostMapping("/guest/sessions") Map<String,Object> guest(@Valid @RequestBody GuestSession in) { var p=db.one("SELECT p.id,p.verification_answer_hash,i.id invitation_id FROM invitation i JOIN party p ON p.id=i.party_id WHERE i.token_hash=:t AND (i.token_expires_at IS NULL OR i.token_expires_at>now()) AND i.status <> 'CLOSED'",Map.of("t",db.hashToken(in.qrToken()))); if(!db.passwords.matches(in.answer().trim().toLowerCase(),p.get("verification_answer_hash").toString())) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_VERIFICATION","The verification answer is incorrect"); db.named.update("UPDATE invitation SET status=CASE WHEN status='DRAFT' THEN 'VIEWED' ELSE status END,viewed_at=COALESCE(viewed_at,now()) WHERE id=:id",Map.of("id",p.get("invitation_id"))); return Map.of("accessToken",jwt.create(db.id(p.get("id")),"GUEST",db.id(p.get("id")),props.security().guestSessionMinutes()),"tokenType","Bearer"); }
  @PostMapping("/guest/invitations/lookup") Map<String,Object> lookup(@Valid @RequestBody InviteLookup in) { var p=db.one("SELECT p.display_name,p.verification_question FROM invitation i JOIN party p ON p.id=i.party_id WHERE i.token_hash=:t AND (i.token_expires_at IS NULL OR i.token_expires_at>now()) AND i.status <> 'CLOSED'",Map.of("t",db.hashToken(in.qrToken()))); return Map.of("partyName",p.get("display_name"),"verificationQuestion",p.get("verification_question")); }
}
