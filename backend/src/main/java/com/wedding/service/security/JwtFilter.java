package com.wedding.service.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtFilter extends OncePerRequestFilter {
  private final JwtService jwt;
  public JwtFilter(JwtService jwt) { this.jwt = jwt; }
  @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    String auth = request.getHeader("Authorization");
    if (auth != null && auth.startsWith("Bearer ")) try {
      Principal p = jwt.parse(auth.substring(7));
      var token = new UsernamePasswordAuthenticationToken(p, null, java.util.List.of(new SimpleGrantedAuthority("ROLE_" + p.role())));
      SecurityContextHolder.getContext().setAuthentication(token);
    } catch (IllegalArgumentException ignored) { }
    chain.doFilter(request, response);
  }
}
