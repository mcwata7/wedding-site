package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import com.wedding.service.service.InvitationCardRenderer;
import com.wedding.service.service.InvitationCardRenderer.Orientation;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Read and lifecycle endpoints used by the planner application. */
@RestController @RequestMapping("/api/v1/internal")
public class InternalDataController {
  private final DataService db;
  InternalDataController(DataService db) { this.db = db; }

  private static final Map<String, String> TABLES = Map.ofEntries(
    Map.entry("parties", "party"), Map.entry("guests", "guest"), Map.entry("venues", "venue"), Map.entry("events", "event"),
    Map.entry("venue-rooms", "venue_room"), Map.entry("venue-fees", "venue_fee"),
    Map.entry("site-pages", "site_page"), Map.entry("things-to-do-items", "thing_to_do_item"),
    Map.entry("faq-items", "faq_item"), Map.entry("travel-hotels", "travel_hotel"), Map.entry("travel-flights", "travel_flight"));
  private static final Map<String, Set<String>> COLUMNS = Map.ofEntries(
    Map.entry("parties", Set.of("display_name","contact_email","contact_phone","verification_question")),
    Map.entry("guests", Set.of("first_name","last_name","relationship_group","email","phone","dietary_requirements","accessibility_needs","travel_origin","flight_number","planner_notes","is_additional_guest","wedding_side","attendance_probability","is_wedding_party","passport","is_ktm_resident","is_child","room_assignment_id","invite_round")),
    Map.entry("venues", Set.of("name","address","contact_information","capacity","notes","distance_from_ktm_km","transportation_required","room_block_min","room_block_max","image_id")),
    Map.entry("events", Set.of("name","venue_id","description","starts_at","ends_at","dress_code","capacity","rsvp_deadline","public_visible")),
    Map.entry("venue-rooms", Set.of("room_type","room_number","capacity","max_available","nepali_rate","foreigner_rate","notes")),
    Map.entry("venue-fees", Set.of("fee_type","amount","notes")),
    Map.entry("site-pages", Set.of("label","heading","sort_order","visible","body","image_id")),
    Map.entry("things-to-do-items", Set.of("category","title","description","image_id","sort_order")),
    Map.entry("faq-items", Set.of("question","answer","sort_order")),
    Map.entry("travel-hotels", Set.of("name","address","url","description","sort_order")),
    Map.entry("travel-flights", Set.of("route_name","duration","estimated_cost","description","sort_order")));

