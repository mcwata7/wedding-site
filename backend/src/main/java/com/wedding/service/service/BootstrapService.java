package com.wedding.service.service;

import com.wedding.service.config.AppProperties;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "wedding.bootstrap-enabled", havingValue = "true", matchIfMissing = true)
public class BootstrapService implements ApplicationRunner {
  private final DataService db; private final AppProperties props;
  BootstrapService(DataService db, AppProperties props) { this.db=db;this.props=props; }
  public void run(ApplicationArguments a) { if (db.jdbc.queryForObject("SELECT count(*) FROM planner_user",Integer.class)==0) db.jdbc.update("INSERT INTO planner_user(email,password_hash,role) VALUES(?,?, 'ADMIN')",props.bootstrapAdmin().email().toLowerCase(),db.passwords.encode(props.bootstrapAdmin().password())); }
}
