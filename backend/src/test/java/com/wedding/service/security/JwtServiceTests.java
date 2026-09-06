package com.wedding.service.security;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.config.AppProperties;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtServiceTests {
  private final JwtService jwt = new JwtService(new ObjectMapper(), new AppProperties(new AppProperties.Security("test-secret-that-is-long-enough-for-hmac", 10, 10), new AppProperties.BootstrapAdmin("a@b.com", "password"), new AppProperties.Media("data/media", 5242880), new AppProperties.Site("http://localhost:3001"), new AppProperties.Slack("", false), new AppProperties.Cors(List.of())));
  @Test void roundTripsPlannerToken() {
    UUID user = UUID.randomUUID();
    Principal principal = jwt.parse(jwt.create(user, "PLANNER", null, 10));
    assertEquals(user, principal.id()); assertTrue(principal.planner()); assertNull(principal.partyId());
  }
  @Test void rejectsModifiedToken() {
    String token = jwt.create(UUID.randomUUID(), "GUEST", UUID.randomUUID(), 10);
    assertThrows(IllegalArgumentException.class, () -> jwt.parse(token.substring(0, token.length() - 1) + "x"));
  }
}
