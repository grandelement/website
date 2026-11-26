package com.grandelement.auto;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.session.*;
import android.os.*;
import java.util.*;

public class PlaybackService extends Service implements AudioManager.OnAudioFocusChangeListener {
    static final String ACTION="com.grandelement.auto.STATE";
    static final String PLAY="play", TOGGLE="toggle", NEXT="next", PREV="previous", PAUSE="pause", STOP="stop";
    private final IBinder binder=new LocalBinder();
    final class LocalBinder extends Binder { PlaybackService get(){return PlaybackService.this;} }
    private MediaPlayer player;
    private MediaSession session;
    private AudioManager am;
    private AudioFocusRequest focus;
    private boolean ready=false, wanted=false, resumeOnFocus=false;
    private List<Library.Song> songs=new ArrayList<>();
    private int index=-1;
    private String error="";
    private BroadcastReceiver noisy=new BroadcastReceiver(){public void onReceive(Context c,Intent i){pause(false);}};
    @Override public void onCreate(){
        super.onCreate(); am=(AudioManager)getSystemService(AUDIO_SERVICE);
        if(Build.VERSION.SDK_INT>=26){
            getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel("ge_music","GE AUTO playback",NotificationManager.IMPORTANCE_LOW));
            focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes()).setOnAudioFocusChangeListener(this).build();
        }
        session=new MediaSession(this,"GE AUTO");
        session.setCallback(new MediaSession.Callback(){
            public void onPlay(){resume();}
            public void onPause(){pause(false);}
            public void onSkipToNext(){step(1);}
            public void onSkipToPrevious(){step(-1);}
            public void onSeekTo(long pos){seek((int)pos);}
            public void onStop(){stopPlayback();}
        });
        session.setSessionActivity(openApp()); session.setActive(true);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
    }
    AudioAttributes attributes(){return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();}
    @Override public IBinder onBind(Intent intent){return binder;}
    @Override public int onStartCommand(Intent intent,int flags,int id){
        if(intent==null){stopSelf();return START_NOT_STICKY;}
        String action=intent.getAction();
        if(PLAY.equals(action)){foreground();load(intent.getIntExtra("index",-1),0);}
        else if(TOGGLE.equals(action)){if(isPlaying())pause(false);else {foreground();resume();}}
        else if(NEXT.equals(action)){foreground();step(1);}
        else if(PREV.equals(action)){foreground();step(-1);}
        else if(PAUSE.equals(action))pause(false);
        else if(STOP.equals(action))stopPlayback();
        return START_NOT_STICKY;
    }
    void foreground(){startForeground(17,notification());}
    private PendingIntent openApp(){return PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private PendingIntent command(String action,int code){return PendingIntent.getService(this,code,new Intent(this,PlaybackService.class).setAction(action),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private Notification notification(){
        Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"ge_music"):new Notification.Builder(this);
        return b.setSmallIcon(android.R.drawable.ic_media_play).setContentTitle(title()).setContentText("GE AUTO · Offline").setContentIntent(openApp()).setOngoing(isPlaying())
            .addAction(android.R.drawable.ic_media_previous,"Previous",command(PREV,1))
            .addAction(isPlaying()?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,isPlaying()?"Pause":"Play",command(TOGGLE,2))
            .addAction(android.R.drawable.ic_media_next,"Next",command(NEXT,3))
            .setDeleteIntent(command(STOP,4))
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1,2)).build();
    }
    private boolean gain(){return (Build.VERSION.SDK_INT>=26?am.requestAudioFocus(focus):am.requestAudioFocus(this,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN))==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;}
    private void abandon(){if(Build.VERSION.SDK_INT>=26)am.abandonAudioFocusRequest(focus);else am.abandonAudioFocus(this);}
    @Override public void onAudioFocusChange(int change){
        if(change==AudioManager.AUDIOFOCUS_GAIN){if(resumeOnFocus){resumeOnFocus=false;resume();}else if(player!=null)player.setVolume(1,1);}
        else if(change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK){if(player!=null)player.setVolume(.25f,.25f);}
        else if(change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT){resumeOnFocus=wanted||isPlaying();pause(true);}
        else if(change==AudioManager.AUDIOFOCUS_LOSS){resumeOnFocus=false;pause(false);}
    }
    private void releasePlayer(){ready=false;if(player!=null){player.release();player=null;}}
    private void load(int i,int offset){
        save();releasePlayer();songs=Library.songs(this);
        if(songs.isEmpty()){error="Import music first";stopPlayback();return;}
        index=Math.max(0,Math.min(i,songs.size()-1));error="";wanted=true;
        final MediaPlayer p=new MediaPlayer();player=p;
        try{
            p.setAudioAttributes(attributes());p.setWakeMode(this,PowerManager.PARTIAL_WAKE_LOCK);
            p.setDataSource(songs.get(index).file.getAbsolutePath());
            p.setOnPreparedListener(mp->{if(player!=mp)return;ready=true;if(offset>0)mp.seekTo(Math.min(offset,Math.max(0,mp.getDuration()-1)));if(wanted&&gain()){mp.start();}else{wanted=false;stopForeground(false);}publish();});
            p.setOnCompletionListener(mp->{if(player==mp){if(index+1<songs.size())load(index+1,0);else{pause(false);seek(0);}}});
            p.setOnErrorListener((mp,what,extra)->{if(player==mp){error="This audio file could not be played";stopPlayback();}return true;});
            p.prepareAsync();publish();
        }catch(Exception e){error="Cannot open selected music file";stopPlayback();}
    }
    private void resume(){
        if(player==null){
            songs=Library.songs(this);if(songs.isEmpty()){error="Import music first";stopPlayback();return;}
            String path=getSharedPreferences("ge",0).getString("last","");
            int i=0;for(int j=0;j<songs.size();j++)if(songs.get(j).file.getAbsolutePath().equals(path)){i=j;break;}
            foreground();load(i,path.equals(songs.get(i).file.getAbsolutePath())?getSharedPreferences("ge",0).getInt("position",0):0);return;
        }
        wanted=true;if(ready&&gain()){foreground();player.start();}else if(ready){wanted=false;stopForeground(false);}publish();
    }
    private void pause(boolean transientLoss){wanted=false;if(!transientLoss)resumeOnFocus=false;if(ready&&player!=null&&player.isPlaying())player.pause();save();if(!transientLoss){abandon();stopForeground(false);}publish();}
    private void step(int delta){if(songs.isEmpty())songs=Library.songs(this);if(songs.isEmpty()){stopPlayback();return;}load(Math.max(0,Math.min(index+delta,songs.size()-1)),0);}
    void seek(int ms){if(ready&&player!=null){player.seekTo(Math.max(0,Math.min(ms,duration())));save();publish();}}
    boolean isPlaying(){return ready&&player!=null&&player.isPlaying();}
    int position(){return ready&&player!=null?player.getCurrentPosition():0;}
    int duration(){return ready&&player!=null?player.getDuration():0;}
    int audioSession(){return ready&&player!=null?player.getAudioSessionId():0;}
    String title(){return index>=0&&index<songs.size()?songs.get(index).title:"Grand Element";}
    Library.Song current(){return index>=0&&index<songs.size()?songs.get(index):null;}
    String error(){return error;}
    void save(){if(ready&&current()!=null)getSharedPreferences("ge",0).edit().putString("last",current().file.getAbsolutePath()).putInt("position",position()).apply();}
    private void publish(){
        session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title()).putString(MediaMetadata.METADATA_KEY_ARTIST,"Grand Element").putLong(MediaMetadata.METADATA_KEY_DURATION,duration()).build());
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_STOP).setState(isPlaying()?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED,position(),isPlaying()?1:0).build());
        if(isPlaying()||wanted)getSystemService(NotificationManager.class).notify(17,notification());
        sendBroadcast(new Intent(ACTION).setPackage(getPackageName()));
    }
    private void stopPlayback(){save();wanted=false;resumeOnFocus=false;releasePlayer();abandon();stopForeground(true);publish();stopSelf();}
    @Override public void onDestroy(){save();releasePlayer();abandon();unregisterReceiver(noisy);session.release();super.onDestroy();}
}
