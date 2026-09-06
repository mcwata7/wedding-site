package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import com.wedding.service.service.SlackNotifier;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
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
 @GetMapping("/party") Map<String,Object> party(@AuthenticationPrincipal Principal p) { var party=db.one("SELECT id,display_name,contact_email,contact_phone FROM party WHERE id=:id",Map.of("id",p.partyId())); var guests=db.many("SELECT id,first_name,last_name,email,phone,dietary_requirements,accessibility_needs,travel_origin,flight_number,is_additional_guest FROM guest WHERE party_id=:id AND active=true ORDER BY created_at",Map.of("id",p.partyId())); return Map.of("party",party,"guests",guests); }
 @PatchMapping("/guests/{id}") Map<String,Object> updateGuest(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@RequestBody GuestUpdate in) { var g=db.one("SELECT * FROM guest WHERE id=:id AND party_id=:p AND active=true",Map.of("id",id,"p",p.partyId())); db.named.update("UPDATE guest SET email=:e,phone=:ph,dietary_requirements=:d,travel_origin=:o,flight_number=:f,updated_at=now() WHERE id=:id",new org.springframework.jdbc.core.namedparam.MapSqlParameterSource().addValue("e",in.email()).addValue("ph",in.phone()).addValue("d",in.dietaryRequirements()).addValue("o",in.travelOrigin()).addValue("f",in.flightNumber()).addValue("id",id)); return db.one("SELECT id,first_name,last_name,email,phone,dietary_requirements,travel_origin,flight_number FROM guest WHERE id=:id",Map.of("id",id)); }
 @GetMapping("/events") List<Map<String,Object>> events(@AuthenticationPrincipal Principal p) { return db.many("SELECT e.id,e.name,e.description,e.starts_at,e.ends_at,e.dress_code,e.rsvp_deadline,v.name venue_name FROM event e JOIN event_eligibility ee ON ee.event_id=e.id AND ee.party_id=:p LEFT JOIN venue v ON v.id=e.venue_id WHERE NOT e.archived ORDER BY e.starts_at",Map.of("p",p.partyId())); }
 @GetMapping("/rsvps") List<Map<String,Object>> rsvps(@AuthenticationPrincipal Principal p) { return db.many("SELECT r.id,r.status,r.note,r.updated_at,g.first_name,g.last_name,e.name event_name,e.starts_at FROM rsvp r JOIN guest g ON g.id=r.guest_id JOIN event e ON e.id=r.event_id WHERE g.party_id=:p ORDER BY e.starts_at,g.first_name",Map.of("p",p.partyId())); }
 @Transactional
 @PutMapping("/rsvps/{id}") Map<String,Object> rsvp(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Valid @RequestBody RsvpUpdate in) { var r=db.one("SELECT r.*,e.capacity,e.rsvp_deadline FROM rsvp r JOIN guest g ON g.id=r.guest_id JOIN event e ON e.id=r.event_id WHERE r.id=:id AND g.party_id=:p",Map.of("id",id,"p",p.partyId())); String status=in.status().toUpperCase(); if(!List.of("ATTENDING","DECLINED","PENDING").contains(status)) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_RSVP","Invalid RSVP status"); if(r.get("rsvp_deadline")!=null && ((OffsetDateTime)r.get("rsvp_deadline")).isBefore(OffsetDateTime.now())) throw new ApiException(HttpStatus.CONFLICT,"RSVP_CLOSED","The RSVP deadline has passed"); if("ATTENDING".equals(status) && r.get("capacity")!=null) { db.jdbc.queryForObject("SELECT id FROM event WHERE id=? FOR UPDATE",UUID.class,r.get("event_id")); Integer c=db.jdbc.queryForObject("SELECT count(*) FROM rsvp WHERE event_id=? AND status='ATTENDING'",Integer.class,r.get("event_id")); if(c>=((Number)r.get("capacity")).intValue()) status="WAITLISTED"; } db.named.update("UPDATE rsvp SET status=:s,note=:n,source='GUEST',updated_at=now() WHERE id=:id",Map.of("s",status,"n",in.note()==null?"":in.note(),"id",id)); slack.rsvpRecorded(id); return db.one("SELECT id,status,note,updated_at FROM rsvp WHERE id=:id",Map.of("id",id)); }
 @GetMapping("/accommodation") List<Map<String,Object>> accommodations(@AuthenticationPrincipal Principal p) { return db.many("SELECT a.id,a.check_in,a.check_out,a.status,a.coverage_notes,r.room_number,r.room_type,v.name venue_name,v.address FROM accommodation_assignment a JOIN venue_room r ON r.id=a.room_id JOIN venue v ON v.id=r.venue_id WHERE a.party_id=:p OR a.guest_id IN (SELECT id FROM guest WHERE party_id=:p)",Map.of("p",p.partyId())); }
 @PostMapping("/accommodation/{id}/change-requests") Map<String,Object> request(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Valid @RequestBody ChangeRequest in) { db.one("SELECT id FROM accommodation_assignment WHERE id=:id AND (party_id=:p OR guest_id IN (SELECT id FROM guest WHERE party_id=:p))",Map.of("id",id,"p",p.partyId())); UUID request=db.uuid(); db.named.update("INSERT INTO accommodation_change_request(id,assignment_id,party_id,request_note) VALUES(:i,:a,:p,:n)",Map.of("i",request,"a",id,"p",p.partyId(),"n",in.note())); return Map.of("id",request,"status","OPEN"); }
}
