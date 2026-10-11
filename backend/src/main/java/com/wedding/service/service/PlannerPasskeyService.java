package com.wedding.service.service;

import com.wedding.service.api.ApiException;
import com.wedding.service.config.AppProperties;
import com.wedding.service.config.PasskeyProperties;
import com.wedding.service.security.JwtService;
import com.yubico.webauthn.*;
import com.yubico.webauthn.data.*;
import java.net.URI;
import java.nio.ByteBuffer;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** WebAuthn verification is delegated to Yubico; private keys never leave the authenticator. */
@Service
public class PlannerPasskeyService {
  private final DataService db;
  private final PasskeyProperties config;
  private final JwtService jwt;
  private final AppProperties props;
  private final TransactionTemplate transaction;
  public PlannerPasskeyService(DataService db,PasskeyProperties config,JwtService jwt,AppProperties props,PlatformTransactionManager transactions) {
    this.db=db; this.config=config; this.jwt=jwt; this.props=props; this.transaction=new TransactionTemplate(transactions);
  }
  static ByteArray handle(UUID id) {
    return new ByteArray(ByteBuffer.allocate(16).putLong(id.getMostSignificantBits()).putLong(id.getLeastSignificantBits()).array());
  }
  String rpId(String origin) {
    if(origin==null || !config.getAllowedOrigins().contains(origin))
      throw new ApiException(HttpStatus.BAD_REQUEST,"PASSKEY_ORIGIN","Passkeys are not configured for this planner website. Use your password instead.");
    URI uri=URI.create(origin);
    String host=uri.getHost();
    if(host==null || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && "localhost".equals(host))))
      throw new ApiException(HttpStatus.BAD_REQUEST,"PASSKEY_ORIGIN","Passkeys require HTTPS or localhost.");
    return host;
  }
  private RelyingParty relyingParty(String origin) {
    String rp=rpId(origin);
    return RelyingParty.builder().identity(RelyingPartyIdentity.builder().id(rp).name("Wedding Planner").build())
      .credentialRepository(new Credentials(rp)).origins(Set.of(origin)).build();
  }
  private class Credentials implements CredentialRepository {
    private final String rp;
    Credentials(String rp) { this.rp=rp; }
    private List<Map<String,Object>> keys(String clause,Map<String,Object> values) {
      var p=new HashMap<>(values); p.put("rp",rp);
      return db.many("SELECT k.*,u.email FROM planner_passkey k JOIN planner_user u ON u.id=k.planner_id WHERE u.active AND k.rp_id=:rp AND "+clause,p);
    }
    private RegisteredCredential credential(Map<String,Object> row) {
      return RegisteredCredential.builder().credentialId(bytes(row.get("credential_id"))).userHandle(handle(db.id(row.get("planner_id"))))
        .publicKeyCose(bytes(row.get("public_key_cose"))).signatureCount(((Number)row.get("signature_count")).longValue()).build();
    }
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
      Set<PublicKeyCredentialDescriptor> result=new HashSet<>();
      for(var row:keys("u.email=:email",Map.of("email",username))) result.add(PublicKeyCredentialDescriptor.builder().id(bytes(row.get("credential_id"))).build());
      return result;
    }
    public Optional<ByteArray> getUserHandleForUsername(String username) {
      return keys("u.email=:email",Map.of("email",username)).stream().findFirst().map(r->handle(db.id(r.get("planner_id"))));
    }
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
      return keys("true",Map.of()).stream().filter(r->handle(db.id(r.get("planner_id"))).equals(userHandle)).findFirst().map(r->r.get("email").toString());
    }
    public Optional<RegisteredCredential> lookup(ByteArray credentialId,ByteArray userHandle) {
      return keys("k.credential_id=:id",Map.of("id",credentialId.getBase64Url())).stream()
        .filter(r->handle(db.id(r.get("planner_id"))).equals(userHandle)).findFirst().map(this::credential);
    }
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
      var result=new HashSet<RegisteredCredential>();
      keys("k.credential_id=:id",Map.of("id",credentialId.getBase64Url())).forEach(r->result.add(credential(r))); return result;
    }
  }
  private static ByteArray bytes(Object value) {
    try { return ByteArray.fromBase64Url(value.toString()); } catch(Exception e) { throw new IllegalStateException("Invalid stored passkey",e); }
  }
  public boolean hasPasskey(UUID planner,String origin) {
    if(origin==null || !config.getAllowedOrigins().contains(origin)) return false;
    return !db.many("SELECT credential_id FROM planner_passkey WHERE planner_id=:id AND rp_id=:rp",Map.of("id",planner,"rp",rpId(origin))).isEmpty();
  }
  public UUID enrollment(UUID planner) { return saveChallenge(planner,"ENROLLMENT",null,"{}"); }
  private UUID saveChallenge(UUID planner,String kind,String origin,String request) {
    db.named.update("DELETE FROM planner_passkey_challenge WHERE expires_at<=now()",Map.of());
    UUID id=UUID.randomUUID();
    db.named.update("INSERT INTO planner_passkey_challenge(id,planner_id,kind,origin,request_json,expires_at) VALUES(:id,:user,:kind,:origin,:request,now()+interval '5 minutes')",
      new org.springframework.jdbc.core.namedparam.MapSqlParameterSource().addValue("id",id).addValue("user",planner).addValue("kind",kind).addValue("origin",origin).addValue("request",request));
    return id;
  }
  private Map<String,Object> consume(UUID id,String kind,UUID owner) {
    // One DELETE RETURNING makes replay and concurrent finish attempts fail, including bad proofs.
    var params=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource().addValue("id",id).addValue("kind",kind).addValue("owner",owner);
    var rows=db.named.queryForList("DELETE FROM planner_passkey_challenge WHERE id=:id AND kind=:kind AND expires_at>now() AND (cast(:owner as uuid) IS NULL OR planner_id=cast(:owner as uuid)) RETURNING *",params);
    if(rows.isEmpty()) throw invalid("This passkey request expired or was already used. Please try again.");
    return rows.getFirst();
  }
  private static ApiException invalid(String message) { return new ApiException(HttpStatus.BAD_REQUEST,"PASSKEY_INVALID",message); }
  private Object publicKey(String json) throws Exception { return db.json.readTree(json).get("publicKey"); }

  public Map<String,Object> beginLogin(String email,String origin) {
    var rp=relyingParty(origin);
    String normalized=email.trim().toLowerCase(Locale.ROOT);
    var users=db.many("SELECT id,email FROM planner_user WHERE lower(email)=:email AND active",Map.of("email",normalized));
    if(users.isEmpty() || !hasPasskey(db.id(users.getFirst().get("id")),origin)) return Map.of("hasPasskey",false);
    var user=users.getFirst();
    try {
      var request=rp.startAssertion(StartAssertionOptions.builder().username(user.get("email").toString()).userVerification(UserVerificationRequirement.REQUIRED).timeout(60000).build());
      UUID id=saveChallenge(db.id(user.get("id")),"LOGIN",origin,request.toJson());
      return Map.of("hasPasskey",true,"challengeId",id,"publicKey",publicKey(request.toCredentialsGetJson()));
    } catch(Exception e) { throw new IllegalStateException("Unable to start passkey login",e); }
  }
  public Map<String,Object> finishLogin(UUID challengeId,String responseJson) {
    var challenge=consume(challengeId,"LOGIN",null);
    try {
      var result=relyingParty(challenge.get("origin").toString()).finishAssertion(FinishAssertionOptions.builder()
        .request(AssertionRequest.fromJson(challenge.get("request_json").toString()))
        .response(PublicKeyCredential.parseAssertionResponseJson(responseJson)).build());
      UUID planner=db.id(challenge.get("planner_id"));
      if(!result.isSuccess() || !result.getUserHandle().equals(handle(planner))) throw invalid("Passkey sign-in failed. Try again or use your password.");
      var user=db.one("SELECT id,role FROM planner_user WHERE id=:id AND active",Map.of("id",planner));
      // Check again at the write to reject concurrent assertions with stale nonzero counters.
      int changed=db.named.update("UPDATE planner_passkey SET signature_count=:count,last_used_at=now() WHERE credential_id=:id AND planner_id=:user AND (signature_count<:count OR (signature_count=0 AND :count=0))",Map.of("count",result.getSignatureCount(),"id",result.getCredentialId().getBase64Url(),"user",planner));
      if(changed!=1) throw invalid("Passkey sign-in failed. Please try again.");
      return Map.of("accessToken",jwt.create(planner,user.get("role").toString(),null,props.security().plannerSessionMinutes()),"tokenType","Bearer","role",user.get("role"));
    } catch(ApiException e) { throw e; } catch(Exception e) { throw invalid("Passkey sign-in failed. Try again or use your password."); }
  }
  public Map<String,Object> beginRegistration(UUID planner,UUID enrollmentToken,String origin) {
    var rp=relyingParty(origin);
    var proof=db.many("SELECT id FROM planner_passkey_challenge WHERE id=:id AND planner_id=:user AND kind='ENROLLMENT' AND expires_at>now()",Map.of("id",enrollmentToken,"user",planner));
    if(proof.isEmpty()) throw invalid("Please sign in with your password again before setting up a passkey.");
    var user=db.one("SELECT email FROM planner_user WHERE id=:id AND active",Map.of("id",planner));
    try {
      var request=rp.startRegistration(StartRegistrationOptions.builder().user(UserIdentity.builder().name(user.get("email").toString()).displayName(user.get("email").toString()).id(handle(planner)).build())
        .authenticatorSelection(AuthenticatorSelectionCriteria.builder().residentKey(ResidentKeyRequirement.REQUIRED).userVerification(UserVerificationRequirement.REQUIRED).build())
        .timeout(60000).build());
      UUID id=saveChallenge(planner,"REGISTER",origin,request.toJson());
      return Map.of("challengeId",id,"publicKey",publicKey(request.toCredentialsCreateJson()));
    } catch(Exception e) { throw new IllegalStateException("Unable to start passkey setup",e); }
  }
  public Map<String,Object> finishRegistration(UUID planner,UUID challengeId,String responseJson) {
    var challenge=consume(challengeId,"REGISTER",planner);
    try {
      db.one("SELECT id FROM planner_user WHERE id=:id AND active",Map.of("id",planner));
      var result=relyingParty(challenge.get("origin").toString()).finishRegistration(FinishRegistrationOptions.builder()
        .request(PublicKeyCredentialCreationOptions.fromJson(challenge.get("request_json").toString()))
        .response(PublicKeyCredential.parseRegistrationResponseJson(responseJson)).build());
      persistRegistration(planner,rpId(challenge.get("origin").toString()),result);
      return Map.of("registered",true);
    } catch(ApiException e) { throw e; } catch(Exception e) { throw invalid("Passkey setup failed. Please try again."); }
  }
  private void persistRegistration(UUID planner,String rp,RegistrationResult result) {
    transaction.executeWithoutResult(status -> {
      db.named.update("INSERT INTO planner_passkey(credential_id,planner_id,rp_id,public_key_cose,signature_count) VALUES(:id,:user,:rp,:key,:count)",Map.of("id",result.getKeyId().getId().getBase64Url(),"user",planner,"rp",rp,"key",result.getPublicKeyCose().getBase64Url(),"count",result.getSignatureCount()));
      db.audit(planner,"REGISTER","PLANNER_PASSKEY",planner,null,Map.of("rpId",rp));
    });
  }
}
