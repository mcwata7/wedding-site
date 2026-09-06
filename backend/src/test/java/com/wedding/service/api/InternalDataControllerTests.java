package com.wedding.service.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class InternalDataControllerTests {
  @Test void defaultsNullToMultiPage() {
    assertEquals("MULTI_PAGE", InternalDataController.parseSiteLayoutOrThrow(null));
  }
  @Test void defaultsBlankToMultiPage() {
    assertEquals("MULTI_PAGE", InternalDataController.parseSiteLayoutOrThrow("  "));
  }
  @Test void normalizesCaseAndWhitespace() {
    assertEquals("SINGLE_PAGE", InternalDataController.parseSiteLayoutOrThrow("single_page"));
    assertEquals("MULTI_PAGE", InternalDataController.parseSiteLayoutOrThrow("  MULTI_PAGE "));
  }
  @Test void rejectsUnknownValue() {
    ApiException ex = assertThrows(ApiException.class, () -> InternalDataController.parseSiteLayoutOrThrow("FOO"));
    assertEquals("VALIDATION_ERROR", ex.code);
    assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.status);
  }

  @Test void fontFamilyNullAndBlankStayNull() {
    assertNull(InternalDataController.parseFontFamilyOrNull(null));
    assertNull(InternalDataController.parseFontFamilyOrNull("  "));
  }
  @Test void fontFamilyNormalizesCaseAndWhitespace() {
    assertEquals("TANGERINE", InternalDataController.parseFontFamilyOrNull(" tangerine "));
  }
  @Test void fontFamilyRejectsUnknownValue() {
    ApiException ex = assertThrows(ApiException.class, () -> InternalDataController.parseFontFamilyOrNull("Comic Sans"));
    assertEquals("VALIDATION_ERROR", ex.code);
    assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.status);
  }

  @Test void fontSizeNullAndBlankStayNull() {
    assertNull(InternalDataController.parseFontSizeOrNull(null));
    assertNull(InternalDataController.parseFontSizeOrNull(""));
  }
  @Test void fontSizeNormalizesCaseAndWhitespace() {
    assertEquals("LARGE", InternalDataController.parseFontSizeOrNull(" large "));
  }
  @Test void fontSizeRejectsUnknownValue() {
    ApiException ex = assertThrows(ApiException.class, () -> InternalDataController.parseFontSizeOrNull("HUGE"));
    assertEquals("VALIDATION_ERROR", ex.code);
    assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.status);
  }

  @Test void booleanDefaultsNullToFallback() {
    assertFalse(InternalDataController.parseBooleanOrDefault(null, false));
    assertTrue(InternalDataController.parseBooleanOrDefault(null, true));
  }
  @Test void booleanAcceptsBooleanAndStringValues() {
    assertTrue(InternalDataController.parseBooleanOrDefault(Boolean.TRUE, false));
    assertTrue(InternalDataController.parseBooleanOrDefault("true", false));
    assertFalse(InternalDataController.parseBooleanOrDefault("false", true));
  }
}
