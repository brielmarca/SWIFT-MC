package br.com.swiftmc.bridge;

import java.io.*;
import java.nio.file.*;
import java.util.*;

/** UUID <-> stable backend account ID. Never keyed by nickname. */
public final class Links {
    private final Path file;
    private final Map<UUID,String> linked = new HashMap<>();
    public Links(Path file) throws IOException {
        this.file=file;Files.createDirectories(file.getParent());
        if(Files.exists(file)) for(String line:Files.readAllLines(file)) {
            String[] pair=line.split("\\t",2);
            if(pair.length==2)try{linked.put(UUID.fromString(pair[0]),pair[1]);}catch(Exception ignored){}
        }
    }
    public synchronized String account(UUID uuid){return linked.get(uuid);}
    public synchronized UUID player(String account){return linked.entrySet().stream().filter(e->e.getValue().equals(account)).map(Map.Entry::getKey).findFirst().orElse(null);}
    public synchronized void bind(UUID uuid,String account) throws IOException {
        if(account==null || !account.matches("[A-Za-z0-9_:.\\-]{1,128}")) throw new IllegalArgumentException("invalid account");
        var existing=linked.get(uuid);
        if(existing!=null&&!existing.equals(account))throw new SecurityException("UUID already linked; manual unlink required");
        var owner=player(account);
        if(owner!=null&&!owner.equals(uuid))throw new SecurityException("account already linked to another UUID");
        var copy=new HashMap<>(linked);copy.put(uuid,account);
        Path tmp=file.resolveSibling(file.getFileName()+".tmp");
        var lines=copy.entrySet().stream().map(e->e.getKey()+"\t"+e.getValue()).sorted().toList();
        Files.write(tmp,lines);try{Files.move(tmp,file,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
        catch(AtomicMoveNotSupportedException e){Files.move(tmp,file,StandardCopyOption.REPLACE_EXISTING);}
        linked.clear();linked.putAll(copy);
    }
}
