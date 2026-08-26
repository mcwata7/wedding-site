package com.wedding.service.api;

import com.wedding.service.security.Principal;
import com.wedding.service.service.DataService;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/v1/internal/guests")
public class GuestImportController {
  private final DataService db; GuestImportController(DataService db){this.db=db;}
  private static final List<String> HEADERS=List.of("party_key","party_name","verification_question","verification_answer","first_name","last_name","email","phone","relationship_group","dietary_requirements","accessibility_needs","travel_origin","flight_number","additional_guest");
  @GetMapping(value="/import-template.csv",produces="text/csv") ResponseEntity<String> template(){return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=guest-import-template.csv").body(String.join(",",HEADERS)+"\nsmith-family,Smith Family,What city did the couple meet?,Boston,Alex,Smith,alex@example.com,+15555550123,Family,Vegetarian,,,false\n");}
  @PostMapping(value="/import",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Map<String,Object> importCsv(@AuthenticationPrincipal Principal actor,@RequestPart("file") MultipartFile file) {
    List<String> errors=new ArrayList<>(); List<Map<String,String>> rows=new ArrayList<>();
    try(var reader=new BufferedReader(new InputStreamReader(file.getInputStream(),StandardCharsets.UTF_8))){String first=reader.readLine();if(first==null)throw new ApiException(HttpStatus.BAD_REQUEST,"IMPORT_INVALID","CSV is empty");List<String> header=split(first);for(String needed:List.of("party_key","party_name","verification_question","verification_answer","first_name","last_name"))if(!header.contains(needed))errors.add("CSV is missing required column: "+needed);String line;int number=1;while((line=reader.readLine())!=null){number++;if(line.isBlank())continue;List<String> values=split(line);Map<String,String> row=new HashMap<>();for(int i=0;i<header.size();i++)row.put(header.get(i),i<values.size()?values.get(i).trim():"");row.put("_row",String.valueOf(number));rows.add(row);}}catch(IOException e){throw new ApiException(HttpStatus.BAD_REQUEST,"IMPORT_INVALID","Unable to read CSV");}
    for(var row:rows){for(String needed:List.of("party_key","party_name","verification_question","verification_answer","first_name","last_name"))if(row.getOrDefault(needed,"").isBlank())errors.add("Row "+row.get("_row")+": "+needed+" is required");String email=row.getOrDefault("email","").toLowerCase();if(!email.isBlank()&&db.jdbc.queryForObject("SELECT count(*) FROM guest WHERE lower(email)=? AND active",Integer.class,email)>0)errors.add("Row "+row.get("_row")+": email already belongs to an active guest");}if(rows.isEmpty())errors.add("CSV has no data rows");if(!errors.isEmpty())throw new ApiException(HttpStatus.BAD_REQUEST,"IMPORT_INVALID",String.join("; ",errors));
    Map<String,UUID> parties=new HashMap<>();for(var row:rows){UUID party=parties.get(row.get("party_key"));if(party==null){party=db.uuid();parties.put(row.get("party_key"),party);var p=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource().addValue("id",party).addValue("n",row.get("party_name")).addValue("q",row.get("verification_question")).addValue("a",db.passwords.encode(row.get("verification_answer").trim().toLowerCase()));db.named.update("INSERT INTO party(id,display_name,verification_question,verification_answer_hash) VALUES(:id,:n,:q,:a)",p);}UUID guest=db.uuid();var p=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource().addValue("id",guest).addValue("party",party).addValue("first",row.get("first_name")).addValue("last",row.get("last_name")).addValue("email",blank(row.get("email"))).addValue("phone",blank(row.get("phone"))).addValue("relationship",blank(row.get("relationship_group"))).addValue("dietary",blank(row.get("dietary_requirements"))).addValue("access",blank(row.get("accessibility_needs"))).addValue("origin",blank(row.get("travel_origin"))).addValue("flight",blank(row.get("flight_number"))).addValue("additional",Boolean.parseBoolean(row.getOrDefault("additional_guest","false")));db.named.update("INSERT INTO guest(id,party_id,first_name,last_name,email,phone,relationship_group,dietary_requirements,accessibility_needs,travel_origin,flight_number,is_additional_guest) VALUES(:id,:party,:first,:last,:email,:phone,:relationship,:dietary,:access,:origin,:flight,:additional)",p);db.audit(actor.id(),"IMPORT","GUEST",guest,null,row);}
    return Map.of("partiesCreated",parties.size(),"guestsCreated",rows.size());
  }
  private List<String> split(String line){List<String> result=new ArrayList<>();boolean quoted=false;StringBuilder current=new StringBuilder();for(int i=0;i<line.length();i++){char c=line.charAt(i);if(c=='\"'){if(quoted&&i+1<line.length()&&line.charAt(i+1)=='\"'){current.append(c);i++;}else quoted=!quoted;}else if(c==','&&!quoted){result.add(current.toString());current.setLength(0);}else current.append(c);}result.add(current.toString());return result;}
  private String blank(String value){return value==null||value.isBlank()?null:value;}
}
