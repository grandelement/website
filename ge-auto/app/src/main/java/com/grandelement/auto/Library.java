package com.grandelement.auto;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.os.StatFs;
import java.io.*;
import java.util.*;
import java.security.MessageDigest;

final class Library {
    interface Progress { void update(String message); }
    static final class Song {
        final File file; final String title, album;
        Song(File f, String a) { file=f; title=f.getName().replaceFirst("(?i)\\.[^.]+$",""); album=a; }
        public String toString(){return title+"  ·  "+album;}
    }
    static File root(Context c){File f=new File(c.getFilesDir(),"music"); f.mkdirs(); return f;}
    static boolean isAudio(String name){return name.toLowerCase(Locale.ROOT).matches(".*\\.(mp3|m4a|aac|wav|flac|ogg|opus)$");}
    static boolean isCover(String name){return name.toLowerCase(Locale.ROOT).matches("(cover|folder|front|album|artwork)\\.(jpg|jpeg|png|webp)");}
    static List<Song> songs(Context c){
        ArrayList<Song> songs=new ArrayList<>(); File[] dirs=root(c).listFiles(File::isDirectory);
        if(dirs!=null) for(File dir:dirs){
            File[] tracks=dir.listFiles(f->f.isFile()&&isAudio(f.getName()));
            if(tracks!=null)for(File f:tracks)songs.add(new Song(f,dir.getName()));
        }
        songs.sort(Comparator.comparing((Song s)->s.album,String.CASE_INSENSITIVE_ORDER).thenComparing(s->s.title,String.CASE_INSENSITIVE_ORDER));
        return songs;
    }
    static File cover(Song s){File[] files=s.file.getParentFile().listFiles(f->f.isFile()&&isCover(f.getName()));return files==null||files.length==0?null:files[0];}
    static String safe(String s){String v=s.replaceAll("[^\\p{L}\\p{N} ._()'&-]","_").trim();return v.isEmpty()||v.equals(".")||v.equals("..")?"GE Music":v.substring(0,Math.min(120,v.length()));}
    static int importTree(Context c,Uri tree,Progress progress) throws Exception{
        int[] count={0,0}; String id=DocumentsContract.getTreeDocumentId(tree);
        walk(c,tree,id,"GE Music",0,count,progress);
        return count[0];
    }
    private static void walk(Context c,Uri tree,String id,String album,int depth,int[] count,Progress progress) throws Exception{
        if(depth>12)throw new IOException("Folder nesting exceeds safe limit");
        Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,id);
        String[] cols={DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_SIZE};
        try(Cursor cur=c.getContentResolver().query(children,cols,null,null,null)){
            if(cur==null)throw new IOException("Cannot read selected folder");
            while(cur.moveToNext()){
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
                if(++count[1]>10000)throw new IOException("Import limit reached; select a smaller folder.");
                String child=cur.getString(0), name=cur.getString(1), mime=cur.getString(2);
                if(name==null)continue;
                if(DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)){walk(c,tree,child,safe(name),depth+1,count,progress);continue;}
                if(!isAudio(name)&&!isCover(name))continue;
                long size=cur.isNull(3)?-1:cur.getLong(3);
                if(isCover(name)&&size>8L*1024*1024)continue;
                File dir=new File(root(c),safe(album)); if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create music folder");
                File dest=new File(dir,safe(name));
                if(dest.exists()&&size>=0&&dest.length()==size)continue;
                if(dest.exists())throw new IOException("Conflicting file: "+name+". Existing music preserved.");
                if(size>0&&new StatFs(dir.getPath()).getAvailableBytes()<size+32L*1024*1024)throw new IOException("Not enough radio storage");
                Uri source=DocumentsContract.buildDocumentUriUsingTree(tree,child);
                File tmp=File.createTempFile("import-",".part",dir);
                try(InputStream in=c.getContentResolver().openInputStream(source);OutputStream out=new FileOutputStream(tmp)){
                    if(in==null)throw new IOException("Cannot open "+name);
                    byte[] buffer=new byte[32768];int n; long written=0;
                    while((n=in.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException(); written+=n;if(isCover(name)&&written>8L*1024*1024)throw new IOException("Artwork exceeds safe import limit");out.write(buffer,0,n);}
                    if(written==0||(size>=0&&written!=size))throw new IOException("Incomplete file: "+name);
                }catch(Exception e){tmp.delete();throw e;}
                if(!tmp.renameTo(dest)){tmp.delete();throw new IOException("Cannot save "+name);}
                if(isAudio(name))count[0]++;
                progress.update("Imported "+count[0]+" songs · "+name);
            }
        }
    }
}
