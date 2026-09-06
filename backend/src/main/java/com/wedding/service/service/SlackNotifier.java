package com.wedding.service.service;

import com.wedding.service.config.AppProperties;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;

/**
 * Posts a Slack message for every RSVP status change (GuestController.rsvp,
 * InternalController.manualRsvp) -- one message per update, including a change back to PENDING.
 *
 * Failures here must never fail the RSVP request itself: every path is caught and logged.
 */
@Service
public class SlackNotifier {
  private static final Logger log = LoggerFactory.getLogger(SlackNotifier.class);
  private final DataService db; private final AppProperties props; private final RestClient client = RestClient.create();

  SlackNotifier(DataService db, AppProperties props) { this.db = db; this.props = props; }

  public void rsvpRecorded(UUID rsvpId) {
    if (!enabled()) return;
    try {
      var rows = db.many(
        "SELECT g.first_name, g.last_name, p.display_name party_name, r.status, r.note "
        + "FROM rsvp r JOIN guest g ON g.id=r.guest_id JOIN party p ON p.id=r.party_id "
        + "WHERE r.id=:id",
        Map.of("id", rsvpId));
      if (rows.isEmpty()) return;
      var row = rows.getFirst();
      String name = row.get("first_name") + " " + row.get("last_name");
      String partyName = (String) row.get("party_name");
      String status = (String) row.get("status");
      String note = (String) row.get("note");
      Runnable post = () -> post(rsvpId, buildPayload(name, partyName, status, note));
      if (TransactionSynchronizationManager.isSynchronizationActive()) {
        // Post only after the RSVP actually commits -- otherwise a later rollback would leave a
        // Slack message announcing an RSVP that never happened.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
          @Override public void afterCommit() { post.run(); }
        });
      } else {
        post.run();
      }
    } catch (Exception e) {
      log.error("Failed to prepare Slack RSVP notification for rsvp {}", rsvpId, e);
    }
  }

  private void post(UUID rsvpId, Map<String,Object> payload) {
    try {
      client.post().uri(props.slack().webhookUrl())
        .header("Content-Type", "application/json")
        .body(payload)
        .retrieve().toBodilessEntity();
    } catch (Exception e) {
      log.error("Slack RSVP notification failed for rsvp {}", rsvpId, e);
    }
  }

  private boolean enabled() {
    return props.slack() != null && props.slack().enabled() && props.slack().webhookUrl() != null && !props.slack().webhookUrl().isBlank();
  }

  /** Pure function of its inputs so it's unit-testable without Spring; see SlackNotifierTests. */
  static Map<String,Object> buildPayload(String name, String partyName, String status, String note) {
    String title = "RSVP: " + name + " from " + partyName + " party responded " + status;
    return Map.of(
      "blocks", List.of(
        Map.of("type", "header", "text", Map.of("type", "plain_text", "text", title)),
        Map.of("type", "section", "text", Map.of("type", "mrkdwn", "text", "*Notes*: " + (note == null ? "" : note)))));
  }
}
