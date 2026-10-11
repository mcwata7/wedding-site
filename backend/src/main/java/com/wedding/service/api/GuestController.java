package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import com.wedding.service.service.SlackNotifier;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/guest")
public class GuestController {
 private final DataService db; private final SlackNotifier slack; GuestController(DataService db,SlackNotifier slack){this.db=db;this.slack=slack;}
 public record GuestUpdate(String email,String phone,String dietaryRequirements,String travelOrigin,String flightNumber) {}
 public record RsvpUpdate(@NotBlank String status,String note) {}
 public record ChangeRequest(@NotBlank String note) {}
 @GetMapping("/party") Map<String,Object> party(@AuthenticationPrincipal Principal p) { var party=db.one("SELECT id,display_name,mailing_address FROM party WHERE id=:id AND NOT archived",Map.of("id",p.partyId())); var guests=db.many("SELECT id,first_name,last_name,email,phone,dietary_requirements,accessibility_needs,travel_origin,flight_number,is_additional_guest,rsvp_status,rsvp_note,rsvp_updated_at FROM guest WHERE party_id=:id AND active=true ORDER BY created_at",Map.of("id",p.partyId())); return Map.of("party",party,"guests",guests); }
 @PatchMapping("/guests/{id}") Map<String,Object> updateGuest(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@RequestBody GuestUpdate in) { var g=db.one("SELECT * FROM guest WHERE id=:id AND party_id=:p AND active=true",Map.of("id",id,"p",p.partyId())); db.named.update("UPDATE guest SET email=:e,phone=:ph,dietary_requirements=:d,travel_origin=:o,flight_number=:f,updated_at=now() WHERE id=:id",new org.springframework.jdbc.core.namedparam.MapSqlParameterSource().addValue("e",in.email()).addValue("ph",in.phone()).addValue("d",in.dietaryRequirements()).addValue("o",in.travelOrigin()).addValue("f",in.flightNumber()).addValue("id",id)); return db.one("SELECT id,first_name,last_name,email,phone,dietary_requirements,travel_origin,flight_number FROM guest WHERE id=:id",Map.of("id",id)); }
 @GetMapping("/events") List<Map<String,Object>> events(@AuthenticationPrincipal Principal p) { return db.many("SELECT e.id,e.name,e.description,e.starts_at,e.ends_at,e.dress_code,v.name venue_name FROM event e LEFT JOIN venue v ON v.id=e.venue_id WHERE NOT e.archived ORDER BY e.starts_at",Map.of()); }
 @Transactional
 @PutMapping("/guests/{id}/rsvp") Map<String,Object> rsvp(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Valid @RequestBody RsvpUpdate in) {
   db.one("SELECT g.id FROM guest g JOIN party p ON p.id=g.party_id WHERE g.id=:id AND g.party_id=:p AND g.active AND NOT p.archived FOR UPDATE",Map.of("id",id,"p",p.partyId()));
   String status=in.status().trim().toUpperCase(Locale.ROOT);
   if(!Set.of("ATTENDING","DECLINED","PENDING").contains(status)) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_RSVP","Invalid RSVP status");
   db.named.update("UPDATE guest SET rsvp_status=:s,rsvp_note=:n,rsvp_source='GUEST',rsvp_updated_at=now(),updated_at=now() WHERE id=:id",Map.of("s",status,"n",in.note()==null?"":in.note(),"id",id));
   slack.rsvpRecorded(id);
   return db.one("SELECT id,first_name,last_name,rsvp_status,rsvp_note,rsvp_updated_at FROM guest WHERE id=:id",Map.of("id",id));
 }
 @GetMapping("/accommodation") List<Map<String,Object>> accommodations(@AuthenticationPrincipal Principal p) { return db.many("SELECT a.id,a.check_in,a.check_out,a.status,a.coverage_notes,r.room_number,r.room_type,v.name venue_name,v.address FROM accommodation_assignment a JOIN venue_room r ON r.id=a.room_id JOIN venue v ON v.id=r.venue_id WHERE a.party_id=:p OR a.guest_id IN (SELECT id FROM guest WHERE party_id=:p)",Map.of("p",p.partyId())); }
 @PostMapping("/accommodation/{id}/change-requests") Map<String,Object> request(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Valid @RequestBody ChangeRequest in) { db.one("SELECT id FROM accommodation_assignment WHERE id=:id AND (party_id=:p OR guest_id IN (SELECT id FROM guest WHERE party_id=:p))",Map.of("id",id,"p",p.partyId())); UUID request=db.uuid(); db.named.update("INSERT INTO accommodation_change_request(id,assignment_id,party_id,request_note) VALUES(:i,:a,:p,:n)",Map.of("i",request,"a",id,"p",p.partyId(),"n",in.note())); return Map.of("id",request,"status","OPEN"); }
}
