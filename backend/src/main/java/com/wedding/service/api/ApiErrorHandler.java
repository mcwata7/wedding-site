package com.wedding.service.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiErrorHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiErrorHandler.class);
  @ExceptionHandler(ApiException.class) ResponseEntity<Map<String,Object>> api(ApiException e, HttpServletRequest r) { return ResponseEntity.status(e.status).body(Map.of("code", e.code, "message", e.getMessage(), "requestId", r.getAttribute("requestId") == null ? "" : r.getAttribute("requestId"))); }
  @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<Map<String,Object>> validation(MethodArgumentNotValidException e, HttpServletRequest r) { var errors=e.getBindingResult().getFieldErrors().stream().map(f->Map.of("field",f.getField(),"message",f.getDefaultMessage()==null?"Invalid value":f.getDefaultMessage())).toList(); return ResponseEntity.badRequest().body(Map.of("code","VALIDATION_ERROR","message","One or more fields are invalid","errors",errors,"requestId",r.getAttribute("requestId") == null ? "" : r.getAttribute("requestId"))); }
  @ExceptionHandler(Exception.class) ResponseEntity<Map<String,Object>> other(Exception e, HttpServletRequest r) { log.error("Unhandled exception on {} {}", r.getMethod(), r.getRequestURI(), e); return ResponseEntity.internalServerError().body(Map.of("code", "INTERNAL_ERROR", "message", "An unexpected error occurred", "requestId", r.getAttribute("requestId") == null ? "" : r.getAttribute("requestId"))); }
}
