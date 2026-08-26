package com.wedding.service.service;

import com.wedding.service.config.AppProperties;
import java.io.IOException;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Seeds the default invitation-card artwork into the media pipeline on first boot, so a planner
 * has something to print before uploading their own. Idempotent: a fixed asset id plus
 * ON CONFLICT DO NOTHING means re-running this never duplicates the row, and the site_settings
 * update only fires while invitation_image_id is still unset, so a planner's own choice is never
 * clobbered on restart.
 *
 * Gated by the same flag as BootstrapService (matchIfMissing = true) so it's skipped in tests:
 * WeddingServiceApplicationTests runs against a schema-less H2 with wedding.bootstrap-enabled=false,
 * and this runner queries media_asset/site_settings, which don't exist there.
 */
@Component
@ConditionalOnProperty(name = "wedding.bootstrap-enabled", havingValue = "true", matchIfMissing = true)
public class MediaSeedService implements ApplicationRunner {
  private static final UUID SEED_ASSET_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
  private static final String SEED_RESOURCE = "seed/invitation-card-default.jpg";
  private static final String SEED_STORAGE_KEY = "seed-invitation-card.jpg";

  private final DataService db; private final MediaService media;
  MediaSeedService(DataService db, MediaService media, AppProperties props) { this.db = db; this.media = media; }

  public void run(ApplicationArguments args) throws IOException {
    ClassPathResource resource = new ClassPathResource(SEED_RESOURCE);
    db.jdbc.update(
      "INSERT INTO media_asset(id,storage_key,content_type,size_bytes,original_name) VALUES(?,?,?,?,?) ON CONFLICT (id) DO NOTHING",
      SEED_ASSET_ID, SEED_STORAGE_KEY, "image/jpeg", resource.contentLength(), "invitation-card-default.jpg");
    if (!media.exists(SEED_STORAGE_KEY)) media.store(resource.getInputStream().readAllBytes(), SEED_STORAGE_KEY);
    db.jdbc.update("UPDATE site_settings SET invitation_image_id=? WHERE singleton AND invitation_image_id IS NULL", SEED_ASSET_ID);
  }
}
