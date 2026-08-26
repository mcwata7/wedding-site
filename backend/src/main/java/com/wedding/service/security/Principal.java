package com.wedding.service.security;

import java.util.UUID;

public record Principal(UUID id, String role, UUID partyId) {
  public boolean planner() { return "ADMIN".equals(role) || "PLANNER".equals(role); }
}
