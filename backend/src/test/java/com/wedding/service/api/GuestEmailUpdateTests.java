package com.wedding.service.api;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class GuestEmailUpdateTests {
  DataService db;
  InternalDataController controller;
  Principal planner = new Principal(UUID.randomUUID(), "PLANNER", null);
  UUID first = UUID.randomUUID(), second = UUID.randomUUID();
  Map<?,?> auditAfter;

  @BeforeEach void setup() {
    var jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"));
    db = new DataService(jdbc, new NamedParameterJdbcTemplate(jdbc), new ObjectMapper()) {
      @Override public void audit(UUID actor, String action, String type, UUID entity, Object before, Object after) {
        auditAfter = (Map<?,?>) after;
      }
    };
    // H2 equivalent of PostgreSQL's lower(email) unique index for active guests.
    jdbc.execute("CREATE TABLE guest(id UUID PRIMARY KEY,first_name VARCHAR(100),email VARCHAR_IGNORECASE UNIQUE)");
    jdbc.update("INSERT INTO guest(id,first_name,email) VALUES(?,?,?)", first, "First", "");
    jdbc.update("INSERT INTO guest(id,first_name) VALUES(?,?)", second, "Second");
    controller = new InternalDataController(db);
  }

  @Test void editingMultipleGuestsWithoutEmailsDoesNotCollideWithExistingBlankEmail() {
    for (UUID id : List.of(second, first)) {
      var saved = controller.update(planner,"guests",id,Map.of("first_name","Updated","email","  "));
      assertEquals("Updated", saved.get("first_name"));
      assertNull(saved.get("email"));
      assertNull(auditAfter.get("email"));
    }
  }

  @Test void realEmailIsTrimmedAndCanBeClearedOrOmitted() {
    var saved = controller.update(planner,"guests",second,Map.of("email","  guest@example.com  "));
    assertEquals("guest@example.com", saved.get("email"));
    saved = controller.update(planner,"guests",second,Map.of("first_name","Changed"));
    assertEquals("guest@example.com", saved.get("email"));
    var clear = new HashMap<String,Object>(); clear.put("email",null);
    assertNull(controller.update(planner,"guests",second,clear).get("email"));
  }

  @Test void duplicateEmailIsAConflictAndOtherEditsAreNotSaved() {
    controller.update(planner,"guests",first,Map.of("email","guest@example.com"));
    auditAfter = null;
    var error = assertThrows(ApiException.class, () -> controller.update(planner,"guests",second,Map.of("first_name","Must not save","email","GUEST@example.com")));
    assertEquals(HttpStatus.CONFLICT,error.status);
    assertEquals("EMAIL_ALREADY_IN_USE",error.code);
    assertEquals("Second",db.jdbc.queryForObject("SELECT first_name FROM guest WHERE id=?",String.class,second));
    assertNull(auditAfter);
  }

  @Test void nonTextEmailIsAValidationError() {
    var error = assertThrows(ApiException.class, () -> controller.update(planner,"guests",second,Map.of("email",123)));
    assertEquals(HttpStatus.BAD_REQUEST,error.status);
    assertEquals("VALIDATION_ERROR",error.code);
  }
}
