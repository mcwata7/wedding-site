package com.wedding.service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "wedding")
public record AppProperties(Security security, BootstrapAdmin bootstrapAdmin, Fx fx, Media media, Site site) {
  public record Security(String jwtSecret, long guestSessionMinutes, long plannerSessionMinutes) {}
  public record BootstrapAdmin(String email, String password) {}
  public record Fx(boolean enabled, String baseCurrency) {}
  public record Media(String dir, long maxBytes) {}
  /** publicUrl is the guest-facing site's origin, used to build the full QR payload ({publicUrl}/i/{token}). */
  public record Site(String publicUrl) {}
}
