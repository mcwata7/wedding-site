package com.wedding.service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.wedding.service.config.AppProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class FxRateService {
 private static final Logger log=LoggerFactory.getLogger(FxRateService.class); private final DataService db; private final AppProperties props; private final RestClient client=RestClient.create("https://api.frankfurter.dev");
 FxRateService(DataService db,AppProperties props){this.db=db;this.props=props;}
 @Scheduled(cron="0 15 2 * * *") public void capture(){if(!props.fx().enabled())return; try {String base=props.fx().baseCurrency().toUpperCase();JsonNode result=client.get().uri("/v1/latest?base={base}",base).retrieve().body(JsonNode.class);LocalDate date=LocalDate.parse(result.path("date").asText());result.path("rates").fields().forEachRemaining(e->db.named.update("INSERT INTO fx_rate_snapshot(base_currency,quote_currency,rate,rate_date,source) VALUES(:b,:q,:r,:d,'Frankfurter') ON CONFLICT DO NOTHING",Map.of("b",base,"q",e.getKey(),"r",new BigDecimal(e.getValue().asText()),"d",date))); log.info("Captured FX rates for {}",date);}catch(Exception e){log.error("FX rate update failed; retaining prior snapshots",e);}}
}
