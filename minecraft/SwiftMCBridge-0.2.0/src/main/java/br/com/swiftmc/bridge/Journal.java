package br.com.swiftmc.bridge;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Append-only, fsync'd journal. Replay-safe only with absolute expiry + monotonic sequence. */
public final class Journal {
    private final Path file;
    private final Map<String, String> statuses = new ConcurrentHashMap<>();
    private final Map<UUID,Long> sequences = new ConcurrentHashMap<>();
    public Journal(Path file) throws IOException {
        this.file = file; Files.createDirectories(file.getParent());
        if (Files.exists(file)) for (String line : Files.readAllLines(file)) {
            String[] p=line.split("\\|",-1);
            if (p.length==3 && p[0].equals("D")) statuses.put(p[1],p[2]);
            if (p.length==3 && p[0].equals("S")) {
                try { UUID id=UUID.fromString(p[1]); sequences.merge(id,Long.parseLong(p[2]),Math::max); } catch(Exception ignored) {}
            }
        }
    }
    public synchronized String status(String id) { return statuses.get(id); }
    public synchronized long lastSequence(UUID id) { return sequences.getOrDefault(id,0L); }
    public synchronized void mark(String id,String status) throws IOException {
        write("D|"+id+"|"+status+"\n"); statuses.put(id,status);
    }
    public synchronized void sequence(UUID id,long value) throws IOException {
        if (value > lastSequence(id)) {write("S|"+id+"|"+value+"\n");sequences.put(id,value);}
    }
    private void write(String s) throws IOException {
        try (var channel=java.nio.channels.FileChannel.open(file,StandardOpenOption.CREATE,StandardOpenOption.WRITE,StandardOpenOption.APPEND)) {
            var buf=java.nio.ByteBuffer.wrap(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            while(buf.hasRemaining())channel.write(buf);
            channel.force(true);
        }
    }
}
