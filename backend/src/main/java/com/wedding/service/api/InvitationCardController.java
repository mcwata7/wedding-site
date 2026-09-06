package com.wedding.service.api;

import com.wedding.service.config.AppProperties;
import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import com.wedding.service.service.InvitationCardRenderer;
import com.wedding.service.service.InvitationCardRenderer.Card;
import com.wedding.service.service.InvitationCardRenderer.CardLayout;
import com.wedding.service.service.InvitationCardRenderer.CardTheme;
import com.wedding.service.service.InvitationCardRenderer.Orientation;
import com.wedding.service.service.MediaService;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Renders printable, two-sided A6 QR invitation cards (front = pure artwork, back = QR + invite
 * URL + guest names). Kept separate from InternalController (which mints the underlying tokens)
 * because it owns a distinct concern -- PDF generation -- with its own failure modes (missing
 * artwork, unprintable text, unissued tokens).
 *
 * GET endpoints never mutate: if any non-archived party lacks a printable token, they fail with
 * 409 MISSING_INVITATION(S) instead of silently minting one, so a retry/prefetch/double-click
 * can never rotate a token that's already on a mailed card. The planner must explicitly call
 * issue-missing first.
 */
@RestController @RequestMapping("/api/v1/internal")
public class InvitationCardController {
  private final DataService db; private final MediaService media; private final InvitationCardRenderer renderer; private final AppProperties props;

  InvitationCardController(DataService db, MediaService media, InvitationCardRenderer renderer, AppProperties props) {
    this.db = db; this.media = media; this.renderer = renderer; this.props = props;
  }

  /** Mints tokens only for parties that don't have a printable one yet -- never rotates an existing token. */
  @PostMapping("/invitation-cards/issue-missing")
  Map<String,Object> issueMissing(@AuthenticationPrincipal Principal actor) {
    var parties = db.many("SELECT p.id FROM party p LEFT JOIN invitation i ON i.party_id=p.id WHERE NOT p.archived AND i.token IS NULL", Map.of());
    for (var row : parties) {
      UUID partyId = db.id(row.get("id"));
      String token = db.newToken();
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

  /** Lets the planner preview unsaved Card Design edits before hitting Save. baseUrl always comes
   * from the DB (not part of card design editing); everything else in `body` overlays the DB-loaded
   * values. `side` picks a single-page render (FRONT or BACK) -- the frontend requests each side
   * separately so it can show two distinct single-page PDFs instead of paging one two-page PDF
   * (which browsers' embedded PDF viewers don't reliably do when the same document is embedded
   * twice). Inline (not attachment) so the frontend can display it. */
  @PostMapping("/invitation-cards/preview.pdf")
  ResponseEntity<byte[]> preview(@RequestBody Map<String, Object> body, @RequestParam(defaultValue = "BOTH") String side) {
    var s = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());
    Art front = loadArt(body.containsKey("invitation_front_image_id") ? body.get("invitation_front_image_id") : s.get("invitation_front_image_id"));
    Art back = loadArt(body.containsKey("invitation_back_image_id") ? body.get("invitation_back_image_id") : s.get("invitation_back_image_id"));
    Orientation orientation = parseOrientation(body.containsKey("invitation_orientation") ? body.get("invitation_orientation") : s.get("invitation_orientation"));
    CardLayout layout = InvitationCardRenderer.validate(
      InvitationCardRenderer.parseLayout(body.getOrDefault("invitation_card_layout", s.get("invitation_card_layout")), db.json).withDefaults(), orientation);
    CardTheme theme = new CardTheme(front.bytes(), front.contentType(), back.bytes(), back.contentType(), props.site().publicUrl(), orientation, layout);
    byte[] pdf = renderer.render(theme, List.of(new Card("Sample Family", "preview-token-0000")), 0, InvitationCardRenderer.Side.valueOf(side.toUpperCase()));
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
      .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().build().toString())
      .body(pdf);
  }

  private CardTheme theme() {
    var s = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());
    Art front = loadArt(s.get("invitation_front_image_id"));
    Art back = loadArt(s.get("invitation_back_image_id"));
    Orientation orientation = parseOrientation(s.get("invitation_orientation"));
    CardLayout layout = InvitationCardRenderer.validate(
      InvitationCardRenderer.parseLayout(s.get("invitation_card_layout"), db.json).withDefaults(), orientation);
    return new CardTheme(front.bytes(), front.contentType(), back.bytes(), back.contentType(), props.site().publicUrl(), orientation, layout);
  }

  private record Art(byte[] bytes, String contentType) {}
  private Art loadArt(Object mediaId) {
    if (mediaId == null) return new Art(null, null);
    var asset = db.one("SELECT storage_key,content_type FROM media_asset WHERE id=:id", Map.of("id", db.id(mediaId)));
    return new Art(media.read(asset.get("storage_key").toString()), asset.get("content_type").toString());
  }

  /** Guards a null/blank orientation (a singleton row from before this column existed) to the
   * schema's own default rather than NPE-ing. */
  private static Orientation parseOrientation(Object value) {
    if (value == null || value.toString().isBlank()) return Orientation.PORTRAIT;
    return Orientation.valueOf(value.toString());
  }

  private static String slug(String v) { return v.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""); }
  private ResponseEntity<byte[]> pdfResponse(byte[] pdf, String filename) {
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
      .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
      .body(pdf);
  }
}
