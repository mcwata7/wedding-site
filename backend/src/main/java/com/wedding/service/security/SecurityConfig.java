package com.wedding.service.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {
  @Bean SecurityFilterChain securityFilterChain(HttpSecurity http, JwtFilter jwt) throws Exception {
    return http.csrf(c -> c.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'self'")))
      .authorizeHttpRequests(a -> a.requestMatchers("/actuator/health", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**", "/api/v1/auth/**", "/api/v1/guest/sessions", "/api/v1/guest/invitations/lookup", "/api/v1/media/**").permitAll()
        .requestMatchers("/api/v1/internal/**").hasAnyRole("ADMIN", "PLANNER").requestMatchers("/api/v1/guest/**").hasRole("GUEST").anyRequest().denyAll())
      .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class).build();
  }
}
