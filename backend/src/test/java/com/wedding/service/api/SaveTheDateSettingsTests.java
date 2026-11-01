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

@SpringBootTest(properties={"spring.flyway.enabled=false","spring.datasource.url=jdbc:h2:mem:savethedate;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE","wedding.bootstrap-enabled=false","wedding.slack.enabled=false"})
@AutoConfigureMockMvc
class SaveTheDateSettingsTests {
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate db;
  @Autowired JwtService jwt;
  UUID image;
  String planner,guest;

  @BeforeEach void setup() {
    db.execute("DROP ALL OBJECTS");
    db.execute("CREATE TABLE media_asset(id UUID PRIMARY KEY)");
    db.execute("CREATE TABLE site_settings(id UUID PRIMARY KEY,singleton BOOLEAN DEFAULT TRUE,save_the_date_image_id UUID REFERENCES media_asset(id),save_the_date_enabled BOOLEAN DEFAULT FALSE NOT NULL,updated_at TIMESTAMP)");
    db.execute("CREATE TABLE site_page(slug TEXT,label TEXT,heading TEXT,sort_order INT,body TEXT,image_id UUID,visible BOOLEAN)");
    db.execute("CREATE TABLE audit_record(actor_id UUID,action TEXT,entity_type TEXT,entity_id UUID,before_value JSONB,after_value JSONB)");
    image=UUID.randomUUID();db.update("INSERT INTO media_asset(id) VALUES(?)",image);
    db.update("INSERT INTO site_settings(id) VALUES(?)",UUID.randomUUID());
    planner=jwt.create(UUID.randomUUID(),"PLANNER",null,30);
    UUID party=UUID.randomUUID();guest=jwt.create(party,"GUEST",party,UUID.randomUUID(),30);
  }

  @Test void plannerCanSelectEnableDisableAndClearCardWithAudit() throws Exception {
    mvc.perform(patch("/api/v1/internal/site/settings").header("Authorization","Bearer "+planner).contentType("application/json")
      .content("{\"save_the_date_image_id\":\""+image+"\",\"save_the_date_enabled\":true}"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.save_the_date_enabled").value(true)).andExpect(jsonPath("$.save_the_date_image_id").value(image.toString()));
    mvc.perform(get("/api/v1/guest/site/config").header("Authorization","Bearer "+guest))
      .andExpect(status().isOk()).andExpect(jsonPath("$.settings.save_the_date_enabled").value(true));
    mvc.perform(patch("/api/v1/internal/site/settings").header("Authorization","Bearer "+planner).contentType("application/json")
      .content("{\"save_the_date_enabled\":false}"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.save_the_date_image_id").value(image.toString()));
    mvc.perform(patch("/api/v1/internal/site/settings").header("Authorization","Bearer "+planner).contentType("application/json")
      .content("{\"save_the_date_image_id\":null}"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.save_the_date_image_id").doesNotExist());
    assertEquals(3,db.queryForObject("SELECT count(*) FROM audit_record WHERE entity_type='SITE_SETTINGS'",Integer.class));
  }

  @Test void guestAndAnonymousCannotChangeCardAndAnonymousCannotReadConfig() throws Exception {
    for(String auth:new String[]{"","Bearer "+guest})
      mvc.perform(patch("/api/v1/internal/site/settings").header("Authorization",auth).contentType("application/json").content("{\"save_the_date_enabled\":true}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/guest/site/config")).andExpect(status().isForbidden());
    assertFalse(db.queryForObject("SELECT save_the_date_enabled FROM site_settings",Boolean.class));
    assertEquals(0,db.queryForObject("SELECT count(*) FROM audit_record",Integer.class));
  }
}
