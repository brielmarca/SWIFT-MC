package br.com.swiftmc.bridge;

import org.bukkit.Bukkit;
import org.bukkit.command.*;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.Plugin;
import net.luckperms.api.LuckPerms;
import com.swift.cash.SwiftCash;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Sem chave do Stripe no Minecraft; apenas token próprio do Bridge em HTTPS. */
public final class SwiftMCBridge extends JavaPlugin implements CommandExecutor {
    private final ExecutorService worker=Executors.newSingleThreadExecutor(r -> {
        Thread t=new Thread(r,"SwiftMCBridge-HTTP");t.setDaemon(true);return t;});
    private final AtomicBoolean busy=new AtomicBoolean(false);
    private Backend backend;
    private Journal journal;
    private Links links;
    private VipApplier vip;
    private volatile String state="unconfigured";
    private volatile int fails;
    private volatile long nextAttempt;
    private int maxBackoff=600;
    private int pollTask=-1;
    @Override public void onEnable() {
        saveDefaultConfig();
        try {
            journal=new Journal(getDataFolder().toPath().resolve("deliveries.journal"));
            links=new Links(getDataFolder().toPath().resolve("links.tsv"));
            LuckPerms lp=Bukkit.getServicesManager().load(LuckPerms.class);
            if(lp==null)throw new IllegalStateException("LuckPerms não disponível");
            vip=new VipApplier(lp);
            maxBackoff=Math.max(30,getConfig().getInt("maxBackoffSeconds",600));
            if (getConfig().getBoolean("enabled")) {
                var routes=new HashMap<String,String>();
                for(var k:List.of("link","pending","acknowledge"))routes.put(k,getConfig().getString("endpoints."+k,""));
                if(routes.values().stream().anyMatch(String::isBlank))state="rotas API ausentes";
                else {
                    backend=new Backend(getConfig().getString("apiUrl",""),getConfig().getString("apiKey",""),
                         getConfig().getString("serverId","swift-survival"),
                         Math.max(3,getConfig().getInt("httpTimeoutSeconds",12)),routes);
                    state="pronto";
                }
            }
            Objects.requireNonNull(getCommand("link")).setExecutor(this);
            Objects.requireNonNull(getCommand("swiftbridge")).setExecutor(this);
            int ticks=Math.max(15,getConfig().getInt("pollSeconds",30))*20;
            pollTask=Bukkit.getScheduler().scheduleSyncRepeatingTask(this,this::pollAsync,40,ticks);
            getLogger().info("SwiftMCBridge 0.2.0: "+state+" (somente polling HTTPS)");
        } catch(Exception ex) {
            getLogger().severe("Falha inicial: "+ex.getMessage());getServer().getPluginManager().disablePlugin(this);
        }
    }
    @Override public void onDisable(){if(pollTask!=-1)Bukkit.getScheduler().cancelTask(pollTask);worker.shutdown();}
    private void send(CommandSender s, String m){
        if(isEnabled())Bukkit.getScheduler().runTask(this,()->s.sendMessage("§5[SwiftBridge] §f"+m));
    }
    @Override public boolean onCommand(CommandSender sender,Command command,String label,String[] args) {
        if(command.getName().equalsIgnoreCase("link")) {
            if(!(sender instanceof Player player)){sender.sendMessage("Use dentro do Minecraft.");return true;}
            if(args.length!=1 || !args[0].matches("[A-Za-z0-9_-]{15,48}")){
                sender.sendMessage("§eUso: /link CODIGO — gere seu código na conta do site.");return true;
            }
            if(backend==null){sender.sendMessage("§cLoja indisponível: Bridge não configurado.");return true;}
            UUID id=player.getUniqueId();String name=player.getName(),code=args[0];
            sender.sendMessage("§eValidando vínculo seguro com o site...");
            worker.submit(()->{try{
                String account=backend.link(id,name,code);
                links.bind(id,account);
                send(sender,"§aSua conta foi vinculada à loja!");
                pollAsync();
            }catch(Exception ex){getLogger().warning("Vínculo falhou: "+ex.getClass().getSimpleName());
                send(sender,"§cCódigo inválido/expirado ou conta já vinculada. Veja o painel do site.");}});
            return true;
        }
        if(args.length==0 || args[0].equalsIgnoreCase("status")){
            sender.sendMessage("§5[SwiftBridge] §fAPI: "+state+"; falhas: "+fails+"; ocupado: "+busy.get());return true;
        }
        if(args[0].equalsIgnoreCase("poll")){pollAsync();sender.sendMessage("§eConsulta solicitada.");return true;}
        return false;
    }
    private CompletableFuture<Void> apply(Delivery d) {
        if(d.kind()==Delivery.Kind.VIP)return vip.apply(d);
        Plugin installed=getServer().getPluginManager().getPlugin("SwiftCash");
        if(!(installed instanceof SwiftCash cash) || !installed.isEnabled())
            return CompletableFuture.failedFuture(new IllegalStateException("SwiftCash 0.2.0 ausente/inativo"));
        // ID é estável e único: replays nunca duplicam Cash, mesmo após crash entre crédito e journal.
        return cash.cash().credit(d.playerUuid(),d.cashAmount(),"swiftbridge_"+d.deliveryId(),
            "Compra aprovada no site",d.deliveryId()).thenApply(change -> null);
    }
    private void pollAsync() {
        if(backend==null || !busy.compareAndSet(false,true))return;
        if(System.currentTimeMillis()<nextAttempt){busy.set(false);return;}
        worker.submit(()->{try{
            for(Delivery d:backend.pending()){
                if(!d.accountId().equals(links.account(d.playerUuid()))) {
                    getLogger().warning("Compra ignorada: jogador/conta não coincidem, delivery="+d.deliveryId());
                    continue;
                }
                String st=journal.status(d.deliveryId());
                if("ACKED".equals(st))continue;
                if(!"APPLIED".equals(st)){
                    long last=journal.lastSequence(d.playerUuid());
                    if(d.sequence()<last || (d.sequence()==last && !"PROCESSING".equals(st))){
                        getLogger().warning("Entrega obsoleta: "+d.deliveryId());
                        // Backend só deve emitir estado final após confirmação de sequências anteriores.
                        continue;
                    }
                    journal.mark(d.deliveryId(),"PROCESSING");
                    apply(d).get(30,TimeUnit.SECONDS);
                    journal.sequence(d.playerUuid(),d.sequence());
                    journal.mark(d.deliveryId(),"APPLIED");
                    getLogger().info("Entrega aplicada: "+d.deliveryId()+" tipo="+d.kind());
                }
                backend.acknowledge(d);
                journal.mark(d.deliveryId(),"ACKED");
            }
            fails=0;nextAttempt=0;state="conectado";
        }catch(Exception ex){
            fails++;long seconds=Math.min(maxBackoff,30L<<(Math.min(fails-1,4)));
            nextAttempt=System.currentTimeMillis()+seconds*1000;state="retry "+seconds+"s";
            getLogger().warning("Polling sem sucesso (tentará novamente): "+ex.getClass().getSimpleName());
        }finally{busy.set(false);}});
    }
}
