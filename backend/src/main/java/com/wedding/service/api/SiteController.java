package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Read-only public-site content for authenticated guests. Kept separate from GuestController's
 * RSVP-facing endpoints so the public_visible filter here never affects RSVP eligibility. */
@RestController @RequestMapping("/api/v1/guest/site")
public class SiteController {
  private final DataService db; SiteController(DataService db) { this.db = db; }

  @GetMapping("/config") Map<String,Object> config() {
    var settings = db.one("SELECT * FROM site_settings WHERE singleton", Map.of());
    var pages = db.many("SELECT slug,label,heading,sort_order,body,image_id FROM site_page WHERE visible ORDER BY sort_order", Map.of());
    return Map.of("settings", settings, "pages", pages);
  }

  @GetMapping("/schedule") List<Map<String,Object>> schedule(@AuthenticationPrincipal Principal p) {
    return db.many("SELECT e.id,e.name,e.description,e.starts_at,e.ends_at,e.dress_code,v.name venue_name,v.address venue_address " +
      "FROM event e JOIN event_eligibility ee ON ee.event_id=e.id AND ee.party_id=:p LEFT JOIN venue v ON v.id=e.venue_id " +
      "WHERE e.public_visible AND NOT e.archived ORDER BY e.starts_at", Map.of("p", p.partyId()));
  }

  @GetMapping("/things-to-do") List<Map<String,Object>> thingsToDo() {
    return db.many("SELECT id,category,title,description,image_id,sort_order FROM thing_to_do_item WHERE NOT archived ORDER BY sort_order", Map.of());
  }

  @GetMapping("/faq") List<Map<String,Object>> faq() {
    return db.many("SELECT id,question,answer,sort_order FROM faq_item WHERE NOT archived ORDER BY sort_order", Map.of());
  }

  @GetMapping("/travel") Map<String,Object> travel() {
    var hotels = db.many("SELECT id,name,address,url,description,sort_order FROM travel_hotel WHERE NOT archived ORDER BY sort_order", Map.of());
    var flights = db.many("SELECT id,route_name,duration,estimated_cost,description,sort_order FROM travel_flight WHERE NOT archived ORDER BY sort_order", Map.of());
    return Map.of("hotels", hotels, "flights", flights);
  }
}
