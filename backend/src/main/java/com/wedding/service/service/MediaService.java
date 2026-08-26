package com.wedding.service.service;

import com.wedding.service.api.ApiException;
import com.wedding.service.config.AppProperties;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Local-disk storage for uploaded images. Files are named by their media_asset id + extension. */
@Service
public class MediaService {
  private static final Map<String, String> ALLOWED = Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");
  private final AppProperties props;
  public MediaService(AppProperties props) { this.props = props; }

  public String extensionFor(String contentType) {
    String ext = ALLOWED.get(contentType);
    if (ext == null) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MEDIA", "Only JPEG, PNG, or WEBP images are allowed");
    return ext;
  }

  public void validateSize(long size) {
    if (size <= 0 || size > props.media().maxBytes()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MEDIA", "File exceeds the maximum allowed size");
  }

  public String store(MultipartFile file, String storageKey) {
    try {
      file.transferTo(target(storageKey));
      return storageKey;
    } catch (IOException e) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "MEDIA_STORE_FAILED", "Unable to store the uploaded file");
    }
  }

  /** Same as store(MultipartFile, ...) but for bytes already in memory -- used to seed the default invitation-card artwork. */
  public String store(byte[] bytes, String storageKey) {
    try {
      Files.write(target(storageKey), bytes);
      return storageKey;
    } catch (IOException e) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "MEDIA_STORE_FAILED", "Unable to store the uploaded file");
    }
  }

  public boolean exists(String storageKey) {
    Path dir = Paths.get(props.media().dir());
    return Files.exists(dir.resolve(storageKey).normalize());
  }

  public byte[] read(String storageKey) {
    try {
      Path dir = Paths.get(props.media().dir());
      Path target = dir.resolve(storageKey).normalize();
      if (!target.startsWith(dir)) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource was not found");
      return Files.readAllBytes(target);
    } catch (IOException e) {
      throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource was not found");
    }
  }

  private Path target(String storageKey) throws IOException {
    Path dir = Paths.get(props.media().dir());
    Files.createDirectories(dir);
    Path target = dir.resolve(storageKey).normalize();
    if (!target.startsWith(dir)) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MEDIA", "Invalid file name");
    return target;
  }
}
