package com.wedding.service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wedding.service.api.ApiException;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class DataService {
  public final JdbcTemplate jdbc; public final NamedParameterJdbcTemplate named; public final ObjectMapper json; public final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
  public DataService(JdbcTemplate jdbc, NamedParameterJdbcTemplate named, ObjectMapper json) { this.jdbc=jdbc; this.named=named; this.json=json; }
  public UUID uuid() { return UUID.randomUUID(); }
  public String hashToken(String v) { try { return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(v.getBytes())); } catch(Exception e) { throw new IllegalStateException(e); } }
  public Map<String,Object> one(String sql, Map<String,?> p) { var rows=named.queryForList(sql,p); if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"NOT_FOUND","Resource was not found"); return rows.getFirst(); }
  public List<Map<String,Object>> many(String sql, Map<String,?> p) { return named.queryForList(sql,p); }
  public void audit(UUID actor,String action,String type,UUID id,Object before,Object after) { try { named.update("INSERT INTO audit_record(actor_id,action,entity_type,entity_id,before_value,after_value) VALUES(:a,:ac,:t,:id,cast(:b as jsonb),cast(:af as jsonb))", Map.of("a",actor,"ac",action,"t",type,"id",id,"b",json.writeValueAsString(before==null?Map.of():before),"af",json.writeValueAsString(after==null?Map.of():after))); } catch(Exception e) { throw new IllegalStateException(e); } }
  public UUID id(Object value) { return UUID.fromString(value.toString()); }
  /** Request bodies bind "*_id" fields as JSON strings; the JDBC driver sends an unconverted
   * String as varchar, which Postgres refuses to assign into a uuid column without a cast.
   * Parsing to a real UUID here binds it as the native type instead, same as path-variable UUIDs. */
  public Object coerceUuidLike(String key, Object value) {
    if (value instanceof String s && key.endsWith("_id") && !s.isBlank()) { try { return UUID.fromString(s); } catch (IllegalArgumentException ignored) { } }
    return value;
  }
}
