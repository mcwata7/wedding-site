package com.wedding.service.api;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component @Order(1)
public class RequestIdFilter implements Filter {
 public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException { String id = UUID.randomUUID().toString(); req.setAttribute("requestId", id); ((HttpServletResponse)res).setHeader("X-Request-Id", id); chain.doFilter(req,res); }
}
