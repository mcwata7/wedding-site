package com.wedding.service.api;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class PartyVerificationAnswerTests {
  DataService db;
  InternalDataController controller;
  Map<String,Object> auditBefore, auditAfter;
  UUID id=UUID.randomUUID();
  Principal planner=new Principal(UUID.randomUUID(),"PLANNER",null);
  String original;

  @BeforeEach void setup() {
    var jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"));
    db=new DataService(jdbc,new NamedParameterJdbcTemplate(jdbc),new ObjectMapper()) {
      @SuppressWarnings("unchecked")
      @Override public void audit(UUID actor,String action,String type,UUID entity,Object before,Object after) {
        auditBefore=(Map<String,Object>) before; auditAfter=(Map<String,Object>) after;
      }
    };
    jdbc.execute("CREATE TABLE party(id UUID PRIMARY KEY,verification_question VARCHAR(255),verification_answer_hash VARCHAR(255),archived BOOLEAN DEFAULT FALSE)");
    original=db.passwords.encode("old answer");
    jdbc.update("INSERT INTO party(id,verification_question,verification_answer_hash) VALUES(?,?,?)",id,"Old question",original);
    controller=new InternalDataController(db);
  }
  String hash() { return db.jdbc.queryForObject("SELECT verification_answer_hash FROM party WHERE id=?",String.class,id); }

  @Test void plannerCanReplaceAnswerAndQuestionWithoutExposingSecrets() {
    var result=controller.update(planner,"parties",id,Map.of("verification_question","New question","verification_answer","  New ANSWER  "));
    assertTrue(db.passwords.matches("new answer",hash()));
    assertFalse(db.passwords.matches("old answer",hash()));
    assertEquals("New question",result.get("verification_question"));
    for(var snapshot:List.of(result,auditBefore,auditAfter)) {
      assertFalse(snapshot.containsKey("verification_answer_hash"));
      assertFalse(snapshot.containsKey("verification_answer"));
      assertFalse(snapshot.toString().contains("New ANSWER"));
    }
    assertEquals(true,auditAfter.get("verification_answer_changed"));
  }
  @Test void answerOnlyUpdateWorksAndBlankOrMissingAnswerPreservesHash() {
    controller.update(planner,"parties",id,Map.of("verification_answer","replacement"));
    String replacement=hash();
    for(var body:List.of(Map.<String,Object>of("verification_question","Another question"),Map.<String,Object>of("verification_question","Question","verification_answer","  "))) {
      controller.update(planner,"parties",id,body);
      assertEquals(replacement,hash());
      assertEquals(false,auditAfter.get("verification_answer_changed"));
    }
  }
  @Test void invalidAnswerOrDirectHashCannotModifyParty() {
    for(var body:List.of(Map.<String,Object>of("verification_answer_hash","attacker hash"),Map.<String,Object>of("verification_question","Must not save","verification_answer",false),Map.<String,Object>of("verification_answer","é".repeat(37)))) {
      var error=assertThrows(ApiException.class,()->controller.update(planner,"parties",id,body));
      assertEquals("VALIDATION_ERROR",error.code);
      assertEquals(original,hash());
      assertEquals("Old question",db.jdbc.queryForObject("SELECT verification_question FROM party WHERE id=?",String.class,id));
    }
  }
  @Test void archiveAlsoRedactsAnswerHash() {
    assertFalse(controller.archive(planner,"parties",id).containsKey("verification_answer_hash"));
    assertFalse(auditBefore.containsKey("verification_answer_hash"));
    assertFalse(auditAfter.containsKey("verification_answer_hash"));
  }
}
