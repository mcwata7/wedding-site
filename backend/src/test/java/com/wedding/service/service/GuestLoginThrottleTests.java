package com.wedding.service.service;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class GuestLoginThrottleTests {
  @Test void roundsPartialMinutesUp() {
    assertEquals("a minute", GuestLoginThrottle.minutesLabel(1));
    assertEquals("a minute", GuestLoginThrottle.minutesLabel(60));
    assertEquals("2 minutes", GuestLoginThrottle.minutesLabel(61));
    assertEquals("5 minutes", GuestLoginThrottle.minutesLabel(300));
  }

  /** The temporary lock has to re-arm on multiples of TEMP_LOCK_AFTER strictly below the permanent
   * threshold -- the SQL in recordFailureAndThrow encodes exactly this, so pin the arithmetic. */
  @Test void lockTiersDivideEvenly() {
    assertEquals(0, GuestLoginThrottle.PERMANENT_LOCK_AFTER % GuestLoginThrottle.TEMP_LOCK_AFTER);
    assertTrue(GuestLoginThrottle.TEMP_LOCK_AFTER > GuestLoginThrottle.MAX_PER_MINUTE);
    assertTrue(GuestLoginThrottle.PERMANENT_LOCK_AFTER > GuestLoginThrottle.TEMP_LOCK_AFTER);
  }
}
