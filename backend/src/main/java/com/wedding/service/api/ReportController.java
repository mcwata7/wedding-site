package com.wedding.service.api;

import com.wedding.service.service.DataService;
import java.io.IOException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/internal/reports")
public class ReportController {
 private final DataService db; ReportController(DataService db){this.db=db;}
 @GetMapping(value="/attendance.csv",produces="text/csv") ResponseEntity<String> attendance(@RequestParam(required=false) UUID eventId){String sql="SELECT e.name event,g.first_name,g.last_name,r.status,r.note FROM rsvp r JOIN guest g ON g.id=r.guest_id JOIN event e ON e.id=r.event_id WHERE (:e IS NULL OR e.id=:e) ORDER BY e.starts_at,g.last_name";return csv("attendance.csv",db.named.queryForList(sql,new org.springframework.jdbc.core.namedparam.MapSqlParameterSource("e",eventId)));}
 @GetMapping(value="/dietary.csv",produces="text/csv") ResponseEntity<String> dietary(){return csv("dietary.csv",db.many("SELECT p.display_name party,g.first_name,g.last_name,g.dietary_requirements,g.accessibility_needs FROM guest g JOIN party p ON p.id=g.party_id WHERE g.active ORDER BY p.display_name,g.last_name",Map.of()));}
 @GetMapping(value="/rooming.csv",produces="text/csv") ResponseEntity<String> rooming(){return csv("rooming.csv",db.many("SELECT ap.name property,r.room_number,r.room_type,a.check_in,a.check_out,a.status,p.display_name party,g.first_name,g.last_name FROM accommodation_assignment a JOIN accommodation_room r ON r.id=a.room_id JOIN accommodation_property ap ON ap.id=r.property_id LEFT JOIN party p ON p.id=a.party_id LEFT JOIN guest g ON g.id=a.guest_id ORDER BY ap.name,r.room_number",Map.of()));}
 @GetMapping(value="/budget.csv",produces="text/csv") ResponseEntity<String> budget(){return csv("budget.csv",db.many("SELECT c.name category,b.description,b.currency,b.planned_amount,b.actual_amount,b.payment_status,b.due_date FROM budget_line_item b JOIN budget_category c ON c.id=b.category_id ORDER BY c.name,b.description",Map.of()));}
 private ResponseEntity<String> csv(String name,List<Map<String,Object>> rows){ if(rows.isEmpty()) return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename="+name).body(""); List<String> keys=new ArrayList<>(rows.getFirst().keySet());StringBuilder out=new StringBuilder(String.join(",",keys)).append('\n');for(var row:rows){for(int i=0;i<keys.size();i++){if(i>0)out.append(',');out.append(quote(row.get(keys.get(i))));}out.append('\n');}return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename="+name).body(out.toString());}
 private String quote(Object o){String v=o==null?"":o.toString();return '"'+v.replace("\"","\"\"")+'"';}
}
