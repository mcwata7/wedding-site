package com.wedding.service.api;

import com.wedding.service.config.AppProperties;
import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import com.wedding.service.service.InvitationCardRenderer;
import com.wedding.service.service.InvitationCardRenderer.Card;
import com.wedding.service.service.InvitationCardRenderer.CardTheme;
import com.wedding.service.service.MediaService;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Renders printable A6 QR invitation cards. Kept separate from InternalController (which mints
 * the underlying tokens) because it owns a distinct concern -- PDF generation -- with its own
 * failure modes (missing artwork, unprintable text, unissued tokens).
 *
 * GET endpoints never mutate: if any non-archived party lacks a printable token, they fail with
 * 409 MISSING_INVITATION(S) instead of silently minting one, so a retry/prefetch/double-click
 * can never rotate a token that's already on a mailed card. The planner must explicitly call
 * issue-missing first.
 */
@RestController @RequestMapping("/api/v1/internal")
public class InvitationCardController {
  private final DataService db; private final MediaService media; private final InvitationCardRenderer renderer; private final AppProperties props;
  private final SecureRandom random = new SecureRandom();

  InvitationCardController(DataService db, MediaService media, InvitationCardRenderer renderer, AppProperties props) {
    this.db = db; this.media = media; this.renderer = renderer; this.props = props;
  }

  /** Mints tokens only for parties that don't have a printable one yet -- never rotates an existing token. */
  @PostMapping("/invitation-cards/issue-missing")
  Map<String,Object> issueMissing(@AuthenticationPrincipal Principal actor) {
    var parties = db.many("SELECT p.id FROM party p LEFT JOIN invitation i ON i.party_id=p.id WHERE NOT p.archived AND i.token IS NULL", Map.of());
    for (var row : parties) {
      UUID partyId = db.id(row.get("id"));
      String token = UUID.randomUUID() + "-" + Long.toUnsignedString(random.nextLong(), 36);
      UUID invite = db.uuid();
      db.named.update(
        "INSERT INTO invitation(id,party_id,token,token_hash) VALUES(:i,:p,:tok,:t) " +
        "ON CONFLICT(party_id) DO UPDATE SET token=excluded.token,token_hash=excluded.token_hash,status='DRAFT' WHERE invitation.token IS NULL",
        Map.of("i", invite, "p", partyId, "tok", token, "t", db.hashToken(token)));
      db.audit(actor.id(), "ISSUE_QR", "INVITATION", invite, null, Map.of("partyId", partyId, "reason", "bulk-card-print"));
    }
    return Map.of("issued", parties.size());
  }

  @GetMapping("/parties/{partyId}/invitation-card.pdf")
  ResponseEntity<byte[]> single(@PathVariable UUID partyId, @RequestParam(defaultValue = "0") double bleedMm) {
    var party = db.one("SELECT display_name FROM party WHERE id=:id AND NOT archived", Map.of("id", partyId));
    var invitations = db.many("SELECT token FROM invitation WHERE party_id=:id AND token IS NOT NULL", Map.of("id", partyId));
    if (invitations.isEmpty())
      throw new ApiException(HttpStatus.CONFLICT, "MISSING_INVITATION", "This party doesn't have a printable invitation token yet. Issue one first.");
    String name = party.get("display_name").toString();
    byte[] pdf = renderer.render(theme(), List.of(new Card(name, invitations.getFirst().get("token").toString())), bleedMm);
    return pdfResponse(pdf, "invitation-" + slug(name) + ".pdf");
  }

  @GetMapping("/invitation-cards.pdf")
  ResponseEntity<byte[]> all(@RequestParam(defaultValue = "0") double bleedMm) {
    int missing = db.jdbc.queryForObject("SELECT count(*) FROM party p LEFT JOIN invitation i ON i.party_id=p.id WHERE NOT p.archived AND i.token IS NULL", Integer.class);
    if (missing > 0)
      throw new ApiException(HttpStatus.CONFLICT, "MISSING_INVITATIONS", missing + (missing == 1 ? " party hasn't" : " parties haven't") + " been issued an invitation token yet.");
    var rows = db.many("SELECT p.display_name,i.token FROM party p JOIN invitation i ON i.party_id=p.id WHERE NOT p.archived AND i.token IS NOT NULL ORDER BY p.display_name", Map.of());
    if (rows.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "NO_PARTIES", "There are no parties to print");
    var cards = rows.stream().map(r -> new Card(r.get("display_name").toString(), r.get("token").toString())).toList();
    return pdfResponse(renderer.render(theme(), cards, bleedMm), "invitation-cards.pdf");
  }

  private CardTheme theme() {
    var s = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());
    byte[] artwork = null; String artworkType = null;
    if (s.get("invitation_image_id") != null) {
      var asset = db.one("SELECT storage_key,content_type FROM media_asset WHERE id=:id", Map.of("id", db.id(s.get("invitation_image_id"))));
      artwork = media.read(asset.get("storage_key").toString());
      artworkType = asset.get("content_type").toString();
    }
    String date = s.get("wedding_date") == null ? "" : LocalDate.parse(s.get("wedding_date").toString()).format(DateTimeFormatter.ofPattern("d MMMM yyyy"));
    return new CardTheme(
      coupleNames(s.get("partner_one_name"), s.get("partner_two_name")), date,
      str(s.get("invitation_headline")), str(s.get("invitation_body")),
      s.get("invitation_footer") == null || str(s.get("invitation_footer")).isBlank() ? "Scan to RSVP" : s.get("invitation_footer").toString(),
      artwork, artworkType, props.site().publicUrl());
  }

  private static String str(Object v) { return v == null ? "" : v.toString(); }
  private static String coupleNames(Object one, Object two) {
    String a = str(one).trim(), b = str(two).trim();
    if (a.isEmpty()) return b;
    if (b.isEmpty()) return a;
    return a + " & " + b;
  }
  private static String slug(String v) { return v.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""); }
  private ResponseEntity<byte[]> pdfResponse(byte[] pdf, String filename) {
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
      .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
      .body(pdf);
  }
}
