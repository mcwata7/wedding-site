package com.wedding.service.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "wedding")
public record AppProperties(Security security, BootstrapAdmin bootstrapAdmin, Media media, Site site, Slack slack, Cors cors) {
  public record Security(String jwtSecret, long guestSessionMinutes, long plannerSessionMinutes) {}
  public record BootstrapAdmin(String email, String password) {}
  public record Media(String dir, long maxBytes) {}
  /** publicUrl is the guest-facing site's origin, used to build the full QR payload ({publicUrl}/i/{token}). */
  public record Site(String publicUrl) {}
  /** allowedOrigins lists frontend origins allowed to call the API cross-origin (e.g. Render static
   * sites hosted on a different domain than the API). Empty when frontends are served same-origin
   * via an nginx reverse proxy (local/Docker Compose), where CORS headers aren't needed. */
  public record Cors(List<String> allowedOrigins) {}
  /** webhookUrl is a Slack incoming-webhook URL (kept only in .env / real env vars, never committed).
   * The integration is treated as off unless enabled is true AND webhookUrl is non-blank, so local
   * dev/tests without a webhook configured simply no-op. */
  public record Slack(String webhookUrl, boolean enabled) {}
}
