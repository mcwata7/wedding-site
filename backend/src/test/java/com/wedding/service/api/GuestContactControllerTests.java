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

@SpringBootTest(properties={"spring.flyway.enabled=false","spring.datasource.url=jdbc:h2:mem:contact;DB_CLOSE_DELAY=-1","wedding.bootstrap-enabled=false","wedding.slack.enabled=false"})
@AutoConfigureMockMvc
class GuestContactControllerTests {
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate db;
  @Autowired JwtService jwt;
  UUID party, guest, other;
  String token;
  @BeforeEach void setup() {
    db.execute("DROP TABLE IF EXISTS guest"); db.execute("DROP TABLE IF EXISTS party");
    db.execute("CREATE TABLE party(id UUID PRIMARY KEY,mailing_address VARCHAR(2000),archived BOOLEAN DEFAULT FALSE)");
    db.execute("CREATE TABLE guest(id UUID PRIMARY KEY,party_id UUID,email VARCHAR(254) UNIQUE,phone VARCHAR(50),active BOOLEAN DEFAULT TRUE,updated_at TIMESTAMP,dietary_requirements VARCHAR(100))");
    party=UUID.randomUUID(); guest=UUID.randomUUID(); other=UUID.randomUUID();
    db.update("INSERT INTO party(id) VALUES(?)",party);
    db.update("INSERT INTO guest(id,party_id,dietary_requirements) VALUES(?,?,'vegetarian')",guest,party);
    db.update("INSERT INTO guest(id,party_id,email) VALUES(?,?,'other@example.com')",other,party);
    token=jwt.create(party,"GUEST",party,guest,30);
  }
  @Test void missingDetailsAreIncompleteAndFullSaveCompletesProfile() throws Exception {
    mvc.perform(get("/api/v1/guest/contact").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.complete").value(false));
    mvc.perform(patch("/api/v1/guest/contact").header("Authorization","Bearer "+token).contentType("application/json")
        .content("{\"email\":\"me@example.com\",\"phone\":\" +977 123 \" ,\"mailingAddress\":\" Kathmandu, Nepal \"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.complete").value(true)).andExpect(jsonPath("$.mailingAddress").value("Kathmandu, Nepal"));
    assertEquals("vegetarian",db.queryForObject("SELECT dietary_requirements FROM guest WHERE id=?",String.class,guest));
    assertEquals("other@example.com",db.queryForObject("SELECT email FROM guest WHERE id=?",String.class,other));
  }
  @Test void partialAndBlankSavesPreserveExistingDataAndRemainIncomplete() throws Exception {
    db.update("UPDATE guest SET email='existing@example.com' WHERE id=?",guest);
    mvc.perform(patch("/api/v1/guest/contact").header("Authorization","Bearer "+token).contentType("application/json")
        .content("{\"email\":null,\"phone\":\"   \"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("existing@example.com")).andExpect(jsonPath("$.complete").value(false));
  }
  @Test void partyAddressIsSharedButGuestContactIsIndividual() throws Exception {
    db.update("UPDATE party SET mailing_address='Shared address' WHERE id=?",party);
    String second=jwt.create(party,"GUEST",party,other,30);
    mvc.perform(get("/api/v1/guest/contact").header("Authorization","Bearer "+second))
        .andExpect(status().isOk()).andExpect(jsonPath("$.mailingAddress").value("Shared address"))
        .andExpect(jsonPath("$.email").value("other@example.com"));
  }
  @Test void duplicateEmailDoesNotSavePartyAddress() throws Exception {
    mvc.perform(patch("/api/v1/guest/contact").header("Authorization","Bearer "+token).contentType("application/json")
        .content("{\"email\":\"other@example.com\",\"mailingAddress\":\"Should not save\"}"))
        .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EMAIL_ALREADY_IN_USE"));
    assertNull(db.queryForObject("SELECT mailing_address FROM party WHERE id=?",String.class,party));
  }
  @Test void invalidEmailAndOversizedAddressAreRejected() throws Exception {
    for(String body : new String[]{"{\"email\":\"invalid\"}","{\"mailingAddress\":\""+"x".repeat(2001)+"\"}"})
      mvc.perform(patch("/api/v1/guest/contact").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andExpect(status().isBadRequest());
  }
  @Test void mismatchedPartyCannotReadOrUpdateGuest() throws Exception {
    String wrong=jwt.create(UUID.randomUUID(),"GUEST",UUID.randomUUID(),guest,30);
    mvc.perform(get("/api/v1/guest/contact").header("Authorization","Bearer "+wrong)).andExpect(status().isNotFound());
    mvc.perform(patch("/api/v1/guest/contact").header("Authorization","Bearer "+wrong).contentType("application/json").content("{\"phone\":\"123\"}")).andExpect(status().isNotFound());
  }
  @Test void legacySessionRequestsFreshIdentityAndInactiveGuestIsRejected() throws Exception {
    String legacy=jwt.create(party,"GUEST",party,30);
    mvc.perform(get("/api/v1/guest/contact").header("Authorization","Bearer "+legacy)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GUEST_IDENTITY_REQUIRED"));
    db.update("UPDATE guest SET active=false WHERE id=?",guest);
    mvc.perform(get("/api/v1/guest/contact").header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
  }
  @Test void expiredGuestSessionIsRejected() throws Exception {
    String expired=jwt.create(party,"GUEST",party,guest,-1);
    mvc.perform(get("/api/v1/guest/contact").header("Authorization","Bearer "+expired)).andExpect(status().isForbidden());
  }
  @Test void unauthenticatedAndPlannerRequestsAreRejected() throws Exception {
    mvc.perform(get("/api/v1/guest/contact")).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/guest/contact").header("Authorization","Bearer "+jwt.create(UUID.randomUUID(),"ADMIN",null,30))).andExpect(status().isForbidden());
  }
}
