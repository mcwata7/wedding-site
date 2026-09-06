package com.wedding.service.service;

import java.io.IOException;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Seeds default images into the media pipeline on first boot, so a planner has something to print
 * before uploading their own: the Himalayas line-drawing artwork and the original save-the-date
 * design (both kept around for the guest site's media library), and card.jpg -- the seeded default
 * for the invitation card's front image (the card is two-sided; the back has no seeded default).
 * Idempotent: fixed asset ids plus ON CONFLICT DO NOTHING mean re-running this never duplicates a
 * row, and the site_settings update only fires while invitation_front_image_id is still unset, so
 * a planner's own choice is never clobbered on restart.
 *
 * Gated by the same flag as BootstrapService (matchIfMissing = true) so it's skipped in tests:
 * WeddingServiceApplicationTests runs against a schema-less H2 with wedding.bootstrap-enabled=false,
 * and this runner queries media_asset/site_settings, which don't exist there.
 */
@Component
@ConditionalOnProperty(name = "wedding.bootstrap-enabled", havingValue = "true", matchIfMissing = true)
public class MediaSeedService implements ApplicationRunner {
  private static final UUID ARTWORK_ASSET_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
  private static final UUID BACKGROUND_ASSET_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
  private static final UUID BACKGROUND_V2_ASSET_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a3");

  private final DataService db; private final MediaService media;
  MediaSeedService(DataService db, MediaService media) { this.db = db; this.media = media; }

  public void run(ApplicationArguments args) throws IOException {
    seed(ARTWORK_ASSET_ID, "seed/invitation-card-default.jpg", "seed-invitation-card.jpg", "invitation-card-default.jpg");
    seed(BACKGROUND_ASSET_ID, "seed/invitation-background-default.jpg", "seed-invitation-background.jpg", "invitation-background-default.jpg");
    seed(BACKGROUND_V2_ASSET_ID, "seed/invitation-background-v2.jpg", "seed-invitation-background-v2.jpg", "invitation-background-v2.jpg");
    db.jdbc.update("UPDATE site_settings SET invitation_front_image_id=? WHERE singleton AND invitation_front_image_id IS NULL", BACKGROUND_V2_ASSET_ID);
  }

  private void seed(UUID id, String classpathResource, String storageKey, String originalName) throws IOException {
    ClassPathResource resource = new ClassPathResource(classpathResource);
    db.jdbc.update(
      "INSERT INTO media_asset(id,storage_key,content_type,size_bytes,original_name) VALUES(?,?,?,?,?) ON CONFLICT (id) DO NOTHING",
      id, storageKey, "image/jpeg", resource.contentLength(), originalName);
    if (!media.exists(storageKey)) media.store(resource.getInputStream().readAllBytes(), storageKey);
  }
}
