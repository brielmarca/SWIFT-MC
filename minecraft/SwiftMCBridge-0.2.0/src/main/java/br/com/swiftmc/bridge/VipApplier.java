package br.com.swiftmc.bridge;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.node.Node;
import net.luckperms.api.node.types.InheritanceNode;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/** Sempre aplica o estado VIP FINAL absoluto, não comandos de prorrogação. */
public final class VipApplier {
    private static final Set<String> VIPS=Set.of("swift","eclipse","cosmic","overdrive");
    private final LuckPerms lp;
    public VipApplier(LuckPerms lp){this.lp=lp;}
    public CompletableFuture<Void> apply(Delivery d) {
        return lp.getUserManager().loadUser(d.playerUuid()).thenCompose(user -> {
            List<Node> removed=new ArrayList<>();
            for (Node n:user.data().toCollection())
                if(n instanceof InheritanceNode parent && VIPS.contains(parent.getGroupName().toLowerCase(Locale.ROOT)))removed.add(n);
            removed.forEach(user.data()::remove);
            if(d.action()==Delivery.Action.ACTIVATE && d.expiresAt().isAfter(Instant.now()))
                user.data().add(InheritanceNode.builder(d.vip()).expiry(d.expiresAt()).build());
            return lp.getUserManager().saveUser(user);
        });
    }
}
