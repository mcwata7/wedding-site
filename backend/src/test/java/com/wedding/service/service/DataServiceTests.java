package com.wedding.service.service;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

/**
 * Plain JUnit 5, no Spring context -- matching JwtServiceTests/InvitationCardRendererTests.
 * newToken() touches none of DataService's constructor-injected fields, so a null-wired instance
 * is fine here.
 */
class DataServiceTests {
  private final DataService db = new DataService(null, null, null);

  @Test void newTokenIsEightUrlSafeChars() {
    String token = db.newToken();
    assertEquals(8, token.length());
    assertTrue(token.matches("^[A-Za-z0-9_-]{8}$"), "token \"" + token + "\" should be 8 URL-safe base64 chars");
  }

  @Test void newTokenIsRandom() {
    assertNotEquals(db.newToken(), db.newToken());
  }
}
