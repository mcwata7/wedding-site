package com.wedding.service.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final ObjectMapper mapper;
  private final AppProperties properties;
  public JwtService(ObjectMapper mapper, AppProperties properties) { this.mapper = mapper; this.properties = properties; }
  public String create(UUID id, String role, UUID partyId, long minutes) {
    try {
      String header = b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
      Map<String,Object> claims = Map.of("sub", id.toString(), "role", role, "partyId", partyId == null ? "" : partyId.toString(), "exp", Instant.now().plusSeconds(minutes * 60).getEpochSecond());
      String body = b64(mapper.writeValueAsString(claims)); String signing = header + "." + body;
      return signing + "." + b64(sign(signing));
    } catch (Exception e) { throw new IllegalStateException("Unable to create session token", e); }
  }
  public Principal parse(String token) {
    try {
      String[] p = token.split("\\."); if (p.length != 3 || !constantTime(b64(sign(p[0] + "." + p[1])), p[2])) throw new IllegalArgumentException("Invalid token");
      Map<String,Object> claims = mapper.readValue(Base64.getUrlDecoder().decode(p[1]), new TypeReference<>() {});
      if (((Number) claims.get("exp")).longValue() < Instant.now().getEpochSecond()) throw new IllegalArgumentException("Expired token");
      String party = (String) claims.get("partyId");
      return new Principal(UUID.fromString((String) claims.get("sub")), (String) claims.get("role"), party == null || party.isBlank() ? null : UUID.fromString(party));
    } catch (Exception e) { throw new IllegalArgumentException("Invalid token"); }
  }
  private byte[] sign(String value) throws Exception { Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(properties.security().jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256")); return mac.doFinal(value.getBytes(StandardCharsets.UTF_8)); }
  private String b64(String s) { return b64(s.getBytes(StandardCharsets.UTF_8)); }
  private String b64(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }
  private boolean constantTime(String a, String b) { return java.security.MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8)); }
}
