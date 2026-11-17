package br.com.swiftmc.bridge;

import java.time.Instant;
import java.util.*;

/** Payload assinado apenas pela API de backend autenticada, nunca pelo navegador. */
public record Delivery(String deliveryId, String accountId, UUID playerUuid,
                       Kind kind, Action action, String vip, long cashAmount,
                       Instant expiresAt, long sequence) {
    private static final Set<String> VIPS=Set.of("swift","eclipse","cosmic","overdrive");
    public enum Kind { VIP, CASH }
    public enum Action { ACTIVATE, REMOVE, CREDIT }
    public Delivery {
        if (deliveryId==null || !deliveryId.matches("[A-Za-z0-9_.:-]{1,128}")) throw new IllegalArgumentException("deliveryId inválido");
        if (accountId==null || !accountId.matches("[A-Za-z0-9_.:-]{1,128}")) throw new IllegalArgumentException("accountId inválido");
        Objects.requireNonNull(playerUuid); Objects.requireNonNull(kind);Objects.requireNonNull(action);
        if (sequence<=0) throw new IllegalArgumentException("sequence inválida");
        if (kind==Kind.VIP) {
            if (action!=Action.ACTIVATE && action!=Action.REMOVE) throw new IllegalArgumentException("ação VIP inválida");
            if (action==Action.ACTIVATE && (!VIPS.contains(vip) || expiresAt==null)) throw new IllegalArgumentException("VIP/expiry inválido");
        } else if (action!=Action.CREDIT || cashAmount<1 || cashAmount>100_000_000L)
            throw new IllegalArgumentException("crédito Cash inválido");
    }
}
