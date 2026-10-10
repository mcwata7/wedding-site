package com.wedding.service.security;

import java.util.UUID;

public record Principal(UUID id, String role, UUID partyId, UUID guestId) {
  public Principal(UUID id, String role, UUID partyId) { this(id, role, partyId, null); }
  public boolean planner() { return "ADMIN".equals(role) || "PLANNER".equals(role); }
}
