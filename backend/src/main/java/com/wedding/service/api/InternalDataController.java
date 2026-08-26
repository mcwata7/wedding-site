package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
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
    Map.entry("properties", "accommodation_property"), Map.entry("rooms", "accommodation_room"),
    Map.entry("categories", "budget_category"), Map.entry("contributors", "budget_contributor"), Map.entry("line-items", "budget_line_item"),
    Map.entry("site-pages", "site_page"), Map.entry("things-to-do-items", "thing_to_do_item"));
  private static final Map<String, Set<String>> COLUMNS = Map.ofEntries(
    Map.entry("parties", Set.of("display_name","contact_email","contact_phone","verification_question")),
    Map.entry("guests", Set.of("first_name","last_name","relationship_group","email","phone","dietary_requirements","accessibility_needs","travel_origin","flight_number","planner_notes","is_additional_guest")),
    Map.entry("venues", Set.of("name","address","contact_information","pricing","capacity","food_score","view_score","notes")),
    Map.entry("events", Set.of("name","venue_id","description","starts_at","ends_at","dress_code","capacity","rsvp_deadline","public_visible")),
    Map.entry("properties", Set.of("name","address","contact_information","notes")),
    Map.entry("rooms", Set.of("property_id","room_number","room_type","capacity")),
    Map.entry("categories", Set.of("name")), Map.entry("contributors", Set.of("name")),
    Map.entry("line-items", Set.of("category_id","description","currency","planned_amount","actual_amount","payment_status","due_date","notes")),
    Map.entry("site-pages", Set.of("label","sort_order","visible","body")),
    Map.entry("things-to-do-items", Set.of("category","title","description","image_id","sort_order")));

  @GetMapping("/dashboard") Map<String,Object> dashboard() {
    return Map.of("parties", count("party WHERE NOT archived"), "guests", count("guest WHERE active"), "events", count("event WHERE NOT archived"),
      "attending", count("rsvp WHERE status='ATTENDING'"), "pendingRsvps", count("rsvp WHERE status='PENDING'"), "openChangeRequests", count("accommodation_change_request WHERE status='OPEN'"));
  }
  @GetMapping("/venues") List<Map<String,Object>> venues() { return list("SELECT * FROM venue WHERE NOT archived ORDER BY name"); }
  @GetMapping("/parties/{id}") Map<String,Object> party(@PathVariable UUID id) { var party=db.one("SELECT p.*,i.id invitation_id,i.status invitation_status,i.sent_at,i.viewed_at,i.token_expires_at FROM party p LEFT JOIN invitation i ON i.party_id=p.id WHERE p.id=:id",Map.of("id",id)); var guests=db.many("SELECT * FROM guest WHERE party_id=:id AND active ORDER BY created_at",Map.of("id",id)); return Map.of("party",party,"guests",guests); }
  @GetMapping("/events") List<Map<String,Object>> events() { return list("SELECT e.*,v.name venue_name, count(r.id) FILTER (WHERE r.status='ATTENDING') attending_count, count(r.id) FILTER (WHERE r.status='WAITLISTED') waitlist_count FROM event e LEFT JOIN venue v ON v.id=e.venue_id LEFT JOIN rsvp r ON r.event_id=e.id WHERE NOT e.archived GROUP BY e.id,v.name ORDER BY e.starts_at"); }
  @GetMapping("/rsvps") List<Map<String,Object>> rsvps(@RequestParam(required=false) UUID eventId) { var ps=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource(); String sql="SELECT r.*,g.first_name,g.last_name,p.display_name party_name,e.name event_name FROM rsvp r JOIN guest g ON g.id=r.guest_id JOIN party p ON p.id=g.party_id JOIN event e ON e.id=r.event_id"; if(eventId!=null){sql+=" WHERE r.event_id=:eventId";ps.addValue("eventId",eventId);} return db.named.queryForList(sql+" ORDER BY e.starts_at,p.display_name,g.last_name",ps); }
  @GetMapping("/accommodations/properties") List<Map<String,Object>> properties() { return list("SELECT * FROM accommodation_property WHERE NOT archived ORDER BY name"); }
  @GetMapping("/accommodations/rooms") List<Map<String,Object>> rooms() { return list("SELECT r.*,p.name property_name FROM accommodation_room r JOIN accommodation_property p ON p.id=r.property_id WHERE NOT r.archived AND NOT p.archived ORDER BY p.name,r.room_number"); }
  @GetMapping("/accommodations/assignments") List<Map<String,Object>> assignments() { return list("SELECT a.*,r.room_number,p.name property_name,coalesce(pa.display_name, g.first_name||' '||g.last_name) assignee FROM accommodation_assignment a JOIN accommodation_room r ON r.id=a.room_id JOIN accommodation_property p ON p.id=r.property_id LEFT JOIN party pa ON pa.id=a.party_id LEFT JOIN guest g ON g.id=a.guest_id ORDER BY a.check_in,p.name,r.room_number"); }
  @GetMapping("/accommodations/change-requests") List<Map<String,Object>> requests() { return list("SELECT c.*,p.display_name party_name FROM accommodation_change_request c JOIN party p ON p.id=c.party_id ORDER BY c.created_at DESC"); }
  @GetMapping("/budget/categories") List<Map<String,Object>> categories() { return list("SELECT * FROM budget_category WHERE NOT archived ORDER BY name"); }
  @GetMapping("/budget/contributors") List<Map<String,Object>> contributors() { return list("SELECT * FROM budget_contributor WHERE NOT archived ORDER BY name"); }
  @GetMapping("/budget/line-items") List<Map<String,Object>> lineItems() { return list("SELECT b.*,c.name category_name FROM budget_line_item b JOIN budget_category c ON c.id=b.category_id WHERE NOT b.archived ORDER BY c.name,b.description"); }
  @GetMapping("/budget/summary") List<Map<String,Object>> budgetSummary() { return list("SELECT c.name category, sum(b.planned_amount) planned_amount, sum(b.actual_amount) actual_amount, b.currency FROM budget_line_item b JOIN budget_category c ON c.id=b.category_id WHERE NOT b.archived GROUP BY c.name,b.currency ORDER BY c.name,b.currency"); }
  @GetMapping("/site/settings") Map<String,Object> siteSettings() { return db.one("SELECT * FROM site_settings WHERE singleton", Map.of()); }
  @GetMapping("/site/pages") List<Map<String,Object>> sitePages() { return list("SELECT * FROM site_page ORDER BY sort_order"); }
  @GetMapping("/site/things-to-do-items") List<Map<String,Object>> thingsToDoItems() { return list("SELECT * FROM thing_to_do_item WHERE NOT archived ORDER BY sort_order"); }

  /** Status list backing the /invitations planner page. Never selects invitation.token -- see the comment on that column in V4. */
  @GetMapping("/invitations") List<Map<String,Object>> invitations() {
    return list("SELECT p.id party_id,p.display_name,i.id invitation_id,i.status invitation_status,i.sent_at,i.token_expires_at,"
      + "(i.token IS NOT NULL) printable FROM party p LEFT JOIN invitation i ON i.party_id=p.id WHERE NOT p.archived ORDER BY p.display_name");
  }

  private static final Set<String> SETTINGS_COLUMNS = Set.of("partner_one_name","partner_two_name","wedding_date","display_timezone","hero_image_id","hero_tagline",
    "home_heading","home_body","travel_heading","travel_body","things_to_do_heading","things_to_do_body","schedule_heading","schedule_body",
    "invitation_image_id","invitation_headline","invitation_body","invitation_footer");
  @PatchMapping("/site/settings") Map<String,Object> updateSiteSettings(@AuthenticationPrincipal Principal actor,@RequestBody Map<String,Object> input) {
    var updates = input.entrySet().stream().filter(e -> SETTINGS_COLUMNS.contains(e.getKey())).toList();
    if (updates.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","No editable fields were provided");
    Map<String,Object> before = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());
    var params = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource(); List<String> setters = new ArrayList<>();
    for (var e : updates) {
      String col = e.getKey(); Object val = db.coerceUuidLike(col, e.getValue());
      setters.add(col + "=" + ("wedding_date".equals(col) && val instanceof String ? "cast(:"+col+" as date)" : ":"+col));
      params.addValue(col, val);
    }
    setters.add("updated_at=now()");
    db.named.update("UPDATE site_settings SET "+String.join(",",setters)+" WHERE singleton", params);
    Map<String,Object> after = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());
    db.audit(actor.id(),"UPDATE","SITE_SETTINGS",db.id(after.get("id")),before,after); return after;
  }

  @PatchMapping("/resources/{resource}/{id}") Map<String,Object> update(@AuthenticationPrincipal Principal actor,@PathVariable String resource,@PathVariable UUID id,@RequestBody Map<String,Object> input) {
    String table=table(resource); Set<String> allowed=COLUMNS.get(resource); var updates=input.entrySet().stream().filter(e->allowed.contains(e.getKey())).toList();
    if(updates.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","No editable fields were provided");
    Map<String,Object> before=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); var params=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource("id",id); List<String> setters=new ArrayList<>(); for(var e:updates){setters.add(e.getKey()+"=:"+e.getKey());params.addValue(e.getKey(),db.coerceUuidLike(e.getKey(),e.getValue()));}
    if(Set.of("venue","event","budget_line_item","site_page","thing_to_do_item").contains(table)) setters.add("updated_at=now()");
    db.named.update("UPDATE "+table+" SET "+String.join(",",setters)+" WHERE id=:id",params); Map<String,Object> after=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); db.audit(actor.id(),"UPDATE",table.toUpperCase(),id,before,after); return after;
  }
  @PostMapping("/resources/{resource}/{id}/archive") Map<String,Object> archive(@AuthenticationPrincipal Principal actor,@PathVariable String resource,@PathVariable UUID id) {
    String table=table(resource); Map<String,Object> before=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); String field="guest".equals(table)?"active":"archived"; String value="guest".equals(table)?"false":"true";
    db.named.update("UPDATE "+table+" SET "+field+"="+value+" WHERE id=:id",Map.of("id",id)); Map<String,Object> after=db.one("SELECT * FROM "+table+" WHERE id=:id",Map.of("id",id)); db.audit(actor.id(),"ARCHIVE",table.toUpperCase(),id,before,after); return after;
  }
  @PostMapping("/accommodations/change-requests/{id}/{action}") Map<String,Object> resolve(@AuthenticationPrincipal Principal actor,@PathVariable UUID id,@PathVariable String action) {
    String status=switch(action){case "resolve"->"RESOLVED";case "decline"->"DECLINED";default->throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ACTION","Action must be resolve or decline");};
    db.named.update("UPDATE accommodation_change_request SET status=:s WHERE id=:id",Map.of("s",status,"id",id)); Map<String,Object> result=db.one("SELECT * FROM accommodation_change_request WHERE id=:id",Map.of("id",id));db.audit(actor.id(),status,"ACCOMMODATION_CHANGE_REQUEST",id,null,result);return result;
  }
  private int count(String target){return db.jdbc.queryForObject("SELECT count(*) FROM "+target,Integer.class);}
  private List<Map<String,Object>> list(String sql){return db.many(sql,Map.of());}
  private String table(String resource){String table=TABLES.get(resource);if(table==null)throw new ApiException(HttpStatus.NOT_FOUND,"NOT_FOUND","Unknown resource");return table;}
}
