import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Pause,Play,Quote} from 'lucide-react';
import type {Review} from '../config';
import {useReducedMotion} from '../hooks/usePageMotion';
import {wrapLoopOffset} from '../utils/carousel';

function ReviewCard({review,hidden=false}:{review:Review;hidden?:boolean}){
  return <article className="review-card" aria-hidden={hidden||undefined} inert={hidden||undefined}>
    <div className="review-top"><span className="stars" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span><Quote size={24} aria-hidden="true"/></div>
    <p className="review-comment" tabIndex={hidden?-1:0}>{review.comment}</p>
    <div className="review-author">{review.image?<img src={review.image} alt="Fotografía autorizada del trabajo" loading="lazy" draggable={false}/>:<span className="review-avatar" aria-hidden="true">{review.name.slice(0,1)}</span>}<div><strong>{review.name}</strong>{review.created&&<time dateTime={review.created}>{new Date(review.created).toLocaleDateString('es-CL')}</time>}</div></div>
    {review.response&&<p className="review-response"><strong>Vibrados Lagunilla</strong>{review.response}</p>}
  </article>;
}

export default function ReviewsCarousel({reviews}:{reviews:Review[]}){
  const viewport=useRef<HTMLDivElement>(null),group=useRef<HTMLDivElement>(null);
  const interaction=useRef({hover:false,focus:false,drag:false,idleUntil:0,pointerUntil:0,x:0,left:0});
  const [paused,setPaused]=useState(false);
  const pausedRef=useRef(paused);pausedRef.current=paused;
  const reduced=useReducedMotion(),loop=reviews.length>1&&!reduced;
  // Each identical group fills the viewport, including when only two reviews exist.
  const repeated=reviews.length>1?Array.from({length:Math.max(1,Math.ceil(4/reviews.length))},()=>reviews).flat():reviews;
  useEffect(()=>{
    const el=viewport.current,batch=group.current;if(!el||!batch||!loop)return;
    let width=batch.getBoundingClientRect().width,frame=0,last=0,position=width;
    el.scrollLeft=position;
    const resize=new ResizeObserver(()=>{const next=batch.getBoundingClientRect().width;position=width?el.scrollLeft/width*next:next;width=next;el.scrollLeft=position});resize.observe(batch);
    const tick=(now:number)=>{
      const delta=last?Math.min(now-last,50):0;last=now;
      if(!document.hidden){
        const state=interaction.current;
        if(!pausedRef.current&&!state.hover&&!state.focus&&!state.drag&&now>state.idleUntil){
          // One complete group in at least 32 seconds; cap speed for readability.
          position+=Math.min(width/32,42)*delta/1000;
        }else position=el.scrollLeft;
        if(!state.drag)position=wrapLoopOffset(position,width);
        el.scrollLeft=position;
      }
      frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);resize.disconnect()};
  },[loop,reviews.length]);
  function step(direction:number){const el=viewport.current;if(!el)return;interaction.current.idleUntil=performance.now()+5000;el.scrollLeft+=direction*((el.querySelector('article')?.getBoundingClientRect().width||300)+20)}
  return <div className="carousel" role="region" aria-roledescription="carrusel" aria-label="Reseñas de clientes">
    <div className="carousel-controls"><span>{reduced?'Desliza para leer las reseñas':'Desliza para explorar · pausa al leer'}</span><div>
      {reviews.length>1&&<><button className="icon-button" aria-label="Reseña anterior" onClick={()=>step(-1)}><ChevronLeft size={19}/></button><button className="icon-button" aria-label="Reseña siguiente" onClick={()=>step(1)}><ChevronRight size={19}/></button></>}
      {loop&&<button className="carousel-pause" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Reanudar':'Pausar'}</button>}
    </div></div>
    <div className={`carousel-viewport ${loop?'is-loop':''}`} ref={viewport} tabIndex={0} aria-label="Reseñas. Usa las flechas para desplazarte."
      onMouseEnter={()=>{interaction.current.hover=true}} onMouseLeave={()=>{interaction.current.hover=false}}
      onFocusCapture={()=>{interaction.current.focus=performance.now()>interaction.current.pointerUntil}} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))interaction.current.focus=false}}
      onWheel={()=>{interaction.current.idleUntil=performance.now()+3000}}
      onKeyDown={e=>{interaction.current.focus=true;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1)}}}
      onPointerDown={e=>{if(e.button!==0)return;const state=interaction.current;state.pointerUntil=performance.now()+1000;state.focus=false;state.drag=true;state.x=e.clientX;state.left=e.currentTarget.scrollLeft;if(e.pointerType==='mouse')e.currentTarget.setPointerCapture(e.pointerId)}}
      onPointerMove={e=>{if(interaction.current.drag&&e.pointerType==='mouse')e.currentTarget.scrollLeft=interaction.current.left-(e.clientX-interaction.current.x)}}
      onPointerUp={e=>{interaction.current.drag=false;interaction.current.idleUntil=performance.now()+3000;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
      onPointerCancel={()=>{interaction.current.drag=false;interaction.current.idleUntil=performance.now()+3000}}>
      <div className="carousel-track">
        {loop?<>{[0,1,2].map(copy=><div className="carousel-group" key={copy} ref={copy===0?group:undefined} aria-hidden={copy!==1||undefined}>{repeated.map((r,index)=><ReviewCard key={`${r.id}-${index}`} review={r} hidden={copy!==1||index>=reviews.length}/>)}</div>)}</>:<div className="carousel-group">{reviews.map(r=><ReviewCard key={r.id} review={r}/>)}</div>}
      </div>
    </div>
  </div>;
}
