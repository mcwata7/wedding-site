package com.wedding.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties={"spring.flyway.enabled=false","spring.datasource.url=jdbc:h2:mem:test","wedding.bootstrap-enabled=false"})
class WeddingServiceApplicationTests { @Test void contextLoads() {} }
