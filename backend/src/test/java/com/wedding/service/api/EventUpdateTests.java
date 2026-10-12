package com.wedding.service.api;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class EventUpdateTests {
  DataService db;
  InternalDataController controller;
  UUID id=UUID.randomUUID();
  Principal planner=new Principal(UUID.randomUUID(),"PLANNER",null);
  Map<?,?> auditBefore,auditAfter;

  @BeforeEach void setup() {
    var jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"));
    db=new DataService(jdbc,new NamedParameterJdbcTemplate(jdbc),new ObjectMapper()) {
      @Override public void audit(UUID actor,String action,String type,UUID entity,Object before,Object after) {
        auditBefore=(Map<?,?>)before; auditAfter=(Map<?,?>)after;
      }
    };
    jdbc.execute("CREATE TABLE event(id UUID PRIMARY KEY,name VARCHAR(255),starts_at TIMESTAMP WITH TIME ZONE NOT NULL,ends_at TIMESTAMP WITH TIME ZONE,updated_at TIMESTAMP WITH TIME ZONE)");
    jdbc.update("INSERT INTO event(id,name,starts_at) VALUES(?,?,?)",id,"Original",OffsetDateTime.parse("2027-10-02T10:00:00Z"));
    controller=new InternalDataController(db);
  }

  @Test void formDatesSaveWithNameAndAudit() {
    var result=controller.update(planner,"events",id,Map.of("name","Updated","starts_at","2027-10-02T11:30","ends_at","2027-10-02T12:30"));
    assertEquals("Updated",result.get("name"));
    assertEquals(Instant.parse("2027-10-02T11:30:00Z"),((OffsetDateTime)result.get("starts_at")).toInstant());
    assertEquals(Instant.parse("2027-10-02T12:30:00Z"),((OffsetDateTime)result.get("ends_at")).toInstant());
    assertEquals("Original",auditBefore.get("name"));
    assertEquals("Updated",auditAfter.get("name"));
    assertNotNull(result.get("updated_at"));
  }

  @Test void offsetsPreserveInstantsAndOptionalEndCanBeCleared() {
    var result=controller.update(planner,"events",id,Map.of("starts_at","2027-10-02T17:15:00+05:45","ends_at","2027-10-02T18:15:00+05:45"));
    assertEquals(Instant.parse("2027-10-02T11:30:00Z"),((OffsetDateTime)result.get("starts_at")).toInstant());
    var clear=new HashMap<String,Object>();clear.put("ends_at",null);
    result=controller.update(planner,"events",id,clear);
    assertNull(result.get("ends_at"));
    assertEquals(Instant.parse("2027-10-02T11:30:00Z"),((OffsetDateTime)result.get("starts_at")).toInstant());
  }

  @Test void invalidDatesAreClientErrorsAndDoNotSaveOtherEdits() {
    for(String column:List.of("starts_at","ends_at")) for(Object value:List.of("bad date","2027-02-30T10:00","",true,123)) {
      var error=assertThrows(ApiException.class,()->controller.update(planner,"events",id,Map.of("name","Must not save",column,value)));
      assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST,error.status);
      assertEquals("VALIDATION_ERROR",error.code);
      assertEquals("Original",db.jdbc.queryForObject("SELECT name FROM event WHERE id=?",String.class,id));
      assertNull(auditAfter);
    }
    var input=new HashMap<String,Object>();input.put("starts_at",null);
    assertThrows(ApiException.class,()->controller.update(planner,"events",id,input));
  }
}
