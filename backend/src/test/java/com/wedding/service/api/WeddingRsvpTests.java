package com.wedding.service.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.wedding.service.security.JwtService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties={"spring.flyway.enabled=false","spring.datasource.url=jdbc:h2:mem:wedding-rsvp;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","wedding.bootstrap-enabled=false","wedding.slack.enabled=false"})
@AutoConfigureMockMvc
class WeddingRsvpTests {
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate db;
  @Autowired JwtService jwt;
  UUID party, guest, companion, other, planner;
  String token, plannerToken;

  @BeforeEach void setup() {
    db.execute("DROP ALL OBJECTS");
    db.execute("CREATE TABLE party(id UUID PRIMARY KEY,display_name TEXT,mailing_address TEXT,archived BOOLEAN DEFAULT FALSE)");
    db.execute("CREATE TABLE guest(id UUID PRIMARY KEY,party_id UUID,first_name TEXT,last_name TEXT,email TEXT,phone TEXT,dietary_requirements TEXT,accessibility_needs TEXT,travel_origin TEXT,flight_number TEXT,is_additional_guest BOOLEAN DEFAULT FALSE,active BOOLEAN DEFAULT TRUE,rsvp_status TEXT NOT NULL DEFAULT 'PENDING',rsvp_note TEXT,rsvp_source TEXT,rsvp_updated_at TIMESTAMP WITH TIME ZONE,updated_at TIMESTAMP WITH TIME ZONE,created_at TIMESTAMP WITH TIME ZONE DEFAULT now())");
    db.execute("CREATE TABLE audit_record(id UUID DEFAULT random_uuid(),actor_id UUID,action TEXT,entity_type TEXT,entity_id UUID,before_value JSONB,after_value JSONB)");
    db.execute("CREATE TABLE event(id UUID PRIMARY KEY,archived BOOLEAN DEFAULT FALSE)");
    db.execute("CREATE TABLE accommodation_change_request(status TEXT)");
    party=UUID.randomUUID(); guest=UUID.randomUUID(); companion=UUID.randomUUID(); other=UUID.randomUUID(); planner=UUID.randomUUID();
    db.update("INSERT INTO party(id,display_name) VALUES(?,'Family'),(?,'Other')",party,other);
    db.update("INSERT INTO guest(id,party_id,first_name,last_name) VALUES(?,?,'First','Guest'),(?,?,'Second','Guest'),(?,?,'Other','Guest')",guest,party,companion,party,other,other);
    token=jwt.create(party,"GUEST",party,guest,30);
    plannerToken=jwt.create(planner,"PLANNER",null,30);
  }

  void respond(UUID id, String status, String auth, boolean internal, int expected) throws Exception {
    mvc.perform(put("/api/v1/"+(internal?"internal":"guest")+"/guests/"+id+"/rsvp")
      .header("Authorization","Bearer "+auth).contentType("application/json")
      .content("{\"status\":\""+status+"\",\"note\":\"Confirmed\"}"))
      .andExpect(status().is(expected));
  }

  @Test void guestResponseWorksWithoutEventsAndDoesNotChangeCompanions() throws Exception {
    respond(guest,"attending",token,false,200);
    assertEquals("ATTENDING",db.queryForObject("SELECT rsvp_status FROM guest WHERE id=?",String.class,guest));
    assertEquals("GUEST",db.queryForObject("SELECT rsvp_source FROM guest WHERE id=?",String.class,guest));
    assertNotNull(db.queryForObject("SELECT rsvp_updated_at FROM guest WHERE id=?",Object.class,guest));
    assertEquals("PENDING",db.queryForObject("SELECT rsvp_status FROM guest WHERE id=?",String.class,companion));
    mvc.perform(get("/api/v1/guest/party").header("Authorization","Bearer "+token))
      .andExpect(status().isOk()).andExpect(jsonPath("$.guests.length()").value(2));
  }

  @Test void companionsAreAllowedButOtherPartiesAndArchivedGuestsAreNot() throws Exception {
    respond(companion,"DECLINED",token,false,200);
    respond(other,"ATTENDING",token,false,404);
    db.update("UPDATE guest SET active=false WHERE id=?",guest);
    respond(guest,"ATTENDING",token,false,404);
    db.update("UPDATE party SET archived=true WHERE id=?",party);
    respond(companion,"ATTENDING",token,false,404);
  }

  @Test void guestCannotChooseWaitlistOrInvalidStatus() throws Exception {
    for(String value:new String[]{"WAITLISTED","INVALID"," "}) respond(guest,value,token,false,400);
    assertEquals("PENDING",db.queryForObject("SELECT rsvp_status FROM guest WHERE id=?",String.class,guest));
  }

  @Test void plannerOverrideIsAuditedAndGuestCanRestorePending() throws Exception {
    respond(guest,"WAITLISTED",plannerToken,true,200);
    assertEquals("PLANNER",db.queryForObject("SELECT rsvp_source FROM guest WHERE id=?",String.class,guest));
    assertEquals(1,db.queryForObject("SELECT count(*) FROM audit_record WHERE entity_type='GUEST' AND entity_id=? AND actor_id=?",Integer.class,guest,planner));
    respond(guest,"PENDING",token,false,200);
    assertEquals("PENDING",db.queryForObject("SELECT rsvp_status FROM guest WHERE id=?",String.class,guest));
  }

  @Test void countsAndReportHaveOneResponsePerActiveGuestRegardlessOfEvents() throws Exception {
    respond(guest,"ATTENDING",token,false,200);
    db.update("INSERT INTO event(id) VALUES(?),(?)",UUID.randomUUID(),UUID.randomUUID());
    mvc.perform(get("/api/v1/internal/dashboard").header("Authorization","Bearer "+plannerToken))
      .andExpect(status().isOk()).andExpect(jsonPath("$.attending").value(1)).andExpect(jsonPath("$.pendingRsvps").value(2));
    String csv=mvc.perform(get("/api/v1/internal/reports/attendance.csv").header("Authorization","Bearer "+plannerToken))
      .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    assertEquals(4,csv.lines().count()); assertTrue(csv.contains("rsvp_status")); assertFalse(csv.contains("event"));
    db.update("UPDATE party SET archived=true WHERE id=?",party);
    mvc.perform(get("/api/v1/internal/dashboard").header("Authorization","Bearer "+plannerToken))
      .andExpect(jsonPath("$.attending").value(0)).andExpect(jsonPath("$.pendingRsvps").value(1));
  }

  @Test void rolesProtectBothWritePaths() throws Exception {
    respond(guest,"ATTENDING",token,true,403);
    respond(guest,"ATTENDING",plannerToken,false,403);
    mvc.perform(put("/api/v1/guest/guests/"+guest+"/rsvp").contentType("application/json").content("{\"status\":\"ATTENDING\"}"))
      .andExpect(status().isForbidden());
  }
}
