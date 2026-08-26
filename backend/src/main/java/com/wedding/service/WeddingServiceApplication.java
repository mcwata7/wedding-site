package com.wedding.service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WeddingServiceApplication {
  public static void main(String[] args) { SpringApplication.run(WeddingServiceApplication.class, args); }
}
