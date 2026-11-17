package br.com.swiftmc.bridge;

import com.google.gson.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

public final class Backend {
    private final HttpClient http;
    private final String base,key,server;
    private final int timeout;
    private final Map<String,String> paths;
    public Backend(String base,String key,String server,int timeout,Map<String,String> paths){
        if(base==null || !base.startsWith("https://"))throw new IllegalArgumentException("apiUrl deve usar HTTPS");
        if(key==null || key.length()<32 || key.contains("TROQUE"))throw new IllegalArgumentException("apiKey segura necessária");
        this.base=base.replaceAll("/+$","");this.key=key;this.server=server;this.timeout=timeout;this.paths=Map.copyOf(paths);
        http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(timeout)).followRedirects(HttpClient.Redirect.NEVER).build();
    }
    private JsonElement request(String name, String method, JsonObject body) throws Exception {
        String route=paths.get(name);
        if(route==null || route.isBlank() || !route.startsWith("/") || route.startsWith("//") || route.contains("..") || route.contains("?"))
            throw new IllegalStateException("Rota ausente: "+name);
        var b=HttpRequest.newBuilder(URI.create(base+route)).timeout(Duration.ofSeconds(timeout))
            .header("Authorization","Bearer "+key).header("Accept","application/json").header("X-Swift-Server",server);
        if(method.equals("GET"))b.GET();
        else b.header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8));
        var resp=http.send(b.build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        // Idempotent ACK: only a confirmed duplicate acknowledgment (HTTP 409 from SwiftMC website contract)
        // is treated as successful. Other conflicts/errors must fail so local journal is not falsely ACKed.
        if("acknowledge".equals(name) && resp.statusCode()==409) {
            try {
                var conflict = JsonParser.parseString(resp.body()).getAsJsonObject();
                if(conflict.has("ok") && conflict.get("ok").getAsBoolean() && conflict.has("duplicate") && conflict.get("duplicate").getAsBoolean())
                    return conflict;
            } catch(Exception ignored) {}
            throw new IllegalStateException("HTTP 409 em "+name+" (não confirmado como ACK duplicado)");
        }
        if(resp.statusCode()<200 || resp.statusCode()>=300)throw new IllegalStateException("HTTP "+resp.statusCode()+" em "+name);
        return JsonParser.parseString(resp.body());
    }
    public String link(UUID uuid,String nickname,String code) throws Exception {
        JsonObject payload=new JsonObject();payload.addProperty("serverId",server);payload.addProperty("playerUuid",uuid.toString());
        payload.addProperty("nickname",nickname);payload.addProperty("code",code);
        return request("link","POST",payload).getAsJsonObject().get("accountId").getAsString();
    }
    public List<Delivery> pending() throws Exception {
        var root=request("pending","GET",null).getAsJsonObject();
        var arr=root.getAsJsonArray("deliveries");if(arr==null)throw new IllegalStateException("deliveries ausentes");
        if(arr.size()>200)throw new IllegalStateException("Lote de entregas grande demais");
        var output=new ArrayList<Delivery>();
        for(var element:arr){
            var x=element.getAsJsonObject();
            var kind=Delivery.Kind.valueOf(x.get("kind").getAsString().toUpperCase(Locale.ROOT));
            var action=Delivery.Action.valueOf(x.get("action").getAsString().toUpperCase(Locale.ROOT));
            String vip=x.has("vip")&&!x.get("vip").isJsonNull()?x.get("vip").getAsString():null;
            Instant end=x.has("expiresAt")&&!x.get("expiresAt").isJsonNull()?Instant.parse(x.get("expiresAt").getAsString()):null;
            long amount=x.has("cashAmount")&&!x.get("cashAmount").isJsonNull()?x.get("cashAmount").getAsLong():0;
            output.add(new Delivery(x.get("deliveryId").getAsString(),x.get("accountId").getAsString(),
                 UUID.fromString(x.get("playerUuid").getAsString()),kind,action,vip,amount,end,x.get("sequence").getAsLong()));
        }
        output.sort(Comparator.comparing(Delivery::playerUuid).thenComparingLong(Delivery::sequence));
        return output;
    }
    public void acknowledge(Delivery d) throws Exception {
        var payload=new JsonObject();payload.addProperty("serverId",server);payload.addProperty("deliveryId",d.deliveryId());
        payload.addProperty("status","completed");payload.addProperty("sequence",d.sequence());
        request("acknowledge","POST",payload);
    }
}
