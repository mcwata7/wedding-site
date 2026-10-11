package com.wedding.service.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.wedding.service.security.Principal;
import com.wedding.service.service.PlannerPasskeyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class PlannerPasskeyController {
  private final PlannerPasskeyService passkeys;
  public PlannerPasskeyController(PlannerPasskeyService passkeys) { this.passkeys=passkeys; }
  public record LoginStart(@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(max=512) String origin) {}
  public record RegisterStart(@NotNull UUID enrollmentToken,@NotBlank @Size(max=512) String origin,Boolean anotherDevice) {}
  public record Enrollment(@NotBlank @Size(max=1024) String password) {}
  public record Finish(@NotNull UUID challengeId,@NotNull JsonNode credential) {}
  private String credential(Finish input) {
    String value=input.credential().toString();
    if(value.length()>65536) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Passkey response is too large");
    return value;
  }
  @PostMapping("/auth/planner/passkeys/login/options") Map<String,Object> loginOptions(@Valid @RequestBody LoginStart input) {
    return passkeys.beginLogin(input.email(),input.origin());
  }
  @PostMapping("/auth/planner/passkeys/login/finish") Map<String,Object> loginFinish(@Valid @RequestBody Finish input) {
    return passkeys.finishLogin(input.challengeId(),credential(input));
  }
  @PostMapping("/internal/passkeys/enrollment") Map<String,Object> enrollment(@AuthenticationPrincipal Principal actor,@Valid @RequestBody Enrollment input) {
    return Map.of("enrollmentToken",passkeys.confirmPassword(actor.id(),input.password()));
  }
  @PostMapping("/internal/passkeys/register/options") Map<String,Object> registrationOptions(@AuthenticationPrincipal Principal actor,@Valid @RequestBody RegisterStart input) {
    return passkeys.beginRegistration(actor.id(),input.enrollmentToken(),input.origin(),Boolean.TRUE.equals(input.anotherDevice()));
  }
  @PostMapping("/internal/passkeys/register/finish") Map<String,Object> registrationFinish(@AuthenticationPrincipal Principal actor,@Valid @RequestBody Finish input) {
    return passkeys.finishRegistration(actor.id(),input.challengeId(),credential(input));
  }
}
