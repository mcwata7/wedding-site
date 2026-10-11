package com.wedding.service.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.api.ApiException;
import com.wedding.service.config.AppProperties;
import com.wedding.service.config.PasskeyProperties;
import com.wedding.service.security.JwtService;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.transaction.PlatformTransactionManager;

class PlannerPasskeyServiceTests {
  NamedParameterJdbcTemplate sql;
  JwtService jwt;
  PlannerPasskeyService service;
  UUID planner=UUID.randomUUID();
  String origin="http://localhost:3000";
  @BeforeEach void setup() {
    sql=mock(NamedParameterJdbcTemplate.class); jwt=mock(JwtService.class);
    var properties=mock(AppProperties.class);
    service=new PlannerPasskeyService(new DataService(mock(JdbcTemplate.class),sql,new ObjectMapper()),new PasskeyProperties(),jwt,properties,mock(PlatformTransactionManager.class));
  }
  @Test void untrustedAndNonSecureOriginsCannotStartCeremonies() {
    for(String untrusted:List.of("https://attacker.example","http://localhost:3000.attacker.example","http://127.0.0.1:3000","http://localhost:3001")) {
      assertEquals("PASSKEY_ORIGIN",assertThrows(ApiException.class,()->service.beginLogin("user@example.com",untrusted)).code);
      verifyNoInteractions(sql,jwt);
    }
  }
  @Test void unknownOrUnregisteredUsersFallBackWithoutIssuingChallenges() {
    assertEquals(Map.of("hasPasskey",false),service.beginLogin("missing@example.com",origin));
    when(sql.queryForList(contains("planner_user WHERE lower(email)"),anyMap())).thenReturn(List.of(Map.of("id",planner,"email","user@example.com")));
    assertEquals(Map.of("hasPasskey",false),service.beginLogin("user@example.com",origin));
    verify(sql,never()).update(anyString(),any(SqlParameterSource.class));
    verifyNoInteractions(jwt);
  }
  @Test void registrationRequiresRecentPasswordProofForTheSamePlanner() {
    var error=assertThrows(ApiException.class,()->service.beginRegistration(planner,UUID.randomUUID(),origin));
    assertEquals("PASSKEY_INVALID",error.code);
    verify(sql,never()).update(anyString(),any(SqlParameterSource.class));
    verifyNoInteractions(jwt);
  }
  @Test void registrationOptionsRequireDiscoverableKeyAndUserVerification() {
    when(sql.queryForList(contains("kind='ENROLLMENT'"),anyMap())).thenReturn(List.of(Map.of("id",UUID.randomUUID())));
    when(sql.queryForList(contains("SELECT email FROM planner_user"),anyMap())).thenReturn(List.of(Map.of("email","user@example.com")));
    var options=service.beginRegistration(planner,UUID.randomUUID(),origin);
    var key=(JsonNode)options.get("publicKey");
    assertEquals("required",key.at("/authenticatorSelection/residentKey").asText());
    assertEquals("required",key.at("/authenticatorSelection/userVerification").asText());
    assertEquals("localhost",key.at("/rp/id").asText());
    assertEquals(PlannerPasskeyService.handle(planner).getBase64Url(),key.at("/user/id").asText());
    assertNotNull(options.get("challengeId"));
  }
  @Test void assertionOptionsRequireUserVerificationAndRegisteredCredentials() {
    var key=Map.<String,Object>of("credential_id","aWQ","planner_id",planner,"email","user@example.com");
    when(sql.queryForList(contains("planner_user WHERE lower(email)"),anyMap())).thenReturn(List.of(Map.of("id",planner,"email","user@example.com")));
    when(sql.queryForList(contains("SELECT credential_id FROM planner_passkey"),anyMap())).thenReturn(List.of(key));
    when(sql.queryForList(contains("SELECT k.*,u.email"),anyMap())).thenReturn(List.of(key));
    var options=service.beginLogin(" USER@example.com ",origin);
    var request=(JsonNode)options.get("publicKey");
    assertEquals("required",request.get("userVerification").asText());
    assertEquals("aWQ",request.at("/allowCredentials/0/id").asText());
    assertEquals(true,options.get("hasPasskey"));
  }
  @Test void expiredOrReplayedChallengeCannotCreateSessionOrRegisterKey() {
    assertEquals("PASSKEY_INVALID",assertThrows(ApiException.class,()->service.finishLogin(UUID.randomUUID(),"{}")).code);
    assertEquals("PASSKEY_INVALID",assertThrows(ApiException.class,()->service.finishRegistration(planner,UUID.randomUUID(),"{}")).code);
    verifyNoInteractions(jwt);
    verify(sql,never()).update(contains("INSERT INTO planner_passkey("),anyMap());
  }
  @Test void malformedProofConsumesChallengeAndCannotCreateSession() {
    UUID challenge=UUID.randomUUID();
    when(sql.queryForList(contains("DELETE FROM planner_passkey_challenge"),any(SqlParameterSource.class)))
      .thenReturn(List.of(Map.of("origin",origin,"request_json","{}","planner_id",planner))).thenReturn(List.of());
    assertEquals("PASSKEY_INVALID",assertThrows(ApiException.class,()->service.finishLogin(challenge,"{}")).code);
    assertEquals("PASSKEY_INVALID",assertThrows(ApiException.class,()->service.finishLogin(challenge,"{}")).code);
    verifyNoInteractions(jwt);
    verify(sql,never()).update(contains("UPDATE planner_passkey SET"),anyMap());
  }
}