  @GetMapping("/dashboard") Map<String,Object> dashboard() {
    return Map.of("parties", count("party WHERE NOT archived"), "guests", count("guest WHERE active"), "events", count("event WHERE NOT archived"),
      "attending", count("rsvp WHERE status='ATTENDING'"), "pendingRsvps", count("rsvp WHERE status='PENDING'"), "openChangeRequests", count("accommodation_change_request WHERE status='OPEN'"));
  }
  @GetMapping("/venues") List<Map<String,Object>> venues() { return list("SELECT v.*,"
    + "(SELECT coalesce(sum(max_available),0) FROM venue_room r WHERE r.venue_id=v.id AND NOT r.archived) room_block_rooms,"
    + "(SELECT coalesce(sum(capacity*max_available),0) FROM venue_room r WHERE r.venue_id=v.id AND NOT r.archived) room_block_beds,"
    + "(SELECT coalesce(sum(amount),0) FROM venue_fee f WHERE f.venue_id=v.id AND NOT f.archived) total_fees"
    + " FROM venue v WHERE NOT v.archived ORDER BY v.name"); }
  @GetMapping("/venues/{id}") Map<String,Object> venue(@PathVariable UUID id) { var venue=db.one("SELECT * FROM venue WHERE id=:id",Map.of("id",id)); var rooms=db.many("SELECT * FROM venue_room WHERE venue_id=:id AND NOT archived ORDER BY room_type",Map.of("id",id)); var fees=db.many("SELECT * FROM venue_fee WHERE venue_id=:id AND NOT archived ORDER BY fee_type",Map.of("id",id)); return Map.of("venue",venue,"rooms",rooms,"fees",fees); }
  @GetMapping("/venues/rooms") List<Map<String,Object>> allVenueRooms() { return list("SELECT r.*,v.name venue_name FROM venue_room r JOIN venue v ON v.id=r.venue_id WHERE NOT r.archived AND NOT v.archived ORDER BY v.name,r.room_type,r.room_number"); }
  @GetMapping("/parties/{id}") Map<String,Object> party(@PathVariable UUID id) {
    var party=db.one("SELECT p.*,i.id invitation_id,i.token,i.status invitation_status,i.sent_at,i.viewed_at,i.token_expires_at,"
      + "coalesce(t.locked_permanently,false) login_locked_permanently,coalesce(t.failed_count,0) login_failed_count,"
      + "CASE WHEN t.locked_until>now() THEN t.locked_until END login_locked_until"
      + " FROM party p LEFT JOIN invitation i ON i.party_id=p.id LEFT JOIN guest_login_throttle t ON t.party_id=p.id WHERE p.id=:id",Map.of("id",id));
    var guests=db.many("SELECT g.*,r.room_number,v.name room_venue_name FROM guest g LEFT JOIN venue_room r ON r.id=g.room_assignment_id LEFT JOIN venue v ON v.id=r.venue_id WHERE g.party_id=:id AND g.active ORDER BY g.created_at",Map.of("id",id));
    var events=db.many("SELECT e.* FROM event e WHERE NOT e.archived ORDER BY e.starts_at",Map.of());
    var rsvps=db.many("SELECT r.*,g.first_name,g.last_name FROM rsvp r JOIN guest g ON g.id=r.guest_id WHERE r.party_id=:id",Map.of("id",id));
    return Map.of("party",party,"guests",guests,"events",events,"rsvps",rsvps);
  }
  @GetMapping("/events") List<Map<String,Object>> events() { return list("SELECT e.*,v.name venue_name, count(r.id) FILTER (WHERE r.status='ATTENDING') attending_count, count(r.id) FILTER (WHERE r.status='WAITLISTED') waitlist_count FROM event e LEFT JOIN venue v ON v.id=e.venue_id LEFT JOIN rsvp r ON r.event_id=e.id WHERE NOT e.archived GROUP BY e.id,v.name ORDER BY e.starts_at"); }
  @GetMapping("/rsvps") List<Map<String,Object>> rsvps(@RequestParam(required=false) UUID eventId) { var ps=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource(); String sql="SELECT r.*,g.first_name,g.last_name,p.display_name party_name,e.name event_name FROM rsvp r JOIN guest g ON g.id=r.guest_id JOIN party p ON p.id=g.party_id JOIN event e ON e.id=r.event_id"; if(eventId!=null){sql+=" WHERE r.event_id=:eventId";ps.addValue("eventId",eventId);} return db.named.queryForList(sql+" ORDER BY e.starts_at,p.display_name,g.last_name",ps); }
  @GetMapping("/accommodations/assignments") List<Map<String,Object>> assignments() { return list("SELECT a.*,r.room_number,v.name venue_name,coalesce(pa.display_name, g.first_name||' '||g.last_name) assignee FROM accommodation_assignment a JOIN venue_room r ON r.id=a.room_id JOIN venue v ON v.id=r.venue_id LEFT JOIN party pa ON pa.id=a.party_id LEFT JOIN guest g ON g.id=a.guest_id ORDER BY a.check_in,v.name,r.room_number"); }
  @GetMapping("/accommodations/change-requests") List<Map<String,Object>> requests() { return list("SELECT c.*,p.display_name party_name FROM accommodation_change_request c JOIN party p ON p.id=c.party_id ORDER BY c.created_at DESC"); }
  @GetMapping("/site/settings") Map<String,Object> siteSettings() { return db.one("SELECT * FROM site_settings WHERE singleton", Map.of()); }
  @GetMapping("/site/pages") List<Map<String,Object>> sitePages() { return list("SELECT * FROM site_page ORDER BY sort_order"); }
  @GetMapping("/site/things-to-do-items") List<Map<String,Object>> thingsToDoItems() { return list("SELECT * FROM thing_to_do_item WHERE NOT archived ORDER BY sort_order"); }
  @GetMapping("/site/faq-items") List<Map<String,Object>> faqItems() { return list("SELECT * FROM faq_item WHERE NOT archived ORDER BY sort_order"); }
  @GetMapping("/site/travel-hotels") List<Map<String,Object>> travelHotels() { return list("SELECT * FROM travel_hotel WHERE NOT archived ORDER BY sort_order"); }
  @GetMapping("/site/travel-flights") List<Map<String,Object>> travelFlights() { return list("SELECT * FROM travel_flight WHERE NOT archived ORDER BY sort_order"); }

