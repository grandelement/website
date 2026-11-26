package com.grandelement.auto;

import android.content.Context;
import android.graphics.*;
import android.media.audiofx.Visualizer;
import android.view.View;
import java.util.Arrays;

final class SunView extends View {
    private final Bitmap logo;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final float[] history=new float[48*3];
    private final int[] colors={0xff6633ff,0xff33aaff,0xff22ddbb};
    private Visualizer fft;
    private byte[] data;
    private int session=0,quality=0,head=0,active=0;
    private boolean enabled=false;
    private long renderMs=0;
    private final float[] levels=new float[3];
    private final int[] counts=new int[3];
    private final RectF logoRect=new RectF();
    SunView(Context c){super(c);logo=BitmapFactory.decodeResource(getResources(),R.drawable.ge_sun);}
    void enable(boolean on){enabled=on;if(!on){release();Arrays.fill(history,0);active=0;invalidate();}}
    void release(){if(fft!=null){try{fft.release();}catch(Exception ignored){}fft=null;}session=0;}
    boolean sample(int id,boolean playing){
        if(!enabled)return false;
        if(playing&&id>0&&id!=session){
            release();
            try{fft=new Visualizer(id);int[] range=Visualizer.getCaptureSizeRange();int n=Math.min(range[1],Math.max(range[0],256));fft.setCaptureSize(n);data=new byte[n];fft.setEnabled(true);session=id;}catch(Exception e){release();return false;}
        }
        Arrays.fill(levels,0);
        if(playing&&fft!=null&&fft.getFft(data)==Visualizer.SUCCESS){
            int half=data.length/2;Arrays.fill(counts,0);
            for(int i=1;i<half;i++){int band=i<half*.08?0:i<half*.35?1:2;float v=(float)Math.hypot(data[i*2],data[i*2+1])/128f;levels[band]+=v;counts[band]++;}
            for(int j=0;j<3;j++)levels[j]=Math.min(1,levels[j]*3/Math.max(1,counts[j]));
        }
        head=(head+1)%48;for(int k=0;k<3;k++)history[head*3+k]=levels[k];
        if(playing)active=48;else if(active>0)active--;
        if(!playing)release();
        invalidate();return !playing||fft!=null;
    }
    int interval(){return quality==0?200:quality==1?125:100;}
    void setQuality(int q){quality=Math.max(0,Math.min(2,q));}
    int quality(){return quality;}
    long renderTime(){return renderMs;}
    @Override protected void onDraw(Canvas c){
        long start=android.os.SystemClock.uptimeMillis();super.onDraw(c);
        float cx=getWidth()/2f,cy=getHeight()/2f,r=Math.min(cx,cy)*.28f;
        int count=quality==0?16:quality==1?24:48;
        if(enabled&&active>0)for(int i=0;i<count;i++){
            int age=i*48/count;int idx=((head-age+48)%48)*3;
            float a=history[idx],b=history[idx+1],d=history[idx+2],peak=Math.max(a,Math.max(b,d));
            if(peak<.02f)continue;int k=a>=b&&a>=d?0:b>=d?1:2;
            paint.setColor(colors[k]);paint.setAlpha((int)(Math.min(1,peak)*(1-i/(float)count)*210));paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1+peak*2);
            c.drawCircle(cx,cy,r+(Math.min(cx,cy)-r)*i/count,paint);
        }
        paint.setAlpha(255);paint.setStyle(Paint.Style.FILL);
        logoRect.set(cx-r,cy-r,cx+r,cy+r);c.drawBitmap(logo,null,logoRect,paint);
        renderMs=android.os.SystemClock.uptimeMillis()-start;
    }
}
