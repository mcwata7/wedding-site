package com.wedding.service.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Plain JUnit 5, no Spring context -- matching InvitationCardRendererTests. buildPayload is
 * deliberately a pure function of its inputs so it can be tested this way, without a real
 * Slack webhook.
 */
class SlackNotifierTests {

  @SuppressWarnings("unchecked")
  private static Map<String,Object> block(Map<String,Object> payload, int i) {
    return ((List<Map<String,Object>>) payload.get("blocks")).get(i);
  }

  @SuppressWarnings("unchecked")
  private static String textOf(Map<String,Object> block) {
    return (String) ((Map<String,Object>) block.get("text")).get("text");
  }

  @Test void payloadHasNoTopLevelTextOnlyBlocks() {
    var payload = SlackNotifier.buildPayload("John Smith", "Smith", "ATTENDING", "");
    assertFalse(payload.containsKey("text"));
    assertFalse(payload.containsKey("block"));
    assertTrue(payload.containsKey("blocks"));
  }

  @Test void headerBlockFollowsTheRequiredTemplate() {
    var payload = SlackNotifier.buildPayload("John Smith", "Smith", "ATTENDING", "");
    var header = block(payload, 0);
    assertEquals("header", header.get("type"));
    assertEquals("plain_text", ((Map<?,?>) header.get("text")).get("type"));
    assertEquals("RSVP: John Smith from Smith party responded ATTENDING", textOf(header));
  }

  @Test void responseIsTheRawStatusNotAHumanWord() {
    assertEquals("RSVP: Raj Sharma from Sharma party responded DECLINED",
      textOf(block(SlackNotifier.buildPayload("Raj Sharma", "Sharma", "DECLINED", ""), 0)));
    assertEquals("RSVP: Raj Sharma from Sharma party responded PENDING",
      textOf(block(SlackNotifier.buildPayload("Raj Sharma", "Sharma", "PENDING", ""), 0)));
    assertEquals("RSVP: Raj Sharma from Sharma party responded WAITLISTED",
      textOf(block(SlackNotifier.buildPayload("Raj Sharma", "Sharma", "WAITLISTED", ""), 0)));
  }

  @Test void secondBlockIsAMrkdwnNotesSection() {
    var payload = SlackNotifier.buildPayload("John Smith", "Smith", "ATTENDING", "");
    var notes = block(payload, 1);
    assertEquals("section", notes.get("type"));
    assertEquals("mrkdwn", ((Map<?,?>) notes.get("text")).get("type"));
    assertEquals("*Notes*: ", textOf(notes));
  }

  @Test void noteContentIsAppendedToTheNotesSection() {
    var payload = SlackNotifier.buildPayload("John Smith", "Smith", "DECLINED", "Flying in a day late");
    assertEquals("*Notes*: Flying in a day late", textOf(block(payload, 1)));
  }

  @Test void nullNoteRendersAsBlank() {
    var payload = SlackNotifier.buildPayload("John Smith", "Smith", "ATTENDING", null);
    assertEquals("*Notes*: ", textOf(block(payload, 1)));
  }

  @Test void payloadHasExactlyTwoBlocks() {
    var payload = SlackNotifier.buildPayload("John Smith", "Smith", "ATTENDING", "");
    assertEquals(2, ((List<?>) payload.get("blocks")).size());
  }
}