  /** Status list backing the /invitations planner page. Never selects invitation.token -- see the comment on that column in V4. */
  @GetMapping("/invitations") List<Map<String,Object>> invitations() {
    return list("SELECT p.id party_id,p.display_name,i.id invitation_id,i.status invitation_status,i.sent_at,i.token_expires_at,"
      + "(i.token IS NOT NULL) printable FROM party p LEFT JOIN invitation i ON i.party_id=p.id WHERE NOT p.archived ORDER BY p.display_name");
  }

  private static final Set<String> SETTINGS_COLUMNS = Set.of("partner_one_name","partner_two_name","wedding_start_date","wedding_end_date","display_timezone","hero_image_id","hero_tagline",
    "invitation_front_image_id","invitation_back_image_id","invitation_orientation","invitation_card_layout","site_layout",
    "header_font_family","header_font_color","header_font_size","header_bg_color",
    "site_font_family","site_font_color","site_font_size","site_bg_color",
    "tile_bg_color","tile_border_color",
    "home_design_image_id","home_design_only");
  private static final Set<String> DATE_COLUMNS = Set.of("wedding_start_date","wedding_end_date");
  @PatchMapping("/site/settings") Map<String,Object> updateSiteSettings(@AuthenticationPrincipal Principal actor,@RequestBody Map<String,Object> input) {
    var updates = input.entrySet().stream().filter(e -> SETTINGS_COLUMNS.contains(e.getKey())).toList();
    if (updates.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","No editable fields were provided");
    Map<String,Object> before = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());

    // The layout's x/y/size bounds depend on orientation, so resolve the orientation this patch
    // will leave in effect up front -- whether it's part of this same patch or already stored.
    Orientation orientation = input.containsKey("invitation_orientation")
      ? parseOrientationOrThrow(input.get("invitation_orientation")) : parseOrientationOrThrow(before.get("invitation_orientation"));

    var params = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource(); List<String> setters = new ArrayList<>();
    boolean layoutInPatch = false;
    for (var e : updates) {
      String col = e.getKey(); Object val = db.coerceUuidLike(col, e.getValue());
      if ("invitation_card_layout".equals(col)) {
        layoutInPatch = true;
        if (val == null) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","invitation_card_layout cannot be null");
        var layout = InvitationCardRenderer.validate(InvitationCardRenderer.parseLayout(val, db.json).withDefaults(), orientation);
        try { val = db.json.writeValueAsString(layout); } catch (Exception ex) { throw new IllegalStateException(ex); }
        setters.add(col + "=cast(:" + col + " as jsonb)");
      } else if ("invitation_orientation".equals(col)) {
        setters.add(col + "=:" + col);
        val = orientation.name();
      } else if ("site_layout".equals(col)) {
        setters.add(col + "=:" + col);
        val = parseSiteLayoutOrThrow(val);
      } else if ("header_font_family".equals(col) || "site_font_family".equals(col)) {
        setters.add(col + "=:" + col);
        val = parseFontFamilyOrNull(val);
      } else if ("header_font_size".equals(col) || "site_font_size".equals(col)) {
        setters.add(col + "=:" + col);
        val = parseFontSizeOrNull(val);
      } else if ("header_font_color".equals(col) || "header_bg_color".equals(col) || "site_font_color".equals(col) || "site_bg_color".equals(col)
          || "tile_bg_color".equals(col) || "tile_border_color".equals(col)) {
        setters.add(col + "=:" + col);
        val = blankToNull(val);
      } else if ("home_design_only".equals(col)) {
        setters.add(col + "=:" + col);
        val = parseBooleanOrDefault(val, false);
      } else {
        setters.add(col + "=" + (DATE_COLUMNS.contains(col) && val instanceof String ? "cast(:"+col+" as date)" : ":"+col));
      }
      params.addValue(col, val);
    }

    // Orientation changed without a paired layout update in this same patch -- re-validate the
    // already-stored layout against the new orientation, so an incompatible saved position 422s
    // here, on Save, rather than silently succeeding and only failing the next PDF render.
    if (input.containsKey("invitation_orientation") && !layoutInPatch) {
      InvitationCardRenderer.validate(
        InvitationCardRenderer.parseLayout(before.get("invitation_card_layout"), db.json).withDefaults(), orientation);
    }

    setters.add("updated_at=now()");
    db.named.update("UPDATE site_settings SET "+String.join(",",setters)+" WHERE singleton", params);
    Map<String,Object> after = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());
    db.audit(actor.id(),"UPDATE","SITE_SETTINGS",db.id(after.get("id")),before,after); return after;
  }

  /** Guards a null/blank orientation (a singleton row from before this column existed) to the
   * schema's own default, and turns a bad value into a clean 400 instead of a DB CHECK 500. */
  private static Orientation parseOrientationOrThrow(Object value) {
    if (value == null || value.toString().isBlank()) return Orientation.PORTRAIT;
    try { return Orientation.valueOf(value.toString().trim().toUpperCase()); }
    catch (IllegalArgumentException e) { throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "invitation_orientation must be PORTRAIT or LANDSCAPE"); }
  }

  private static final Set<String> SITE_LAYOUTS = Set.of("MULTI_PAGE","SINGLE_PAGE");
  /** Same shape as parseOrientationOrThrow: a null/blank value falls back to the column's own
   * schema default rather than tripping the NOT NULL constraint, and a bad value becomes a clean
   * 400 instead of surfacing as an opaque 500 from the CHECK constraint. */
  static String parseSiteLayoutOrThrow(Object value) {
    if (value == null || value.toString().isBlank()) return "MULTI_PAGE";
    String v = value.toString().trim().toUpperCase();
    if (!SITE_LAYOUTS.contains(v)) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "site_layout must be MULTI_PAGE or SINGLE_PAGE");
    return v;
  }

  // The 10 custom fonts bundled as static assets in the guest app (frontend/public/public/fonts) --
  // kept in sync with frontend/public/src/lib/theme.ts and frontend/internal's font label map.
  // No DB CHECK constraint on this list (unlike SITE_LAYOUTS/FONT_SIZES below): it's a frontend
  // asset set expected to grow, and this method is the only writer, so a CHECK would only add a
  // migration requirement for every new font with no extra safety.
  private static final Set<String> SITE_FONTS = Set.of("TANGERINE","ROUGE_SCRIPT","MONSIEUR_LA_DOULAISE",
    "GWENDOLYN","EPHESIS","LAVISHLY_YOURS","OOOH_BABY","CARATTERE","BIRTHSTONE","BILBO_SWASH_CAPS");
  private static final Set<String> FONT_SIZES = Set.of("SMALL","MEDIUM","LARGE");

  /** Unlike parseOrientationOrThrow/parseSiteLayoutOrThrow, these 4 style columns have no schema
   * default -- null means "use the guest app's built-in look", so null/blank must stay null, not
   * get substituted for some default value. A bad value still 400s instead of hitting the (font
   * size's) CHECK constraint as an opaque 500, or (font family's, which has no CHECK) silently
   * storing garbage. */
  static String parseFontFamilyOrNull(Object value) {
    if (value == null || value.toString().isBlank()) return null;
    String v = value.toString().trim().toUpperCase();
    if (!SITE_FONTS.contains(v)) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "font family must be one of " + SITE_FONTS);
    return v;
  }
  static String parseFontSizeOrNull(Object value) {
    if (value == null || value.toString().isBlank()) return null;
    String v = value.toString().trim().toUpperCase();
    if (!FONT_SIZES.contains(v)) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "font size must be SMALL, MEDIUM, or LARGE");
    return v;
  }
  /** A CSS color column has no format validation (matches hero_tagline's "plain text" precedent) --
   * but blank must still become NULL, never an empty string, so the guest app's `var(--x, fallback)`
   * CSS can keep falling back once a planner clears the field. */
  private static String blankToNull(Object value) {
    return (value == null || value.toString().isBlank()) ? null : value.toString();
  }
  static boolean parseBooleanOrDefault(Object value, boolean fallback) {
    if (value == null) return fallback;
    if (value instanceof Boolean b) return b;
    return Boolean.parseBoolean(value.toString());
  }

  @PatchMapping("/resources/{resource}/{id}") Map<String,Object> update(@AuthenticationPrincipal Principal actor,@PathVariable String resource,@PathVariable UUID id,@RequestBody Map<String,Object> input) {
    String table=table(resource); Set<String> allowed=COLUMNS.get(resource); var updates=input.entrySet().stream().filter(e->allowed.contains(e.getKey())).toList();
    if(updates.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","No editable fields were provided");
    Map<String,Object> before=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); var params=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource("id",id); List<String> setters=new ArrayList<>(); for(var e:updates){setters.add(e.getKey()+"=:"+e.getKey());params.addValue(e.getKey(),db.checkEnum(e.getKey(),db.coerceUuidLike(e.getKey(),e.getValue())));}
    if(Set.of("venue","event","site_page","thing_to_do_item","venue_room","venue_fee","faq_item","travel_hotel","travel_flight").contains(table)) setters.add("updated_at=now()");
    db.named.update("UPDATE "+table+" SET "+String.join(",",setters)+" WHERE id=:id",params); Map<String,Object> after=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); db.audit(actor.id(),"UPDATE",table.toUpperCase(),id,before,after); return after;
  }
  @PostMapping("/resources/{resource}/{id}/archive") Map<String,Object> archive(@AuthenticationPrincipal Principal actor,@PathVariable String resource,@PathVariable UUID id) {
    String table=table(resource); Map<String,Object> before=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); String field="guest".equals(table)?"active":"archived"; String value="guest".equals(table)?"false":"true";
    db.named.update("UPDATE "+table+" SET "+field+"="+value+" WHERE id=:id",Map.of("id",id));
    if("guest".equals(table)) db.syncRsvps();
    Map<String,Object> after=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); db.audit(actor.id(),"ARCHIVE",table.toUpperCase(),id,before,after); return after;
  }
  @PostMapping("/accommodations/change-requests/{id}/{action}") Map<String,Object> resolve(@AuthenticationPrincipal Principal actor,@PathVariable UUID id,@PathVariable String action) {
    String status=switch(action){case "resolve"->"RESOLVED";case "decline"->"DECLINED";default->throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ACTION","Action must be resolve or decline");};
    db.named.update("UPDATE accommodation_change_request SET status=:s WHERE id=:id",Map.of("s",status,"id",id)); Map<String,Object> result=db.one("SELECT * FROM accommodation_change_request WHERE id=:id",Map.of("id",id));db.audit(actor.id(),status,"ACCOMMODATION_CHANGE_REQUEST",id,null,result);return result;
  }
  private int count(String target){return db.jdbc.queryForObject("SELECT count(*) FROM "+target,Integer.class);}
  private List<Map<String,Object>> list(String sql){return db.many(sql,Map.of());}
  private String table(String resource){String table=TABLES.get(resource);if(table==null)throw new ApiException(HttpStatus.NOT_FOUND,"NOT_FOUND","Unknown resource");return table;}
}
