package com.wedding.service.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix="wedding.passkeys")
public class PasskeyProperties {
  private List<String> allowedOrigins=List.of("http://localhost:3000");
  public List<String> getAllowedOrigins() { return allowedOrigins; }
  public void setAllowedOrigins(List<String> value) { allowedOrigins=List.copyOf(value); }
}
