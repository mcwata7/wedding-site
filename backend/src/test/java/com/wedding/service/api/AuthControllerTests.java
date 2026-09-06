package com.wedding.service.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class AuthControllerTests {
  @Test void normalizesCaseAndSurroundingWhitespace() {
    assertEquals("ram thapa", AuthController.normalizeName("  Ram Thapa "));
  }
  @Test void collapsesInternalWhitespace() {
    assertEquals("ram bahadur thapa", AuthController.normalizeName("Ram   Bahadur\tThapa"));
  }
  @Test void nullAndBlankNormalizeToEmpty() {
    assertEquals("", AuthController.normalizeName(null));
    assertEquals("", AuthController.normalizeName("   "));
  }
}
