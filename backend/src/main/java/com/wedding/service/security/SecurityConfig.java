package com.wedding.service.security;

import com.wedding.service.config.AppProperties;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
  // Qualified because Spring MVC's own HandlerMappingIntrospector also implements
  // CorsConfigurationSource, making by-type autowiring here ambiguous.
  @Bean SecurityFilterChain securityFilterChain(HttpSecurity http, JwtFilter jwt, AppProperties props, @Qualifier("corsConfigurationSource") CorsConfigurationSource cors) throws Exception {
    http.csrf(c -> c.disable())
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'self'")))
      .authorizeHttpRequests(a -> a.requestMatchers("/actuator/health", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**", "/api/v1/auth/**", "/api/v1/guest/sessions", "/api/v1/guest/invitations/lookup", "/api/v1/media/**").permitAll()
        // Listed ahead of the general internal rule so it narrows it: clearing a guest-login lock
        // is an ADMIN action, not something any planner can do.
        .requestMatchers(HttpMethod.POST, "/api/v1/internal/parties/*/unlock").hasRole("ADMIN")
        .requestMatchers("/api/v1/internal/**").hasAnyRole("ADMIN", "PLANNER").requestMatchers("/api/v1/guest/**").hasRole("GUEST").anyRequest().denyAll())
      .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class);
    // Only register Spring Security's CORS filter when origins are actually configured. Once
    // registered, it rejects (403) ANY request carrying an Origin header that isn't allow-listed
    // -- including same-origin fetch/XHR requests proxied through nginx/Vite locally, which
    // still send an Origin header. Leaving the filter out entirely when the list is empty
    // (local/Docker Compose) preserves the pre-CORS behavior of ignoring Origin altogether.
    if (!props.cors().allowedOrigins().isEmpty()) {
      http.cors(c -> c.configurationSource(cors));
    }
    return http.build();
  }

  @Bean CorsConfigurationSource corsConfigurationSource(AppProperties props) {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(props.cors().allowedOrigins());
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
