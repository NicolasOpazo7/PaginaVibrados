import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight,Pause,Play} from 'lucide-react';
import {useReducedMotion} from '../hooks/usePageMotion';
import {wrapLoopOffset} from '../utils/carousel';

export default function ProjectCarousel({count,identity,modalOpen,renderCard}:{count:number;identity:string;modalOpen:boolean;renderCard:(index:number,hidden:boolean)=>ReactNode}){
  const viewport=useRef<HTMLDivElement>(null),group=useRef<HTMLDivElement>(null);
  const [paused,setPaused]=useState(false);
  const reduced=useReducedMotion(),loop=count>1&&!reduced;
  const state=useRef({paused,modalOpen,hover:false,focus:false,idleUntil:0,visible:false});
  state.current.paused=paused;state.current.modalOpen=modalOpen;
  useEffect(()=>{
    const el=viewport.current,batch=group.current;if(!el)return;
    el.scrollLeft=0;
    if(!loop||!batch)return;
    let width=batch.getBoundingClientRect().width,position=width,last=0,frame=0;
    el.scrollLeft=position;
    const resize=new ResizeObserver(()=>{
      const next=batch.getBoundingClientRect().width;
      position=width?el.scrollLeft/width*next:next;width=next;el.scrollLeft=position;
    });resize.observe(batch);
    const visibility=new IntersectionObserver(entries=>{state.current.visible=entries[0].isIntersecting});visibility.observe(el);
    const tick=(now:number)=>{
      const delta=last?Math.min(now-last,50):0;last=now;
      const current=state.current;
      if(!document.hidden&&current.visible){
        if(!current.paused&&!current.modalOpen&&!current.hover&&!current.focus&&now>current.idleUntil)position+=36*delta/1000;
        else position=el.scrollLeft;
        position=wrapLoopOffset(position,width);el.scrollLeft=position;
      }
      frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);resize.disconnect();visibility.disconnect()};
  },[loop,identity]);
  function step(direction:number){
    const el=viewport.current;if(!el)return;
    state.current.idleUntil=performance.now()+4000;
    el.scrollLeft+=direction*((el.querySelector('.project')?.getBoundingClientRect().width||300)+20);
  }
  const indices=Array.from({length:loop?Math.max(count,4):count},(_,i)=>i%count);
  return <div className="project-carousel" role="region" aria-roledescription="carrusel" aria-label="Nuestros trabajos">
    <div className="carousel-controls"><span>{count} trabajos · Fotos y videos</span><div>
      {count>1&&<><button className="icon-button" aria-label="Trabajo anterior" onClick={()=>step(-1)}><ChevronLeft size={19}/></button><button className="icon-button" aria-label="Trabajo siguiente" onClick={()=>step(1)}><ChevronRight size={19}/></button></>}
      {loop&&<button className="carousel-pause" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Reanudar':'Pausar'}</button>}
    </div></div>
    <div className={`carousel-viewport ${loop?'is-loop':''}`} ref={viewport} tabIndex={0} aria-label="Fotos y videos de trabajos. Usa las flechas para desplazarte."
      onMouseEnter={()=>{state.current.hover=true}} onMouseLeave={()=>{state.current.hover=false}}
      onFocusCapture={()=>{state.current.focus=true}} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))state.current.focus=false}}
      onWheel={()=>{state.current.idleUntil=performance.now()+4000}} onTouchStart={()=>{state.current.idleUntil=Infinity}} onTouchEnd={()=>{state.current.idleUntil=performance.now()+4000}} onTouchCancel={()=>{state.current.idleUntil=performance.now()+4000}}
      onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1)}}}>
      <div className="carousel-track">{(loop?[0,1,2]:[1]).map(copy=><div className="carousel-group" key={copy} ref={copy===(loop?0:1)?group:undefined} aria-hidden={copy!==1||undefined}>
        {indices.map((index,i)=><div className="project-slide" key={i}>{renderCard(index,copy!==1||i>=count)}</div>)}
      </div>)}</div>
    </div>
  </div>;
}
