package com.grandelement.auto;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.File;
import java.util.*;

public class MainActivity extends Activity {
    private final Handler ui=new Handler(Looper.getMainLooper());
    private PlaybackService playback;
    private boolean bound=false,visible=false,dragging=false,importing=false,eq=false;
    private long lastSample=0,lastRefresh=0;private int frames=0,slow=0;
    private SunView sun;
    private TextView title,status,time,storage;
    private Button play,eqButton,importButton;
    private SeekBar seek;
    private ListView list;
    private ImageView artwork;
    private String lastArt="",lastTrack="";
    private List<Library.Song> songs=new ArrayList<>();
    private final ServiceConnection connection=new ServiceConnection(){
        public void onServiceConnected(ComponentName n,IBinder b){playback=((PlaybackService.LocalBinder)b).get();bound=true;refresh();}
        public void onServiceDisconnected(ComponentName n){bound=false;playback=null;}
    };
    private final Runnable tick=new Runnable(){public void run(){
        if(!visible)return;
        long now=SystemClock.uptimeMillis();
        if(now-lastRefresh>=500){lastRefresh=now;refresh();}
        if(eq&&playback!=null&&now-lastSample>=sun.interval()){
            long delay=now-lastSample;lastSample=now;
            if(!sun.sample(playback.audioSession(),playback.isPlaying())){setEq(false);status.setText("EQ unavailable on this radio · music remains active");}
            else if(playback.isPlaying()){
                if(sun.renderTime()>25||delay>sun.interval()*2L){slow++;frames=0;}else{frames++;slow=Math.max(0,slow-1);}
                if(slow>=4){if(sun.quality()>0)sun.setQuality(sun.quality()-1);else{setEq(false);status.setText("EQ paused to protect playback");}slow=0;}
                else if(frames>=100&&sun.quality()<2){sun.setQuality(sun.quality()+1);frames=0;}
            }
        }
        ui.postDelayed(this,100);
    }};
    private int dp(float v){return Math.round(v*getResources().getDisplayMetrics().density);}
    private TextView label(String s,int size){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(0xffe8f4ff);t.setGravity(Gravity.CENTER);return t;}
    private Button button(String text,Runnable action){Button b=new Button(this);b.setText(text);b.setMinHeight(dp(48));b.setOnClickListener(v->action.run());return b;}
    private void command(String action,int index){Intent i=new Intent(this,PlaybackService.class).setAction(action).putExtra("index",index);if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i);}
    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(8),dp(4),dp(8),dp(4));root.setBackgroundColor(0xff071321);setContentView(root);
        root.addView(label("GE AUTO  ·  OFFLINE",18));
        LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.HORIZONTAL);root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout player=new LinearLayout(this);player.setOrientation(LinearLayout.VERTICAL);body.addView(player,new LinearLayout.LayoutParams(0,-1,1));
        sun=new SunView(this);player.addView(sun,new LinearLayout.LayoutParams(-1,0,1));
        title=label("Grand Element",18);player.addView(title);
        seek=new SeekBar(this);seek.setMax(1000);player.addView(seek);time=label("0:00 / 0:00",12);player.addView(time);
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar s){dragging=true;}public void onProgressChanged(SeekBar s,int p,boolean user){}public void onStopTrackingTouch(SeekBar s){if(playback!=null)playback.seek((int)((long)playback.duration()*s.getProgress()/1000));dragging=false;}});
        LinearLayout controls=new LinearLayout(this);player.addView(controls);
        controls.addView(button("PREV",()->command(PlaybackService.PREV,-1)),new LinearLayout.LayoutParams(0,-2,1));
        play=button("PLAY",()->command(PlaybackService.TOGGLE,-1));controls.addView(play,new LinearLayout.LayoutParams(0,-2,1));
        controls.addView(button("NEXT",()->command(PlaybackService.NEXT,-1)),new LinearLayout.LayoutParams(0,-2,1));
        eqButton=button("EQ EFFECTS · OFF",()->{if(eq)setEq(false);else if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},44);else setEq(true);});player.addView(eqButton);
        LinearLayout library=new LinearLayout(this);library.setOrientation(LinearLayout.VERTICAL);body.addView(library,new LinearLayout.LayoutParams(0,-1,1));
        artwork=new ImageView(this);artwork.setScaleType(ImageView.ScaleType.FIT_CENTER);artwork.setVisibility(View.GONE);library.addView(artwork,new LinearLayout.LayoutParams(-1,dp(80)));
        list=new ListView(this);library.addView(list,new LinearLayout.LayoutParams(-1,0,1));list.setOnItemClickListener((p,v,i,id)->{if(!importing)command(PlaybackService.PLAY,i);});
        importButton=button("IMPORT MUSIC / USB",()->{if(!importing){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);try{startActivityForResult(i,41);}catch(ActivityNotFoundException e){status.setText("Radio has no compatible folder picker");}}});library.addView(importButton);
        storage=label("",12);library.addView(storage);
        status=label("Select a local music folder while parked.",12);root.addView(status);
        reload();bindService(new Intent(this,PlaybackService.class),connection,BIND_AUTO_CREATE);
    }
    private void setEq(boolean on){eq=on;sun.enable(on);sun.setQuality(0);lastSample=0;frames=slow=0;eqButton.setText("EQ EFFECTS · "+(on?"ON (PARKED)":"OFF"));}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==44&&grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)setEq(true);}
    @Override protected void onStart(){super.onStart();visible=true;ui.post(tick);}
    @Override protected void onStop(){visible=false;ui.removeCallbacks(tick);sun.release();if(playback!=null)playback.save();super.onStop();}
    @Override protected void onDestroy(){if(bound)unbindService(connection);super.onDestroy();}
    private String clock(int ms){int s=ms/1000;return String.format(Locale.ROOT,"%d:%02d",s/60,s%60);}
    private void refresh(){
        if(playback==null)return;
        title.setText(playback.title());play.setText(playback.isPlaying()?"PAUSE":"PLAY");
        int d=playback.duration(),p=playback.position();if(!dragging)seek.setProgress(d==0?0:(int)((long)p*1000/d));
        time.setText(clock(p)+" / "+clock(d));
        if(!playback.error().isEmpty())status.setText(playback.error());
        Library.Song current=playback.current();String track=current==null?"":current.file.getAbsolutePath();
        if(track.equals(lastTrack))return;lastTrack=track;
        File cover=current==null?null:Library.cover(current);
        String path=cover==null?"":cover.getAbsolutePath();
        if(!path.equals(lastArt)){lastArt=path;artwork.setImageDrawable(null);artwork.setVisibility(View.GONE);if(cover!=null){BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;BitmapFactory.decodeFile(path,o);o.inJustDecodeBounds=false;o.inSampleSize=1;while(Math.max(o.outWidth,o.outHeight)/o.inSampleSize>256)o.inSampleSize*=2;Bitmap bitmap=BitmapFactory.decodeFile(path,o);if(bitmap!=null){artwork.setImageBitmap(bitmap);artwork.setVisibility(View.VISIBLE);}}}
    }
    private void reload(){songs=Library.songs(this);list.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_list_item_1,songs));long free=new StatFs(Library.root(this).getPath()).getAvailableBytes();storage.setText(songs.size()+" songs · "+(free/(1024*1024))+" MB free");}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(request!=41||result!=RESULT_OK||data==null||data.getData()==null||importing)return;
        final Uri tree=data.getData();importing=true;importButton.setEnabled(false);status.setText("Importing to radio storage…");
        // Keep import separate from the audio and UI threads; one file and a 32 KiB buffer at a time.
        new Thread(()->{String message;try{int count=Library.importTree(this,tree,s->runOnUiThread(()->status.setText(s)));message="Imported "+count+" new songs. Music is stored on this radio.";}catch(Exception e){message="Import stopped: "+e.getMessage();}final String done=message;runOnUiThread(()->{if(isDestroyed())return;importing=false;importButton.setEnabled(true);reload();status.setText(done);});},"ge-import").start();
    }
}
