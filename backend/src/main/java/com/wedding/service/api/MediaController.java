package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import com.wedding.service.service.MediaService;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Upload/list are planner-only (`/internal/media`); reads are public (`/media/{id}`) since <img> can't send a Bearer header. */
@RestController @RequestMapping("/api/v1")
public class MediaController {
  private final DataService db; private final MediaService media;
  MediaController(DataService db, MediaService media) { this.db = db; this.media = media; }

  @PostMapping(value = "/internal/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  ResponseEntity<Map<String,Object>> upload(@AuthenticationPrincipal Principal actor, @RequestPart("file") MultipartFile file) {
    String contentType = file.getContentType(); String ext = media.extensionFor(contentType);
    media.validateSize(file.getSize());
    UUID id = db.uuid(); String storageKey = id + "." + ext;
    media.store(file, storageKey);
    db.named.update("INSERT INTO media_asset(id,storage_key,content_type,size_bytes,original_name,uploaded_by) VALUES(:id,:k,:c,:s,:n,:u)",
      Map.of("id", id, "k", storageKey, "c", contentType, "s", file.getSize(), "n", file.getOriginalFilename() == null ? "" : file.getOriginalFilename(), "u", actor.id()));
    db.audit(actor.id(), "CREATE", "MEDIA_ASSET", id, null, Map.of("originalName", file.getOriginalFilename()));
    return ResponseEntity.status(HttpStatus.CREATED).body(db.one("SELECT id,content_type,size_bytes,original_name,created_at FROM media_asset WHERE id=:id", Map.of("id", id)));
  }

  @GetMapping("/internal/media") List<Map<String,Object>> list() { return db.many("SELECT id,content_type,size_bytes,original_name,created_at FROM media_asset ORDER BY created_at DESC", Map.of()); }

  @GetMapping("/media/{id}") ResponseEntity<byte[]> read(@PathVariable UUID id) {
    var asset = db.one("SELECT storage_key,content_type FROM media_asset WHERE id=:id", Map.of("id", id));
    byte[] bytes = media.read(asset.get("storage_key").toString());
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.get("content_type").toString())).cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30))).body(bytes);
  }
}
